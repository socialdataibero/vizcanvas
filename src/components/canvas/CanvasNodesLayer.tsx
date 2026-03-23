"use client";

import React from "react";
import { DAGNode } from "@/engine/types";
import DataNodeComponent from "@/components/nodes/DataNodeComponent";
import { ResizeDirection } from "@/lib/canvasInteractionTypes";
import { NodeType } from "@/types/nodes";

interface CanvasNodesLayerProps {
  nodes: Array<[string, DAGNode]>;
  nodePositions: Record<string, { x: number; y: number }>;
  nodeSizes: Record<string, { width: number; height: number }>;
  selectedNodeIds: string[];
  presentationMode: boolean;
  isHandModeActive: boolean;
  getNodeWidth: (type: string) => number;
  getNodeHeight: (type: string) => number;
  onNodeRightClick: (event: React.MouseEvent, nodeId: string) => void;
  onNodeDragStart: (nodeId: string) => (event: React.MouseEvent) => void;
  onPortDragStart: (nodeId: string) => () => void;
  onNodeResizeStart: (nodeId: string) => (direction: ResizeDirection, event: React.MouseEvent<HTMLDivElement>) => void;
  onNodeSelect: (nodeId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onDeleteNode: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => Promise<void>;
  onDuplicateNode: (nodeId: string) => void;
  onAddDownstreamNode?: (type: NodeType, preferredPosition?: { x: number; y: number }) => string;
}

export default function CanvasNodesLayer({
  nodes,
  nodePositions,
  nodeSizes,
  selectedNodeIds,
  presentationMode,
  isHandModeActive,
  getNodeWidth,
  getNodeHeight,
  onNodeRightClick,
  onNodeDragStart,
  onPortDragStart,
  onNodeResizeStart,
  onNodeSelect,
  onDeleteNode,
  onCopyNode,
  onDuplicateNode,
  onAddDownstreamNode,
}: CanvasNodesLayerProps) {
  return (
    <>
      {nodes.map(([id, node]) => {
        const pos = nodePositions[id] || { x: 100, y: 100 };
        const explicitSize = nodeSizes[id];
        const baseHeight = getNodeHeight(node.type);
        const explicitHeight = explicitSize?.height;
        const defaultHeight = node.type === "chart" ? baseHeight : undefined;
        const resolvedSize = {
          width: explicitSize?.width ?? getNodeWidth(node.type),
          minHeight: explicitHeight || defaultHeight ? baseHeight : undefined,
          height: explicitHeight ?? defaultHeight,
        };
        return (
          <div
            key={id}
            style={{ pointerEvents: "auto" }}
            onContextMenu={(event) => onNodeRightClick(event, id)}
          >
            <DataNodeComponent
              node={node}
              position={pos}
              size={resolvedSize}
              isSelected={selectedNodeIds.includes(id)}
              presentationMode={presentationMode}
              onDragStart={onNodeDragStart(id)}
              onPortDragStart={onPortDragStart(id)}
              onResizeStart={onNodeResizeStart(id)}
              onSelect={(event) => {
                if (presentationMode) return;
                if (isHandModeActive) return;
                onNodeSelect(id, event);
              }}
              onDelete={() => onDeleteNode(id)}
              onCopyNode={() => void onCopyNode(id)}
              onDuplicateNode={() => onDuplicateNode(id)}
              onAddDownstreamNode={presentationMode ? undefined : onAddDownstreamNode}
            />
          </div>
        );
      })}
    </>
  );
}
