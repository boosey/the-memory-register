"use client";
import dynamic from "next/dynamic";
import { ecBtnClass } from "./editors/shared";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-[12px] text-[color:var(--text-muted)]">
        Loading diff…
      </div>
    ),
  },
);

interface DiffPreviewModalProps {
  open: boolean;
  title?: string;
  before: string;
  after: string;
  language?: string;
  onClose: () => void;
  noop?: boolean;
  /** Strings that identify the section(s) being edited.
   * The editor will scroll to and flash-highlight the first match. */
  stanzas?: string[] | undefined;
}

export function DiffPreviewModal({
  open,
  title = "Preview diff",
  before,
  after,
  language,
  onClose,
  noop,
  stanzas,
}: DiffPreviewModalProps) {
  if (!open) return null;
  const close = ecBtnClass();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorMount = (editor: any) => {
    if (!stanzas || stanzas.length === 0) return;

    // Use a timeout to ensure the editor is ready and content is loaded
    setTimeout(() => {
      const modifiedEditor = editor.getModifiedEditor();
      const model = modifiedEditor.getModel();
      if (!model) return;

      for (const s of stanzas) {
        if (!s) continue;
        // Escape regex special characters from the stanza string
        const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // findMatches(searchString, searchOnlyEditableRange, isRegex, matchCase, wordSeparators, captureMatches, limitResultCount)
        const matches = model.findMatches(escaped, false, true, false, null, false);
        
        if (matches && matches.length > 0) {
          const match = matches[0];
          const line = match.range.startLineNumber;

          // Scroll to the line
          modifiedEditor.revealLineInCenter(line);

          // Apply flash highlight decoration
          const decorations = modifiedEditor.deltaDecorations(
            [],
            [
              {
                range: {
                  startLineNumber: line,
                  startColumn: 1,
                  endLineNumber: line,
                  endColumn: 1,
                },
                options: {
                  isWholeLine: true,
                  className: "diff-flash-highlight",
                  zIndex: 100,
                },
              },
            ],
          );

          // Remove decoration after animation completes (2s per globals.css)
          setTimeout(() => {
            if (modifiedEditor.getModel()) {
              modifiedEditor.deltaDecorations(decorations, []);
            }
          }, 3000);

          break; // only scroll to first match
        }
      }
    }, 500); // Increased timeout to be safer
  };

  return (
    <div
      data-testid="diff-preview-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[80vw] flex-col overflow-hidden rounded-sm border border-[color:var(--ink)] bg-[color:var(--paper)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[color:var(--rule)] px-5 py-3">
          <span className="smallcaps text-[10px] tracking-[0.2em] text-[color:var(--text-muted)]">
            Preview
          </span>
          <span className="text-[15px] font-semibold text-[color:var(--ink)]">
            {title}
          </span>
          <span className="flex-1" />
          {noop && (
            <span
              className="smallcaps text-[10px] tracking-[0.14em]"
              style={{ color: "var(--semantic-warn)" }}
            >
              no-op · file unchanged
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className={close.className}
            style={close.style}
          >
            close
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <DiffEditor
            original={before}
            modified={after}
            language={language ?? "markdown"}
            theme="light"
            onMount={handleEditorMount}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              scrollBeyondLastLine: false,
              scrollbar: {
                vertical: "visible",
                horizontal: "visible",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
