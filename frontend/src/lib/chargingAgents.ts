import type { CalendarEvent, VehicleState } from '../store/useAppStore';
import { mercedesEqs450PlusMockData, mercedesEqsDerivedValues, mercedesEqsAiTrainingRules } from '../constants/mercedesEqs450PlusTrainedData';
import { estimateDrivingRoute, type RouteDistanceSource } from '../constants/realWorldRouteData';

type WeatherSnapshot = {
  temp: number;
  condition: string;
};

export type TrafficLevel = 'light' | 'moderate' | 'heavy';

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

export type ChargingPlan = {
  planningStart: Date;
  scheduleDemand: {
    upcomingEvents: number;
    travelEvents: number;
    highDemandEvent?: TripForecast;
    trips: TripForecast[];
  };
  energy: {
    currentBattery: number;
    forecastUsePercent: number;
    reserveTarget: number;
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

function getAcChargeMinutesNeeded(currentPercent: number, targetPercent: number) {
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

function getPlanningStart(events: CalendarEvent[], planningAnchor?: Date) {
  if (planningAnchor && !Number.isNaN(planningAnchor.getTime())) return startOfDay(planningAnchor);

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

  return trips
    .map(({ event, date }, index) => {
      const previousTrip = trips[index - 1];
      const originLocation = previousTrip && startOfDay(previousTrip.date).getTime() === startOfDay(date).getTime()
        ? previousTrip.event.location
        : 'Home Garage, Damansara Heights';
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
}

function buildBusyBlocks(events: CalendarEvent[], planningStart: Date) {
  const horizonEnd = addDays(planningStart, horizonDays);
  return events
    .map((event) => {
      const start = eventDateTime(event, event.departureTime ?? event.time);
      const end = eventDateTime(event, event.endTime ?? event.time);
      if (end <= start) end.setMinutes(start.getMinutes() + 60);
      return { start, end, event };
    })
    .filter((block) => block.end > planningStart && block.start < horizonEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function windowScore(start: Date, end: Date, durationMinutes: number) {
  const hour = start.getHours();
  let score = Math.min(durationMinutes / 30, 8);
  if (hour >= 19 || hour < 7) score += 5;
  if (hour >= 10 && hour <= 16) score += 2;
  if (start.getHours() >= 18 && end.getHours() <= 23) score += 2;
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
  const windows: AvailabilityWindow[] = [];

  for (let day = 0; day < horizonDays; day += 1) {
    const dayStart = addDays(startOfDay(planningStart), day);
    dayStart.setHours(day === 0 ? Math.max(planningStart.getHours(), 6) : 6, day === 0 ? planningStart.getMinutes() : 0, 0, 0);
    const dayEnd = addDays(startOfDay(planningStart), day);
    dayEnd.setHours(23, 0, 0, 0);

    let cursor = new Date(dayStart);
    const dayBlocks = blocks.filter((block) => block.end > dayStart && block.start < dayEnd);

    for (const block of dayBlocks) {
      const gapStart = new Date(Math.max(cursor.getTime(), dayStart.getTime()));
      const gapEnd = new Date(Math.min(block.start.getTime(), dayEnd.getTime()));
      const durationMinutes = Math.round((gapEnd.getTime() - gapStart.getTime()) / 60000);

      if (durationMinutes >= 60) {
        const chargerAccess = getChargerAccess(gapStart);
        windows.push({
          id: `${gapStart.toISOString()}-${gapEnd.toISOString()}`,
          start: gapStart,
          end: gapEnd,
          durationMinutes,
          location: chargerAccess === 'home wallbox' ? 'Home Garage, Damansara Heights' : 'Parked between appointments',
          chargerAccess,
          score: windowScore(gapStart, gapEnd, durationMinutes) + (chargerAccess === 'home wallbox' ? 4 : chargerAccess === 'public charger nearby' ? 2 : 0)
        });
      }

      if (block.end > cursor) cursor = new Date(block.end);
    }

    const finalDuration = Math.round((dayEnd.getTime() - cursor.getTime()) / 60000);
    if (finalDuration >= 60) {
      const chargerAccess = getChargerAccess(cursor);
      windows.push({
        id: `${cursor.toISOString()}-${dayEnd.toISOString()}`,
        start: new Date(cursor),
        end: dayEnd,
        durationMinutes: finalDuration,
        location: chargerAccess === 'home wallbox' ? 'Home Garage, Damansara Heights' : 'Parked between appointments',
        chargerAccess,
        score: windowScore(cursor, dayEnd, finalDuration) + (chargerAccess === 'home wallbox' ? 4 : chargerAccess === 'public charger nearby' ? 2 : 0)
      });
    }
  }

  return windows.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function buildExplanation(plan: Omit<ChargingPlan, 'explanation' | 'agents'>) {
  const best = plan.decision.bestWindow;
  const leadTrip = plan.scheduleDemand.highDemandEvent;

  if (!best || plan.energy.topUpPercent === 0) {
    return `Battery is projected to finish at ${plan.energy.projectedBattery}% after the next ${plan.scheduleDemand.travelEvents} drive events, using the EQS 450+ training range of ${plan.energy.rangePerPercentKm} km per 1%.`;
  }

  const dcCopy = plan.charging.dcFast.validToTarget
    ? ` DC fast estimate is about ${plan.charging.dcFast.minutesNeeded ?? 0} minutes.`
    : ` DC fast estimate is capped at ${plan.charging.dcFast.cappedAtBattery}% because the training data only covers 10-80%.`;

  return `Charge during ${best.chargerAccess} time because ${leadTrip?.title ?? 'the upcoming schedule'} creates the highest demand. AC charging to ${plan.charging.targetBattery}% takes about ${plan.charging.ac.minutesNeeded} minutes.${dcCopy}`;
}

function buildAgents(plan: Omit<ChargingPlan, 'explanation' | 'agents'>): AgentInsight[] {
  const best = plan.decision.bestWindow;
  const highDemand = plan.scheduleDemand.highDemandEvent;
  const scheduleStatus: AgentInsight['status'] = plan.scheduleDemand.travelEvents >= 4 ? 'watch' : 'ready';
  const energyStatus: AgentInsight['status'] = plan.energy.projectedBattery < plan.energy.reserveTarget
    ? 'action'
    : plan.energy.forecastUsePercent >= 35
      ? 'watch'
      : 'ready';
  const targetBelowRecommended = plan.charging.targetBattery < plan.energy.recommendedTarget;
  const chargingStatus: AgentInsight['status'] = targetBelowRecommended || plan.energy.projectedBattery < plan.energy.reserveTarget
    ? 'action'
    : plan.charging.minutesNeeded > 90 || plan.energy.forecastUsePercent >= 35
      ? 'watch'
      : 'ready';
  const decisionStatus: AgentInsight['status'] = plan.decision.canComplete && !targetBelowRecommended ? 'ready' : 'action';
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
      metric: `${plan.energy.forecastUsePercent}% use`,
      summary: `${highDemand ? `${highDemand.title} is the highest demand trip. ` : ''}Predicts battery use with ${plan.energy.rangePerPercentKm} km per 1% from the EQS 450+ training data.`
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
      metric: `${plan.charging.targetBattery}% target`,
      summary: `Rechecked against ${plan.energy.forecastUsePercent}% forecast use. AC takes ${plan.charging.ac.minutesNeeded} min. ${dcFastSummary}`
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

export function buildChargingPlan(events: CalendarEvent[], vehicle: VehicleState, weather: WeatherSnapshot, targetChargePercent = dailyTarget, planningAnchor?: Date): ChargingPlan {
  const planningStart = getPlanningStart(events, planningAnchor);
  const upcomingEvents = events.filter((event) => eventDateTime(event) >= planningStart && eventDateTime(event) < addDays(planningStart, horizonDays));
  const trips = buildTripForecasts(events, weather, planningStart);
  const forecastUsePercent = trips.reduce((sum, trip) => sum + trip.batteryUsePercent, 0);
  const targetBattery = clampPercent(targetChargePercent, minTargetCharge, maxTargetCharge);
  const plannedStartBattery = Math.max(vehicle.batteryLevel, targetBattery);
  const projectedBattery = Math.max(plannedStartBattery - forecastUsePercent, 0);
  const withoutChargeProjectedBattery = Math.max(vehicle.batteryLevel - forecastUsePercent, 0);
  const recommendedTarget = Math.min(dailyTarget, Math.max(60, forecastUsePercent + reserveTarget + 5));
  const topUpPercent = Math.max(targetBattery - vehicle.batteryLevel, 0);
  const acMinutesNeeded = getAcChargeMinutesNeeded(vehicle.batteryLevel, targetBattery);
  const dcFastTargetBattery = Math.min(targetBattery, dcFastMaxSoc);
  const dcFastMinutesNeeded = vehicle.batteryLevel >= dcFastMaxSoc ? null : getDcFastChargeMinutesNeeded(vehicle.batteryLevel, dcFastTargetBattery);
  const dcFastValidToTarget = targetBattery <= dcFastMaxSoc;
  const windows = buildAvailabilityWindows(events, planningStart);
  const feasibleWindows = windows.filter((window) => window.durationMinutes >= Math.max(acMinutesNeeded, 30));
  const bestWindow = feasibleWindows[0] ?? windows[0];
  const canComplete = Boolean(bestWindow && bestWindow.durationMinutes >= acMinutesNeeded);
  const start = bestWindow?.start;
  const end = start && acMinutesNeeded > 0 ? addMinutes(start, Math.min(acMinutesNeeded, bestWindow.durationMinutes)) : bestWindow?.end;

  const partialPlan = {
    planningStart,
    scheduleDemand: {
      upcomingEvents: upcomingEvents.length,
      travelEvents: trips.length,
      highDemandEvent: trips.reduce<TripForecast | undefined>((current, trip) => !current || trip.batteryUsePercent > current.batteryUsePercent ? trip : current, undefined),
      trips
    },
    energy: {
      currentBattery: vehicle.batteryLevel,
      forecastUsePercent,
      reserveTarget,
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
      minutesNeeded: acMinutesNeeded,
      targetBattery,
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
    }
  };

  return {
    ...partialPlan,
    explanation: buildExplanation(partialPlan),
    agents: buildAgents(partialPlan)
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
