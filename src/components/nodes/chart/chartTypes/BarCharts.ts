import type * as PlotModule from "@observablehq/plot";
import {
  BASE_CHART_COLOR,
  getCompactSwatchLegendOptions,
  getReducerForColumnName,
  getBarYMarkOptions,
  getBarXMarkOptions,
  aggregateCategoryValues,
  getWaffleUnit,
  buildWaterfallData,
} from "../chartUtils";
import { buildStackedSortOptions, buildTipMarkOptions, getXTickRotation, detectsHighVariance } from "@/lib/chartBarUtils";

export type ChartContext = {
  Plot: typeof PlotModule;
  data: Record<string, unknown>[];
  marks: PlotModule.Markish[];
  plotOptions: Record<string, unknown>;
  plotSize: { width: number; height: number };
  xColumn?: string;
  yColumn?: string;
  colorColumn?: string;
  facetColumn?: string;
};

export type ChartResult = {
  showColorLegend: boolean;
  legendOptions: Record<string, unknown> | null;
  showGrid: boolean;
};

export function buildStackedBar(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn && colorColumn) {
    showColorLegend = true;
    legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    const reducer = getReducerForColumnName(yColumn);
    const uniqueXCount = new Set(data.map((row) => row[xColumn])).size;
    plotOptions.x = { tickRotate: getXTickRotation(uniqueXCount) };
    const sortOpts = buildStackedSortOptions();
    marks.push(Plot.barY(data, Plot.groupX({ y: reducer }, { x: xColumn, y: yColumn, fill: colorColumn, sort: sortOpts } as Record<string, unknown>)));
    marks.push(Plot.tip(data, Plot.pointerX(Plot.groupX({ y: reducer }, buildTipMarkOptions(xColumn, yColumn, colorColumn) as Record<string, unknown>))));
    marks.push(Plot.ruleY([0]));
    const groupSumValues = Array.from(
      new Map(data.reduce((acc, row) => {
        const key = String(row[xColumn]);
        const val = typeof row[yColumn] === "number" ? (row[yColumn] as number) : Number(row[yColumn]);
        acc.set(key, (acc.get(key) ?? 0) + (Number.isFinite(val) ? val : 0));
        return acc;
      }, new Map<string, number>())).values()
    );
    if (detectsHighVariance(groupSumValues)) plotOptions.y = { type: "log" };
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildGroupedBar(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, yColumn, colorColumn, facetColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (yColumn && colorColumn && facetColumn) {
    showColorLegend = true;
    legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    const reducer = getReducerForColumnName(yColumn);
    plotOptions.fx = { label: null, tickRotate: -45 };
    plotOptions.x = { axis: null };
    marks.push(Plot.barY(data, Plot.groupX({ y: reducer }, { x: colorColumn, y: yColumn, fill: colorColumn, fx: facetColumn } as Record<string, unknown>)));
    marks.push(Plot.ruleY([0]));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildVerticalBar(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    if (colorColumn) {
      showColorLegend = true;
      legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    }
    const reducer = getReducerForColumnName(yColumn);
    const uniqueXCount = new Set(data.map((row) => row[xColumn])).size;
    plotOptions.x = { tickRotate: getXTickRotation(uniqueXCount) };
    marks.push(Plot.barY(data, Plot.groupX({ y: reducer }, getBarYMarkOptions(xColumn, yColumn, colorColumn || BASE_CHART_COLOR) as Record<string, unknown>)));
    marks.push(Plot.tip(data, Plot.pointerX(Plot.groupX({ y: reducer }, buildTipMarkOptions(xColumn, yColumn, colorColumn) as Record<string, unknown>))));
    marks.push(Plot.ruleY([0], { stroke: "#94a3b8" }));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildHorizontalBar(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;

  if (xColumn && yColumn) {
    if (colorColumn) showColorLegend = true;
    const reducer = getReducerForColumnName(xColumn);
    marks.push(Plot.barX(data, Plot.groupY({ x: reducer }, getBarXMarkOptions(yColumn, xColumn, colorColumn || BASE_CHART_COLOR) as Record<string, unknown>)));
    marks.push(Plot.ruleX([0], { stroke: "#94a3b8" }));
  }

  return { showColorLegend, legendOptions: null, showGrid: true };
}

export function buildWaffleChart(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    showColorLegend = Boolean(colorColumn);
    if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    const uniqueXCount = new Set(data.map((row) => row[xColumn])).size;
    plotOptions.x = { tickRotate: getXTickRotation(uniqueXCount) };
    const reducer = getReducerForColumnName(yColumn);
    const waffleData = aggregateCategoryValues(data, xColumn, yColumn, reducer, colorColumn);
    const unit = getWaffleUnit(waffleData.map((e) => e.value), yColumn);
    marks.push(Plot.waffleY(waffleData, { x: "category", y: "value", fill: colorColumn ? "group" : BASE_CHART_COLOR, unit } as Record<string, unknown>));
  }

  return { showColorLegend, legendOptions, showGrid: false };
}

export function buildWaterfallChart(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    const waterfallData = buildWaterfallData(data, xColumn, yColumn, colorColumn);
    if (waterfallData.length > 0) {
      showColorLegend = Boolean(colorColumn);
      if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
      marks.push(Plot.barY(waterfallData, {
        x: "step", y1: "start", y2: "end",
        fill: colorColumn ? "fill" : (row: { change: number }) => row.change >= 0 ? "#10b981" : "#ef4444",
      } as Record<string, unknown>));
      marks.push(Plot.text(waterfallData, {
        x: "step",
        y: (row: { start: number; end: number }) => Math.max(row.start, row.end),
        text: "label", dy: -8, fontWeight: "bold", fontSize: 10,
      } as Record<string, unknown>));
      marks.push(Plot.ruleY([0]));
    }
  }

  return { showColorLegend, legendOptions, showGrid: true };
}
