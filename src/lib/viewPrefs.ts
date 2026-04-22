import fs from "node:fs/promises";
import { resolveHomePaths } from "@/core/paths";

export interface ViewPrefs {
  activeTab: "inventory" | "graph";
  showConnections: boolean;
  filters: { scopes: string[]; types: string[]; authors: string[] };
  sidebarWidthPx: number;
}

const DEFAULT: ViewPrefs = {
  activeTab: "inventory",
  showConnections: false,
  filters: { scopes: [], types: [], authors: [] },
  sidebarWidthPx: 420,
};

export async function loadViewPrefs(): Promise<ViewPrefs> {
  const { viewPrefsFile } = resolveHomePaths();
  try {
    const text = await fs.readFile(viewPrefsFile, "utf8");
    return { ...DEFAULT, ...(JSON.parse(text) as Partial<ViewPrefs>) };
  } catch {
    return DEFAULT;
  }
}

export async function saveViewPrefs(next: ViewPrefs): Promise<void> {
  const { viewPrefsFile } = resolveHomePaths();
  await fs.writeFile(viewPrefsFile, JSON.stringify(next, null, 2) + "\n", "utf8");
}
