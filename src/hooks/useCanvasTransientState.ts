"use client";

import { useCallback, useState } from "react";
import {
  CanvasPoint,
  CanvasContextMenuState,
  FrameContextMenuState,
  NodePosition,
  NodeSize,
  NodeContextMenuState,
  ResizeDirection,
} from "@/lib/canvasInteractionTypes";

export function useCanvasTransientState() {
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [draggingFrame, setDraggingFrame] = useState<string | null>(null);
  const [resizingNode, setResizingNode] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null);
  const [dragStartCanvas, setDragStartCanvas] = useState<CanvasPoint>({ x: 0, y: 0 });
  const [dragStartNodePos, setDragStartNodePos] = useState<NodePosition>({ x: 0, y: 0 });
  const [dragStartNodeSize, setDragStartNodeSize] = useState<NodeSize>({ width: 0, height: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectingMouse, setConnectingMouse] = useState({ x: 0, y: 0 });
  const [canvasContextMenu, setCanvasContextMenu] = useState<CanvasContextMenuState | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null);
  const [frameContextMenu, setFrameContextMenu] = useState<FrameContextMenuState | null>(null);

  const closeMenus = useCallback(() => {
    setCanvasContextMenu(null);
    setNodeContextMenu(null);
    setFrameContextMenu(null);
  }, []);

  return {
    draggingNode,
    setDraggingNode,
    draggingFrame,
    setDraggingFrame,
    resizingNode,
    setResizingNode,
    resizeDirection,
    setResizeDirection,
    dragStartCanvas,
    setDragStartCanvas,
    dragStartNodePos,
    setDragStartNodePos,
    dragStartNodeSize,
    setDragStartNodeSize,
    connectingFrom,
    setConnectingFrom,
    connectingMouse,
    setConnectingMouse,
    canvasContextMenu,
    setCanvasContextMenu,
    nodeContextMenu,
    setNodeContextMenu,
    frameContextMenu,
    setFrameContextMenu,
    closeMenus,
  };
}
