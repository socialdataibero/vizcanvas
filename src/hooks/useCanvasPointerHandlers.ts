"use client";

import { useCallback, type MutableRefObject, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { DAGNode } from "@/engine/types";
import { computeDraggedPosition } from "@/lib/canvasDrag";
import { computeResizedNodeGeometry } from "@/lib/canvasResize";
import {
  resolveMarqueeSelection,
} from "@/lib/canvasSelection";
import {
  CanvasContextMenuState,
  CanvasPoint,
  NodePosition,
  NodeSize,
  ResizeDirection,
  SelectionRect,
} from "@/lib/canvasInteractionTypes";

interface UseCanvasPointerHandlersParams {
  canvasRef: RefObject<HTMLDivElement | null>;
  presentationMode: boolean;
  isHandModeActive: boolean;
  isEditingTarget: (target: HTMLElement | null) => boolean;
  closeMenus: () => void;
  visibleNodes: Record<string, DAGNode>;
  nodes: Record<string, DAGNode>;
  marqueeStart: CanvasPoint | null;
  setMarqueeStart: (point: CanvasPoint | null) => void;
  marqueeCurrent: CanvasPoint | null;
  setMarqueeCurrent: (point: CanvasPoint | null) => void;
  marqueeBaseSelectionRef: MutableRefObject<string[]>;
  selectedNodeIds: string[];
  setNodeSelection: (nodeIds: string[]) => void;
  isPanning: boolean;
  setIsPanning: (value: boolean) => void;
  lastMouse: { x: number; y: number };
  setLastMouse: (value: { x: number; y: number }) => void;
  setPan: (value: { x: number; y: number } | ((current: { x: number; y: number }) => { x: number; y: number })) => void;
  zoom: number;
  draggingNode: string | null;
  setDraggingNode: (nodeId: string | null) => void;
  draggingFrame: string | null;
  setDraggingFrame: (frameId: string | null) => void;
  resizingNode: string | null;
  setResizingNode: (nodeId: string | null) => void;
  resizeDirection: ResizeDirection | null;
  setResizeDirection: (direction: ResizeDirection | null) => void;
  dragStartCanvas: CanvasPoint;
  dragStartNodePos: NodePosition;
  dragStartNodeSize: NodeSize;
  connectingFrom: string | null;
  setConnectingFrom: (nodeId: string | null) => void;
  setConnectingMouse: (point: { x: number; y: number }) => void;
  setCanvasContextMenu: (menu: CanvasContextMenuState | null) => void;
  screenToCanvas: (screenX: number, screenY: number) => CanvasPoint;
  getNodeRect: (nodeId: string) => SelectionRect | null;
  getMinNodeWidth: (type: string) => number;
  minNodeHeight: number;
  rectanglesOverlap: (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
    padding?: number
  ) => boolean;
  addEdge: (fromNodeId: string, toNodeId: string) => unknown;
  onMoveFrame: (frameId: string, x: number, y: number) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeResize: (
    nodeId: string,
    size: { width: number; height: number },
    position?: { x: number; y: number }
  ) => void;
}

export function useCanvasPointerHandlers({
  canvasRef,
  presentationMode,
  isHandModeActive,
  isEditingTarget,
  closeMenus,
  visibleNodes,
  nodes,
  marqueeStart,
  setMarqueeStart,
  marqueeCurrent,
  setMarqueeCurrent,
  marqueeBaseSelectionRef,
  selectedNodeIds,
  setNodeSelection,
  isPanning,
  setIsPanning,
  lastMouse,
  setLastMouse,
  setPan,
  zoom,
  draggingNode,
  setDraggingNode,
  draggingFrame,
  setDraggingFrame,
  resizingNode,
  setResizingNode,
  resizeDirection,
  setResizeDirection,
  dragStartCanvas,
  dragStartNodePos,
  dragStartNodeSize,
  connectingFrom,
  setConnectingFrom,
  setConnectingMouse,
  setCanvasContextMenu,
  screenToCanvas,
  getNodeRect,
  getMinNodeWidth,
  minNodeHeight,
  rectanglesOverlap,
  addEdge,
  onMoveFrame,
  onNodeMove,
  onNodeResize,
}: UseCanvasPointerHandlersParams) {
  const startCanvasPan = useCallback((screenX: number, screenY: number) => {
    closeMenus();
    setIsPanning(true);
    setLastMouse({ x: screenX, y: screenY });
  }, [closeMenus, setIsPanning, setLastMouse]);

  const stopTransientPointerState = useCallback(() => {
    if (isPanning) setIsPanning(false);
    if (draggingFrame) setDraggingFrame(null);
    if (draggingNode) setDraggingNode(null);
    if (resizingNode) {
      setResizingNode(null);
      setResizeDirection(null);
    }
  }, [
    draggingFrame,
    draggingNode,
    isPanning,
    resizingNode,
    setDraggingFrame,
    setDraggingNode,
    setIsPanning,
    setResizeDirection,
    setResizingNode,
  ]);

  const finishNodeConnection = useCallback((screenX: number, screenY: number) => {
    if (!connectingFrom) return;

    const target = document.elementFromPoint(screenX, screenY);
    const nodeEl = target?.closest("[data-node-id]");
    if (nodeEl) {
      const targetNodeId = nodeEl.getAttribute("data-node-id");
      if (targetNodeId && targetNodeId !== connectingFrom) {
        addEdge(connectingFrom, targetNodeId);
      }
    }

    setConnectingFrom(null);
  }, [addEdge, connectingFrom, setConnectingFrom]);

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    const isCanvasBg = target === canvasRef.current || target.classList.contains("canvas-surface");
    const shouldPan = e.button === 1 || (e.button === 0 && isHandModeActive);

    if (presentationMode) {
      if (shouldPan && !isEditingTarget(target)) {
        e.preventDefault();
        startCanvasPan(e.clientX, e.clientY);
        return;
      }

      if (e.button === 2) {
        e.preventDefault();
        closeMenus();
      }
      return;
    }

    if (shouldPan && !isEditingTarget(target)) {
      e.preventDefault();
      startCanvasPan(e.clientX, e.clientY);
      return;
    }

    if (!isCanvasBg) return;

    if (e.button === 2) {
      e.preventDefault();
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      setCanvasContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasX: canvasPoint.x,
        canvasY: canvasPoint.y,
      });
      return;
    }

    if (e.button === 0) {
      closeMenus();
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      marqueeBaseSelectionRef.current = e.shiftKey ? selectedNodeIds : [];
      setMarqueeStart(canvasPoint);
      setMarqueeCurrent(canvasPoint);
    }
  }, [
    canvasRef,
    closeMenus,
    isEditingTarget,
    isHandModeActive,
    marqueeBaseSelectionRef,
    presentationMode,
    screenToCanvas,
    selectedNodeIds,
    setCanvasContextMenu,
    setMarqueeCurrent,
    setMarqueeStart,
    startCanvasPan,
  ]);

  const handleMouseMove = useCallback((e: ReactMouseEvent) => {
    if (resizingNode && resizeDirection) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const nodeType = nodes[resizingNode]?.type ?? "table";
      const nextGeometry = computeResizedNodeGeometry({
        direction: resizeDirection,
        dragStartCanvas,
        dragStartNodePos,
        dragStartNodeSize,
        canvasPos,
        minWidth: getMinNodeWidth(nodeType),
        minHeight: minNodeHeight,
      });

      onNodeResize(
        resizingNode,
        nextGeometry.size,
        nextGeometry.position
      );
      return;
    }

    if (isPanning) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }

    if (marqueeStart && !draggingNode && !draggingFrame && !resizingNode && !connectingFrom) {
      setMarqueeCurrent(screenToCanvas(e.clientX, e.clientY));
    }

    if (draggingFrame) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const nextPosition = computeDraggedPosition({
        canvasPos,
        dragStartCanvas,
        dragStartPosition: dragStartNodePos,
      });
      onMoveFrame(draggingFrame, nextPosition.x, nextPosition.y);
      return;
    }

    if (draggingNode) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const nextPosition = computeDraggedPosition({
        canvasPos,
        dragStartCanvas,
        dragStartPosition: dragStartNodePos,
      });
      onNodeMove(draggingNode, nextPosition.x, nextPosition.y);
    }

    if (connectingFrom) {
      setConnectingMouse({ x: e.clientX, y: e.clientY });
    }
  }, [
    connectingFrom,
    dragStartCanvas,
    dragStartNodePos,
    dragStartNodeSize,
    draggingFrame,
    draggingNode,
    getMinNodeWidth,
    isPanning,
    lastMouse,
    marqueeStart,
    minNodeHeight,
    nodes,
    onMoveFrame,
    onNodeMove,
    onNodeResize,
    resizeDirection,
    resizingNode,
    screenToCanvas,
    setConnectingMouse,
    setLastMouse,
    setMarqueeCurrent,
    setPan,
  ]);

  const handleMouseUp = useCallback((e: ReactMouseEvent) => {
    stopTransientPointerState();
    finishNodeConnection(e.clientX, e.clientY);

    if (marqueeStart && marqueeCurrent) {
      const nextSelection = resolveMarqueeSelection({
        marqueeStart,
        marqueeCurrent,
        baseSelection: marqueeBaseSelectionRef.current,
        zoom,
        visibleNodeIds: Object.keys(visibleNodes),
        getNodeRect,
        rectanglesOverlap,
      });
      setNodeSelection(nextSelection);

      setMarqueeStart(null);
      setMarqueeCurrent(null);
    }
  }, [
    finishNodeConnection,
    getNodeRect,
    marqueeBaseSelectionRef,
    marqueeCurrent,
    marqueeStart,
    rectanglesOverlap,
    stopTransientPointerState,
    zoom,
    setMarqueeCurrent,
    setMarqueeStart,
    setNodeSelection,
    visibleNodes,
  ]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
