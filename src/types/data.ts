import { ColumnInfo } from "./nodes";

export interface DataSource {
  tables: DataTable[];
  initialized: boolean;
}

export interface DataTable {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  fileSize?: number;
  fileType?: string;
}

export interface ColumnStats {
  column: string;
  type: string;
  nullCount: number;
  distinctCount: number;
  // Numeric stats
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  // Categorical stats
  topValues?: { value: string; count: number }[];
  // Histogram bins
  histogram?: { bin: string; count: number }[];
}
