"use client";
import type { Graph } from "@/core/types";

export function GhostSlugsPanel({ graph }: { graph: Graph }) {
  if (!graph.ghostSlugs?.length) return null;
  return (
    <section className="mx-4 my-3 rounded-md border border-yellow-300 bg-yellow-50 p-3">
      <h2 className="font-semibold text-sm mb-1">
        Ghost slugs ({graph.ghostSlugs.length})
      </h2>
      <p className="text-xs text-neutral-600 mb-2">
        Project directories that no longer exist on disk. Safe to remove the
        slug folder if the project was deleted.
      </p>
      <ul className="text-xs space-y-1">
        {graph.ghostSlugs.map((g) => (
          <li key={g.slug} className="font-mono">
            <span className="text-neutral-500">{g.slug}</span>
            <span className="mx-2">→</span>
            <span className="text-red-600">{g.expectedPath}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
