"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type * as PlotModule from "@observablehq/plot";
import type { GeoGeometryObjects } from "d3";
import { FiChevronsLeft, FiChevronsRight, FiCopy, FiPlay, FiRotateCcw } from "react-icons/fi";
import { LuChartColumnBig } from "react-icons/lu";
import { DAGNode } from "@/engine/types";
import { ChartConfig, ChartType, ColumnInfo } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import {
  CHART_CATALOG,
  CHART_GALLERY_SECTIONS,
  getChartCatalogEntry,
  type ChartCatalogEntry,
  type ChartFieldKey,
  type ChartFieldRequirement,
} from "@/lib/chartCatalog";
import { getColumnOptions, getFieldOrder, getIncompatibleChartConfigPatch } from "@/lib/chartFields";
import { chartIconRegistry } from "@/components/charts/picker/chart-icons-lucide-outline";
import { findGeometryColumn, parseGeometryValue } from "@/lib/geospatial";
import { inferChartConfigDefaults } from "@/lib/aiChartDefaults";
import {
  buildStackedSortOptions,
  buildTipMarkOptions,
  computeCategoricalYMargin,
  computeMaxGroupSum,
  computePlotSize,
  computeYMargin,
  detectsHighVariance,
  getCompactAxisMargin,
  getMarginBottomForLabels,
  getXTickRotation,
  resolveStripChartMode,
  shouldShowInlineCategoricalLegend,
} from "@/lib/chartBarUtils";

interface Props {
  node: DAGNode;
  presentationMode?: boolean;
}

type TabId = "type" | "data" | "options" | "customs";

interface ChartTypeButtonProps {
  entry: ChartCatalogEntry;
  isSelected: boolean;
  onSelect: () => void;
}

const BASE_CHART_COLOR = "#14b8a6";
const ALL_CHART_FIELDS: ChartFieldKey[] = ["x", "y", "x2", "y2", "color", "size", "length", "label", "facet"];
const MAX_INLINE_CATEGORICAL_LEGEND_ITEMS = 8;

function getBarYMarkOptions(xColumn: string, yColumn: string, fill: string) {
  return {
    x: xColumn,
    y: yColumn,
    fill,
  };
}

function getBarXMarkOptions(yColumn: string, xColumn: string, fill: string) {
  return {
    y: yColumn,
    x: xColumn,
    fill,
  };
}

function getCompactSwatchLegendOptions(_plotWidth: number) {
  return {
    legend: true,
  };
}

function getQuantitativeLegendOptions(_plotWidth: number, label: string) {
  return {
    legend: true,
    label,
  };
}

function isPercentageLikeColumnName(name?: string | null) {
  return Boolean(name && /pct|percent|percentage|porcentaje|tasa|rate|ratio/i.test(name));
}

function isAverageLikeColumnName(name?: string | null) {
  return Boolean(name && /price|cost|rate|ratio|score|avg|mean|margin|pct|percent|percentage|porcentaje/i.test(name));
}

function getReducerForColumnName(name?: string | null) {
  return isAverageLikeColumnName(name) ? "mean" : "sum";
}

function getNumericAxisMargin(values: unknown[], fallback = 52) {
  const numericValues = values
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .filter((value) => Number.isFinite(value));

  if (numericValues.length === 0) return fallback;

  const maxAbs = Math.max(...numericValues.map((value) => Math.abs(value)));
  const formatted = Math.round(maxAbs).toLocaleString();
  return Math.max(fallback, Math.min(96, formatted.length * 8 + 20));
}

function getAxisLabel(
  field: "x" | "y",
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  column?: string,
  counterpartColumn?: string
) {
  if (!column) return undefined;

  if (counterpartColumn && counterpartColumn === column) {
    return column;
  }

  if (entry?.id === "grouped-bar" && field === "x") {
    return getFieldLabel("color", entry, chartType);
  }

  return column;
}

function mergeAxisOptions(
  existing: unknown,
  label?: string
) {
  if (existing && typeof existing === "object" && "axis" in (existing as Record<string, unknown>) && (existing as Record<string, unknown>).axis === null) {
    return existing;
  }

  if (!label) return existing;
  return {
    ...(existing && typeof existing === "object" ? existing as Record<string, unknown> : {}),
    label,
  };
}

function formatAxisTickValue(value: number, columnName?: string, values: unknown[] = []) {
  const numericValues = values
    .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry));
  const maxAbs = numericValues.length > 0 ? Math.max(...numericValues.map((entry) => Math.abs(entry))) : Math.abs(value);

  if (isPercentageLikeColumnName(columnName)) {
    const usesUnitScale = maxAbs <= 1;
    const normalizedValue = usesUnitScale ? value * 100 : value;
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: Math.abs(normalizedValue) >= 10 ? 0 : 1,
    }).format(normalizedValue)}%`;
  }

  if (maxAbs >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return undefined;
}

function mergeAxisDisplayOptions(
  existing: unknown,
  label: string | undefined,
  columnName?: string,
  values: unknown[] = []
) {
  const merged = mergeAxisOptions(existing, label);
  if (!columnName || !merged || typeof merged !== "object") {
    return merged;
  }

  if ((merged as Record<string, unknown>).percent === true) {
    return merged;
  }

  const tickSample = formatAxisTickValue(0, columnName, values);
  if (tickSample === undefined) {
    return merged;
  }

  return {
    ...(merged as Record<string, unknown>),
    tickFormat: (value: number) => formatAxisTickValue(value, columnName, values) ?? value,
  };
}

function roundUpToNiceStep(value: number) {
  if (value <= 0) return 1;
  if (value <= 5) return Math.ceil(value);
  if (value <= 10) return Math.ceil(value / 2) * 2;
  if (value <= 25) return Math.ceil(value / 5) * 5;
  if (value <= 50) return Math.ceil(value / 10) * 10;
  if (value <= 100) return Math.ceil(value / 20) * 20;
  if (value <= 250) return Math.ceil(value / 50) * 50;
  if (value <= 500) return Math.ceil(value / 100) * 100;
  if (value <= 1000) return Math.ceil(value / 200) * 200;
  return Math.ceil(value / 20) * 20;
}

type SpikeLegendMode = "percent" | "compact" | "plain";

function getSpikeLegendMode(values: number[], columnName?: string): SpikeLegendMode {
  const finiteValues = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (finiteValues.length === 0) return "plain";

  const maxValue = Math.max(...finiteValues);
  if (isPercentageLikeColumnName(columnName) && maxValue <= 100) {
    return "percent";
  }
  if (maxValue >= 1000) {
    return "compact";
  }
  return "plain";
}

function formatSpikeLegendValue(value: number, mode: SpikeLegendMode) {
  if (mode === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)}%`;
  }
  if (mode === "compact") {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value);
}

function getSpikeLengthRange(mode: SpikeLegendMode, maxValue: number) {
  if (mode === "percent") return [0, 64];
  if (mode === "compact") return [0, 110];
  return maxValue <= 100 ? [0, 80] : [0, 96];
}

function buildSpikeLegendValues(values: number[], mode: SpikeLegendMode) {
  const finiteValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finiteValues.length === 0) return [];

  const maxValue = Math.max(...finiteValues);
  if (mode === "percent" || mode === "plain") {
    const niceMax = roundUpToNiceStep(maxValue);
    const step = Math.max(1, niceMax / 4);
    return Array.from({ length: 4 }, (_, index) => step * (index + 1)).filter((value) => value <= niceMax);
  }

  const step = maxValue / 4;
  return Array.from({ length: 4 }, (_, index) => step * (index + 1)).filter((value) => value > 0);
}

function buildSpikeLegendMarks(
  Plot: typeof PlotModule,
  values: number[],
  mode: SpikeLegendMode,
  stroke: string,
  frameAnchor: "bottom-right" | "bottom-left" | "top-right" | "top-left" = "bottom-right"
): PlotModule.Markish[] {
  const legendValues = buildSpikeLegendValues(values, mode);
  if (legendValues.length === 0) return [];

  return legendValues.flatMap((value, index) => {
    const dx = (index - legendValues.length) * 26;

    return [
      Plot.spike([value], {
        length: [value],
        dx,
        dy: -24,
        frameAnchor,
        stroke,
      } as Record<string, unknown>),
      Plot.text([value], {
        text: [formatSpikeLegendValue(value, mode)],
        dx,
        dy: -8,
        frameAnchor,
        textAnchor: "middle",
      } as Record<string, unknown>),
    ];
  });
}

function ChartTypeButton({ entry, isSelected, onSelect }: ChartTypeButtonProps) {
  const Icon = chartIconRegistry[entry.iconName];

  return (
    <button
      className={`chart-type-btn ${isSelected ? "selected" : ""} ${entry.supported ? "" : "opacity-45 cursor-not-allowed"}`}
      onClick={onSelect}
      title={
        entry.supported
          ? entry.description
          : `${entry.label}: catalog item not available yet`
      }
      disabled={!entry.supported}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="text-[7px] leading-tight">{entry.label}</span>
    </button>
  );
}

function alignSvgTopLeft(markup: string) {
  if (!markup.includes("<svg")) return markup;
  if (markup.includes("preserveAspectRatio=")) {
    return markup.replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMinYMin meet"');
  }
  return markup.replace("<svg", '<svg preserveAspectRatio="xMinYMin meet"');
}

function injectSvgStyle(markup: string, style: string) {
  if (!markup.includes("<svg")) return markup;
  if (markup.includes('style="')) {
    return markup.replace(/style="([^"]*)"/, (_match, existing) => `style="${existing}; ${style}"`);
  }
  return markup.replace("<svg", `<svg style="${style}"`);
}

function compactSwatchLegendMarkup(markup: string) {
  const prefixMatch = markup.match(/class="([^"]*?(plot-[^"\s]+))-swatches\b/);
  const prefix = prefixMatch?.[2];
  if (!prefix || !markup.includes(`${prefix}-swatches-wrap`)) return markup;

  const compactLegendStyle = `<style>
:where(.${prefix}-swatches) {
  font-size: 9px !important;
  line-height: 1.05;
  margin-bottom: 0.35em !important;
}
:where(.${prefix}-swatches-wrap) {
  align-items: flex-start !important;
  min-height: 22px !important;
  gap: 4px 6px;
  max-width: 100%;
  justify-content: flex-start !important;
}
:where(.${prefix}-swatches-wrap .${prefix}-swatch) {
  margin-right: 0 !important;
  max-width: 180px;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.15;
}
:where(.${prefix}-swatch > svg) {
  width: 10px;
  height: 10px;
  margin-right: 0.35em !important;
  flex: none;
}
</style>`;

  return markup.replace("</style>", `</style>${compactLegendStyle}`);
}

function isNumericType(type: string): boolean {
  return /int|float|double|decimal|numeric|real|bigint|smallint|tinyint/i.test(type);
}

function getFieldRequirement(
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  field: ChartFieldKey
): ChartFieldRequirement | null {
  if (entry?.fields) {
    return entry.fields[field] ?? null;
  }

  switch (chartType) {
    case "histogram":
      return field === "x" ? "required" : null;
    case "heatmap":
      if (field === "x" || field === "y") return "required";
      return field === "color" ? "optional" : null;
    case "choropleth":
      return field === "x" || field === "y" ? "required" : null;
    case "geoPoint":
      if (field === "x") return "required";
      return field === "color" || field === "size" ? "optional" : null;
    case "spike":
      if (field === "x" || field === "length") return "required";
      return field === "color" ? "optional" : null;
    case "arc":
      if (field === "x" || field === "y" || field === "x2" || field === "y2") return "required";
      return field === "color" || field === "length" ? "optional" : null;
    case "link":
      if (field === "x" || field === "y" || field === "x2" || field === "y2") return "required";
      return field === "color" || field === "label" ? "optional" : null;
    case "scatter":
    case "dot":
      if (field === "x") return "required";
      if (field === "y") return chartType === "scatter" ? "required" : "optional";
      if (field === "color" || field === "size") return "optional";
      return null;
    case "box":
      return field === "x" || field === "y" ? "required" : null;
    case "stackedBar":
      if (field === "x" || field === "y" || field === "color") return "required";
      return null;
    case "waffle":
    case "waterfall":
    case "treemap":
      if (field === "x" || field === "y") return "required";
      return field === "color" ? "optional" : null;
    case "grid":
      if (field === "x" || field === "y" || field === "color") return "required";
      return field === "label" ? "optional" : null;
    case "bar":
    case "barY":
    case "barX":
    case "line":
    case "area":
    case "pie":
      if (field === "x" || field === "y") return "required";
      return field === "color" ? "optional" : null;
    default:
      return null;
  }
}

function getFieldLabel(
  field: ChartFieldKey,
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined
): string {
  switch (field) {
    case "x":
      if (entry?.id === "world-choropleth") return "Feature label";
      if (entry?.id === "spike-map") return "Feature label";
      if (entry?.id === "dot-map") return "Feature label";
      if (entry?.id === "grid-cartogram") return "Grid X";
      if (entry?.id === "arc-map") return "Origin Lon";
      if (entry?.id === "sankey-diagram") return "Source";
      if (entry?.id === "waterfall-chart") return "Step";
      if (entry?.id === "treemap") return "Item";
      if (entry?.id === "link-chart") return "Start X";
      if (
        entry?.id === "line-chart" ||
        entry?.id === "multi-series-line" ||
        entry?.id === "area-chart" ||
        entry?.id === "temporal-histogram"
      ) {
        return "Time";
      }
      if (
        entry?.id === "vertical-bar" ||
        entry?.id === "dot-comparison" ||
        entry?.id === "box-plot" ||
        entry?.id === "waffle-chart" ||
        entry?.id === "stacked-bar"
      ) {
        return "Category";
      }
      if (entry?.id === "barcode-strip-plot" || entry?.id === "beeswarm" || entry?.id === "histogram" || entry?.id === "faceted-dodge") {
        return "Value";
      }
      if (entry?.id === "waffle-chart" || entry?.id === "stacked-bar") return "Category";
      if (entry?.id === "horizontal-bar") return "Value";
      if (entry?.id === "grouped-bar") return "Series";
      if (entry?.id === "temporal-histogram") return "Time";
      return chartType === "histogram" ? "Value" : "X";
    case "y":
      if (entry?.id === "world-choropleth") return "Value";
      if (entry?.id === "arc-map") return "Origin Lat";
      if (entry?.id === "sankey-diagram") return "Target";
      if (entry?.id === "waterfall-chart") return "Change";
      if (
        entry?.id === "treemap" ||
        entry?.id === "waffle-chart" ||
        entry?.id === "stacked-bar" ||
        entry?.id === "grouped-bar" ||
        entry?.id === "vertical-bar" ||
        entry?.id === "dot-comparison" ||
        entry?.id === "box-plot" ||
        entry?.id === "line-chart" ||
        entry?.id === "multi-series-line" ||
        entry?.id === "area-chart"
      ) {
        return "Value";
      }
      if (entry?.id === "heatmap") return "Row";
      if (entry?.id === "grid-cartogram") return "Grid Y";
      if (entry?.id === "link-chart") return "Start Y";
      if (entry?.id === "barcode-strip-plot") return "Category";
      if (entry?.id === "horizontal-bar") return "Category";
      return "Y";
    case "x2":
      if (entry?.id === "arc-map") return "Dest Lon";
      if (entry?.id === "link-chart") return "End X";
      return "X2";
    case "y2":
      if (entry?.id === "arc-map") return "Dest Lat";
      if (entry?.id === "link-chart") return "End Y";
      return "Y2";
    case "color":
      if (entry?.id === "dot-map") return "Group";
      if (entry?.id === "arc-map") return "Color";
      if (entry?.id === "spike-map") return "Group";
      if (entry?.id === "sankey-diagram") return "Group";
      if (entry?.id === "stacked-bar") return "Segment";
      if (entry?.id === "treemap") return "Group";
      if (entry?.id === "grid-cartogram" || entry?.id === "heatmap") return "Value";
      if (entry?.id === "link-chart") return "Color";
      if (entry?.id === "barcode-strip-plot") return "Group";
      if (entry?.id === "grouped-bar" || entry?.id === "multi-series-line") {
        return "Series";
      }
      return "Color";
    case "size":
      if (entry?.id === "dot-map") return "Magnitude";
      if (entry?.id === "sankey-diagram") return "Value";
      return "Size";
    case "length":
      if (entry?.id === "arc-map") return "Weight";
      if (entry?.id === "spike-map") return "Magnitude";
      return "Length";
    case "label":
      if (entry?.id === "grid-cartogram") return "Label";
      if (entry?.id === "link-chart") return "Label";
      return "Label";
    case "facet":
      if (entry?.id === "grouped-bar") return "Group";
      if (entry?.id === "faceted-dodge") return "Group";
      return "Facet";
  }
}

function getMissingConfigFields(
  config: ChartConfig,
  entry: ChartCatalogEntry | null
): ChartFieldKey[] {
  if (!config.chartType) return ["x"];

  return ALL_CHART_FIELDS.filter((field) => {
    if (getFieldRequirement(entry, config.chartType, field) !== "required") {
      return false;
    }

    switch (field) {
      case "x":
        return !config.xColumn;
      case "y":
        return !config.yColumn;
      case "x2":
        return !config.x2Column;
      case "y2":
        return !config.y2Column;
      case "color":
        return !config.colorColumn;
      case "size":
        return !config.sizeColumn;
      case "length":
        return !config.lengthColumn;
      case "label":
        return !config.labelColumn;
      case "facet":
        return !config.facetColumn;
    }
  });
}

function isChartReady(config: ChartConfig, entry: ChartCatalogEntry | null): boolean {
  if (!config.chartType) return false;
  return getMissingConfigFields(config, entry).length === 0;
}

function getChartSetupMessage(config: ChartConfig, entry: ChartCatalogEntry | null): string {
  if (!config.chartType) {
    return "Chart type not selected";
  }

  const missing = getMissingConfigFields(config, entry);
  if (missing.length === 0) {
    return "";
  }

  return `Choose ${missing
    .map((field) => getFieldLabel(field, entry, config.chartType))
    .join(", ")}`;
}

function toFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

type GridCartogramDatum = {
  gridX: number;
  gridY: number;
  value: number;
  label: string | null;
};

function buildGridCartogramData(
  data: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  valueColumn: string,
  labelColumn?: string
): GridCartogramDatum[] {
  return data.flatMap((row) => {
    const gridX = toFiniteNumber(row[xColumn]);
    const gridY = toFiniteNumber(row[yColumn]);
    const value = toFiniteNumber(row[valueColumn]);

    if (gridX === null || gridY === null || value === null) {
      return [];
    }

    return [{
      gridX,
      gridY,
      value,
      label:
        labelColumn && row[labelColumn] !== undefined && row[labelColumn] !== null
          ? String(row[labelColumn])
          : null,
    }];
  });
}

function isGridRatioDomain(values: number[]) {
  return values.length > 0 && values.every((value) => value > 0) && Math.min(...values) < 1 && Math.max(...values) > 1;
}

function formatGridCartogramValue(value: number, ratioDomain: boolean) {
  if (ratioDomain) {
    const percentChange = (value - 1) * 100;
    const rounded = Math.abs(percentChange) >= 10 ? Math.round(percentChange) : Math.round(percentChange * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  }

  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 1,
  }).format(value);
}

function buildWaterfallData(
  data: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  colorColumn?: string
) {
  let runningTotal = 0;

  return data.flatMap((row) => {
    const change = toFiniteNumber(row[yColumn]);
    const step = row[xColumn];
    if (change === null || step === undefined || step === null) {
      return [];
    }

    const start = runningTotal;
    const end = runningTotal + change;
    runningTotal = end;

    return [{
      step: String(step),
      start,
      end,
      change,
      label: change > 0 ? `+${change}` : `${change}`,
      fill:
        colorColumn && row[colorColumn] !== undefined && row[colorColumn] !== null
          ? String(row[colorColumn])
          : change >= 0
            ? "Increase"
            : "Decrease",
    }];
  });
}

function aggregateCategoryValues(
  data: Record<string, unknown>[],
  categoryColumn: string,
  valueColumn: string,
  reducer: "sum" | "mean",
  groupColumn?: string
) {
  const grouped = new Map<string, { category: string; group?: string; total: number; count: number }>();

  data.forEach((row) => {
    const category = row[categoryColumn];
    const numericValue = toFiniteNumber(row[valueColumn]);
    if (category === undefined || category === null || numericValue === null) return;

    const groupValue =
      groupColumn && row[groupColumn] !== undefined && row[groupColumn] !== null
        ? String(row[groupColumn])
        : undefined;
    const key = `${String(category)}__${groupValue ?? ""}`;
    const current = grouped.get(key) ?? {
      category: String(category),
      ...(groupValue ? { group: groupValue } : {}),
      total: 0,
      count: 0,
    };
    current.total += numericValue;
    current.count += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((entry) => ({
    category: entry.category,
    value: reducer === "mean" ? entry.total / Math.max(entry.count, 1) : entry.total,
    ...(entry.group ? { group: entry.group } : {}),
  }));
}

async function buildTreemapLeaves(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumn: string,
  width: number,
  height: number,
  groupColumn?: string,
  reducer: "sum" | "mean" = "sum"
) {
  const d3 = await import("d3");
  const groupedValues = new Map<string, Map<string, { total: number; count: number }>>();
  type TreemapDatum = {
    name: string;
    value?: number;
    children?: TreemapDatum[];
  };

  data.forEach((row) => {
    const label = row[labelColumn];
    const value = toFiniteNumber(row[valueColumn]);
    if (label === undefined || label === null || value === null) return;

    const groupKey =
      groupColumn && row[groupColumn] !== undefined && row[groupColumn] !== null
        ? String(row[groupColumn])
        : "All";
    const itemKey = String(label);
    const groupItems = groupedValues.get(groupKey) ?? new Map<string, { total: number; count: number }>();
    const current = groupItems.get(itemKey) ?? { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    groupItems.set(itemKey, current);
    groupedValues.set(groupKey, groupItems);
  });

  if (groupedValues.size === 0) {
    return [];
  }

  const hierarchyData: TreemapDatum = {
    name: "root",
    children: Array.from(groupedValues.entries(), ([group, items]) => ({
      name: group,
      children: Array.from(items.entries(), ([label, stats]) => ({
        name: label,
        value: reducer === "mean" ? stats.total / Math.max(stats.count, 1) : stats.total,
      })),
    })),
  };

  const root = d3.hierarchy<TreemapDatum>(hierarchyData)
    .sum((node) => node.value ?? 0)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));

  const layout = d3.treemap<TreemapDatum>()
    .size([width, height])
    .padding(1);

  const treemapRoot = layout(root);

  return treemapRoot.leaves().map((leaf) => ({
    x0: leaf.x0,
    x1: leaf.x1,
    y0: leaf.y0,
    y1: leaf.y1,
    label: leaf.data.name,
    value: leaf.value ?? 0,
    group: leaf.parent?.data.name ?? leaf.data.name,
  }));
}

const GEO_NAME_ALIASES: Record<string, string> = {
  us: "unitedstatesofamerica",
  usa: "unitedstatesofamerica",
  unitedstates: "unitedstatesofamerica",
  uk: "unitedkingdom",
  uae: "unitedarabemirates",
  czechia: "czechrepublic",
};

function normalizeGeoLookupKey(value: unknown): string {
  if (value === null || value === undefined) return "";
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

  return GEO_NAME_ALIASES[normalized] ?? normalized;
}

async function loadWorldAtlasFeatures() {
  const [{ feature }, countriesModule, landModule] = await Promise.all([
    import("topojson-client"),
    import("world-atlas/countries-110m.json"),
    import("world-atlas/land-110m.json"),
  ]);

  const countriesAtlas = (countriesModule.default ?? countriesModule) as {
    objects: { countries: unknown };
  };
  const landAtlas = (landModule.default ?? landModule) as {
    objects: { land: unknown };
  };

  const countries = feature(countriesAtlas as never, countriesAtlas.objects.countries as never) as unknown as {
    features: Array<{ properties?: { name?: string } }>;
  };
  const land = feature(landAtlas as never, landAtlas.objects.land as never);

  return { countries: countries.features, land };
}

function buildCountryValueLookup(
  data: Record<string, unknown>[],
  countryColumn: string,
  valueColumn: string
) {
  const values = new Map<string, number>();

  data.forEach((row) => {
    const key = normalizeGeoLookupKey(row[countryColumn]);
    const value = toFiniteNumber(row[valueColumn]);
    if (!key || value === null) return;
    values.set(key, (values.get(key) ?? 0) + value);
  });

  return values;
}

type GeometryFeatureDatum = {
  type: "Feature";
  properties: {
    label: string;
    value: number | null;
    group?: string | null;
  };
  geometry: {
    type: string;
  } & Record<string, unknown>;
};

type CartogramCellDatum = {
  gridX: number;
  gridY: number;
  label: string;
  value: number;
  textLabel: string;
};

function buildGeometryFeatures(
  data: Record<string, unknown>[],
  geometryColumn: string,
  labelColumn: string,
  valueColumn: string
): GeometryFeatureDatum[] {
  return data.flatMap((row) => {
    const geometry = parseGeometryValue(row[geometryColumn]);
    if (!geometry) return [];

    return [{
      type: "Feature",
      properties: {
        label:
          row[labelColumn] === undefined || row[labelColumn] === null
            ? "Unknown"
            : String(row[labelColumn]),
        value: toFiniteNumber(row[valueColumn]),
      },
      geometry,
    }];
  });
}

async function buildCartogramCells(
  data: Record<string, unknown>[],
  geometryColumn: string,
  featureLabelColumn: string,
  valueColumn: string,
  textLabelColumn?: string
): Promise<CartogramCellDatum[]> {
  const d3 = await import("d3");
  const features = data.flatMap((row) => {
    const geometry = parseGeometryValue(row[geometryColumn]);
    const value = toFiniteNumber(row[valueColumn]);
    const featureLabel = row[featureLabelColumn];
    if (!geometry || value === null || featureLabel === undefined || featureLabel === null) {
      return [];
    }

    const [longitude, latitude] = d3.geoCentroid(geometry as GeoGeometryObjects);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return [];
    }

    return [{
      longitude,
      latitude,
      label: String(featureLabel),
      value,
      textLabel:
        textLabelColumn && row[textLabelColumn] !== undefined && row[textLabelColumn] !== null
          ? String(row[textLabelColumn])
          : String(featureLabel),
    }];
  });

  if (features.length === 0) {
    return [];
  }

  const longitudes = features.map((feature) => feature.longitude);
  const latitudes = features.map((feature) => feature.latitude);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const aspectRatio = longitudeSpan > 0 && latitudeSpan > 0
    ? Math.min(2.4, Math.max(0.75, longitudeSpan / latitudeSpan))
    : 1;
  const rowCount = Math.max(1, Math.round(Math.sqrt(features.length / aspectRatio)));
  const rows: typeof features[] = Array.from({ length: rowCount }, () => []);

  const northToSouth = [...features].sort((left, right) => right.latitude - left.latitude);
  northToSouth.forEach((feature, index) => {
    const rowIndex = Math.min(rowCount - 1, Math.floor(index * rowCount / northToSouth.length));
    rows[rowIndex].push(feature);
  });

  return rows.flatMap((row, rowIndex) =>
    row
      .sort((left, right) => left.longitude - right.longitude)
      .map((feature, columnIndex) => ({
        gridX: columnIndex,
        gridY: rowIndex,
        label: feature.label,
        value: feature.value,
        textLabel: feature.textLabel,
      }))
  );
}

function buildCustomStarterCode(
  config: ChartConfig,
  entry: ChartCatalogEntry | null,
  columns: ColumnInfo[],
  geometryColumn: string | null
) {
  const categoryColumn = config.xColumn ?? columns[0]?.name ?? "category";
  const numericColumn =
    config.yColumn ??
    config.sizeColumn ??
    config.lengthColumn ??
    columns.find((column) => isNumericType(column.type))?.name ??
    columns[1]?.name ??
    "value";
  const valueColumn =
    config.xColumn ??
    columns.find((column) => isNumericType(column.type))?.name ??
    columns[1]?.name ??
    "value";
  const featureLabelColumn = config.xColumn ?? config.labelColumn ?? columns[0]?.name ?? "label";
  const selectedVariant = entry?.id ?? config.chartType;

  if (selectedVariant === "world-choropleth" && geometryColumn) {
    return `Plot.plot({
  width,
  height,
  color: {
    legend: true,
    scheme: "blues",
    label: "${numericColumn}"
  },
  projection: {
    type: "mercator",
    domain: {
      type: "FeatureCollection",
      features: helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${numericColumn}")
    }
  },
  marks: [
    Plot.geo(helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${numericColumn}"), {
      fill: d => d.properties.value,
      stroke: "white",
      strokeWidth: 0.8,
      tip: true
    })
  ]
})`;
  }

  if (selectedVariant === "grid-cartogram" && config.xColumn && config.yColumn && config.colorColumn) {
    const textColumn = config.labelColumn ?? config.colorColumn;
    return `Plot.plot({
  width,
  height,
  x: { axis: null },
  y: { axis: null },
  color: {
    legend: true,
    scheme: "blues",
    label: "${config.colorColumn}"
  },
  marks: [
    Plot.cell(data, {
      x: "${config.xColumn}",
      y: "${config.yColumn}",
      fill: "${config.colorColumn}",
      inset: 1,
      stroke: "white"
    }),
    Plot.text(data, {
      x: "${config.xColumn}",
      y: "${config.yColumn}",
      text: "${textColumn}",
      fontSize: 10,
      fontWeight: 600
    })
  ]
})`;
  }

  if (selectedVariant === "horizontal-bar" || selectedVariant === "barX") {
    const reducer = getReducerForColumnName(config.xColumn ?? numericColumn);
    return `Plot.plot({
  width,
  height,
  x: { label: "${config.xColumn ?? numericColumn}" },
  y: { label: "${config.yColumn ?? columns[0]?.name ?? "category"}" },
  marks: [
    Plot.barX(
      data,
      Plot.groupY({ x: "${reducer}" }, {
      y: "${config.yColumn ?? columns[0]?.name ?? "category"}",
      x: "${config.xColumn ?? numericColumn}",
      fill: "#14b8a6"
    })
    ),
    Plot.ruleX([0], { stroke: "#94a3b8" })
  ]
})`;
  }

  if (selectedVariant === "grouped-bar") {
    const color = config.colorColumn ?? categoryColumn;
    const facet = config.facetColumn ?? categoryColumn;
    const reducer = getReducerForColumnName(numericColumn);
    return `Plot.plot({
  width,
  height,
  color: { legend: true },
  fx: { label: null },
  x: { axis: null },
  marks: [
    Plot.barY(data, Plot.groupX({ y: "${reducer}" }, {
      x: "${color}",
      y: "${numericColumn}",
      fill: "${color}",
      fx: "${facet}"
    })),
    Plot.ruleY([0], { stroke: "#94a3b8" })
  ]
})`;
  }

  if (selectedVariant === "stacked-bar") {
    const color = config.colorColumn ?? categoryColumn;
    const reducer = getReducerForColumnName(numericColumn);
    return `Plot.plot({
  width,
  height,
  color: { legend: true },
  marks: [
    Plot.barY(data, Plot.groupX({ y: "${reducer}" }, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: "${color}"
    })),
    Plot.ruleY([0], { stroke: "#94a3b8" })
  ]
})`;
  }

  if (selectedVariant === "histogram" || selectedVariant === "temporal-histogram") {
    return `Plot.plot({
  width,
  height,
  marks: [
    Plot.rectY(data, Plot.binX({ y: "count" }, {
      x: "${categoryColumn}",
      fill: "#14b8a6"
    })),
    Plot.ruleY([0])
  ]
})`;
  }

  if (selectedVariant === "faceted-dodge") {
    const facet = config.facetColumn ?? config.colorColumn ?? categoryColumn;
    const fill = config.colorColumn ?? facet;
    return `Plot.plot({
  width,
  height,
  y: { grid: true },
  color: { legend: true },
  marks: [
    Plot.dot(data, Plot.dodgeX("middle", {
      fx: "${facet}",
      y: "${categoryColumn}",
      fill: "${fill}"
    }))
  ]
})`;
  }

  if (selectedVariant === "line-chart" || selectedVariant === "line") {
    return `Plot.plot({
  width,
  height,
  marks: [
    Plot.line(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      stroke: "#14b8a6"
    })
  ]
})`;
  }

  if (selectedVariant === "multi-series-line") {
    const color = config.colorColumn ?? categoryColumn;
    return `Plot.plot({
  width,
  height,
  color: { legend: true },
  marks: [
    Plot.line(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      stroke: "${color}"
    })
  ]
})`;
  }

  if (selectedVariant === "area-chart" || selectedVariant === "area") {
    return `Plot.plot({
  width,
  height,
  marks: [
    Plot.areaY(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: "#14b8a6"
    }),
    Plot.line(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      stroke: "#0d9488"
    })
  ]
})`;
  }

  if (selectedVariant === "scatterplot" || selectedVariant === "color-scatterplot" || selectedVariant === "scatter") {
    const fill = config.colorColumn ? `"${config.colorColumn}"` : '"#14b8a6"';
    return `Plot.plot({
  width,
  height,${config.colorColumn ? '\n  color: { legend: true },' : ''}
  marks: [
    Plot.dot(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: ${fill}
    })
  ]
})`;
  }

  if (selectedVariant === "bubble-chart") {
    const size = config.sizeColumn ?? numericColumn;
    const fill = config.colorColumn ? `"${config.colorColumn}"` : '"#14b8a6"';
    return `Plot.plot({
  width,
  height,${config.colorColumn ? '\n  color: { legend: true },' : ''}
  marks: [
    Plot.dot(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      r: "${size}",
      fill: ${fill}
    })
  ]
})`;
  }

  if (selectedVariant === "dot-comparison" || selectedVariant === "dot") {
    const fill = config.colorColumn ? `"${config.colorColumn}"` : '"#14b8a6"';
    const reducer = getReducerForColumnName(numericColumn);
    return `Plot.plot({
  width,
  height,${config.colorColumn ? '\n  color: { legend: true },' : ''}
  marks: [
    Plot.ruleY([0]),
    Plot.dot(data, Plot.groupX({ y: "${reducer}" }, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: ${fill}
    }))
  ]
})`;
  }

  if (selectedVariant === "beeswarm") {
    const fill = config.colorColumn ? `"${config.colorColumn}"` : '"#14b8a6"';
    const anchor = config.beeswarmAnchor ?? "middle";
    return `Plot.plot({
  width,
  height,${config.colorColumn ? '\n  color: { legend: true },' : ''}
  marks: [
    Plot.dot(data, Plot.dodgeY({
      x: "${categoryColumn}",
      fill: ${fill},
      anchor: "${anchor}"
    }))
  ]
})`;
  }

  if (selectedVariant === "barcode-strip-plot") {
    const showLegendExpression = config.colorColumn
      ? `new Set(data.map((d) => String(d["${config.colorColumn}"] ?? ""))).size <= ${MAX_INLINE_CATEGORICAL_LEGEND_ITEMS}`
      : "false";
    const stripMode = resolveStripChartMode({
      hasCategory: Boolean(config.yColumn),
      hasGroup: Boolean(config.colorColumn),
      categoryEqualsGroup: config.yColumn === config.colorColumn,
      groupCardinality: config.colorColumn ? 0 : 0,
      maxLegendItems: MAX_INLINE_CATEGORICAL_LEGEND_ITEMS,
    });

    if (stripMode.mode === "grouped" && config.yColumn && config.colorColumn) {
      return `Plot.plot({
  width,
  height,
  color: { legend: ${showLegendExpression} },
  x: {
    grid: true,
    label: "${valueColumn} →"
  },
  y: {
    domain: Array.from(new Set(data.map((d) => d["${config.yColumn}"]))),
    reverse: true,
    label: null
  },
  marks: [
    Plot.ruleX([0]),
    Plot.tickX(data, {
      x: "${valueColumn}",
      y: "${config.yColumn}",
      stroke: ${showLegendExpression} ? "${config.colorColumn}" : "#14b8a6"
    })
  ]
})`;
    }

    if (config.yColumn) {
      return `Plot.plot({
  width,
  height,
  y: {
    domain: Array.from(new Set(data.map((d) => d["${config.yColumn}"]))),
    reverse: true,
    label: null
  },
  marks: [
    Plot.tickX(data, {
      x: "${valueColumn}",
      y: "${config.yColumn}",
      stroke: "#14b8a6"
    })
  ]
})`;
    }

    return `Plot.plot({
  width,
  height,
  marks: [
    Plot.tickX(data, {
      x: "${categoryColumn}",
      stroke: "#14b8a6"
    })
  ]
})`;
  }

  if (selectedVariant === "box-plot" || selectedVariant === "box") {
    return `Plot.plot({
  width,
  height,
  marks: [
    Plot.boxY(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: "#d1d5db"
    })
  ]
})`;
  }

  if (selectedVariant === "heatmap") {
    return `Plot.plot({
  width,
  height,
  color: { legend: true, scheme: "blues" },
  marks: [
    Plot.cell(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: "${config.colorColumn ?? numericColumn}"
    })
  ]
})`;
  }

  if (selectedVariant === "waffle-chart") {
    return `Plot.plot({
  width,
  height,
  color: { legend: true },
  marks: [
    Plot.waffleY(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: "${config.colorColumn ?? categoryColumn}"
    })
  ]
})`;
  }

  if (selectedVariant === "waterfall-chart") {
    return `Plot.plot({
  width,
  height,
  marks: [
    Plot.barY(data, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: d => d["${numericColumn}"] >= 0 ? "#10b981" : "#ef4444"
    }),
    Plot.ruleY([0])
  ]
})`;
  }

  if (selectedVariant === "treemap") {
    return `Plot.plot({
  width,
  height,
  color: { legend: true },
  x: { axis: null },
  y: { axis: null },
  marks: [
    Plot.cell(data, Plot.group({ fill: "count" }, {
      x: "${categoryColumn}",
      y: "${numericColumn}"
    }))
  ]
})`;
  }

  if ((selectedVariant === "dot-map" || selectedVariant === "geoPoint") && geometryColumn) {
    return `Plot.plot({
  width,
  height,
  projection: {
    type: "mercator",
    domain: {
      type: "FeatureCollection",
      features: helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${config.sizeColumn ?? numericColumn}")
    }
  },
  marks: [
    Plot.geo(helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${config.sizeColumn ?? numericColumn}"), {
      fill: "#f8fafc",
      stroke: "#e2e8f0",
      strokeWidth: 0.8
    }),
    Plot.dot(
      helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${config.sizeColumn ?? numericColumn}"),
      Plot.geoCentroid({
        r: d => d.properties.value ?? 5,
        fill: "#14b8a6",
        fillOpacity: 0.75,
        stroke: "#fff",
        strokeWidth: 1
      })
    )
  ]
})`;
  }

  if ((selectedVariant === "spike-map" || selectedVariant === "spike") && geometryColumn) {
    return `Plot.plot({
  width,
  height,
  projection: {
    type: "mercator",
    domain: {
      type: "FeatureCollection",
      features: helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${config.lengthColumn ?? numericColumn}")
    }
  },
  marks: [
    Plot.geo(helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${config.lengthColumn ?? numericColumn}"), {
      fill: "#e0e0e0",
      stroke: "white",
      strokeWidth: 1
    }),
    Plot.spike(
      helpers.geometryFeatures(data, "${geometryColumn}", "${featureLabelColumn}", "${config.lengthColumn ?? numericColumn}"),
      Plot.geoCentroid({
        length: d => d.properties.value ?? 0,
        stroke: "red",
        fill: "red"
      })
    )
  ]
})`;
  }

  if (selectedVariant === "arc-map" || selectedVariant === "arc") {
    const x2 = config.x2Column ?? "dest_lon";
    const y2 = config.y2Column ?? "dest_lat";
    return `Plot.plot({
  width,
  height,
  projection: "equal-earth",
  marks: [
    Plot.sphere(),
    Plot.arrow(data, {
      x1: "${categoryColumn}",
      y1: "${numericColumn}",
      x2: "${x2}",
      y2: "${y2}",
      bend: true,
      stroke: "#14b8a6",
      strokeOpacity: 0.45,
      strokeWidth: 1.5
    })
  ]
})`;
  }

  if (selectedVariant === "link-chart" || selectedVariant === "link") {
    const x2 = config.x2Column ?? categoryColumn;
    const y2 = config.y2Column ?? numericColumn;
    return `Plot.plot({
  width,
  height,
  marks: [
    Plot.link(data, {
      x1: "${categoryColumn}",
      y1: "${numericColumn}",
      x2: "${x2}",
      y2: "${y2}",
      stroke: "#94a3b8",
      strokeOpacity: 0.7
    }),
    Plot.dot(data, {
      x: "${x2}",
      y: "${y2}",
      fill: "#14b8a6",
      r: 4
    })
  ]
})`;
  }

  if (selectedVariant === "sankey-diagram") {
    return `Plot.plot({
  width,
  height,
  color: { legend: true },
  marks: [
    Plot.barX(data, Plot.groupY({ x: "sum" }, {
      y: "${categoryColumn}",
      x: "${config.sizeColumn ?? numericColumn}",
      fill: "${config.colorColumn ?? categoryColumn}"
    }))
  ]
})`;
  }

  const reducer = getReducerForColumnName(config.yColumn ?? numericColumn);
  return `Plot.plot({
  width,
  height,
  x: { label: "${categoryColumn}" },
  y: { label: "${numericColumn}" },
  marks: [
    Plot.barY(
      data,
      Plot.groupX({ y: "${reducer}" }, {
      x: "${categoryColumn}",
      y: "${numericColumn}",
      fill: "#14b8a6"
    })
    ),
    Plot.ruleY([0], { stroke: "#94a3b8" })
  ]
})`;
}

function parseQuotedFieldOption(code: string, key: string) {
  const match = code.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
  return match?.[1];
}

function parseAnchorOption(code: string): "top" | "middle" | "bottom" | undefined {
  const match = code.match(/anchor\s*:\s*(["']top["']|["']middle["']|["']bottom["'])/);
  if (!match) return undefined;
  return match[1].replace(/['"]/g, "") as "top" | "middle" | "bottom";
}

function parseCustomPlotConfig(
  code: string,
  availableColumns: ColumnInfo[],
  currentConfig?: Pick<
    ChartConfig,
    "chartType" | "chartCatalogId" | "xColumn" | "yColumn" | "x2Column" | "y2Column" | "colorColumn" | "sizeColumn" | "lengthColumn" | "labelColumn" | "facetColumn" | "beeswarmAnchor"
  >
): Partial<ChartConfig> | null {
  const normalized = code.replace(/\s+/g, " ");
  const columnNames = new Set(availableColumns.map((column) => column.name));
  const asColumn = (value?: string) => (value && columnNames.has(value) ? value : undefined);
  const currentVariant = currentConfig?.chartCatalogId;

  if (currentVariant === "grouped-bar") {
    return {
      chartType: "bar",
      chartCatalogId: "grouped-bar",
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn:
        asColumn(parseQuotedFieldOption(code, "x")) ??
        asColumn(parseQuotedFieldOption(code, "fill")) ??
        currentConfig?.colorColumn,
      facetColumn: asColumn(parseQuotedFieldOption(code, "fx")) ?? currentConfig?.facetColumn,
    };
  }

  if (currentVariant === "stacked-bar") {
    return {
      chartType: "stackedBar",
      chartCatalogId: "stacked-bar",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "histogram" || currentVariant === "temporal-histogram") {
    return {
      chartType: "histogram",
      chartCatalogId: currentVariant,
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
    };
  }

  if (currentVariant === "faceted-dodge") {
    return {
      chartType: "dot",
      chartCatalogId: "faceted-dodge",
      xColumn:
        asColumn(parseQuotedFieldOption(code, "y")) ??
        asColumn(parseQuotedFieldOption(code, "x")) ??
        currentConfig?.xColumn,
      facetColumn:
        asColumn(parseQuotedFieldOption(code, "fx")) ??
        currentConfig?.facetColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "multi-series-line") {
    return {
      chartType: "line",
      chartCatalogId: "multi-series-line",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "stroke")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "area-chart") {
    return {
      chartType: "area",
      chartCatalogId: "area-chart",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "bubble-chart") {
    return {
      chartType: "scatter",
      chartCatalogId: "bubble-chart",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      sizeColumn: asColumn(parseQuotedFieldOption(code, "r")) ?? currentConfig?.sizeColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "scatterplot" || currentVariant === "color-scatterplot") {
    return {
      chartType: "scatter",
      chartCatalogId: currentVariant,
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "dot-comparison") {
    return {
      chartType: "dot",
      chartCatalogId: "dot-comparison",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "beeswarm") {
    return {
      chartType: "dot",
      chartCatalogId: "beeswarm",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
      beeswarmAnchor: parseAnchorOption(code) ?? currentConfig?.beeswarmAnchor ?? "middle",
    };
  }

  if (currentVariant === "barcode-strip-plot") {
    return {
      chartType: "dot",
      chartCatalogId: "barcode-strip-plot",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn:
        asColumn(parseQuotedFieldOption(code, "z")) ??
        asColumn(parseQuotedFieldOption(code, "stroke")) ??
        currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "box-plot") {
    return {
      chartType: "box",
      chartCatalogId: "box-plot",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
    };
  }

  if (currentVariant === "heatmap") {
    return {
      chartType: "heatmap",
      chartCatalogId: "heatmap",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "waffle-chart") {
    return {
      chartType: "waffle",
      chartCatalogId: "waffle-chart",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
      colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn,
    };
  }

  if (currentVariant === "waterfall-chart") {
    return {
      chartType: "waterfall",
      chartCatalogId: "waterfall-chart",
      xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn,
    };
  }

  if (currentVariant === "arc-map" || currentVariant === "link-chart") {
    return {
      chartType: currentVariant === "arc-map" ? "arc" : "link",
      chartCatalogId: currentVariant,
      xColumn: asColumn(parseQuotedFieldOption(code, "x1")) ?? currentConfig?.xColumn,
      yColumn: asColumn(parseQuotedFieldOption(code, "y1")) ?? currentConfig?.yColumn,
      x2Column: asColumn(parseQuotedFieldOption(code, "x2")) ?? currentConfig?.x2Column,
      y2Column: asColumn(parseQuotedFieldOption(code, "y2")) ?? currentConfig?.y2Column,
      colorColumn: asColumn(parseQuotedFieldOption(code, "stroke")) ?? currentConfig?.colorColumn,
    };
  }

  if (normalized.includes("Plot.barY(")) {
    const x = parseQuotedFieldOption(code, "x");
    const y = parseQuotedFieldOption(code, "y");
    const fill = parseQuotedFieldOption(code, "fill");
    return {
      chartType: "bar",
      chartCatalogId: "vertical-bar",
      xColumn: x,
      yColumn: y,
      colorColumn: fill && columnNames.has(fill) ? fill : undefined,
    };
  }

  if (normalized.includes("Plot.barX(")) {
    const y = parseQuotedFieldOption(code, "y");
    const x = parseQuotedFieldOption(code, "x");
    const fill = parseQuotedFieldOption(code, "fill");
    return {
      chartType: "barX",
      chartCatalogId: "horizontal-bar",
      xColumn: x,
      yColumn: y,
      colorColumn: fill && columnNames.has(fill) ? fill : undefined,
    };
  }

  if (normalized.includes("Plot.line(")) {
    const x = parseQuotedFieldOption(code, "x");
    const y = parseQuotedFieldOption(code, "y");
    const stroke = parseQuotedFieldOption(code, "stroke");
    return {
      chartType: "line",
      chartCatalogId: "line-chart",
      xColumn: x,
      yColumn: y,
      colorColumn: stroke && columnNames.has(stroke) ? stroke : undefined,
    };
  }

  return null;
}

async function buildSankeyData(
  data: Record<string, unknown>[],
  sourceColumn: string,
  targetColumn: string,
  valueColumn: string,
  width: number,
  height: number,
  groupColumn?: string
) {
  const { sankey } = await import("d3-sankey");
  type SankeyNodeDatum = {
    name: string;
    group: string;
  };
  type SankeyLinkDatum = {
    source: string;
    target: string;
    value: number;
    group: string;
  };

  const nodeGroups = new Map<string, string>();
  const aggregatedLinks = new Map<string, SankeyLinkDatum>();

  data.forEach((row) => {
    const source = row[sourceColumn];
    const target = row[targetColumn];
    const value = toFiniteNumber(row[valueColumn]);
    if (source === undefined || source === null || target === undefined || target === null || value === null) {
      return;
    }

    const sourceName = String(source);
    const targetName = String(target);
    const group =
      groupColumn && row[groupColumn] !== undefined && row[groupColumn] !== null
        ? String(row[groupColumn])
        : sourceName;
    const key = `${sourceName}→${targetName}→${group}`;
    const existingLink = aggregatedLinks.get(key);

    if (existingLink) {
      existingLink.value += value;
    } else {
      aggregatedLinks.set(key, {
        source: sourceName,
        target: targetName,
        value,
        group,
      });
    }

    if (!nodeGroups.has(sourceName)) nodeGroups.set(sourceName, group);
    if (!nodeGroups.has(targetName)) nodeGroups.set(targetName, group);
  });

  const nodes = Array.from(
    new Set(
      Array.from(aggregatedLinks.values()).flatMap((link) => [link.source, link.target])
    )
  ).map((name) => ({
    name,
    group: nodeGroups.get(name) ?? name,
  }));

  const links = Array.from(aggregatedLinks.values()).map((link) => ({ ...link }));
  if (nodes.length === 0 || links.length === 0) {
    return { nodes: [], linkBands: [] };
  }

  const layout = sankey<SankeyNodeDatum, SankeyLinkDatum>()
    .nodeId((node: SankeyNodeDatum) => node.name)
    .nodeWidth(18)
    .nodePadding(14)
    .extent([[0, 0], [Math.max(width - 40, 240), Math.max(height - 24, 180)]]);

  const graph = layout({
    nodes: nodes.map((node) => ({ ...node })) as SankeyNodeDatum[],
    links: links.map((link) => ({ ...link })) as SankeyLinkDatum[],
  });

  const sankeyNodes = graph.nodes.map((node) => ({
    x0: node.x0,
    x1: node.x1,
    y0: node.y0,
    y1: node.y1,
    name: node.name,
    group: node.group,
  }));

  const linkBands = graph.links.flatMap((link) => {
    const sourceNode = link.source as SankeyNodeDatum & { x0: number; x1: number; y0: number; y1: number };
    const targetNode = link.target as SankeyNodeDatum & { x0: number; x1: number; y0: number; y1: number };
    const widthValue = link.width ?? 0;
    const sourceY = link.y0 ?? (sourceNode.y0 + sourceNode.y1) / 2;
    const targetY = link.y1 ?? (targetNode.y0 + targetNode.y1) / 2;

    if (widthValue <= 0) {
      return [];
    }

    return [{
      group: link.group,
      points: [
        {
          x: sourceNode.x1,
          y0: sourceY - widthValue / 2,
          y1: sourceY + widthValue / 2,
        },
        {
          x: targetNode.x0,
          y0: targetY - widthValue / 2,
          y1: targetY + widthValue / 2,
        },
      ],
    }];
  });

  return { nodes: sankeyNodes, linkBands };
}

export default function ChartNodeBody({ node, presentationMode = false }: Props) {
  const config = node.config as ChartConfig;
  const {
    chartType,
    chartCatalogId,
    xColumn,
    yColumn,
    x2Column,
    y2Column,
    colorColumn,
    sizeColumn,
    lengthColumn,
    labelColumn,
    facetColumn,
    beeswarmAnchor,
    customCode,
    customEnabled,
    customBaseChartId,
  } = config;
  const normalizedBeeswarmAnchor = beeswarmAnchor ?? "middle";
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const columns = useMemo(() => upstreamNode?.result?.columns ?? [], [upstreamNode?.result?.columns]);
  const data = useMemo(() => upstreamNode?.result?.rows ?? [], [upstreamNode?.result?.rows]);
  const geometryColumn = useMemo(() => findGeometryColumn(columns), [columns]);
  const previewRef = useRef<HTMLDivElement>(null);
  const customEditorRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("type");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const selectedCatalogEntry = useMemo(
    () => getChartCatalogEntry(chartCatalogId, chartType),
    [chartCatalogId, chartType]
  );
  const getCompatibleConfigPatch = (targetConfig: ChartConfig) => {
    const nextEntry = getChartCatalogEntry(targetConfig.chartCatalogId, targetConfig.chartType);
    return getIncompatibleChartConfigPatch(targetConfig, nextEntry, columns);
  };
  const starterCustomCode = useMemo(
    () => buildCustomStarterCode(config, selectedCatalogEntry, columns, geometryColumn),
    [columns, config, geometryColumn, selectedCatalogEntry]
  );
  const [customDraft, setCustomDraft] = useState(customCode ?? starterCustomCode);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied">("idle");
  const [plotSize, setPlotSize] = useState({ width: 400, height: 220 });
  const [chartMarkup, setChartMarkup] = useState<string>("");
  const [chartError, setChartError] = useState<string>("");

  useEffect(() => {
    const previewEl = previewRef.current;
    if (!previewEl || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const next = computePlotSize(previewEl.clientWidth, previewEl.clientHeight);
      setPlotSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next
      );
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(previewEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCustomDraft(customCode ?? starterCustomCode);
  }, [customCode, starterCustomCode]);

  useEffect(() => {
    if (copyFeedback !== "copied") return undefined;
    const timeout = window.setTimeout(() => setCopyFeedback("idle"), 1200);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  useEffect(() => {
    if (customEnabled) return;

    const incompatiblePatch = getCompatibleConfigPatch(config);
    const sanitizedConfig = { ...config, ...incompatiblePatch } as ChartConfig;
    const defaultsPatch = inferChartConfigDefaults(sanitizedConfig, columns);
    const merged = { ...incompatiblePatch, ...defaultsPatch };

    // Only keep entries that actually differ from the current config to avoid loops
    const configPatch: Partial<ChartConfig> = {};
    for (const [key, value] of Object.entries(merged)) {
      if (!Object.is((config as Record<string, unknown>)[key], value)) {
        (configPatch as Record<string, unknown>)[key] = value;
      }
    }
    if (Object.keys(configPatch).length === 0) return;

    updateNodeConfig(node.id, configPatch);
  }, [columns, config, customEnabled, node.id, updateNodeConfig]);

  useEffect(() => {
    if (
      data.length === 0 ||
      !isChartReady(
        {
          chartType,
          xColumn,
          yColumn,
          x2Column,
          y2Column,
          colorColumn,
          sizeColumn,
          lengthColumn,
          labelColumn,
          facetColumn,
        },
        selectedCatalogEntry
      )
    ) {
      setChartMarkup("");
      setChartError("");
      return;
    }

    let cancelled = false;

    async function renderChart() {
      try {
        const Plot = await import("@observablehq/plot");
        if (cancelled) return;
        if (customEnabled && (customCode ?? "").trim()) {
          if (!customCode?.includes("Plot.plot(")) {
            throw new Error('Custom charts must call Plot.plot({ ... }).');
          }

          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
            ...args: string[]
          ) => (...fnArgs: unknown[]) => Promise<unknown>;
          let plottedChart: HTMLElement | SVGElement | null = null;
          const plotProxy = new Proxy(Plot, {
            get(target, prop, receiver) {
              if (prop === "plot") {
                return (options: Record<string, unknown>) => {
                  const chart = target.plot(options);
                  plottedChart = chart;
                  return chart;
                };
              }
              return Reflect.get(target, prop, receiver);
            },
          });
          const helpers = {
            geometryFeatures: (
              rows: Record<string, unknown>[],
              geometryField: string,
              labelField: string,
              valueField: string
            ) => buildGeometryFeatures(rows, geometryField, labelField, valueField),
            parseGeometryValue,
          };
          const executeCustomPlot = new AsyncFunction(
            "Plot",
            "data",
            "width",
            "height",
            "helpers",
            `"use strict";\n${customCode}`
          );
          const customResult = await executeCustomPlot(plotProxy, data, plotSize.width, plotSize.height, helpers);
          const customChart = plottedChart ?? customResult;

          if (!(customChart instanceof HTMLElement) && !(customChart instanceof SVGElement)) {
            throw new Error('Custom code must return Plot.plot({ ... }) or call Plot.plot({ ... }).');
          }

          if (!cancelled) {
            const html =
              customChart instanceof HTMLElement
                ? customChart.outerHTML
                : (() => {
                    const container = document.createElement("div");
                    container.appendChild(customChart.cloneNode(true));
                    return container.outerHTML;
                  })();
            setChartMarkup(html);
            setChartError("");
          }
          return;
        }
        const marks: PlotModule.Markish[] = [];
        const variantId = selectedCatalogEntry?.id ?? chartType;
        let showColorLegend = false;
        let showGrid = true;
        const plotOptions: Record<string, unknown> = {};
        let legendOptions: Record<string, unknown> | null = null;

        switch (variantId) {
          case "stacked-bar":
            if (xColumn && yColumn && colorColumn) {
              showColorLegend = true;
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              const reducer = getReducerForColumnName(yColumn);
              // mejora 1: rotar etiquetas X si hay muchas categorías
              const uniqueXCount = new Set(
                data.map((row) => (row as Record<string, unknown>)[xColumn])
              ).size;
              const tickRotate = getXTickRotation(uniqueXCount);
              plotOptions.x = { tickRotate };
              // mejora 3: ordenar barras por total descendente
              const sortOpts = buildStackedSortOptions();
              marks.push(
                Plot.barY(
                  data,
                  Plot.groupX(
                    { y: reducer },
                    {
                      x: xColumn,
                      y: yColumn,
                      fill: colorColumn,
                      sort: sortOpts,
                    } as Record<string, unknown>
                  )
                )
              );
              // mejora 2: tooltip al hover por segmento
              marks.push(
                Plot.tip(
                  data,
                  Plot.pointerX(
                    Plot.groupX(
                      { y: reducer },
                      buildTipMarkOptions(xColumn, yColumn, colorColumn) as Record<string, unknown>
                    )
                  )
                )
              );
              marks.push(Plot.ruleY([0]));
              // mejora 4: escala log si hay alta varianza en los totales por grupo
              const groupSumValues = Array.from(
                new Map(
                  data.reduce((acc, row) => {
                    const r = row as Record<string, unknown>;
                    const key = String(r[xColumn]);
                    const val = typeof r[yColumn] === "number" ? (r[yColumn] as number) : Number(r[yColumn]);
                    acc.set(key, (acc.get(key) ?? 0) + (Number.isFinite(val) ? val : 0));
                    return acc;
                  }, new Map<string, number>())
                ).values()
              );
              if (detectsHighVariance(groupSumValues)) {
                plotOptions.y = { type: "log" };
              }
            }
            break;
          case "grouped-bar":
            if (yColumn && colorColumn && facetColumn) {
              showColorLegend = true;
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              const reducer = getReducerForColumnName(yColumn);
              plotOptions.fx = { label: null, tickRotate: -45 };
              plotOptions.x = { axis: null };
              marks.push(
                Plot.barY(
                  data,
                  Plot.groupX(
                    { y: reducer },
                    {
                      x: colorColumn,
                      y: yColumn,
                      fill: colorColumn,
                      fx: facetColumn,
                    } as Record<string, unknown>
                  )
                )
              );
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "vertical-bar":
          case "bar":
          case "barY":
            if (xColumn && yColumn) {
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              const reducer = getReducerForColumnName(yColumn);
              const uniqueXCount = new Set(
                data.map((row) => (row as Record<string, unknown>)[xColumn])
              ).size;
              const tickRotate = getXTickRotation(uniqueXCount);
              plotOptions.x = { tickRotate };
              marks.push(
                Plot.barY(
                  data,
                  Plot.groupX(
                    { y: reducer },
                    getBarYMarkOptions(xColumn, yColumn, colorColumn || BASE_CHART_COLOR) as Record<string, unknown>
                  )
                )
              );
              marks.push(
                Plot.tip(
                  data,
                  Plot.pointerX(
                    Plot.groupX(
                      { y: reducer },
                      buildTipMarkOptions(xColumn, yColumn, colorColumn) as Record<string, unknown>
                    )
                  )
                )
              );
              marks.push(Plot.ruleY([0], { stroke: "#94a3b8" }));
            }
            break;
          case "horizontal-bar":
          case "barX":
            if (xColumn && yColumn) {
              if (colorColumn) showColorLegend = true;
              const reducer = getReducerForColumnName(xColumn);
              marks.push(
                Plot.barX(
                  data,
                  Plot.groupY(
                    { x: reducer },
                    getBarXMarkOptions(yColumn, xColumn, colorColumn || BASE_CHART_COLOR) as Record<string, unknown>
                  )
                )
              );
              marks.push(Plot.ruleX([0], { stroke: "#94a3b8" }));
            }
            break;
          case "waffle-chart":
            if (xColumn && yColumn) {
              showColorLegend = true;
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              showGrid = false;
              const reducer = getReducerForColumnName(yColumn);
              const waffleData = aggregateCategoryValues(
                data as Record<string, unknown>[],
                xColumn,
                yColumn,
                reducer,
                colorColumn || xColumn
              );
              marks.push(
                Plot.waffleY(waffleData, {
                  x: "category",
                  y: "value",
                  fill: colorColumn ? "group" : "category",
                } as Record<string, unknown>)
              );
            }
            break;
          case "waterfall-chart":
            if (xColumn && yColumn) {
              const waterfallData = buildWaterfallData(data as Record<string, unknown>[], xColumn, yColumn, colorColumn);
              if (waterfallData.length > 0) {
                showColorLegend = Boolean(colorColumn);
                if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
                marks.push(
                  Plot.barY(waterfallData, {
                    x: "step",
                    y1: "start",
                    y2: "end",
                    fill: colorColumn
                      ? "fill"
                      : (row: { change: number }) => row.change >= 0 ? "#10b981" : "#ef4444",
                  } as Record<string, unknown>)
                );
                marks.push(
                  Plot.text(waterfallData, {
                    x: "step",
                    y: (row: { start: number; end: number }) => Math.max(row.start, row.end),
                    text: "label",
                    dy: -8,
                    fontWeight: "bold",
                    fontSize: 10,
                  } as Record<string, unknown>)
                );
                marks.push(Plot.ruleY([0]));
              }
            }
            break;
          case "line-chart":
          case "line":
            if (xColumn && yColumn) {
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              marks.push(
                Plot.line(data, {
                  x: xColumn,
                  y: yColumn,
                  stroke: colorColumn || BASE_CHART_COLOR,
                })
              );
            }
            break;
          case "multi-series-line":
            if (xColumn && yColumn && colorColumn) {
              showColorLegend = true;
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              marks.push(
                Plot.line(data, {
                  x: xColumn,
                  y: yColumn,
                  stroke: colorColumn,
                })
              );
            }
            break;
          case "area-chart":
          case "area":
            if (xColumn && yColumn) {
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              marks.push(
                Plot.areaY(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                })
              );
              marks.push(
                Plot.line(data, {
                  x: xColumn,
                  y: yColumn,
                  stroke: colorColumn || "#0d9488",
                })
              );
            }
            break;
          case "temporal-histogram":
          case "histogram":
            if (xColumn) {
              const histogramOptions: Record<string, unknown> = { x: xColumn, fill: BASE_CHART_COLOR };
              marks.push(
                Plot.rectY(
                  data,
                  Plot.binX(
                    { y: "count" },
                    histogramOptions
                  )
                )
              );
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "faceted-dodge":
            if (xColumn && facetColumn) {
              showGrid = true;
              showColorLegend = Boolean(colorColumn || facetColumn);
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              const uniqueFacetCount = new Set(
                data.map((row) => (row as Record<string, unknown>)[facetColumn])
              ).size;
              const tickRotate = getXTickRotation(uniqueFacetCount);
              plotOptions.fx = { label: null, tickRotate };
              plotOptions.x = { axis: null };
              marks.push(
                Plot.dot(
                  data,
                  Plot.dodgeX("middle", {
                    fx: facetColumn,
                    y: xColumn,
                    fill: colorColumn || facetColumn,
                  } as Record<string, unknown>)
                )
              );
            }
            break;
          case "scatterplot":
          case "color-scatterplot":
          case "scatter":
            if (xColumn && yColumn) {
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              marks.push(
                Plot.dot(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                })
              );
            }
            break;
          case "bubble-chart":
            if (xColumn && yColumn && sizeColumn) {
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              marks.push(
                Plot.dot(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                  r: sizeColumn,
                } as Record<string, unknown>)
              );
            }
            break;
          case "beeswarm":
            if (xColumn) {
              if (colorColumn) {
                showColorLegend = true;
                const colorColInfo = columns.find((c) => c.name === colorColumn);
                const isNumericColor = colorColInfo ? isNumericType(colorColInfo.type) : false;
                if (isNumericColor) {
                  plotOptions.color = { scheme: "greens" };
                } else {
                  legendOptions = getCompactSwatchLegendOptions(plotSize.width);
                }
              }
              marks.push(
                Plot.dot(
                  data,
                  Plot.dodgeY({
                    x: xColumn,
                    fill: colorColumn || BASE_CHART_COLOR,
                    anchor: normalizedBeeswarmAnchor,
                  } as Record<string, unknown>)
                )
              );
            }
            break;
          case "barcode-strip-plot":
            if (xColumn) {
              const stripCategoryColumnInfo = yColumn
                ? columns.find((column) => column.name === yColumn)
                : undefined;
              const stripGroupColumnInfo = colorColumn
                ? columns.find((column) => column.name === colorColumn)
                : undefined;
              const stripMode = resolveStripChartMode({
                hasCategory: Boolean(yColumn && stripCategoryColumnInfo && !isNumericType(stripCategoryColumnInfo.type)),
                hasGroup: Boolean(colorColumn && stripGroupColumnInfo && !isNumericType(stripGroupColumnInfo.type)),
                categoryEqualsGroup: yColumn === colorColumn,
                groupCardinality: colorColumn
                  ? new Set(data.map((row) => String((row as Record<string, unknown>)[colorColumn] ?? ""))).size
                  : 0,
                maxLegendItems: MAX_INLINE_CATEGORICAL_LEGEND_ITEMS,
              });

              if (stripMode.mode === "grouped" && yColumn && colorColumn) {
                const stripYColumn = yColumn as string;
                const stripColorColumn = colorColumn as string;
                showGrid = true;
                showColorLegend = stripMode.showLegend;
                if (stripMode.showLegend) {
                  legendOptions = getCompactSwatchLegendOptions(plotSize.width);
                }
                plotOptions.y = {
                  domain: Array.from(
                    new Set(data.map((row) => (row as Record<string, unknown>)[stripYColumn]))
                  ),
                  reverse: true,
                  label: null,
                };
                marks.push(Plot.ruleX([0], { stroke: "#94a3b8" }));
                plotOptions.x = {
                  grid: true,
                  label: `${xColumn} →`,
                };
                marks.push(
                  Plot.tickX(data, {
                    x: xColumn,
                    y: stripYColumn,
                    stroke: stripMode.useGroupColor ? stripColorColumn : BASE_CHART_COLOR,
                  } as Record<string, unknown>)
                );
              } else if (stripMode.mode === "category" && yColumn && stripCategoryColumnInfo && !isNumericType(stripCategoryColumnInfo.type)) {
                const stripYColumn = yColumn as string;
                showGrid = true;
                plotOptions.y = {
                  domain: Array.from(
                    new Set(data.map((row) => (row as Record<string, unknown>)[stripYColumn]))
                  ),
                  reverse: true,
                  label: null,
                };
                plotOptions.x = {
                  grid: true,
                  label: `${xColumn} →`,
                };
                marks.push(
                  Plot.tickX(data, {
                    x: xColumn,
                    y: stripYColumn,
                    stroke: BASE_CHART_COLOR,
                  } as Record<string, unknown>)
                );
              } else {
                showGrid = true;
                plotOptions.x = {
                  grid: true,
                  label: `${xColumn} →`,
                };
                marks.push(
                  Plot.tickX(data, {
                    x: xColumn,
                    stroke: BASE_CHART_COLOR,
                  } as Record<string, unknown>)
                );
              }
            }
            break;
          case "dot-comparison":
          case "dot":
            if (xColumn && yColumn) {
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              const reducer = getReducerForColumnName(yColumn);
              const dotData = aggregateCategoryValues(
                data as Record<string, unknown>[],
                xColumn,
                yColumn,
                reducer,
                colorColumn
              );
              const dotUniqueXCount = new Set(
                data.map((row) => (row as Record<string, unknown>)[xColumn])
              ).size;
              const dotTickRotate = getXTickRotation(dotUniqueXCount);
              plotOptions.x = { tickRotate: dotTickRotate };
              marks.push(Plot.ruleY([0]));
              marks.push(
                Plot.dot(dotData, {
                  x: "category",
                  y: "value",
                  fill: colorColumn ? "group" : BASE_CHART_COLOR,
                })
              );
              marks.push(
                Plot.tip(dotData, Plot.pointerX({
                  x: "category",
                  y: "value",
                  ...(colorColumn ? { fill: "group" } : {}),
                }))
              );
            }
            break;
          case "box-plot":
          case "box":
            if (xColumn && yColumn) {
              const uniqueXCount = new Set(
                data.map((row) => (row as Record<string, unknown>)[xColumn])
              ).size;
              const tickRotate = getXTickRotation(uniqueXCount);
              plotOptions.x = { tickRotate };
              marks.push(
                Plot.boxY(data, { x: xColumn, y: yColumn } as Record<string, unknown>)
              );
            }
            break;
          case "heatmap":
            if (xColumn && yColumn) {
              marks.push(
                Plot.cell(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || "count",
                  ...(colorColumn ? {} : Plot.group({ fill: "count" })),
                } as Record<string, unknown>)
              );
            }
            break;
          case "world-choropleth":
            if (xColumn && yColumn) {
              showColorLegend = true;
              showGrid = false;
              plotOptions.marginTop = 8;
              plotOptions.marginRight = 8;
              plotOptions.marginBottom = 8;
              plotOptions.marginLeft = 8;
              plotOptions.color = {
                type: "quantile",
                n: 9,
                scheme: "blues",
                ...getQuantitativeLegendOptions(plotSize.width, yColumn),
              };

              if (!geometryColumn) {
                throw new Error("Connect a GeoJSON or TopoJSON table to render this choropleth.");
              }

              const features = buildGeometryFeatures(
                data as Record<string, unknown>[],
                geometryColumn,
                xColumn,
                yColumn
              );

              if (features.length === 0) {
                throw new Error("The connected geospatial table does not contain valid geometries.");
              }

              plotOptions.projection = {
                type: "mercator",
                domain: {
                  type: "FeatureCollection",
                  features,
                },
              };
              marks.push(
                Plot.geo(features, {
                  fill: (feature: GeometryFeatureDatum) => feature.properties.value,
                  stroke: "#ffffff",
                  strokeWidth: 0.8,
                  tip: true,
                  title: (feature: GeometryFeatureDatum) =>
                    feature.properties.value === null
                      ? feature.properties.label
                      : `${feature.properties.label}: ${feature.properties.value}`,
                } as Record<string, unknown>)
              );
            }
            break;
          case "dot-map":
            if (xColumn) {
              showGrid = false;
              plotOptions.marginTop = 8;
              plotOptions.marginRight = 8;
              plotOptions.marginBottom = 8;
              plotOptions.marginLeft = 8;

              if (!geometryColumn) {
                throw new Error("Connect a GeoJSON or TopoJSON table to render this bubble map.");
              }

              const bubbleFeatures = (data as Record<string, unknown>[]).flatMap((row) => {
                const geometry = parseGeometryValue(row[geometryColumn]);
                if (!geometry) return [];

                return [{
                  type: "Feature" as const,
                  properties: {
                    label:
                      row[xColumn] === undefined || row[xColumn] === null
                        ? "Unknown"
                        : String(row[xColumn]),
                    value: sizeColumn ? toFiniteNumber(row[sizeColumn]) : null,
                    group:
                      colorColumn && row[colorColumn] !== undefined && row[colorColumn] !== null
                        ? String(row[colorColumn])
                        : null,
                  },
                  geometry,
                }];
              });

              if (bubbleFeatures.length === 0) {
                throw new Error("The connected geospatial table does not contain valid geometries.");
              }

              plotOptions.projection = {
                type: "mercator",
                domain: {
                  type: "FeatureCollection",
                  features: bubbleFeatures,
                },
              };
              showColorLegend = Boolean(colorColumn);
              if (colorColumn) {
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              marks.push(
                Plot.geo(bubbleFeatures, {
                  fill: "#f8fafc",
                  stroke: "#e2e8f0",
                  strokeWidth: 0.8,
                } as Record<string, unknown>)
              );
              marks.push(
                Plot.dot(
                  bubbleFeatures,
                  Plot.geoCentroid({
                    r: sizeColumn
                      ? (feature: GeometryFeatureDatum) => feature.properties.value ?? 0
                      : 5,
                    fill: colorColumn
                      ? (feature: GeometryFeatureDatum) => feature.properties.group ?? BASE_CHART_COLOR
                      : BASE_CHART_COLOR,
                    stroke: "#ffffff",
                    strokeWidth: 1,
                    fillOpacity: 0.75,
                    tip: true,
                    title: (feature: GeometryFeatureDatum) =>
                      feature.properties.value === null
                        ? feature.properties.label
                        : `${feature.properties.label}: ${feature.properties.value}`,
                  } as Record<string, unknown>)
                )
              );
            }
            break;
          case "spike-map":
          case "spike":
            if (xColumn && lengthColumn) {
              showGrid = false;
              plotOptions.marginTop = 24;
              plotOptions.marginRight = 0;
              plotOptions.marginBottom = 0;
              plotOptions.marginLeft = 0;

              if (!geometryColumn) {
                throw new Error("Connect a GeoJSON or TopoJSON table to render this spike map.");
              }

              const spikeFeatures = (data as Record<string, unknown>[]).flatMap((row) => {
                const geometry = parseGeometryValue(row[geometryColumn]);
                const value = toFiniteNumber(row[lengthColumn]);
                if (!geometry || value === null) return [];

                return [{
                  type: "Feature" as const,
                  properties: {
                    label:
                      row[xColumn] === undefined || row[xColumn] === null
                        ? "Unknown"
                        : String(row[xColumn]),
                    value,
                    group:
                      colorColumn && row[colorColumn] !== undefined && row[colorColumn] !== null
                        ? String(row[colorColumn])
                        : null,
                  },
                  geometry,
                }];
              });

              if (spikeFeatures.length === 0) {
                throw new Error("The connected geospatial table does not contain valid geometries.");
              }

              const spikeValues = spikeFeatures
                .map((feature) => feature.properties.value)
                .filter((value): value is number => value !== null && Number.isFinite(value));
              const spikeLegendMode = getSpikeLegendMode(spikeValues, lengthColumn);
              const maxSpikeValue = spikeValues.length > 0 ? Math.max(...spikeValues) : 0;
              plotOptions.length = { range: getSpikeLengthRange(spikeLegendMode, maxSpikeValue) };

              plotOptions.projection = {
                type: "mercator",
                domain: {
                  type: "FeatureCollection",
                  features: spikeFeatures,
                },
              };
              showColorLegend = Boolean(colorColumn);
              if (colorColumn) {
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              marks.push(
                Plot.geo(spikeFeatures, {
                  fill: "#e0e0e0",
                  stroke: "white",
                  strokeWidth: 1,
                } as Record<string, unknown>)
              );
              marks.push(
                Plot.spike(
                  spikeFeatures,
                  Plot.geoCentroid({
                    length: (feature: GeometryFeatureDatum) => feature.properties.value ?? 0,
                    stroke: colorColumn
                      ? (feature: GeometryFeatureDatum) => feature.properties.group ?? BASE_CHART_COLOR
                      : "red",
                    fill: colorColumn
                      ? (feature: GeometryFeatureDatum) => feature.properties.group ?? BASE_CHART_COLOR
                      : "red",
                    tip: true,
                    title: (feature: GeometryFeatureDatum) =>
                      feature.properties.value === null
                        ? feature.properties.label
                        : `${feature.properties.label}: ${feature.properties.value}`,
                  } as Record<string, unknown>)
                )
              );
              if (!colorColumn) {
                marks.push(
                  ...buildSpikeLegendMarks(
                    Plot,
                    spikeValues,
                    spikeLegendMode,
                    "red",
                    "bottom-right"
                  )
                );
              }
            }
            break;
          case "arc-map":
          case "arc":
            if (xColumn && yColumn && x2Column && y2Column) {
              const { land } = await loadWorldAtlasFeatures();
              const locations = (data as Record<string, unknown>[]).flatMap((row) => {
                const originLon = toFiniteNumber(row[xColumn]);
                const originLat = toFiniteNumber(row[yColumn]);
                const destLon = toFiniteNumber(row[x2Column]);
                const destLat = toFiniteNumber(row[y2Column]);
                const points: Array<{ longitude: number; latitude: number }> = [];

                if (originLon !== null && originLat !== null) {
                  points.push({ longitude: originLon, latitude: originLat });
                }
                if (destLon !== null && destLat !== null) {
                  points.push({ longitude: destLon, latitude: destLat });
                }

                return points;
              });

              showGrid = false;
              showColorLegend = Boolean(colorColumn);
              plotOptions.projection = "equal-earth";
              plotOptions.marginTop = 8;
              plotOptions.marginRight = 8;
              plotOptions.marginBottom = 8;
              plotOptions.marginLeft = 8;
              marks.push(
                Plot.geo(land, {
                  fill: "#f8fafc",
                  stroke: "#cbd5e1",
                } as Record<string, unknown>)
              );
              marks.push(
                Plot.arrow(data, {
                  x1: xColumn,
                  y1: yColumn,
                  x2: x2Column,
                  y2: y2Column,
                  bend: true,
                  stroke: colorColumn || BASE_CHART_COLOR,
                  strokeOpacity: 0.45,
                  strokeWidth: lengthColumn || 1.5,
                } as Record<string, unknown>)
              );
              marks.push(
                Plot.dot(locations, {
                  x: "longitude",
                  y: "latitude",
                  fill: "#0f172a",
                  r: 1.8,
                } as Record<string, unknown>)
              );
              marks.push(Plot.sphere());
            }
            break;
          case "treemap":
            if (xColumn && yColumn) {
              const reducer = getReducerForColumnName(yColumn);
              const leaves = await buildTreemapLeaves(
                data as Record<string, unknown>[],
                xColumn,
                yColumn,
                plotSize.width,
                plotSize.height,
                colorColumn,
                reducer
              );
              if (leaves.length > 0) {
                showColorLegend = Boolean(colorColumn);
                if (colorColumn) {
                  legendOptions = getCompactSwatchLegendOptions(plotSize.width);
                }
                showGrid = false;
                plotOptions.x = { axis: null };
                plotOptions.y = { axis: null };
                plotOptions.marginTop = 20;
                plotOptions.marginRight = 8;
                plotOptions.marginBottom = 8;
                plotOptions.marginLeft = 8;
                marks.push(
                  Plot.rect(leaves, {
                    x1: "x0",
                    x2: "x1",
                    y1: "y0",
                    y2: "y1",
                    fill: "group",
                    inset: 1,
                    title: (leaf: { group: string; label: string; value: number }) =>
                      `${leaf.group}: ${leaf.label} (${leaf.value})`,
                  } as Record<string, unknown>)
                );
                marks.push(
                  Plot.text(leaves, {
                    x: (leaf: { x0: number; x1: number }) => (leaf.x0 + leaf.x1) / 2,
                    y: (leaf: { y0: number; y1: number }) => (leaf.y0 + leaf.y1) / 2,
                    text: (leaf: { x0: number; x1: number; y0: number; y1: number; label: string }) =>
                      leaf.x1 - leaf.x0 > 38 && leaf.y1 - leaf.y0 > 22 ? leaf.label : "",
                    textAnchor: "middle",
                    lineAnchor: "middle",
                    fontSize: 10,
                    fontWeight: 600,
                    fill: "#fff",
                  } as Record<string, unknown>)
                );
              }
            }
            break;
          case "grid-cartogram":
            if (xColumn && yColumn && colorColumn) {
              showColorLegend = true;
              showGrid = false;
              plotOptions.x = { axis: null };
              plotOptions.y = { axis: null };
              plotOptions.marginTop = 12;
              plotOptions.marginRight = 12;
              plotOptions.marginBottom = 12;
              plotOptions.marginLeft = 12;

              const cartogramCells = buildGridCartogramData(
                data as Record<string, unknown>[],
                xColumn,
                yColumn,
                colorColumn,
                labelColumn
              );

              if (cartogramCells.length === 0) {
                throw new Error("Select numeric grid columns for X, Y, and Value.");
              }

              const cartogramValues = cartogramCells.map((cell) => cell.value);
              const ratioDomain = isGridRatioDomain(cartogramValues);
              plotOptions.color = ratioDomain
                ? {
                    type: "diverging-log",
                    pivot: 1,
                    scheme: "PiYG",
                    ...getQuantitativeLegendOptions(plotSize.width, colorColumn),
                  }
                : {
                    scheme: "blues",
                    ...getQuantitativeLegendOptions(plotSize.width, colorColumn),
                  };

              marks.push(
                Plot.cell(cartogramCells, {
                  x: "gridX",
                  y: "gridY",
                  fill: "value",
                  inset: 1,
                  stroke: "#ffffff",
                  strokeWidth: 1,
                  tip: true,
                  title: (cell: GridCartogramDatum) =>
                    cell.label
                      ? `${cell.label}: ${formatGridCartogramValue(cell.value, ratioDomain)}`
                      : `(${cell.gridX}, ${cell.gridY}): ${formatGridCartogramValue(cell.value, ratioDomain)}`,
                } as Record<string, unknown>)
              );
              if (labelColumn) {
                marks.push(
                  Plot.text(cartogramCells, {
                    x: "gridX",
                    y: "gridY",
                    text: (cell: GridCartogramDatum) => cell.label,
                    dy: -5,
                    fontSize: 9,
                    fontWeight: 700,
                    lineWidth: 8,
                    textAnchor: "middle",
                    lineAnchor: "middle",
                    fill: "#0f172a",
                  } as Record<string, unknown>)
                );
              }
              marks.push(
                Plot.text(cartogramCells, {
                  x: "gridX",
                  y: "gridY",
                  text: (cell: GridCartogramDatum) => formatGridCartogramValue(cell.value, ratioDomain),
                  dy: labelColumn ? 8 : 0,
                  fontSize: labelColumn ? 8.5 : 10,
                  fontWeight: labelColumn ? 500 : 700,
                  lineWidth: 8,
                  textAnchor: "middle",
                  lineAnchor: "middle",
                  fill: labelColumn ? "#475467" : "#0f172a",
                } as Record<string, unknown>)
              );
            }
            break;
          case "link-chart":
          case "link":
            if (xColumn && yColumn && x2Column && y2Column) {
              showGrid = false;
              showColorLegend = Boolean(colorColumn);
              if (colorColumn) {
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
              marks.push(
                Plot.link(data, {
                  x1: xColumn,
                  y1: yColumn,
                  x2: x2Column,
                  y2: y2Column,
                  stroke: colorColumn || "#94a3b8",
                  strokeOpacity: 0.7,
                } as Record<string, unknown>)
              );
              marks.push(
                Plot.dot(data, {
                  x: x2Column,
                  y: y2Column,
                  fill: BASE_CHART_COLOR,
                  r: 4,
                } as Record<string, unknown>)
              );
              if (labelColumn) {
                marks.push(
                  Plot.text(data, {
                    x: x2Column,
                    y: y2Column,
                    text: labelColumn,
                    dx: 8,
                    textAnchor: "start",
                  } as Record<string, unknown>)
                );
              }
            }
            break;
          case "sankey-diagram":
            if (xColumn && yColumn && sizeColumn) {
              const { nodes: sankeyNodes, linkBands } = await buildSankeyData(
                data as Record<string, unknown>[],
                xColumn,
                yColumn,
                sizeColumn,
                plotSize.width,
                plotSize.height,
                colorColumn
              );
              if (sankeyNodes.length > 0 && linkBands.length > 0) {
                showColorLegend = Boolean(colorColumn);
                if (colorColumn) {
                  legendOptions = getCompactSwatchLegendOptions(plotSize.width);
                }
                showGrid = false;
                plotOptions.x = { axis: null };
                plotOptions.y = { axis: null };
                plotOptions.marginTop = 20;
                plotOptions.marginRight = 48;
                plotOptions.marginBottom = 8;
                plotOptions.marginLeft = 8;

                linkBands.forEach((band) => {
                  marks.push(
                    Plot.areaY(band.points, {
                      x: "x",
                      y1: "y0",
                      y2: "y1",
                      curve: "bump-x",
                      fill: colorColumn ? band.group : "#0f172a",
                      fillOpacity: 0.16,
                    } as Record<string, unknown>)
                  );
                });

                marks.push(
                  Plot.rect(sankeyNodes, {
                    x1: "x0",
                    x2: "x1",
                    y1: "y0",
                    y2: "y1",
                    fill: colorColumn ? "group" : "name",
                  } as Record<string, unknown>)
                );
                marks.push(
                  Plot.text(sankeyNodes, {
                    x: "x1",
                    y: (node: { y0: number; y1: number }) => (node.y0 + node.y1) / 2,
                    text: "name",
                    dx: 5,
                    textAnchor: "start",
                    lineAnchor: "middle",
                    fontSize: 10,
                  } as Record<string, unknown>)
                );
              }
            }
            break;
          case "pie":
            if (xColumn && yColumn) {
              const reducer = getReducerForColumnName(yColumn);
              const pieData = aggregateCategoryValues(
                data as Record<string, unknown>[],
                xColumn,
                yColumn,
                reducer
              ).map((entry) => ({
                label: entry.category,
                value: entry.value,
              }));
              showColorLegend = true;
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              marks.push(
                Plot.barY(pieData, {
                  x: "label",
                  y: "value",
                  fill: "label",
                  sort: { x: "-y" },
                })
              );
              marks.push(Plot.ruleY([0]));
            }
            break;
          default:
            if (xColumn && yColumn) {
              marks.push(
                Plot.barY(data, { x: xColumn, y: yColumn, fill: BASE_CHART_COLOR })
              );
            }
        }

        if (marks.length === 0) {
          if (!cancelled) {
            setChartMarkup("");
            setChartError("");
          }
          return;
        }

        const { color: variantColorOptions, ...restPlotOptions } = plotOptions as Record<string, unknown> & {
          color?: Record<string, unknown>;
        };
        const categoricalYLabels =
          yColumn && (variantId === "horizontal-bar" || variantId === "barX" || variantId === "barcode-strip-plot")
            ? Array.from(
                new Set(data.map((row) => String((row as Record<string, unknown>)[yColumn] ?? "")))
              )
            : [];
        // Compute marginLeft first — needed for legend alignment
        const dynamicMarginLeft =
          variantId === "grid-cartogram" || variantId === "grid"
            ? 12
            : variantId === "horizontal-bar" || variantId === "barX"
            ? computeCategoricalYMargin(categoricalYLabels)
            : variantId === "barcode-strip-plot" && Boolean(yColumn)
            ? computeCategoricalYMargin(categoricalYLabels)
            : variantId === "stacked-bar" && xColumn && yColumn
            ? getCompactAxisMargin(computeMaxGroupSum(data as Record<string, unknown>[], xColumn, yColumn))
            : computeYMargin(
                variantId === "faceted-dodge" && xColumn
                  ? data.map((row) => (row as Record<string, unknown>)[xColumn])
                  : yColumn
                    ? data.map((row) => (row as Record<string, unknown>)[yColumn])
                    : []
              );

        const colorColumnInfo = colorColumn
          ? columns.find((column) => column.name === colorColumn)
          : undefined;
        const categoricalLegendColumnType = colorColumnInfo?.type;
        const shouldSuppressCategoricalLegend =
          showColorLegend &&
          Boolean(colorColumn) &&
          Boolean(categoricalLegendColumnType) &&
          !(categoricalLegendColumnType ? isNumericType(categoricalLegendColumnType) : false) &&
          !shouldShowInlineCategoricalLegend(
            data.map((row) => (row as Record<string, unknown>)[colorColumn as string]),
            MAX_INLINE_CATEGORICAL_LEGEND_ITEMS
          );
        if (shouldSuppressCategoricalLegend) {
          showColorLegend = false;
          legendOptions = null;
        }

        // Pass marginLeft to the legend so swatches align with the plot area
        const resolvedColorOptions = variantColorOptions
          ? { ...variantColorOptions, ...(showColorLegend ? { legend: true } : {}) }
          : showColorLegend
            ? { ...(legendOptions ?? { legend: true }), marginLeft: dynamicMarginLeft }
            : undefined;

        const xAxisValues = xColumn ? data.map((row) => (row as Record<string, unknown>)[xColumn]) : [];
        // mejora 5: para stacked-bar usar los totales por grupo como referencia del tickFormat
        const yAxisValues =
          variantId === "stacked-bar" && xColumn && yColumn
            ? Array.from(
                new Map(
                  data.reduce((acc, row) => {
                    const r = row as Record<string, unknown>;
                    const key = String(r[xColumn]);
                    const val = typeof r[yColumn] === "number" ? (r[yColumn] as number) : Number(r[yColumn]);
                    acc.set(key, (acc.get(key) ?? 0) + (Number.isFinite(val) ? val : 0));
                    return acc;
                  }, new Map<string, number>())
                ).values()
              )
            : variantId === "faceted-dodge" && xColumn
            ? data.map((row) => (row as Record<string, unknown>)[xColumn])
            : yColumn
            ? data.map((row) => (row as Record<string, unknown>)[yColumn])
            : [];
        const suppressXLabel = variantId === "vertical-bar" || variantId === "bar" || variantId === "barY" || variantId === "stacked-bar" || variantId === "grouped-bar" || variantId === "dot-comparison" || variantId === "dot";
        const resolvedXAxisOptionsBase = mergeAxisDisplayOptions(
          restPlotOptions.x,
          getAxisLabel("x", selectedCatalogEntry, chartType, xColumn, yColumn),
          xColumn,
          xAxisValues
        );
        const resolvedXAxisOptions = suppressXLabel
          ? {
              ...(resolvedXAxisOptionsBase && typeof resolvedXAxisOptionsBase === "object"
                ? (resolvedXAxisOptionsBase as Record<string, unknown>)
                : {}),
              label: null,
            }
          : resolvedXAxisOptionsBase;
        const suppressYLabel =
          variantId === "horizontal-bar" || variantId === "barX" || variantId === "barcode-strip-plot";
        const resolvedYAxisOptionsBase = mergeAxisDisplayOptions(
          restPlotOptions.y,
          getAxisLabel("y", selectedCatalogEntry, chartType, variantId === "faceted-dodge" ? xColumn : yColumn, xColumn),
          variantId === "faceted-dodge" ? xColumn : yColumn,
          yAxisValues
        );
        const resolvedYAxisOptions = suppressYLabel
          ? {
              ...(resolvedYAxisOptionsBase && typeof resolvedYAxisOptionsBase === "object"
                ? (resolvedYAxisOptionsBase as Record<string, unknown>)
                : {}),
              label: null,
            }
          : resolvedYAxisOptionsBase;
        const finalPlotOptions = {
          ...restPlotOptions,
          ...(resolvedXAxisOptions ? { x: resolvedXAxisOptions } : {}),
          ...(resolvedYAxisOptions ? { y: resolvedYAxisOptions } : {}),
        };
        // mejora 1: margen inferior basado en longitud real de etiquetas rotadas
        const xTickRotate =
          restPlotOptions.x && typeof restPlotOptions.x === "object"
            ? ((restPlotOptions.x as Record<string, unknown>).tickRotate as number | undefined) ?? 0
            : 0;
        const fxTickRotate =
          restPlotOptions.fx && typeof restPlotOptions.fx === "object"
            ? ((restPlotOptions.fx as Record<string, unknown>).tickRotate as number | undefined) ?? 0
            : 0;
        const xUniqueLabels = xColumn
          ? Array.from(new Set(data.map((row) => String((row as Record<string, unknown>)[xColumn]))))
          : [];
        const fxUniqueLabels = facetColumn
          ? Array.from(new Set(data.map((row) => String((row as Record<string, unknown>)[facetColumn]))))
          : [];
        const dynamicMarginBottom =
          variantId === "grid-cartogram" || variantId === "grid"
            ? 12
            : Math.max(
                getMarginBottomForLabels(xUniqueLabels, xTickRotate),
                getMarginBottomForLabels(fxUniqueLabels, fxTickRotate)
              );

        const chart = Plot.plot({
          width: plotSize.width,
          height: plotSize.height,
          marginLeft: dynamicMarginLeft,
          marginBottom: dynamicMarginBottom,
          marks,
          grid: showGrid,
          ...(variantId === "faceted-dodge"
            ? {
                fx:
                  restPlotOptions.fx && typeof restPlotOptions.fx === "object"
                    ? { label: null, ...(restPlotOptions.fx as Record<string, unknown>) }
                    : { label: null },
              }
            : {}),
          ...(resolvedColorOptions ? { color: resolvedColorOptions } : {}),
          ...finalPlotOptions,
          style: { fontSize: "10px", background: "transparent" },
        } as PlotModule.PlotOptions);
        if (!cancelled) {
          let html = isGeospatialChart ? alignSvgTopLeft(chart.outerHTML) : chart.outerHTML;
          if (showColorLegend && !variantColorOptions) {
            html = compactSwatchLegendMarkup(html);
          }
          if (isSpikeMap) {
            html = injectSvgStyle(html, "transform: translateX(-28px);");
          }
          setChartMarkup(html);
          setChartError("");
        }
        chart.remove();
      } catch (err) {
        if (!cancelled) {
          setChartMarkup("");
          setChartError(`Chart error: ${err}`);
        }
      }
    }

    void renderChart();
    return () => {
      cancelled = true;
    };
  }, [
    chartType,
    colorColumn,
    customCode,
    customEnabled,
    facetColumn,
    labelColumn,
    lengthColumn,
    sizeColumn,
    xColumn,
    x2Column,
    yColumn,
    y2Column,
    data,
    plotSize.height,
    plotSize.width,
    selectedCatalogEntry,
  ]);

  const numericCols = columns.filter((c) => isNumericType(c.type));
  const allCols = columns;
  const chartReady = isChartReady(config, selectedCatalogEntry);
  const previewReady = customEnabled ? Boolean((customCode ?? "").trim()) : chartReady;
  const setupMessage = getChartSetupMessage(config, selectedCatalogEntry);
  const isChoropleth = selectedCatalogEntry?.id === "world-choropleth";
  const isBubbleMap = selectedCatalogEntry?.id === "dot-map";
  const isSpikeMap = selectedCatalogEntry?.id === "spike-map";
  const isGeospatialChart = isChoropleth || isBubbleMap || isSpikeMap || selectedCatalogEntry?.id === "arc-map";
  const choroplethGuidance =
    isChoropleth && data.length > 0 && !geometryColumn
      ? "Connect a GeoJSON or TopoJSON table to render this choropleth."
      : isChoropleth && chartError.includes("valid geometries")
        ? "The connected geospatial table does not contain valid geometries."
        : "";
  const bubbleMapGuidance =
    isBubbleMap && data.length > 0 && !geometryColumn
      ? "Connect a GeoJSON or TopoJSON table to render this bubble map."
      : isBubbleMap && chartError.includes("valid geometries")
        ? "The connected geospatial table does not contain valid geometries."
        : "";
  const spikeMapGuidance =
    isSpikeMap && data.length > 0 && !geometryColumn
      ? "Connect a GeoJSON or TopoJSON table to render this spike map."
      : isSpikeMap && chartError.includes("valid geometries")
        ? "The connected geospatial table does not contain valid geometries."
        : "";
  const cartogramGuidance = "";

  const syncCustomFromBuilder = (nextConfig: ChartConfig) => {
    const nextEntry = getChartCatalogEntry(nextConfig.chartCatalogId, nextConfig.chartType);
    return buildCustomStarterCode(nextConfig, nextEntry, columns, geometryColumn);
  };

  const updateChartConfig = (patch: Partial<ChartConfig>, options?: { syncCustom?: boolean }) => {
    const nextConfig = { ...config, ...patch } as ChartConfig;
    const incompatiblePatch = getCompatibleConfigPatch(nextConfig);
    const resolvedPatch = { ...patch, ...incompatiblePatch } as Partial<ChartConfig>;
    const sanitizedNextConfig = { ...config, ...resolvedPatch } as ChartConfig;

    if (options?.syncCustom === false) {
      updateNodeConfig(node.id, resolvedPatch);
      return;
    }

    const nextCustomCode = syncCustomFromBuilder(sanitizedNextConfig);
    updateNodeConfig(node.id, {
      ...resolvedPatch,
      customCode: nextCustomCode,
      customBaseChartId: sanitizedNextConfig.chartCatalogId,
    } as Partial<ChartConfig>);
    setCustomDraft(nextCustomCode);
  };

  const applyCustomDraft = () => {
    const parsedConfig = parseCustomPlotConfig(customDraft, columns, {
      chartType,
      chartCatalogId,
      xColumn,
      yColumn,
      x2Column,
      y2Column,
      colorColumn,
      sizeColumn,
      lengthColumn,
      labelColumn,
      facetColumn,
      beeswarmAnchor: normalizedBeeswarmAnchor,
    });
    const canSyncBackToStandardChart = Boolean(parsedConfig && Object.keys(parsedConfig).length > 0);
    updateNodeConfig(node.id, {
      ...(parsedConfig ?? {}),
      customCode: customDraft,
      customEnabled: canSyncBackToStandardChart ? false : true,
      customBaseChartId: selectedCatalogEntry?.id ?? customBaseChartId ?? chartCatalogId,
    } as Partial<ChartConfig>);
  };

  const updateChartField = (
    field: keyof Pick<
      ChartConfig,
      "xColumn" | "yColumn" | "x2Column" | "y2Column" | "colorColumn" | "sizeColumn" | "lengthColumn" | "labelColumn" | "facetColumn"
    >,
    value: string
  ) => {
    updateChartConfig({
      [field]: value || undefined,
    } as Partial<ChartConfig>);
  };

  const renderEncodingField = (field: ChartFieldKey) => {
    const requirement = getFieldRequirement(selectedCatalogEntry, config.chartType, field);
    if (!requirement) return null;

    const value =
      field === "x"
        ? config.xColumn
        : field === "y"
          ? config.yColumn
          : field === "x2"
            ? config.x2Column
            : field === "y2"
              ? config.y2Column
              : field === "color"
                ? config.colorColumn
                : field === "size"
                  ? config.sizeColumn
                  : field === "length"
                    ? config.lengthColumn
                    : field === "label"
                      ? config.labelColumn
                      : config.facetColumn;
    const configField =
      field === "x"
        ? "xColumn"
        : field === "y"
          ? "yColumn"
          : field === "x2"
            ? "x2Column"
            : field === "y2"
              ? "y2Column"
              : field === "color"
                ? "colorColumn"
                : field === "size"
                  ? "sizeColumn"
                  : field === "length"
                    ? "lengthColumn"
                    : field === "label"
                      ? "labelColumn"
                      : "facetColumn";
    const options = getColumnOptions(
      field,
      selectedCatalogEntry,
      config.chartType,
      allCols,
      numericCols
    );

    return (
      <div key={field}>
        <label className="text-[9px] font-medium text-gray-500 uppercase">
          {getFieldLabel(field, selectedCatalogEntry, config.chartType)}
        </label>
        <select
          value={value || ""}
          onChange={(e) => updateChartField(configField, e.target.value)}
          className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] focus:border-teal-400 outline-none"
        >
          <option value="">{requirement === "required" ? "Select…" : "None"}</option>
          {options.map((col) => (
            <option key={col.name} value={col.name}>
              {col.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const presentationEmptyState = (title: string, description: string, tone: "neutral" | "error" = "neutral") => (
    <div
      className={`flex h-full min-h-[220px] items-center justify-center rounded-2xl px-6 text-center ${
        tone === "error"
          ? "border border-red-100 bg-red-50/80"
          : "border border-slate-100 bg-slate-50/70"
      }`}
    >
      <div className="max-w-xs space-y-2">
        <div className={`text-sm font-semibold ${tone === "error" ? "text-red-600" : "text-slate-600"}`}>{title}</div>
        <div className={`text-xs leading-relaxed ${tone === "error" ? "text-red-500" : "text-slate-400"}`}>{description}</div>
      </div>
    </div>
  );

  if (presentationMode) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div ref={previewRef} className="flex-1 min-h-[220px] min-w-0">
          {data.length === 0 ? (
            presentationEmptyState("No data source", "Connect data to render this chart.")
          ) : choroplethGuidance ? (
            presentationEmptyState("Geospatial source required", choroplethGuidance)
          ) : bubbleMapGuidance ? (
            presentationEmptyState("Geospatial source required", bubbleMapGuidance)
          ) : spikeMapGuidance ? (
            presentationEmptyState("Geospatial source required", spikeMapGuidance)
          ) : cartogramGuidance ? (
            presentationEmptyState("Geospatial source required", cartogramGuidance)
          ) : !previewReady ? (
            presentationEmptyState("Chart not configured", setupMessage)
          ) : chartError ? (
            presentationEmptyState("Chart unavailable", chartError, "error")
          ) : (
            <div
              className="chart-container h-full min-h-[220px] rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
              dangerouslySetInnerHTML={{ __html: chartMarkup }}
            />
          )}
        </div>
        {config.caption && (
          <div className="px-1 text-xs leading-relaxed text-slate-500">
            {config.caption}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-0 overflow-hidden no-drag" style={{ minWidth: 0 }}>
      <div className="flex flex-1 min-h-0 gap-2 overflow-hidden">
        <div
          className={`flex min-h-0 flex-shrink-0 flex-col overflow-hidden transition-[width,opacity,margin] duration-200 ease-out ${
            isSidebarCollapsed
              ? "w-9 border-r border-gray-100 pr-0 opacity-100"
              : "w-64 border-r border-gray-100 pr-2 opacity-100"
          }`}
          aria-hidden={isSidebarCollapsed}
        >
          <div className="border-b border-gray-100 px-2 pb-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              {!isSidebarCollapsed && <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto whitespace-nowrap">
                {(["type", "data", "options", "customs"] as TabId[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab);
                      setIsSidebarCollapsed(false);
                    }}
                    className={`shrink-0 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-teal-50 text-teal-700"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                  >
                    {tab === "customs" ? "Customs" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600"
                title={isSidebarCollapsed ? "Show chart sidebar" : "Hide chart sidebar"}
                aria-label={isSidebarCollapsed ? "Show chart sidebar" : "Hide chart sidebar"}
              >
                {isSidebarCollapsed ? <FiChevronsRight className="h-3.5 w-3.5" /> : <FiChevronsLeft className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {!isSidebarCollapsed && <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 pt-2">
            <div className="space-y-2 pb-1">
              {/* TYPE TAB */}
              {activeTab === "type" && (
                <div className="space-y-2">
                  {CHART_GALLERY_SECTIONS.map((section) => {
                    const types = CHART_CATALOG.filter((entry) => entry.section === section);
                    if (types.length === 0) return null;

                    return (
                      <div key={section}>
                        <div className="mb-1 text-[8px] font-bold uppercase leading-tight tracking-[0.18em] text-gray-400">
                          {section}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {types.map((entry) => (
                            <ChartTypeButton
                              key={entry.id}
                              entry={entry}
                              isSelected={selectedCatalogEntry?.id === entry.id}
                              onSelect={() => {
                                if (!entry.supported || !entry.chartType) return;
                                updateChartConfig({
                                  chartCatalogId: entry.id,
                                  chartType: entry.chartType,
                                } as Partial<ChartConfig>);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    className="w-full pt-1 text-center text-[10px] text-teal-600 hover:underline"
                    onClick={() => setActiveTab("data")}
                  >
                    Chart Data →
                  </button>
                </div>
              )}

              {/* DATA TAB */}
              {activeTab === "data" && (
                <div className="space-y-2">
                  <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Encodings</div>
                  {getFieldOrder(selectedCatalogEntry, config.chartType).map(renderEncodingField)}
                  {selectedCatalogEntry?.id === "beeswarm" && (
                    <div>
                      <label className="text-[9px] font-medium text-gray-500 uppercase">Anchor</label>
                      <select
                        value={normalizedBeeswarmAnchor}
                        onChange={(e) =>
                          updateChartConfig({
                            beeswarmAnchor: e.target.value as "top" | "middle" | "bottom",
                          } as Partial<ChartConfig>)
                        }
                        className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400"
                      >
                        <option value="top">top</option>
                        <option value="middle">middle</option>
                        <option value="bottom">bottom</option>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => setActiveTab("type")} className="flex-1 rounded border border-gray-100 py-0.5 text-[9px] text-gray-500 hover:bg-gray-50">← Type</button>
                    <button onClick={() => setActiveTab("options")} className="flex-1 rounded border border-gray-100 py-0.5 text-[9px] text-gray-500 hover:bg-gray-50">Options →</button>
                  </div>
                </div>
              )}

              {/* OPTIONS TAB */}
              {activeTab === "options" && (
                <div className="space-y-2">
                  <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Annotations</div>
                  <div>
                    <label className="text-[9px] font-medium text-gray-500 uppercase">Title</label>
                    <input
                      type="text"
                      placeholder="Title"
                      value={config.title || ""}
                      onChange={(e) => updateChartConfig({
                        title: e.target.value.trim() ? e.target.value : undefined,
                      } as Partial<ChartConfig>, { syncCustom: false })}
                      className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-medium text-gray-500 uppercase">Caption</label>
                    <input
                      type="text"
                      placeholder="Caption"
                      value={config.caption || ""}
                      onChange={(e) => updateChartConfig({
                        caption: e.target.value.trim() ? e.target.value : undefined,
                      } as Partial<ChartConfig>, { syncCustom: false })}
                      className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400"
                    />
                  </div>
                  <button onClick={() => setActiveTab("data")} className="mt-1 w-full rounded border border-gray-100 py-0.5 text-[9px] text-gray-500 hover:bg-gray-50">← Data</button>
                </div>
              )}

              {activeTab === "customs" && (
                <div className="space-y-2 px-1">
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                      <div className="text-[10px] font-medium text-gray-500">Plot</div>
                      <button
                        type="button"
                        onClick={applyCustomDraft}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 transition-colors hover:text-sky-700"
                      >
                        Run
                        <FiPlay className="h-3 w-3" />
                      </button>
                    </div>
                    <textarea
                      ref={customEditorRef}
                      value={customDraft}
                      onChange={(event) => setCustomDraft(event.target.value)}
                      spellCheck={false}
                      className="subtle-scrollbar h-[420px] min-h-[260px] w-full resize-none overflow-y-auto overflow-x-hidden bg-white px-3 py-3 font-mono text-[11px] leading-5 text-slate-700 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>}
        </div>

        <div className="flex-1 min-w-0 min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-2">
            {config.title && (
              <div className="px-1 text-[11px] font-semibold text-gray-700">
                {config.title}
              </div>
            )}
            <div ref={previewRef} className="flex-1 min-h-0">
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 h-40 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                <LuChartColumnBig className="h-8 w-8" />
                <span>Connect a data source</span>
              </div>
            ) : choroplethGuidance ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                  <LuChartColumnBig className="h-4 w-4" />
                  <span>{choroplethGuidance}</span>
                </div>
              </div>
            ) : bubbleMapGuidance ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                  <LuChartColumnBig className="h-4 w-4" />
                  <span>{bubbleMapGuidance}</span>
                </div>
              </div>
            ) : spikeMapGuidance ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                  <LuChartColumnBig className="h-4 w-4" />
                  <span>{spikeMapGuidance}</span>
                </div>
              </div>
            ) : cartogramGuidance ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                  <LuChartColumnBig className="h-4 w-4" />
                  <span>{cartogramGuidance}</span>
                </div>
              </div>
            ) : !previewReady ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                  <LuChartColumnBig className="h-4 w-4" />
                  <span>{setupMessage}</span>
                </div>
              </div>
            ) : chartError ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 px-4 text-xs text-red-500">
                {chartError}
              </div>
            ) : (
              <div
                className={`chart-container h-full overflow-hidden rounded-lg bg-white ${isGeospatialChart ? "p-0" : "p-2"}`}
                dangerouslySetInnerHTML={{ __html: chartMarkup }}
              />
            )}
            </div>
            {config.caption && (
              <div className="px-1 text-[10px] leading-relaxed text-gray-500">
                {config.caption}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
