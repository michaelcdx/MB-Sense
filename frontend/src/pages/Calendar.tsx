import { motion } from 'motion/react';
import { CalendarEvent, useAppStore } from '../store/useAppStore';
import { BrainCircuit, CalendarDays, Car, ChevronLeft, ChevronRight, Clock, MapPin, Video } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

type CalendarView = 'week' | 'month';
type PickerMode = 'month' | 'year';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
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
  const [analyzing, setAnalyzing] = useState(false);
  const [view, setView] = useState<CalendarView>('week');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const monthDays = buildMonthDays(visibleMonth, events);
  const weekDays = buildWeekDays(selectedDate, events);
  const selectedEvents = sortEvents(events.filter((event) => sameDay(getEventDate(event), selectedDate)));
  const vehicleAssignments = events.filter((event) => event.carNeeded).length;
  const activeYear = visibleMonth.getFullYear();
  const activeMonth = visibleMonth.getMonth();
  const yearOptions = buildYearOptions(activeYear);

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

    if (view === 'month' && date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
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
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} Agenda
          </h3>
          <button
            onClick={handleAnalyze}
            className="flex min-h-12 min-w-12 items-center justify-center text-slate-400 transition-colors active:scale-95 active:text-white"
            title="Analyze with AI"
          >
            <BrainCircuit className={cn("h-5 w-5", analyzing && "animate-pulse text-blue-400")} />
          </button>
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
            className={cn(
              "relative rounded-3xl border bg-slate-900 p-6 transition-all duration-300 active:scale-[0.99]",
              event.carNeeded ? "border-white/5 active:border-blue-500/30" : "border-white/5",
              event.category === 'other' ? "border-amber-500/20" : ""
            )}
          >
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
    </motion.div>
  );
}
