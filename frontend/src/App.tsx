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
import { buildChargingPlanInput, requestChargingPlan } from './lib/chargingPlanner';
import { useAppStore, type CalendarEvent } from './store/useAppStore';

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

function ChargingPlannerSync() {
  const events = useAppStore((state) => state.events);
  const vehicle = useAppStore((state) => state.vehicle);
  const weather = useAppStore((state) => state.weather);
  const setAiChargingPlan = useAppStore((state) => state.setAiChargingPlan);
  const setAiChargingPlanStatus = useAppStore((state) => state.setAiChargingPlanStatus);
  const planningEvents = useMemo(() => events.filter((event) => !event.aiChargingPlan && !event.isAiRecommendationPreview), [events]);
  const scheduleSignature = useMemo(() => buildScheduleSignature(planningEvents), [planningEvents]);
  const plannerInput = useMemo(() => buildChargingPlanInput(planningEvents, vehicle, weather), [scheduleSignature, vehicle, weather]);
  const plannerInputSignature = useMemo(() => JSON.stringify(plannerInput), [plannerInput]);
  const lastSubmittedSignatureRef = useRef('');

  useEffect(() => {
    if (plannerInputSignature === lastSubmittedSignatureRef.current) return;

    lastSubmittedSignatureRef.current = plannerInputSignature;
    let cancelled = false;
    setAiChargingPlanStatus('loading');

    const timer = window.setTimeout(() => {
      requestChargingPlan(plannerInput)
        .then((plan) => {
          if (!cancelled) setAiChargingPlan(plan, plan.id.includes('fallback') ? 'fallback' : 'ready');
        })
        .catch(() => {
          if (!cancelled) setAiChargingPlan(null, 'error');
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [plannerInput, plannerInputSignature, setAiChargingPlan, setAiChargingPlanStatus]);

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
      <ChargingPlannerSync />
      <AppShell />
    </BrowserRouter>
  );
}
