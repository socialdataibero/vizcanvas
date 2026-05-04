import type * as PlotModule from "@observablehq/plot";
import { BASE_CHART_COLOR, getCompactSwatchLegendOptions } from "../chartUtils";
import type { ChartContext, ChartResult } from "./BarCharts";

export function buildLineChart(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    if (colorColumn) {
      showColorLegend = true;
      legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    }
    marks.push(Plot.line(data, { x: xColumn, y: yColumn, stroke: colorColumn || BASE_CHART_COLOR }));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildMultiSeriesLine(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn && colorColumn) {
    showColorLegend = true;
    legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    marks.push(Plot.line(data, { x: xColumn, y: yColumn, stroke: colorColumn }));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildAreaChart(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    if (colorColumn) {
      showColorLegend = true;
      legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    }
    marks.push(Plot.areaY(data, { x: xColumn, y: yColumn, fill: colorColumn || BASE_CHART_COLOR }));
    marks.push(Plot.line(data, { x: xColumn, y: yColumn, stroke: colorColumn || "#0d9488" }));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildHistogram(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, xColumn } = ctx;

  if (xColumn) {
    marks.push(Plot.rectY(data, Plot.binX({ y: "count" }, { x: xColumn, fill: BASE_CHART_COLOR })));
    marks.push(Plot.ruleY([0]));
  }

  return { showColorLegend: false, legendOptions: null, showGrid: true };
}
