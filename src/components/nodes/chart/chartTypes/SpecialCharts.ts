import type * as PlotModule from "@observablehq/plot";
import {
  BASE_CHART_COLOR,
  getCompactSwatchLegendOptions,
  getQuantitativeLegendOptions,
  getReducerForColumnName,
  aggregateCategoryValues,
  toFiniteNumber,
  buildGridCartogramData,
  isGridRatioDomain,
  formatGridCartogramValue,
  buildSpikeLegendMarks,
  getSpikeLegendMode,
  getSpikeLengthRange,
  type GridCartogramDatum,
} from "../chartUtils";
import { parseGeometryValue } from "@/lib/geospatial";
import { buildGeometryFeatures } from "../geoUtils";
import type { ChartContext, ChartResult } from "./BarCharts";

// ── Treemap ──────────────────────────────────────────────────────────────────

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
  type TreemapDatum = { name: string; value?: number; children?: TreemapDatum[] };
  const groupedValues = new Map<string, Map<string, { total: number; count: number }>>();

  data.forEach((row) => {
    const label = row[labelColumn];
    const value = toFiniteNumber(row[valueColumn]);
    if (label === undefined || label === null || value === null) return;
    const groupKey = groupColumn && row[groupColumn] !== undefined && row[groupColumn] !== null ? String(row[groupColumn]) : "All";
    const itemKey = String(label);
    const groupItems = groupedValues.get(groupKey) ?? new Map<string, { total: number; count: number }>();
    const current = groupItems.get(itemKey) ?? { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    groupItems.set(itemKey, current);
    groupedValues.set(groupKey, groupItems);
  });

  if (groupedValues.size === 0) return [];

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

  const root = d3.hierarchy<TreemapDatum>(hierarchyData).sum((n) => n.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const layout = d3.treemap<TreemapDatum>().size([width, height]).padding(1);
  const treemapRoot = layout(root);

  return treemapRoot.leaves().map((leaf) => ({
    x0: leaf.x0, x1: leaf.x1, y0: leaf.y0, y1: leaf.y1,
    label: leaf.data.name, value: leaf.value ?? 0,
    group: leaf.parent?.data.name ?? leaf.data.name,
  }));
}

export async function buildTreemap(ctx: ChartContext): Promise<ChartResult> {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, yColumn, colorColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn) {
    const reducer = getReducerForColumnName(yColumn);
    const leaves = await buildTreemapLeaves(data, xColumn, yColumn, plotSize.width, plotSize.height, colorColumn, reducer);
    if (leaves.length > 0) {
      showColorLegend = Boolean(colorColumn);
      if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
      plotOptions.x = { axis: null };
      plotOptions.y = { axis: null };
      plotOptions.marginTop = 20; plotOptions.marginRight = 8; plotOptions.marginBottom = 8; plotOptions.marginLeft = 8;
      marks.push(Plot.rect(leaves, { x1: "x0", x2: "x1", y1: "y0", y2: "y1", fill: "group", inset: 1, title: (l: { group: string; label: string; value: number }) => `${l.group}: ${l.label} (${l.value})` } as Record<string, unknown>));
      marks.push(Plot.text(leaves, { x: (l: { x0: number; x1: number }) => (l.x0 + l.x1) / 2, y: (l: { y0: number; y1: number }) => (l.y0 + l.y1) / 2, text: (l: { x0: number; x1: number; y0: number; y1: number; label: string }) => l.x1 - l.x0 > 38 && l.y1 - l.y0 > 22 ? l.label : "", textAnchor: "middle", lineAnchor: "middle", fontSize: 10, fontWeight: 600, fill: "#fff" } as Record<string, unknown>));
    }
  }

  return { showColorLegend, legendOptions, showGrid: false };
}

// ── Grid cartogram ────────────────────────────────────────────────────────────

export function buildGridCartogram(ctx: ChartContext & { labelColumn?: string }): ChartResult {
  const { Plot, data, marks, plotOptions, xColumn, yColumn, colorColumn, labelColumn } = ctx;

  if (xColumn && yColumn && colorColumn) {
    plotOptions.x = { axis: null };
    plotOptions.y = { axis: null };
    plotOptions.marginTop = 12; plotOptions.marginRight = 12; plotOptions.marginBottom = 12; plotOptions.marginLeft = 12;
    const cartogramCells = buildGridCartogramData(data, xColumn, yColumn, colorColumn, labelColumn);
    if (cartogramCells.length === 0) throw new Error("Select numeric grid columns for X, Y, and Value.");
    const cartogramValues = cartogramCells.map((c) => c.value);
    const ratioDomain = isGridRatioDomain(cartogramValues);
    plotOptions.color = ratioDomain
      ? { type: "diverging-log", pivot: 1, scheme: "PiYG", ...getQuantitativeLegendOptions(colorColumn, cartogramValues) }
      : { scheme: "blues", ...getQuantitativeLegendOptions(colorColumn, cartogramValues) };
    marks.push(Plot.cell(cartogramCells, { x: "gridX", y: "gridY", fill: "value", inset: 1, stroke: "#ffffff", strokeWidth: 1, tip: true, title: (c: GridCartogramDatum) => c.label ? `${c.label}: ${formatGridCartogramValue(c.value, ratioDomain)}` : `(${c.gridX}, ${c.gridY}): ${formatGridCartogramValue(c.value, ratioDomain)}` } as Record<string, unknown>));
    if (labelColumn) marks.push(Plot.text(cartogramCells, { x: "gridX", y: "gridY", text: (c: GridCartogramDatum) => c.label, dy: -5, fontSize: 9, fontWeight: 700, lineWidth: 8, textAnchor: "middle", lineAnchor: "middle", fill: "#0f172a" } as Record<string, unknown>));
    marks.push(Plot.text(cartogramCells, { x: "gridX", y: "gridY", text: (c: GridCartogramDatum) => formatGridCartogramValue(c.value, ratioDomain), dy: labelColumn ? 8 : 0, fontSize: labelColumn ? 8.5 : 10, fontWeight: labelColumn ? 500 : 700, lineWidth: 8, textAnchor: "middle", lineAnchor: "middle", fill: labelColumn ? "#475467" : "#0f172a" } as Record<string, unknown>));
    return { showColorLegend: true, legendOptions: null, showGrid: false };
  }

  return { showColorLegend: false, legendOptions: null, showGrid: false };
}

// ── Link chart ────────────────────────────────────────────────────────────────

export function buildLinkChart(ctx: ChartContext & { x2Column?: string; y2Column?: string; labelColumn?: string }): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn, x2Column, y2Column, colorColumn, labelColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn && x2Column && y2Column) {
    showColorLegend = Boolean(colorColumn);
    if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    marks.push(Plot.link(data, { x1: xColumn, y1: yColumn, x2: x2Column, y2: y2Column, stroke: colorColumn || "#94a3b8", strokeOpacity: 0.7 } as Record<string, unknown>));
    marks.push(Plot.dot(data, { x: x2Column, y: y2Column, fill: BASE_CHART_COLOR, r: 4 } as Record<string, unknown>));
    if (labelColumn) marks.push(Plot.text(data, { x: x2Column, y: y2Column, text: labelColumn, dx: 8, textAnchor: "start" } as Record<string, unknown>));
  }

  return { showColorLegend, legendOptions, showGrid: false };
}

// ── Sankey ────────────────────────────────────────────────────────────────────

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
  type SankeyNodeDatum = { name: string; group: string };
  type SankeyLinkDatum = { source: string; target: string; value: number; group: string };

  const nodeGroups = new Map<string, string>();
  const aggregatedLinks = new Map<string, SankeyLinkDatum>();

  data.forEach((row) => {
    const source = row[sourceColumn];
    const target = row[targetColumn];
    const value = toFiniteNumber(row[valueColumn]);
    if (source == null || target == null || value === null) return;
    const sourceName = String(source);
    const targetName = String(target);
    if (sourceName === targetName) return;
    const group = groupColumn && row[groupColumn] != null ? String(row[groupColumn]) : sourceName;
    const key = `${sourceName}→${targetName}→${group}`;
    const existing = aggregatedLinks.get(key);
    if (existing) { existing.value += value; } else { aggregatedLinks.set(key, { source: sourceName, target: targetName, value, group }); }
    if (!nodeGroups.has(sourceName)) nodeGroups.set(sourceName, group);
    if (!nodeGroups.has(targetName)) nodeGroups.set(targetName, group);
  });

  const nodes = Array.from(new Set(Array.from(aggregatedLinks.values()).flatMap((l) => [l.source, l.target]))).map((name) => ({ name, group: nodeGroups.get(name) ?? name }));
  const links = Array.from(aggregatedLinks.values()).map((l) => ({ ...l }));
  if (nodes.length === 0 || links.length === 0) return { nodes: [], linkBands: [] };

  const maxColumnNodeCount = Math.max(new Set(links.map((l) => l.source)).size, new Set(links.map((l) => l.target)).size, 1);
  const availableHeight = Math.max(height - 24, 180);
  const preferredPadding = maxColumnNodeCount > 1 ? Math.floor((availableHeight - maxColumnNodeCount * 8) / (maxColumnNodeCount - 1)) : 14;
  const nodePadding = Math.max(2, Math.min(14, preferredPadding));

  const layout = sankey<SankeyNodeDatum, SankeyLinkDatum>().nodeId((n) => n.name).nodeWidth(18).nodePadding(nodePadding).extent([[0, 0], [Math.max(width - 40, 240), availableHeight]]);
  const graph = layout({ nodes: nodes.map((n) => ({ ...n })) as SankeyNodeDatum[], links: links.map((l) => ({ ...l })) as SankeyLinkDatum[] });

  const sankeyNodes = graph.nodes.map((n) => ({ x0: n.x0, x1: n.x1, y0: n.y0, y1: n.y1, name: n.name, group: n.group }));
  const linkBands = graph.links.flatMap((link) => {
    const src = link.source as SankeyNodeDatum & { x0: number; x1: number; y0: number; y1: number };
    const tgt = link.target as SankeyNodeDatum & { x0: number; x1: number; y0: number; y1: number };
    const w = link.width ?? 0;
    if (w <= 0) return [];
    const sy = link.y0 ?? (src.y0 + src.y1) / 2;
    const ty = link.y1 ?? (tgt.y0 + tgt.y1) / 2;
    return [{ group: link.group, points: [{ x: src.x1, y0: sy - w / 2, y1: sy + w / 2 }, { x: tgt.x0, y0: ty - w / 2, y1: ty + w / 2 }] }];
  });

  return { nodes: sankeyNodes, linkBands };
}

export async function buildSankeyDiagram(ctx: ChartContext & { sizeColumn?: string }): Promise<ChartResult> {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, yColumn, colorColumn, sizeColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && yColumn && sizeColumn) {
    if (xColumn === yColumn) throw new Error("Choose different source and target columns for a Sankey diagram.");
    const { nodes: sankeyNodes, linkBands } = await buildSankeyData(data, xColumn, yColumn, sizeColumn, plotSize.width, plotSize.height, colorColumn);
    if (sankeyNodes.length > 0 && linkBands.length > 0) {
      showColorLegend = Boolean(colorColumn);
      if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
      plotOptions.x = { axis: null }; plotOptions.y = { axis: null };
      plotOptions.marginTop = 20; plotOptions.marginRight = 48; plotOptions.marginBottom = 8; plotOptions.marginLeft = 8;
      linkBands.forEach((band) => marks.push(Plot.areaY(band.points, { x: "x", y1: "y0", y2: "y1", curve: "bump-x", fill: colorColumn ? band.group : "#0f172a", fillOpacity: 0.16 } as Record<string, unknown>)));
      marks.push(Plot.rect(sankeyNodes, { x1: "x0", x2: "x1", y1: "y0", y2: "y1", fill: colorColumn ? "group" : "name" } as Record<string, unknown>));
      marks.push(Plot.text(sankeyNodes, { x: "x1", y: (n: { y0: number; y1: number }) => (n.y0 + n.y1) / 2, text: "name", dx: 5, textAnchor: "start", lineAnchor: "middle", fontSize: 10 } as Record<string, unknown>));
    }
  }

  return { showColorLegend, legendOptions, showGrid: false };
}

// ── Pie ──────────────────────────────────────────────────────────────────────

export function buildPieChart(ctx: ChartContext): ChartResult {
  const { Plot, data, marks, plotSize, xColumn, yColumn } = ctx;

  if (xColumn && yColumn) {
    const reducer = getReducerForColumnName(yColumn);
    const pieData = aggregateCategoryValues(data, xColumn, yColumn, reducer).map((e) => ({ label: e.category, value: e.value }));
    marks.push(Plot.barY(pieData, { x: "label", y: "value", fill: "label", sort: { x: "-y" } }));
    marks.push(Plot.ruleY([0]));
    return { showColorLegend: true, legendOptions: getCompactSwatchLegendOptions(plotSize.width), showGrid: true };
  }

  return { showColorLegend: false, legendOptions: null, showGrid: true };
}

// ── Geo charts ────────────────────────────────────────────────────────────────

export function buildChoropleth(ctx: ChartContext & { geometryColumn?: string }): ChartResult {
  const { Plot, data, marks, plotOptions, xColumn, yColumn, colorColumn, geometryColumn } = ctx;

  if (xColumn && yColumn) {
    if (!geometryColumn) throw new Error("Connect a GeoJSON or TopoJSON table to render this choropleth.");
    const features = buildGeometryFeatures(data, geometryColumn, xColumn, yColumn);
    if (features.length === 0) throw new Error("The connected geospatial table does not contain valid geometries.");
    const choroplethValues = data.map((row) => row[yColumn]);
    plotOptions.marginTop = 8; plotOptions.marginRight = 8; plotOptions.marginBottom = 8; plotOptions.marginLeft = 8;
    plotOptions.color = { zero: true, scheme: "blues", ...getQuantitativeLegendOptions(yColumn, choroplethValues) };
    plotOptions.projection = { type: "mercator", domain: { type: "FeatureCollection", features } };
    marks.push(Plot.geo(features, { fill: (f: ReturnType<typeof buildGeometryFeatures>[number]) => f.properties.value, stroke: "#ffffff", strokeWidth: 0.8, tip: true, title: (f: ReturnType<typeof buildGeometryFeatures>[number]) => f.properties.value === null ? f.properties.label : `${f.properties.label}: ${f.properties.value}` } as Record<string, unknown>));
    return { showColorLegend: true, legendOptions: null, showGrid: false };
  }

  return { showColorLegend: false, legendOptions: null, showGrid: false };
}

export function buildDotMap(ctx: ChartContext & { geometryColumn?: string; sizeColumn?: string }): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, colorColumn, sizeColumn, geometryColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn) {
    if (!geometryColumn) throw new Error("Connect a GeoJSON or TopoJSON table to render this bubble map.");
    const bubbleFeatures = data.flatMap((row) => {
      const geometry = parseGeometryValue(row[geometryColumn]);
      if (!geometry) return [];
      return [{ type: "Feature" as const, properties: { label: row[xColumn] == null ? "Unknown" : String(row[xColumn]), value: sizeColumn ? toFiniteNumber(row[sizeColumn]) : null, group: colorColumn && row[colorColumn] != null ? String(row[colorColumn]) : null }, geometry }];
    });
    if (bubbleFeatures.length === 0) throw new Error("The connected geospatial table does not contain valid geometries.");
    showColorLegend = Boolean(colorColumn);
    if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    plotOptions.marginTop = 8; plotOptions.marginRight = 8; plotOptions.marginBottom = 8; plotOptions.marginLeft = 8;
    plotOptions.projection = { type: "mercator", domain: { type: "FeatureCollection", features: bubbleFeatures } };
    marks.push(Plot.geo(bubbleFeatures, { fill: "#f8fafc", stroke: "#e2e8f0", strokeWidth: 0.8 } as Record<string, unknown>));
    marks.push(Plot.dot(bubbleFeatures, Plot.geoCentroid({ r: sizeColumn ? (f: typeof bubbleFeatures[number]) => f.properties.value ?? 0 : 5, fill: colorColumn ? (f: typeof bubbleFeatures[number]) => f.properties.group ?? BASE_CHART_COLOR : BASE_CHART_COLOR, stroke: "#ffffff", strokeWidth: 1, fillOpacity: 0.75, tip: true, title: (f: typeof bubbleFeatures[number]) => f.properties.value === null ? f.properties.label : `${f.properties.label}: ${f.properties.value}` } as Record<string, unknown>)));
  }

  return { showColorLegend, legendOptions, showGrid: false };
}

export function buildSpikeMap(ctx: ChartContext & { geometryColumn?: string; lengthColumn?: string }): ChartResult {
  const { Plot, data, marks, plotOptions, plotSize, xColumn, colorColumn, geometryColumn, lengthColumn } = ctx;
  let showColorLegend = false;
  let legendOptions: Record<string, unknown> | null = null;

  if (xColumn && lengthColumn) {
    if (!geometryColumn) throw new Error("Connect a GeoJSON or TopoJSON table to render this spike map.");
    const spikeFeatures = data.flatMap((row) => {
      const geometry = parseGeometryValue(row[geometryColumn]);
      const value = toFiniteNumber(row[lengthColumn]);
      if (!geometry || value === null) return [];
      return [{ type: "Feature" as const, properties: { label: row[xColumn] == null ? "Unknown" : String(row[xColumn]), value, group: colorColumn && row[colorColumn] != null ? String(row[colorColumn]) : null }, geometry }];
    });
    if (spikeFeatures.length === 0) throw new Error("The connected geospatial table does not contain valid geometries.");
    const spikeValues = spikeFeatures.map((f) => f.properties.value).filter((v): v is number => v !== null && Number.isFinite(v));
    const spikeLegendMode = getSpikeLegendMode(spikeValues, lengthColumn);
    const maxSpikeValue = spikeValues.length > 0 ? Math.max(...spikeValues) : 0;
    showColorLegend = Boolean(colorColumn);
    if (colorColumn) legendOptions = getCompactSwatchLegendOptions(plotSize.width);
    plotOptions.length = { range: getSpikeLengthRange(spikeLegendMode, maxSpikeValue) };
    plotOptions.marginTop = 24; plotOptions.marginRight = 0; plotOptions.marginBottom = 0; plotOptions.marginLeft = 0;
    plotOptions.projection = { type: "mercator", domain: { type: "FeatureCollection", features: spikeFeatures } };
    marks.push(Plot.geo(spikeFeatures, { fill: "#e0e0e0", stroke: "white", strokeWidth: 1 } as Record<string, unknown>));
    marks.push(Plot.spike(spikeFeatures, Plot.geoCentroid({ length: (f: typeof spikeFeatures[number]) => f.properties.value ?? 0, stroke: colorColumn ? (f: typeof spikeFeatures[number]) => f.properties.group ?? BASE_CHART_COLOR : "red", fill: colorColumn ? (f: typeof spikeFeatures[number]) => f.properties.group ?? BASE_CHART_COLOR : "red", tip: true, title: (f: typeof spikeFeatures[number]) => f.properties.value === null ? f.properties.label : `${f.properties.label}: ${f.properties.value}` } as Record<string, unknown>)));
    if (!colorColumn) marks.push(...buildSpikeLegendMarks(Plot, spikeValues, spikeLegendMode, "red", "bottom-right"));
  }

  return { showColorLegend, legendOptions, showGrid: false };
}

export async function buildArcMap(ctx: ChartContext & { x2Column?: string; y2Column?: string; lengthColumn?: string }): Promise<ChartResult> {
  const { Plot, data, marks, plotOptions, xColumn, yColumn, x2Column, y2Column, colorColumn, lengthColumn } = ctx;
  let showColorLegend = false;

  if (xColumn && yColumn && x2Column && y2Column) {
    const [{ feature }, countriesModule, landModule] = await Promise.all([import("topojson-client"), import("world-atlas/countries-110m.json"), import("world-atlas/land-110m.json")]);
    const landAtlas = (landModule.default ?? landModule) as { objects: { land: unknown } };
    const land = feature(landAtlas as never, landAtlas.objects.land as never);
    const locations = data.flatMap((row) => {
      const originLon = toFiniteNumber(row[xColumn]); const originLat = toFiniteNumber(row[yColumn]);
      const destLon = toFiniteNumber(row[x2Column]); const destLat = toFiniteNumber(row[y2Column]);
      const points: Array<{ longitude: number; latitude: number }> = [];
      if (originLon !== null && originLat !== null) points.push({ longitude: originLon, latitude: originLat });
      if (destLon !== null && destLat !== null) points.push({ longitude: destLon, latitude: destLat });
      return points;
    });
    showColorLegend = Boolean(colorColumn);
    plotOptions.projection = "equal-earth";
    plotOptions.marginTop = 8; plotOptions.marginRight = 8; plotOptions.marginBottom = 8; plotOptions.marginLeft = 8;
    marks.push(Plot.geo(land, { fill: "#f8fafc", stroke: "#cbd5e1" } as Record<string, unknown>));
    marks.push(Plot.arrow(data, { x1: xColumn, y1: yColumn, x2: x2Column, y2: y2Column, bend: true, stroke: colorColumn || BASE_CHART_COLOR, strokeOpacity: 0.45, strokeWidth: lengthColumn || 1.5 } as Record<string, unknown>));
    marks.push(Plot.dot(locations, { x: "longitude", y: "latitude", fill: "#0f172a", r: 1.8 } as Record<string, unknown>));
    marks.push(Plot.sphere());
  }

  return { showColorLegend, legendOptions: null, showGrid: false };
}
