"use client";

import React from "react";
import { createPortal } from "react-dom";
import AddAnalysisStepMenu from "@/components/canvas/AddAnalysisStepMenu";
import ContextMenu from "@/components/ui/ContextMenu";
import { ContextMenuItem } from "@/lib/contextMenu";
import { NodePaletteGroup } from "@/lib/nodeConfig";
import { NodeType } from "@/types/nodes";

interface CanvasMenusOverlayProps {
  canvasContextMenu: {
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
  } | null;
  nodeContextMenu: {
    x: number;
    y: number;
  } | null;
  frameContextMenu: {
    x: number;
    y: number;
  } | null;
  nodeContextMenuTitle: string;
  nodeContextMenuItems: ContextMenuItem[];
  frameContextMenuTitle: string;
  frameContextMenuItems: ContextMenuItem[];
  nodeGroups: NodePaletteGroup[];
  onAddNode: (type: NodeType, position?: { x: number; y: number }) => void;
  onCloseMenus: () => void;
}

export default function CanvasMenusOverlay({
  canvasContextMenu,
  nodeContextMenu,
  frameContextMenu,
  nodeContextMenuTitle,
  nodeContextMenuItems,
  frameContextMenuTitle,
  frameContextMenuItems,
  nodeGroups,
  onAddNode,
  onCloseMenus,
}: CanvasMenusOverlayProps) {
  return (
    <>
      {canvasContextMenu ? (
        <AddAnalysisStepMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          canvasX={canvasContextMenu.canvasX}
          canvasY={canvasContextMenu.canvasY}
          groups={nodeGroups}
          onAddNode={onAddNode}
          onClose={onCloseMenus}
        />
      ) : null}

      {nodeContextMenu ? (
        <ContextMenu
          title={nodeContextMenuTitle}
          items={nodeContextMenuItems}
          className="context-menu absolute z-50"
          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        />
      ) : null}

      {frameContextMenu && typeof document !== "undefined"
        ? createPortal(
            <ContextMenu
              title={frameContextMenuTitle}
              items={frameContextMenuItems}
              className="context-menu fixed z-[120]"
              style={{ left: frameContextMenu.x, top: frameContextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            />,
            document.body
          )
        : null}
    </>
  );
}
