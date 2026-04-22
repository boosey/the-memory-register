"use client";
import type { ArtifactNode } from "@/core/types";

export function MemoryEditor({ node }: { node: ArtifactNode }) {
  return (
    <pre className="text-xs whitespace-pre-wrap font-mono bg-neutral-50 p-2 rounded border">
      {JSON.stringify(node.structuredData, null, 2)}
    </pre>
  );
}
