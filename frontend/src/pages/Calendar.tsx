import { motion } from 'motion/react';
import { CalendarEvent, useAppStore } from '../store/useAppStore';
import { AlertTriangle, BatteryCharging, BrainCircuit, Car, Save, Trash2, Video, X, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import GlassButton from '../components/GlassButton';
import { FormEvent, PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from 'react';
import { useCalendarViewStore } from '../store/useCalendarViewStore';

type EventMode = 'create' | 'edit';

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
const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthHeaderFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
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

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
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

function getEventTone(event: CalendarEvent) {
  if (isRiskEvent(event)) return 'calendar-solid-event border-amber-400/35 bg-amber-400/20 text-amber-500';
  if (isChargingEvent(event)) return 'calendar-solid-event border-emerald-400/35 bg-emerald-400/20 text-emerald-500';
  if ((event.status ?? '').toLowerCase().includes('important')) return 'calendar-solid-event border-rose-400/35 bg-rose-500/20 text-rose-500';
  if (event.category === 'personal' || event.category === 'fitness') return 'calendar-solid-event border-violet-300/35 bg-violet-350/20 text-violet-350';
  if (!event.carNeeded) return 'calendar-solid-event border-outline-variant/45 bg-surface-container text-on-surface';
  return 'calendar-solid-event border-blue-300/35 bg-blue-500/20 text-blue-600';
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
    notes: ''
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
    notes: event.notes ?? ''
  };
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => getEventStart(a) - getEventStart(b));
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

function EventBlock({ event, selected, onClick }: { event: CalendarEvent; selected: boolean; onClick: (event: CalendarEvent) => void }) {
  const { top, height } = getBlockLayout(event);
  const compact = height < 46;

  return (
    <button
      data-event-block="true"
      onClick={(clickEvent) => { clickEvent.stopPropagation(); onClick(event); }}
      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
      className={cn('absolute left-1 right-1 overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition hover:brightness-105 active:scale-[0.99]', getEventTone(event), selected && 'ring-1 ring-primary/60')}
      style={{ top, height }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-w-0 items-center gap-1">
          {isChargingEvent(event) ? <BatteryCharging className="h-3 w-3 shrink-0" /> : isRiskEvent(event) ? <AlertTriangle className="h-3 w-3 shrink-0" /> : event.carNeeded ? <Car className="h-3 w-3 shrink-0" /> : <Video className="h-3 w-3 shrink-0" />}
          <span className="truncate text-[11px] font-semibold leading-tight">{event.title}</span>
        </div>
        <span className="mt-0.5 truncate text-[10px] font-medium opacity-80">{minutesToDisplayTime(getEventStart(event))} - {minutesToDisplayTime(getEventEnd(event))}</span>
        {!compact && <span className="mt-0.5 truncate text-[10px] font-medium opacity-65">{event.location}</span>}
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
  return (
    <div className="relative border-r border-outline-variant/30 bg-surface-container-lowest last:border-r-0" style={{ height: calendarHeight }} onClick={() => onSelectDay(day)} onPointerDown={(event) => onPointerDown(event, dayIndex, day)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => <div key={index} className="absolute left-0 right-0 border-t border-outline-variant/30" style={{ top: index * hourHeight }} />)}
      {sortEvents(events).map((event) => <EventBlock key={event.id} event={event} selected={event.id === selectedEventId} onClick={onEventClick} />)}
      {selection?.dayIndex === dayIndex && <DragSelectionBlock selection={selection} />}
    </div>
  );
}

function CalendarWeekView({ weekDays, events, selection, selectedEventId, onEventClick, onSelectDay, onPointerDown, onPointerMove, onPointerUp }: {
  weekDays: Date[];
  events: CalendarEvent[];
  selection: DragSelection | null;
  selectedEventId?: string;
  onEventClick: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, dayIndex: number, date: Date) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const gridTemplateColumns = `${timeColumnWidth}px repeat(7, minmax(${dayColumnMinWidth}px, 1fr))`;

  return (
    <section className="min-h-0 overflow-hidden bg-surface">
      <div className="h-full overflow-auto">
        <div className="min-w-[976px]">
          <div className="sticky top-0 z-30 grid border-b border-outline-variant/45 bg-surface-container-low" style={{ gridTemplateColumns }}>
            <div className="sticky left-0 z-40 flex h-14 items-end justify-end border-r border-outline-variant/45 bg-surface-container-low px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">GMT+8</div>
            {weekDays.map((day, index) => (
              <button key={day.toISOString()} onClick={() => onSelectDay(day)} className="h-14 border-r border-outline-variant/45 bg-surface-container-low px-2.5 py-2 text-left transition hover:bg-surface-container last:border-r-0" aria-label={fullDateFormatter.format(day)}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{dayLabels[index]}</div>
                <div className="mt-1 flex items-baseline gap-1.5"><span className="text-lg font-semibold leading-none text-on-surface">{dayHeaderFormatter.format(day)}</span><span className="text-[11px] font-medium text-on-surface-variant">{monthLabelFormatter.format(day)}</span></div>
              </button>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns }}>
            <TimeColumn />
            {weekDays.map((day, index) => (
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
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Type</span>
            <select value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value as CalendarEvent['category'] })} className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none focus:border-primary/45"><option value="work">Work</option><option value="personal">Personal</option><option value="fitness">Fitness</option><option value="other">Charging / Other</option></select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
            <input value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value })} className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45" placeholder="Vehicle Required" />
          </label>
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

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEvents = useMemo(() => {
    const weekEnd = addDays(weekStart, 7);
    return calendarEvents.filter((event) => {
      const date = getEventDate(event);
      return date >= weekStart && date < weekEnd;
    });
  }, [calendarEvents, weekStart]);

  const draftEvent = useMemo<CalendarEvent | null>(() => {
    if (panelMode !== 'create') return null;
    const start = parseTimeToMinutes(form.startTime);
    const parsedEnd = parseTimeToMinutes(form.endTime);
    const normalizedEnd = parsedEnd > start ? parsedEnd : start + 30;

    return {
      id: draftEventId,
      title: form.title.trim() || 'Draft schedule',
      location: form.location.trim() || 'Selected time block',
      time: minutesToDisplayTime(start),
      endTime: minutesToDisplayTime(normalizedEnd),
      date: fromDateInputValue(form.date),
      carNeeded: form.carNeeded,
      type: getEventType(form.startTime),
      category: form.category,
      status: form.status.trim() || 'Draft',
      notes: form.notes.trim() || undefined
    };
  }, [form, panelMode]);

  const visibleWeekEvents = useMemo(() => {
    if (!draftEvent) return weekEvents;
    const draftDate = getEventDate(draftEvent);
    const weekEnd = addDays(weekStart, 7);
    if (draftDate < weekStart || draftDate >= weekEnd) return weekEvents;
    return [...weekEvents, draftEvent];
  }, [draftEvent, weekEvents, weekStart]);

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
    const nextEvent: CalendarEvent = {
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
          weekDays={weekDays}
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
