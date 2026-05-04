import type * as PlotModule from "@observablehq/plot";
import {
  BASE_CHART_COLOR,
  MAX_INLINE_CATEGORICAL_LEGEND_ITEMS,
  getCompactSwatchLegendOptions,
  getReducerForColumnName,
  aggregateCategoryValues,
  isNumericType,
} from "../chartUtils";
import { getXTickRotation, resolveStripChartMode } from "@/lib/chartBarUtils";
import type { ChartContext, ChartResult } from "./BarCharts";
import type { ColumnInfo } from "@/types/nodes";

export function buildScatterChart(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    if (colorColumn) {
      showColorLegend = true;
      legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    }
    marks.push(Plot.dot(data, { x: xColumn, y: yColumn, fill: colorColumn || BASE_CHART_COLOR }));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildBubbleChart(ctx: ChartContext & { sizeColumn?: string }): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn, colorColumn, sizeColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn && sizeColumn) {
    if (colorColumn) {
      showColorLegend = true;
      legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    }
    marks.push(Plot.dot(data, { x: xColumn, y: yColumn, fill: colorColumn || BASE_CHART_COLOR, r: sizeColumn } as Record<string, unknown>));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildBeeswarm(ctx: ChartContext & { columns: ColumnInfo[]; normalizedBeeswarmAnchor: string }): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, colorColumn, columns, normalizedBeeswarmAnchor } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

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
    marks.push(Plot.dot(data, Plot.dodgeY({ x: xColumn, fill: colorColumn || BASE_CHART_COLOR, anchor: normalizedBeeswarmAnchor } as Record<string, unknown>)));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildFacetedDodge(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, colorColumn, facetColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && facetColumn) {
    showColorLegend = Boolean(colorColumn || facetColumn);
    legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    const uniqueFacetCount = new Set(data.map((row) => row[facetColumn])).size;
    plotOptions.fx = { label: null, tickRotate: getXTickRotation(uniqueFacetCount) };
    plotOptions.x = { axis: null };
    marks.push(Plot.dot(data, Plot.dodgeX("middle", { fx: facetColumn, y: xColumn, fill: colorColumn || facetColumn } as Record<string, unknown>)));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildDotComparison(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    if (colorColumn) {
      showColorLegend = true;
      legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    }
    const reducer = getReducerForColumnName(yColumn);
    const dotData = aggregateCategoryValues(data, xColumn, yColumn, reducer, colorColumn);
    const uniqueXCount = new Set(data.map((row) => row[xColumn])).size;
    plotOptions.x = { tickRotate: getXTickRotation(uniqueXCount) };
    marks.push(Plot.ruleY([0]));
    marks.push(Plot.dot(dotData, { x: "category", y: "value", fill: colorColumn ? "group" : BASE_CHART_COLOR }));
    marks.push(Plot.tip(dotData, Plot.pointerX({ x: "category", y: "value", ...(colorColumn ? { fill: "group" } : {}) })));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}

export function buildBoxPlot(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotOptions, xColumn, yColumn } = ctx;

  if (xColumn && yColumn) {
    const uniqueXCount = new Set(data.map((row) => row[xColumn])).size;
    plotOptions.x = { tickRotate: getXTickRotation(uniqueXCount) };
    marks.push(Plot.boxY(data, { x: xColumn, y: yColumn } as Record<string, unknown>));
  }

  return { showColorLegend: false, legendOptions: null, showGrid: true };
}

export function buildBarcodeStripPlot(
  ctx: ChartContext & { columns: ColumnInfo[] }
): ChartResult {
  const { Plot, data, marks, plotOptions, xColumn, yColumn, colorColumn, columns } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (!xColumn) return { showColorLegend, legendOptions, showGrid: true };

  const stripCategoryColumnInfo = yColumn ? columns.find((c) => c.name === yColumn) : undefined;
  const stripGroupColumnInfo = colorColumn ? columns.find((c) => c.name === colorColumn) : undefined;

  const stripMode = resolveStripChartMode({
    hasCategory: Boolean(yColumn && stripCategoryColumnInfo && !isNumericType(stripCategoryColumnInfo.type)),
    hasGroup: Boolean(colorColumn && stripGroupColumnInfo && !isNumericType(stripGroupColumnInfo.type)),
    categoryEqualsGroup: yColumn === colorColumn,
    groupCardinality: colorColumn ? new Set(data.map((row) => String(row[colorColumn] ?? ""))).size : 0,
    maxLegendItems: MAX_INLINE_CATEGORICAL_LEGEND_ITEMS,
  });

  if (stripMode.mode === "grouped" && yColumn && colorColumn) {
    showColorLegend = stripMode.showLegend;
    if (stripMode.showLegend) legendOptions = getCompactSwatchLegendOptions(0);
    plotOptions.y = { domain: Array.from(new Set(data.map((row) => row[yColumn]))), reverse: true, label: null };
    plotOptions.x = { grid: true, label: `${xColumn} →` };
    marks.push(Plot.ruleX([0], { stroke: "#94a3b8" }));
    marks.push(Plot.tickX(data, { x: xColumn, y: yColumn, stroke: stripMode.useGroupColor ? colorColumn : BASE_CHART_COLOR } as Record<string, unknown>));
  } else if (stripMode.mode === "category" && yColumn && stripCategoryColumnInfo && !isNumericType(stripCategoryColumnInfo.type)) {
    plotOptions.y = { domain: Array.from(new Set(data.map((row) => row[yColumn]))), reverse: true, label: null };
    plotOptions.x = { grid: true, label: `${xColumn} →` };
    marks.push(Plot.tickX(data, { x: xColumn, y: yColumn, stroke: BASE_CHART_COLOR } as Record<string, unknown>));
  } else {
    plotOptions.x = { grid: true, label: `${xColumn} →` };
    marks.push(Plot.tickX(data, { x: xColumn, stroke: BASE_CHART_COLOR } as Record<string, unknown>));
  }

  return { showColorLegend, legendOptions, showGrid: true };
}
