import { NodeType, NodeConfig, QueryResult } from "@/types/nodes";

export interface DAGNode {
  id: string;
  type: NodeType;
  config: NodeConfig;
  inputIds: string[]; // IDs of upstream nodes
  result: QueryResult | null;
  status: "idle" | "running" | "success" | "error";
  error?: string;
  pageId: string;
}

export interface DAGEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  toInputIndex: number; // 0 for single-input nodes, 0/1 for join
}

export interface ExecutionContext {
  executeQuery: (sql: string) => Promise<QueryResult>;
  getNodeResult: (nodeId: string) => QueryResult | null;
  getNodeConfig: (nodeId: string) => NodeConfig | undefined;
  getNodeType: (nodeId: string) => NodeType | undefined;
  getUpstreamNodes: (nodeId: string) => string[];
}

export type NodeExecutor = (
  node: DAGNode,
  context: ExecutionContext
) => Promise<string>; // Returns SQL query string
