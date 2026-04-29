import os from "node:os";
import path from "node:path";

export interface HomePaths {
  claudeHome: string;
  projectsDir: string;
  pluginsDir: string;
  backupsDir: string;
  viewPrefsFile: string;
}

export interface ResolveOverride {
  home?: string;
  claudeHome?: string;
}

export function resolveHomePaths(override?: ResolveOverride): HomePaths {
  const claudeHome =
    override?.claudeHome
    ?? process.env.THE_MEMORY_REGISTER_CLAUDE_HOME
    ?? path.join(override?.home ?? os.homedir(), ".claude");
  return {
    claudeHome,
    projectsDir: path.join(claudeHome, "projects"),
    pluginsDir: path.join(claudeHome, "plugins"),
    backupsDir: path.join(claudeHome, "the-memory-register-backups"),
    viewPrefsFile: path.join(claudeHome, "the-memory-register-settings.json"),
  };
}
