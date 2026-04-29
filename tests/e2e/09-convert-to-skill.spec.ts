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
const COMMANDS_DIR = path.join(FIXTURE, "commands");
const SKILLS_DIR = path.join(FIXTURE, "skills");
const BACKUPS = path.join(FIXTURE, "the-memory-register-backups");

const THROWAWAY_CMD_NAME = "throwaway-cmd";
const THROWAWAY_CMD_FILE = path.join(
  COMMANDS_DIR,
  `${THROWAWAY_CMD_NAME}.md`,
);
const THROWAWAY_CMD_SRC = `---
description: Throwaway command for convert-to-skill E2E
---
Body of the throwaway command. When invoked, do X.
`;

test("command → Convert to Skill writes new skill file + deletes command + backs up", async ({
  page,
}) => {
  // Seed the throwaway command.
  await fs.mkdir(COMMANDS_DIR, { recursive: true });
  await fs.writeFile(THROWAWAY_CMD_FILE, THROWAWAY_CMD_SRC, "utf8");

  try {
    // Graph cache TTL is 5s — wait past it so the fresh seed is picked up.
    await new Promise((r) => setTimeout(r, 5_200));
    await waitForSignalFlow(page);
    await clickTypeTab(page, "command");
    await openEditorForTitle(page, new RegExp(`/?${THROWAWAY_CMD_NAME}`, "i"));

    // Expand Convert-to-Skill block.
    const convertBlock = page.getByTestId("convert-to-skill");
    await expect(convertBlock).toBeVisible();
    await convertBlock
      .getByRole("button", { name: /convert to skill…/i })
      .click();

    // Fill the skill description (skill name pre-fills from command name).
    const skillDescArea = convertBlock.locator("textarea");
    await skillDescArea.fill(
      "Converted skill — auto-invokes when body X applies.",
    );

    // Click "Convert & back up".
    await convertBlock
      .getByRole("button", { name: /convert & back up/i })
      .click();
    await page.waitForTimeout(1200);

    // Verify the new skill file exists with the command body carried over.
    const newSkillFile = path.join(
      SKILLS_DIR,
      THROWAWAY_CMD_NAME,
      "SKILL.md",
    );
    const skillContent = await fs
      .readFile(newSkillFile, "utf8")
      .catch(() => null);
    expect(skillContent).not.toBeNull();
    expect(skillContent!).toContain("Body of the throwaway command");
    expect(skillContent!).toContain(`name: ${THROWAWAY_CMD_NAME}`);

    // Command file is gone from commands dir.
    const commandExists = await fs
      .access(THROWAWAY_CMD_FILE)
      .then(() => true)
      .catch(() => false);
    expect(commandExists).toBe(false);

    // Backup directory contains the command's original.
    const backupDirs = await fs.readdir(BACKUPS).catch(() => [] as string[]);
    expect(backupDirs.length).toBeGreaterThan(0);
  } finally {
    // Clean: delete the new skill folder if it landed, and restore the command
    // (the backend may have deleted it on success).
    await fs
      .rm(path.join(SKILLS_DIR, THROWAWAY_CMD_NAME), {
        recursive: true,
        force: true,
      })
      .catch(() => {});
    await fs
      .rm(THROWAWAY_CMD_FILE, { force: true })
      .catch(() => {});
    await fs.rm(BACKUPS, { recursive: true, force: true });
  }
});
