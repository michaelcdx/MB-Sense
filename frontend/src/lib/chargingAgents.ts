import type { CalendarEvent, ChargingCalendarMeta, VehicleState } from '../store/useAppStore';
import { mercedesEqs450PlusMockData, mercedesEqsDerivedValues, mercedesEqsAiTrainingRules } from '../constants/mercedesEqs450PlusTrainedData';
import { mockDCChargingStationsMalaysia, type DCChargingStation } from '../constants/dcChargingStationsMalaysia';
import { estimateDrivingRoute, resolveLocationCoordinates, type Coordinates, type RouteDistanceSource } from '../constants/realWorldRouteData';
import type { OpenChargeMapStationCandidate } from '../types/chargingPlanner';

type WeatherSnapshot = {
  temp: number;
  condition: string;
};

export type TrafficLevel = 'light' | 'moderate' | 'heavy';
export type ChargingMode = 'AC' | 'DC';
export type ChargingModePreference = ChargingMode | 'auto';

export type GeminiChargingChoice = {
  id: string;
  rank: number;
  mode: ChargingMode;
  start?: string;
  end?: string;
  selectedStationId?: string | null;
  stationName?: string;
  reason: string;
};

export type GeminiChargingDecision = {
  source?: 'gemini' | 'fallback';
  mode: ChargingMode;
  selectedStationId?: string | null;
  selectedChoiceId?: string;
  confidence?: number;
  reason?: string;
  explanation?: string;
  choices?: GeminiChargingChoice[];
};

export type DCStationRecommendation = {
  station: DCChargingStation;
  connector: 'CCS2' | 'Tesla CCS2';
  anchorLocation: string;
  previousLocation?: string;
  nextLocation?: string;
  distanceFromAnchorKm: number;
  detourKm: number;
  score: number;
  reason: string;
};

export type ChargingOptionPlan = {
  mode: ChargingMode;
  window?: AvailabilityWindow;
  start?: Date;
  end?: Date;
  minutesNeeded: number | null;
  blockMinutes: number;
  targetBattery: number;
  canComplete: boolean;
  location: string;
  summary: string;
  selectedStation?: DCStationRecommendation;
  stationOptions: DCStationRecommendation[];
};
export type TripForecast = {
  eventId: string;
  title: string;
  originLocation: string;
  location: string;
  date: Date;
  departureTime: string;
  eventTime: string;
  distanceKm: number;
  routeDurationMinutes?: number;
  routeDistanceSource: RouteDistanceSource;
  traffic: TrafficLevel;
  weatherImpactPercent: number;
  batteryUsePercent: number;
  isReturnHome?: boolean;
};

export type AvailabilityWindow = {
  id: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  location: string;
  chargerAccess: 'home wallbox' | 'public charger nearby' | 'parked only';
  score: number;
};

export type AgentInsight = {
  name: string;
  status: 'ready' | 'watch' | 'action';
  metric: string;
  summary: string;
};

export type ChargingScheduleEventSnapshot = {
  id: string;
  title: string;
  location: string;
  start: string;
  end: string;
  time: string;
  endTime?: string;
  departureTime?: string;
  carNeeded: boolean;
  category: CalendarEvent['category'];
  status?: string;
};

export type ChargingPlan = {
  planningStart: Date;
  scheduleDemand: {
    upcomingEvents: number;
    upcomingSchedule: ChargingScheduleEventSnapshot[];
    travelEvents: number;
    highDemandEvent?: TripForecast;
    trips: TripForecast[];
  };
  energy: {
    currentBattery: number;
    forecastUsePercent: number;
    reserveTarget: number;
    userTargetBattery: number;
    chargeRecommended: boolean;
    chargeReason: 'minimum_threshold' | 'idle_day_opportunity' | 'none';
    idleDayTopUpThreshold: number;
    idleDayOpportunityDate: string | null;
    idleDayScheduleIsEmpty: boolean;
    plannedStartBattery: number;
    withoutChargeProjectedBattery: number;
    projectedBattery: number;
    recommendedTarget: number;
    topUpPercent: number;
    rangePerPercentKm: number;
    batteryCapacityKWh: number;
  };
  availability: {
    windows: AvailabilityWindow[];
  };
  charging: {
    chargeRatePercentPerHour: number;
    minutesNeeded: number;
    targetBattery: number;
    ac: {
      minutesNeeded: number;
      targetBattery: number;
      chargeRatePercentPerHour: number;
    };
    dcFast: {
      minutesNeeded: number | null;
      targetBattery: number;
      validToTarget: boolean;
      cappedAtBattery: number;
      unsupportedTopUpPercent: number;
    };
  };
  decision: {
    bestWindow?: AvailabilityWindow;
    canComplete: boolean;
    start?: Date;
    end?: Date;
  };
  chargingStrategy: {
    preference: ChargingModePreference;
    selected: ChargingOptionPlan;
    ac: ChargingOptionPlan;
    dc: ChargingOptionPlan;
    aiDecision?: GeminiChargingDecision;
  };
  explanation: string;
  agents: AgentInsight[];
};

const reserveTarget = 20;
const dailyTarget = 80;
const defaultPlanningDate = new Date(2026, 6, 3);
const horizonDays = 7;
const minTargetCharge = 50;
const maxTargetCharge = 100;
const dcFastMinSoc = mercedesEqsAiTrainingRules.dcFastChargingValidSocRange.minPercent;
const dcFastMaxSoc = mercedesEqsAiTrainingRules.dcFastChargingValidSocRange.maxPercent;
const rangePerPercentKm = mercedesEqsDerivedValues.rangePer1PercentKm;
const acMinutesPerPercent = mercedesEqsDerivedValues.acCharging.averageMinutesPer1Percent_from10To100;
const dcMinutesPerPercent = mercedesEqsDerivedValues.dcFastCharging.averageMinutesPer1Percent_from10To80;
const chargeRatePercentPerHour = 60 / acMinutesPerPercent;
const batteryCapacityKWh = mercedesEqs450PlusMockData.vehicle.batteryCapacityKWh;
export const managedChargingEventId = 'ai-managed-charging-recommendation';
const dcStationBufferMinutes = 15;
export const homeChargingLocation = 'Xiamen University Malaysia, Sunsuria City, Sepang';
const acChargeCurve = mercedesEqs450PlusMockData.batteryPercentageData
  .map((point) => ({
    socPercent: point.socPercent,
    minutes: point.acChargeFrom10PercentToThisSocMinutes_est
  }))
  .filter((point) => point.minutes !== null)
  .sort((a, b) => a.socPercent - b.socPercent);
const dcChargeCurve = mercedesEqs450PlusMockData.batteryPercentageData
  .map((point) => ({
    socPercent: point.socPercent,
    minutes: point.dcFastChargeFrom10PercentToThisSocMinutes_est
  }))
  .filter((point): point is { socPercent: number; minutes: number } => point.minutes !== null)
  .sort((a, b) => a.socPercent - b.socPercent);

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getGreatCircleDistanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function estimateStationRoadDistanceKm(from: Coordinates, to: Coordinates) {
  const directDistanceKm = getGreatCircleDistanceKm(from, to);
  if (directDistanceKm < 0.4) return 0;
  const roadFactor = directDistanceKm > 45 ? 1.22 : directDistanceKm > 15 ? 1.3 : 1.38;
  return roundToSingleDecimal(directDistanceKm * roadFactor);
}

function parseTimeToMinutes(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 9 * 60;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function clampPercent(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function cumulativeAcChargeMinutesAtSoc(socPercent: number) {
  const bounded = clampPercent(socPercent, 0, 100);
  const first = acChargeCurve[0];
  const last = acChargeCurve[acChargeCurve.length - 1];

  if (!first || !last) return Math.max(0, (bounded - 10) * acMinutesPerPercent);
  if (bounded <= first.socPercent) return Math.max(0, (bounded - first.socPercent) * acMinutesPerPercent + first.minutes);
  if (bounded >= last.socPercent) return last.minutes + (bounded - last.socPercent) * acMinutesPerPercent;

  for (let index = 1; index < acChargeCurve.length; index += 1) {
    const previous = acChargeCurve[index - 1];
    const next = acChargeCurve[index];
    if (bounded > next.socPercent) continue;

    const span = next.socPercent - previous.socPercent;
    const progress = span ? (bounded - previous.socPercent) / span : 0;
    return previous.minutes + (next.minutes - previous.minutes) * progress;
  }

  return last.minutes;
}

export function getAcChargeMinutesNeeded(currentPercent: number, targetPercent: number) {
  const current = clampPercent(currentPercent);
  const target = clampPercent(targetPercent);
  if (target <= current) return 0;
  return Math.ceil(cumulativeAcChargeMinutesAtSoc(target) - cumulativeAcChargeMinutesAtSoc(current));
}

function cumulativeDcFastChargeMinutesAtSoc(socPercent: number) {
  const bounded = clampPercent(socPercent, dcFastMinSoc, dcFastMaxSoc);
  const first = dcChargeCurve[0];
  const last = dcChargeCurve[dcChargeCurve.length - 1];

  if (!first || !last) return Math.max(0, (bounded - dcFastMinSoc) * dcMinutesPerPercent);
  if (bounded <= first.socPercent) return Math.max(0, (bounded - first.socPercent) * dcMinutesPerPercent + first.minutes);
  if (bounded >= last.socPercent) return last.minutes;

  for (let index = 1; index < dcChargeCurve.length; index += 1) {
    const previous = dcChargeCurve[index - 1];
    const next = dcChargeCurve[index];
    if (bounded > next.socPercent) continue;

    const span = next.socPercent - previous.socPercent;
    const progress = span ? (bounded - previous.socPercent) / span : 0;
    return previous.minutes + (next.minutes - previous.minutes) * progress;
  }

  return last.minutes;
}

function getDcFastChargeMinutesNeeded(currentPercent: number, targetPercent: number) {
  const current = clampPercent(currentPercent, dcFastMinSoc, dcFastMaxSoc);
  const target = clampPercent(targetPercent, dcFastMinSoc, dcFastMaxSoc);
  if (target <= current) return 0;
  return Math.ceil(cumulativeDcFastChargeMinutesAtSoc(target) - cumulativeDcFastChargeMinutesAtSoc(current));
}

function minutesToDisplayTime(minutes: number) {
  const bounded = Math.max(0, Math.min(24 * 60 - 1, minutes));
  const hour24 = Math.floor(bounded / 60);
  const minute = bounded % 60;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function eventDateTime(event: CalendarEvent, time = event.time) {
  const base = event.date instanceof Date ? event.date : new Date(event.date);
  const next = startOfDay(base);
  const minutes = parseTimeToMinutes(time);
  next.setMinutes(minutes);
  return next;
}

function serializeScheduleEventForPrediction(event: CalendarEvent): ChargingScheduleEventSnapshot {
  const start = eventDateTime(event, event.departureTime ?? event.time);
  const end = eventDateTime(event, event.endTime ?? event.time);
  if (end <= start) end.setMinutes(start.getMinutes() + 60);

  return {
    id: event.id,
    title: event.title,
    location: event.location,
    start: start.toISOString(),
    end: end.toISOString(),
    time: event.time,
    endTime: event.endTime,
    departureTime: event.departureTime,
    carNeeded: event.carNeeded,
    category: event.category,
    status: event.status
  };
}

function getPlanningStart(events: CalendarEvent[], planningAnchor?: Date) {
  if (planningAnchor && !Number.isNaN(planningAnchor.getTime())) {
    const anchor = new Date(planningAnchor);
    anchor.setSeconds(0, 0);
    const anchorDay = startOfDay(anchor);
    const hasExplicitTime = anchor.getHours() !== 0 || anchor.getMinutes() !== 0;
    if (hasExplicitTime) return anchor;

    const now = new Date();
    now.setSeconds(0, 0);
    return sameDay(anchorDay, now) ? now : anchorDay;
  }
  const today = startOfDay(new Date());
  const datedEvents = events.map((event) => event.date instanceof Date ? event.date : new Date(event.date));
  const min = datedEvents.reduce<Date | null>((current, date) => current && current < date ? current : date, null);
  const max = datedEvents.reduce<Date | null>((current, date) => current && current > date ? current : date, null);

  if (min && max && today >= startOfDay(min) && today <= startOfDay(max)) return today;
  return defaultPlanningDate;
}

function estimateDistanceKm(location: string) {
  const value = location.toLowerCase();
  if (value.includes('singapore')) return 95;
  if (value.includes('klia')) return 82;
  if (value.includes('cyberjaya')) return 48;
  if (value.includes('putrajaya')) return 42;
  if (value.includes('shah alam')) return 38;
  if (value.includes('petaling jaya') || value.includes('dealer')) return 26;
  if (value.includes('klcc') || value.includes('trx')) return 24;
  if (value.includes('bangsar') || value.includes('mont kiara')) return 18;
  if (value.includes('royal lake')) return 16;
  if (value.includes('home') || value.includes('teams') || value.includes('online') || value.includes('hq')) return 0;
  return 22;
}

function isPhysicalLocation(location: string) {
  const value = location.toLowerCase();
  return !value.includes('online') && !value.includes('teams');
}

function estimateFallbackDurationMinutes(distanceKm: number) {
  if (distanceKm <= 0) return 0;

  const averageSpeedKmh = distanceKm > 65 ? 72 : distanceKm > 30 ? 56 : distanceKm > 12 ? 42 : 30;
  return Math.max(5, Math.round(distanceKm / averageSpeedKmh * 60));
}

function estimateTripRoute(fromLocation: string, toLocation: string) {
  const route = estimateDrivingRoute(fromLocation, toLocation);
  if (route) return route;

  const distanceKm = estimateDistanceKm(toLocation);
  return {
    distanceKm,
    distanceMeters: Math.round(distanceKm * 1000),
    durationMinutesNoTraffic: estimateFallbackDurationMinutes(distanceKm),
    source: 'heuristic-estimated' as const
  };
}

function getTrafficLevel(event: CalendarEvent) {
  const departure = parseTimeToMinutes(event.departureTime ?? event.time);
  const status = `${event.status ?? ''} ${event.title}`.toLowerCase();
  const peak = (departure >= 7 * 60 && departure <= 9 * 60 + 30) || (departure >= 17 * 60 && departure <= 19 * 60 + 30);
  const lunchPeak = departure >= 12 * 60 && departure <= 14 * 60;

  if (peak || status.includes('important') || status.includes('airport')) return 'heavy';
  if (lunchPeak || status.includes('charging') || status.includes('review')) return 'moderate';
  return 'light';
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function trafficMultiplier(level: TrafficLevel) {
  if (level === 'heavy') return 1.18;
  if (level === 'moderate') return 1.1;
  return 1;
}

function weatherImpact(weather: WeatherSnapshot) {
  const condition = weather.condition.toLowerCase();
  let impact = weather.temp >= 31 ? 4 : weather.temp <= 18 ? 3 : 1;
  if (condition.includes('rain') || condition.includes('storm')) impact += 5;
  if (condition.includes('cloud')) impact += 1;
  if (condition.includes('fog') || condition.includes('wind')) impact += 3;
  return impact;
}

function buildTripForecasts(events: CalendarEvent[], weather: WeatherSnapshot, planningStart: Date) {
  const horizonEnd = addDays(planningStart, horizonDays);
  const trips = events
    .filter((event) => event.carNeeded)
    .map((event) => ({
      event,
      date: eventDateTime(event)
    }))
    .filter(({ date, event }) => date >= planningStart && date < horizonEnd && isPhysicalLocation(event.location))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const tripForecasts = trips
    .map(({ event, date }, index) => {
      const previousTrip = trips[index - 1];
      const originLocation = previousTrip && startOfDay(previousTrip.date).getTime() === startOfDay(date).getTime()
        ? previousTrip.event.location
        : homeChargingLocation;
      const route = estimateTripRoute(originLocation, event.location);
      const distanceKm = route.distanceKm;
      const traffic = getTrafficLevel(event);
      const weatherImpactPercent = weatherImpact(weather);
      const batteryUsePercent = Math.ceil((distanceKm / rangePerPercentKm) * trafficMultiplier(traffic) * (1 + weatherImpactPercent / 100));

      return {
        eventId: event.id,
        title: event.title,
        originLocation,
        location: event.location,
        date,
        departureTime: event.departureTime ?? minutesToDisplayTime(Math.max(parseTimeToMinutes(event.time) - 30, 0)),
        eventTime: event.time,
        distanceKm,
        routeDurationMinutes: route.durationMinutesNoTraffic,
        routeDistanceSource: route.source,
        traffic,
        weatherImpactPercent,
        batteryUsePercent
      } satisfies TripForecast;
    })
    .filter((trip) => trip.distanceKm > 0);

  const returnHomeForecasts = Array.from(
    trips.reduce<Map<string, { event: CalendarEvent; date: Date }[]>>((days, trip) => {
      const key = getLocalDateKey(trip.date);
      const dayTrips = days.get(key) ?? [];
      dayTrips.push(trip);
      days.set(key, dayTrips);
      return days;
    }, new Map()).entries()
  ).map<TripForecast | null>(([dayKey, dayTrips]) => {
    const lastTrip = dayTrips[dayTrips.length - 1];
    if (!lastTrip) return null;

    const returnRoute = estimateTripRoute(lastTrip.event.location, homeChargingLocation);
    if (returnRoute.distanceKm <= 0) return null;

    const eventStart = eventDateTime(lastTrip.event, lastTrip.event.departureTime ?? lastTrip.event.time);
    let returnDate = eventDateTime(lastTrip.event, lastTrip.event.endTime ?? lastTrip.event.time);
    if (returnDate <= eventStart) returnDate = addMinutes(eventStart, 60);

    const returnTime = minutesToDisplayTime(returnDate.getHours() * 60 + returnDate.getMinutes());
    const returnEvent: CalendarEvent = {
      ...lastTrip.event,
      id: `${lastTrip.event.id}-return-home`,
      title: 'Return home',
      location: homeChargingLocation,
      time: returnTime,
      departureTime: returnTime,
      status: 'Return home',
      endTime: undefined,
    };
    const traffic = getTrafficLevel(returnEvent);
    const weatherImpactPercent = weatherImpact(weather);
    const batteryUsePercent = Math.ceil((returnRoute.distanceKm / rangePerPercentKm) * trafficMultiplier(traffic) * (1 + weatherImpactPercent / 100));

    return {
      eventId: `return-home-${dayKey}`,
      title: 'Return home',
      originLocation: lastTrip.event.location,
      location: homeChargingLocation,
      date: returnDate,
      departureTime: returnTime,
      eventTime: returnTime,
      distanceKm: returnRoute.distanceKm,
      routeDurationMinutes: returnRoute.durationMinutesNoTraffic,
      routeDistanceSource: returnRoute.source,
      traffic,
      weatherImpactPercent,
      batteryUsePercent,
      isReturnHome: true,
    } satisfies TripForecast;
  }).filter((trip): trip is TripForecast => Boolean(trip));

  return [...tripForecasts, ...returnHomeForecasts].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function isManagedChargingEvent(event: CalendarEvent) {
  return event.id === managedChargingEventId || event.status === 'AI MANAGED CHARGING';
}

function buildBusyBlocks(events: CalendarEvent[], planningStart: Date) {
  const horizonEnd = addDays(planningStart, horizonDays);
  return events
    .filter((event) => !isManagedChargingEvent(event))
    .map((event) => {
      const start = eventDateTime(event, event.departureTime ?? event.time);
      const end = eventDateTime(event, event.endTime ?? event.time);
      if (end <= start) end.setMinutes(start.getMinutes() + 60);
      return { start, end, event };
    })
    .filter((block) => block.end > planningStart && block.start < horizonEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function buildPhysicalTravelBlocks(events: CalendarEvent[], planningStart: Date) {
  const horizonEnd = addDays(planningStart, horizonDays);
  return events
    .filter((event) => event.carNeeded && isPhysicalLocation(event.location) && !isManagedChargingEvent(event))
    .map((event) => {
      const start = eventDateTime(event, event.departureTime ?? event.time);
      const end = eventDateTime(event, event.endTime ?? event.time);
      if (end <= start) end.setMinutes(start.getMinutes() + 45);
      return { start, end, event };
    })
    .filter((block) => block.end > planningStart && block.start < horizonEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function windowScore(start: Date, end: Date, durationMinutes: number) {
  const hour = start.getHours();
  let score = Math.min(durationMinutes / 30, 12);
  if (hour >= 19 || hour < 7) score += 7;
  if (hour >= 10 && hour <= 16) score += 2;
  if (start.getHours() >= 18 || end.getHours() <= 8 || durationMinutes >= 7 * 60) score += 5;
  return score;
}

function getChargerAccess(start: Date) {
  const hour = start.getHours();
  if (hour >= 18 || hour < 7) return 'home wallbox' as const;
  if (hour >= 10 && hour <= 16) return 'public charger nearby' as const;
  return 'parked only' as const;
}

function buildAvailabilityWindows(events: CalendarEvent[], planningStart: Date) {
  const blocks = buildBusyBlocks(events, planningStart);
  const horizonEnd = addDays(planningStart, horizonDays);
  const windows: AvailabilityWindow[] = [];
  let cursor = new Date(planningStart);

  for (const block of blocks) {
    const gapStart = new Date(Math.max(cursor.getTime(), planningStart.getTime()));
    const gapEnd = new Date(Math.min(block.start.getTime(), horizonEnd.getTime()));
    const durationMinutes = Math.round((gapEnd.getTime() - gapStart.getTime()) / 60000);

    if (durationMinutes >= 30) {
      const chargerAccess = getChargerAccess(gapStart);
      windows.push({
        id: `${gapStart.toISOString()}-${gapEnd.toISOString()}`,
        start: gapStart,
        end: gapEnd,
        durationMinutes,
        location: chargerAccess === 'home wallbox' ? homeChargingLocation : 'Parked between appointments',
        chargerAccess,
        score: windowScore(gapStart, gapEnd, durationMinutes) + (chargerAccess === 'home wallbox' ? 4 : chargerAccess === 'public charger nearby' ? 2 : 0)
      });
    }

    if (block.end > cursor) cursor = new Date(block.end);
  }

  const finalDuration = Math.round((horizonEnd.getTime() - cursor.getTime()) / 60000);
  if (finalDuration >= 30) {
    const chargerAccess = getChargerAccess(cursor);
    windows.push({
      id: `${cursor.toISOString()}-${horizonEnd.toISOString()}`,
      start: new Date(cursor),
      end: horizonEnd,
      durationMinutes: finalDuration,
      location: chargerAccess === 'home wallbox' ? homeChargingLocation : 'Parked between appointments',
      chargerAccess,
      score: windowScore(cursor, horizonEnd, finalDuration) + (chargerAccess === 'home wallbox' ? 4 : chargerAccess === 'public charger nearby' ? 2 : 0)
    });
  }

  return windows.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
}

function buildIdleDayTopUpOpportunity(events: CalendarEvent[], planningStart: Date, currentBattery: number, targetBattery: number, minimumBatteryTarget: number) {
  const nextDay = addDays(startOfDay(planningStart), 1);
  const nextDayEvents = events.filter((event) => sameDay(eventDateTime(event), nextDay));
  const idleDayTopUpThreshold = Math.min(
    targetBattery - 1,
    Math.max(minimumBatteryTarget + 10, targetBattery - 20, 50)
  );
  const shouldRecommend = nextDayEvents.length === 0
    && currentBattery < targetBattery
    && currentBattery <= idleDayTopUpThreshold;

  return {
    date: nextDay,
    scheduleIsEmpty: nextDayEvents.length === 0,
    eventCount: nextDayEvents.length,
    idleDayTopUpThreshold,
    shouldRecommend
  };
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function getStationCoordinates(station: DCChargingStation): Coordinates {
  return { lat: station.latitude, lng: station.longitude };
}

function getCompatibleConnector(station: DCChargingStation): 'CCS2' | 'Tesla CCS2' | undefined {
  if (station.connectors.includes('CCS2')) return 'CCS2';
  if (station.connectors.includes('Tesla CCS2')) return 'Tesla CCS2';
  return undefined;
}

function normalizeOpenChargeMapConnector(connector: string): DCChargingStation['connectors'][number] | null {
  const normalized = connector.toLowerCase();
  if (normalized.includes('tesla')) return 'Tesla CCS2';
  if (normalized.includes('ccs')) return 'CCS2';
  if (normalized.includes('chademo')) return 'CHAdeMO';
  return null;
}

function mapOpenChargeMapStationToDCStation(station: OpenChargeMapStationCandidate): DCChargingStation | null {
  const connector = normalizeOpenChargeMapConnector(station.connector);
  if (!connector || connector === 'CHAdeMO') return null;
  if (!Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) return null;

  return {
    id: station.id,
    name: station.name,
    provider: station.provider || 'Open Charge Map',
    state: station.state ?? station.city ?? 'N/A',
    city: station.city || 'N/A',
    address: station.address || station.name,
    latitude: station.latitude,
    longitude: station.longitude,
    chargerType: 'DC',
    connectors: [connector],
    maxPowerKw: Math.max(0, Math.round(station.maxPowerKw || 0)),
    stalls: Math.max(0, Math.round(station.stalls || 0)),
    isHighwayStop: false,
    notes: `${station.status ? `${station.status}. ` : ''}${station.attribution}`,
  };
}

function getWindowRouteContext(events: CalendarEvent[], planningStart: Date, windowStart: Date) {
  const travelBlocks = buildPhysicalTravelBlocks(events, planningStart);
  const previous = [...travelBlocks].reverse().find((block) => block.end <= windowStart);
  const next = travelBlocks.find((block) => block.start >= windowStart);
  const previousLocation = previous?.event.location ?? homeChargingLocation;

  return {
    previousLocation,
    nextLocation: next?.event.location,
    anchorLocation: previousLocation
  };
}

function rankDCStationsForWindow(events: CalendarEvent[], planningStart: Date, window: AvailabilityWindow, openChargeMapStations: OpenChargeMapStationCandidate[] = []): DCStationRecommendation[] {
  const context = getWindowRouteContext(events, planningStart, window.start);
  const anchorCoordinates = resolveLocationCoordinates(context.anchorLocation) ?? resolveLocationCoordinates(homeChargingLocation);
  if (!anchorCoordinates) return [];

  const nextCoordinates = context.nextLocation ? resolveLocationCoordinates(context.nextLocation) : undefined;
  const anchorToNextKm = nextCoordinates ? estimateStationRoadDistanceKm(anchorCoordinates, nextCoordinates) : 0;

  const candidateStations = openChargeMapStations.length
    ? openChargeMapStations.map(mapOpenChargeMapStationToDCStation).filter((station): station is DCChargingStation => Boolean(station))
    : mockDCChargingStationsMalaysia;

  return candidateStations
    .map<DCStationRecommendation | null>((station) => {
      const connector = getCompatibleConnector(station);
      if (!connector) return null;

      const stationCoordinates = getStationCoordinates(station);
      const distanceFromAnchorKm = estimateStationRoadDistanceKm(anchorCoordinates, stationCoordinates);
      const viaStationKm = nextCoordinates
        ? estimateStationRoadDistanceKm(anchorCoordinates, stationCoordinates) + estimateStationRoadDistanceKm(stationCoordinates, nextCoordinates)
        : distanceFromAnchorKm;
      const detourKm = nextCoordinates ? Math.max(0, roundToSingleDecimal(viaStationKm - anchorToNextKm)) : 0;
      const highwayBonus = station.isHighwayStop && nextCoordinates ? 1.2 : 0;
      const powerBonus = station.maxPowerKw / 120;
      const stallBonus = station.stalls / 8;
      const score = distanceFromAnchorKm * 1.1 + detourKm * 1.8 - powerBonus - stallBonus - highwayBonus;
      const reason = nextCoordinates && detourKm <= 3
        ? `Near the route from ${context.anchorLocation} to ${context.nextLocation}`
        : distanceFromAnchorKm <= 5
          ? `Closest CCS station to ${context.anchorLocation}`
          : `Best CCS option from ${context.anchorLocation}`;

      const recommendation: DCStationRecommendation = {
        station,
        connector,
        anchorLocation: context.anchorLocation,
        previousLocation: context.previousLocation,
        nextLocation: context.nextLocation,
        distanceFromAnchorKm,
        detourKm,
        score,
        reason
      };
      return recommendation;
    })
    .filter((station): station is DCStationRecommendation => Boolean(station))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
}

function selectAcWindow(windows: AvailabilityWindow[], blockMinutes: number) {
  return windows
    .filter((window) => window.durationMinutes >= blockMinutes)
    .sort((a, b) => {
      const aHome = a.chargerAccess === 'home wallbox' ? 0 : 1;
      const bHome = b.chargerAccess === 'home wallbox' ? 0 : 1;
      const aOvernight = a.start.getHours() >= 18 || a.start.getHours() < 7 || a.durationMinutes >= 7 * 60 ? 0 : 1;
      const bOvernight = b.start.getHours() >= 18 || b.start.getHours() < 7 || b.durationMinutes >= 7 * 60 ? 0 : 1;
      return aHome - bHome || aOvernight - bOvernight || a.start.getTime() - b.start.getTime();
    })[0];
}

function selectDcWindow(windows: AvailabilityWindow[], blockMinutes: number) {
  const feasible = windows.filter((window) => window.durationMinutes >= blockMinutes);
  const evening = feasible.filter((window) => window.start.getHours() >= 17 || window.start.getHours() < 7);
  return (evening.length ? evening : feasible).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
}

function buildChargingOptionPlans(events: CalendarEvent[], planningStart: Date, windows: AvailabilityWindow[], acMinutesNeeded: number, dcFastMinutesNeeded: number | null, targetBattery: number, dcFastTargetBattery: number, preference: ChargingModePreference, shouldCharge: boolean, aiDecision?: GeminiChargingDecision, openChargeMapStations: OpenChargeMapStationCandidate[] = []) {
  if (!shouldCharge) {
    const ac: ChargingOptionPlan = {
      mode: 'AC',
      minutesNeeded: 0,
      blockMinutes: 0,
      targetBattery,
      canComplete: true,
      location: homeChargingLocation,
      summary: 'No charging is needed because the forecast stays above the minimum battery threshold.',
      stationOptions: []
    };

    const dc: ChargingOptionPlan = {
      mode: 'DC',
      minutesNeeded: null,
      blockMinutes: 0,
      targetBattery: dcFastTargetBattery,
      canComplete: false,
      location: 'No public DC charging needed',
      summary: 'No DC stop is recommended while the battery forecast remains above the minimum threshold.',
      stationOptions: []
    };

    return { preference, selected: ac, ac, dc, aiDecision: undefined };
  }

  const acBlockMinutes = Math.max(acMinutesNeeded, 30);
  const dcBlockMinutes = Math.max((dcFastMinutesNeeded ?? 0) + dcStationBufferMinutes, 30);
  const acWindow = selectAcWindow(windows, acBlockMinutes);
  const dcWindow = dcFastMinutesNeeded === null ? undefined : selectDcWindow(windows, dcBlockMinutes);
  const dcStations = dcWindow ? rankDCStationsForWindow(events, planningStart, dcWindow, openChargeMapStations) : [];
  const usableAiDecision = aiDecision && (preference === 'auto' || aiDecision.mode === preference) ? aiDecision : undefined;
  const aiStation = usableAiDecision?.mode === 'DC' && usableAiDecision.selectedStationId
    ? dcStations.find((station) => station.station.id === usableAiDecision.selectedStationId)
    : undefined;
  const selectedStation = aiStation ?? dcStations[0];

  const ac: ChargingOptionPlan = {
    mode: 'AC',
    window: acWindow,
    start: acWindow?.start,
    end: acWindow ? addMinutes(acWindow.start, Math.min(acBlockMinutes, acWindow.durationMinutes)) : undefined,
    minutesNeeded: acMinutesNeeded,
    blockMinutes: acBlockMinutes,
    targetBattery,
    canComplete: Boolean(acWindow),
    location: homeChargingLocation,
    summary: acWindow
      ? `AC needs ${acMinutesNeeded} minutes, so MB Sense chose a long ${acWindow.chargerAccess} window.`
      : `No free window is long enough for the ${acMinutesNeeded} minute AC charge.`,
    stationOptions: []
  };

  const dc: ChargingOptionPlan = {
    mode: 'DC',
    window: dcWindow,
    start: dcWindow?.start,
    end: dcWindow ? addMinutes(dcWindow.start, Math.min(dcBlockMinutes, dcWindow.durationMinutes)) : undefined,
    minutesNeeded: dcFastMinutesNeeded,
    blockMinutes: dcBlockMinutes,
    targetBattery: dcFastTargetBattery,
    canComplete: Boolean(dcWindow && selectedStation),
    location: selectedStation ? selectedStation.station.address : 'No compatible CCS2 DC station found',
    selectedStation,
    stationOptions: dcStations,
    summary: selectedStation
      ? `${selectedStation.station.name} is the top CCS2 DC station near ${selectedStation.anchorLocation}.`
      : 'No compatible CCS2 DC station could be ranked for the available DC window.'
  };

  const canUseAiDecision = usableAiDecision?.mode === 'AC' ? ac.canComplete : usableAiDecision?.mode === 'DC' ? dc.canComplete : false;
  const aiSelected = canUseAiDecision ? (usableAiDecision?.mode === 'AC' ? ac : dc) : undefined;
  const canUsePreferred = preference === 'AC' ? ac.canComplete : preference === 'DC' ? dc.canComplete : false;
  const selected = aiSelected ?? (canUsePreferred
    ? (preference === 'AC' ? ac : dc)
    : dc.canComplete && acMinutesNeeded >= 180
      ? dc
      : ac.canComplete
        ? ac
        : dc.canComplete
          ? dc
          : ac);

  return { preference, selected, ac, dc, aiDecision: aiSelected ? usableAiDecision : undefined };
}

function dcStationToCalendarOption(recommendation: DCStationRecommendation): ChargingCalendarMeta['stationOptions'][number] {
  return {
    id: recommendation.station.id,
    name: recommendation.station.name,
    provider: recommendation.station.provider,
    city: recommendation.station.city,
    address: recommendation.station.address,
    connector: recommendation.connector,
    maxPowerKw: recommendation.station.maxPowerKw,
    stalls: recommendation.station.stalls,
    distanceFromAnchorKm: recommendation.distanceFromAnchorKm,
    detourKm: recommendation.detourKm,
    isHighwayStop: recommendation.station.isHighwayStop,
    reason: recommendation.reason
  };
}

function buildExplanation(plan: Omit<ChargingPlan, 'explanation' | 'agents'>) {
  const selected = plan.chargingStrategy.selected;
  const leadTrip = plan.scheduleDemand.highDemandEvent;
  const aiExplanation = plan.chargingStrategy.aiDecision?.explanation?.trim();
  if (aiExplanation && selected.start && selected.end) return aiExplanation;

  if (!selected.start || !selected.end || plan.energy.topUpPercent === 0) {
    if (plan.energy.chargeRecommended) {
      if (plan.energy.chargeReason === 'idle_day_opportunity') {
        return `Tomorrow has no scheduled activities and the battery is ${plan.energy.currentBattery}%, so MB Sense recommends using the open day to charge toward the user target of ${plan.energy.userTargetBattery}%.`;
      }
      return `Battery is projected to fall to ${plan.energy.withoutChargeProjectedBattery}% without charging, below the ${plan.energy.reserveTarget}% minimum threshold. Use the next practical parked window to recover toward the user target of ${plan.energy.userTargetBattery}%.`;
    }
    return `No charge is recommended yet. Without charging, battery is projected to finish at ${plan.energy.withoutChargeProjectedBattery}% after the next ${plan.scheduleDemand.travelEvents} drive events, above the ${plan.energy.reserveTarget}% minimum threshold.`;
  }

  if (selected.mode === 'DC' && selected.selectedStation) {
    return `Use DC fast charging because AC needs ${plan.chargingStrategy.ac.minutesNeeded} minutes. MB Sense picked ${selected.selectedStation.station.name} because it supports ${selected.selectedStation.connector} and is ${selected.selectedStation.distanceFromAnchorKm} km from ${selected.selectedStation.anchorLocation}.`;
  }

  if (plan.energy.chargeReason === 'idle_day_opportunity') {
    return `Use AC charging during the open day because tomorrow has no scheduled activities and the battery is below the ${plan.energy.idleDayTopUpThreshold}% idle-day top-up threshold. AC charging to ${selected.targetBattery}% takes about ${selected.minutesNeeded ?? 0} minutes.`;
  }

  return `Use AC charging during a long ${selected.window?.chargerAccess ?? 'free'} window because ${leadTrip?.title ?? 'the upcoming schedule'} creates the highest demand. AC charging to ${selected.targetBattery}% takes about ${selected.minutesNeeded ?? 0} minutes.`;
}

function buildAgents(plan: Omit<ChargingPlan, 'explanation' | 'agents'>): AgentInsight[] {
  const best = plan.decision.bestWindow;
  const highDemand = plan.scheduleDemand.highDemandEvent;
  const scheduleStatus: AgentInsight['status'] = plan.scheduleDemand.travelEvents >= 4 ? 'watch' : 'ready';
  const energyStatus: AgentInsight['status'] = plan.energy.chargeRecommended
    ? 'action'
    : plan.energy.forecastUsePercent >= 35
      ? 'watch'
      : 'ready';
  const chargingStatus: AgentInsight['status'] = plan.energy.chargeRecommended
    ? 'action'
    : plan.charging.minutesNeeded > 90 || plan.energy.forecastUsePercent >= 35
      ? 'watch'
      : 'ready';
  const decisionStatus: AgentInsight['status'] = !plan.energy.chargeRecommended || plan.decision.canComplete ? 'ready' : 'action';
  const dcFastSummary = plan.charging.dcFast.validToTarget
    ? `DC fast estimate is ${plan.charging.dcFast.minutesNeeded ?? 0} min to ${plan.charging.dcFast.targetBattery}%.`
    : `DC fast is capped at ${plan.charging.dcFast.cappedAtBattery}% because the training data stops at 80%.`;

  return [
    {
      name: 'Schedule Agent',
      status: scheduleStatus,
      metric: `${plan.scheduleDemand.travelEvents} drives`,
      summary: `Scanned ${plan.scheduleDemand.upcomingEvents} current schedule blocks and found ${plan.scheduleDemand.travelEvents} car-required trips.`
    },
    {
      name: 'Energy Agent',
      status: energyStatus,
      metric: `${plan.energy.withoutChargeProjectedBattery}% left`,
      summary: plan.energy.chargeReason === 'idle_day_opportunity'
        ? `Tomorrow is open and battery is below the ${plan.energy.idleDayTopUpThreshold}% idle-day top-up threshold, so a low-disruption charge is recommended.`
        : `${highDemand ? `${highDemand.title} is the highest demand trip. ` : ''}Recommends charging only if the no-charge forecast drops below the ${plan.energy.reserveTarget}% minimum threshold.`
    },
    {
      name: 'Availability Agent',
      status: plan.availability.windows.length ? 'ready' : 'action',
      metric: `${plan.availability.windows.length} free slots`,
      summary: `Rebuilt parked gaps from ${plan.scheduleDemand.upcomingEvents} schedule blocks and found slots of at least one hour.`
    },
    {
      name: 'Charging Agent',
      status: chargingStatus,
      metric: plan.energy.chargeRecommended ? `${plan.charging.targetBattery}% target` : 'Hold charge',
      summary: plan.energy.chargeRecommended
        ? plan.energy.chargeReason === 'idle_day_opportunity'
          ? `Empty next-day schedule creates a good charging window, so charging targets the user-defined ${plan.energy.userTargetBattery}%. AC takes ${plan.charging.ac.minutesNeeded} min. ${dcFastSummary}`
          : `Forecast falls below ${plan.energy.reserveTarget}%, so charging targets the user-defined ${plan.energy.userTargetBattery}%. AC takes ${plan.charging.ac.minutesNeeded} min. ${dcFastSummary}`
        : `Forecast stays above ${plan.energy.reserveTarget}%, so no charging session is recommended.`
    },
    {
      name: 'Decision Agent',
      status: decisionStatus,
      metric: best ? best.chargerAccess : 'No fit',
      summary: best
        ? `Selected from ${plan.availability.windows.length} available slots around ${highDemand?.title ?? 'the latest travel demand'}.`
        : 'No available slot can complete the current charging target.'
    },
    {
      name: 'Explanation Agent',
      status: 'ready',
      metric: `${plan.scheduleDemand.travelEvents} trips`,
      summary: 'Refreshes the recommendation from the latest schedule, energy, availability, charging, and decision results.'
    }
  ];
}

export function buildChargingPlan(events: CalendarEvent[], vehicle: VehicleState, weather: WeatherSnapshot, targetChargePercent = dailyTarget, planningAnchor?: Date, chargingPreference: ChargingModePreference = 'auto', aiDecision?: GeminiChargingDecision, openChargeMapStations: OpenChargeMapStationCandidate[] = [], minimumBatteryPercent = reserveTarget): ChargingPlan {
  const planningStart = getPlanningStart(events, planningAnchor);
  const planningEvents = events.filter((event) => !isManagedChargingEvent(event));
  const upcomingEvents = planningEvents.filter((event) => eventDateTime(event) >= planningStart && eventDateTime(event) < addDays(planningStart, horizonDays));
  const upcomingSchedule = upcomingEvents.map(serializeScheduleEventForPrediction);
  const trips = buildTripForecasts(planningEvents, weather, planningStart);
  const forecastUsePercent = trips.reduce((sum, trip) => sum + trip.batteryUsePercent, 0);
  const targetBattery = clampPercent(targetChargePercent, minTargetCharge, maxTargetCharge);
  const minimumBatteryTarget = clampPercent(minimumBatteryPercent, 5, Math.max(5, targetBattery - 5));
  const withoutChargeProjectedBattery = Math.max(vehicle.batteryLevel - forecastUsePercent, 0);
  const idleDayOpportunity = buildIdleDayTopUpOpportunity(planningEvents, planningStart, vehicle.batteryLevel, targetBattery, minimumBatteryTarget);
  const batteryThresholdChargeRecommended = withoutChargeProjectedBattery < minimumBatteryTarget;
  const chargeRecommended = batteryThresholdChargeRecommended || idleDayOpportunity.shouldRecommend;
  const chargeReason: ChargingPlan['energy']['chargeReason'] = batteryThresholdChargeRecommended
    ? 'minimum_threshold'
    : idleDayOpportunity.shouldRecommend
      ? 'idle_day_opportunity'
      : 'none';
  const plannedStartBattery = chargeRecommended ? Math.max(vehicle.batteryLevel, targetBattery) : vehicle.batteryLevel;
  const projectedBattery = Math.max(plannedStartBattery - forecastUsePercent, 0);
  const recommendedTarget = chargeRecommended ? targetBattery : vehicle.batteryLevel;
  const topUpPercent = chargeRecommended ? Math.max(targetBattery - vehicle.batteryLevel, 0) : 0;
  const acMinutesNeeded = chargeRecommended ? getAcChargeMinutesNeeded(vehicle.batteryLevel, targetBattery) : 0;
  const dcFastTargetBattery = Math.min(targetBattery, dcFastMaxSoc);
  const dcFastMinutesNeeded = chargeRecommended && vehicle.batteryLevel < dcFastMaxSoc ? getDcFastChargeMinutesNeeded(vehicle.batteryLevel, dcFastTargetBattery) : null;
  const dcFastValidToTarget = targetBattery <= dcFastMaxSoc;
  const windows = buildAvailabilityWindows(planningEvents, planningStart);
  const chargingStrategy = buildChargingOptionPlans(planningEvents, planningStart, windows, acMinutesNeeded, dcFastMinutesNeeded, targetBattery, dcFastTargetBattery, chargingPreference, chargeRecommended, aiDecision, openChargeMapStations);
  const selected = chargingStrategy.selected;
  const bestWindow = selected.window;
  const canComplete = selected.canComplete;
  const start = selected.start;
  const end = selected.end;

  const partialPlan = {
    planningStart,
    scheduleDemand: {
      upcomingEvents: upcomingEvents.length,
      upcomingSchedule,
      travelEvents: trips.length,
      highDemandEvent: trips.reduce<TripForecast | undefined>((current, trip) => !current || trip.batteryUsePercent > current.batteryUsePercent ? trip : current, undefined),
      trips
    },
    energy: {
      currentBattery: vehicle.batteryLevel,
      forecastUsePercent,
      reserveTarget: minimumBatteryTarget,
      userTargetBattery: targetBattery,
      chargeRecommended,
      chargeReason,
      idleDayTopUpThreshold: idleDayOpportunity.idleDayTopUpThreshold,
      idleDayOpportunityDate: getLocalDateKey(idleDayOpportunity.date),
      idleDayScheduleIsEmpty: idleDayOpportunity.scheduleIsEmpty,
      plannedStartBattery,
      withoutChargeProjectedBattery,
      projectedBattery,
      recommendedTarget,
      topUpPercent,
      rangePerPercentKm,
      batteryCapacityKWh
    },
    availability: {
      windows
    },
    charging: {
      chargeRatePercentPerHour: Math.round(chargeRatePercentPerHour * 10) / 10,
      minutesNeeded: selected.minutesNeeded ?? acMinutesNeeded,
      targetBattery: selected.targetBattery,
      ac: {
        minutesNeeded: acMinutesNeeded,
        targetBattery,
        chargeRatePercentPerHour: Math.round(chargeRatePercentPerHour * 10) / 10
      },
      dcFast: {
        minutesNeeded: dcFastMinutesNeeded,
        targetBattery: dcFastTargetBattery,
        validToTarget: dcFastValidToTarget,
        cappedAtBattery: dcFastMaxSoc,
        unsupportedTopUpPercent: Math.max(targetBattery - dcFastMaxSoc, 0)
      }
    },
    decision: {
      bestWindow,
      canComplete,
      start,
      end
    },
    chargingStrategy
  };

  return {
    ...partialPlan,
    explanation: buildExplanation(partialPlan),
    agents: buildAgents(partialPlan)
  };
}

function getEventTypeFromDate(date: Date): CalendarEvent['type'] {
  const hour = date.getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export function buildManagedChargingCalendarEvent(plan: ChargingPlan): CalendarEvent | null {
  const selected = plan.chargingStrategy.selected;
  if (!plan.energy.chargeRecommended || plan.energy.topUpPercent <= 0) return null;
  if (!selected.start || !selected.end || !selected.canComplete) return null;

  const stationOptions = selected.stationOptions.map(dcStationToCalendarOption);
  const selectedStation = selected.selectedStation ? dcStationToCalendarOption(selected.selectedStation) : undefined;
  const chargingMeta: ChargingCalendarMeta = {
    mode: selected.mode,
    targetBattery: selected.targetBattery,
    minutesNeeded: selected.minutesNeeded ?? selected.blockMinutes,
    connector: 'CCS2',
    anchorLocation: selected.selectedStation?.anchorLocation ?? homeChargingLocation,
    previousLocation: selected.selectedStation?.previousLocation,
    nextLocation: selected.selectedStation?.nextLocation,
    selectedStation,
    stationOptions,
    choiceOptions: plan.chargingStrategy.aiDecision?.choices ?? buildLocalChargingChoices(plan),
    aiSource: plan.chargingStrategy.aiDecision?.source,
    aiConfidence: plan.chargingStrategy.aiDecision?.confidence,
    aiReason: plan.chargingStrategy.aiDecision?.reason
  };

  return {
    id: managedChargingEventId,
    title: `Charging Time (${selected.mode})`,
    location: selected.mode === 'DC' && selectedStation ? selectedStation.address : selected.location,
    time: minutesToDisplayTime(selected.start.getHours() * 60 + selected.start.getMinutes()),
    endTime: minutesToDisplayTime(selected.end.getHours() * 60 + selected.end.getMinutes()),
    date: startOfDay(selected.start),
    carNeeded: false,
    type: getEventTypeFromDate(selected.start),
    category: 'charging',
    status: 'AI MANAGED CHARGING',
    notes: selected.summary,
    aiReason: plan.explanation,
    chargingMeta
  };
}

function serializeChargingOption(option: ChargingOptionPlan) {
  return {
    mode: option.mode,
    canComplete: option.canComplete,
    start: option.start?.toISOString(),
    end: option.end?.toISOString(),
    minutesNeeded: option.minutesNeeded,
    blockMinutes: option.blockMinutes,
    targetBattery: option.targetBattery,
    location: option.location,
    window: option.window ? {
      id: option.window.id,
      start: option.window.start.toISOString(),
      end: option.window.end.toISOString(),
      durationMinutes: option.window.durationMinutes,
      chargerAccess: option.window.chargerAccess,
      location: option.window.location
    } : undefined,
    stationOptions: option.stationOptions.map((recommendation) => ({
      id: recommendation.station.id,
      name: recommendation.station.name,
      provider: recommendation.station.provider,
      connector: recommendation.connector,
      maxPowerKw: recommendation.station.maxPowerKw,
      stalls: recommendation.station.stalls,
      distanceFromAnchorKm: recommendation.distanceFromAnchorKm,
      detourKm: recommendation.detourKm,
      reason: recommendation.reason,
      address: recommendation.station.address,
      city: recommendation.station.city,
      isHighwayStop: recommendation.station.isHighwayStop,
      anchorLocation: recommendation.anchorLocation,
      nextLocation: recommendation.nextLocation,
      latitude: recommendation.station.latitude,
      longitude: recommendation.station.longitude,
      source: recommendation.station.id.startsWith('ocm-') ? 'openchargemap' : 'local-fallback',
      attribution: recommendation.station.id.startsWith('ocm-') ? 'Open Charge Map contributors' : undefined
    }))
  };
}

function buildLocalChargingChoices(plan: ChargingPlan): GeminiChargingChoice[] {
  const choices: GeminiChargingChoice[] = [];
  const ac = plan.chargingStrategy.ac;
  if (ac.canComplete) {
    choices.push({
      id: 'ac-home-window',
      rank: choices.length + 1,
      mode: 'AC',
      start: ac.start?.toISOString(),
      end: ac.end?.toISOString(),
      selectedStationId: null,
      reason: ac.summary
    });
  }

  const dc = plan.chargingStrategy.dc;
  if (dc.canComplete) {
    dc.stationOptions.forEach((recommendation) => {
      choices.push({
        id: `dc-${recommendation.station.id}`,
        rank: choices.length + 1,
        mode: 'DC',
        start: dc.start?.toISOString(),
        end: dc.end?.toISOString(),
        selectedStationId: recommendation.station.id,
        stationName: recommendation.station.name,
        reason: `${recommendation.reason}. ${recommendation.distanceFromAnchorKm} km from ${recommendation.anchorLocation}; ${recommendation.detourKm} km detour.`
      });
    });
  }

  return choices.map((choice, index) => ({ ...choice, rank: index + 1 }));
}
export function buildGeminiChargingPredictionPayload(plan: ChargingPlan, preference: ChargingModePreference) {
  return {
    preference,
    vehicleProfile: {
      model: 'Mercedes-Benz EQS 580 4MATIC',
      connector: 'CCS2',
      batteryCapacityKWh: plan.energy.batteryCapacityKWh,
      batteryCareRules: [
        'Recommend charging as rarely as possible while keeping the no-charge forecast above the user-defined minimum battery threshold.',
        'The user target charge is the destination state of charge only when a charging session is actually needed.',
        'Do not recommend charging just because the current battery is below the user target charge.',
        'If the next local day has no schedule and battery is below the idle-day top-up threshold, use that open day as a low-disruption charging opportunity.',
        'Prefer AC charging when charging is needed and there is a long overnight/home window that can finish before the next trip.',
        'Prefer DC fast charging only when schedule pressure makes AC impractical or when a CCS2 station is convenient near the latest location or route.',
        'Keep the no-charge projected battery above the minimum threshold; otherwise charge toward the user target.'
      ]
    },
    choices: buildLocalChargingChoices(plan),
    energy: {
      currentBattery: plan.energy.currentBattery,
      forecastUsePercent: plan.energy.forecastUsePercent,
      withoutChargeProjectedBattery: plan.energy.withoutChargeProjectedBattery,
      projectedBattery: plan.energy.projectedBattery,
      reserveTarget: plan.energy.reserveTarget,
      minimumBatteryThreshold: plan.energy.reserveTarget,
      userTargetCharge: plan.energy.userTargetBattery,
      chargeRecommended: plan.energy.chargeRecommended,
      chargeReason: plan.energy.chargeReason,
      idleDayTopUpThreshold: plan.energy.idleDayTopUpThreshold,
      idleDayOpportunityDate: plan.energy.idleDayOpportunityDate,
      idleDayScheduleIsEmpty: plan.energy.idleDayScheduleIsEmpty,
      recommendedTarget: plan.energy.recommendedTarget,
      topUpPercent: plan.energy.topUpPercent,
      batteryCapacityKWh: plan.energy.batteryCapacityKWh
    },
    schedule: {
      planningStart: plan.planningStart.toISOString(),
      upcomingEvents: plan.scheduleDemand.upcomingEvents,
      events: plan.scheduleDemand.upcomingSchedule,
      travelEvents: plan.scheduleDemand.travelEvents,
      highDemandEvent: plan.scheduleDemand.highDemandEvent ? {
        title: plan.scheduleDemand.highDemandEvent.title,
        location: plan.scheduleDemand.highDemandEvent.location,
        batteryUsePercent: plan.scheduleDemand.highDemandEvent.batteryUsePercent,
        departureTime: plan.scheduleDemand.highDemandEvent.departureTime
      } : undefined,
      trips: plan.scheduleDemand.trips.slice(0, 8).map((trip) => ({
        title: trip.title,
        originLocation: trip.originLocation,
        location: trip.location,
        isReturnHome: trip.isReturnHome,
        departureTime: trip.departureTime,
        eventTime: trip.eventTime,
        distanceKm: trip.distanceKm,
        traffic: trip.traffic,
        weatherImpactPercent: trip.weatherImpactPercent,
        batteryUsePercent: trip.batteryUsePercent
      }))
    },
    options: {
      ac: serializeChargingOption(plan.chargingStrategy.ac),
      dc: serializeChargingOption(plan.chargingStrategy.dc)
    },
    localSelection: {
      mode: plan.chargingStrategy.selected.mode,
      selectedStationId: plan.chargingStrategy.selected.selectedStation?.station.id ?? null,
      explanation: plan.explanation
    }
  };
}
export function formatPlanDateTime(date?: Date) {
  if (!date) return 'Not available';
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatPlanTimeRange(start?: Date, end?: Date) {
  if (!start || !end) return 'No window';
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${startTime}-${endTime}`;
}
