import type { Entity } from "../entities";
import type { SlugMetadata } from "../types";
import { STALE_THRESHOLD_MS } from "../entities";

export interface DismissedMarker {
  entityId: string;
  atMs: number;
}

/**
 * Memory is considered stale when the associated slug has been touched
 * more recently than the memory file itself by more than STALE_THRESHOLD_MS.
 *
 * Only applies to entities with type === 'memory' and a slugRef.
 *
 * Accepts an optional `dismissed` list (read from ~/.claude/the-memory-register-state.json
 * by callers that care about the user's dismissals). If an entity has a
 * dismissal whose `atMs` is newer than the memory's mtimeMs, the staleness
 * is suppressed — it was already acknowledged. A newer mtime (user edited
 * the memory after dismissing) re-arms the flag.
 */
export function isMemoryStale(
  entity: Entity,
  slugMetadata: SlugMetadata[],
  dismissed: DismissedMarker[] = [],
): boolean {
  if (entity.type !== "memory") return false;
  if (!entity.slugRef) return false;
  const meta = slugMetadata.find((m) => m.slug === entity.slugRef);
  if (!meta) return false;
  if (meta.lastActiveMs <= 0) return false;
  if (meta.lastActiveMs - entity.mtimeMs <= STALE_THRESHOLD_MS) return false;

  const dm = dismissed.find((d) => d.entityId === entity.id);
  if (dm && dm.atMs >= entity.mtimeMs) return false;
  return true;
}
