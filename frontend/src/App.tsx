import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import MapView from './pages/Map';
import Vehicle from './pages/Vehicle';
import Profile from './pages/Profile';
import VoiceAssistant from './components/VoiceAssistant';
import Chatbot from './components/Chatbot';
import { cn } from './lib/utils';

function AppShell() {
  const location = useLocation();
  const isMap = location.pathname === '/map';

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 font-sans selection:bg-white/30 overflow-x-hidden">
      <div className="relative min-h-dvh w-full bg-slate-950 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <TopBar />
        <main className={cn(
          "w-full overflow-x-hidden",
          isMap ? "fixed inset-0 pt-0 px-0 pb-0" : "mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8"
        )}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/vehicle" element={<Vehicle />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
        <VoiceAssistant />
        <Chatbot />
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
