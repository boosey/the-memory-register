"use client";
import type { ArtifactNode } from "@/core/types";
import type { SettingsEntry } from "@/core/parsers/settings";

export function SettingsEntryEditor({
  node,
  draft,
  onChange,
  readOnly,
}: {
  node: ArtifactNode;
  draft?: SettingsEntry | undefined;
  onChange?: ((next: SettingsEntry) => void) | undefined;
  readOnly?: boolean | undefined;
}) {
  const sd = (draft ?? (node.structuredData as SettingsEntry));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Row label="Kind" value={sd.kind} />
      <Row label="Source" value={node.sourceFile} mono />
      {sd.kind === "permission" && (
        <>
          <Row label="Group" value={sd.group} />
          <div className="flex flex-col">
            <span className="text-xs uppercase text-neutral-500">Value</span>
            <input
              className="font-mono text-xs bg-neutral-50 p-1 rounded border"
              value={sd.value}
              readOnly={readOnly}
              onChange={(e) => onChange?.({ ...sd, value: e.target.value })}
            />
          </div>
        </>
      )}
      {sd.kind === "hook" && (
        <>
          <Row label="Event" value={sd.event} />
          <Row label="Matcher" value={sd.matcher} mono />
          <Row
            label="Hooks (JSON)"
            value={JSON.stringify(sd.hooks, null, 2)}
            mono
          />
        </>
      )}
      {sd.kind === "env" && (
        <>
          <Row label="Name" value={sd.name} />
          <div className="flex flex-col">
            <span className="text-xs uppercase text-neutral-500">Value</span>
            <input
              className="font-mono text-xs bg-neutral-50 p-1 rounded border"
              value={sd.value}
              readOnly={readOnly}
              onChange={(e) => onChange?.({ ...sd, value: e.target.value })}
            />
          </div>
        </>
      )}
      {sd.kind === "other" && <Row label="Key" value={sd.key} />}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase text-neutral-500">{label}</span>
      <span className={mono ? "font-mono text-xs bg-neutral-50 p-1 rounded" : ""}>
        {value}
      </span>
    </div>
  );
}
