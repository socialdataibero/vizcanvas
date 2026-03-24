"use client";

import React, { useCallback, useEffect } from "react";
import { useDagStore } from "@/stores/dagStore";
import { useUIStore } from "@/stores/uiStore";
import { useCanvasStore } from "@/stores/canvasStore";
import CanvasFramesLayer from "@/components/canvas/CanvasFramesLayer";
import CanvasMenusOverlay from "@/components/canvas/CanvasMenusOverlay";
import CanvasNodesLayer from "@/components/canvas/CanvasNodesLayer";
import CanvasSelectionMarquee from "@/components/canvas/CanvasSelectionMarquee";
import CanvasSurface from "@/components/canvas/CanvasSurface";
import ZoomControls from "@/components/canvas/ZoomControls";
import EdgeRenderer from "./EdgeRenderer";
import { NodeType } from "@/types/nodes";
import { CanvasFrame } from "@/types/canvas";
import { CONTEXT_MENU_NODE_GROUPS, NODE_SHORTCUTS } from "@/lib/nodeConfig";
import { getCanvasNodeHeight, getCanvasNodeWidth } from "@/lib/canvasLayout";
import {
  addNodeWithCollisionAvoidance,
  findAvailableNodePosition,
  rectanglesOverlap,
} from "@/lib/canvasPlacement";
import { CANVAS_VIEWPORT_CHANGE_EVENT } from "@/lib/canvasViewportEvents";
import { useCanvasShareLinks } from "@/hooks/useCanvasShareLinks";
import { useCanvasClipboard } from "@/hooks/useCanvasClipboard";
import { useCanvasSelection } from "@/hooks/useCanvasSelection";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { useCanvasInteractions } from "@/hooks/useCanvasInteractions";
import { useCanvasShortcuts } from "@/hooks/useCanvasShortcuts";
import { useCanvasContextMenus } from "@/hooks/useCanvasContextMenus";
import {
  useCanvasTransientState,
} from "@/hooks/useCanvasTransientState";

const MIN_NODE_WIDTH: Partial<Record<string, number>> = {
  chart: 640,
};
const DEFAULT_MIN_NODE_WIDTH = 260;
const MIN_NODE_HEIGHT = 140;

function getNodeWidth(type: string): number {
  return getCanvasNodeWidth(type as NodeType);
}

function getNodeHeight(type: string): number {
  return getCanvasNodeHeight(type as NodeType, "", {});
}

function getMinNodeWidth(type: string): number {
  return MIN_NODE_WIDTH[type] ?? DEFAULT_MIN_NODE_WIDTH;
}

interface Props {
  nodePositions: Record<string, { x: number; y: number }>;
  nodeSizes: Record<string, { width: number; height: number }>;
  frames: CanvasFrame[];
  presentationMode?: boolean;
  presentationFrameId?: string | null;
  linkedNodeIds?: string[];
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeResize: (nodeId: string, size: { width: number; height: number }, position?: { x: number; y: number }) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddNode: (type: NodeType, position?: { x: number; y: number }) => string;
  onCreateFrameFromSelection: (nodeIds: string[], name?: string) => string | null;
  onMoveFrame: (frameId: string, x: number, y: number) => void;
  onDeleteFrame: (frameId: string) => void;
  onRenameFrame: (frameId: string, name: string) => void;
  undoCanvas: () => void;
  redoCanvas: () => void;
  toggleFocusMode: () => void;
  toggleShortcutsModal: () => void;
  persistCanvasStateNow: () => void;
}

export default function InfiniteCanvas({
  nodePositions,
  nodeSizes,
  frames,
  presentationMode = false,
  presentationFrameId = null,
  linkedNodeIds = [],
  onNodeMove,
  onNodeResize,
  onDeleteNode,
  onAddNode,
  onCreateFrameFromSelection,
  onMoveFrame,
  onDeleteFrame,
  onRenameFrame,
  undoCanvas,
  redoCanvas,
  toggleFocusMode,
  toggleShortcutsModal,
  persistCanvasStateNow,
}: Props) {
  const {
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
  } = useCanvasTransientState();

  const nodes = useDagStore((s) => s.nodes);
  const edges = useDagStore((s) => s.edges);
  const addEdge = useDagStore((s) => s.addEdge);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setSelectedNode = useUIStore((s) => s.setSelectedNode);
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const currentPageId = useCanvasStore((s) => s.currentPageId);
  const pageFrames = React.useMemo(
    () => frames.filter((frame) => frame.pageId === currentPageId),
    [currentPageId, frames]
  );
  const activePresentationFrame = React.useMemo(
    () =>
      presentationMode && presentationFrameId
        ? pageFrames.find((frame) => frame.id === presentationFrameId) ?? null
        : null,
    [pageFrames, presentationFrameId, presentationMode]
  );
  const activeLinkedNodeIds = React.useMemo(
    () =>
      Array.from(new Set(linkedNodeIds)).filter((nodeId) => {
        const node = nodes[nodeId];
        return Boolean(node && node.pageId === currentPageId);
      }),
    [currentPageId, linkedNodeIds, nodes]
  );
  const activePresentationNodeIdSet = React.useMemo(
    () =>
      new Set(
        presentationMode && !activePresentationFrame
          ? activeLinkedNodeIds
          : []
      ),
    [activeLinkedNodeIds, activePresentationFrame, presentationMode]
  );
  const visibleNodes = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(nodes).filter(([nodeId, node]) =>
          node.pageId === currentPageId &&
          (!activePresentationFrame || activePresentationFrame.nodeIds.includes(nodeId)) &&
          (activePresentationNodeIdSet.size === 0 || activePresentationNodeIdSet.has(nodeId))
        )
      ),
    [activePresentationFrame, activePresentationNodeIdSet, currentPageId, nodes]
  );
  const visibleNodeIds = React.useMemo(
    () => new Set(Object.keys(visibleNodes)),
    [visibleNodes]
  );
  const visibleFrames = React.useMemo(
    () => (activePresentationFrame ? [activePresentationFrame] : pageFrames),
    [activePresentationFrame, pageFrames]
  );
  const visibleEdges = React.useMemo(
    () =>
      edges.filter(
        (edge) => visibleNodeIds.has(edge.fromNodeId) && visibleNodeIds.has(edge.toNodeId)
      ),
    [edges, visibleNodeIds]
  );

  useEffect(() => {
    if (!canvasContextMenu && !nodeContextMenu && !frameContextMenu) return;

    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".context-menu")) return;
      closeMenus();
    };

    const handleViewportChange = () => {
      closeMenus();
    };

    document.addEventListener("mousedown", handleOutsideMouseDown);
    window.addEventListener(CANVAS_VIEWPORT_CHANGE_EVENT, handleViewportChange);

    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
      window.removeEventListener(CANVAS_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    };
  }, [canvasContextMenu, closeMenus, frameContextMenu, nodeContextMenu]);

  const {
    selectedNodeIds,
    selectedFrameId,
    setSelectedFrameId,
    marqueeStart,
    setMarqueeStart,
    marqueeCurrent,
    setMarqueeCurrent,
    marqueeBaseSelectionRef,
    setNodeSelection,
    clearNodeSelection,
    getNodeRect,
    getSelectionScope,
    getSelectionBounds,
  } = useCanvasSelection({
    selectedNodeId,
    setSelectedNode,
    visibleNodes,
    visibleFrames,
    nodePositions,
    nodeSizes,
    getNodeWidth,
    getNodeHeight,
  });

  const {
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
  } = useCanvasViewport({
    currentPageId,
    visibleFrames,
    activePresentationFrame,
    activeLinkedNodeIds,
    presentationMode,
    getSelectionBounds,
    setSelectedFrameId,
    setNodeSelection,
  });

  const isHandModeActive = activeTool === "hand" || spacePressed;

  const isEditingTarget = useCallback((target: HTMLElement | null) => {
    return Boolean(target?.closest("input, textarea, select, button, .cm-editor, [contenteditable='true']"));
  }, []);

  const getFrameRect = useCallback((frameId: string) => {
    return visibleFrames.find((frame) => frame.id === frameId) ?? null;
  }, [visibleFrames]);

  const getAvailableNodePosition = useCallback((
    type: NodeType,
    preferredPosition: { x: number; y: number }
  ) =>
    findAvailableNodePosition({
      type,
      preferredPosition,
      visibleNodes,
      nodePositions,
      nodeSizes,
      getNodeWidth,
      getNodeHeight,
    }),
  [nodePositions, nodeSizes, visibleNodes]);

  const { copyFrameLink, copyNodeLink } = useCanvasShareLinks({
    currentPageId,
    visibleNodes,
    getFrameById: getFrameRect,
    persistCanvasStateNow,
  });
  const {
    handleCopySelection,
    handleDuplicateSelection,
    handlePasteSelection,
  } = useCanvasClipboard({
    canvasRef,
    currentPageId,
    visibleNodes,
    nodePositions,
    nodeSizes,
    edges,
    pan,
    zoom,
    getNodeWidth,
    getNodeHeight,
    findAvailableNodePosition: getAvailableNodePosition,
    onNodeMove,
    onNodeResize,
    setNodeSelection,
    getSelectionBounds,
    getSelectionScope,
  });

  const handleDeleteNodes = useCallback((nodeIds: string[]) => {
    const scope = Array.from(new Set(nodeIds)).filter((nodeId) => Boolean(visibleNodes[nodeId]));
    if (scope.length === 0) return;

    for (const nodeId of scope) {
      onDeleteNode(nodeId);
    }
    clearNodeSelection();
  }, [clearNodeSelection, onDeleteNode, visibleNodes]);

  const handleCreateFrameSelection = useCallback((nodeIds: string[]) => {
    const scope = Array.from(new Set(nodeIds)).filter((nodeId) => Boolean(visibleNodes[nodeId] && nodePositions[nodeId]));
    if (scope.length === 0) return null;
    const frameId = onCreateFrameFromSelection(scope);
    if (frameId) {
      clearNodeSelection();
      setSelectedFrameId(frameId);
    }
    return frameId;
  }, [clearNodeSelection, nodePositions, onCreateFrameFromSelection, setSelectedFrameId, visibleNodes]);

  const {
    handleFrameDragStart,
    handleFrameRightClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeDragStart,
    handleNodeResizeStart,
    handlePortDragStart,
    handleNodeRightClick,
  } = useCanvasInteractions({
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
    minNodeHeight: MIN_NODE_HEIGHT,
    rectanglesOverlap,
    addEdge,
    onMoveFrame,
    onNodeMove,
    onNodeResize,
  });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleFrameSelect = useCallback((frameId: string) => (event: React.MouseEvent) => {
    event.stopPropagation();
    closeMenus();
    clearNodeSelection();
    setSelectedFrameId(frameId);
  }, [clearNodeSelection, closeMenus, setSelectedFrameId]);

  const handleNodeSelect = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement>) => {
    closeMenus();
    if (event.shiftKey) {
      if (selectedNodeIds.includes(nodeId)) {
        setNodeSelection(selectedNodeIds.filter((currentNodeId) => currentNodeId !== nodeId));
      } else {
        setNodeSelection([...selectedNodeIds, nodeId]);
      }
    } else {
      setNodeSelection([nodeId]);
    }
  }, [closeMenus, selectedNodeIds, setNodeSelection]);

  // Add node from node's + button
  const handleAddNodeForComponent = useCallback((type: NodeType, preferredPosition?: { x: number; y: number }) => {
    if (!preferredPosition) {
      return onAddNode(type);
    }
    return addNodeWithCollisionAvoidance({
      type,
      preferredPosition,
      visibleNodes,
      nodePositions,
      nodeSizes,
      getNodeWidth,
      getNodeHeight,
      onAddNode,
    });
  }, [nodePositions, nodeSizes, onAddNode, visibleNodes]);

  useCanvasShortcuts({
    canvasRef,
    presentationMode,
    pan,
    zoom,
    selectedFrameId,
    getSelectionScope,
    handleCopySelection,
    handleDuplicateSelection,
    handlePasteSelection,
    handleDeleteNodes,
    onDeleteFrame,
    setSelectedFrameId,
    onAddNode,
    closeMenus,
    setActiveTool,
    isEditingTarget,
    setSpacePressed,
    setZoom,
    setPan,
    undoCanvas,
    redoCanvas,
    toggleFocusMode,
    toggleShortcutsModal,
    nodeShortcuts: NODE_SHORTCUTS,
  });

  const nodesArray = Object.entries(visibleNodes);
  const {
    nodeContextMenuTitle,
    nodeContextMenuItems,
    frameContextMenuTitle,
    frameContextMenuItems,
  } = useCanvasContextMenus({
    nodeContextMenuNodeId: nodeContextMenu?.nodeId ?? null,
    frameContextMenuFrameId: frameContextMenu?.frameId ?? null,
    visibleNodes,
    nodePositions,
    getNodeWidth,
    getSelectionScope,
    handleDuplicateSelection,
    handleCopySelection,
    onAddNode,
    addEdge,
    copyNodeLink,
    copyFrameLink,
    handleCreateFrameSelection,
    handleDeleteNodes,
    getFrameRect,
    onRenameFrame,
    onDeleteFrame,
    setSelectedFrameId,
    closeMenus,
  });
  const marqueeVisible = Boolean(marqueeStart && marqueeCurrent);
  const marqueeLeft = marqueeVisible ? Math.min(marqueeStart!.x, marqueeCurrent!.x) * zoom + pan.x : 0;
  const marqueeTop = marqueeVisible ? Math.min(marqueeStart!.y, marqueeCurrent!.y) * zoom + pan.y : 0;
  const marqueeWidth = marqueeVisible ? Math.abs(marqueeCurrent!.x - marqueeStart!.x) * zoom : 0;
  const marqueeHeight = marqueeVisible ? Math.abs(marqueeCurrent!.y - marqueeStart!.y) * zoom : 0;

  return (
    <div
      ref={canvasRef}
      className="canvas-bg absolute inset-0"
      style={{
        cursor: presentationMode
          ? isPanning ? "grabbing" : "default"
          : connectingFrom ? "crosshair" : isPanning ? "grabbing" : draggingNode || draggingFrame ? "grabbing" : isHandModeActive ? "grab" : "default",
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onClick={closeMenus}
    >
      <CanvasSelectionMarquee
        visible={marqueeVisible && !presentationMode}
        left={marqueeLeft}
        top={marqueeTop}
        width={marqueeWidth}
        height={marqueeHeight}
      />

      <CanvasSurface pan={pan} zoom={zoom}>
        <EdgeRenderer
          edges={visibleEdges}
          nodes={nodes}
          nodePositions={nodePositions}
          connectingFrom={connectingFrom}
          connectingMouse={connectingMouse}
          pan={pan}
          zoom={zoom}
        />

        {!presentationMode ? (
          <CanvasFramesLayer
            frames={visibleFrames}
            selectedFrameId={selectedFrameId}
            onFrameDragStart={handleFrameDragStart}
            onFrameRightClick={handleFrameRightClick}
            onFrameSelect={handleFrameSelect}
          />
        ) : null}

        <CanvasNodesLayer
          nodes={nodesArray}
          nodePositions={nodePositions}
          nodeSizes={nodeSizes}
          selectedNodeIds={selectedNodeIds}
          presentationMode={presentationMode}
          isHandModeActive={isHandModeActive}
          getNodeWidth={getNodeWidth}
          getNodeHeight={getNodeHeight}
          onNodeRightClick={handleNodeRightClick}
          onNodeDragStart={handleNodeDragStart}
          onPortDragStart={(nodeId) => () => handlePortDragStart(nodeId)}
          onNodeResizeStart={handleNodeResizeStart}
          onNodeSelect={handleNodeSelect}
          onDeleteNode={(nodeId) => handleDeleteNodes(getSelectionScope(nodeId))}
          onCopyNode={(nodeId) => handleCopySelection(getSelectionScope(nodeId))}
          onDuplicateNode={(nodeId) => {
            handleDuplicateSelection(getSelectionScope(nodeId));
          }}
          onAddDownstreamNode={handleAddNodeForComponent}
        />
      </CanvasSurface>

      <ZoomControls
        zoom={zoom}
        onZoomChange={setZoom}
        onReset={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
      />

      <CanvasMenusOverlay
        canvasContextMenu={canvasContextMenu}
        nodeContextMenu={nodeContextMenu}
        frameContextMenu={frameContextMenu}
        nodeContextMenuTitle={nodeContextMenuTitle}
        nodeContextMenuItems={nodeContextMenuItems}
        frameContextMenuTitle={frameContextMenuTitle}
        frameContextMenuItems={frameContextMenuItems}
        nodeGroups={CONTEXT_MENU_NODE_GROUPS}
        onAddNode={onAddNode}
        onCloseMenus={closeMenus}
      />
    </div>
  );
}
