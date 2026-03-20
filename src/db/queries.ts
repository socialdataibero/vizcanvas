import { executeQuery } from "./duckdb";
import { ColumnStats } from "@/types/data";

function escId(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export async function getColumnStats(
  tableName: string,
  columnName: string,
  columnType: string
): Promise<ColumnStats> {
  const isNumeric = /int|float|double|decimal|numeric|real|bigint|smallint|tinyint/i.test(
    columnType
  );
  const isDate = /date|timestamp|time/i.test(columnType);

  const col = escId(columnName);
  const tbl = escId(tableName);

  const baseStats = await executeQuery(`
    SELECT
      COUNT(*) - COUNT(${col}) as null_count,
      COUNT(DISTINCT ${col}) as distinct_count
    FROM ${tbl}
  `);

  const stats: ColumnStats = {
    column: columnName,
    type: columnType,
    nullCount: Number(baseStats.rows[0]?.null_count ?? 0),
    distinctCount: Number(baseStats.rows[0]?.distinct_count ?? 0),
  };

  if (isNumeric) {
    const numStats = await executeQuery(`
      SELECT
        MIN(${col}) as min_val,
        MAX(${col}) as max_val,
        AVG(${col}) as mean_val,
        MEDIAN(${col}) as median_val
      FROM ${tbl}
    `);

    stats.min = Number(numStats.rows[0]?.min_val);
    stats.max = Number(numStats.rows[0]?.max_val);
    stats.mean = Number(numStats.rows[0]?.mean_val);
    stats.median = Number(numStats.rows[0]?.median_val);

    // Histogram
    const histResult = await executeQuery(`
      SELECT
        CASE WHEN bucket IS NOT NULL
          THEN CONCAT(ROUND(bucket, 2), ' - ', ROUND(bucket + step, 2))
          ELSE 'NULL'
        END as bin,
        count as count
      FROM (
        SELECT
          width_bucket(${col},
            (SELECT MIN(${col}) FROM ${tbl}),
            (SELECT MAX(${col}) FROM ${tbl}) + 0.001,
            10
          ) as bucket_num,
          (SELECT MIN(${col}) FROM ${tbl}) +
            (width_bucket(${col},
              (SELECT MIN(${col}) FROM ${tbl}),
              (SELECT MAX(${col}) FROM ${tbl}) + 0.001,
              10
            ) - 1) * ((SELECT MAX(${col}) - MIN(${col}) FROM ${tbl}) / 10.0) as bucket,
          (SELECT (MAX(${col}) - MIN(${col})) / 10.0 FROM ${tbl}) as step,
          COUNT(*) as count
        FROM ${tbl}
        WHERE ${col} IS NOT NULL
        GROUP BY bucket_num, bucket, step
        ORDER BY bucket_num
      )
    `).catch(() => ({ rows: [], columns: [], totalRows: 0, sql: "" }));

    stats.histogram = histResult.rows.map((r) => ({
      bin: String(r.bin),
      count: Number(r.count),
    }));
  } else if (!isDate) {
    // Categorical - top values
    const topResult = await executeQuery(`
      SELECT ${col} as value, COUNT(*) as count
      FROM ${tbl}
      WHERE ${col} IS NOT NULL
      GROUP BY ${col}
      ORDER BY count DESC
      LIMIT 10
    `);

    stats.topValues = topResult.rows.map((r) => ({
      value: String(r.value),
      count: Number(r.count),
    }));
  }

  return stats;
}
