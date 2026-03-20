"use client";

import { useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { DAGNode } from "@/engine/types";
import {
  CanvasPoint,
  NodeContextMenuState,
  NodePosition,
  NodeSize,
  ResizeDirection,
} from "@/lib/canvasInteractionTypes";

interface UseCanvasNodeInteractionsParams {
  presentationMode: boolean;
  isHandModeActive: boolean;
  closeMenus: () => void;
  selectedNodeIds: string[];
  setSelectedFrameId: (frameId: string | null) => void;
  setNodeSelection: (nodeIds: string[]) => void;
  setDraggingNode: (nodeId: string | null) => void;
  setResizingNode: (nodeId: string | null) => void;
  setResizeDirection: (direction: ResizeDirection | null) => void;
  setDragStartCanvas: (point: CanvasPoint) => void;
  setDragStartNodePos: (position: NodePosition) => void;
  setDragStartNodeSize: (size: NodeSize) => void;
  setConnectingFrom: (nodeId: string | null) => void;
  setNodeContextMenu: (menu: NodeContextMenuState | null) => void;
  setIsPanning: (value: boolean) => void;
  setLastMouse: (value: { x: number; y: number }) => void;
  screenToCanvas: (screenX: number, screenY: number) => CanvasPoint;
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  nodes: Record<string, DAGNode>;
  getNodeWidth: (type: string) => number;
  getNodeHeight: (type: string) => number;
}

export function useCanvasNodeInteractions({
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
}: UseCanvasNodeInteractionsParams) {
  const handleNodeDragStart = useCallback((nodeId: string) => {
    return (event: ReactMouseEvent) => {
      if (presentationMode) return;
      event.stopPropagation();

      if (event.button === 1 || isHandModeActive) {
        event.preventDefault();
        closeMenus();
        setIsPanning(true);
        setLastMouse({ x: event.clientX, y: event.clientY });
        return;
      }

      closeMenus();
      if (event.shiftKey) {
        setNodeSelection([...selectedNodeIds, nodeId]);
      } else if (!selectedNodeIds.includes(nodeId)) {
        setNodeSelection([nodeId]);
      }

      setDraggingNode(nodeId);
      setDragStartCanvas(screenToCanvas(event.clientX, event.clientY));
      setDragStartNodePos(nodePositions[nodeId] || { x: 0, y: 0 });
    };
  }, [
    closeMenus,
    isHandModeActive,
    nodePositions,
    presentationMode,
    screenToCanvas,
    selectedNodeIds,
    setDragStartCanvas,
    setDragStartNodePos,
    setDraggingNode,
    setIsPanning,
    setLastMouse,
    setNodeSelection,
  ]);

  const handleNodeResizeStart = useCallback((nodeId: string) => {
    return (direction: ResizeDirection, event: ReactMouseEvent<HTMLDivElement>) => {
      if (presentationMode) return;

      event.preventDefault();
      event.stopPropagation();
      const canvasPoint = screenToCanvas(event.clientX, event.clientY);
      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
      const explicitSize = nodeSizes[nodeId];

      setResizingNode(nodeId);
      setResizeDirection(direction);
      setDragStartCanvas(canvasPoint);
      setDragStartNodePos(nodePositions[nodeId] || { x: 0, y: 0 });
      setDragStartNodeSize({
        width: explicitSize?.width ?? nodeElement?.offsetWidth ?? getNodeWidth(nodes[nodeId]?.type ?? "table"),
        height: explicitSize?.height ?? nodeElement?.offsetHeight ?? getNodeHeight(nodes[nodeId]?.type ?? "table"),
      });

      if (!selectedNodeIds.includes(nodeId)) {
        setNodeSelection([nodeId]);
      }
    };
  }, [
    getNodeHeight,
    getNodeWidth,
    nodePositions,
    nodeSizes,
    nodes,
    presentationMode,
    screenToCanvas,
    selectedNodeIds,
    setDragStartCanvas,
    setDragStartNodePos,
    setDragStartNodeSize,
    setNodeSelection,
    setResizeDirection,
    setResizingNode,
  ]);

  const handlePortDragStart = useCallback((nodeId: string) => {
    if (presentationMode) return;
    setConnectingFrom(nodeId);
  }, [presentationMode, setConnectingFrom]);

  const handleNodeRightClick = useCallback((event: ReactMouseEvent, nodeId: string) => {
    if (presentationMode) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedFrameId(null);
    setNodeContextMenu({ x: event.clientX, y: event.clientY, nodeId });
    if (!selectedNodeIds.includes(nodeId)) {
      setNodeSelection([nodeId]);
    }
  }, [
    presentationMode,
    selectedNodeIds,
    setNodeContextMenu,
    setNodeSelection,
    setSelectedFrameId,
  ]);

  return {
    handleNodeDragStart,
    handleNodeResizeStart,
    handlePortDragStart,
    handleNodeRightClick,
  };
}
