import type { Entity } from "@/core/entities";
import { WireSegment } from "./WireSegment";

interface SignalNodeProps {
  entities: Entity[];
  isWinner: boolean;
  isShadowed: boolean;
}

const AUTHOR_TINT: Record<string, string> = {
  anthropic: "var(--author-anthropic-tint)",
  community: "var(--author-community-tint)",
  you: "var(--author-you-tint)",
  unknown: "var(--author-unknown-tint)",
};

export function SignalNode({ entities, isWinner, isShadowed }: SignalNodeProps) {
  // Use the first entity for coloring, but theoretically they should all share 
  // the same author if they are in the same scope/group.
  const first = entities[0]!;
  const tint = AUTHOR_TINT[first.author];
  const count = entities.length;
  const isEnabled = first.enabled !== false;

  // For the node icon/state, we look at the individual copies.
  // If ANY of them are winners, the cell is a winner.
  // If ALL of them are shadowed, the cell is shadowed.
  const cellIsWinner = isWinner;
  const cellIsShadowed = isShadowed;

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      title={entities.map(e => e.intent).join("\n---\n")}
    >
      <div
        className={[
          "relative flex size-6 items-center justify-center rounded-full border transition-all",
          cellIsWinner
            ? (isEnabled
                ? "border-[color:var(--ink)] bg-[oklch(0.62_0.17_145)] text-white shadow-[0_0_0_1px_var(--ink)]"
                : "border-[color:var(--rule)] bg-[oklch(0.95_0.01_55)] text-[color:var(--text-muted)] shadow-[0_0_0_1px_var(--rule)]")
            : "border-[color:var(--rule)] bg-[oklch(0.95_0.01_55)] text-[color:var(--text-muted)]",
          cellIsShadowed ? "opacity-40" : "",
        ].join(" ")}
        style={{
          boxShadow: cellIsWinner && isEnabled ? `0 0 0 2px ${tint}` : undefined,
        }}
      >
        {cellIsWinner ? (
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : isShadowed ? (
          <svg
            className="size-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : null}

        {count > 1 && (
          <div className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-[color:var(--ink)] text-[9px] font-bold text-[color:var(--paper)] shadow-sm">
            {count}
          </div>
        )}
      </div>
      <WireSegment />
    </div>
  );
}
