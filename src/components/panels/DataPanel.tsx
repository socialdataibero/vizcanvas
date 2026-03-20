"use client";

import React, { useRef, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { isSupported } from "@/db/fileLoader";
import { formatBytes } from "@/lib/utils";

interface Props {
  onAddFromNode: (tableName: string) => void;
}

function ColTypeIcon({ type }: { type: string }) {
  if (/int|float|double|decimal|numeric|real|bigint/i.test(type))
    return <span className="col-type-badge col-type-num">#</span>;
  if (/date|timestamp|time/i.test(type))
    return <span className="col-type-badge col-type-date" style={{ fontSize: 7 }}>T</span>;
  if (/bool/i.test(type))
    return <span className="col-type-badge col-type-bool">?</span>;
  return <span className="col-type-badge col-type-str">T</span>;
}

export default function DataPanel({ onAddFromNode }: Props) {
  const tables = useDataStore((s) => s.tables);
  const uploadFile = useDataStore((s) => s.uploadFile);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    const inputFiles = Array.from(files);
    const unsupported = inputFiles.filter((f) => !isSupported(f.name));
    const supported = inputFiles.filter((f) => isSupported(f.name));
    if (unsupported.length > 0) alert(`Unsupported: ${unsupported.map((f) => f.name).join(", ")}`);
    if (supported.length === 0) return;
    setUploading(true);
    try {
      const failed = (await Promise.allSettled(supported.map((f) => uploadFile(f)))).filter((r) => r.status === "rejected");
      if (failed.length > 0) alert(`Failed to load ${failed.length} file(s).`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filteredTables = tables.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="panel w-64 max-h-[calc(100vh-120px)] overflow-hidden flex flex-col"
      onDrop={async (e) => { e.preventDefault(); e.stopPropagation(); await processFiles(e.dataTransfer.files); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
        <span className="text-xs font-semibold text-gray-700">Data</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50"
        >
          {uploading ? <span className="animate-spin text-xs inline-block">↻</span> : <span>+</span>}
          Upload
        </button>
        <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.tsv,.json,.jsonl,.parquet" multiple onChange={handleFileChange} />
      </div>

      {/* Search */}
      {tables.length > 0 && (
        <div className="px-2 py-1.5 border-b border-gray-50">
          <input
            type="text"
            placeholder="Search tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-gray-100 bg-gray-50 px-2 py-1 text-xs outline-none focus:border-teal-300 focus:bg-white"
          />
        </div>
      )}

      {/* Tables */}
      <div className="flex-1 overflow-y-auto py-1">
        {tables.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center px-4">
            <div className="text-3xl">📂</div>
            <p className="text-xs text-gray-500">Drop CSV, JSON, or Parquet files here</p>
            <button
              onClick={async () => {
                setUploading(true);
                try {
                  const res = await fetch("/sample_data.csv");
                  const blob = await res.blob();
                  await uploadFile(new File([blob], "sample_data.csv", { type: "text/csv" }));
                } catch (err) { console.error(err); }
                setUploading(false);
              }}
              disabled={uploading}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: "#14b8a6" }}
            >
              {uploading ? "Loading…" : "📊 Load Sample Data"}
            </button>
          </div>
        ) : (
          <div className="px-2 space-y-0.5">
            {/* Source badge */}
            <div className="flex items-center gap-1.5 px-1 py-1 mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: "#14b8a6" }}>DuckDB</span>
              <span className="text-[10px] text-gray-400">{tables.length} table{tables.length !== 1 ? "s" : ""}</span>
            </div>

            {filteredTables.map((table) => (
              <div key={table.name} className="rounded-lg border border-gray-100 overflow-hidden">
                <div
                  className="group flex items-center gap-1.5 px-2 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                >
                  <span className="text-gray-400 text-[9px] flex-shrink-0">
                    {expandedTable === table.name ? "▾" : "▸"}
                  </span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">⊞</span>
                  <span className="text-xs font-medium text-gray-800 truncate flex-1">{table.name}</span>
                  <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {table.columns.length}c
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddFromNode(table.name); }}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-white transition-opacity"
                    style={{ background: "#14b8a6" }}
                  >
                    +
                  </button>
                </div>

                {expandedTable === table.name && (
                  <div className="border-t border-gray-50 bg-gray-50/50">
                    {table.columns.map((col) => (
                      <div key={col.name} className="flex items-center gap-1.5 px-3 py-1 hover:bg-gray-100">
                        <ColTypeIcon type={col.type} />
                        <span className="text-[11px] text-gray-700 truncate flex-1">{col.name}</span>
                        <span className="text-[9px] text-gray-400 font-mono truncate max-w-[55px]">
                          {col.type.split("(")[0].toLowerCase()}
                        </span>
                      </div>
                    ))}
                    {table.fileSize && (
                      <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400 flex gap-1">
                        <span>{formatBytes(table.fileSize)}</span>
                        <span>·</span>
                        <span className="uppercase">{table.fileType}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {filteredTables.length === 0 && search && (
              <div className="py-4 text-center text-xs text-gray-400">No tables match &quot;{search}&quot;</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
