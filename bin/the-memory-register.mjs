#!/usr/bin/env node
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import open from "open";

const PORT_START = 5174;
const PORT_END = 5199;

async function findFreePort(start, end) {
  for (let p = start; p <= end; p++) {
    const free = await new Promise((resolve) => {
      const srv = createServer()
        .once("error", () => resolve(false))
        .once("listening", () => {
          srv.close(() => resolve(true));
        });
      srv.listen(p, "127.0.0.1");
    });
    if (free) return p;
  }
  return null;
}

async function main() {
  const envPort = process.env.PORT ? Number(process.env.PORT) : null;
  const port = envPort ?? (await findFreePort(PORT_START, PORT_END));
  if (!port) {
    console.error(
      `the-memory-register: could not find a free port in ${PORT_START}-${PORT_END}.\n` +
        `Try:  PORT=8080 npx the-memory-register`,
    );
    process.exit(1);
  }
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";

  const here = path.dirname(fileURLToPath(import.meta.url));
  const serverEntry = path.resolve(here, "../.next/standalone/server.js");
  await import(serverEntry);

  const url = `http://127.0.0.1:${port}`;
  console.log(`the-memory-register: serving on ${url}`);
  try {
    await open(url);
  } catch {
    /* browser open is best-effort */
  }
}

main().catch((err) => {
  console.error("the-memory-register: fatal", err);
  process.exit(1);
});
