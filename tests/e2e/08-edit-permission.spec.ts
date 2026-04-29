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
const SETTINGS_FILE = path.join(FIXTURE, "settings.json");
const BACKUPS = path.join(FIXTURE, "the-memory-register-backups");

test("permission edit (Allow → Ask) → save → settings.json moved rule → undo restores", async ({
  page,
}) => {
  const before = await fs.readFile(SETTINGS_FILE, "utf8");
  try {
    await waitForSignalFlow(page);
    await clickTypeTab(page, "permission");
    await openEditorForTitle(page, /Bash\(git \*\)/);

    // Click the "Ask" effect segment.
    await page.getByRole("button", { name: /^Ask$/ }).click();

    // Compiled preview should update to show "ask".
    await expect(page.getByTestId("permission-compiled")).toContainText(/ask/i);

    // Save with backup.
    await page.getByTestId("right-rail-save").click();
    await page.waitForTimeout(800);

    const afterSave = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
    expect(afterSave.permissions.ask).toContain("Bash(git *)");
    expect(afterSave.permissions.allow ?? []).not.toContain("Bash(git *)");

    const backupDirs = await fs.readdir(BACKUPS).catch(() => [] as string[]);
    expect(backupDirs.length).toBeGreaterThan(0);

    // Undo.
    await page.getByRole("button", { name: /^undo$/i }).click();
    await page.waitForTimeout(800);
    const afterUndo = await fs.readFile(SETTINGS_FILE, "utf8");
    expect(afterUndo).toBe(before);
  } finally {
    await fs.writeFile(SETTINGS_FILE, before, "utf8");
    await fs.rm(BACKUPS, { recursive: true, force: true });
  }
});
