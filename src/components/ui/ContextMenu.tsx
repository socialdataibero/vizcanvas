"use client";

import React from "react";
import { ContextMenuItem } from "@/lib/contextMenu";

interface ContextMenuProps {
  items: ContextMenuItem[];
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export default function ContextMenu({
  items,
  title,
  className,
  style,
  onClick,
}: ContextMenuProps) {
  return (
    <div className={className ?? "context-menu"} style={style} onClick={onClick}>
      {title ? <div className="context-menu-label">{title}</div> : null}
      {items.map((item, index) => {
        if (item.type === "separator") {
          return <div key={`separator-${index}`} className="context-menu-separator" />;
        }

        const Icon = item.icon;
        return (
          <button
            key={`${item.label}-${index}`}
            className={`context-menu-item${item.danger ? " danger" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              item.onSelect();
            }}
          >
            {Icon ? <Icon className="h-4 w-4 flex-shrink-0" /> : <span className="h-4 w-4 flex-shrink-0" />}
            {item.label}
            {item.shortcut ? <span className="shortcut">{item.shortcut}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
