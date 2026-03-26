// ─── 1. X-axis tick rotation ─────────────────────────────────────────────────

/** Returns -45 when there are more than 8 x-axis categories, otherwise 0. */
export function getXTickRotation(categoryCount: number): number {
  return categoryCount > 8 ? -45 : 0;
}

// ─── 2. Tooltip mark options ─────────────────────────────────────────────────

/** Builds the channel options object for a Plot.tip pointer mark. */
export function buildTipMarkOptions(
  xColumn: string,
  yColumn: string,
  colorColumn?: string
): Record<string, unknown> {
  const opts: Record<string, unknown> = { x: xColumn, y: yColumn };
  if (colorColumn) opts.fill = colorColumn;
  return opts;
}

// ─── 3. Sort bars by total descending ────────────────────────────────────────

/** Returns Plot sort options that order x groups by the sum of y, descending. */
export function buildStackedSortOptions(): { x: string; reduce: string; reverse: boolean } {
  return { x: "y", reduce: "sum", reverse: true };
}

// ─── 4. High-variance detection (log scale hint) ─────────────────────────────

/**
 * Returns true when the ratio between the maximum and minimum positive values
 * exceeds 100, indicating that a log scale would improve readability.
 */
export function detectsHighVariance(values: number[]): boolean {
  const positives = values.filter((v) => v > 0);
  if (positives.length < 2) return false;
  const min = Math.min(...positives);
  const max = Math.max(...positives);
  return max / min > 100;
}

// ─── 5a. Max aggregated group sum ────────────────────────────────────────────

/**
 * Computes the maximum total y value across all x groups.
 * Used to determine the correct tick format range for stacked charts,
 * where the axis domain is the aggregated sum, not individual row values.
 */
export function computeMaxGroupSum(
  data: Record<string, unknown>[],
  xColumn: string,
  yColumn: string
): number {
  if (data.length === 0) return 0;

  const sums = new Map<unknown, number>();
  for (const row of data) {
    const key = row[xColumn];
    const raw = row[yColumn];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) continue;
    sums.set(key, (sums.get(key) ?? 0) + value);
  }

  if (sums.size === 0) return 0;
  return Math.max(...sums.values());
}

// ─── 5c. Left margin based on compact tick label width ───────────────────────

/**
 * Estimates the Y-axis left margin using the compact-formatted max value
 * (e.g. "15M" instead of "15,000,000"), preventing the chart from being
 * pushed too far right when raw values have many digits.
 */
export function getCompactAxisMargin(maxValue: number, fallback = 36): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return fallback;
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(maxValue);
  return Math.max(fallback, compact.length * 8 + 16);
}

// ─── 5d. Y-axis margin matching actual tick format ──────────────────────────

const MARGIN_FALLBACK = 36;
const CATEGORICAL_Y_MARGIN_MIN = 52;
const CATEGORICAL_Y_MARGIN_MAX = 110;
const CATEGORICAL_Y_FONT = '10px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export type StripChartMode = "simple" | "category" | "grouped";

/**
 * Computes the Y-axis left margin based on actual tick label width.
 * Uses compact format (e.g. "16M") for values ≥ 1000, matching
 * the tick format applied by formatAxisTickValue.
 */
export function computeYMargin(values: unknown[]): number {
  const nums = values
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((v) => Number.isFinite(v));

  if (nums.length === 0) return MARGIN_FALLBACK;

  const maxAbs = Math.max(...nums.map((v) => Math.abs(v)));
  if (maxAbs >= 1000) {
    return getCompactAxisMargin(maxAbs, MARGIN_FALLBACK);
  }

  const formatted = Math.round(maxAbs).toLocaleString();
  return Math.max(MARGIN_FALLBACK, formatted.length * 8 + 20);
}

/**
 * Computes the left margin for categorical Y-axis labels.
 * Prefers real text measurement via canvas and falls back to a character-based estimate.
 */
export function computeCategoricalYMargin(
  labels: string[],
  options?: { min?: number; max?: number; font?: string }
): number {
  if (labels.length === 0) return CATEGORICAL_Y_MARGIN_MIN;

  const min = options?.min ?? CATEGORICAL_Y_MARGIN_MIN;
  const max = options?.max ?? CATEGORICAL_Y_MARGIN_MAX;
  const font = options?.font ?? CATEGORICAL_Y_FONT;

  let widestLabel = 0;

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = font;
      widestLabel = Math.max(...labels.map((label) => context.measureText(label).width));
    }
  }

  if (!Number.isFinite(widestLabel) || widestLabel <= 0) {
    widestLabel = Math.max(...labels.map((label) => label.length * 6));
  }

  return Math.max(min, Math.min(max, Math.ceil(widestLabel + 20)));
}

export function shouldShowInlineCategoricalLegend(values: unknown[], maxItems = 8): boolean {
  return new Set(values.map((value) => String(value ?? ""))).size <= maxItems;
}

export function resolveStripChartMode(options: {
  hasCategory: boolean;
  hasGroup: boolean;
  categoryEqualsGroup: boolean;
  groupCardinality: number;
  maxLegendItems?: number;
}): { mode: StripChartMode; showLegend: boolean; useGroupColor: boolean } {
  const maxLegendItems = options.maxLegendItems ?? 8;

  if (!options.hasCategory) {
    return { mode: "simple", showLegend: false, useGroupColor: false };
  }

  if (!options.hasGroup || options.categoryEqualsGroup) {
    return { mode: "category", showLegend: false, useGroupColor: false };
  }

  if (options.groupCardinality > maxLegendItems) {
    return { mode: "category", showLegend: false, useGroupColor: false };
  }

  return { mode: "grouped", showLegend: true, useGroupColor: true };
}

// ─── 5b. Bottom margin computed from actual label lengths ────────────────────

/**
 * Computes the bottom margin needed so that rotated x-axis labels are not
 * clipped. Uses the length of the longest label and the rotation angle.
 * At -45° each character projects ~4.24 px vertically (6px * sin 45°).
 */
export function getMarginBottomForLabels(labels: string[], tickRotate: number): number {
  if (tickRotate === 0 || labels.length === 0) return 36;
  const maxLen = Math.max(...labels.map((l) => l.length));
  const angleRad = Math.abs(tickRotate) * (Math.PI / 180);
  const projected = Math.ceil(maxLen * 6 * Math.sin(angleRad));
  return Math.max(36, projected + 12);
}

// ─── 6. Plot size from container dimensions ──────────────────────────────────

const PLOT_PADDING = 16;
const MIN_PLOT_WIDTH = 340;
const MIN_PLOT_HEIGHT = 220;

/**
 * Computes plot width and height from the actual container dimensions,
 * ensuring the chart fills the available space instead of using a fixed
 * aspect-ratio cap.
 */
export function computePlotSize(
  containerWidth: number,
  containerHeight: number
): { width: number; height: number } {
  return {
    width: Math.max(MIN_PLOT_WIDTH, Math.floor(containerWidth - PLOT_PADDING)),
    height: Math.max(MIN_PLOT_HEIGHT, Math.floor(containerHeight - PLOT_PADDING)),
  };
}

// ─── legacy: fixed bottom margin ─────────────────────────────────────────────

/** @deprecated Use getMarginBottomForLabels for label-aware margin calculation. */
export function getMarginBottomForRotation(tickRotate: number): number {
  return tickRotate !== 0 ? 72 : 36;
}
