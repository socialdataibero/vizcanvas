"use client";

import React, { useEffect, useState } from "react";
import { useCanvasStore } from "@/stores/canvasStore";

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
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  useEffect(() => {
    setContextMenuId(null);
  }, [currentPageId, pages.length]);

  useEffect(() => {
    if (!contextMenuId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-page-tabs-root]")) return;
      setContextMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuId(null);
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
                setContextMenuId(null);
                onSelectPage(page.id);
              }}
              onDoubleClick={() => setEditingId(page.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuId(page.id);
              }}
            >
              {page.name}
            </button>
          )}

          {/* Page context menu */}
          {contextMenuId === page.id && (
            <div className="context-menu absolute bottom-full left-0 mb-1 z-50">
              <button className="context-menu-item" onClick={() => { setEditingId(page.id); setContextMenuId(null); }}>
                ✏️ Rename
              </button>
              <button className="context-menu-item" onClick={() => { onDuplicatePage(page.id); setContextMenuId(null); }}>
                📋 Duplicate
              </button>
              {pages.length > 1 && (
                <button className="context-menu-item text-red-600" onClick={() => { onDeletePage(page.id); setContextMenuId(null); }}>
                  🗑️ Delete
                </button>
              )}
              <button className="context-menu-item text-gray-400" onClick={() => setContextMenuId(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => {
          setContextMenuId(null);
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
