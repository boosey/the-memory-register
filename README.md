# The Memory Register

Local-only web UI for managing your Claude Code configuration surface — CLAUDE.md, skills, slash commands, settings, hooks, keybindings, and auto-memory — across Global, Slug, Plugin, Project, and Local scopes.

## Install & run

```bash
npx the-memory-register       # or: bunx the-memory-register
```

Opens `http://127.0.0.1:<port>` in your default browser. Ctrl-C to exit.

## What it does (v1)

- Crawls every Claude Code config artifact on disk.
- Renders a hybrid scope-layered inventory + React Flow graph.
- Structured forms per artifact type + raw Monaco escape hatch.
- Edits flow through diff preview → timestamped backup → one-click undo.

No LLM, no cloud, no account. Your filesystem is the database.

## Custom port

```bash
PORT=8080 npx the-memory-register
```

Default port probing tries 5174–5199 in order. Override `PORT` if you need a specific one.

## Scope coverage

| Scope | Path |
|---|---|
| Global | `~/.claude/` |
| Slug | `~/.claude/projects/<slug>/` |
| Plugin | `~/.claude/plugins/` |
| Project | `<project>/CLAUDE.md` + `<project>/.claude/` |
| Local | `<project>/CLAUDE.local.md` + `<project>/.claude/settings.local.json` |

## Editing & safety

- Diff preview before every save.
- Originals backed up to `~/.claude/the-memory-register-backups/<iso>/<relative-path>`.
- Undo restores the most recent backup.
- Concurrent-edit detection via file mtime.

## Development

```bash
pnpm install
pnpm dev            # hot-reload dev server
pnpm test           # vitest
pnpm typecheck
pnpm build && pnpm the-memory-register:launch-dev   # standalone smoke
```

## License

MIT.
