import type { Graph } from "@/core/types";

let cached: { graph: Graph; expiresAt: number } | null = null;
const TTL_MS = 5_000;

export function getCached(): Graph | null {
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    cached = null;
    return null;
  }
  return cached.graph;
}

export function setCached(g: Graph) {
  cached = { graph: g, expiresAt: Date.now() + TTL_MS };
}

export function invalidate() {
  cached = null;
}
