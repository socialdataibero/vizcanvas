"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useAuthStore, isTokenUsable, type AuthUser } from "@/stores/authStore";
import LoginPage from "@/components/auth/LoginPage";
import { v4 as uuidv4 } from "uuid";
import { buildPersistedAppState } from "@/lib/persistence";
import type { FromConfig, GroupConfig, SQLConfig, TableDisplayConfig, ColumnFilter, AggregationConfig } from "@/types/nodes";
import type { DAGNode, DAGEdge } from "@/engine/types";

function buildAnalysisPipeline(
  recipe: Record<string, unknown>,
  sourceTableName: string,
  _resultTableName: string
) {
  const pageId = uuidv4();
  const nodes: Record<string, DAGNode> = {};
  const edges: DAGEdge[] = [];
  const nodePositions: Record<string, { x: number; y: number }> = {};

  let x = 80;
  const y = 300;
  const gap = 480;
  let prevId: string | null = null;

  function addNode(node: DAGNode, pos: { x: number; y: number }) {
    nodes[node.id] = node;
    nodePositions[node.id] = pos;
  }

  function connect(fromId: string, toId: string) {
    const edgeId = uuidv4();
    edges.push({ id: edgeId, fromNodeId: fromId, toNodeId: toId, toInputIndex: 0 });
    nodes[toId] = { ...nodes[toId], inputIds: [...nodes[toId].inputIds, fromId] };
  }

  type RawFilter = { column: string; operator: string; value: unknown };
  const rawFilters = (recipe.filters as RawFilter[]) ?? [];
  const fromFilters: ColumnFilter[] = rawFilters.map((f) => ({
    column: f.column,
    operator: f.operator as ColumnFilter["operator"],
    value: f.value,
  }));

  const fromId = uuidv4();
  addNode({
    id: fromId, type: "from",
    config: { tableName: sourceTableName, filters: fromFilters } as FromConfig,
    inputIds: [], result: null, status: "idle", pageId,
  }, { x, y });
  prevId = fromId;
  x += gap;

  type RawCompute = { left: string; right: string; as: string };
  const computes = (recipe.computes as RawCompute[]) ?? [];

  if (computes.length > 0) {
    const cols = computes.map((c) => `"${c.left}" * "${c.right}" AS "${c.as}"`).join(", ");
    const sqlId = uuidv4();
    addNode({
      id: sqlId, type: "sql",
      config: { query: `SELECT *, ${cols} FROM input`, autoRun: true } as SQLConfig,
      inputIds: [], result: null, status: "idle", pageId,
    }, { x, y });
    connect(prevId!, sqlId);
    prevId = sqlId;
    x += gap;
  }
  const groupByCols = (recipe.group_by as string[]) ?? [];
  type RawAgg = { func: string; column?: string; as?: string };
  const rawAggs = (recipe.aggregates as RawAgg[]) ?? [];
  const SUPPORTED_FUNCS = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

  if (groupByCols.length > 0 || rawAggs.length > 0) {
    const aggregations: AggregationConfig[] = rawAggs
      .filter((a) => SUPPORTED_FUNCS.has((a.func ?? "").toUpperCase()))
      .map((a) => ({
        function: a.func.toUpperCase() as AggregationConfig["function"],
        column: (a.column === "*" || !a.column) ? (groupByCols[0] ?? undefined) : a.column,
        alias: a.as,
      }));

    const groupId = uuidv4();
    addNode({
      id: groupId, type: "group",
      config: {
        groupByColumns: groupByCols,
        aggregations,
        configVersion: 1,
        lastRunVersion: 1,
      } as GroupConfig,
      inputIds: [], result: null, status: "idle", pageId,
    }, { x, y });
    connect(prevId!, groupId);
    prevId = groupId;
    x += gap;
  }

  type RawSort = { column: string; dir: string };
  const sorts = (recipe.sort as RawSort[]) ?? [];
  const limit = recipe.limit as number | null | undefined;

  if (sorts.length > 0 || limit != null) {
    const orderPart = sorts.length > 0
      ? ` ORDER BY ${sorts.map((s) => `"${s.column}" ${s.dir.toUpperCase()}`).join(", ")}`
      : "";
    const limitPart = limit != null ? ` LIMIT ${limit}` : "";
    const sqlId = uuidv4();
    addNode({
      id: sqlId, type: "sql",
      config: { query: `SELECT * FROM input${orderPart}${limitPart}`, autoRun: true } as SQLConfig,
      inputIds: [], result: null, status: "idle", pageId,
    }, { x, y });
    connect(prevId!, sqlId);
    prevId = sqlId;
    x += gap;
  }

  const tableId = uuidv4();
  addNode({
    id: tableId, type: "table",
    config: { hiddenColumns: [] } as TableDisplayConfig,
    inputIds: [], result: null, status: "idle", pageId,
  }, { x, y });
  connect(prevId!, tableId);

  const state = buildPersistedAppState({
    nodePositions,
    canvas: {
      id: uuidv4(),
      title: `Análisis — ${sourceTableName}`,
      pages: [{ id: pageId, name: "Análisis", order: 0 }],
      currentPageId: pageId,
      focusMode: false,
    },
    dag: { nodes, edges },
  });
  sessionStorage.setItem("vizcanvas-handoff", JSON.stringify(state));
  console.log("[handoff] pipeline written to sessionStorage:", Object.keys(nodes).length, "nodes");
}

const CanvasApp = dynamic(() => import("@/components/canvas/CanvasApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-gray-500">Loading VizCanvas...</p>
      </div>
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const [status, setStatus] = useState<"idle" | "auth" | "import" | "done">("idle");
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const handoffProcessedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handoff = params.get("handoff");
    const ckanUrl = params.get("ckan_url");

    if (!handoff || !ckanUrl) return;

    if (handoffProcessedRef.current) return;
    handoffProcessedRef.current = true;
    const existingToken = isTokenUsable(token) ? token : null;

    setStatus("auth");

    fetch(`${API_BASE}/users/ckan-sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoffToken: handoff, ckanUrl }),
    })
      .then(async (res) => {
        const data = await res.json() as { token?: string; message?: string[]; ckanDownloadToken?: string; user?: AuthUser };
        console.log("[handoff] ckan-sign-in status:", res.status, "body:", data, "sesión activa:", !!existingToken);
        if (!res.ok || !data.token) {
          if (!existingToken) {
            const msg = Array.isArray(data.message) ? data.message[0] : (data.message ?? `Error ${res.status}`);
            setHandoffError(String(msg));
            setStatus("idle");
            return;
          }
          console.warn("[handoff] no se pudo consumir el token de CKAN; se continúa con la sesión activa");
        }
        const sessionToken = existingToken ?? data.token!;

        const resourceUrl = params.get("resource_url");
        const resourceName = params.get("resource_name");
        const resourceFormat = params.get("resource_format") ?? "csv";
        const sourceResourceUrl = params.get("source_resource_url");
        const sourceResourceName = params.get("source_resource_name");
        const pipelineB64 = params.get("pipeline");
        console.log("[handoff] resource_url:", resourceUrl, "source:", sourceResourceUrl, "pipeline:", !!pipelineB64);
        window.history.replaceState({}, "", window.location.pathname);

        setStatus("import");

        if (resourceUrl && resourceName) {
          try {
            const importRes = await fetch(`${API_BASE}/tables/import-from-url`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({
                url: resourceUrl,
                tableName: resourceName,
                format: resourceFormat,
                ckanToken: data.ckanDownloadToken ?? "",
              }),
            });
            if (!importRes.ok) {
              const errBody = await importRes.json().catch(() => ({})) as { message?: string };
              console.warn("[handoff] import result failed:", importRes.status, errBody);
            } else {
              const importData = await importRes.json() as { tableName?: string; rowCount?: number; skipped?: boolean };
              console.log(importData.skipped ? "[handoff] result al ready exists, not imported:" : "[handoff] import result ok:", importData);
            }
          } catch (e) {
            console.warn("[handoff] import result network error:", e);
          }
        }

        if (sourceResourceUrl && sourceResourceName) {
          try {
            const srcRes = await fetch(`${API_BASE}/tables/import-from-url`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({
                url: sourceResourceUrl,
                tableName: sourceResourceName,
                format: "parquet",
                ckanToken: data.ckanDownloadToken ?? "",
              }),
            });
            if (srcRes.ok) {
              const srcData = await srcRes.json() as { tableName?: string; skipped?: boolean };
              console.log(srcData.skipped ? "[handoff] source already exists, not reimported:" : "[handoff] import source ok:", srcData);
            }
          } catch (e) {
            console.warn("[handoff] import source network error:", e);
          }
        }

        if (pipelineB64 && sourceResourceName) {
          try {
            const standardB64 = pipelineB64.replace(/-/g, "+").replace(/_/g, "/");
            const recipe = JSON.parse(atob(standardB64)) as Record<string, unknown>;
            console.log("[handoff] recipe keys:", Object.keys(recipe));
            buildAnalysisPipeline(recipe, sourceResourceName, resourceName ?? "resultado");
          } catch (e) {
            console.warn("[handoff] could not build pipeline from recipe:", e);
          }
        }

        if (!existingToken && data.token) {
          setSession(data.token, data.user ?? null, "ckan");
        }
        setStatus("done");
      })
      .catch((e) => {
        console.error("[handoff] network error:", e);
        setHandoffError("cannot complete handoff due to network error");
        setStatus("idle");
      });
  }, [token, setSession]);

  if (status === "auth") return <Spinner label="Autenticando con CKAN..." />;
  if (status === "import") return <Spinner label="Importando datos desde CKAN..." />;

  if (handoffError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-red-600">{handoffError}</p>
          <button
            onClick={() => setHandoffError(null)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  if (!token) return <LoginPage />;
  return <CanvasApp />;
}
