export type KnownDrivingRoute = {
  fromAliases: readonly string[];
  toAliases: readonly string[];
  distanceKm: number;
  distanceMeters: number;
  durationMinutesNoTraffic: number;
  source: string;
  checkedOn: string;
  note: string;
};

export type RouteDistanceSource = 'known-real-world' | 'coordinate-estimated' | 'heuristic-estimated';

export type Coordinates = {
  lat: number;
  lng: number;
};

export type EstimatedDrivingRoute = {
  distanceKm: number;
  distanceMeters: number;
  durationMinutesNoTraffic: number;
  source: RouteDistanceSource;
};

export const knownCalendarLocations = {
  homeGarage: {
    label: "Home Garage, Damansara Heights",
    aliases: [
      "Home Garage, Damansara Heights",
      "Home Wallbox, Damansara Heights",
      "Damansara Heights",
      "Home"
    ],
    lat: 3.1507,
    lng: 101.6617,
    resolvedAddress: "Damansara Heights, Kuala Lumpur, Malaysia"
  },
  mercedesMalaysiaHq: {
    label: "Mercedes-Benz Malaysia HQ, Puchong",
    aliases: [
      "Mercedes-Benz Malaysia HQ, Puchong",
      "Mercedes-Benz Malaysia HQ",
      "Mercedes-Benz Tech Malaysia",
      "Puchong HQ"
    ],
    lat: 3.0323,
    lng: 101.6176,
    resolvedAddress: "Puchong, Selangor, Malaysia"
  },
  mandarinOrientalKlcc: {
    label: "Mandarin Oriental, KLCC",
    aliases: [
      "Mandarin Oriental, KLCC",
      "Mandarin Oriental Kuala Lumpur",
      "KLCC",
      "Suria KLCC",
      "Kuala Lumpur City Centre"
    ],
    lat: 3.1565,
    lng: 101.7132,
    resolvedAddress: "Kuala Lumpur City Centre, Kuala Lumpur, Malaysia"
  },
  trxExchange: {
    label: "TRX Executive Tower",
    aliases: [
      "TRX Executive Tower",
      "The Exchange TRX",
      "Tun Razak Exchange",
      "Exchange 106",
      "TRX"
    ],
    lat: 3.1427,
    lng: 101.718,
    resolvedAddress: "Tun Razak Exchange, Kuala Lumpur, Malaysia"
  },
  bangsarSouth: {
    label: "Bangsar South Client Office",
    aliases: [
      "Bangsar South Client Office",
      "Bangsar South",
      "Bangsar"
    ],
    lat: 3.1117,
    lng: 101.6656,
    resolvedAddress: "Bangsar South, Kuala Lumpur, Malaysia"
  },
  cyberjayaInnovationCampus: {
    label: "Cyberjaya Innovation Campus",
    aliases: [
      "Cyberjaya Innovation Campus",
      "Cyberjaya"
    ],
    lat: 2.9226,
    lng: 101.6559,
    resolvedAddress: "Cyberjaya, Selangor, Malaysia"
  },
  shahAlamLogisticsHub: {
    label: "Shah Alam Logistics Hub",
    aliases: [
      "Shah Alam Logistics Hub",
      "Shah Alam"
    ],
    lat: 3.0738,
    lng: 101.5183,
    resolvedAddress: "Shah Alam, Selangor, Malaysia"
  },
  putrajayaPrecinct: {
    label: "Putrajaya Government Precinct",
    aliases: [
      "Putrajaya Government Precinct",
      "Putrajaya"
    ],
    lat: 2.9264,
    lng: 101.6964,
    resolvedAddress: "Putrajaya, Malaysia"
  },
  montKiara: {
    label: "Mont Kiara Private Dining",
    aliases: [
      "Mont Kiara Private Dining",
      "Mont Kiara"
    ],
    lat: 3.1677,
    lng: 101.6527,
    resolvedAddress: "Mont Kiara, Kuala Lumpur, Malaysia"
  },
  kliaTerminal1: {
    label: "KLIA Terminal 1",
    aliases: [
      "KLIA Terminal 1",
      "KLIA",
      "Kuala Lumpur International Airport"
    ],
    lat: 2.7456,
    lng: 101.7072,
    resolvedAddress: "Kuala Lumpur International Airport, Sepang, Selangor, Malaysia"
  },
  royalLakeClub: {
    label: "Royal Lake Club",
    aliases: [
      "Royal Lake Club",
      "Royal Lake Club, Kuala Lumpur",
      "Royal Lake Club, Jalan Cenderamulia, Kuala Lumpur"
    ],
    lat: 3.1473242,
    lng: 101.6834033,
    resolvedAddress: "Royal Lake Club, Jalan Cenderamulia, Bangsar, Kuala Lumpur, 50646, Malaysia"
  },
  mercedesPetalingJayaService: {
    label: "Dealer Service Center, Petaling Jaya",
    aliases: [
      "Dealer Service Center, Petaling Jaya",
      "Dealer Service Centre, Petaling Jaya",
      "Mercedes-Benz, Petaling Jaya",
      "Mercedes-Benz, Jalan SS 9A/14, Seksyen 51A, Sungai Way, Petaling Jaya"
    ],
    lat: 3.0871382,
    lng: 101.6250941,
    resolvedAddress: "Mercedes-Benz, Jalan SS 9A/14, Seksyen 51A, Sungai Way, Petaling Jaya, Selangor, 46150, Malaysia"
  },
  mcdonaldsKlcc: {
    label: "McDonald's Suria KLCC",
    aliases: [
      "McDonald's Suria KLCC",
      "McDonalds Suria KLCC",
      "McDonald KLCC",
      "McD KLCC"
    ],
    lat: 3.158,
    lng: 101.7122,
    resolvedAddress: "Suria KLCC, Kuala Lumpur City Centre, Kuala Lumpur, Malaysia"
  },
  mcdonaldsBukitBintang: {
    label: "McDonald's Bukit Bintang",
    aliases: [
      "McDonald's Bukit Bintang",
      "McDonalds Bukit Bintang",
      "McDonald Bukit Bintang",
      "McD Bukit Bintang"
    ],
    lat: 3.1467,
    lng: 101.7112,
    resolvedAddress: "Bukit Bintang, Kuala Lumpur, Malaysia"
  },
  mcdonaldsBangsar: {
    label: "McDonald's Bangsar",
    aliases: [
      "McDonald's Bangsar",
      "McDonalds Bangsar",
      "McDonald Bangsar",
      "McD Bangsar"
    ],
    lat: 3.1308,
    lng: 101.6709,
    resolvedAddress: "Bangsar Baru, Kuala Lumpur, Malaysia"
  },
  mcdonaldsSs2: {
    label: "McDonald's SS2 Petaling Jaya",
    aliases: [
      "McDonald's SS2 Petaling Jaya",
      "McDonalds SS2 Petaling Jaya",
      "McDonald SS2",
      "McD SS2",
      "SS2 Petaling Jaya"
    ],
    lat: 3.1188,
    lng: 101.6233,
    resolvedAddress: "SS2, Petaling Jaya, Selangor, Malaysia"
  }
} as const;

export const knownDrivingRoutes: KnownDrivingRoute[] = [
  {
    fromAliases: knownCalendarLocations.royalLakeClub.aliases,
    toAliases: knownCalendarLocations.mercedesPetalingJayaService.aliases,
    distanceKm: 13.4,
    distanceMeters: 13372,
    durationMinutesNoTraffic: 17,
    source: "OpenStreetMap Nominatim geocoding + OSRM driving route",
    checkedOn: "2026-07-03",
    note: "The generic calendar destination was resolved to the Mercedes-Benz location on Jalan SS 9A/14 in Seksyen 51A, Sungai Way, Petaling Jaya."
  }
];

function normalizeLocation(location: string) {
  return location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesLocationAlias(location: string, aliases: readonly string[]) {
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) return false;

  return aliases.some((alias) => {
    const normalizedAlias = normalizeLocation(alias);
    return normalizedLocation === normalizedAlias || normalizedLocation.includes(normalizedAlias) || normalizedAlias.includes(normalizedLocation);
  });
}

function parseCoordinateLocation(location: string): Coordinates | undefined {
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;

  return { lat, lng };
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getGreatCircleDistanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function estimateRoadDistanceKm(from: Coordinates, to: Coordinates) {
  const directDistanceKm = getGreatCircleDistanceKm(from, to);
  if (directDistanceKm < 0.4) return 0;

  const roadFactor = directDistanceKm > 45 ? 1.22 : directDistanceKm > 15 ? 1.3 : 1.38;
  return roundToSingleDecimal(directDistanceKm * roadFactor);
}

function estimateNoTrafficDurationMinutes(distanceKm: number) {
  if (distanceKm <= 0) return 0;

  const averageSpeedKmh = distanceKm > 65 ? 72 : distanceKm > 30 ? 56 : distanceKm > 12 ? 42 : 30;
  return Math.max(5, Math.round(distanceKm / averageSpeedKmh * 60));
}

export function resolveLocationCoordinates(location: string): Coordinates | undefined {
  const coordinateLocation = parseCoordinateLocation(location);
  if (coordinateLocation) return coordinateLocation;

  return Object.values(knownCalendarLocations).find((knownLocation) => matchesLocationAlias(location, knownLocation.aliases));
}

export function findKnownDrivingRoute(fromLocation: string, toLocation: string) {
  return knownDrivingRoutes.find((route) => (
    matchesLocationAlias(fromLocation, route.fromAliases) && matchesLocationAlias(toLocation, route.toAliases)
  ) || (
    matchesLocationAlias(fromLocation, route.toAliases) && matchesLocationAlias(toLocation, route.fromAliases)
  ));
}

export function estimateDrivingRoute(fromLocation: string, toLocation: string): EstimatedDrivingRoute | undefined {
  const knownRoute = findKnownDrivingRoute(fromLocation, toLocation);
  if (knownRoute) {
    return {
      distanceKm: knownRoute.distanceKm,
      distanceMeters: knownRoute.distanceMeters,
      durationMinutesNoTraffic: knownRoute.durationMinutesNoTraffic,
      source: 'known-real-world'
    };
  }

  const fromCoordinates = resolveLocationCoordinates(fromLocation);
  const toCoordinates = resolveLocationCoordinates(toLocation);
  if (!fromCoordinates || !toCoordinates) return undefined;

  const distanceKm = estimateRoadDistanceKm(fromCoordinates, toCoordinates);
  return {
    distanceKm,
    distanceMeters: Math.round(distanceKm * 1000),
    durationMinutesNoTraffic: estimateNoTrafficDurationMinutes(distanceKm),
    source: 'coordinate-estimated'
  };
}
