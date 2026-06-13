import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { 
  Layers, LocateFixed, Plus, Navigation, Sparkles, Calendar, Clock, MapPin, 
  BrainCircuit, ChevronRight, Check, X, AlertCircle, Banknote, Leaf, Sliders, Fuel, Coins, Zap,
  Plug, RefreshCw, Bus, Car, Scale, Trash2, ArrowUp, ArrowDown, Route
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function RouteDisplay({ origin, destination }: {
  origin: string | google.maps.LatLngLiteral;
  destination: string | google.maps.LatLngLiteral;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map) return;
    
    polylinesRef.current.forEach(p => p.setMap(null));

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach(p => p.setMap(map));
        polylinesRef.current = newPolylines;
        if (routes[0].viewport) map.fitBounds(routes[0].viewport);
      }
    });

    return () => polylinesRef.current.forEach(p => p.setMap(null));
  }, [routesLib, map, origin, destination]);

  return null;
}

const mapCoordsToPercent = (lat: number, lng: number) => {
  const minLat = 37.73;
  const maxLat = 37.825;
  const minLng = -122.52;
  const maxLng = -122.38;
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
  return { 
    x: `${Math.max(5, Math.min(95, x))}%`, 
    y: `${Math.max(5, Math.min(95, y))}%` 
  };
};

export default function MapView() {
  const { events, addRecentAction } = useAppStore();
  const [showETA, setShowETA] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [syncApplied, setSyncApplied] = useState(false);
  const [squareSyncApplied, setSquareSyncApplied] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  
  // Smart Routing states
  const [showSmartRouting, setShowSmartRouting] = useState(false);
  const [selectedTrafficProfile, setSelectedTrafficProfile] = useState<'light' | 'moderate' | 'heavy' | 'severe'>('moderate');
  const [isLoadingRouting, setIsLoadingRouting] = useState(false);
  const [routingData, setRoutingData] = useState<{
    advisories: Array<{
      id: string;
      title: string;
      time: string;
      location: string;
      baseDuration: string;
      trafficDuration: string;
      suggestedDeparture: string;
      trafficStatus: string;
      delayAddedMins: number;
      aiRecommendation: string;
    }>;
    commuteSummary: string;
  } | null>(null);

  const [optimizedRoute, setOptimizedRoute] = useState<{
    stops: Array<{
      id: string;
      title: string;
      locationName: string;
      lat: number;
      lng: number;
      optimizedTime: string;
      suggestedDeparture: string;
      travelDuration: string;
      insight: string;
    }>;
    explanation: string;
  } | null>(null);

  const handleFetchSmartRouting = async (profile: 'light' | 'moderate' | 'heavy' | 'severe') => {
    setIsLoadingRouting(true);
    setErrorText(null);
    const routableEvents = events.filter(e => e.location && e.carNeeded);
    if (routableEvents.length === 0) {
      setErrorText("No car-required events with locations found in your calendar.");
      setIsLoadingRouting(false);
      return;
    }
    try {
      const res = await fetch('/api/smart-routing-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: routableEvents,
          trafficProfile: profile
        })
      });
      if (!res.ok) {
        throw new Error("Failed to load smart routing analytics");
      }
      const data = await res.json();
      setRoutingData(data);
    } catch (e: any) {
      console.error(e);
      setErrorText("Departure analysis failed. Please try again.");
    } finally {
      setIsLoadingRouting(false);
    }
  };

  useEffect(() => {
    if (showSmartRouting) {
      handleFetchSmartRouting(selectedTrafficProfile);
    }
  }, [showSmartRouting, selectedTrafficProfile, events]);

  // Trip Cost Estimator States
  const [showCostEstimator, setShowCostEstimator] = useState(false);
  const [costFuelType, setCostFuelType] = useState<'electricity' | 'gasoline'>('electricity');
  const [costUnitPrice, setCostUnitPrice] = useState<number>(0.36);
  const [costDistance, setCostDistance] = useState<number>(45);
  const [costPattern, setCostPattern] = useState<'eco' | 'nominal' | 'adverse'>('nominal');
  const [isEstimatedLoading, setIsEstimatedLoading] = useState(false);
  const [costSyncApplied, setCostSyncApplied] = useState(false);
  const [estimatedData, setEstimatedData] = useState<{
    fuelType: 'electricity' | 'gasoline';
    unitPrice: number;
    distanceKm: number;
    efficiencyPattern: 'eco' | 'nominal' | 'adverse';
    efficiencyRateText: string;
    consumptionAmount: number;
    totalCost: number;
    carbonFootprintKg: number;
    aiOptimizationAdvisory: string;
  } | null>(null);

  // Alternate Comparison States
  const [compareAlternativeModes, setCompareAlternativeModes] = useState(false);
  const [compareMetric, setCompareMetric] = useState<'cost' | 'carbon'>('cost');
  const [isAlternateComparingLoading, setIsAlternateComparingLoading] = useState(false);
  const [alternateCompareData, setAlternateCompareData] = useState<{
    transit: {
      name: string;
      cost: number;
      carbonKg: number;
      durationMin: number;
      efficiencyLevel: string;
    };
    rideshare: {
      name: string;
      cost: number;
      carbonKg: number;
      durationMin: number;
      efficiencyLevel: string;
    };
    gasolineModel: {
      name: string;
      cost: number;
      carbonKg: number;
      durationMin: number;
      efficiencyLevel: string;
    };
    aiComparisonAdvisory: string;
  } | null>(null);

  const fetchAlternateComparison = async () => {
    setIsAlternateComparingLoading(true);
    try {
      const defaultDrivingCost = estimatedData?.totalCost || (costFuelType === 'electricity' ? 2.67 : 7.39);
      const defaultDrivingCarbon = estimatedData?.carbonFootprintKg || (costFuelType === 'electricity' ? 1.1 : 14.3);
      const defaultDriveTime = Math.round(costDistance * 1.3 + 5);

      const res = await fetch('/api/transit-rideshare-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distanceKm: costDistance,
          drivingCost: defaultDrivingCost,
          drivingCarbon: defaultDrivingCarbon,
          drivingDurationMin: defaultDriveTime,
          fuelType: costFuelType
        })
      });

      if (!res.ok) throw new Error("Alternate comparator failed");
      const data = await res.json();
      setAlternateCompareData(data);
    } catch (err) {
      console.error(err);
      // Local fallback calculation if server is starting or network is down
      const defaultDrivingCost = estimatedData?.totalCost || (costFuelType === 'electricity' ? 2.67 : 7.39);
      const defaultDrivingCarbon = estimatedData?.carbonFootprintKg || (costFuelType === 'electricity' ? 1.1 : 14.3);
      const defaultDriveTime = Math.round(costDistance * 1.3 + 5);

      const transitFare = Math.min(9.50, Math.max(2.75, Math.round((2.75 + costDistance * 0.12) * 100) / 100));
      const transitCarbon = Math.round((costDistance * 0.012) * 10) / 10;
      const transitTime = Math.round(defaultDriveTime * 1.4 + 10);
      const transitName = costDistance > 60 ? "Caltrain Express" : costDistance > 20 ? "BART Rapid Rail" : "Muni Light Rail";

      const rideShareCost = Math.round((6.50 + costDistance * 2.10 + defaultDriveTime * 0.40) * 100) / 100;
      const rideShareCarbon = Math.round((costDistance * 0.13) * 10) / 10;
      const rideShareTime = defaultDriveTime + 5;

      const altGasCost = Math.round((costDistance * 0.621371 / 25 * 4.60) * 100) / 100;
      const altGasCarbon = Math.round((costDistance * 0.621371 / 25 * 8.887) * 10) / 10;

      const adviseMessage = costFuelType === 'electricity'
        ? `Commanding your Mercedes-Benz EQ is $${(rideShareCost - defaultDrivingCost).toFixed(2)} more cost-effective than ride-sharing while saving ${transitTime - defaultDriveTime} minutes over public rail transit with supreme seat massage comfort.`
        : `Your Mercedes luxury companion shaves ${transitTime - defaultDriveTime} minutes off the public transit itinerary, with a refined cockpit and acoustic insulation shielding you from transit stress.`;

      setAlternateCompareData({
        transit: {
          name: transitName,
          cost: transitFare,
          carbonKg: transitCarbon,
          durationMin: transitTime,
          efficiencyLevel: "ULTRA_GREEN"
        },
        rideshare: {
          name: "Premium Rideshare (Comfort EV)",
          cost: rideShareCost,
          carbonKg: rideShareCarbon,
          durationMin: rideShareTime,
          efficiencyLevel: "MODERATE"
        },
        gasolineModel: {
          name: "Standard Gas Alternative",
          cost: altGasCost,
          carbonKg: altGasCarbon,
          durationMin: defaultDriveTime,
          efficiencyLevel: "INEFFICIENT"
        },
        aiComparisonAdvisory: adviseMessage
      });
    } finally {
      setIsAlternateComparingLoading(false);
    }
  };

  useEffect(() => {
    if (showCostEstimator && compareAlternativeModes) {
      const delayDebt = setTimeout(() => {
        fetchAlternateComparison();
      }, 400);
      return () => clearTimeout(delayDebt);
    }
  }, [showCostEstimator, compareAlternativeModes, costDistance, costFuelType, costUnitPrice, costPattern, estimatedData]);

  const fetchTripCostEstimation = async (
    type: 'electricity' | 'gasoline',
    price: number,
    dist: number,
    patt: 'eco' | 'nominal' | 'adverse'
  ) => {
    setIsEstimatedLoading(true);
    setErrorText(null);
    try {
      const res = await fetch('/api/trip-cost-estimator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fuelType: type,
          unitPrice: price,
          distanceKm: dist,
          efficiencyPattern: patt
        })
      });
      if (!res.ok) {
        throw new Error("Failed to load cost estimation");
      }
      const data = await res.json();
      setEstimatedData(data);
    } catch (err) {
      console.error(err);
      // Fallback local calculations if network error or offline
      let whPerKm = patt === 'eco' ? 135 : patt === 'nominal' ? 165 : 210;
      let effRateText = `${whPerKm} Wh/km`;
      let cons = (dist * whPerKm) / 1000;
      let rawCost = cons * price;
      let carbon = cons * 0.15;
      
      if (type === 'gasoline') {
        const mpg = patt === 'eco' ? 38 : patt === 'nominal' ? 28 : 18;
        effRateText = `${mpg} MPG`;
        const distanceMiles = dist * 0.621371;
        cons = distanceMiles / mpg;
        rawCost = cons * price;
        carbon = cons * 8.887;
      }
      
      setEstimatedData({
        fuelType: type,
        unitPrice: price,
        distanceKm: dist,
        efficiencyPattern: patt,
        efficiencyRateText: effRateText,
        consumptionAmount: Math.round(cons * 10) / 10,
        totalCost: Math.round(rawCost * 100) / 100,
        carbonFootprintKg: Math.round(carbon * 10) / 10,
        aiOptimizationAdvisory: type === 'electricity' 
          ? "Activate Mercedes-Benz D-- maximum recuperation mode for single-pedal urban driving. This recaptures up to 28% kinetic energy on deceleration, reducing overall Wh/km costs."
          : "Leverage adaptive cruise control with active eco gliding mode to minimize abrupt throttle inputs, boosting fuel efficiency by up to 14% on highway stretches."
      });
    } finally {
      setIsEstimatedLoading(false);
    }
  };

  useEffect(() => {
    if (showCostEstimator) {
      const delayDebt = setTimeout(() => {
        fetchTripCostEstimation(costFuelType, costUnitPrice, costDistance, costPattern);
      }, 350);
      return () => clearTimeout(delayDebt);
    }
  }, [showCostEstimator, costFuelType, costUnitPrice, costDistance, costPattern]);

  const handleFuelTypeChange = (type: 'electricity' | 'gasoline') => {
    setCostFuelType(type);
    setCostUnitPrice(type === 'electricity' ? 0.36 : 4.60);
  };

  // EV charging stations nearby states
  const [showEVStations, setShowEVStations] = useState(false);
  const [evStations, setEvStations] = useState<any[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evSoc, setEvSoc] = useState(35);
  const [evMinSpeed, setEvMinSpeed] = useState(0);
  const [evProviderFilter, setEvProviderFilter] = useState('all');
  const [evRecommendation, setEvRecommendation] = useState('');
  const [selectedStation, setSelectedStation] = useState<any | null>(null);
  const [evSyncApplied, setEvSyncApplied] = useState(false);

  // Predictive Parking Finder states and parameters
  const [showParkingFinder, setShowParkingFinder] = useState(false);
  const [parkingLots, setParkingLots] = useState<any[]>([]);
  const [parkingLoading, setParkingLoading] = useState(false);
  const [parkingArrivalHour, setParkingArrivalHour] = useState<number>(14);
  const [parkingDayOfWeek, setParkingDayOfWeek] = useState<string>('Saturday');
  const [parkingRecommendation, setParkingRecommendation] = useState<string>('');
  const [selectedParkingLot, setSelectedParkingLot] = useState<any | null>(null);
  const [parkingSyncApplied, setParkingSyncApplied] = useState(false);

  const fetchParkingPredictions = async () => {
    setParkingLoading(true);
    setErrorText(null);
    try {
      const res = await fetch('/api/destination-parking-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: destination.lat,
          lng: destination.lng,
          arrivalHour: parkingArrivalHour,
          dayOfWeek: parkingDayOfWeek
        })
      });
      if (!res.ok) {
        throw new Error("Failed to load parking predictions telemetry");
      }
      const data = await res.json();
      setParkingLots(data.lots || []);
      setParkingRecommendation(data.aiParkingExplanatory || '');
      
      // Auto select the first lot if none is selected
      if (data.lots && data.lots.length > 0 && !selectedParkingLot) {
        setSelectedParkingLot(data.lots[0]);
      } else if (selectedParkingLot && data.lots) {
        const updatedSelected = data.lots.find((l: any) => l.id === selectedParkingLot.id);
        if (updatedSelected) {
          setSelectedParkingLot(updatedSelected);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorText("Trouble downloading live destination parking telemetry.");
    } finally {
      setParkingLoading(false);
    }
  };

  useEffect(() => {
    if (showParkingFinder) {
      const timer = setTimeout(() => {
        fetchParkingPredictions();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showParkingFinder, parkingArrivalHour, parkingDayOfWeek]);

  // AI Route Planner states
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [plannerWaypoints, setPlannerWaypoints] = useState<any[]>([
    { id: 'wp-start', name: 'Start: SF MB Experience Center', lat: 37.7770, lng: -122.4100 },
    { id: 'wp-goldengate', name: 'Golden Gate Bridge Overlook', lat: 37.8085, lng: -122.4757 },
    { id: 'wp-salesforce', name: 'Salesforce Park Rooftop', lat: 37.7891, lng: -122.3969 },
    { id: 'wp-twinpeaks', name: 'Twin Peaks Summit Vista', lat: 37.7544, lng: -122.4477 }
  ]);
  const [plannerVehicleType, setPlannerVehicleType] = useState<'electric' | 'gasoline'>('electric');
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerResult, setPlannerResult] = useState<any | null>(null);
  const [plannerNewName, setPlannerNewName] = useState('');
  const [plannerNewLat, setPlannerNewLat] = useState('37.7749');
  const [plannerNewLng, setPlannerNewLng] = useState('-122.4194');
  const [plannerSyncApplied, setPlannerSyncApplied] = useState(false);

  // Preset location options for easy clicking
  const PRESET_WAYPOINTS = [
    { name: 'Palace of Fine Arts', lat: 37.8029, lng: -122.4484 },
    { name: 'Fisherman\'s Wharf Pier 39', lat: 37.8080, lng: -122.4177 },
    { name: 'Sutro Baths Cliff Overlook', lat: 37.7804, lng: -122.5137 },
    { name: 'Lombard Crooked Street', lat: 37.8021, lng: -122.4187 },
    { name: 'Mission Dolores Park Vista', lat: 37.7596, lng: -122.4269 }
  ];

  const handleAddPresetWaypoint = (preset: any) => {
    const newId = `wp-${Date.now()}`;
    setPlannerWaypoints(prev => [
      ...prev,
      { id: newId, name: preset.name, lat: preset.lat, lng: preset.lng }
    ]);
  };

  const handleAddCustomWaypoint = () => {
    if (!plannerNewName.trim()) return;
    const latNum = parseFloat(plannerNewLat);
    const lngNum = parseFloat(plannerNewLng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorText("Invalid latitude or longitude coordinate.");
      return;
    }
    const newId = `wp-${Date.now()}`;
    setPlannerWaypoints(prev => [
      ...prev,
      { id: newId, name: plannerNewName, lat: latNum, lng: lngNum }
    ]);
    setPlannerNewName('');
  };

  const handleRemoveWaypoint = (id: string) => {
    setPlannerWaypoints(prev => prev.filter(wp => wp.id !== id));
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return; // Keep starting point locked
    if (direction === 'down' && index === plannerWaypoints.length - 1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex === 0) return; // Never displace the locked index 0 starter

    const updated = [...plannerWaypoints];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setPlannerWaypoints(updated);
  };

  const calculateAIPlan = async () => {
    if (plannerWaypoints.length < 2) {
      setErrorText("Provide at least 2 waypoints to sequence.");
      return;
    }
    setPlannerLoading(true);
    setErrorText(null);
    try {
      const res = await fetch('/api/ai-route-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints: plannerWaypoints,
          vehicleType: plannerVehicleType
        })
      });
      if (!res.ok) {
        throw new Error("Route planner API failed");
      }
      const data = await res.json();
      setPlannerResult(data);
      if (data.optimizedWaypoints) {
        setPlannerWaypoints(data.optimizedWaypoints);
      }
    } catch (err) {
      console.error(err);
      setErrorText("Trouble optimizing multiple waypoints sequence.");
    } finally {
      setPlannerLoading(false);
    }
  };

  const fetchEVStations = async () => {
    setEvLoading(true);
    setErrorText(null);
    try {
      const res = await fetch('/api/ev-charging-stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: origin.lat,
          lng: origin.lng,
          vehicleSOC: evSoc,
          filterProvider: evProviderFilter,
          minChargingSpeed: evMinSpeed
        })
      });
      if (!res.ok) {
        throw new Error("Failed to load EV stations telemetry");
      }
      const data = await res.json();
      setEvStations(data.stations || []);
      setEvRecommendation(data.aiRecommendation || '');
      if (selectedStation) {
        const updatedSelected = data.stations?.find((s: any) => s.id === selectedStation.id);
        if (updatedSelected) {
          setSelectedStation(updatedSelected);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorText("Trouble downloading live charging telemetry.");
    } finally {
      setEvLoading(false);
    }
  };

  useEffect(() => {
    if (showEVStations) {
      const timer = setTimeout(() => {
        fetchEVStations();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showEVStations, evSoc, evMinSpeed, evProviderFilter]);

  const isDemoMode = !hasValidKey;

  const destination = { lat: 37.7749, lng: -122.4194 };
  const origin = { lat: 37.75, lng: -122.43 };

  // Calculate only routable locations
  const routableEventsCount = events.filter(e => e.location && e.carNeeded).length;

  const handleOptimizeRoutes = async () => {
    setIsOptimizing(true);
    setErrorText(null);
    setSyncApplied(false);
    setShowSmartRouting(false); // Close smart routing side-panel to clear path display

    // Filter events requiring vehicle
    const routableEvents = events.filter(e => e.location && e.carNeeded);

    if (routableEvents.length === 0) {
      setErrorText("No car-required events with locations found in your calendar to optimize.");
      setIsOptimizing(false);
      return;
    }

    try {
      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: routableEvents,
          origin
        })
      });

      if (!res.ok) {
        throw new Error("Failed to post optimize schedule route");
      }

      const data = await res.json();
      if (data && Array.isArray(data.stops)) {
        setOptimizedRoute(data);
        setShowETA(false); // Hide the standard origin-destination ETA

        addRecentAction({
          icon: 'explore',
          title: 'Schedule Route Optimized',
          description: `Sequenced ${data.stops.length} calendar stops via Gemini`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        throw new Error("Invalid schema");
      }
    } catch (e: any) {
      console.error("Route optimization error", e);
      setErrorText("Trouble sequencing routes. Fallback calculated.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSyncToCar = () => {
    setSyncApplied(true);
    addRecentAction({
      icon: 'sync',
      title: 'Optimal Navigation Synced',
      description: 'Pushed optimized route matrix to MB Cockpit',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  return (
    <div className="absolute inset-0 z-0">
      {!isDemoMode ? (
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            defaultCenter={origin}
            defaultZoom={11}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100dvh' }}
            disableDefaultUI={true}
          >
            {optimizedRoute ? (
              <>
                {/* Custom numbered markers for optimized stops */}
                {optimizedRoute.stops.map((stop, index) => (
                  <AdvancedMarker key={`stop-${index}-${stop.id}`} position={{ lat: stop.lat, lng: stop.lng }}>
                    <div className="relative flex items-center justify-center group">
                      <div className="absolute rounded-full bg-blue-500/35 animate-ping w-8 h-8" />
                      <div className="relative w-8 h-8 rounded-full bg-blue-600 border-[3px] border-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-xl hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      {/* Hover text / Floating popup badge */}
                      <div className="absolute -top-11 bg-slate-900/90 border border-white/10 px-3 py-1 rounded-xl text-[11px] text-white whitespace-nowrap shadow-2xl pointer-events-none font-semibold flex items-center gap-1.5 backdrop-blur-sm transition-all group-hover:scale-105">
                        <span className="bg-blue-500/20 text-blue-400 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                        {stop.title}
                      </div>
                    </div>
                  </AdvancedMarker>
                ))}

                {/* Extra Starting/Origin Marker */}
                <AdvancedMarker position={origin}>
                  <div className="relative flex items-center justify-center group">
                    <div className="relative w-7 h-7 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                      S
                    </div>
                    <div className="absolute -top-10 bg-slate-900/95 border border-white/10 px-2.5 py-1 rounded-lg text-[10px] text-emerald-400 whitespace-nowrap shadow-xl font-bold">
                      STARTING POINT
                    </div>
                  </div>
                </AdvancedMarker>

                {/* Render dynamic sequential legs connecting the route */}
                {optimizedRoute.stops.map((stop, index) => {
                  const legOrigin = index === 0 ? origin : {
                    lat: optimizedRoute.stops[index - 1].lat,
                    lng: optimizedRoute.stops[index - 1].lng
                  };
                  const legDest = { lat: stop.lat, lng: stop.lng };
                  return (
                    <RouteDisplay 
                      key={`leg-${index}-${stop.id}`} 
                      origin={legOrigin} 
                      destination={legDest} 
                    />
                  );
                })}
              </>
            ) : !showRoutePlanner ? (
              <>
                <AdvancedMarker position={destination}>
                  <Pin background="#4b8eff" glyphColor="#fff" borderColor="#031427" />
                </AdvancedMarker>
                <AdvancedMarker position={origin}>
                   <Pin background="#4edea3" glyphColor="#003824" borderColor="#003824" />
                </AdvancedMarker>
                
                <RouteDisplay origin={origin} destination={destination} />
              </>
            ) : null}

            {/* AI Route Planner custom interactive markers in Google Map */}
            {showRoutePlanner && (
              <>
                {plannerWaypoints.map((wp, idx) => (
                  <AdvancedMarker
                    key={`wp-marker-${wp.id}`}
                    position={{ lat: wp.lat, lng: wp.lng }}
                  >
                    <div className="relative flex items-center justify-center group">
                      <div className="absolute rounded-full bg-indigo-500/35 animate-ping w-8 h-8" />
                      <div className="relative w-8 h-8 rounded-full bg-indigo-600 border-[3px] border-slate-950 flex items-center justify-center text-xs font-bold text-white shadow-xl hover:scale-110 transition-transform">
                        {idx + 1}
                      </div>
                      <div className="absolute -top-11 bg-slate-900/90 border border-white/10 px-3 py-1 rounded-xl text-[11px] text-white whitespace-nowrap shadow-2xl pointer-events-none font-semibold flex items-center gap-1.5 backdrop-blur-sm transition-all group-hover:scale-105">
                        <span className="bg-indigo-500/25 text-indigo-400 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                        {wp.name}
                      </div>
                    </div>
                  </AdvancedMarker>
                ))}

                {plannerWaypoints.slice(0, -1).map((wp, idx) => {
                  const nextWp = plannerWaypoints[idx + 1];
                  return (
                    <RouteDisplay 
                      key={`planner-leg-${idx}`} 
                      origin={{ lat: wp.lat, lng: wp.lng }} 
                      destination={{ lat: nextWp.lat, lng: nextWp.lng }} 
                    />
                  );
                })}
              </>
            )}

            {showEVStations && evStations.map((station) => (
              <AdvancedMarker 
                key={`ev-marker-${station.id}`} 
                position={{ lat: station.lat, lng: station.lng }}
                onClick={() => setSelectedStation(station)}
              >
                <div className="relative flex items-center justify-center cursor-pointer group">
                  <div className={cn(
                    "absolute rounded-full w-8 h-8 animate-ping opacity-20",
                    station.status === 'available' ? "bg-emerald-500" : station.status === 'busy' ? "bg-amber-500" : "bg-red-500"
                  )} />
                  <div className={cn(
                    "relative w-7 h-7 rounded-xl border border-slate-950 flex items-center justify-center text-white shadow-2xl hover:scale-115 transition-transform",
                    station.status === 'available' 
                      ? "bg-emerald-500 hover:bg-emerald-400" 
                      : station.status === 'busy' 
                        ? "bg-amber-500 hover:bg-amber-400" 
                        : "bg-slate-700 opacity-80"
                  )}>
                    <Plug className="w-3.5 h-3.5 text-white" />
                  </div>
                  
                  {/* Floating summary bubble */}
                  <div className="absolute -top-11 bg-slate-950/95 border border-white/10 px-3 py-1 rounded-xl text-[10px] font-bold text-white whitespace-nowrap shadow-2xl flex items-center gap-2 backdrop-blur-sm pointer-events-none group-hover:scale-105 transition-all">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      station.status === 'available' ? "bg-emerald-400" : station.status === 'busy' ? "bg-amber-400" : "bg-red-500"
                    )} />
                    <span>{station.name}</span>
                    <span className="opacity-40">|</span>
                    <span className="text-emerald-400 font-mono">{station.portsFree}/{station.totalPorts} Free</span>
                  </div>
                </div>
              </AdvancedMarker>
            ))}

            {showParkingFinder && parkingLots.map((lot) => (
              <AdvancedMarker 
                key={`park-marker-${lot.id}`} 
                position={{ lat: lot.lat, lng: lot.lng }}
                onClick={() => setSelectedParkingLot(lot)}
              >
                <div className="relative flex items-center justify-center cursor-pointer group">
                  <div className={cn(
                    "absolute rounded-full w-8 h-8 animate-ping opacity-20",
                    lot.currentPredictedOccupancy > 80 ? "bg-red-500" : lot.currentPredictedOccupancy > 55 ? "bg-amber-500" : "bg-emerald-500"
                  )} />
                  <div className={cn(
                    "relative w-7 h-7 rounded-xl border border-slate-950 flex items-center justify-center text-white shadow-2xl hover:scale-115 transition-transform font-bold text-xs",
                    lot.currentPredictedOccupancy > 80 
                      ? "bg-red-600 hover:bg-red-500" 
                      : lot.currentPredictedOccupancy > 55 
                        ? "bg-amber-500 hover:bg-amber-400" 
                        : "bg-emerald-500 hover:bg-emerald-400"
                  )}>
                    P
                  </div>
                  
                  {/* Floating summary bubble */}
                  <div className="absolute -top-11 bg-slate-950/95 border border-white/10 px-3 py-1 rounded-xl text-[10px] font-bold text-white whitespace-nowrap shadow-2xl flex items-center gap-2 backdrop-blur-sm pointer-events-none group-hover:scale-105 transition-all">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      lot.currentPredictedOccupancy > 80 ? "bg-red-400" : lot.currentPredictedOccupancy > 55 ? "bg-amber-400" : "bg-emerald-400"
                    )} />
                    <span className="font-extrabold">{lot.name}</span>
                    <span className="opacity-40 font-normal">|</span>
                    <span className="text-blue-450 font-mono font-extrabold">{lot.freeSpacesPredicted} free</span>
                  </div>
                </div>
              </AdvancedMarker>
            ))}
          </Map>
        </APIProvider>
      ) : (
        /* GORGEOUS DESIGNED HAND-CRAFTED DEMO TACTICAL MAP ENVIRONMENT */
        <div className="absolute inset-0 bg-[#070b16] overflow-hidden select-none flex flex-col font-sans">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:38px_38px]" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#090d18]/40 to-[#04060b]" />

          {/* Handdrawn SF Stylized Coastlines SVG & Connections */}
          <svg className="absolute inset-0 w-full h-full text-slate-800" viewBox="0 0 800 600" preserveAspectRatio="none">
            {/* SF Water Base representation */}
            <path d="M 0,0 Q 250,70 380,105 T 580,55 T 800,10 H 800 V 600 H 520 Q 440,380 490,240 T 380,150 Z" fill="#0b172a" opacity="0.35" />

            {/* Grid highway markers */}
            <path d="M 120,600 Q 250,450 380,300 T 500,0" fill="none" stroke="#253552" strokeWidth="2" strokeDasharray="5 5" opacity="0.4" />
            <path d="M 0,220 C 300,260 400,200 800,180" fill="none" stroke="#1c2b46" strokeWidth="1.5" opacity="0.3" />

            {/* Golden Gate Bridge link */}
            <line x1="280" y1="80" x2="310" y2="10" stroke="#ef4444" strokeWidth="2.5" opacity="0.3" />

            {/* SVG connected line legs for Route Planner waypoints */}
            {showRoutePlanner && plannerWaypoints.length >= 2 && (
              <polyline
                points={plannerWaypoints.map(wp => {
                  const { x, y } = mapCoordsToPercent(wp.lat, wp.lng);
                  return `${parseFloat(x) * 8.0},${parseFloat(y) * 6.0}`;
                }).join(' ')}
                fill="none"
                stroke="#6366f1"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0px 0px 8px #6366f1)' }}
                className="animate-pulse"
              />
            )}

            {/* SVG connected lines for Standard origin/destination leg if planner inactive */}
            {!showRoutePlanner && !showEVStations && !showParkingFinder && !optimizedRoute && (
              <line
                x1={parseFloat(mapCoordsToPercent(origin.lat, origin.lng).x) * 8.0}
                y1={parseFloat(mapCoordsToPercent(origin.lat, origin.lng).y) * 6.0}
                x2={parseFloat(mapCoordsToPercent(destination.lat, destination.lng).x) * 8.0}
                y2={parseFloat(mapCoordsToPercent(destination.lat, destination.lng).y) * 6.0}
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0px 0px 6px #10b981)' }}
              />
            )}

            {/* SVG connected line legs for scheduling optimizedRoute stops */}
            {optimizedRoute && (
              <polyline
                points={[origin, ...optimizedRoute.stops].map(wp => {
                  const { x, y } = mapCoordsToPercent(wp.lat, wp.lng);
                  return `${parseFloat(x) * 8.0},${parseFloat(y) * 6.0}`;
                }).join(' ')}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0px 0px 6px #3b82f6)' }}
              />
            )}
          </svg>

          {/* Sandbox Indicator Overlay */}
          <div className="absolute top-4 w-full text-center pointer-events-none flex flex-col items-center">
            <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 px-4 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-black tracking-widest text-[#4edea3] uppercase shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              HUD NAVIGATION SIMULATION GRID
            </div>
          </div>

          {/* Absolute Positioned Markers in Simulator */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Standard Origin & Destination */}
            {!showRoutePlanner && (
              <>
                <div 
                  className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ 
                    left: mapCoordsToPercent(destination.lat, destination.lng).x, 
                    top: mapCoordsToPercent(destination.lat, destination.lng).y 
                  }}
                >
                  <div className="w-7 h-7 rounded-xl bg-blue-600 border border-slate-950 flex items-center justify-center text-white text-[10px] font-black shadow-2xl hover:scale-115 transition-transform">
                    D
                  </div>
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-950 border border-white/10 px-2 py-0.5 rounded text-[9px] text-blue-300 font-extrabold whitespace-nowrap">
                    DESTINATION
                  </div>
                </div>

                <div 
                  className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ 
                    left: mapCoordsToPercent(origin.lat, origin.lng).x, 
                    top: mapCoordsToPercent(origin.lat, origin.lng).y 
                  }}
                >
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 border border-slate-950 flex items-center justify-center text-white text-[10px] font-black shadow-2xl hover:scale-115 transition-transform">
                    S
                  </div>
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-950 border border-white/10 px-2 py-0.5 rounded text-[9px] text-emerald-300 font-extrabold whitespace-nowrap">
                    STARTING POINT
                  </div>
                </div>
              </>
            )}

            {/* EV Charging Stations */}
            {showEVStations && evStations.map(station => (
              <div 
                key={`sim-ev-${station.id}`}
                onClick={() => setSelectedStation(station)}
                className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ 
                  left: mapCoordsToPercent(station.lat, station.lng).x, 
                  top: mapCoordsToPercent(station.lat, station.lng).y 
                }}
              >
                <div className={cn(
                  "relative w-7 h-7 rounded-xl border border-slate-950 flex items-center justify-center text-white shadow-xl hover:scale-115 transition-transform",
                  station.status === 'available' ? "bg-emerald-500" : "bg-amber-500"
                )}>
                  <Plug className="w-3.5 h-3.5 text-white" />
                </div>
                {/* Float-over label */}
                <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-white/10 px-3 py-1 rounded-xl text-[10px] font-bold text-white whitespace-nowrap shadow-2xl flex items-center gap-2 backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{station.name}</span>
                  <span className="text-emerald-400 font-mono">{station.portsFree}/{station.totalPorts} Free</span>
                </div>
              </div>
            ))}

            {/* Predictive Parking Lots */}
            {showParkingFinder && parkingLots.map(lot => (
              <div 
                key={`sim-park-${lot.id}`}
                onClick={() => setSelectedParkingLot(lot)}
                className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ 
                  left: mapCoordsToPercent(lot.lat, lot.lng).x, 
                  top: mapCoordsToPercent(lot.lat, lot.lng).y 
                }}
              >
                <div className={cn(
                  "w-7 h-7 rounded-xl border border-slate-950 flex items-center justify-center text-white font-black text-xs shadow-xl hover:scale-115 transition-transform",
                  lot.currentPredictedOccupancy > 80 ? "bg-red-600" : lot.currentPredictedOccupancy > 55 ? "bg-amber-500" : "bg-emerald-500"
                )}>
                  P
                </div>
                <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-white/10 px-3 py-1 rounded-xl text-[10px] font-bold text-white whitespace-nowrap shadow-2xl flex items-center gap-2 backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  <span className="font-extrabold">{lot.name}</span>
                  <span className="text-blue-300 font-mono">{lot.freeSpacesPredicted} free</span>
                </div>
              </div>
            ))}

            {/* AI Route Planner Waypoints */}
            {showRoutePlanner && plannerWaypoints.map((wp, idx) => (
              <div 
                key={`sim-wp-${wp.id}`}
                className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ 
                  left: mapCoordsToPercent(wp.lat, wp.lng).x, 
                  top: mapCoordsToPercent(wp.lat, wp.lng).y 
                }}
              >
                <div className="relative w-8 h-8 rounded-full bg-indigo-600 border-[3px] border-slate-950 flex items-center justify-center text-xs font-black text-white shadow-2xl hover:scale-115 transition-transform">
                  {idx + 1}
                </div>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-950 border border-white/15 px-2.5 py-1 rounded-xl text-[10px] font-bold text-white whitespace-nowrap shadow-2xl backdrop-blur-sm">
                  <span className="bg-indigo-500/20 text-indigo-400 px-1 rounded font-mono mr-1">{idx+1}</span>
                  <span>{wp.name}</span>
                </div>
              </div>
            ))}

            {/* Calendar Stops Optimized */}
            {optimizedRoute && optimizedRoute.stops.map((stop, idx) => (
              <div 
                key={`sim-stop-${stop.id}`}
                className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ 
                  left: mapCoordsToPercent(stop.lat, stop.lng).x, 
                  top: mapCoordsToPercent(stop.lat, stop.lng).y 
                }}
              >
                <div className="relative w-7 h-7 rounded-full bg-blue-600 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-white shadow-xl hover:scale-115 transition-transform">
                  {idx + 1}
                </div>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-950 border border-white/15 px-2 py-0.5 rounded-lg text-[9.5px] text-white whitespace-nowrap">
                  {stop.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="absolute top-24 right-4 flex flex-col gap-3 z-10">
        {[Layers, LocateFixed, Plus].map((Icon, idx) => (
          <button key={idx} className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/10 text-slate-400 hover:text-blue-400 transition-colors shadow-lg">
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      {/* Primary Dynamic Route Optimizer/Smart Routing advisor triggers container */}
      <div className="absolute top-24 left-4 right-20 z-10 flex max-w-[calc(100vw-6rem)] flex-col gap-2 md:right-auto md:max-w-[calc(100vw-9rem)]">
        <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-2 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:flex-wrap xl:overflow-visible">
          <button 
            onClick={handleOptimizeRoutes}
            disabled={isOptimizing}
            className={cn(
              "h-12 px-5 bg-slate-900 text-white rounded-2xl flex items-center gap-2.5 border font-semibold shadow-2xl transition-all duration-300 backdrop-blur-md hover:scale-102 flex-shrink-0",
              isOptimizing ? "border-amber-500/50 text-amber-400 hover:scale-100" : "border-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            )}
          >
            {isOptimizing ? (
              <>
                <BrainCircuit className="w-5 h-5 text-amber-400 animate-pulse" />
                <span className="text-sm font-bold tracking-wide uppercase text-amber-400/90">Sequencing stops with AI...</span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping absolute -top-0.5 -right-0.5" />
                <BrainCircuit className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-bold tracking-wide uppercase">Optimize Multi-stop Commute</span>
                {routableEventsCount > 0 && (
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md text-[11px] font-bold ml-1">
                    {routableEventsCount}
                  </span>
                )}
              </>
            )}
          </button>

          {/* AI-driven Predictive Smart Routing Panel Toggle */}
          <button
            onClick={() => {
              const nextVal = !showSmartRouting;
              setShowSmartRouting(nextVal);
              setShowCostEstimator(false);
              setShowEVStations(false);
              setShowParkingFinder(false);
              if (nextVal) {
                setOptimizedRoute(null); // Clear sequence to focus on departure advisory
                setShowETA(false);
              } else {
                setShowETA(true);
              }
            }}
            className={cn(
              "h-12 px-5 bg-slate-900 text-white rounded-2xl flex items-center gap-2.5 border font-semibold shadow-2xl transition-all duration-300 backdrop-blur-md hover:scale-102 flex-shrink-0",
              showSmartRouting ? "border-sky-500 text-sky-400" : "border-white/10 text-slate-300 hover:text-white"
            )}
          >
            <Sparkles className="w-4.5 h-4.5 text-sky-450" />
            <span className="text-sm font-bold uppercase tracking-wider">Predictive Smart Routing</span>
            {showSmartRouting && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />}
          </button>

          {/* Trip Cost Estimator Toggle */}
          <button
            onClick={() => {
              const nextVal = !showCostEstimator;
              setShowCostEstimator(nextVal);
              setShowSmartRouting(false);
              setShowEVStations(false);
              setShowParkingFinder(false);
              if (nextVal) {
                setOptimizedRoute(null);
                setShowETA(false);
              } else {
                setShowETA(true);
              }
            }}
            className={cn(
              "h-12 px-5 bg-slate-900 text-white rounded-2xl flex items-center gap-2.5 border font-semibold shadow-2xl transition-all duration-300 backdrop-blur-md hover:scale-102 flex-shrink-0",
              showCostEstimator ? "border-emerald-500 text-emerald-400" : "border-white/10 text-slate-300 hover:text-white"
            )}
          >
            <Banknote className="w-4.5 h-4.5 text-emerald-400" />
            <span className="text-sm font-bold uppercase tracking-wider">Trip Cost Estimator</span>
            {showCostEstimator && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />}
          </button>

          {/* EV Station Locator Toggle */}
          <button
            onClick={() => {
              const nextVal = !showEVStations;
              setShowEVStations(nextVal);
              setShowSmartRouting(false);
              setShowCostEstimator(false);
              setShowParkingFinder(false);
              if (nextVal) {
                setOptimizedRoute(null);
                setShowETA(false);
              } else {
                setShowETA(true);
              }
            }}
            className={cn(
              "h-12 px-5 bg-slate-900 text-white rounded-2xl flex items-center gap-2.5 border font-semibold shadow-2xl transition-all duration-300 backdrop-blur-md hover:scale-102 flex-shrink-0",
              showEVStations ? "border-blue-500 text-sky-450" : "border-white/10 text-slate-300 hover:text-white"
            )}
          >
            <Plug className="w-4.5 h-4.5 text-blue-405" />
            <span className="text-sm font-bold uppercase tracking-wider">EV Stations</span>
            {showEVStations && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />}
          </button>

          {/* Predictive Parking Finder Toggle */}
          <button
            onClick={() => {
              const nextVal = !showParkingFinder;
              setShowParkingFinder(nextVal);
              setShowSmartRouting(false);
              setShowCostEstimator(false);
              setShowEVStations(false);
              setShowRoutePlanner(false);
              if (nextVal) {
                setOptimizedRoute(null);
                setShowETA(false);
              } else {
                setShowETA(true);
              }
            }}
            className={cn(
              "h-12 px-5 bg-slate-900 text-white rounded-2xl flex items-center gap-2.5 border font-semibold shadow-2xl transition-all duration-300 backdrop-blur-md hover:scale-102 flex-shrink-0",
              showParkingFinder ? "border-indigo-500 text-indigo-400" : "border-white/10 text-slate-300 hover:text-white"
            )}
          >
            <Clock className="w-4.5 h-4.5 text-indigo-400" />
            <span className="text-sm font-bold uppercase tracking-wider">Predictive Parking</span>
            {showParkingFinder && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />}
          </button>

          {/* AI Route Planner Toggle */}
          <button
            onClick={() => {
              const nextVal = !showRoutePlanner;
              setShowRoutePlanner(nextVal);
              setShowSmartRouting(false);
              setShowCostEstimator(false);
              setShowEVStations(false);
              setShowParkingFinder(false);
              if (nextVal) {
                setOptimizedRoute(null);
                setShowETA(false);
              } else {
                setShowETA(true);
              }
            }}
            className={cn(
              "h-12 px-5 bg-slate-900 text-white rounded-2xl flex items-center gap-2.5 border font-semibold shadow-2xl transition-all duration-300 backdrop-blur-md hover:scale-102 flex-shrink-0",
              showRoutePlanner ? "border-indigo-600 text-indigo-400" : "border-white/10 text-slate-300 hover:text-white"
            )}
          >
            <Route className="w-4.5 h-4.5 text-indigo-400" />
            <span className="text-sm font-bold uppercase tracking-wider">AI Route Planner</span>
            {showRoutePlanner && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-0.5" />}
          </button>
        </div>

        {errorText && (
          <div className="max-w-sm bg-red-950/80 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-medium shadow-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorText}</span>
          </div>
        )}
      </div>

      {/* Smart Routing Side Panel Drawer */}
      <AnimatePresence>
        {showSmartRouting && routingData && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute left-4 right-4 top-40 bottom-24 z-30 flex w-auto flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur-md md:right-auto md:w-[420px]"
          >
            {/* Top Border Glow */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest block">AI-driven predictive engine</span>
                <h3 className="text-base font-extrabold flex items-center gap-2 mt-0.5">
                  <Sparkles className="w-4.5 h-4.5 text-sky-300" /> Smart Routing Advisor
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowSmartRouting(false);
                  setShowETA(true);
                }}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Commute Summary Alert Banner */}
            <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl text-xs text-slate-350 leading-relaxed font-semibold">
              {isLoadingRouting ? (
                <div className="flex items-center gap-2 py-1 text-slate-400">
                  <div className="w-3.5 h-3.5 rounded-full border border-sky-400 border-t-transparent animate-spin shrink-0" />
                  <span>Computing predictive models...</span>
                </div>
              ) : (
                routingData.commuteSummary
              )}
            </div>

            {/* Traffic Condition Preset Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Set Predicted Traffic Pressure Profile</span>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-900/80 border border-white/5 rounded-xl">
                {(['light', 'moderate', 'heavy', 'severe'] as const).map((prof) => (
                  <button
                    key={prof}
                    disabled={isLoadingRouting}
                    onClick={() => setSelectedTrafficProfile(prof)}
                    className={cn(
                      "py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all tracking-wider shrink-0 text-center",
                      selectedTrafficProfile === prof
                        ? prof === 'light'
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : prof === 'moderate'
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : prof === 'heavy'
                              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                              : "bg-rose-500/25 text-rose-400 border border-rose-500/35"
                        : "text-slate-400 hover:text-white bg-transparent border border-transparent"
                    )}
                  >
                    {prof}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable list of advisories */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {isLoadingRouting ? (
                <div className="h-44 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                  <p className="text-xs font-semibold">Simulating real-time traffic telemetry...</p>
                </div>
              ) : (
                routingData.advisories.map((adv) => (
                  <div
                    key={adv.id}
                    className="bg-slate-900/40 border border-white/5 p-3 rounded-2xl flex flex-col gap-2 hover:border-white/10 transition-colors"
                  >
                    <div className="flex justify-between items-baseline gap-2">
                      <h4 className="text-xs font-bold text-slate-100 truncate">{adv.title}</h4>
                      <span className="text-[10px] font-mono text-slate-450 shrink-0 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        Starts: {adv.time}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{adv.location}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] py-1 border-t border-b border-white/5 bg-slate-900/20 px-1 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Clear Road:</span>
                        <span className="text-slate-350 font-semibold">{adv.baseDuration}</span>
                      </div>
                      <div className="flex justify-between border-l border-white/5 pl-2">
                        <span className="text-slate-500 font-medium font-semibold">In Traffic:</span>
                        <span className={cn(
                          "font-bold",
                          selectedTrafficProfile === 'light' ? "text-emerald-400" : selectedTrafficProfile === 'moderate' ? "text-amber-450" : "text-rose-450"
                        )}>{adv.trafficDuration}</span>
                      </div>
                    </div>

                    {/* Highly-highlighted departure badge */}
                    <div className="flex justify-between items-center bg-slate-900/90 border border-white/5 px-2.5 py-2 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider leading-none">Smart Departure</span>
                        <span className="text-sm font-black text-sky-400 mt-1 leading-none">{adv.suggestedDeparture}</span>
                      </div>
                      <span className={cn(
                        "text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md",
                        selectedTrafficProfile === 'light'
                          ? "bg-emerald-500/10 text-emerald-405"
                          : selectedTrafficProfile === 'moderate'
                            ? "bg-amber-500/10 text-amber-405"
                            : "bg-red-500/10 text-red-405"
                      )}>
                        {adv.trafficStatus}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-snug italic px-1 pt-0.5">
                      💡 {adv.aiRecommendation}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Sync Cockpit directly from Advisor list */}
            <div className="pt-2 border-t border-white/5">
              <button
                onClick={() => {
                  addRecentAction({
                    icon: 'sync',
                    title: 'Smart Departures Synced',
                    description: `Pushed traffic-aware schedules (${selectedTrafficProfile.toUpperCase()}) to MB Navigation`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  });
                  setSquareSyncApplied(true);
                  setTimeout(() => setSquareSyncApplied(false), 3000);
                }}
                className={cn(
                  "w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2",
                  squareSyncApplied ? "bg-emerald-600 text-white" : "bg-sky-600 hover:bg-sky-500 text-white"
                )}
              >
                {squareSyncApplied ? (
                  <>
                    <Check className="w-4 h-4 text-white animate-pulse" />
                    COCKPIT CALENDAR PREPPED
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    SYNC SMART DEPARTURES
                  </>
                )}
              </button>
            </div>
            
          </motion.div>
        )}

        {showCostEstimator && (() => {
          const costChartData = [
            {
              name: 'Eco Optimum',
              cost: costFuelType === 'electricity' 
                ? Math.round(((costDistance * 135) / 1000) * costUnitPrice * 100) / 100
                : Math.round(((costDistance * 0.621371) / 38) * costUnitPrice * 100) / 100,
            },
            {
              name: 'Normal Fleet',
              cost: costFuelType === 'electricity' 
                ? Math.round(((costDistance * 165) / 1000) * costUnitPrice * 100) / 100
                : Math.round(((costDistance * 0.621371) / 28) * costUnitPrice * 100) / 100,
            },
            {
              name: 'Demanding Drive',
              cost: costFuelType === 'electricity' 
                ? Math.round(((costDistance * 210) / 1000) * costUnitPrice * 100) / 100
                : Math.round(((costDistance * 0.621371) / 18) * costUnitPrice * 100) / 100,
            }
          ];

          return (
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="absolute left-4 right-4 top-40 bottom-24 z-30 flex w-auto flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur-md md:right-auto md:w-[420px]"
            >
              {/* Top Border Glow */}
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
              
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block font-mono">MB Intelligent Costing</span>
                  <h3 className="text-base font-extrabold flex items-center gap-2 mt-0.5">
                    <Banknote className="w-4.5 h-4.5 text-emerald-350 animate-pulse" /> Powertrain Cost Estimator
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowCostEstimator(false);
                    setShowETA(true);
                  }}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Powertrain Select tabs */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-medium">Select Powertrain Profile</span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-white/5 rounded-xl">
                  <button
                    onClick={() => handleFuelTypeChange('electricity')}
                    className={cn(
                      "py-1.5 rounded-lg text-[10.5px] font-black uppercase transition-all tracking-wider flex items-center justify-center gap-1.5",
                      costFuelType === 'electricity'
                        ? "bg-sky-600/20 text-sky-300 border border-sky-500/30"
                        : "text-slate-400 hover:text-white bg-transparent border border-transparent"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5 text-sky-400" /> Electric (EQ)
                  </button>
                  <button
                    onClick={() => handleFuelTypeChange('gasoline')}
                    className={cn(
                      "py-1.5 rounded-lg text-[10.5px] font-black uppercase transition-all tracking-wider flex items-center justify-center gap-1.5",
                      costFuelType === 'gasoline'
                        ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                        : "text-slate-400 hover:text-white bg-transparent border border-transparent"
                    )}
                  >
                    <Fuel className="w-3.5 h-3.5 text-emerald-400" /> Petrol / Hybrid
                  </button>
                </div>
              </div>

              {/* Scrollable parameters wrapper */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                
                {/* Distance settings */}
                <div className="bg-slate-900/40 p-3 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline font-semibold text-xs">
                    <span className="text-slate-400 flex items-center gap-1 uppercase tracking-wider text-[10px]"><Sliders className="w-3 h-3 text-slate-500" /> Trip Distance</span>
                    <span className="text-white font-mono text-sm font-black">{costDistance} km</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="350" 
                    step="5"
                    value={costDistance} 
                    onChange={(e) => setCostDistance(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  
                  {/* Micro-Presets for Mercedes Commutes */}
                  <div className="flex gap-1.5 pt-1 overflow-x-auto pb-1">
                    {[
                      { label: 'City', val: 15 },
                      { label: 'Office', val: 45 },
                      { label: 'Bay Area', val: 110 },
                      { label: 'Intercity', val: 240 }
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCostDistance(p.val)}
                        className={cn(
                          "text-[9px] font-extrabold uppercase px-2 py-1 rounded bg-white/5 border text-slate-350 hover:text-white hover:bg-white/10 shrink-0",
                          costDistance === p.val ? "border-emerald-500 text-emerald-450 bg-emerald-500/5" : "border-white/5"
                        )}
                      >
                        {p.val}k ({p.label})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Energy or Fuel Rate Prices */}
                <div className="bg-slate-900/40 p-3 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-baseline font-semibold text-xs">
                    <span className="text-slate-400 flex items-center gap-1 uppercase tracking-wider text-[10px]">
                      {costFuelType === 'electricity' ? <Coins className="w-3 h-3 text-sky-400" /> : <Fuel className="w-3 h-3 text-emerald-400" />}
                      {costFuelType === 'electricity' ? 'Utility Rate ($ / kWh)' : 'Gasoline ($ / Gallon)'}
                    </span>
                    <span className="text-white font-mono text-sm font-black">${costUnitPrice.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min={costFuelType === 'electricity' ? '0.10' : '2.00'} 
                    max={costFuelType === 'electricity' ? '0.90' : '8.00'} 
                    step="0.01"
                    value={costUnitPrice} 
                    onChange={(e) => setCostUnitPrice(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase px-0.5">
                    <span>{costFuelType === 'electricity' ? '$0.10 (Off-peak)' : '$2.00'}</span>
                    <span>{costFuelType === 'electricity' ? '$0.90 (Supercharge)' : '$8.00'}</span>
                  </div>
                </div>

                {/* Driving Intensity Profile */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-medium">Driving Efficiency Index</span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 border border-white/5 rounded-xl">
                    {([
                      { key: 'eco', label: 'ECO OPT', desc: 'Optimal D--' },
                      { key: 'nominal', label: 'NORMAL', desc: 'Balanced' },
                      { key: 'adverse', label: 'SEVERE', desc: 'Headwinds/Ice' }
                    ] as const).map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setCostPattern(p.key)}
                        className={cn(
                          "py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all tracking-wider text-center flex flex-col",
                          costPattern === p.key
                            ? p.key === 'eco'
                              ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold"
                              : p.key === 'nominal'
                              ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 font-bold"
                              : "bg-red-600/25 text-red-400 border border-red-500/35 font-bold"
                            : "text-slate-400 hover:text-white bg-transparent border border-transparent"
                        )}
                      >
                        <span>{p.label}</span>
                        <span className="text-[7.5px] opacity-60 font-semibold lowercase tracking-none mt-0.5">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced Alternate Comparison Mode Selector */}
                <div className="bg-slate-900/50 p-3 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                      <Scale className="w-3.5 h-3.5 text-sky-400" /> Compare Alternate Modes
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompareAlternativeModes(!compareAlternativeModes)}
                      className={cn(
                        "w-10 h-5.5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none",
                        compareAlternativeModes ? "bg-sky-500" : "bg-slate-800 border border-white/10"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4.5 h-4.5 rounded-full bg-white transition-all shadow-md absolute top-0.5",
                          compareAlternativeModes ? "left-5" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    Compare your route against live public transit schedules, pricing, and ride-sharing carbon emission indexes.
                  </p>
                </div>

                {/* Metric Selector Tabs */}
                {compareAlternativeModes && (
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-900 border border-white/5 rounded-xl">
                    <button
                      onClick={() => setCompareMetric('cost')}
                      className={cn(
                        "py-1 rounded-lg text-[9px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5",
                        compareMetric === 'cost'
                          ? "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      <Coins className="w-3 h-3" /> Energy Cost ($)
                    </button>
                    <button
                      onClick={() => setCompareMetric('carbon')}
                      className={cn(
                        "py-1 rounded-lg text-[9px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5",
                        compareMetric === 'carbon'
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      <Leaf className="w-3 h-3" /> Carbon Footprint (kg)
                    </button>
                  </div>
                )}

                {/* Dynamic Recharts Comparison Chart */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    {compareAlternativeModes ? `Comparative ${compareMetric === 'cost' ? 'Energy Cost ($)' : 'CO2 Footprint (kg)'}` : 'Comparative Projection'}
                  </span>
                  <div className="h-28 bg-slate-900/60 border border-white/5 rounded-2xl p-2.5 flex items-center justify-center relative">
                    {compareAlternativeModes && isAlternateComparingLoading ? (
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="w-4 h-4 rounded-full border border-sky-400 border-t-transparent animate-spin" />
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Syncing mode telemetry...</span>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={compareAlternativeModes ? [
                            {
                              name: 'Your Mercedes',
                              cost: compareMetric === 'cost' 
                                ? (estimatedData?.totalCost || (costFuelType === 'electricity' ? 2.67 : 7.39))
                                : (estimatedData?.carbonFootprintKg || (costFuelType === 'electricity' ? 1.1 : 14.3)),
                              color: '#3b82f6'
                            },
                            {
                              name: 'Public Transit',
                              cost: compareMetric === 'cost'
                                ? (alternateCompareData?.transit.cost || 4.25)
                                : (alternateCompareData?.transit.carbonKg || 0.5),
                              color: '#10b981'
                            },
                            {
                              name: 'Comfort Rideshare',
                              cost: compareMetric === 'cost'
                                ? (alternateCompareData?.rideshare.cost || 22.40)
                                : (alternateCompareData?.rideshare.carbonKg || 5.85),
                              color: '#f59e0b'
                            },
                            {
                              name: 'Gas Alternative',
                              cost: compareMetric === 'cost'
                                ? (alternateCompareData?.gasolineModel.cost || 14.80)
                                : (alternateCompareData?.gasolineModel.carbonKg || 12.4),
                              color: '#ef4444'
                            }
                          ] : (costChartData as any[])}
                          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={8} width={85} tickLine={false} axisLine={false} />
                          <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={12}>
                            {(compareAlternativeModes ? [
                              { color: '#3b82f6' },
                              { color: '#10b981' },
                              { color: '#f59e0b' },
                              { color: '#ef4444' }
                            ] : costChartData).map((entry: any, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={compareAlternativeModes ? entry.color : (index === 0 ? '#10b981' : index === 1 ? '#f59e0b' : '#ef4444')}
                                opacity={compareAlternativeModes ? 1.0 : (costPattern === (index === 0 ? 'eco' : index === 1 ? 'nominal' : 'adverse') ? 1.0 : 0.35)}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Live Alternate Comparison Data Cards */}
                {compareAlternativeModes && alternateCompareData && (
                  <div className="grid grid-cols-3 gap-2">
                    {/* Transit Option */}
                    <div className="bg-slate-900 border border-white/5 p-2 rounded-xl space-y-1">
                      <div className="flex items-center gap-1 text-sky-400">
                        <Bus className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-wider truncate">{alternateCompareData.transit.name}</span>
                      </div>
                      <div className="space-y-0.5 leading-none">
                        <div className="text-[10px] font-black font-mono text-white">${alternateCompareData.transit.cost.toFixed(2)}</div>
                        <div className="text-[8px] font-bold text-emerald-400 font-mono">{alternateCompareData.transit.carbonKg}kg CO₂</div>
                        <div className="text-[8px] font-bold text-slate-400 font-mono">{alternateCompareData.transit.durationMin} mins</div>
                      </div>
                    </div>

                    {/* Rideshare Option */}
                    <div className="bg-slate-900 border border-white/5 p-2 rounded-xl space-y-1">
                      <div className="flex items-center gap-1 text-amber-400">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-wider truncate">Uber Comfort</span>
                      </div>
                      <div className="space-y-0.5 leading-none">
                        <div className="text-[10px] font-black font-mono text-white">${alternateCompareData.rideshare.cost.toFixed(2)}</div>
                        <div className="text-[8px] font-bold text-amber-500 font-mono">{alternateCompareData.rideshare.carbonKg}kg CO₂</div>
                        <div className="text-[8px] font-bold text-slate-400 font-mono">{alternateCompareData.rideshare.durationMin} mins</div>
                      </div>
                    </div>

                    {/* Gas Option */}
                    <div className="bg-slate-900 border border-white/5 p-2 rounded-xl space-y-1">
                      <div className="flex items-center gap-1 text-red-400">
                        <Fuel className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-wider truncate">Gas ICE Car</span>
                      </div>
                      <div className="space-y-0.5 leading-none">
                        <div className="text-[10px] font-black font-mono text-white">${alternateCompareData.gasolineModel.cost.toFixed(2)}</div>
                        <div className="text-[8px] font-bold text-red-500 font-mono">{alternateCompareData.gasolineModel.carbonKg}kg CO₂</div>
                        <div className="text-[8px] font-bold text-slate-400 font-mono">{alternateCompareData.gasolineModel.durationMin} mins</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculations Outcome Dashboard Callout */}
                {isEstimatedLoading ? (
                  <div className="h-32 flex flex-col items-center justify-center bg-slate-900/40 border border-white/5 rounded-3xl gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    <span className="text-[10.5px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Running Gemini Models...</span>
                  </div>
                ) : estimatedData ? (
                  <div className="bg-slate-900 border border-white/15 p-4 rounded-3xl relative overflow-hidden flex flex-col gap-3">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                    
                    {/* Cost Display and Unit label */}
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block leading-none">Estimated Trip Cost</span>
                        <span className="text-3xl font-black text-emerald-450 font-mono tracking-tight block mt-1 leading-none">
                          ${estimatedData.totalCost.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="text-right bg-white/5 border border-white/5 p-2 rounded-xl shrink-0">
                        <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest leading-none block">Consumption</span>
                        <span className="text-xs font-black text-white font-mono mt-0.5 block">
                          {estimatedData.consumptionAmount} {costFuelType === 'electricity' ? 'kWh' : 'Gal'}
                        </span>
                      </div>
                    </div>

                    {/* CO2 Footprint rating progress underlay */}
                    <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-2xl border border-white/5 text-[10.5px]">
                      <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                        <Leaf className={cn(
                          "w-4 h-4 shrink-0",
                          costFuelType === 'electricity' ? "text-emerald-400" : "text-amber-400"
                        )} />
                        <span>Carbon Footprint:</span>
                      </div>
                      <span className={cn(
                        "font-black font-mono",
                        estimatedData.carbonFootprintKg < 5 ? "text-emerald-400" : "text-amber-450"
                      )}>
                        {estimatedData.carbonFootprintKg} kg CO₂
                      </span>
                    </div>

                    {/* Gemini Advice Box */}
                    <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                        {compareAlternativeModes ? "⭐ REAL-TIME MULTI-MODAL EVALUATION" : "⭐ POWERTRAIN RECOMMENDATION"}
                      </span>
                      <p className="text-[10px] text-slate-300 leading-relaxed italic font-medium pt-0.5">
                        "{compareAlternativeModes && alternateCompareData ? alternateCompareData.aiComparisonAdvisory : estimatedData.aiOptimizationAdvisory}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center bg-slate-900/40 border border-white/5 rounded-3xl gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    <span className="text-[10.5px] text-slate-500 font-bold uppercase tracking-widest">Evaluating telemetry...</span>
                  </div>
                )}

              </div>

              {/* Sync Cockpit directly */}
              <div className="pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    addRecentAction({
                      icon: 'sync',
                      title: 'Cost Profile Synced',
                      description: `Pushed target cost ($${estimatedData?.totalCost.toFixed(2) || '0.00'}) and ${costPattern.toUpperCase()} recuperation markers to navigator HUD`,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                    setCostSyncApplied(true);
                    setTimeout(() => setCostSyncApplied(false), 3000);
                  }}
                  disabled={isEstimatedLoading || !estimatedData}
                  className={cn(
                    "w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50",
                    costSyncApplied ? "bg-emerald-600 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  )}
                >
                  {costSyncApplied ? (
                    <>
                      <Check className="w-4 h-4 text-white font-bold animate-pulse" />
                      HUD ENERGY CRITERIA ARMED
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      SYNC TARGET COST TO HUD
                    </>
                  )}
                </button>
              </div>
              
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* EV Charging Stations Side Panel Drawer */}
      <AnimatePresence>
        {showEVStations && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute left-4 right-4 top-40 bottom-24 z-30 flex w-auto flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur-md md:right-auto md:w-[420px]"
          >
            {/* Top Border Glow */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block font-sans">MB Sense Intelligent charging network</span>
                <h3 className="text-base font-extrabold flex items-center gap-1.5 mt-0.5 font-sans">
                  <Plug className="w-4.5 h-4.5 text-blue-400" /> EV Charger Locator
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchEVStations}
                  disabled={evLoading}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white disabled:opacity-50"
                  title="Refresh Live availability"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", evLoading && "animate-spin")} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEVStations(false);
                    setShowETA(true);
                  }}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Vehicle SoC simulation custom slider */}
            <div className="bg-slate-900/60 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9.5px]">EQ Virtual State of Charge</span>
                <span className="font-mono font-black text-blue-400">{evSoc}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                value={evSoc}
                onChange={(e) => setEvSoc(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-1.5 rounded-lg bg-slate-950 border border-white/5"
              />
              <span className="text-[9px] text-slate-500 leading-normal">
                Adjusting state of charge dynamically updates the elite Gemini recommendations for proximity vs speed!
              </span>
            </div>

            {/* Selection filters */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Provider</label>
                <select
                  value={evProviderFilter}
                  onChange={(e) => setEvProviderFilter(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500/50"
                >
                  <option value="all">All Networks</option>
                  <option value="tesla_supercharger">Tesla Supercharger</option>
                  <option value="chargepoint">ChargePoint</option>
                  <option value="electrify_america">Electrify America</option>
                  <option value="evgo">EVgo</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Min charging speed</label>
                <select
                  value={evMinSpeed}
                  onChange={(e) => setEvMinSpeed(Number(e.target.value))}
                  className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500/50"
                >
                  <option value={0}>Any Speed</option>
                  <option value={150}>Fast (&gt;= 150 kW)</option>
                  <option value={250}>Ultra-Fast (&gt;= 250 kW)</option>
                </select>
              </div>
            </div>

            {/* Gemini Live Recommendation */}
            <div className="bg-slate-900 border border-white/15 p-3.5 rounded-2xl relative overflow-hidden flex flex-col gap-2 min-h-[92px] justify-center">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
              
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1 font-sans">
                ⭐ GERMANY MOBILITY MERCEDES-BENZ DIRECTIVE
              </span>
              
              {evLoading ? (
                <div className="flex items-center gap-2 py-1 text-slate-450 text-xs">
                  <div className="w-3.5 h-3.5 rounded-full border border-blue-400 border-t-transparent animate-spin shrink-0" />
                  <span>Analyzing nearby chargers and SoC...</span>
                </div>
              ) : evRecommendation ? (
                <p className="text-[10.5px] text-slate-350 leading-relaxed font-sans italic">
                  "{evRecommendation}"
                </p>
              ) : (
                <p className="text-[10px] text-slate-500">No telemetry suggestions loaded.</p>
              )}
            </div>

            {/* List of stations with active status */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1">
                <span>Nearby nodes ({evStations.length})</span>
                <span>Proximity / Status</span>
              </div>

              {evLoading && evStations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
                  <div className="w-5 h-5 rounded-full border border-blue-500 border-t-transparent animate-spin" />
                  <span className="text-[11px] uppercase tracking-wider">Downloading station map...</span>
                </div>
              ) : evStations.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/30 rounded-2xl border border-white/5">
                  <span className="text-xs text-slate-500">No stations match current filters.</span>
                </div>
              ) : (
                evStations.map((station) => (
                  <div
                    key={station.id}
                    onClick={() => setSelectedStation(station)}
                    className={cn(
                      "w-full text-left bg-slate-900/40 hover:bg-slate-900/90 border rounded-2xl p-3 flex flex-col gap-1.5 transition-all cursor-pointer",
                      selectedStation?.id === station.id 
                        ? "border-blue-500/60 bg-slate-900/100 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                        : "border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-extrabold text-slate-100">{station.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{station.provider}</span>
                      </div>
                      
                      <div className="text-right flex flex-col items-end shrink-0">
                        <span className="text-[11px] text-blue-405 font-black font-mono">{station.distanceKm} km</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider mt-1 text-center scale-90 origin-right",
                          station.status === 'available' 
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                            : station.status === 'busy' 
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" 
                              : "bg-red-500/15 text-red-400 border border-red-500/20"
                        )}>
                          {station.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-white/5 text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Plug className="w-3 h-3 text-slate-500" />
                        <span className="font-mono">{station.chargingSpeed} kW • {station.connectorType}</span>
                      </span>
                      <span className="text-[10.5px] font-black text-slate-200">
                        ${station.pricing.toFixed(2)}/kWh
                      </span>
                    </div>

                    {/* Rich Details if clicked */}
                    {selectedStation?.id === station.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-2 mt-1 border-t border-white/5 text-[10px] text-slate-350 flex flex-col gap-1.5"
                      >
                        <div className="flex justify-between">
                          <span>Address:</span>
                          <span className="text-right text-white font-medium">{station.address}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Connector status:</span>
                          <span className="font-mono text-white bg-slate-950 px-2 py-0.5 rounded border border-white/5">
                            {station.totalPorts - station.portsFree} / {station.totalPorts} ports occupied
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[9.5px]">
                          <span>Real-time Free Slots:</span>
                          <span className="text-emerald-450 font-black font-mono">
                            {station.portsFree} free connect lines
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Sync active selected station to the dashboard display */}
            <div className="pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  if (selectedStation) {
                    addRecentAction({
                      icon: 'sync',
                      title: 'EQ Charger Set',
                      description: `Routed MB HUD to ${selectedStation.name} (${selectedStation.chargingSpeed}kW CCS) with ${selectedStation.portsFree} ports available`,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                    setEvSyncApplied(true);
                    setTimeout(() => setEvSyncApplied(false), 3000);
                  }
                }}
                disabled={!selectedStation || evLoading}
                className={cn(
                  "w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50",
                  evSyncApplied ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                )}
              >
                {evSyncApplied ? (
                  <>
                    <Check className="w-4 h-4 text-white font-bold animate-pulse" />
                    HUD STATION CHARGER ARMED
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    {selectedStation ? `ROUTE TO ${selectedStation.name.toUpperCase()}` : 'SELECT CHARGER FROM LIST'}
                  </>
                )}
              </button>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination Predictive Parking Side Drawer */}
      <AnimatePresence>
        {showParkingFinder && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute left-4 right-4 top-40 bottom-24 z-30 flex w-auto flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-5 font-sans text-white shadow-2xl backdrop-blur-md md:right-auto md:w-[420px]"
          >
            {/* Top Border Glow */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block font-sans">MB Sense Intelligent Telemetry</span>
                <h3 className="text-base font-extrabold flex items-center gap-1.5 mt-0.5 font-sans">
                  <Clock className="w-4.5 h-4.5 text-indigo-400" /> Space Predictive Parking
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchParkingPredictions}
                  disabled={parkingLoading}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white disabled:opacity-50"
                  title="Refresh Live availability"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", parkingLoading && "animate-spin")} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowParkingFinder(false);
                    setShowETA(true);
                  }}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated Query controls */}
            <div className="bg-slate-905/60 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-3">
              {/* Day selection badges */}
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] font-sans">Scheduled Day</span>
                <div className="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
                  {['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setParkingDayOfWeek(d)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-all shrink-0 uppercase tracking-wider border",
                        parkingDayOfWeek === d
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg"
                          : "bg-slate-900 border-white/5 text-slate-400 hover:text-white hover:bg-slate-850"
                      )}
                    >
                      {d.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hour Selection badges */}
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] font-sans">Simulated Arrival Hour</span>
                <div className="grid grid-cols-4 gap-1">
                  {[10, 12, 14, 16, 18, 20, 22].map((h) => (
                    <button
                      key={h}
                      onClick={() => setParkingArrivalHour(h)}
                      className={cn(
                        "py-1 rounded-lg text-[10px] font-mono font-bold transition-all border",
                        parkingArrivalHour === h
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                      )}
                    >
                      {h}:00
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gemini Live Recommendation */}
            <div className="bg-slate-900 border border-white/15 p-3.5 rounded-2xl relative overflow-hidden flex flex-col gap-2 min-h-[92px] justify-center">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
              
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 font-sans">
                ⭐ CO-PILOT ADVISOR IN COOPERATION WITH MERCI VALET
              </span>
              
              {parkingLoading ? (
                <div className="flex items-center gap-2 py-1 text-slate-450 text-xs">
                  <div className="w-3.5 h-3.5 rounded-full border border-indigo-400 border-t-transparent animate-spin shrink-0" />
                  <span>Synthesizing smart parking telemetry...</span>
                </div>
              ) : parkingRecommendation ? (
                <p className="text-[10.5px] text-slate-350 leading-relaxed font-sans italic">
                  "{parkingRecommendation}"
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 font-sans">Synchronizing telemetry parameters...</p>
              )}
            </div>

            {/* Selected Lot Trends / Recharts dual bar chart comparison */}
            {selectedParkingLot && (
              <div className="bg-slate-900/45 border border-white/5 p-3 rounded-2xl flex flex-col gap-1.5 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[200px]">
                    📊 occupancy trends: {selectedParkingLot.name}
                  </span>
                  <span className="text-[8.5px] text-indigo-400 font-bold font-mono">
                    Today vs Historical Benchmark
                  </span>
                </div>
                <div className="h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedParkingLot.hourlyTrend} margin={{ top: 2, right: 2, left: -28, bottom: 2 }}>
                      <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 8 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 8 }} domain={[0, 100]} />
                      <Bar dataKey="historical" fill="#475569" radius={[1, 1, 0, 0]} name="Bench" opacity={0.6} />
                      <Bar dataKey="predictedToday" fill="#6366f1" radius={[1, 1, 0, 0]} name="Today" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* List of Parking Lots near Destination */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1">
                <span>Destination lots ({parkingLots.length})</span>
                <span>Proximity / Vacancy Intel</span>
              </div>

              {parkingLoading && parkingLots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
                  <div className="w-5 h-5 rounded-full border border-indigo-500 border-t-transparent animate-spin" />
                  <span className="text-[11px] uppercase tracking-wider">Downloading parking indices...</span>
                </div>
              ) : parkingLots.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/30 rounded-2xl border border-white/5">
                  <span className="text-xs text-slate-500">No predictions matching telemetry indices.</span>
                </div>
              ) : (
                parkingLots.map((lot) => (
                  <div
                    key={lot.id}
                    onClick={() => setSelectedParkingLot(lot)}
                    className={cn(
                      "w-full text-left bg-slate-900/40 hover:bg-slate-900/90 border rounded-2xl p-3 flex flex-col gap-1.5 transition-all cursor-pointer",
                      selectedParkingLot?.id === lot.id 
                        ? "border-indigo-500/60 bg-slate-900/100 shadow-[0_0_15px_rgba(99,102,241,0.15)]" 
                        : "border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-extrabold text-slate-100 flex items-center gap-1">
                          {lot.hasValet && <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded-md font-black text-[8px] uppercase tracking-wider shrink-0 scale-90">Valet VIP</span>}
                          {lot.name}
                        </span>
                        <span className="text-[9.5px] text-slate-400 font-semibold">{lot.address}</span>
                      </div>
                      
                      <div className="text-right flex flex-col items-end shrink-0">
                        <span className="text-[11px] text-indigo-400 font-black font-mono">{lot.distanceKm} km</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider mt-1 text-center scale-90 origin-right border",
                          lot.currentPredictedOccupancy > 80 
                            ? "bg-red-500/15 text-red-400 border-red-500/20" 
                            : lot.currentPredictedOccupancy > 55 
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/20" 
                              : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                        )}>
                          {lot.currentPredictedOccupancy}% Occupied
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-white/5 text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-emerald-455 font-extrabold">{lot.freeSpacesPredicted} Spaces Available</span>
                      </span>
                      <span className="text-[10.5px] font-black text-slate-200">
                        ${lot.pricePerHour.toFixed(2)}/hr
                      </span>
                    </div>

                    {/* Rich Details if clicked */}
                    {selectedParkingLot?.id === lot.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-2 mt-1 border-t border-white/5 text-[10px] text-slate-350 flex flex-col gap-1.5 font-sans"
                      >
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {lot.features.map((feat: string, idx: number) => (
                            <span key={idx} className="bg-slate-900 border border-white/10 text-slate-300 rounded px-1.5 py-0.5 text-[8.5px] font-bold">
                              {feat}
                            </span>
                          ))}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
                          <span>Historical average at this hour:</span>
                          <span className="font-mono text-slate-300 font-bold">{lot.currentHistoricalOccupancy}% occupancy</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Sync active selected parking valet routing to the dashboard display */}
            <div className="pt-2 border-t border-white/5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (selectedParkingLot) {
                    addRecentAction({
                      icon: 'sync',
                      title: 'EQ Commute Parking Reserved',
                      description: `Routed MB AR HUD to ${selectedParkingLot.name} with ${selectedParkingLot.freeSpacesPredicted} predicted vacant spaces and active valet clearance.`,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                    setParkingSyncApplied(true);
                    setTimeout(() => setParkingSyncApplied(false), 3000);
                  }
                }}
                disabled={!selectedParkingLot || parkingLoading}
                className={cn(
                  "w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50",
                  parkingSyncApplied ? "bg-emerald-600 text-white animate-pulse" : "bg-indigo-650 hover:bg-indigo-600 text-white hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                )}
              >
                {parkingSyncApplied ? (
                  <>
                    <Check className="w-4 h-4 text-white font-bold animate-pulse" />
                    VALET CLEARED & ROUTED HUD
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4 text-white" />
                    {selectedParkingLot ? `ROUTE TO ${selectedParkingLot.name.toUpperCase()}` : 'SELECT DESTINATION CAR PARK'}
                  </>
                )}
              </button>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Route Planner Side Drawer */}
      <AnimatePresence>
        {showRoutePlanner && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute left-4 right-4 top-40 bottom-24 z-30 flex w-auto flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-5 font-sans text-white shadow-2xl backdrop-blur-md md:right-auto md:w-[420px]"
          >
            {/* Top Border Glow */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Gemini-Sequenced Multi-Stop Engine</span>
                <h3 className="text-base font-extrabold flex items-center gap-1.5 mt-0.5">
                  <Route className="w-4.5 h-4.5 text-indigo-400 animate-pulse" /> AI Route Planner
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRoutePlanner(false);
                  setShowETA(true);
                }}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick-add presets */}
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Click to Quick-Add scenic waypoints</span>
              <div className="flex flex-wrap gap-1">
                {PRESET_WAYPOINTS.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() => handleAddPresetWaypoint(preset)}
                    className="bg-slate-900 border border-white/5 hover:border-indigo-500/30 text-slate-300 hover:text-white rounded-xl px-2.5 py-1 text-[9.5px] font-bold transition-all text-left"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Custom Coordinate stop input */}
            <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl flex flex-col gap-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Configure custom coordinate waypoint</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Stop label name (e.g. Presidio)"
                  value={plannerNewName}
                  onChange={(e) => setPlannerNewName(e.target.value)}
                  className="col-span-2 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 font-bold uppercase pl-1">Latitude</span>
                  <input
                    type="text"
                    value={plannerNewLat}
                    onChange={(e) => setPlannerNewLat(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 font-bold uppercase pl-1">Longitude</span>
                  <input
                    type="text"
                    value={plannerNewLng}
                    onChange={(e) => setPlannerNewLng(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddCustomWaypoint}
                className="w-full bg-slate-800 hover:bg-slate-750 border border-white/5 hover:border-indigo-500/30 text-white rounded-xl py-1.5 text-[10.5px] font-bold transition-all tracking-wide uppercase"
              >
                Insert custom Stop Label
              </button>
            </div>

            {/* Config Vehicle Fleet */}
            <div className="flex justify-between items-center bg-slate-900/40 border border-white/5 p-2.5 rounded-2xl shrink-0">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Simulated Powertrain</span>
                <span className="text-[10px] text-slate-500">Estimates fuel or battery discharge</span>
              </div>
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
                {(['electric', 'gasoline'] as const).map((vt) => (
                  <button
                    type="button"
                    key={vt}
                    onClick={() => setPlannerVehicleType(vt)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                      plannerVehicleType === vt
                        ? "bg-indigo-600 text-white shadow shadow-indigo-500/50"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {vt === 'electric' ? '⚡ Electric' : '⛽ Gas'}
                  </button>
                ))}
              </div>
            </div>

            {/* List of stops in Route Planner */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1">
                <span>Waypoint List ({plannerWaypoints.length})</span>
                <span className="text-[9px] text-[#4edea3] font-bold">Locked Stop 1 is starting point</span>
              </div>

              {plannerWaypoints.map((wp, idx) => (
                <div
                  key={wp.id}
                  className="bg-slate-900/40 border border-white/5 rounded-2xl p-2.5 flex items-center justify-between gap-2 hover:border-indigo-500/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                    <span className="w-5.5 h-5.5 rounded-full bg-slate-950 border border-white/20 text-indigo-400 text-[10.5px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-slate-150 truncate">{wp.name}</span>
                      <span className="text-[8.5px] font-mono text-slate-500">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Move Up button */}
                    <button
                      type="button"
                      disabled={idx <= 1} // Lock index 0 AND index 1 can't displace 0
                      onClick={() => handleMoveWaypoint(idx, 'up')}
                      className="w-6 h-6 rounded bg-slate-950 border border-white/5 hover:bg-slate-800 disabled:opacity-25 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    {/* Move Down button */}
                    <button
                      type="button"
                      disabled={idx === 0 || idx === plannerWaypoints.length - 1} // Lock index 0 from moving
                      onClick={() => handleMoveWaypoint(idx, 'down')}
                      className="w-6 h-6 rounded bg-slate-950 border border-white/5 hover:bg-slate-800 disabled:opacity-25 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {/* Remove stop button */}
                    <button
                      type="button"
                      disabled={idx === 0} // Lock starter destination
                      onClick={() => handleRemoveWaypoint(wp.id)}
                      className="w-6 h-6 rounded bg-slate-950 border border-white/5 hover:bg-rose-950/45 disabled:opacity-25 text-slate-400 hover:text-rose-405 flex items-center justify-center transition-colors"
                      title="Delete Waypoint"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* LLM Routing Appraisal / Statistics HUD */}
            {plannerResult && (
              <div className="bg-slate-900 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2 shrink-0 max-h-[145px] overflow-y-auto custom-scrollbar">
                <span className="text-[8.5px] font-black text-indigo-400 uppercase tracking-widest block">
                  🧠 AI Route Analysis Narrative
                </span>
                
                {/* Visual statistics badge */}
                <div className="grid grid-cols-2 gap-2 py-1.5 border-t border-b border-white/5 text-[9.5px]">
                  <div className="flex flex-col">
                    <span className="text-slate-500 uppercase tracking-wider text-[8px] font-extrabold leading-none">Est Distance</span>
                    <span className="text-white font-extrabold font-mono mt-1 text-[11px] h-3.5 flex items-center">{plannerResult.totalDistance ? plannerResult.totalDistance : `${plannerWaypoints.length * 4.5} km`}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-2">
                    <span className="text-slate-500 uppercase tracking-wider text-[8px] font-extrabold leading-none">Energy Spent</span>
                    <span className="text-indigo-305 font-extrabold font-mono mt-1 text-[11px] h-3.5 flex items-center">
                      {plannerResult.totalEnergyUsed ? plannerResult.totalEnergyUsed : (plannerVehicleType === 'electric' ? `${Math.round(plannerWaypoints.length * 1.45)} kWh` : `${Math.round(plannerWaypoints.length * 0.12 * 10) / 10} gal`)}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-indigo-200 leading-relaxed italic font-sans animate-fade-in">
                  "{plannerResult.aiExplanation ? plannerResult.aiExplanation : `Optimized sequence of ${plannerWaypoints.length} waypoints via nearest-neighbor indexing. Selected route maintains minimal lateral displacements across high-speed grids, resulting in optimal battery thermals.`}"
                </p>
              </div>
            )}

            {/* Calculate / Sync footer buttons */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={calculateAIPlan}
                disabled={plannerLoading || plannerWaypoints.length < 2}
                className={cn(
                  "w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50",
                  plannerLoading ? "bg-amber-650 text-white font-black animate-pulse" : "bg-indigo-605 hover:bg-indigo-600 text-white"
                )}
              >
                {plannerLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    Calculating Scenic Sequencing...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-4 h-4 text-white" />
                    Solve Sequence with AI
                  </>
                )}
              </button>

              {plannerResult && (
                <button
                  type="button"
                  onClick={() => {
                    addRecentAction({
                      icon: 'sync',
                      title: 'Tour Schedule Synced',
                      description: `Pushed Scenic optimized waypoints (${plannerWaypoints.length} stops) to cockpit`,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                    setPlannerSyncApplied(true);
                    setTimeout(() => setPlannerSyncApplied(false), 3000);
                  }}
                  className={cn(
                    "w-full h-10 rounded-xl text-[10.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-white/10",
                    plannerSyncApplied ? "bg-emerald-600 border-emerald-500 text-white" : "bg-transparent hover:border-white/20 text-indigo-400 hover:text-indigo-300"
                  )}
                >
                  {plannerSyncApplied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white animate-bounce" />
                      COCKPIT WAYPOINTS TRANSFERRED
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5" />
                      Sync Waypoint Tour to EQ HUD
                    </>
                  )}
                </button>
              )}
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Interface */}
      <AnimatePresence>
        {optimizedRoute ? (
          /* Multi-stop Timeline Detail Screen */
          <motion.div
            initial={{ y: 250, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 250, opacity: 0 }}
            className="absolute bottom-24 left-4 right-4 z-20 md:left-1/2 md:right-auto md:w-[500px] md:-translate-x-1/2"
          >
            <div className="bg-slate-950/95 border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md flex flex-col gap-4">
              
              {/* Premium Mercedes-Benz aesthetic progress indicators */}
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
              <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4.5 h-4.5 text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">GEMINI COMMUTE INTELLIGENCE</span>
                  </div>
                  <h2 className="text-lg font-extrabold text-white mt-1">Optimal Commuting Path</h2>
                </div>
                <div className="bg-emerald-500/15 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] text-emerald-400 font-extrabold tracking-wider">
                  SAVINGS: ~24 MINS
                </div>
              </div>

              {/* Explanatory insights */}
              <p className="text-xs text-slate-400 leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/5">
                {optimizedRoute.explanation}
              </p>

              {/* Optimized Stops Route Timeline list container */}
              <div className="max-h-[220px] overflow-y-auto space-y-3 pr-1 py-1 custom-scrollbar">
                {optimizedRoute.stops.map((stop, index) => (
                  <div key={stop.id} className="relative flex gap-3 pl-2.5">
                    
                    {/* Vertical timeline connector */}
                    {index < optimizedRoute.stops.length - 1 && (
                      <div className="absolute left-[21px] top-6 bottom-[-22px] w-[2px] bg-slate-800" />
                    )}

                    <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0 mt-1">
                      {index + 1}
                    </div>

                    <div className="flex-1 bg-slate-900/60 border border-white/5 p-3 rounded-2xl flex flex-col gap-1 hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-slate-100">{stop.title}</h4>
                        <span className="text-xs text-blue-400 font-bold">{stop.optimizedTime}</span>
                      </div>
                      
                      <div className="flex items-center gap-3.5 text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 shrink-0" /> {stop.locationName}</span>
                        <span className="flex items-center gap-1 text-slate-500"><Clock className="w-3.5 h-3.5 shrink-0" /> Drive: {stop.travelDuration}</span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] gap-2">
                        <span className="text-slate-400 font-semibold bg-slate-950 px-2 py-0.5 rounded-md border border-white/5">
                          Depart: {stop.suggestedDeparture}
                        </span>
                        <span className="text-emerald-400 text-right leading-snug font-medium italic">
                          {stop.insight}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-1 pt-1.5 border-t border-white/5">
                <button 
                  onClick={handleSyncToCar}
                  className={cn(
                    "flex-1 py-3.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2",
                    syncApplied 
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                      : "bg-white hover:bg-slate-200 text-slate-950"
                  )}
                >
                  {syncApplied ? (
                    <>
                      <Check className="w-4.5 h-4.5 text-white" />
                      COCKPIT SYNCED
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4.5 h-4.5" />
                      SYNC MB COCKPIT
                    </>
                  )}
                </button>
                <button 
                  onClick={() => {
                    setOptimizedRoute(null);
                    setShowETA(true);
                  }}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center"
                  title="Close Optimized View"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

            </div>
          </motion.div>
        ) : (
          /* Default origin-to-destination ETA overlay */
          showETA && (
            <motion.div 
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="absolute bottom-24 left-4 right-4 z-20 md:left-1/2 md:right-auto md:w-[480px] md:-translate-x-1/2"
            >
              <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 relative overflow-hidden">
                 {/* Glow effect */}
                 <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
                 <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Destination</span>
                    <h2 className="text-2xl font-bold text-blue-400">Office — 12 min</h2>
                  </div>
                  <div className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                    <span className="text-[10px] font-bold text-emerald-400 tracking-wider">LIVE TRAFFIC</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-medium">Suggested Departure</span>
                    <div className="flex items-center gap-2 text-blue-400">
                      <span className="font-semibold">8:45 AM</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-medium">Traffic Status</span>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <span className="font-semibold uppercase tracking-wider text-sm">Light</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-1">
                  <button className="flex-1 bg-white hover:bg-slate-200 text-slate-950 py-3.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors">
                    Start Navigation
                  </button>
                  <button onClick={handleOptimizeRoutes} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-blue-400" />
                    AI Optimize
                  </button>
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

    </div>
  );
}
