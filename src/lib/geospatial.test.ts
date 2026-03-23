import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import countriesAtlas from "world-atlas/countries-110m.json";
import {
  findGeometryColumn,
  normalizeGeospatialObject,
  parseGeometryValue,
} from "@/lib/geospatial";

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("normalizeGeospatialObject", () => {
  it("flattens the sample GeoJSON into joinable rows with serialized geometry", () => {
    const geojson = JSON.parse(readWorkspaceFile("geojson/states_simple.geojson"));
    const normalized = normalizeGeospatialObject(geojson);

    expect(normalized.rowCount).toBe(32);
    expect(findGeometryColumn(normalized.columns)).toBe("geometry");
    expect(normalized.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["CVE_ENT", "NOMGEO", "geometry", "geometry_type"])
    );
    expect(parseGeometryValue(normalized.rows[0]?.geometry)?.type).toBe("Polygon");
  });

  it("keeps the sample CSV compatible with the GeoJSON for an equality join on names", () => {
    const geojson = JSON.parse(readWorkspaceFile("geojson/states_simple.geojson"));
    const normalized = normalizeGeospatialObject(geojson);
    const geoNames = new Set(
      normalized.rows
        .map((row) => row.NOMGEO)
        .filter((value): value is string => typeof value === "string")
    );

    const [headerLine, ...lines] = readWorkspaceFile("geojson/dis_ent.csv").trim().split(/\r?\n/);
    const headers = headerLine.split(",");
    const nameIndex = headers.indexOf("NOM_ENT");
    const csvNames = Array.from(new Set(lines.map((line) => line.split(",")[nameIndex])));

    expect(csvNames).toHaveLength(32);
    expect(csvNames.every((name) => geoNames.has(name))).toBe(true);
  });

  it("converts TopoJSON objects into feature rows that stay joinable", () => {
    const normalized = normalizeGeospatialObject(countriesAtlas);

    expect(normalized.rowCount).toBeGreaterThan(150);
    expect(normalized.columns.map((column) => column.name)).toContain("topology_object");
    expect(normalized.rows.some((row) => row.topology_object === "countries")).toBe(true);
    expect(typeof normalized.rows[0]?.geometry).toBe("string");
  });
});
