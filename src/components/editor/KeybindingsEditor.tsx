"use client";
import type { ArtifactNode } from "@/core/types";
import type { ParsedKeybindings } from "@/core/parsers/keybindings";

export function KeybindingsEditor({ node }: { node: ArtifactNode }) {
  const sd = node.structuredData as ParsedKeybindings;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {sd.entries.map((e, i) => (
        <div key={i} className="flex gap-3 items-center">
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border font-mono text-xs">
            {e.chord}
          </kbd>
          <span>→</span>
          <span>{e.action}</span>
        </div>
      ))}
    </div>
  );
}
