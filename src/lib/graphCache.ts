import path from "node:path";
import type { ArtifactNode } from "@/core/types";
import type { GraphPayload } from "@/core/entities";
import { crawl } from "@/core/discovery";
import { buildPayload } from "@/core/graph/transform";
import { resolveHomePaths } from "@/core/paths";

interface CacheEntry {
  payload: GraphPayload;
  nodes: ArtifactNode[];
  expiresAt: number;
}

let cached: CacheEntry | null = null;
const TTL_MS = 5_000;

export function getCachedPayload(): GraphPayload | null {
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    cached = null;
    return null;
  }
  return cached.payload;
}

export function getCachedNodes(): ArtifactNode[] | null {
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    cached = null;
    return null;
  }
  return cached.nodes;
}

export function setCached(payload: GraphPayload, nodes: ArtifactNode[]) {
  cached = { payload, nodes, expiresAt: Date.now() + TTL_MS };
}

export function invalidate() {
  cached = null;
}

// Convenience for routes that need `{ payload, nodes }` without caring about
// cache hit/miss. Rebuilds via the same crawl path `/api/graph` uses so the
// shape stays in sync.
export async function getOrBuildGraph(): Promise<{
  payload: GraphPayload;
  nodes: ArtifactNode[];
}> {
  const payload = getCachedPayload();
  const nodes = getCachedNodes();
  if (payload && nodes) return { payload, nodes };

  const paths = resolveHomePaths();
  const extra = process.env.THE_MEMORY_REGISTER_EXTRA_PROJECTS
    ? process.env.THE_MEMORY_REGISTER_EXTRA_PROJECTS.split(path.delimiter).filter(Boolean)
    : [];
  const { raws, ghostSlugs, slugMetadata, crawledAtMs } = await crawl({
    claudeHome: paths.claudeHome,
    ...(extra ? { knownProjectPaths: extra } : {}),
  });
  const built = buildPayload({ raws, slugMetadata, ghostSlugs, crawledAtMs });
  setCached(built.payload, built.nodes);
  return { payload: built.payload, nodes: built.nodes };
}
