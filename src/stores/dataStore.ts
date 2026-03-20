import { createStore, useStore } from "@/lib/createStore";
import { DataTable, ColumnStats } from "@/types/data";
import { exportTableData, getTables, getTableSchema, importTableData, initDuckDB } from "@/db/duckdb";
import { loadDataFile } from "@/db/fileLoader";
import { getColumnStats } from "@/db/queries";
import { readPersistedUploadedTables, writePersistedUploadedTables } from "@/lib/persistence";

interface DataState {
  tables: DataTable[];
  initialized: boolean;
  loading: boolean;
  error: string | null;
  columnStats: Record<string, ColumnStats[]>;

  initialize: () => Promise<void>;
  uploadFile: (file: File) => Promise<DataTable>;
  refreshTables: () => Promise<void>;
  loadColumnStats: (tableName: string) => Promise<void>;
}

const dataStore = createStore<DataState>((set, get) => ({
  tables: [],
  initialized: false,
  loading: false,
  error: null,
  columnStats: {},

  initialize: async () => {
    if (get().initialized) return;
    set({ loading: true, error: null });
    try {
      await initDuckDB();
      const persistedTables = readPersistedUploadedTables();
      const existingTables = new Set(await getTables());
      for (const table of persistedTables) {
        if (existingTables.has(table.name)) continue;
        await importTableData(table.name, table.rows, table.columns);
      }
      await get().refreshTables();
      set({ initialized: true, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  uploadFile: async (file: File) => {
    set({ loading: true, error: null });
    try {
      const table = await loadDataFile(file);
      const exported = await exportTableData(table.name);
      const persistedTables = readPersistedUploadedTables();
      writePersistedUploadedTables([
        ...persistedTables.filter((entry) => entry.name !== table.name),
        {
          name: table.name,
          columns: exported.columns,
          rowCount: exported.rowCount,
          rows: exported.rows,
          fileSize: table.fileSize,
          fileType: table.fileType,
        },
      ]);
      set((state) => ({
        tables: [...state.tables.filter((t) => t.name !== table.name), table],
        loading: false,
      }));
      return table;
    } catch (err) {
      set({ error: String(err), loading: false });
      throw err;
    }
  },

  refreshTables: async () => {
    try {
      const persistedTables = readPersistedUploadedTables();
      const tableNames = await getTables();
      const tables = await Promise.all(
        tableNames.map(async (name) => {
          const persisted = persistedTables.find((table) => table.name === name);
          return {
            name,
            columns: await getTableSchema(name),
            rowCount: persisted?.rowCount ?? 0,
            fileSize: persisted?.fileSize,
            fileType: persisted?.fileType,
          };
        })
      );
      set({ tables });
    } catch (err) {
      console.error("Failed to refresh tables:", err);
    }
  },

  loadColumnStats: async (tableName: string) => {
    const table = get().tables.find((t) => t.name === tableName);
    if (!table) return;

    const stats = (
      await Promise.allSettled(
        table.columns.map((col) => getColumnStats(tableName, col.name, col.type))
      )
    )
      .filter((result): result is PromiseFulfilledResult<ColumnStats> => result.status === "fulfilled")
      .map((result) => result.value);

    set((state) => ({
      columnStats: { ...state.columnStats, [tableName]: stats },
    }));
  },
}));

export function useDataStore<S>(selector: (state: DataState) => S): S {
  return useStore(dataStore, selector);
}

// Direct access for outside React
export const dataStoreApi = dataStore;
