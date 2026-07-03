import { create } from 'zustand';

export interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  time: string;
  date: Date;
  carNeeded: boolean;
  type: 'Morning' | 'Afternoon' | 'Evening';
  category: 'work' | 'personal' | 'fitness' | 'other';
  status?: string;
  departureTime?: string;
  endTime?: string;
  notes?: string;
  aiReason?: string;
}

export interface VehicleState {
  locked: boolean;
  engineOn: boolean;
  cabinTemp: number;
  batteryLevel: number;
  tirePressure: 'OK' | 'LOW';
  preCooling: boolean;
}

interface AppStore {
  isAuthenticated: boolean;
  user: {
    name: string;
    email: string;
    notifications: {
      preferences: boolean;
      photos: boolean;
    };
  };
  location: string;
  weather: {
    temp: number;
    condition: string;
  };
  vehicle: VehicleState;
  events: CalendarEvent[];
  recentActions: {icon: string, title: string, time: string, description: string}[];
  // Actions
  login: () => void;
  logout: () => void;
  register: () => void;
  updateUser: (data: Partial<AppStore['user']>) => void;
  toggleLock: () => void;
  toggleEngine: () => void;
  togglePreCool: () => void;
  addEvent: (event: CalendarEvent) => void;
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
  home: 'Home Garage, Damansara Heights',
  klia: 'KLIA Terminal 1',
  online: 'Microsoft Teams',
  charger: 'Home Wallbox, Damansara Heights'
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
type BusinessScheduleVariant = {
  mondayFocus: string;
  tuesdayVisit: string;
  wednesdayStrategy: string;
  thursdayPartner: string;
  fridayBriefing: string;
  mondayLunch: string;
  thursdayDinner: string;
};

const weeklyBusinessVariants: BusinessScheduleVariant[] = [
  {
    mondayFocus: 'June revenue command review',
    tuesdayVisit: 'Shah Alam fleet charging audit',
    wednesdayStrategy: 'ASEAN launch sequence review',
    thursdayPartner: 'Singapore partner arrival program',
    fridayBriefing: 'Putrajaya EV infrastructure briefing',
    mondayLunch: 'Enterprise renewal lunch',
    thursdayDinner: 'Regional partner dinner'
  },
  {
    mondayFocus: 'Board pre-read and risk review',
    tuesdayVisit: 'Cyberjaya product lab visit',
    wednesdayStrategy: 'Premium fleet pricing council',
    thursdayPartner: 'Banking partner workshop',
    fridayBriefing: 'Investor pipeline closeout',
    mondayLunch: 'CFO working lunch',
    thursdayDinner: 'Strategic account dinner'
  },
  {
    mondayFocus: 'Vibathon pitch rehearsal block',
    tuesdayVisit: 'Bangsar client discovery visit',
    wednesdayStrategy: 'AI charging roadmap review',
    thursdayPartner: 'Dealer network operating session',
    fridayBriefing: 'Government fleet pilot readout',
    mondayLunch: 'Mercedes-Benz Tech lunch',
    thursdayDinner: 'Executive sponsor dinner'
  },
  {
    mondayFocus: 'Post-pitch investor narrative',
    tuesdayVisit: 'KLIA investor travel day',
    wednesdayStrategy: 'Singapore expansion debrief',
    thursdayPartner: 'Logistics partner negotiation',
    fridayBriefing: 'Quarterly forecast lock',
    mondayLunch: 'Investor relations lunch',
    thursdayDinner: 'Private investor dinner'
  },
  {
    mondayFocus: 'Q3 operating plan review',
    tuesdayVisit: 'TRX enterprise showcase',
    wednesdayStrategy: 'Quarterly board review prep',
    thursdayPartner: 'Cybersecurity procurement session',
    fridayBriefing: 'Leadership retro and hiring plan',
    mondayLunch: 'Board member lunch',
    thursdayDinner: 'Client renewal dinner'
  },
  {
    mondayFocus: 'July close and runway review',
    tuesdayVisit: 'Fleet partner success review',
    wednesdayStrategy: 'August product bets council',
    thursdayPartner: 'Regional OEM partnership review',
    fridayBriefing: 'Executive offsite planning',
    mondayLunch: 'Commercial strategy lunch',
    thursdayDinner: 'Partner appreciation dinner'
  },
  {
    mondayFocus: 'Final July board package review',
    tuesdayVisit: 'Customer advisory council',
    wednesdayStrategy: 'Quarterly board review',
    thursdayPartner: 'Investor follow-up roadshow',
    fridayBriefing: 'August execution handoff',
    mondayLunch: 'Legal counsel lunch',
    thursdayDinner: 'Founders dinner'
  }
];

function getWeekVariant(date: Date) {
  const start = dateOf(15, 5);
  const daysSinceStart = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const weekIndex = Math.max(0, Math.floor(daysSinceStart / 7));
  return weeklyBusinessVariants[weekIndex % weeklyBusinessVariants.length];
}

function buildBusinessCalendarEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const start = dateOf(15, 5);
  const end = dateOf(30, 6);

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    const day = date.getDay();
    const idPrefix = `biz-${date.toISOString().slice(0, 10)}`;
    const variant = getWeekVariant(date);
    const add = (
      suffix: string,
      title: string,
      time: string,
      endTime: string,
      location: string,
      options: Partial<Omit<CalendarEvent, 'id' | 'date' | 'title' | 'time' | 'endTime' | 'location' | 'type'>> = {}
    ) => events.push(makeEvent(`${idPrefix}-${suffix}`, date, title, time, endTime, location, options));

    if (day === 0) {
      add('charge-plan', 'AI charging recommendation', '08:00 PM', '09:30 PM', businessLocations.charger, {
        carNeeded: false,
        category: 'other',
        status: 'AI CHARGING RECOMMENDATION',
        notes: 'Top up before Monday executive travel block.',
        aiReason: 'Calendar density on Monday and Tuesday is above normal. Charging during the home parking window keeps reserve above 20%.'
      });
      continue;
    }

    if (day === 6) {
      add('wellness', 'Executive wellness session', '08:00 AM', '09:15 AM', 'Royal Lake Club', {
        category: 'fitness',
        status: 'Personal',
        notes: 'Light weekend commitment.'
      });
      if (date.getDate() === 20 || date.getDate() === 4 || date.getDate() === 18) {
        add('networking', 'Private investor dinner', '07:30 PM', '10:00 PM', businessLocations.montKiara, {
          category: 'work',
          status: 'Important',
          departureTime: '06:55 PM',
          notes: 'Relationship dinner with strategic investors.'
        });
      }
      continue;
    }

    add('standup', 'Executive operating review', '08:30 AM', '09:15 AM', businessLocations.hq, {
      carNeeded: false,
      status: 'Office',
      notes: 'Daily KPI, cash position, and leadership blockers.'
    });

    if (day === 1) {
      add('leadership', variant.mondayFocus, '09:45 AM', '10:45 AM', businessLocations.hq, { carNeeded: false, status: 'Office' });
      add('finance', date.getDate() % 2 === 0 ? 'Cash runway and margin review' : 'Weekly finance and forecast review', '11:15 AM', '12:15 PM', businessLocations.hq, { carNeeded: false, status: 'Office' });
      add('client-lunch', variant.mondayLunch, '01:00 PM', '02:30 PM', businessLocations.klcc, {
        status: 'Vehicle Required',
        departureTime: '12:25 PM',
        notes: 'Renewal discussion with enterprise account sponsor.'
      });
      add('product', date.getDate() % 2 === 0 ? 'Battery intelligence product decision' : 'Product roadmap decision', '04:00 PM', '05:00 PM', businessLocations.hq, { carNeeded: false, status: 'Office' });
    }

    if (day === 2) {
      add('site-visit', variant.tuesdayVisit, '09:30 AM', '11:30 AM', businessLocations.shahAlam, {
        status: 'Vehicle Required',
        departureTime: '08:40 AM',
        notes: 'Review driver operations and charging bay utilization.'
      });
      add('supplier', date.getDate() % 2 === 0 ? 'Charging hardware supplier negotiation' : 'Supplier pricing negotiation', '12:30 PM', '01:30 PM', businessLocations.bangsar, {
        status: 'Vehicle Required',
        departureTime: '12:00 PM'
      });
      add('investor', 'Investor update call', '03:00 PM', '04:00 PM', businessLocations.online, {
        carNeeded: false,
        status: 'Remote',
        notes: 'Prepare July growth and margin narrative.'
      });
      add('charge', 'Recommended charging time', '08:30 PM', '10:00 PM', businessLocations.charger, {
        carNeeded: false,
        category: 'other',
        status: 'AI CHARGING RECOMMENDATION',
        notes: 'Home charging window while vehicle is parked.',
        aiReason: 'Tomorrow includes cross-city travel and limited daytime charging availability.'
      });
    }

    if (day === 3) {
      add('strategy', variant.wednesdayStrategy, '09:00 AM', '10:30 AM', businessLocations.trx, {
        status: 'Important',
        departureTime: '08:20 AM',
        notes: 'Decision meeting for Singapore and Indonesia launch sequence.'
      });
      add('lunch', date.getDate() % 2 === 0 ? 'Strategic partner lunch' : 'Board member lunch', '12:00 PM', '01:30 PM', businessLocations.klcc, {
        status: 'Vehicle Required',
        departureTime: '11:30 AM'
      });
      add('legal', 'Legal and procurement review', '02:30 PM', '03:30 PM', businessLocations.online, {
        carNeeded: false,
        status: 'Remote'
      });
      add('risk', 'Battery prediction warning', '05:00 PM', '05:30 PM', businessLocations.home, {
        carNeeded: false,
        category: 'other',
        status: 'BATTERY RISK',
        notes: 'Projected battery reserve drops below 20% after Thursday travel.',
        aiReason: 'Thursday route plan is estimated to use 38-44% battery with heavy traffic near KLCC.'
      });
    }

    if (day === 4) {
      add('airport', variant.thursdayPartner, '07:45 AM', '09:15 AM', businessLocations.klia, {
        status: 'Important',
        departureTime: '06:40 AM',
        notes: 'High-priority partner visit from Singapore.'
      });
      add('workshop', 'Regional partnership workshop', '10:30 AM', '12:30 PM', businessLocations.cyberjaya, {
        status: 'Vehicle Required',
        departureTime: '09:35 AM'
      });
      add('press', 'Brand and PR preparation', '03:00 PM', '04:00 PM', businessLocations.hq, { carNeeded: false, status: 'Office' });
      add('dinner', variant.thursdayDinner, '07:00 PM', '09:30 PM', businessLocations.montKiara, {
        status: 'Important',
        departureTime: '06:20 PM',
        notes: 'Relationship dinner after workshop.'
      });
    }

    if (day === 5) {
      add('pipeline', date.getDate() % 2 === 0 ? 'Enterprise conversion review' : 'Sales pipeline closeout', '09:30 AM', '10:30 AM', businessLocations.hq, { carNeeded: false, status: 'Office' });
      add('gov', variant.fridayBriefing, '11:30 AM', '01:00 PM', businessLocations.putrajaya, {
        status: 'Important',
        departureTime: '10:35 AM',
        notes: 'Briefing on EV infrastructure and premium fleet pilots.'
      });
      add('one-on-one', 'COO one-on-one', '03:30 PM', '04:15 PM', businessLocations.hq, { carNeeded: false, status: 'Office' });
      add('family', 'Family dinner', '07:30 PM', '09:00 PM', 'Damansara Heights', {
        category: 'personal',
        status: 'Personal',
        notes: 'Protected personal time.'
      });
    }
  }

  events.push(
    makeEvent('biz-2026-07-06-vibathon', dateOf(6, 6), 'MBTMY Vibathon pitch day', '09:00 AM', '01:00 PM', 'Mercedes-Benz Tech Malaysia', {
      status: 'Important',
      category: 'work',
      departureTime: '08:15 AM',
      notes: 'Final 4-minute pitch, QnA, and judge networking.'
    }),
    makeEvent('biz-2026-07-14-singapore', dateOf(14, 6), 'Singapore investor day trip', '06:30 AM', '08:30 PM', 'KLIA / Singapore CBD', {
      status: 'Important',
      category: 'work',
      departureTime: '05:30 AM',
      notes: 'Long mobility day. MB Sense should recommend charging the night before.',
      aiReason: 'Airport transfer plus late return leaves limited charging flexibility.'
    }),
    makeEvent('biz-2026-07-13-pretrip-charge', dateOf(13, 6), 'AI charging recommendation', '08:00 PM', '10:00 PM', businessLocations.charger, {
      carNeeded: false,
      status: 'AI CHARGING RECOMMENDATION',
      category: 'other',
      notes: 'Charge to 80% before the Singapore investor day trip.',
      aiReason: 'The next day combines airport travel, meetings, and late return. Charging tonight prevents reserve risk.'
    }),
    makeEvent('biz-2026-07-29-quarterly-board', dateOf(29, 6), 'Quarterly board review', '09:00 AM', '12:00 PM', businessLocations.trx, {
      status: 'Important',
      category: 'work',
      departureTime: '08:20 AM',
      notes: 'Board review for Q3 operating plan and EV product direction.'
    })
  );

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const useAppStore = create<AppStore>((set) => ({
  isAuthenticated: false,
  user: {
    name: 'Michael Tan',
    email: 'michael.tan@example.com',
    notifications: {
      preferences: true,
      photos: false
    }
  },
  location: 'Kuala Lumpur',
  weather: {
    temp: 31,
    condition: 'partly_cloudy_day'
  },
  vehicle: {
    locked: true,
    engineOn: false,
    cabinTemp: 28,
    batteryLevel: 50,
    tirePressure: 'OK',
    preCooling: false
  },
  events: buildBusinessCalendarEvents(),
  recentActions: [
    { icon: 'battery_charging_full', title: 'Charging Window Planned', description: 'Tonight 8:30 PM-10:00 PM', time: '18:45' },
    { icon: 'warning', title: 'Battery Risk Predicted', description: 'Thursday travel may drop below reserve', time: '16:20' },
    { icon: 'event', title: 'Schedule Synced', description: 'Business calendar loaded through July 30', time: '08:30' }
  ],

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

  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  addRecentAction: (action) => set((state) => ({ recentActions: [action, ...state.recentActions].slice(0, 5) })),
  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
  register: () => set({ isAuthenticated: true }),
  updateUser: (data) => set((state) => ({ user: { ...state.user, ...data } }))
}));