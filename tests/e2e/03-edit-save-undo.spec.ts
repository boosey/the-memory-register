import { test, expect, waitForInventory, clickCardByTitle } from "./fixtures";
import fs from "node:fs/promises";
import path from "node:path";

const FIXTURE = path.resolve(process.cwd(), "tests/fixtures/sample-claude-home");
const SETTINGS_FILE = path.join(FIXTURE, "settings.json");
const BACKUPS = path.join(FIXTURE, "memmgmt-backups");

test("edit permission -> diff preview -> save -> backup exists -> undo restores", async ({
  page,
}) => {
  const before = await fs.readFile(SETTINGS_FILE, "utf8");
  try {
    await waitForInventory(page);
    // Click the "Bash(git *)" permission card
    await clickCardByTitle(page, /Bash\(git \*\)/);

    // In the structured editor, find the value input (font-mono styling) and change it
    const input = page.locator('aside input.font-mono').first();
    await input.waitFor({ state: "visible", timeout: 5_000 });
    await input.fill("Bash(git status)");

    // Trigger diff preview (first "save"-named button is "Preview save")
    await page.getByRole("button", { name: /save/i }).first().click();
    await expect(
      page.getByText(/preview save|before|after/i).first(),
    ).toBeVisible();

    // Confirm save (exact match "Save" inside the diff modal)
    await page.getByRole("button", { name: /^save$/i }).last().click();

    // Backup directory should exist with a timestamped subdir
    // Give the save a moment to flush
    await page.waitForTimeout(500);
    const backupDirs = await fs.readdir(BACKUPS).catch(() => [] as string[]);
    expect(backupDirs.length).toBeGreaterThan(0);

    // Undo
    await page.getByRole("button", { name: /undo/i }).click();
    await page.waitForTimeout(500);
    const after = await fs.readFile(SETTINGS_FILE, "utf8");
    expect(after).toBe(before);
  } finally {
    // Always restore the fixture in case the test aborts mid-run
    await fs.writeFile(SETTINGS_FILE, before, "utf8");
    await fs.rm(BACKUPS, { recursive: true, force: true });
  }
});
