import { motion } from 'motion/react';
import { CalendarEvent, useAppStore } from '../store/useAppStore';
import {
  BrainCircuit,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Video,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';

type CalendarView = 'week' | 'month';
type PickerMode = 'month' | 'year';

interface ScheduleForm {
  title: string;
  location: string;
  time: string;
  date: string;
  carNeeded: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

interface DragScrollState {
  pointerId: number;
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 1).toLocaleDateString('en-US', { month: 'long' })
);
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const shortMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getEventDate(event: CalendarEvent) {
  return event.date instanceof Date ? event.date : new Date(event.date);
}

function getEventMinutes(event: CalendarEvent) {
  const match = event.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;

  const [, rawHour, rawMinute, meridiem] = match;
  let hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (meridiem?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (meridiem?.toUpperCase() === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
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

function toTimeInputValue(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '';

  const [, rawHour, rawMinute, meridiem] = match;
  let hour = Number(rawHour);

  if (meridiem?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (meridiem?.toUpperCase() === 'AM' && hour === 12) hour = 0;

  return `${String(hour).padStart(2, '0')}:${rawMinute}`;
}

function toDisplayTime(value: string) {
  const [rawHour, minute] = value.split(':').map(Number);
  const meridiem = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function getEventType(time: string): CalendarEvent['type'] {
  const [hour] = time.split(':').map(Number);
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function createEmptyForm(date: Date): ScheduleForm {
  return {
    title: '',
    location: '',
    time: '09:00',
    date: toDateInputValue(date),
    carNeeded: true
  };
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button,input,textarea,select,a,[data-no-drag-scroll="true"]'));
}

function useDragScroll() {
  const dragState = useRef<DragScrollState | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.buttons !== 1 || isInteractiveTarget(event.target)) return;

    const target = event.currentTarget;
    dragState.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: target.scrollLeft,
      scrollTop: target.scrollTop,
      moved: false
    };
    target.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (event.buttons !== 1) {
      dragState.current = null;
      return;
    }

    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) state.moved = true;

    event.currentTarget.scrollLeft = state.scrollLeft - dx;
    event.currentTarget.scrollTop = state.scrollTop - dy;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState.current = null;
  };

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onLostPointerCapture: handlePointerUp
  };
}

function useWindowDragScroll(disabled: boolean) {
  const dragState = useRef<DragScrollState | null>(null);

  useEffect(() => {
    if (disabled) {
      dragState.current = null;
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.buttons !== 1 || isInteractiveTarget(event.target)) return;

      dragState.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: window.scrollX,
        scrollTop: window.scrollY,
        moved: false
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      const state = dragState.current;
      if (!state || state.pointerId !== event.pointerId) return;
      if (event.buttons !== 1) {
        dragState.current = null;
        return;
      }

      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) state.moved = true;

      event.preventDefault();
      window.scrollTo({
        left: state.scrollLeft - dx,
        top: state.scrollTop - dy
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const state = dragState.current;
      if (!state || state.pointerId !== event.pointerId) return;

      dragState.current = null;
    };

    const handleWindowBlur = () => {
      dragState.current = null;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerEnd);
      document.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [disabled]);
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => getEventMinutes(a) - getEventMinutes(b));
}

function buildYearOptions(activeYear: number) {
  const rangeStart = activeYear - 5;
  return Array.from({ length: 12 }, (_, index) => rangeStart + index);
}

function buildMonthDays(monthDate: Date, events: CalendarEvent[]) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());
  const today = startOfDay(new Date());

  return Array.from({ length: 42 }, (_, index): CalendarDay => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      isCurrentMonth: date.getMonth() === month,
      isToday: sameDay(date, today),
      events: sortEvents(events.filter((event) => sameDay(getEventDate(event), date)))
    };
  });
}

function buildWeekDays(selectedDate: Date, events: CalendarEvent[]) {
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
  const today = startOfDay(new Date());

  return Array.from({ length: 7 }, (_, index): CalendarDay => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    return {
      date,
      isCurrentMonth: true,
      isToday: sameDay(date, today),
      events: sortEvents(events.filter((event) => sameDay(getEventDate(event), date)))
    };
  });
}

export default function Calendar() {
  const { events } = useAppStore();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(events);
  const [analyzing, setAnalyzing] = useState(false);
  const [view, setView] = useState<CalendarView>('week');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDatePickerOpen, setFormDatePickerOpen] = useState(false);
  const [formDateMonth, setFormDateMonth] = useState(() => startOfDay(new Date()));
  const [form, setForm] = useState<ScheduleForm>(() => createEmptyForm(new Date()));
  useWindowDragScroll(formOpen);
  const sheetDragScroll = useDragScroll();

  const monthDays = buildMonthDays(visibleMonth, calendarEvents);
  const weekDays = buildWeekDays(selectedDate, calendarEvents);
  const selectedEvents = sortEvents(calendarEvents.filter((event) => sameDay(getEventDate(event), selectedDate)));
  const vehicleAssignments = calendarEvents.filter((event) => event.carNeeded).length;
  const activeYear = visibleMonth.getFullYear();
  const activeMonth = visibleMonth.getMonth();
  const yearOptions = buildYearOptions(activeYear);
  const showDateField = view === 'month' || editingEvent !== null;
  const formDate = fromDateInputValue(form.date);
  const formDateDays = buildMonthDays(formDateMonth, []);

  const handleMonthChange = (offset: number) => {
    setVisibleMonth((current) => {
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + offset, 1);
      setSelectedDate(nextMonth);
      setPickerMode('month');
      return nextMonth;
    });
  };

  const handleWeekChange = (offset: number) => {
    setSelectedDate((current) => {
      const nextDate = new Date(current);
      nextDate.setDate(current.getDate() + offset * 7);
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setPickerMode('month');
      return startOfDay(nextDate);
    });
  };

  const handlePeriodChange = (offset: number) => {
    setPickerOpen(false);

    if (view === 'week') {
      handleWeekChange(offset);
      return;
    }

    handleMonthChange(offset);
  };

  const handleSelectWeek = () => {
    setView('week');
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  };

  const handleSelectMonth = () => {
    setView('month');
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  };

  const handleSelectDay = (date: Date) => {
    const normalizedDate = startOfDay(date);
    setSelectedDate(normalizedDate);

    if (view === 'month') {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setView('week');
    }
  };

  const handlePickerToggle = () => {
    setPickerOpen((isOpen) => !isOpen);
    setPickerMode('month');
  };

  const handleSelectPickerMonth = (month: number) => {
    const nextDate = new Date(activeYear, month, 1);
    setVisibleMonth(nextDate);
    setSelectedDate(nextDate);
    setView('month');
    setPickerOpen(false);
  };

  const handleSelectPickerYear = (year: number) => {
    const nextDate = new Date(year, activeMonth, 1);
    setVisibleMonth(nextDate);
    setSelectedDate(nextDate);
    setPickerMode('month');
  };

  const handlePickerYearOffset = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear() + offset, current.getMonth(), 1));
  };

  const handleOpenAddForm = () => {
    setEditingEvent(null);
    setOpenMenuId(null);
    const nextForm = createEmptyForm(selectedDate);
    setForm(nextForm);
    setFormDateMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setFormDatePickerOpen(false);
    setFormOpen(true);
  };

  const handleOpenEditForm = (event: CalendarEvent) => {
    setEditingEvent(event);
    setOpenMenuId(null);
    setForm({
      title: event.title,
      location: event.location,
      time: toTimeInputValue(event.time) || '09:00',
      date: toDateInputValue(getEventDate(event)),
      carNeeded: event.carNeeded
    });
    setFormDateMonth(new Date(getEventDate(event).getFullYear(), getEventDate(event).getMonth(), 1));
    setFormDatePickerOpen(false);
    setFormOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setCalendarEvents((current) => current.filter((event) => event.id !== eventId));
    setOpenMenuId(null);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingEvent(null);
    setFormDatePickerOpen(false);
  };

  const handleFormDateMonthChange = (offset: number) => {
    setFormDateMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const handleSelectFormDate = (date: Date) => {
    setForm((current) => ({ ...current, date: toDateInputValue(date) }));
    setFormDateMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setFormDatePickerOpen(false);
  };

  const handleTimeOffset = (minutes: number) => {
    setForm((current) => {
      const [hour, minute] = current.time.split(':').map(Number);
      const nextTime = new Date(2026, 0, 1, hour, minute + minutes);

      return {
        ...current,
        time: `${String(nextTime.getHours()).padStart(2, '0')}:${String(nextTime.getMinutes()).padStart(2, '0')}`
      };
    });
  };

  const handleSubmitSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const date = showDateField ? fromDateInputValue(form.date) : selectedDate;
    const nextEvent: CalendarEvent = {
      id: editingEvent?.id || `local-${Date.now()}`,
      title: form.title.trim(),
      location: form.location.trim(),
      time: toDisplayTime(form.time),
      date,
      carNeeded: form.carNeeded,
      type: getEventType(form.time),
      category: 'other',
      status: form.carNeeded ? 'CAR NEEDED' : undefined
    };

    if (editingEvent) {
      setCalendarEvents((current) => current.map((item) => (item.id === editingEvent.id ? nextEvent : item)));
    } else {
      setCalendarEvents((current) => [...current, nextEvent]);
    }

    setSelectedDate(startOfDay(date));
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    handleCloseForm();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: calendarEvents })
      });
      await res.json();
      setTimeout(() => setAnalyzing(false), 800);
    } catch (e) {
      console.error(e);
      setAnalyzing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-6 pb-20"
    >
      <section className="mt-2 mb-4">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-3xl font-bold tracking-tight text-white">{monthFormatter.format(visibleMonth)}</h2>
            <p className="mt-1 text-sm font-medium text-slate-400">{vehicleAssignments} pending vehicle assignments</p>
          </div>
          <div className="flex shrink-0 gap-1 rounded-full border border-white/5 bg-slate-900 p-1">
            <button
              onClick={handleSelectWeek}
              className={cn(
                "min-h-10 rounded-full px-4 text-sm font-bold transition-colors active:scale-95",
                view === 'week' ? "bg-blue-500/20 text-blue-400" : "text-slate-400 active:text-slate-200"
              )}
            >
              Week
            </button>
            <button
              onClick={handleSelectMonth}
              className={cn(
                "min-h-10 rounded-full px-4 text-sm font-bold transition-colors active:scale-95",
                view === 'month' ? "bg-blue-500/20 text-blue-400" : "text-slate-400 active:text-slate-200"
              )}
            >
              Month
            </button>
          </div>
        </div>

        <div className="relative rounded-3xl border border-white/5 bg-slate-900">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-3">
            <button
              onClick={() => handlePeriodChange(-1)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-slate-300 active:scale-95 active:text-white"
              aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                onClick={handlePickerToggle}
                className="flex min-h-12 items-center gap-2 rounded-full px-3 text-sm font-bold text-slate-100 active:scale-95 active:bg-slate-800"
                aria-expanded={pickerOpen}
              >
                <CalendarDays className="h-4 w-4 text-blue-400" />
                {monthFormatter.format(visibleMonth)}
              </button>

              {pickerOpen && (
                <div className="absolute left-1/2 top-14 z-30 w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2">
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="rounded-3xl border border-white/10 bg-slate-900 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.5)]"
                  >
                    <div className="mb-3 flex items-center justify-between rounded-2xl bg-slate-950 p-1">
                      <button
                        onClick={() => handlePickerYearOffset(pickerMode === 'year' ? -12 : -1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 active:scale-95 active:bg-slate-800 active:text-white"
                        aria-label="Previous year range"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPickerMode((mode) => (mode === 'month' ? 'year' : 'month'))}
                        className="min-h-11 rounded-full px-5 text-base font-bold text-white active:scale-95 active:bg-slate-800"
                      >
                        {activeYear}
                      </button>
                      <button
                        onClick={() => handlePickerYearOffset(pickerMode === 'year' ? 12 : 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 active:scale-95 active:bg-slate-800 active:text-white"
                        aria-label="Next year range"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {pickerMode === 'month' ? (
                      <div className="grid grid-cols-3 gap-2">
                        {monthNames.map((month, index) => (
                          <button
                            key={month}
                            onClick={() => handleSelectPickerMonth(index)}
                            className={cn(
                              "min-h-12 rounded-2xl px-2 text-sm font-bold transition-colors active:scale-95",
                              index === activeMonth
                                ? "bg-blue-500 text-white"
                                : "bg-slate-950 text-slate-300 active:bg-slate-800 active:text-white"
                            )}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {yearOptions.map((year) => (
                          <button
                            key={year}
                            onClick={() => handleSelectPickerYear(year)}
                            className={cn(
                              "min-h-12 rounded-2xl px-2 text-sm font-bold transition-colors active:scale-95",
                              year === activeYear
                                ? "bg-blue-500 text-white"
                                : "bg-slate-950 text-slate-300 active:bg-slate-800 active:text-white"
                            )}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </div>
            <button
              onClick={() => handlePeriodChange(1)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-slate-300 active:scale-95 active:text-white"
              aria-label={view === 'week' ? 'Next week' : 'Next month'}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-hidden rounded-b-3xl">
            {view === 'week' ? (
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                onDragEnd={(_, info) => {
                  if (info.offset.x <= -48) handleWeekChange(1);
                  if (info.offset.x >= 48) handleWeekChange(-1);
                }}
                className="grid cursor-grab touch-pan-y grid-cols-7 gap-2 p-4 active:cursor-grabbing"
              >
                {weekDays.map((day) => (
                  <button
                    key={day.date.toISOString()}
                    onClick={() => handleSelectDay(day.date)}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-between rounded-2xl border px-1 py-3 active:scale-95",
                      sameDay(day.date, selectedDate)
                        ? "border-blue-500/40 bg-blue-500/20 text-white"
                        : "border-white/5 bg-slate-950 text-slate-300"
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase text-slate-500">{dayLabels[day.date.getDay()]}</span>
                    <span className={cn("text-base font-bold", day.isToday && "text-blue-400")}>{day.date.getDate()}</span>
                    <span className="flex h-4 items-center gap-0.5">
                      {day.events.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={cn("h-1.5 w-1.5 rounded-full", event.carNeeded ? "bg-blue-400" : "bg-emerald-400")}
                        />
                      ))}
                    </span>
                  </button>
                ))}
              </motion.div>
            ) : (
              <div>
                <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <button
                    onClick={handleOpenAddForm}
                    className="flex min-h-12 items-center gap-2 rounded-full bg-blue-500 px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(45,126,255,0.2)] active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>

                <div className="grid grid-cols-7 border-t border-white/5">
                  {dayLabels.map((day) => (
                    <div key={day} className="border-b border-white/5 py-2 text-center text-[10px] font-bold uppercase text-slate-500">
                      {day}
                    </div>
                  ))}

                  {monthDays.map((day) => (
                    <button
                      key={day.date.toISOString()}
                      onClick={() => handleSelectDay(day.date)}
                      className={cn(
                        "min-h-[86px] border-b border-r border-white/5 p-1.5 text-left align-top active:bg-slate-800",
                        !day.isCurrentMonth && "bg-slate-950/60 text-slate-600",
                        day.isCurrentMonth && "bg-slate-900 text-slate-300",
                        sameDay(day.date, selectedDate) && "bg-blue-500/10"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs font-bold",
                            day.isToday && "flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white",
                            !day.isCurrentMonth && "text-slate-600"
                          )}
                        >
                          {day.date.getDate() === 1 ? `${day.date.getDate()} ${shortMonthFormatter.format(day.date)}` : day.date.getDate()}
                        </span>
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        {day.events.slice(0, 2).map((event) => (
                          <div key={event.id} className="flex min-w-0 items-center gap-1 text-[9px] font-semibold leading-tight text-slate-100">
                            <span className={cn("h-2 w-0.5 shrink-0 rounded-full", event.carNeeded ? "bg-blue-400" : "bg-emerald-400")} />
                            <span className="truncate">{event.title}</span>
                          </div>
                        ))}
                        {day.events.length > 2 && (
                          <div className="text-[9px] font-bold text-slate-500">+{day.events.length - 2} more</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {openMenuId && (
        <button
          className="fixed inset-0 z-10 cursor-default"
          aria-label="Close schedule menu"
          onClick={() => setOpenMenuId(null)}
        />
      )}

      {view === 'week' && (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} Agenda
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleAnalyze}
              className="flex min-h-12 min-w-12 items-center justify-center rounded-full text-slate-400 transition-colors active:scale-95 active:bg-slate-900 active:text-white"
              title="Analyze with AI"
            >
              <BrainCircuit className={cn("h-5 w-5", analyzing && "animate-pulse text-blue-400")} />
            </button>
            {view === 'week' && (
              <button
                onClick={handleOpenAddForm}
                className="flex min-h-12 min-w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-[0_12px_30px_rgba(45,126,255,0.25)] active:scale-95"
                title="Add schedule"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {selectedEvents.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900 p-6 text-center">
            <p className="text-sm font-semibold text-slate-200">No schedule for this day</p>
            <p className="mt-1 text-xs text-slate-500">Use the month controls to check another date.</p>
          </div>
        )}

        {selectedEvents.map((event) => (
          <div
            key={event.id}
            onClick={() => {
              if (openMenuId === event.id) setOpenMenuId(null);
            }}
            className={cn(
              "group relative rounded-3xl border bg-slate-900 p-6 pr-16 transition-all duration-300 active:scale-[0.99]",
              openMenuId === event.id && "z-20",
              event.carNeeded ? "border-white/5 active:border-blue-500/30" : "border-white/5",
              event.category === 'other' ? "border-amber-500/20" : ""
            )}
          >
            <button
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                setOpenMenuId((current) => (current === event.id ? null : event.id));
              }}
              className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-slate-400 opacity-100 transition-opacity active:scale-95 active:text-white md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              aria-label="Schedule options"
              aria-expanded={openMenuId === event.id}
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {openMenuId === event.id && (
              <div
                className="absolute right-4 top-16 z-30 w-48 rounded-2xl border border-white/10 bg-slate-950 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
              >
                <button
                  onClick={() => handleOpenEditForm(event)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-200 active:bg-slate-800"
                >
                  <Pencil className="h-4 w-4 text-blue-400" />
                  Edit schedule
                </button>
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-300 active:bg-rose-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete schedule
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
                    event.carNeeded ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-400"
                  )}
                >
                  {event.carNeeded ? <Car className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  {event.status || (event.carNeeded ? 'Vehicle Required' : 'Remote / No Car')}
                </span>
              </div>

              <h4 className="text-xl font-bold text-slate-100">{event.title}</h4>

              <div className="flex flex-col items-start gap-2 text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  {event.time}
                </div>
                <div className="flex w-fit items-center gap-1.5 rounded-full border border-white/5 bg-slate-950 px-2.5 py-1 text-sm font-medium">
                  {event.carNeeded ? <MapPin className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  {event.location}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/60 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-20 no-scrollbar"
          onClick={handleCloseForm}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onPointerCancel={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <motion.form
            {...sheetDragScroll}
            onSubmit={handleSubmitSchedule}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              sheetDragScroll.onPointerDown(event);
              event.stopPropagation();
            }}
            onPointerMove={(event) => {
              sheetDragScroll.onPointerMove(event);
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              sheetDragScroll.onPointerUp(event);
              event.stopPropagation();
            }}
            onPointerCancel={(event) => {
              sheetDragScroll.onPointerCancel(event);
              event.stopPropagation();
            }}
            onLostPointerCapture={(event) => {
              sheetDragScroll.onLostPointerCapture(event);
              event.stopPropagation();
            }}
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mx-auto max-h-[82dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-slate-900 p-5 shadow-[0_-18px_55px_rgba(0,0,0,0.55)] no-scrollbar"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{editingEvent ? 'Edit schedule' : 'Add schedule'}</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {showDateField
                    ? 'Choose the date, time, destination, and vehicle need.'
                    : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-slate-400 active:scale-95 active:text-white"
                aria-label="Close schedule form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Schedule</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  required
                  className="h-[52px] w-full rounded-2xl border border-white/5 bg-slate-950 px-4 text-sm font-semibold text-white outline-none focus:border-blue-500/60"
                  placeholder="Client site visit"
                />
              </label>

              {showDateField && (
                <div className="relative">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Date</span>
                  <button
                    type="button"
                    onClick={() => setFormDatePickerOpen((isOpen) => !isOpen)}
                    className="flex h-[52px] w-full items-center justify-between rounded-2xl border border-white/5 bg-slate-950 px-4 text-left text-sm font-semibold text-white active:scale-[0.98] active:border-blue-500/60"
                  >
                    {formDate.toLocaleDateString('en-GB')}
                    <CalendarDays className="h-4 w-4 text-blue-400" />
                  </button>

                  {formDatePickerOpen && (
                    <div className="mt-3 rounded-3xl border border-white/10 bg-slate-900 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                      <div className="mb-3 flex items-center justify-between rounded-2xl bg-slate-950 p-1">
                        <button
                          type="button"
                          onClick={() => handleFormDateMonthChange(-1)}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 active:scale-95 active:bg-slate-800 active:text-white"
                          aria-label="Previous form month"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-bold text-white">{monthFormatter.format(formDateMonth)}</span>
                        <button
                          type="button"
                          onClick={() => handleFormDateMonthChange(1)}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 active:scale-95 active:bg-slate-800 active:text-white"
                          aria-label="Next form month"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {dayLabels.map((day) => (
                          <div key={day} className="py-1 text-center text-[10px] font-bold uppercase text-slate-500">
                            {day.slice(0, 2)}
                          </div>
                        ))}
                        {formDateDays.map((day) => (
                          <button
                            key={day.date.toISOString()}
                            type="button"
                            onClick={() => handleSelectFormDate(day.date)}
                            className={cn(
                              "flex h-10 items-center justify-center rounded-xl text-sm font-bold active:scale-95",
                              sameDay(day.date, formDate)
                                ? "bg-blue-500 text-white"
                                : day.isCurrentMonth
                                  ? "bg-slate-950 text-slate-200 active:bg-slate-800"
                                  : "bg-slate-950/60 text-slate-600 active:bg-slate-800"
                            )}
                          >
                            {day.date.getDate()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">When</span>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    required
                    className="h-[52px] w-full rounded-2xl border border-white/5 bg-slate-950 px-4 text-sm font-semibold text-white outline-none focus:border-blue-500/60"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTimeOffset(30)}
                      className="min-h-10 rounded-xl border border-white/5 bg-slate-950 px-3 text-xs font-bold text-slate-300 active:scale-95 active:border-blue-500/40 active:text-white"
                    >
                      +30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTimeOffset(60)}
                      className="min-h-10 rounded-xl border border-white/5 bg-slate-950 px-3 text-xs font-bold text-slate-300 active:scale-95 active:border-blue-500/40 active:text-white"
                    >
                      +1 hour
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Vehicle</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, carNeeded: !current.carNeeded }))}
                    className={cn(
                      "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold active:scale-[0.98]",
                      form.carNeeded
                        ? "border-blue-500/40 bg-blue-500/20 text-blue-400"
                        : "border-white/5 bg-slate-950 text-slate-400"
                    )}
                  >
                    {form.carNeeded ? <Car className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    {form.carNeeded ? 'Needs car' : 'No car'}
                  </button>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Where</span>
                <input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  required
                  className="h-[52px] w-full rounded-2xl border border-white/5 bg-slate-950 px-4 text-sm font-semibold text-white outline-none focus:border-blue-500/60"
                  placeholder="Office - Building 4"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!form.title.trim() || !form.location.trim()}
              className="mt-6 h-[52px] w-full rounded-2xl bg-blue-500 text-sm font-bold text-white shadow-[0_12px_30px_rgba(45,126,255,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              {editingEvent ? 'Save schedule' : 'Add schedule'}
            </button>
          </motion.form>
        </div>
      )}
    </motion.div>
  );
}
