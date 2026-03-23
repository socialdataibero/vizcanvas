import { DataTable } from "@/types/data";
import { ColumnInfo } from "@/types/nodes";

export interface TableWithRows extends Pick<DataTable, "name" | "columns"> {
  rows?: Record<string, unknown>[];
}

export interface JoinSuggestion {
  leftColumn: string;
  rightColumn: string;
  score: number;
  sharedValueCount: number;
  sampleCoverage: number;
  reason: string;
}

export interface SuggestedMapFlow {
  geoTableName: string;
  dataTableName: string;
  join: JoinSuggestion;
}

const COLUMN_ROLE_LABELS: Record<NonNullable<ColumnInfo["role"]>, string> = {
  geometry: "Geo",
  latitude: "Lat",
  longitude: "Lon",
  join_key: "Key",
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalizeToken(token: string): string {
  if (/^(nom|nombre|name|label)$/.test(token)) return "name";
  if (/^(geo|geography|spatial|shape)$/.test(token)) return "geo";
  if (/^(ent|entity|entidad|state|province|region|country|county|district|municipio|mun|dept|department)$/.test(token)) {
    return "region";
  }
  if (/^(cve|code|codigo|clave|key|id|iso|fips|abbr)$/.test(token)) return "code";
  if (/^(lat|latitude)$/.test(token)) return "lat";
  if (/^(lon|lng|long|longitude)$/.test(token)) return "lon";
  return token;
}

function tokenizeIdentifier(name: string): string[] {
  return normalizeText(name)
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalizeToken);
}

function normalizeJoinValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    return normalized.replace(/^0+/, "") || "0";
  }

  return normalized;
}

function isNumericType(type: string): boolean {
  return /int|decimal|double|float|real|numeric|number|hugeint|bigint|smallint|tinyint|uinteger|ubigint|usmallint|utinyint/i.test(type);
}

function isJoinCandidate(column: ColumnInfo): boolean {
  return column.role !== "geometry" && column.role !== "latitude" && column.role !== "longitude";
}

function getSampleValueSet(rows: Record<string, unknown>[] | undefined, columnName: string): Set<string> {
  const values = new Set<string>();
  if (!rows) return values;

  for (const row of rows.slice(0, 250)) {
    const normalizedValue = normalizeJoinValue(row[columnName]);
    if (normalizedValue) {
      values.add(normalizedValue);
    }
  }

  return values;
}

function scoreColumnNameMatch(leftColumn: ColumnInfo, rightColumn: ColumnInfo): number {
  const leftNormalized = normalizeText(leftColumn.name).replace(/\s+/g, "");
  const rightNormalized = normalizeText(rightColumn.name).replace(/\s+/g, "");

  if (leftNormalized === rightNormalized && leftNormalized) {
    return 35;
  }

  if (
    leftNormalized &&
    rightNormalized &&
    (leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized))
  ) {
    return 20;
  }

  const leftTokens = tokenizeIdentifier(leftColumn.name);
  const rightTokens = tokenizeIdentifier(rightColumn.name);
  const sharedTokens = leftTokens.filter((token) => rightTokens.includes(token));

  let score = sharedTokens.length * 8;

  if (leftTokens.includes("name") && rightTokens.includes("name")) {
    score += 8;
  }

  if (leftTokens.includes("code") && rightTokens.includes("code")) {
    score += 5;
  }

  if (leftColumn.role === "join_key" && rightColumn.role === "join_key") {
    score += 6;
  }

  return score;
}

function buildJoinReason(sharedValueCount: number, sampleCoverage: number, nameScore: number): string {
  if (sharedValueCount > 0) {
    return `${sharedValueCount} shared sample values · ${Math.round(sampleCoverage * 100)}% overlap`;
  }

  if (nameScore >= 35) return "matching column names";
  if (nameScore >= 16) return "similar key columns";
  return "possible join keys";
}

export function inferColumnRole(name: string, type: string): ColumnInfo["role"] | undefined {
  const normalizedName = normalizeText(name);
  const tokens = tokenizeIdentifier(name);

  if (/(^| )(geometry|geom|geojson|topojson|shape)( |$)/.test(normalizedName)) {
    return "geometry";
  }

  if (isNumericType(type) && tokens.includes("lat")) {
    return "latitude";
  }

  if (isNumericType(type) && tokens.includes("lon")) {
    return "longitude";
  }

  if (
    tokens.includes("name") ||
    tokens.includes("code") ||
    /(^| )(id|key)( |$)/.test(normalizedName)
  ) {
    return "join_key";
  }

  return undefined;
}

export function applyColumnSemantics(column: ColumnInfo): ColumnInfo {
  const role = column.role ?? inferColumnRole(column.name, column.type);
  return role ? { ...column, role } : column;
}

export function applyColumnSemanticsToColumns(columns: ColumnInfo[]): ColumnInfo[] {
  return columns.map(applyColumnSemantics);
}

export function getColumnRoleLabel(role: ColumnInfo["role"]): string | null {
  if (!role) return null;
  return COLUMN_ROLE_LABELS[role] ?? null;
}

export function formatColumnDisplayName(column: ColumnInfo): string {
  const roleLabel = getColumnRoleLabel(column.role);
  return roleLabel ? `[${roleLabel}] ${column.name}` : column.name;
}

export function hasGeometryColumn(columns: ColumnInfo[]): boolean {
  return columns.some((column) => applyColumnSemantics(column).role === "geometry");
}

export function getJoinSuggestions(
  leftColumns: ColumnInfo[],
  leftRows: Record<string, unknown>[] | undefined,
  rightColumns: ColumnInfo[],
  rightRows: Record<string, unknown>[] | undefined
): JoinSuggestion[] {
  const normalizedLeftColumns = applyColumnSemanticsToColumns(leftColumns).filter(isJoinCandidate);
  const normalizedRightColumns = applyColumnSemanticsToColumns(rightColumns).filter(isJoinCandidate);

  const suggestions = normalizedLeftColumns.flatMap((leftColumn) =>
    normalizedRightColumns.map((rightColumn) => {
      const nameScore = scoreColumnNameMatch(leftColumn, rightColumn);
      const leftValues = getSampleValueSet(leftRows, leftColumn.name);
      const rightValues = getSampleValueSet(rightRows, rightColumn.name);
      const sharedValueCount = Array.from(leftValues).filter((value) => rightValues.has(value)).length;
      const sampleCoverage =
        leftValues.size > 0 && rightValues.size > 0
          ? sharedValueCount / Math.min(leftValues.size, rightValues.size)
          : 0;

      const score = nameScore + sampleCoverage * 70;
      if (score < 12) {
        return null;
      }

      return {
        leftColumn: leftColumn.name,
        rightColumn: rightColumn.name,
        score,
        sharedValueCount,
        sampleCoverage,
        reason: buildJoinReason(sharedValueCount, sampleCoverage, nameScore),
      };
    })
  ).filter((suggestion): suggestion is JoinSuggestion => Boolean(suggestion));

  return suggestions
    .sort((left, right) =>
      right.score - left.score ||
      right.sharedValueCount - left.sharedValueCount ||
      left.leftColumn.localeCompare(right.leftColumn) ||
      left.rightColumn.localeCompare(right.rightColumn)
    )
    .slice(0, 5);
}

export function getSuggestedMapFlows(
  tables: TableWithRows[],
  selectedTableName?: string
): SuggestedMapFlow[] {
  const normalizedTables = tables.map((table) => ({
    ...table,
    columns: applyColumnSemanticsToColumns(table.columns),
  }));

  const geospatialTables = normalizedTables.filter((table) => hasGeometryColumn(table.columns));
  const dataTables = normalizedTables.filter((table) => !hasGeometryColumn(table.columns));

  const candidateGeoTables = selectedTableName
    ? geospatialTables.filter((table) => table.name === selectedTableName)
    : geospatialTables;
  const candidateDataTables = selectedTableName
    ? dataTables.filter((table) => table.name === selectedTableName)
    : dataTables;

  const flows: SuggestedMapFlow[] = [];

  if (candidateGeoTables.length > 0) {
    for (const geoTable of candidateGeoTables) {
      for (const dataTable of normalizedTables.filter((table) => table.name !== geoTable.name && !hasGeometryColumn(table.columns))) {
        const suggestion = getJoinSuggestions(geoTable.columns, geoTable.rows, dataTable.columns, dataTable.rows)[0];
        if (!suggestion) continue;
        flows.push({
          geoTableName: geoTable.name,
          dataTableName: dataTable.name,
          join: suggestion,
        });
      }
    }
  } else if (candidateDataTables.length > 0) {
    for (const dataTable of candidateDataTables) {
      for (const geoTable of geospatialTables.filter((table) => table.name !== dataTable.name)) {
        const suggestion = getJoinSuggestions(geoTable.columns, geoTable.rows, dataTable.columns, dataTable.rows)[0];
        if (!suggestion) continue;
        flows.push({
          geoTableName: geoTable.name,
          dataTableName: dataTable.name,
          join: suggestion,
        });
      }
    }
  }

  return flows.sort((left, right) => right.join.score - left.join.score);
}
