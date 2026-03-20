/** Escape a string value for safe interpolation into SQL single-quoted literals. */
export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}
