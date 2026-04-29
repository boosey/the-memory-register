"use client";
import { useEffect, useMemo, useState } from "react";
import type { Entity } from "@/core/entities";
import {
  formatPermissionValue,
  parsePermissionValue,
  permissionPreview,
  permissionPreviewColorClass,
  type PermissionEffect,
} from "@/lib/permissionPreview";
import { buildNextContentFor } from "@/lib/buildNextContent";
import { Chip, FormRow, fieldClass, monoClass } from "./shared";
import type { TypedEditorProps } from "./editorTypes";

const TOOL_OPTIONS = ["Bash", "Read", "Edit", "Write", "WebFetch", "*"] as const;
const PRESETS: Record<string, string[]> = {
  Bash: ["git *", "pnpm *", "bun *", "rm *", "curl *"],
  Read: ["~/.ssh/**", "~/.aws/**", ".env*"],
  Write: [".env*", "~/.config/**"],
};

function initialEffect(entity: Entity): PermissionEffect {
  const sd = entity.structured as { group?: string } | null;
  const g = sd?.group;
  if (g === "deny") return "deny";
  if (g === "ask") return "ask";
  return "allow";
}

interface PermissionEditorProps extends TypedEditorProps {
  onStanzasChange?: (stanzas: string[]) => void;
}

export function PermissionEditor({
  entity,
  onApiReady,
  onStanzasChange,
}: PermissionEditorProps) {
  const sd = entity.structured as { value?: string } | null;
  const initialValue = sd?.value ?? entity.title ?? "";
  const parsed = useMemo(
    () => parsePermissionValue(initialValue),
    [initialValue],
  );
  const [tool, setTool] = useState(parsed.tool);
  const [pattern, setPattern] = useState(parsed.pattern);
  const [effect, setEffect] = useState<PermissionEffect>(initialEffect(entity));
  const [reason, setReason] = useState("");

  const preview = permissionPreview({ effect, tool, pattern });
  const effectColor = permissionPreviewColorClass(effect);

  const options = useMemo(() => {
    if (TOOL_OPTIONS.includes(tool as (typeof TOOL_OPTIONS)[number])) return TOOL_OPTIONS;
    return [...TOOL_OPTIONS, tool];
  }, [tool]);

  const ruleValue = useMemo(() => formatPermissionValue(tool, pattern), [tool, pattern]);

  useEffect(() => {
    onStanzasChange?.([ruleValue]);
  }, [ruleValue, onStanzasChange]);

  useEffect(() => {
    onApiReady({
      stanzas: [ruleValue],
      getSerializedContent: () =>
        buildNextContentFor(entity, {
          group: effect,
          value: ruleValue,
        }),
    });
  }, [effect, ruleValue, entity, onApiReady]);

  return (
    <div>
      <FormRow label="Tool" hint="Which tool family this permission applies to.">
        <div className="flex flex-wrap gap-[6px]">
          {options.map((t) => (
            <Chip
              key={t}
              label={t}
              active={tool === t}
              onClick={() => setTool(t)}
            />
          ))}
        </div>
      </FormRow>
      <FormRow
        label="Pattern"
        hint="Glob against the tool's arguments. Leave blank for ALL calls."
      >
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={`${tool}(...)`}
          className={monoClass()}
        />
        {PRESETS[tool] && (
          <div className="mt-[6px] flex flex-wrap gap-[6px]">
            {PRESETS[tool].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPattern(p)}
                className="cursor-pointer rounded-sm border border-[color:var(--rule-soft)] bg-transparent px-[8px] py-[2px] font-mono text-[10.5px] text-[color:var(--text-muted)]"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </FormRow>
      <FormRow label="Effect">
        <div className="flex w-fit overflow-hidden rounded-sm border border-[color:var(--rule)]">
          {(
            [
              ["allow", "Allow", "oklch(0.50 0.12 155)"],
              ["ask", "Ask", "oklch(0.55 0.11 70)"],
              ["deny", "Deny", "oklch(0.55 0.18 28)"],
            ] as const
          ).map(([k, l, c]) => {
            const active = effect === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setEffect(k)}
                className="cursor-pointer border-none px-[16px] py-[7px] text-[12px] font-semibold tracking-[0.04em]"
                style={{
                  background: active ? c : "transparent",
                  color: active ? "var(--paper)" : "var(--ink)",
                  borderRight: k !== "deny" ? "1px solid var(--rule)" : "none",
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      </FormRow>
      <FormRow
        label="Reason (optional)"
        hint="Comment stored alongside the rule. Helps you remember why you added it."
      >
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. blocks force-push on shared branches"
          className={fieldClass()}
        />
      </FormRow>
      <div
        data-testid="permission-compiled"
        className="mt-[6px] rounded-sm border border-dashed border-[color:var(--rule)] bg-[color:var(--paper)] px-[12px] py-[10px]"
      >
        <div className="smallcaps mb-[4px] text-[10px] tracking-[0.14em] text-[color:var(--text-muted)]">
          Compiled rule
        </div>
        <div className="font-mono text-[13px] text-[color:var(--ink)]">
          <b className={effectColor}>{effect}</b> · {tool}({pattern || "*"})
        </div>
        <span className="sr-only">{preview}</span>
      </div>
    </div>
  );
}
