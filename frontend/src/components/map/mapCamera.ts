import {
  defaultMockView,
  destinationPreviewMockView,
  navigationMockView,
  routeOverviewZoom,
} from '../../constants/mapDemoData';
import type { CameraMode, MockMapView } from '../../types/mapModes';

type UnitPoint = {
  x: number;
  y: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type MockFocusViewOptions = {
  point: UnitPoint;
  target?: UnitPoint;
  viewport?: ViewportSize;
  zoom: number;
};

const mockMapInsetRatio = 0.18;

export function clampMockView(next: MockMapView): MockMapView {
  return {
    x: Math.max(-720, Math.min(720, next.x)),
    y: Math.max(-1250, Math.min(1250, next.y)),
    zoom: Math.max(0.78, Math.min(2.35, next.zoom)),
  };
}

export function getMockCameraView(cameraMode: CameraMode): MockMapView {
  if (cameraMode === 'destinationPreview') return destinationPreviewMockView;
  if (cameraMode === 'navigationFollow') return navigationMockView;
  return defaultMockView;
}

export function mockScaleToCameraZoom(scale: number): number {
  return Number(Math.max(7, Math.min(18, scale * routeOverviewZoom)).toFixed(1));
}

export function createMockFocusView({
  point,
  target = { x: 0.5, y: 0.5 },
  viewport = getViewportSize(),
  zoom,
}: MockFocusViewOptions): MockMapView {
  const layerWidth = viewport.width * (1 + mockMapInsetRatio * 2);
  const layerHeight = viewport.height * (1 + mockMapInsetRatio * 2);
  const layerLeft = -viewport.width * mockMapInsetRatio;
  const layerTop = -viewport.height * mockMapInsetRatio;

  return clampMockView({
    x: viewport.width * target.x - layerLeft - layerWidth * point.x * zoom,
    y: viewport.height * target.y - layerTop - layerHeight * point.y * zoom,
    zoom,
  });
}

function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
