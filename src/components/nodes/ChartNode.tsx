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
import { chartIconRegistry } from "@/components/charts/picker/chart-icons-lucide-outline";
import { findGeometryColumn, parseGeometryValue } from "@/lib/geospatial";

interface Props {
  node: DAGNode;
  presentationMode?: boolean;
}

type TabId = "type" | "data" | "options";

interface ChartTypeButtonProps {
  entry: ChartCatalogEntry;
  isSelected: boolean;
  onSelect: () => void;
}

const BASE_CHART_COLOR = "#14b8a6";
const ALL_CHART_FIELDS: ChartFieldKey[] = ["x", "y", "x2", "y2", "color", "size", "length", "label", "facet"];

function getCompactSwatchLegendOptions(plotWidth: number) {
  return {
    legend: true,
    swatchSize: 8,
    width: Math.max(220, plotWidth - 8),
  };
}

function getAxisLabel(
  field: "x" | "y",
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  column?: string,
  counterpartColumn?: string
) {
  if (!column) return undefined;

  const semanticLabel = getFieldLabel(field, entry, chartType);
  if (counterpartColumn && counterpartColumn === column) {
    return semanticLabel;
  }

  if (semanticLabel === "X" || semanticLabel === "Y") {
    return column;
  }

  return semanticLabel;
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
    case "choropleth":
      return field === "x" || field === "y" ? "required" : null;
    case "geoPoint":
      if (field === "x" || field === "y") return "required";
      return field === "color" || field === "size" ? "optional" : null;
    case "spike":
      if (field === "x" || field === "y" || field === "length") return "required";
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
      if (entry?.id === "world-choropleth") return "Country";
      if (entry?.id === "dot-map") return "Longitude";
      if (entry?.id === "arc-map") return "Origin Lon";
      if (entry?.id === "sankey-diagram") return "Source";
      if (entry?.id === "waterfall-chart") return "Step";
      if (entry?.id === "treemap") return "Item";
      if (entry?.id === "grid-cartogram") return "Column";
      if (entry?.id === "link-chart") return "Start X";
      if (entry?.id === "waffle-chart" || entry?.id === "stacked-bar") return "Category";
      if (entry?.id === "horizontal-bar") return "Value";
      if (entry?.id === "grouped-bar") return "Series";
      if (entry?.id === "temporal-histogram") return "Time";
      return chartType === "histogram" ? "Value" : "X";
    case "y":
      if (entry?.id === "world-choropleth") return "Value";
      if (entry?.id === "dot-map") return "Latitude";
      if (entry?.id === "arc-map") return "Origin Lat";
      if (entry?.id === "spike-map") return "Latitude";
      if (entry?.id === "sankey-diagram") return "Target";
      if (entry?.id === "waterfall-chart") return "Change";
      if (entry?.id === "treemap" || entry?.id === "waffle-chart" || entry?.id === "stacked-bar" || entry?.id === "grouped-bar") {
        return "Value";
      }
      if (entry?.id === "grid-cartogram") return "Row";
      if (entry?.id === "link-chart") return "Start Y";
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
      if (entry?.id === "dot-map") return "Color";
      if (entry?.id === "arc-map") return "Color";
      if (entry?.id === "spike-map") return "Color";
      if (entry?.id === "sankey-diagram") return "Group";
      if (entry?.id === "stacked-bar") return "Segment";
      if (entry?.id === "treemap") return "Group";
      if (entry?.id === "grid-cartogram") return "Value";
      if (entry?.id === "link-chart") return "Color";
      if (entry?.id === "grouped-bar" || entry?.id === "multi-series-line") {
        return "Series";
      }
      return "Color";
    case "size":
      if (entry?.id === "dot-map") return "Size";
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
      return "Facet";
  }
}

function getFieldOrder(
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined
): ChartFieldKey[] {
  if (entry?.fields) {
    return Object.keys(entry.fields) as ChartFieldKey[];
  }

  switch (entry?.id ?? chartType) {
    case "world-choropleth":
    case "choropleth":
      return ["x", "y"];
    case "dot-map":
    case "geoPoint":
      return ["x", "y", "size", "color"];
    case "spike-map":
    case "spike":
      return ["x", "y", "length", "color"];
    case "arc-map":
    case "arc":
      return ["x", "y", "x2", "y2", "length", "color"];
    case "grid-cartogram":
    case "grid":
      return ["x", "y", "color", "label"];
    case "link-chart":
    case "link":
      return ["x", "y", "x2", "y2", "label", "color"];
    case "sankey-diagram":
      return ["x", "y", "size", "color"];
    default:
      return ["y", "x", "color", "size", "facet"];
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

function getColumnOptions(
  field: ChartFieldKey,
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  allColumns: ColumnInfo[],
  numericColumns: ColumnInfo[]
) {
  const numericOrAll = numericColumns.length > 0 ? numericColumns : allColumns;

  switch (entry?.id ?? chartType) {
    case "world-choropleth":
      return field === "y" ? numericOrAll : allColumns;
    case "dot-map":
      if (field === "x" || field === "y" || field === "size") return numericOrAll;
      return allColumns;
    case "spike-map":
    case "spike":
      if (field === "x" || field === "y" || field === "length") return numericOrAll;
      return allColumns;
    case "arc-map":
    case "arc":
      if (field === "x" || field === "y" || field === "x2" || field === "y2" || field === "length") {
        return numericOrAll;
      }
      return allColumns;
    case "sankey-diagram":
      if (field === "size") return numericOrAll;
      return allColumns;
    case "stacked-bar":
      if (field === "y") return numericOrAll;
      return allColumns;
    case "waffle-chart":
    case "waterfall-chart":
    case "treemap":
      if (field === "y") return numericOrAll;
      return allColumns;
    case "grid-cartogram":
      if (field === "color") return numericOrAll;
      return allColumns;
    case "link-chart":
    case "link":
      if (field === "x" || field === "y" || field === "x2" || field === "y2") {
        return numericOrAll;
      }
      return allColumns;
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

function toFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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

async function buildTreemapLeaves(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumn: string,
  width: number,
  height: number,
  groupColumn?: string
) {
  const d3 = await import("d3");
  const groupedValues = new Map<string, Map<string, number>>();
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
    const groupItems = groupedValues.get(groupKey) ?? new Map<string, number>();
    groupItems.set(itemKey, (groupItems.get(itemKey) ?? 0) + value);
    groupedValues.set(groupKey, groupItems);
  });

  if (groupedValues.size === 0) {
    return [];
  }

  const hierarchyData: TreemapDatum = {
    name: "root",
    children: Array.from(groupedValues.entries(), ([group, items]) => ({
      name: group,
      children: Array.from(items.entries(), ([label, value]) => ({ name: label, value })),
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
  };
  geometry: {
    type: string;
  } & Record<string, unknown>;
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
  } = config;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const columns = useMemo(() => upstreamNode?.result?.columns ?? [], [upstreamNode?.result?.columns]);
  const data = useMemo(() => upstreamNode?.result?.rows ?? [], [upstreamNode?.result?.rows]);
  const geometryColumn = useMemo(() => findGeometryColumn(columns), [columns]);
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
              marks.push(
                Plot.barY(
                  data,
                  Plot.groupX(
                    { y: "sum" },
                    {
                      x: xColumn,
                      y: yColumn,
                      fill: colorColumn,
                    } as Record<string, unknown>
                  )
                )
              );
              marks.push(Plot.ruleY([0]));
            }
            break;
          case "grouped-bar":
            if (yColumn && colorColumn && facetColumn) {
              showColorLegend = true;
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              marks.push(
                Plot.barY(data, {
                  x: colorColumn,
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
          case "waffle-chart":
            if (xColumn && yColumn) {
              showColorLegend = true;
              legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              showGrid = false;
              marks.push(
                Plot.waffleY(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || xColumn,
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
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
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
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
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
                  fillOpacity: 0.75,
                } as Record<string, unknown>)
              );
            }
            break;
          case "beeswarm":
            if (xColumn) {
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
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
              if (colorColumn) {
                showColorLegend = true;
                legendOptions = getCompactSwatchLegendOptions(plotSize.width);
              }
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
          case "world-choropleth":
            if (xColumn && yColumn) {
              showColorLegend = true;
              showGrid = false;
              plotOptions.marginTop = 8;
              plotOptions.marginRight = 8;
              plotOptions.marginBottom = 8;
              plotOptions.marginLeft = 8;
              plotOptions.color = { legend: true, scheme: "YlGnBu" };

              if (geometryColumn) {
                const features = buildGeometryFeatures(
                  data as Record<string, unknown>[],
                  geometryColumn,
                  xColumn,
                  yColumn
                );

                if (features.length > 0) {
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
                      strokeWidth: 0.5,
                      title: (feature: GeometryFeatureDatum) =>
                        feature.properties.value === null
                          ? feature.properties.label
                          : `${feature.properties.label}: ${feature.properties.value}`,
                    } as Record<string, unknown>)
                  );
                  break;
                }
              }

              const { countries, land } = await loadWorldAtlasFeatures();
              const valueLookup = buildCountryValueLookup(data as Record<string, unknown>[], xColumn, yColumn);
              plotOptions.projection = "equal-earth";
              marks.push(
                Plot.geo(land, {
                  fill: "#f8fafc",
                  stroke: "#cbd5e1",
                } as Record<string, unknown>)
              );
              marks.push(
                Plot.geo(countries, {
                  fill: (feature: { properties?: { name?: string } }) =>
                    valueLookup.get(normalizeGeoLookupKey(feature.properties?.name)),
                  stroke: "#ffffff",
                  strokeWidth: 0.5,
                  title: (feature: { properties?: { name?: string } }) => {
                    const name = feature.properties?.name ?? "Unknown";
                    const value = valueLookup.get(normalizeGeoLookupKey(name));
                    return value === undefined ? name : `${name}: ${value}`;
                  },
                } as Record<string, unknown>)
              );
              marks.push(Plot.sphere());
            }
            break;
          case "dot-map":
            if (xColumn && yColumn) {
              const { land } = await loadWorldAtlasFeatures();
              showColorLegend = Boolean(colorColumn);
              showGrid = false;
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
                Plot.dot(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn || BASE_CHART_COLOR,
                  r: sizeColumn || 3,
                  fillOpacity: 0.7,
                } as Record<string, unknown>)
              );
              marks.push(Plot.sphere());
            }
            break;
          case "spike-map":
          case "spike":
            if (xColumn && yColumn && lengthColumn) {
              const { land } = await loadWorldAtlasFeatures();
              showColorLegend = Boolean(colorColumn);
              showGrid = false;
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
                Plot.vector(data, {
                  x: xColumn,
                  y: yColumn,
                  length: lengthColumn,
                  rotate: 180,
                  anchor: "start",
                  stroke: colorColumn || BASE_CHART_COLOR,
                  strokeWidth: 1.5,
                  strokeOpacity: 0.8,
                } as Record<string, unknown>)
              );
              marks.push(Plot.sphere());
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
              const leaves = await buildTreemapLeaves(
                data as Record<string, unknown>[],
                xColumn,
                yColumn,
                plotSize.width,
                plotSize.height,
                colorColumn
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
              plotOptions.axis = null;
              marks.push(
                Plot.cell(data, {
                  x: xColumn,
                  y: yColumn,
                  fill: colorColumn,
                  inset: 2,
                } as Record<string, unknown>)
              );
              if (labelColumn) {
                marks.push(
                  Plot.text(data, {
                    x: xColumn,
                    y: yColumn,
                    text: labelColumn,
                    fontSize: 10,
                    fontWeight: 600,
                  } as Record<string, unknown>)
                );
              }
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
              const pieData = data.map((d: Record<string, unknown>) => ({
                label: String(d[xColumn]),
                value: Number(d[yColumn]) || 0,
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
        const resolvedColorOptions = variantColorOptions
          ? { ...variantColorOptions, ...(showColorLegend ? { legend: true } : {}) }
          : showColorLegend
            ? legendOptions ?? { legend: true }
            : undefined;
        const resolvedXAxisOptions = mergeAxisOptions(
          restPlotOptions.x,
          variantId === "grouped-bar"
            ? getFieldLabel("color", selectedCatalogEntry, chartType)
            : getAxisLabel("x", selectedCatalogEntry, chartType, xColumn, yColumn)
        );
        const resolvedYAxisOptions = mergeAxisOptions(
          restPlotOptions.y,
          getAxisLabel("y", selectedCatalogEntry, chartType, yColumn, xColumn)
        );
        const finalPlotOptions = {
          ...restPlotOptions,
          ...(resolvedXAxisOptions ? { x: resolvedXAxisOptions } : {}),
          ...(resolvedYAxisOptions ? { y: resolvedYAxisOptions } : {}),
        };

        const chart = Plot.plot({
          width: plotSize.width,
          height: plotSize.height,
          marginLeft:
            variantId === "horizontal-bar" || variantId === "barX" ? 110 : 52,
          marginBottom: 36,
          marks,
          grid: showGrid,
          ...(variantId === "faceted-histogram" ? { fy: { label: null } } : {}),
          ...(resolvedColorOptions ? { color: resolvedColorOptions } : {}),
          ...finalPlotOptions,
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
  const setupMessage = getChartSetupMessage(config, selectedCatalogEntry);

  const updateChartField = (
    field: keyof Pick<
      ChartConfig,
      "xColumn" | "yColumn" | "x2Column" | "y2Column" | "colorColumn" | "sizeColumn" | "lengthColumn" | "labelColumn" | "facetColumn"
    >,
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
              : "w-40 border-r border-gray-100 pr-2 opacity-100"
          }`}
          aria-hidden={isSidebarCollapsed}
        >
          <div className="subtle-scrollbar h-full min-h-0 overflow-y-auto pr-1">
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
                                updateNodeConfig(node.id, {
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
                className="chart-container min-h-[160px] flex-1 overflow-hidden rounded-lg bg-white p-2"
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
