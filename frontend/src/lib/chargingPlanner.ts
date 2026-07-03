import { mockDCChargingStationsMalaysia } from '../constants/dcChargingStationsMalaysia';
import type { CalendarEvent, VehicleState } from '../store/useAppStore';
import type { ChargingPlanInput, ChargingPlanResult } from '../types/chargingPlanner';

type WeatherSnapshot = {
  temp: number;
  condition: string;
};

export const fallbackChargingPlan: ChargingPlanResult = {
  id: "ai-charge-fallback-001",
  type: "ai_charging_recommendation",
  riskLevel: "medium",
  mainRisk: "limited_charging_opportunity",
  mobilityConfidenceScore: 58,
  confidenceScore: 70,
  shouldCharge: true,
  recommendationStatus: "recommended",
  title: "Recommended EV Charging",
  summary: "Charge tonight from 8:30 PM to 10:00 PM.",
  reason:
    "Your battery is acceptable now, but your upcoming schedule may leave limited time to charge later.",
  recommendedChargingStart: "2026-07-03T20:30:00",
  recommendedChargingEnd: "2026-07-03T22:00:00",
  chargingLocationName: "Home Charger",
  chargingLocationType: "home",
  chargingType: "home_ac",
  currentBatteryPercent: 52,
  targetBatteryPercent: 85,
  predictedBatteryAfterSchedule: 24,
  predictedLowestBatteryPercent: 22,
  estimatedEnergyNeededPercent: 33,
  estimatedChargingDurationMinutes: 90,
  riskBreakdown: {
    batteryRisk: "medium",
    chargingOpportunityRisk: "high",
    scheduleDisruptionRisk: "medium",
    weatherTrafficRisk: "medium",
  },
  backupPlan: {
    available: true,
    title: "Backup DC Fast Charging",
    locationName: "Setia City Mall DC Charger",
    startTime: "2026-07-04T16:30:00",
    endTime: "2026-07-04T17:00:00",
    reason:
      "Fast backup option near your evening destination if you skip home charging tonight.",
  },
  calendarAction: {
    shouldCreateEvent: true,
    title: "Recommended EV Charging",
    date: "2026-07-03",
    startTime: "20:30",
    endTime: "22:00",
    location: "Home Charger",
    colorType: "charging",
  },
  sidePanelDetails: {
    mainMessage: "Charging is recommended before tomorrow's schedule.",
    batteryExplanation:
      "Your current battery is enough for now, but the predicted lowest battery after upcoming trips is low.",
    scheduleExplanation:
      "Tomorrow contains multiple trips with limited free time to charge.",
    chargingExplanation:
      "Home charging tonight is the least disruptive option because the car is usually parked at home.",
    backupExplanation:
      "If you skip tonight, use DC fast charging near your evening destination as a backup.",
    userActionText: "Add charging plan to calendar",
  },
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

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

function estimateDistanceKm(location: string) {
  const value = location.toLowerCase();
  if (value.includes('klia')) return 82;
  if (value.includes('cyberjaya')) return 48;
  if (value.includes('putrajaya')) return 42;
  if (value.includes('shah alam')) return 38;
  if (value.includes('petaling jaya') || value.includes('dealer')) return 26;
  if (value.includes('klcc') || value.includes('trx')) return 24;
  if (value.includes('bangsar') || value.includes('mont kiara')) return 18;
  if (value.includes('royal lake')) return 16;
  if (value.includes('home') || value.includes('online') || value.includes('teams') || value.includes('hq')) return 0;
  return 20;
}

function normalizeWeather(weather: WeatherSnapshot): ChargingPlanInput['weather'] {
  const condition = weather.condition.toLowerCase();
  if (condition.includes('storm')) return { condition: 'storm', energyImpactPercent: 9 };
  if (condition.includes('rain')) return { condition: 'rain', energyImpactPercent: 6 };
  if (weather.temp >= 32 || condition.includes('hot')) return { condition: 'hot', energyImpactPercent: 4 };
  if (condition.includes('clear') || condition.includes('sun')) return { condition: 'clear', energyImpactPercent: 1 };
  return { condition: 'unknown', energyImpactPercent: 2 };
}

function eventDate(event: CalendarEvent) {
  return event.date instanceof Date ? event.date : new Date(event.date);
}

export function buildChargingPlanInput(events: CalendarEvent[], vehicle: VehicleState, weather: WeatherSnapshot): ChargingPlanInput {
  const now = new Date();
  const horizonEnd = addDays(startOfDay(now), 3);
  const weatherPlan = normalizeWeather(weather);

  return {
    currentDateTime: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar',
    vehicle: {
      modelName: 'Mercedes-Benz EQS 450+',
      batteryPercent: vehicle.batteryLevel,
      usableBatteryKwh: 107.8,
      estimatedRangeKm: Math.round(620 * vehicle.batteryLevel / 100),
      averageEfficiencyKwhPer100Km: 17.4,
      homeChargingAvailable: true,
      homeChargingPowerKw: 11,
      connectorType: 'CCS2',
    },
    calendarEvents: events
      .filter((event) => !event.isAiRecommendationPreview)
      .filter((event) => {
        const date = eventDate(event);
        return date >= startOfDay(now) && date < horizonEnd;
      })
      .map((event) => {
        const distanceKm = event.carNeeded ? estimateDistanceKm(event.location) : 0;
        const trafficFactor = parseTimeToMinutes(event.departureTime ?? event.time) >= 17 * 60 ? 1.25 : 1.12;
        const weatherFactor = 1 + ((weatherPlan?.energyImpactPercent ?? 0) / 100);
        return {
          id: event.id,
          title: event.title,
          date: toDateValue(eventDate(event)),
          startTime: event.time,
          endTime: event.endTime ?? event.time,
          location: event.location,
          estimatedDistanceKm: distanceKm,
          estimatedEnergyUsePercent: Math.ceil(distanceKm / 5.8 * trafficFactor * weatherFactor),
          type: event.category,
        };
      }),
    driverHabits: {
      usuallyParkedAtHomeFrom: '20:00',
      usuallyParkedAtHomeUntil: '07:30',
      averageDailyDistanceKm: 42,
      preferredChargingLocation: 'home',
      usualChargingThresholdPercent: 30,
    },
    weather: weatherPlan,
    traffic: {
      condition: 'heavy',
      energyImpactPercent: 8,
    },
    chargingStations: mockDCChargingStationsMalaysia.slice(0, 12).map((station) => ({
      id: station.id,
      name: station.name,
      latitude: station.latitude,
      longitude: station.longitude,
      provider: station.provider,
      chargerType: station.chargerType,
      connectors: station.connectors,
      maxPowerKw: station.maxPowerKw,
      isHighwayStop: station.isHighwayStop,
    })),
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
  const location = action.location ?? plan.chargingLocationName ?? 'Charging location';
  const minutes = plan.estimatedChargingDurationMinutes ?? Math.max(30, parseTimeToMinutes(action.endTime) - parseTimeToMinutes(action.startTime));

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
      targetBattery: plan.targetBatteryPercent ?? 80,
      minutesNeeded: minutes,
      connector: 'CCS2',
      anchorLocation: plan.chargingLocationName ?? location,
      stationOptions: [],
      aiSource: plan.id.includes('fallback') ? 'fallback' : 'gemini',
      aiConfidence: plan.confidenceScore / 100,
      aiReason: plan.reason,
    },
  };
}

export function formatChargingWindow(plan: ChargingPlanResult) {
  const start = plan.recommendedChargingStart ? new Date(plan.recommendedChargingStart) : null;
  const end = plan.recommendedChargingEnd ? new Date(plan.recommendedChargingEnd) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'No charging window';
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function formatChargingWindowWithDate(plan: ChargingPlanResult) {
  const start = plan.recommendedChargingStart ? new Date(plan.recommendedChargingStart) : null;
  const end = plan.recommendedChargingEnd ? new Date(plan.recommendedChargingEnd) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'No charging window';
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${formatChargingWindow(plan)}`;
}
