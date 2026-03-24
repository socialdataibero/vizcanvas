import * as React from "react";
import { Icon, type IconNode, type LucideProps } from "lucide-react";

type LooseIconNode = ReadonlyArray<
  readonly [elementName: IconNode[number][0], attrs: Record<string, string | number>]
>;

const createChartIcon = (name: string, iconNode: LooseIconNode) => {
  const Component = React.forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
    <Icon
      ref={ref}
      iconNode={iconNode as unknown as IconNode}
      strokeWidth={1.9}
      absoluteStrokeWidth
      {...props}
    />
  ));

  Component.displayName = name;
  return Component;
};

export const chartIconNeutral = "#667085" as const;

const ChartColumnsNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 19.5, x2: 19.5, y2: 19.5, opacity: "0.24" }],
  ["rect", { x: 6, y: 11, width: 2.5, height: 8.5, rx: "0.8", fill: "none" }],
  ["rect", { x: 10.75, y: 7.5, width: 2.5, height: 12, rx: "0.8", fill: "none" }],
  ["rect", { x: 15.5, y: 13, width: 2.5, height: 6.5, rx: "0.8", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartColumns = createChartIcon("ChartColumns", ChartColumnsNode);

const ChartBarsNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 5, x2: 4.5, y2: 19, opacity: "0.24" }],
  ["rect", { x: 6, y: 6.2, width: 12, height: 2.4, rx: "0.8", fill: "none" }],
  ["rect", { x: 6, y: 10.8, width: 8.5, height: 2.4, rx: "0.8", fill: "none" }],
  ["rect", { x: 6, y: 15.4, width: 5.6, height: 2.4, rx: "0.8", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartBars = createChartIcon("ChartBars", ChartBarsNode);

const ChartGroupedNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 19.5, x2: 19.5, y2: 19.5, opacity: "0.24" }],
  ["rect", { x: 5.2, y: 12, width: 1.9, height: 7.5, rx: "0.6", fill: "none" }],
  ["rect", { x: 7.8, y: 9.4, width: 1.9, height: 10.1, rx: "0.6", fill: "none" }],
  ["rect", { x: 11.6, y: 14, width: 1.9, height: 5.5, rx: "0.6", fill: "none" }],
  ["rect", { x: 14.2, y: 8, width: 1.9, height: 11.5, rx: "0.6", fill: "none" }],
  ["rect", { x: 16.8, y: 11.4, width: 1.9, height: 8.1, rx: "0.6", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartGrouped = createChartIcon("ChartGrouped", ChartGroupedNode);

const ChartDotPlotNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 18.5, x2: 19.5, y2: 18.5, opacity: "0.24" }],
  ["circle", { cx: 6, cy: 14.5, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 10, cy: 11, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 10, cy: 7.5, r: 1, fill: "none" }],
  ["circle", { cx: 14, cy: 14.5, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 14, cy: 11, r: 1, fill: "none" }],
  ["circle", { cx: 18, cy: 11, r: 1, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartDotPlot = createChartIcon("ChartDotPlot", ChartDotPlotNode);

const ChartHistogramNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 19.5, x2: 19.5, y2: 19.5, opacity: "0.24" }],
  ["rect", { x: 5, y: 13.5, width: 3.2, height: 6, rx: "0.5", fill: "none" }],
  ["rect", { x: 8.2, y: 9, width: 3.2, height: 10.5, rx: "0.5", fill: "none" }],
  ["rect", { x: 11.4, y: 6.3, width: 3.2, height: 13.2, rx: "0.5", fill: "none" }],
  ["rect", { x: 14.6, y: 10.5, width: 3.2, height: 9, rx: "0.5", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartHistogram = createChartIcon("ChartHistogram", ChartHistogramNode);

const ChartBeeswarmNode: LooseIconNode = [
  ["circle", { cx: 6.3, cy: 12.5, r: 1, fill: "none" }],
  ["circle", { cx: 8.7, cy: 9.4, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 8.9, cy: 15.8, r: 1, fill: "none" }],
  ["circle", { cx: 11.5, cy: 7.8, r: 1, fill: "none" }],
  ["circle", { cx: 11.6, cy: 12.2, r: 1.05, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 13.9, cy: 9.8, r: 1, fill: "none" }],
  ["circle", { cx: 14.2, cy: 15.6, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 16.7, cy: 11.8, r: 1, fill: "none" }],
  ["circle", { cx: 18.6, cy: 9.6, r: 1, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartBeeswarm = createChartIcon("ChartBeeswarm", ChartBeeswarmNode);

const ChartBoxPlotNode: LooseIconNode = [
  ["line", { x1: 12, y1: 5, x2: 12, y2: 19 }],
  ["line", { x1: 9.5, y1: 6.5, x2: 14.5, y2: 6.5, opacity: "0.86" }],
  ["line", { x1: 9.5, y1: 17.5, x2: 14.5, y2: 17.5, opacity: "0.86" }],
  ["rect", { x: 8.5, y: 9, width: 7, height: 6, rx: "1", fill: "none" }],
  ["line", { x1: 8.5, y1: 12, x2: 15.5, y2: 12, opacity: "0.86" }],
] as const satisfies LooseIconNode;

export const ChartBoxPlot = createChartIcon("ChartBoxPlot", ChartBoxPlotNode);

const ChartFacetedNode: LooseIconNode = [
  ["rect", { x: 4.5, y: 5, width: 6.3, height: 5.7, rx: "1", fill: "none" }],
  ["rect", { x: 13.2, y: 5, width: 6.3, height: 5.7, rx: "1", fill: "none" }],
  ["rect", { x: 4.5, y: 13.3, width: 6.3, height: 5.7, rx: "1", fill: "none" }],
  ["rect", { x: 13.2, y: 13.3, width: 6.3, height: 5.7, rx: "1", fill: "none" }],
  ["path", { d: "M6.1 8.8h3.1", opacity: "0.82" }],
  ["path", { d: "M14.8 9.1l1.5-1.3 1.5 1.6 1.5-1.9", opacity: "0.82" }],
  ["line", { x1: 6.2, y1: 17.2, x2: 9.1, y2: 17.2, opacity: "0.82" }],
  ["circle", { cx: 16.4, cy: 16.2, r: 1, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartFaceted = createChartIcon("ChartFaceted", ChartFacetedNode);

const ChartStripNode: LooseIconNode = [
  ["line", { x1: 12, y1: 5, x2: 12, y2: 19, opacity: "0.24" }],
  ["circle", { cx: 10.5, cy: 7.2, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 13.2, cy: 9.6, r: 1, fill: "none" }],
  ["circle", { cx: 11.3, cy: 12.2, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 14.1, cy: 14.7, r: 1, fill: "none" }],
  ["circle", { cx: 10.2, cy: 17.4, r: 1, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartStrip = createChartIcon("ChartStrip", ChartStripNode);

const ChartTemporalNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 19.5, x2: 19.5, y2: 19.5, opacity: "0.24" }],
  ["rect", { x: 5.3, y: 14.5, width: 2.2, height: 5, rx: "0.7", fill: "none" }],
  ["rect", { x: 8.6, y: 10.5, width: 2.2, height: 9, rx: "0.7", fill: "none" }],
  ["rect", { x: 11.9, y: 7.2, width: 2.2, height: 12.3, rx: "0.7", fill: "none" }],
  ["rect", { x: 15.2, y: 11.7, width: 2.2, height: 7.8, rx: "0.7", fill: "none" }],
  ["path", { d: "M5.4 8.2c2-1 3.8-1.5 5.8-1.5 2 0 3.9.6 5.8 1.8", opacity: "0.55" }],
] as const satisfies LooseIconNode;

export const ChartTemporal = createChartIcon("ChartTemporal", ChartTemporalNode);

const ChartLineNode: LooseIconNode = [
  ["path", { d: "M4.5 5.5v13.5H19.5", opacity: "0.24" }],
  ["path", { d: "M5.6 15.8 9.2 12.2 12.1 13.7 16.1 9.5 18.4 7.3" }],
  ["circle", { cx: 18.4, cy: 7.3, r: 0.9, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartLine = createChartIcon("ChartLine", ChartLineNode);

const ChartMultiLineNode: LooseIconNode = [
  ["path", { d: "M5.3 8.6c2.1-1 3.9-1.2 5.5-.2 1.2.7 2 1.7 3.1 1.7 1 0 1.8-.6 3.6-2.3", opacity: "0.72" }],
  ["path", { d: "M5.3 12.3c2.1-1.2 4-1.2 5.7-.1 1.1.7 1.8 1.6 2.8 1.6 1.1 0 1.8-.6 3.7-2.4" }],
  ["path", { d: "M5.3 16.2c2.2-.9 4-1 5.5-.1 1.1.7 2 1.3 3.1 1.3 1 0 1.9-.4 3.8-1.6", opacity: "0.72" }],
] as const satisfies LooseIconNode;

export const ChartMultiLine = createChartIcon("ChartMultiLine", ChartMultiLineNode);

const ChartAreaNode: LooseIconNode = [
  ["path", { d: "M4.5 5.5v13.5H19.5", opacity: "0.24" }],
  ["path", { d: "M5.5 16.5 9.2 12.3 12 13.6 15.4 10.2 18.4 7.6" }],
  ["path", { d: "M5.5 16.5V19.5H18.4V7.6", opacity: "0.36" }],
] as const satisfies LooseIconNode;

export const ChartArea = createChartIcon("ChartArea", ChartAreaNode);

const ChartScatterNode: LooseIconNode = [
  ["path", { d: "M4.5 5.5v13.5H19.5", opacity: "0.24" }],
  ["circle", { cx: 6.2, cy: 16.4, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 8.9, cy: 13.6, r: 1, fill: "none" }],
  ["circle", { cx: 11.5, cy: 15.1, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 13.7, cy: 10.3, r: 1, fill: "none" }],
  ["circle", { cx: 16.5, cy: 8, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 18.2, cy: 6.2, r: 1, fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartScatter = createChartIcon("ChartScatter", ChartScatterNode);

const ChartColorScatterNode: LooseIconNode = [
  ["path", { d: "M4.5 5.5v13.5H19.5", opacity: "0.24" }],
  ["circle", { cx: 6.4, cy: 16.4, r: 0.9, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 9.4, cy: 12.8, r: 1.2, fill: "none" }],
  ["circle", { cx: 12.3, cy: 15.1, r: 1.4, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 15.2, cy: 9.6, r: 1.8, fill: "none" }],
  ["circle", { cx: 18.1, cy: 6.4, r: 1.1, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartColorScatter = createChartIcon("ChartColorScatter", ChartColorScatterNode);

const ChartBubbleNode: LooseIconNode = [
  ["circle", { cx: 8.7, cy: 10.2, r: 2.1, fill: "none" }],
  ["circle", { cx: 13.2, cy: 15.4, r: 3.1, fill: "none" }],
  ["circle", { cx: 17.5, cy: 8.4, r: 1.6, fill: "none" }],
  ["circle", { cx: 18.1, cy: 16.2, r: 2.1, fill: "none" }],
  ["circle", { cx: 6.5, cy: 17.1, r: 1.1, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartBubble = createChartIcon("ChartBubble", ChartBubbleNode);

const ChartHeatmapNode: LooseIconNode = [
  ["rect", { x: 5, y: 5, width: 4, height: 4, rx: "0.8", fill: "currentColor", stroke: "none", opacity: "0.18" }],
  ["rect", { x: 10, y: 5, width: 4, height: 4, rx: "0.8", fill: "none" }],
  ["rect", { x: 15, y: 5, width: 4, height: 4, rx: "0.8", fill: "currentColor", stroke: "none", opacity: "0.45" }],
  ["rect", { x: 5, y: 10, width: 4, height: 4, rx: "0.8", fill: "none" }],
  ["rect", { x: 10, y: 10, width: 4, height: 4, rx: "0.8", fill: "currentColor", stroke: "none", opacity: "0.68" }],
  ["rect", { x: 15, y: 10, width: 4, height: 4, rx: "0.8", fill: "none" }],
  ["rect", { x: 5, y: 15, width: 4, height: 4, rx: "0.8", fill: "currentColor", stroke: "none", opacity: "0.12" }],
  ["rect", { x: 10, y: 15, width: 4, height: 4, rx: "0.8", fill: "none" }],
  ["rect", { x: 15, y: 15, width: 4, height: 4, rx: "0.8", fill: "currentColor", stroke: "none", opacity: "0.82" }],
] as const satisfies LooseIconNode;

export const ChartHeatmap = createChartIcon("ChartHeatmap", ChartHeatmapNode);

const ChartStackedNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 19.5, x2: 19.5, y2: 19.5, opacity: "0.24" }],
  ["rect", { x: 5.2, y: 14.5, width: 3, height: 5, rx: "0.6", fill: "none" }],
  ["rect", { x: 5.2, y: 10.9, width: 3, height: 3.6, rx: "0.6", fill: "none" }],
  ["rect", { x: 9.7, y: 15.8, width: 3, height: 3.7, rx: "0.6", fill: "none" }],
  ["rect", { x: 9.7, y: 11.3, width: 3, height: 4.5, rx: "0.6", fill: "none" }],
  ["rect", { x: 9.7, y: 7.5, width: 3, height: 3.8, rx: "0.6", fill: "none" }],
  ["rect", { x: 14.2, y: 13.1, width: 3, height: 6.4, rx: "0.6", fill: "none" }],
  ["rect", { x: 14.2, y: 8.9, width: 3, height: 4.2, rx: "0.6", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartStacked = createChartIcon("ChartStacked", ChartStackedNode);

const ChartTreemapNode: LooseIconNode = [
  ["rect", { x: 4.5, y: 5, width: 15, height: 14, rx: "1.5", fill: "none" }],
  ["rect", { x: 5.4, y: 5.9, width: 5.3, height: 7.7, rx: "0.8", fill: "none" }],
  ["rect", { x: 5.4, y: 14.4, width: 5.3, height: 3.7, rx: "0.8", fill: "none" }],
  ["rect", { x: 11.6, y: 5.9, width: 7, height: 4.6, rx: "0.8", fill: "none" }],
  ["rect", { x: 11.6, y: 11.3, width: 3.2, height: 6.8, rx: "0.8", fill: "none" }],
  ["rect", { x: 15.4, y: 11.3, width: 3.2, height: 6.8, rx: "0.8", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartTreemap = createChartIcon("ChartTreemap", ChartTreemapNode);

const ChartWaffleNode: LooseIconNode = [
  ["rect", { x: 5, y: 5, width: 2.6, height: 2.6, rx: "0.55", fill: "currentColor", stroke: "none", opacity: "0.75" }],
  ["rect", { x: 8.8, y: 5, width: 2.6, height: 2.6, rx: "0.55", fill: "currentColor", stroke: "none", opacity: "0.75" }],
  ["rect", { x: 12.6, y: 5, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 16.4, y: 5, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 5, y: 8.8, width: 2.6, height: 2.6, rx: "0.55", fill: "currentColor", stroke: "none", opacity: "0.75" }],
  ["rect", { x: 8.8, y: 8.8, width: 2.6, height: 2.6, rx: "0.55", fill: "currentColor", stroke: "none", opacity: "0.75" }],
  ["rect", { x: 12.6, y: 8.8, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 16.4, y: 8.8, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 5, y: 12.6, width: 2.6, height: 2.6, rx: "0.55", fill: "currentColor", stroke: "none", opacity: "0.45" }],
  ["rect", { x: 8.8, y: 12.6, width: 2.6, height: 2.6, rx: "0.55", fill: "currentColor", stroke: "none", opacity: "0.45" }],
  ["rect", { x: 12.6, y: 12.6, width: 2.6, height: 2.6, rx: "0.55", fill: "currentColor", stroke: "none", opacity: "0.45" }],
  ["rect", { x: 16.4, y: 12.6, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 5, y: 16.4, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 8.8, y: 16.4, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 12.6, y: 16.4, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
  ["rect", { x: 16.4, y: 16.4, width: 2.6, height: 2.6, rx: "0.55", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartWaffle = createChartIcon("ChartWaffle", ChartWaffleNode);

const ChartWaterfallNode: LooseIconNode = [
  ["line", { x1: 4.5, y1: 19, x2: 19.5, y2: 19, opacity: "0.24" }],
  ["rect", { x: 5.1, y: 11.4, width: 2.8, height: 7.6, rx: "0.6", fill: "none" }],
  ["line", { x1: 7.9, y1: 11.4, x2: 9.6, y2: 11.4, opacity: "0.72" }],
  ["rect", { x: 9.6, y: 7.6, width: 2.8, height: 3.8, rx: "0.6", fill: "none" }],
  ["line", { x1: 12.4, y1: 7.6, x2: 14.1, y2: 7.6, opacity: "0.72" }],
  ["rect", { x: 14.1, y: 7.6, width: 2.8, height: 6.1, rx: "0.6", fill: "none" }],
  ["line", { x1: 16.9, y1: 13.7, x2: 18.3, y2: 13.7, opacity: "0.72" }],
  ["rect", { x: 18.3, y: 13.7, width: 1.2, height: 5.3, rx: "0.5", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartWaterfall = createChartIcon("ChartWaterfall", ChartWaterfallNode);

const ChartChoroplethNode: LooseIconNode = [
  ["polygon", { points: "5.6,11.6 8.0,7.6 11.1,8.6 10.5,12.5 7.0,14.1", fill: "none" }],
  ["polygon", { points: "10.9,8.5 14.5,6.7 17.3,9.0 15.8,12.5 10.5,12.5", fill: "none" }],
  ["polygon", { points: "17.2,9.0 19.2,11.0 18.9,15.1 15.8,14.2 15.8,12.5", fill: "none" }],
  ["polygon", { points: "7.0,14.1 10.5,12.5 12.9,14.8 11.9,18.2 7.6,17.4", fill: "none" }],
  ["polygon", { points: "12.9,14.8 15.8,14.2 18.0,17.1 14.4,19.0 11.9,18.2", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartChoropleth = createChartIcon("ChartChoropleth", ChartChoroplethNode);

const ChartBubbleMapNode: LooseIconNode = [
  ["path", { d: "M5.8 12.0 7.8 8.0 11.9 6.6l3.1 1.8 3.3-.2 1.9 3.4-1.4 4.0-3.0 1.6-2.7 1.9-3.8-.7-3.1-2.8Z", opacity: "0.42" }],
  ["circle", { cx: 10.2, cy: 11.1, r: 1.5, fill: "none" }],
  ["circle", { cx: 15.2, cy: 10.1, r: 2.1, fill: "none" }],
  ["circle", { cx: 13.9, cy: 15.4, r: 1, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartBubbleMap = createChartIcon("ChartBubbleMap", ChartBubbleMapNode);

const ChartCartogramNode: LooseIconNode = [
  ["rect", { x: 5, y: 5.2, width: 2.7, height: 2.6, rx: "0.5", fill: "none" }],
  ["rect", { x: 8.4, y: 5.2, width: 4.1, height: 2.6, rx: "0.5", fill: "none" }],
  ["rect", { x: 13.2, y: 5.7, width: 2.5, height: 2.1, rx: "0.5", fill: "none" }],
  ["rect", { x: 16.3, y: 5.1, width: 2.7, height: 3, rx: "0.5", fill: "none" }],
  ["rect", { x: 4.3, y: 8.9, width: 3.1, height: 2.6, rx: "0.5", fill: "none" }],
  ["rect", { x: 7.9, y: 8.7, width: 3.5, height: 3, rx: "0.5", fill: "none" }],
  ["rect", { x: 12, y: 9.5, width: 4.2, height: 2.2, rx: "0.5", fill: "none" }],
  ["rect", { x: 16.8, y: 9.1, width: 2.3, height: 2.8, rx: "0.5", fill: "none" }],
  ["rect", { x: 6.3, y: 13.4, width: 3, height: 2.8, rx: "0.5", fill: "none" }],
  ["rect", { x: 10, y: 13.8, width: 4.9, height: 2.4, rx: "0.5", fill: "none" }],
  ["rect", { x: 15.6, y: 13.2, width: 2.7, height: 3.4, rx: "0.5", fill: "none" }],
] as const satisfies LooseIconNode;

export const ChartCartogram = createChartIcon("ChartCartogram", ChartCartogramNode);

const ChartArcMapNode: LooseIconNode = [
  ["line", { x1: 4.7, y1: 18, x2: 19.3, y2: 18, opacity: "0.24" }],
  ["path", { d: "M5.7 18c1.8-4.5 3.8-4.5 5.6 0", opacity: "0.78" }],
  ["path", { d: "M9.0 18c2.3-7.8 4.9-7.8 7.2 0" }],
  ["path", { d: "M13.6 18c1.7-3.8 3.5-3.8 5.2 0", opacity: "0.78" }],
  ["circle", { cx: 5.7, cy: 18, r: 0.8, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 12.6, cy: 18, r: 0.8, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 19.3, cy: 18, r: 0.8, fill: "currentColor", stroke: "none" }],
] as const satisfies LooseIconNode;

export const ChartArcMap = createChartIcon("ChartArcMap", ChartArcMapNode);

const ChartLinkNode: LooseIconNode = [
  ["rect", { x: 4.8, y: 14.8, width: 2.4, height: 2.4, rx: "0.7", fill: "none" }],
  ["circle", { cx: 12.6, cy: 10.8, r: 1, fill: "currentColor", stroke: "none" }],
  ["circle", { cx: 18.6, cy: 7.8, r: 1.4, fill: "none" }],
  ["path", { d: "M7.2 16c2.8 0 3.6-5.2 7-5.2h2.9" }],
] as const satisfies LooseIconNode;

export const ChartLink = createChartIcon("ChartLink", ChartLinkNode);

const ChartSankeyNode: LooseIconNode = [
  ["path", { d: "M4.2 8.4h3.1c2.4 0 3.5.7 5 2.1 1.4 1.3 2.6 2.6 5.2 2.6H20", strokeWidth: "3.0", strokeLinecap: "round", strokeLinejoin: "round" }],
  ["path", { d: "M4.2 15.6h3.1c2.4 0 3.5-.7 5-2.1 1.4-1.3 2.6-2.6 5.2-2.6H20", strokeWidth: "3.0", strokeLinecap: "round", strokeLinejoin: "round", opacity: "0.72" }],
] as const satisfies LooseIconNode;

export const ChartSankey = createChartIcon("ChartSankey", ChartSankeyNode);


export const chartIconColorByName = {
  ChartColumns: "#667085",
  ChartBars: "#667085",
  ChartGrouped: "#667085",
  ChartDotPlot: "#667085",
  ChartHistogram: "#667085",
  ChartBeeswarm: "#667085",
  ChartBoxPlot: "#667085",
  ChartFaceted: "#667085",
  ChartStrip: "#667085",
  ChartTemporal: "#667085",
  ChartLine: "#667085",
  ChartMultiLine: "#667085",
  ChartArea: "#667085",
  ChartScatter: "#667085",
  ChartColorScatter: "#667085",
  ChartBubble: "#667085",
  ChartHeatmap: "#667085",
  ChartStacked: "#667085",
  ChartTreemap: "#667085",
  ChartWaffle: "#667085",
  ChartWaterfall: "#667085",
  ChartChoropleth: "#667085",
  ChartBubbleMap: "#667085",
  ChartCartogram: "#667085",
  ChartArcMap: "#667085",
  ChartLink: "#667085",
  ChartSankey: "#667085",
} as const;


export const chartIconRegistry = {
  ChartColumns,
  ChartBars,
  ChartGrouped,
  ChartDotPlot,
  ChartHistogram,
  ChartBeeswarm,
  ChartBoxPlot,
  ChartFaceted,
  ChartStrip,
  ChartTemporal,
  ChartLine,
  ChartMultiLine,
  ChartArea,
  ChartScatter,
  ChartColorScatter,
  ChartBubble,
  ChartHeatmap,
  ChartStacked,
  ChartTreemap,
  ChartWaffle,
  ChartWaterfall,
  ChartChoropleth,
  ChartBubbleMap,
  ChartCartogram,
  ChartArcMap,
  ChartLink,
  ChartSankey,
} as const;


export const chartIconGroups = {
  "comparison": [
    { label: "Columns", icon: ChartColumns, name: "ChartColumns", color: "#667085" },
    { label: "Bars", icon: ChartBars, name: "ChartBars", color: "#667085" },
    { label: "Grouped", icon: ChartGrouped, name: "ChartGrouped", color: "#667085" },
    { label: "Dot plot", icon: ChartDotPlot, name: "ChartDotPlot", color: "#667085" },
  ],
  "distribution": [
    { label: "Histogram", icon: ChartHistogram, name: "ChartHistogram", color: "#667085" },
    { label: "Beeswarm", icon: ChartBeeswarm, name: "ChartBeeswarm", color: "#667085" },
    { label: "Box plot", icon: ChartBoxPlot, name: "ChartBoxPlot", color: "#667085" },
    { label: "Faceted", icon: ChartFaceted, name: "ChartFaceted", color: "#667085" },
    { label: "Strip", icon: ChartStrip, name: "ChartStrip", color: "#667085" },
  ],
  "time": [
    { label: "Temporal", icon: ChartTemporal, name: "ChartTemporal", color: "#667085" },
    { label: "Line", icon: ChartLine, name: "ChartLine", color: "#667085" },
    { label: "Multi-line", icon: ChartMultiLine, name: "ChartMultiLine", color: "#667085" },
    { label: "Area", icon: ChartArea, name: "ChartArea", color: "#667085" },
  ],
  "relationship": [
    { label: "Scatter", icon: ChartScatter, name: "ChartScatter", color: "#667085" },
    { label: "Color scatter", icon: ChartColorScatter, name: "ChartColorScatter", color: "#667085" },
    { label: "Bubble", icon: ChartBubble, name: "ChartBubble", color: "#667085" },
    { label: "Heatmap", icon: ChartHeatmap, name: "ChartHeatmap", color: "#667085" },
  ],
  "part-to-whole": [
    { label: "Stacked", icon: ChartStacked, name: "ChartStacked", color: "#667085" },
    { label: "Treemap", icon: ChartTreemap, name: "ChartTreemap", color: "#667085" },
    { label: "Waffle", icon: ChartWaffle, name: "ChartWaffle", color: "#667085" },
    { label: "Waterfall", icon: ChartWaterfall, name: "ChartWaterfall", color: "#667085" },
  ],
  "maps": [
    { label: "Choropleth", icon: ChartChoropleth, name: "ChartChoropleth", color: "#667085" },
    { label: "Bubble map", icon: ChartBubbleMap, name: "ChartBubbleMap", color: "#667085" },
    { label: "Cartogram", icon: ChartCartogram, name: "ChartCartogram", color: "#667085" },
  ],
  "flow": [
    { label: "Arc map", icon: ChartArcMap, name: "ChartArcMap", color: "#667085" },
    { label: "Link", icon: ChartLink, name: "ChartLink", color: "#667085" },
    { label: "Sankey", icon: ChartSankey, name: "ChartSankey", color: "#667085" },
  ],
} as const;


export type ChartIconName = keyof typeof chartIconRegistry;
