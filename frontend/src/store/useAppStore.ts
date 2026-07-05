import { create } from 'zustand';
import type { ChargingPlanResult } from '../types/chargingPlanner';

export interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  time: string;
  date: Date;
  carNeeded: boolean;
  type: 'Morning' | 'Afternoon' | 'Evening';
  category: 'work' | 'study' | 'assignment' | 'important' | 'charging' | 'risk' | 'personal' | 'fitness' | 'other';
  status?: string;
  departureTime?: string;
  endTime?: string;
  notes?: string;
  aiReason?: string;
  chargingMeta?: ChargingCalendarMeta;
  aiChargingPlan?: ChargingPlanResult;
  isAiRecommendationPreview?: boolean;
}

export type ChargingCalendarMeta = {
  mode: 'AC' | 'DC';
  targetBattery: number;
  minutesNeeded: number;
  connector: 'CCS2' | 'Tesla CCS2';
  anchorLocation: string;
  previousLocation?: string;
  nextLocation?: string;
  selectedStation?: ChargingStationCalendarOption;
  stationOptions: ChargingStationCalendarOption[];
  choiceOptions?: ChargingChoiceCalendarOption[];
  aiSource?: 'gemini' | 'fallback';
  aiConfidence?: number;
  aiReason?: string;
};

export type ChargingChoiceCalendarOption = {
  id: string;
  rank: number;
  mode: 'AC' | 'DC';
  start?: string;
  end?: string;
  selectedStationId?: string | null;
  stationName?: string;
  reason: string;
};

export type ChargingStationCalendarOption = {
  id: string;
  name: string;
  provider: string;
  city: string;
  address: string;
  connector: 'CCS2' | 'Tesla CCS2';
  maxPowerKw: number;
  stalls: number;
  distanceFromAnchorKm: number;
  detourKm: number;
  isHighwayStop: boolean;
  reason: string;
};
export interface VehicleState {
  locked: boolean;
  engineOn: boolean;
  cabinTemp: number;
  batteryLevel: number;
  tirePressure: 'OK' | 'LOW';
  preCooling: boolean;
}

type AuthMode = 'signed-out' | 'database' | 'demo';

export type UserProfile = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  notifications: {
    preferences: boolean;
    photos: boolean;
  };
};

export type AiChargingPlanHistoryEntry = {
  id: string;
  plan: ChargingPlanResult;
  status: 'ready' | 'fallback';
  inputSignature: string;
  savedAt: string;
  batteryPercent: number;
  targetPercent: number;
  minimumPercent: number;
};

const defaultChargingTargetPercent = 80;
const defaultChargingMinimumBatteryPercent = 35;
const minChargingTargetPercent = 50;
const maxChargingTargetPercent = 100;
const minChargingMinimumBatteryPercent = 10;
const maxChargingMinimumBatteryPercent = 60;

function clampChargingTarget(value: number) {
  return Math.max(minChargingTargetPercent, Math.min(maxChargingTargetPercent, Math.round(value / 5) * 5));
}

function clampChargingMinimum(value: number, targetPercent: number) {
  const ceiling = Math.min(maxChargingMinimumBatteryPercent, targetPercent - 5);
  return Math.max(minChargingMinimumBatteryPercent, Math.min(ceiling, Math.round(value / 5) * 5));
}

interface AppStore {
  isAuthenticated: boolean;
  authMode: AuthMode;
  accountEmail: string | null;
  user: UserProfile;
  location: string;
  weather: {
    temp: number;
    condition: string;
  };
  vehicle: VehicleState;
  chargingTargetPercent: number;
  chargingMinimumBatteryPercent: number;
  events: CalendarEvent[];
  aiChargingPlan: ChargingPlanResult | null;
  aiChargingPlanStatus: 'idle' | 'loading' | 'ready' | 'fallback' | 'error';
  aiChargingPlanInputSignature: string | null;
  aiChargingPlanHistory: AiChargingPlanHistoryEntry[];
  calendarRevision: number;
  recentActions: {icon: string, title: string, time: string, description: string}[];
  // Actions
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  loginDemo: () => void;
  logout: () => void;
  register: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  updateUser: (data: Partial<UserProfile>) => void;
  toggleLock: () => void;
  toggleEngine: () => void;
  togglePreCool: () => void;
  setBatteryLevel: (level: number) => void;
  setChargingTargetPercent: (level: number) => void;
  setChargingMinimumBatteryPercent: (level: number) => void;
  setAiChargingPlan: (plan: ChargingPlanResult | null, status?: AppStore['aiChargingPlanStatus'], inputSignature?: string | null) => void;
  setAiChargingPlanStatus: (status: AppStore['aiChargingPlanStatus']) => void;
  addAiChargingPlanHistory: (entry: Omit<AiChargingPlanHistoryEntry, 'id' | 'savedAt'>) => void;
  restoreAiChargingPlanFromHistory: (historyId: string) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (eventId: string) => void;
  addRecentAction: (action: {icon: string, title: string, time: string, description: string}) => void;
}

const businessLocations = {
  hq: 'Mercedes-Benz Malaysia HQ, Puchong',
  klcc: 'Mandarin Oriental, KLCC',
  trx: 'TRX Executive Tower',
  bangsar: 'Bangsar South Client Office',
  cyberjaya: 'Cyberjaya Innovation Campus',
  shahAlam: 'Shah Alam Logistics Hub',
  putrajaya: 'Putrajaya Government Precinct',
  montKiara: 'Mont Kiara Private Dining',
  home: 'Xiamen University Malaysia, Sunsuria City, Sepang',
  klia: 'KLIA Terminal 1',
  online: 'Microsoft Teams',
  charger: 'Home Wallbox, Xiamen University Malaysia',
  dealerService: 'Dealer Service Center, Petaling Jaya',
  mbTech: 'Mercedes-Benz Tech Malaysia',
  royalLake: 'Royal Lake Club',
  damansara: 'Xiamen University Malaysia, Sunsuria City, Sepang'
};

function dateOf(day: number, monthIndex: number) {
  return new Date(2026, monthIndex, day);
}

function getEventType(time: string): CalendarEvent['type'] {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 'Morning';
  let hour = Number(match[1]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function makeEvent(
  id: string,
  date: Date,
  title: string,
  time: string,
  endTime: string,
  location: string,
  options: Partial<Omit<CalendarEvent, 'id' | 'date' | 'title' | 'time' | 'endTime' | 'location' | 'type'>> = {}
): CalendarEvent {
  return {
    id,
    title,
    location,
    time,
    endTime,
    date: new Date(date),
    carNeeded: options.carNeeded ?? true,
    type: getEventType(time),
    category: options.category ?? 'work',
    status: options.status,
    departureTime: options.departureTime,
    notes: options.notes,
    aiReason: options.aiReason
  };
}

type BusinessEventOptions = Partial<Omit<CalendarEvent, 'id' | 'date' | 'title' | 'time' | 'endTime' | 'location' | 'type'>>;

type BusinessCalendarSeed = {
  day: number;
  monthIndex: number;
  suffix: string;
  title: string;
  time: string;
  endTime: string;
  location: string;
  options?: BusinessEventOptions;
};

const businessCalendarSeeds: BusinessCalendarSeed[] = [
  // Week Jun 15 - Jun 21: dealer operations and launch discovery.
  { day: 15, monthIndex: 5, suffix: 'dealer-network', title: 'Dealer network review', time: '08:45 AM', endTime: '09:30 AM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office', notes: 'Morning scan of dealer readiness and CRM follow-ups.' } },
  { day: 15, monthIndex: 5, suffix: 'sales-pipeline', title: 'Corporate sales pipeline review', time: '10:15 AM', endTime: '11:30 AM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 15, monthIndex: 5, suffix: 'board-lunch', title: 'Board member lunch', time: '12:45 PM', endTime: '02:15 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '12:10 PM', notes: 'Discuss premium fleet strategy and July board expectations.' } },
  { day: 16, monthIndex: 5, suffix: 'service-bay', title: 'Service center charging bay inspection', time: '09:20 AM', endTime: '10:50 AM', location: businessLocations.dealerService, options: { status: 'Charging Service Check', departureTime: '08:50 AM', notes: 'Inspect customer handover charging flow and bay turnover.' } },
  { day: 16, monthIndex: 5, suffix: 'fleet-client', title: 'Fleet client discussion', time: '01:15 PM', endTime: '02:00 PM', location: businessLocations.bangsar, options: { status: 'Vehicle Required', departureTime: '12:45 PM' } },
  { day: 16, monthIndex: 5, suffix: 'battery-review', title: 'Battery health review', time: '04:15 PM', endTime: '05:00 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office', notes: 'Review battery reserve assumptions for the MB Sense demo.' } },
  { day: 17, monthIndex: 5, suffix: 'gov-briefing', title: 'Government EV briefing', time: '10:00 AM', endTime: '11:00 AM', location: businessLocations.putrajaya, options: { status: 'Important', departureTime: '09:10 AM' } },
  { day: 18, monthIndex: 5, suffix: 'regional-partner', title: 'Regional partnership meeting', time: '09:45 AM', endTime: '11:15 AM', location: businessLocations.cyberjaya, options: { status: 'Important', departureTime: '08:55 AM' } },
  { day: 18, monthIndex: 5, suffix: 'handover', title: 'Customer handover appointment', time: '02:30 PM', endTime: '03:15 PM', location: businessLocations.dealerService, options: { status: 'Vehicle Required', departureTime: '01:55 PM' } },
  { day: 18, monthIndex: 5, suffix: 'wellness', title: 'Executive wellness session', time: '05:15 PM', endTime: '06:00 PM', location: businessLocations.royalLake, options: { category: 'fitness', status: 'Personal', notes: 'Short recovery block after service center visit.' } },
  { day: 19, monthIndex: 5, suffix: 'launch-planning', title: 'Product launch planning', time: '08:30 AM', endTime: '09:45 AM', location: businessLocations.trx, options: { status: 'Important', departureTime: '08:00 AM' } },
  { day: 19, monthIndex: 5, suffix: 'charging-infra', title: 'Charging infrastructure check', time: '11:30 AM', endTime: '12:15 PM', location: businessLocations.shahAlam, options: { status: 'Charging Review', departureTime: '10:55 AM' } },
  { day: 19, monthIndex: 5, suffix: 'investor-coffee', title: 'Investor coffee debrief', time: '03:00 PM', endTime: '03:45 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '02:25 PM' } },
  { day: 20, monthIndex: 5, suffix: 'saturday-wellness', title: 'Executive wellness session', time: '08:30 AM', endTime: '09:30 AM', location: businessLocations.royalLake, options: { category: 'fitness', status: 'Personal' } },

  // Week Jun 22 - Jun 28: investor preparation and partner arrivals.
  { day: 22, monthIndex: 5, suffix: 'board-risk', title: 'Board pre-read and risk review', time: '09:15 AM', endTime: '10:00 AM', location: businessLocations.trx, options: { carNeeded: false, category: 'risk', status: 'BATTERY RISK', notes: 'Flag schedule density and charging reserve assumptions.' } },
  { day: 22, monthIndex: 5, suffix: 'dealer-incentive', title: 'Dealer incentive planning', time: '11:00 AM', endTime: '12:00 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 22, monthIndex: 5, suffix: 'renewal-lunch', title: 'Enterprise renewal lunch', time: '01:00 PM', endTime: '02:30 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '12:25 PM' } },
  { day: 23, monthIndex: 5, suffix: 'fleet-depot', title: 'Fleet charging depot walk-through', time: '08:10 AM', endTime: '09:25 AM', location: businessLocations.shahAlam, options: { status: 'Fleet Charging Review', departureTime: '07:35 AM' } },
  { day: 23, monthIndex: 5, suffix: 'ux-playback', title: 'Cyberjaya UX playback', time: '11:45 AM', endTime: '12:30 PM', location: businessLocations.cyberjaya, options: { status: 'Vehicle Required', departureTime: '10:55 AM' } },
  { day: 23, monthIndex: 5, suffix: 'fleet-client', title: 'Fleet client discussion', time: '03:00 PM', endTime: '04:00 PM', location: businessLocations.bangsar, options: { status: 'Vehicle Required', departureTime: '02:25 PM' } },
  { day: 24, monthIndex: 5, suffix: 'mentor-sync', title: 'Mercedes-Benz Tech mentor sync', time: '10:30 AM', endTime: '11:15 AM', location: businessLocations.mbTech, options: { carNeeded: false, status: 'Office' } },
  { day: 24, monthIndex: 5, suffix: 'asset-review', title: 'Product launch asset review', time: '02:15 PM', endTime: '03:30 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 24, monthIndex: 5, suffix: 'battery-warning', title: 'Battery prediction warning', time: '05:00 PM', endTime: '05:30 PM', location: businessLocations.home, options: { carNeeded: false, category: 'risk', status: 'BATTERY RISK', notes: 'Projected reserve drops below target after Thursday airport and workshop travel.', aiReason: 'Thursday route plan is estimated to use 38-44% battery with heavier traffic near KLCC.' } },
  { day: 25, monthIndex: 5, suffix: 'airport-arrival', title: 'KLIA partner arrival coordination', time: '07:50 AM', endTime: '09:10 AM', location: businessLocations.klia, options: { status: 'Important', departureTime: '06:45 AM' } },
  { day: 25, monthIndex: 5, suffix: 'partner-workshop', title: 'Regional partnership workshop', time: '10:45 AM', endTime: '12:15 PM', location: businessLocations.cyberjaya, options: { status: 'Vehicle Required', departureTime: '09:45 AM' } },
  { day: 25, monthIndex: 5, suffix: 'sponsor-lunch', title: 'Mandarin Oriental sponsor lunch', time: '01:15 PM', endTime: '02:00 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '12:35 PM' } },
  { day: 25, monthIndex: 5, suffix: 'dealer-review', title: 'Dealer network review', time: '04:30 PM', endTime: '05:30 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 26, monthIndex: 5, suffix: 'ev-briefing', title: 'Government EV infrastructure briefing', time: '09:40 AM', endTime: '11:00 AM', location: businessLocations.putrajaya, options: { status: 'Important', departureTime: '08:50 AM' } },
  { day: 26, monthIndex: 5, suffix: 'pipeline-review', title: 'Corporate sales pipeline review', time: '02:00 PM', endTime: '02:45 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 26, monthIndex: 5, suffix: 'family', title: 'Family dinner', time: '07:30 PM', endTime: '09:00 PM', location: businessLocations.damansara, options: { category: 'personal', status: 'Personal', notes: 'Protected personal time.' } },
  { day: 27, monthIndex: 5, suffix: 'investor-dinner', title: 'Private investor dinner', time: '07:30 PM', endTime: '10:00 PM', location: businessLocations.montKiara, options: { status: 'Important', departureTime: '06:55 PM', notes: 'Relationship dinner with strategic investors.' } },

  // Week Jun 29 - Jul 5: Q3 planning and Vibathon preparation.
  { day: 29, monthIndex: 5, suffix: 'q3-plan', title: 'Q3 operating plan review', time: '08:45 AM', endTime: '10:15 AM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 29, monthIndex: 5, suffix: 'board-lunch', title: 'Board member lunch', time: '12:15 PM', endTime: '01:45 PM', location: businessLocations.klcc, options: { status: 'Important', departureTime: '11:45 AM' } },
  { day: 29, monthIndex: 5, suffix: 'launch-planning', title: 'Product launch planning', time: '03:30 PM', endTime: '04:45 PM', location: businessLocations.trx, options: { status: 'Important', departureTime: '03:00 PM' } },
  { day: 30, monthIndex: 5, suffix: 'handover', title: 'Customer handover appointment', time: '09:10 AM', endTime: '09:55 AM', location: businessLocations.dealerService, options: { status: 'Vehicle Required', departureTime: '08:40 AM' } },
  { day: 30, monthIndex: 5, suffix: 'charging-check', title: 'Charging infrastructure check', time: '11:30 AM', endTime: '01:00 PM', location: businessLocations.shahAlam, options: { status: 'Charging Review', departureTime: '10:55 AM' } },
  { day: 30, monthIndex: 5, suffix: 'service-inspection', title: 'Service center inspection', time: '02:45 PM', endTime: '03:45 PM', location: businessLocations.dealerService, options: { status: 'Charging Service Check', departureTime: '02:20 PM' } },
  { day: 1, monthIndex: 6, suffix: 'battery-review', title: 'Battery health review', time: '08:40 AM', endTime: '09:25 AM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 1, monthIndex: 6, suffix: 'asean-rehearsal', title: 'ASEAN launch sequence rehearsal', time: '10:30 AM', endTime: '12:00 PM', location: businessLocations.trx, options: { status: 'Important', departureTime: '09:55 AM' } },
  { day: 1, monthIndex: 6, suffix: 'fleet-client', title: 'Fleet client discussion', time: '02:15 PM', endTime: '03:00 PM', location: businessLocations.bangsar, options: { status: 'Vehicle Required', departureTime: '01:45 PM' } },
  { day: 1, monthIndex: 6, suffix: 'legal-call', title: 'Legal procurement call', time: '04:30 PM', endTime: '05:00 PM', location: businessLocations.online, options: { carNeeded: false, status: 'Remote' } },
  { day: 2, monthIndex: 6, suffix: 'wellness', title: 'Executive wellness session', time: '08:00 AM', endTime: '09:00 AM', location: businessLocations.royalLake, options: { category: 'fitness', status: 'Personal' } },
  { day: 2, monthIndex: 6, suffix: 'innovation-lab', title: 'Cyberjaya innovation lab visit', time: '10:45 AM', endTime: '12:15 PM', location: businessLocations.cyberjaya, options: { status: 'Vehicle Required', departureTime: '09:55 AM' } },
  { day: 2, monthIndex: 6, suffix: 'risk-preread', title: 'Charging risk pre-read', time: '04:00 PM', endTime: '04:45 PM', location: businessLocations.home, options: { carNeeded: false, category: 'risk', status: 'BATTERY RISK', notes: 'Check Friday and Monday demand before the pitch week.' } },
  { day: 3, monthIndex: 6, suffix: 'gov-briefing', title: 'Government EV briefing', time: '09:30 AM', endTime: '10:45 AM', location: businessLocations.putrajaya, options: { status: 'Important', departureTime: '08:40 AM' } },
  { day: 3, monthIndex: 6, suffix: 'pitch-dry-run', title: 'MB Sense pitch dry run', time: '12:00 PM', endTime: '01:00 PM', location: businessLocations.mbTech, options: { status: 'Important', departureTime: '11:30 AM' } },
  { day: 3, monthIndex: 6, suffix: 'pipeline-review', title: 'Corporate sales pipeline review', time: '03:15 PM', endTime: '04:00 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 3, monthIndex: 6, suffix: 'home-parking', title: 'Parked at home', time: '08:00 PM', endTime: '11:30 PM', location: businessLocations.home, options: { carNeeded: false, category: 'personal', status: 'Home parked', notes: 'Usual parked-at-home window. Home charging is available after 8:00 PM.' } },
  { day: 4, monthIndex: 6, suffix: 'class', title: 'AI systems class', time: '09:00 AM', endTime: '10:30 AM', location: businessLocations.mbTech, options: { category: 'study', status: 'Vehicle Required', departureTime: '08:15 AM', notes: 'Rain and morning traffic increase the energy forecast.' } },
  { day: 4, monthIndex: 6, suffix: 'meeting', title: 'Startup partner meeting', time: '01:00 PM', endTime: '02:00 PM', location: businessLocations.trx, options: { status: 'Vehicle Required', departureTime: '12:20 PM', notes: 'Midday cross-city trip with limited charging time before evening.' } },
  { day: 4, monthIndex: 6, suffix: 'evening-event', title: 'Vibathon networking event', time: '06:00 PM', endTime: '08:30 PM', location: businessLocations.klcc, options: { category: 'important', status: 'Important', departureTime: '05:10 PM', notes: 'Heavy evening traffic makes this the mobility risk peak.' } },

  // Week Jul 6 - Jul 12: pitch day and post-demo follow-through.
  { day: 6, monthIndex: 6, suffix: 'vibathon', title: 'MBTMY Vibathon pitch day', time: '09:00 AM', endTime: '01:00 PM', location: businessLocations.mbTech, options: { status: 'Important', departureTime: '08:15 AM', notes: 'Final 4-minute pitch, QnA, and judge networking.' } },
  { day: 6, monthIndex: 6, suffix: 'judge-networking', title: 'Judge networking debrief', time: '02:30 PM', endTime: '03:15 PM', location: businessLocations.mbTech, options: { carNeeded: false, status: 'Office' } },
  { day: 7, monthIndex: 6, suffix: 'investor-narrative', title: 'Post-pitch investor narrative', time: '10:00 AM', endTime: '11:00 AM', location: businessLocations.trx, options: { status: 'Important', departureTime: '09:30 AM' } },
  { day: 7, monthIndex: 6, suffix: 'dealer-followup', title: 'Dealer pilot follow-up', time: '02:00 PM', endTime: '02:45 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 8, monthIndex: 6, suffix: 'charging-ops', title: 'Charging infrastructure check', time: '09:30 AM', endTime: '10:30 AM', location: businessLocations.shahAlam, options: { status: 'Charging Review', departureTime: '08:55 AM' } },
  { day: 8, monthIndex: 6, suffix: 'customer-council', title: 'Customer advisory council', time: '03:30 PM', endTime: '05:00 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '02:55 PM' } },
  { day: 9, monthIndex: 6, suffix: 'service-quality', title: 'Service center inspection', time: '11:00 AM', endTime: '12:15 PM', location: businessLocations.dealerService, options: { status: 'Charging Service Check', departureTime: '10:25 AM' } },
  { day: 9, monthIndex: 6, suffix: 'partnership-review', title: 'Regional partnership meeting', time: '02:45 PM', endTime: '03:45 PM', location: businessLocations.cyberjaya, options: { status: 'Vehicle Required', departureTime: '01:55 PM' } },
  { day: 10, monthIndex: 6, suffix: 'board-readout', title: 'Vibathon board readout', time: '09:45 AM', endTime: '10:30 AM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 10, monthIndex: 6, suffix: 'client-dinner', title: 'Client renewal dinner', time: '07:00 PM', endTime: '09:15 PM', location: businessLocations.montKiara, options: { status: 'Important', departureTime: '06:25 PM' } },

  // Week Jul 13 - Jul 19: Singapore investor trip and recovery.
  { day: 14, monthIndex: 6, suffix: 'singapore', title: 'Singapore investor day trip', time: '06:30 AM', endTime: '08:30 PM', location: 'KLIA / Singapore CBD', options: { status: 'Important', departureTime: '05:30 AM', notes: 'Long mobility day. MB Sense should recommend charging the night before.', aiReason: 'Airport transfer plus late return leaves limited charging flexibility.' } },
  { day: 15, monthIndex: 6, suffix: 'recovery-review', title: 'Investor follow-up review', time: '11:00 AM', endTime: '12:00 PM', location: businessLocations.online, options: { carNeeded: false, status: 'Remote' } },
  { day: 15, monthIndex: 6, suffix: 'fleet-client', title: 'Fleet client discussion', time: '03:15 PM', endTime: '04:15 PM', location: businessLocations.bangsar, options: { status: 'Vehicle Required', departureTime: '02:40 PM' } },
  { day: 16, monthIndex: 6, suffix: 'pricing-council', title: 'Premium fleet pricing council', time: '09:30 AM', endTime: '10:45 AM', location: businessLocations.trx, options: { status: 'Important', departureTime: '09:00 AM' } },
  { day: 16, monthIndex: 6, suffix: 'charging-bay', title: 'Dealer charging bay audit', time: '01:30 PM', endTime: '02:30 PM', location: businessLocations.dealerService, options: { status: 'Charging Service Check', departureTime: '01:00 PM' } },
  { day: 17, monthIndex: 6, suffix: 'gov-pilot', title: 'Government fleet pilot readout', time: '10:00 AM', endTime: '11:30 AM', location: businessLocations.putrajaya, options: { status: 'Important', departureTime: '09:10 AM' } },
  { day: 17, monthIndex: 6, suffix: 'wellness', title: 'Executive wellness session', time: '04:30 PM', endTime: '05:15 PM', location: businessLocations.royalLake, options: { category: 'fitness', status: 'Personal' } },
  { day: 18, monthIndex: 6, suffix: 'networking-dinner', title: 'Private investor dinner', time: '07:30 PM', endTime: '10:00 PM', location: businessLocations.montKiara, options: { status: 'Important', departureTime: '06:55 PM' } },

  // Week Jul 20 - Jul 26: operational closeout and partner success.
  { day: 20, monthIndex: 6, suffix: 'runway-review', title: 'July close and runway review', time: '09:00 AM', endTime: '10:15 AM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 20, monthIndex: 6, suffix: 'commercial-lunch', title: 'Commercial strategy lunch', time: '12:30 PM', endTime: '01:45 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '11:55 AM' } },
  { day: 21, monthIndex: 6, suffix: 'partner-success', title: 'Fleet partner success review', time: '09:45 AM', endTime: '11:00 AM', location: businessLocations.bangsar, options: { status: 'Vehicle Required', departureTime: '09:10 AM' } },
  { day: 22, monthIndex: 6, suffix: 'product-bets', title: 'August product bets council', time: '08:30 AM', endTime: '09:45 AM', location: businessLocations.trx, options: { status: 'Important', departureTime: '08:00 AM' } },
  { day: 22, monthIndex: 6, suffix: 'battery-review', title: 'Battery health review', time: '02:00 PM', endTime: '02:45 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 23, monthIndex: 6, suffix: 'oem-review', title: 'Regional OEM partnership review', time: '10:15 AM', endTime: '11:45 AM', location: businessLocations.cyberjaya, options: { status: 'Vehicle Required', departureTime: '09:25 AM' } },
  { day: 23, monthIndex: 6, suffix: 'service-center', title: 'Service center inspection', time: '03:15 PM', endTime: '04:15 PM', location: businessLocations.dealerService, options: { status: 'Charging Service Check', departureTime: '02:45 PM' } },
  { day: 24, monthIndex: 6, suffix: 'offsite-plan', title: 'Executive offsite planning', time: '11:30 AM', endTime: '12:30 PM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 24, monthIndex: 6, suffix: 'family', title: 'Family dinner', time: '07:45 PM', endTime: '09:15 PM', location: businessLocations.damansara, options: { category: 'personal', status: 'Personal' } },

  // Week Jul 27 - Jul 30: board package and month-end handoff.
  { day: 27, monthIndex: 6, suffix: 'board-package', title: 'Final July board package review', time: '09:20 AM', endTime: '10:35 AM', location: businessLocations.hq, options: { carNeeded: false, category: 'risk', status: 'BATTERY RISK', notes: 'Pre-read has schedule risk notes and charging assumptions.' } },
  { day: 27, monthIndex: 6, suffix: 'legal-lunch', title: 'Legal counsel lunch', time: '12:15 PM', endTime: '01:30 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '11:45 AM' } },
  { day: 28, monthIndex: 6, suffix: 'advisory-council', title: 'Customer advisory council', time: '10:00 AM', endTime: '11:30 AM', location: businessLocations.bangsar, options: { status: 'Vehicle Required', departureTime: '09:25 AM' } },
  { day: 28, monthIndex: 6, suffix: 'charging-audit', title: 'Charging infrastructure check', time: '03:00 PM', endTime: '04:00 PM', location: businessLocations.shahAlam, options: { status: 'Charging Review', departureTime: '02:20 PM' } },
  { day: 29, monthIndex: 6, suffix: 'quarterly-board', title: 'Quarterly board review', time: '09:00 AM', endTime: '12:00 PM', location: businessLocations.trx, options: { status: 'Important', departureTime: '08:20 AM', notes: 'Board review for Q3 operating plan and EV product direction.' } },
  { day: 29, monthIndex: 6, suffix: 'investor-followup', title: 'Investor follow-up roadshow', time: '02:45 PM', endTime: '04:15 PM', location: businessLocations.klcc, options: { status: 'Vehicle Required', departureTime: '02:10 PM' } },
  { day: 30, monthIndex: 6, suffix: 'execution-handoff', title: 'August execution handoff', time: '10:30 AM', endTime: '11:30 AM', location: businessLocations.hq, options: { carNeeded: false, status: 'Office' } },
  { day: 30, monthIndex: 6, suffix: 'founders-dinner', title: 'Founders dinner', time: '07:00 PM', endTime: '09:00 PM', location: businessLocations.montKiara, options: { status: 'Important', departureTime: '06:25 PM' } }
];

function toBusinessDateId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEventSortMinutes(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => {
    const aDate = a.date instanceof Date ? a.date : new Date(a.date);
    const bDate = b.date instanceof Date ? b.date : new Date(b.date);
    return aDate.getTime() - bDate.getTime() || getEventSortMinutes(a.time) - getEventSortMinutes(b.time);
  });
}

function buildBusinessCalendarEvents(): CalendarEvent[] {
  return sortCalendarEvents(businessCalendarSeeds
    .map((seed) => {
      const date = dateOf(seed.day, seed.monthIndex);
      return makeEvent(
        `biz-${toBusinessDateId(date)}-${seed.suffix}`,
        date,
        seed.title,
        seed.time,
        seed.endTime,
        seed.location,
        seed.options
      );
    }));
}

const defaultAccountEmail = 'employee@example.com';
const defaultUser: UserProfile = {
  name: 'Michael Tan',
  email: defaultAccountEmail,
  avatarUrl: null,
  notifications: {
    preferences: true,
    photos: false
  }
};
const demoUser: UserProfile = {
  name: 'Demo Driver',
  email: 'demo@mbsense.local',
  avatarUrl: null,
  notifications: {
    preferences: true,
    photos: false
  }
};
const defaultRecentActions = [
  { icon: 'battery_charging_full', title: 'Charging Window Planned', description: 'Tonight 8:30 PM-10:00 PM', time: '18:45' },
  { icon: 'warning', title: 'Battery Risk Predicted', description: 'Thursday travel may drop below reserve', time: '16:20' },
  { icon: 'event', title: 'Schedule Synced', description: 'Business calendar loaded through July 30', time: '08:30' }
];

function normalizeUserProfile(value: unknown, fallbackEmail = defaultAccountEmail): UserProfile {
  const source = value && typeof value === 'object' ? value as Partial<UserProfile> : {};
  const notifications = source.notifications ?? defaultUser.notifications;

  return {
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : defaultUser.name,
    email: typeof source.email === 'string' && source.email.trim() ? source.email.trim() : fallbackEmail,
    avatarUrl: typeof source.avatarUrl === 'string' && source.avatarUrl.trim() ? source.avatarUrl : null,
    notifications: {
      preferences: typeof notifications.preferences === 'boolean' ? notifications.preferences : defaultUser.notifications.preferences,
      photos: typeof notifications.photos === 'boolean' ? notifications.photos : defaultUser.notifications.photos,
    },
  };
}

function isCalendarCategory(value: unknown): value is CalendarEvent['category'] {
  return value === 'work'
    || value === 'study'
    || value === 'assignment'
    || value === 'important'
    || value === 'charging'
    || value === 'risk'
    || value === 'personal'
    || value === 'fitness'
    || value === 'other';
}

function isCalendarType(value: unknown): value is CalendarEvent['type'] {
  return value === 'Morning' || value === 'Afternoon' || value === 'Evening';
}

function hydrateCalendarEvent(value: unknown): CalendarEvent | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as Record<string, any>;
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : '';
  const title = typeof source.title === 'string' && source.title.trim() ? source.title.trim() : '';
  const location = typeof source.location === 'string' && source.location.trim() ? source.location.trim() : '';
  const time = typeof source.time === 'string' && source.time.trim() ? source.time.trim() : '09:00 AM';
  const parsedDate = source.date instanceof Date ? source.date : new Date(String(source.date ?? ''));

  if (!id || !title || !location || Number.isNaN(parsedDate.getTime())) return null;

  return {
    ...source,
    id,
    title,
    location,
    time,
    date: parsedDate,
    carNeeded: typeof source.carNeeded === 'boolean' ? source.carNeeded : true,
    type: isCalendarType(source.type) ? source.type : getEventType(time),
    category: isCalendarCategory(source.category) ? source.category : 'work',
  };
}

function hydrateCalendarEvents(value: unknown) {
  if (!Array.isArray(value)) return buildBusinessCalendarEvents();

  const events = value
    .map(hydrateCalendarEvent)
    .filter((event): event is CalendarEvent => Boolean(event));

  return events.length ? sortCalendarEvents(events) : buildBusinessCalendarEvents();
}

function serializeCalendarEvents(events: CalendarEvent[]) {
  return events.map((event) => {
    const date = event.date instanceof Date ? event.date : new Date(event.date);
    return {
      ...event,
      date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    };
  });
}

async function readJsonResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function saveDatabaseState(state: AppStore) {
  if (!state.isAuthenticated || state.authMode !== 'database' || !state.accountEmail) return;

  try {
    await fetch('/api/user-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountEmail: state.accountEmail,
        user: state.user,
        events: serializeCalendarEvents(state.events),
      }),
    });
  } catch (error) {
    console.warn('Unable to save MB Sense user state.', error);
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  isAuthenticated: false,
  authMode: 'signed-out',
  accountEmail: null,
  user: defaultUser,
  location: 'Kuala Lumpur',
  weather: {
    temp: 29,
    condition: 'rain'
  },
  vehicle: {
    locked: true,
    engineOn: false,
    cabinTemp: 28,
    batteryLevel: 52,
    tirePressure: 'OK',
    preCooling: false
  },
  chargingTargetPercent: defaultChargingTargetPercent,
  chargingMinimumBatteryPercent: defaultChargingMinimumBatteryPercent,
  events: buildBusinessCalendarEvents(),
  aiChargingPlan: null,
  aiChargingPlanStatus: 'idle',
  aiChargingPlanInputSignature: null,
  aiChargingPlanHistory: [],
  calendarRevision: 0,
  recentActions: defaultRecentActions,

  toggleLock: () => set((state) => ({
    vehicle: { ...state.vehicle, locked: !state.vehicle.locked },
    recentActions: [{
      icon: state.vehicle.locked ? 'lock_open' : 'lock',
      title: state.vehicle.locked ? 'Vehicle Unlocked' : 'Vehicle Locked',
      description: 'Remote command',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }, ...state.recentActions].slice(0, 5)
  })),

  toggleEngine: () => set((state) => ({
    vehicle: { ...state.vehicle, engineOn: !state.vehicle.engineOn },
    recentActions: [{
      icon: 'power_settings_new',
      title: state.vehicle.engineOn ? 'Engine Stopped' : 'Engine Started',
      description: 'Remote command',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }, ...state.recentActions].slice(0, 5)
  })),

  togglePreCool: () => set((state) => ({
    vehicle: { ...state.vehicle, preCooling: !state.vehicle.preCooling, cabinTemp: state.vehicle.preCooling ? 28 : 22 },
    recentActions: [{
      icon: 'ac_unit',
      title: state.vehicle.preCooling ? 'Pre-cooling Stopped' : 'Pre-cooling Started',
      description: 'Target 22 deg C',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }, ...state.recentActions].slice(0, 5)
  })),

  setBatteryLevel: (level) => set((state) => ({
    vehicle: { ...state.vehicle, batteryLevel: Math.max(0, Math.min(100, Math.round(level))) }
  })),
  setChargingTargetPercent: (level) => set((state) => {
    const chargingTargetPercent = clampChargingTarget(level);
    return {
      chargingTargetPercent,
      chargingMinimumBatteryPercent: clampChargingMinimum(state.chargingMinimumBatteryPercent, chargingTargetPercent),
    };
  }),
  setChargingMinimumBatteryPercent: (level) => set((state) => ({
    chargingMinimumBatteryPercent: clampChargingMinimum(level, state.chargingTargetPercent),
  })),
  setAiChargingPlan: (plan, status = 'ready', inputSignature = null) => set({
    aiChargingPlan: plan,
    aiChargingPlanStatus: status,
    aiChargingPlanInputSignature: inputSignature
  }),
  setAiChargingPlanStatus: (status) => set({ aiChargingPlanStatus: status }),
  addAiChargingPlanHistory: (entry) => set((state) => ({
    aiChargingPlanHistory: [
      ...state.aiChargingPlanHistory,
      {
        ...entry,
        id: `ai-plan-history-${Date.now()}-${state.aiChargingPlanHistory.length + 1}`,
        savedAt: new Date().toISOString(),
      }
    ]
  })),
  restoreAiChargingPlanFromHistory: (historyId) => set((state) => {
    const entry = state.aiChargingPlanHistory.find((item) => item.id === historyId);
    if (!entry) return {};
    return {
      aiChargingPlan: entry.plan,
      aiChargingPlanStatus: entry.status,
      aiChargingPlanInputSignature: entry.inputSignature
    };
  }),

  addEvent: (event) => {
    set((state) => ({
      events: sortCalendarEvents([...state.events, event]),
      aiChargingPlanInputSignature: null,
      calendarRevision: state.calendarRevision + 1
    }));
    void saveDatabaseState(get());
  },
  updateEvent: (event) => {
    set((state) => ({
      events: sortCalendarEvents(state.events.map((item) => item.id === event.id ? event : item)),
      aiChargingPlanInputSignature: null,
      calendarRevision: state.calendarRevision + 1
    }));
    void saveDatabaseState(get());
  },
  deleteEvent: (eventId) => {
    set((state) => ({
      events: state.events.filter((event) => event.id !== eventId),
      aiChargingPlanInputSignature: null,
      calendarRevision: state.calendarRevision + 1
    }));
    void saveDatabaseState(get());
  },
  addRecentAction: (action) => set((state) => ({ recentActions: [action, ...state.recentActions].slice(0, 5) })),
  login: async (email, password) => {
    const accountEmail = email.trim().toLowerCase();
    if (!accountEmail || !password) return { ok: false, message: 'Email and password are required.' };

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: accountEmail,
          password,
          seed: {
            user: { ...defaultUser, email: accountEmail },
            events: serializeCalendarEvents(buildBusinessCalendarEvents()),
          },
        }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        return {
          ok: false,
          message: typeof data.error === 'string' ? data.error : 'Invalid email or password.',
        };
      }

      set((state) => ({
        isAuthenticated: true,
        authMode: 'database',
        accountEmail: typeof data.accountEmail === 'string' ? data.accountEmail : accountEmail,
        user: normalizeUserProfile(data.user, accountEmail),
        events: hydrateCalendarEvents(data.events),
        aiChargingPlan: null,
        aiChargingPlanStatus: 'idle',
        aiChargingPlanInputSignature: null,
        aiChargingPlanHistory: [],
        calendarRevision: state.calendarRevision + 1,
        recentActions: defaultRecentActions,
      }));

      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach the MB Sense database. Make sure the backend is running.' };
    }
  },
  loginDemo: () => {
    set((state) => ({
      isAuthenticated: true,
      authMode: 'demo',
      accountEmail: null,
      user: demoUser,
      events: buildBusinessCalendarEvents(),
      aiChargingPlan: null,
      aiChargingPlanStatus: 'idle',
      aiChargingPlanInputSignature: null,
      aiChargingPlanHistory: [],
      calendarRevision: state.calendarRevision + 1,
      recentActions: defaultRecentActions,
    }));
  },
  logout: () => set({
    isAuthenticated: false,
    authMode: 'signed-out',
    accountEmail: null,
    aiChargingPlan: null,
    aiChargingPlanStatus: 'idle',
    aiChargingPlanInputSignature: null,
    aiChargingPlanHistory: [],
  }),
  register: async (email, password) => {
    const accountEmail = email.trim().toLowerCase();
    if (!accountEmail || !password) return { ok: false, message: 'Email and password are required.' };

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: accountEmail,
          password,
          seed: {
            user: { ...defaultUser, email: accountEmail },
            events: serializeCalendarEvents(buildBusinessCalendarEvents()),
          },
        }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        return {
          ok: false,
          message: typeof data.error === 'string' ? data.error : 'Unable to create account.',
        };
      }

      set((state) => ({
        isAuthenticated: true,
        authMode: 'database',
        accountEmail: typeof data.accountEmail === 'string' ? data.accountEmail : accountEmail,
        user: normalizeUserProfile(data.user, accountEmail),
        events: hydrateCalendarEvents(data.events),
        aiChargingPlan: null,
        aiChargingPlanStatus: 'idle',
        aiChargingPlanInputSignature: null,
        aiChargingPlanHistory: [],
        calendarRevision: state.calendarRevision + 1,
        recentActions: defaultRecentActions,
      }));

      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach the MB Sense database. Make sure the backend is running.' };
    }
  },
  updateUser: (data) => {
    set((state) => ({ user: { ...state.user, ...data } }));
    void saveDatabaseState(get());
  }
}));
