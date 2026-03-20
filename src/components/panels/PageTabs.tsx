"use client";

import React, { useEffect, useState } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { APP_ICONS } from "@/lib/iconography";

interface PageTabsProps {
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onRenamePage: (pageId: string, name: string) => void;
  onDeletePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
}

export default function PageTabs({
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onDuplicatePage,
}: PageTabsProps) {
  const pages = useCanvasStore((s) => s.pages);
  const currentPageId = useCanvasStore((s) => s.currentPageId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    pageId: string;
    pageCount: number;
    currentPageId: string;
  } | null>(null);
  const RenameIcon = APP_ICONS.rename;
  const DuplicateIcon = APP_ICONS.duplicate;
  const DeleteIcon = APP_ICONS.delete;
  const contextMenuId =
    contextMenuState &&
    contextMenuState.pageCount === pages.length &&
    contextMenuState.currentPageId === currentPageId &&
    pages.some((page) => page.id === contextMenuState.pageId)
      ? contextMenuState.pageId
      : null;

  useEffect(() => {
    if (!contextMenuId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-page-tabs-root]")) return;
      setContextMenuState(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenuId]);

  return (
    <div className="panel flex items-center gap-0.5 px-1 py-1" data-page-tabs-root>
      {pages.map((page) => (
        <div key={page.id} className="relative">
          {editingId === page.id ? (
            <input
              autoFocus
              defaultValue={page.name}
              className="h-7 w-20 rounded border border-indigo-400 px-2 text-xs outline-none"
              onBlur={(e) => {
                onRenamePage(page.id, e.target.value || page.name);
                setEditingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRenamePage(page.id, (e.target as HTMLInputElement).value || page.name);
                  setEditingId(null);
                }
              }}
            />
          ) : (
            <button
              className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
                currentPageId === page.id
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
              onClick={() => {
                setContextMenuState(null);
                onSelectPage(page.id);
              }}
              onDoubleClick={() => setEditingId(page.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuState({
                  pageId: page.id,
                  pageCount: pages.length,
                  currentPageId,
                });
              }}
            >
              {page.name}
            </button>
          )}

          {/* Page context menu */}
          {contextMenuId === page.id && (
            <div className="context-menu absolute bottom-full left-0 mb-1 z-50">
              <button className="context-menu-item" onClick={() => { setEditingId(page.id); setContextMenuState(null); }}>
                <RenameIcon className="h-4 w-4" /> Rename
              </button>
              <button className="context-menu-item" onClick={() => { onDuplicatePage(page.id); setContextMenuState(null); }}>
                <DuplicateIcon className="h-4 w-4" /> Duplicate
              </button>
              {pages.length > 1 && (
                <button className="context-menu-item text-red-600" onClick={() => { onDeletePage(page.id); setContextMenuState(null); }}>
                  <DeleteIcon className="h-4 w-4" /> Delete
                </button>
              )}
              <button className="context-menu-item text-gray-400" onClick={() => setContextMenuState(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => {
          setContextMenuState(null);
          onAddPage();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-xs"
        title="Add page"
      >
        +
      </button>
    </div>
  );
}
