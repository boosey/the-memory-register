import {
  test,
  expect,
  waitForSignalFlow,
  clickTypeTab,
} from "./fixtures";
import fs from "node:fs/promises";
import path from "node:path";

const FIXTURE = path.resolve(process.cwd(), "tests/fixtures/sample-claude-home");
const BACKUPS = path.join(FIXTURE, "the-memory-register-backups");

const CONTESTED = "contested-skill";
const GLOBAL_SKILL_DIR = path.join(FIXTURE, "skills", CONTESTED);
const PROJECT_SKILL_DIR = path.join(
  FIXTURE,
  ".fixture-project",
  ".claude",
  "skills",
  CONTESTED,
);
const GLOBAL_SKILL_FILE = path.join(GLOBAL_SKILL_DIR, "SKILL.md");
const PROJECT_SKILL_FILE = path.join(PROJECT_SKILL_DIR, "SKILL.md");

const GLOBAL_SRC = `---
name: ${CONTESTED}
description: Global-scope copy
---
Global body.
`;
const PROJECT_SRC = `---
name: ${CONTESTED}
description: Project-scope copy
---
Project body.
`;

test("bulk resolve-to-winner deletes shadowed skill copies while preserving winner", async ({
  page,
}) => {
  // Seed a contested skill pair (file-backed, bulk-deletable).
  await fs.mkdir(GLOBAL_SKILL_DIR, { recursive: true });
  await fs.mkdir(PROJECT_SKILL_DIR, { recursive: true });
  await fs.writeFile(GLOBAL_SKILL_FILE, GLOBAL_SRC, "utf8");
  await fs.writeFile(PROJECT_SKILL_FILE, PROJECT_SRC, "utf8");

  try {
    // Graph cache TTL is 5s — wait past it so the fresh seed is picked up.
    await new Promise((r) => setTimeout(r, 5_200));
    await waitForSignalFlow(page);
    await clickTypeTab(page, "skill");

    const row = page.locator("[data-row-id]", {
      hasText: new RegExp(CONTESTED, "i"),
    }).first();
    await row.waitFor({ state: "visible", timeout: 10_000 });

    await row.locator('[data-testid="row-checkbox"]').click();

    const bar = page.getByTestId("bulk-action-bar");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/contested/i);

    await page.getByTestId("bulk-action-resolve-to-winner").click();
    await page.waitForTimeout(1200);

    // Winner (highest-precedence = project) preserved; loser (global) gone.
    const globalExists = await fs
      .access(GLOBAL_SKILL_FILE)
      .then(() => true)
      .catch(() => false);
    const projectExists = await fs
      .access(PROJECT_SKILL_FILE)
      .then(() => true)
      .catch(() => false);
    expect(projectExists).toBe(true);
    expect(globalExists).toBe(false);

    const backupDirs = await fs.readdir(BACKUPS).catch(() => [] as string[]);
    expect(backupDirs.length).toBeGreaterThan(0);
  } finally {
    await fs
      .rm(GLOBAL_SKILL_DIR, { recursive: true, force: true })
      .catch(() => {});
    await fs
      .rm(PROJECT_SKILL_DIR, { recursive: true, force: true })
      .catch(() => {});
    await fs.rm(BACKUPS, { recursive: true, force: true });
  }
});
