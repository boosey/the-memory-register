"use client";
import { useState } from "react";
import type { Entity, Scope } from "@/core/entities";
import {
  SCOPE_LADDER,
  type BulkAction,
  type BulkRequest,
  type BulkResponse,
} from "@/core/apiContracts";
import { Chip, FormRow, ecBtnClass } from "./shared";
import { useProjectFilter } from "@/hooks/useProjectFilter";

interface ScopeMoverProps {
  entity: Entity;
  onMoved: () => void;
}

/**
 * Scope moves flow through /api/bulk (promote-scope / demote-scope) so the
 * backend can re-root the source path, rewrite relations, and leave a backup
 * in one transaction.
 */
export function ScopeMover({ entity, onMoved }: ScopeMoverProps) {
  const { activeSlug } = useProjectFilter();
  const [scope, setScope] = useState<Scope>(entity.scope);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIndex = SCOPE_LADDER.indexOf(entity.scope);

  function scopeToAction(target: Scope): BulkAction | null {
    const idx = SCOPE_LADDER.indexOf(target);
    if (idx < currentIndex) return "promote-scope";
    if (idx > currentIndex) return "demote-scope";
    return null;
  }

  const action = scope === entity.scope ? null : scopeToAction(scope);
  const isDemotion = action === "demote-scope";
  const isBlockedDemotion = isDemotion && !activeSlug;
  const disabled = action === null || isBlockedDemotion || pending;
  const saveBtn = ecBtnClass(true);

  const isAutoToManual = entity.scope === "slug" && scope !== "slug";
  const isManualToAuto = entity.scope !== "slug" && scope === "slug";

  async function save() {
    if (!action) return;
    setPending(true);
    setError(null);
    try {
      const body: BulkRequest = {
        action,
        entityIds: [entity.id],
        confirm: true,
        targetScope: scope,
      };
      const resp = await fetch("/api/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await resp.json()) as BulkResponse;
      if (!j.ok) {
        setError(String(j.reason ?? j.message ?? "move failed"));
        return;
      }
      onMoved();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid="scope-mover">
      <FormRow
        label="Move to scope"
        hint="Relocate this entity to a different scope. Writes a backup + rewrites relations."
      >
        <div className="flex flex-wrap gap-[6px]">
          {SCOPE_LADDER.filter((sk) => sk !== "plugin").map((sk) => {
            return (
              <Chip
                key={sk}
                label={sk.toUpperCase()}
                active={scope === sk}
                onClick={() => setScope(sk)}
              />
            );
          })}
        </div>
        <div className="mt-[10px] text-[12px] text-[color:var(--text-muted)]">
          Current: <b className="text-[color:var(--ink)]">{entity.scope}</b>
          {scope !== entity.scope && (
            <>
              {" "}
              → New: <b className="text-[color:var(--ink)]">{scope}</b>{" "}
              <span className="smallcaps font-mono text-[9.5px] tracking-[0.14em] text-[color:var(--text-faint)]">
                · {action}
              </span>
            </>
          )}
        </div>
      </FormRow>

      {isBlockedDemotion && (
        <div className="mt-4 rounded-sm border border-[color:var(--semantic-error)] bg-[color:var(--semantic-error-tint)] px-3 py-2 text-[12px] text-[color:var(--ink)]">
          <div className="mb-1 font-bold">Project Selection Required</div>
          <p>
            To demote an entity (move it to a lower scope), you must first select a <b>target project</b> in the top navigation. 
            This tells Claude Code which project the entity should be moved into.
          </p>
        </div>
      )}

      {(isAutoToManual || isManualToAuto) && !isBlockedDemotion && (
        <div className="mt-4 rounded-sm border border-[color:var(--author-community)] bg-[color:var(--author-community-tint)] px-3 py-2 text-[12px] text-[color:var(--ink)]">
          <div className="mb-1 font-bold">Scope Conversion Warning</div>
          {isAutoToManual && (
            <p>
              Moving an <b>Auto-Memory</b> note to a manual scope will convert it into a <b>Standing Instruction</b> in <code className="bg-[color:var(--paper)] px-1 rounded">CLAUDE.md</code>. 
              Claude will no longer manage this note automatically.
            </p>
          )}
          {isManualToAuto && (
            <p>
              Moving a <b>Manual Instruction</b> to the Slug scope will convert it into <b>Auto-Memory</b> in <code className="bg-[color:var(--paper)] px-1 rounded">MEMORY.md</code>. 
              It will become part of the agent&apos;s self-managed context.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          data-testid="scope-mover-save"
          disabled={disabled}
          onClick={save}
          className={saveBtn.className}
          style={{
            ...saveBtn.style,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "moving…" : "Move scope"}
        </button>
        {error && (
          <span
            className="text-[11.5px]"
            style={{ color: "var(--semantic-error)" }}
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
