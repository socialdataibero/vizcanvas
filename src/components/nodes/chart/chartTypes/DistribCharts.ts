import type * as PlotModule from "@observablehq/plot";
import { getQuantitativeLegendOptions } from "../chartUtils";
import { getXTickRotation } from "@/lib/chartBarUtils";
import type { ChartContext, ChartResult } from "./BarCharts";

export function buildHeatmap(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, xColumn, yColumn, colorColumn } = ctx;

  if (xColumn && yColumn) {
    const fillColumn = colorColumn || "count";
    const heatmapValues = colorColumn
      ? data.map((row) => row[colorColumn])
      : data.map(() => 1);
    const uniqueXCount = new Set(data.map((row) => row[xColumn])).size;
    plotOptions.x = { tickRotate: getXTickRotation(uniqueXCount) };
    plotOptions.color = {
      zero: true,
      scheme: "blues",
      ...getQuantitativeLegendOptions(fillColumn, heatmapValues),
    };
    marks.push(
      colorColumn
        ? Plot.cell(data, Plot.group({ fill: "median" }, { x: xColumn, y: yColumn, fill: colorColumn, inset: 0.5, sort: { y: "fill" } } as Record<string, unknown>))
        : Plot.cell(data, Plot.group({ fill: "count" }, { x: xColumn, y: yColumn, fill: "count", inset: 0.5, sort: { y: "fill" } } as Record<string, unknown>))
    );
    return { showColorLegend: true, legendOptions: null, showGrid: true };
  }

  return { showColorLegend: false, legendOptions: null, showGrid: true };
}
