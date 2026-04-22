"use client";
import type { ArtifactNode } from "@/core/types";

export interface ClaudeMdSectionDraft {
  heading: string;
  level: number;
  headingPath: string[];
  body: string;
  imports: string[];
}

export function ClaudeMdSectionEditor({
  node,
  draft,
  onChange,
  readOnly,
}: {
  node: ArtifactNode;
  draft?: ClaudeMdSectionDraft | undefined;
  onChange?: ((next: ClaudeMdSectionDraft) => void) | undefined;
  readOnly?: boolean | undefined;
}) {
  const sd = (draft ?? (node.structuredData as ClaudeMdSectionDraft));
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-neutral-500">
        {sd.headingPath.join(" / ")}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block rounded bg-neutral-200 px-1 text-xs font-mono">
          H{sd.level}
        </span>
        <div className="text-base font-semibold">{sd.heading}</div>
      </div>
      <textarea
        className="w-full min-h-[240px] font-mono text-sm border rounded p-2"
        value={sd.body}
        readOnly={readOnly}
        onChange={(e) => onChange?.({ ...sd, body: e.target.value })}
      />
    </div>
  );
}
