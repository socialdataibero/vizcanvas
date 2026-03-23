import { DAGEdge } from "@/engine/types";

export function getInputPortCount(nodeType: string): number {
  if (nodeType === "from") return 0;
  if (nodeType === "join") return 2;
  return 1;
}

export function getInputPortOffsetPercent(inputCount: number, inputIndex: number): number {
  if (inputCount <= 1) return 50;
  if (inputCount === 2) return inputIndex === 0 ? 38 : 62;

  const safeIndex = Math.max(0, Math.min(inputIndex, inputCount - 1));
  return ((safeIndex + 1) / (inputCount + 1)) * 100;
}

interface ResolveTargetInputIndexParams {
  targetNodeId: string;
  targetNodeType: string;
  edges: DAGEdge[];
  explicitInputIndex?: number | null;
  dropClientY?: number;
  targetRect?: DOMRect;
}

export function resolveTargetInputIndex({
  targetNodeId,
  targetNodeType,
  edges,
  explicitInputIndex,
  dropClientY,
  targetRect,
}: ResolveTargetInputIndexParams): number {
  const inputCount = getInputPortCount(targetNodeType);
  if (inputCount <= 1) return 0;

  if (
    typeof explicitInputIndex === "number" &&
    Number.isInteger(explicitInputIndex) &&
    explicitInputIndex >= 0 &&
    explicitInputIndex < inputCount
  ) {
    return explicitInputIndex;
  }

  const usedInputs = new Set(
    edges
      .filter((edge) => edge.toNodeId === targetNodeId)
      .map((edge) => edge.toInputIndex)
      .filter((index) => index >= 0 && index < inputCount)
  );

  const firstFreeInput = Array.from({ length: inputCount }, (_, index) => index).find(
    (index) => !usedInputs.has(index)
  );

  if (firstFreeInput !== undefined) {
    return firstFreeInput;
  }

  if (targetRect && typeof dropClientY === "number" && targetRect.height > 0) {
    const yRatio = (dropClientY - targetRect.top) / targetRect.height;
    let closestInput = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) {
      const anchorRatio = getInputPortOffsetPercent(inputCount, inputIndex) / 100;
      const distance = Math.abs(yRatio - anchorRatio);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestInput = inputIndex;
      }
    }

    return closestInput;
  }

  return 0;
}
