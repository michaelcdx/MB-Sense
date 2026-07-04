import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactNode, WheelEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AlertTriangle,
  Banknote,
  BatteryCharging,
  Check,
  Coffee,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plug,
  Plus,
  Route,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clampMockView, createMockFocusView, getMockCameraView, mockScaleToCameraZoom } from '../components/map/mapCamera';
import {
  costMarkers,
  defaultMockView,
  destinationPreviewDelayMs,
  destinationPreviewZoom,
  evStations,
  mockCost,
  mockEvStations,
  navigationZoom,
  pinchRefocusDelayMs,
  routeOverviewZoom,
} from '../constants/mapDemoData';
import { estimateDrivingRoute, resolveLocationCoordinates } from '../constants/realWorldRouteData';
import {
  buildChargingPlan,
  formatPlanTimeRange,
  type ChargingOptionPlan,
  type ChargingPlan,
} from '../lib/chargingAgents';
import { fetchOpenChargeMapStations } from '../lib/chargingPlanner';
import { cn } from '../lib/utils';
import { useAppStore, type CalendarEvent } from '../store/useAppStore';
import type { OpenChargeMapStationCandidate } from '../types/chargingPlanner';
import type { CameraMode, Coordinates, MapCameraState, MapMode, MapTone, MockMapView, SheetState } from '../types/mapModes';

type ViteImportMeta = ImportMeta & {
  env: {
    VITE_MAPTILER_API_KEY?: string;
  };
};
const viteEnv = (import.meta as ViteImportMeta).env;

const mapTilerApiKey = (viteEnv.VITE_MAPTILER_API_KEY ?? '').trim();
const defaultMapLibreCenter: [number, number] = [101.6869, 3.1390];
const defaultMapLibreZoom = 11.5;
const kualaLumpurCenter: Coordinates = { lat: 3.139, lng: 101.6869 };
const defaultDriveOriginName = 'Xiamen University Malaysia';
const defaultDriveOriginAddress = 'Xiamen University Malaysia, Sunsuria City, Sepang';
const defaultDriveOriginPosition = resolveLocationCoordinates(defaultDriveOriginAddress) ?? { lat: 2.835, lng: 101.706 };

function buildMapTilerStyleUrl(apiKey: string) {
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`;
}

const toolChips: Array<{
  key: MapMode;
  label: string;
  shortLabel: string;
  value: string;
  icon: LucideIcon;
}> = [
  { key: 'aiRoute', label: 'Route', shortLabel: 'Route', value: '3 min saved', icon: Sparkles },
  { key: 'parking', label: 'Stops', shortLabel: 'Stops', value: '5 saved', icon: Coffee },
  { key: 'evStations', label: 'Charge', shortLabel: 'Charge', value: '4 fast', icon: Plug },
  { key: 'cost', label: 'Cost', shortLabel: 'Cost', value: '$12.80', icon: Banknote },
];

const modeVisuals: Record<MapMode, { routeColor: string; glow: string; tone: MapTone }> = {
  aiRoute: { routeColor: '#4647d3', glow: 'rgba(70, 71, 211, 0.14)', tone: 'blue' },
  parking: { routeColor: '#10a86c', glow: 'rgba(16, 168, 108, 0.12)', tone: 'emerald' },
  evStations: { routeColor: '#00628c', glow: 'rgba(0, 98, 140, 0.12)', tone: 'cyan' },
  cost: { routeColor: '#d28700', glow: 'rgba(210, 135, 0, 0.12)', tone: 'amber' },
};

type ActivePanel = null | 'routeCompare' | 'favoriteStops' | 'evStops' | 'costBreakdown';
type DriveExperienceMode = 'driveNow' | 'futureDrivePreview';
type FutureDriveAction = 'Optimize Selected Plan' | 'Compare Rescue Routes' | 'Set Charging Reminder';
type FutureDrivePlanId = 'planA' | 'planB' | 'planC';
type FutureDriveRiskTone = 'safe' | 'watch' | 'high' | 'critical';
type BatteryStatusColor = 'green' | 'yellow' | 'red';
type FutureDrivePreviewMode = 'tomorrow' | 'tomorrowEmpty' | 'nextDrivingDay' | 'empty' | 'calendarUnavailable';
type RouteVariant = 'recommended' | 'comfort' | 'eco';

type MapEvStation = {
  id: string;
  name: string;
  label: string;
  availability: string;
  speed: string;
  detour: string;
  position: Coordinates;
  recommended: boolean;
  provider?: string;
  source: 'openchargemap' | 'local-fallback';
  availabilityPercent: number;
};

type DriveDestination = {
  id: string;
  name: string;
  detail: string;
  eta: string;
  departAt: string;
  distance: string;
  traffic: string;
  saved: string;
  originName: string;
  originDetail: string;
  originPosition: Coordinates;
  position: Coordinates;
  routePath: Coordinates[];
  alternativePath: Coordinates[];
  routeInsight: string;
  eventName?: string;
  eventDateLabel?: string;
  eventLocation?: string;
};

type DrivingRouteResult = {
  source: string;
  profile: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Coordinates[];
};

const fallbackMapEvStations: MapEvStation[] = evStations.map((station, index) => ({
  id: station.id ?? `fallback-ev-${index + 1}`,
  name: station.name,
  label: station.label,
  availability: station.availability,
  speed: station.speed,
  detour: station.detour,
  position: station.position ?? kualaLumpurCenter,
  recommended: station.recommended,
  source: 'local-fallback',
  availabilityPercent: station.id === 'mb-partner' ? 25 : station.id === 'chargepoint-sunnyvale' ? 100 : 50,
}));

function formatStationPower(station: OpenChargeMapStationCandidate) {
  return station.maxPowerKw > 0 ? `${station.maxPowerKw} kW` : 'Power N/A';
}

function formatStationAvailability(station: OpenChargeMapStationCandidate) {
  if (station.status) return station.status;
  if (station.stalls > 0) return `${station.stalls} stall${station.stalls === 1 ? '' : 's'}`;
  return 'Availability N/A';
}

function formatStationDistance(station: OpenChargeMapStationCandidate) {
  return typeof station.distanceKm === 'number'
    ? `${station.distanceKm.toFixed(1)} km away`
    : 'Nearby';
}

function mapOpenChargeMapStationToMapStation(station: OpenChargeMapStationCandidate, index: number): MapEvStation {
  return {
    id: station.id,
    name: station.name,
    label: formatStationPower(station),
    availability: formatStationAvailability(station),
    speed: formatStationPower(station),
    detour: formatStationDistance(station),
    position: { lat: station.latitude, lng: station.longitude },
    recommended: index === 0,
    provider: station.provider,
    source: 'openchargemap',
    availabilityPercent: station.stalls > 0 ? Math.min(100, Math.max(15, station.stalls * 20)) : 55,
  };
}

const routeVariants: Array<{
  key: RouteVariant;
  name: string;
  etaDelta: string;
  distanceDelta: string;
  detail: string;
  tone: MapTone;
}> = [
  { key: 'recommended', name: 'Recommended', etaDelta: 'Fastest', distanceDelta: 'Balanced', detail: 'Best blend of ETA, comfort, and traffic confidence.', tone: 'blue' },
  { key: 'comfort', name: 'Comfort Priority', etaDelta: '+4 min', distanceDelta: '+1.2 mi', detail: 'Fewer sharp merges and calmer road segments.', tone: 'slate' },
  { key: 'eco', name: 'Eco Route', etaDelta: '+7 min', distanceDelta: `Save ${mockCost.ecoRoute.savings}`, detail: 'Lower energy draw with smoother average speeds.', tone: 'emerald' },
];

type FavoriteStop = {
  id: string;
  name: string;
  label: string;
  habit: string;
  detour: string;
  confidence: string;
  visits: string;
  position: Coordinates;
  recommended?: boolean;
};

type FutureDriveStop = {
  id: string;
  name: string;
  shortName: string;
  batteryPercent: number;
  position: Coordinates;
  markerTone: FutureDriveRiskTone;
  batteryStatus: BatteryStatusColor;
  activityNumber?: number;
  timelineLabel?: string;
  isOrigin?: boolean;
  originLocation?: string;
  destinationLocation?: string;
  distanceKm?: number;
  batteryUsePercent?: number;
  traffic?: string;
  weatherImpactPercent?: number;
  departureTime?: string;
  eventTime?: string;
  isReturnHome?: boolean;
};

type FutureDriveSegment = {
  id: string;
  fromIndex: number;
  toIndex: number;
  tone: FutureDriveRiskTone;
};

type FutureDriveSuggestedCharger = {
  name: string;
  detail: string;
  position: Coordinates;
  mode: ChargingOptionPlan['mode'];
  timeEstimate: string;
  targetBattery: number;
};

type FutureDriveRescuePlan = {
  id: FutureDrivePlanId;
  title: string;
  action: string;
  resultBattery: number;
  label: string;
  tone: MapTone;
  mode: ChargingOptionPlan['mode'];
  timeEstimate: string;
  canComplete: boolean;
};

type FutureDrivePrediction = {
  finalBattery: number;
  lowestBattery: number;
  riskTone: FutureDriveRiskTone;
  riskLabel: string;
  explanation: string;
};

type CoordinateBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

type FutureDrivePreviewData = {
  title: string;
  subtitle: string;
  previewMode: FutureDrivePreviewMode;
  previewDate: Date;
  previewDateLabel: string;
  drivingActivityCount: number;
  currentBattery: number;
  reserveLimit: number;
  riskLevel: string;
  lowestBattery: number;
  riskPoint: string;
  rootCause: string;
  recommendation: string;
  chargingTimeEstimate: string;
  chargerRecommended: boolean;
  stops: FutureDriveStop[];
  activityStops: FutureDriveStop[];
  segments: FutureDriveSegment[];
  ecoRoutePath: Coordinates[];
  suggestedCharger: FutureDriveSuggestedCharger | null;
  rescuePlans: FutureDriveRescuePlan[];
  criticalStop: FutureDriveStop | null;
  mapBounds: CoordinateBounds;
};

type FutureDrivePreviewSelection = {
  date: Date | null;
  events: CalendarEvent[];
  mode: FutureDrivePreviewMode;
};

const favoriteStops: FavoriteStop[] = [
  {
    id: 'morning-coffee',
    name: 'The Exchange Coffee Lounge',
    label: 'Coffee',
    habit: 'Usually visited before 9 AM',
    detour: '+4 min',
    confidence: '96%',
    visits: '18 visits',
    position: { lat: 37.634, lng: -122.315 },
    recommended: true,
  },
  {
    id: 'lunch-spot',
    name: 'Bangsar Lunch Club',
    label: 'Lunch',
    habit: 'Frequent weekday lunch stop',
    detour: '+7 min',
    confidence: '88%',
    visits: '12 visits',
    position: { lat: 37.572, lng: -122.248 },
  },
  {
    id: 'gym-routine',
    name: 'Equinox Premium Gym',
    label: 'Gym',
    habit: 'Common evening routine',
    detour: '+6 min',
    confidence: '82%',
    visits: '9 visits',
    position: { lat: 37.512, lng: -122.286 },
  },
  {
    id: 'charging-lounge',
    name: 'Mercedes Charging Lounge',
    label: 'Lounge',
    habit: 'Preferred long-drive charging stop',
    detour: '+11 min',
    confidence: '91%',
    visits: '7 visits',
    position: { lat: 37.691, lng: -122.198 },
  },
  {
    id: 'office-shortcut',
    name: 'Office South Entrance',
    label: 'Office',
    habit: 'Fastest arrival on workdays',
    detour: '+2 min',
    confidence: '94%',
    visits: '22 visits',
    position: { lat: 37.472, lng: -122.176 },
  },
];

const futureDriveRiskVisuals: Record<FutureDriveRiskTone, { label: string; color: string; glow: string }> = {
  safe: { label: 'Safe', color: '#22c55e', glow: 'rgba(34, 197, 94, 0.28)' },
  watch: { label: 'Warning', color: '#f3b51b', glow: 'rgba(243, 181, 27, 0.30)' },
  high: { label: 'Warning', color: '#f3b51b', glow: 'rgba(243, 181, 27, 0.30)' },
  critical: { label: 'Critical', color: '#dc2626', glow: 'rgba(220, 38, 38, 0.34)' },
};

const batteryStatusVisuals: Record<BatteryStatusColor, { label: string; color: string; glow: string; tone: FutureDriveRiskTone }> = {
  green: { label: 'Safe', color: '#22c55e', glow: 'rgba(34, 197, 94, 0.28)', tone: 'safe' },
  yellow: { label: 'Warning', color: '#f3b51b', glow: 'rgba(243, 181, 27, 0.30)', tone: 'watch' },
  red: { label: 'Critical', color: '#dc2626', glow: 'rgba(220, 38, 38, 0.34)', tone: 'critical' },
};

function getBatteryStatusColor(batteryPercent: number): BatteryStatusColor {
  if (batteryPercent < 25) return 'red';
  if (batteryPercent < 50) return 'yellow';
  return 'green';
}

function classifyFutureDriveRisk(batteryPercent: number): FutureDriveRiskTone {
  return batteryStatusVisuals[getBatteryStatusColor(batteryPercent)].tone;
}

function clampBatteryPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function startOfCalendarDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseCalendarTimeToMinutes(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function isDrivingRequiredActivity(event: CalendarEvent) {
  const location = event.location.toLowerCase();
  return event.carNeeded && !location.includes('online') && !location.includes('teams');
}

function getEventDate(event: CalendarEvent) {
  return event.date instanceof Date ? event.date : new Date(event.date);
}

function getDrivingEventsForDate(events: CalendarEvent[], targetDate: Date) {
  return events
    .filter((event) => {
      const eventDate = getEventDate(event);
      return isSameCalendarDay(eventDate, targetDate) && isDrivingRequiredActivity(event);
    })
    .sort((a, b) => parseCalendarTimeToMinutes(a.departureTime ?? a.time) - parseCalendarTimeToMinutes(b.departureTime ?? b.time));
}

function getPreviewDrivingDay(events: CalendarEvent[], today: Date, shouldCheckNextDrivingDay = false): FutureDrivePreviewSelection {
  const tomorrow = addCalendarDays(today, 1);
  const tomorrowEvents = getDrivingEventsForDate(events, tomorrow);

  if (tomorrowEvents.length > 0) {
    return {
      date: tomorrow,
      events: tomorrowEvents,
      mode: 'tomorrow',
    };
  }

  if (!shouldCheckNextDrivingDay) {
    return {
      date: null,
      events: [],
      mode: 'tomorrowEmpty',
    };
  }

  for (let dayOffset = 2; dayOffset <= 8; dayOffset += 1) {
    const targetDate = addCalendarDays(today, dayOffset);
    const drivingEvents = getDrivingEventsForDate(events, targetDate);

    if (drivingEvents.length > 0) {
      return {
        date: targetDate,
        events: drivingEvents,
        mode: 'nextDrivingDay',
      };
    }
  }

  return {
    date: null,
    events: [],
    mode: 'empty',
  };
}

function formatFutureDriveDate(date: Date) {
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatFutureDriveCompactDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return [weekday, day, month].filter(Boolean).join(' ');
}

function getReadableLocationName(location: string) {
  return location.split(',')[0]?.trim() || location.trim() || 'Selected location';
}

function getDriveTrafficLabel(event: CalendarEvent) {
  const minutes = parseCalendarTimeToMinutes(event.departureTime ?? event.time);
  if ((minutes >= 420 && minutes <= 570) || (minutes >= 1020 && minutes <= 1200)) return 'Heavy';
  if ((minutes >= 660 && minutes <= 840) || event.status?.toLowerCase().includes('important')) return 'Moderate';
  return 'Light';
}

function getRouteDurationMinutes(distanceKm: number, traffic: string) {
  const estimated = distanceKm <= 0 ? 0 : Math.max(5, Math.round(distanceKm / (distanceKm > 35 ? 55 : distanceKm > 12 ? 42 : 30) * 60));
  const multiplier = traffic === 'Heavy' ? 1.35 : traffic === 'Moderate' ? 1.16 : 1;
  return estimated <= 0 ? 0 : Math.max(5, Math.round(estimated * multiplier));
}

function formatDriveDate(date: Date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildRoutePath(origin: Coordinates, destination: Coordinates, bend = 1): Coordinates[] {
  const latDelta = destination.lat - origin.lat;
  const lngDelta = destination.lng - origin.lng;
  const offsetLat = -lngDelta * 0.08 * bend;
  const offsetLng = latDelta * 0.08 * bend;

  return [
    origin,
    {
      lat: origin.lat + latDelta * 0.34 + offsetLat,
      lng: origin.lng + lngDelta * 0.34 + offsetLng,
    },
    {
      lat: origin.lat + latDelta * 0.68 + offsetLat * 0.55,
      lng: origin.lng + lngDelta * 0.68 + offsetLng * 0.55,
    },
    destination,
  ];
}

function buildDriveDestination({
  id,
  name,
  eventName,
  eventDate,
  eventTime,
  eventLocation,
  originName,
  originLocation,
  destinationPosition,
  traffic,
}: {
  id: string;
  name: string;
  eventName?: string;
  eventDate?: Date;
  eventTime?: string;
  eventLocation: string;
  originName: string;
  originLocation: string;
  destinationPosition: Coordinates;
  traffic: string;
}): DriveDestination {
  const originPosition = resolveLocationCoordinates(originLocation) ?? defaultDriveOriginPosition;
  const routeEstimate = estimateDrivingRoute(originLocation, eventLocation);
  const distanceKm = routeEstimate?.distanceKm ?? 0;
  const durationMinutes = getRouteDurationMinutes(distanceKm, traffic);
  const distance = distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : 'Location resolved';
  const eta = durationMinutes > 0 ? `${durationMinutes} min` : 'Ready';
  const departAt = eventTime ?? 'Now';
  const eventDateLabel = eventDate ? formatDriveDate(eventDate) : undefined;

  return {
    id,
    name,
    detail: [eventName, eventDateLabel, distance].filter(Boolean).join(' - '),
    eta,
    departAt,
    distance,
    traffic,
    saved: 'Calendar',
    originName,
    originDetail: originLocation,
    originPosition,
    position: destinationPosition,
    routePath: buildRoutePath(originPosition, destinationPosition),
    alternativePath: buildRoutePath(originPosition, destinationPosition, -1),
    routeInsight: eventName
      ? `Route generated from calendar activity "${eventName}" using the existing location resolver and route estimate.`
      : 'Route opened from Home using the selected charging destination.',
    eventName,
    eventDateLabel,
    eventLocation,
  };
}

function buildCalendarDriveDestinations(events: CalendarEvent[], today: Date) {
  const drivingEvents = [...events]
    .filter((event) => isDrivingRequiredActivity(event))
    .filter((event) => startOfCalendarDay(getEventDate(event)).getTime() >= today.getTime())
    .sort((a, b) => {
      const dateDelta = getEventDate(a).getTime() - getEventDate(b).getTime();
      return dateDelta || parseCalendarTimeToMinutes(a.departureTime ?? a.time) - parseCalendarTimeToMinutes(b.departureTime ?? b.time);
    });

  const previousLocationByDay = new Map<string, string>();

  return drivingEvents.reduce<DriveDestination[]>((destinations, event, index) => {
    const eventDate = getEventDate(event);
    const dayKey = startOfCalendarDay(eventDate).toISOString();
    const originLocation = previousLocationByDay.get(dayKey) ?? defaultDriveOriginAddress;
    const position = resolveLocationCoordinates(event.location);
    previousLocationByDay.set(dayKey, event.location);
    if (!position) return destinations;

    destinations.push(buildDriveDestination({
      id: `calendar-${event.id}-${index}`,
      name: getReadableLocationName(event.location),
      eventName: event.title,
      eventDate,
      eventTime: event.departureTime ?? event.time,
      eventLocation: event.location,
      originName: getReadableLocationName(originLocation),
      originLocation,
      destinationPosition: position,
      traffic: getDriveTrafficLabel(event),
    }));

    return destinations;
  }, []);
}

function buildRouteDestinationFromParams(searchParams: URLSearchParams): DriveDestination | null {
  const routeMode = searchParams.get('route');
  const destinationLocation = searchParams.get('to')?.trim();
  if (routeMode !== 'charging' && !destinationLocation) return null;

  const rawLat = Number(searchParams.get('lat'));
  const rawLng = Number(searchParams.get('lng'));
  const destinationPosition = Number.isFinite(rawLat) && Number.isFinite(rawLng)
    ? { lat: rawLat, lng: rawLng }
    : resolveLocationCoordinates(destinationLocation ?? '');

  if (!destinationLocation || !destinationPosition) return null;

  const originLocation = searchParams.get('from')?.trim() || defaultDriveOriginAddress;
  const routeName = searchParams.get('name')?.trim() || getReadableLocationName(destinationLocation);

  return buildDriveDestination({
    id: `route-request-${routeName}-${destinationLocation}`,
    name: routeName,
    eventName: searchParams.get('event')?.trim() || 'Home navigation request',
    eventLocation: destinationLocation,
    eventTime: 'Now',
    originName: getReadableLocationName(originLocation),
    originLocation,
    destinationPosition,
    traffic: 'Moderate',
  });
}

function getEmptyDriveDestination(): DriveDestination {
  return {
    id: 'calendar-empty-route',
    name: 'No driving destination',
    detail: 'No upcoming car-needed calendar activity',
    eta: 'N/A',
    departAt: 'N/A',
    distance: 'N/A',
    traffic: 'N/A',
    saved: 'Calendar',
    originName: defaultDriveOriginName,
    originDetail: defaultDriveOriginAddress,
    originPosition: defaultDriveOriginPosition,
    position: defaultDriveOriginPosition,
    routePath: [defaultDriveOriginPosition],
    alternativePath: [defaultDriveOriginPosition],
    routeInsight: 'Add a calendar activity with carNeeded enabled to generate a route.',
  };
}

function formatDurationMinutes(minutes?: number | null) {
  if (!Number.isFinite(minutes ?? NaN)) return 'No estimate';
  const rounded = Math.max(0, Math.round(minutes ?? 0));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
}

function toCompactStopName(name: string) {
  return name
    .replace(/^Mercedes-Benz\s+/i, 'MB ')
    .replace(/,\s*(Kuala Lumpur|Selangor|Malaysia).*$/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');
}

function getChargingOptionKey(option: ChargingOptionPlan) {
  return [
    option.mode,
    option.location,
    option.targetBattery,
    option.start?.toISOString() ?? 'no-start',
    option.end?.toISOString() ?? 'no-end',
  ].join('|');
}

function buildFutureDriveRescuePlans(plan: ChargingPlan): FutureDriveRescuePlan[] {
  const ids: FutureDrivePlanId[] = ['planA', 'planB', 'planC'];
  const options: Array<{ option: ChargingOptionPlan; label: string; tone: MapTone }> = [
    { option: plan.chargingStrategy.selected, label: 'Recommended', tone: 'blue' },
    { option: plan.chargingStrategy.ac, label: 'Home AC', tone: 'cyan' },
    { option: plan.chargingStrategy.dc, label: 'DC Backup', tone: 'emerald' },
  ];
  const seen = new Set<string>();

  return options
    .filter(({ option }) => {
      const key = getChargingOptionKey(option);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, ids.length)
    .map(({ option, label, tone }, index) => {
      const resultBattery = option.canComplete
        ? clampBatteryPercent(option.targetBattery - plan.energy.forecastUsePercent)
        : plan.energy.withoutChargeProjectedBattery;

      return {
        id: ids[index],
        title: `Plan ${String.fromCharCode(65 + index)}`,
        action: option.canComplete ? `${option.mode} charging - ${formatPlanTimeRange(option.start, option.end)}` : option.summary,
        resultBattery,
        label,
        tone,
        mode: option.mode,
        timeEstimate: formatDurationMinutes(option.minutesNeeded ?? option.blockMinutes),
        canComplete: option.canComplete,
      };
    });
}

function getFutureDriveRiskCause(plan: ChargingPlan, criticalStop: FutureDriveStop | null) {
  const highDemandTrip = plan.scheduleDemand.highDemandEvent;
  if (!highDemandTrip) return plan.explanation;

  const riskPrefix = criticalStop
    ? `${criticalStop.name} is projected at ${criticalStop.batteryPercent}%, below the 25% critical threshold.`
    : `${highDemandTrip.title} is the highest energy segment.`;

  return `${riskPrefix} ${highDemandTrip.traffic} traffic, ${highDemandTrip.weatherImpactPercent}% weather impact, and ${highDemandTrip.batteryUsePercent}% battery use drive the risk.`;
}

function buildFutureDriveSuggestedCharger(plan: ChargingPlan, chargerRecommended: boolean): FutureDriveSuggestedCharger | null {
  if (!chargerRecommended) return null;

  const selected = plan.chargingStrategy.selected;
  const station = selected.selectedStation;
  const position = station
    ? { lat: station.station.latitude, lng: station.station.longitude }
    : resolveLocationCoordinates(selected.location);

  if (!position) return null;

  return {
    name: station?.station.name ?? selected.location,
    detail: `${selected.mode} - ${formatDurationMinutes(selected.minutesNeeded ?? selected.blockMinutes)} - target ${selected.targetBattery}%`,
    position,
    mode: selected.mode,
    timeEstimate: formatDurationMinutes(selected.minutesNeeded ?? selected.blockMinutes),
    targetBattery: selected.targetBattery,
  };
}

function buildCoordinateBounds(points: Coordinates[]): CoordinateBounds {
  const latValues = points.map((point) => point.lat);
  const lngValues = points.map((point) => point.lng);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);
  const minLng = Math.min(...lngValues);
  const maxLng = Math.max(...lngValues);
  const latPadding = Math.max((maxLat - minLat) * 0.18, 0.015);
  const lngPadding = Math.max((maxLng - minLng) * 0.18, 0.015);

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
  };
}

function buildFutureDrivePreviewData(plan: ChargingPlan, selection: FutureDrivePreviewSelection): FutureDrivePreviewData | null {
  if (!selection.date) {
    return null;
  }

  const trips = plan.scheduleDemand.trips;
  if (trips.length === 0) {
    // TODO: Connect Map page to existing trained EV prediction data source.
    return null;
  }

  const originLocation = trips[0].originLocation;
  const originPosition = resolveLocationCoordinates(originLocation);
  if (!originPosition) {
    // TODO: Connect Map page to existing trained EV prediction data source.
    return null;
  }

  let runningBattery = plan.energy.currentBattery;
  const originBatteryStatus = getBatteryStatusColor(runningBattery);
  const stops: FutureDriveStop[] = [
    {
      id: 'prediction-origin',
      name: toCompactStopName(originLocation),
      shortName: 'Start',
      batteryPercent: runningBattery,
      position: originPosition,
      markerTone: batteryStatusVisuals[originBatteryStatus].tone,
      batteryStatus: originBatteryStatus,
      isOrigin: true,
      destinationLocation: originLocation,
    },
  ];
  const activityStops: FutureDriveStop[] = [];

  let activityIndex = 0;
  for (const trip of trips) {
    const position = resolveLocationCoordinates(trip.location);
    if (!position) {
      // TODO: Connect Map page to existing trained EV prediction data source.
      return null;
    }

    if (!trip.isReturnHome) activityIndex += 1;
    const timelineLabel = trip.isReturnHome ? 'Home' : `A${activityIndex}`;
    runningBattery = clampBatteryPercent(runningBattery - trip.batteryUsePercent);
    const batteryStatus = getBatteryStatusColor(runningBattery);
    const activityStop: FutureDriveStop = {
      id: trip.eventId,
      name: trip.title,
      shortName: timelineLabel,
      batteryPercent: runningBattery,
      position,
      markerTone: batteryStatusVisuals[batteryStatus].tone,
      batteryStatus,
      activityNumber: trip.isReturnHome ? undefined : activityIndex,
      timelineLabel,
      isReturnHome: trip.isReturnHome,
      originLocation: trip.originLocation,
      destinationLocation: trip.location,
      distanceKm: trip.distanceKm,
      batteryUsePercent: trip.batteryUsePercent,
      traffic: trip.traffic,
      weatherImpactPercent: trip.weatherImpactPercent,
      departureTime: trip.departureTime,
      eventTime: trip.eventTime,
    };
    stops.push(activityStop);
    activityStops.push(activityStop);
  }

  const segments = stops.slice(1).map((stop, index) => ({
    id: `${stops[index].id}-${stop.id}`,
    fromIndex: index,
    toIndex: index + 1,
    tone: stop.markerTone,
  })) satisfies FutureDriveSegment[];
  const lowestBattery = Math.min(...activityStops.map((stop) => stop.batteryPercent));
  const criticalStop = activityStops.find((stop) => stop.batteryPercent < 25) ?? null;
  const riskTone = classifyFutureDriveRisk(lowestBattery);
  const selected = plan.chargingStrategy.selected;
  const chargerRecommended =
    selected.canComplete &&
    (plan.energy.withoutChargeProjectedBattery < plan.energy.reserveTarget ||
      plan.energy.currentBattery < plan.energy.recommendedTarget ||
      plan.energy.topUpPercent > 0);
  const suggestedCharger = buildFutureDriveSuggestedCharger(plan, chargerRecommended);
  const rescuePlans = buildFutureDriveRescuePlans(plan);
  const chargingTimeEstimate = formatDurationMinutes(selected.minutesNeeded ?? selected.blockMinutes);
  const riskPoint = criticalStop?.name ?? plan.scheduleDemand.highDemandEvent?.title ?? stops[stops.length - 1].name;
  const rootCause = getFutureDriveRiskCause(plan, criticalStop);
  const recommendation = chargerRecommended
    ? `${selected.mode} charging: ${formatPlanTimeRange(selected.start, selected.end)}`
    : plan.explanation;
  const boundsPoints = suggestedCharger ? [...stops.map((stop) => stop.position), suggestedCharger.position] : stops.map((stop) => stop.position);
  const previewDateLabel = formatFutureDriveDate(selection.date);

  return {
    title: selection.mode === 'tomorrow' ? "Tomorrow's Energy Forecast" : 'Next Driving Day Forecast',
    subtitle: selection.mode === 'tomorrow'
      ? previewDateLabel
      : `Showing next driving day: ${formatFutureDriveCompactDate(selection.date)}`,
    previewMode: selection.mode,
    previewDate: selection.date,
    previewDateLabel,
    drivingActivityCount: selection.events.length,
    currentBattery: plan.energy.currentBattery,
    reserveLimit: plan.energy.reserveTarget,
    riskLevel: futureDriveRiskVisuals[riskTone].label,
    lowestBattery,
    riskPoint,
    rootCause,
    recommendation,
    chargingTimeEstimate,
    chargerRecommended,
    stops,
    activityStops,
    segments,
    ecoRoutePath: stops.map((stop) => stop.position),
    suggestedCharger,
    rescuePlans,
    criticalStop,
    mapBounds: buildCoordinateBounds(boundsPoints),
  };
}

function getFutureDrivePrediction(
  preview: FutureDrivePreviewData,
  selectedPlan: FutureDriveRescuePlan | undefined
): FutureDrivePrediction {
  const riskTone = classifyFutureDriveRisk(preview.lowestBattery);
  const riskLabel = futureDriveRiskVisuals[riskTone].label;
  const finalBattery = selectedPlan?.resultBattery ?? preview.lowestBattery;
  const explanation = selectedPlan
    ? `${selectedPlan.title} uses ${selectedPlan.mode} charging for ${selectedPlan.timeEstimate}. ${preview.recommendation}.`
    : preview.recommendation;

  return {
    finalBattery,
    lowestBattery: preview.lowestBattery,
    riskTone,
    riskLabel,
    explanation,
  };
}

function getUnavailableFutureDrivePrediction(): FutureDrivePrediction {
  return {
    finalBattery: 0,
    lowestBattery: 0,
    riskTone: 'watch',
    riskLabel: 'Unavailable',
    explanation: 'Prediction data unavailable',
  };
}

function getUnavailableFutureDrivePlan(): FutureDriveRescuePlan {
  return {
    id: 'planA',
    title: 'Plan A',
    action: 'Prediction data unavailable',
    resultBattery: 0,
    label: 'Unavailable',
    tone: 'slate',
    mode: 'AC',
    timeEstimate: 'No estimate',
    canComplete: false,
  };
}

const costDistribution = [
  { label: 'Energy/Fuel', value: mockCost.energyFuel, percent: 66, tone: 'cyan' as const },
  { label: 'Tolls', value: mockCost.tolls, percent: 17, tone: 'amber' as const },
  { label: 'Favorite Stop', value: mockCost.parkingEstimate, percent: 17, tone: 'emerald' as const },
  { label: 'Consumption', value: mockCost.consumption, percent: 42, tone: 'slate' as const },
];

function parsePercent(value: string) {
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
}

const bottomSheets: Record<
  MapMode,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    collapsedTitle: string;
    collapsedMeta: string;
    collapsedStatus: string;
    collapsedAction: string;
    statusLabel: string;
    statusValue: string;
    metrics: Array<{ label: string; value: string; tone?: MapTone }>;
    optionsTitle: string;
    options: Array<{ label: string; value: string; detail: string }>;
    insight: string;
    primaryAction: string;
    secondaryAction: string;
  }
> = {
  aiRoute: {
    eyebrow: 'Intelligent Route',
    title: 'Calendar route',
    subtitle: 'Route generated from calendar data',
    collapsedTitle: 'Calendar route',
    collapsedMeta: 'Select a destination',
    collapsedStatus: 'Traffic: Calendar estimate',
    collapsedAction: 'Start Navigation',
    statusLabel: 'Traffic',
    statusValue: 'Calendar',
    metrics: [
      { label: 'Depart', value: 'Calendar', tone: 'blue' },
      { label: 'ETA', value: 'Calendar' },
      { label: 'Traffic', value: 'Calendar', tone: 'emerald' },
      { label: 'Source', value: 'Calendar', tone: 'cyan' },
    ],
    optionsTitle: 'Route Options',
    options: [
      { label: 'Recommended', value: 'Calendar route', detail: 'Built from the selected driving activity' },
      { label: 'Alternative', value: 'Compare', detail: 'Uses the same calendar destination with a calmer path shape' },
    ],
    insight: 'Select a car-needed calendar activity to generate a Drive Now route.',
    primaryAction: 'Start Navigation',
    secondaryAction: 'Compare Routes',
  },
  parking: {
    eyebrow: 'Favorite Stops',
    title: favoriteStops[0].name,
    subtitle: 'Habit-based stops remembered for quick access',
    collapsedTitle: 'Favorite stops on this route',
    collapsedMeta: `Top pick: ${favoriteStops[0].name}`,
    collapsedStatus: `${favoriteStops[0].habit} - ${favoriteStops[0].detour}`,
    collapsedAction: 'Add Favorite Stop',
    statusLabel: 'Match',
    statusValue: favoriteStops[0].confidence,
    metrics: [
      { label: 'Top Stop', value: favoriteStops[0].label, tone: 'emerald' },
      { label: 'Detour', value: favoriteStops[0].detour },
      { label: 'Match', value: favoriteStops[0].confidence, tone: 'blue' },
      { label: 'History', value: favoriteStops[0].visits },
    ],
    optionsTitle: 'Remembered Stops',
    options: favoriteStops.slice(1).map((stop) => ({
      label: stop.name,
      value: stop.detour,
      detail: `${stop.habit} - ${stop.confidence} match`,
    })),
    insight: `${favoriteStops[0].name} appears because this user often takes a coffee break before morning trips.`,
    primaryAction: 'Add Favorite Stop',
    secondaryAction: 'View Stops',
  },
  evStations: {
    eyebrow: 'EV Stations',
    title: mockEvStations.recommended.name,
    subtitle: 'Recommended fast charger along route',
    collapsedTitle: `${mockEvStations.stationCount} fast chargers nearby`,
    collapsedMeta: `Recommended: ${mockEvStations.recommended.name}`,
    collapsedStatus: `${mockEvStations.recommended.speed} - ${mockEvStations.recommended.detour}`,
    collapsedAction: 'Add Charging Stop',
    statusLabel: 'Arrival',
    statusValue: `${mockEvStations.batteryOnArrival} battery`,
    metrics: [
      { label: 'Open', value: evStations[0].availability, tone: 'cyan' },
      { label: 'Speed', value: mockEvStations.recommended.speed },
      { label: 'Detour', value: mockEvStations.recommended.detour, tone: 'emerald' },
      { label: 'Arrival', value: mockEvStations.batteryOnArrival },
    ],
    optionsTitle: 'Nearby Stations',
    options: evStations.map((station) => ({
      label: station.name,
      value: station.availability,
      detail: `${station.speed} - ${station.detour}`,
    })),
    insight: mockEvStations.note,
    primaryAction: 'Add Charging Stop',
    secondaryAction: 'Navigate Directly',
  },
  cost: {
    eyebrow: 'Cost',
    title: 'Trip cost estimate',
    subtitle: 'Energy, toll, and favorite-stop estimate',
    collapsedTitle: 'Estimated trip cost',
    collapsedMeta: mockCost.totalCost,
    collapsedStatus: 'Calendar route',
    collapsedAction: 'View Cost Breakdown',
    statusLabel: 'Per Mile',
    statusValue: mockCost.costPerMile,
    metrics: [
      { label: 'Total', value: mockCost.totalCost, tone: 'amber' },
      { label: 'Energy/Fuel', value: mockCost.energyFuel, tone: 'cyan' },
      { label: 'Tolls', value: mockCost.tolls },
      { label: 'Stop', value: mockCost.parkingEstimate },
      { label: 'Use', value: mockCost.consumption },
      { label: 'Per Mile', value: mockCost.costPerMile, tone: 'emerald' },
    ],
    optionsTitle: 'Cheaper Eco Route',
    options: [
      { label: 'Eco surface route', value: `Save ${mockCost.ecoRoute.savings}`, detail: `Adds ${mockCost.ecoRoute.extraTime}` },
    ],
    insight: `Eco route saves ${mockCost.ecoRoute.savings} but adds ${mockCost.ecoRoute.extraTime}.`,
    primaryAction: 'Compare Routes',
    secondaryAction: 'Optimize Cost',
  },
};

const mapBounds: CoordinateBounds = {
  minLat: 37.35,
  maxLat: 37.82,
  minLng: -122.52,
  maxLng: -122.04,
};

function coordsToPercentWithinBounds({ lat, lng }: Coordinates, bounds: CoordinateBounds) {
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.001);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.001);
  const x = ((lng - bounds.minLng) / lngRange) * 100;
  const y = (1 - (lat - bounds.minLat) / latRange) * 100;

  return {
    x: `${Math.max(5, Math.min(95, x))}%`,
    y: `${Math.max(5, Math.min(95, y))}%`,
  };
}

function coordsToPercent(point: Coordinates) {
  return coordsToPercentWithinBounds(point, mapBounds);
}

function coordsToUnitPoint(coords: Coordinates) {
  const { x, y } = coordsToPercent(coords);

  return {
    x: parseFloat(x) / 100,
    y: parseFloat(y) / 100,
  };
}

function toMapLibreLngLat(point: Coordinates): [number, number] {
  return [point.lng, point.lat];
}

function fitMapLibreToCoordinates(map: maplibregl.Map, points: Coordinates[], padding = 72) {
  const validPoints = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (!validPoints.length) return;

  const bounds = new maplibregl.LngLatBounds(toMapLibreLngLat(validPoints[0]), toMapLibreLngLat(validPoints[0]));
  validPoints.slice(1).forEach((point) => bounds.extend(toMapLibreLngLat(point)));
  map.fitBounds(bounds, {
    padding,
    duration: 320,
    maxZoom: routeOverviewZoom,
  });
}

function getBrowserCurrentCoordinates(timeoutMs = 7000): Promise<Coordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          resolve(null);
          return;
        }
        resolve({ lat: latitude, lng: longitude });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
function MapLibreBaseMap({ onReady }: { onReady: (map: maplibregl.Map | null) => void }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [runtimeMapTilerApiKey, setRuntimeMapTilerApiKey] = useState(mapTilerApiKey);
  const [configResolved, setConfigResolved] = useState(Boolean(mapTilerApiKey));

  useEffect(() => {
    if (mapTilerApiKey) return;

    let cancelled = false;

    fetch('/api/public-config')
      .then((response) => (response.ok ? response.json() : null))
      .then((config: { mapTilerApiKey?: string } | null) => {
        if (cancelled) return;
        const nextKey = typeof config?.mapTilerApiKey === 'string' ? config.mapTilerApiKey.trim() : '';
        setRuntimeMapTilerApiKey(nextKey);
      })
      .catch(() => {
        if (!cancelled) setRuntimeMapTilerApiKey('');
      })
      .finally(() => {
        if (!cancelled) setConfigResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtimeMapTilerApiKey || !mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildMapTilerStyleUrl(runtimeMapTilerApiKey),
      center: defaultMapLibreCenter,
      zoom: defaultMapLibreZoom,
      attributionControl: false,
    });

    mapRef.current = map;
    onReady(map);

    return () => {
      onReady(null);
      map.remove();
      mapRef.current = null;
    };
  }, [onReady, runtimeMapTilerApiKey]);

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-surface">
      <div ref={mapContainerRef} className="h-full min-h-dvh w-full" />
      {configResolved && !runtimeMapTilerApiKey && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/92 px-6 text-center">
          <div className="max-w-xs rounded-[20px] border border-outline-variant/45 bg-surface-container-lowest/92 px-4 py-3 text-sm font-semibold text-slate-100 shadow-ambient backdrop-blur-xl">
            Map configuration unavailable.
          </div>
        </div>
      )}
    </div>
  );
}

function VehicleMarker({ activeNavigation = false }: { activeNavigation?: boolean }) {
  return (
    <div data-map-marker="vehicle" className="relative flex h-13 w-13 items-center justify-center">
      <div className="absolute h-11 w-11 rounded-full bg-blue-300/12 blur-md" />
      <div
        className={cn(
          'absolute rounded-full border',
          activeNavigation ? 'h-11 w-11 animate-ping' : 'h-9 w-9'
        )}
        style={{ borderColor: 'rgba(70,71,211,0.24)', backgroundColor: 'rgba(70,71,211,0.08)' }}
      />
      <div
        className={cn(
          'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border text-on-primary shadow-ambient',
          activeNavigation ? 'scale-105' : ''
        )}
        style={{
          background: 'radial-gradient(circle at 50% 25%, rgba(255,255,255,0.34), #4647d3 58%, #3939c7 100%)',
          borderColor: activeNavigation ? 'rgba(70,71,211,0.48)' : 'rgba(70,71,211,0.26)',
        }}
      >
        <div className="absolute inset-1.5 rounded-full border border-white/[0.07]" />
        <div className="absolute bottom-1 h-3 w-6 rounded-full bg-blue-300/18 blur-md" />
        <div
          className="relative h-6 w-6 drop-shadow-[0_8px_14px_rgba(0,0,0,0.42)]"
          style={{
            clipPath: 'polygon(50% 0%, 88% 100%, 50% 76%, 12% 100%)',
            background: 'linear-gradient(180deg, #ffffff 0%, #dfe1ff 44%, #f4f1ff 100%)',
          }}
        />
        <div className="absolute top-[17px] h-2 w-1.5 rounded-full bg-primary-dim/72" />
      </div>
    </div>
  );
}

function DestinationMarker() {
  return (
    <div data-map-marker="destination" className="relative flex h-14 w-14 items-center justify-center">
      <div className="absolute h-11 w-11 rounded-full bg-emerald-300/16 blur-md" />
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-surface-container-lowest text-slate-950 shadow-ambient">
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      <div className="absolute -top-6 whitespace-nowrap rounded-full border border-outline-variant/45 bg-surface-container-lowest/90 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-on-surface shadow-ambient backdrop-blur">
        Destination
      </div>
    </div>
  );
}

const toneClasses: Record<MapTone, { icon: string; badge: string; text: string; glow: string }> = {
  blue: {
    icon: 'border-primary/25 bg-primary/10 text-primary',
    badge: 'border-primary/20 bg-primary/10',
    text: 'text-primary',
    glow: 'bg-primary/10',
  },
  emerald: {
    icon: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    badge: 'border-emerald-500/20 bg-emerald-500/10',
    text: 'text-emerald-500',
    glow: 'bg-emerald-500/10',
  },
  cyan: {
    icon: 'border-cyan-300/25 bg-cyan-300/15 text-secondary',
    badge: 'border-cyan-300/25 bg-cyan-300/15',
    text: 'text-secondary',
    glow: 'bg-cyan-300/15',
  },
  amber: {
    icon: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    badge: 'border-amber-500/20 bg-amber-500/10',
    text: 'text-amber-500',
    glow: 'bg-amber-500/10',
  },
  slate: {
    icon: 'border-outline-variant/45 bg-surface-container text-slate-200',
    badge: 'border-outline-variant/45 bg-surface-container-lowest/88',
    text: 'text-slate-200',
    glow: 'bg-white/[0.06]',
  },
};

const toneAccentColors: Record<MapTone, string> = {
  blue: '#4647d3',
  emerald: '#10a86c',
  cyan: '#00628c',
  amber: '#d28700',
  slate: '#747779',
};

function PremiumMetricBar({
  label,
  value,
  percent,
  tone = 'blue',
  detail,
  compact = false,
}: {
  label: string;
  value: string;
  percent: number;
  tone?: MapTone;
  detail?: string;
  compact?: boolean;
}) {
  const accent = toneAccentColors[tone];
  const boundedPercent = Math.max(4, Math.min(100, percent));

  return (
    <div className={cn('rounded-[16px] border border-white/[0.045] bg-white/[0.022] shadow-[inset_0_1px_0_rgba(255,255,255,0.028)]', compact ? 'px-3 py-2' : 'px-3 py-2.5')}>
      <div className={cn('flex items-center justify-between gap-3', compact ? 'mb-1.5' : 'mb-2')}>
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">{label}</span>
        <span className="shrink-0 text-[12px] font-semibold text-white">{value}</span>
      </div>
      <div className={cn('overflow-hidden rounded-full bg-white/[0.07]', compact ? 'h-1.5' : 'h-2')}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${boundedPercent}%`,
            background: `linear-gradient(90deg, ${accent}70, ${accent})`,
            boxShadow: `0 0 10px ${accent}24`,
          }}
        />
      </div>
      {detail && <p className="mt-1.5 truncate text-[10px] font-medium text-slate-500">{detail}</p>}
    </div>
  );
}

function PremiumPanelCard({
  icon: Icon,
  title,
  detail,
  meta,
  tone = 'blue',
  selected = false,
  children,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  meta?: string;
  tone?: MapTone;
  selected?: boolean;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const accent = toneAccentColors[tone];
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full rounded-[18px] border px-3 py-2.5 text-left transition duration-200 ease-out',
        'bg-white/[0.022] shadow-[inset_0_1px_0_rgba(255,255,255,0.028)]',
        selected ? 'border-white/16 bg-white/[0.04]' : 'border-white/[0.055]',
        onClick && 'active:scale-[0.99] hover:bg-white/[0.04]'
      )}
      style={{ boxShadow: selected ? `0 0 0 1px ${accent}26, 0 12px 30px rgba(0,0,0,0.18)` : undefined }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: `${accent}24`, backgroundColor: `${accent}0f`, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-white">{title}</span>
              <span className="mt-1 block text-[11px] font-medium leading-relaxed text-slate-500">{detail}</span>
            </span>
            {meta && (
              <span
                className="shrink-0 rounded-full border px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em]"
                style={{ borderColor: `${accent}2e`, backgroundColor: `${accent}10`, color: accent }}
              >
                {meta}
              </span>
            )}
          </span>
          {children && <span className="mt-3 block">{children}</span>}
        </span>
      </div>
    </Wrapper>
  );
}

function MapModeBadge({
  icon,
  label,
  detail,
  tone,
}: {
  icon: 'favorite' | 'ev' | 'cost' | 'route';
  label: string;
  detail: string;
  tone: MapTone;
}) {
  const toneClass = toneClasses[tone];
  const Icon = icon === 'ev' ? Plug : icon === 'cost' ? Banknote : icon === 'route' ? Route : Coffee;

  return (
    <div className="relative flex items-center gap-1">
      <div
        className={cn(
          'relative flex h-5 w-5 items-center justify-center rounded-full border shadow-[0_6px_18px_rgba(0,0,0,0.20)]',
          toneClass.icon
        )}
      >
        <Icon className="h-2.5 w-2.5" />
      </div>
      <div
        className={cn(
          'relative min-w-max rounded-full border px-1.5 py-0.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] backdrop-blur-xl',
          toneClass.badge
        )}
      >
        <div className="text-[7.5px] font-semibold uppercase leading-none tracking-[0.08em] text-slate-100">{label}</div>
        <div className={cn('mt-0.5 text-[7.5px] font-medium leading-none text-slate-400', toneClass.text)}>{detail}</div>
      </div>
    </div>
  );
}

function FavoriteStopMarker({ stop }: { stop: FavoriteStop }) {
  return (
    <MapModeBadge
      icon="favorite"
      label={stop.label}
      detail={stop.recommended ? `${stop.detour} - top habit` : stop.detour}
      tone="emerald"
    />
  );
}

function EVStationMarker({ station }: { station: MapEvStation }) {
  return (
    <MapModeBadge
      icon="ev"
      label={station.label}
      detail={`${station.speed} - ${station.detour}`}
      tone="cyan"
    />
  );
}

function CostMapMarker({ marker }: { marker: (typeof costMarkers)[number] }) {
  return <MapModeBadge icon="cost" label={marker.label} detail={marker.detail} tone="amber" />;
}

function RouteChoiceMarker({ label, detail, tone }: { label: string; detail: string; tone: MapTone }) {
  return <MapModeBadge icon="route" label={label} detail={detail} tone={tone} />;
}

function FutureDriveStopMarker({
  stop,
  reserveLimit,
  emphasized = false,
}: {
  stop: FutureDriveStop;
  reserveLimit: number;
  emphasized?: boolean;
}) {
  const visual = batteryStatusVisuals[stop.batteryStatus];
  const isCritical = stop.batteryPercent < 25 || stop.batteryPercent < reserveLimit;

  return (
    <div data-map-marker={`future-drive-${stop.id}`} className={cn('relative flex items-center gap-1.5', emphasized && 'scale-110')}>
      {emphasized && <div className="absolute -left-1 h-9 w-9 rounded-full bg-primary/18 blur-md" />}
      <div
        className="relative flex h-5 w-5 items-center justify-center rounded-full border shadow-[0_6px_18px_rgba(0,0,0,0.22)]"
        style={{
          borderColor: emphasized ? `${toneAccentColors.blue}66` : `${visual.color}44`,
          backgroundColor: emphasized ? `${toneAccentColors.blue}24` : `${visual.color}1c`,
          color: emphasized ? toneAccentColors.blue : visual.color,
        }}
      >
        {isCritical ? (
          <AlertTriangle className="h-2.5 w-2.5" />
        ) : (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: emphasized ? toneAccentColors.blue : visual.color }} />
        )}
      </div>
      <div
        className="relative min-w-max rounded-full border bg-surface-container-lowest/92 px-1.5 py-0.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] backdrop-blur-xl"
        style={{
          borderColor: emphasized ? `${toneAccentColors.blue}40` : `${visual.color}30`,
          boxShadow: `0 8px 20px rgba(0,0,0,0.18), 0 0 12px ${emphasized ? 'rgba(70, 71, 211, 0.36)' : visual.glow}`,
        }}
      >
        <div className="text-[7.5px] font-semibold uppercase leading-none tracking-[0.08em] text-slate-100">
          {emphasized ? 'Night Charge' : stop.name}
        </div>
        <div className="mt-0.5 text-[7.5px] font-semibold leading-none" style={{ color: emphasized ? toneAccentColors.blue : visual.color }}>
          {emphasized ? 'Plan A at home' : `${stop.batteryPercent}% predicted`}
        </div>
      </div>
    </div>
  );
}

function FutureDriveChargerMarker({
  charger,
  emphasized = false,
}: {
  charger: FutureDriveSuggestedCharger;
  emphasized?: boolean;
}) {
  return (
    <div data-map-marker="future-drive-charger" className={cn('relative flex items-center gap-1.5', emphasized && 'scale-110')}>
      <div className={cn('absolute h-8 w-8 rounded-full bg-cyan-300/18 blur-md', emphasized && 'h-10 w-10 bg-cyan-300/28')} />
      <div className="relative flex h-7 w-7 items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-300/12 text-cyan-100 shadow-ambient">
        <Plug className="h-3.5 w-3.5" />
      </div>
      <div
        className="relative min-w-max rounded-full border border-cyan-100/18 bg-surface-container-lowest/92 px-2 py-1 shadow-ambient backdrop-blur-xl"
        style={{ boxShadow: emphasized ? 'var(--shadow-ambient), 0 0 18px rgba(103, 232, 249, 0.26)' : undefined }}
      >
        <div className="text-[7.5px] font-semibold uppercase leading-none tracking-[0.08em] text-cyan-100">
          {emphasized ? `${charger.mode} option` : charger.name}
        </div>
        <div className="mt-0.5 text-[7.5px] font-medium leading-none text-slate-400">
          {emphasized ? charger.timeEstimate : charger.detail}
        </div>
      </div>
    </div>
  );
}

function FutureDrivePlanEmphasisMarker({
  icon: Icon,
  label,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  tone: MapTone;
}) {
  const accent = toneAccentColors[tone];

  return (
    <div data-map-marker="future-drive-plan-emphasis" className="relative flex items-center gap-1.5">
      <div className="absolute h-9 w-9 rounded-full blur-md" style={{ backgroundColor: `${accent}2a` }} />
      <div
        className="relative flex h-7 w-7 items-center justify-center rounded-full border shadow-ambient"
        style={{ borderColor: `${accent}40`, backgroundColor: `${accent}18`, color: accent }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div
        className="relative min-w-max rounded-full border bg-surface-container-lowest/92 px-2 py-1 shadow-ambient backdrop-blur-xl"
        style={{ borderColor: `${accent}2e`, boxShadow: `var(--shadow-ambient), 0 0 16px ${accent}22` }}
      >
        <div className="text-[7.5px] font-semibold uppercase leading-none tracking-[0.08em]" style={{ color: accent }}>
          {label}
        </div>
        <div className="mt-0.5 text-[7.5px] font-medium leading-none text-slate-400">{detail}</div>
      </div>
    </div>
  );
}

function FutureDriveCriticalMarker({ stop, reserveLimit }: { stop: FutureDriveStop; reserveLimit: number }) {
  return (
    <div data-map-marker="future-drive-critical" className="relative -translate-y-10">
      <div className="flex min-w-max items-center gap-1.5 rounded-full border border-red-200/25 bg-red-500/14 px-2 py-1 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-red-100 shadow-ambient backdrop-blur-xl">
        <AlertTriangle className="h-3 w-3" />
        Critical below {reserveLimit}% at {stop.name}
      </div>
    </div>
  );
}

function MapControlGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[18px] border border-outline-variant/45 bg-surface-container-lowest/88 shadow-ambient backdrop-blur-2xl',
        'divide-y divide-white/[0.065]',
        className
      )}
    >
      {children}
    </div>
  );
}

function MapControlButton({
  icon: Icon,
  label,
  ariaLabel,
  onClick,
  active = false,
  className,
}: {
  icon: LucideIcon;
  label?: string;
  ariaLabel: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex h-10 items-center justify-center gap-2 px-3 text-[9.5px] font-semibold uppercase tracking-[0.08em] transition duration-200 ease-out active:scale-[0.97]',
        'text-slate-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-inset',
        label ? 'min-w-[6.75rem]' : 'w-10',
        active && 'border-primary/20 bg-primary/10 text-primary shadow-ambient hover:bg-primary/15',
        className
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-slate-400')} />
      {label && <span className="truncate">{label}</span>}
    </button>
  );
}

function MapStatePill({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[8.5px] font-semibold uppercase tracking-[0.10em] shadow-ambient backdrop-blur-2xl',
        active
          ? 'border-primary/25 bg-primary/10 text-primary'
          : 'border-outline-variant/45 bg-surface-container-lowest/88 text-slate-300'
      )}
    >
      <Icon className={cn('h-3 w-3', active ? 'text-primary' : 'text-slate-400')} />
      <span>{label}</span>
    </div>
  );
}

function FutureDrivePreviewSheet({
  preview,
  emptyMessage,
  emptyActionLabel,
  rescuePlans,
  selectedPlan,
  selectedPlanId,
  prediction,
  onPlanSelect,
  onEmptyAction,
  onAction,
}: {
  preview: FutureDrivePreviewData | null;
  emptyMessage: string;
  emptyActionLabel?: string;
  rescuePlans: FutureDriveRescuePlan[];
  selectedPlan: FutureDriveRescuePlan;
  selectedPlanId: FutureDrivePlanId;
  prediction: FutureDrivePrediction;
  onPlanSelect: (planId: FutureDrivePlanId) => void;
  onEmptyAction?: () => void;
  onAction: (action: FutureDriveAction) => void;
}) {
  const riskVisual = futureDriveRiskVisuals[prediction.riskTone];
  const [showActivityList, setShowActivityList] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  useEffect(() => {
    setShowActivityList(false);
    setExpandedActivityId(null);
  }, [preview?.previewDateLabel]);

  const handleActivityListToggle = () => {
    const nextShowState = !showActivityList;
    setShowActivityList(nextShowState);
    if (!nextShowState) {
      setExpandedActivityId(null);
    }
  };

  const handleActivityDetailToggle = (activityId: string) => {
    setExpandedActivityId((current) => (current === activityId ? null : activityId));
  };

  if (!preview) {
    return (
      <section
        aria-label="FutureDrive Preview details"
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-outline-variant/45 bg-surface-container-lowest/92 shadow-ambient-lg backdrop-blur-2xl"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center">
          <div>
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/12 text-primary shadow-ambient">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-[17px] font-semibold text-white">{emptyMessage}</h2>
            <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-400">
              {emptyMessage}
            </p>
            {emptyActionLabel && onEmptyAction && (
              <button
                type="button"
                onClick={onEmptyAction}
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-[14px] border border-primary/25 bg-primary px-4 text-[10px] font-semibold uppercase tracking-[0.05em] text-on-primary shadow-ambient transition duration-200 ease-out active:scale-[0.98]"
              >
                {emptyActionLabel}
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }
  const timelineActivities = preview.activityStops;
  const timelineNodes = [
    {
      id: 'timeline-start',
      label: 'Start',
      batteryPercent: preview.currentBattery,
      batteryStatus: getBatteryStatusColor(preview.currentBattery),
    },
    ...timelineActivities.map((stop) => ({
      id: stop.id,
      label: stop.timelineLabel ?? `A${stop.activityNumber ?? ''}`,
      batteryPercent: stop.batteryPercent,
      batteryStatus: stop.batteryStatus,
    })),
  ];
  const timelineIsScrollable = timelineNodes.length > 5;
  const timelineMinWidth = timelineIsScrollable ? `${Math.max(timelineNodes.length * 92, 440)}px` : undefined;
  const highestEnergyStop =
    timelineActivities.reduce<FutureDriveStop | null>((current, stop) => {
      if (typeof stop.batteryUsePercent !== 'number') return current;
      if (!current || stop.batteryUsePercent > (current.batteryUsePercent ?? -1)) return stop;
      return current;
    }, null) ?? timelineActivities[0] ?? null;
  const trafficImpactLabel = highestEnergyStop?.traffic
    ? `${highestEnergyStop.traffic.charAt(0).toUpperCase()}${highestEnergyStop.traffic.slice(1)}`
    : null;
  const weatherImpactLabel =
    typeof highestEnergyStop?.weatherImpactPercent === 'number' ? `${highestEnergyStop.weatherImpactPercent}%` : null;
  const batteryUseImpactLabel =
    typeof highestEnergyStop?.batteryUsePercent === 'number' ? `${highestEnergyStop.batteryUsePercent}%` : null;
  const riskReasonRows = [
    { label: 'Highest energy segment', value: highestEnergyStop?.name },
    { label: 'Traffic', value: trafficImpactLabel },
    { label: 'Weather impact', value: weatherImpactLabel },
    { label: 'Battery use impact', value: batteryUseImpactLabel },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  const fallbackRiskReason = preview.rootCause.split('. ').find(Boolean);

  return (
    <section
      aria-label="FutureDrive Preview details"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-outline-variant/45 bg-surface-container-lowest/92 shadow-ambient-lg backdrop-blur-2xl"
      style={{ boxShadow: `var(--shadow-ambient-lg), 0 0 0 1px ${riskVisual.color}18` }}
    >
      <div className="border-b border-white/[0.065] px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.15em] text-primary">FUTUREDRIVE PREVIEW</p>
            </div>
            <h2 className="mt-1.5 text-[17px] font-semibold leading-tight text-white">{preview.title}</h2>
            <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-slate-300">{preview.subtitle}</p>
          </div>
          <span
            className="shrink-0 rounded-full border px-2.5 py-1 text-[8.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ borderColor: `${riskVisual.color}30`, backgroundColor: `${riskVisual.color}14`, color: riskVisual.color }}
          >
            {prediction.riskLabel}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-slate-200">Timeline Prediction</p>
            <span className="rounded-full border px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em]" style={{ borderColor: `${riskVisual.color}32`, backgroundColor: `${riskVisual.color}12`, color: riskVisual.color }}>
              Reserve {preview.reserveLimit}%
            </span>
          </div>

          <div className="overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-[3.85rem] items-start" style={{ minWidth: timelineMinWidth }}>
              {timelineNodes.map((node, index) => {
                const visual = batteryStatusVisuals[node.batteryStatus];
                const nextNode = timelineNodes[index + 1];
                const segmentVisual = nextNode ? batteryStatusVisuals[nextNode.batteryStatus] : visual;

                return (
                  <div key={`timeline-flow-${node.id}`} className="contents">
                    <div className="flex w-16 shrink-0 flex-col items-center text-center">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full border text-[8.5px] font-black uppercase tracking-[0.03em] shadow-ambient"
                        style={{
                          borderColor: `${visual.color}52`,
                          backgroundColor: `${visual.color}18`,
                          color: visual.color,
                          boxShadow: `0 0 16px ${visual.glow}`,
                        }}
                      >
                        {node.label}
                      </div>
                      <p className="mt-1.5 text-[11px] font-semibold leading-none" style={{ color: visual.color }}>
                        {node.batteryPercent}%
                      </p>
                    </div>
                    {nextNode && (
                      <div
                        className="mt-[1.05rem] h-1.5 min-w-8 flex-1 rounded-full"
                        style={{ backgroundColor: segmentVisual.color, boxShadow: `0 0 10px ${segmentVisual.glow}` }}
                      />
                    )}
                  </div>
                );
              })}
              {timelineNodes.length === 1 && (
                <div className="mt-[1.05rem] h-1.5 flex-1 rounded-full bg-slate-500/45" />
              )}
            </div>
            {timelineIsScrollable && (
              <p className="text-center text-[8.5px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                Scroll for more activities
              </p>
            )}
          </div>

          <div className="mt-1.5 border-t border-white/[0.07] pt-2">
            <button
              type="button"
              onClick={handleActivityListToggle}
              className="flex min-h-10 w-full items-center justify-center rounded-[14px] border border-primary/20 bg-primary/10 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary transition duration-200 ease-out hover:bg-primary/15 active:scale-[0.99]"
            >
              {showActivityList ? 'Hide activities' : 'Click to expand activities'}
            </button>

            {showActivityList && (
              <div className="mt-2 grid gap-1.5">
                {timelineActivities.map((stop) => {
                  const visual = batteryStatusVisuals[stop.batteryStatus];
                  const isExpanded = expandedActivityId === stop.id;
                  const timeLabel = stop.departureTime && stop.eventTime
                    ? `${stop.departureTime} depart - ${stop.eventTime}`
                    : stop.eventTime ?? stop.departureTime ?? 'Time unavailable';

                  return (
                    <div
                      key={`future-activity-${stop.id}`}
                      className="rounded-[16px] border border-white/[0.075] bg-white/[0.035] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[8.5px] font-black uppercase tracking-[0.04em]"
                            style={{ borderColor: `${visual.color}38`, backgroundColor: `${visual.color}18`, color: visual.color }}
                          >
                            {stop.timelineLabel}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                              {stop.isReturnHome ? 'Return trip' : `Activity ${stop.activityNumber}`}
                            </p>
                            <p className="mt-0.5 text-[12px] font-semibold leading-snug text-white">{stop.name}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-right">
                            <span className="block text-[12px] font-semibold" style={{ color: visual.color }}>
                              {stop.batteryPercent}%
                            </span>
                            <span className="block text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: visual.color }}>
                              {visual.label}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleActivityDetailToggle(stop.id)}
                            className="rounded-full border border-white/[0.10] bg-white/[0.045] px-2.5 py-1 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-slate-100 transition hover:bg-white/[0.07] active:scale-[0.97]"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-2.5">
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">Time</p>
                            <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-100">{timeLabel}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">Battery After Arrival</p>
                            <p className="mt-0.5 text-[11px] font-semibold leading-snug" style={{ color: visual.color }}>{stop.batteryPercent}%</p>
                          </div>
                          <div className="min-w-0 col-span-2">
                            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">Location</p>
                            <p className="mt-0.5 break-words text-[11px] font-semibold leading-snug text-slate-100">
                              {stop.destinationLocation ?? stop.name}
                            </p>
                          </div>
                          {typeof stop.batteryUsePercent === 'number' && (
                            <div className="min-w-0">
                              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">Battery Used</p>
                              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-100">{stop.batteryUsePercent}%</p>
                            </div>
                          )}
                          {stop.traffic && (
                            <div className="min-w-0">
                              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">Traffic Impact</p>
                              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-100">{stop.traffic}</p>
                            </div>
                          )}
                          {typeof stop.weatherImpactPercent === 'number' && (
                            <div className="min-w-0">
                              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">Weather Impact</p>
                              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-100">+{stop.weatherImpactPercent}%</p>
                            </div>
                          )}
                          {preview.recommendation && (
                            <div className="min-w-0 col-span-2">
                              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">Recommendation</p>
                              <p className="mt-0.5 break-words text-[11px] font-medium leading-relaxed text-slate-100">
                                {preview.recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
            <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-300">Current Battery</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{preview.currentBattery}%</p>
          </div>
          <div
            className="rounded-[16px] border px-3.5 py-3"
            style={{ borderColor: `${riskVisual.color}24`, backgroundColor: `${riskVisual.color}0f` }}
          >
            <p className="text-[8.5px] font-bold uppercase tracking-[0.12em]" style={{ color: `${riskVisual.color}` }}>Lowest Battery</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{prediction.lowestBattery}%</p>
          </div>
          <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
            <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-300">Reserve Limit</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{preview.reserveLimit}%</p>
          </div>
          <div
            className="rounded-[16px] border px-3.5 py-3"
            style={{ borderColor: `${riskVisual.color}24`, backgroundColor: `${riskVisual.color}0f` }}
          >
            <p className="text-[8.5px] font-bold uppercase tracking-[0.12em]" style={{ color: riskVisual.color }}>Risk Level</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{prediction.riskLabel}</p>
          </div>
        </div>

        <div className="mt-3 rounded-[18px] border border-amber-300 bg-amber-50 px-3.5 py-3 shadow-ambient">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-700">Risk Reason</p>
              <div className="mt-2 grid gap-2">
                {riskReasonRows.length > 0 ? (
                  riskReasonRows.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
                      <p className="mt-0.5 break-words text-[12px] font-semibold leading-snug text-neutral-900">{row.value}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] font-semibold leading-snug text-neutral-900">{fallbackRiskReason}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {preview.criticalStop && (
          <div className="mt-3 rounded-[18px] border border-red-200/22 bg-red-500/12 px-3.5 py-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-100/20 bg-red-300/10 text-red-100">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-red-100">Critical Warning</p>
                <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-slate-100">
                  {preview.criticalStop.timelineLabel} drops to {preview.criticalStop.batteryPercent}%, below reserve.
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          className="mt-3 rounded-[18px] border px-3.5 py-3"
          style={{ borderColor: `${riskVisual.color}22`, backgroundColor: `${riskVisual.color}0c` }}
        >
          <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: riskVisual.color }}>
            Recommendation
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-slate-100">
            {selectedPlan.title}: {selectedPlan.action}. Expected final battery: {prediction.finalBattery}%.
          </p>
          {preview.suggestedCharger && (
            <div className="mt-2.5 rounded-[14px] border border-cyan-100/18 bg-cyan-300/[0.055] px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-100" />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold leading-snug text-white">{preview.suggestedCharger.name}</p>
                  <p className="mt-0.5 text-[10.5px] font-medium leading-relaxed text-slate-300">
                    {preview.suggestedCharger.detail} - {preview.chargingTimeEstimate}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(5.75rem,1fr))] gap-1.5">
            {rescuePlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const accent = toneAccentColors[plan.tone];

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => onPlanSelect(plan.id)}
                  className={cn(
                    'min-h-16 rounded-[14px] border px-2.5 py-2 text-left transition duration-200 ease-out active:scale-[0.99]',
                    isSelected ? 'bg-white/[0.06]' : 'border-white/[0.075] bg-white/[0.035] hover:bg-white/[0.045]'
                  )}
                  style={{
                    borderColor: isSelected ? `${accent}42` : undefined,
                    boxShadow: isSelected ? `0 0 0 1px ${accent}24, 0 12px 26px rgba(0,0,0,0.15)` : undefined,
                  }}
                >
                  <span className="block text-[10px] font-semibold text-white">{plan.title}</span>
                  <span className="mt-0.5 block text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: accent }}>
                    {plan.label}
                  </span>
                  <span className="mt-1 block text-[12px] font-semibold" style={{ color: accent }}>
                    {plan.canComplete ? `${plan.resultBattery}%` : 'N/A'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      <div className="grid shrink-0 grid-cols-3 gap-1.5 border-t border-outline-variant/45 bg-surface-container-low p-2.5">
        <button
          type="button"
          onClick={() => onAction('Optimize Selected Plan')}
          className="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-[14px] bg-primary px-2 text-center text-[9.5px] font-semibold uppercase leading-tight tracking-[0.02em] text-on-primary shadow-ambient transition duration-200 ease-out active:scale-[0.98]"
        >
          <Check className="h-3.5 w-3.5 shrink-0" />
          Optimize
        </button>
        <button
          type="button"
          onClick={() => onAction('Compare Rescue Routes')}
          className="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-[14px] border border-red-100/22 bg-surface-container-lowest px-2 text-center text-[9.5px] font-semibold uppercase leading-tight tracking-[0.02em] text-slate-100 shadow-ambient transition duration-200 ease-out active:scale-[0.98]"
        >
          <Route className="h-3.5 w-3.5 shrink-0 text-primary" />
          Compare
        </button>
        <button
          type="button"
          onClick={() => onAction('Set Charging Reminder')}
          className="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-[14px] border border-primary/24 bg-surface-container-lowest px-2 text-center text-[9.5px] font-semibold uppercase leading-tight tracking-[0.02em] text-slate-100 shadow-ambient transition duration-200 ease-out active:scale-[0.98]"
        >
          <BatteryCharging className="h-3.5 w-3.5 shrink-0 text-primary" />
          Reminder
        </button>
      </div>
    </section>
  );
}

function MockMapCanvas({
  mode,
  driveMode,
  futureDrivePreview,
  selectedFuturePlan,
  selectedFuturePlanId,
  emphasizeFutureEcoRoute,
  sheetState,
  view,
  cameraMode,
  activeNavigation,
  showDriveRoute,
  routePath,
  alternativePath,
  routeDetail,
  alternativeRouteDetail,
  origin,
  destination,
  evStationOptions,
  addedEvStop,
  selectedFavoriteStop,
  onViewChange,
  onManualPan,
  onZoomInteraction,
}: {
  mode: MapMode;
  driveMode: DriveExperienceMode;
  futureDrivePreview: FutureDrivePreviewData | null;
  selectedFuturePlan: FutureDriveRescuePlan;
  selectedFuturePlanId: FutureDrivePlanId;
  emphasizeFutureEcoRoute: boolean;
  sheetState: SheetState;
  view: MockMapView;
  cameraMode: CameraMode;
  activeNavigation: boolean;
  showDriveRoute: boolean;
  routePath: Coordinates[];
  alternativePath: Coordinates[];
  routeDetail: string;
  alternativeRouteDetail: string;
  origin: Coordinates;
  destination: Coordinates;
  evStationOptions: MapEvStation[];
  addedEvStop?: MapEvStation | null;
  selectedFavoriteStop?: FavoriteStop | null;
  onViewChange: (updater: (view: MockMapView) => MockMapView) => void;
  onManualPan: () => void;
  onZoomInteraction: (nextZoom?: number) => void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    hasMoved: boolean;
  } | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);

  const driveBounds = useMemo(
    () => buildCoordinateBounds([
      origin,
      destination,
      ...routePath,
      ...alternativePath,
      ...(addedEvStop ? [addedEvStop.position] : []),
      ...(selectedFavoriteStop ? [selectedFavoriteStop.position] : []),
    ]),
    [addedEvStop, alternativePath, destination, origin, routePath, selectedFavoriteStop]
  );
  const driveCoordsToPercent = (point: Coordinates) => coordsToPercentWithinBounds(point, driveBounds);
  const vehicle = driveCoordsToPercent(origin);
  const destinationPoint = driveCoordsToPercent(destination);
  const routeChoicePoint = routePath[Math.max(0, Math.floor(routePath.length / 2))] ?? destination;
  const alternativeChoicePoint = alternativePath[Math.max(0, Math.floor(alternativePath.length / 2))] ?? destination;
  const routeCostMarkers = costMarkers.map((marker, index) => ({
    marker,
    position: routePath[Math.min(index + 1, Math.max(routePath.length - 1, 0))] ?? destination,
  }));
  const visual = modeVisuals[mode];
  const isFutureDrivePreview = driveMode === 'futureDrivePreview';
  const futureCoordsToPercent = (point: Coordinates) =>
    futureDrivePreview ? coordsToPercentWithinBounds(point, futureDrivePreview.mapBounds) : driveCoordsToPercent(point);
  const futureEcoRoutePoints = (futureDrivePreview?.ecoRoutePath ?? [])
    .map((point) => {
      const { x, y } = futureCoordsToPercent(point);
      return `${parseFloat(x) * 10},${parseFloat(y) * 10}`;
    })
    .join(' ');

  const getPointerDistance = () => {
    const pointers = Array.from(activePointersRef.current.values());
    if (pointers.length < 2) return 0;
    const [first, second] = pointers;
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size >= 2) {
      pinchRef.current = {
        startDistance: getPointerDistance(),
        startZoom: view.zoom,
      };
      dragRef.current = null;
      onZoomInteraction();
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
      hasMoved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinchRef.current && activePointersRef.current.size >= 2) {
      const nextDistance = getPointerDistance();
      const pinch = pinchRef.current;
      if (pinch.startDistance > 0) {
        const zoomDelta = (nextDistance - pinch.startDistance) / 170;
        const nextZoom = pinch.startZoom + zoomDelta;
        onViewChange((current) => clampMockView({ ...current, zoom: nextZoom }));
        onZoomInteraction(mockScaleToCameraZoom(nextZoom));
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextX = drag.originX + event.clientX - drag.startX;
    const nextY = drag.originY + event.clientY - drag.startY;
    if (!drag.hasMoved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.hasMoved = true;
      onManualPan();
    }
    onViewChange((current) => clampMockView({ ...current, x: nextX, y: nextY }));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (pinchRef.current && activePointersRef.current.size < 2) {
      pinchRef.current = null;
      onZoomInteraction();
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    onZoomInteraction(mockScaleToCameraZoom(view.zoom + delta));
    onViewChange((current) => clampMockView({ ...current, zoom: current.zoom + delta }));
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-transparent"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      <div
        className={cn(
          'absolute inset-[-18%] will-change-transform',
          cameraMode !== 'manualExplore' && 'transition-transform duration-300 ease-out'
        )}
        style={{
          transform: `matrix(${view.zoom}, 0, 0, ${view.zoom}, ${view.x}, ${view.y})`,
          transformOrigin: '0 0',
        }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          {isFutureDrivePreview ? (
            futureDrivePreview ? (
              <>
                {futureDrivePreview.segments.map((segment) => {
                  const fromStop = futureDrivePreview.stops[segment.fromIndex];
                  const toStop = futureDrivePreview.stops[segment.toIndex];
                  const fromPoint = futureCoordsToPercent(fromStop.position);
                  const toPoint = futureCoordsToPercent(toStop.position);
                  const segmentPoints = `${parseFloat(fromPoint.x) * 10},${parseFloat(fromPoint.y) * 10} ${parseFloat(toPoint.x) * 10},${parseFloat(toPoint.y) * 10}`;
                  const segmentVisual = futureDriveRiskVisuals[segment.tone];

                  return (
                    <g key={`future-segment-${segment.id}`}>
                      <polyline
                        points={segmentPoints}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="15"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.86"
                      />
                      <polyline
                        points={segmentPoints}
                        fill="none"
                        stroke={segmentVisual.color}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: `drop-shadow(0 0 8px ${segmentVisual.glow})` }}
                      />
                    </g>
                  );
                })}
                {emphasizeFutureEcoRoute && futureEcoRoutePoints && (
                  <>
                    <polyline
                      points={futureEcoRoutePoints}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="13"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.78"
                    />
                    <polyline
                      points={futureEcoRoutePoints}
                      fill="none"
                      stroke={toneAccentColors.emerald}
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="14 10"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(16, 168, 108, 0.28))' }}
                    />
                  </>
                )}
              </>
            ) : null
          ) : null}
        </svg>

        {!isFutureDrivePreview && mode === 'parking' &&
          favoriteStops.map((stop) => {
            const pos = driveCoordsToPercent(stop.position);
            return (
              <div
                key={stop.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: pos.x, top: pos.y }}
              >
                <FavoriteStopMarker stop={stop} />
              </div>
            );
          })}

        {!isFutureDrivePreview && mode === 'evStations' &&
          evStationOptions.map((station) => {
            const pos = driveCoordsToPercent(station.position);
            const isAdded = addedEvStop?.id === station.id;
            return (
              <div
                key={station.id}
                className={cn('absolute -translate-x-1/2 -translate-y-1/2', isAdded && 'scale-110')}
                style={{ left: pos.x, top: pos.y }}
              >
                <EVStationMarker station={station} />
              </div>
            );
          })}

        {!isFutureDrivePreview && addedEvStop && mode !== 'evStations' && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 scale-110"
            style={{ left: driveCoordsToPercent(addedEvStop.position).x, top: driveCoordsToPercent(addedEvStop.position).y }}
          >
            <EVStationMarker station={addedEvStop} />
          </div>
        )}

        {!isFutureDrivePreview && selectedFavoriteStop && mode !== 'parking' && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 scale-110"
            style={{ left: driveCoordsToPercent(selectedFavoriteStop.position).x, top: driveCoordsToPercent(selectedFavoriteStop.position).y }}
          >
            <FavoriteStopMarker stop={selectedFavoriteStop} />
          </div>
        )}

        {!isFutureDrivePreview && mode === 'cost' &&
          routeCostMarkers.map(({ marker, position }) => {
            const pos = driveCoordsToPercent(position);
            return (
              <div
                key={marker.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: pos.x, top: pos.y }}
              >
                <CostMapMarker marker={marker} />
              </div>
            );
          })}

        {!isFutureDrivePreview && mode === 'cost' && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: driveCoordsToPercent(routeChoicePoint).x, top: driveCoordsToPercent(routeChoicePoint).y }}
          >
            <RouteChoiceMarker label="$12.80 total" detail="$0.47/mi" tone="amber" />
          </div>
        )}

        {!isFutureDrivePreview && mode === 'cost' && sheetState === 'expanded' && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 opacity-80"
            style={{ left: driveCoordsToPercent(alternativeChoicePoint).x, top: driveCoordsToPercent(alternativeChoicePoint).y }}
          >
            <RouteChoiceMarker label="Eco route" detail="Save $1.10" tone="slate" />
          </div>
        )}

        {isFutureDrivePreview ? (
          futureDrivePreview ? (
            <>
              {futureDrivePreview.suggestedCharger && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: futureCoordsToPercent(futureDrivePreview.suggestedCharger.position).x,
                    top: futureCoordsToPercent(futureDrivePreview.suggestedCharger.position).y,
                  }}
                >
                  <FutureDriveChargerMarker charger={futureDrivePreview.suggestedCharger} emphasized={selectedFuturePlanId === 'planB'} />
                </div>
              )}
              {futureDrivePreview.stops.map((stop) => {
                const stopPosition = futureCoordsToPercent(stop.position);
                return (
                  <div
                    key={`mock-future-stop-${stop.id}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: stopPosition.x, top: stopPosition.y }}
                  >
                    <FutureDriveStopMarker
                      stop={stop}
                      reserveLimit={futureDrivePreview.reserveLimit}
                      emphasized={selectedFuturePlanId === 'planA' && stop.id === 'prediction-origin'}
                    />
                  </div>
                );
              })}
              {selectedFuturePlanId === 'planA' && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-[185%]"
                  style={{
                    left: futureCoordsToPercent(futureDrivePreview.stops[0].position).x,
                    top: futureCoordsToPercent(futureDrivePreview.stops[0].position).y,
                  }}
                >
                  <FutureDrivePlanEmphasisMarker
                    icon={BatteryCharging}
                    label={`${selectedFuturePlan.mode} charging`}
                    detail={selectedFuturePlan.canComplete ? `Ends at ${selectedFuturePlan.resultBattery}%` : selectedFuturePlan.timeEstimate}
                    tone="blue"
                  />
                </div>
              )}
              {emphasizeFutureEcoRoute && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: futureCoordsToPercent(futureDrivePreview.stops[Math.max(0, Math.floor(futureDrivePreview.stops.length / 2))].position).x,
                    top: futureCoordsToPercent(futureDrivePreview.stops[Math.max(0, Math.floor(futureDrivePreview.stops.length / 2))].position).y,
                  }}
                >
                  <FutureDrivePlanEmphasisMarker
                    icon={Sparkles}
                    label={selectedFuturePlan.label}
                    detail={selectedFuturePlan.timeEstimate}
                    tone="emerald"
                  />
                </div>
              )}
              {futureDrivePreview.criticalStop && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: futureCoordsToPercent(futureDrivePreview.criticalStop.position).x,
                    top: futureCoordsToPercent(futureDrivePreview.criticalStop.position).y,
                  }}
                >
                  <FutureDriveCriticalMarker stop={futureDrivePreview.criticalStop} reserveLimit={futureDrivePreview.reserveLimit} />
                </div>
              )}
            </>
          ) : null
        ) : showDriveRoute ? (
          <>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: vehicle.x, top: vehicle.y }}
            >
              <VehicleMarker activeNavigation={activeNavigation} />
            </div>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: destinationPoint.x, top: destinationPoint.y }}
            >
              <DestinationMarker />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function MapView() {
  const { addRecentAction, events, vehicle, weather, chargingTargetPercent, chargingMinimumBatteryPercent } = useAppStore();
  const [searchParams] = useSearchParams();
  const [mapMode, setMapMode] = useState<MapMode>('aiRoute');
  const [driveExperienceMode, setDriveExperienceMode] = useState<DriveExperienceMode>('driveNow');
  const [selectedFuturePlanId, setSelectedFuturePlanId] = useState<FutureDrivePlanId>('planA');
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [mockView, setMockView] = useState<MockMapView>(defaultMockView);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [openChargeMapEvStations, setOpenChargeMapEvStations] = useState<MapEvStation[]>([]);
  const [selectedEvStop, setSelectedEvStop] = useState<MapEvStation | null>(null);
  const [selectedFavoriteStop, setSelectedFavoriteStop] = useState<FavoriteStop | null>(null);
  const [selectedRouteVariant, setSelectedRouteVariant] = useState<RouteVariant>('recommended');
  const [futureDriveNextDayRequested, setFutureDriveNextDayRequested] = useState(false);
  const [futureDriveStations, setFutureDriveStations] = useState<OpenChargeMapStationCandidate[]>([]);
  const [transientToast, setTransientToast] = useState<{ title: string; detail: string; tone: MapTone } | null>(null);
  const [realDrivingRoute, setRealDrivingRoute] = useState<DrivingRouteResult | null>(null);
  const [routeOriginPosition, setRouteOriginPosition] = useState<Coordinates | null>(null);
  const [routeLoadingDestinationId, setRouteLoadingDestinationId] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<MapCameraState>({
    cameraMode: 'routeOverview',
    activeNavigation: false,
    followCar: false,
    userInteractingWithMap: false,
    currentZoom: routeOverviewZoom,
  });
  const [lastAction, setLastAction] = useState<string | null>(null);
  const pinchRefocusTimerRef = useRef<number | null>(null);
  const destinationPreviewTimerRef = useRef<number | null>(null);
  const cameraGuardTimerRef = useRef<number | null>(null);
  const navigationOffsetTimerRef = useRef<number | null>(null);
  const transientToastTimerRef = useRef<number | null>(null);
  const programmaticCameraRef = useRef(false);
  const initialCameraFlowRef = useRef(false);
  const autoRouteRequestRef = useRef<string | null>(null);
  const cameraStateRef = useRef<MapCameraState>(cameraState);
  const isFutureDrivePreview = driveExperienceMode === 'futureDrivePreview';
  const [calendarToday] = useState(() => startOfCalendarDay(new Date()));
  const routeRequestDestination = useMemo(() => buildRouteDestinationFromParams(searchParams), [searchParams]);
  const calendarDriveDestinations = useMemo(
    () => buildCalendarDriveDestinations(events, calendarToday),
    [calendarToday, events]
  );
  const driveDestinations = useMemo(() => {
    if (!routeRequestDestination) return calendarDriveDestinations;
    return [
      routeRequestDestination,
      ...calendarDriveDestinations.filter((destination) => destination.id !== routeRequestDestination.id),
    ];
  }, [calendarDriveDestinations, routeRequestDestination]);
  const visibleDrivingDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const destinations = query
      ? calendarDriveDestinations.filter((destination) =>
          `${destination.name} ${destination.detail} ${destination.eventName ?? ''} ${destination.eventLocation ?? ''}`.toLowerCase().includes(query)
        )
      : calendarDriveDestinations;

    return destinations.slice(0, 4);
  }, [calendarDriveDestinations, searchQuery]);
  const selectedDestination = useMemo(
    () => (
      selectedDestinationId
        ? driveDestinations.find((destination) => destination.id === selectedDestinationId) ?? getEmptyDriveDestination()
        : routeRequestDestination ?? getEmptyDriveDestination()
    ),
    [driveDestinations, routeRequestDestination, selectedDestinationId]
  );
  const hasSelectedDriveRoute = selectedDestination.id !== 'calendar-empty-route';
  const calendarDataAvailable = Array.isArray(events);
  const previewDrivingDay = useMemo<FutureDrivePreviewSelection>(
    () => (
      calendarDataAvailable
        ? getPreviewDrivingDay(events, calendarToday, futureDriveNextDayRequested)
        : { date: null, events: [], mode: 'calendarUnavailable' }
    ),
    [calendarDataAvailable, calendarToday, events, futureDriveNextDayRequested]
  );
  const futureDriveStationAnchor = useMemo(() => {
    const location = previewDrivingDay.events.find((event) => event.location)?.location;
    return location ? resolveLocationCoordinates(location) : null;
  }, [previewDrivingDay.events]);
  const futureDriveStationAnchorKey = futureDriveStationAnchor
    ? `${futureDriveStationAnchor.lat.toFixed(4)},${futureDriveStationAnchor.lng.toFixed(4)}`
    : '';

  useEffect(() => {
    if (routeRequestDestination) {
      setSelectedDestinationId(routeRequestDestination.id);
      setSearchQuery(routeRequestDestination.name);
      setDriveExperienceMode('driveNow');
      setMapMode('aiRoute');
      return;
    }
  }, [routeRequestDestination]);

  useEffect(() => {
    if (!selectedDestinationId) return;
    if (driveDestinations.some((destination) => destination.id === selectedDestinationId)) return;
    setSelectedDestinationId(null);
  }, [driveDestinations, selectedDestinationId]);

  useEffect(() => {
    let cancelled = false;

    if (!futureDriveStationAnchor) {
      setFutureDriveStations([]);
      return () => {
        cancelled = true;
      };
    }

    setFutureDriveStations([]);
    fetchOpenChargeMapStations({
      latitude: futureDriveStationAnchor.lat,
      longitude: futureDriveStationAnchor.lng,
      distanceKm: 35,
      maxResults: 8,
    }).then((stations) => {
      if (!cancelled) setFutureDriveStations(stations);
    });

    return () => {
      cancelled = true;
    };
  }, [futureDriveStationAnchorKey]);

  useEffect(() => {
    let cancelled = false;

    fetchOpenChargeMapStations({
      latitude: kualaLumpurCenter.lat,
      longitude: kualaLumpurCenter.lng,
      distanceKm: 50,
      maxResults: 8,
    }).then((stations) => {
      if (!cancelled) setOpenChargeMapEvStations(stations.map(mapOpenChargeMapStationToMapStation));
    }).catch(() => {
      if (!cancelled) setOpenChargeMapEvStations([]);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const chargingPlan = useMemo(() => {
    if (!previewDrivingDay.date || previewDrivingDay.events.length === 0) return null;
    try {
      return buildChargingPlan(previewDrivingDay.events, vehicle, weather, chargingTargetPercent, previewDrivingDay.date, 'auto', undefined, futureDriveStations, chargingMinimumBatteryPercent);
    } catch {
      return null;
    }
  }, [chargingMinimumBatteryPercent, chargingTargetPercent, futureDriveStations, previewDrivingDay, vehicle, weather]);
  const futureDrivePreview = useMemo(
    () => (chargingPlan ? buildFutureDrivePreviewData(chargingPlan, previewDrivingDay) : null),
    [chargingPlan, previewDrivingDay]
  );
  const futureDriveEmptyMessage =
    previewDrivingDay.mode === 'calendarUnavailable'
      ? 'Calendar data unavailable.'
      : previewDrivingDay.mode === 'tomorrowEmpty'
        ? 'No driving activities scheduled for tomorrow.'
      : previewDrivingDay.mode === 'empty'
        ? 'No driving activities found in the next 7 days.'
        : 'Prediction data unavailable.';
  const futureDriveEmptyActionLabel = previewDrivingDay.mode === 'tomorrowEmpty' ? 'Check Next Driving Day' : undefined;
  const futureDriveRescuePlans = futureDrivePreview?.rescuePlans ?? [getUnavailableFutureDrivePlan()];
  const selectedFuturePlan =
    futureDriveRescuePlans.find((plan) => plan.id === selectedFuturePlanId) ?? futureDriveRescuePlans[0];
  const selectedFuturePlanIdForView = selectedFuturePlan.id;
  const futureDrivePrediction = futureDrivePreview
    ? getFutureDrivePrediction(futureDrivePreview, selectedFuturePlan)
    : getUnavailableFutureDrivePrediction();
  const futureDriveEmphasizeEcoRoute = Boolean(futureDrivePreview && selectedFuturePlanIdForView === 'planC' && selectedFuturePlan.canComplete);
  const futureDriveVisual = futureDriveRiskVisuals[futureDrivePrediction.riskTone];
  const visual = isFutureDrivePreview
    ? { routeColor: futureDriveVisual.color, glow: futureDriveVisual.glow, tone: 'blue' as const }
    : modeVisuals[mapMode];
  const activeTool = toolChips.find((tool) => tool.key === mapMode) ?? toolChips[0];
  const ActiveModeIcon = activeTool.icon;
  const { activeNavigation, cameraMode, currentZoom, followCar, userInteractingWithMap } = cameraState;
  const displayEvStations = openChargeMapEvStations.length ? openChargeMapEvStations : fallbackMapEvStations;
  const primaryEvStation = displayEvStations[0] ?? fallbackMapEvStations[0];
  const evStationSourceLabel = openChargeMapEvStations.length ? 'Open Charge Map' : 'Fallback stations';
  const routeAddOnPoints = [selectedFavoriteStop?.position, selectedEvStop?.position].filter(Boolean) as Coordinates[];
  const activeRouteOrigin = routeOriginPosition ?? selectedDestination.originPosition;
  const activeDrivingRoutePath = realDrivingRoute?.coordinates.length
    ? realDrivingRoute.coordinates
    : routeOriginPosition
      ? buildRoutePath(routeOriginPosition, selectedDestination.position)
      : selectedDestination.routePath;
  const routePathWithStops = routeAddOnPoints.length > 0
    ? [
        activeDrivingRoutePath[0],
        ...activeDrivingRoutePath.slice(1, -1),
        ...routeAddOnPoints,
        selectedDestination.position,
      ]
    : activeDrivingRoutePath;
  const activeRouteVariant = routeVariants.find((variant) => variant.key === selectedRouteVariant) ?? routeVariants[0];

  useEffect(() => {
    if (!mapInstance || isFutureDrivePreview) return;

    const routeLayerIds = ['mbsense-active-route-halo', 'mbsense-active-route-line'];
    const routeSourceId = 'mbsense-active-route';

    const removeRouteLayers = () => {
      routeLayerIds.forEach((layerId) => {
        if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
      });
      if (mapInstance.getSource(routeSourceId)) mapInstance.removeSource(routeSourceId);
    };

    const drawRouteLayer = () => {
      removeRouteLayers();
      if (!realDrivingRoute || realDrivingRoute.coordinates.length < 2) return;

      mapInstance.addSource(routeSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: realDrivingRoute.coordinates.map((point) => toMapLibreLngLat(point)),
              },
            },
          ],
        },
      });
      mapInstance.addLayer({
        id: 'mbsense-active-route-halo',
        type: 'line',
        source: routeSourceId,
        paint: {
          'line-color': '#ffffff',
          'line-width': 9,
          'line-opacity': 0.86,
        },
      });
      mapInstance.addLayer({
        id: 'mbsense-active-route-line',
        type: 'line',
        source: routeSourceId,
        paint: {
          'line-color': visual.routeColor,
          'line-width': 4,
          'line-opacity': 0.98,
        },
      });
    };

    if (mapInstance.isStyleLoaded()) {
      drawRouteLayer();
    } else {
      mapInstance.once('load', drawRouteLayer);
    }

    return () => {
      mapInstance.off('load', drawRouteLayer);
      removeRouteLayers();
    };
  }, [isFutureDrivePreview, mapInstance, realDrivingRoute, visual.routeColor]);
  const activeRouteEtaLabel = realDrivingRoute?.durationSeconds
    ? `${Math.max(1, Math.round(realDrivingRoute.durationSeconds / 60))} min`
    : selectedDestination.eta;
  const activeRouteDistanceLabel = realDrivingRoute?.distanceMeters
    ? `${(realDrivingRoute.distanceMeters / 1000).toFixed(1)} km`
    : selectedDestination.distance;
  const activeRouteOriginLabel = routeOriginPosition ? 'Current location' : selectedDestination.originName;
  const evStationsSheet = useMemo(() => ({
    ...bottomSheets.evStations,
    title: primaryEvStation.name,
    subtitle: `${evStationSourceLabel} fast chargers near route`,
    collapsedTitle: `${displayEvStations.length} fast charger${displayEvStations.length === 1 ? '' : 's'} nearby`,
    collapsedMeta: `Recommended: ${primaryEvStation.name}`,
    collapsedStatus: `${primaryEvStation.speed} - ${primaryEvStation.detour}`,
    metrics: [
      { label: 'Source', value: evStationSourceLabel, tone: 'cyan' as const },
      { label: 'Open', value: primaryEvStation.availability, tone: 'emerald' as const },
      { label: 'Speed', value: primaryEvStation.speed },
      { label: 'Distance', value: primaryEvStation.detour, tone: 'cyan' as const },
    ],
    options: displayEvStations.map((station) => ({
      label: station.name,
      value: station.availability,
      detail: `${station.speed} - ${station.detour}`,
    })),
    insight: openChargeMapEvStations.length
      ? 'Live station candidates are loaded from Open Charge Map. If that lookup fails, MB Sense falls back to stored demo stations.'
      : mockEvStations.note,
  }), [displayEvStations, evStationSourceLabel, openChargeMapEvStations.length, primaryEvStation]);
  const sheetBase = mapMode === 'evStations' ? evStationsSheet : bottomSheets[mapMode];
  const sheet = {
    ...sheetBase,
    title: mapMode === 'aiRoute' ? selectedDestination.name : sheetBase.title,
    subtitle: mapMode === 'aiRoute' ? selectedDestination.detail : sheetBase.subtitle,
    collapsedTitle: mapMode === 'aiRoute' ? selectedDestination.name : sheetBase.collapsedTitle,
    collapsedMeta:
      mapMode === 'aiRoute'
        ? `${activeRouteEtaLabel} - From ${activeRouteOriginLabel}`
        : sheetBase.collapsedMeta,
    collapsedStatus:
      mapMode === 'aiRoute'
        ? `Traffic: ${selectedDestination.traffic}${selectedFavoriteStop ? ` - Favorite stop added` : ''}${selectedEvStop ? ` - Charging stop added` : ''}`
        : sheetBase.collapsedStatus,
    statusValue:
      mapMode === 'aiRoute'
        ? selectedRouteVariant === 'eco'
          ? 'Eco'
          : selectedDestination.traffic
        : sheetBase.statusValue,
    metrics:
      mapMode === 'aiRoute'
        ? [
            { label: 'Depart', value: selectedDestination.departAt, tone: 'blue' as const },
            { label: 'ETA', value: activeRouteEtaLabel },
            { label: 'Distance', value: activeRouteDistanceLabel, tone: 'cyan' as const },
            { label: 'From', value: activeRouteOriginLabel, tone: 'blue' as const },
          ]
        : sheetBase.metrics,
    insight:
      mapMode === 'aiRoute'
        ? `${selectedDestination.routeInsight}${selectedFavoriteStop ? ` Favorite stop: ${selectedFavoriteStop.name}.` : ''}${selectedEvStop ? ` Charging stop: ${selectedEvStop.name}.` : ''}`
        : sheetBase.insight,
  };
  const expandedSummaryBars: Array<{ label: string; value: string; percent: number; tone: MapTone; detail?: string }> =
    mapMode === 'parking'
      ? [
          {
            label: 'Habit match',
            value: favoriteStops[0].confidence,
            percent: parsePercent(favoriteStops[0].confidence),
            tone: 'emerald',
            detail: favoriteStops[0].habit,
          },
          {
            label: 'Visit strength',
            value: favoriteStops[0].visits,
            percent: 82,
            tone: 'blue',
            detail: 'Routine confidence from repeated behavior',
          },
        ]
      : mapMode === 'evStations'
        ? [
            {
              label: 'Arrival battery',
              value: mockEvStations.batteryOnArrival,
              percent: parsePercent(mockEvStations.batteryOnArrival),
              tone: 'cyan',
              detail: 'Projected charge at destination',
            },
            {
              label: 'Open',
              value: primaryEvStation.availability,
              percent: primaryEvStation.availabilityPercent,
              tone: 'emerald',
              detail: `${primaryEvStation.speed} ${primaryEvStation.source === 'openchargemap' ? 'Open Charge Map' : 'fallback'} charger`,
            },
          ]
        : mapMode === 'cost'
          ? costDistribution
          : mapMode === 'aiRoute'
            ? [
                {
                  label: 'Route confidence',
                  value: selectedRouteVariant === 'eco' ? '86%' : '94%',
                  percent: selectedRouteVariant === 'eco' ? 86 : 94,
                  tone: selectedRouteVariant === 'eco' ? 'emerald' : 'blue',
                  detail: activeRouteVariant.detail,
                },
              ]
            : [];

  const handleMapReady = useCallback((map: maplibregl.Map | null) => {
    setMapInstance(map);
  }, []);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  const updateCameraState = useCallback((patch: Partial<MapCameraState>) => {
    setCameraState((current) => ({ ...current, ...patch }));
  }, []);

  const clearPinchRefocusTimer = useCallback(() => {
    if (pinchRefocusTimerRef.current) {
      window.clearTimeout(pinchRefocusTimerRef.current);
      pinchRefocusTimerRef.current = null;
    }
  }, []);

  const clearDestinationPreviewTimer = useCallback(() => {
    if (destinationPreviewTimerRef.current) {
      window.clearTimeout(destinationPreviewTimerRef.current);
      destinationPreviewTimerRef.current = null;
    }
  }, []);

  const showTransientToast = useCallback((title: string, detail: string, tone: MapTone = 'blue') => {
    if (transientToastTimerRef.current) {
      window.clearTimeout(transientToastTimerRef.current);
    }

    setTransientToast({ title, detail, tone });
    transientToastTimerRef.current = window.setTimeout(() => {
      setTransientToast(null);
      transientToastTimerRef.current = null;
    }, 1400);
  }, []);

  const markProgrammaticCamera = useCallback(() => {
    programmaticCameraRef.current = true;
    if (cameraGuardTimerRef.current) {
      window.clearTimeout(cameraGuardTimerRef.current);
    }
    cameraGuardTimerRef.current = window.setTimeout(() => {
      programmaticCameraRef.current = false;
      cameraGuardTimerRef.current = null;
    }, 700);
  }, []);

  const getModeFocusPoints = useCallback((mode: MapMode): Coordinates[] => {
    if (mode === 'parking') {
      return [...routePathWithStops, ...favoriteStops.map((stop) => stop.position)];
    }

    if (mode === 'evStations') {
      return [...routePathWithStops, ...displayEvStations.map((station) => station.position)];
    }

    if (mode === 'cost') {
      return [...routePathWithStops, ...costMarkers.map((marker) => marker.position)];
    }

    return [...routePathWithStops, ...selectedDestination.alternativePath];
  }, [displayEvStations, routePathWithStops, selectedDestination.alternativePath]);

  const fitRouteOverview = useCallback((nextMode: MapMode = mapMode) => {
    clearPinchRefocusTimer();
    clearDestinationPreviewTimer();
    markProgrammaticCamera();

    updateCameraState({
      cameraMode: 'routeOverview',
      followCar: false,
      userInteractingWithMap: false,
      currentZoom: routeOverviewZoom,
    });

    if (mapInstance) {
      fitMapLibreToCoordinates(mapInstance, getModeFocusPoints(nextMode), 72);
      window.setTimeout(() => {
        const fittedZoom = mapInstance.getZoom() ?? routeOverviewZoom;
        const nextZoom = Math.min(fittedZoom, routeOverviewZoom);
        mapInstance.setZoom(nextZoom);
        updateCameraState({ currentZoom: nextZoom });
      }, 260);
    }

    setMockView(getMockCameraView('routeOverview'));
  }, [
    clearDestinationPreviewTimer,
    clearPinchRefocusTimer,
    getModeFocusPoints,
    mapInstance,
    mapMode,
    markProgrammaticCamera,
    updateCameraState,
  ]);

  const fitFutureDrivePreview = useCallback(() => {
    clearPinchRefocusTimer();
    clearDestinationPreviewTimer();
    markProgrammaticCamera();

    updateCameraState({
      activeNavigation: false,
      cameraMode: 'routeOverview',
      followCar: false,
      userInteractingWithMap: false,
      currentZoom: routeOverviewZoom,
    });

    if (mapInstance && futureDrivePreview) {
      const previewPoints = futureDrivePreview.suggestedCharger
        ? [...futureDrivePreview.stops.map((stop) => stop.position), futureDrivePreview.suggestedCharger.position]
        : futureDrivePreview.stops.map((stop) => stop.position);
      fitMapLibreToCoordinates(mapInstance, previewPoints, 76);
      window.setTimeout(() => {
        const fittedZoom = mapInstance.getZoom() ?? routeOverviewZoom;
        const nextZoom = Math.min(fittedZoom, routeOverviewZoom);
        mapInstance.setZoom(nextZoom);
        updateCameraState({ currentZoom: nextZoom });
      }, 260);
    }

    setMockView(getMockCameraView('routeOverview'));
  }, [
    clearDestinationPreviewTimer,
    clearPinchRefocusTimer,
    futureDrivePreview,
    mapInstance,
    markProgrammaticCamera,
    updateCameraState,
  ]);

  const getDestinationPreviewMockView = useCallback(() => {
    return createMockFocusView({
      point: coordsToUnitPoint(selectedDestination.position),
      target: { x: 0.5, y: 0.48 },
      zoom: getMockCameraView('destinationPreview').zoom,
    });
  }, [selectedDestination.position]);

  const getVehicleFollowMockView = useCallback(() => {
    return createMockFocusView({
      point: coordsToUnitPoint(activeRouteOrigin),
      target: { x: 0.5, y: 0.62 },
      zoom: getMockCameraView('navigationFollow').zoom,
    });
  }, [activeRouteOrigin]);

  const centerNavigationCamera = useCallback(() => {
    markProgrammaticCamera();
    clearPinchRefocusTimer();
    clearDestinationPreviewTimer();

    updateCameraState({
      activeNavigation: true,
      cameraMode: 'navigationFollow',
      followCar: true,
      userInteractingWithMap: false,
      currentZoom: navigationZoom,
    });

    if (mapInstance) {
      mapInstance.setZoom(navigationZoom);
      mapInstance.panTo(toMapLibreLngLat(activeRouteOrigin));
      window.setTimeout(() => {
        mapInstance.panTo(toMapLibreLngLat(activeRouteOrigin));
        if (navigationOffsetTimerRef.current) {
          window.clearTimeout(navigationOffsetTimerRef.current);
        }
        navigationOffsetTimerRef.current = window.setTimeout(() => {
          mapInstance.panBy([0, Math.round(window.innerHeight * 0.12)]);
          navigationOffsetTimerRef.current = null;
        }, 220);
      }, 180);
    }

    setMockView(getVehicleFollowMockView());
  }, [
    clearDestinationPreviewTimer,
    clearPinchRefocusTimer,
    getVehicleFollowMockView,
    mapInstance,
    markProgrammaticCamera,
    activeRouteOrigin,
    updateCameraState,
  ]);

  const handleManualMapExplore = useCallback(() => {
    clearPinchRefocusTimer();
    clearDestinationPreviewTimer();
    updateCameraState({
      cameraMode: 'manualExplore',
      followCar: false,
      userInteractingWithMap: true,
    });
  }, [clearDestinationPreviewTimer, clearPinchRefocusTimer, updateCameraState]);

  const schedulePinchRefocus = useCallback(() => {
    clearPinchRefocusTimer();
    pinchRefocusTimerRef.current = window.setTimeout(() => {
      if (cameraStateRef.current.activeNavigation) {
        centerNavigationCamera();
      } else {
        updateCameraState({ userInteractingWithMap: false });
      }
      pinchRefocusTimerRef.current = null;
    }, pinchRefocusDelayMs);
  }, [centerNavigationCamera, clearPinchRefocusTimer, updateCameraState]);

  const handleZoomInteraction = useCallback((nextZoom?: number) => {
    const zoomPatch = typeof nextZoom === 'number' ? { currentZoom: Number(nextZoom.toFixed(1)) } : {};

    if (programmaticCameraRef.current) {
      updateCameraState(zoomPatch);
      return;
    }

    if (!cameraStateRef.current.activeNavigation) {
      updateCameraState(zoomPatch);
      return;
    }

    updateCameraState({
      ...zoomPatch,
      followCar: false,
      userInteractingWithMap: true,
    });
    schedulePinchRefocus();
  }, [schedulePinchRefocus, updateCameraState]);

  const focusDestinationPreview = useCallback(() => {
    clearPinchRefocusTimer();
    clearDestinationPreviewTimer();
    markProgrammaticCamera();

    updateCameraState({
      activeNavigation: false,
      cameraMode: 'destinationPreview',
      followCar: false,
      userInteractingWithMap: false,
      currentZoom: destinationPreviewZoom,
    });

    if (mapInstance) {
      mapInstance.panTo(toMapLibreLngLat(selectedDestination.position));
      window.setTimeout(() => {
        mapInstance.setZoom(destinationPreviewZoom);
      }, 180);
    }

    setMockView(getDestinationPreviewMockView());
  }, [
    clearDestinationPreviewTimer,
    clearPinchRefocusTimer,
    getDestinationPreviewMockView,
    mapInstance,
    markProgrammaticCamera,
    selectedDestination.position,
    updateCameraState,
  ]);

  useEffect(() => {
    if (cameraMode !== 'destinationPreview' || activeNavigation) return;

    clearDestinationPreviewTimer();
    destinationPreviewTimerRef.current = window.setTimeout(() => {
      if (!cameraStateRef.current.activeNavigation && cameraStateRef.current.cameraMode === 'destinationPreview') {
        fitRouteOverview(mapMode);
      }
      destinationPreviewTimerRef.current = null;
    }, destinationPreviewDelayMs);

    return () => {
      clearDestinationPreviewTimer();
    };
  }, [activeNavigation, cameraMode, clearDestinationPreviewTimer, fitRouteOverview, mapMode]);

  useEffect(() => {
    if (initialCameraFlowRef.current) return;
    if (!mapInstance) return;

    initialCameraFlowRef.current = true;
    if (!hasSelectedDriveRoute) {
      mapInstance.setZoom(defaultMapLibreZoom);
      mapInstance.panTo(toMapLibreLngLat(kualaLumpurCenter));
      setMockView(defaultMockView);
      return;
    }

    focusDestinationPreview();
  }, [focusDestinationPreview, hasSelectedDriveRoute, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;

    const handleMapZoom = () => {
      const nextZoom = mapInstance.getZoom();
      handleZoomInteraction(typeof nextZoom === 'number' ? nextZoom : undefined);
    };

    mapInstance.on('dragstart', handleManualMapExplore);
    mapInstance.on('zoom', handleMapZoom);

    return () => {
      mapInstance.off('dragstart', handleManualMapExplore);
      mapInstance.off('zoom', handleMapZoom);
    };
  }, [handleManualMapExplore, handleZoomInteraction, mapInstance]);

  useEffect(() => {
    return () => {
      clearPinchRefocusTimer();
      clearDestinationPreviewTimer();
      if (cameraGuardTimerRef.current) {
        window.clearTimeout(cameraGuardTimerRef.current);
      }
      if (navigationOffsetTimerRef.current) {
        window.clearTimeout(navigationOffsetTimerRef.current);
      }
      if (transientToastTimerRef.current) {
        window.clearTimeout(transientToastTimerRef.current);
      }
    };
  }, [clearDestinationPreviewTimer, clearPinchRefocusTimer]);

  const handleModeChange = (nextMode: MapMode) => {
    setDriveExperienceMode('driveNow');
    setMapMode(nextMode);
    setSheetState('collapsed');
    setLastAction(null);
    setActivePanel(null);
  };

  const handleDriveExperienceChange = (nextMode: DriveExperienceMode) => {
    if (nextMode === driveExperienceMode) return;

    setDriveExperienceMode(nextMode);
    setActivePanel(null);
    setLastAction(null);

    if (nextMode === 'futureDrivePreview') {
      setSheetState('expanded');
      fitFutureDrivePreview();
      return;
    }

    setSheetState('collapsed');
    fitRouteOverview(mapMode);
  };

  const handleFuturePlanSelect = (planId: FutureDrivePlanId) => {
    const nextPlan = futureDriveRescuePlans.find((plan) => plan.id === planId) ?? futureDriveRescuePlans[0];
    setSelectedFuturePlanId(planId);
    setLastAction(`${nextPlan.title} selected`);
  };

  const handleBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-map-ui="true"]')) return;
    if (isFutureDrivePreview) return;
    if (sheetState !== 'expanded') return;
    setSheetState('collapsed');
  };

  const handleRecenter = () => {
    updateCameraState({ userInteractingWithMap: false });
    if (isFutureDrivePreview) {
      fitFutureDrivePreview();
      return;
    }

    if (cameraStateRef.current.activeNavigation) {
      centerNavigationCamera();
      return;
    }

    markProgrammaticCamera();
    updateCameraState({
      activeNavigation: false,
      cameraMode: 'routeOverview',
      followCar: false,
      userInteractingWithMap: false,
      currentZoom: defaultMapLibreZoom,
    });
    if (mapInstance) {
      mapInstance.setZoom(defaultMapLibreZoom);
      mapInstance.panTo(toMapLibreLngLat(kualaLumpurCenter));
    }
    setMockView(defaultMockView);
  };

  const applyNavigationZoomControl = (nextScale: number, nextCameraZoom: number) => {
    markProgrammaticCamera();
    clearPinchRefocusTimer();

    updateCameraState({
      cameraMode: 'navigationFollow',
      currentZoom: nextCameraZoom,
      followCar: true,
      userInteractingWithMap: false,
    });

    if (mapInstance) {
      mapInstance.setZoom(nextCameraZoom);
      mapInstance.panTo(toMapLibreLngLat(selectedDestination.originPosition));
      window.setTimeout(() => {
        mapInstance.panBy([0, Math.round(window.innerHeight * 0.12)]);
      }, 180);
    }

    setMockView(createMockFocusView({
      point: coordsToUnitPoint(selectedDestination.originPosition),
      target: { x: 0.5, y: 0.62 },
      zoom: nextScale,
    }));
  };

  const handleZoomIn = () => {
    const nextMockScale = clampMockView({ ...mockView, zoom: mockView.zoom + 0.18 }).zoom;

    if (activeNavigation && followCar) {
      applyNavigationZoomControl(nextMockScale, Math.min(currentZoom + 1, 18));
      return;
    }

    if (mapInstance) {
      const nextZoom = (mapInstance.getZoom() ?? routeOverviewZoom) + 1;
      handleZoomInteraction(nextZoom);
      mapInstance.setZoom(nextZoom);
    }
    const nextView = clampMockView({ ...mockView, zoom: nextMockScale });
    handleZoomInteraction(mockScaleToCameraZoom(nextView.zoom));
    setMockView(nextView);
  };

  const handleZoomOut = () => {
    const nextMockScale = clampMockView({ ...mockView, zoom: mockView.zoom - 0.18 }).zoom;

    if (activeNavigation && followCar) {
      applyNavigationZoomControl(nextMockScale, Math.max(currentZoom - 1, 7));
      return;
    }

    if (mapInstance) {
      const nextZoom = (mapInstance.getZoom() ?? routeOverviewZoom) - 1;
      handleZoomInteraction(nextZoom);
      mapInstance.setZoom(nextZoom);
    }
    const nextView = clampMockView({ ...mockView, zoom: nextMockScale });
    handleZoomInteraction(mockScaleToCameraZoom(nextView.zoom));
    setMockView(nextView);
  };

  const handleDestinationSelect = async (destination: DriveDestination) => {
    setDriveExperienceMode('driveNow');
    setSelectedDestinationId(destination.id);
    setSearchQuery(destination.name);
    setActivePanel(null);
    setSheetState('collapsed');
    setMapMode('aiRoute');
    setSelectedRouteVariant('recommended');
    setSelectedFavoriteStop(null);
    setSelectedEvStop(null);
    setRealDrivingRoute(null);
    setRouteOriginPosition(null);
    setRouteLoadingDestinationId(destination.id);

    const currentLocation = await getBrowserCurrentCoordinates();
    const originPosition = currentLocation ?? destination.originPosition;
    setRouteOriginPosition(currentLocation);

    const params = new URLSearchParams({
      originLat: String(originPosition.lat),
      originLng: String(originPosition.lng),
      destinationLat: String(destination.position.lat),
      destinationLng: String(destination.position.lng),
    });

    try {
      const response = await fetch(`/api/routing/driving?${params.toString()}`);
      if (!response.ok) throw new Error(`Route request failed with ${response.status}`);

      const route = await response.json() as DrivingRouteResult;
      if (!route.coordinates?.length) throw new Error('Route response did not include coordinates');

      setRealDrivingRoute(route);
      setLastAction(`Route set: ${destination.name}`);
      updateCameraState({
        activeNavigation: false,
        followCar: false,
        userInteractingWithMap: false,
        cameraMode: 'routeOverview',
        currentZoom: routeOverviewZoom,
      });

      const distanceKm = route.distanceMeters > 0 ? `${(route.distanceMeters / 1000).toFixed(1)} km` : destination.distance;
      const durationMinutes = route.durationSeconds > 0 ? `${Math.max(1, Math.round(route.durationSeconds / 60))} min` : destination.eta;
      const originLabel = currentLocation ? 'Current location' : destination.originName;
      showTransientToast('Route loaded', `${originLabel} to ${destination.name} - ${distanceKm} - ${durationMinutes}`, 'blue');

      if (mapInstance) {
        markProgrammaticCamera();
        fitMapLibreToCoordinates(mapInstance, route.coordinates, 76);
      }

      setMockView(getMockCameraView('routeOverview'));
    } catch (error) {
      console.error('Driving route load failed:', error);
      setRealDrivingRoute(null);
      updateCameraState({
        activeNavigation: false,
        followCar: false,
        userInteractingWithMap: false,
        cameraMode: 'routeOverview',
        currentZoom: routeOverviewZoom,
      });

      const fallbackPath = buildRoutePath(originPosition, destination.position);
      if (mapInstance) {
        markProgrammaticCamera();
        fitMapLibreToCoordinates(mapInstance, fallbackPath, 76);
      }
      setMockView(getMockCameraView('routeOverview'));
      showTransientToast('Route preview loaded', 'Live traffic route unavailable; showing an estimated route.', 'amber');
    } finally {
      setRouteLoadingDestinationId(null);
    }
  };

  useEffect(() => {
    if (!routeRequestDestination) {
      autoRouteRequestRef.current = null;
      return;
    }

    if (autoRouteRequestRef.current === routeRequestDestination.id) return;
    autoRouteRequestRef.current = routeRequestDestination.id;
    void handleDestinationSelect(routeRequestDestination);
  }, [handleDestinationSelect, routeRequestDestination]);

  const stopNavigation = () => {
    clearPinchRefocusTimer();
    clearDestinationPreviewTimer();
    updateCameraState({
      activeNavigation: false,
      followCar: false,
      userInteractingWithMap: false,
      cameraMode: 'routeOverview',
      currentZoom: routeOverviewZoom,
    });
    setLastAction('Navigation Stopped');
    setActivePanel(null);
    fitRouteOverview('aiRoute');
    showTransientToast('Navigation stopped', 'Route overview restored', 'slate');
  };

  const startNavigation = () => {
    if (!hasSelectedDriveRoute) {
      setActivePanel(null);
      showTransientToast('Choose destination', 'No route selected', 'blue');
      return;
    }

    setSheetState('collapsed');
    setMapMode('aiRoute');
    setActivePanel(null);
    setLastAction('Navigation Active');
    centerNavigationCamera();
    showTransientToast('Navigation started', `Guidance to ${selectedDestination.name}`, 'blue');
    addRecentAction({
      icon: 'navigation',
      title: 'Navigation Active',
      description: `Following vehicle toward ${selectedDestination.name}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleRouteVariantApply = (variant: RouteVariant) => {
    const nextVariant = routeVariants.find((item) => item.key === variant) ?? routeVariants[0];
    setSelectedRouteVariant(variant);
    setActivePanel(null);
    setSheetState('collapsed');
    setMapMode('aiRoute');
    setLastAction(`${nextVariant.name} applied`);
    fitRouteOverview('aiRoute');
    showTransientToast('Route applied', nextVariant.name, nextVariant.tone);
  };

  const handleEvStopSelect = (station: MapEvStation) => {
    setSelectedEvStop(station);
    setActivePanel(null);
    setSheetState('collapsed');
    setMapMode('aiRoute');
    setLastAction(`Charging stop added: ${station.name}`);
    fitRouteOverview('aiRoute');
    showTransientToast('Charging stop added', `${station.name} - ${station.detour}`, 'cyan');
  };

  const handleEvStopRemove = () => {
    const removedName = selectedEvStop?.name ?? 'Charging stop';
    setSelectedEvStop(null);
    setLastAction(`${removedName} removed`);
    fitRouteOverview('aiRoute');
    showTransientToast('Charging stop removed', 'Route recalculated', 'slate');
  };

  const handleFavoriteStopSelect = (stop: FavoriteStop) => {
    setSelectedFavoriteStop(stop);
    setActivePanel(null);
    setSheetState('collapsed');
    setMapMode('aiRoute');
    setLastAction(`Favorite stop added: ${stop.name}`);
    fitRouteOverview('aiRoute');
    showTransientToast('Favorite stop added', `${stop.name} - ${stop.habit}`, 'emerald');
  };

  const handleModeAction = (label: string) => {
    if (label === 'Start Navigation') {
      startNavigation();
      return;
    }

    if (label === 'Stop Navigation') {
      stopNavigation();
      return;
    }

    if (label === 'View Cost Breakdown') {
      setActivePanel('costBreakdown');
      setMapMode('cost');
      setSheetState('expanded');
      return;
    }

    if (label === 'Compare Routes' || label === 'Optimize Route') {
      setActivePanel('routeCompare');
      setMapMode('aiRoute');
      setSheetState('expanded');
      return;
    }

    if (label === 'Optimize Cost') {
      setActivePanel('costBreakdown');
      setMapMode('cost');
      setSheetState('expanded');
      return;
    }

    if (label === 'Add Charging Stop' || label === 'Navigate Directly') {
      setActivePanel('evStops');
      setMapMode('evStations');
      setSheetState('expanded');
      return;
    }

    if (label === 'Add Favorite Stop') {
      handleFavoriteStopSelect(favoriteStops[0]);
      return;
    }

    if (label === 'View Stops') {
      setActivePanel('favoriteStops');
      setMapMode('parking');
      setSheetState('expanded');
      return;
    }

    setLastAction(label);
    showTransientToast(label, `${sheet.eyebrow} action selected`, visual.tone);
    addRecentAction({
      icon: label.includes('Navigate') || label.includes('Navigation') ? 'navigation' : 'explore',
      title: label,
      description: `${sheet.eyebrow} action selected for ${sheet.title}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleFutureDriveAction = (action: FutureDriveAction) => {
    const detail =
      action === 'Optimize Selected Plan'
        ? `${selectedFuturePlan.title} applied - expected ${futureDrivePrediction.finalBattery}% after planned travel.`
        : action === 'Compare Rescue Routes'
          ? `${futureDriveRescuePlans.length} charging options compared. ${selectedFuturePlan.title} is selected.`
          : `Reminder preview for ${selectedFuturePlan.action}.`;

    setLastAction(action);
    showTransientToast(action, detail, action === 'Set Charging Reminder' ? 'cyan' : action === 'Compare Rescue Routes' ? 'amber' : 'blue');
  };

  const collapsedActionLabel =
    activeNavigation && mapMode === 'aiRoute' && sheet.collapsedAction === 'Start Navigation'
      ? 'Stop Navigation'
      : sheet.collapsedAction;
  const expandedPrimaryActionLabel =
    activeNavigation && mapMode === 'aiRoute' && sheet.primaryAction === 'Start Navigation'
      ? 'Stop Navigation'
      : sheet.primaryAction;
  const primaryActionLabel = sheetState === 'collapsed' ? collapsedActionLabel : expandedPrimaryActionLabel;
  const PrimaryActionIcon = primaryActionLabel.includes('Charging')
    ? Plug
    : primaryActionLabel.includes('Compare') || primaryActionLabel.includes('Cost')
      ? Banknote
      : primaryActionLabel.includes('Favorite') || primaryActionLabel.includes('Stop')
        ? Coffee
        : Navigation;
  const SecondaryActionIcon = sheet.secondaryAction.includes('Navigate')
    ? Navigation
    : sheet.secondaryAction.includes('Stops')
      ? Coffee
      : Sparkles;
  const isManualExplore = cameraMode === 'manualExplore' || userInteractingWithMap || (activeNavigation && !followCar);
  const recenterIsPrimary = isManualExplore || (activeNavigation && !followCar);
  const recenterControlLabel =
    sheetState === 'expanded'
      ? undefined
    : activeNavigation || isManualExplore
        ? 'Re-center'
          : 'KL';
  const mapStateLabel = activeNavigation
    ? followCar
      ? 'Following'
      : 'Browsing map'
    : isManualExplore
      ? 'Browsing map'
      : 'Overview';
  const MapStateIcon = activeNavigation ? Navigation : isManualExplore ? LocateFixed : Route;
  const controlBottomClass = isFutureDrivePreview
    ? 'bottom-[calc(12.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(11rem+env(safe-area-inset-bottom))] md:bottom-8'
    : sheetState === 'expanded'
      ? 'bottom-[calc(62dvh+env(safe-area-inset-bottom))] sm:bottom-[calc(59dvh+env(safe-area-inset-bottom))] lg:bottom-8'
      : 'bottom-[calc(12.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(11rem+env(safe-area-inset-bottom))] lg:bottom-8';

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-surface text-on-surface"
      data-active-navigation={activeNavigation ? 'true' : 'false'}
      data-camera-mode={cameraMode}
      data-current-zoom={currentZoom}
      data-follow-car={followCar ? 'true' : 'false'}
      data-map-mode={mapMode}
      data-user-interacting-with-map={userInteractingWithMap ? 'true' : 'false'}
      onClick={handleBackgroundClick}
    >
      <MapLibreBaseMap onReady={handleMapReady} />
      <MockMapCanvas
        mode={mapMode}
        driveMode={driveExperienceMode}
        futureDrivePreview={futureDrivePreview}
        selectedFuturePlan={selectedFuturePlan}
        selectedFuturePlanId={selectedFuturePlanIdForView}
        emphasizeFutureEcoRoute={futureDriveEmphasizeEcoRoute}
        sheetState={sheetState}
        view={mockView}
        cameraMode={cameraMode}
        activeNavigation={activeNavigation}
        showDriveRoute={hasSelectedDriveRoute}
        routePath={routePathWithStops}
        alternativePath={selectedDestination.alternativePath}
        routeDetail={selectedDestination.eta}
        alternativeRouteDetail={activeRouteVariant.etaDelta}
        origin={activeRouteOrigin}
        destination={selectedDestination.position}
        evStationOptions={displayEvStations}
        addedEvStop={selectedEvStop}
        selectedFavoriteStop={selectedFavoriteStop}
        onViewChange={setMockView}
        onManualPan={handleManualMapExplore}
        onZoomInteraction={handleZoomInteraction}
      />

      <div
        data-map-ui="true"
        className="absolute left-3 top-[88px] z-30 w-[min(calc(100vw-1.5rem),410px)] transition-all duration-300 ease-out sm:left-5 md:left-8 lg:left-10"
      >
        <div className="w-full">
          <div className="flex items-center gap-1">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (visibleDrivingDestinations[0] && !isFutureDrivePreview) {
                  handleDestinationSelect(visibleDrivingDestinations[0]);
                }
              }}
              className="relative min-w-0 flex-1"
            >
              <span className="pointer-events-none absolute left-1.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-primary/20 bg-surface-container-low text-primary shadow-ambient">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                }}
                placeholder={isFutureDrivePreview ? 'Where to tomorrow?' : 'Where to?'}
                className="h-11 w-full rounded-full border border-outline-variant/45 bg-surface-container-lowest/88 pl-12 pr-11 text-[13px] font-medium text-on-surface shadow-ambient backdrop-blur-2xl outline-none transition placeholder:text-slate-500 focus:border-primary/35 focus:bg-surface-container-lowest"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActivePanel(null);
                  }}
                  aria-label="Clear destination search"
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-300 transition hover:bg-primary/10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>

            <button
              type="button"
              onClick={() => handleDriveExperienceChange(isFutureDrivePreview ? 'driveNow' : 'futureDrivePreview')}
              aria-label={isFutureDrivePreview ? 'Switch to Drive Now' : 'Switch to FutureDrive Preview'}
              title={isFutureDrivePreview ? 'Drive Now' : 'FutureDrive Preview'}
              className={cn(
                'flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-[9px] font-semibold uppercase tracking-[0.08em] shadow-ambient backdrop-blur-2xl transition duration-200 ease-out active:scale-[0.97]',
                isFutureDrivePreview
                  ? 'border-outline-variant/45 bg-surface-container-lowest/88 text-slate-200 hover:bg-primary/10'
                  : 'border-primary/25 bg-primary text-on-primary hover:bg-primary/90'
              )}
            >
              {isFutureDrivePreview ? <Navigation className="h-3.5 w-3.5 shrink-0" /> : <Sparkles className="h-3.5 w-3.5 shrink-0" />}
              <span className={cn('hidden sm:inline', !isFutureDrivePreview && 'md:hidden lg:inline')}>
                {isFutureDrivePreview ? 'Drive Now' : 'Future'}
              </span>
            </button>
          </div>

          {!isFutureDrivePreview && (
            <div className="mt-2 overflow-hidden rounded-[22px] border border-outline-variant/45 bg-surface-container-lowest/92 p-2 shadow-ambient-lg backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3 px-2 pb-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Driving destinations</p>
                <span className="rounded-full border border-primary/18 bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">
                  {calendarDriveDestinations.length}
                </span>
              </div>
              <div className="max-h-[min(34dvh,18rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleDrivingDestinations.length ? (
                  visibleDrivingDestinations.map((destination) => {
                    const isSelected = selectedDestination.id === destination.id;
                    const isLoading = routeLoadingDestinationId === destination.id;

                    return (
                      <button
                        key={destination.id}
                        type="button"
                        onClick={() => handleDestinationSelect(destination)}
                        className={cn(
                          'flex min-h-14 w-full items-center gap-2.5 rounded-[18px] px-2.5 py-2 text-left transition active:scale-[0.99]',
                          isSelected ? 'bg-primary/12 text-on-surface' : 'hover:bg-primary/10'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                            isSelected ? 'border-primary/35 bg-primary text-on-primary' : 'border-primary/20 bg-primary/10 text-primary'
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-on-surface">{destination.name}</span>
                          <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-slate-500">
                            {isLoading ? 'Loading route...' : [destination.departAt, destination.eta, destination.distance].join(' - ')}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-outline-variant/45 bg-surface-container-low px-2 py-0.5 text-[9px] font-black text-slate-300">
                          {destination.traffic}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex min-h-14 items-center justify-center rounded-[18px] px-3 py-3 text-center">
                    <p className="text-[11px] font-semibold leading-relaxed text-slate-500">No upcoming car-needed calendar drives.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isFutureDrivePreview && (
        <div
          className={cn(
            'pointer-events-none absolute right-3 z-20 transition-all duration-300 ease-out sm:right-5',
            isManualExplore || activeNavigation ? 'top-[9.25rem] sm:top-[9.5rem]' : 'top-[8.35rem] sm:top-[8.65rem]'
          )}
        >
          <div
            data-map-ui="true"
            className="pointer-events-auto grid w-13 gap-1 rounded-[22px] border border-outline-variant/45 bg-surface-container-lowest/88 p-1 shadow-ambient backdrop-blur-2xl"
          >
            {toolChips.map((tool) => {
              const Icon = tool.icon;
              const isActive = mapMode === tool.key;

              return (
                <button
                  key={tool.key}
                  type="button"
                  aria-label={tool.label}
                  title={tool.label}
                  onClick={() => handleModeChange(tool.key)}
                  className={cn(
                    'flex h-11 w-11 min-w-0 items-center justify-center rounded-[17px] border text-center transition duration-200 ease-out active:scale-[0.98]',
                    isActive
                      ? 'border-primary/25 bg-primary/10 text-primary shadow-ambient'
                      : 'border-transparent bg-transparent text-slate-300 hover:bg-primary/10'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border',
                      isActive ? 'border-slate-300/55 bg-white text-blue-600' : 'border-white/[0.08] bg-white/[0.04] text-slate-400'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="sr-only">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(isManualExplore || activeNavigation) && (
        <div
          data-map-ui="true"
          className="pointer-events-auto absolute right-3 top-[4.45rem] z-40 transition-all duration-300 ease-out sm:right-5 sm:top-[4.8rem]"
        >
          <MapStatePill icon={MapStateIcon} label={mapStateLabel} active={isManualExplore || activeNavigation} />
        </div>
      )}

      <div
        data-map-ui="true"
        className={cn('absolute right-3 z-30 flex flex-col items-end gap-2 transition-all duration-300 ease-out sm:right-5', controlBottomClass)}
      >
        <MapControlGroup className={cn(sheetState === 'expanded' && 'hidden sm:block')}>
          <MapControlButton icon={Plus} ariaLabel="Zoom in" onClick={handleZoomIn} />
          <MapControlButton icon={Minus} ariaLabel="Zoom out" onClick={handleZoomOut} />
        </MapControlGroup>
        <MapControlGroup>
          <MapControlButton
            icon={LocateFixed}
            label={recenterControlLabel}
            ariaLabel={activeNavigation && !followCar ? 'Center map on vehicle' : 'Center map'}
            onClick={handleRecenter}
            active={recenterIsPrimary}
          />
        </MapControlGroup>
      </div>

      {transientToast && (
        <div className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center px-6">
          <div
            className="max-w-[320px] rounded-3xl border border-outline-variant/45 bg-surface-container-lowest/92 px-5 py-4 text-center shadow-ambient-lg backdrop-blur-2xl"
            style={{ boxShadow: `var(--shadow-ambient-lg), 0 0 0 1px ${toneAccentColors[transientToast.tone]}22` }}
          >
            <div
              className={cn(
                'mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border',
                toneClasses[transientToast.tone].icon
              )}
            >
              <Check className="h-5 w-5" />
            </div>
            <p className="text-[15px] font-semibold text-white">{transientToast.title}</p>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-400">{transientToast.detail}</p>
          </div>
        </div>
      )}

      <div
        data-map-ui="true"
        className={cn(
          'absolute z-[60] transition-all duration-300 ease-out',
          isFutureDrivePreview
            ? 'inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] h-[min(72dvh,43rem)] md:inset-x-auto md:left-8 md:bottom-8 md:w-[360px] md:max-w-[calc(48vw-2rem)] lg:left-10 lg:w-[380px]'
            : cn(
                'inset-x-3 sm:inset-x-auto sm:w-[430px] sm:max-w-[calc(100vw-4rem)]',
                'sm:left-5 md:left-8 lg:left-10',
                sheetState === 'expanded'
                  ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] sm:bottom-8'
                  : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] sm:bottom-8'
              )
        )}
      >
        {isFutureDrivePreview ? (
          <FutureDrivePreviewSheet
            preview={futureDrivePreview}
            emptyMessage={futureDriveEmptyMessage}
            emptyActionLabel={futureDriveEmptyActionLabel}
            rescuePlans={futureDriveRescuePlans}
            selectedPlan={selectedFuturePlan}
            selectedPlanId={selectedFuturePlanIdForView}
            prediction={futureDrivePrediction}
            onPlanSelect={handleFuturePlanSelect}
            onEmptyAction={() => setFutureDriveNextDayRequested(true)}
            onAction={handleFutureDriveAction}
          />
        ) : (
          <section
            aria-label={`${sheet.eyebrow} route details`}
            className={cn(
              'overflow-hidden rounded-[20px] border border-outline-variant/45 bg-surface-container-lowest/92 shadow-ambient-lg backdrop-blur-2xl transition-all duration-300 ease-out',
              sheetState === 'expanded' ? 'max-h-[58dvh] sm:max-h-[56dvh]' : 'max-h-48'
            )}
            style={{ boxShadow: `var(--shadow-ambient-lg), 0 0 0 1px ${visual.routeColor}18` }}
          >
          <button
            type="button"
            aria-label={sheetState === 'expanded' ? 'Collapse route details' : 'Expand route details'}
            onClick={() => setSheetState((current) => (current === 'expanded' ? 'collapsed' : 'expanded'))}
            className="flex w-full justify-center px-4 pb-1 pt-2 transition duration-200 ease-out active:scale-[0.99]"
          >
            <span className="h-0.5 w-8 rounded-full bg-white/18" />
          </button>

          {sheetState === 'collapsed' ? (
            <div className="px-3.5 pb-3.5">
              <button
                type="button"
                onClick={() => setSheetState('expanded')}
                className="block w-full text-left transition duration-200 ease-out active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                          toneClasses[visual.tone].icon
                        )}
                      >
                        <ActiveModeIcon className="h-3 w-3" />
                      </span>
                      <p className="text-[8.5px] font-semibold uppercase tracking-[0.15em] text-slate-500">{sheet.eyebrow}</p>
                    </div>
                    <h2 className="mt-1.5 truncate text-[15px] font-semibold leading-tight text-white">{sheet.collapsedTitle}</h2>
                    <p className="mt-1 truncate text-[12px] font-medium text-slate-300">{sheet.collapsedMeta}</p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium text-slate-500">{sheet.collapsedStatus}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-full border border-white/[0.075] bg-white/[0.035] px-2.5 py-0.5 text-[9.5px] font-semibold text-slate-200"
                    style={{ color: visual.routeColor }}
                  >
                    {sheet.statusValue}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeAction(collapsedActionLabel)}
                className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-[16px] bg-primary px-3 text-[10px] font-semibold uppercase tracking-[0.05em] text-on-primary shadow-ambient transition duration-200 ease-out active:scale-[0.98]"
              >
                <PrimaryActionIcon className="h-3.5 w-3.5 shrink-0" />
                {collapsedActionLabel}
              </button>
            </div>
          ) : (
            <div className="flex max-h-[calc(58dvh-1.5rem)] min-h-0 flex-col sm:max-h-[calc(56dvh-1.5rem)]">
              <div className="border-b border-white/[0.065] px-4 pb-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                          toneClasses[visual.tone].icon
                        )}
                      >
                        <ActiveModeIcon className="h-3 w-3" />
                      </span>
                      <p className="text-[8.5px] font-semibold uppercase tracking-[0.15em] text-slate-500">{sheet.eyebrow}</p>
                    </div>
                    <h2 className="mt-1.5 truncate text-[17px] font-semibold leading-tight text-white">{sheet.title}</h2>
                    <p className="mt-1 truncate text-[12px] font-medium text-slate-400">{sheet.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheetState('collapsed')}
                    aria-label="Close route details"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.075] bg-white/[0.035] text-slate-300 transition duration-200 ease-out active:scale-[0.96] hover:bg-white/[0.06]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div
                  className={cn(
                    'grid rounded-[16px] border border-white/[0.05] bg-white/[0.022] p-1',
                    mapMode === 'aiRoute' ? 'grid-cols-4' : mapMode === 'cost' ? 'grid-cols-3' : 'grid-cols-2'
                  )}
                >
                  {sheet.metrics.map((metric, index) => (
                    <div
                      key={`${sheet.eyebrow}-${metric.label}`}
                      className={cn(
                        'min-w-0 px-2 py-1.5',
                        mapMode === 'aiRoute' && index > 0 && 'border-l border-white/[0.06]',
                        mapMode === 'cost' && index > 2 && 'border-t border-white/[0.06]',
                        mapMode === 'cost' && index % 3 !== 0 && 'border-l border-white/[0.06]',
                        mapMode !== 'aiRoute' && mapMode !== 'cost' && index > 1 && 'border-t border-white/[0.06]',
                        mapMode !== 'aiRoute' && mapMode !== 'cost' && index % 2 === 1 && 'border-l border-white/[0.06]'
                      )}
                    >
                      <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
                      <p className={cn('mt-1 truncate text-[12.5px] font-semibold text-white', metric.tone && toneClasses[metric.tone].text)}>
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>

                {expandedSummaryBars.length > 0 && (
                  <div
                    className={cn(
                      'mt-3 grid gap-2',
                      expandedSummaryBars.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                    )}
                  >
                    {expandedSummaryBars.map((bar) => (
                      <PremiumMetricBar
                        key={`${sheet.eyebrow}-${bar.label}`}
                        label={bar.label}
                        value={bar.value}
                        percent={bar.percent}
                        tone={bar.tone}
                        detail={mapMode === 'cost' ? undefined : bar.detail}
                        compact
                      />
                    ))}
                  </div>
                )}

                {(selectedEvStop || selectedFavoriteStop || selectedRouteVariant !== 'recommended') && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {selectedRouteVariant !== 'recommended' && (
                      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-blue-100/14 bg-blue-300/8 px-2 text-[8.5px] font-semibold uppercase tracking-[0.09em] text-blue-100">
                        <Route className="h-3 w-3" />
                        {activeRouteVariant.name}
                      </span>
                    )}
                    {selectedEvStop && (
                      <button
                        type="button"
                        onClick={handleEvStopRemove}
                        className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-cyan-100/14 bg-cyan-300/8 px-2 text-[8.5px] font-semibold uppercase tracking-[0.09em] text-cyan-100"
                      >
                        <Plug className="h-3 w-3" />
                        {selectedEvStop.name}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {selectedFavoriteStop && (
                      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-emerald-100/14 bg-emerald-300/8 px-2 text-[8.5px] font-semibold uppercase tracking-[0.09em] text-emerald-100">
                        <Coffee className="h-3 w-3" />
                        {selectedFavoriteStop.name}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-2.5 border-t border-white/[0.065] pt-2.5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {activePanel === 'routeCompare'
                        ? 'Compare Routes'
                        : activePanel === 'favoriteStops'
                          ? 'Favorite Stops'
                          : activePanel === 'evStops'
                            ? 'Choose Charging Stop'
                            : activePanel === 'costBreakdown'
                              ? 'Cost Breakdown'
                              : sheet.optionsTitle}
                    </p>
                    <span
                      className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 text-[8.5px] font-semibold text-slate-300"
                      style={{ color: visual.routeColor }}
                    >
                      {sheet.statusValue}
                    </span>
                  </div>

                  {activePanel === 'routeCompare' ? (
                    <div className="space-y-1.5">
                      {routeVariants.map((variant, index) => (
                        <PremiumPanelCard
                          key={variant.key}
                          onClick={() => handleRouteVariantApply(variant.key)}
                          icon={variant.key === 'eco' ? Sparkles : Route}
                          title={variant.name}
                          detail={variant.detail}
                          meta={variant.etaDelta}
                          tone={variant.tone}
                          selected={selectedRouteVariant === variant.key}
                        >
                          <PremiumMetricBar
                            label={variant.key === 'eco' ? 'Efficiency gain' : 'Route confidence'}
                            value={variant.distanceDelta}
                            percent={[94, 78, 86][index]}
                            tone={variant.tone}
                          />
                        </PremiumPanelCard>
                      ))}
                    </div>
                  ) : activePanel === 'favoriteStops' ? (
                    <div className="space-y-1.5">
                      {favoriteStops.map((stop) => (
                        <PremiumPanelCard
                          key={stop.id}
                          onClick={() => handleFavoriteStopSelect(stop)}
                          icon={Coffee}
                          title={stop.name}
                          detail={stop.habit}
                          meta={stop.detour}
                          tone="emerald"
                          selected={selectedFavoriteStop?.id === stop.id}
                        >
                          <PremiumMetricBar
                            label={stop.recommended ? 'Top habit match' : 'Habit match'}
                            value={stop.confidence}
                            percent={parsePercent(stop.confidence)}
                            tone="emerald"
                            detail={stop.visits}
                          />
                        </PremiumPanelCard>
                      ))}
                    </div>
                  ) : activePanel === 'evStops' ? (
                    <div className="space-y-1.5">
                      <PremiumMetricBar
                        label="Arrival battery"
                        value={mockEvStations.batteryOnArrival}
                        percent={parsePercent(mockEvStations.batteryOnArrival)}
                        tone="cyan"
                        detail="Charging is optional for this route"
                      />
                      {displayEvStations.map((station) => (
                        <PremiumPanelCard
                          key={station.id}
                          onClick={() => handleEvStopSelect(station)}
                          icon={Plug}
                          title={station.name}
                          detail={`${station.speed} - ${station.detour}`}
                          meta={station.recommended ? 'best' : station.availability}
                          tone="cyan"
                          selected={selectedEvStop?.id === station.id}
                        >
                          <PremiumMetricBar
                            label="Charger availability"
                            value={station.availability}
                            percent={station.availabilityPercent}
                            tone="cyan"
                          />
                        </PremiumPanelCard>
                      ))}
                    </div>
                  ) : activePanel === 'costBreakdown' ? (
                    <div className="space-y-1.5">
                      <div className="rounded-[18px] border border-amber-100/10 bg-amber-200/[0.045] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                        <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-amber-100/70">Estimated trip total</p>
                        <div className="mt-1 flex items-end justify-between gap-3">
                          <span className="text-xl font-semibold text-white">{mockCost.totalCost}</span>
                          <span className="pb-1 text-[11px] font-semibold text-amber-100">{mockCost.costPerMile}</span>
                        </div>
                      </div>
                      {costDistribution.map((item) => (
                        <PremiumMetricBar
                          key={item.label}
                          label={item.label}
                          value={item.value}
                          percent={item.percent}
                          tone={item.tone}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => handleRouteVariantApply('eco')}
                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[16px] border border-emerald-100/16 bg-emerald-300/8 px-3 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-emerald-100 transition active:scale-[0.98]"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Apply Eco Route
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-white/[0.04] bg-white/[0.022] px-3">
                      {sheet.options.map((option, index) => (
                        <div
                          key={`${sheet.eyebrow}-${option.label}`}
                          className={cn(
                            'flex items-center justify-between gap-3 py-2',
                            index > 0 && 'border-t border-white/[0.055]'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-white">{option.label}</p>
                            <p className="mt-0.5 truncate text-[10.5px] font-medium text-slate-500">{option.detail}</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-outline-variant/45 bg-surface-container-low px-2.5 py-0.5 text-[9.5px] font-semibold text-slate-200">
                            {option.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="mt-2.5 rounded-[18px] border-l-2 bg-white/[0.026] px-3.5 py-2.5 text-[11.5px] font-medium leading-relaxed text-slate-300"
                  style={{ borderLeftColor: visual.routeColor }}
                >
                  <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {sheet.eyebrow} insight
                  </p>
                  <p>{sheet.insight}</p>
                </div>

                {lastAction && (
                  <div className="mt-2.5 rounded-[16px] border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-300">
                    Selected: {lastAction}
                  </div>
                )}
              </div>

              <div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2 border-t border-outline-variant/45 bg-surface-container-low p-2.5">
                <button
                  type="button"
                  onClick={() => handleModeAction(expandedPrimaryActionLabel)}
                  className="flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-[16px] bg-primary px-3 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.05em] text-on-primary shadow-ambient transition duration-200 ease-out active:scale-[0.98]"
                >
                  <PrimaryActionIcon className="h-4 w-4 shrink-0" />
                  {expandedPrimaryActionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleModeAction(sheet.secondaryAction)}
                  className="flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-[16px] border border-outline-variant/45 bg-surface-container-lowest px-3 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.05em] text-slate-100 shadow-ambient transition duration-200 ease-out active:scale-[0.98]"
                  style={{
                    borderColor: `${visual.routeColor}35`,
                  }}
                >
                  <SecondaryActionIcon className="h-4 w-4 shrink-0" style={{ color: visual.routeColor }} />
                  {sheet.secondaryAction}
                </button>
              </div>
            </div>
          )}
          </section>
        )}
      </div>
    </div>
  );
}
