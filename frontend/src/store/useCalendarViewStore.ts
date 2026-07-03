import { create } from 'zustand';

const demoStart = new Date(2026, 5, 15);
const demoEnd = new Date(2026, 6, 30);
const fallbackDemoDate = new Date(2026, 6, 1);

const monthHeaderFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export function startOfCalendarDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfCalendarWeek(date: Date) {
  const normalized = startOfCalendarDay(date);
  const mondayOffset = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - mondayOffset);
  return normalized;
}

export function startOfCalendarMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addCalendarDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addCalendarMonths(date: Date, amount: number) {
  const next = startOfCalendarMonth(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function getInitialCalendarDate() {
  const today = startOfCalendarDay(new Date());
  return today >= startOfCalendarDay(demoStart) && today <= startOfCalendarDay(demoEnd) ? today : fallbackDemoDate;
}

export function getAvailableCalendarWeeks() {
  const months: Date[] = [];
  for (let cursor = startOfCalendarMonth(demoStart); cursor <= startOfCalendarMonth(demoEnd); cursor = addCalendarMonths(cursor, 1)) {
    months.push(new Date(cursor));
  }
  return months;
}

export function getCalendarWeekRangeLabel(monthStart: Date) {
  return monthHeaderFormatter.format(monthStart);
}

export function getCalendarMonthHeaderLabel(weekStart: Date) {
  return monthHeaderFormatter.format(weekStart);
}

export function toCalendarDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromCalendarDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface CalendarViewStore {
  selectedDate: Date;
  weekStart: Date;
  setSelectedDate: (date: Date) => void;
  setActiveWeek: (date: Date) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToTodayWeek: () => void;
}

const initialDate = getInitialCalendarDate();

export const useCalendarViewStore = create<CalendarViewStore>((set) => ({
  selectedDate: startOfCalendarDay(initialDate),
  weekStart: startOfCalendarMonth(initialDate),
  setSelectedDate: (date) => set({ selectedDate: startOfCalendarDay(date) }),
  setActiveWeek: (date) => set({
    selectedDate: startOfCalendarDay(date),
    weekStart: startOfCalendarMonth(date),
  }),
  goToPreviousWeek: () => set((state) => {
    const previousWeek = addCalendarMonths(state.weekStart, -1);
    return {
      selectedDate: startOfCalendarDay(previousWeek),
      weekStart: startOfCalendarMonth(previousWeek),
    };
  }),
  goToNextWeek: () => set((state) => {
    const nextWeek = addCalendarMonths(state.weekStart, 1);
    return {
      selectedDate: startOfCalendarDay(nextWeek),
      weekStart: startOfCalendarMonth(nextWeek),
    };
  }),
  goToTodayWeek: () => {
    const today = getInitialCalendarDate();
    set({
      selectedDate: startOfCalendarDay(today),
      weekStart: startOfCalendarMonth(today),
    });
  },
}));
