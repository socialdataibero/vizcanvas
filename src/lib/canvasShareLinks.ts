export function buildCanvasShareUrl(): URL {
  return new URL(window.location.pathname, window.location.origin);
}
