"use client";

import React from "react";

interface Props {
  onClose: () => void;
}

const shortcuts = [
  { category: "Navigation", items: [
    { keys: "Scroll / Two-finger", desc: "Pan canvas" },
    { keys: "⌘ + Scroll", desc: "Zoom in/out" },
    { keys: "Alt + Drag", desc: "Pan canvas" },
    { keys: "Shift + 0", desc: "Zoom to 100%" },
  ]},
  { category: "Nodes", items: [
    { keys: "Right-click", desc: "Add node menu" },
    { keys: "Delete / ⌫", desc: "Delete selected" },
    { keys: "Click port → Drag", desc: "Connect nodes" },
  ]},
  { category: "General", items: [
    { keys: "⌘ + .", desc: "Toggle focus mode" },
    { keys: "⌘ + Enter", desc: "Run SQL query" },
  ]},
];

export default function ShortcutsModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-[420px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {shortcuts.map((cat) => (
            <div key={cat.category}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{cat.category}</h3>
              <div className="space-y-1.5">
                {cat.items.map((item) => (
                  <div key={item.keys} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{item.desc}</span>
                    <kbd className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600 border border-gray-200">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
