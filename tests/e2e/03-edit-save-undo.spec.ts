import {
  test,
  expect,
  waitForSignalFlow,
  clickTypeTab,
  openEditorForTitle,
} from "./fixtures";
import fs from "node:fs/promises";
import path from "node:path";

const FIXTURE = path.resolve(process.cwd(), "tests/fixtures/sample-claude-home");
const SKILL_FILE = path.join(FIXTURE, "skills", "demo-skill", "SKILL.md");
const BACKUPS = path.join(FIXTURE, "the-memory-register-backups");

test("skill edit → preview diff → save with backup → undo restores", async ({
  page,
}) => {
  const before = await fs.readFile(SKILL_FILE, "utf8");
  try {
    await waitForSignalFlow(page);
    await clickTypeTab(page, "skill");
    await openEditorForTitle(page, /demo-skill/i);

    // Edit the description textarea.
    const descBox = page.locator('textarea').nth(0);
    await descBox.waitFor({ state: "visible", timeout: 5_000 });
    const originalDesc = await descBox.inputValue();
    await descBox.fill(`${originalDesc} (edited by e2e)`);

    // Preview diff via RightRail.
    await page.getByTestId("right-rail-preview").click();
    const modal = page.getByTestId("diff-preview-modal");
    await expect(modal).toBeVisible();
    // Close the modal (close button inside the modal header).
    await modal.getByRole("button", { name: /close/i }).click();
    await expect(modal).toBeHidden();

    // Save with backup.
    await page.getByTestId("right-rail-save").click();
    await page.waitForTimeout(800);

    // Disk reflects the edit.
    const afterSave = await fs.readFile(SKILL_FILE, "utf8");
    expect(afterSave).not.toBe(before);
    expect(afterSave).toContain("edited by e2e");

    // Backup directory exists with at least one timestamped subdir.
    const backupDirs = await fs.readdir(BACKUPS).catch(() => [] as string[]);
    expect(backupDirs.length).toBeGreaterThan(0);

    // Sonner toast renders with Undo action.
    const undoBtn = page.getByRole("button", { name: /^undo$/i });
    await undoBtn.waitFor({ state: "visible", timeout: 5_000 });
    await undoBtn.click();
    await page.waitForTimeout(800);

    const afterUndo = await fs.readFile(SKILL_FILE, "utf8");
    expect(afterUndo).toBe(before);
  } finally {
    // Always restore the fixture, even on mid-test abort.
    await fs.writeFile(SKILL_FILE, before, "utf8");
    await fs.rm(BACKUPS, { recursive: true, force: true });
  }
});
