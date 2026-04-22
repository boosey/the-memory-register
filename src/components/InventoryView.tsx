"use client";
import { useMemo, useState } from "react";
import type { Graph, Scope, ArtifactNode } from "@/core/types";
import { ScopeColumn } from "./ScopeColumn";
import { GhostSlugsPanel } from "./GhostSlugsPanel";

const ORDER: Scope[] = ["global", "slug", "plugin", "project", "local"];

type AuthorFilter = "all" | "anthropic" | "community" | "self" | "unknown";

export function InventoryView({
  graph,
  onSelect,
  selectedId,
}: {
  graph: Graph;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const [filterScopes, setFilterScopes] = useState<Set<Scope>>(
    new Set(ORDER),
  );
  const [filterAuthor, setFilterAuthor] = useState<AuthorFilter>("all");

  const filtered = useMemo(() => {
    const out: Record<Scope, ArtifactNode[]> = {
      global: [],
      slug: [],
      plugin: [],
      project: [],
      local: [],
    };
    for (const n of graph.nodes) {
      if (!filterScopes.has(n.scope)) continue;
      if (filterAuthor === "anthropic" && !n.isOfficial) continue;
      if (
        filterAuthor === "community" &&
        (n.isOfficial || n.author === "self" || n.author == null)
      )
        continue;
      if (filterAuthor === "self" && n.author !== "self") continue;
      if (filterAuthor === "unknown" && n.author != null) continue;
      out[n.scope].push(n);
    }
    return out;
  }, [graph, filterScopes, filterAuthor]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <span className="font-medium">Filters:</span>
        {ORDER.map((s) => (
          <label key={s} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filterScopes.has(s)}
              onChange={(e) => {
                const next = new Set(filterScopes);
                if (e.target.checked) next.add(s);
                else next.delete(s);
                setFilterScopes(next);
              }}
            />
            {s}
          </label>
        ))}
        <select
          value={filterAuthor}
          onChange={(e) => setFilterAuthor(e.target.value as AuthorFilter)}
          className="ml-4 border rounded px-2 py-1"
        >
          <option value="all">All authors</option>
          <option value="anthropic">Anthropic only</option>
          <option value="community">Community only</option>
          <option value="self">You</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
      <GhostSlugsPanel graph={graph} />
      <div className="flex gap-3 overflow-x-auto">
        {ORDER.map((s) => {
          const slugProps =
            s === "slug" ? { slugMetadata: graph.slugMetadata } : {};
          return (
            <ScopeColumn
              key={s}
              scope={s}
              nodes={filtered[s]}
              selectedId={selectedId}
              onSelect={onSelect}
              {...slugProps}
            />
          );
        })}
      </div>
    </div>
  );
}
