export type MapMode = 'aiRoute' | 'parking' | 'evStations' | 'cost';

export type SheetState = 'collapsed' | 'expanded';

export type CameraMode = 'destinationPreview' | 'routeOverview' | 'navigationFollow' | 'manualExplore';

export type MapTone = 'blue' | 'emerald' | 'cyan' | 'amber' | 'slate';

export type Coordinates = {
  lat: number;
  lng: number;
};

export type MockMapView = {
  x: number;
  y: number;
  zoom: number;
};

export interface MapCameraState {
  cameraMode: CameraMode;
  activeNavigation: boolean;
  followCar: boolean;
  userInteractingWithMap: boolean;
  currentZoom: number;
}
