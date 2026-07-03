import { motion } from 'motion/react';
import { CalendarEvent, useAppStore } from '../store/useAppStore';
import { AlertTriangle, BatteryCharging, BrainCircuit, Car, Save, Trash2, Video, X, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import GlassButton from '../components/GlassButton';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useCalendarViewStore } from '../store/useCalendarViewStore';

type EventMode = 'create' | 'edit';
type EventColor = 'graphite' | 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cream' | 'general' | 'study' | 'assignment' | 'urgent' | 'charging' | 'risk';
type EventTextColor = 'dark' | 'light' | 'light3' | 'light4' | 'cream5' | 'rose6' | 'green7' | 'amber8';

const eventColorOptions: { value: EventColor; label: string; backgroundColor: string; textColor: string }[] = [
  { value: 'general', label: 'Work / Meeting', backgroundColor: '#243B53', textColor: '#F8FAFC' },
  { value: 'study', label: 'Class / Study', backgroundColor: '#3B2F63', textColor: '#F8FAFC' },
  { value: 'assignment', label: 'Assignment / Deadline', backgroundColor: '#6B2E2E', textColor: '#FFF7ED' },
  { value: 'urgent', label: 'Important / Urgent', backgroundColor: '#7A1F2B', textColor: '#FFF1F2' },
  { value: 'charging', label: 'AI Charging Recommendation', backgroundColor: '#14532D', textColor: '#ECFDF5' },
  { value: 'risk', label: 'Battery Risk Warning', backgroundColor: '#7C4A03', textColor: '#FFFBEB' },
  { value: 'graphite', label: 'Graphite', backgroundColor: '#0b0f10', textColor: '#f5f7f9' },
  { value: 'blue', label: 'Blue', backgroundColor: '#172554', textColor: '#f5f7f9' },
  { value: 'green', label: 'Green', backgroundColor: '#064e3b', textColor: '#f5f7f9' },
  { value: 'amber', label: 'Amber', backgroundColor: '#78350f', textColor: '#f5f7f9' },
  { value: 'rose', label: 'Rose', backgroundColor: '#881337', textColor: '#f5f7f9' },
  { value: 'violet', label: 'Violet', backgroundColor: '#4c1d95', textColor: '#f5f7f9' },
  { value: 'cream', label: 'Cream', backgroundColor: '#FFF7ED', textColor: '#2c2f31' }
];

const eventColorStyles: Record<EventColor, { backgroundColor: string }> = eventColorOptions.reduce((styles, option) => ({
  ...styles,
  [option.value]: { backgroundColor: option.backgroundColor }
}), {} as Record<EventColor, { backgroundColor: string }>);

const eventTextColorOptions: { value: EventTextColor; label: string; color: string }[] = [
  { value: 'dark', label: 'Text 1', color: '#1E3A5F' },
  { value: 'light', label: 'Text 2', color: '#F8FAFC' },
  { value: 'light3', label: 'Text 3', color: '#F8FAFC' },
  { value: 'light4', label: 'Text 4', color: '#F8FAFC' },
  { value: 'cream5', label: 'Text 5', color: '#FFF7ED' },
  { value: 'rose6', label: 'Text 6', color: '#FFF1F2' },
  { value: 'green7', label: 'Text 7', color: '#ECFDF5' },
  { value: 'amber8', label: 'Text 8', color: '#FFFBEB' }
];

const eventTextColorStyles: Record<EventTextColor, { color: string }> = eventTextColorOptions.reduce((styles, option) => ({
  ...styles,
  [option.value]: { color: option.color }
}), {} as Record<EventTextColor, { color: string }>);

type ScheduleForm = {
  title: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  carNeeded: boolean;
  category: CalendarEvent['category'];
  status: string;
  notes: string;
  color: EventColor;
  textColor: EventTextColor;
};

type DragSelection = {
  dayIndex: number;
  date: Date;
  startMinutes: number;
  endMinutes: number;
};

type DragStartState = {
  pointerId: number;
  dayIndex: number;
  date: Date;
  startMinutes: number;
};

type EventHorizontalLayout = {
  leftPercent: number;
  widthPercent: number;
  zIndex: number;
};

const productTagline = 'Predict battery risk before it happens.';
const draftEventId = 'draft-schedule-block';
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayStartHour = 0;
const dayEndHour = 24;
const startMinutes = 0;
const endMinutes = 24 * 60;
const hourHeight = 72;
const timeColumnWidth = 52;
const dayColumnMinWidth = 132;
const snapMinutes = 15;
const calendarHeight = 24 * hourHeight;
const demoStart = new Date(2026, 5, 15);
const demoEnd = new Date(2026, 6, 30);
const fallbackDemoDate = new Date(2026, 6, 1);

const dayHeaderFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric' });
const weekRangeFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const normalized = startOfDay(date);
  const mondayOffset = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - mondayOffset);
  return normalized;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getInitialCalendarDate() {
  const today = startOfDay(new Date());
  return today >= startOfDay(demoStart) && today <= startOfDay(demoEnd) ? today : fallbackDemoDate;
}

function getAvailableWeeks() {
  const weeks: Date[] = [];
  for (let cursor = startOfWeek(demoStart); cursor <= startOfWeek(demoEnd); cursor = addDays(cursor, 7)) {
    weeks.push(new Date(cursor));
  }
  return weeks;
}

function getTimelineDays(monthStart: Date) {
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const days: Date[] = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor));
  }

  return days;
}

function getWeekRangeLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  return `${weekRangeFormatter.format(weekStart)} - ${weekRangeFormatter.format(weekEnd)}`;
}

function getEventDate(event: CalendarEvent) {
  return event.date instanceof Date ? event.date : new Date(event.date);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseTimeToMinutes(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return startMinutes;

  const [, rawHour, rawMinute, meridiem] = match;
  let hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (meridiem?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (meridiem?.toUpperCase() === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function minutesToTimeInput(minutes: number) {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hour = Math.floor(bounded / 60);
  const minute = bounded % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function minutesToDisplayTime(minutes: number) {
  const bounded = Math.max(0, Math.min(endMinutes, minutes));
  const hour24 = Math.floor(bounded / 60) % 24;
  const minute = bounded % 60;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function inputTimeToDisplay(value: string) {
  return minutesToDisplayTime(parseTimeToMinutes(value));
}

function getEventStart(event: CalendarEvent) {
  return parseTimeToMinutes(event.time);
}

function getEventEnd(event: CalendarEvent) {
  const start = getEventStart(event);
  const parsedEnd = event.endTime ? parseTimeToMinutes(event.endTime) : start + 60;
  return parsedEnd > start ? parsedEnd : start + 60;
}

function getEventType(startTime: string): CalendarEvent['type'] {
  const minutes = parseTimeToMinutes(startTime);
  if (minutes < 12 * 60) return 'Morning';
  if (minutes < 17 * 60) return 'Afternoon';
  return 'Evening';
}

function getHourLabel(hour: number) {
  const normalized = hour % 24;
  if (normalized === 0) return '12 AM';
  if (normalized === 12) return '12 PM';
  if (normalized > 12) return `${normalized - 12} PM`;
  return `${normalized} AM`;
}

function getMinutesFromPointer(event: ReactPointerEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const rawMinutes = startMinutes + (y / hourHeight) * 60;
  const snapped = Math.round(rawMinutes / snapMinutes) * snapMinutes;
  return Math.max(startMinutes, Math.min(endMinutes, snapped));
}

function getBlockLayout(event: CalendarEvent) {
  const rawStart = getEventStart(event);
  const rawEnd = getEventEnd(event);
  const visibleStart = Math.max(startMinutes, rawStart);
  const visibleEnd = Math.min(endMinutes, rawEnd);
  const top = ((visibleStart - startMinutes) / 60) * hourHeight;
  const height = Math.max(24, ((visibleEnd - visibleStart) / 60) * hourHeight - 3);
  return { top, height };
}

function getSelectionLayout(selection: DragSelection) {
  const top = ((selection.startMinutes - startMinutes) / 60) * hourHeight;
  const height = Math.max(22, ((selection.endMinutes - selection.startMinutes) / 60) * hourHeight);
  return { top, height };
}
function isChargingEvent(event: CalendarEvent) {
  const text = `${event.title} ${event.status ?? ''}`.toLowerCase();
  return text.includes('charge') || text.includes('charging');
}

function isRiskEvent(event: CalendarEvent) {
  const text = `${event.title} ${event.status ?? ''}`.toLowerCase();
  return text.includes('risk') || text.includes('warning') || text.includes('urgent');
}

function getDefaultEventColor(event: Pick<CalendarEvent, 'category' | 'carNeeded'> & { title?: string; status?: string }) {
  const text = `${event.title ?? ''} ${event.status ?? ''}`.toLowerCase();

  if (event.category === 'important') return 'urgent';
  if (event.category === 'risk') return 'risk';
  if (text.includes('risk') || text.includes('warning')) return 'risk';
  if (text.includes('urgent')) return 'urgent';
  if (event.category === 'charging') return 'charging';
  if (text.includes('charge') || text.includes('charging')) return 'charging';
  if (text.includes('important')) return 'rose';
  if (!event.carNeeded) return 'blue';
  if (event.category === 'study') return 'study';
  if (event.category === 'assignment') return 'assignment';
  if (event.category === 'personal') return 'violet';
  if (event.category === 'fitness') return 'green';
  if (event.category === 'other') return 'amber';
  return 'general';
}

function getEventColor(event: CalendarEvent) {
  return ((event as CalendarEvent & { color?: EventColor }).color ?? getDefaultEventColor(event));
}

function getEventTone(_event: CalendarEvent) {
  return 'calendar-solid-event text-inverse-on-surface';
}

function getEventColorStyle(event: CalendarEvent) {
  return eventColorStyles[getEventColor(event)];
}

function getDefaultEventTextColor(background: EventColor) {
  return background === 'cream' ? 'dark' : background === 'assignment' ? 'cream5' : background === 'urgent' ? 'rose6' : background === 'charging' ? 'green7' : background === 'risk' ? 'amber8' : 'light';
}

function getEventTextColor(event: CalendarEvent) {
  return ((event as CalendarEvent & { textColor?: EventTextColor }).textColor ?? getDefaultEventTextColor(getEventColor(event)));
}

function getEventTextColorStyle(event: CalendarEvent) {
  return eventTextColorStyles[getEventTextColor(event)];
}

function buildEmptyForm(date: Date, start = 9 * 60, end = 10 * 60): ScheduleForm {
  return {
    title: '',
    location: '',
    date: toDateInputValue(date),
    startTime: minutesToTimeInput(start),
    endTime: minutesToTimeInput(end),
    carNeeded: true,
    category: 'work',
    status: 'Vehicle Required',
    notes: '',
    color: 'general',
    textColor: 'light'
  };
}

function formFromEvent(event: CalendarEvent): ScheduleForm {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  return {
    title: event.title,
    location: event.location,
    date: toDateInputValue(getEventDate(event)),
    startTime: minutesToTimeInput(start),
    endTime: minutesToTimeInput(end),
    carNeeded: event.carNeeded,
    category: event.category,
    status: event.status ?? (event.carNeeded ? 'Vehicle Required' : 'Remote / No Car'),
    notes: event.notes ?? '',
    color: getEventColor(event),
    textColor: getEventTextColor(event)
  };
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => getEventStart(a) - getEventStart(b) || getEventEnd(b) - getEventEnd(a));
}

function eventsOverlap(a: CalendarEvent, b: CalendarEvent) {
  return getEventStart(a) < getEventEnd(b) && getEventStart(b) < getEventEnd(a);
}

function eventContains(outer: CalendarEvent, inner: CalendarEvent) {
  const outerStart = getEventStart(outer);
  const outerEnd = getEventEnd(outer);
  const innerStart = getEventStart(inner);
  const innerEnd = getEventEnd(inner);

  return outerStart <= innerStart && outerEnd >= innerEnd && (outerStart < innerStart || outerEnd > innerEnd);
}

function buildEventHorizontalLayouts(events: CalendarEvent[]) {
  const sorted = sortEvents(events);
  const layouts = new Map<string, EventHorizontalLayout>();

  sorted.forEach((event, index) => {
    layouts.set(event.id, { leftPercent: 0, widthPercent: 100, zIndex: index + 1 });
  });

  sorted.forEach((event, index) => {
    for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
      const next = sorted[nextIndex];
      if (!eventsOverlap(event, next)) continue;

      if (eventContains(event, next)) {
        layouts.set(next.id, { leftPercent: 5, widthPercent: 95, zIndex: 50 + nextIndex });
        continue;
      }

      if (eventContains(next, event)) {
        layouts.set(event.id, { leftPercent: 5, widthPercent: 95, zIndex: 50 + index });
        continue;
      }

      const eventStart = getEventStart(event);
      const nextStart = getEventStart(next);
      const earlier = eventStart <= nextStart ? event : next;
      const later = earlier === event ? next : event;
      const earlierLayout = layouts.get(earlier.id);
      const laterLayout = layouts.get(later.id);

      if (earlierLayout?.widthPercent !== 95) {
        layouts.set(earlier.id, { leftPercent: 0, widthPercent: 50, zIndex: earlierLayout?.zIndex ?? index + 1 });
      }
      if (laterLayout?.widthPercent !== 95) {
        layouts.set(later.id, { leftPercent: 50, widthPercent: 50, zIndex: laterLayout?.zIndex ?? nextIndex + 1 });
      }
    }
  });

  return sorted.map((event) => ({
    event,
    horizontalLayout: layouts.get(event.id) ?? { leftPercent: 0, widthPercent: 100, zIndex: 1 }
  }));
}

function TimeColumn() {
  return (
    <div className="sticky left-0 z-20 border-r border-outline-variant/30 bg-surface-container-lowest" style={{ height: calendarHeight }}>
      {Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => (
        <div key={index} className="absolute left-0 right-0 -translate-y-2 pr-2 text-right text-[10px] font-medium text-slate-500" style={{ top: index * hourHeight }}>
          {getHourLabel(index)}
        </div>
      ))}
    </div>
  );
}

function EventBlock({ event, horizontalLayout, selected, onClick }: { event: CalendarEvent; horizontalLayout: EventHorizontalLayout; selected: boolean; onClick: (event: CalendarEvent) => void }) {
  const { top, height } = getBlockLayout(event);
  const compact = height < 46;

  return (
    <button
      data-event-block="true"
      onClick={(clickEvent) => { clickEvent.stopPropagation(); onClick(event); }}
      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
      className={cn('absolute overflow-hidden rounded-md px-1.5 py-1 text-left opacity-100 shadow-sm transition hover:brightness-105 active:scale-[0.99]', getEventTone(event), selected && 'ring-1 ring-primary/60')}
      style={{
        top,
        height,
        left: `calc(${horizontalLayout.leftPercent}% + 0.25rem)`,
        width: `calc(${horizontalLayout.widthPercent}% - 0.5rem)`,
        zIndex: selected ? horizontalLayout.zIndex + 30 : horizontalLayout.zIndex,
        ...getEventColorStyle(event),
        ...getEventTextColorStyle(event)
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-w-0 items-center gap-1">
          {isChargingEvent(event) ? <BatteryCharging className="h-3 w-3 shrink-0" /> : isRiskEvent(event) ? <AlertTriangle className="h-3 w-3 shrink-0" /> : event.carNeeded ? <Car className="h-3 w-3 shrink-0" /> : <Video className="h-3 w-3 shrink-0" />}
          <span className="truncate text-[11px] font-semibold leading-tight">{event.title}</span>
        </div>
        <span className="mt-0.5 truncate text-[10px] font-medium">{minutesToDisplayTime(getEventStart(event))} - {minutesToDisplayTime(getEventEnd(event))}</span>
        {!compact && <span className="mt-0.5 truncate text-[10px] font-medium">{event.location}</span>}
      </div>
    </button>
  );
}

function DragSelectionBlock({ selection }: { selection: DragSelection }) {
  const { top, height } = getSelectionLayout(selection);
  return (
    <div className="pointer-events-none absolute left-1 right-1 rounded-md border border-primary/45 bg-primary/15" style={{ top, height }}>
      <div className="px-1.5 py-1 text-[10px] font-semibold text-primary">{minutesToDisplayTime(selection.startMinutes)} - {minutesToDisplayTime(selection.endMinutes)}</div>
    </div>
  );
}

function DayColumn({ day, dayIndex, events, selection, selectedEventId, onEventClick, onSelectDay, onPointerDown, onPointerMove, onPointerUp }: {
  day: Date;
  dayIndex: number;
  events: CalendarEvent[];
  selection: DragSelection | null;
  selectedEventId?: string;
  onEventClick: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, dayIndex: number, date: Date) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const laidOutEvents = buildEventHorizontalLayouts(events);

  return (
    <div className="relative border-r border-outline-variant/30 bg-surface-container-lowest last:border-r-0" style={{ height: calendarHeight }} onClick={() => onSelectDay(day)} onPointerDown={(event) => onPointerDown(event, dayIndex, day)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => <div key={index} className="absolute left-0 right-0 border-t border-outline-variant/30" style={{ top: index * hourHeight }} />)}
      {laidOutEvents.map(({ event, horizontalLayout }) => <EventBlock key={event.id} event={event} horizontalLayout={horizontalLayout} selected={event.id === selectedEventId} onClick={onEventClick} />)}
      {selection?.dayIndex === dayIndex && <DragSelectionBlock selection={selection} />}
    </div>
  );
}

function CalendarWeekView({ days, weekStart, events, selection, selectedEventId, onEventClick, onSelectDay, onPointerDown, onPointerMove, onPointerUp }: {
  days: Date[];
  weekStart: Date;
  events: CalendarEvent[];
  selection: DragSelection | null;
  selectedEventId?: string;
  onEventClick: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, dayIndex: number, date: Date) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridTemplateColumns = `${timeColumnWidth}px repeat(${days.length}, minmax(${dayColumnMinWidth}px, 1fr))`;

  useEffect(() => {
    const weekIndex = days.findIndex((day) => sameDay(day, weekStart));
    if (weekIndex < 0 || !scrollRef.current) return;
    scrollRef.current.scrollTo({ left: weekIndex * dayColumnMinWidth, behavior: 'smooth' });
  }, [days, weekStart]);

  return (
    <section className="min-h-0 overflow-hidden bg-surface">
      <div ref={scrollRef} className="h-full overflow-auto">
        <div style={{ minWidth: `${timeColumnWidth + days.length * dayColumnMinWidth}px` }}>
          <div className="sticky top-0 z-30 grid border-b border-outline-variant/45 bg-surface-container-low" style={{ gridTemplateColumns }}>
            <div className="sticky left-0 z-40 flex h-8 items-center justify-end border-r border-outline-variant/45 bg-surface-container-low px-2 text-[9px] font-semibold text-slate-500">GMT+8</div>
            {days.map((day, index) => (
              <button key={day.toISOString()} onClick={() => onSelectDay(day)} className="flex h-8 items-center justify-center gap-1.5 border-r border-outline-variant/45 bg-surface-container-low px-2 text-[11px] font-semibold text-on-surface transition hover:bg-surface-container last:border-r-0" aria-label={fullDateFormatter.format(day)}>
                <span>{dayLabels[(day.getDay() + 6) % 7]}</span>
                <span>{dayHeaderFormatter.format(day)}</span>
              </button>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns }}>
            <TimeColumn />
            {days.map((day, index) => (
              <DayColumn key={day.toISOString()} day={day} dayIndex={index} events={events.filter((event) => sameDay(getEventDate(event), day))} selection={selection} selectedEventId={selectedEventId} onEventClick={onEventClick} onSelectDay={onSelectDay} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventSidePanel({ mode, form, editingEvent, onChange, onClose, onDelete, onSubmit }: {
  mode: EventMode | null;
  form: ScheduleForm;
  editingEvent: CalendarEvent | null;
  onChange: (form: ScheduleForm) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!mode) {
    return (
      <aside className="min-h-0 border-t border-outline-variant/45 bg-surface-container-low p-4 text-on-surface lg:border-l lg:border-t-0">
        <div className="rounded-lg border border-outline-variant/45 bg-surface-container-lowest p-3">
          <div className="flex items-start gap-3">
            <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">MB Sense</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-on-surface-variant">{productTagline}</p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const chargingContext = editingEvent ? isChargingEvent(editingEvent) || isRiskEvent(editingEvent) : form.status.toLowerCase().includes('charging') || form.status.toLowerCase().includes('risk') || form.title.toLowerCase().includes('charge');

  return (
    <aside className="min-h-0 overflow-hidden border-t border-outline-variant/45 bg-surface-container-low text-on-surface lg:border-l lg:border-t-0">
      <form onSubmit={onSubmit} className="h-full overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-4">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{mode === 'edit' ? 'Edit event' : 'New event'}</p>
            <h3 className="mt-1 truncate text-base font-semibold text-on-surface">{form.title || 'Untitled'}</h3>
            <p className="mt-1 text-xs font-medium text-on-surface-variant">{inputTimeToDisplay(form.startTime)} - {inputTimeToDisplay(form.endTime)}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant transition hover:bg-surface-container" aria-label="Close schedule editor"><X className="h-4 w-4" /></button>
        </div>

        {chargingContext && (
          <div className="mb-4 rounded-lg border border-outline-variant/45 bg-surface-container-lowest p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-500"><BatteryCharging className="h-4 w-4 text-emerald-500" />Charging prediction</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Target</p><p className="mt-1 font-semibold text-on-surface">80%</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Risk</p><p className={cn('mt-1 font-semibold', editingEvent && isRiskEvent(editingEvent) ? 'text-amber-500' : 'text-emerald-500')}>{editingEvent && isRiskEvent(editingEvent) ? 'High' : 'Watch'}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">After schedule</p><p className="mt-1 font-semibold text-on-surface">22-28%</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Window</p><p className="mt-1 font-semibold text-on-surface">Home</p></div>
            </div>
            {editingEvent?.aiReason && <p className="mt-3 text-xs font-medium leading-relaxed text-on-surface-variant">{editingEvent.aiReason}</p>}
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Title</span>
            <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} required className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45" placeholder="Client strategy review" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</span>
            <input type="date" value={form.date} onChange={(event) => onChange({ ...form, date: event.target.value })} required className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none focus:border-primary/45" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Start</span>
              <input type="time" value={form.startTime} onChange={(event) => onChange({ ...form, startTime: event.target.value })} required className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none focus:border-primary/45" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">End</span>
              <input type="time" value={form.endTime} onChange={(event) => onChange({ ...form, endTime: event.target.value })} required className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none focus:border-primary/45" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Location</span>
            <input value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })} required className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45" placeholder="TRX Executive Tower" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Event Type / Use</span>
            <select value={form.category} onChange={(event) => { const category = event.target.value as CalendarEvent['category']; const color = getDefaultEventColor({ title: form.title, status: form.status, carNeeded: form.carNeeded, category }); onChange({ ...form, category, color, textColor: getDefaultEventTextColor(color) }); }} className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none focus:border-primary/45"><option value="work">Work / Meeting</option><option value="study">Class / Study</option><option value="assignment">Assignment / Deadline</option><option value="important">Important / Urgent</option><option value="charging">AI Charging Recommendation</option><option value="risk">Battery Risk Warning</option><option value="personal">Personal</option><option value="fitness">Fitness</option><option value="other">Charging / Other</option></select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
            <input value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value })} className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45" placeholder="Vehicle Required" />
          </label>
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Background</span>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {eventColorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...form, color: option.value, textColor: getDefaultEventTextColor(option.value) })}
                  className={cn('flex h-9 items-center justify-center rounded-md text-[0px] transition active:scale-95', form.color === option.value && 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low')}
                  style={{ backgroundColor: option.backgroundColor }}
                  aria-label={`Use ${option.label} schedule color`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Text</span>
            <div className="grid grid-cols-2 gap-1.5">
              {eventTextColorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...form, textColor: option.value })}
                  className={cn('flex h-9 items-center justify-center rounded-md border text-[10px] font-black uppercase tracking-widest transition active:scale-95', form.textColor === option.value ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low' : 'border-outline-variant/45')}
                  style={{ backgroundColor: option.color, color: option.value === 'dark' ? '#F8FAFC' : '#1E3A5F' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => onChange({ ...form, carNeeded: !form.carNeeded, status: !form.carNeeded ? 'Vehicle Required' : 'Remote / No Car' })} className={cn('flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition', form.carNeeded ? 'border-blue-300/35 bg-blue-500/20 text-blue-600' : 'border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant')}>{form.carNeeded ? <Car className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}{form.carNeeded ? 'Drive needed' : 'Remote / no car'}</button>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Notes</span>
            <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} rows={4} className="w-full resize-none rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 py-2 text-xs font-medium leading-relaxed text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45" placeholder="Details or charging recommendation context" />
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          {mode === 'edit' && <button type="button" onClick={onDelete} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-rose-300/25 bg-rose-500/10 text-rose-500 transition hover:bg-rose-500/15" aria-label="Delete schedule"><Trash2 className="h-4 w-4" /></button>}
          <GlassButton type="submit" disabled={!form.title.trim() || !form.location.trim()} wrapClassName="flex-1 text-[13px]" className="glass-panel-action-button">
            <Save className="h-3.5 w-3.5" />
            Save
          </GlassButton>
        </div>
      </form>
    </aside>
  );
}

export default function Calendar() {
  const { events } = useAppStore();
  const { selectedDate, weekStart, setSelectedDate, setActiveWeek } = useCalendarViewStore();
  const initialDate = useMemo(() => selectedDate, []);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(events);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const dragStartRef = useRef<DragStartState | null>(null);
  const [panelMode, setPanelMode] = useState<EventMode | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<ScheduleForm>(() => buildEmptyForm(initialDate));

  const timelineDays = useMemo(() => getTimelineDays(weekStart), [weekStart]);
  const timelineEvents = useMemo(() => {
    const timelineStart = timelineDays[0] ?? startOfDay(weekStart);
    const timelineEnd = addDays(timelineDays[timelineDays.length - 1] ?? demoEnd, 1);
    return calendarEvents.filter((event) => {
      const date = getEventDate(event);
      return date >= timelineStart && date < timelineEnd;
    });
  }, [calendarEvents, timelineDays]);

  const draftEvent = useMemo<(CalendarEvent & { color: EventColor; textColor: EventTextColor }) | null>(() => {
    if (!panelMode) return null;
    const start = parseTimeToMinutes(form.startTime);
    const parsedEnd = parseTimeToMinutes(form.endTime);
    const normalizedEnd = parsedEnd > start ? parsedEnd : start + 30;

    return {
      id: panelMode === 'edit' && editingEvent ? editingEvent.id : draftEventId,
      title: form.title.trim() || 'Draft schedule',
      location: form.location.trim() || 'Selected time block',
      time: minutesToDisplayTime(start),
      endTime: minutesToDisplayTime(normalizedEnd),
      date: fromDateInputValue(form.date),
      carNeeded: form.carNeeded,
      type: getEventType(form.startTime),
      category: form.category,
      status: form.status.trim() || 'Draft',
      notes: form.notes.trim() || undefined,
      color: form.color,
      textColor: form.textColor,
      aiReason: editingEvent?.aiReason
    };
  }, [editingEvent, form, panelMode]);

  const visibleWeekEvents = useMemo(() => {
    if (!draftEvent) return timelineEvents;
    const draftDate = getEventDate(draftEvent);
    const timelineStart = timelineDays[0] ?? startOfDay(weekStart);
    const timelineEnd = addDays(timelineDays[timelineDays.length - 1] ?? demoEnd, 1);
    const baseEvents = editingEvent ? timelineEvents.filter((event) => event.id !== editingEvent.id) : timelineEvents;
    if (draftDate < timelineStart || draftDate >= timelineEnd) return baseEvents;
    return [...baseEvents, draftEvent];
  }, [draftEvent, editingEvent, timelineEvents, timelineDays]);

  const selectedEventId = panelMode === 'create' ? draftEventId : editingEvent?.id;

  const openPanelForCreate = (date: Date, start = 9 * 60, end = 10 * 60) => {
    setEditingEvent(null);
    setForm(buildEmptyForm(date, start, end));
    setPanelMode('create');
    setActiveWeek(date);
  };

  const openPanelForEvent = (event: CalendarEvent) => {
    const eventDate = getEventDate(event);
    setEditingEvent(event);
    setForm(formFromEvent(event));
    setPanelMode('edit');
    setActiveWeek(eventDate);
  };

  const closePanel = () => {
    setPanelMode(null);
    setEditingEvent(null);
  };

  const handleGridPointerDown = (event: ReactPointerEvent<HTMLElement>, dayIndex: number, date: Date) => {
    if (event.target instanceof Element && event.target.closest('[data-event-block="true"]')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const start = getMinutesFromPointer(event, event.currentTarget);
    const initialEnd = Math.min(endMinutes, start + 30);
    dragStartRef.current = { pointerId: event.pointerId, dayIndex, date, startMinutes: start };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragSelection({ dayIndex, date, startMinutes: start, endMinutes: initialEnd });
  };

  const handleGridPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    const pointerMinutes = getMinutesFromPointer(event, event.currentTarget);
    const selectionStart = Math.min(dragStart.startMinutes, pointerMinutes);
    const selectionEnd = Math.max(dragStart.startMinutes + snapMinutes, pointerMinutes);
    setDragSelection({ dayIndex: dragStart.dayIndex, date: dragStart.date, startMinutes: selectionStart, endMinutes: Math.min(endMinutes, selectionEnd) });
  };

  const handleGridPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const selection = dragSelection;
    dragStartRef.current = null;
    setDragSelection(null);

    if (!selection) return;
    const selectedEnd = selection.endMinutes <= selection.startMinutes ? selection.startMinutes + 30 : selection.endMinutes;
    openPanelForCreate(selection.date, selection.startMinutes, Math.min(endMinutes, selectedEnd));
  };

  const handleSaveSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const start = parseTimeToMinutes(form.startTime);
    const parsedEnd = parseTimeToMinutes(form.endTime);
    const normalizedEnd = parsedEnd > start ? parsedEnd : start + 30;
    const date = fromDateInputValue(form.date);
    const status = form.status.trim() || (form.carNeeded ? 'Vehicle Required' : 'Remote / No Car');
    const nextEvent: CalendarEvent & { color: EventColor; textColor: EventTextColor } = {
      id: editingEvent?.id ?? `local-${Date.now()}`,
      title: form.title.trim(),
      location: form.location.trim(),
      time: minutesToDisplayTime(start),
      endTime: minutesToDisplayTime(normalizedEnd),
      date,
      carNeeded: form.carNeeded,
      type: getEventType(form.startTime),
      category: form.category,
      status,
      notes: form.notes.trim() || undefined,
      color: form.color,
      textColor: form.textColor,
      aiReason: editingEvent?.aiReason
    };

    setCalendarEvents((current) => editingEvent ? current.map((item) => item.id === editingEvent.id ? nextEvent : item) : [...current, nextEvent]);
    setActiveWeek(date);
    setEditingEvent(nextEvent);
    setForm(formFromEvent(nextEvent));
    setPanelMode('edit');
  };

  const handleDeleteSchedule = () => {
    if (!editingEvent) return;
    setCalendarEvents((current) => current.filter((event) => event.id !== editingEvent.id));
    closePanel();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-0 flex-col overflow-hidden bg-surface text-on-surface">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(240px,34vh)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1">
        <CalendarWeekView
          days={timelineDays}
          weekStart={weekStart}
          events={visibleWeekEvents}
          selection={dragSelection}
          selectedEventId={selectedEventId}
          onEventClick={openPanelForEvent}
          onSelectDay={(date) => setSelectedDate(startOfDay(date))}
          onPointerDown={handleGridPointerDown}
          onPointerMove={handleGridPointerMove}
          onPointerUp={handleGridPointerUp}
        />

        <EventSidePanel
          mode={panelMode}
          form={form}
          editingEvent={editingEvent}
          onChange={setForm}
          onClose={closePanel}
          onDelete={handleDeleteSchedule}
          onSubmit={handleSaveSchedule}
        />
      </div>

      <span className="hidden">{selectedDate.toISOString()}</span>
      <Zap className="hidden" />
    </motion.div>
  );
}
