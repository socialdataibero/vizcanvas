import { describe, expect, it } from "vitest";
import { getChartCatalogEntry } from "@/lib/chartCatalog";
import { getIncompatibleChartConfigPatch } from "@/lib/chartFields";
import type { ChartConfig, ColumnInfo } from "@/types/nodes";

describe("getIncompatibleChartConfigPatch", () => {
  it("clears numeric color encodings from vertical bars", () => {
    const columns: ColumnInfo[] = [
      { name: "NOMGEO", type: "VARCHAR", nullable: false },
      { name: "porcentaje", type: "DOUBLE", nullable: false },
      { name: "grupo", type: "VARCHAR", nullable: false },
    ];
    const config: ChartConfig = {
      chartType: "bar",
      chartCatalogId: "vertical-bar",
      xColumn: "NOMGEO",
      yColumn: "porcentaje",
      colorColumn: "porcentaje",
    };

    expect(
      getIncompatibleChartConfigPatch(
        config,
        getChartCatalogEntry(config.chartCatalogId, config.chartType),
        columns
      )
    ).toEqual({
      colorColumn: undefined,
    });
  });

  it("keeps numeric color encodings for grid cartograms", () => {
    const columns: ColumnInfo[] = [
      { name: "grid_x", type: "INTEGER", nullable: false },
      { name: "grid_y", type: "INTEGER", nullable: false },
      { name: "porcentaje", type: "DOUBLE", nullable: false },
    ];
    const config: ChartConfig = {
      chartType: "grid",
      chartCatalogId: "grid-cartogram",
      xColumn: "grid_x",
      yColumn: "grid_y",
      colorColumn: "porcentaje",
    };

    expect(
      getIncompatibleChartConfigPatch(
        config,
        getChartCatalogEntry(config.chartCatalogId, config.chartType),
        columns
      )
    ).toEqual({});
  });

  it("clears fields that are not used by the selected chart", () => {
    const columns: ColumnInfo[] = [
      { name: "estado", type: "VARCHAR", nullable: false },
      { name: "valor", type: "DOUBLE", nullable: false },
      { name: "serie", type: "VARCHAR", nullable: false },
    ];
    const config: ChartConfig = {
      chartType: "bar",
      chartCatalogId: "vertical-bar",
      xColumn: "estado",
      yColumn: "valor",
      facetColumn: "serie",
    };

    expect(
      getIncompatibleChartConfigPatch(
        config,
        getChartCatalogEntry(config.chartCatalogId, config.chartType),
        columns
      )
    ).toEqual({
      facetColumn: undefined,
    });
  });

  it("keeps categorical band and group fields for normalized strip charts", () => {
    const columns: ColumnInfo[] = [
      { name: "population", type: "DOUBLE", nullable: false },
      { name: "age", type: "VARCHAR", nullable: false },
      { name: "state", type: "VARCHAR", nullable: false },
    ];
    const config: ChartConfig = {
      chartType: "dot",
      chartCatalogId: "barcode-strip-plot",
      xColumn: "population",
      yColumn: "age",
      colorColumn: "state",
    };

    expect(
      getIncompatibleChartConfigPatch(
        config,
        getChartCatalogEntry(config.chartCatalogId, config.chartType),
        columns
      )
    ).toEqual({});
  });
});
