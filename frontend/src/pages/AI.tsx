import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
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
  PlugZap,
  Route,
  Timer
} from 'lucide-react';
import Chatbot from '../components/Chatbot';
import VoiceAssistant from '../components/VoiceAssistant';
import { buildChargingPlan, formatPlanDateTime, formatPlanTimeRange } from '../lib/chargingAgents';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

const agentIcons = [CalendarClock, Gauge, Clock3, PlugZap, CheckCircle2, MessageCircle];

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

export default function AI() {
  const { events, vehicle, weather } = useAppStore();
  const plan = useMemo(() => buildChargingPlan(events, vehicle, weather), [events, vehicle, weather]);
  const bestWindowLabel = formatPlanTimeRange(plan.decision.start, plan.decision.end);
  const projectedRisk = plan.energy.projectedBattery < plan.energy.reserveTarget;

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
            Charging intelligence
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
              <p className="mt-2 text-xs font-bold text-slate-500">{plan.decision.bestWindow?.location ?? 'No parked charging window found'}</p>
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
            </div>
            <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <Timer className="mb-2 h-5 w-5 text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Charge Time</p>
              <p className="mt-1 text-2xl font-black text-on-surface">{plan.charging.minutesNeeded}m</p>
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
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Target</span>
              <span className="text-lg font-black text-on-surface">{plan.charging.targetBattery}%</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Top up</span>
              <span className="text-lg font-black text-on-surface">+{plan.energy.topUpPercent}%</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Rate</span>
              <span className="text-lg font-black text-on-surface">{plan.charging.chargeRatePercentPerHour}%/hr</span>
            </div>
          </div>
        </div>
      </section>

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
                  <p className="mt-1 text-xs font-semibold text-slate-500">Depart {trip.departureTime} for {formatPlanDateTime(trip.date)}</p>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Route</p>
                    <p className="mt-1 text-sm font-black text-on-surface">{trip.distanceKm} km</p>
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
              <h2 className="mt-1 text-xl font-black text-on-surface">Parked windows</h2>
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
