import { estimateDrivingRoute, type RouteDistanceSource } from '../constants/realWorldRouteData';
import type { CalendarEvent } from '../store/useAppStore';

export type ScheduleDistanceResult = {
  id: string;
  date: Date;
  fromEventId: string;
  toEventId: string;
  fromTitle: string;
  toTitle: string;
  fromLocation: string;
  toLocation: string;
  fromTime: string;
  toTime: string;
  distanceKm: number;
  durationMinutes?: number;
  bufferMinutes: number;
  source: RouteDistanceSource;
};

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

function eventDateTime(event: CalendarEvent, time = event.time) {
  const base = event.date instanceof Date ? event.date : new Date(event.date);
  const next = startOfDay(base);
  next.setMinutes(parseTimeToMinutes(time));
  return next;
}

function isPhysicalLocation(location: string) {
  const value = location.toLowerCase();
  return !value.includes('online') && !value.includes('teams');
}

function estimateFallbackDistanceKm(toLocation: string) {
  const value = toLocation.toLowerCase();
  if (value.includes('singapore')) return 95;
  if (value.includes('klia')) return 82;
  if (value.includes('cyberjaya')) return 48;
  if (value.includes('putrajaya')) return 42;
  if (value.includes('shah alam')) return 38;
  if (value.includes('petaling jaya') || value.includes('dealer')) return 26;
  if (value.includes('klcc') || value.includes('trx')) return 24;
  if (value.includes('bangsar') || value.includes('mont kiara')) return 18;
  if (value.includes('royal lake')) return 16;
  if (value.includes('home') || value.includes('hq')) return 0;
  return 22;
}

function estimateFallbackDurationMinutes(distanceKm: number) {
  if (distanceKm <= 0) return 0;

  const averageSpeedKmh = distanceKm > 65 ? 72 : distanceKm > 30 ? 56 : distanceKm > 12 ? 42 : 30;
  return Math.max(5, Math.round(distanceKm / averageSpeedKmh * 60));
}

function estimateRouteBetween(fromLocation: string, toLocation: string) {
  const route = estimateDrivingRoute(fromLocation, toLocation);
  if (route) return route;

  const distanceKm = estimateFallbackDistanceKm(toLocation);
  return {
    distanceKm,
    durationMinutesNoTraffic: estimateFallbackDurationMinutes(distanceKm),
    source: 'heuristic-estimated' as const
  };
}

export function buildScheduleDistanceResults(events: CalendarEvent[], planningStart: Date, horizonDays = 7): ScheduleDistanceResult[] {
  const horizonEnd = addDays(planningStart, horizonDays);
  const physicalEvents = events
    .filter((event) => event.carNeeded && isPhysicalLocation(event.location))
    .map((event) => ({
      event,
      start: eventDateTime(event),
      end: eventDateTime(event, event.endTime ?? event.time)
    }))
    .filter(({ start }) => start >= planningStart && start < horizonEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return physicalEvents.flatMap((current, index) => {
    const next = physicalEvents[index + 1];
    if (!next || startOfDay(current.start).getTime() !== startOfDay(next.start).getTime()) return [];

    const route = estimateRouteBetween(current.event.location, next.event.location);
    const distanceKm = route.distanceKm;
    const bufferMinutes = Math.max(0, Math.round((next.start.getTime() - current.end.getTime()) / 60000));

    return [{
      id: `${current.event.id}-${next.event.id}`,
      date: next.start,
      fromEventId: current.event.id,
      toEventId: next.event.id,
      fromTitle: current.event.title,
      toTitle: next.event.title,
      fromLocation: current.event.location,
      toLocation: next.event.location,
      fromTime: current.event.time,
      toTime: next.event.time,
      distanceKm,
      durationMinutes: route.durationMinutesNoTraffic,
      bufferMinutes,
      source: route.source
    } satisfies ScheduleDistanceResult];
  });
}
