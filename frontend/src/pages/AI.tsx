import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  Battery,
  BatteryCharging,
  BrainCircuit,
  CalendarClock,
  CarFront,
  CheckCircle2,
  Clock3,
  Gauge,
  MapPin,
  MessageCircle,
  Minus,
  PlugZap,
  Plus,
  Route,
  Timer
} from 'lucide-react';
import Chatbot from '../components/Chatbot';
import VoiceAssistant from '../components/VoiceAssistant';
import { buildChargingPlan, buildGeminiChargingPredictionPayload, buildManagedChargingCalendarEvent, formatPlanDateTime, formatPlanTimeRange, managedChargingEventId, type ChargingModePreference, type ChargingOptionPlan, type GeminiChargingDecision } from '../lib/chargingAgents';
import { buildScheduleDistanceResults } from '../lib/scheduleDistanceAgent';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useCalendarViewStore } from '../store/useCalendarViewStore';

const agentIcons = [CalendarClock, Gauge, Clock3, PlugZap, CheckCircle2, MessageCircle];
const targetChargeOptions = [60, 70, 80, 90, 100];
const minTargetCharge = 50;
const maxTargetCharge = 100;

function statusClass(status: 'ready' | 'watch' | 'action') {
  if (status === 'action') return 'border-amber-500/25 bg-amber-950/60 text-amber-500';
  if (status === 'watch') return 'border-blue-300/35 bg-blue-950/70 text-blue-500';
  return 'border-emerald-300/30 bg-emerald-950/70 text-emerald-500';
}

function trafficClass(traffic: string) {
  if (traffic === 'heavy') return 'text-rose-500 bg-rose-950/70 border-rose-300/25';
  if (traffic === 'moderate') return 'text-amber-500 bg-amber-950/70 border-amber-300/25';
  return 'text-emerald-500 bg-emerald-950/70 border-emerald-300/25';
}

function formatChargeDuration(minutes: number | null) {
  if (minutes === null) return 'Not modeled';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function routeSourceLabel(source: string) {
  if (source === 'known-real-world') return 'Real route';
  if (source === 'coordinate-estimated') return 'Live estimate';
  return 'Estimate';
}

function calendarEventChanged(current: ReturnType<typeof buildManagedChargingCalendarEvent>, next: ReturnType<typeof buildManagedChargingCalendarEvent>) {
  if (!current || !next) return true;
  const currentDate = current.date instanceof Date ? current.date : new Date(current.date);
  const nextDate = next.date instanceof Date ? next.date : new Date(next.date);

  return current.title !== next.title
    || current.location !== next.location
    || current.time !== next.time
    || current.endTime !== next.endTime
    || currentDate.getTime() !== nextDate.getTime()
    || current.aiReason !== next.aiReason
    || current.notes !== next.notes
    || JSON.stringify(current.chargingMeta) !== JSON.stringify(next.chargingMeta);
}

function optionLabel(option: ChargingOptionPlan) {
  return option.start && option.end ? formatPlanTimeRange(option.start, option.end) : 'No matching free slot';
}

export default function AI() {
  const { events, vehicle, weather, calendarRevision, addEvent, updateEvent } = useAppStore();
  const selectedDate = useCalendarViewStore((state) => state.selectedDate);
  const [targetCharge, setTargetCharge] = useState(80);
  const [chargingPreference, setChargingPreference] = useState<ChargingModePreference>('auto');
  const [geminiDecision, setGeminiDecision] = useState<GeminiChargingDecision | undefined>();
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback' | 'error'>('idle');
  const candidatePlan = useMemo(() => buildChargingPlan(events, vehicle, weather, targetCharge, selectedDate, chargingPreference), [events, vehicle, weather, targetCharge, selectedDate, chargingPreference, calendarRevision]);
  const geminiPayload = useMemo(() => buildGeminiChargingPredictionPayload(candidatePlan, chargingPreference), [candidatePlan, chargingPreference]);
  const geminiPayloadSignature = useMemo(() => JSON.stringify(geminiPayload), [geminiPayload]);
  const plan = useMemo(() => buildChargingPlan(events, vehicle, weather, targetCharge, selectedDate, chargingPreference, geminiDecision), [events, vehicle, weather, targetCharge, selectedDate, chargingPreference, geminiDecision, calendarRevision]);
  const managedChargingEvent = useMemo(() => events.find((event) => event.id === managedChargingEventId) ?? null, [events, calendarRevision]);
  const scheduleDistances = useMemo(() => buildScheduleDistanceResults(events, plan.planningStart), [events, plan.planningStart, calendarRevision]);
  const highlightedDistance = scheduleDistances.find((result) => result.source === 'known-real-world') ?? scheduleDistances.find((result) => result.source === 'coordinate-estimated') ?? scheduleDistances[0];
  const bestWindowLabel = formatPlanTimeRange(plan.decision.start, plan.decision.end);
  const projectedRisk = plan.energy.projectedBattery < plan.energy.reserveTarget;
  const selectedOption = plan.chargingStrategy.selected;
  const selectedStation = selectedOption.selectedStation;
  const updateTargetCharge = (value: number) => setTargetCharge(Math.max(minTargetCharge, Math.min(maxTargetCharge, Math.round(value / 5) * 5)));

  useEffect(() => {
    let cancelled = false;
    setGeminiStatus('loading');
    setGeminiDecision(undefined);

    fetch('/api/charging/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: geminiPayloadSignature
    })
      .then((response) => response.json())
      .then((decision: GeminiChargingDecision) => {
        if (cancelled) return;
        if (decision?.mode === 'AC' || decision?.mode === 'DC') {
          setGeminiDecision(decision);
          setGeminiStatus(decision.source === 'gemini' ? 'ready' : 'fallback');
          return;
        }
        setGeminiStatus('fallback');
      })
      .catch(() => {
        if (!cancelled) setGeminiStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [geminiPayloadSignature]);

  useEffect(() => {
    const nextEvent = buildManagedChargingCalendarEvent(plan);
    if (!nextEvent) return;

    if (!managedChargingEvent) {
      addEvent(nextEvent);
      return;
    }

    if (calendarEventChanged(managedChargingEvent, nextEvent)) {
      updateEvent({ ...managedChargingEvent, ...nextEvent });
    }
  }, [addEvent, managedChargingEvent, plan, updateEvent]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-5 pb-24 sm:pb-8">
      <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
              <BrainCircuit className="h-4 w-4" />
              AI
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-on-surface sm:text-4xl">MB Sense AI</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">Six agents coordinate schedule, energy, availability, charging time, decision logic, and explanations.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-500">
            <BatteryCharging className="h-4 w-4" />
            {geminiStatus === 'loading' ? 'Gemini evaluating' : geminiStatus === 'ready' ? 'Gemini decision' : geminiStatus === 'fallback' ? 'Fallback decision' : 'Charging intelligence'}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest', projectedRisk ? 'border-amber-300/25 bg-amber-950/60 text-amber-500' : 'border-emerald-300/25 bg-emerald-950/70 text-emerald-500')}>
                {projectedRisk ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {projectedRisk ? 'Charge recommended' : 'Schedule ready'}
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-on-surface">Best charging time</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">{plan.explanation}</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4 text-left lg:min-w-72">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Decision Agent</p>
              <p className="mt-2 text-lg font-black leading-tight text-on-surface">{bestWindowLabel}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">{selectedOption.mode} selected · {selectedOption.mode === 'DC' && selectedStation ? selectedStation.station.name : selectedOption.location}</p>
              {selectedOption.mode === 'DC' && selectedStation ? <p className="mt-1 text-[10px] font-bold text-slate-500">{selectedStation.connector} · {selectedStation.distanceFromAnchorKm} km from {selectedStation.anchorLocation}</p> : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <Battery className="mb-2 h-5 w-5 text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current</p>
              <p className="mt-1 text-2xl font-black text-on-surface">{plan.energy.currentBattery}%</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <Route className="mb-2 h-5 w-5 text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Forecast Use</p>
              <p className="mt-1 text-2xl font-black text-on-surface">{plan.energy.forecastUsePercent}%</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <Gauge className="mb-2 h-5 w-5 text-rose-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">After Trips</p>
              <p className="mt-1 text-2xl font-black text-on-surface">{plan.energy.projectedBattery}%</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500">from {plan.energy.plannedStartBattery}% target/current</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <Timer className="mb-2 h-5 w-5 text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Charge Time</p>
              <p className="mt-1 text-xl font-black text-on-surface">AC {formatChargeDuration(plan.charging.ac.minutesNeeded)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500">DC {formatChargeDuration(plan.charging.dcFast.minutesNeeded)}{plan.charging.dcFast.validToTarget ? '' : ` to ${plan.charging.dcFast.targetBattery}%`}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Charging Agent</p>
              <h2 className="mt-1 text-xl font-black text-on-surface">Charging calculation</h2>
            </div>
            <PlugZap className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Target charge</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateTargetCharge(targetCharge - 5)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-surface-container-lowest text-primary transition hover:bg-surface-container" aria-label="Decrease target charge">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-12 text-center text-lg font-black text-on-surface">{targetCharge}%</span>
                  <button type="button" onClick={() => updateTargetCharge(targetCharge + 5)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-surface-container-lowest text-primary transition hover:bg-surface-container" aria-label="Increase target charge">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={minTargetCharge}
                max={maxTargetCharge}
                step={5}
                value={targetCharge}
                onChange={(event) => updateTargetCharge(Number(event.target.value))}
                className="mt-4 w-full accent-primary"
                aria-label="Target charge"
              />
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {targetChargeOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateTargetCharge(value)}
                    className={cn('h-8 rounded-xl border text-[10px] font-black transition', targetCharge === value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-primary')}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Charging mode</span>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(['auto', 'AC', 'DC'] as ChargingModePreference[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setChargingPreference(mode)}
                    className={cn('h-9 rounded-xl border text-xs font-black transition', chargingPreference === mode ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-primary')}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] font-bold text-slate-500">Gemini chooses from validated AC/DC candidates. {geminiDecision?.confidence ? `Confidence ${Math.round(geminiDecision.confidence * 100)}%. ` : ''}{geminiDecision?.reason ?? 'Local candidates are ready.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[plan.chargingStrategy.ac, plan.chargingStrategy.dc].map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setChargingPreference(option.mode)}
                  className={cn('rounded-2xl border p-4 text-left transition', selectedOption.mode === option.mode ? 'border-primary/45 bg-primary/10' : 'border-outline-variant/45 bg-surface-container-low')}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">{option.mode} option</span>
                  <p className="mt-2 text-sm font-black text-on-surface">{optionLabel(option)}</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-500">{option.mode === 'DC' && option.selectedStation ? option.selectedStation.station.name : option.location}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Charge needed</span>
              <span className="text-lg font-black text-on-surface">+{plan.energy.topUpPercent}%</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">AC estimate</span>
                <p className="mt-1 text-[10px] font-bold text-slate-500">{plan.charging.ac.chargeRatePercentPerHour}%/hr Â· trained 10-100%</p>
              </div>
              <span className="text-lg font-black text-on-surface">{formatChargeDuration(plan.charging.ac.minutesNeeded)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">DC fast estimate</span>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {plan.charging.dcFast.validToTarget
                    ? 'trained 10-80%'
                    : `${plan.charging.dcFast.unsupportedTopUpPercent}% above 80% not modeled`}
                </p>
              </div>
              <span className="text-lg font-black text-on-surface">
                {formatChargeDuration(plan.charging.dcFast.minutesNeeded)}
                {!plan.charging.dcFast.validToTarget && plan.charging.dcFast.minutesNeeded !== null ? ` to ${plan.charging.dcFast.targetBattery}%` : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      {highlightedDistance ? (
        <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
                <Route className="h-4 w-4" />
                Schedule Distance Agent
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface">Between schedules</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{highlightedDistance.fromTime}</p>
                  <p className="mt-1 text-sm font-black text-on-surface">{highlightedDistance.fromTitle}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{highlightedDistance.fromLocation}</p>
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary md:flex">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{highlightedDistance.toTime}</p>
                  <p className="mt-1 text-sm font-black text-on-surface">{highlightedDistance.toTitle}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{highlightedDistance.toLocation}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary">{routeSourceLabel(highlightedDistance.source)}</p>
                <p className="mt-1 text-xl font-black text-on-surface">{highlightedDistance.distanceKm} km</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Drive</p>
                <p className="mt-1 text-xl font-black text-on-surface">{highlightedDistance.durationMinutes ? `${highlightedDistance.durationMinutes}m` : 'Est.'}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Buffer</p>
                <p className="mt-1 text-xl font-black text-on-surface">{highlightedDistance.bufferMinutes}m</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {plan.agents.map((agent, index) => {
          const Icon = agentIcons[index] ?? BrainCircuit;
          return (
            <div key={agent.name} className="rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-4 shadow-ambient">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn('rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest', statusClass(agent.status))}>{agent.status}</span>
              </div>
              <h3 className="mt-4 text-sm font-black text-on-surface">{agent.name}</h3>
              <p className="mt-1 text-lg font-black text-primary">{agent.metric}</p>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{agent.summary}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.76fr)]">
        <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Schedule + Energy Agents</p>
              <h2 className="mt-1 text-xl font-black text-on-surface">Upcoming travel demand</h2>
            </div>
            <CarFront className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-3">
            {plan.scheduleDemand.trips.slice(0, 5).map((trip) => (
              <div key={trip.eventId} className="grid gap-3 rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-on-surface">{trip.title}</p>
                    <span className={cn('rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest', trafficClass(trip.traffic))}>{trip.traffic}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5" />{trip.location}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">From {trip.originLocation}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Depart {trip.departureTime} for {formatPlanDateTime(trip.date)}</p>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{routeSourceLabel(trip.routeDistanceSource)}</p>
                    <p className="mt-1 text-sm font-black text-on-surface">{trip.distanceKm} km</p>
                    {trip.routeDurationMinutes ? <p className="mt-0.5 text-[10px] font-bold text-slate-500">{trip.routeDurationMinutes} min</p> : null}
                  </div>
                  <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Battery</p>
                    <p className="mt-1 text-sm font-black text-on-surface">{trip.batteryUsePercent}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Availability Agent</p>
              <h2 className="mt-1 text-xl font-black text-on-surface">Free parked slots</h2>
            </div>
            <Clock3 className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-3">
            {plan.availability.windows.slice(0, 4).map((window) => (
              <div key={window.id} className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
                <p className="text-sm font-black text-on-surface">{formatPlanTimeRange(window.start, window.end)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>{Math.round(window.durationMinutes / 60 * 10) / 10} hr</span>
                  <span className="h-1 w-1 rounded-full bg-outline-variant" />
                  <span>{window.chargerAccess}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
        <Chatbot embedded />
        <VoiceAssistant embedded />
      </section>
    </motion.div>
  );
}






