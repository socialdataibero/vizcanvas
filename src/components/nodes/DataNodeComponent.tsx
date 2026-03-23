"use client";

import React, { useState, useCallback } from "react";
import { DAGNode } from "@/engine/types";
import { ResizeDirection } from "@/lib/canvasInteractionTypes";
import { getCanvasNodeHeight } from "@/lib/canvasLayout";
import { getInputPortCount } from "@/lib/inputPorts";
import { buildPortAlignedDownstreamNodePosition } from "@/lib/canvasPlacement";
import { ChartConfig, ControlsConfig, FromConfig, GroupConfig, NodeType } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import NodeShell from "./shared/NodeShell";
import FromNodeBody from "./FromNode";
import SQLNodeBody from "./SQLNode";
import GroupNodeBody from "./GroupNode";
import JoinNodeBody from "./JoinNode";
import ChartNodeBody from "./ChartNode";
import TableNodeBody from "./TableNode";
import DistinctNodeBody from "./DistinctNode";
import JSNodeBody from "./JSNode";
import ControlsNodeBody from "./ControlsNode";
import PresentationNodeBody from "./PresentationNodeBody";

interface Props {
  node: DAGNode;
  position: { x: number; y: number };
  size: { width: number; height?: number; minHeight?: number };
  isSelected: boolean;
  presentationMode?: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onPortDragStart: () => void;
  onResizeStart: (direction: ResizeDirection, e: React.MouseEvent<HTMLDivElement>) => void;
  onSelect: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDelete: () => void;
  onCopyNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onAddDownstreamNode?: (type: NodeType, preferredPosition?: { x: number; y: number }) => string;
}

function getNodeBody(node: DAGNode, presentationMode = false, expandTablePreview = false) {
  switch (node.type) {
    case "from": return presentationMode ? <PresentationNodeBody node={node} /> : <FromNodeBody node={node} expandTablePreview={expandTablePreview} />;
    case "sql": return presentationMode ? <PresentationNodeBody node={node} /> : <SQLNodeBody node={node} expandTablePreview={expandTablePreview} />;
    case "group": return presentationMode ? <PresentationNodeBody node={node} /> : <GroupNodeBody node={node} expandTablePreview={expandTablePreview} />;
    case "join": return presentationMode ? <PresentationNodeBody node={node} /> : <JoinNodeBody node={node} expandTablePreview={expandTablePreview} />;
    case "chart": return <ChartNodeBody node={node} presentationMode={presentationMode} />;
    case "table": return presentationMode ? <PresentationNodeBody node={node} /> : <TableNodeBody node={node} expandTablePreview={expandTablePreview} />;
    case "distinct": return presentationMode ? <PresentationNodeBody node={node} /> : <DistinctNodeBody node={node} expandTablePreview={expandTablePreview} />;
    case "javascript": return presentationMode ? <PresentationNodeBody node={node} /> : <JSNodeBody node={node} />;
    case "controls": return presentationMode ? <PresentationNodeBody node={node} /> : <ControlsNodeBody node={node} expandTablePreview={expandTablePreview} />;
    default: return <div className="text-xs text-gray-400">Unknown node type</div>;
  }
}

function getNodeDisplayName(node: DAGNode, presentationMode = false): string {
  if (presentationMode) {
    switch (node.type) {
      case "from":
        return (node.config as FromConfig).tableName || "Source";
      case "group": {
        const config = node.config as GroupConfig;
        const groupCount = config.groupByColumns?.length ?? 0;
        const metricCount = (config.aggregations ?? []).filter(
          (aggregation) => aggregation.function && aggregation.column
        ).length;
        if (groupCount > 0 || metricCount > 0) {
          return "Group by + Summarize";
        }
        return "Grouped result";
      }
      case "join":
        return "Joined result";
      case "chart":
        return (node.config as ChartConfig).title?.trim() || "Chart";
      case "table":
        return "Table";
      case "distinct":
        return "Unique rows";
      case "controls":
        return "Interactive filters";
      case "sql":
        return "Custom SQL";
      case "javascript":
        return "JavaScript";
      default:
        return node.type;
    }
  }

  const suffix = node.id.slice(0, 5);

  switch (node.type) {
    case "from":
      return (node.config as FromConfig).tableName || `source_${suffix}`;
    case "group":
      return `summary_${suffix}`;
    case "join":
      return `join_${suffix}`;
    case "chart":
      return `chart_${suffix}`;
    case "table":
      return `table_${suffix}`;
    case "distinct":
      return `unique_${suffix}`;
    case "controls": {
      const filterCount = (node.config as ControlsConfig).controls?.length ?? 0;
      return filterCount > 0 ? `filters_${suffix}` : `filter_${suffix}`;
    }
    case "sql":
      return `sql_${suffix}`;
    case "javascript":
      return `javascript_${suffix}`;
    default:
      return `${node.type}_${suffix}`;
  }
}

export default function DataNodeComponent({
  node,
  position,
  size,
  isSelected,
  presentationMode = false,
  onDragStart,
  onPortDragStart,
  onResizeStart,
  onSelect,
  onDelete,
  onCopyNode,
  onDuplicateNode,
  onAddDownstreamNode,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const addEdge = useDagStore((s) => s.addEdge);
  const expandsTablePreview = Boolean(
    size.height !== undefined &&
    size.minHeight !== undefined &&
    size.height > size.minHeight
  );

  const showInputPort = node.type !== "from";
  const showOutputPort = node.type !== "javascript";
  const inputPortCount = showInputPort ? getInputPortCount(node.type) : 0;

  const handleAddDownstream = useCallback((type: NodeType) => {
    if (!onAddDownstreamNode) return;
    const preferredPosition = buildPortAlignedDownstreamNodePosition({
      sourcePosition: position,
      sourceSize: {
        width: size.width,
        height: size.height ?? size.minHeight ?? getCanvasNodeHeight(node.type, node.id, {}),
      },
      targetHeight: getCanvasNodeHeight(type, "", {}),
    });
    const newNodeId = onAddDownstreamNode(type, preferredPosition);
    if (newNodeId && type !== "from") {
      setTimeout(() => addEdge(node.id, newNodeId), 50);
    }
  }, [onAddDownstreamNode, node.id, node.type, addEdge, position, size.height, size.width]);

  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        zIndex: presentationMode ? 20 : isSelected ? 100 : 10,
        width: size.width,
        height: size.height,
        minHeight: size.minHeight,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (presentationMode) return;
        onSelect(e);
      }}
    >
      <NodeShell
        nodeType={node.type}
        nodeId={node.id}
        nodeName={getNodeDisplayName(node, presentationMode)}
        status={node.status}
        error={node.error}
        isSelected={presentationMode ? false : isSelected}
        presentationMode={presentationMode}
        onDragStart={onDragStart}
        onPortDragStart={onPortDragStart}
        onDelete={onDelete}
        onCopy={onCopyNode ? () => onCopyNode(node.id) : undefined}
        onDuplicate={onDuplicateNode ? () => onDuplicateNode(node.id) : undefined}
        onAddDownstream={presentationMode ? undefined : onAddDownstreamNode ? handleAddDownstream : undefined}
        showInputPort={presentationMode ? false : showInputPort}
        inputPortCount={presentationMode ? 0 : inputPortCount}
        showOutputPort={presentationMode ? false : showOutputPort}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onResizeStart={presentationMode ? undefined : onResizeStart}
        fillParent={Boolean(size.height)}
      >
        {getNodeBody(node, presentationMode, expandsTablePreview)}
      </NodeShell>
    </div>
  );
}
