import { useCallback } from "react";
import { buildCanvasShareUrl } from "@/lib/canvasShareLinks";
import { CanvasFrame } from "@/types/canvas";
import { DAGNode } from "@/engine/types";

interface UseCanvasShareLinksParams {
  currentPageId: string;
  visibleNodes: Record<string, DAGNode>;
  getFrameById: (frameId: string) => CanvasFrame | null;
  persistCanvasStateNow?: () => void;
}

export function useCanvasShareLinks({
  currentPageId,
  visibleNodes,
  getFrameById,
  persistCanvasStateNow,
}: UseCanvasShareLinksParams) {
  const copyFrameLink = useCallback(async (frameId: string, presentation = false) => {
    persistCanvasStateNow?.();
    const frame = getFrameById(frameId);
    const url = buildCanvasShareUrl();
    url.searchParams.set("page", frame?.pageId ?? currentPageId);
    url.searchParams.set("frame", frameId);

    if (presentation) {
      url.searchParams.set("mode", "present");
    }

    await navigator.clipboard?.writeText(url.toString());
  }, [currentPageId, getFrameById, persistCanvasStateNow]);

  const copyNodeLink = useCallback(async (nodeIds: string[], presentation = false) => {
    const scopedNodeIds = Array.from(new Set(nodeIds)).filter((nodeId) => Boolean(visibleNodes[nodeId]));
    if (scopedNodeIds.length === 0) return;

    persistCanvasStateNow?.();
    const url = buildCanvasShareUrl();
    url.searchParams.set("page", currentPageId);
    url.searchParams.set("nodes", scopedNodeIds.join(","));

    if (presentation) {
      url.searchParams.set("mode", "present");
    }

    await navigator.clipboard?.writeText(url.toString());
  }, [currentPageId, persistCanvasStateNow, visibleNodes]);

  return {
    copyFrameLink,
    copyNodeLink,
  };
}
