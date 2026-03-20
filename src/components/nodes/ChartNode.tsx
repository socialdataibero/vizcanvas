"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type * as PlotModule from "@observablehq/plot";
import { FiChevronsLeft, FiChevronsRight } from "react-icons/fi";
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

interface Props {
  node: DAGNode;
  presentationMode?: boolean;
}

type TabId = "type" | "data" | "options";

const BASE_CHART_COLOR = "#14b8a6";

function isNumericType(type: string): boolean {
  return /int|float|double|decimal|numeric|real|bigint|smallint|tinyint/i.test(type);
}

function getFieldRequirement(
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  field: ChartFieldKey
): ChartFieldRequirement | null {
  if (entry?.fields?.[field]) {
    return entry.fields[field];
  }

  switch (chartType) {
    case "histogram":
      return field === "x" ? "required" : null;
    case "heatmap":
      if (field === "x" || field === "y") return "required";
      return field === "color" ? "optional" : null;
    case "scatter":
    case "dot":
      if (field === "x") return "required";
      if (field === "y") return chartType === "scatter" ? "required" : "optional";
      if (field === "color" || field === "size") return "optional";
      return null;
    case "box":
      return field === "x" || field === "y" ? "required" : null;
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
      if (entry?.id === "horizontal-bar") return "Value";
      if (entry?.id === "grouped-bar") return "Series";
      if (entry?.id === "temporal-histogram") return "Time";
      return chartType === "histogram" ? "Value" : "X";
    case "y":
      if (entry?.id === "horizontal-bar") return "Category";
      return "Y";
    case "color":
      if (entry?.id === "grouped-bar" || entry?.id === "multi-series-line") {
        return "Series";
      }
      return "Color";
    case "size":
      return "Size";
    case "facet":
      if (entry?.id === "grouped-bar") return "Group";
      return "Facet";
  }
}

function getMissingConfigFields(
  config: ChartConfig,
  entry: ChartCatalogEntry | null
): ChartFieldKey[] {
  if (!config.chartType) return ["x"];

  return (["x", "y", "color", "size", "facet"] as ChartFieldKey[]).filter((field) => {
    if (getFieldRequirement(entry, config.chartType, field) !== "required") {
      return false;
    }

    switch (field) {
      case "x":
        return !config.xColumn;
      case "y":
        return !config.yColumn;
      case "color":
        return !config.colorColumn;
      case "size":
        return !config.sizeColumn;
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

function getColumnOptions(
  field: ChartFieldKey,
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  allColumns: ColumnInfo[],
  numericColumns: ColumnInfo[]
) {
  const numericOrAll = numericColumns.length > 0 ? numericColumns : allColumns;

  switch (entry?.id ?? chartType) {
    case "horizontal-bar":
      return field === "x" ? numericOrAll : allColumns;
    case "grouped-bar":
      if (field === "y") return numericOrAll;
      return allColumns;
    case "histogram":
    case "temporal-histogram":
    case "faceted-histogram":
      return field === "x" || field === "facet" || field === "color" ? allColumns : [];
    case "bubble-chart":
      if (field === "size" || field === "x" || field === "y") return numericOrAll;
      return allColumns;
    case "scatter":
    case "scatterplot":
    case "color-scatterplot":
      if (field === "x" || field === "y") return numericOrAll;
      return allColumns;
    case "box":
    case "box-plot":
      return field === "y" ? numericOrAll : allColumns;
    case "barcode-strip-plot":
    case "beeswarm":
      return field === "x" ? numericOrAll : allColumns;
    default:
      if (field === "y" || field === "size") return numericOrAll;
      return allColumns;
  }
}

export default function ChartNodeBody({ node, presentationMode = false }: Props) {
  const config = node.config as ChartConfig;
  const {
    chartType,
    chartCatalogId,
    xColumn,
    yColumn,
    colorColumn,
    sizeColumn,
    facetColumn,
  } = config;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const columns = useMemo(() => upstreamNode?.result?.columns ?? [], [upstreamNode?.result?.columns]);
  const data = useMemo(() => upstreamNode?.result?.rows ?? [], [upstreamNode?.result?.rows]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("type");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const selectedCatalogEntry = useMemo(
    () => getChartCatalogEntry(chartCatalogId, chartType),
    [chartCatalogId, chartType]
  );
  const [plotSize, setPlotSize] = useState({ width: 400, height: 220 });
  const [chartMarkup, setChartMarkup] = useState<string>("");
  const [chartError, setChartError] = useState<string>("");

  useEffect(() => {
    const previewEl = previewRef.current;
    if (!previewEl || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const nextWidth = Math.max(340, Math.floor(previewEl.clientWidth - 16));
      const nextHeight = Math.max(220, Math.min(420, Math.round(nextWidth * 0.48)));
      setPlotSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(previewEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      data.length === 0 ||
      !isChartReady(
        {
          chartType,
          xColumn,
          yColumn,
          colorColumn,
          sizeColumn,
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
        const marks: PlotModule.Markish[] = [];
        const variantId = selectedCatalogEntry?.id ?? chartType;
        let showColorLegend = false;

        switch (variantId) {
          case "grouped-bar":
            if (xColumn && yColumn && colorColumn && facetColumn) {
              showColorLegend = true;
              marks.push(
                Plot.barY(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn,
                  fx: facetColumn,
                } as Record<string, unknown>)
              );
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "vertical-bar":
          case "bar":
          case "barY":
            if (xColumn && yColumn) {
              if (colorColumn) showColorLegend = true;
              marks.push(
                Plot.barY(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                })
              );
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "horizontal-bar":
          case "barX":
            if (xColumn && yColumn) {
              if (colorColumn) showColorLegend = true;
              marks.push(
                Plot.barX(data, {
                  y: yColumn,
                  x: xColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                })
              );
              marks.push(Plot.ruleX([0]));
            }
            break;
          case "line-chart":
          case "line":
            if (xColumn && yColumn) {
              if (colorColumn) showColorLegend = true;
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
              if (colorColumn) showColorLegend = true;
              marks.push(
                Plot.areaY(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                  fillOpacity: 0.4,
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
          case "faceted-histogram":
          case "histogram":
            if (xColumn) {
              const histogramOptions: Record<string, unknown> = { x: xColumn };
              if (variantId === "faceted-histogram" && facetColumn) {
                histogramOptions.fy = facetColumn;
                histogramOptions.fill = colorColumn || facetColumn;
                showColorLegend = Boolean(colorColumn || facetColumn);
              }
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
          case "scatterplot":
          case "color-scatterplot":
          case "scatter":
            if (xColumn && yColumn) {
              if (colorColumn) showColorLegend = true;
              marks.push(
                Plot.dot(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                  r: 4,
                })
              );
            }
            break;
          case "bubble-chart":
            if (xColumn && yColumn && sizeColumn) {
              if (colorColumn) showColorLegend = true;
              marks.push(
                Plot.dot(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                  r: sizeColumn,
                  fillOpacity: 0.75,
                } as Record<string, unknown>)
              );
            }
            break;
          case "beeswarm":
            if (xColumn) {
              if (colorColumn) showColorLegend = true;
              marks.push(
                Plot.dot(
                  data,
                  Plot.dodgeY({
                    x: xColumn,
                    fill: colorColumn || BASE_CHART_COLOR,
                    r: 3,
                  } as Record<string, unknown>)
                )
              );
            }
            break;
          case "barcode-strip-plot":
            if (xColumn) {
              marks.push(
                Plot.tickX(data, {
                  x: xColumn,
                  stroke: BASE_CHART_COLOR,
                  strokeOpacity: 0.35,
                } as Record<string, unknown>)
              );
            }
            break;
          case "dot-comparison":
          case "dot":
            if (xColumn && yColumn) {
              if (colorColumn) showColorLegend = true;
              marks.push(Plot.ruleY([0]));
              marks.push(
                Plot.dot(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                  r: 4,
                })
              );
            }
            break;
          case "box-plot":
          case "box":
            if (xColumn && yColumn) {
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
          case "pie":
            if (xColumn && yColumn) {
              const pieData = data.map((d: Record<string, unknown>) => ({
                label: String(d[xColumn]),
                value: Number(d[yColumn]) || 0,
              }));
              showColorLegend = true;
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

        const chart = Plot.plot({
          width: plotSize.width,
          height: plotSize.height,
          marginLeft:
            variantId === "horizontal-bar" || variantId === "barX" ? 110 : 52,
          marginBottom: 36,
          marks,
          grid: true,
          ...(variantId === "faceted-histogram" ? { fy: { label: null } } : {}),
          ...(showColorLegend ? { color: { legend: true } } : {}),
          style: { fontSize: "10px", background: "transparent" },
        });
        if (!cancelled) {
          setChartMarkup(chart.outerHTML);
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
    facetColumn,
    sizeColumn,
    xColumn,
    yColumn,
    data,
    plotSize.height,
    plotSize.width,
    selectedCatalogEntry,
  ]);

  const numericCols = columns.filter((c) => isNumericType(c.type));
  const allCols = columns;
  const chartReady = isChartReady(config, selectedCatalogEntry);
  const setupMessage = getChartSetupMessage(config, selectedCatalogEntry);

  const updateChartField = (
    field: keyof Pick<ChartConfig, "xColumn" | "yColumn" | "colorColumn" | "sizeColumn" | "facetColumn">,
    value: string
  ) => {
    updateNodeConfig(node.id, {
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
          : field === "color"
            ? config.colorColumn
            : field === "size"
              ? config.sizeColumn
              : config.facetColumn;
    const configField =
      field === "x"
        ? "xColumn"
        : field === "y"
          ? "yColumn"
          : field === "color"
            ? "colorColumn"
            : field === "size"
              ? "sizeColumn"
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
          ) : !chartReady ? (
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
      {/* Tab bar */}
      <div className="mb-2 flex items-center border-b border-gray-100">
        {(["type", "data", "options"] as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setIsSidebarCollapsed(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((current) => !current)}
          className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600"
          title={isSidebarCollapsed ? "Show chart sidebar" : "Hide chart sidebar"}
          aria-label={isSidebarCollapsed ? "Show chart sidebar" : "Hide chart sidebar"}
        >
          {isSidebarCollapsed ? <FiChevronsRight className="h-3.5 w-3.5" /> : <FiChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* LEFT/RIGHT layout: config panel + chart preview */}
      <div className="flex flex-1 min-h-0 gap-2 overflow-hidden">
        {/* Config panel */}
        <div
          className={`min-h-0 flex-shrink-0 overflow-hidden transition-[width,opacity,margin] duration-200 ease-out ${
            isSidebarCollapsed
              ? "w-0 border-transparent pr-0 opacity-0"
              : "w-44 border-r border-gray-100 pr-2 opacity-100"
          }`}
          aria-hidden={isSidebarCollapsed}
        >
          <div className="subtle-scrollbar h-full overflow-y-auto pr-1">
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
                            <button
                              key={entry.id}
                              className={`chart-type-btn ${
                                selectedCatalogEntry?.id === entry.id ? "selected" : ""
                              } ${entry.supported ? "" : "opacity-45 cursor-not-allowed"}`}
                              onClick={() => {
                                if (!entry.supported || !entry.chartType) return;
                                updateNodeConfig(node.id, {
                                  chartCatalogId: entry.id,
                                  chartType: entry.chartType,
                                } as Partial<ChartConfig>);
                              }}
                              title={
                                entry.supported
                                  ? entry.description
                                  : `${entry.label}: catalog item not available yet`
                              }
                              disabled={!entry.supported}
                            >
                              <span className="text-sm leading-none">{entry.icon}</span>
                              <span className="text-[7px] leading-tight">{entry.label}</span>
                            </button>
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
                  {(["y", "x", "color", "size", "facet"] as ChartFieldKey[]).map(renderEncodingField)}
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
                      onChange={(e) => updateNodeConfig(node.id, {
                        title: e.target.value.trim() ? e.target.value : undefined,
                      } as Partial<ChartConfig>)}
                      className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-medium text-gray-500 uppercase">Caption</label>
                    <input
                      type="text"
                      placeholder="Caption"
                      value={config.caption || ""}
                      onChange={(e) => updateNodeConfig(node.id, {
                        caption: e.target.value.trim() ? e.target.value : undefined,
                      } as Partial<ChartConfig>)}
                      className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-teal-400"
                    />
                  </div>
                  <button onClick={() => setActiveTab("data")} className="mt-1 w-full rounded border border-gray-100 py-0.5 text-[9px] text-gray-500 hover:bg-gray-50">← Data</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart preview */}
        <div ref={previewRef} className="flex-1 min-w-0 min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-2">
            {config.title && (
              <div className="px-1 text-[11px] font-semibold text-gray-700">
                {config.title}
              </div>
            )}
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 h-40 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                <LuChartColumnBig className="h-8 w-8" />
                <span>Connect a data source</span>
              </div>
            ) : !chartReady ? (
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
                className="chart-container min-h-[160px] overflow-hidden bg-white"
                dangerouslySetInnerHTML={{ __html: chartMarkup }}
              />
            )}
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
