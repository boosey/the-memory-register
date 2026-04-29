import {
  test,
  expect,
  waitForSignalFlow,
  clickTypeTab,
} from "./fixtures";
import fs from "node:fs/promises";
import path from "node:path";

const FIXTURE = path.resolve(process.cwd(), "tests/fixtures/sample-claude-home");
const COMMANDS_DIR = path.join(FIXTURE, "commands");
const BACKUPS = path.join(FIXTURE, "the-memory-register-backups");

const THROWAWAY = "throwaway-to-delete";
const THROWAWAY_FILE = path.join(COMMANDS_DIR, `${THROWAWAY}.md`);
const THROWAWAY_SRC = `---
description: Throwaway command for bulk-delete E2E
---
Body.
`;

test("bulk delete-entity confirm dialog → deletes all scope copies + backs up", async ({
  page,
}) => {
  await fs.mkdir(COMMANDS_DIR, { recursive: true });
  await fs.writeFile(THROWAWAY_FILE, THROWAWAY_SRC, "utf8");

  try {
    // Graph cache TTL is 5s — wait past it so the fresh seed is picked up.
    await new Promise((r) => setTimeout(r, 5_200));
    await waitForSignalFlow(page);
    await clickTypeTab(page, "command");

    const row = page.locator("[data-row-id]", {
      hasText: new RegExp(`/?${THROWAWAY}`, "i"),
    }).first();
    await row.waitFor({ state: "visible", timeout: 10_000 });
    await row.locator('[data-testid="row-checkbox"]').click();

    const bar = page.getByTestId("bulk-action-bar");
    await expect(bar).toBeVisible();

    // Click Delete entity — opens confirmation dialog.
    await page.getByTestId("bulk-action-delete-entity").click();

    // Confirmation dialog appears.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/delete/i);

    // Confirm.
    await dialog.getByRole("button", { name: /^delete$/i }).click();
    await page.waitForTimeout(1000);

    // Command file should be gone.
    const exists = await fs
      .access(THROWAWAY_FILE)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);

    // Backup directory exists.
    const backupDirs = await fs.readdir(BACKUPS).catch(() => [] as string[]);
    expect(backupDirs.length).toBeGreaterThan(0);
  } finally {
    await fs
      .rm(THROWAWAY_FILE, { force: true })
      .catch(() => {});
    await fs.rm(BACKUPS, { recursive: true, force: true });
  }
});
