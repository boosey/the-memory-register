import {
  ENTITY_TYPE_ORDER,
  type Entity,
  type EntityType,
  type PseudoNode,
  type Relation,
} from "@/core/entities";
import { TYPE_LABELS } from "./typeLabels";

interface TypeTabsProps {
  entities: readonly Entity[];
  relations: readonly Relation[];
  pseudoNodes: readonly PseudoNode[];
  activeType: EntityType;
  pinnedId: string | null;
  onSelectType: (t: EntityType) => void;
}

function computeRelatedByType(
  pinnedId: string | null,
  entities: readonly Entity[],
  relations: readonly Relation[],
): Record<EntityType, number> {
  const acc: Record<EntityType, number> = {
    "standing-instruction": 0,
    permission: 0,
    plugin: 0,
    skill: 0,
    command: 0,
    memory: 0,
    hook: 0,
    env: 0,
    keybinding: 0,
    agent: 0,
    "mcp-server": 0,
  };
  if (!pinnedId) return acc;
  const byId = new Map<string, Entity>();
  for (const e of entities) byId.set(e.id, e);
  const related = new Set<string>();
  for (const r of relations) {
    if (r.from === pinnedId) related.add(r.to);
    if (r.to === pinnedId) related.add(r.from);
  }
  for (const id of related) {
    const e = byId.get(id);
    if (e) acc[e.type] += 1;
  }
  return acc;
}

export function TypeTabs({
  entities,
  relations,
  pseudoNodes,
  activeType,
  pinnedId,
  onSelectType,
}: TypeTabsProps) {
  const countsByType = new Map<EntityType, number>();
  for (const e of entities) {
    if (e.type === "enabled-plugins") continue;
    countsByType.set(e.type, (countsByType.get(e.type) ?? 0) + 1);
  }
  const relatedByType = computeRelatedByType(pinnedId, entities, relations);

  const slugs = (
    pseudoNodes.filter((p) => p.kind === "slug") as any[]
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      data-testid="type-tabs"
      className="border-b border-[color:var(--rule)] px-7 pt-[14px]"
    >
      <div className="mb-2">
        <div className="smallcaps text-[10px] text-[color:var(--text-muted)]">
          Trace by entity kind
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-5">
        {ENTITY_TYPE_ORDER.map((t) => {
          const active = activeType === t;
          const count = countsByType.get(t) ?? 0;
          const related = relatedByType[t];
          return (
            <button
              key={t}
              type="button"
              data-testid={`type-tab-${t}`}
              data-active={active ? "true" : "false"}
              data-count={count}
              data-related={related > 0 ? "true" : "false"}
              onClick={() => onSelectType(t)}
              className={[
                "cursor-pointer border-0 bg-transparent px-0 py-2 text-[16px]",
                active
                  ? "font-semibold text-[color:var(--ink)]"
                  : "font-medium text-[color:var(--text-muted)]",
                "border-b-2",
                active ? "border-[color:var(--ink)]" : "border-transparent",
              ].join(" ")}
            >
              {TYPE_LABELS[t].plural}
              <span className="ml-[6px] font-mono text-[10px] text-[color:var(--text-faint)]">
                {count}
              </span>
              {related > 0 && (
                <span
                  aria-hidden="true"
                  className="ml-[6px] inline-block size-2 rounded-full align-middle"
                  style={{ background: "oklch(0.55 0.14 50)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
