"use client";
import Editor from "@monaco-editor/react";

export function MonacoEscapeHatch({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <Editor
      height="70vh"
      defaultLanguage="markdown"
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        readOnly: !!readOnly,
        minimap: { enabled: false },
        wordWrap: "on",
        fontSize: 13,
      }}
    />
  );
}
