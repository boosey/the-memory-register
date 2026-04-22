import path from "node:path";
import os from "node:os";

export function resolveImport(
  ref: string,
  fromFile: string,
  home: string = os.homedir(),
): string | null {
  if (!/[\/\\]/.test(ref) && !ref.startsWith("~")) return null;
  if (ref.startsWith("~/") || ref === "~") {
    return path.join(home, ref.slice(2) || "");
  }
  if (path.isAbsolute(ref)) return ref;
  return path.resolve(path.dirname(fromFile), ref);
}
