import { useEffect, useMemo, useState } from "react";
import { CanvasFrame, CanvasPage } from "@/types/canvas";
import { DAGNode } from "@/engine/types";
import { getNodeTypeLabel } from "@/lib/utils";

interface UseCanvasPresentationParams {
  hydrated: boolean;
  currentPageId: string;
  pages: CanvasPage[];
  frames: CanvasFrame[];
  nodes: Record<string, DAGNode>;
  setCurrentPage: (pageId: string) => void;
}

export function useCanvasPresentation({
  hydrated,
  currentPageId,
  pages,
  frames,
  nodes,
  setCurrentPage,
}: UseCanvasPresentationParams) {
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationFrameId, setPresentationFrameId] = useState<string | null>(null);
  const [sharedNodeIds, setSharedNodeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const requestedPageId = params.get("page");
    const requestedMode = params.get("mode");
    const requestedFrameId = params.get("frame");
    const requestedNodeIds = (params.get("nodes") ?? "")
      .split(",")
      .map((nodeId) => nodeId.trim())
      .filter(Boolean);
    const hasRequestedNodes = requestedNodeIds.length > 0;

    if (requestedPageId && pages.some((page) => page.id === requestedPageId) && requestedPageId !== currentPageId) {
      setCurrentPage(requestedPageId);
    }

    setPresentationFrameId(
      requestedMode === "present" && !hasRequestedNodes ? requestedFrameId : null
    );
    setSharedNodeIds(requestedNodeIds);
    setPresentationMode(requestedMode === "present");
  }, [currentPageId, hydrated, pages, setCurrentPage]);

  const presentationFrame = useMemo(
    () =>
      presentationMode && presentationFrameId
        ? frames.find((frame) => frame.id === presentationFrameId) ?? null
        : null,
    [frames, presentationFrameId, presentationMode]
  );

  const presentationNodes = useMemo(
    () =>
      presentationMode && !presentationFrame
        ? sharedNodeIds
            .map((nodeId) => nodes[nodeId])
            .filter((node): node is DAGNode => Boolean(node && node.pageId === currentPageId))
        : [],
    [currentPageId, nodes, presentationFrame, presentationMode, sharedNodeIds]
  );

  const presentationTitle = useMemo(() => {
    if (presentationFrame) return presentationFrame.name;
    if (presentationNodes.length === 1) return getNodeTypeLabel(presentationNodes[0].type);
    if (presentationNodes.length > 1) return `${presentationNodes.length} nodes`;
    return null;
  }, [presentationFrame, presentationNodes]);

  const showPresentationTitle = useMemo(
    () => Boolean(presentationFrame) || presentationNodes.length > 1,
    [presentationFrame, presentationNodes.length]
  );

  return {
    presentationMode,
    presentationFrameId,
    sharedNodeIds,
    presentationFrame,
    presentationNodes,
    presentationTitle,
    showPresentationTitle,
  };
}
