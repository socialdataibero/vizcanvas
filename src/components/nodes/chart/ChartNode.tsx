"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type * as PlotModule from "@observablehq/plot";
import { FiChevronsLeft, FiChevronsRight, FiPlay } from "react-icons/fi";
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
} from "@/lib/chartCatalog";
import { getColumnOptions, getFieldOrder, getIncompatibleChartConfigPatch } from "@/lib/chartFields";
import { chartIconRegistry } from "@/components/charts/picker/chart-icons-lucide-outline";
import { findGeometryColumn } from "@/lib/geospatial";
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

// ── Utilities from chart/ ─────────────────────────────────────────────────────
import {
  BASE_CHART_COLOR,
  MAX_INLINE_CATEGORICAL_LEGEND_ITEMS,
  alignSvgTopLeft,
  compactSwatchLegendMarkup,
  injectSvgStyle,
  isChartReady,
  isNumericType,
  getChartSetupMessage,
  getFieldRequirement,
  getFieldLabel,
  mergeAxisDisplayOptions,
  getAxisLabel,
  normalizeSvgImageHref,
  buildWaffleMark,
} from "./chartUtils";
import { buildGeometryFeatures } from "./geoUtils";

// ── Chart builders ────────────────────────────────────────────────────────────
import {
  buildStackedBar,
  buildGroupedBar,
  buildVerticalBar,
  buildHorizontalBar,
  buildWaffleChart,
  buildWaterfallChart,
} from "./chartTypes/BarCharts";
import {
  buildLineChart,
  buildMultiSeriesLine,
  buildAreaChart,
  buildHistogram,
} from "./chartTypes/LineAreaCharts";
import {
  buildScatterChart,
  buildBubbleChart,
  buildBeeswarm,
  buildFacetedDodge,
  buildDotComparison,
  buildBoxPlot,
  buildBarcodeStripPlot,
} from "./chartTypes/ScatterCharts";
import { buildHeatmap } from "./chartTypes/DistribCharts";
import {
  buildTreemap,
  buildGridCartogram,
  buildLinkChart,
  buildSankeyDiagram,
  buildPieChart,
  buildChoropleth,
  buildDotMap,
  buildSpikeMap,
  buildArcMap,
} from "./chartTypes/SpecialCharts";

// ── Legacy helpers needed by custom code executor ────────────────────────────
// buildSankeyPlotConfig still lives here because it's only used by the custom code executor
async function buildSankeyPlotConfig(
  Plot: typeof PlotModule,
  data: Record<string, unknown>[],
  options: { source: string; target: string; value: string; group?: string },
  width: number,
  height: number
) {
  const result = await buildSankeyDiagram({
    Plot,
    data,
    marks: [],
    plotOptions: {},
    plotSize: { width, height },
    xColumn: options.source,
    yColumn: options.target,
    sizeColumn: options.value,
    colorColumn: options.group,
  });
  return result;
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartTypeButton({ entry, isSelected, onSelect }: ChartTypeButtonProps) {
  const Icon = chartIconRegistry[entry.iconName];
  return (
    <button
      className={`chart-type-btn ${isSelected ? "selected" : ""} ${entry.supported ? "" : "opacity-45 cursor-not-allowed"}`}
      onClick={onSelect}
      title={entry.supported ? entry.description : `${entry.label}: catalog item not available yet`}
      disabled={!entry.supported}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="text-[7px] leading-tight">{entry.label}</span>
    </button>
  );
}

// ── Helpers needed only inside this file ─────────────────────────────────────

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
  currentConfig?: Pick<ChartConfig, "chartType" | "chartCatalogId" | "xColumn" | "yColumn" | "x2Column" | "y2Column" | "colorColumn" | "sizeColumn" | "lengthColumn" | "labelColumn" | "facetColumn" | "beeswarmAnchor">
): Partial<ChartConfig> | null {
  const normalized = code.replace(/\s+/g, " ");
  const columnNames = new Set(availableColumns.map((c) => c.name));
  const asColumn = (value?: string) => (value && columnNames.has(value) ? value : undefined);
  const currentVariant = currentConfig?.chartCatalogId;

  const variantMap: Record<string, () => Partial<ChartConfig>> = {
    "grouped-bar": () => ({ chartType: "bar", chartCatalogId: "grouped-bar", yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn, facetColumn: asColumn(parseQuotedFieldOption(code, "fx")) ?? currentConfig?.facetColumn }),
    "stacked-bar": () => ({ chartType: "stackedBar", chartCatalogId: "stacked-bar", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "histogram": () => ({ chartType: "histogram", chartCatalogId: "histogram", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn }),
    "temporal-histogram": () => ({ chartType: "histogram", chartCatalogId: "temporal-histogram", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn }),
    "faceted-dodge": () => ({ chartType: "dot", chartCatalogId: "faceted-dodge", xColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, facetColumn: asColumn(parseQuotedFieldOption(code, "fx")) ?? currentConfig?.facetColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "multi-series-line": () => ({ chartType: "line", chartCatalogId: "multi-series-line", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "stroke")) ?? currentConfig?.colorColumn }),
    "area-chart": () => ({ chartType: "area", chartCatalogId: "area-chart", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "bubble-chart": () => ({ chartType: "scatter", chartCatalogId: "bubble-chart", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, sizeColumn: asColumn(parseQuotedFieldOption(code, "r")) ?? currentConfig?.sizeColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "scatterplot": () => ({ chartType: "scatter", chartCatalogId: "scatterplot", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "color-scatterplot": () => ({ chartType: "scatter", chartCatalogId: "color-scatterplot", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "dot-comparison": () => ({ chartType: "dot", chartCatalogId: "dot-comparison", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "beeswarm": () => ({ chartType: "dot", chartCatalogId: "beeswarm", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn, beeswarmAnchor: parseAnchorOption(code) ?? currentConfig?.beeswarmAnchor ?? "middle" }),
    "barcode-strip-plot": () => ({ chartType: "dot", chartCatalogId: "barcode-strip-plot", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "z")) ?? asColumn(parseQuotedFieldOption(code, "stroke")) ?? currentConfig?.colorColumn }),
    "box-plot": () => ({ chartType: "box", chartCatalogId: "box-plot", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn }),
    "heatmap": () => ({ chartType: "heatmap", chartCatalogId: "heatmap", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "waffle-chart": () => ({ chartType: "waffle", chartCatalogId: "waffle-chart", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn, colorColumn: asColumn(parseQuotedFieldOption(code, "fill")) ?? currentConfig?.colorColumn }),
    "waterfall-chart": () => ({ chartType: "waterfall", chartCatalogId: "waterfall-chart", xColumn: asColumn(parseQuotedFieldOption(code, "x")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y")) ?? currentConfig?.yColumn }),
    "arc-map": () => ({ chartType: "arc", chartCatalogId: "arc-map", xColumn: asColumn(parseQuotedFieldOption(code, "x1")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y1")) ?? currentConfig?.yColumn, x2Column: asColumn(parseQuotedFieldOption(code, "x2")) ?? currentConfig?.x2Column, y2Column: asColumn(parseQuotedFieldOption(code, "y2")) ?? currentConfig?.y2Column, colorColumn: asColumn(parseQuotedFieldOption(code, "stroke")) ?? currentConfig?.colorColumn }),
    "link-chart": () => ({ chartType: "link", chartCatalogId: "link-chart", xColumn: asColumn(parseQuotedFieldOption(code, "x1")) ?? currentConfig?.xColumn, yColumn: asColumn(parseQuotedFieldOption(code, "y1")) ?? currentConfig?.yColumn, x2Column: asColumn(parseQuotedFieldOption(code, "x2")) ?? currentConfig?.x2Column, y2Column: asColumn(parseQuotedFieldOption(code, "y2")) ?? currentConfig?.y2Column, colorColumn: asColumn(parseQuotedFieldOption(code, "stroke")) ?? currentConfig?.colorColumn }),
  };

  if (currentVariant && variantMap[currentVariant]) return variantMap[currentVariant]();

  if (normalized.includes("Plot.barY(")) return { chartType: "bar", chartCatalogId: "vertical-bar", xColumn: parseQuotedFieldOption(code, "x"), yColumn: parseQuotedFieldOption(code, "y"), colorColumn: (() => { const f = parseQuotedFieldOption(code, "fill"); return f && columnNames.has(f) ? f : undefined; })() };
  if (normalized.includes("Plot.barX(")) return { chartType: "barX", chartCatalogId: "horizontal-bar", xColumn: parseQuotedFieldOption(code, "x"), yColumn: parseQuotedFieldOption(code, "y"), colorColumn: (() => { const f = parseQuotedFieldOption(code, "fill"); return f && columnNames.has(f) ? f : undefined; })() };
  if (normalized.includes("Plot.line(")) return { chartType: "line", chartCatalogId: "line-chart", xColumn: parseQuotedFieldOption(code, "x"), yColumn: parseQuotedFieldOption(code, "y"), colorColumn: (() => { const s = parseQuotedFieldOption(code, "stroke"); return s && columnNames.has(s) ? s : undefined; })() };

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChartNodeBody({ node, presentationMode = false }: Props) {
  const config = node.config as ChartConfig;
  const { chartType, chartCatalogId, xColumn, yColumn, x2Column, y2Column, colorColumn, sizeColumn, lengthColumn, labelColumn, facetColumn, beeswarmAnchor, customCode, customEnabled, customBaseChartId } = config;
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

  const selectedCatalogEntry = useMemo(() => getChartCatalogEntry(chartCatalogId, chartType), [chartCatalogId, chartType]);
  const getCompatibleConfigPatch = React.useCallback((targetConfig: ChartConfig) => {
    const nextEntry = getChartCatalogEntry(targetConfig.chartCatalogId, targetConfig.chartType);
    return getIncompatibleChartConfigPatch(targetConfig, nextEntry, columns);
  }, [columns]);

  const starterCustomCode = useMemo(() => buildCustomStarterCode(config, selectedCatalogEntry, columns, geometryColumn), [columns, config, geometryColumn, selectedCatalogEntry]);
  const [customDraft, setCustomDraft] = useState(customCode ?? starterCustomCode);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied">("idle");
  const [plotSize, setPlotSize] = useState({ width: 400, height: 220 });
  const [chartMarkup, setChartMarkup] = useState<string>("");
  const [chartError, setChartError] = useState<string>("");

  const syncCustomEditorHeight = () => {
    const editor = customEditorRef.current;
    if (!editor) return;
    editor.style.height = "260px";
    editor.style.height = `${Math.max(260, editor.scrollHeight)}px`;
  };

  // Resize observer
  useEffect(() => {
    const previewEl = previewRef.current;
    if (!previewEl || typeof ResizeObserver === "undefined") return;
    const updateSize = () => {
      const next = computePlotSize(previewEl.clientWidth, previewEl.clientHeight);
      setPlotSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(previewEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setCustomDraft(customCode ?? starterCustomCode); }, [customCode, starterCustomCode]);
  useEffect(() => { syncCustomEditorHeight(); }, [activeTab, customDraft]);
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
    const configPatch: Partial<ChartConfig> = {};
    for (const [key, value] of Object.entries(merged)) {
      if (!Object.is((config as Record<string, unknown>)[key], value)) {
        (configPatch as Record<string, unknown>)[key] = value;
      }
    }
    if (Object.keys(configPatch).length === 0) return;
    updateNodeConfig(node.id, configPatch);
  }, [columns, config, customEnabled, getCompatibleConfigPatch, node.id, updateNodeConfig]);

  // ── Main render effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (data.length === 0 || !isChartReady({ chartType, xColumn, yColumn, x2Column, y2Column, colorColumn, sizeColumn, lengthColumn, labelColumn, facetColumn }, selectedCatalogEntry)) {
      setChartMarkup("");
      setChartError("");
      return;
    }

    let cancelled = false;

    async function renderChart() {
      try {
        const Plot = await import("@observablehq/plot");
        if (cancelled) return;

        // ── Custom code path ──
        if (customEnabled && (customCode ?? "").trim()) {
          if (!customCode?.includes("Plot.plot(")) throw new Error("Custom charts must call Plot.plot({ ... }).");
          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...fnArgs: unknown[]) => Promise<unknown>;
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
          const executeCustomPlot = new AsyncFunction("Plot", "data", "width", "height", "helpers", "geometryFeatures", "waffleY", "sankey", `"use strict";\n${customCode}`);
          const customResult = await executeCustomPlot(
            plotProxy, data, plotSize.width, plotSize.height,
            { geometryFeatures: (rows: Record<string, unknown>[], gf: string, lf: string, vf: string) => buildGeometryFeatures(rows, gf, lf, vf), buildWaffleMark },
            (rows: Record<string, unknown>[], gf: string, lf: string, vf: string) => buildGeometryFeatures(rows, gf, lf, vf),
            (plot: typeof PlotModule, rows: Record<string, unknown>[], opts: { x: string; y: string; fill?: string; reducer?: "sum" | "mean" }) => buildWaffleMark(plot, rows, opts),
            (plot: typeof PlotModule, rows: Record<string, unknown>[], opts: { source: string; target: string; value: string; group?: string }, w: number, h: number) => buildSankeyPlotConfig(plot, rows, opts, w, h)
          );
          const customChart = plottedChart ?? customResult;
          if (!(customChart instanceof HTMLElement) && !(customChart instanceof SVGElement)) throw new Error("Custom code must return Plot.plot({ ... }) or call Plot.plot({ ... }).");
          if (!cancelled) {
            const html = customChart instanceof HTMLElement ? customChart.outerHTML : (() => { const c = document.createElement("div"); c.appendChild(customChart.cloneNode(true)); return c.outerHTML; })();
            setChartMarkup(html);
            setChartError("");
          }
          return;
        }

        // ── Standard chart path ──
        const marks: PlotModule.Markish[] = [];
        const plotOptions: Record<string, unknown> = {};
        const variantId = selectedCatalogEntry?.id ?? chartType;
        const spikeMapVariant = selectedCatalogEntry?.id === "spike-map";
        const geospatialVariant = ["world-choropleth", "dot-map", "spike-map", "arc-map"].includes(selectedCatalogEntry?.id ?? "");

        const ctx = { Plot, data, marks, plotOptions, plotSize, xColumn, yColumn, x2Column, y2Column, colorColumn, sizeColumn, lengthColumn, labelColumn, facetColumn, columns, geometryColumn, normalizedBeeswarmAnchor };

        // ── Dispatch to chart builder ──
        let showColorLegend = false;
        let showGrid = true;
        let legendOptions: Record<string, unknown> | null = null;

        let result: { showColorLegend: boolean; legendOptions: Record<string, unknown> | null; showGrid: boolean };

        switch (variantId) {
          case "stacked-bar":          result = buildStackedBar(ctx); break;
          case "grouped-bar":          result = buildGroupedBar(ctx); break;
          case "vertical-bar":
          case "bar":
          case "barY":                 result = buildVerticalBar(ctx); break;
          case "horizontal-bar":
          case "barX":                 result = buildHorizontalBar(ctx); break;
          case "waffle-chart":         result = buildWaffleChart(ctx); break;
          case "waterfall-chart":      result = buildWaterfallChart(ctx); break;
          case "line-chart":
          case "line":                 result = buildLineChart(ctx); break;
          case "multi-series-line":    result = buildMultiSeriesLine(ctx); break;
          case "area-chart":
          case "area":                 result = buildAreaChart(ctx); break;
          case "temporal-histogram":
          case "histogram":            result = buildHistogram(ctx); break;
          case "faceted-dodge":        result = buildFacetedDodge(ctx); break;
          case "scatterplot":
          case "color-scatterplot":
          case "scatter":              result = buildScatterChart(ctx); break;
          case "bubble-chart":         result = buildBubbleChart(ctx); break;
          case "beeswarm":             result = buildBeeswarm(ctx); break;
          case "barcode-strip-plot":   result = buildBarcodeStripPlot(ctx); break;
          case "dot-comparison":
          case "dot":                  result = buildDotComparison(ctx); break;
          case "box-plot":
          case "box":                  result = buildBoxPlot(ctx); break;
          case "heatmap":              result = buildHeatmap(ctx); break;
          case "world-choropleth":     result = buildChoropleth(ctx); break;
          case "dot-map":              result = buildDotMap(ctx); break;
          case "spike-map":
          case "spike":                result = buildSpikeMap(ctx); break;
          case "arc-map":
          case "arc":                  result = await buildArcMap(ctx); break;
          case "treemap":              result = await buildTreemap(ctx); break;
          case "grid-cartogram":       result = buildGridCartogram(ctx); break;
          case "link-chart":
          case "link":                 result = buildLinkChart(ctx); break;
          case "sankey-diagram":       result = await buildSankeyDiagram(ctx); break;
          case "pie":                  result = buildPieChart(ctx); break;
          default:
            if (xColumn && yColumn) marks.push(Plot.barY(data, { x: xColumn, y: yColumn, fill: BASE_CHART_COLOR }));
            result = { showColorLegend: false, legendOptions: null, showGrid: true };
        }

        showColorLegend = result.showColorLegend;
        legendOptions = result.legendOptions;
        showGrid = result.showGrid;

        if (marks.length === 0) {
          if (!cancelled) { setChartMarkup(""); setChartError(""); }
          return;
        }

        // ── Post-processing (margin, axis labels, color legend) ──
        const { color: variantColorOptions, ...restPlotOptions } = plotOptions as Record<string, unknown> & { color?: Record<string, unknown> };

        const categoricalYLabels = yColumn && ["horizontal-bar", "barX", "barcode-strip-plot", "heatmap"].includes(variantId)
          ? Array.from(new Set(data.map((row) => String((row as Record<string, unknown>)[yColumn] ?? ""))))
          : [];

        const dynamicMarginLeft =
          variantId === "grid-cartogram" || variantId === "grid" ? 12
          : variantId === "horizontal-bar" || variantId === "barX" ? computeCategoricalYMargin(categoricalYLabels)
          : variantId === "barcode-strip-plot" && Boolean(yColumn) ? computeCategoricalYMargin(categoricalYLabels)
          : variantId === "heatmap" && Boolean(yColumn) ? computeCategoricalYMargin(categoricalYLabels)
          : variantId === "stacked-bar" && xColumn && yColumn ? getCompactAxisMargin(computeMaxGroupSum(data as Record<string, unknown>[], xColumn, yColumn))
          : computeYMargin(variantId === "faceted-dodge" && xColumn ? data.map((row) => (row as Record<string, unknown>)[xColumn]) : yColumn ? data.map((row) => (row as Record<string, unknown>)[yColumn]) : []);

        const colorColumnInfo = colorColumn ? columns.find((c) => c.name === colorColumn) : undefined;
        const shouldSuppressCategoricalLegend = showColorLegend && Boolean(colorColumn) && Boolean(colorColumnInfo?.type) && !isNumericType(colorColumnInfo!.type) && !shouldShowInlineCategoricalLegend(data.map((row) => (row as Record<string, unknown>)[colorColumn as string]), MAX_INLINE_CATEGORICAL_LEGEND_ITEMS);
        if (shouldSuppressCategoricalLegend) { showColorLegend = false; legendOptions = null; }

        const resolvedColorOptions = variantColorOptions
          ? { ...variantColorOptions, ...(showColorLegend ? { legend: true } : {}) }
          : showColorLegend ? { ...(legendOptions ?? { legend: true }), marginLeft: dynamicMarginLeft } : undefined;

        const xAxisValues = xColumn ? data.map((row) => (row as Record<string, unknown>)[xColumn]) : [];
        const yAxisValues = variantId === "stacked-bar" && xColumn && yColumn
          ? Array.from(new Map(data.reduce((acc, row) => { const r = row as Record<string, unknown>; const key = String(r[xColumn]); const val = typeof r[yColumn] === "number" ? (r[yColumn] as number) : Number(r[yColumn]); acc.set(key, (acc.get(key) ?? 0) + (Number.isFinite(val) ? val : 0)); return acc; }, new Map<string, number>())).values())
          : variantId === "faceted-dodge" && xColumn ? data.map((row) => (row as Record<string, unknown>)[xColumn])
          : yColumn ? data.map((row) => (row as Record<string, unknown>)[yColumn]) : [];

        const suppressXLabel = ["vertical-bar", "bar", "barY", "stacked-bar", "grouped-bar", "dot-comparison", "dot", "waffle-chart"].includes(variantId);
        const suppressYLabel = ["horizontal-bar", "barX", "barcode-strip-plot", "heatmap"].includes(variantId);

        const resolvedXAxisOptionsBase = mergeAxisDisplayOptions(restPlotOptions.x, getAxisLabel("x", selectedCatalogEntry, chartType, xColumn, yColumn), xColumn, xAxisValues);
        const resolvedXAxisOptions = suppressXLabel ? { ...(resolvedXAxisOptionsBase && typeof resolvedXAxisOptionsBase === "object" ? (resolvedXAxisOptionsBase as Record<string, unknown>) : {}), label: null } : resolvedXAxisOptionsBase;
        const resolvedYAxisOptionsBase = mergeAxisDisplayOptions(restPlotOptions.y, getAxisLabel("y", selectedCatalogEntry, chartType, variantId === "faceted-dodge" ? xColumn : yColumn, xColumn), variantId === "faceted-dodge" ? xColumn : yColumn, yAxisValues);
        const resolvedYAxisOptions = suppressYLabel ? { ...(resolvedYAxisOptionsBase && typeof resolvedYAxisOptionsBase === "object" ? (resolvedYAxisOptionsBase as Record<string, unknown>) : {}), label: null } : resolvedYAxisOptionsBase;

        const finalPlotOptions = { ...restPlotOptions, ...(resolvedXAxisOptions ? { x: resolvedXAxisOptions } : {}), ...(resolvedYAxisOptions ? { y: resolvedYAxisOptions } : {}) };

        const xTickRotate = restPlotOptions.x && typeof restPlotOptions.x === "object" ? ((restPlotOptions.x as Record<string, unknown>).tickRotate as number | undefined) ?? 0 : 0;
        const fxTickRotate = restPlotOptions.fx && typeof restPlotOptions.fx === "object" ? ((restPlotOptions.fx as Record<string, unknown>).tickRotate as number | undefined) ?? 0 : 0;
        const xUniqueLabels = xColumn ? Array.from(new Set(data.map((row) => String((row as Record<string, unknown>)[xColumn])))) : [];
        const fxUniqueLabels = facetColumn ? Array.from(new Set(data.map((row) => String((row as Record<string, unknown>)[facetColumn])))) : [];
        const dynamicMarginBottom = variantId === "grid-cartogram" || variantId === "grid" ? 12 : Math.max(getMarginBottomForLabels(xUniqueLabels, xTickRotate), getMarginBottomForLabels(fxUniqueLabels, fxTickRotate));

        const chart = Plot.plot({
          width: plotSize.width,
          height: plotSize.height,
          marginLeft: dynamicMarginLeft,
          marginBottom: dynamicMarginBottom,
          marks,
          grid: showGrid,
          ...(variantId === "faceted-dodge" ? { fx: restPlotOptions.fx && typeof restPlotOptions.fx === "object" ? { label: null, ...(restPlotOptions.fx as Record<string, unknown>) } : { label: null } } : {}),
          ...(resolvedColorOptions ? { color: resolvedColorOptions } : {}),
          ...finalPlotOptions,
          style: { fontSize: "10px", background: "transparent" },
        } as PlotModule.PlotOptions);

        if (!cancelled) {
          let html = geospatialVariant ? alignSvgTopLeft(chart.outerHTML) : chart.outerHTML;
          html = normalizeSvgImageHref(html);
          if (showColorLegend && !variantColorOptions) html = compactSwatchLegendMarkup(html);
          if (spikeMapVariant) html = injectSvgStyle(html, "transform: translateX(-28px);");
          setChartMarkup(html);
          setChartError("");
        }
        chart.remove();
      } catch (err) {
        if (!cancelled) { setChartMarkup(""); setChartError(`Chart error: ${err}`); }
      }
    }

    void renderChart();
    return () => { cancelled = true; };
  }, [chartType, colorColumn, customCode, customEnabled, facetColumn, labelColumn, lengthColumn, sizeColumn, xColumn, x2Column, yColumn, y2Column, data, columns, geometryColumn, normalizedBeeswarmAnchor, plotSize.height, plotSize.width, selectedCatalogEntry]);

  const numericCols = columns.filter((c) => isNumericType(c.type));
  const allCols = columns;
  const chartReady = isChartReady(config, selectedCatalogEntry);
  const previewReady = customEnabled ? Boolean((customCode ?? "").trim()) : chartReady;
  const setupMessage = getChartSetupMessage(config, selectedCatalogEntry);
  const isChoropleth = selectedCatalogEntry?.id === "world-choropleth";
  const isBubbleMap = selectedCatalogEntry?.id === "dot-map";
  const isSpikeMap = selectedCatalogEntry?.id === "spike-map";
  const isGeospatialChart = isChoropleth || isBubbleMap || isSpikeMap || selectedCatalogEntry?.id === "arc-map";
  const choroplethGuidance = isChoropleth && data.length > 0 && !geometryColumn ? "Connect a GeoJSON or TopoJSON table to render this choropleth." : isChoropleth && chartError.includes("valid geometries") ? "The connected geospatial table does not contain valid geometries." : "";
  const bubbleMapGuidance = isBubbleMap && data.length > 0 && !geometryColumn ? "Connect a GeoJSON or TopoJSON table to render this bubble map." : isBubbleMap && chartError.includes("valid geometries") ? "The connected geospatial table does not contain valid geometries." : "";
  const spikeMapGuidance = isSpikeMap && data.length > 0 && !geometryColumn ? "Connect a GeoJSON or TopoJSON table to render this spike map." : isSpikeMap && chartError.includes("valid geometries") ? "The connected geospatial table does not contain valid geometries." : "";
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
    if (options?.syncCustom === false) { updateNodeConfig(node.id, resolvedPatch); return; }
    const nextCustomCode = syncCustomFromBuilder(sanitizedNextConfig);
    updateNodeConfig(node.id, { ...resolvedPatch, customCode: nextCustomCode, customBaseChartId: sanitizedNextConfig.chartCatalogId } as Partial<ChartConfig>);
    setCustomDraft(nextCustomCode);
  };

  const applyCustomDraft = () => {
    const parsedConfig = parseCustomPlotConfig(customDraft, columns, { chartType, chartCatalogId, xColumn, yColumn, x2Column, y2Column, colorColumn, sizeColumn, lengthColumn, labelColumn, facetColumn, beeswarmAnchor: normalizedBeeswarmAnchor });
    const canSyncBack = Boolean(parsedConfig && Object.keys(parsedConfig).length > 0);
    updateNodeConfig(node.id, { ...(parsedConfig ?? {}), customCode: customDraft, customEnabled: canSyncBack ? false : true, customBaseChartId: selectedCatalogEntry?.id ?? customBaseChartId ?? chartCatalogId } as Partial<ChartConfig>);
  };

  const updateChartField = (field: keyof Pick<ChartConfig, "xColumn" | "yColumn" | "x2Column" | "y2Column" | "colorColumn" | "sizeColumn" | "lengthColumn" | "labelColumn" | "facetColumn">, value: string) => {
    updateChartConfig({ [field]: value || undefined } as Partial<ChartConfig>);
  };

  const renderEncodingField = (field: ChartFieldKey) => {
    const requirement = getFieldRequirement(selectedCatalogEntry, config.chartType, field);
    if (!requirement) return null;
    const fieldToConfig: Record<ChartFieldKey, keyof ChartConfig> = { x: "xColumn", y: "yColumn", x2: "x2Column", y2: "y2Column", color: "colorColumn", size: "sizeColumn", length: "lengthColumn", label: "labelColumn", facet: "facetColumn" };
    const configKey = fieldToConfig[field];
    const value = config[configKey] as string | undefined;
    const options = getColumnOptions(field, selectedCatalogEntry, config.chartType, allCols, numericCols);
    return (
      <div key={field}>
        <label className="text-[9px] font-medium text-gray-500 uppercase">{getFieldLabel(field, selectedCatalogEntry, config.chartType)}</label>
        <select value={value || ""} onChange={(e) => updateChartField(configKey as Parameters<typeof updateChartField>[0], e.target.value)} className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] focus:border-teal-400 outline-none">
          <option value="">{requirement === "required" ? "Select…" : "None"}</option>
          {options.map((col) => <option key={col.name} value={col.name}>{col.name}</option>)}
        </select>
      </div>
    );
  };

  const presentationEmptyState = (title: string, description: string, tone: "neutral" | "error" = "neutral") => (
    <div className={`flex h-full min-h-[220px] items-center justify-center rounded-2xl px-6 text-center ${tone === "error" ? "border border-red-100 bg-red-50/80" : "border border-slate-100 bg-slate-50/70"}`}>
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
          {data.length === 0 ? presentationEmptyState("No data source", "Connect data to render this chart.")
            : choroplethGuidance ? presentationEmptyState("Geospatial source required", choroplethGuidance)
            : bubbleMapGuidance ? presentationEmptyState("Geospatial source required", bubbleMapGuidance)
            : spikeMapGuidance ? presentationEmptyState("Geospatial source required", spikeMapGuidance)
            : cartogramGuidance ? presentationEmptyState("Geospatial source required", cartogramGuidance)
            : !previewReady ? presentationEmptyState("Chart not configured", setupMessage)
            : chartError ? presentationEmptyState("Chart unavailable", chartError, "error")
            : <div className="chart-container h-full min-h-[220px] rounded-xl border border-slate-100 bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: chartMarkup }} />}
        </div>
        {config.caption && <div className="px-1 text-xs leading-relaxed text-slate-500">{config.caption}</div>}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-0 overflow-hidden no-drag" style={{ minWidth: 0 }}>
      <div className="flex flex-1 min-h-0 gap-2 overflow-hidden">
        {/* Sidebar */}
        <div className={`flex min-h-0 flex-shrink-0 flex-col overflow-hidden transition-[width,opacity,margin] duration-200 ease-out ${isSidebarCollapsed ? "w-9 border-r border-gray-100 pr-0 opacity-100" : "w-64 border-r border-gray-100 pr-2 opacity-100"}`} aria-hidden={isSidebarCollapsed}>
          <div className="border-b border-gray-100 px-2 pb-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              {!isSidebarCollapsed && (
                <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto whitespace-nowrap">
                  {(["type", "data", "options", "customs"] as TabId[]).map((tab) => (
                    <button key={tab} type="button" onClick={() => { setActiveTab(tab); setIsSidebarCollapsed(false); }} className={`shrink-0 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors ${activeTab === tab ? "bg-teal-50 text-teal-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}>
                      {tab === "customs" ? "Customs" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setIsSidebarCollapsed((c) => !c)} className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600" title={isSidebarCollapsed ? "Show chart sidebar" : "Hide chart sidebar"}>
                {isSidebarCollapsed ? <FiChevronsRight className="h-3.5 w-3.5" /> : <FiChevronsLeft className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {!isSidebarCollapsed && (
            <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 pt-2">
              <div className="space-y-2 pb-1">
                {activeTab === "type" && (
                  <div className="space-y-2">
                    {CHART_GALLERY_SECTIONS.map((section) => {
                      const types = CHART_CATALOG.filter((entry) => entry.section === section);
                      if (types.length === 0) return null;
                      return (
                        <div key={section}>
                          <div className="mb-1 text-[8px] font-bold uppercase leading-tight tracking-[0.18em] text-gray-400">{section}</div>
                          <div className="grid grid-cols-3 gap-1">
                            {types.map((entry) => (
                              <ChartTypeButton key={entry.id} entry={entry} isSelected={selectedCatalogEntry?.id === entry.id} onSelect={() => { if (!entry.supported || !entry.chartType) return; updateChartConfig({ chartCatalogId: entry.id, chartType: entry.chartType } as Partial<ChartConfig>); }} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <button className="w-full pt-1 text-center text-[10px] text-teal-600 hover:underline" onClick={() => setActiveTab("data")}>Chart Data →</button>
                  </div>
                )}

                {activeTab === "data" && (
                  <div className="space-y-2">
                    <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Encodings</div>
                    {getFieldOrder(selectedCatalogEntry, config.chartType).map(renderEncodingField)}
                    {selectedCatalogEntry?.id === "beeswarm" && (
                      <div>
                        <label className="text-[9px] font-medium text-gray-500 uppercase">Anchor</label>
                        <select value={normalizedBeeswarmAnchor} onChange={(e) => updateChartConfig({ beeswarmAnchor: e.target.value as "top" | "middle" | "bottom" } as Partial<ChartConfig>)} className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400">
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

                {activeTab === "options" && (
                  <div className="space-y-2">
                    <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Annotations</div>
                    <div>
                      <label className="text-[9px] font-medium text-gray-500 uppercase">Title</label>
                      <input type="text" placeholder="Title" value={config.title || ""} onChange={(e) => updateChartConfig({ title: e.target.value.trim() ? e.target.value : undefined } as Partial<ChartConfig>, { syncCustom: false })} className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400" />
                    </div>
                    <div>
                      <label className="text-[9px] font-medium text-gray-500 uppercase">Caption</label>
                      <input type="text" placeholder="Caption" value={config.caption || ""} onChange={(e) => updateChartConfig({ caption: e.target.value.trim() ? e.target.value : undefined } as Partial<ChartConfig>, { syncCustom: false })} className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400" />
                    </div>
                    <button onClick={() => setActiveTab("data")} className="mt-1 w-full rounded border border-gray-100 py-0.5 text-[9px] text-gray-500 hover:bg-gray-50">← Data</button>
                  </div>
                )}

                {activeTab === "customs" && (
                  <div className="space-y-2 px-1">
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                        <div className="text-[10px] font-medium text-gray-500">Plot</div>
                        <button type="button" onClick={applyCustomDraft} className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 transition-colors hover:text-sky-700">Run <FiPlay className="h-3 w-3" /></button>
                      </div>
                      <textarea ref={customEditorRef} value={customDraft} onChange={(e) => { setCustomDraft(e.target.value); syncCustomEditorHeight(); }} spellCheck={false} className="min-h-[260px] w-full resize-none overflow-hidden bg-white px-3 py-3 font-mono text-[11px] leading-5 text-slate-700 outline-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chart preview */}
        <div className="flex-1 min-w-0 min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-2">
            {config.title && <div className="px-1 text-[11px] font-semibold text-gray-700">{config.title}</div>}
            <div ref={previewRef} className="flex-1 min-h-0">
              {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 h-40 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  <LuChartColumnBig className="h-8 w-8" /><span>Connect a data source</span>
                </div>
              ) : choroplethGuidance || bubbleMapGuidance || spikeMapGuidance || cartogramGuidance ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                    <LuChartColumnBig className="h-4 w-4" /><span>{choroplethGuidance || bubbleMapGuidance || spikeMapGuidance || cartogramGuidance}</span>
                  </div>
                </div>
              ) : !previewReady ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                    <LuChartColumnBig className="h-4 w-4" /><span>{setupMessage}</span>
                  </div>
                </div>
              ) : chartError ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 px-4 text-xs text-red-500">{chartError}</div>
              ) : (
                <div className={`chart-container h-full overflow-hidden rounded-lg bg-white ${isGeospatialChart ? "p-0" : "p-2"}`} dangerouslySetInnerHTML={{ __html: chartMarkup }} />
              )}
            </div>
            {config.caption && <div className="px-1 text-[10px] leading-relaxed text-gray-500">{config.caption}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildCustomStarterCode(config: ChartConfig, entry: ChartCatalogEntry | null, columns: ColumnInfo[], geometryColumn: string | null): string {
  const categoryColumn = config.xColumn ?? columns[0]?.name ?? "category";
  const numericColumn = config.yColumn ?? config.sizeColumn ?? config.lengthColumn ?? columns.find((c) => isNumericType(c.type))?.name ?? columns[1]?.name ?? "value";
  const reducer = numericColumn.match(/price|cost|rate|ratio|score|avg|mean/i) ? "mean" : "sum";
  return `Plot.plot({\n  width,\n  height,\n  marks: [\n    Plot.barY(\n      data,\n      Plot.groupX({ y: "${reducer}" }, {\n        x: "${categoryColumn}",\n        y: "${numericColumn}",\n        fill: "#14b8a6"\n      })\n    ),\n    Plot.ruleY([0], { stroke: "#94a3b8" })\n  ]\n})`;
}
