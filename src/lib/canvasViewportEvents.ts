export const CANVAS_VIEWPORT_CHANGE_EVENT = "vizcanvas-viewport-change";

export function notifyCanvasViewportChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CANVAS_VIEWPORT_CHANGE_EVENT));
}
