import { useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import MapView from './pages/Map';
import Vehicle from './pages/Vehicle';
import AI from './pages/AI';
import Simulation from './pages/Simulation';
import Profile from './pages/Profile';
import SignIn from './pages/SignIn';
import CreateAccount from './pages/CreateAccount';
import { cn } from './lib/utils';
import { buildChargingPlan, buildGeminiChargingPredictionPayload, buildManagedChargingCalendarEvent, managedChargingEventId, type GeminiChargingDecision } from './lib/chargingAgents';
import { useAppStore, type CalendarEvent } from './store/useAppStore';

function calendarEventChanged(current: CalendarEvent | null, next: CalendarEvent | null) {
  if (!current || !next) return true;
  const currentDate = current.date instanceof Date ? current.date : new Date(current.date);
  const nextDate = next.date instanceof Date ? next.date : new Date(next.date);

  return current.title !== next.title
    || current.location !== next.location
    || current.time !== next.time
    || current.endTime !== next.endTime
    || currentDate.getTime() !== nextDate.getTime()
    || current.aiReason !== next.aiReason
    || current.notes !== next.notes
    || JSON.stringify(current.chargingMeta) !== JSON.stringify(next.chargingMeta);
}

function getAutoPlanningAnchor() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

function isAutoManagedChargingEvent(event: CalendarEvent) {
  return event.id === managedChargingEventId || event.status === 'AI MANAGED CHARGING';
}

function buildScheduleSignature(events: CalendarEvent[]) {
  return JSON.stringify(events.map((event) => {
    const date = event.date instanceof Date ? event.date : new Date(event.date);
    return {
      id: event.id,
      title: event.title,
      location: event.location,
      time: event.time,
      endTime: event.endTime,
      departureTime: event.departureTime,
      date: date.toISOString(),
      carNeeded: event.carNeeded,
      category: event.category,
      status: event.status
    };
  }));
}

function ChargingPredictionSync() {
  const events = useAppStore((state) => state.events);
  const vehicle = useAppStore((state) => state.vehicle);
  const weather = useAppStore((state) => state.weather);
  const planningEvents = useMemo(() => events.filter((event) => !isAutoManagedChargingEvent(event)), [events]);
  const scheduleSignature = useMemo(() => buildScheduleSignature(planningEvents), [planningEvents]);
  const planningAnchor = useMemo(getAutoPlanningAnchor, [scheduleSignature, vehicle.batteryLevel, weather.temp, weather.condition]);
  const candidatePlan = useMemo(() => buildChargingPlan(planningEvents, vehicle, weather, 80, planningAnchor, 'auto'), [scheduleSignature, vehicle, weather, planningAnchor]);
  const geminiPayload = useMemo(() => buildGeminiChargingPredictionPayload(candidatePlan, 'auto'), [candidatePlan]);
  const geminiPayloadSignature = useMemo(() => JSON.stringify(geminiPayload), [geminiPayload]);
  const lastSubmittedSignatureRef = useRef('');

  useEffect(() => {
    const hasChargingCandidate = Boolean(geminiPayload.options.ac.canComplete || geminiPayload.options.dc.canComplete);
    if (!hasChargingCandidate || geminiPayloadSignature === lastSubmittedSignatureRef.current) return;

    lastSubmittedSignatureRef.current = geminiPayloadSignature;
    let cancelled = false;
    const controller = new AbortController();

    const applyChargingEvent = (decision?: GeminiChargingDecision) => {
      const latest = useAppStore.getState();
      const finalPlan = buildChargingPlan(latest.events, latest.vehicle, latest.weather, 80, planningAnchor, 'auto', decision);
      const nextEvent = buildManagedChargingCalendarEvent(finalPlan);
      if (!nextEvent) return;

      const currentEvent = latest.events.find((event) => event.id === managedChargingEventId) ?? null;
      if (!currentEvent) {
        latest.addEvent(nextEvent);
        return;
      }

      if (calendarEventChanged(currentEvent, nextEvent)) {
        latest.updateEvent({ ...currentEvent, ...nextEvent });
      }
    };

    const timer = window.setTimeout(() => {
      fetch('/api/charging/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiPayloadSignature,
        signal: controller.signal
      })
        .then((response) => response.json())
        .then((decision: GeminiChargingDecision) => {
          if (cancelled) return;
          if (decision?.mode === 'AC' || decision?.mode === 'DC') applyChargingEvent(decision);
          else applyChargingEvent();
        })
        .catch(() => {
          if (!cancelled) applyChargingEvent();
        });
    }, 500);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [geminiPayload.options.ac.canComplete, geminiPayload.options.dc.canComplete, geminiPayloadSignature, planningAnchor]);

  return null;
}
function AppShell() {
  const location = useLocation();
  const isMap = location.pathname === '/map';
  const isCalendar = location.pathname === '/calendar';
  const isAuth = location.pathname === '/signin' || location.pathname === '/register';

  return (
    <div className="min-h-dvh bg-surface text-on-surface font-sans selection:bg-primary-fixed/35 overflow-x-hidden">
      <div className="relative min-h-dvh w-full bg-surface pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-8">
        <TopBar />
        <main
          className={cn(
            'w-full overflow-x-hidden',
            isMap && 'fixed inset-0 px-0 pb-0 pt-0',
            isCalendar && 'fixed inset-x-0 bottom-0 top-16 overflow-hidden px-0 pb-0 pt-0',
            !isMap && !isCalendar && 'mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8',
            isAuth && 'flex min-h-dvh items-center justify-center pt-16 sm:pt-16'
          )}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/vehicle" element={<Vehicle />} />
            <Route path="/ai" element={<AI />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/register" element={<CreateAccount />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ChargingPredictionSync />
      <AppShell />
    </BrowserRouter>
  );
}
