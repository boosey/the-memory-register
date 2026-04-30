"use client";
import { useEffect, useState } from "react";
import { buildNextContentFor } from "@/lib/buildNextContent";
import { FormRow, ecBtnClass, monoClass } from "./shared";
import type { TypedEditorProps } from "./editorTypes";

interface EnvVarEditorProps extends TypedEditorProps {
  onStanzasChange?: (stanzas: string[]) => void;
}

export function EnvVarEditor({
  entity,
  onApiReady,
  onStanzasChange,
}: EnvVarEditorProps) {
  const sd = (entity.structured ?? {}) as { name?: string; value?: unknown };
  const [name, setName] = useState(
    (sd.name ?? entity.title ?? "").toUpperCase(),
  );

  const initialValue =
    typeof sd.value === "object" && sd.value !== null
      ? JSON.stringify(sd.value, null, 2)
      : String(sd.value ?? entity.intent ?? "");

  const [value, setValue] = useState(initialValue);
  const [secret, setSecret] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    onStanzasChange?.([name]);
  }, [name, onStanzasChange]);

  useEffect(() => {
    onApiReady({
      currentTitle: name,
      stanzas: [name],
      getSerializedContent: () => {
        let finalValue: unknown = value;
        try {
          // If it was an object initially, or it looks like one, try to parse it.
          if (
            (value.startsWith("{") && value.endsWith("}")) ||
            (value.startsWith("[") && value.endsWith("]"))
          ) {
            finalValue = JSON.parse(value);
          }
        } catch {
          // ignore parse errors, keep as string
        }
        return buildNextContentFor(entity, { name, value: finalValue });
      },
    });
  }, [name, value, entity, onApiReady]);

  const reveaBtn = ecBtnClass();

  return (
    <div>
      <FormRow label="Variable">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          className={`${monoClass()} font-semibold`}
          style={{ letterSpacing: "0.04em" }}
        />
      </FormRow>
      <FormRow label="Value">
        <div className="flex gap-[6px]">
          <textarea
            rows={Math.max(2, value.split("\n").length)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${monoClass()} flex-1 resize-none overflow-hidden py-2`}
            style={
              {
                minHeight: "38px",
                WebkitTextSecurity: secret && !reveal ? "disc" : "none",
              } as React.CSSProperties
            }
          />
          {secret && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className={reveaBtn.className}
              style={reveaBtn.style}
            >
              {reveal ? "hide" : "reveal"}
            </button>
          )}
        </div>
      </FormRow>
      <FormRow label="Flags">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={secret}
            onChange={(e) => setSecret(e.target.checked)}
          />
          <span className="text-[12.5px] text-[color:var(--ink)]">
            Mark as secret · value hidden by default, never printed in logs
          </span>
        </label>
      </FormRow>
    </div>
  );
}
