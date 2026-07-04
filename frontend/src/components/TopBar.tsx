import { useEffect, useMemo, useRef, useState } from 'react';
import { Home, Calendar, Map as MapIcon, Car, BrainCircuit, BatteryCharging, Bell, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
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

function isMeaningful(value: unknown) {
  return typeof value === 'string' && value.trim() && value.trim().toUpperCase() !== 'N/A';
}

function displayText(value: unknown, fallback = 'N/A') {
  return isMeaningful(value) ? String(value).trim() : fallback;
}

function parsePlanDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeDate(date: Date | null, fallback?: string | null) {
  if (!date) return displayText(fallback, '');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'today';
  if (sameDay(date, tomorrow)) return 'tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatNotificationTime(date: Date | null, fallback?: string | null) {
  if (date) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return displayText(fallback, 'soon');
}

export default function TopBar() {
  const { user, isAuthenticated, vehicle, aiChargingPlan, aiChargingPlanStatus, setBatteryLevel } = useAppStore();
  const [batteryOpen, setBatteryOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const batteryRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false);
    };

    if (notificationOpen) document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [notificationOpen]);

  const aiNotification = useMemo(() => {
    const plan = aiChargingPlan;
    const station = displayText(plan?.stationRecommendations?.[0]?.name ?? plan?.chargingLocationName ?? plan?.calendarAction.location ?? plan?.backupPlan.locationName, 'AI Charging');
    const start = parsePlanDateTime(plan?.recommendedChargingStart ?? null);
    const dateLabel = formatRelativeDate(start, plan?.calendarAction.date);
    const timeLabel = formatNotificationTime(start, plan?.calendarAction.startTime);

    if (aiChargingPlanStatus === 'loading') {
      return {
        tone: 'loading' as const,
        title: 'AI recommendation updating',
        summary: 'Gemini is checking the latest charging plan.',
        detail: 'This should clear automatically; local fallback will be used if the planner is slow.'
      };
    }

    if (aiChargingPlanStatus === 'error') {
      return {
        tone: 'error' as const,
        title: 'Gemini recommendation failed',
        summary: 'AI charging result unavailable.',
        detail: 'Try updating again, or use the local battery forecast meanwhile.'
      };
    }

    if (aiChargingPlanStatus === 'fallback' || plan?.id === 'ai-charge-na') {
      return {
        tone: 'warning' as const,
        title: 'Gemini fallback active',
        summary: 'Gemini did not complete. Local fallback is showing.',
        detail: 'The recommendation may be less specific until Gemini responds again.'
      };
    }

    if (plan?.shouldCharge) {
      return {
        tone: 'action' as const,
        title: 'Charge recommended',
        summary: `Charge ${dateLabel || 'soon'} at ${timeLabel} at ${station}.`,
        detail: displayText(plan.reason, 'AI recommends charging before the battery reaches the minimum threshold.')
      };
    }

    if (plan) {
      return {
        tone: 'ready' as const,
        title: 'Battery ready',
        summary: `No charge needed. Forecast ends near ${plan.predictedBatteryAfterSchedule}%.`,
        detail: displayText(plan.reason, 'Battery remains above the minimum threshold.')
      };
    }

    return {
      tone: 'idle' as const,
      title: 'No AI result yet',
      summary: 'Update AI Recommendation to create a charging forecast.',
      detail: 'Charging notifications will appear here after the first result.'
    };
  }, [aiChargingPlan, aiChargingPlanStatus]);

  const notificationTone = {
    loading: 'border-primary/30 bg-primary/10 text-primary',
    error: 'border-rose-400/35 bg-rose-500/10 text-rose-300',
    warning: 'border-amber-400/35 bg-amber-500/10 text-amber-300',
    action: 'border-amber-400/35 bg-amber-500/10 text-amber-300',
    ready: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
    idle: 'border-outline-variant/45 bg-surface-container-lowest text-slate-300'
  }[aiNotification.tone];

  const notificationIcon = aiNotification.tone === 'loading'
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : aiNotification.tone === 'error' || aiNotification.tone === 'warning' || aiNotification.tone === 'action'
      ? <AlertTriangle className="h-4 w-4" />
      : aiNotification.tone === 'ready'
        ? <CheckCircle2 className="h-4 w-4" />
        : <Bell className="h-4 w-4" />;

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
        <div ref={notificationRef} className="relative">
          <button
            type="button"
            onClick={() => setNotificationOpen((open) => !open)}
            className={cn('relative inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-ambient backdrop-blur-xl transition active:scale-[0.98]', notificationTone)}
            aria-expanded={notificationOpen}
            aria-label="Open AI notifications"
          >
            {notificationIcon}
            {(aiChargingPlanStatus === 'loading' || aiChargingPlanStatus === 'fallback' || aiChargingPlanStatus === 'error' || aiChargingPlan?.shouldCharge) && (
              <span className={cn(
                'absolute right-2 top-2 h-2 w-2 rounded-full ring-2 ring-surface-container-lowest',
                aiChargingPlanStatus === 'error'
                  ? 'bg-rose-400'
                  : aiChargingPlanStatus === 'fallback' || aiChargingPlan?.shouldCharge
                    ? 'bg-amber-400'
                    : 'bg-primary'
              )} />
            )}
          </button>

          {notificationOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute right-0 top-12 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-outline-variant/45 bg-surface-container-lowest/95 p-4 shadow-ambient-lg backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', notificationTone)}>
                  {notificationIcon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">AI Notification</p>
                  <h3 className="mt-1 text-sm font-black leading-snug text-on-surface">{aiNotification.title}</h3>
                  <p className="mt-2 text-sm font-extrabold leading-snug text-slate-100">{aiNotification.summary}</p>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{aiNotification.detail}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
        <GlassButton onClick={() => navigate(isAuthenticated ? '/profile' : '/signin')} wrapClassName="text-[13px]" className="glass-avatar-button" aria-label="Open profile">
          {initials}
        </GlassButton>
      </div>
    </header>
  );
}
