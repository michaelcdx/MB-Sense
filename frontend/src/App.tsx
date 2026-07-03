import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import MapView from './pages/Map';
import Vehicle from './pages/Vehicle';
import AI from './pages/AI';
import Profile from './pages/Profile';
import SignIn from './pages/SignIn';
import CreateAccount from './pages/CreateAccount';
import { cn } from './lib/utils';

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
      <AppShell />
    </BrowserRouter>
  );
}