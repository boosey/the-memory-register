"use client";
import type { ArtifactNode, Scope, SlugMetadata } from "@/core/types";
import { ArtifactCard } from "./ArtifactCard";

const SCOPE_LABELS: Record<Scope, string> = {
  global: "Global (~/.claude)",
  slug: "Slug (per-project memory)",
  plugin: "Plugin",
  project: "Project",
  local: "Local (gitignored)",
};

const SCOPE_ACCENT: Record<Scope, string> = {
  global: "border-t-slate-500",
  slug: "border-t-purple-500",
  plugin: "border-t-orange-500",
  project: "border-t-green-600",
  local: "border-t-red-500",
};

export function ScopeColumn({
  scope,
  nodes,
  selectedId,
  onSelect,
  slugMetadata,
}: {
  scope: Scope;
  nodes: ArtifactNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  slugMetadata?: SlugMetadata[];
}) {
  const byKind = new Map<string, ArtifactNode[]>();
  for (const n of nodes) {
    const arr = byKind.get(n.kind) ?? [];
    arr.push(n);
    byKind.set(n.kind, arr);
  }

  const slugCardsBySlug = new Map<string, ArtifactNode[]>();
  if (scope === "slug") {
    for (const n of nodes) {
      if (!n.slug) continue;
      const arr = slugCardsBySlug.get(n.slug) ?? [];
      arr.push(n);
      slugCardsBySlug.set(n.slug, arr);
    }
  }

  return (
    <section
      className={`flex flex-col gap-2 min-w-[280px] w-80 p-3 bg-neutral-50 rounded-md border-t-4 ${SCOPE_ACCENT[scope]}`}
    >
      <h2 className="font-semibold text-sm">
        {SCOPE_LABELS[scope]}{" "}
        <span className="text-neutral-400">({nodes.length})</span>
      </h2>
      {scope === "slug" && slugMetadata && slugMetadata.length > 0 && (
        <div className="flex flex-col gap-1 text-xs text-neutral-600">
          {slugMetadata
            .filter((m) => slugCardsBySlug.has(m.slug))
            .map((m) => (
              <div
                key={m.slug}
                className="rounded border border-neutral-200 bg-white px-2 py-1"
              >
                <div className="font-mono truncate" title={m.projectPath}>
                  {m.projectPath}
                </div>
                <div className="text-neutral-500">
                  {m.sessionCount} session{m.sessionCount === 1 ? "" : "s"}
                  {m.lastActiveMs > 0 &&
                    ` · last ${new Date(m.lastActiveMs).toLocaleDateString()}`}
                </div>
              </div>
            ))}
        </div>
      )}
      {Array.from(byKind.entries()).map(([kind, arr]) => (
        <div key={kind} className="flex flex-col gap-1">
          <h3 className="text-xs uppercase tracking-wide text-neutral-500 mt-1">
            {kind} ({arr.length})
          </h3>
          {arr.map((n) => (
            <ArtifactCard
              key={n.id}
              node={n}
              selected={n.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </section>
  );
}
