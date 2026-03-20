import { createContextMenuSeparator, ContextMenuItem } from "@/lib/contextMenu";
import {
  getCopyLabel,
  getCreateFrameLabel,
  getDeleteLabel,
  getDuplicateLabel,
  getLinkLabel,
  getPresentationLinkLabel,
  MenuScope,
} from "@/lib/contextMenuLabels";
import { APP_ICONS, getNodeTypeIcon } from "@/lib/iconography";

interface BuildNodeOptionsMenuItemsParams {
  scope: MenuScope;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function buildNodeOptionsMenuItems({
  scope,
  onCopy,
  onDuplicate,
  onDelete,
}: BuildNodeOptionsMenuItemsParams): ContextMenuItem[] {
  return [
    {
      type: "item",
      icon: APP_ICONS.copy,
      label: getCopyLabel(scope),
      shortcut: "⌘C",
      onSelect: onCopy,
    },
    {
      type: "item",
      icon: APP_ICONS.duplicate,
      label: getDuplicateLabel(scope),
      shortcut: "⌘D",
      onSelect: onDuplicate,
    },
    createContextMenuSeparator(),
    {
      type: "item",
      icon: APP_ICONS.delete,
      label: getDeleteLabel(scope),
      shortcut: "⌫",
      danger: true,
      onSelect: onDelete,
    },
  ];
}

interface BuildNodeContextMenuItemsParams {
  scope: MenuScope;
  onDuplicate: () => void;
  onCopy: () => void;
  onMakeChart: () => void;
  onViewTable: () => void;
  onCopyLink: () => void;
  onCopyPresentationLink: () => void;
  onCreateFrame: () => void;
  onDelete: () => void;
}

export function buildNodeContextMenuItems({
  scope,
  onDuplicate,
  onCopy,
  onMakeChart,
  onViewTable,
  onCopyLink,
  onCopyPresentationLink,
  onCreateFrame,
  onDelete,
}: BuildNodeContextMenuItemsParams): ContextMenuItem[] {
  return [
    {
      type: "item",
      icon: APP_ICONS.duplicate,
      label: getDuplicateLabel(scope),
      shortcut: "⌘D",
      onSelect: onDuplicate,
    },
    {
      type: "item",
      icon: APP_ICONS.copy,
      label: getCopyLabel(scope),
      shortcut: "⌘C",
      onSelect: onCopy,
    },
    createContextMenuSeparator(),
    {
      type: "item",
      icon: getNodeTypeIcon("chart"),
      label: "Make chart",
      shortcut: "⌘⇧K",
      onSelect: onMakeChart,
    },
    {
      type: "item",
      icon: getNodeTypeIcon("table"),
      label: "View table",
      onSelect: onViewTable,
    },
    createContextMenuSeparator(),
    {
      type: "item",
      icon: APP_ICONS.link,
      label: getLinkLabel(scope),
      onSelect: onCopyLink,
    },
    {
      type: "item",
      icon: APP_ICONS.presentationLink,
      label: getPresentationLinkLabel(scope),
      onSelect: onCopyPresentationLink,
    },
    {
      type: "item",
      icon: APP_ICONS.frame,
      label: getCreateFrameLabel(scope),
      onSelect: onCreateFrame,
    },
    createContextMenuSeparator(),
    {
      type: "item",
      icon: APP_ICONS.delete,
      label: getDeleteLabel(scope),
      shortcut: "⌫",
      danger: true,
      onSelect: onDelete,
    },
  ];
}

interface BuildFrameContextMenuItemsParams {
  onRename: () => void;
  onCopyLink: () => void;
  onCopyPresentationLink: () => void;
  onDelete: () => void;
}

export function buildFrameContextMenuItems({
  onRename,
  onCopyLink,
  onCopyPresentationLink,
  onDelete,
}: BuildFrameContextMenuItemsParams): ContextMenuItem[] {
  return [
    {
      type: "item",
      icon: APP_ICONS.rename,
      label: "Rename frame",
      onSelect: onRename,
    },
    {
      type: "item",
      icon: APP_ICONS.link,
      label: "Copy frame link",
      onSelect: onCopyLink,
    },
    {
      type: "item",
      icon: APP_ICONS.presentationLink,
      label: "Copy frame presentation link",
      onSelect: onCopyPresentationLink,
    },
    createContextMenuSeparator(),
    {
      type: "item",
      icon: APP_ICONS.delete,
      label: "Delete frame",
      danger: true,
      onSelect: onDelete,
    },
  ];
}
