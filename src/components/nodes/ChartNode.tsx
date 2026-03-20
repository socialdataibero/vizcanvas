"use client";

import React, { useEffect, useRef, useState } from "react";
import type * as PlotModule from "@observablehq/plot";
import { DAGNode } from "@/engine/types";
import { ChartConfig, ChartType } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";

interface Props {
  node: DAGNode;
  presentationMode?: boolean;
}

type TabId = "type" | "data" | "options";

interface ChartTypeOption {
  value: ChartType;
  label: string;
  icon: string;
  section: string;
}

const CHART_TYPES: ChartTypeOption[] = [
  { value: "histogram", label: "Histogram",  icon: "▐▌▐",  section: "BARS" },
  { value: "bar",       label: "Columns",    icon: "▁▃▅▇", section: "BARS" },
  { value: "barX",      label: "Bars",       icon: "▬▬▬",  section: "BARS" },
  { value: "line",      label: "Line",       icon: "∿",    section: "SERIES" },
  { value: "area",      label: "Area",       icon: "◿",    section: "SERIES" },
  { value: "scatter",   label: "Scatter",    icon: "⋮⋰⋯",  section: "POINTS" },
  { value: "dot",       label: "Dot",        icon: "⊙⊙⊙",  section: "POINTS" },
  { value: "box",       label: "Box plot",   icon: "⊟⊟",   section: "OTHER" },
  { value: "heatmap",   label: "Heatmap",    icon: "▦▦",   section: "OTHER" },
  { value: "pie",       label: "Bar/Pie",    icon: "◷",    section: "OTHER" },
];

const SECTIONS = ["BARS", "SERIES", "POINTS", "OTHER"];

function isNumericType(type: string): boolean {
  return /int|float|double|decimal|numeric|real|bigint|smallint|tinyint/i.test(type);
}

function isChartReady(config: ChartConfig): boolean {
  if (!config.chartType) return false;
  if (config.chartType === "histogram") {
    return Boolean(config.xColumn);
  }

  return Boolean(config.xColumn && config.yColumn);
}

function getChartSetupMessage(config: ChartConfig): string {
  if (!config.chartType) {
    return "Chart type not selected";
  }

  if (config.chartType === "histogram" && !config.xColumn) {
    return "Choose a column";
  }

  if (!config.xColumn || !config.yColumn) {
    return "Choose X and Y";
  }

  return "";
}

export default function ChartNodeBody({ node, presentationMode = false }: Props) {
  const config = node.config as ChartConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const columns = upstreamNode?.result?.columns || [];
  const data = upstreamNode?.result?.rows || [];
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("type");
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
    if (data.length === 0 || !isChartReady(config)) {
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

        switch (config.chartType) {
          case "bar":
          case "barY":
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.barY(data, { x: config.xColumn, y: config.yColumn, fill: config.colorColumn || "#14b8a6" }));
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "barX":
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.barX(data, { y: config.yColumn, x: config.xColumn, fill: config.colorColumn || "#14b8a6" }));
            }
            break;
          case "line":
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.line(data, { x: config.xColumn, y: config.yColumn, stroke: config.colorColumn || "#14b8a6" }));
            }
            break;
          case "scatter":
          case "dot":
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.dot(data, { x: config.xColumn, y: config.yColumn, fill: config.colorColumn || "#14b8a6", r: 4 }));
            }
            break;
          case "area":
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.areaY(data, { x: config.xColumn, y: config.yColumn, fill: config.colorColumn || "#14b8a6", fillOpacity: 0.4 }));
              marks.push(Plot.line(data, { x: config.xColumn, y: config.yColumn, stroke: "#0d9488" }));
            }
            break;
          case "histogram":
            if (config.xColumn) {
              marks.push(Plot.rectY(data, Plot.binX({ y: "count" }, { x: config.xColumn } as Record<string, unknown>)));
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "box":
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.boxY(data, { x: config.xColumn, y: config.yColumn } as Record<string, unknown>));
            }
            break;
          case "pie":
            if (config.xColumn && config.yColumn) {
              const pieData = data.map((d: Record<string, unknown>) => ({
                label: String(d[config.xColumn!]),
                value: Number(d[config.yColumn!]) || 0,
              }));
              marks.push(Plot.barY(pieData, { x: "label", y: "value", fill: "label", sort: { x: "-y" } }));
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "heatmap":
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.cell(data, {
                x: config.xColumn,
                y: config.yColumn,
                fill: config.colorColumn || "count",
                ...(config.colorColumn ? {} : Plot.group({ fill: "count" })),
              } as Record<string, unknown>));
            }
            break;
          default:
            if (config.xColumn && config.yColumn) {
              marks.push(Plot.barY(data, { x: config.xColumn, y: config.yColumn, fill: "#14b8a6" }));
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
          marginLeft: 52,
          marginBottom: 36,
          marks,
          grid: true,
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
  }, [data, config.chartType, config.xColumn, config.yColumn, config.colorColumn, plotSize.height, plotSize.width]);

  const numericCols = columns.filter((c) => isNumericType(c.type));
  const allCols = columns;
  const chartReady = isChartReady(config);
  const setupMessage = getChartSetupMessage(config);

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
    <div className="flex h-full min-h-0 flex-col gap-0 no-drag" style={{ minWidth: 0 }}>
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 mb-2">
        {(["type", "data", "options"] as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* LEFT/RIGHT layout: config panel + chart preview */}
      <div className="flex min-h-0 gap-2">
        {/* Config panel */}
        <div className="w-44 flex-shrink-0 space-y-2">
          {/* TYPE TAB */}
          {activeTab === "type" && (
            <div className="space-y-2">
              {SECTIONS.map((section) => {
                const types = CHART_TYPES.filter((t) => t.section === section);
                return (
                  <div key={section}>
                    <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">{section}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {types.map((ct) => (
                        <button
                          key={ct.value}
                          className={`chart-type-btn ${config.chartType === ct.value ? "selected" : ""}`}
                          onClick={() => updateNodeConfig(node.id, { chartType: ct.value } as Partial<ChartConfig>)}
                          title={ct.label}
                        >
                          <span className="text-sm leading-none">{ct.icon}</span>
                          <span className="text-[7px] leading-tight">{ct.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button
                className="w-full text-center text-[10px] text-teal-600 hover:underline pt-1"
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
              <div>
                <label className="text-[9px] font-medium text-gray-500 uppercase">Y</label>
                <select
                  value={config.yColumn || ""}
                  onChange={(e) => updateNodeConfig(node.id, { yColumn: e.target.value } as Partial<ChartConfig>)}
                  className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] focus:border-teal-400 outline-none"
                >
                  <option value="">Select…</option>
                  {(numericCols.length > 0 ? numericCols : allCols).map((col) => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-medium text-gray-500 uppercase">X</label>
                <select
                  value={config.xColumn || ""}
                  onChange={(e) => updateNodeConfig(node.id, { xColumn: e.target.value } as Partial<ChartConfig>)}
                  className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] focus:border-teal-400 outline-none"
                >
                  <option value="">Select…</option>
                  {allCols.map((col) => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-medium text-gray-500 uppercase">Color</label>
                <select
                  value={config.colorColumn || ""}
                  onChange={(e) => updateNodeConfig(node.id, { colorColumn: e.target.value } as Partial<ChartConfig>)}
                  className="mt-0.5 w-full rounded border border-gray-200 px-1.5 py-1 text-[10px] focus:border-teal-400 outline-none"
                >
                  <option value="">None</option>
                  {allCols.map((col) => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>
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
              <button onClick={() => setActiveTab("data")} className="w-full rounded border border-gray-100 py-0.5 text-[9px] text-gray-500 hover:bg-gray-50 mt-1">← Data</button>
            </div>
          )}
        </div>

        {/* Chart preview */}
        <div ref={previewRef} className="flex-1 min-w-0">
          <div className="flex min-h-0 flex-col gap-2">
            {config.title && (
              <div className="px-1 text-[11px] font-semibold text-gray-700">
                {config.title}
              </div>
            )}
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 h-40 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                <span className="text-3xl">📈</span>
                <span>Connect a data source</span>
              </div>
            ) : !chartReady ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm">
                  <span className="text-sm">📊</span>
                  <span>{setupMessage}</span>
                </div>
              </div>
            ) : chartError ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 px-4 text-xs text-red-500">
                {chartError}
              </div>
            ) : (
              <div
                className="chart-container rounded-lg border border-gray-100 bg-white min-h-[160px] overflow-hidden"
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
