import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyColumnSemanticsToColumns,
  getJoinSuggestions,
  getSuggestedMapFlows,
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

  return {
    name: "dis_ent",
    columns,
    rows,
  };
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
      suggestions.some((suggestion) =>
        suggestion.leftColumn === "NOMGEO" &&
        suggestion.rightColumn === "NOM_ENT"
      )
    ).toBe(true);
    expect(
      suggestions.some((suggestion) =>
        suggestion.leftColumn === "CVE_ENT" &&
        suggestion.rightColumn === "ENT"
      )
    ).toBe(true);
  });

  it("builds a suggested map flow between the geo table and the tabular table", () => {
    const geoTable = {
      name: "states_simple",
      ...normalizeGeospatialObject(JSON.parse(readWorkspaceFile("geojson/states_simple.geojson"))),
    };
    const csvTable = parseCsvTable();
    const flow = getSuggestedMapFlows([geoTable, csvTable], "states_simple")[0];

    expect(flow).toBeDefined();
    expect(flow?.geoTableName).toBe("states_simple");
    expect(flow?.dataTableName).toBe("dis_ent");
    expect(flow?.join.score).toBeGreaterThan(40);
  });

  it("ranks multiple map-flow candidates so the strongest match appears first", () => {
    const geoTable = {
      name: "states_simple",
      ...normalizeGeospatialObject(JSON.parse(readWorkspaceFile("geojson/states_simple.geojson"))),
    };
    const csvTable = parseCsvTable();
    const alternateTable = {
      name: "subset_states",
      columns: applyColumnSemanticsToColumns([
        { name: "NOM_ENT", type: "VARCHAR", nullable: false },
        { name: "value", type: "DOUBLE", nullable: false },
      ]),
      rows: [
        { NOM_ENT: "Aguascalientes", value: 10 },
        { NOM_ENT: "Baja California", value: 20 },
      ],
    };

    const flows = getSuggestedMapFlows([geoTable, alternateTable, csvTable], "states_simple");

    expect(flows.length).toBeGreaterThan(1);
    expect(flows[0]?.dataTableName).toBe("dis_ent");
    expect(flows[1]?.dataTableName).toBe("subset_states");
  });
});
