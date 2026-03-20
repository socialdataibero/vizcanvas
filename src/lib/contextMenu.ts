import type { IconType } from "react-icons";

export type ContextMenuItem =
  | {
      type: "item";
      label: string;
      icon?: IconType;
      shortcut?: string;
      danger?: boolean;
      onSelect: () => void;
    }
  | {
      type: "separator";
    };

export function createContextMenuSeparator(): ContextMenuItem {
  return { type: "separator" };
}
