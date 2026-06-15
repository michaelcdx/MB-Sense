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

export const useAppStore = create<AppStore>((set) => ({
  isAuthenticated: false,
  user: {
    name: 'Alex Johnson',
    email: 'alex.j@example.com',
    notifications: {
      preferences: true,
      photos: false
    }
  },
  location: 'Palo Alto',
  weather: {
    temp: 18,
    condition: 'partly_cloudy_day'
  },
  vehicle: {
    locked: true,
    engineOn: false,
    cabinTemp: 22,
    batteryLevel: 75,
    tirePressure: 'OK',
    preCooling: false
  },
  events: [
    {
      id: '1',
      title: 'Product Strategy',
      location: 'Office - Building 4',
      time: '10:00 AM',
      date: new Date(),
      carNeeded: true,
      type: 'Morning',
      category: 'work'
    },
    {
      id: '2',
      title: 'Lunch with Sarah',
      location: 'Blue Bottle Cafe',
      time: '01:30 PM',
      date: new Date(),
      carNeeded: false,
      type: 'Afternoon',
      category: 'personal'
    },
    {
      id: '3',
      title: 'Evening Workout',
      location: 'Equinox Gym',
      time: '06:00 PM',
      date: new Date(),
      carNeeded: true,
      type: 'Evening',
      category: 'fitness',
      departureTime: '05:45 PM',
      status: 'CAR NEEDED'
    }
  ],
  recentActions: [
    { icon: 'ac_unit', title: 'Climate Adjusted', description: 'Target 21°C', time: '14:20' },
    { icon: 'lock', title: 'Vehicle Locked', description: 'Automated', time: '12:45' },
    { icon: 'explore', title: 'Destination Synced', description: 'Work Office', time: '08:30' }
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
      description: 'Target 22°C',
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
