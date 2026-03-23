import { feature as topojsonFeature } from "topojson-client";
import { ColumnInfo } from "@/types/nodes";
import { applyColumnSemanticsToColumns } from "@/lib/columnSemantics";

type GeoGeometry = {
  type: string;
  coordinates?: unknown;
  geometries?: unknown[];
};

type GeoFeature = {
  type: "Feature";
  id?: unknown;
  properties?: Record<string, unknown> | null;
  geometry?: GeoGeometry | null;
};

type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

type Topology = {
  type: "Topology";
  objects: Record<string, unknown>;
};

type FlattenedFeature = {
  feature: GeoFeature;
  topologyObject?: string;
};

export interface NormalizedGeospatialTable {
  columns: ColumnInfo[];
  rowCount: number;
  rows: Record<string, unknown>[];
}

const RESERVED_COLUMN_ORDER = ["feature_id", "geometry", "geometry_type", "topology_object"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGeoFeature(value: unknown): value is GeoFeature {
  return isRecord(value) && value.type === "Feature";
}

function isGeoFeatureCollection(value: unknown): value is GeoFeatureCollection {
  return isRecord(value) && value.type === "FeatureCollection" && Array.isArray(value.features);
}

function isTopology(value: unknown): value is Topology {
  return isRecord(value) && value.type === "Topology" && isRecord(value.objects);
}

function coerceCellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") return Number(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function inferValueType(values: unknown[]): string {
  type ValueType = "BOOLEAN" | "BIGINT" | "DOUBLE" | "VARCHAR";

  let type: ValueType | null = null;

  for (const value of values) {
    if (value === null || value === undefined) continue;

    let nextType: ValueType;
    switch (typeof value) {
      case "boolean":
        nextType = "BOOLEAN";
        break;
      case "number":
        nextType = Number.isInteger(value) ? "BIGINT" : "DOUBLE";
        break;
      default:
        nextType = "VARCHAR";
        break;
    }

    if (type === null || type === nextType) {
      type = nextType;
      continue;
    }

    if ((type === "BIGINT" && nextType === "DOUBLE") || (type === "DOUBLE" && nextType === "BIGINT")) {
      type = "DOUBLE";
      continue;
    }

    type = "VARCHAR";
  }

  return type ?? "VARCHAR";
}

function buildNormalizedTable(features: FlattenedFeature[]): NormalizedGeospatialTable {
  if (features.length === 0) {
    throw new Error("No geographic features were found in this file.");
  }

  const propertyColumnOrder: string[] = [];
  const rows = features.map(({ feature, topologyObject }) => {
    const row: Record<string, unknown> = {};
    const properties = isRecord(feature.properties) ? feature.properties : {};

    Object.entries(properties).forEach(([key, value]) => {
      if (!propertyColumnOrder.includes(key) && !RESERVED_COLUMN_ORDER.includes(key)) {
        propertyColumnOrder.push(key);
      }
      row[key] = coerceCellValue(value);
    });

    row.feature_id = coerceCellValue(feature.id);
    row.geometry = feature.geometry ? JSON.stringify(feature.geometry) : null;
    row.geometry_type = feature.geometry?.type ?? null;
    if (topologyObject) {
      row.topology_object = topologyObject;
    }

    return row;
  });

  const columnNames = [
    ...propertyColumnOrder,
    ...RESERVED_COLUMN_ORDER.filter((columnName) =>
      rows.some((row) => Object.prototype.hasOwnProperty.call(row, columnName))
    ),
  ];

  const finalizedRows = rows.map((row) =>
    Object.fromEntries(
      columnNames.map((columnName) => [
        columnName,
        Object.prototype.hasOwnProperty.call(row, columnName) ? row[columnName] : null,
      ])
    )
  );

  const columns = applyColumnSemanticsToColumns(columnNames.map((name) => ({
    name,
    type: inferValueType(finalizedRows.map((row) => row[name])),
    nullable: finalizedRows.some((row) => row[name] === null),
  })));

  return {
    columns,
    rowCount: finalizedRows.length,
    rows: finalizedRows,
  };
}

export function isGeospatialExtension(ext: string | undefined): boolean {
  return ext === "geojson" || ext === "topojson";
}

export function normalizeGeospatialObject(input: unknown): NormalizedGeospatialTable {
  if (isGeoFeatureCollection(input)) {
    return buildNormalizedTable(input.features.map((feature) => ({ feature })));
  }

  if (isGeoFeature(input)) {
    return buildNormalizedTable([{ feature: input }]);
  }

  if (isTopology(input)) {
    const flattenedFeatures = Object.entries(input.objects).flatMap(([objectName, objectValue]) => {
      const converted = topojsonFeature(input as never, objectValue as never) as unknown;

      if (isGeoFeatureCollection(converted)) {
        return converted.features.map((feature) => ({
          feature,
          topologyObject: objectName,
        }));
      }

      if (isGeoFeature(converted)) {
        return [{
          feature: converted,
          topologyObject: objectName,
        }];
      }

      return [];
    });

    return buildNormalizedTable(flattenedFeatures);
  }

  throw new Error("Unsupported geospatial JSON. Expected GeoJSON FeatureCollection/Feature or TopoJSON Topology.");
}

export function findGeometryColumn(columns: Array<Pick<ColumnInfo, "name">>): string | null {
  const preferred = columns.find((column) => /^(geometry|geom|geojson)$/i.test(column.name));
  if (preferred) return preferred.name;

  const fallback = columns.find((column) => /geometry|geojson/i.test(column.name));
  return fallback?.name ?? null;
}

export function parseGeometryValue(value: unknown): GeoGeometry | null {
  if (value === null || value === undefined) return null;

  if (isRecord(value) && typeof value.type === "string") {
    return value as GeoGeometry;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) && typeof parsed.type === "string" ? parsed as GeoGeometry : null;
  } catch {
    return null;
  }
}
