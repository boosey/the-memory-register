"use client";
import { useEffect, useMemo, useState } from "react";
import type { Entity } from "@/core/entities";
import type { ParsedMcpServer } from "@/core/parsers/mcpServer";
import { buildNextContentFor } from "@/lib/buildNextContent";
import { FormRow, fieldClass, monoClass, ecBtnClass } from "./shared";
import type { TypedEditorProps } from "./editorTypes";

function structured(entity: Entity): ParsedMcpServer | null {
  return (entity.structured as { server: ParsedMcpServer })?.server ?? null;
}

export function McpServerEditor({
  entity,
  onApiReady,
  onTitleChange,
}: TypedEditorProps) {
  const initial = useMemo(() => structured(entity), [entity]);
  const [name, setName] = useState(initial?.name || entity.title);
  const [command, setCommand] = useState(initial?.command || "");
  const [args, setArgs] = useState(initial?.args.join(" ") || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [env, setEnv] = useState<Array<{ k: string; v: string }>>(() =>
    Object.entries(initial?.env || {}).map(([k, v]) => ({ k, v })),
  );

  useEffect(() => {
    onTitleChange?.(name);
  }, [name, onTitleChange]);

  useEffect(() => {
    const envObj: Record<string, string> = {};
    for (const { k, v } of env) {
      if (k.trim()) envObj[k.trim()] = v;
    }

    onApiReady({
      currentTitle: name,
      getSerializedContent: () =>
        buildNextContentFor(entity, {
          name,
          raw: {
            ...initial?.raw,
            command: command || undefined,
            args: args.trim() ? args.split(/\s+/).filter(Boolean) : [],
            url: url || undefined,
            env: Object.keys(envObj).length > 0 ? envObj : undefined,
            enabled,
          },
        }),
    });
  }, [name, command, args, url, enabled, env, initial, onApiReady, entity]);

  const btn = ecBtnClass();

  return (
    <div className="flex flex-col gap-4">
      <FormRow label="Server Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={monoClass()}
        />
      </FormRow>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="mcp-enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <label htmlFor="mcp-enabled" className="text-[20px] font-medium text-[color:var(--ink)]">
          Enabled
        </label>
      </div>

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
    </div>
  );
}
