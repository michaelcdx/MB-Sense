import type { CalendarEvent, VehicleState } from '../store/useAppStore';
import type { ChargingPlanInput, ChargingPlanResult } from '../types/chargingPlanner';

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

function eventDate(event: CalendarEvent) {
  return event.date instanceof Date ? event.date : new Date(event.date);
}

export function buildChargingPlanInput(events: CalendarEvent[], vehicle: VehicleState, weather: WeatherSnapshot, horizonDays: number | null = 3): ChargingPlanInput {
  const now = new Date();
  const horizonEnd = horizonDays === null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizonDays);

  return {
    currentDateTime: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar',
    vehicle: {
      modelName: 'Mercedes-Benz EQS 450+',
      batteryPercent: vehicle.batteryLevel,
      estimatedRangeKm: Math.round(620 * vehicle.batteryLevel / 100),
      connectorType: 'CCS2',
    },
    calendarEvents: events
      .filter((event) => !event.isAiRecommendationPreview)
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
    const response = await fetch('/api/charging/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Planner failed with ${response.status}`);
    const plan = await response.json() as ChargingPlanResult;
    return plan?.type === 'ai_charging_recommendation' ? plan : fallbackChargingPlan;
  } catch {
    return fallbackChargingPlan;
  }
}

export function getChargingPlanCalendarEventId(plan: ChargingPlanResult) {
  return `ai-plan-${plan.id}`;
}

export function buildCalendarEventFromChargingPlan(plan: ChargingPlanResult, isPreview = false): CalendarEvent | null {
  const action = plan.calendarAction;
  if (!action.shouldCreateEvent || !action.date || !action.startTime || !action.endTime) return null;

  const dateParts = action.date.split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isFinite(part))) return null;
  const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const category: CalendarEvent['category'] = action.colorType === 'battery-risk' || plan.riskLevel === 'high' ? 'risk' : 'charging';
  const location = action.location ?? plan.chargingLocationName ?? 'N/A';
  const minutes = plan.estimatedChargingDurationMinutes ?? Math.max(0, parseTimeToMinutes(action.endTime) - parseTimeToMinutes(action.startTime));

  return {
    id: getChargingPlanCalendarEventId(plan),
    title: action.title || plan.title,
    location,
    time: timeValueToDisplay(action.startTime),
    endTime: timeValueToDisplay(action.endTime),
    date,
    carNeeded: false,
    type: eventTypeFromTime(action.startTime),
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
