"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ContextMenu from "@/components/ui/ContextMenu";
import { ResizeDirection } from "@/lib/canvasInteractionTypes";
import { buildNodeOptionsMenuItems } from "@/lib/contextMenuActions";
import { getMenuTitle } from "@/lib/contextMenuLabels";
import { CONTEXT_MENU_NODE_GROUPS } from "@/lib/nodeConfig";
import { CANVAS_VIEWPORT_CHANGE_EVENT } from "@/lib/canvasViewportEvents";
import { getInputPortOffsetPercent } from "@/lib/inputPorts";
import { getNodeTypeLabel } from "@/lib/utils";
import { getNodeTypeIcon } from "@/lib/iconography";
import { NodeType } from "@/types/nodes";

const NODE_HEADER_COLORS: Record<string, string> = {
  from:       "#1e3a5f",
  sql:        "#5b21b6",
  chart:      "#0f766e",
  join:       "#b45309",
  group:      "#be185d",
  table:      "#1d4ed8",
  distinct:   "#0e7490",
  javascript: "#c2410c",
  controls:   "#0369a1",
};

const RESIZE_DIRECTIONS: ResizeDirection[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function formatNodeError(nodeType: string, error?: string) {
  if (!error) return null;

  const normalizedError = error.replace(/^Error:\s*/i, "").trim();

  if (
    nodeType === "sql" &&
    normalizedError.includes('Connect an input table first. "SELECT * FROM input" only works when this SQL node has an upstream table.')
  ) {
    return 'Connect a table first. The alias "input" is only available when this SQL node has an upstream connection.';
  }

  return normalizedError;
}

interface Props {
  nodeType: string;
  nodeId: string;
  nodeName?: string;
  status: string;
  error?: string;
  isSelected: boolean;
  presentationMode?: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onPortDragStart: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onAddDownstream?: (type: NodeType) => void;
  children: React.ReactNode;
  showInputPort?: boolean;
  inputPortCount?: number;
  showOutputPort?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onResizeStart?: (direction: ResizeDirection, e: React.MouseEvent<HTMLDivElement>) => void;
  fillParent?: boolean;
}

export default function NodeShell({
  nodeType,
  nodeId,
  nodeName,
  status,
  error,
  isSelected,
  presentationMode = false,
  onDragStart,
  onPortDragStart,
  onDelete,
  onCopy,
  onDuplicate,
  onAddDownstream,
  children,
  showInputPort = true,
  inputPortCount = 1,
  showOutputPort = true,
  collapsed,
  onToggleCollapse,
  onResizeStart,
  fillParent = false,
}: Props) {
  const scope = "node" as const;
  const label = getNodeTypeLabel(nodeType);
  const headerColor = NODE_HEADER_COLORS[nodeType] || "#374151";

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const addMenuButtonRef = useRef<HTMLButtonElement>(null);
  const addMenuContentRef = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const optionsContentRef = useRef<HTMLDivElement>(null);
  const [addMenuPosition, setAddMenuPosition] = useState({ top: 0, left: 0 });
  const [optionsMenuPosition, setOptionsMenuPosition] = useState({ top: 0, left: 0 });

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedAddButton = addMenuButtonRef.current?.contains(target);
      const clickedAddMenu = addMenuContentRef.current?.contains(target);
      const clickedOptionsButton = optionsButtonRef.current?.contains(target);
      const clickedOptionsMenu = optionsContentRef.current?.contains(target);
      if (!clickedAddButton && !clickedAddMenu) {
        setAddMenuOpen(false);
      }
      if (!clickedOptionsButton && !clickedOptionsMenu) {
        setOptionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handleViewportChange = () => {
      setAddMenuOpen(false);
      setOptionsOpen(false);
    };

    window.addEventListener(CANVAS_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    return () => {
      window.removeEventListener(CANVAS_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (!addMenuOpen) return;

    const updatePosition = () => {
      const rect = addMenuButtonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuWidth = 250;
      const gap = 14;
      const viewportPadding = 12;
      const preferredLeft = rect.right + gap;
      const fitsRight = preferredLeft + menuWidth < window.innerWidth - viewportPadding;
      const left = fitsRight
        ? preferredLeft
        : Math.max(viewportPadding, rect.left - gap - menuWidth);
      const top = rect.top + 26;

      setAddMenuPosition({ left, top });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    if (!optionsOpen) return;

    const updatePosition = () => {
      const rect = optionsButtonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuWidth = 160;
      const viewportPadding = 12;
      const left = Math.min(
        window.innerWidth - menuWidth - viewportPadding,
        Math.max(viewportPadding, rect.right - menuWidth)
      );
      const top = Math.min(
        window.innerHeight - viewportPadding,
        rect.bottom + 6
      );

      setOptionsMenuPosition({ left, top });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [optionsOpen]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (presentationMode) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea")) return;
    onDragStart(e);
  };

  const handleWheelCapture = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    e.stopPropagation();
  };

  const displayName = nodeName || `${label}_${nodeId.slice(0, 6)}`;
  const displayError = formatNodeError(nodeType, error);
  const optionsMenuItems = buildNodeOptionsMenuItems({
    scope,
    onCopy: () => {
      onCopy?.();
      setOptionsOpen(false);
    },
    onDuplicate: () => {
      onDuplicate?.();
      setOptionsOpen(false);
    },
    onDelete: () => {
      onDelete();
      setOptionsOpen(false);
    },
  });

  return (
    <div
      data-node-id={nodeId}
      className={`data-node ${presentationMode ? "presentation-node" : ""} ${isSelected ? "selected" : ""} ${status === "error" ? "error" : ""} ${status === "running" ? "running" : ""}`}
      style={{ position: "relative", width: "100%", height: fillParent ? "100%" : undefined }}
    >
      {/* Input port */}
      {showInputPort && Array.from({ length: inputPortCount }).map((_, inputIndex) => (
        <div
          key={`input-${inputIndex}`}
          className="port input"
          data-input-index={inputIndex}
          style={{
            background: headerColor,
            top: `${getInputPortOffsetPercent(inputPortCount, inputIndex)}%`,
          }}
          title={
            inputPortCount > 1
              ? `Drop connection on input ${inputIndex + 1}`
              : "Drop connection here"
          }
        />
      ))}

      {/* Output port */}
      {showOutputPort && (
        <div
          className="port output"
          style={{ background: headerColor }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPortDragStart();
          }}
          title="Drag to connect"
        />
      )}

      {/* [+] Add downstream button */}
      {onAddDownstream && !presentationMode && (
        <div
          className="absolute z-20"
          style={{ top: -12, right: -12 }}
        >
          <button
            ref={addMenuButtonRef}
            onClick={(e) => { e.stopPropagation(); setAddMenuOpen((v) => !v); }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 shadow text-gray-500 hover:border-teal-400 hover:text-teal-600 text-xs font-bold transition-all"
            style={{ borderColor: isSelected ? "#3b82f6" : "#d1d5db" }}
            title="Add next step"
          >
            +
          </button>
        </div>
      )}

      {addMenuOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={addMenuContentRef}
          className="context-menu node-add-dropdown fixed"
          style={{ top: addMenuPosition.top, left: addMenuPosition.left }}
        >
          <div className="context-menu-label">Add analysis step</div>
          {CONTEXT_MENU_NODE_GROUPS.map((group, groupIndex) => (
            <React.Fragment key={group.id}>
              {groupIndex > 0 && <div className="context-menu-separator" />}
              <div className="context-menu-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.type}
                  className="context-menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddDownstream?.(item.type);
                    setAddMenuOpen(false);
                  }}
                >
                  {React.createElement(item.icon, { className: "h-4 w-4" })}
                  {item.label}
                </button>
              ))}
            </React.Fragment>
          ))}
          <button
            className="context-menu-item text-gray-400"
            onClick={(e) => {
              e.stopPropagation();
              setAddMenuOpen(false);
            }}
          >
            Cancel
          </button>
        </div>,
        document.body
      )}

      {onResizeStart && !presentationMode && RESIZE_DIRECTIONS.map((direction) => (
        <div
          key={direction}
          className={`resize-handle resize-${direction}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(direction, e);
          }}
        />
      ))}

      <div className="data-node-inner">
        {/* Header */}
        <div
          className={`node-header ${presentationMode ? "presentation-header" : ""}`}
          onMouseDown={handleHeaderMouseDown}
        >
          {/* Type badge */}
          <span
            className="node-header-type"
            style={{ background: headerColor }}
          >
            {React.createElement(getNodeTypeIcon(nodeType), {
              className: "h-3.5 w-3.5",
            })}
            <span>{label}</span>
          </span>

          {/* Collapse toggle (») */}
          {onToggleCollapse && !presentationMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-[10px] flex-shrink-0"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? "▶" : "◀"}
            </button>
          )}

          {/* Node name */}
          <span className="node-name" title={displayName}>{displayName}</span>

          {/* Status */}
          {!presentationMode && status === "running" && (
            <span className="status-badge running flex-shrink-0">
              <span className="animate-spin inline-block">↻</span>
            </span>
          )}
          {!presentationMode && status === "success" && (
            <span className="node-timestamp flex-shrink-0">Just now</span>
          )}
          {!presentationMode && status === "error" && (
            <span className="status-badge error flex-shrink-0">!</span>
          )}

          {/* ⋮ Options menu */}
          {!presentationMode && <div className="relative flex-shrink-0">
            <button
              ref={optionsButtonRef}
              onClick={(e) => { e.stopPropagation(); setOptionsOpen((v) => !v); }}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 text-sm"
            >
              ⋮
            </button>
            {optionsOpen && typeof document !== "undefined" && createPortal(
              <div ref={optionsContentRef}>
                <ContextMenu
                  title={getMenuTitle(scope)}
                  items={optionsMenuItems}
                  className="context-menu fixed"
                  style={{ top: optionsMenuPosition.top, left: optionsMenuPosition.left, minWidth: "160px", zIndex: 2000 }}
                />
              </div>,
              document.body
            )}
          </div>}
        </div>

        {/* Error message */}
        {displayError && (
          <div className="subtle-scrollbar border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 break-words max-h-[60px] overflow-y-auto">
            {displayError.length > 200 ? displayError.slice(0, 200) + "..." : displayError}
          </div>
        )}

        {/* Body */}
        {!collapsed && (
          <div
            className={`node-body subtle-scrollbar ${presentationMode ? "presentation-body" : ""}`}
            onWheelCapture={handleWheelCapture}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
