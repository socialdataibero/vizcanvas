import { useEffect, useMemo } from "react";
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
  const search = hydrated && typeof window !== "undefined" ? window.location.search : "";

  const presentationRequest = useMemo(() => {
    if (!hydrated || typeof window === "undefined") {
      return {
        requestedPageId: null,
        requestedMode: null,
        requestedFrameId: null,
        requestedNodeIds: [] as string[],
      };
    }

    const params = new URLSearchParams(search);
    return {
      requestedPageId: params.get("page"),
      requestedMode: params.get("mode"),
      requestedFrameId: params.get("frame"),
      requestedNodeIds: (params.get("nodes") ?? "")
        .split(",")
        .map((nodeId) => nodeId.trim())
        .filter(Boolean),
    };
  }, [hydrated, search]);

  const presentationMode = presentationRequest.requestedMode === "present";
  const sharedNodeIds = presentationRequest.requestedNodeIds;
  const presentationFrameId =
    presentationMode && sharedNodeIds.length === 0
      ? presentationRequest.requestedFrameId
      : null;

  useEffect(() => {
    const { requestedPageId } = presentationRequest;

    if (
      requestedPageId &&
      requestedPageId !== currentPageId &&
      pages.some((page) => page.id === requestedPageId)
    ) {
      setCurrentPage(requestedPageId);
    }
  }, [currentPageId, pages, presentationRequest, setCurrentPage]);

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
