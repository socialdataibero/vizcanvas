import { getToken } from "@/stores/authStore";
import {
  PersistedAppState,
  parsePersistedAppState,
} from "@/lib/persistence";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

export async function fetchRemoteCanvasState(): Promise<PersistedAppState | null> {
  const res = await fetch(`${API_BASE}/canvases/mine`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = (await res.json()) as { state?: unknown };
  if (!data.state) return null;
  return parsePersistedAppState(JSON.stringify(data.state));
}

export async function saveRemoteCanvasState(state: PersistedAppState): Promise<void> {
  const res = await fetch(`${API_BASE}/canvases/mine`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ state }),
  });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al guardar el canvas`);
  }
}
