import { useCallback } from "react";
import { dataStoreApi } from "@/stores/dataStore";
import { dagStoreApi } from "@/stores/dagStore";
import {
  buildSafeVizCanvasTitle,
  buildVizCanvasFile,
  parseVizCanvasFile,
  PersistedAppState,
  VIZCANVAS_FILE_EXTENSION,
  writePersistedUploadedTables,
} from "@/lib/persistence";
import { clearAllTables, exportTableData, importTableData } from "@/db/duckdb";

interface UseVizCanvasIOParams {
  title: string;
  buildCurrentPersistedState: () => PersistedAppState;
  applyPersistedState: (state: PersistedAppState) => void;
}

export function useVizCanvasIO({
  title,
  buildCurrentPersistedState,
  applyPersistedState,
}: UseVizCanvasIOParams) {
  const exportVizCanvas = useCallback(async () => {
    const currentTables = dataStoreApi.getState().tables;
    const exportedTables = await Promise.all(
      currentTables.map(async (table) => {
        const exported = await exportTableData(table.name);
        return {
          name: table.name,
          columns: exported.columns,
          rowCount: exported.rowCount,
          rows: exported.rows,
          fileSize: table.fileSize,
          fileType: table.fileType,
        };
      })
    );

    const file = buildVizCanvasFile(buildCurrentPersistedState(), exportedTables);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${buildSafeVizCanvasTitle(title)}${VIZCANVAS_FILE_EXTENSION}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [buildCurrentPersistedState, title]);

  const importVizCanvas = useCallback(async (file: File) => {
    const parsed = parseVizCanvasFile(await file.text());
    if (!parsed) {
      throw new Error("El archivo .vzc no es valido o no tiene un formato compatible.");
    }

    await clearAllTables();

    for (const table of parsed.data.tables) {
      await importTableData(table.name, table.rows, table.columns);
    }

    writePersistedUploadedTables(parsed.data.tables);

    dataStoreApi.setState({
      tables: parsed.data.tables.map((table) => ({
        name: table.name,
        columns: table.columns,
        rowCount: table.rowCount,
        fileSize: table.fileSize,
        fileType: table.fileType,
      })),
      loading: false,
      error: null,
      columnStats: {},
    });

    applyPersistedState(parsed.appState);
    await dagStoreApi.getState().executeAll();
  }, [applyPersistedState]);

  return {
    exportVizCanvas,
    importVizCanvas,
  };
}
