"use client";
import type { ArtifactNode } from "@/core/types";
import { ClaudeMdSectionEditor } from "./ClaudeMdSectionEditor";
import { SettingsEntryEditor } from "./SettingsEntryEditor";
import { SkillEditor } from "./SkillEditor";
import { MemoryEditor } from "./MemoryEditor";
import { KeybindingsEditor } from "./KeybindingsEditor";

export interface StructuredEditorProps {
  node: ArtifactNode;
  draft?: unknown;
  onChange?: ((next: unknown) => void) | undefined;
  readOnly?: boolean | undefined;
}

export function StructuredEditor({
  node,
  draft,
  onChange,
  readOnly,
}: StructuredEditorProps) {
  switch (node.kind) {
    case "claude-md-section":
      return (
        <ClaudeMdSectionEditor
          node={node}
          draft={draft as Parameters<typeof ClaudeMdSectionEditor>[0]["draft"]}
          onChange={
            onChange as Parameters<typeof ClaudeMdSectionEditor>[0]["onChange"]
          }
          readOnly={readOnly}
        />
      );
    case "settings-entry":
      return (
        <SettingsEntryEditor
          node={node}
          draft={draft as Parameters<typeof SettingsEntryEditor>[0]["draft"]}
          onChange={
            onChange as Parameters<typeof SettingsEntryEditor>[0]["onChange"]
          }
          readOnly={readOnly}
        />
      );
    case "skill":
    case "slash-command":
      return (
        <SkillEditor
          node={node}
          draft={draft as Parameters<typeof SkillEditor>[0]["draft"]}
          onChange={onChange as Parameters<typeof SkillEditor>[0]["onChange"]}
          readOnly={readOnly}
        />
      );
    case "typed-memory":
    case "memory-index-entry":
      return <MemoryEditor node={node} />;
    case "keybindings":
      return <KeybindingsEditor node={node} />;
    case "plugin-manifest":
      return (
        <pre className="text-xs whitespace-pre-wrap font-mono bg-neutral-50 p-2 rounded border">
          {JSON.stringify(node.structuredData, null, 2)}
        </pre>
      );
  }
}
