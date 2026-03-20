export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function truncateString(str: string, maxLen: number = 30): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export function getNodeTypeColor(type: string): string {
  const colors: Record<string, string> = {
    from: "#6366f1",
    sql: "#8b5cf6",
    group: "#ec4899",
    join: "#f59e0b",
    chart: "#10b981",
    table: "#3b82f6",
    distinct: "#14b8a6",
    javascript: "#f97316",
    controls: "#06b6d4",
  };
  return colors[type] || "#6366f1";
}

export function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    from: "Source",
    sql: "Custom SQL",
    group: "Group by + Summarize",
    join: "Join tables",
    chart: "Make chart",
    table: "View table",
    distinct: "Remove duplicates",
    javascript: "JavaScript",
    controls: "Interactive filter",
  };
  return labels[type] || type;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
