"use client";

import React, { useState, useCallback } from "react";
import { LuChartColumnBig, LuCopy, LuSquarePen } from "react-icons/lu";
import { getTablePreviewMinHeight, INITIAL_TABLE_VISIBLE_ROWS } from "@/lib/canvasLayout";
import { QueryResult, ColumnInfo } from "@/types/nodes";

interface ColumnContextMenu {
  col: string;
  x: number;
  y: number;
}

interface Props {
  result: QueryResult;
  maxRows?: number;
  onSort?: (column: string) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onCreateChart?: (column: string) => void;
  readOnly?: boolean;
  presentation?: boolean;
  fillAvailableHeight?: boolean;
  initialVisibleRows?: number;
}

function getColTypeIcon(type: string): { icon: string; cls: string } {
  if (/int|float|double|decimal|numeric|real|bigint/i.test(type)) return { icon: "#", cls: "col-type-badge col-type-num" };
  if (/date|timestamp|time/i.test(type)) return { icon: "📅", cls: "col-type-badge col-type-date" };
  if (/bool/i.test(type)) return { icon: "?", cls: "col-type-badge col-type-bool" };
  return { icon: "T", cls: "col-type-badge col-type-str" };
}

function isNumericType(type: string): boolean {
  return /int|float|double|decimal|numeric|real|bigint/i.test(type);
}

function isTextType(type: string): boolean {
  return /varchar|text|char|string|category/i.test(type) || (!isNumericType(type) && !/date|timestamp|time|bool/i.test(type));
}

function isDateType(type: string): boolean {
  return /date|timestamp|time/i.test(type);
}

/** Build mini sparkline: 10 bars from data distribution */
function buildSparkline(rows: Record<string, unknown>[], col: ColumnInfo): number[] {
  const vals = rows.map((r) => r[col.name]).filter((v) => v !== null && v !== undefined);
  if (vals.length === 0) return [];

  if (isNumericType(col.type)) {
    const nums = vals.map(Number).filter((n) => !isNaN(n));
    if (nums.length === 0) return [];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (min === max) return new Array(10).fill(1);
    const bins = new Array(10).fill(0);
    nums.forEach((n) => {
      const idx = Math.min(9, Math.floor(((n - min) / (max - min)) * 10));
      bins[idx]++;
    });
    const peak = Math.max(...bins);
    return bins.map((b) => (peak > 0 ? b / peak : 0));
  }
  return [];
}

/** Get top categories and their proportions */
function buildCategorySummary(rows: Record<string, unknown>[], colName: string): { label: string; count: number; pct: number }[] {
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    const v = String(r[colName] ?? "∅");
    counts[v] = (counts[v] || 0) + 1;
  });
  const total = rows.length;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count, pct: count / total }));
}

function countDistinctValues(rows: Record<string, unknown>[], colName: string) {
  return new Set(rows.map((row) => String(row[colName] ?? "∅"))).size;
}

function formatCompactCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export default function TablePreview({
  result,
  maxRows = 250,
  onSort,
  sortColumn,
  sortDirection,
  onCreateChart,
  readOnly = false,
  presentation = false,
  fillAvailableHeight = false,
  initialVisibleRows = INITIAL_TABLE_VISIBLE_ROWS,
}: Props) {
  const [colMenu, setColMenu] = useState<ColumnContextMenu | null>(null);

  const closeMenu = useCallback(() => setColMenu(null), []);

  if (!result || !result.columns || result.columns.length === 0) {
    return <div className="p-3 text-xs text-gray-400 text-center">No data</div>;
  }

  const previewRowLimit = fillAvailableHeight
    ? maxRows
    : Math.min(maxRows, initialVisibleRows);
  const rows = result.rows.slice(0, previewRowLimit);
  const initialPreviewHeight = getTablePreviewMinHeight(initialVisibleRows, !presentation);

  const formatValue = (val: unknown, colType: string): React.ReactNode => {
    if (val === null || val === undefined) return <span className="text-gray-300 italic text-[10px]">∅</span>;
    if (typeof val === "number") {
      if (Number.isInteger(val)) return val.toLocaleString();
      return val.toFixed(2);
    }
    if (typeof val === "boolean") return val ? "true" : "false";
    if (val instanceof Date) return val.toISOString().split("T")[0];
    const s = String(val);
    const display = s.length > 30 ? s.slice(0, 28) + "…" : s;
    // Highlight text/category values
    if (isTextType(colType)) {
      return <span className="category-chip">{display}</span>;
    }
    return display;
  };

  const handleColRightClick = (e: React.MouseEvent, colName: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setColMenu({ col: colName, x: e.clientX, y: e.clientY });
  };

  const visibleRowsLabel = result.totalRows > previewRowLimit
    ? `Showing ${previewRowLimit} of ${result.totalRows.toLocaleString()} rows`
    : `${result.totalRows.toLocaleString()} rows`;

  return (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden ${
        fillAvailableHeight ? "h-full min-h-0 flex-1" : ""
      }`}
      style={
        fillAvailableHeight
          ? undefined
          : {
              height: initialPreviewHeight,
              maxHeight: initialPreviewHeight,
            }
      }
      onClick={closeMenu}
    >
      <div className="subtle-scrollbar min-h-0 flex-1 overflow-auto">
        <table className="preview-table">
          <thead>
            <tr>
              {result.columns.map((col) => {
                const { icon, cls } = getColTypeIcon(col.type);
                return (
                  <th
                    key={col.name}
                    onClick={() => onSort?.(col.name)}
                    onContextMenu={(e) => handleColRightClick(e, col.name)}
                    className={`${onSort ? "cursor-pointer" : ""} ${sortColumn === col.name ? "sorted" : ""}`}
                  >
                    <div className="preview-header-top">
                      <span className={cls}>{icon}</span>
                      <span className="preview-header-name" title={col.name}>{col.name}</span>
                      {sortColumn === col.name && (
                        <span className="preview-header-sort">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                    {!presentation && (
                      <div className="preview-header-bottom">
                        {isNumericType(col.type) ? (
                          <>
                            {(() => {
                              const bars = buildSparkline(rows, col);
                              const numericCount = rows.filter((row) => row[col.name] !== null && row[col.name] !== undefined).length;
                              return (
                                <>
                                  {bars.length > 0 ? (
                                    <div className="mini-sparkline mini-sparkline--header">
                                      {bars.map((h, i) => (
                                        <div
                                          key={i}
                                          className="bar"
                                          style={{ height: `${Math.max(4, h * 18)}px` }}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="preview-header-empty">—</div>
                                  )}
                                  <div className="preview-header-meta">{formatCompactCount(numericCount)} values</div>
                                </>
                              );
                            })()}
                          </>
                        ) : isTextType(col.type) ? (
                          <>
                            {(() => {
                              const cats = buildCategorySummary(rows, col.name);
                              const topN = cats.slice(0, 2);
                              const distinctCount = countDistinctValues(rows, col.name);
                              return (
                                <>
                                  <div className="preview-chip-row">
                                    {topN.map((c) => (
                                      <span
                                        key={c.label}
                                        className="preview-chip"
                                        title={`${c.label}: ${c.count}`}
                                      >
                                        {c.label.slice(0, 14)}
                                      </span>
                                    ))}
                                    {distinctCount > topN.length && (
                                      <span className="preview-chip-more">+{distinctCount - topN.length}</span>
                                    )}
                                  </div>
                                  <div className="preview-header-meta">
                                    {formatCompactCount(distinctCount)} categories
                                  </div>
                                </>
                              );
                            })()}
                          </>
                        ) : isDateType(col.type) ? (
                          <div className="preview-header-meta">{formatCompactCount(rows.filter((row) => row[col.name]).length)} dates</div>
                        ) : (
                          <div className="preview-header-meta">{formatCompactCount(rows.filter((row) => row[col.name] !== null && row[col.name] !== undefined).length)} values</div>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>

          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {result.columns.map((col) => (
                  <td key={col.name}>
                    {formatValue(row[col.name], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        className={`border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400 ${
          presentation
            ? "bg-white text-right"
            : "flex items-center justify-between bg-gray-50"
        }`}
      >
        {presentation ? (
          <span>{visibleRowsLabel}</span>
        ) : (
          <>
            <span>{result.columns.length} columns</span>
            <span>{visibleRowsLabel}</span>
          </>
        )}
      </div>

      {/* Column context menu */}
      {colMenu && !readOnly && (
        <div
          className="context-menu fixed z-[1000]"
          style={{ left: colMenu.x, top: colMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="context-menu-item" onClick={() => { onSort?.(colMenu.col); closeMenu(); }}>
            <span>↑≡</span> Sort ascending
          </button>
          <button className="context-menu-item" onClick={() => { onSort?.(colMenu.col); closeMenu(); }}>
            <span>↓≡</span> Sort descending
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => { onCreateChart?.(colMenu.col); closeMenu(); }}>
            <LuChartColumnBig className="h-4 w-4" /> Create chart
            <span className="shortcut">⌘⇧K</span>
          </button>
          <button className="context-menu-item" onClick={closeMenu}>
            <LuSquarePen className="h-4 w-4" /> Add derived column
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => { navigator.clipboard?.writeText(colMenu.col); closeMenu(); }}>
            <LuCopy className="h-4 w-4" /> Copy column name
          </button>
        </div>
      )}
    </div>
  );
}
