export type ContextMenuItem =
  | {
      type: "item";
      label: string;
      icon?: string;
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
