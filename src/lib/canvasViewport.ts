export type CanvasViewportBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type CanvasViewportState = {
  pan: { x: number; y: number };
  zoom: number;
};

export type CanvasScreenPoint = {
  x: number;
  y: number;
};

const MIN_VIEWPORT_ZOOM = 0.2;
const MAX_VIEWPORT_ZOOM = 1.5;
const MIN_INTERACTIVE_ZOOM = 0.15;
const MAX_INTERACTIVE_ZOOM = 3;

export function fitViewportToBounds(
  surface: { width: number; height: number },
  bounds: CanvasViewportBounds,
  padding: number
): CanvasViewportState {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scaleX = (surface.width - padding * 2) / width;
  const scaleY = (surface.height - padding * 2) / height;
  const zoom = Math.max(MIN_VIEWPORT_ZOOM, Math.min(MAX_VIEWPORT_ZOOM, Math.min(scaleX, scaleY)));

  return {
    zoom,
    pan: {
      x: surface.width / 2 - (bounds.minX + width / 2) * zoom,
      y: surface.height / 2 - (bounds.minY + height / 2) * zoom,
    },
  };
}

export function zoomViewportAroundPoint(
  viewport: CanvasViewportState,
  point: { x: number; y: number },
  deltaY: number
): CanvasViewportState {
  const delta = -deltaY * 0.002;
  const zoom = Math.min(Math.max(viewport.zoom + delta, MIN_INTERACTIVE_ZOOM), MAX_INTERACTIVE_ZOOM);

  return {
    zoom,
    pan: {
      x: point.x - (point.x - viewport.pan.x) * (zoom / viewport.zoom),
      y: point.y - (point.y - viewport.pan.y) * (zoom / viewport.zoom),
    },
  };
}

export function panViewportByWheel(
  viewport: CanvasViewportState,
  delta: { x: number; y: number }
): CanvasViewportState {
  return {
    ...viewport,
    pan: {
      x: viewport.pan.x - delta.x,
      y: viewport.pan.y - delta.y,
    },
  };
}

export function screenToCanvasPoint(
  viewport: CanvasViewportState,
  screen: CanvasScreenPoint
): CanvasScreenPoint {
  return {
    x: (screen.x - viewport.pan.x) / viewport.zoom,
    y: (screen.y - viewport.pan.y) / viewport.zoom,
  };
}
