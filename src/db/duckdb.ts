import * as duckdb from "@duckdb/duckdb-wasm";
import { ColumnInfo, QueryResult } from "@/types/nodes";
import { applyColumnSemanticsToColumns } from "@/lib/columnSemantics";
import { isGeospatialExtension, normalizeGeospatialObject } from "@/lib/geospatial";

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<void> | null = null;

export async function initDuckDB(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
        mvp: {
          mainModule: "/duckdb/duckdb-mvp.wasm",
          mainWorker: "/duckdb/duckdb-browser-mvp.worker.js",
        },
        eh: {
          mainModule: "/duckdb/duckdb-eh.wasm",
          mainWorker: "/duckdb/duckdb-browser-eh.worker.js",
        },
      };

      const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.VoidLogger();
      db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      conn = await db.connect();
      await conn.query("SET memory_limit='8000MB'");

    } catch (err) {
      console.error("[DuckDB] Failed to initialize:", err);
      db = null;
      conn = null;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!conn) {
    await initDuckDB();
  }
  return conn!;
}

export async function getDB(): Promise<duckdb.AsyncDuckDB> {
  if (!db) {
    await initDuckDB();
  }
  return db!;
}

function escapeSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeDuckDBType(type: string | undefined): string {
  if (!type) return "VARCHAR";

  const normalized = type.trim().toLowerCase();

  if (/^date/.test(normalized)) return "DATE";
  if (/^timestamp/.test(normalized)) return "TIMESTAMP";
  if (/^(utf8|string|varchar|text|largeutf8|uuid)/.test(normalized)) return "VARCHAR";
  if (/^(bool|boolean)/.test(normalized)) return "BOOLEAN";
  if (/^(float64|double|double precision|real)/.test(normalized)) return "DOUBLE";
  if (/^(float32|float)/.test(normalized)) return "FLOAT";
  if (/^(int64|bigint|hugeint)/.test(normalized)) return "BIGINT";
  if (/^(int32|integer|int)/.test(normalized)) return "INTEGER";
  if (/^(int16|smallint)/.test(normalized)) return "SMALLINT";
  if (/^(int8|tinyint)/.test(normalized)) return "TINYINT";
  if (/^(uint64|ubigint)/.test(normalized)) return "UBIGINT";
  if (/^(uint32|uinteger)/.test(normalized)) return "UINTEGER";
  if (/^(uint16|usmallint)/.test(normalized)) return "USMALLINT";
  if (/^(uint8|utinyint)/.test(normalized)) return "UTINYINT";
  if (/^(decimal|numeric)/.test(normalized)) return type.toUpperCase();
  if (/^(json|struct|map|list|array)/.test(normalized)) return "JSON";
  if (/^(blob|binary|varbinary)/.test(normalized)) return "BLOB";

  return "VARCHAR";
}

function convertArrowValue(val: unknown, colType?: string): unknown {
  if (val === null || val === undefined) return null;
  // Handle Date/Timestamp columns (Date32<DAY>, Timestamp<MICROSECOND>, etc.)
  const isDateCol = colType && /date/i.test(colType) && !/timestamp/i.test(colType);
  const isTimestampCol = colType && /timestamp/i.test(colType);
  if (isDateCol || isTimestampCol) {
    if (val instanceof Date) {
      return isDateCol ? val.toISOString().slice(0, 10) : val.toISOString();
    }
    const raw = typeof val === "bigint" ? Number(val) : typeof val === "number" ? val : null;
    if (raw !== null) {
      // DuckDB timestamps are in microseconds; Date expects milliseconds
      const ms = isTimestampCol ? raw / 1000 : raw;
      const d = new Date(ms);
      return isDateCol ? d.toISOString().slice(0, 10) : d.toISOString();
    }
  }
  if (typeof val === "bigint") return Number(val);
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && val !== null) {
    if ("toString" in val && typeof val.toString === "function") {
      const s = val.toString();
      const n = Number(s);
      return isNaN(n) ? s : n;
    }
    return String(val);
  }
  return val;
}

export async function executeQuery(sql: string): Promise<QueryResult> {
  const connection = await getConnection();
  const result = await connection.query(sql);

  const columns: ColumnInfo[] = applyColumnSemanticsToColumns(
    result.schema.fields.map((field) => ({
      name: field.name,
      type: field.type.toString(),
      nullable: field.nullable,
    }))
  );

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < result.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const colData = result.getChild(col.name);
      row[col.name] = convertArrowValue(colData?.get(i), col.type);
    }
    rows.push(row);
  }

  return {
    columns,
    rows,
    totalRows: result.numRows,
    sql,
  };
}

export async function executeQueryLimited(
  sql: string,
  limit: number = 250
): Promise<QueryResult> {
  // Wrap in a subquery with limit for preview
  const limitedSql = `SELECT * FROM (${sql}) AS _q LIMIT ${limit}`;
  const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS _q`;

  const [dataResult, countResult] = await Promise.all([
    executeQuery(limitedSql),
    executeQuery(countSql).catch(() => null),
  ]);

  const totalRows =
    countResult && countResult.rows[0]
      ? Number(countResult.rows[0].total)
      : dataResult.totalRows;

  return {
    ...dataResult,
    totalRows,
    sql,
  };
}

export async function loadFile(
  file: File,
  tableName: string
): Promise<{ columns: ColumnInfo[]; rowCount: number }> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (isGeospatialExtension(ext)) {
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(await file.text());
    } catch (error) {
      throw new Error(
        `Invalid ${ext?.toUpperCase()} file: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const normalizedTable = normalizeGeospatialObject(parsedContent);
    return importTableData(tableName, normalizedTable.rows, normalizedTable.columns);
  }

  const database = await getDB();
  const connection = await getConnection();

  // Register file in DuckDB virtual filesystem
  const buffer = await file.arrayBuffer();
  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  await database.registerFileBuffer(fileName, new Uint8Array(buffer));

  // Determine file type and create table
  let createSql: string;

  switch (ext) {
    case "csv":
    case "tsv":
      createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv('${fileName}', auto_detect=true, header=true)`;
      break;
    case "parquet":
      createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_parquet('${fileName}')`;
      break;
    case "json":
    case "jsonl":
      createSql = `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json('${fileName}', auto_detect=true)`;
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }

  await connection.query(createSql);

  // Get schema
  const schema = await getTableSchema(tableName);
  const countResult = await connection.query(
    `SELECT COUNT(*) as cnt FROM "${tableName}"`
  );
  const rowCount = Number(countResult.getChild("cnt")?.get(0)) || 0;

  return { columns: schema, rowCount };
}

export async function getTableSchema(
  tableName: string
): Promise<ColumnInfo[]> {
  const connection = await getConnection();
  const result = await connection.query(`DESCRIBE "${tableName}"`);

  const columns: ColumnInfo[] = [];
  for (let i = 0; i < result.numRows; i++) {
    columns.push({
      name: String(result.getChild("column_name")?.get(i)),
      type: String(result.getChild("column_type")?.get(i)),
      nullable: result.getChild("null")?.get(i) === "YES",
    });
  }
  return applyColumnSemanticsToColumns(columns);
}

export async function getTables(): Promise<string[]> {
  const connection = await getConnection();
  const result = await connection.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
  );

  const tables: string[] = [];
  for (let i = 0; i < result.numRows; i++) {
    tables.push(String(result.getChild("table_name")?.get(i)));
  }
  return tables;
}

export async function exportTableData(tableName: string): Promise<{
  columns: ColumnInfo[];
  rowCount: number;
  rows: Record<string, unknown>[];
}> {
  const result = await executeQuery(`SELECT * FROM ${escapeSqlIdentifier(tableName)}`);
  return {
    columns: result.columns,
    rowCount: result.totalRows,
    rows: result.rows,
  };
}

export async function clearAllTables(): Promise<void> {
  const connection = await getConnection();
  const tableNames = await getTables();

  for (const tableName of tableNames) {
    await connection.query(`DROP TABLE IF EXISTS ${escapeSqlIdentifier(tableName)}`);
  }
}

export async function dropTable(tableName: string): Promise<void> {
  const connection = await getConnection();
  await connection.query(`DROP TABLE IF EXISTS ${escapeSqlIdentifier(tableName)}`);
}

export async function importTableData(
  tableName: string,
  rows: Record<string, unknown>[],
  columns: ColumnInfo[]
): Promise<{ columns: ColumnInfo[]; rowCount: number }> {
  const database = await getDB();
  const connection = await getConnection();
  const safeTableName = escapeSqlIdentifier(tableName);

  await connection.query(`DROP TABLE IF EXISTS ${safeTableName}`);

  if (rows.length === 0) {
    const columnSql = columns
      .map((column) => `${escapeSqlIdentifier(column.name)} ${normalizeDuckDBType(column.type)}`)
      .join(", ");

    await connection.query(`CREATE TABLE ${safeTableName} (${columnSql})`);
    return {
      columns: await getTableSchema(tableName),
      rowCount: 0,
    };
  }

  const fileName = `vizcanvas_${tableName}_${Date.now()}.json`;
  const buffer = new TextEncoder().encode(JSON.stringify(rows));
  await database.registerFileBuffer(fileName, buffer);

  const selectSql = columns
    .map((column) => {
      const columnName = escapeSqlIdentifier(column.name);
      const columnType = normalizeDuckDBType(column.type);
      return `CAST(${columnName} AS ${columnType}) AS ${columnName}`;
    })
    .join(", ");

  await connection.query(
    `CREATE TABLE ${safeTableName} AS SELECT ${selectSql} FROM read_json(${escapeSqlLiteral(fileName)}, auto_detect=true)`
  );

  return {
    columns: await getTableSchema(tableName),
    rowCount: rows.length,
  };
}
