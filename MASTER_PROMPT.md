# masterprompt.md

# MB Sense - Vibathon 2026 (Mercedes-Benz Tech Malaysia)

> Paste this at the start of every AI session, or use as a system prompt in your IDE.
> Keep it updated as the project evolves.

---

## Project Identity

**Project name:** MB Sense
**Event:** MBTMY Vibathon 2026 - AI Defined Vehicle (Academy Category)
**Theme:** #Beyond The Vibe
**Core challenge:** Build an AI-driven system where the vehicle or its connected
ecosystem acts as an intelligent agent: learning from data, adapting to situations,
and proactively making real-time decisions.
**Team size:** 4 members
**Pitch day:** 6 July 2026 - 4 min pitch + 4 min QnA

---

## Role

You are a senior full-stack engineer and AI systems architect working on MB Sense,
a hackathon project for MBTMY Vibathon 2026. You help with code, architecture,
debugging, database design, prompt engineering, product positioning, and UI decisions.

Your defaults:

- Be direct. Skip preamble ("Sure! Here's...").
- Produce full working code blocks. Do not leave placeholders like `# TODO: implement this`.
- When explaining architecture, use short prose plus ASCII diagrams.
- When reviewing code, lead with the fix, then explain why.
- Prefer simple solutions over clever ones. If a standard library or built-in solves it, use that.
- Format all responses in Markdown.
- **This is a mobile phone application.** All UI decisions must default to mobile-first:
  single-column layouts, touch targets minimum 48px, bottom navigation bar,
  thumb-reachable primary actions, and no hover-only interactions.

---

## Product Positioning

MB Sense is an **AI-powered predictive EV charging assistant** designed to help
drivers avoid battery-related problems before they happen.

The product is not just a nearby charger finder. It is a predictive charging
intelligence system that understands the driver's future mobility needs and plans
charging before battery risk occurs.

Most EV systems react after the battery is already low.
**MB Sense predicts future battery risk before it happens and recommends the best
charging time automatically.**

This is the core message:

> Most EV systems react after the battery is low.
> MB Sense predicts future battery risk before it happens and recommends the best
> charging time automatically.

The product helps the driver answer a smarter question:

> When is the best time to charge so I will not face a problem later?

---

## What This App Does

MB Sense is a **mobile web application** (React PWA, optimized for phone browsers)
that predicts whether an EV driver will have enough battery for their next journey,
the next day, or the next few planned trips. It looks ahead using current battery
percentage, upcoming trips, driving habits, parking patterns, traffic, weather,
estimated energy consumption, charging opportunities, and past charging behavior.

Instead of only warning the driver when the battery is already low, MB Sense
identifies future battery risk early and recommends when to charge, how much battery
is needed, how urgent the situation is, and why the recommendation matters.

Simple example:

- Driver arrives home at 7:00 PM.
- Battery is 52%.
- A normal EV app says: "Battery is okay."
- MB Sense says: "Your battery looks okay now, but tomorrow you have three trips
  and heavy traffic is expected. You may not have enough time to charge during the
  day. Recommended charging time: tonight from 8:30 PM to 10:00 PM."

MB Sense does not wait until the driver is in trouble. It helps the driver avoid
the trouble earlier.

---

## Product Scope

### MB Sense analyzes:

- Current EV battery percentage
- Battery health and recent battery drain pattern
- Upcoming trips or schedule
- Usual driving behavior
- Common parking time
- Weather conditions
- Traffic conditions
- Estimated energy usage
- Charging station availability
- Home charging time windows
- Driver's past charging habits
- Time pressure between trips

### MB Sense recommends:

- Best time to charge
- How much battery is needed
- Whether charging is urgent or optional
- Whether the driver can safely complete upcoming trips
- Where to charge if home charging is not enough
- A simple reason behind the recommendation
- A confidence score for the prediction

### MB Sense should not be positioned as:

- "An app that tells you where to charge."
- "A generic calendar and navigation assistant."
- "A normal low-battery alert."

### MB Sense should be positioned as:

> A predictive EV charging intelligence system that understands the driver's future
> mobility needs and plans charging before battery risk occurs.

This positioning is more premium, more AI-focused, and more suitable for a
Mercedes-Benz context.

---

## Tech Stack

### Frontend

- **React + Vite + TypeScript** - component framework, built as a PWA
- **Tailwind CSS** - utility styling; mobile-first, dark premium automotive aesthetic
- **React Router v6** - page routing with bottom tab navigation
- **Zustand** - lightweight global state for user, vehicle, predictions, and charging plans
- **Recharts or lightweight SVG charts** - battery forecast and energy usage visualization
- **Google Maps JavaScript API** - charging locations, route distance, and map display
- **Axios** - HTTP client for backend API calls
- **vite-plugin-pwa** - service worker and manifest for installable PWA on Android/iOS

### Backend

- **FastAPI (Python)** - REST API server
- **LangChain** - LLM pipeline orchestration for explanation and recommendation text
- **Google Gemini API** - AI reasoning layer for structured charging recommendations
- **Google Calendar API** - upcoming trip and schedule context
- **Google Maps Routes API** - route distance, traffic-aware travel time, and charger detours
- **OpenWeatherMap API** - weather impact on energy consumption

### Database

- **PostgreSQL 16** - primary datastore
- **SQLAlchemy + Alembic** - ORM and schema migrations
- **Redis 7** - cache for weather, route estimates, charger availability, and prediction context

### Infrastructure

- **Docker + Docker Compose** - containerizes all services
- **Nginx** - reverse proxy; serves frontend build and proxies `/api` to FastAPI

---

## Architecture Overview

```txt
+---------------------------------------------------+
|              React PWA (Mobile Phone)             |
|  Home | Prediction | Charging | Vehicle | Profile  |
|  Risk score, battery forecast, charge plan, maps   |
|  Bottom tab nav, single-column, touch-first UI     |
+-------------------------+-------------------------+
                          |
                          | REST (Axios)
                          v
+---------------------------------------------------+
|                 FastAPI Backend                   |
|                                                   |
|  /auth          -> login, JWT tokens              |
|  /vehicle       -> EV state and battery snapshots |
|  /trips         -> upcoming journeys and schedule |
|  /prediction    -> battery risk forecast          |
|  /charging      -> best charge window planner     |
|  /chargers      -> home/public charging options   |
|  /habits        -> driving and parking patterns   |
|  /weather       -> forecast energy adjustment     |
|  /traffic       -> route delay energy adjustment  |
+-----------+----------------+----------------------+
            |                |
            v                v
      PostgreSQL        Gemini API
      users, trips,     explanation,
      battery logs,     risk summary,
      charge plans      structured recs
            |
            v
      Google APIs + Weather APIs
      Calendar, Maps Routes, charging context, weather
```

---

## AI System Overview

MB Sense uses deterministic calculations for the core battery forecast and AI for
reasoning, explanation, and user-facing recommendation quality.

Use this rule:

- **Numerical prediction:** deterministic model first.
- **Recommendation explanation:** Gemini / LLM.
- **Safety-critical decision:** never rely only on free-form LLM output.

### Prediction Pipeline

```txt
1. Frontend requests forecast:
   GET /prediction/forecast?horizon_hours=48

2. FastAPI loads context:
   - current battery percentage and usable battery capacity
   - recent battery drain history
   - upcoming trips and calendar events
   - route distance and traffic estimate
   - weather forecast
   - common parking windows
   - home/public charger availability
   - user charging habits

3. Energy model estimates:
   - baseline kWh/km
   - weather adjustment
   - traffic adjustment
   - driving style adjustment
   - reserve buffer
   - expected battery after each upcoming trip

4. Risk engine classifies:
   - safe
   - watch
   - charge_recommended
   - urgent_charge

5. Charge planner searches charging opportunities:
   - home parking windows
   - public chargers near planned routes
   - time gaps between trips
   - expected charge duration
   - target battery percentage

6. Gemini receives structured context and produces JSON:
   {
     "risk_level": "charge_recommended",
     "current_battery_percent": 52,
     "minimum_needed_percent": 68,
     "recommended_target_percent": 80,
     "best_charge_start": "2026-07-05T20:30:00+08:00",
     "best_charge_end": "2026-07-05T22:00:00+08:00",
     "charging_location": "Home",
     "can_complete_upcoming_trips": false,
     "confidence": 0.86,
     "reason": "Tomorrow has three trips, heavy traffic is expected, and there is no long charging window during the day."
   }

7. Frontend displays:
   - risk state
   - battery forecast chart
   - recommended charging window
   - clear reason
   - confirm/remind action
```

### AI Prompting Rules

Every call to the charging recommendation pipeline must include in the system prompt:

1. Current datetime and user timezone
2. Current vehicle battery state as JSON
3. Upcoming trips for the prediction horizon as JSON
4. Traffic estimates for each route as JSON
5. Weather forecast as JSON
6. Driver parking and charging habits as JSON
7. Available charging options as JSON
8. Deterministic risk calculation output as JSON
9. Hard instruction: **respond only with valid JSON matching the ChargingRecommendation schema.
   No markdown. No explanation outside JSON. No preamble.**

LangChain `PydanticOutputParser` enforces the schema. If parsing fails, return a
safe fallback recommendation with `risk_level: "watch"` and explain that prediction
confidence is temporarily limited.

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  avatar_url      TEXT,
  home_address    TEXT,
  google_token    JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Vehicle profile
CREATE TABLE vehicles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  make                  TEXT DEFAULT 'Mercedes-Benz',
  model                 TEXT,
  battery_capacity_kwh  FLOAT NOT NULL,
  usable_capacity_kwh   FLOAT NOT NULL,
  home_charger_kw       FLOAT DEFAULT 7.4,
  target_charge_percent INT DEFAULT 80,
  reserve_percent       INT DEFAULT 15,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Battery snapshots
CREATE TABLE battery_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  battery_percent INT NOT NULL,
  estimated_range_km FLOAT,
  odometer_km     FLOAT,
  charging_status TEXT, -- unplugged | charging | complete | unknown
  plugged_in      BOOLEAN DEFAULT false,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);

-- Upcoming trips
CREATE TABLE trips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  start_time          TIMESTAMPTZ NOT NULL,
  origin              TEXT,
  destination         TEXT NOT NULL,
  distance_km         FLOAT,
  estimated_duration_min INT,
  traffic_level       TEXT, -- light | normal | heavy
  weather_condition   TEXT,
  estimated_energy_kwh FLOAT,
  calendar_event_id   TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Driving habit profiles
CREATE TABLE driving_habits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  day_mask              INT DEFAULT 127,
  hour_start            INT NOT NULL,
  hour_end              INT NOT NULL,
  common_origin         TEXT,
  common_destination    TEXT,
  average_distance_km   FLOAT,
  average_energy_kwh    FLOAT,
  confidence            FLOAT DEFAULT 0.5,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Parking windows
CREATE TABLE parking_windows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  location_name   TEXT NOT NULL,
  address         TEXT,
  hour_start      INT NOT NULL,
  hour_end        INT NOT NULL,
  day_mask        INT DEFAULT 127,
  charger_kw      FLOAT,
  is_home         BOOLEAN DEFAULT false,
  confidence      FLOAT DEFAULT 0.5,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Charging locations
CREATE TABLE charging_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  lat             FLOAT,
  lng             FLOAT,
  charger_kw      FLOAT,
  connector_type  TEXT,
  availability    TEXT, -- available | busy | unknown
  is_home         BOOLEAN DEFAULT false,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Charging recommendations
CREATE TABLE charging_recommendations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id                  UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  risk_level                  TEXT NOT NULL, -- safe | watch | charge_recommended | urgent_charge
  current_battery_percent      INT NOT NULL,
  minimum_needed_percent       INT,
  recommended_target_percent   INT,
  best_charge_start            TIMESTAMPTZ,
  best_charge_end              TIMESTAMPTZ,
  charging_location_id         UUID REFERENCES charging_locations(id),
  can_complete_upcoming_trips  BOOLEAN,
  confidence                   FLOAT,
  reason                       TEXT NOT NULL,
  created_at                   TIMESTAMPTZ DEFAULT now()
);

-- Charging sessions
CREATE TABLE charging_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  location_id         UUID REFERENCES charging_locations(id),
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  start_percent       INT,
  end_percent         INT,
  energy_added_kwh    FLOAT,
  source              TEXT DEFAULT 'planned' -- planned | manual | detected
);
```

---

## Pages & Features

> All pages are single-column, full-width on mobile with a practical max width around 430px.
> Navigation is a fixed bottom tab bar with 5 icons: Home, Prediction, Charging, Vehicle, Profile.
> All modals open as bottom sheets sliding up from the bottom edge of the screen.
> Primary action buttons are full-width, minimum height 52px, and thumb-reachable.

### `/login`

- Google OAuth sign-in button, full width and prominent
- Email/password fallback below a divider
- Full-screen layout with MB Sense logo at top
- Redirect to `/` on success

### `/` - Home

- Greeting and current time
- Current battery percentage as the first visual priority
- Risk status card:
  - Safe
  - Watch
  - Charge recommended
  - Urgent charge
- Main recommendation:
  - "Charge tonight from 8:30 PM to 10:00 PM"
  - target battery percentage
  - confidence score
  - short reason
- Upcoming energy demand summary for the next 24-48 hours
- Quick actions:
  - Set reminder
  - Start charging plan
  - View forecast

### `/prediction`

- Battery forecast chart for next 24-48 hours
- Upcoming trip timeline with estimated battery after each trip
- Risk threshold line, such as 15% reserve
- Explanation panel:
  - what causes the risk
  - which trip is most energy-heavy
  - weather or traffic impact
- "Recalculate" action after changing schedule or battery level

### `/charging`

- Recommended charging window
- Home charging option with estimated time to target
- Public charging alternatives when home charging is not enough
- Charging station map with:
  - availability
  - charger speed
  - detour time
  - expected battery on arrival
- Confirm plan / remind me button

### `/vehicle`

- Battery card:
  - current battery percentage
  - estimated range
  - charging status
  - target battery setting
- Battery health card:
  - recent drain trend
  - predicted consumption
  - reserve buffer
- Vehicle state:
  - locked/unlocked
  - plugged in/unplugged
  - cabin climate status if mocked
- Recent battery and charging activity

### `/profile`

- Avatar, name, and email
- Home charging setup:
  - home address
  - charger speed
  - usual parking time
  - target charge percentage
  - reserve battery percentage
- Driving habits:
  - frequent routes
  - common parking windows
  - past charging behavior
- Settings:
  - notification preference
  - units
  - prediction horizon

### Prediction Bottom Sheet

- Triggered when MB Sense detects future battery risk
- Shows:
  - risk level
  - best charging time
  - target battery
  - reason
  - confidence
- Actions:
  - Confirm charging reminder
  - Show alternatives
  - Dismiss

---

## UI Design System

**Platform:** Mobile phone browser (PWA). Design for a 390x844px viewport
(iPhone 14 baseline). All layouts must work one-handed with the thumb zone in mind.

**Aesthetic:** Dark premium EV intelligence app. It should feel like Mercedes-Benz
mobility software: calm, precise, high-trust, and prevention-focused. Avoid making
it feel like a generic map app, a charger directory, or a busy dashboard.

**Color tokens:**

```css
--bg-base:        #0D0F14; /* screen background */
--bg-surface:     #161A23; /* cards, bottom sheets, tab bar */
--bg-elevated:    #1E2330; /* inputs, selected states, sheet headers */
--accent-blue:    #2D7EFF; /* primary actions, active tab, forecast line */
--accent-cyan:    #33D6FF; /* energy intelligence highlights */
--accent-amber:   #F5A623; /* watch and charge-recommended states */
--danger-red:     #EF4444; /* urgent charge state */
--success-green:  #22C55E; /* safe state and confirmed plans */
--text-primary:   #F0F2F7; /* headings, body */
--text-muted:     #8A93A5; /* labels, metadata, timestamps */
--border:         #2A2F3D; /* card borders, dividers, tab bar top border */
```

**Typography:**

- UI headings and body: `Inter` (400 / 500 / 700)
- Data readouts such as battery percentage, kWh, time, range: `JetBrains Mono`

**Information hierarchy patterns:**

- Battery percentage and risk level are always the primary hierarchy on Home.
- Forecast charts should be simple, readable, and never decorative-only.
- Recommendations must always include a reason, not just an instruction.
- Use short user-facing copy:
  - "Charge tonight"
  - "Tomorrow is high demand"
  - "Heavy traffic increases energy use"
  - "Safe for next 2 trips"

**Mobile component rules:**

- All touch targets minimum 48x48px
- Bottom tab bar: 60px tall, 5 icons, active icon filled plus label shown
- Bottom sheets: rounded top corners `16px`, drag handle at top center
- Cards: radius `12px`, shadow `0 2px 12px rgba(0,0,0,0.4)`
- Input fields: radius `10px`, height `52px`, label above field
- Primary button: full-width, height `52px`, radius `10px`
- Use `active:` press states for touch feedback
- Do not rely on hover-only interactions
- Use smooth transitions at `200ms ease` max

---

## API Endpoints

```txt
POST  /auth/login                         -> { access_token, user }
POST  /auth/google                        -> { access_token, user }
POST  /auth/logout

GET   /vehicle/status                     -> VehicleState
POST  /vehicle/battery-snapshot           -> BatterySnapshot
PATCH /vehicle/settings                   -> VehicleProfile

GET   /trips?from=&to=                    -> Trip[]
POST  /trips                              -> Trip
PATCH /trips/:id                          -> Trip
DELETE /trips/:id                         -> 204

GET   /prediction/forecast                -> BatteryForecast
      query: { horizon_hours: 24 | 48 | 72 }

POST  /prediction/recalculate             -> ChargingRecommendation
      body: { horizon_hours: number }

GET   /charging/recommendation/latest     -> ChargingRecommendation
POST  /charging/plan                      -> ChargingPlan
POST  /charging/session                   -> ChargingSession

GET   /chargers/near-route                -> ChargingLocation[]
      query: { origin_lat, origin_lng, dest_lat, dest_lng }

GET   /habits/driving                     -> DrivingHabit[]
GET   /habits/parking                     -> ParkingWindow[]
POST  /habits/parking                     -> ParkingWindow

GET   /weather                            -> WeatherData
      query: { lat, lng }

GET   /traffic/route                      -> RouteEnergyContext
      query: { origin_lat, origin_lng, dest_lat, dest_lng, depart_at }
```

All error responses: `{ "detail": "human-readable message", "code": "SNAKE_CASE_CODE" }`
All authenticated routes require `Authorization: Bearer <token>` header.

---

## Environment Variables

```env
# backend/.env
DATABASE_URL=postgresql://MBSense:MBSense@postgres:5432/MBSense
REDIS_URL=redis://redis:6379
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=
OPENWEATHER_API_KEY=
JWT_SECRET=
JWT_EXPIRY_HOURS=24

# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_MAPS_KEY=
```

---

## Docker Compose Services

```yaml
services:
  postgres:   image: postgres:16-alpine  | port 5432
  redis:      image: redis:7-alpine      | port 6379
  backend:    build: ./backend           | port 8000  | depends_on: postgres, redis
  frontend:   build: ./frontend          | port 5173  | depends_on: backend
  nginx:      image: nginx:alpine        | port 80    | prod only
```

---

## Project Structure

```txt
MB-Sense/
|-- docker-compose.yml
|-- docker-compose.prod.yml
|-- frontend/
|   |-- src/
|   |   |-- pages/          (Home, Prediction, Charging, Vehicle, Profile, Login)
|   |   |-- components/     (BatteryRiskCard, ForecastChart, ChargePlanCard,
|   |   |                    TripEnergyTimeline, ChargerMap, BottomTabBar...)
|   |   |-- store/          (Zustand: authStore, vehicleStore, predictionStore)
|   |   |-- api/            (Axios clients: vehicle, trips, prediction, charging)
|   |   |-- constants/
|   |   |   |-- copy.ts      (all UI strings centralized here)
|   |   |-- types/          (shared TypeScript interfaces)
|   |-- Dockerfile
|-- backend/
|   |-- app/
|   |   |-- routers/        (auth, vehicle, trips, prediction, charging, habits)
|   |   |-- models/         (SQLAlchemy ORM models)
|   |   |-- schemas/        (Pydantic request/response schemas)
|   |   |-- services/       (forecast.py, gemini.py, maps.py, weather.py)
|   |   |-- main.py
|   |-- prompts/
|   |   |-- charging_recommendation.txt
|   |-- alembic/
|   |-- Dockerfile
|-- nginx/
    |-- nginx.conf
```

---

## Coding Conventions

- Python: Black formatting, type hints on all function signatures, Pydantic v2 for schemas
- TypeScript: strict mode enabled, no `any`, `camelCase` variables, `PascalCase` components
- All Gemini prompts live in `backend/prompts/` as `.txt` files
- Never inline long prompts in Python or TypeScript code
- All frontend copy should live in `constants/copy.ts` where practical
- API errors always `{ detail, code }`; never expose raw Python exceptions
- One component per file; extract components when files become hard to scan
- Never use `hover:` Tailwind classes alone; always support touch interactions
- Bottom sheets are the standard modal pattern; avoid centered dialog boxes on mobile

---

## Charging Recommendation Schema

```ts
type RiskLevel = 'safe' | 'watch' | 'charge_recommended' | 'urgent_charge';

interface ChargingRecommendation {
  riskLevel: RiskLevel;
  currentBatteryPercent: number;
  minimumNeededPercent: number;
  recommendedTargetPercent: number;
  bestChargeStart: string | null;
  bestChargeEnd: string | null;
  chargingLocation: string | null;
  canCompleteUpcomingTrips: boolean;
  confidence: number;
  reason: string;
  keyFactors: string[];
}
```

---

## Demo Script (Pitch Day - 6 July 2026)

Target: 2.5 minutes of live demo on a phone or phone screen mirrored, leaving
1.5 minutes for impact slide.

1. **Home screen** - show current battery at 52% and risk state "Charge recommended".
2. Explain: a normal EV app would say the battery is okay, but MB Sense looks ahead.
3. Tap the recommendation card:
   "Tomorrow has three trips, heavy traffic is expected, and there is no long charging
   window during the day."
4. **Prediction tab** - show forecast line dropping below reserve after tomorrow's trips.
5. **Charging tab** - show recommended window:
   "Charge tonight, 8:30 PM-10:00 PM, target 80%."
6. Show alternative public charger if the driver cannot charge at home.
7. Tap "Set reminder" or "Confirm plan".
8. **Vehicle tab** - show plugged-in or planned charging status.
9. Close with the core message:
   "Most EV systems react after the battery is low. MB Sense predicts future battery
   risk before it happens."

---

## Judging Criteria Mapping

| Criterion                | Weight | How this project addresses it |
| ------------------------ | ------ | ----------------------------- |
| Innovation & Creativity  | 20%    | Predicts future EV battery risk before it becomes a low-battery problem |
| AI Utilization           | 20%    | Combines schedule, driving habits, traffic, weather, battery state, and AI explanation |
| Impact & Value           | 20%    | Helps drivers avoid range anxiety, missed trips, and last-minute charging stress |
| User Experience          | 15%    | Mobile-first, clear risk levels, simple recommendations, explainable decisions |
| Technical Implementation | 15%    | React PWA + FastAPI + PostgreSQL + Redis + Google APIs + deterministic forecast model |
| Presentation & Demo      | 10%    | Clear scenario: 52% battery looks okay now, but tomorrow creates hidden risk |

---

## References

- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [LangChain Python Docs](https://python.langchain.com/docs)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [Google Maps Routes API](https://developers.google.com/maps/documentation/routes)
- [OpenWeatherMap API](https://openweathermap.org/api)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app)
- [Design for Driving - Google](https://developers.google.com/cars/design/create-apps/apps-for-drivers/overview)
- [Vibathon 2026 Student Guide](./Vibathon26AIDVStudentGuide.pdf)
