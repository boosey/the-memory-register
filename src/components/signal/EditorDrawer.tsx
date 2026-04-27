"use client";
import { useCallback, useRef, useState } from "react";
import type { Entity, EntityType, Relation } from "@/core/entities";
import { TYPE_LABELS } from "./typeLabels";
import { RightRail } from "./editors/RightRail";
import { StandingInstructionEditor } from "./editors/StandingInstructionEditor";
import { PermissionEditor } from "./editors/PermissionEditor";
import { SkillEditor } from "./editors/SkillEditor";
import { CommandEditor } from "./editors/CommandEditor";
import { MemoryEditor } from "./editors/MemoryEditor";
import { HookEditor } from "./editors/HookEditor";
import { EnvVarEditor } from "./editors/EnvVarEditor";
import { KeybindingEditor } from "./editors/KeybindingEditor";
import { PluginEditor } from "./editors/PluginEditor";
import { AgentEditor } from "./editors/AgentEditor";
import { McpServerEditor } from "./editors/McpServerEditor";
import { EnabledPluginsEditor } from "./editors/EnabledPluginsEditor";
import { RawFallbackEditor } from "./editors/RawFallbackEditor";
import { ScopeMover } from "./editors/ScopeMover";
import { ResolveConflict } from "./editors/ResolveConflict";
import { ecBtnClass } from "./editors/shared";
import type { EditorApi } from "./editors/editorTypes";

interface EditorDrawerProps {
  entity: Entity;
  group: readonly Entity[];
  allEntities: readonly Entity[];
  relations: readonly Relation[];
  onClose: () => void;
  onSaved: () => void;
  onOpenEntity?: (e: Entity) => void;
}

type TabKey = "edit" | "scope" | "resolve";

export function EditorDrawer({
  entity,
  group,
  allEntities,
  relations,
  onClose,
  onSaved,
  onOpenEntity,
}: EditorDrawerProps) {
  const [tab, setTab] = useState<TabKey>("edit");
  const apiRef = useRef<EditorApi>({
    getSerializedContent: () => entity.rawContent,
  });
  const [currentTitle, setCurrentTitle] = useState<string>(entity.title);
  const [currentStanzas, setCurrentStanzas] = useState<string[]>([]);

  const onApiReady = useCallback((api: EditorApi) => {
    apiRef.current = api;
    if (api.stanzas) setCurrentStanzas(api.stanzas);
  }, []);

  const onTitleChange = useCallback((t: string) => {
    setCurrentTitle(t);
  }, []);

  const onStanzasChange = useCallback((s: string[]) => {
    setCurrentStanzas(s);
    apiRef.current.stanzas = s;
  }, []);

  const typeLabel = TYPE_LABELS[entity.type].label;
  const contested = group.length > 1;
  const close = ecBtnClass();

  function renderEditor() {
    const t: EntityType = entity.type;
    const common = { entity, onApiReady, onTitleChange, onStanzasChange };
    switch (t) {
      case "standing-instruction":
        return <StandingInstructionEditor {...common} relations={relations} />;
      case "permission":
        return <PermissionEditor {...common} />;
      case "skill":
        return <SkillEditor {...common} />;
      case "command":
        return (
          <CommandEditor
            {...common}
            onConverted={() => {
              onSaved();
              onClose();
            }}
          />
        );
      case "memory":
        return (
          <MemoryEditor
            {...common}
            relations={relations}
            onSaved={onSaved}
          />
        );
      case "hook":
        return <HookEditor {...common} />;
      case "env":
        return <EnvVarEditor {...common} />;
      case "keybinding":
        return <KeybindingEditor {...common} />;
      case "plugin":
        return (
          <PluginEditor
            {...common}
            relations={relations}
            allEntities={allEntities}
            {...(onOpenEntity ? { onOpenEntity } : {})}
          />
        );
      case "agent":
        return <AgentEditor {...common} />;
      case "mcp-server":
        return <McpServerEditor {...common} />;
      case "enabled-plugins":
        return <EnabledPluginsEditor {...common} />;
      default:
        return <RawFallbackEditor {...common} />;
    }
  }

  return (
    <div
      data-testid="editor-drawer"
      data-entity-id={entity.id}
      onClick={(e) => e.stopPropagation()}
      className="grid border-t border-b border-[color:var(--rule)] bg-[color:var(--paper-deep)] gap-6"
      style={{
        padding: "18px 28px",
        gridTemplateColumns: "1fr 320px",
      }}
    >
      <div>
        <div className="mb-[12px] flex items-center gap-3">
          <span className="smallcaps text-[10px] tracking-[0.18em] text-[color:var(--text-muted)]">
            Editing · {typeLabel}
          </span>
          <span className="text-[18px] font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
            {currentTitle}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            data-testid="editor-drawer-close"
            className={close.className}
            style={close.style}
          >
            close
          </button>
        </div>

        <div className="mb-[16px] flex gap-[20px] border-b border-[color:var(--rule)]">
          {(
            [
              ["edit", "Edit"],
              ...(!entity.plugin || entity.type === "plugin"
                ? ([["scope", "Move scope"]] as const)
                : []),
              ...(contested ? ([["resolve", "Resolve conflict"]] as const) : []),
            ] as const
          ).map(([k, l]) => {
            const active = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k as TabKey)}
                data-testid={`editor-tab-${k}`}
                data-active={active ? "true" : "false"}
                className="cursor-pointer border-none bg-transparent px-0 py-[8px] text-[12.5px]"
                style={{
                  borderBottom: active
                    ? "2px solid var(--ink)"
                    : "2px solid transparent",
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--ink)" : "var(--text-muted)",
                }}
              >
                {l}
              </button>
            );
          })}
        </div>

        {tab === "edit" && renderEditor()}
        {tab === "scope" && (
          <ScopeMover
            entity={entity}
            onMoved={() => {
              onSaved();
              onClose();
            }}
          />
        )}
        {tab === "resolve" && contested && (
          <ResolveConflict
            group={group}
            winner={entity}
            onResolved={() => {
              onSaved();
              onClose();
            }}
          />
        )}
      </div>

      <RightRail
        entity={entity}
        currentFormTitle={currentTitle}
        api={apiRef.current}
        onSaved={() => {
          onSaved();
        }}
        stanzas={currentStanzas}
      />
    </div>
  );
}
