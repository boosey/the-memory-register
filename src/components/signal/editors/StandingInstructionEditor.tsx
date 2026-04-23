"use client";
import { useEffect, useMemo, useState } from "react";
import type { Entity, Relation } from "@/core/entities";
import type { ClaudeMdSection } from "@/core/parsers/claudeMd";
import { buildNextContentFor } from "@/lib/buildNextContent";
import { BodyEditor } from "./BodyEditor";
import { ImportList } from "./ImportList";
import { FormRow, fieldClass } from "./shared";
import type { TypedEditorProps } from "./editorTypes";

interface StandingInstructionEditorProps extends TypedEditorProps {
  relations: readonly Relation[];
}

function structured(entity: Entity): ClaudeMdSection | null {
  return (entity.structured as ClaudeMdSection) ?? null;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function StandingInstructionEditor({
  entity,
  relations,
  onApiReady,
  onTitleChange,
}: StandingInstructionEditorProps) {
  const initial = useMemo(() => structured(entity), [entity]);
  const [heading, setHeading] = useState(initial?.heading || entity.title);
  const [body, setBody] = useState(initial?.body ?? "");
  const [imports, setImports] = useState<string[]>(entity.imports ?? []);

  // Compute broken paths from relations
  const brokenPaths = useMemo(() => {
    const s = new Set<string>();
    for (const r of relations) {
      if (r.from === entity.id && r.kind === "imports" && r.broken) {
        // to is the pseudo-node id, which is `@path`
        s.add(r.to);
      }
    }
    return s;
  }, [relations, entity.id]);

  useEffect(() => {
    onTitleChange?.(heading);
  }, [heading, onTitleChange]);

  useEffect(() => {
    // Harmonized regex with claudeMd.ts
    const IMPORT_SCAN_RE = /@([^\s)<>]+)/g;
    const existingImports = new Set<string>();
    for (const m of body.matchAll(IMPORT_SCAN_RE)) {
      existingImports.add(`@${m[1]}`);
    }

    const extras = imports.filter((i) => !existingImports.has(i));
    const finalBody =
      extras.length > 0 ? `${body.trimEnd()}\n\n${extras.join("\n")}\n` : body;

    onApiReady({
      currentTitle: heading,
      getSerializedContent: () =>
        buildNextContentFor(entity, {
          heading,
          body: finalBody,
        }),
    });
  }, [heading, body, imports, entity, onApiReady]);

  function handleImportsChange(next: string[]) {
    // Bug 2: If an item was removed from the list, try to remove it from the body too.
    const removed = imports.filter((i) => !next.includes(i));
    let nextBody = body;
    for (const r of removed) {
      const bare = r.startsWith("@") ? r.slice(1) : r;
      const regex = new RegExp(`@${escapeRegExp(bare)}(\\s|$)`, "g");
      nextBody = nextBody.replace(regex, "");
    }
    setBody(nextBody.trimEnd() + (nextBody.endsWith("\n") ? "\n" : ""));
    setImports(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <FormRow
        label="Heading"
        hint="Rendered as an H2 in CLAUDE.md. Keep short; Claude reads these as anchors."
      >
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          className={fieldClass()}
        />
      </FormRow>
      <FormRow
        label="Body"
        hint="This section body. Toggle Markdown to view or edit the raw source."
      >
        <BodyEditor value={body} onChange={setBody} allowMarkdownToggle />
      </FormRow>
      <FormRow
        label="Imports"
        hint="@-references to other files merged into this section."
      >
        <ImportList
          imports={imports}
          onChange={handleImportsChange}
          brokenPaths={brokenPaths}
        />
      </FormRow>
    </div>
  );
}
