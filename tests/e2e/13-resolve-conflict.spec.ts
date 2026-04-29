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
const BACKUPS = path.join(FIXTURE, "the-memory-register-backups");

const CONTESTED = "conflict-skill";
const GLOBAL_SKILL_DIR = path.join(FIXTURE, "skills", CONTESTED);
const PROJECT_SKILL_DIR = path.join(
  FIXTURE,
  ".fixture-project",
  ".claude",
  "skills",
  CONTESTED,
);
const GLOBAL_FILE = path.join(GLOBAL_SKILL_DIR, "SKILL.md");
const PROJECT_FILE = path.join(PROJECT_SKILL_DIR, "SKILL.md");

test("drawer Resolve conflict tab → make-winner deletes the other scope copy", async ({
  page,
}) => {
  await fs.mkdir(GLOBAL_SKILL_DIR, { recursive: true });
  await fs.mkdir(PROJECT_SKILL_DIR, { recursive: true });
  await fs.writeFile(
    GLOBAL_FILE,
    `---\nname: ${CONTESTED}\ndescription: Global copy\n---\nGlobal body.\n`,
    "utf8",
  );
  await fs.writeFile(
    PROJECT_FILE,
    `---\nname: ${CONTESTED}\ndescription: Project copy\n---\nProject body.\n`,
    "utf8",
  );

  try {
    // Graph cache TTL is 5s — wait past it so the fresh seed is picked up.
    await new Promise((r) => setTimeout(r, 5_200));
    await waitForSignalFlow(page);
    await clickTypeTab(page, "skill");
    await openEditorForTitle(page, new RegExp(CONTESTED, "i"));

    const resolveTab = page.getByTestId("editor-tab-resolve");
    await expect(resolveTab).toBeVisible();
    await resolveTab.click();

    const resolve = page.getByTestId("resolve-conflict");
    await expect(resolve).toBeVisible();

    // The loser row is the non-winner; click its "make winner" button.
    await resolve
      .locator('[data-testid="resolve-row"][data-is-winner="false"]')
      .first()
      .getByRole("button", { name: /make winner/i })
      .click();
    await page.waitForTimeout(1200);

    // The specifically selected Global copy remains; Project (formerly winner) deleted.
    const globalExists = await fs
      .access(GLOBAL_FILE)
      .then(() => true)
      .catch(() => false);
    const projectExists = await fs
      .access(PROJECT_FILE)
      .then(() => true)
      .catch(() => false);
    expect(globalExists).toBe(true);
    expect(projectExists).toBe(false);

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
