Please implement the improved MBSense AI Charging Planner.

Before editing, inspect the existing project structure and find the current Gemini API integration, calendar data, home screen, calendar week view, side panel, mock data, and any existing service/API files. Reuse the current architecture as much as possible. Do not rewrite the whole app.

# Product Direction

MBSense is now focused on **AI-powered EV charging prediction**.

The system should not only predict the best time to charge. It should predict the driver’s **future mobility risk**.

Core selling point:

> Most EV systems react when the battery is already low.
> MBSense predicts charging risk before it happens.

Gemini should act as a **predictive planning engine**, not a chatbot.

# What Gemini Should Predict

Gemini should analyze the user’s data and return:

1. Best charging window
2. Battery risk
3. Charging opportunity risk
4. Schedule disruption risk
5. Mobility confidence score
6. Best charging location
7. Charging type recommendation
8. Target battery percentage
9. Human-friendly reason
10. Backup charging plan

# Main User Flow

The feature should support this flow:

1. User opens MBSense.
2. App collects current mock data:

   * Current battery
   * Vehicle range
   * Calendar events
   * Driving habits
   * Weather
   * Traffic
   * Charging stations
3. App sends the data to Gemini.
4. Gemini returns structured JSON.
5. Home screen shows an AI charging recommendation card.
6. Calendar week view shows the recommended charging window as a green block.
7. Side panel shows the full AI explanation.
8. User can confirm and add the charging plan to calendar.

# Do Not Make It a Chatbot Only

The AI should not only respond when the user asks.

It should also work proactively when the app loads or when the user views the home screen/calendar.

Optional later: chatbot/voice assistant can trigger the same AI planner by saying “I want to charge.”

# Required Gemini Output Type

Create or update the TypeScript type for the Gemini charging result.

Use this structure:

```ts
export type ChargingPlanResult = {
  id: string;
  type: "ai_charging_recommendation";

  // Overall risk
  riskLevel: "low" | "medium" | "high";
  mainRisk:
    | "none"
    | "low_battery"
    | "limited_charging_opportunity"
    | "schedule_disruption"
    | "long_distance_trip"
    | "weather_traffic_impact"
    | "unknown";

  // Confidence
  mobilityConfidenceScore: number; // 0-100
  confidenceScore: number; // 0-100

  // Recommendation status
  shouldCharge: boolean;
  recommendationStatus: "not_needed" | "optional" | "recommended" | "urgent";

  // Main copy
  title: string;
  summary: string;
  reason: string;

  // Charging window
  recommendedChargingStart: string | null; // ISO datetime
  recommendedChargingEnd: string | null; // ISO datetime

  // Charging location
  chargingLocationName: string | null;
  chargingLocationType: "home" | "public_dc" | "public_ac" | null;
  chargingType: "home_ac" | "public_dc_fast" | "public_ac" | "none";

  // Battery prediction
  currentBatteryPercent: number;
  targetBatteryPercent: number | null;
  predictedBatteryAfterSchedule: number;
  predictedLowestBatteryPercent: number;
  estimatedEnergyNeededPercent: number;
  estimatedChargingDurationMinutes: number | null;

  // Risk breakdown
  riskBreakdown: {
    batteryRisk: "low" | "medium" | "high";
    chargingOpportunityRisk: "low" | "medium" | "high";
    scheduleDisruptionRisk: "low" | "medium" | "high";
    weatherTrafficRisk: "low" | "medium" | "high";
  };

  // Backup plan
  backupPlan: {
    available: boolean;
    title: string | null;
    locationName: string | null;
    startTime: string | null;
    endTime: string | null;
    reason: string | null;
  };

  // Calendar block
  calendarAction: {
    shouldCreateEvent: boolean;
    title: string;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    colorType: "charging" | "battery-risk" | "default";
  };

  // Side panel details
  sidePanelDetails: {
    mainMessage: string;
    batteryExplanation: string;
    scheduleExplanation: string;
    chargingExplanation: string;
    backupExplanation: string;
    userActionText: string;
  };
};
```

# Required Input Type

Create or update the input type for the planner.

Use this structure, but adapt field names if the app already has equivalent types:

```ts
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
```

# Gemini System Prompt

Use this as the Gemini system instruction or main prompt:

```text
You are the AI Charging Planner for MBSense.

MBSense is a predictive EV charging assistant for an AI-defined vehicle experience.

Your job is to analyze the driver's current EV battery level, upcoming schedule, estimated trips, driving habits, weather, traffic, and charging availability.

Your goal is to predict future mobility and charging risk before the battery becomes a problem.

Core principle:
Most EV systems react after the battery is already low.
MBSense predicts charging risk before it happens.

You are not a chatbot.
You are a structured decision engine.

You must predict:
1. The best charging window.
2. Battery risk.
3. Charging opportunity risk.
4. Schedule disruption risk.
5. Mobility confidence score.
6. Best charging location.
7. Charging type recommendation.
8. Target battery percentage.
9. Backup charging plan.
10. Human-friendly explanation.

Decision rules:
- Do not recommend charging only because the battery is below a fixed threshold.
- Look ahead at the user's schedule and detect future risk.
- A battery level that looks safe now may still be risky if the upcoming schedule is busy.
- Charging opportunity risk is important: detect whether the user may have no good time to charge later.
- Schedule disruption risk is important: avoid recommendations that conflict with events.
- Prefer charging when the car is usually parked and unused.
- Prefer home charging if it is available and fits the schedule.
- Use public DC fast charging when home charging is unavailable, too slow, or does not fit the schedule.
- Never recommend charging during calendar events.
- Avoid recommending charging windows shorter than the estimated charging duration.
- Consider heavy traffic and rain as factors that may increase energy usage.
- Recommend a reasonable target battery percentage, not always 100%.
- If data is incomplete, make a safe conservative recommendation and mention uncertainty in the reason.
- Keep the explanation short, clear, and user-friendly.
- Return only valid JSON.
- Do not return markdown.
- Do not add explanation outside the JSON.
```

# User Prompt Template

When calling Gemini, send the app data like this:

```text
Analyze this MBSense charging planning data and return the best predictive charging recommendation.

Current datetime:
{{currentDateTime}}

Timezone:
{{timezone}}

Vehicle:
{{vehicleJson}}

Calendar events:
{{calendarEventsJson}}

Driver habits:
{{driverHabitsJson}}

Weather:
{{weatherJson}}

Traffic:
{{trafficJson}}

Charging stations:
{{chargingStationsJson}}

Return only valid JSON using the required schema.
```

# Important Implementation Rule

Normal code should prepare useful data.

Gemini should make the final recommendation and explanation.

Use normal code for:

* Collecting events
* Reading battery percentage
* Passing mock weather/traffic
* Passing charging stations
* Checking available schedule gaps if already implemented

Use Gemini for:

* Choosing the best charging window
* Predicting risk level
* Explaining the recommendation
* Choosing home charging vs public DC charging
* Creating backup plan

# Fallback Result

If Gemini fails, returns invalid JSON, or API key is missing, return this safe fallback object instead of crashing:

```ts
const fallbackChargingPlan: ChargingPlanResult = {
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
```

# Home Screen Requirement

Show a recommendation card using the Gemini result.

The card should show:

* Title
* Risk level
* Mobility confidence score
* Recommended charging time
* Charging location
* Target battery
* Short reason
* Button: “View details”
* Button: “Add to calendar” if `calendarAction.shouldCreateEvent` is true

Example UI copy:

```text
AI Charging Recommendation

Charge tonight
8:30 PM – 10:00 PM

Mobility Confidence: 58%
Risk Level: Medium

Tomorrow has multiple trips and limited charging opportunity.
Target battery: 85%
```

# Calendar Requirement

If `calendarAction.shouldCreateEvent` is true, render the AI charging recommendation as a green block in the Calendar week view.

Use:

```css
background: #14532D;
color: #ECFDF5;
```

If the main risk is high or `colorType` is `"battery-risk"`, use amber:

```css
background: #7C4A03;
color: #FFFBEB;
```

The event block should be clickable and open the existing side panel.

# Side Panel Requirement

When the user clicks the AI charging card or calendar block, show the full details in the existing side panel.

Show:

* Title
* Summary
* Risk level
* Mobility confidence score
* Current battery
* Target battery
* Predicted lowest battery
* Predicted battery after schedule
* Charging location
* Charging type
* Recommended charging time
* Main reason
* Risk breakdown
* Backup plan
* Button: “Add charging plan to calendar”

Do not use a large modal overlay. Use the current side panel layout.

# Add to Calendar Behavior

Do not let Gemini directly modify the calendar.

Correct flow:

1. Gemini recommends.
2. User clicks “Add charging plan to calendar.”
3. App creates the calendar event using `calendarAction`.
4. Calendar week view updates immediately.

# Mock Demo Scenario

Create or update mock data to support this strong demo:

Current battery: 52%.

Today evening:

* Car is usually parked at home after 8:00 PM.
* Home charger is available.

Tomorrow:

* 9:00 AM class
* 1:00 PM meeting
* 6:00 PM event
* Heavy traffic
* Rain
* Limited free time to charge

Expected result:

MBSense recommends charging tonight from around 8:30 PM to 10:00 PM, targeting around 85%, because tomorrow creates future charging risk even though the current battery does not look low.

# Quality Rules

* Do not expose the Gemini API key in frontend code.
* Keep Gemini calls in backend/server/service side if backend exists.
* If the project is frontend-only, use environment variables and clearly keep it demo-safe.
* Return structured data to the UI.
* Do not display raw Gemini text directly.
* Do not make Gemini a chat-only interface.
* Do not break the existing calendar UI.
* Do not remove existing event logic.
* Do not hardcode only one output if the data structure can support dynamic results.
* Validate Gemini output before using it.
* Keep code reusable and easy to debug.

# Final Expected Result

After implementation, MBSense should be able to:

1. Collect vehicle, calendar, habit, weather, traffic, and charging station data.
2. Send the structured data to Gemini.
3. Receive a structured AI charging recommendation.
4. Predict battery risk, charging opportunity risk, schedule disruption risk, and mobility confidence.
5. Show the recommendation on the Home screen.
6. Show the recommendation as a green calendar block.
7. Show full explanation in the side panel.
8. Allow the user to confirm and add the charging plan to the calendar.
9. Use fallback mock data if Gemini fails.

The feature must clearly demonstrate:

“Most EV systems react after the battery is low. MBSense predicts charging risk before it happens.”
