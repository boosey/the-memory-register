"use client";
import { useEffect, useMemo, useState } from "react";
import type { Entity, Relation } from "@/core/entities";
import type { ParsedMcpServer } from "@/core/parsers/mcpServer";
import { buildNextContentFor, type McpConsolidateDraft } from "@/lib/buildNextContent";
import { FormRow, monoClass, ecBtnClass } from "./shared";
import type { TypedEditorProps } from "./editorTypes";

function structured(entity: Entity): ParsedMcpServer | null {
  return (entity.structured as { server: ParsedMcpServer })?.server ?? null;
}

interface McpServerEditorProps extends TypedEditorProps {
  allEntities?: readonly Entity[];
  relations?: readonly Relation[];
}

export function McpServerEditor({
  entity,
  onApiReady,
  onTitleChange,
  allEntities = [],
}: McpServerEditorProps) {
  const initial = useMemo(() => structured(entity), [entity]);
  const [name, setName] = useState(initial?.name || entity.title);
  const [command, setCommand] = useState(initial?.command || "");
  const [args, setArgs] = useState(initial?.args.join(" ") || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [env, setEnv] = useState<Array<{ k: string; v: string }>>(() =>
    Object.entries(initial?.env || {}).map(([k, v]) => ({ k, v })),
  );

  const [consolidating, setConsolidating] = useState(false);

  const globalSettings = useMemo(() => 
    allEntities.find(e => e.type === 'enabled-plugins' && e.scope === 'global'),
    [allEntities]
  );
  
  const projectSettings = useMemo(() => 
    allEntities.find(e => e.type === 'enabled-plugins' && (e.scope === 'project' || e.scope === 'local')),
    [allEntities]
  );

  const settingsTarget = projectSettings || globalSettings;

  const relatedPermissions = useMemo(() => {
    // Claude Code uses several prefixing conventions for MCP tools:
    // 1. mcp__plugin_<plugin-name>_<server-name>__<tool>
    // 2. mcp__<server-name>__<tool>
    // 3. <server-name>__<tool> (fallback)
    const prefixes = [
      `mcp__${name}__`,
      `${name}__`
    ];
    if (entity.plugin) {
      prefixes.unshift(`mcp__plugin_${entity.plugin}_${name}__`);
    }

    return allEntities.filter(e => {
      if (e.type !== 'permission') return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (e.structured as any)?.value || e.title;
      return prefixes.some(p => val.startsWith(p));
    });
  }, [allEntities, name, entity.plugin]);

  const wildcard = useMemo(() => {
    // If we found any plugin-prefixed permissions, use that specific prefix for the wildcard.
    if (entity.plugin) {
      const pluginPrefix = `mcp__plugin_${entity.plugin}_${name}__`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (relatedPermissions.some(p => ((p.structured as any)?.value || p.title).startsWith(pluginPrefix))) {
        return `${pluginPrefix}*`;
      }
    }
    return `mcp__${name}__*`;
  }, [entity.plugin, name, relatedPermissions]);

  const canConsolidate = useMemo(() => {
    // Can consolidate if there are multiple specific permissions
    // and none of them is already the wildcard we intend to create.
    const hasWildcard = relatedPermissions.some(p => 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p.title === wildcard || (p.structured as any)?.value === wildcard
    );
    return relatedPermissions.length > 1 && !hasWildcard;
  }, [relatedPermissions, wildcard]);

  useEffect(() => {
    onTitleChange?.(name);
  }, [name, onTitleChange]);

  useEffect(() => {
    const envObj: Record<string, string> = {};
    for (const { k, v } of env) {
      if (k.trim()) envObj[k.trim()] = v;
    }

    const isOnlyConsolidate = consolidating && settingsTarget;

    onApiReady({
      currentTitle: name,
      getSerializedContent: () => {
        if (isOnlyConsolidate) {
          const draft: McpConsolidateDraft = {
            kind: "consolidate-permissions",
            toWildcard: wildcard,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toRemoveValues: relatedPermissions.map(p => (p.structured as any)?.value || p.title),
            allRelatedPermissions: relatedPermissions
          };
          return buildNextContentFor(settingsTarget, draft);
        }
        return buildNextContentFor(entity, {
          name,
          raw: {
            ...initial?.raw,
            command: command || undefined,
            args: args.trim() ? args.split(/\s+/).filter(Boolean) : [],
            url: url || undefined,
            env: Object.keys(envObj).length > 0 ? envObj : undefined,
            enabled,
          },
        });
      },
      ...(isOnlyConsolidate ? {
        sourceFile: settingsTarget.sourceFile,
        scopeRoot: settingsTarget.scopeRoot,
        expectedMtimeMs: settingsTarget.mtimeMs,
      } : {})
    });
  }, [name, command, args, url, enabled, env, initial, onApiReady, entity, consolidating, relatedPermissions, wildcard, settingsTarget]);

  const btn = ecBtnClass();
  const primary = ecBtnClass(true);

  return (
    <div className="flex flex-col gap-4">
      <FormRow label="Server Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={monoClass()}
        />
      </FormRow>

      <FormRow label="State">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!!entity.plugin}
            onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="text-[12.5px] text-[color:var(--ink)]">
            Enabled · {enabled ? "Active" : "Disabled (Claude will not see this server)"}
            {!!entity.plugin && " · Controlled by plugin state"}
            </span>
        </label>
      </FormRow>

      <FormRow label="Command" hint="The executable to run for stdio transport.">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="npx"
          className={monoClass()}
        />
      </FormRow>

      <FormRow label="Arguments" hint="Arguments passed to the command.">
        <input
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          placeholder="@modelcontextprotocol/server-everything"
          className={monoClass()}
        />
      </FormRow>

      <FormRow label="URL" hint="URL for HTTP/SSE transport.">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:3000/sse"
          className={monoClass()}
        />
      </FormRow>

      <FormRow label="Environment Variables">
        <div className="flex flex-col gap-2">
          {env.map((pair, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={pair.k}
                onChange={(e) =>
                  setEnv((curr) =>
                    curr.map((p, j) => (i === j ? { ...p, k: e.target.value } : p)),
                  )
                }
                placeholder="KEY"
                className={`${monoClass()} flex-1`}
              />
              <input
                value={pair.v}
                onChange={(e) =>
                  setEnv((curr) =>
                    curr.map((p, j) => (i === j ? { ...p, v: e.target.value } : p)),
                  )
                }
                placeholder="VALUE"
                className={`${monoClass()} flex-1`}
              />
              <button
                type="button"
                onClick={() => setEnv((curr) => curr.filter((_, j) => i !== j))}
                className="text-[color:var(--text-muted)] hover:text-[color:var(--ink)]"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEnv((curr) => [...curr, { k: "", v: "" }])}
            className={btn.className}
            style={btn.style}
          >
            + Add variable
          </button>
        </div>
      </FormRow>

      <FormRow
        label={`Permissions · ${relatedPermissions.length}`}
        hint="Claude Code permissions associated with this server."
      >
        <div className="rounded-sm border border-[color:var(--rule)] bg-[color:var(--paper)] p-3">
          {relatedPermissions.length === 0 ? (
            <div className="text-[12px] text-[color:var(--text-faint)] italic">
              No specific permissions found for this server.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-col gap-1">
                {relatedPermissions.map(p => (
                  <li key={p.id} className="flex items-center gap-2 font-mono text-[11px] text-[color:var(--text-muted)]">
                    <span className="shrink-0 opacity-50">·</span>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <span className="flex-1 truncate">{(p.structured as any)?.value || p.title}</span>
                    <span className={[
                      "smallcaps shrink-0 rounded-sm px-1 py-0.5 text-[8.5px] tracking-[0.08em]",
                      p.scope === 'global' ? "bg-[color:var(--paper-deep)] text-[color:var(--text-muted)] border border-[color:var(--rule)]" : "bg-[color:var(--author-you-tint)] text-[color:var(--author-you-ink)]"
                    ].join(" ")}>
                      {p.scope}
                    </span>
                  </li>
                ))}
              </ul>
              {canConsolidate && (
                <div className="mt-2 border-t border-[color:var(--rule-soft)] pt-2">
                  <div className="mb-2 text-[11px] text-[color:var(--text-muted)] leading-[1.4]">
                    Consolidate these into a single wildcard permission in your <code className="font-bold">{settingsTarget?.scope}</code> settings: <code className="font-bold">{wildcard}</code>
                    {relatedPermissions.some(p => p.scope !== settingsTarget?.scope) && (
                      <p className="mt-1 text-[10px] text-[color:var(--text-faint)] italic">
                        Note: This will shadow permissions in other scopes.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConsolidating(!consolidating)}
                    className={consolidating ? primary.className : btn.className}
                    style={consolidating ? primary.style : btn.style}
                  >
                    {consolidating ? "✓ Will consolidate on save" : "Consolidate to wildcard"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </FormRow>
    </div>
  );
}
