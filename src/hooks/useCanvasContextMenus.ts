import { useMemo } from "react";
import { DAGNode } from "@/engine/types";
import { CanvasFrame } from "@/types/canvas";
import { NodeType } from "@/types/nodes";
import {
  buildFrameContextMenuItems,
  buildNodeContextMenuItems,
} from "@/lib/contextMenuActions";
import { getFrameMenuTitle, getMenuScope, getMenuTitle } from "@/lib/contextMenuLabels";

interface UseCanvasContextMenusParams {
  nodeContextMenuNodeId: string | null;
  frameContextMenuFrameId: string | null;
  visibleNodes: Record<string, DAGNode>;
  nodePositions: Record<string, { x: number; y: number }>;
  getNodeWidth: (type: string) => number;
  getSelectionScope: (nodeId?: string) => string[];
  handleDuplicateSelection: (nodeIds: string[]) => void;
  handleCopySelection: (nodeIds: string[]) => Promise<void>;
  onAddNode: (type: NodeType, position?: { x: number; y: number }) => string;
  addEdge: (fromNodeId: string, toNodeId: string) => unknown;
  copyNodeLink: (nodeIds: string[], presentation?: boolean) => Promise<void>;
  copyFrameLink: (frameId: string, presentation?: boolean) => Promise<void>;
  handleCreateFrameSelection: (nodeIds: string[]) => string | null;
  handleDeleteNodes: (nodeIds: string[]) => void;
  getFrameRect: (frameId: string) => CanvasFrame | null;
  onRenameFrame: (frameId: string, name: string) => void;
  onDeleteFrame: (frameId: string) => void;
  setSelectedFrameId: (frameId: string | null) => void;
  closeMenus: () => void;
}

export function useCanvasContextMenus({
  nodeContextMenuNodeId,
  frameContextMenuFrameId,
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
}: UseCanvasContextMenusParams) {
  const nodeContextScope = useMemo(
    () => (nodeContextMenuNodeId ? getSelectionScope(nodeContextMenuNodeId) : []),
    [getSelectionScope, nodeContextMenuNodeId]
  );

  const nodeMenuScope = useMemo(
    () => getMenuScope(nodeContextScope.length),
    [nodeContextScope.length]
  );

  const nodeContextMenuTitle = useMemo(
    () => getMenuTitle(nodeMenuScope),
    [nodeMenuScope]
  );

  const nodeContextMenuItems = useMemo(() => {
    if (!nodeContextMenuNodeId) return [];

    const createConnectedNode = (type: NodeType, offsetY = 0) => {
      const node = visibleNodes[nodeContextMenuNodeId];
      const position = nodePositions[nodeContextMenuNodeId];
      if (!node || !position) return;

      const nextNodeId = onAddNode(type, {
        x: position.x + getNodeWidth(node.type) + 60,
        y: position.y + offsetY,
      });
      setTimeout(() => addEdge(nodeContextMenuNodeId, nextNodeId), 50);
    };

    return buildNodeContextMenuItems({
      scope: nodeMenuScope,
      onDuplicate: () => {
        handleDuplicateSelection(getSelectionScope(nodeContextMenuNodeId));
        closeMenus();
      },
      onCopy: () => {
        void handleCopySelection(getSelectionScope(nodeContextMenuNodeId));
        closeMenus();
      },
      onMakeChart: () => {
        createConnectedNode("chart");
        closeMenus();
      },
      onViewTable: () => {
        createConnectedNode("table", 100);
        closeMenus();
      },
      onCopyLink: () => {
        void copyNodeLink(getSelectionScope(nodeContextMenuNodeId), false);
        closeMenus();
      },
      onCopyPresentationLink: () => {
        void copyNodeLink(getSelectionScope(nodeContextMenuNodeId), true);
        closeMenus();
      },
      onCreateFrame: () => {
        handleCreateFrameSelection(getSelectionScope(nodeContextMenuNodeId));
        closeMenus();
      },
      onDelete: () => {
        handleDeleteNodes(getSelectionScope(nodeContextMenuNodeId));
        closeMenus();
      },
    });
  }, [
    addEdge,
    closeMenus,
    copyNodeLink,
    getNodeWidth,
    getSelectionScope,
    handleCopySelection,
    handleCreateFrameSelection,
    handleDeleteNodes,
    handleDuplicateSelection,
    nodeContextMenuNodeId,
    nodeMenuScope,
    nodePositions,
    onAddNode,
    visibleNodes,
  ]);

  const frameContextMenuItems = useMemo(() => {
    if (!frameContextMenuFrameId) return [];

    return buildFrameContextMenuItems({
      onRename: () => {
        const frame = getFrameRect(frameContextMenuFrameId);
        if (frame) {
          const nextName = window.prompt("Frame name", frame.name);
          if (nextName !== null) {
            onRenameFrame(frame.id, nextName);
          }
        }
        closeMenus();
      },
      onCopyLink: () => {
        void copyFrameLink(frameContextMenuFrameId, false);
        closeMenus();
      },
      onCopyPresentationLink: () => {
        void copyFrameLink(frameContextMenuFrameId, true);
        closeMenus();
      },
      onDelete: () => {
        onDeleteFrame(frameContextMenuFrameId);
        setSelectedFrameId(null);
        closeMenus();
      },
    });
  }, [
    closeMenus,
    copyFrameLink,
    frameContextMenuFrameId,
    getFrameRect,
    onDeleteFrame,
    onRenameFrame,
    setSelectedFrameId,
  ]);

  return {
    nodeContextMenuTitle,
    nodeContextMenuItems,
    frameContextMenuTitle: getFrameMenuTitle(),
    frameContextMenuItems,
  };
}
