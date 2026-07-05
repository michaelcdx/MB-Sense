import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BatteryCharging,
  CheckCircle2,
  Minus,
  PlugZap,
  Plus,
  Settings
} from 'lucide-react';
import { resolveLocationCoordinates } from '../constants/realWorldRouteData';
import { buildChargingPlan, buildGeminiChargingPredictionPayload, formatPlanTimeRange, type ChargingModePreference, type ChargingOptionPlan, type GeminiChargingDecision } from '../lib/chargingAgents';
import { fetchOpenChargeMapStations } from '../lib/chargingPlanner';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useCalendarViewStore } from '../store/useCalendarViewStore';
import type { OpenChargeMapStationCandidate } from '../types/chargingPlanner';

const targetChargeOptions = [60, 70, 80, 90, 100];
const minTargetCharge = 50;
const maxTargetCharge = 100;
const minBatteryThresholdOptions = [20, 30, 35, 40, 50];
const minBatteryThresholdFloor = 10;
const minBatteryThresholdCeiling = 60;

function formatChargeDuration(minutes: number | null) {
  if (minutes === null) return 'Not modeled';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function optionLabel(option: ChargingOptionPlan) {
  return option.start && option.end ? formatPlanTimeRange(option.start, option.end) : 'No matching free slot';
}

export default function AI() {
  const {
    events,
    vehicle,
    weather,
    calendarRevision,
    chargingTargetPercent,
    chargingMinimumBatteryPercent,
    setChargingTargetPercent,
    setChargingMinimumBatteryPercent,
  } = useAppStore();
  const selectedDate = useCalendarViewStore((state) => state.selectedDate);
  const targetCharge = chargingTargetPercent;
  const minimumBattery = chargingMinimumBatteryPercent;
  const [chargingPreference, setChargingPreference] = useState<ChargingModePreference>('auto');
  const [geminiDecision, setGeminiDecision] = useState<GeminiChargingDecision | undefined>();
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback' | 'error'>('idle');
  const [openChargeMapStations, setOpenChargeMapStations] = useState<OpenChargeMapStationCandidate[]>([]);
  const stationAnchor = useMemo(() => {
    const planningStart = new Date(selectedDate);
    const drivingEvent = [...events]
      .filter((event) => event.carNeeded && event.location && new Date(event.date).getTime() >= planningStart.getTime())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    return drivingEvent?.location ? resolveLocationCoordinates(drivingEvent.location) : null;
  }, [events, selectedDate, calendarRevision]);
  const stationAnchorKey = stationAnchor ? `${stationAnchor.lat.toFixed(4)},${stationAnchor.lng.toFixed(4)}` : '';
  const candidatePlan = useMemo(() => buildChargingPlan(events, vehicle, weather, targetCharge, selectedDate, chargingPreference, undefined, openChargeMapStations, minimumBattery), [events, vehicle, weather, targetCharge, selectedDate, chargingPreference, openChargeMapStations, minimumBattery, calendarRevision]);
  const geminiPayload = useMemo(() => buildGeminiChargingPredictionPayload(candidatePlan, chargingPreference), [candidatePlan, chargingPreference]);
  const geminiPayloadSignature = useMemo(() => JSON.stringify(geminiPayload), [geminiPayload]);
  const plan = useMemo(() => buildChargingPlan(events, vehicle, weather, targetCharge, selectedDate, chargingPreference, geminiDecision, openChargeMapStations, minimumBattery), [events, vehicle, weather, targetCharge, selectedDate, chargingPreference, geminiDecision, openChargeMapStations, minimumBattery, calendarRevision]);
  const selectedOption = plan.chargingStrategy.selected;
  const dcOption = plan.chargingStrategy.dc;
  const dcOptionStation = dcOption.selectedStation;
  const acMinutes = plan.charging.ac.minutesNeeded;
  const dcMinutes = plan.charging.dcFast.minutesNeeded;
  const dcIsFaster = dcMinutes !== null && dcMinutes < acMinutes;
  const acOptionDetail = plan.energy.chargeRecommended
    ? `${acMinutes} minutes${dcIsFaster ? ', not recommended for this schedule' : ', suitable for this schedule'}`
    : 'No charging needed while forecast stays above minimum';
  const dcOptionDetail = dcOptionStation
    ? `${dcIsFaster ? 'Recommended, ' : ''}${dcOptionStation.connector} compatible, ${dcOptionStation.distanceFromAnchorKm} km away`
    : plan.energy.chargeRecommended ? 'Recommended when AC cannot fit the schedule' : 'No public DC stop needed yet';
  const updateTargetCharge = (value: number) => setChargingTargetPercent(Math.max(minTargetCharge, Math.min(maxTargetCharge, Math.round(value / 5) * 5)));
  const updateMinimumBattery = (value: number) => setChargingMinimumBatteryPercent(Math.max(minBatteryThresholdFloor, Math.min(Math.min(minBatteryThresholdCeiling, targetCharge - 5), Math.round(value / 5) * 5)));

  useEffect(() => {
    let cancelled = false;

    if (!stationAnchor) {
      setOpenChargeMapStations([]);
      return () => {
        cancelled = true;
      };
    }

    setOpenChargeMapStations([]);
    fetchOpenChargeMapStations({
      latitude: stationAnchor.lat,
      longitude: stationAnchor.lng,
      distanceKm: 35,
      maxResults: 8,
    }).then((stations) => {
      if (!cancelled) setOpenChargeMapStations(stations);
    });

    return () => {
      cancelled = true;
    };
  }, [stationAnchorKey]);

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

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-5 pb-24 sm:pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
            <Settings className="h-4 w-4" />
            Setting
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-on-surface sm:text-4xl">Setting</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">Charging calculation and minimum battery policy.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-500">
          <BatteryCharging className="h-4 w-4" />
          {geminiStatus === 'loading' ? 'Evaluating' : geminiStatus === 'ready' ? 'Gemini decision' : geminiStatus === 'fallback' ? 'Fallback decision' : geminiStatus === 'error' ? 'Local decision' : 'Charging intelligence'}
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-outline-variant/45 bg-surface-container-lowest shadow-ambient-lg">
        <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                  <PlugZap className="h-4 w-4" />
                  Charging Calculation
                </p>
                <h2 className="mt-2 text-xl font-black text-on-surface">Target and charge estimate</h2>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">+{plan.energy.topUpPercent}%</span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Target charge</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateTargetCharge(targetCharge - 5)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-surface-container-low text-primary transition hover:bg-surface-container" aria-label="Decrease target charge">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-12 text-center text-lg font-black text-on-surface">{targetCharge}%</span>
                  <button type="button" onClick={() => updateTargetCharge(targetCharge + 5)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-surface-container-low text-primary transition hover:bg-surface-container" aria-label="Increase target charge">
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
                    className={cn('h-8 rounded-xl border text-[10px] font-black transition', targetCharge === value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/45 bg-surface-container-low text-on-surface-variant hover:border-primary/35 hover:text-primary')}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Minimum battery</span>
                  <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-500">Recommend charging only when the no-charge forecast drops below this level.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateMinimumBattery(minimumBattery - 5)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-surface-container-lowest text-primary transition hover:bg-surface-container" aria-label="Decrease minimum battery">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-12 text-center text-lg font-black text-on-surface">{minimumBattery}%</span>
                  <button type="button" onClick={() => updateMinimumBattery(minimumBattery + 5)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-surface-container-lowest text-primary transition hover:bg-surface-container" aria-label="Increase minimum battery">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={minBatteryThresholdFloor}
                max={Math.min(minBatteryThresholdCeiling, targetCharge - 5)}
                step={5}
                value={minimumBattery}
                onChange={(event) => updateMinimumBattery(Number(event.target.value))}
                className="mt-4 w-full accent-primary"
                aria-label="Minimum battery threshold"
              />
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {minBatteryThresholdOptions.map((value) => {
                  const disabled = value >= targetCharge;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateMinimumBattery(value)}
                      disabled={disabled}
                      className={cn('h-8 rounded-xl border text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-40', minimumBattery === value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-primary')}
                    >
                      {value}%
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">No-charge forecast</p>
                  <p className="mt-1 text-lg font-black text-on-surface">{plan.energy.withoutChargeProjectedBattery}%</p>
                </div>
                <div className={cn('rounded-xl border px-3 py-2', plan.energy.chargeRecommended ? 'border-amber-300/35 bg-amber-500/10' : 'border-emerald-300/35 bg-emerald-500/10')}>
                  <p className={cn('text-[9px] font-black uppercase tracking-widest', plan.energy.chargeRecommended ? 'text-amber-600' : 'text-emerald-600')}>Charging behavior</p>
                  <p className="mt-1 text-sm font-black text-on-surface">{plan.energy.chargeRecommended ? `Charge to ${plan.energy.userTargetBattery}%` : 'Wait'}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-outline-variant/45 pt-5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Charging mode</span>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(['auto', 'AC', 'DC'] as ChargingModePreference[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setChargingPreference(mode)}
                    className={cn('h-9 rounded-xl border text-xs font-black transition', chargingPreference === mode ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/45 bg-surface-container-low text-on-surface-variant hover:border-primary/35 hover:text-primary')}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] font-bold leading-relaxed text-slate-500">MB Sense waits while the forecast stays above minimum, then compares AC and DC only when charging is needed.</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="border-t border-outline-variant/45 pt-4">
                <button
                  type="button"
                  onClick={() => setChargingPreference('AC')}
                  className={cn(
                    'flex min-h-[150px] w-full flex-col rounded-2xl border p-4 text-left transition active:scale-[0.99]',
                    selectedOption.mode === 'AC' ? 'border-primary/45 bg-primary/10 shadow-ambient' : 'border-outline-variant/45 bg-surface-container-low hover:border-primary/35'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">AC charging</p>
                    {selectedOption.mode === 'AC' && <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-primary">Selected</span>}
                  </div>
                  <p className="mt-3 text-2xl font-black text-on-surface">{formatChargeDuration(plan.charging.ac.minutesNeeded)}</p>
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{acOptionDetail}</p>
                  <p className="mt-auto pt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{optionLabel(plan.chargingStrategy.ac)}</p>
                </button>
              </div>
              <div className="border-t border-outline-variant/45 pt-4">
                <button
                  type="button"
                  onClick={() => setChargingPreference('DC')}
                  className={cn(
                    'flex min-h-[150px] w-full flex-col rounded-2xl border p-4 text-left transition active:scale-[0.99]',
                    dcIsFaster ? 'border-emerald-300/45 bg-emerald-500/10 shadow-ambient' : 'border-outline-variant/45 bg-surface-container-low hover:border-primary/35',
                    selectedOption.mode === 'DC' && 'ring-1 ring-emerald-300/45'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">DC fast charging</p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" />
                      {!plan.energy.chargeRecommended ? 'Not needed' : selectedOption.mode === 'DC' ? 'Selected' : 'Recommended'}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black text-on-surface">
                    {formatChargeDuration(plan.charging.dcFast.minutesNeeded)}
                    {!plan.charging.dcFast.validToTarget && plan.charging.dcFast.minutesNeeded !== null ? ` to ${plan.charging.dcFast.targetBattery}%` : ''}
                  </p>
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{dcOptionDetail}</p>
                  <p className="mt-auto pt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{optionLabel(plan.chargingStrategy.dc)}</p>
                </button>
              </div>
            </div>
        </div>
      </section>
    </motion.div>
  );
}

