import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyColumnSemanticsToColumns,
  getJoinSuggestions,
  inferColumnRole,
} from "@/lib/columnSemantics";
import { normalizeGeospatialObject } from "@/lib/geospatial";

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function parseCsvTable() {
  const [headerLine, ...lines] = readWorkspaceFile("geojson/dis_ent.csv").trim().split(/\r?\n/);
  const headers = headerLine.split(",");

  const columns = applyColumnSemanticsToColumns(headers.map((name) => ({
    name,
    type:
      name === "ENT" || /total/i.test(name)
        ? "BIGINT"
        : /porcentaje/i.test(name)
          ? "DOUBLE"
          : "VARCHAR",
    nullable: false,
  })));

  const rows = lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => {
      const raw = values[index];
      if (header === "ENT" || /total/i.test(header)) return [header, Number(raw)];
      if (/porcentaje/i.test(header)) return [header, Number(raw)];
      return [header, raw];
    }));
  });

  return { name: "dis_ent", columns, rows };
}

describe("column semantics", () => {
  it("infers map-related roles from column names", () => {
    expect(inferColumnRole("geometry", "VARCHAR")).toBe("geometry");
    expect(inferColumnRole("latitude", "DOUBLE")).toBe("latitude");
    expect(inferColumnRole("longitude", "DOUBLE")).toBe("longitude");
    expect(inferColumnRole("CVE_ENT", "VARCHAR")).toBe("join_key");
  });

  it("suggests join pairs for the provided geospatial fixtures", () => {
    const geoTable = {
      name: "states_simple",
      ...normalizeGeospatialObject(JSON.parse(readWorkspaceFile("geojson/states_simple.geojson"))),
    };
    const csvTable = parseCsvTable();
    const suggestions = getJoinSuggestions(geoTable.columns, geoTable.rows, csvTable.columns, csvTable.rows);

    expect(
      suggestions.some((s) => s.leftColumn === "NOMGEO" && s.rightColumn === "NOM_ENT")
    ).toBe(true);
    expect(
      suggestions.some((s) => s.leftColumn === "CVE_ENT" && s.rightColumn === "ENT")
    ).toBe(true);
  });
});
