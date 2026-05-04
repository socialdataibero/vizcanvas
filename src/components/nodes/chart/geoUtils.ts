import { parseGeometryValue } from "@/lib/geospatial";
import { toFiniteNumber } from "./chartUtils";

export type GeometryFeatureDatum = {
  type: "Feature";
  properties: {
    label: string;
    value: number | null;
    group?: string | null;
  };
  geometry: { type: string } & Record<string, unknown>;
};

export function buildGeometryFeatures(
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
        label: row[labelColumn] === undefined || row[labelColumn] === null ? "Unknown" : String(row[labelColumn]),
        value: toFiniteNumber(row[valueColumn]),
      },
      geometry,
    }];
  });
}
