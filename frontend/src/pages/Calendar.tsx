import { motion } from 'motion/react';
import { CalendarEvent, useAppStore, type ChargingStationCalendarOption } from '../store/useAppStore';
import { AlertTriangle, BatteryCharging, BrainCircuit, Car, Check, Crosshair, MapPin, Plus, Save, Search, Trash2, Video, X, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import GlassButton from '../components/GlassButton';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useCalendarViewStore } from '../store/useCalendarViewStore';
import { useLocation } from 'react-router-dom';
import { buildCalendarEventFromChargingPlan } from '../lib/chargingPlanner';

type EventMode = 'create' | 'edit';
type EventColor = 'graphite' | 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cream' | 'general' | 'study' | 'assignment' | 'urgent' | 'charging' | 'risk';

const eventColorOptions: { value: EventColor; label: string; backgroundColor: string }[] = [
  { value: 'general', label: 'Work / Meeting', backgroundColor: '#D8E8FF' },
  { value: 'study', label: 'Class / Study', backgroundColor: '#E7DCFF' },
  { value: 'assignment', label: 'Assignment / Deadline', backgroundColor: '#FFDAD6' },
  { value: 'urgent', label: 'Important / Urgent', backgroundColor: '#FFD7E2' },
  { value: 'charging', label: 'AI Charging Recommendation', backgroundColor: '#D8F8E7' },
  { value: 'risk', label: 'Battery Risk Warning', backgroundColor: '#FFE8BC' },
  { value: 'graphite', label: 'Graphite', backgroundColor: '#E1E7EA' },
  { value: 'blue', label: 'Blue', backgroundColor: '#D4E3FF' },
  { value: 'green', label: 'Green', backgroundColor: '#D8F2DD' },
  { value: 'amber', label: 'Amber', backgroundColor: '#FFE0B2' },
  { value: 'rose', label: 'Rose', backgroundColor: '#FFD9E2' },
  { value: 'violet', label: 'Violet', backgroundColor: '#E5D9FF' },
  { value: 'cream', label: 'Cream', backgroundColor: '#FFF1C7' }
];

const eventColorStyles: Record<EventColor, { backgroundColor: string }> = eventColorOptions.reduce((styles, option) => ({
  ...styles,
  [option.value]: { backgroundColor: option.backgroundColor }
}), {} as Record<EventColor, { backgroundColor: string }>);

const defaultEventTextStyle = { color: '#25313A' };

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

type LocationMode = 'place' | 'coordinates';

type MalaysiaLocationSuggestion = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  keywords?: string[];
};

type CoordinateDraft = {
  lat: string;
  lng: string;
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
const initialCalendarScrollHour = 12;
const demoStart = new Date(2026, 5, 15);
const demoEnd = new Date(2026, 6, 30);
const fallbackDemoDate = new Date(2026, 6, 1);
const malaysiaBounds = {
  north: 7.6,
  south: 0.85,
  east: 119.3,
  west: 99.6,
};

const runtimeGoogleMapsKey =
  'GOOGLE_MAPS_PLATFORM_KEY' in globalThis
    ? String((globalThis as { GOOGLE_MAPS_PLATFORM_KEY?: string }).GOOGLE_MAPS_PLATFORM_KEY ?? '')
    : '';
const processGoogleMapsKey = typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_PLATFORM_KEY || '' : '';
type ViteImportMeta = ImportMeta & {
  env: {
    VITE_GOOGLE_MAPS_PLATFORM_KEY?: string;
    VITE_GOOGLE_MAPS_KEY?: string;
  };
};
const viteEnv = (import.meta as ViteImportMeta).env;
const googlePlacesApiKey =
  processGoogleMapsKey ||
  viteEnv.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  viteEnv.VITE_GOOGLE_MAPS_KEY ||
  runtimeGoogleMapsKey ||
  '';
const hasGooglePlacesKey = Boolean(googlePlacesApiKey) && googlePlacesApiKey !== 'YOUR_API_KEY';

const malaysiaLocationSuggestions: MalaysiaLocationSuggestion[] = [
  {
    id: 'trx-exchange',
    name: 'The Exchange TRX',
    address: 'Persiaran TRX, Tun Razak Exchange, 55188 Kuala Lumpur, Malaysia',
    lat: 3.1427,
    lng: 101.718,
    keywords: ['trx', 'tun razak exchange', 'exchange trx', 'trx mall'],
  },
  {
    id: 'trx-tower',
    name: 'TRX Exchange 106',
    address: 'Lingkaran TRX, Tun Razak Exchange, 55188 Kuala Lumpur, Malaysia',
    lat: 3.1421,
    lng: 101.7166,
    keywords: ['trx', 'exchange 106', 'tun razak exchange', 'office'],
  },
  {
    id: 'suria-klcc',
    name: 'Suria KLCC',
    address: 'Kuala Lumpur City Centre, 50088 Kuala Lumpur, Malaysia',
    lat: 3.1579,
    lng: 101.7121,
    keywords: ['klcc', 'petronas', 'suria'],
  },
  {
    id: 'pavilion-kl',
    name: 'Pavilion Kuala Lumpur',
    address: '168 Jalan Bukit Bintang, 55100 Kuala Lumpur, Malaysia',
    lat: 3.1491,
    lng: 101.7136,
    keywords: ['pavilion', 'bukit bintang'],
  },
  {
    id: 'mbm-puchong',
    name: 'Mercedes-Benz Malaysia HQ',
    address: 'Puchong, Selangor, Malaysia',
    lat: 3.0323,
    lng: 101.6176,
    keywords: ['mercedes', 'hq', 'puchong', 'mbm'],
  },
  {
    id: 'mcd-klcc',
    name: "McDonald's Suria KLCC",
    address: 'Suria KLCC, Kuala Lumpur City Centre, 50088 Kuala Lumpur, Malaysia',
    lat: 3.158,
    lng: 101.7122,
    keywords: ['mcdonalds', 'mcdonald', 'mcd', 'klcc'],
  },
  {
    id: 'mcd-bukit-bintang',
    name: "McDonald's Bukit Bintang",
    address: 'Jalan Bukit Bintang, Bukit Bintang, 55100 Kuala Lumpur, Malaysia',
    lat: 3.1467,
    lng: 101.7112,
    keywords: ['mcdonalds', 'mcdonald', 'mcd', 'bukit bintang'],
  },
  {
    id: 'mcd-bangsar',
    name: "McDonald's Bangsar",
    address: 'Bangsar Baru, 59100 Kuala Lumpur, Malaysia',
    lat: 3.1308,
    lng: 101.6709,
    keywords: ['mcdonalds', 'mcdonald', 'mcd', 'bangsar'],
  },
  {
    id: 'mcd-ss2',
    name: "McDonald's SS2 Petaling Jaya",
    address: 'SS2, 47300 Petaling Jaya, Selangor, Malaysia',
    lat: 3.1188,
    lng: 101.6233,
    keywords: ['mcdonalds', 'mcdonald', 'mcd', 'ss2', 'petaling jaya', 'pj'],
  },
  {
    id: 'mcd-ttdi',
    name: "McDonald's TTDI",
    address: 'Taman Tun Dr Ismail, 60000 Kuala Lumpur, Malaysia',
    lat: 3.1397,
    lng: 101.6304,
    keywords: ['mcdonalds', 'mcdonald', 'mcd', 'ttdi', 'taman tun'],
  },
];

let googlePlacesLibraryPromise: Promise<void> | null = null;

const dayHeaderFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric' });
const weekRangeFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

function loadGooglePlacesLibrary() {
  if (!hasGooglePlacesKey || typeof document === 'undefined') return Promise.reject(new Error('Google Places API key is not configured.'));
  if (typeof google !== 'undefined' && google.maps?.places?.Autocomplete) return Promise.resolve();
  if (typeof google !== 'undefined' && google.maps?.importLibrary) {
    return google.maps.importLibrary('places').then(() => undefined);
  }
  if (googlePlacesLibraryPromise) return googlePlacesLibraryPromise;

  googlePlacesLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googlePlacesApiKey)}&libraries=places&loading=async`;
    script.dataset.calendarGooglePlaces = 'true';
    script.addEventListener('load', () => {
      if (typeof google !== 'undefined' && google.maps?.places?.Autocomplete) resolve();
      else reject(new Error('Google Places library did not load.'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('Google Places library failed to load.')), { once: true });
    document.head.appendChild(script);
  });

  return googlePlacesLibraryPromise;
}

function normalizeLocationSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactLocationSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getMalaysiaLocationMatches(query: string) {
  const normalized = normalizeLocationSearch(query);
  const compactQuery = compactLocationSearch(query);
  if (normalized.length < 2 && compactQuery.length < 2) return [];

  const tokens = normalized.split(' ').filter(Boolean);

  return malaysiaLocationSuggestions
    .filter((suggestion) => {
      const source = [suggestion.name, suggestion.address, ...(suggestion.keywords ?? [])].join(' ');
      const normalizedSource = normalizeLocationSearch(source);
      const compactSource = compactLocationSearch(source);

      return tokens.every((token) => normalizedSource.includes(token) || compactSource.includes(compactLocationSearch(token)))
        || (compactQuery.length >= 2 && compactSource.includes(compactQuery));
    })
    .slice(0, 6);
}

function formatSuggestionLocation(suggestion: MalaysiaLocationSuggestion) {
  return `${suggestion.name}, ${suggestion.address}`;
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parseCoordinateString(value: string) {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return isValidCoordinate(lat, lng) ? { lat, lng } : null;
}

function parseCoordinateDraft(draft: CoordinateDraft) {
  const lat = Number(draft.lat);
  const lng = Number(draft.lng);
  return isValidCoordinate(lat, lng) ? { lat, lng } : null;
}

function coordinateDraftFromLocation(value: string): CoordinateDraft {
  const parsed = parseCoordinateString(value);
  return parsed ? { lat: String(parsed.lat), lng: String(parsed.lng) } : { lat: '', lng: '' };
}

function formatCoordinateLocation(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

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

function formatChoiceWindow(start?: string, end?: string) {
  if (!start || !end) return 'No window';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'No window';

  const day = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${startTime}-${endTime}`;
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

function getTravelStatus(carNeeded: boolean) {
  return carNeeded ? 'Vehicle Required' : 'Remote / No Car';
}

function getEventColor(event: CalendarEvent) {
  return ((event as CalendarEvent & { color?: EventColor }).color ?? getDefaultEventColor(event));
}

function getEventTone(_event: CalendarEvent) {
  return 'calendar-solid-event text-inverse-on-surface';
}

function getEventColorStyle(event: CalendarEvent) {
  if (event.aiChargingPlan) {
    const amber = event.aiChargingPlan.riskLevel === 'high' || event.aiChargingPlan.calendarAction.colorType === 'battery-risk';
    return { backgroundColor: amber ? '#FFE8BC' : '#D8F8E7' };
  }
  return eventColorStyles[getEventColor(event)];
}

function getEventTextColorStyle(event: CalendarEvent) {
  if (event.aiChargingPlan) {
    const amber = event.aiChargingPlan.riskLevel === 'high' || event.aiChargingPlan.calendarAction.colorType === 'battery-risk';
    return { color: amber ? '#714A00' : '#165C3B' };
  }
  return defaultEventTextStyle;
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
    status: getTravelStatus(true),
    notes: '',
    color: 'general'
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
    status: getTravelStatus(event.carNeeded),
    notes: event.notes ?? '',
    color: getEventColor(event)
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

function DayColumn({ day, dayIndex, events, selection, selectedEventId, onEventClick, onPointerDown, onPointerMove, onPointerUp }: {
  day: Date;
  dayIndex: number;
  events: CalendarEvent[];
  selection: DragSelection | null;
  selectedEventId?: string;
  onEventClick: (event: CalendarEvent) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, dayIndex: number, date: Date) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const laidOutEvents = buildEventHorizontalLayouts(events);

  return (
    <div className="relative border-r border-outline-variant/30 bg-surface-container-lowest last:border-r-0" style={{ height: calendarHeight }} onPointerDown={(event) => onPointerDown(event, dayIndex, day)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
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
  const initialScrollDoneRef = useRef(false);
  const gridTemplateColumns = `${timeColumnWidth}px repeat(${days.length}, minmax(${dayColumnMinWidth}px, 1fr))`;

  useEffect(() => {
    if (initialScrollDoneRef.current || !scrollRef.current) return;
    initialScrollDoneRef.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: initialCalendarScrollHour * hourHeight, behavior: 'auto' });
    });
  }, []);

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
              <DayColumn key={day.toISOString()} day={day} dayIndex={index} events={events.filter((event) => sameDay(getEventDate(event), day))} selection={selection} selectedEventId={selectedEventId} onEventClick={onEventClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LocationModeButton({ active, icon: Icon, label, onClick }: {
  active: boolean;
  icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex h-9 items-center justify-center gap-2 rounded-md border px-2 text-xs font-semibold transition', active ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-primary')}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
      {active && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

function EventSidePanel({ mode, form, editingEvent, onChange, onClose, onDelete, onSubmit, onStationSelect, onAddChargingPlan }: {
  mode: EventMode | null;
  form: ScheduleForm;
  editingEvent: CalendarEvent | null;
  onChange: (form: ScheduleForm) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStationSelect: (station: ChargingStationCalendarOption) => void;
  onAddChargingPlan: (event: CalendarEvent) => void;
}) {
  const formRef = useRef(form);
  const onChangeRef = useRef(onChange);
  const placeInputRef = useRef<HTMLInputElement>(null);
  const autocompleteListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>(() => parseCoordinateString(form.location) ? 'coordinates' : 'place');
  const [placeQuery, setPlaceQuery] = useState(form.location);
  const [placeFocused, setPlaceFocused] = useState(false);
  const [placesStatus, setPlacesStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>(hasGooglePlacesKey ? 'idle' : 'unavailable');
  const [stationPickerOpen, setStationPickerOpen] = useState(false);
  const [coordinateDraft, setCoordinateDraft] = useState<CoordinateDraft>(() => coordinateDraftFromLocation(form.location));
  const localPlaceMatches = useMemo(() => getMalaysiaLocationMatches(placeQuery), [placeQuery]);
  const coordinateValue = parseCoordinateDraft(coordinateDraft);
  const coordinateStarted = Boolean(coordinateDraft.lat.trim() || coordinateDraft.lng.trim());
  const coordinateInvalid = locationMode === 'coordinates' && coordinateStarted && !coordinateValue;
  const showLocalPlaceMatches = locationMode === 'place' && placeFocused && localPlaceMatches.length > 0 && placesStatus !== 'ready';
  const chargingMeta = editingEvent?.chargingMeta;
  const sortedChargingChoices = useMemo(() => [...(chargingMeta?.choiceOptions ?? [])].sort((a, b) => a.rank - b.rank), [chargingMeta?.choiceOptions]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    setStationPickerOpen(false);
  }, [editingEvent?.id, mode]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const parsed = parseCoordinateString(form.location);
    setLocationMode(parsed ? 'coordinates' : 'place');
    setPlaceQuery(parsed ? '' : form.location);
    setCoordinateDraft(parsed ? { lat: String(parsed.lat), lng: String(parsed.lng) } : { lat: '', lng: '' });
  }, [editingEvent?.id, form.date, form.endTime, form.startTime, mode]);

  useEffect(() => {
    if (!mode || locationMode !== 'place' || !hasGooglePlacesKey) return;

    let cancelled = false;
    autocompleteListenerRef.current?.remove();
    autocompleteListenerRef.current = null;
    setPlacesStatus('loading');

    loadGooglePlacesLibrary()
      .then(() => {
        if (cancelled || !placeInputRef.current) return;

        const bounds = new google.maps.LatLngBounds(
          { lat: malaysiaBounds.south, lng: malaysiaBounds.west },
          { lat: malaysiaBounds.north, lng: malaysiaBounds.east }
        );
        const autocomplete = new google.maps.places.Autocomplete(placeInputRef.current, {
          bounds,
          componentRestrictions: { country: 'my' },
          fields: ['formatted_address', 'geometry', 'name'],
          strictBounds: false,
        });

        autocompleteListenerRef.current = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const displayLocation = [place.name, place.formatted_address].filter(Boolean).join(', ') || placeInputRef.current?.value || '';
          setPlaceQuery(displayLocation);
          onChangeRef.current({ ...formRef.current, location: displayLocation });
        });
        setPlacesStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setPlacesStatus('unavailable');
      });

    return () => {
      cancelled = true;
      autocompleteListenerRef.current?.remove();
      autocompleteListenerRef.current = null;
    };
  }, [locationMode, mode]);

  const setLocationFromPlace = (value: string) => {
    setPlaceQuery(value);
    onChange({ ...form, location: value });
  };

  const selectLocationSuggestion = (suggestion: MalaysiaLocationSuggestion) => {
    setLocationFromPlace(formatSuggestionLocation(suggestion));
    setPlaceFocused(false);
  };

  const updateCoordinateDraft = (nextDraft: CoordinateDraft) => {
    setCoordinateDraft(nextDraft);
    const nextCoordinate = parseCoordinateDraft(nextDraft);
    onChange({ ...form, location: nextCoordinate ? formatCoordinateLocation(nextCoordinate.lat, nextCoordinate.lng) : '' });
  };

  const selectLocationMode = (nextMode: LocationMode) => {
    setLocationMode(nextMode);
    setPlaceFocused(false);

    if (nextMode === 'place') {
      const nextPlace = parseCoordinateString(form.location) ? '' : form.location;
      setPlaceQuery(nextPlace);
      onChange({ ...form, location: nextPlace });
      return;
    }

    const nextDraft = coordinateDraftFromLocation(form.location);
    setCoordinateDraft(nextDraft);
    const nextCoordinate = parseCoordinateDraft(nextDraft);
    onChange({ ...form, location: nextCoordinate ? formatCoordinateLocation(nextCoordinate.lat, nextCoordinate.lng) : '' });
  };

  if (!mode) return null;

  const chargingContext = editingEvent
    ? isChargingEvent(editingEvent) || isRiskEvent(editingEvent)
    : form.category === 'charging' || form.category === 'risk' || form.title.toLowerCase().includes('charge');
  const aiPlan = editingEvent?.aiChargingPlan;
  const travelStatus = getTravelStatus(form.carNeeded);
  const formatAiPlanDateTime = (value: string | null) => {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const selectChargingStation = (station: ChargingStationCalendarOption) => {
    onStationSelect(station);
    setStationPickerOpen(false);
  };
  const toggleTravelStatus = () => {
    const nextCarNeeded = !form.carNeeded;
    onChange({ ...form, carNeeded: nextCarNeeded, status: getTravelStatus(nextCarNeeded) });
  };

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

        {aiPlan && (
          <div className="mb-4 rounded-lg border border-emerald-300/25 bg-surface-container-lowest p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500"><BrainCircuit className="h-4 w-4" />AI charging planner</div>
            <h4 className="mt-2 text-sm font-semibold text-on-surface">{aiPlan.title}</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-on-surface-variant">{aiPlan.summary}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Risk level</p><p className="mt-1 font-semibold capitalize text-on-surface">{aiPlan.riskLevel}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Mobility confidence</p><p className="mt-1 font-semibold text-on-surface">{aiPlan.mobilityConfidenceScore}%</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Current battery</p><p className="mt-1 font-semibold text-on-surface">{aiPlan.currentBatteryPercent}%</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Target battery</p><p className="mt-1 font-semibold text-on-surface">{aiPlan.targetBatteryPercent ?? 'None'}{aiPlan.targetBatteryPercent ? '%' : ''}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Predicted lowest</p><p className="mt-1 font-semibold text-on-surface">{aiPlan.predictedLowestBatteryPercent}%</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">After schedule</p><p className="mt-1 font-semibold text-on-surface">{aiPlan.predictedBatteryAfterSchedule}%</p></div>
            </div>
            <div className="mt-3 rounded-md bg-surface-container-low p-2 text-[11px]">
              <p className="font-semibold text-on-surface">{aiPlan.chargingLocationName ?? 'Charging location'} · {aiPlan.chargingType.replace(/_/g, ' ')}</p>
              <p className="mt-1 text-slate-500">{formatAiPlanDateTime(aiPlan.recommendedChargingStart)} - {formatAiPlanDateTime(aiPlan.recommendedChargingEnd)}</p>
            </div>
            <p className="mt-3 text-xs font-medium leading-relaxed text-on-surface-variant">{aiPlan.reason}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Battery risk</p><p className="mt-1 font-semibold capitalize text-on-surface">{aiPlan.riskBreakdown.batteryRisk}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Opportunity risk</p><p className="mt-1 font-semibold capitalize text-on-surface">{aiPlan.riskBreakdown.chargingOpportunityRisk}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Schedule risk</p><p className="mt-1 font-semibold capitalize text-on-surface">{aiPlan.riskBreakdown.scheduleDisruptionRisk}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Weather/traffic</p><p className="mt-1 font-semibold capitalize text-on-surface">{aiPlan.riskBreakdown.weatherTrafficRisk}</p></div>
            </div>
            {aiPlan.backupPlan.available && (
              <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-500/10 p-2 text-[11px]">
                <p className="font-semibold text-amber-500">{aiPlan.backupPlan.title ?? 'Backup charging plan'}</p>
                <p className="mt-1 text-on-surface">{aiPlan.backupPlan.locationName ?? 'Backup location'}</p>
                <p className="mt-1 text-slate-500">{formatAiPlanDateTime(aiPlan.backupPlan.startTime)} - {formatAiPlanDateTime(aiPlan.backupPlan.endTime)}</p>
                {aiPlan.backupPlan.reason && <p className="mt-1 leading-relaxed text-on-surface-variant">{aiPlan.backupPlan.reason}</p>}
              </div>
            )}
            <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-on-surface-variant">
              <p>{aiPlan.sidePanelDetails.batteryExplanation}</p>
              <p>{aiPlan.sidePanelDetails.scheduleExplanation}</p>
              <p>{aiPlan.sidePanelDetails.chargingExplanation}</p>
              <p>{aiPlan.sidePanelDetails.backupExplanation}</p>
            </div>
            {aiPlan.calendarAction.shouldCreateEvent && editingEvent && (
              <button type="button" onClick={() => onAddChargingPlan(editingEvent)} className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-black uppercase tracking-widest text-on-primary transition active:scale-[0.99]">
                <BatteryCharging className="h-3.5 w-3.5" />
                {aiPlan.sidePanelDetails.userActionText}
              </button>
            )}
          </div>
        )}

        {chargingContext && (
          <div className="mb-4 rounded-lg border border-outline-variant/45 bg-surface-container-lowest p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-500"><BatteryCharging className="h-4 w-4 text-emerald-500" />Charging prediction</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Mode</p><p className="mt-1 font-semibold text-on-surface">{chargingMeta?.mode ?? 'AI'}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Target</p><p className="mt-1 font-semibold text-on-surface">{chargingMeta ? `${chargingMeta.targetBattery}%` : '80%'}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Duration</p><p className="mt-1 font-semibold text-on-surface">{chargingMeta ? `${chargingMeta.minutesNeeded} min` : 'Predicted'}</p></div>
              <div className="rounded-md bg-surface-container-low p-2"><p className="text-slate-500">Connector</p><p className="mt-1 font-semibold text-on-surface">{chargingMeta?.connector ?? 'CCS2'}</p></div>
            </div>
            {chargingMeta?.selectedStation && (
              <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-500/10 p-2 text-[11px]">
                <p className="font-semibold text-emerald-500">Top selected station</p>
                <p className="mt-1 font-semibold text-on-surface">{chargingMeta.selectedStation.name}</p>
                <p className="mt-1 text-slate-500">{chargingMeta.selectedStation.provider} � {chargingMeta.selectedStation.maxPowerKw} kW � {chargingMeta.selectedStation.distanceFromAnchorKm} km from {chargingMeta.anchorLocation}</p>
              </div>
            )}
            {sortedChargingChoices.length ? (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">AI choices</p>
                {sortedChargingChoices.slice(0, 5).map((choice) => (
                  <div key={choice.id} className="rounded-md bg-surface-container-low p-2 text-[11px]">
                    <p className="font-semibold text-on-surface">{choice.rank}. {choice.mode}{choice.stationName ? ` � ${choice.stationName}` : ''}</p>
                    <p className="mt-1 text-slate-500">{formatChoiceWindow(choice.start, choice.end)}</p>
                    <p className="mt-1 leading-relaxed text-on-surface-variant">{choice.reason}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {chargingMeta?.stationOptions.length ? (
              <div className="mt-3 space-y-2">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top CCS2 stations</p>
                  <button type="button" onClick={() => setStationPickerOpen(true)} className="flex min-h-8 w-full items-center justify-center gap-1.5 rounded-md border border-outline-variant/45 bg-surface-container-low px-2 py-1.5 text-center text-[10px] font-semibold leading-tight text-on-surface-variant transition hover:border-primary/40 hover:text-primary">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>Select another charging station</span>
                  </button>
                </div>
                {chargingMeta.stationOptions.slice(0, 5).map((station, index) => (
                  <div key={station.id} className="rounded-md bg-surface-container-low p-2 text-[11px]">
                    <p className="font-semibold text-on-surface">{index + 1}. {station.name}</p>
                    <p className="mt-1 text-slate-500">{station.connector} � {station.maxPowerKw} kW � {station.distanceFromAnchorKm} km away � {station.detourKm} km detour</p>
                  </div>
                ))}
              </div>
            ) : null}
            {stationPickerOpen && chargingMeta?.stationOptions.length ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
                <button type="button" className="absolute inset-0" onClick={() => setStationPickerOpen(false)} aria-label="Close charging station selector" />
                <div className="relative z-10 max-h-[82vh] w-full max-w-lg overflow-hidden rounded-lg border border-outline-variant/45 bg-surface-container-lowest shadow-ambient-lg">
                  <div className="flex items-start justify-between gap-3 border-b border-outline-variant/45 p-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Available DC charging stations</p>
                      <h4 className="mt-1 text-sm font-semibold text-on-surface">Select another charging station</h4>
                    </div>
                    <button type="button" onClick={() => setStationPickerOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container" aria-label="Close station selector"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="max-h-[62vh] space-y-2 overflow-y-auto p-3">
                    {chargingMeta.stationOptions.slice(0, 5).map((station, index) => {
                      const selected = station.id === chargingMeta.selectedStation?.id;
                      return (
                        <button key={station.id} type="button" onClick={() => selectChargingStation(station)} className={cn('w-full rounded-md border p-3 text-left transition', selected ? 'border-emerald-300/35 bg-emerald-500/10' : 'border-outline-variant/45 bg-surface-container-low hover:border-primary/40')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-on-surface">{index + 1}. {station.name}</p>
                              <p className="mt-1 text-[11px] font-medium text-slate-500">{station.provider} � {station.connector} � {station.maxPowerKw} kW � {station.stalls} stalls</p>
                              <p className="mt-1 text-[11px] text-on-surface-variant">{station.address}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{station.distanceFromAnchorKm} km from {chargingMeta.anchorLocation} � {station.detourKm} km detour</p>
                            </div>
                            {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
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
          <div className="space-y-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Location type</span>
            <div className="grid grid-cols-2 gap-2">
              <LocationModeButton active={locationMode === 'place'} icon={Search} label="Place name" onClick={() => selectLocationMode('place')} />
              <LocationModeButton active={locationMode === 'coordinates'} icon={Crosshair} label="Coordinates" onClick={() => selectLocationMode('coordinates')} />
            </div>

            {locationMode === 'place' ? (
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Place name</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    ref={placeInputRef}
                    value={placeQuery}
                    onBlur={() => window.setTimeout(() => setPlaceFocused(false), 120)}
                    onChange={(event) => setLocationFromPlace(event.target.value)}
                    onFocus={() => setPlaceFocused(true)}
                    required
                    className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest pl-8 pr-2.5 text-xs font-medium text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45"
                    placeholder="TRX or McDonalds"
                  />
                  {showLocalPlaceMatches && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-56 overflow-y-auto rounded-md border border-outline-variant/45 bg-surface-container-lowest p-1 shadow-ambient-lg">
                      {localPlaceMatches.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => selectLocationSuggestion(suggestion)}
                          onMouseDown={(event) => event.preventDefault()}
                          className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition hover:bg-surface-container-low"
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-on-surface">{suggestion.name}</span>
                            <span className="mt-0.5 block truncate text-[10px] font-medium text-on-surface-variant">{suggestion.address}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Latitude</span>
                    <input
                      inputMode="decimal"
                      value={coordinateDraft.lat}
                      onChange={(event) => updateCoordinateDraft({ ...coordinateDraft, lat: event.target.value })}
                      className={cn('h-9 w-full rounded-md border bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45', coordinateInvalid ? 'border-rose-300/45' : 'border-outline-variant/45')}
                      placeholder="3.142700"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Longitude</span>
                    <input
                      inputMode="decimal"
                      value={coordinateDraft.lng}
                      onChange={(event) => updateCoordinateDraft({ ...coordinateDraft, lng: event.target.value })}
                      className={cn('h-9 w-full rounded-md border bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none placeholder:text-slate-500 focus:border-primary/45', coordinateInvalid ? 'border-rose-300/45' : 'border-outline-variant/45')}
                      placeholder="101.718000"
                    />
                  </label>
                </div>
                {coordinateInvalid && <p className="mt-1.5 text-[10px] font-semibold text-rose-500">Enter latitude from -90 to 90 and longitude from -180 to 180.</p>}
                {coordinateValue && <p className="mt-1.5 text-[10px] font-semibold text-primary">Saved as {formatCoordinateLocation(coordinateValue.lat, coordinateValue.lng)}</p>}
              </div>
            )}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Event Type / Use</span>
            <select value={form.category} onChange={(event) => { const category = event.target.value as CalendarEvent['category']; const color = getDefaultEventColor({ title: form.title, status: form.status, carNeeded: form.carNeeded, category }); onChange({ ...form, category, color }); }} className="h-9 w-full rounded-md border border-outline-variant/45 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface outline-none focus:border-primary/45"><option value="work">Work / Meeting</option><option value="study">Class / Study</option><option value="assignment">Assignment / Deadline</option><option value="important">Important / Urgent</option><option value="charging">AI Charging Recommendation</option><option value="risk">Battery Risk Warning</option><option value="personal">Personal</option><option value="fitness">Fitness</option><option value="other">Charging / Other</option></select>
          </label>
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
            <button type="button" onClick={toggleTravelStatus} className={cn('flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition', form.carNeeded ? 'border-blue-300/35 bg-blue-500/20 text-blue-600' : 'border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant')}>
              <span className="flex min-w-0 items-center gap-2">
                {form.carNeeded ? <Car className="h-3.5 w-3.5 shrink-0" /> : <Video className="h-3.5 w-3.5 shrink-0" />}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{form.carNeeded ? 'Drive needed' : 'Remote / no car'}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-wider opacity-75">{travelStatus}</span>
                </span>
              </span>
              <Check className={cn('h-3.5 w-3.5 shrink-0 transition', form.carNeeded ? 'opacity-100' : 'opacity-45')} />
            </button>
          </div>
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Background</span>
            <div className="flex flex-wrap gap-2">
              {eventColorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...form, color: option.value })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-full border border-white/80 text-[0px] transition active:scale-95', form.color === option.value && 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low')}
                  style={{ backgroundColor: option.backgroundColor }}
                  aria-label={`Use ${option.label} schedule color`}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full bg-white transition', form.color === option.value ? 'opacity-100' : 'opacity-0')} />
                </button>
              ))}
            </div>
          </div>
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
  const { events: calendarEvents, aiChargingPlan, addEvent, updateEvent, deleteEvent } = useAppStore();
  const { selectedDate, weekStart, setSelectedDate, setActiveWeek } = useCalendarViewStore();
  const location = useLocation();
  const initialDate = useMemo(() => selectedDate, []);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [selectedEmptySlot, setSelectedEmptySlot] = useState<DragSelection | null>(null);
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
  }, [calendarEvents, timelineDays, weekStart]);

  const draftEvent = useMemo<(CalendarEvent & { color: EventColor }) | null>(() => {
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
      status: getTravelStatus(form.carNeeded),
      notes: form.notes.trim() || undefined,
      color: form.color,
      aiReason: editingEvent?.aiReason,
      chargingMeta: editingEvent?.chargingMeta
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
  }, [draftEvent, editingEvent, timelineEvents, timelineDays, weekStart]);

  const selectedEventId = panelMode === 'create' ? draftEventId : editingEvent?.id;
  const displayedSelection = panelMode ? dragSelection : dragSelection ?? selectedEmptySlot;
  const hasPanel = panelMode !== null;

  const openPanelForCreate = (date: Date, start = 9 * 60, end = 10 * 60) => {
    setSelectedEmptySlot(null);
    setEditingEvent(null);
    setForm(buildEmptyForm(date, start, end));
    setPanelMode('create');
    setActiveWeek(date);
  };

  const openPanelForEvent = (event: CalendarEvent) => {
    const eventDate = getEventDate(event);
    setSelectedEmptySlot(null);
    setEditingEvent(event);
    setForm(formFromEvent(event));
    setPanelMode('edit');
    setActiveWeek(eventDate);
  };

  const closePanel = () => {
    setSelectedEmptySlot(null);
    setPanelMode(null);
    setEditingEvent(null);
  };

  useEffect(() => {
    if (!location.search.includes('aiPlan=1')) return;
    const eventToOpen = aiChargingPlan ? calendarEvents.find((event) => event.id === buildCalendarEventFromChargingPlan(aiChargingPlan)?.id) : undefined;
    if (eventToOpen) openPanelForEvent(eventToOpen);
  }, [location.search, aiChargingPlan, calendarEvents]);

  const handleGridPointerDown = (event: ReactPointerEvent<HTMLElement>, dayIndex: number, date: Date) => {
    if (event.target instanceof Element && event.target.closest('[data-event-block="true"]')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    setSelectedEmptySlot(null);
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
    const nextSelection = { ...selection, endMinutes: Math.min(endMinutes, selectedEnd) };
    setSelectedEmptySlot(nextSelection);
    setPanelMode(null);
    setEditingEvent(null);
  };

  const handleCreateFromSelectedSlot = () => {
    if (selectedEmptySlot) {
      openPanelForCreate(selectedEmptySlot.date, selectedEmptySlot.startMinutes, selectedEmptySlot.endMinutes);
      return;
    }

    openPanelForCreate(selectedDate, 9 * 60, 10 * 60);
  };

  const handleSaveSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const start = parseTimeToMinutes(form.startTime);
    const parsedEnd = parseTimeToMinutes(form.endTime);
    const normalizedEnd = parsedEnd > start ? parsedEnd : start + 30;
    const date = fromDateInputValue(form.date);
    const status = getTravelStatus(form.carNeeded);
    const nextEvent: CalendarEvent & { color: EventColor } = {
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
      aiReason: editingEvent?.aiReason,
      chargingMeta: editingEvent?.chargingMeta
    };

    if (editingEvent) updateEvent(nextEvent);
    else addEvent(nextEvent);

    setSelectedEmptySlot(null);
    setActiveWeek(date);
    setEditingEvent(nextEvent);
    setForm(formFromEvent(nextEvent));
    setPanelMode('edit');
  };

  const handleDeleteSchedule = () => {
    if (!editingEvent) return;
    deleteEvent(editingEvent.id);
    closePanel();
  };

  const handleAddChargingPlan = (event: CalendarEvent) => {
    if (!event.aiChargingPlan) return;
    const confirmedEvent: CalendarEvent = {
      ...event,
      status: 'AI CHARGING CONFIRMED',
      isAiRecommendationPreview: false,
    };
    const existingEvent = calendarEvents.find((item) => item.id === confirmedEvent.id);
    if (existingEvent) updateEvent({ ...existingEvent, ...confirmedEvent });
    else addEvent(confirmedEvent);
    setActiveWeek(getEventDate(confirmedEvent));
    setEditingEvent(confirmedEvent);
    setForm(formFromEvent(confirmedEvent));
    setPanelMode('edit');
  };

  const handleChargingStationSelect = (station: ChargingStationCalendarOption) => {
    if (!editingEvent?.chargingMeta) return;

    const nextEvent: CalendarEvent & { color?: EventColor } = {
      ...editingEvent,
      location: station.address,
      notes: `Selected ${station.name} from the available CCS2 charging station options.`,
      chargingMeta: {
        ...editingEvent.chargingMeta,
        selectedStation: station
      }
    };

    updateEvent(nextEvent);
    setEditingEvent(nextEvent);
    setForm((current) => ({
      ...current,
      location: station.address,
      notes: nextEvent.notes ?? current.notes
    }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex h-full min-h-0 flex-col overflow-hidden bg-surface text-on-surface">
      <div className={cn('grid min-h-0 flex-1 overflow-hidden', hasPanel ? 'grid-rows-[minmax(0,1fr)_minmax(240px,34vh)] lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1' : 'grid-rows-[minmax(0,1fr)]')}>
        <CalendarWeekView
          days={timelineDays}
          weekStart={weekStart}
          events={visibleWeekEvents}
          selection={displayedSelection}
          selectedEventId={selectedEventId}
          onEventClick={openPanelForEvent}
          onSelectDay={(date) => setSelectedDate(startOfDay(date))}
          onPointerDown={handleGridPointerDown}
          onPointerMove={handleGridPointerMove}
          onPointerUp={handleGridPointerUp}
        />

        {hasPanel && (
          <EventSidePanel
            mode={panelMode}
            form={form}
            editingEvent={editingEvent}
            onChange={setForm}
            onClose={closePanel}
            onDelete={handleDeleteSchedule}
            onSubmit={handleSaveSchedule}
            onStationSelect={handleChargingStationSelect}
            onAddChargingPlan={handleAddChargingPlan}
          />
        )}
      </div>

      {!hasPanel && (
        <button
          type="button"
          onClick={handleCreateFromSelectedSlot}
          className="floating-glass-button absolute bottom-[calc(6.25rem+env(safe-area-inset-bottom))] left-4 z-40 sm:bottom-5"
          aria-label={selectedEmptySlot ? 'Create schedule in selected time slot' : 'Create schedule'}
          title={selectedEmptySlot ? 'Create schedule in selected time slot' : 'Create schedule'}
        >
          <Plus className="h-6 w-6 stroke-[3]" aria-hidden="true" />
        </button>
      )}

      <span className="hidden">{selectedDate.toISOString()}</span>
      <Zap className="hidden" />
    </motion.div>
  );
}
