import { useMemo } from 'react';
import { MapPin, Home, Calendar, Map as MapIcon, Car, BrainCircuit, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import GlassButton from './GlassButton';
import {
  fromCalendarDateInputValue,
  getAvailableCalendarWeeks,
  getCalendarWeekRangeLabel,
  toCalendarDateInputValue,
  useCalendarViewStore,
} from '../store/useCalendarViewStore';

export default function TopBar() {
  const { user, isAuthenticated } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isCalendar = path === '/calendar';
  const calendarWeeks = useMemo(() => getAvailableCalendarWeeks(), []);
  const { weekStart, setActiveWeek, goToPreviousWeek, goToNextWeek, goToTodayWeek } = useCalendarViewStore();

  const tabs = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Vehicle', path: '/vehicle', icon: Car },
    { name: 'AI', path: '/ai', icon: BrainCircuit }
  ];

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between px-3 sm:px-5 lg:px-8">
      <div className="pointer-events-auto flex flex-1 items-center justify-start gap-3">
        <GlassButton onClick={() => navigate('/')} wrapClassName="text-[13px]" className="glass-brand-button">
          <MapPin className="h-4 w-4" />
          MB Sense
        </GlassButton>

      </div>

      <nav className="pointer-events-auto absolute left-1/2 top-3 hidden -translate-x-1/2 sm:block" aria-label="Primary navigation">
        <div className="glass-selection-pane">
          {tabs.map((tab) => {
            const isActive = path === tab.path;
            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn('glass-selection-item', isActive && 'is-active')}
              >
                {isActive && <motion.span layoutId="topbar-glass-selection" className="glass-selection-active" transition={{ type: 'spring', stiffness: 320, damping: 32 }} />}
                <tab.icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="pointer-events-auto flex flex-1 items-center justify-end gap-2">
        {isCalendar && (
          <div className="hidden items-center gap-1.5 lg:flex">
            <select
              value={toCalendarDateInputValue(weekStart)}
              onChange={(event) => setActiveWeek(fromCalendarDateInputValue(event.target.value))}
              className="h-9 rounded-lg border border-outline-variant/45 bg-surface-container-lowest/88 px-2.5 text-xs font-semibold text-on-surface shadow-ambient outline-none backdrop-blur-xl transition focus:border-primary/45"
              aria-label="Select week"
            >
              {calendarWeeks.map((week) => (
                <option key={week.toISOString()} value={toCalendarDateInputValue(week)}>Week {getCalendarWeekRangeLabel(week)}</option>
              ))}
            </select>
            <button onClick={goToTodayWeek} className="h-9 rounded-lg border border-outline-variant/45 bg-surface-container-lowest/88 px-3 text-xs font-semibold text-on-surface transition hover:bg-surface-container">Today</button>
            <div className="flex overflow-hidden rounded-lg border border-outline-variant/45 bg-surface-container-lowest/88 shadow-ambient backdrop-blur-xl">
              <button onClick={goToPreviousWeek} className="flex h-9 w-9 items-center justify-center text-on-surface-variant transition hover:bg-surface-container" aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={goToNextWeek} className="flex h-9 w-9 items-center justify-center border-l border-outline-variant/45 text-on-surface-variant transition hover:bg-surface-container" aria-label="Next week"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
        <GlassButton onClick={() => navigate(isAuthenticated ? '/profile' : '/signin')} wrapClassName="text-[13px]" className="glass-avatar-button" aria-label="Open profile">
          {initials}
        </GlassButton>
      </div>
    </header>
  );
}
