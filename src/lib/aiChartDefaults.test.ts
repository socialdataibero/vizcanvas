import { describe, expect, it } from "vitest";
import { inferChartConfigDefaults } from "@/lib/aiChartDefaults";
import type { ChartConfig, ColumnInfo } from "@/types/nodes";

describe("inferChartConfigDefaults", () => {
  it("fills choropleth label and metric columns from geospatial results", () => {
    const columns: ColumnInfo[] = [
      { name: "NOMGEO", type: "VARCHAR", nullable: false, role: "join_key" },
      { name: "geometry", type: "VARCHAR", nullable: false, role: "geometry" },
      { name: "porcentaje_promedio", type: "DOUBLE", nullable: true },
    ];
    const config: ChartConfig = { chartType: "choropleth" };

    expect(inferChartConfigDefaults(config, columns)).toEqual({
      chartCatalogId: "world-choropleth",
      xColumn: "NOMGEO",
      yColumn: "porcentaje_promedio",
    });
  });

  it("fills grid cartogram axes, value, and label from explicit grid columns", () => {
    const columns: ColumnInfo[] = [
      { name: "grid_x", type: "INTEGER", nullable: false },
      { name: "grid_y", type: "INTEGER", nullable: false },
      { name: "pct_change", type: "DOUBLE", nullable: false },
      { name: "state", type: "VARCHAR", nullable: false, role: "join_key" },
    ];
    const config: ChartConfig = { chartType: "grid" };

    expect(inferChartConfigDefaults(config, columns)).toEqual({
      chartCatalogId: "grid-cartogram",
      xColumn: "grid_x",
      yColumn: "grid_y",
      colorColumn: "pct_change",
      labelColumn: "state",
    });
  });

  it("preserves already selected columns", () => {
    const columns: ColumnInfo[] = [
      { name: "region_name", type: "VARCHAR", nullable: false },
      { name: "value", type: "DOUBLE", nullable: false },
      { name: "geometry", type: "VARCHAR", nullable: false, role: "geometry" },
    ];
    const config: ChartConfig = {
      chartType: "choropleth",
      chartCatalogId: "world-choropleth",
      xColumn: "region_name",
    };

    expect(inferChartConfigDefaults(config, columns)).toEqual({
      yColumn: "value",
    });
  });

  it("fills spike map label and magnitude while skipping identifier codes", () => {
    const columns: ColumnInfo[] = [
      { name: "ENT", type: "INTEGER", nullable: false },
      { name: "NOM_ENT", type: "VARCHAR", nullable: false, role: "join_key" },
      { name: "geometry", type: "VARCHAR", nullable: false, role: "geometry" },
      { name: "porcentaje", type: "DOUBLE", nullable: false },
    ];
    const config: ChartConfig = { chartType: "spike" };

    expect(inferChartConfigDefaults(config, columns)).toEqual({
      chartCatalogId: "spike-map",
      xColumn: "NOM_ENT",
      lengthColumn: "porcentaje",
    });
  });

  it("fills generic chart x and y from categorical + numeric columns", () => {
    const columns: ColumnInfo[] = [
      { name: "discapacidad", type: "VARCHAR", nullable: false },
      { name: "discapacidad_total", type: "BIGINT", nullable: false },
      { name: "ENT", type: "INTEGER", nullable: false },
      { name: "porcentaje", type: "DOUBLE", nullable: false },
    ];
    const config: ChartConfig = { chartType: "dot", chartCatalogId: "beeswarm" };

    const result = inferChartConfigDefaults(config, columns);
    expect(result.xColumn).toBe("discapacidad_total");
    expect(result).not.toHaveProperty("yColumn");
  });

  it("fills generic bar chart x (categorical) and y (numeric)", () => {
    const columns: ColumnInfo[] = [
      { name: "category", type: "VARCHAR", nullable: false },
      { name: "total_personas", type: "BIGINT", nullable: false },
    ];
    const config: ChartConfig = { chartType: "bar" };

    const result = inferChartConfigDefaults(config, columns);
    expect(result.xColumn).toBe("category");
    expect(result.yColumn).toBe("total_personas");
  });

  it("does not overwrite already assigned columns for generic charts", () => {
    const columns: ColumnInfo[] = [
      { name: "category", type: "VARCHAR", nullable: false },
      { name: "total_personas", type: "BIGINT", nullable: false },
    ];
    const config: ChartConfig = { chartType: "bar", xColumn: "category" };

    const result = inferChartConfigDefaults(config, columns);
    expect(result).not.toHaveProperty("xColumn");
    expect(result.yColumn).toBe("total_personas");
  });

  it("fills bubble map label and size from geospatial results", () => {
    const columns: ColumnInfo[] = [
      { name: "CVE_ENT", type: "INTEGER", nullable: false },
      { name: "NOMGEO", type: "VARCHAR", nullable: false, role: "join_key" },
      { name: "geometry", type: "VARCHAR", nullable: false, role: "geometry" },
      { name: "total_discapacidad", type: "DOUBLE", nullable: false },
    ];
    const config: ChartConfig = { chartType: "geoPoint" };

    expect(inferChartConfigDefaults(config, columns)).toEqual({
      chartCatalogId: "dot-map",
      xColumn: "NOMGEO",
      sizeColumn: "total_discapacidad",
    });
  });
});
