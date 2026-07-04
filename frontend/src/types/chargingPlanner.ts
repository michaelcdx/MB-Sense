export type ChargingStationRecommendation = {
  id?: string;
  name: string;
  provider?: string | null;
  city?: string | null;
  address?: string | null;
  connector?: 'CCS2' | 'Tesla CCS2' | 'CHAdeMO' | string | null;
  maxPowerKw?: number | null;
  stalls?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  reason?: string | null;
};

export type OpenChargeMapStationCandidate = {
  id: string;
  name: string;
  provider: string;
  city: string;
  state?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  connector: string;
  maxPowerKw: number;
  stalls: number;
  status?: string | null;
  distanceKm?: number | null;
  source: "openchargemap";
  attribution: string;
};

export type ChargingPlanResult = {
  id: string;
  type: "ai_charging_recommendation";

  riskLevel: "low" | "medium" | "high";
  mainRisk:
    | "none"
    | "low_battery"
    | "limited_charging_opportunity"
    | "schedule_disruption"
    | "long_distance_trip"
    | "weather_traffic_impact"
    | "unknown";

  mobilityConfidenceScore: number;
  confidenceScore: number;

  shouldCharge: boolean;
  recommendationStatus: "not_needed" | "optional" | "recommended" | "urgent";

  title: string;
  summary: string;
  reason: string;

  recommendedChargingStart: string | null;
  recommendedChargingEnd: string | null;

  chargingLocationName: string | null;
  chargingLocationType: "home" | "public_dc" | "public_ac" | null;
  chargingType: "home_ac" | "public_dc_fast" | "public_ac" | "none";

  currentBatteryPercent: number;
  targetBatteryPercent: number | null;
  predictedBatteryAfterSchedule: number;
  predictedLowestBatteryPercent: number;
  estimatedEnergyNeededPercent: number;
  estimatedChargingDurationMinutes: number | null;
  stationRecommendations?: ChargingStationRecommendation[];

  riskBreakdown: {
    batteryRisk: "low" | "medium" | "high";
    chargingOpportunityRisk: "low" | "medium" | "high";
    scheduleDisruptionRisk: "low" | "medium" | "high";
    weatherTrafficRisk: "low" | "medium" | "high";
  };

  backupPlan: {
    available: boolean;
    title: string | null;
    locationName: string | null;
    startTime: string | null;
    endTime: string | null;
    reason: string | null;
  };

  calendarAction: {
    shouldCreateEvent: boolean;
    title: string;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    colorType: "charging" | "battery-risk" | "default";
  };

  sidePanelDetails: {
    mainMessage: string;
    batteryExplanation: string;
    scheduleExplanation: string;
    chargingExplanation: string;
    backupExplanation: string;
    userActionText: string;
  };
};

export type ChargingPlanInput = {
  currentDateTime: string;
  timezone: string;

  vehicle: {
    modelName: string;
    batteryPercent: number;
    estimatedRangeKm: number;
    connectorType?: "CCS2" | "CHAdeMO" | "Tesla CCS2";
  };

  targetChargePercent?: number;
  minimumBatteryPercent?: number;

  chargingOpportunity?: {
    nextDayDate: string;
    nextDayEventCount: number;
    nextDayDrivingEventCount: number;
    nextDayHasNoSchedule: boolean;
    idleTopUpThresholdPercent: number;
    shouldRecommendIdleTopUp: boolean;
    preferredChargingStart: string | null;
    preferredChargingEnd: string | null;
    estimatedChargingDurationMinutes: number | null;
    chargingLocationName: string;
    reason: string | null;
  };

  calendarEvents: Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    type?: string;
    carNeeded?: boolean;
    status?: string;
    notes?: string;
  }>;

  calendarRevision?: number;

  chargingStations?: OpenChargeMapStationCandidate[];

  weather?: Record<string, unknown>;
};
