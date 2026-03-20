"use client";

import { useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { CanvasFrame } from "@/types/canvas";
import {
  CanvasPoint,
  FrameContextMenuState,
} from "@/lib/canvasInteractionTypes";

interface UseCanvasFrameInteractionsParams {
  presentationMode: boolean;
  isHandModeActive: boolean;
  closeMenus: () => void;
  clearNodeSelection: () => void;
  setSelectedFrameId: (frameId: string | null) => void;
  setDraggingFrame: (frameId: string | null) => void;
  setDragStartCanvas: (point: CanvasPoint) => void;
  setDragStartNodePos: (position: CanvasPoint) => void;
  setIsPanning: (value: boolean) => void;
  setLastMouse: (value: { x: number; y: number }) => void;
  setFrameContextMenu: (menu: FrameContextMenuState | null) => void;
  screenToCanvas: (screenX: number, screenY: number) => CanvasPoint;
  getFrameRect: (frameId: string) => CanvasFrame | null;
}

export function useCanvasFrameInteractions({
  presentationMode,
  isHandModeActive,
  closeMenus,
  clearNodeSelection,
  setSelectedFrameId,
  setDraggingFrame,
  setDragStartCanvas,
  setDragStartNodePos,
  setIsPanning,
  setLastMouse,
  setFrameContextMenu,
  screenToCanvas,
  getFrameRect,
}: UseCanvasFrameInteractionsParams) {
  const handleFrameDragStart = useCallback((frameId: string) => {
    return (event: ReactMouseEvent) => {
      if (presentationMode) return;
      event.preventDefault();
      event.stopPropagation();

      if (event.button === 1 || isHandModeActive) {
        closeMenus();
        setIsPanning(true);
        setLastMouse({ x: event.clientX, y: event.clientY });
        return;
      }

      const frame = getFrameRect(frameId);
      if (!frame) return;

      closeMenus();
      clearNodeSelection();
      setSelectedFrameId(frameId);
      setDraggingFrame(frameId);
      setDragStartCanvas(screenToCanvas(event.clientX, event.clientY));
      setDragStartNodePos({ x: frame.x, y: frame.y });
    };
  }, [
    clearNodeSelection,
    closeMenus,
    getFrameRect,
    isHandModeActive,
    presentationMode,
    screenToCanvas,
    setDragStartCanvas,
    setDragStartNodePos,
    setDraggingFrame,
    setIsPanning,
    setLastMouse,
    setSelectedFrameId,
  ]);

  const handleFrameRightClick = useCallback((frameId: string) => {
    return (event: ReactMouseEvent) => {
      if (presentationMode) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenus();
      clearNodeSelection();
      setSelectedFrameId(frameId);
      setFrameContextMenu({ x: event.clientX, y: event.clientY, frameId });
    };
  }, [
    clearNodeSelection,
    closeMenus,
    presentationMode,
    setFrameContextMenu,
    setSelectedFrameId,
  ]);

  return {
    handleFrameDragStart,
    handleFrameRightClick,
  };
}
