import { motion } from 'motion/react';
import { useAppStore, type ChargingStationCalendarOption } from '../store/useAppStore';
import { AnimatePresence } from 'motion/react';
import { BatteryCharging, Battery, CalendarClock, Clock, MapPin, Navigation, PlugZap, ShieldCheck, Thermometer, Timer, Zap } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { buildChargingPlan } from '../lib/chargingAgents';
import { buildCalendarEventFromChargingPlan, buildChargingPlanInput, buildChargingPlanInputSignature, fallbackChargingPlan, normalizeChargingPlanAgainstSchedule, requestChargingPlan } from '../lib/chargingPlanner';
import type { ChargingStationRecommendation } from '../types/chargingPlanner';
import { useCalendarViewStore } from '../store/useCalendarViewStore';

const defaultHomeAddress = 'Xiamen University Malaysia, Jalan Sunsuria, Bandar Sunsuria, 43900 Sepang, Selangor, Malaysia';

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

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameLocalDate(dateA: Date, dateB: Date) {
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth() && dateA.getDate() === dateB.getDate();
}

function getCalendarEventDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
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

function normalizeNavigationDestination(value: string) {
  const normalized = value.toLowerCase();
  if (
    normalized === 'home' ||
    normalized.includes('home ac') ||
    normalized.includes('home charging') ||
    normalized.includes('home garage') ||
    normalized.includes('home wallbox') ||
    normalized.includes('damansara heights')
  ) {
    return defaultHomeAddress;
  }

  return value;
}

function buildMapDirectionsUrl(station: ChargingStationRecommendation | null, fallbackLocation: string) {
  const latitude = Number(station?.latitude);
  const longitude = Number(station?.longitude);
  const destination = [
    displayText(station?.address),
    displayText(station?.name),
    fallbackLocation,
  ]
    .filter((value) => value !== 'N/A')
    .map(normalizeNavigationDestination)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(', ');

  if (!destination || destination === 'N/A') return null;

  const params = new URLSearchParams({
    route: 'charging',
    from: defaultHomeAddress,
    to: destination,
    name: displayText(station?.name) !== 'N/A' ? displayText(station?.name) : displayText(fallbackLocation),
    event: 'AI Charging Recommendation',
  });

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    params.set('lat', String(latitude));
    params.set('lng', String(longitude));
  }

  return `/map?${params.toString()}`;
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
  const {
    user,
    location,
    weather,
    vehicle,
    chargingTargetPercent,
    chargingMinimumBatteryPercent,
    events,
    aiChargingPlan,
    aiChargingPlanStatus,
    aiChargingPlanInputSignature,
    aiChargingPlanHistory,
    calendarRevision,
    setAiChargingPlan,
    setAiChargingPlanStatus,
    addAiChargingPlanHistory,
    clearAiChargingPlanHistory,
    restoreAiChargingPlanFromHistory,
    addEvent,
    updateEvent
  } = useAppStore();
  const setActiveWeek = useCalendarViewStore((state) => state.setActiveWeek);
  const navigate = useNavigate();
  const [time, setTime] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [showAllTodayForecastTrips, setShowAllTodayForecastTrips] = useState(false);

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

  const scheduleEvents = useMemo(() => events.filter((event) => !event.aiChargingPlan && !event.isAiRecommendationPreview), [events]);
  const currentPlannerInput = useMemo(
    () => buildChargingPlanInput(scheduleEvents, vehicle, weather, null, chargingTargetPercent, chargingMinimumBatteryPercent, calendarRevision),
    [calendarRevision, chargingMinimumBatteryPercent, chargingTargetPercent, scheduleEvents, vehicle, weather]
  );
  const currentRecommendationInputSignature = useMemo(
    () => buildChargingPlanInputSignature(scheduleEvents, vehicle, weather, chargingTargetPercent, chargingMinimumBatteryPercent),
    [chargingMinimumBatteryPercent, chargingTargetPercent, scheduleEvents, vehicle, weather]
  );
  const hasPlan = Boolean(aiChargingPlan);
  const recommendationInputsChanged = hasPlan && aiChargingPlanInputSignature !== currentRecommendationInputSignature;
  const shouldUpdateRecommendation = !hasPlan || recommendationInputsChanged || aiChargingPlanStatus === 'idle' || aiChargingPlanStatus === 'error';
  const isAnotherOptionMode = !shouldUpdateRecommendation;
  const aiRecommendationButtonLabel = aiChargingPlanStatus === 'loading'
    ? shouldUpdateRecommendation
      ? 'Updating AI...'
      : 'Generating Option...'
    : shouldUpdateRecommendation
      ? 'Update AI Recommendation'
      : 'Another Option';
  const plan = aiChargingPlan ? normalizeChargingPlanAgainstSchedule(aiChargingPlan, currentPlannerInput) : fallbackChargingPlan;
  const stationRecommendations = plan.stationRecommendations ?? [];
  const selectedStation = stationRecommendations[0] ?? null;
  const selectedStationCalendarOption = selectedStation ? toCalendarStationOption(selectedStation, 0) : null;
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
  const recommendedTarget = `${chargingTargetPercent}%`;
  const minimumBatteryTarget = `${chargingMinimumBatteryPercent}%`;
  const isChargeRecommended = plan.shouldCharge;
  const chargingTypeLabel = formatChargingType(plan.chargingType);
  const durationLabel = formatDuration(plan.estimatedChargingDurationMinutes);
  const bestChargingStation = displayText(selectedStation?.name ?? plan.chargingLocationName ?? plan.calendarAction.location ?? plan.backupPlan.locationName);
  const stationSummary = buildStationSummary(selectedStation, plan.summary);
  const chargingStart = parsePlanDateTime(plan.recommendedChargingStart);
  const chargingEnd = parsePlanDateTime(plan.recommendedChargingEnd);
  const nextChargingDate = formatDateLabel(chargingStart, plan.calendarAction.date);
  const nextChargingTime = formatTimeLabel(chargingStart, chargingEnd, plan.calendarAction.startTime, plan.calendarAction.endTime);
  const navigationStation = selectedStation ?? stationRecommendations[0] ?? null;
  const chargingStationNavigationUrl = buildMapDirectionsUrl(navigationStation, bestChargingStation);
  const weatherTemperatureLabel = `${Math.round(Number(weather.temp) || 0)}\u00B0C`;
  const batteryScheduleForecasts = useMemo(() => {
    const today = startOfLocalDay(new Date());
    const buckets = [
      { id: 'today', title: 'Today', subtitle: today.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }), startOffset: 0, endOffset: 0 },
      { id: 'tomorrow', title: 'Tomorrow', subtitle: addLocalDays(today, 1).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }), startOffset: 1, endOffset: 1 },
      { id: 'day-after', title: 'Day After Tomorrow', subtitle: addLocalDays(today, 2).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }), startOffset: 2, endOffset: 2 },
      { id: 'next-week', title: 'Next 3-7 Days', subtitle: `${addLocalDays(today, 3).toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${addLocalDays(today, 7).toLocaleDateString([], { month: 'short', day: 'numeric' })}`, startOffset: 3, endOffset: 7 },
    ];

    return buckets.map((bucket) => {
      const bucketDays = Array.from({ length: bucket.endOffset - bucket.startOffset + 1 }, (_, index) => addLocalDays(today, bucket.startOffset + index));
      const bucketEvents = events
        .filter((event) => !event.aiChargingPlan && !event.isAiRecommendationPreview)
        .filter((event) => bucketDays.some((day) => isSameLocalDate(getCalendarEventDate(event.date), day)));
      const drivingEventCount = bucketEvents.filter((event) => event.carNeeded).length;

      if (!drivingEventCount) {
        return {
          ...bucket,
          totalUsePercent: 0,
          afterSchedulePercent: vehicle.batteryLevel,
          trips: [],
          drivingEventCount,
        };
      }

      try {
        const forecast = buildChargingPlan(
          bucketEvents,
          vehicle,
          weather,
          chargingTargetPercent,
          addLocalDays(today, bucket.startOffset - 1),
          'auto',
          undefined,
          [],
          chargingMinimumBatteryPercent
        );
        const totalUsePercent = forecast.scheduleDemand.trips.reduce((sum, trip) => sum + trip.batteryUsePercent, 0);

        return {
          ...bucket,
          totalUsePercent,
          afterSchedulePercent: Math.max(vehicle.batteryLevel - totalUsePercent, 0),
          trips: forecast.scheduleDemand.trips,
          drivingEventCount,
        };
      } catch {
        return {
          ...bucket,
          totalUsePercent: 0,
          afterSchedulePercent: vehicle.batteryLevel,
          trips: [],
          drivingEventCount,
        };
      }
    });
  }, [calendarRevision, chargingMinimumBatteryPercent, chargingTargetPercent, dateLabel, events, vehicle, weather]);
  const todayForecast = batteryScheduleForecasts.find((bucket) => bucket.id === 'today') ?? batteryScheduleForecasts[0];
  const futureForecasts = batteryScheduleForecasts.filter((bucket) => bucket.id !== 'today');
  const visibleTodayTrips = showAllTodayForecastTrips ? todayForecast.trips : todayForecast.trips.slice(0, 3);
  const hiddenTodayTripCount = Math.max(todayForecast.trips.length - visibleTodayTrips.length, 0);
  const aiStatusLabel = aiChargingPlanStatus === 'loading'
    ? 'MB Sense is evaluating the latest calendar and battery data'
    : isChargeRecommended
      ? 'MB Sense recommends charging before the forecast crosses your minimum battery'
      : 'MB Sense is holding charging because the forecast remains above your minimum battery';

  const updateAiRecommendation = async () => {
    const requestAnotherOption = isAnotherOptionMode && Boolean(aiChargingPlan);

    if (requestAnotherOption && aiChargingPlan) {
      addAiChargingPlanHistory({
        plan: aiChargingPlan,
        status: aiChargingPlanStatus === 'fallback' ? 'fallback' : 'ready',
        inputSignature: currentRecommendationInputSignature,
        batteryPercent: vehicle.batteryLevel,
        targetPercent: chargingTargetPercent,
        minimumPercent: chargingMinimumBatteryPercent,
      });
    }

    if (!requestAnotherOption && recommendationInputsChanged && aiChargingPlanHistory.length) {
      clearAiChargingPlanHistory();
    }

    setAiChargingPlanStatus('loading');

    try {
      const nextPlan = await requestChargingPlan(currentPlannerInput);
      setAiChargingPlan(nextPlan, nextPlan.id === 'ai-charge-na' ? 'fallback' : 'ready', currentRecommendationInputSignature);
    } catch {
      setAiChargingPlan(null, 'error');
    }
  };

  const restoreHistoryOption = (historyId: string) => {
    restoreAiChargingPlanFromHistory(historyId);
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
      <section className="px-1">
        <h1 className="text-3xl font-bold text-slate-100">Hello, {user.name.split(' ')[0]}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold leading-relaxed text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {time}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Thermometer className="h-3.5 w-3.5 text-primary" />
            {weatherTemperatureLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {location}
          </span>
        </div>
      </section>

      <section>
        <div className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant/45 rounded-3xl p-5 shadow-ambient-lg">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-100 leading-tight">AI Charging Recommendation</h2>
                <p className="mt-1 text-xs font-semibold text-slate-400 leading-relaxed">
                  MB Sense predicts charging before the battery becomes a problem.
                </p>
              </div>

            </div>

            <div className="overflow-hidden rounded-2xl border border-primary/30 bg-primary/15 shadow-ambient">
              <div className="flex items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-3">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                  <CalendarClock className="h-4 w-4" />
                  Next Charging
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { if (chargingStationNavigationUrl) navigate(chargingStationNavigationUrl); }} disabled={!chargingStationNavigationUrl} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/35 bg-primary px-4 py-2.5 text-xs font-black uppercase tracking-widest text-on-primary shadow-ambient transition hover:bg-primary/90 hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:border-outline-variant/45 disabled:bg-surface-container-low disabled:text-slate-500">
                    <Navigation className="h-4 w-4" />
                    Navigate
                  </button>
                </div>
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Target charge</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100">{recommendedTarget}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/45 bg-surface-container-low p-3">
                <ShieldCheck className="mb-2 h-4 w-4 text-blue-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Minimum</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100">{minimumBatteryTarget}</p>
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
                <p className="mt-2 text-xs font-bold leading-relaxed text-slate-400">{aiStatusLabel}. {plan.sidePanelDetails.chargingExplanation}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={updateAiRecommendation} disabled={aiChargingPlanStatus === 'loading'} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-center text-[11px] font-black uppercase leading-tight tracking-widest text-on-primary shadow-ambient transition-all hover:bg-primary-dim hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-wait disabled:opacity-70">
                <BatteryCharging className="h-4 w-4 shrink-0" />
                {aiRecommendationButtonLabel}
              </button>
              {plan.calendarAction.shouldCreateEvent && (
                <button type="button" onClick={addChargingPlanToCalendar} className="min-h-12 rounded-2xl border border-outline-variant/45 bg-surface-container-low px-4 py-3 text-center text-[10px] font-black uppercase leading-tight tracking-widest text-slate-200 transition hover:border-primary/35 hover:text-primary">
                  Put in your Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {aiChargingPlanHistory.length > 0 && (
        <section>
          <div className="relative rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg">
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
            <div className="relative z-10">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                  <BatteryCharging className="h-4 w-4" />
                  Recommendation History
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <h2 className="min-w-0 text-xl font-extrabold leading-tight text-slate-100 sm:text-2xl">Saved AI options</h2>
                  <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
                    <span className="text-[9px] font-black uppercase tracking-widest">Saved</span>
                    <span className="text-lg font-black leading-none">{aiChargingPlanHistory.length}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">Restore an earlier recommendation if the new option is not better.</p>
              </div>

              <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-2">
                {[...aiChargingPlanHistory].reverse().map((entry, index) => {
                  const entryStart = parsePlanDateTime(entry.plan.recommendedChargingStart);
                  const entryEnd = parsePlanDateTime(entry.plan.recommendedChargingEnd);
                  const entryStation = displayText(entry.plan.stationRecommendations?.[0]?.name ?? entry.plan.chargingLocationName ?? entry.plan.calendarAction.location ?? entry.plan.backupPlan.locationName);
                  const entryDate = formatDateLabel(entryStart, entry.plan.calendarAction.date);
                  const entryTime = formatTimeLabel(entryStart, entryEnd, entry.plan.calendarAction.startTime, entry.plan.calendarAction.endTime);
                  const savedAt = new Date(entry.savedAt);
                  const savedLabel = Number.isNaN(savedAt.getTime())
                    ? 'Saved option'
                    : savedAt.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

                  return (
                    <div key={entry.id} className="min-w-0 rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Option {aiChargingPlanHistory.length - index}</p>
                          <h3 className="mt-1 break-words text-base font-black leading-snug text-slate-100">{displayText(entry.plan.title)}</h3>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">{savedLabel}</p>
                        </div>
                        <button type="button" onClick={() => restoreHistoryOption(entry.id)} className="shrink-0 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary">
                          Restore
                        </button>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Battery</p>
                          <p className="mt-1 text-sm font-black text-slate-100">{entry.batteryPercent}%</p>
                        </div>
                        <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Policy</p>
                          <p className="mt-1 text-sm font-black text-slate-100">{entry.targetPercent}% / {entry.minimumPercent}%</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-outline-variant/45 bg-surface-container-lowest p-3">
                        <p className="flex min-w-0 items-start gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="min-w-0 break-words">{entryStation}</span>
                        </p>
                        <p className="mt-2 text-sm font-extrabold leading-snug text-slate-100">{entryDate}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">{entryTime}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="relative overflow-hidden rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent" />
          <div className="relative z-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                  <Battery className="h-4 w-4" />
                  Schedule Battery Forecast
                </p>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight text-slate-100">Upcoming driving energy</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">Predicted battery use from calendar activities that require the car.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-slate-100">{todayForecast.title}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{todayForecast.subtitle}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:min-w-[300px]">
                    <div className={cn('rounded-xl border px-3 py-2', todayForecast.totalUsePercent > 25 ? 'border-amber-400/30 bg-amber-500/10' : todayForecast.totalUsePercent > 0 ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-outline-variant/45 bg-surface-container-lowest')}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Use</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Battery className={cn('h-3.5 w-3.5', todayForecast.totalUsePercent > 25 ? 'text-amber-400' : todayForecast.totalUsePercent > 0 ? 'text-emerald-400' : 'text-slate-300')} />
                        <p className={cn('text-sm font-black leading-none', todayForecast.totalUsePercent > 25 ? 'text-amber-400' : todayForecast.totalUsePercent > 0 ? 'text-emerald-400' : 'text-slate-300')}>{todayForecast.totalUsePercent}%</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 py-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Driving</p>
                      <p className="mt-1 text-sm font-black text-slate-100">{todayForecast.drivingEventCount}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 py-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">After</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Battery className="h-3.5 w-3.5 text-primary" />
                        <p className="text-sm font-black text-slate-100">{todayForecast.afterSchedulePercent}%</p>
                      </div>
                    </div>
                  </div>
                </div>

                <motion.div layout className="mt-4 overflow-hidden rounded-xl border border-outline-variant/35 bg-surface-container-lowest/70">
                  {visibleTodayTrips.length ? (
                    <>
                      <div className="divide-y divide-outline-variant/35">
                        <AnimatePresence initial={false}>
                          {visibleTodayTrips.map((trip) => (
                            <motion.div
                              key={`${todayForecast.id}-${trip.eventId}`}
                              layout
                              initial={{ opacity: 0, height: 0, y: -8 }}
                              animate={{ opacity: 1, height: 'auto', y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -8 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              className="overflow-hidden"
                            >
                              <div className="flex items-center justify-between gap-3 px-3 py-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black leading-tight text-slate-100">{trip.title}</p>
                                  <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] font-semibold text-slate-400">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span className="truncate">{trip.location}</span>
                                  </p>
                                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{trip.eventTime} - {trip.distanceKm} km</p>
                                </div>
                                <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-2 text-right">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-primary">Battery</p>
                                  <div className="mt-1 flex items-center justify-end gap-1.5">
                                    <Battery className="h-3.5 w-3.5 text-primary" />
                                    <p className="text-sm font-black leading-none text-primary">-{trip.batteryUsePercent}%</p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                      {todayForecast.trips.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setShowAllTodayForecastTrips((current) => !current)}
                          className="flex min-h-11 w-full items-center justify-center border-t border-outline-variant/35 bg-surface-container-low px-3 text-[10px] font-black uppercase tracking-widest text-primary transition hover:bg-primary/10"
                        >
                          {showAllTodayForecastTrips ? 'Show less' : `Show ${hiddenTodayTripCount} more`}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[112px] items-center justify-center px-3 py-6 text-center">
                      <p className="text-xs font-semibold leading-relaxed text-slate-500">No driving activities scheduled today.</p>
                    </div>
                  )}
                </motion.div>
              </div>

              <div className="grid gap-2">
                {futureForecasts.map((bucket) => (
                  <div key={bucket.id} className="rounded-xl border border-outline-variant/45 bg-surface-container-low p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-100">{bucket.title}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{bucket.subtitle}</p>
                      </div>
                      <div className={cn('shrink-0 rounded-lg border px-2.5 py-1.5 text-right', bucket.totalUsePercent > 25 ? 'border-amber-400/30 bg-amber-500/10' : bucket.totalUsePercent > 0 ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-outline-variant/45 bg-surface-container-lowest')}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Use</p>
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <Battery className={cn('h-3.5 w-3.5', bucket.totalUsePercent > 25 ? 'text-amber-400' : bucket.totalUsePercent > 0 ? 'text-emerald-400' : 'text-slate-300')} />
                          <p className={cn('text-sm font-black leading-none', bucket.totalUsePercent > 25 ? 'text-amber-400' : bucket.totalUsePercent > 0 ? 'text-emerald-400' : 'text-slate-300')}>{bucket.totalUsePercent}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-outline-variant/45 bg-surface-container-lowest px-2.5 py-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Driving</p>
                        <p className="mt-1 text-sm font-black text-slate-100">{bucket.drivingEventCount}</p>
                      </div>
                      <div className="rounded-lg border border-outline-variant/45 bg-surface-container-lowest px-2.5 py-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">After</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Battery className="h-3.5 w-3.5 text-primary" />
                          <p className="text-sm font-black text-slate-100">{bucket.afterSchedulePercent}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
