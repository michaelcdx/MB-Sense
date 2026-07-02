import type { Coordinates, MockMapView } from '../types/mapModes';

export const vehiclePosition: Coordinates = { lat: 37.777, lng: -122.41 };
export const destinationPosition: Coordinates = { lat: 37.422, lng: -122.0841 };
export const mapCenter: Coordinates = { lat: 37.596, lng: -122.251 };

export const defaultMockView: MockMapView = { x: 0, y: 0, zoom: 1 };
export const destinationPreviewMockView: MockMapView = { x: -285, y: -600, zoom: 1.58 };
export const navigationMockView: MockMapView = { x: 260, y: 900, zoom: 1.85 };

export const routeOverviewZoom = 10;
export const destinationPreviewZoom = 14;
export const navigationZoom = 16;
export const pinchRefocusDelayMs = 1800;
export const destinationPreviewDelayMs = 1300;

export const mockRoutePath: Coordinates[] = [
  vehiclePosition,
  { lat: 37.731, lng: -122.392 },
  { lat: 37.643, lng: -122.398 },
  { lat: 37.528, lng: -122.301 },
  destinationPosition,
];

export const alternativeRoutePath: Coordinates[] = [
  vehiclePosition,
  { lat: 37.756, lng: -122.338 },
  { lat: 37.688, lng: -122.286 },
  { lat: 37.56, lng: -122.217 },
  destinationPosition,
];

export const mockRouteSummary = {
  destination: 'Mercedes-Benz Research Office',
  subtitle: 'Sunnyvale Innovation Campus - 27.4 mi',
  departAt: '8:45 AM',
  eta: '24 min',
  traffic: 'Light',
  saved: '3 min',
  distance: '27.4 mi',
};

export const mockAiRoute = {
  insight: 'Saves 3 minutes by avoiding heavier traffic near the city center.',
  recommended: {
    name: 'Recommended',
    detail: 'US-101 express segment',
    eta: '24 min',
  },
  alternative: {
    name: 'Alternative',
    detail: 'Fewer freeway merges',
    eta: '31 min',
  },
};

export const mockParking = {
  nearbySpaces: 18,
  recommended: {
    name: 'Innovation Garage A',
    spaces: 18,
    walkTime: '2 min walk',
    price: '$1.20/hr',
  },
  options: [
    { name: 'Campus Lot B', spaces: 12, walkTime: '4 min walk', price: '$0.80/hr' },
    { name: 'Visitor Parking C', spaces: 8, walkTime: '5 min walk', price: 'Free' },
    { name: 'Street Parking', spaces: 'Limited', walkTime: '6 min walk', price: 'Metered' },
  ],
  prediction: 'Parking demand is expected to increase in the next 20 minutes.',
};

export const parkingOptions = [
  {
    id: 'garage-a',
    name: mockParking.recommended.name,
    label: `${mockParking.recommended.spaces} open`,
    walk: mockParking.recommended.walkTime,
    spaces: `${mockParking.recommended.spaces} spaces`,
    price: mockParking.recommended.price,
    position: { lat: 37.425, lng: -122.087 },
    recommended: true,
  },
  ...mockParking.options.map((spot, index) => ({
    id: ['lot-b', 'visitor-c', 'street'][index],
    name: spot.name,
    label: typeof spot.spaces === 'number' ? `${spot.spaces} open` : spot.spaces,
    walk: spot.walkTime,
    spaces: typeof spot.spaces === 'number' ? `${spot.spaces} spaces` : spot.spaces,
    price: spot.price,
    position: [
      { lat: 37.418, lng: -122.095 },
      { lat: 37.428, lng: -122.078 },
      { lat: 37.414, lng: -122.083 },
    ][index],
    recommended: false,
  })),
];

export const mockEvStations = {
  stationCount: 4,
  recommended: {
    name: 'Mercedes Partner Charger',
    openChargers: 1,
    speed: '250 kW',
    detour: '11 min detour',
  },
  batteryOnArrival: '62%',
  note: 'Charging not required, but available along route.',
  stations: [
    { name: 'ChargePoint Sunnyvale', open: 4, speed: '150 kW', detour: '6 min detour' },
    { name: 'EVgo Campus Hub', open: 2, speed: '100 kW', detour: '9 min detour' },
    { name: 'Mercedes Partner Charger', open: 1, speed: '250 kW', detour: '11 min detour' },
  ],
};

export const evStations = [
  {
    id: 'mb-partner',
    name: mockEvStations.recommended.name,
    label: mockEvStations.recommended.speed,
    availability: `${mockEvStations.recommended.openChargers} open charger`,
    speed: mockEvStations.recommended.speed,
    detour: mockEvStations.recommended.detour,
    position: { lat: 37.617, lng: -122.352 },
    recommended: true,
  },
  ...mockEvStations.stations
    .filter((station) => station.name !== mockEvStations.recommended.name)
    .map((station, index) => ({
      id: ['chargepoint-sunnyvale', 'evgo-campus'][index],
      name: station.name,
      label: `${station.open} open`,
      availability: `${station.open} open`,
      speed: station.speed,
      detour: station.detour,
      position: [
        { lat: 37.506, lng: -122.254 },
        { lat: 37.696, lng: -122.395 },
      ][index],
      recommended: false,
    })),
];

export const mockCost = {
  totalCost: '$12.80',
  energyFuel: '$8.40',
  tolls: '$2.20',
  parkingEstimate: '$2.20',
  consumption: '5.8 kWh',
  costPerMile: '$0.47/mi',
  ecoRoute: {
    savings: '$1.10',
    extraTime: '7 min',
  },
};

export const costMarkers = [
  {
    id: 'energy',
    label: mockCost.energyFuel,
    detail: 'Energy/Fuel',
    position: { lat: 37.666, lng: -122.383 },
  },
  {
    id: 'toll',
    label: mockCost.tolls,
    detail: 'Toll',
    position: { lat: 37.594, lng: -122.322 },
  },
  {
    id: 'parking-cost',
    label: mockCost.parkingEstimate,
    detail: 'Parking',
    position: { lat: 37.43, lng: -122.1 },
  },
];
