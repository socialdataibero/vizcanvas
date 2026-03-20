export type MenuScope = "node" | "selection";

export function getMenuScope(itemCount: number): MenuScope {
  return itemCount > 1 ? "selection" : "node";
}

export function getMenuTitle(scope: MenuScope): string {
  return scope === "selection" ? "Selection actions" : "Node actions";
}

export function getFrameMenuTitle(): string {
  return "Frame actions";
}

export function getCopyLabel(scope: MenuScope): string {
  return scope === "selection" ? "Copy selection" : "Copy node";
}

export function getDuplicateLabel(scope: MenuScope): string {
  return scope === "selection" ? "Duplicate selection" : "Duplicate node";
}

export function getDeleteLabel(scope: MenuScope): string {
  return scope === "selection" ? "Delete selection" : "Delete node";
}

export function getLinkLabel(scope: MenuScope): string {
  return scope === "selection" ? "Copy selection link" : "Copy node link";
}

export function getPresentationLinkLabel(scope: MenuScope): string {
  return scope === "selection"
    ? "Copy selection presentation link"
    : "Copy node presentation link";
}

export function getCreateFrameLabel(scope: MenuScope): string {
  return scope === "selection"
    ? "Create frame from selection"
    : "Create frame from node";
}
