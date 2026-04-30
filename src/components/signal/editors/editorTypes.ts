import type { Entity } from "@/core/entities";

export interface EditorApi {
  getSerializedContent: (options?: { isNew?: boolean }) => string;
  currentTitle?: string;
  /** Strings that identify the section(s) being edited (e.g. headings, keys).
   * Used by DiffPreviewModal to scroll to and highlight the changes. */
  stanzas?: string[];
  sourceFile?: string;
  scopeRoot?: string;
  expectedMtimeMs?: number;
}

export interface TypedEditorProps {
  entity: Entity;
  onApiReady: (api: EditorApi) => void;
  /** Called whenever currentTitle changes — drives RightRail "Writes to" preview. */
  onTitleChange?: (title: string) => void;
}
