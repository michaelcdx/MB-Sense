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
    usableBatteryKwh?: number;
    estimatedRangeKm: number;
    averageEfficiencyKwhPer100Km?: number;
    homeChargingAvailable: boolean;
    homeChargingPowerKw?: number;
    connectorType?: "CCS2" | "CHAdeMO" | "Tesla CCS2";
  };

  calendarEvents: Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    estimatedDistanceKm?: number;
    estimatedEnergyUsePercent?: number;
    type?: string;
  }>;

  driverHabits: {
    usuallyParkedAtHomeFrom?: string;
    usuallyParkedAtHomeUntil?: string;
    averageDailyDistanceKm?: number;
    preferredChargingLocation?: "home" | "public_dc" | "any";
    usualChargingThresholdPercent?: number;
  };

  weather?: {
    condition: "clear" | "rain" | "storm" | "hot" | "unknown";
    energyImpactPercent?: number;
  };

  traffic?: {
    condition: "light" | "moderate" | "heavy" | "unknown";
    energyImpactPercent?: number;
  };

  chargingStations?: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    provider?: string;
    chargerType: "DC" | "AC";
    connectors: string[];
    maxPowerKw: number;
    isHighwayStop?: boolean;
  }>;
};
