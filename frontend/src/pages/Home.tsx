import { motion } from 'motion/react';
import { useAppStore, type ChargingStationCalendarOption } from '../store/useAppStore';
import { BatteryCharging, Battery, CalendarClock, Check, MapPin, PlugZap, ShieldCheck, Timer, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { buildCalendarEventFromChargingPlan, buildChargingPlanInput, fallbackChargingPlan, requestChargingPlan } from '../lib/chargingPlanner';
import type { ChargingStationRecommendation } from '../types/chargingPlanner';
import { useCalendarViewStore } from '../store/useCalendarViewStore';

function formatChargingType(type: string) {
  if (type === 'home_ac') return 'Home AC';
  if (type === 'public_dc_fast') return 'Public DC fast';
  if (type === 'public_ac') return 'Public AC';
  return 'No charge needed';
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return 'N/A';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function parsePlanDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(date: Date | null, fallback?: string | null) {
  if (date) return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  if (fallback) return fallback;
  return 'N/A';
}

function formatTimeLabel(start: Date | null, end: Date | null, fallbackStart?: string | null, fallbackEnd?: string | null) {
  if (start && end) {
    const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  }
  if (fallbackStart && fallbackEnd) return `${fallbackStart} - ${fallbackEnd}`;
  return 'N/A';
}

function isMeaningful(value: unknown) {
  return typeof value === 'string' && value.trim() && value.trim().toUpperCase() !== 'N/A';
}

function displayText(value: unknown) {
  return isMeaningful(value) ? String(value).trim() : 'N/A';
}

function formatNumber(value: unknown, suffix: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric}${suffix}` : 'N/A';
}

function buildStationSummary(station: ChargingStationRecommendation | null, fallback: string) {
  if (!station) return displayText(fallback);
  const details = [
    displayText(station.provider),
    displayText(station.city),
    displayText(station.connector),
    formatNumber(station.maxPowerKw, ' kW'),
    formatNumber(station.stalls, ' stalls'),
  ].filter((item, index, list) => item !== 'N/A' && list.indexOf(item) === index);
  const reason = displayText(station.reason);
  return [...details, reason !== 'N/A' ? reason : null].filter(Boolean).join('. ') || 'N/A';
}

function toCalendarStationOption(station: ChargingStationRecommendation, index: number): ChargingStationCalendarOption {
  return {
    id: displayText(station.id) !== 'N/A' ? displayText(station.id) : `gemini-station-${index + 1}`,
    name: displayText(station.name),
    provider: displayText(station.provider),
    city: displayText(station.city),
    address: displayText(station.address),
    connector: station.connector === 'Tesla CCS2' ? 'Tesla CCS2' : 'CCS2',
    maxPowerKw: Number.isFinite(Number(station.maxPowerKw)) ? Number(station.maxPowerKw) : 0,
    stalls: Number.isFinite(Number(station.stalls)) ? Number(station.stalls) : 0,
    distanceFromAnchorKm: 0,
    detourKm: 0,
    isHighwayStop: false,
    reason: displayText(station.reason),
  };
}
export default function Home() {
  const { user, location, weather, vehicle, events, aiChargingPlan, aiChargingPlanStatus, setAiChargingPlan, setAiChargingPlanStatus, addEvent, updateEvent } = useAppStore();
  const setActiveWeek = useCalendarViewStore((state) => state.setActiveWeek);
  const navigate = useNavigate();
  const [time, setTime] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [showStationOptions, setShowStationOptions] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDateLabel(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const plan = aiChargingPlan ?? fallbackChargingPlan;
  const stationRecommendations = plan.stationRecommendations ?? [];
  const selectedStation = stationRecommendations.find((station, index) => (station.id ?? `gemini-station-${index + 1}`) === selectedStationId) ?? null;
  const selectedStationCalendarOption = selectedStation ? toCalendarStationOption(selectedStation, stationRecommendations.indexOf(selectedStation)) : null;
  const selectedStationLocation = selectedStation
    ? displayText(selectedStation.address) !== 'N/A'
      ? displayText(selectedStation.address)
      : displayText(selectedStation.name)
    : null;
  const planForCalendar = selectedStation
    ? {
        ...plan,
        chargingLocationName: displayText(selectedStation.name),
        calendarAction: {
          ...plan.calendarAction,
          location: selectedStationLocation,
          colorType: 'charging' as const
        }
      }
    : plan;
  const plannedEvent = buildCalendarEventFromChargingPlan(planForCalendar);
  const existingPlannedEvent = plannedEvent ? events.find((event) => event.id === plannedEvent.id) : undefined;
  const currentBattery = vehicle.batteryLevel;
  const recommendedTarget = plan.targetBatteryPercent === null ? 'N/A' : `${plan.targetBatteryPercent}%`;
  const isChargeRecommended = plan.shouldCharge;
  const chargingTypeLabel = formatChargingType(plan.chargingType);
  const durationLabel = formatDuration(plan.estimatedChargingDurationMinutes);
  const bestChargingStation = displayText(selectedStation?.name ?? plan.chargingLocationName ?? plan.calendarAction.location ?? plan.backupPlan.locationName);
  const stationSummary = buildStationSummary(selectedStation, plan.summary);
  const chargingStart = parsePlanDateTime(plan.recommendedChargingStart);
  const chargingEnd = parsePlanDateTime(plan.recommendedChargingEnd);
  const nextChargingDate = formatDateLabel(chargingStart, plan.calendarAction.date);
  const nextChargingTime = formatTimeLabel(chargingStart, chargingEnd, plan.calendarAction.startTime, plan.calendarAction.endTime);

  const updateAiRecommendation = async () => {
    const scheduleEvents = events.filter((event) => !event.aiChargingPlan && !event.isAiRecommendationPreview);
    const plannerInput = buildChargingPlanInput(scheduleEvents, vehicle, weather, null);
    setSelectedStationId(null);
    setShowStationOptions(false);
    setAiChargingPlanStatus('loading');

    try {
      const nextPlan = await requestChargingPlan(plannerInput);
      setAiChargingPlan(nextPlan, nextPlan.id === 'ai-charge-na' ? 'fallback' : 'ready');
    } catch {
      setAiChargingPlan(null, 'error');
    }
  };

  const addChargingPlanToCalendar = () => {
    if (!plannedEvent) return;
    const stationOptions = stationRecommendations.map(toCalendarStationOption);
    const chargingMeta = plannedEvent.chargingMeta
      ? {
          ...plannedEvent.chargingMeta,
          mode: selectedStation ? 'DC' as const : plannedEvent.chargingMeta.mode,
          connector: selectedStationCalendarOption?.connector ?? plannedEvent.chargingMeta.connector,
          anchorLocation: selectedStationCalendarOption?.name ?? plannedEvent.chargingMeta.anchorLocation,
          selectedStation: selectedStationCalendarOption ?? plannedEvent.chargingMeta.selectedStation,
          stationOptions
        }
      : undefined;
    const confirmedEvent = {
      ...plannedEvent,
      location: selectedStationLocation ?? plannedEvent.location,
      notes: selectedStation ? `Selected ${displayText(selectedStation.name)}. ${displayText(plan.summary)}` : plannedEvent.notes,
      chargingMeta,
      isAiRecommendationPreview: false,
      status: 'AI CHARGING CONFIRMED'
    };
    if (existingPlannedEvent) updateEvent({ ...existingPlannedEvent, ...confirmedEvent });
    else addEvent(confirmedEvent);
    setActiveWeek(confirmedEvent.date);
    navigate('/calendar?aiPlan=1');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-6"
    >
      <section className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Hello, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm font-medium tracking-wide text-slate-400">{time}</p>
          <p className="mt-0.5 text-xs font-semibold tracking-wide text-slate-500">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/45 px-4 py-2 rounded-xl shadow-ambient">
          <div className="text-right">
            <p className="text-xs text-slate-300 font-medium">{location}</p>
            <p className="text-lg font-semibold text-blue-400">{weather.temp}Â°C</p>
          </div>
        </div>
      </section>

      <section>
        <div className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant/45 rounded-3xl p-5 shadow-ambient-lg">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border',
                  isChargeRecommended
                    ? 'bg-amber-950/70 text-amber-500 border-amber-500/25'
                    : 'bg-emerald-950/70 text-emerald-500 border-emerald-500/25'
                )}>
                  <Zap className="w-3.5 h-3.5" />
                  {aiChargingPlanStatus === 'loading' ? 'AI evaluating' : isChargeRecommended ? 'Charge recommended' : 'Battery ready'}
                </span>
                <h2 className="mt-3 text-2xl font-extrabold text-slate-100 leading-tight">AI Charging Recommendation</h2>
                <p className="mt-1 text-xs font-semibold text-slate-400 leading-relaxed">
                  MB Sense predicts charging before the battery becomes a problem.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-center">
                <Battery className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="font-mono text-3xl font-black text-primary leading-none">{currentBattery}%</p>
                <p className="mt-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Battery</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-primary/30 bg-primary/15 shadow-ambient">
              <div className="flex items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-3">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                  <CalendarClock className="h-4 w-4" />
                  Next Charging
                </p>
                <button type="button" onClick={() => setShowStationOptions((value) => !value)} className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary transition hover:bg-primary/15">
                  {showStationOptions ? 'Hide stations' : 'Show other station'}
                </button>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                    <MapPin className="h-4 w-4 text-primary" />
                    Best station
                  </p>
                  <h3 className="mt-2 text-xl font-black leading-tight text-slate-100">{bestChargingStation}</h3>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{stationSummary}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Date</p>
                    <p className="mt-1 text-sm font-extrabold leading-snug text-slate-100">{nextChargingDate}</p>
                  </div>
                  <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Time</p>
                    <p className="mt-1 text-sm font-extrabold leading-snug text-slate-100">{nextChargingTime}</p>
                  </div>
                </div>
              </div>
            </div>

            {showStationOptions && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stationRecommendations.length === 0 && (
                  <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-3 text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary">Other stations</p>
                    <p className="mt-1 text-sm font-black leading-snug text-slate-100">N/A</p>
                    <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">Gemini did not return station recommendations.</p>
                  </div>
                )}
                {stationRecommendations.map((station, index) => {
                  const stationKey = station.id ?? `gemini-station-${index + 1}`;
                  const selected = selectedStationId === stationKey;
                  const detail = [displayText(station.city), displayText(station.provider), formatNumber(station.maxPowerKw, ' kW'), formatNumber(station.stalls, ' stalls')]
                    .filter((item) => item !== 'N/A')
                    .join(' · ') || 'N/A';
                  return (
                    <button
                      key={stationKey}
                      type="button"
                      onClick={() => setSelectedStationId(stationKey)}
                      className={cn('rounded-2xl border p-3 text-left transition', selected ? 'border-primary/45 bg-primary/15' : 'border-outline-variant/45 bg-surface-container-low hover:border-primary/35')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary">Top {index + 1}</p>
                          <p className="mt-1 text-sm font-black leading-snug text-slate-100">{displayText(station.name)}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">{detail}</p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="rounded-xl border border-outline-variant/45 bg-surface-container-low p-3">
                <PlugZap className="mb-2 h-4 w-4 text-emerald-500" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Mode</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100">{chargingTypeLabel}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/45 bg-surface-container-low p-3">
                <Timer className="mb-2 h-4 w-4 text-primary" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Duration</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100">{durationLabel}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/45 bg-surface-container-low p-3">
                <BatteryCharging className="mb-2 h-4 w-4 text-emerald-500" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Target</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100">{recommendedTarget}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/45 bg-surface-container-low p-3">
                <Battery className="mb-2 h-4 w-4 text-amber-500" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">After schedule</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100">{plan.predictedBatteryAfterSchedule === 0 && plan.id === 'ai-charge-na' ? 'N/A' : `${plan.predictedBatteryAfterSchedule}%`}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/45 bg-surface-container-low p-3">
                <ShieldCheck className="mb-2 h-4 w-4 text-blue-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Confidence</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100">{plan.mobilityConfidenceScore === 0 && plan.id === 'ai-charge-na' ? 'N/A' : `${plan.mobilityConfidenceScore}%`}</p>
              </div>
            </div>

            <div className={cn(
              'rounded-2xl border p-4 flex gap-3',
              isChargeRecommended
                ? 'bg-amber-950/60 border-amber-500/25'
                : 'bg-emerald-950/60 border-emerald-500/20'
            )}>
              <Zap className={cn(
                'w-5 h-5 shrink-0 mt-0.5',
                isChargeRecommended ? 'text-amber-500' : 'text-emerald-500'
              )} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Why now</p>
                <p className="mt-1 text-sm font-semibold text-slate-100 leading-relaxed">{plan.reason}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">{plan.sidePanelDetails.chargingExplanation}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={updateAiRecommendation} disabled={aiChargingPlanStatus === 'loading'} className="bg-primary text-on-primary py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-98 disabled:cursor-wait disabled:opacity-70 flex items-center justify-center gap-2 shadow-ambient">
                <BatteryCharging className="w-4 h-4" />
                {aiChargingPlanStatus === 'loading' ? 'Updating AI...' : 'Update AI Recommendation'}
              </button>
              {plan.calendarAction.shouldCreateEvent && (
                <button type="button" onClick={addChargingPlanToCalendar} className="bg-surface-container-low border border-outline-variant/45 rounded-xl px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-200 transition hover:border-primary/35 hover:text-primary">
                  Put in your Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}




