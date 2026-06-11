"use client";

import { useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  title: string;
  message: string;
  type?: "info" | "error" | "warning" | "confirm";
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
}

const icons = {
  info: "ℹ️",
  error: "✕",
  warning: "⚠️",
  confirm: "?",
};

const colors = {
  info: "text-blue-600 bg-blue-50",
  error: "text-red-600 bg-red-50",
  warning: "text-amber-600 bg-amber-50",
  confirm: "text-gray-600 bg-gray-100",
};

export default function Dialog({
  open,
  title,
  message,
  type = "info",
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  onConfirm,
  onClose,
}: DialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmBtnRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && onConfirm) onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${colors[type]}`}>
              {icons[type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{title}</p>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 bg-gray-50">
          {type === "confirm" && (
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            onClick={() => { onConfirm?.(); onClose(); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors ${
              type === "error" ? "bg-red-500 hover:bg-red-600" :
              type === "confirm" ? "bg-red-500 hover:bg-red-600" :
              "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
