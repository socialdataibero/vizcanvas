import { useCallback, useEffect, useRef, useState } from "react";
import {
  fitViewportToBounds,
  panViewportByWheel,
  screenToCanvasPoint,
  type CanvasViewportBounds,
  zoomViewportAroundPoint,
} from "@/lib/canvasViewport";
import { notifyCanvasViewportChange } from "@/lib/canvasViewportEvents";
import { CanvasFrame } from "@/types/canvas";

interface UseCanvasViewportParams {
  currentPageId: string;
  visibleFrames: CanvasFrame[];
  activePresentationFrame: CanvasFrame | null;
  activeLinkedNodeIds: string[];
  presentationMode: boolean;
  getSelectionBounds: (nodeIds: string[]) => CanvasViewportBounds | null;
  setSelectedFrameId: (frameId: string | null) => void;
  setNodeSelection: (nodeIds: string[]) => void;
}

export function useCanvasViewport({
  currentPageId,
  visibleFrames,
  activePresentationFrame,
  activeLinkedNodeIds,
  presentationMode,
  getSelectionBounds,
  setSelectedFrameId,
  setNodeSelection,
}: UseCanvasViewportParams) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const initialViewportFocusKeyRef = useRef<string | null>(null);

  const screenToCanvas = useCallback((screenX: number, screenY: number) => ({
    ...screenToCanvasPoint(
      { pan, zoom },
      { x: screenX, y: screenY }
    ),
  }), [pan, zoom]);

  const applyViewportFocus = useCallback((
    focusKey: string,
    bounds: CanvasViewportBounds,
    padding: number,
    onFocused?: () => void
  ) => {
    if (!canvasRef.current) return;
    if (initialViewportFocusKeyRef.current === focusKey) return;

    const rect = canvasRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const viewport = fitViewportToBounds(
      { width: rect.width, height: rect.height },
      bounds,
      padding
    );

    setZoom(viewport.zoom);
    setPan(viewport.pan);
    onFocused?.();
    initialViewportFocusKeyRef.current = focusKey;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetNodeIds = (params.get("nodes") ?? "")
      .split(",")
      .map((nodeId) => nodeId.trim())
      .filter(Boolean);
    if (targetNodeIds.length > 0) return;

    const targetFrameId = params.get("frame");
    if (!targetFrameId) return;

    const frame = visibleFrames.find((entry) => entry.id === targetFrameId);
    if (!frame) return;

    const focusKey = `${currentPageId}:${targetFrameId}`;
    applyViewportFocus(
      focusKey,
      {
        minX: frame.x,
        minY: frame.y,
        maxX: frame.x + frame.width,
        maxY: frame.y + frame.height,
      },
      80,
      () => setSelectedFrameId(frame.id)
    );
  }, [applyViewportFocus, currentPageId, setSelectedFrameId, visibleFrames]);

  useEffect(() => {
    if (activePresentationFrame || activeLinkedNodeIds.length === 0) {
      return;
    }

    const bounds = getSelectionBounds(activeLinkedNodeIds);
    if (!bounds) return;

    applyViewportFocus(
      `${currentPageId}:nodes:${activeLinkedNodeIds.join(",")}:${presentationMode ? "present" : "canvas"}`,
      bounds,
      100,
      () => {
        setSelectedFrameId(null);
        if (!presentationMode) {
          setNodeSelection(activeLinkedNodeIds);
        }
      }
    );
  }, [
    activeLinkedNodeIds,
    activePresentationFrame,
    applyViewportFocus,
    currentPageId,
    getSelectionBounds,
    presentationMode,
    setNodeSelection,
    setSelectedFrameId,
  ]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    notifyCanvasViewportChange();

    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const viewport = zoomViewportAroundPoint(
          { pan, zoom },
          { x: e.clientX - rect.left, y: e.clientY - rect.top },
          e.deltaY
        );
        setPan(viewport.pan);
        setZoom(viewport.zoom);
      }
      return;
    }

    setPan(panViewportByWheel({ pan, zoom }, { x: e.deltaX, y: e.deltaY }).pan);
  }, [pan, zoom]);

  return {
    canvasRef,
    pan,
    setPan,
    zoom,
    setZoom,
    isPanning,
    setIsPanning,
    spacePressed,
    setSpacePressed,
    lastMouse,
    setLastMouse,
    screenToCanvas,
    handleWheel,
  };
}
