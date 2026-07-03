import type { CalendarEvent, VehicleState } from '../store/useAppStore';

type WeatherSnapshot = {
  temp: number;
  condition: string;
};

export type TrafficLevel = 'light' | 'moderate' | 'heavy';

export type TripForecast = {
  eventId: string;
  title: string;
  location: string;
  date: Date;
  departureTime: string;
  eventTime: string;
  distanceKm: number;
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
    projectedBattery: number;
    recommendedTarget: number;
    topUpPercent: number;
  };
  availability: {
    windows: AvailabilityWindow[];
  };
  charging: {
    chargeRatePercentPerHour: number;
    minutesNeeded: number;
    targetBattery: number;
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
const horizonDays = 4;
const wallboxKw = 11;
const batteryKwh = 108;
const chargingEfficiency = 0.9;
const chargeRatePercentPerHour = (wallboxKw / batteryKwh) * 100 * chargingEfficiency;

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

function getPlanningStart(events: CalendarEvent[]) {
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
  return events
    .filter((event) => event.carNeeded)
    .map((event) => {
      const date = eventDateTime(event);
      const distanceKm = estimateDistanceKm(event.location);
      const traffic = getTrafficLevel(event);
      const weatherImpactPercent = weatherImpact(weather);
      const batteryUsePercent = Math.ceil((distanceKm / 4.2) * trafficMultiplier(traffic) * (1 + weatherImpactPercent / 100));

      return {
        eventId: event.id,
        title: event.title,
        location: event.location,
        date,
        departureTime: event.departureTime ?? minutesToDisplayTime(Math.max(parseTimeToMinutes(event.time) - 30, 0)),
        eventTime: event.time,
        distanceKm,
        traffic,
        weatherImpactPercent,
        batteryUsePercent
      } satisfies TripForecast;
    })
    .filter((trip) => trip.date >= planningStart && trip.date < horizonEnd && trip.distanceKm > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
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
    return `Battery is projected to finish at ${plan.energy.projectedBattery}% after the next ${plan.scheduleDemand.travelEvents} drive events, so no urgent charge is required right now.`;
  }

  return `Charge during ${best.chargerAccess} time because ${leadTrip?.title ?? 'the upcoming schedule'} creates the highest demand. Adding ${plan.energy.topUpPercent}% takes about ${plan.charging.minutesNeeded} minutes and keeps the projected reserve near ${plan.energy.reserveTarget}%.`;
}

function buildAgents(plan: Omit<ChargingPlan, 'explanation' | 'agents'>): AgentInsight[] {
  const best = plan.decision.bestWindow;
  return [
    {
      name: 'Schedule Agent',
      status: plan.scheduleDemand.travelEvents >= 3 ? 'watch' : 'ready',
      metric: `${plan.scheduleDemand.travelEvents} drives`,
      summary: `Scanned ${plan.scheduleDemand.upcomingEvents} upcoming events and found ${plan.scheduleDemand.travelEvents} car-required trips.`
    },
    {
      name: 'Energy Agent',
      status: plan.energy.projectedBattery < plan.energy.reserveTarget ? 'action' : 'ready',
      metric: `${plan.energy.forecastUsePercent}% use`,
      summary: `Predicts battery usage from route distance, ${plan.scheduleDemand.highDemandEvent?.traffic ?? 'moderate'} traffic, and weather load.`
    },
    {
      name: 'Availability Agent',
      status: plan.availability.windows.length ? 'ready' : 'action',
      metric: `${plan.availability.windows.length} windows`,
      summary: `Found parked gaps of at least one hour across the planning horizon.`
    },
    {
      name: 'Charging Agent',
      status: plan.charging.minutesNeeded > 90 ? 'watch' : 'ready',
      metric: `${plan.charging.minutesNeeded} min`,
      summary: `Calculates the time needed to reach ${plan.charging.targetBattery}% using the home wallbox rate.`
    },
    {
      name: 'Decision Agent',
      status: plan.decision.canComplete ? 'ready' : 'action',
      metric: best ? best.chargerAccess : 'No fit',
      summary: best ? `Selected the highest scoring parked window before the demand peak.` : 'No available window can complete the recommended charge.'
    },
    {
      name: 'Explanation Agent',
      status: 'ready',
      metric: 'Plain English',
      summary: 'Turns the planning result into a user-friendly reason for the recommendation.'
    }
  ];
}

export function buildChargingPlan(events: CalendarEvent[], vehicle: VehicleState, weather: WeatherSnapshot): ChargingPlan {
  const planningStart = getPlanningStart(events);
  const upcomingEvents = events.filter((event) => eventDateTime(event) >= planningStart && eventDateTime(event) < addDays(planningStart, horizonDays));
  const trips = buildTripForecasts(events, weather, planningStart);
  const forecastUsePercent = trips.reduce((sum, trip) => sum + trip.batteryUsePercent, 0);
  const projectedBattery = Math.max(vehicle.batteryLevel - forecastUsePercent, 0);
  const recommendedTarget = Math.min(dailyTarget, Math.max(60, forecastUsePercent + reserveTarget + 5));
  const topUpPercent = Math.max(recommendedTarget - vehicle.batteryLevel, 0);
  const minutesNeeded = Math.max(0, Math.ceil((topUpPercent / chargeRatePercentPerHour) * 60));
  const windows = buildAvailabilityWindows(events, planningStart);
  const feasibleWindows = windows.filter((window) => window.durationMinutes >= Math.max(minutesNeeded, 30));
  const bestWindow = feasibleWindows[0] ?? windows[0];
  const canComplete = Boolean(bestWindow && bestWindow.durationMinutes >= minutesNeeded);
  const start = bestWindow?.start;
  const end = start && minutesNeeded > 0 ? addMinutes(start, Math.min(minutesNeeded, bestWindow.durationMinutes)) : bestWindow?.end;

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
      projectedBattery,
      recommendedTarget,
      topUpPercent
    },
    availability: {
      windows
    },
    charging: {
      chargeRatePercentPerHour: Math.round(chargeRatePercentPerHour * 10) / 10,
      minutesNeeded,
      targetBattery: recommendedTarget
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
