"use client";

import React from "react";
import { NodePaletteGroup } from "@/lib/nodeConfig";
import { NodeType } from "@/types/nodes";

interface AddAnalysisStepMenuProps {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  groups: NodePaletteGroup[];
  onAddNode: (type: NodeType, position?: { x: number; y: number }) => void;
  onClose: () => void;
}

export default function AddAnalysisStepMenu({
  x,
  y,
  canvasX,
  canvasY,
  groups,
  onAddNode,
  onClose,
}: AddAnalysisStepMenuProps) {
  return (
    <div
      className="context-menu absolute z-50"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="context-menu-label">Add Analysis Step</div>
      {groups.map((group, groupIndex) => (
        <React.Fragment key={group.id}>
          {groupIndex > 0 ? <div className="context-menu-separator" /> : null}
          <div className="context-menu-label">{group.label}</div>
          {group.items.map((item) => (
            <button
              key={item.type}
              className="context-menu-item"
              onClick={() => {
                onAddNode(item.type, { x: canvasX, y: canvasY });
                onClose();
              }}
            >
              {React.createElement(item.icon, { className: "h-4 w-4" })}
              {item.label}
            </button>
          ))}
        </React.Fragment>
      ))}
      <button className="context-menu-item text-gray-400" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
