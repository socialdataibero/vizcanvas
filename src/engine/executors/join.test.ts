import { describe, expect, it } from "vitest";
import { executeJoin } from "./join";
import type { DAGNode, ExecutionContext } from "../types";
import type { JoinConfig, QueryResult } from "@/types/nodes";

function makeResult(columnNames: string[]): QueryResult {
  return {
    columns: columnNames.map((name) => ({ name, type: "VARCHAR", nullable: true })),
    rows: [],
    totalRows: 0,
    sql: "",
  };
}

function makeContext(results: Record<string, QueryResult>): ExecutionContext {
  return {
    executeQuery: async () => makeResult([]),
    getNodeResult: (id) => results[id] ?? null,
    getNodeConfig: () => undefined,
    getNodeType: () => undefined,
    getUpstreamNodes: () => Object.keys(results),
  };
}

function makeJoinNode(config: JoinConfig): DAGNode {
  return {
    id: "join-1",
    type: "join",
    config,
    inputIds: [],
    result: null,
    status: "idle",
    pageId: "page-1",
  };
}

describe("executeJoin", () => {
  it("no duplica la columna de cruce cuando ambos lados la comparten (ej: appid)", async () => {
    const context = makeContext({
      left: makeResult(["appid", "name", "price"]),
      right: makeResult(["appid", "positive", "negative"]),
    });
    const node = makeJoinNode({ joinType: "INNER", leftColumn: "appid", rightColumn: "appid" });

    const sql = await executeJoin(node, context);
    const selectList = sql.split(" FROM ")[0];
    expect(selectList).toContain('"_node_left"."appid"');
    expect(selectList).not.toContain('"_node_right"."appid"');
    expect(sql).toContain('ON "_node_left"."appid" = "_node_right"."appid"');
  });

  it("conserva una columna no-llave repetida en ambos lados, con sufijo _right", async () => {
    const context = makeContext({
      left: makeResult(["id", "name"]),
      right: makeResult(["id", "name"]),
    });
    const node = makeJoinNode({ joinType: "LEFT", leftColumn: "id", rightColumn: "id" });

    const sql = await executeJoin(node, context);

    expect(sql).toContain('"_node_left"."name"');
    expect(sql).toContain('"_node_right"."name" AS "name_right"');
  });

  it("columnas sin conflicto de nombre pasan igual, sin sufijo", async () => {
    const context = makeContext({
      left: makeResult(["folio", "ingreso"]),
      right: makeResult(["folio", "factor"]),
    });
    const node = makeJoinNode({ joinType: "INNER", leftColumn: "folio", rightColumn: "folio" });

    const sql = await executeJoin(node, context);

    expect(sql).toContain('"_node_right"."factor"');
    expect(sql).not.toContain("factor_right");
  });

  it("sigue fallando igual que antes si falta alguna conexión o columna de cruce", async () => {
    const emptyContext: ExecutionContext = {
      executeQuery: async () => makeResult([]),
      getNodeResult: () => null,
      getNodeConfig: () => undefined,
      getNodeType: () => undefined,
      getUpstreamNodes: () => ["only-one"],
    };
    const node = makeJoinNode({ joinType: "INNER", leftColumn: "a", rightColumn: "b" });

    await expect(executeJoin(node, emptyContext)).rejects.toThrow(
      "Join node requires two input connections"
    );
  });
});
