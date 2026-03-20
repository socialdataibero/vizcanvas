"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  description: string;
}

export default function NodeInfoTooltip({ title, description }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const tooltipWidth = 224;
      const gap = 14;
      const viewportPadding = 12;
      const fitsRight = rect.right + gap + tooltipWidth < window.innerWidth - viewportPadding;
      const left = fitsRight
        ? rect.right + gap
        : Math.max(viewportPadding, rect.left - gap - tooltipWidth);
      const top = rect.top + rect.height / 2;

      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  return (
    <div
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        ref={buttonRef}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-200 bg-white text-[10px] font-semibold text-gray-500 transition hover:border-gray-300 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        aria-label={title}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-none fixed z-[1200] w-56 -translate-y-1/2 rounded-xl border border-gray-200 bg-white/95 p-3 text-left text-[10px] leading-relaxed text-gray-600 shadow-[0_12px_30px_rgba(15,23,42,0.14)] backdrop-blur"
          style={{ left: position.left, top: position.top }}
        >
          <div className="text-[10px] font-semibold text-gray-800">{title}</div>
          <div className="mt-1">{description}</div>
        </div>,
        document.body
      )}
    </div>
  );
}
