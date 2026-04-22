"use client";
import type { ArtifactNode } from "@/core/types";
import type { ParsedSkill } from "@/core/parsers/skill";

export function SkillEditor({
  node,
  draft,
  onChange,
  readOnly,
}: {
  node: ArtifactNode;
  draft?: ParsedSkill | undefined;
  onChange?: ((next: ParsedSkill) => void) | undefined;
  readOnly?: boolean | undefined;
}) {
  const sd = (draft ?? (node.structuredData as ParsedSkill));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-col">
        <span className="text-xs uppercase text-neutral-500">Name</span>
        <input
          className="border rounded p-1"
          value={sd.name}
          readOnly={readOnly}
          onChange={(e) => onChange?.({ ...sd, name: e.target.value })}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase text-neutral-500">Description</span>
        <input
          className="border rounded p-1"
          value={sd.description}
          readOnly={readOnly}
          onChange={(e) => onChange?.({ ...sd, description: e.target.value })}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase text-neutral-500">Author</span>
        <span>{sd.author ?? "(from manifest)"}</span>
      </div>
      <div>
        <span className="text-xs uppercase text-neutral-500">Body</span>
        <textarea
          className="w-full min-h-[200px] font-mono text-xs border rounded p-2"
          value={sd.body}
          readOnly={readOnly}
          onChange={(e) => onChange?.({ ...sd, body: e.target.value })}
        />
      </div>
    </div>
  );
}
