"use client";
import type { ArtifactNode } from "@/core/types";
import { AuthorBadge } from "./AuthorBadge";
import { cn } from "@/lib/utils";

export function ArtifactCard({
  node,
  selected,
  onSelect,
}: {
  node: ArtifactNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className={cn(
        "w-full text-left rounded-md border px-3 py-2 transition",
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-neutral-200 bg-white hover:border-neutral-300",
      )}
      onClick={() => onSelect(node.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm truncate">
          {node.title || "(untitled)"}
        </div>
        <AuthorBadge author={node.author} isOfficial={node.isOfficial} />
      </div>
      {node.intentSummary && (
        <div className="mt-1 text-xs text-neutral-600 line-clamp-2">
          {node.intentSummary}
        </div>
      )}
      {node.parseError && (
        <div className="mt-1 text-xs text-red-600">⚠ parse failed</div>
      )}
      {node.hasDeadImports && (
        <div className="mt-1 text-xs text-red-600">⚠ dead @import</div>
      )}
    </button>
  );
}
