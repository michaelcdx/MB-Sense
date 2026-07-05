import type { CalendarEvent, VehicleState } from '../store/useAppStore';
import { resolveLocationCoordinates } from '../constants/realWorldRouteData';
import { getAcChargeMinutesNeeded, homeChargingLocation } from './chargingAgents';
import type { ChargingPlanInput, ChargingPlanResult, OpenChargeMapStationCandidate } from '../types/chargingPlanner';

type WeatherSnapshot = {
  temp: number;
  condition: string;
};

export const fallbackChargingPlan: ChargingPlanResult = {
  id: "ai-charge-na",
  type: "ai_charging_recommendation",
  riskLevel: "low",
  mainRisk: "unknown",
  mobilityConfidenceScore: 0,
  confidenceScore: 0,
  shouldCharge: false,
  recommendationStatus: "not_needed",
  title: "N/A",
  summary: "N/A",
  reason: "N/A",
  recommendedChargingStart: null,
  recommendedChargingEnd: null,
  chargingLocationName: "N/A",
  chargingLocationType: null,
  chargingType: "none",
  currentBatteryPercent: 0,
  targetBatteryPercent: null,
  predictedBatteryAfterSchedule: 0,
  predictedLowestBatteryPercent: 0,
  estimatedEnergyNeededPercent: 0,
  estimatedChargingDurationMinutes: null,
  stationRecommendations: [],
  riskBreakdown: {
    batteryRisk: "low",
    chargingOpportunityRisk: "low",
    scheduleDisruptionRisk: "low",
    weatherTrafficRisk: "low",
  },
  backupPlan: {
    available: false,
    title: "N/A",
    locationName: "N/A",
    startTime: null,
    endTime: null,
    reason: "N/A",
  },
  calendarAction: {
    shouldCreateEvent: false,
    title: "N/A",
    date: null,
    startTime: null,
    endTime: null,
    location: "N/A",
    colorType: "default",
  },
  sidePanelDetails: {
    mainMessage: "N/A",
    batteryExplanation: "N/A",
    scheduleExplanation: "N/A",
    chargingExplanation: "N/A",
    backupExplanation: "N/A",
    userActionText: "N/A",
  },
};

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseTimeToMinutes(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function minutesToDisplayTime(minutes: number) {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hour24 = Math.floor(bounded / 60);
  const minute = bounded % 60;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function timeValueToDisplay(value: string) {
  return minutesToDisplayTime(parseTimeToMinutes(value));
}

function eventTypeFromTime(time: string): CalendarEvent['type'] {
  const minutes = parseTimeToMinutes(time);
  if (minutes < 12 * 60) return 'Morning';
  if (minutes < 17 * 60) return 'Afternoon';
  return 'Evening';
}

function parseIsoDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToTimeValue(date: Date) {
  return minutesToDisplayTime(date.getHours() * 60 + date.getMinutes());
}

function eventDate(event: CalendarEvent) {
  return event.date instanceof Date ? event.date : new Date(event.date);
}

function parsePlanLocalDateTime(dateValue?: string | null, timeValue?: string | null) {
  if (!dateValue || !timeValue) return null;
  const dateParts = dateValue.split('-').map(Number);
  const minutes = parseTimeToMinutes(timeValue);
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isFinite(part))) return null;

  const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], Math.floor(minutes / 60), minutes % 60, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function buildChargingOpportunityContext(events: CalendarEvent[], vehicle: VehicleState, targetChargePercent: number, minimumBatteryPercent: number, now = new Date()): ChargingPlanInput['chargingOpportunity'] {
  const tomorrow = addLocalDays(startOfLocalDay(now), 1);
  const tomorrowDate = toDateValue(tomorrow);
  const tomorrowEvents = events.filter((event) => toDateValue(eventDate(event)) === tomorrowDate);
  const nextDayDrivingEventCount = tomorrowEvents.filter((event) => event.carNeeded).length;
  const idleTopUpThresholdPercent = Math.min(
    targetChargePercent - 1,
    Math.max(minimumBatteryPercent + 10, targetChargePercent - 20, 50)
  );
  const estimatedChargingDurationMinutes = getAcChargeMinutesNeeded(vehicle.batteryLevel, targetChargePercent);
  const shouldRecommendIdleTopUp = tomorrowEvents.length === 0
    && vehicle.batteryLevel < targetChargePercent
    && vehicle.batteryLevel <= idleTopUpThresholdPercent
    && estimatedChargingDurationMinutes > 0;
  const preferredChargingStart = new Date(tomorrow);
  preferredChargingStart.setHours(9, 0, 0, 0);
  const preferredChargingEnd = shouldRecommendIdleTopUp ? addMinutes(preferredChargingStart, estimatedChargingDurationMinutes) : null;

  return {
    nextDayDate: tomorrowDate,
    nextDayEventCount: tomorrowEvents.length,
    nextDayDrivingEventCount,
    nextDayHasNoSchedule: tomorrowEvents.length === 0,
    idleTopUpThresholdPercent,
    shouldRecommendIdleTopUp,
    preferredChargingStart: shouldRecommendIdleTopUp ? preferredChargingStart.toISOString() : null,
    preferredChargingEnd: preferredChargingEnd ? preferredChargingEnd.toISOString() : null,
    estimatedChargingDurationMinutes: shouldRecommendIdleTopUp ? estimatedChargingDurationMinutes : null,
    chargingLocationName: homeChargingLocation,
    reason: shouldRecommendIdleTopUp
      ? `Tomorrow has no scheduled activities, so use the open day to charge from ${vehicle.batteryLevel}% toward the user target of ${targetChargePercent}%.`
      : null,
  };
}

function getChargingBusyBlocks(input: ChargingPlanInput) {
  return input.calendarEvents
    .map((event) => {
      const start = parsePlanLocalDateTime(event.date, event.startTime);
      if (!start) return null;
      let end = parsePlanLocalDateTime(event.date, event.endTime) ?? addMinutes(start, 60);
      if (end <= start) end = addMinutes(start, 60);
      return { start, end, title: event.title };
    })
    .filter((block): block is { start: Date; end: Date; title: string } => Boolean(block))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function windowsOverlap(start: Date, end: Date, busyStart: Date, busyEnd: Date) {
  return start < busyEnd && end > busyStart;
}

function getOverlappingBusyBlock(start: Date, end: Date, input: ChargingPlanInput) {
  return getChargingBusyBlocks(input).find((block) => windowsOverlap(start, end, block.start, block.end));
}

function findNextFreeChargingWindow(start: Date, durationMinutes: number, input: ChargingPlanInput) {
  const busyBlocks = getChargingBusyBlocks(input);
  const minimumDuration = Math.max(30, Math.round(durationMinutes || 60));
  let candidateStart = new Date(start);
  candidateStart.setSeconds(0, 0);
  const searchEnd = addMinutes(candidateStart, 7 * 24 * 60);

  while (candidateStart < searchEnd) {
    const candidateEnd = addMinutes(candidateStart, minimumDuration);
    const overlap = busyBlocks.find((block) => windowsOverlap(candidateStart, candidateEnd, block.start, block.end));
    if (!overlap) return { start: candidateStart, end: candidateEnd };
    candidateStart = new Date(overlap.end);
  }

  return null;
}

function getPlanChargingWindow(plan: ChargingPlanResult) {
  const start = parseIsoDateTime(plan.recommendedChargingStart) ?? parsePlanLocalDateTime(plan.calendarAction.date, plan.calendarAction.startTime);
  const end = parseIsoDateTime(plan.recommendedChargingEnd) ?? parsePlanLocalDateTime(plan.calendarAction.date, plan.calendarAction.endTime);
  return start && end && end > start ? { start, end } : null;
}

export function normalizeChargingPlanAgainstSchedule(plan: ChargingPlanResult, input: ChargingPlanInput): ChargingPlanResult {
  const opportunityAdjustedPlan = applyIdleDayChargingOpportunity(plan, input);
  const window = getPlanChargingWindow(opportunityAdjustedPlan);
  if (!window || (!opportunityAdjustedPlan.shouldCharge && !opportunityAdjustedPlan.calendarAction.shouldCreateEvent)) return opportunityAdjustedPlan;

  const overlap = getOverlappingBusyBlock(window.start, window.end, input);
  if (!overlap) return opportunityAdjustedPlan;

  const durationMinutes = opportunityAdjustedPlan.estimatedChargingDurationMinutes ?? Math.round((window.end.getTime() - window.start.getTime()) / 60000);
  const freeWindow = findNextFreeChargingWindow(overlap.end, durationMinutes, input);

  if (!freeWindow) {
    return {
      ...opportunityAdjustedPlan,
      reason: `${opportunityAdjustedPlan.reason} No non-overlapping charging window is available in the next 7 days.`,
      recommendedChargingStart: null,
      recommendedChargingEnd: null,
      calendarAction: {
        ...opportunityAdjustedPlan.calendarAction,
        shouldCreateEvent: false,
        date: null,
        startTime: null,
        endTime: null,
      },
    };
  }

  return {
    ...opportunityAdjustedPlan,
    reason: `${opportunityAdjustedPlan.reason} Charging time was moved to avoid overlapping "${overlap.title}".`,
    recommendedChargingStart: freeWindow.start.toISOString(),
    recommendedChargingEnd: freeWindow.end.toISOString(),
    calendarAction: {
      ...opportunityAdjustedPlan.calendarAction,
      date: toDateValue(freeWindow.start),
      startTime: dateToTimeValue(freeWindow.start),
      endTime: dateToTimeValue(freeWindow.end),
    },
  };
}

function applyIdleDayChargingOpportunity(plan: ChargingPlanResult, input: ChargingPlanInput): ChargingPlanResult {
  const opportunity = input.chargingOpportunity;
  const hasChargingWindow = Boolean(plan.recommendedChargingStart && plan.recommendedChargingEnd)
    || Boolean(plan.calendarAction.shouldCreateEvent && plan.calendarAction.date && plan.calendarAction.startTime && plan.calendarAction.endTime);
  if (!opportunity?.shouldRecommendIdleTopUp || (plan.shouldCharge && hasChargingWindow)) return plan;
  if (!opportunity.preferredChargingStart || !opportunity.preferredChargingEnd) return plan;

  const targetBattery = input.targetChargePercent ?? plan.targetBatteryPercent ?? 80;
  const currentBattery = input.vehicle.batteryPercent;
  const energyNeeded = Math.max(0, Math.round(targetBattery - currentBattery));
  const reason = opportunity.reason ?? 'Tomorrow has no scheduled activities, so this is the lowest-disruption time to top up.';

  return {
    ...plan,
    id: plan.id === fallbackChargingPlan.id ? 'ai-charge-idle-day-opportunity' : plan.id,
    riskLevel: plan.riskLevel === 'high' ? plan.riskLevel : 'medium',
    mainRisk: plan.mainRisk === 'unknown' || plan.mainRisk === 'none' ? 'low_battery' : plan.mainRisk,
    mobilityConfidenceScore: Math.max(plan.mobilityConfidenceScore, 82),
    confidenceScore: Math.max(plan.confidenceScore, 82),
    shouldCharge: true,
    recommendationStatus: 'recommended',
    title: plan.title === 'N/A' ? 'Charge during open day' : plan.title,
    summary: plan.summary === 'N/A'
      ? `Use tomorrow's empty schedule to charge toward ${targetBattery}%.`
      : plan.summary,
    reason,
    recommendedChargingStart: opportunity.preferredChargingStart,
    recommendedChargingEnd: opportunity.preferredChargingEnd,
    chargingLocationName: opportunity.chargingLocationName,
    chargingLocationType: 'home',
    chargingType: 'home_ac',
    currentBatteryPercent: currentBattery,
    targetBatteryPercent: targetBattery,
    predictedBatteryAfterSchedule: Math.max(plan.predictedBatteryAfterSchedule, targetBattery),
    predictedLowestBatteryPercent: plan.predictedLowestBatteryPercent > 0
      ? Math.min(plan.predictedLowestBatteryPercent, currentBattery)
      : currentBattery,
    estimatedEnergyNeededPercent: Math.max(plan.estimatedEnergyNeededPercent, energyNeeded),
    estimatedChargingDurationMinutes: opportunity.estimatedChargingDurationMinutes,
    riskBreakdown: {
      ...plan.riskBreakdown,
      batteryRisk: plan.riskBreakdown.batteryRisk === 'high' ? 'high' : 'medium',
      chargingOpportunityRisk: 'low',
      scheduleDisruptionRisk: 'low',
    },
    backupPlan: {
      ...plan.backupPlan,
      available: false,
    },
    calendarAction: {
      ...plan.calendarAction,
      shouldCreateEvent: true,
      title: 'AI Charging Recommendation',
      date: opportunity.nextDayDate,
      startTime: dateToTimeValue(new Date(opportunity.preferredChargingStart)),
      endTime: dateToTimeValue(new Date(opportunity.preferredChargingEnd)),
      location: opportunity.chargingLocationName,
      colorType: 'charging',
    },
    sidePanelDetails: {
      ...plan.sidePanelDetails,
      mainMessage: plan.sidePanelDetails.mainMessage === 'N/A'
        ? 'Tomorrow is open, so MB Sense recommends a low-disruption top-up.'
        : plan.sidePanelDetails.mainMessage,
      batteryExplanation: `Current battery is ${currentBattery}%, below the idle-day top-up threshold of ${opportunity.idleTopUpThresholdPercent}%.`,
      scheduleExplanation: `No calendar activities are scheduled on ${opportunity.nextDayDate}.`,
      chargingExplanation: `Home AC charging can target ${targetBattery}% during the open day.`,
      userActionText: 'Put the charging block in your calendar.',
    },
  };
}

export function buildChargingPlanInputSignature(events: CalendarEvent[], vehicle: VehicleState, weather: WeatherSnapshot, targetChargePercent = 80, minimumBatteryPercent = 35, now = new Date()) {
  const planningEvents = events.filter((event) => !event.isAiRecommendationPreview);
  const chargingOpportunity = buildChargingOpportunityContext(planningEvents, vehicle, targetChargePercent, minimumBatteryPercent, now);

  return JSON.stringify({
    currentDate: toDateValue(now),
    vehicle: {
      batteryPercent: vehicle.batteryLevel,
      estimatedRangeKm: Math.round(620 * vehicle.batteryLevel / 100),
    },
    targetChargePercent,
    minimumBatteryPercent,
    chargingOpportunity,
    calendarEvents: planningEvents
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: toDateValue(eventDate(event)),
        startTime: event.time,
        endTime: event.endTime ?? event.time,
        location: event.location,
        type: event.category,
        carNeeded: event.carNeeded,
        status: event.status,
        notes: event.notes,
      })),
    weather: {
      temp: weather.temp,
      condition: weather.condition,
    },
  });
}

type OpenChargeMapLookupOptions = {
  latitude: number;
  longitude: number;
  distanceKm?: number;
  maxResults?: number;
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchOpenChargeMapStations({
  latitude,
  longitude,
  distanceKm = 35,
  maxResults = 8,
}: OpenChargeMapLookupOptions): Promise<OpenChargeMapStationCandidate[]> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    distanceKm: String(distanceKm),
    maxResults: String(maxResults),
  });

  try {
    const response = await fetchWithTimeout(`/api/charging/openchargemap?${params.toString()}`, {}, 6000);
    if (!response.ok) return [];
    const payload = await response.json() as { stations?: OpenChargeMapStationCandidate[] };
    return Array.isArray(payload.stations) ? payload.stations : [];
  } catch {
    return [];
  }
}

function getChargingStationAnchor(input: ChargingPlanInput) {
  const drivingEvent = input.calendarEvents.find((event) => event.carNeeded && event.location);
  if (!drivingEvent?.location) return null;
  return resolveLocationCoordinates(drivingEvent.location);
}

async function enrichChargingPlanInputWithStations(input: ChargingPlanInput): Promise<ChargingPlanInput> {
  if (input.chargingStations?.length) return input;

  const anchor = getChargingStationAnchor(input);
  if (!anchor) return input;

  const stations = await fetchOpenChargeMapStations({
    latitude: anchor.lat,
    longitude: anchor.lng,
    distanceKm: 35,
    maxResults: 8,
  });

  return stations.length ? { ...input, chargingStations: stations } : input;
}

export function buildChargingPlanInput(events: CalendarEvent[], vehicle: VehicleState, weather: WeatherSnapshot, horizonDays: number | null = 3, targetChargePercent = 80, minimumBatteryPercent = 35, calendarRevision?: number, now = new Date()): ChargingPlanInput {
  const horizonEnd = horizonDays === null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizonDays);
  const planningEvents = events.filter((event) => !event.isAiRecommendationPreview);
  const chargingOpportunity = buildChargingOpportunityContext(planningEvents, vehicle, targetChargePercent, minimumBatteryPercent, now);

  return {
    currentDateTime: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar',
    vehicle: {
      modelName: 'Mercedes-Benz EQS 450+',
      batteryPercent: vehicle.batteryLevel,
      estimatedRangeKm: Math.round(620 * vehicle.batteryLevel / 100),
      connectorType: 'CCS2',
    },
    targetChargePercent,
    minimumBatteryPercent,
    chargingOpportunity,
    calendarRevision,
    calendarEvents: planningEvents
      .filter((event) => {
        const date = eventDate(event);
        return horizonEnd === null ? true : date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && date < horizonEnd;
      })
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: toDateValue(eventDate(event)),
        startTime: event.time,
        endTime: event.endTime ?? event.time,
        location: event.location,
        type: event.category,
        carNeeded: event.carNeeded,
        status: event.status,
        notes: event.notes,
      })),
    weather: {
      temp: weather.temp,
      condition: weather.condition,
    },
  };
}

export async function requestChargingPlan(input: ChargingPlanInput) {
  try {
    const requestInput = await enrichChargingPlanInputWithStations(input);
    const response = await fetchWithTimeout('/api/charging/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestInput),
    }, 18000);
    if (!response.ok) throw new Error(`Planner failed with ${response.status}`);
    const plan = await response.json() as ChargingPlanResult;
    return plan?.type === 'ai_charging_recommendation'
      ? normalizeChargingPlanAgainstSchedule(plan, requestInput)
      : normalizeChargingPlanAgainstSchedule(fallbackChargingPlan, requestInput);
  } catch {
    return normalizeChargingPlanAgainstSchedule(fallbackChargingPlan, input);
  }
}

export function getChargingPlanCalendarEventId(plan: ChargingPlanResult) {
  return `ai-plan-${plan.id}`;
}

export function buildCalendarEventFromChargingPlan(plan: ChargingPlanResult, isPreview = false): CalendarEvent | null {
  const action = plan.calendarAction;
  const recommendedStart = parseIsoDateTime(plan.recommendedChargingStart);
  const recommendedEnd = parseIsoDateTime(plan.recommendedChargingEnd);
  const startTime = recommendedStart ? dateToTimeValue(recommendedStart) : action.startTime;
  const endTime = recommendedEnd ? dateToTimeValue(recommendedEnd) : action.endTime;

  if (!action.shouldCreateEvent || !startTime || !endTime) return null;

  const actionDate = action.date ? action.date.split('-').map(Number) : [];
  const date = recommendedStart
    ? new Date(recommendedStart.getFullYear(), recommendedStart.getMonth(), recommendedStart.getDate())
    : actionDate.length === 3 && actionDate.every((part) => Number.isFinite(part))
      ? new Date(actionDate[0], actionDate[1] - 1, actionDate[2])
      : null;

  if (!date) return null;
  const category: CalendarEvent['category'] = action.colorType === 'battery-risk' || plan.riskLevel === 'high' ? 'risk' : 'charging';
  const location = action.location ?? plan.chargingLocationName ?? 'N/A';
  const minutes = plan.estimatedChargingDurationMinutes ?? Math.max(0, parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime));

  return {
    id: getChargingPlanCalendarEventId(plan),
    title: action.title || plan.title,
    location,
    time: timeValueToDisplay(startTime),
    endTime: timeValueToDisplay(endTime),
    date,
    carNeeded: false,
    type: eventTypeFromTime(startTime),
    category,
    status: isPreview ? 'AI CHARGING RECOMMENDATION' : 'AI CHARGING CONFIRMED',
    notes: plan.summary,
    aiReason: plan.reason,
    aiChargingPlan: plan,
    isAiRecommendationPreview: isPreview,
    chargingMeta: {
      mode: plan.chargingType === 'public_dc_fast' ? 'DC' : 'AC',
      targetBattery: plan.targetBatteryPercent ?? 0,
      minutesNeeded: minutes,
      connector: 'CCS2',
      anchorLocation: plan.chargingLocationName ?? location,
      stationOptions: [],
      aiSource: plan.id === 'ai-charge-na' ? 'fallback' : 'gemini',
      aiConfidence: plan.confidenceScore / 100,
      aiReason: plan.reason,
    },
  };
}

export function formatChargingWindow(plan: ChargingPlanResult) {
  const start = plan.recommendedChargingStart ? new Date(plan.recommendedChargingStart) : null;
  const end = plan.recommendedChargingEnd ? new Date(plan.recommendedChargingEnd) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'N/A';
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function formatChargingWindowWithDate(plan: ChargingPlanResult) {
  const start = plan.recommendedChargingStart ? new Date(plan.recommendedChargingStart) : null;
  const end = plan.recommendedChargingEnd ? new Date(plan.recommendedChargingEnd) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'N/A';
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${formatChargingWindow(plan)}`;
}
