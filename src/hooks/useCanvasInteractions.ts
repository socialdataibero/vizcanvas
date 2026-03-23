import { type MutableRefObject, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { DAGEdge, DAGNode } from "@/engine/types";
import { CanvasFrame } from "@/types/canvas";
import { useCanvasFrameInteractions } from "@/hooks/useCanvasFrameInteractions";
import { useCanvasNodeInteractions } from "@/hooks/useCanvasNodeInteractions";
import { useCanvasPointerHandlers } from "@/hooks/useCanvasPointerHandlers";
import {
  CanvasContextMenuState,
  CanvasPoint,
  FrameContextMenuState,
  NodeContextMenuState,
  NodePosition,
  NodeSize,
  ResizeDirection,
  SelectionRect,
} from "@/lib/canvasInteractionTypes";

interface UseCanvasInteractionsParams {
  canvasRef: RefObject<HTMLDivElement | null>;
  presentationMode: boolean;
  isHandModeActive: boolean;
  isEditingTarget: (target: HTMLElement | null) => boolean;
  closeMenus: () => void;
  visibleNodes: Record<string, DAGNode>;
  nodes: Record<string, DAGNode>;
  edges: DAGEdge[];
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  selectedNodeIds: string[];
  setSelectedFrameId: (frameId: string | null) => void;
  setNodeSelection: (nodeIds: string[]) => void;
  clearNodeSelection: () => void;
  marqueeStart: CanvasPoint | null;
  setMarqueeStart: (point: CanvasPoint | null) => void;
  marqueeCurrent: CanvasPoint | null;
  setMarqueeCurrent: (point: CanvasPoint | null) => void;
  marqueeBaseSelectionRef: MutableRefObject<string[]>;
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
  setDragStartCanvas: (point: CanvasPoint) => void;
  dragStartNodePos: NodePosition;
  setDragStartNodePos: (position: NodePosition) => void;
  dragStartNodeSize: NodeSize;
  setDragStartNodeSize: (size: NodeSize) => void;
  connectingFrom: string | null;
  setConnectingFrom: (nodeId: string | null) => void;
  setConnectingMouse: (point: { x: number; y: number }) => void;
  setCanvasContextMenu: (menu: CanvasContextMenuState | null) => void;
  setNodeContextMenu: (menu: NodeContextMenuState | null) => void;
  setFrameContextMenu: (menu: FrameContextMenuState | null) => void;
  screenToCanvas: (screenX: number, screenY: number) => CanvasPoint;
  getFrameRect: (frameId: string) => CanvasFrame | null;
  getNodeRect: (nodeId: string) => SelectionRect | null;
  getNodeWidth: (type: string) => number;
  getNodeHeight: (type: string) => number;
  getMinNodeWidth: (type: string) => number;
  minNodeHeight: number;
  rectanglesOverlap: (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
    padding?: number
  ) => boolean;
  addEdge: (fromNodeId: string, toNodeId: string, toInputIndex?: number) => unknown;
  onMoveFrame: (frameId: string, x: number, y: number) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeResize: (
    nodeId: string,
    size: { width: number; height: number },
    position?: { x: number; y: number }
  ) => void;
}

export function useCanvasInteractions({
  canvasRef,
  presentationMode,
  isHandModeActive,
  isEditingTarget,
  closeMenus,
  visibleNodes,
  nodes,
  edges,
  nodePositions,
  nodeSizes,
  selectedNodeIds,
  setSelectedFrameId,
  setNodeSelection,
  clearNodeSelection,
  marqueeStart,
  setMarqueeStart,
  marqueeCurrent,
  setMarqueeCurrent,
  marqueeBaseSelectionRef,
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
  setDragStartCanvas,
  dragStartNodePos,
  setDragStartNodePos,
  dragStartNodeSize,
  setDragStartNodeSize,
  connectingFrom,
  setConnectingFrom,
  setConnectingMouse,
  setCanvasContextMenu,
  setNodeContextMenu,
  setFrameContextMenu,
  screenToCanvas,
  getFrameRect,
  getNodeRect,
  getNodeWidth,
  getNodeHeight,
  getMinNodeWidth,
  minNodeHeight,
  rectanglesOverlap,
  addEdge,
  onMoveFrame,
  onNodeMove,
  onNodeResize,
}: UseCanvasInteractionsParams) {
  const { handleFrameDragStart, handleFrameRightClick } = useCanvasFrameInteractions({
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
  });

  const { handleMouseDown, handleMouseMove, handleMouseUp } = useCanvasPointerHandlers({
    canvasRef,
    presentationMode,
    isHandModeActive,
    isEditingTarget,
    closeMenus,
    visibleNodes,
    nodes,
    edges,
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
  });

  const {
    handleNodeDragStart,
    handleNodeResizeStart,
    handlePortDragStart,
    handleNodeRightClick,
  } = useCanvasNodeInteractions({
    presentationMode,
    isHandModeActive,
    closeMenus,
    selectedNodeIds,
    setSelectedFrameId,
    setNodeSelection,
    setDraggingNode,
    setResizingNode,
    setResizeDirection,
    setDragStartCanvas,
    setDragStartNodePos,
    setDragStartNodeSize,
    setConnectingFrom,
    setNodeContextMenu,
    setIsPanning,
    setLastMouse,
    screenToCanvas,
    nodePositions,
    nodeSizes,
    nodes,
    getNodeWidth,
    getNodeHeight,
  });

  return {
    handleFrameDragStart,
    handleFrameRightClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeDragStart,
    handleNodeResizeStart,
    handlePortDragStart,
    handleNodeRightClick,
  };
}
