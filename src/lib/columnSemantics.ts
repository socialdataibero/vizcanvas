import { DataTable } from "@/types/data";
import { ColumnInfo } from "@/types/nodes";

// ─── Shared types (also used by DataPanel, CanvasApp, dataStore) ─────────────

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

// ─── Column role inference (pure, no data needed) ─────────────────────────────

const COLUMN_ROLE_LABELS: Record<NonNullable<ColumnInfo["role"]>, string> = {
  geometry: "Geo",
  latitude: "Lat",
  longitude: "Lon",
  join_key: "Key",
};

function isNumericType(type: string): boolean {
  return /int|decimal|double|float|real|numeric|number|hugeint|bigint|smallint|tinyint|uinteger|ubigint|usmallint|utinyint/i.test(type);
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalizeToken(token: string): string {
  if (/^(lat|latitude)$/.test(token)) return "lat";
  if (/^(lon|lng|long|longitude)$/.test(token)) return "lon";
  return token;
}

function tokenizeIdentifier(name: string): string[] {
  return normalizeText(name).split(/\s+/).filter(Boolean).map(canonicalizeToken);
}

export function inferColumnRole(name: string, type: string): ColumnInfo["role"] | undefined {
  const normalizedName = normalizeText(name);
  const tokens = tokenizeIdentifier(name);

  if (/(^| )(geometry|geom|geojson|topojson|shape)( |$)/.test(normalizedName)) return "geometry";
  if (isNumericType(type) && tokens.includes("lat")) return "latitude";
  if (isNumericType(type) && tokens.includes("lon")) return "longitude";
  if (tokens.includes("name") || tokens.includes("code") || tokens.includes("cve") || tokens.includes("cod") || /(^| )(id|key)( |$)/.test(normalizedName)) return "join_key";
  return undefined;
}

export function applyColumnSemantics(column: ColumnInfo): ColumnInfo {
  const role = column.role ?? inferColumnRole(column.name, column.type);
  return role ? { ...column, role } : column;
}

// Server already sets roles; this is a client-side fallback for query results.
export function applyColumnSemanticsToColumns(columns: ColumnInfo[]): ColumnInfo[] {
  return columns.map(applyColumnSemantics);
}

// ─── Join suggestions on in-memory rows (used by JoinNode) ───────────────────

function normalizeJoinValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  if (!normalized) return null;
  return /^\d+$/.test(normalized) ? (normalized.replace(/^0+/, "") || "0") : normalized;
}

function isJoinCandidate(column: ColumnInfo): boolean {
  return column.role !== "geometry" && column.role !== "latitude" && column.role !== "longitude";
}

function getSampleValueSet(rows: Record<string, unknown>[] | undefined, columnName: string): Set<string> {
  const values = new Set<string>();
  if (!rows) return values;
  for (const row of rows.slice(0, 250)) {
    const v = normalizeJoinValue(row[columnName]);
    if (v) values.add(v);
  }
  return values;
}

function scoreColumnNameMatch(left: ColumnInfo, right: ColumnInfo): number {
  const ln = normalizeText(left.name).replace(/\s+/g, "");
  const rn = normalizeText(right.name).replace(/\s+/g, "");
  if (ln === rn && ln) return 35;
  if (ln && rn && (ln.includes(rn) || rn.includes(ln))) return 20;
  const lt = tokenizeIdentifier(left.name);
  const rt = tokenizeIdentifier(right.name);
  const shared = lt.filter((t) => rt.includes(t));
  let score = shared.length * 8;
  if (lt.includes("name") && rt.includes("name")) score += 8;
  if (lt.includes("code") && rt.includes("code")) score += 5;
  if (left.role === "join_key" && right.role === "join_key") score += 6;
  return score;
}

function buildJoinReason(shared: number, coverage: number, nameScore: number): string {
  if (shared > 0) return `${shared} shared sample values · ${Math.round(coverage * 100)}% overlap`;
  if (nameScore >= 35) return "matching column names";
  if (nameScore >= 16) return "similar key columns";
  return "possible join keys";
}

export function getJoinSuggestions(
  leftColumns: ColumnInfo[],
  leftRows: Record<string, unknown>[] | undefined,
  rightColumns: ColumnInfo[],
  rightRows: Record<string, unknown>[] | undefined,
): JoinSuggestion[] {
  const lc = applyColumnSemanticsToColumns(leftColumns).filter(isJoinCandidate);
  const rc = applyColumnSemanticsToColumns(rightColumns).filter(isJoinCandidate);

  const suggestions = lc.flatMap((l) =>
    rc.map((r) => {
      const nameScore = scoreColumnNameMatch(l, r);
      const lv = getSampleValueSet(leftRows, l.name);
      const rv = getSampleValueSet(rightRows, r.name);
      const sharedValueCount = Array.from(lv).filter((v) => rv.has(v)).length;
      const sampleCoverage = lv.size > 0 && rv.size > 0
        ? sharedValueCount / Math.min(lv.size, rv.size) : 0;
      const score = nameScore + sampleCoverage * 70;
      if (score < 12) return null;
      return { leftColumn: l.name, rightColumn: r.name, score, sharedValueCount, sampleCoverage, reason: buildJoinReason(sharedValueCount, sampleCoverage, nameScore) } satisfies JoinSuggestion;
    }),
  ).filter((s): s is JoinSuggestion => s !== null);

  return suggestions
    .sort((a, b) => b.score - a.score || b.sharedValueCount - a.sharedValueCount || a.leftColumn.localeCompare(b.leftColumn))
    .slice(0, 5);
}

// ─── Display helpers ───────────────────────────────────────────────────────────

export function getColumnRoleLabel(role: ColumnInfo["role"]): string | null {
  if (!role) return null;
  return COLUMN_ROLE_LABELS[role] ?? null;
}

export function formatColumnDisplayName(column: ColumnInfo): string {
  const roleLabel = getColumnRoleLabel(column.role);
  return roleLabel ? `[${roleLabel}] ${column.name}` : column.name;
}

export function hasGeometryColumn(columns: ColumnInfo[]): boolean {
  return columns.some((c) => applyColumnSemantics(c).role === "geometry");
}
