"use client";
import { useState } from "react";
import type { SlugPseudoNode } from "@/core/entities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GhostSlugModalProps {
  ghosts: readonly SlugPseudoNode[];
  onClose: () => void;
  onRemoved: () => void;
}

export function GhostSlugModal({
  ghosts,
  onClose,
  onRemoved,
}: GhostSlugModalProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(slug: string) {
    setPending(slug);
    setError(null);
    try {
      const res = await fetch("/api/remove-slug", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.message || "Failed to remove slug");
      onRemoved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Ghost Slugs</DialogTitle>
          <DialogDescription>
            These project directories no longer exist on disk, but their auto-memory
            and session history remain in your Claude config.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {ghosts.length === 0 ? (
            <p className="text-center text-sm text-[color:var(--text-muted)]">
              No ghost slugs found.
            </p>
          ) : (
            ghosts.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-4 rounded-sm border border-[color:var(--rule-soft)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[18px] font-medium text-[color:var(--ink)]">
                    {g.name}
                  </div>
                  <div
                    title={g.projectPath}
                    className="truncate font-mono text-[15px] text-[color:var(--text-muted)]"
                  >
                    {g.projectPath}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemove(g.name)}
                  disabled={!!pending}
                >
                  {pending === g.name ? "Removing..." : "Remove"}
                </Button>
              </div>
            ))
          )}
          {error && (
            <p className="text-sm text-[color:var(--semantic-error)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
