import { useEffect, useMemo, useRef, useState } from 'react';
import { Home, Calendar, Map as MapIcon, Car, Settings, BatteryCharging } from 'lucide-react';
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

function getBatteryTone(level: number) {
  if (level <= 20) return { text: 'text-rose-500', fill: 'bg-rose-500' };
  if (level <= 50) return { text: 'text-amber-500', fill: 'bg-amber-400' };
  return { text: 'text-emerald-500', fill: 'bg-emerald-400' };
}

export default function TopBar() {
  const { user, isAuthenticated, vehicle, setBatteryLevel } = useAppStore();
  const [batteryOpen, setBatteryOpen] = useState(false);
  const batteryRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isCalendar = path === '/calendar';
  const calendarMonths = useMemo(() => getAvailableCalendarWeeks(), []);
  const { weekStart, setActiveWeek } = useCalendarViewStore();
  const batteryTone = getBatteryTone(vehicle.batteryLevel);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!batteryRef.current?.contains(event.target as Node)) setBatteryOpen(false);
    };

    if (batteryOpen) document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [batteryOpen]);

  const tabs = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Vehicle', path: '/vehicle', icon: Car },
    { name: 'Setting', path: '/ai', icon: Settings }
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
        <div ref={batteryRef} className="relative">
          <button
            type="button"
            onClick={() => setBatteryOpen((open) => !open)}
            className="glass-brand-button inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-black uppercase tracking-widest text-on-surface transition active:scale-[0.98]"
            aria-expanded={batteryOpen}
            aria-label="Adjust battery percentage"
          >
            <BatteryCharging className={cn('h-4 w-4', batteryTone.text)} />
            <span>{vehicle.batteryLevel}%</span>
            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-high sm:block">
              <span className={cn('block h-full rounded-full transition-all', batteryTone.fill)} style={{ width: `${vehicle.batteryLevel}%` }} />
            </span>
          </button>

          {batteryOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute left-0 top-12 w-64 rounded-2xl border border-outline-variant/45 bg-surface-container-lowest/95 p-4 shadow-ambient-lg backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Battery</p>
                  <p className="mt-1 text-2xl font-black text-on-surface">{vehicle.batteryLevel}%</p>
                </div>
                <BatteryCharging className={cn('h-6 w-6', batteryTone.text)} />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={vehicle.batteryLevel}
                onChange={(event) => setBatteryLevel(Number(event.target.value))}
                className="mt-4 h-2 w-full accent-primary"
                aria-label="Battery percentage"
              />
              <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </motion.div>
          )}
        </div>
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
              aria-label="Select month"
            >
              {calendarMonths.map((month) => (
                <option key={month.toISOString()} value={toCalendarDateInputValue(month)}>{getCalendarWeekRangeLabel(month)}</option>
              ))}
            </select>
          </div>
        )}
        <GlassButton onClick={() => navigate(isAuthenticated ? '/profile' : '/signin')} wrapClassName="text-[13px]" className="glass-avatar-button" aria-label="Open profile">
          {initials}
        </GlassButton>
      </div>
    </header>
  );
}

