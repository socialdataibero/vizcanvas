import { loadFile, getTableSchema, getTables } from "./duckdb";
import { DataTable } from "@/types/data";

export function resolveUploadedTableName(baseName: string, existing: string[]): string {
  if (baseName === "sample_data") {
    return "sample_data";
  }

  let name = baseName;
  let suffix = 1;
  while (existing.includes(name)) {
    name = `${baseName}_${suffix}`;
    suffix++;
  }
  return name;
}

async function getUniqueTableName(baseName: string): Promise<string> {
  return resolveUploadedTableName(baseName, await getTables());
}

export async function loadDataFile(file: File): Promise<DataTable> {
  // Generate table name from filename (remove extension, sanitize)
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  const tableName = await getUniqueTableName(baseName || "uploaded_data");

  const { columns, rowCount } = await loadFile(file, tableName);

  return {
    name: tableName,
    columns,
    rowCount,
    fileSize: file.size,
    fileType: file.name.split(".").pop()?.toLowerCase(),
  };
}

export async function loadMultipleFiles(
  files: FileList | File[]
): Promise<DataTable[]> {
  const settled = await Promise.allSettled(
    Array.from(files).map(async (file) => ({
      file,
      table: await loadDataFile(file),
    }))
  );

  return settled.flatMap((result) => {
    if (result.status === "fulfilled") {
      return [result.value.table];
    }
    console.error("Failed to load file:", result.reason);
    return [];
  });
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function isSupported(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ["csv", "tsv", "parquet", "json", "jsonl", "geojson", "topojson"].includes(ext);
}
