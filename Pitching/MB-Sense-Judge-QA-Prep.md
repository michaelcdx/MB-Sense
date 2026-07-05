# MB Sense Hackathon Judge Q&A Prep Pack

Prepared for: **MBTMY Vibathon 2026 - AI Defined Vehicle, Academy Category**  
Pitch day: **6 July 2026**  
Format: **4 minute pitch + 4 minute Q&A**  
Judge types: **Business judges** and **Technical judges**

---

## 1. Core Pitch In One Sentence

**MB Sense is an AI-powered predictive EV charging assistant that looks ahead at the driver's schedule, battery state, route demand, weather, traffic, and charging opportunities to recommend the best time to charge before battery risk happens.**

The sentence to repeat:

> Most EV systems react after the battery is already low. MB Sense predicts future battery risk before it happens and recommends the best charging time automatically.

The simple question MB Sense answers:

> When should I charge so my future schedule is safe?

---

## 2. What MB Sense Is

MB Sense is not just a nearby charger finder.

It is a **predictive EV charging intelligence system** for a Mercedes-Benz style connected mobility experience.

It combines:

- Current battery percentage
- Estimated range
- Upcoming calendar schedule
- Driving events that need the car
- Route distance estimates
- Traffic and weather impact
- Charging target and minimum battery policy
- AC home charging possibility
- DC public charging options
- Charger station candidates
- AI-generated explanation and recommendation

Then it outputs:

- Whether charging is needed
- Best charging time window
- Recommended target battery
- Minimum safe battery threshold
- Predicted battery after schedule
- Best charging location
- AC or DC charging mode
- Reason behind the recommendation
- Confidence score
- One-tap calendar insertion
- Map navigation to a selected station

---

## 3. What Problem We Are Solving

EV drivers usually know their battery percentage, but that number alone does not answer whether they are safe for tomorrow.

Example:

- Driver arrives home at 7:00 PM.
- Battery is 52%.
- A normal EV app says: "Battery is okay."
- But tomorrow has multiple trips, possible heavy traffic, and no long charging gap.
- MB Sense says: "Your battery looks okay now, but tomorrow creates hidden risk. Charge tonight before the schedule becomes difficult."

The hidden problem:

**Battery percentage without future mobility context creates false confidence.**

---

## 4. Main Demo Scenario

Use this scenario in the pitch:

> The car has 52% battery. That looks safe today. But MB Sense checks tomorrow's calendar and predicts the driver's schedule will push the battery below the minimum threshold. So it recommends charging before the risk happens.

Demo flow:

1. Start on **Home**.
2. Show current battery percentage and AI Charging Recommendation.
3. Explain that the app predicts schedule-based battery risk.
4. Show the "Why now" reason.
5. Show target charge, minimum threshold, predicted battery after schedule, and confidence.
6. Go to **Calendar** to show driving events and charging/risk blocks.
7. Go to **AI / Settings** to show target battery, minimum battery policy, and AC/DC comparison.
8. Go to **Map** if a public station is recommended.
9. Return to Home and use **Put in your Calendar**.

Backup demo:

- `Pitching/index.html` plays the pitch video queue from `F1.mp4` to `F11.mp4`.
- Use it if live demo switching is risky.

---

## 5. Judge Positioning

### Business Judge View

Business judges care about:

- Is the problem real?
- Is the value clear?
- Is it different from existing EV apps?
- Does it fit Mercedes-Benz?
- Can it become a product or business feature?
- Can customers trust and understand it?

Best business framing:

> MB Sense turns charging from a reactive chore into proactive premium assistance.

### Technical Judge View

Technical judges care about:

- Is the AI meaningful?
- Is the system more than a chatbot?
- Are calculations deterministic and explainable?
- Are there fallbacks?
- Is the implementation real?
- Can the team explain the architecture honestly?

Best technical framing:

> We use deterministic schedule and energy calculations first, then use Gemini for structured reasoning and explanation. The LLM does not blindly own the safety-critical battery math.

---

## 6. Product Differentiation

Most EV apps:

- Show current battery
- Show nearby chargers
- Warn when battery is already low
- Help after the driver realizes there is a problem

MB Sense:

- Looks at future schedule
- Predicts tomorrow's battery risk
- Finds the best time to charge
- Chooses AC or DC depending on schedule pressure
- Gives a clear reason
- Turns recommendation into a calendar action

The strongest differentiator:

> Other tools answer "Where can I charge?" MB Sense answers "When should I charge so my next trips are safe?"

---

## 7. Current Implementation From Repo Review

### Frontend

Actual frontend stack:

- React 19
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- React Router
- Recharts
- Lucide icons
- Motion animations
- Google Maps / MapLibre related packages

Main app areas:

- Home
- Calendar
- Map
- Vehicle
- AI settings
- Profile
- Chatbot
- Voice assistant

Important files:

- `frontend/src/App.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Calendar.tsx`
- `frontend/src/pages/Map.tsx`
- `frontend/src/pages/AI.tsx`
- `frontend/src/pages/Vehicle.tsx`
- `frontend/src/components/Chatbot.tsx`
- `frontend/src/components/VoiceAssistant.tsx`
- `frontend/src/store/useAppStore.ts`

### Backend

Actual backend stack:

- Node.js
- Express
- TypeScript
- Google Gemini SDK
- WebSocket server
- JSON-file demo persistence

Important backend file:

- `backend/server.ts`

Main backend capabilities:

- Login/register demo account
- Persist user profile and calendar state
- Health check
- Public config
- Route helper endpoint
- Open Charge Map station lookup
- Gemini chat endpoint
- Gemini charging prediction endpoint
- Gemini charging plan endpoint
- Weather, routing, parking, efficiency, and ambient advisory endpoints
- WebSocket live voice assistant route at `/live`

### Deployment

Docker setup:

- `docker-compose.yml`
- Backend service on port `8000`
- Frontend nginx service on port `8080`
- Named volume for backend demo user data

Important deployment files:

- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `deploy/nginx/mbsense.online.conf`

---

## 8. Important Honesty Point: Implemented vs Planned Stack

The `MASTER_PROMPT.md` describes a future architecture with:

- FastAPI
- LangChain
- PostgreSQL
- Redis
- SQLAlchemy
- Alembic

But the actual current repo implements:

- Node/Express backend
- TypeScript
- JSON-file demo state
- Gemini SDK directly

Do not tell judges that FastAPI/Postgres/LangChain are already implemented.

Correct answer:

> The master prompt describes our production roadmap. For the hackathon MVP, we implemented a Node/Express TypeScript backend because it let us integrate quickly with Gemini, WebSockets, the React frontend, and our demo data. In production, we would move persistence to Postgres, add Redis caching, and harden auth and observability.

---

## 9. AI System Explanation

The safest explanation:

> MB Sense is not just asking Gemini what to do. We first calculate battery risk using structured schedule and vehicle data. Then Gemini receives that structured context to produce a recommendation and explanation.

### AI pipeline

1. Frontend reads current app state:
   - Calendar events
   - Vehicle battery level
   - Weather
   - Charging target
   - Minimum battery threshold
   - Current app time

2. Frontend builds a charging plan input:
   - Done in `frontend/src/lib/chargingPlanner.ts`

3. Deterministic logic estimates:
   - Travel events
   - Route distance
   - Weather impact
   - Traffic impact
   - Battery use
   - Future battery after schedule
   - Available charging windows
   - AC charging time
   - DC charging time
   - Candidate public stations

4. Backend calls Gemini:
   - `/api/charging/plan`
   - `/api/charging/predict`

5. Gemini returns structured charging recommendation:
   - Risk level
   - Whether charging is needed
   - Best charging window
   - Target battery
   - Station recommendation
   - Reason
   - Confidence
   - Calendar action

6. Frontend normalizes result:
   - Avoid charging during calendar events
   - Move charging window if it overlaps with a busy block
   - Fall back safely if AI result is missing or invalid

7. User sees:
   - Recommendation
   - Reason
   - Confidence
   - Calendar action
   - Station/map option

---

## 10. Deterministic Battery Model Details

Important file:

- `frontend/src/constants/mercedesEqs450PlusTrainedData.ts`

Vehicle assumptions in repo:

- Vehicle: Mercedes-Benz EQS 450+ Sedan style mock data
- Battery capacity: 118 kWh
- Estimated range: 627.6 km
- Range per 1% battery: about 6.28 km
- Energy per 1% battery: about 1.18 kWh
- AC charging: about 9.33 minutes per 1% from 10% to 100%
- DC fast charging: about 0.44 minutes per 1% from 10% to 80%
- DC charging above 80% is intentionally not extrapolated the same way

How to explain:

> We are using a simplified but explainable battery model for the hackathon. The important part is not claiming lab-grade battery simulation. The important part is the architecture: schedule demand becomes an energy forecast, and the forecast becomes a charging decision.

---

## 11. Charging Logic Details

Important file:

- `frontend/src/lib/chargingAgents.ts`

The charging agent builds:

- Planning start date
- Upcoming events
- Driving events
- Trip forecasts
- Highest-demand trip
- Forecast battery use
- Projected battery without charging
- Minimum battery threshold
- Target charge
- AC charging duration
- DC charging duration
- Availability windows
- Best charging option
- Agent insights

Agent-style outputs:

- Schedule Agent
- Energy Agent
- Availability Agent
- Charging Agent
- Decision Agent
- Explanation Agent

Key behavior:

- Charging is recommended only when forecast falls below the minimum threshold, or when there is a low-disruption idle-day top-up opportunity.
- It does not recommend charging just because the battery is below the user's target.
- It prefers AC if there is enough parked time.
- It uses DC when schedule pressure makes AC impractical.
- It avoids charging during calendar events.

Good judge answer:

> We designed the system to minimize unnecessary charging. The target percentage is not a constant level to maintain. It only becomes the destination when charging is actually needed.

---

## 12. Calendar And Schedule Intelligence

Important files:

- `frontend/src/store/useAppStore.ts`
- `frontend/src/pages/Calendar.tsx`
- `frontend/src/lib/chatSchedule.ts`
- `frontend/src/lib/scheduleDistanceAgent.ts`

Calendar features:

- Seeded business calendar from June 15 to July 30, 2026
- Driving and non-driving events
- Vehicle-required status
- Risk events
- Charging recommendations
- AI calendar insertion
- Schedule creation through chatbot
- Schedule updates through chatbot
- Daily schedule queries

Why this matters:

> The calendar is not just a visual feature. It is the data source that lets MB Sense predict battery risk before the driver starts the trip.

---

## 13. Map And Charging Station Intelligence

Important files:

- `frontend/src/pages/Map.tsx`
- `frontend/src/constants/dcChargingStationsMalaysia.ts`
- `frontend/src/constants/realWorldRouteData.ts`
- `backend/server.ts`

Station sources:

- Seeded Malaysia DC charger list
- Open Charge Map endpoint when available
- Fallback station data when external data is unavailable

Route data:

- Known Malaysian locations
- Coordinate-based estimates
- Heuristic route distance estimates
- Some known route entries

How to explain:

> The map layer is designed to support live station and route data, but the hackathon prototype also includes fallback station and route context so the demo remains stable.

---

## 14. Chatbot And Voice Assistant

Important files:

- `frontend/src/components/Chatbot.tsx`
- `frontend/src/components/VoiceAssistant.tsx`
- `backend/server.ts`

Chatbot can:

- Answer MB Sense mobility questions
- Handle schedule creation
- Ask for missing schedule fields
- Add schedule to calendar
- Update existing schedule
- Delete schedule
- Answer daily schedule queries
- Use speech recognition for voice input
- Use browser speech synthesis for voice answers

Voice assistant:

- Uses browser microphone
- Streams audio through WebSocket `/live`
- Backend connects to Gemini Live API
- Returns audio messages to the frontend

Good judge answer:

> The assistant is not just a generic chat bubble. It is tied to schedule actions, calendar state, charging prediction, and voice interaction.

---

## 15. Business Q&A

### 1. What customer problem are you solving?

EV drivers often know their current battery percentage, but not whether that percentage is enough for tomorrow's actual schedule. MB Sense predicts hidden battery risk before it becomes a low-battery emergency.

### 2. Why is this better than a low-battery alert?

A low-battery alert reacts when the driver is already at risk. MB Sense looks ahead and recommends charging earlier, when the driver still has convenient options.

### 3. Who is the target user?

Premium EV drivers, executive commuters, corporate fleet users, and Mercedes-Benz connected-service customers who value reliability, convenience, and trust.

### 4. Why would Mercedes-Benz care?

Mercedes-Benz is about premium mobility, not just transportation. MB Sense makes the car feel proactive, calm, intelligent, and personally helpful.

### 5. What makes this different from Google Maps or a charger finder?

Maps can help find a charger after the user decides to charge. MB Sense predicts whether charging is needed and when it should happen based on future schedule risk.

### 6. What is the business model?

Possible models:

- Connected-service feature inside a Mercedes-Benz app
- Premium subscription feature
- Fleet operations module
- Charging network partnership feature
- Dealer/service-center customer retention feature

### 7. What is the measurable value?

Possible KPIs:

- Fewer low-battery events
- Fewer emergency DC fast-charging stops
- Higher charging recommendation acceptance rate
- Higher trip-readiness confidence
- Lower missed-trip risk
- Better customer satisfaction
- Improved connected-service engagement

### 8. Why not just tell users to charge every night?

Because that is not intelligent or personalized. MB Sense recommends charging only when future schedule risk or low-disruption opportunity justifies it. It avoids unnecessary charging and respects battery-care targets.

### 9. What is the premium experience?

The driver does not need to think like an energy manager. The car quietly understands the schedule and gives a calm, clear recommendation before the problem happens.

### 10. Is this only useful for long trips?

No. The daily use case is even stronger: multiple normal trips, meetings, airport runs, traffic, and limited free time can create hidden risk even without one long road trip.

### 11. Why will users trust it?

Because MB Sense shows:

- Forecast
- Reason
- Minimum threshold
- Target charge
- Confidence
- Charging time
- Calendar action

It does not just say "trust me."

### 12. What is your strongest demo moment?

The 52% battery scenario:

> 52% looks safe now, but MB Sense sees tomorrow's schedule and recommends charging before risk appears.

### 13. What is the commercial risk?

Trust and accuracy. If the app recommends too often or gives unclear reasoning, users will ignore it. That is why the app focuses on explainable recommendations and driver confirmation.

### 14. How could this expand?

Expansion paths:

- Real vehicle telemetry
- Fleet dashboard
- Charging price optimization
- Home solar and smart charging
- Charging reservation integration
- Maintenance and battery health prediction
- MB.OS integration
- Dealer service insights

### 15. What would you build next?

First next steps:

- Real SOC and vehicle telemetry
- Production auth and secure storage
- Verified traffic and route APIs
- Live charger availability
- Prediction accuracy evaluation
- Automated tests for planner logic

---

## 16. Technical Q&A

### 1. What exactly is the AI doing?

The deterministic layer calculates schedule demand, battery projection, charging windows, and AC/DC candidates. Gemini then reasons over structured context to select or explain the recommendation.

### 2. Is this just a chatbot?

No. The core product is a predictive charging planner. The chatbot is one interface into the system, but the main logic is schedule and energy planning.

### 3. Why use deterministic calculations before Gemini?

Battery and safety-related numbers should be reproducible. Gemini is better used for explanation, ranking, and user-facing reasoning after structured calculations are prepared.

### 4. How do you estimate trip energy?

The system estimates distance, converts that distance into battery percent using the EQS range-per-percent assumption, then adjusts for traffic and weather.

### 5. What data is mocked?

Mocked or seeded:

- Vehicle telemetry
- Battery state
- Calendar dataset
- Some route estimates
- Some charger stations
- Weather snapshot
- Demo user profile

Live or integration-ready:

- Gemini API
- Open Charge Map station lookup
- Google Maps / Places hooks
- WebSocket voice path

### 6. What happens if Gemini fails?

The app has fallback behavior:

- Backend fallback response
- Frontend fallback charging plan
- Safe N/A plan
- Local deterministic logic
- Demo remains usable

### 7. How do you prevent hallucination?

Current safeguards:

- Structured inputs
- Strict expected output shape
- Field validation in backend
- Station recommendations matched to candidate stations
- Frontend schedule conflict normalization
- Fallback if AI response is unusable

### 8. How do you avoid charging during calendar events?

The planner builds busy blocks from calendar events. If a recommended charging window overlaps with a busy block, it searches for the next non-overlapping charging window.

### 9. How does AC vs DC selection work?

AC is preferred when the car has enough parked time. DC is used when AC cannot fit the schedule or a public fast charger is more practical near the route or latest location.

### 10. Is this connected to a real Mercedes-Benz vehicle?

Not yet. The current prototype simulates vehicle state and uses Mercedes EQS-style assumptions. Production would connect to official telemetry for live battery, location, charging, and health data.

### 11. What is your actual backend stack?

Actual MVP stack:

- Node.js
- Express
- TypeScript
- Gemini SDK
- WebSocket
- JSON-file demo persistence

Production roadmap:

- Secure auth
- PostgreSQL
- Redis
- Stronger API separation
- Observability
- Real vehicle and map integrations

### 12. What are the main API endpoints?

Important backend endpoints in `backend/server.ts`:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `PUT /api/user-state`
- `GET /api/health`
- `GET /api/public-config`
- `GET /api/routing/driving`
- `GET /api/charging/openchargemap`
- `POST /api/chat`
- `POST /api/charging/predict`
- `POST /api/charging/plan`
- `POST /api/analyze-schedule`
- `POST /api/optimize-route`
- `POST /api/weather-advisory`
- `POST /api/trip-efficiency`
- `POST /api/ev-charging-stations`
- `POST /api/ai-route-planner`
- `POST /api/destination-parking-predictions`
- `WebSocket /live`

### 13. How scalable is the design?

The current design separates frontend state, deterministic planning logic, backend AI endpoints, station lookup, and deployment containers. To scale, replace JSON state with Postgres, add Redis caching, and run backend instances statelessly.

### 14. What about security?

The MVP is not production-grade security. Demo state is file-backed. Production needs:

- OAuth or secure identity provider
- Hashed passwords if passwords exist
- Encrypted tokens
- Secret management
- User consent for calendar and vehicle data
- Audit logs
- Rate limits

### 15. What tests exist?

No dedicated automated test suite was visible during repo review.

Best answer:

> For the hackathon, we focused on an end-to-end working prototype. The next engineering step is automated testing for time parsing, schedule overlap, energy forecast, AC/DC decision logic, backend validation, and fallback behavior.

### 16. What is the most impressive technical feature?

The recommendation is not a single prompt. It combines:

- Calendar context
- Battery policy
- Trip forecasting
- AC/DC charge curves
- Availability windows
- Station candidates
- Gemini reasoning
- Fallback logic
- Calendar insertion

### 17. How would you evaluate prediction accuracy?

Production evaluation:

1. Predict battery after each planned trip.
2. Collect actual vehicle SOC after the trip.
3. Compare predicted vs actual SOC.
4. Track mean absolute error.
5. Recalibrate route, weather, and driving-style multipliers.

### 18. What is the biggest technical limitation?

The biggest limitation is input quality. Real vehicle telemetry, verified routes, traffic, weather, and charger availability are needed before production deployment.

---

## 17. Hard Questions And Safe Answers

### "Is your battery prediction scientifically validated?"

Not yet as a certified battery model. For the hackathon, we use realistic EQS assumptions and explainable heuristics. The next step is calibration against real telemetry.

### "Can the AI make an unsafe recommendation?"

That is why the AI does not own the raw battery calculation. We calculate structured values first, validate outputs, and fall back when needed. Production would add stronger guardrails and policy checks.

### "Why does your master prompt mention FastAPI and Postgres, but the code uses Express?"

The master prompt describes the target production architecture. The MVP uses Express/TypeScript for speed during the hackathon. We can clearly separate what is implemented now from what we would productionize next.

### "Do you store passwords securely?"

The current file-backed demo auth is not production auth. In production, we would use OAuth/JWT, hashed credentials, encrypted tokens, and proper secret management.

### "What if the user's calendar is wrong?"

The recommendation should show assumptions and allow correction. Production could learn frequent routes and ask the driver when schedule context is incomplete.

### "What if the charger is occupied?"

The MVP supports station candidates and fallback station lists. Production should integrate with live charger networks, availability data, reservations where supported, and ranked backup stations.

### "Why should drivers trust this?"

Because MB Sense explains the reason, shows the forecast, gives a confidence score, and lets the driver confirm the action instead of silently changing plans.

### "Is this only a nice UI?"

No. The UI is backed by planning logic, schedule parsing, energy forecasts, charging curves, station candidates, Gemini endpoints, and fallback behavior.

---

## 18. Known Limitations To Admit

Do not hide these if asked:

- Real Mercedes-Benz vehicle telemetry is not integrated yet.
- Battery prediction is simplified and heuristic-based.
- Calendar and vehicle data are seeded for demo.
- Some map and station data uses fallbacks.
- Live charger availability is not guaranteed.
- Demo auth is not production-grade.
- No dedicated automated test suite was visible.
- FastAPI/Postgres/LangChain are roadmap items, not current implementation.

Strong way to say it:

> This is a hackathon MVP, so we focused on proving the core intelligence loop. The production version needs real telemetry, secure data handling, verified routing, live charging network integration, and measured prediction accuracy.

---

## 19. Four-Minute Pitch Script Outline

### 0:00-0:30 - Hook

"Imagine arriving home with 52% battery. A normal EV app says you are fine. But tomorrow you have multiple trips, heavy traffic, and no good charging window. That 52% is actually a hidden risk."

### 0:30-1:00 - Problem

"EV tools today are reactive. They show battery now, or chargers nearby, but they do not understand the driver's future schedule."

### 1:00-1:35 - Solution

"MB Sense predicts future battery risk using schedule, vehicle battery, route demand, weather, traffic, and charging options. Then it recommends when and where to charge before the driver has a problem."

### 1:35-2:45 - Demo

Show:

- Home recommendation
- Why-now explanation
- Target battery
- Minimum threshold
- Predicted battery after schedule
- Calendar charging insertion
- AI settings AC/DC comparison
- Map/station if available

### 2:45-3:25 - Technical Proof

"The key design is deterministic model first, AI explanation second. We calculate schedule demand and charging options, then Gemini reasons over structured data. That keeps the recommendation explainable and safer."

### 3:25-4:00 - Close

"MB Sense helps the car become a proactive mobility partner. It does not wait until battery is low. It predicts the risk and prevents it."

---

## 20. Final Cheat Sheet

### If Asked "What is MB Sense?"

MB Sense is a predictive EV charging assistant that tells drivers when to charge based on future schedule risk, not just current battery percentage.

### If Asked "What is the AI part?"

The AI reasons over structured battery, schedule, route, weather, and charging data to explain and select a charging recommendation. Deterministic logic handles the core forecast first.

### If Asked "Why is it innovative?"

Because it shifts EV charging from reactive charger search to proactive schedule-aware battery risk prevention.

### If Asked "Why Mercedes-Benz?"

Because premium mobility should feel calm, intelligent, and anticipatory. MB Sense reduces driver cognitive load and increases trust.

### If Asked "What is implemented?"

A React/Vite/TypeScript mobile PWA, Node/Express backend, Gemini integration, charging planner, calendar intelligence, station lookup, fallback logic, Docker setup, chatbot, and voice assistant path.

### If Asked "What is not implemented yet?"

Real vehicle telemetry, production database/auth, verified live traffic, guaranteed live charger availability, full automated tests, and production-grade battery validation.

### If Asked "What should we remember?"

> Battery percentage is not enough. MB Sense understands tomorrow.

---

## 21. Files To Know Before Q&A

| File | Why it matters |
| --- | --- |
| `frontend/src/App.tsx` | Auto-syncs charging planner with app state. |
| `frontend/src/pages/Home.tsx` | Main charging recommendation and forecast surface. |
| `frontend/src/pages/AI.tsx` | Charging policy, target/minimum battery, AC/DC decision UI. |
| `frontend/src/pages/Calendar.tsx` | Schedule surface and calendar interaction. |
| `frontend/src/pages/Map.tsx` | Route, station, and map experience. |
| `frontend/src/lib/chargingAgents.ts` | Deterministic schedule, energy, charging, and agent logic. |
| `frontend/src/lib/chargingPlanner.ts` | Builds backend input, calls AI planner, normalizes results. |
| `frontend/src/lib/chatSchedule.ts` | Parses natural language schedule creation and updates. |
| `frontend/src/constants/mercedesEqs450PlusTrainedData.ts` | Battery and charging assumptions. |
| `frontend/src/constants/realWorldRouteData.ts` | Known locations and route estimation. |
| `frontend/src/constants/dcChargingStationsMalaysia.ts` | Malaysia DC charging fallback station data. |
| `backend/server.ts` | Express backend, Gemini endpoints, Open Charge Map, WebSocket live API. |
| `docker-compose.yml` | Containerized frontend/backend setup. |
| `Pitching/index.html` | Video queue for pitch-day backup demo. |

---

## 22. Rehearsal Checklist

Before pitch:

- [ ] Open the app and confirm Home loads.
- [ ] Confirm battery is around the demo value, ideally 52%.
- [ ] Confirm AI recommendation can be generated or fallback is acceptable.
- [ ] Confirm Calendar has enough driving events to tell the story.
- [ ] Confirm AI page shows target and minimum battery controls.
- [ ] Confirm Map route/station view is ready if needed.
- [ ] Open `Pitching/index.html` as video backup.
- [ ] Prepare one business answer about value.
- [ ] Prepare one technical answer about deterministic model plus Gemini.
- [ ] Prepare one honest answer about current limitations.

Final line to memorize:

> MB Sense is about preventing battery anxiety before it becomes a driving problem.
