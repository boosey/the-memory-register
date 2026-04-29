// Shared mock data for the-memory-register design exploration.
// Represents a plausible Claude Code life: 4 projects, some plugins,
// some global memory, a couple ghosts, a couple dead imports.

window.MEM_DATA = (function () {
  const SCOPES = {
    global:  { key: 'global',  label: 'Global',  path: '~/.claude',               order: 1 },
    plugin:  { key: 'plugin',  label: 'Plugin',  path: '~/.claude/plugins',       order: 2 },
    slug:    { key: 'slug',    label: 'Slug',    path: '~/.claude/projects/<slug>', order: 3 },
    project: { key: 'project', label: 'Project', path: '<project>/.claude',       order: 4 },
    local:   { key: 'local',   label: 'Local',   path: '<project>/.claude (local)', order: 5 },
  };

  // Provenance buckets → card color. Editorial-muted oklch.
  const AUTHORS = {
    anthropic: { key: 'anthropic', label: 'Anthropic',  color: 'oklch(0.55 0.11 245)',  tint: 'oklch(0.96 0.02 245)', ink: 'oklch(0.35 0.09 245)' },
    community: { key: 'community', label: 'Community',  color: 'oklch(0.58 0.12 155)',  tint: 'oklch(0.96 0.025 155)', ink: 'oklch(0.38 0.1 155)' },
    you:       { key: 'you',       label: 'You',        color: 'oklch(0.50 0.12 45)',   tint: 'oklch(0.96 0.025 55)', ink: 'oklch(0.36 0.1 45)' },
    unknown:   { key: 'unknown',   label: 'Unknown',    color: 'oklch(0.55 0.01 60)',   tint: 'oklch(0.95 0.005 60)', ink: 'oklch(0.35 0.01 60)' },
  };

  // Entity kinds. The user thinks in these, not in file paths.
  const TYPES = {
    'standing-instruction': { label: 'Standing Instruction', plural: 'Standing Instructions', glyph: '§', blurb: 'Things Claude should always do, remember, or prefer.' },
    'permission':           { label: 'Permission',           plural: 'Permissions',           glyph: '∙', blurb: 'Allow/deny rules for tools and shell access.' },
    'skill':                { label: 'Skill',                plural: 'Skills',                glyph: '◇', blurb: 'Named capabilities Claude can invoke on demand.' },
    'memory':               { label: 'Memory',               plural: 'Memories',              glyph: '◉', blurb: 'Auto-curated notes from past sessions.' },
    'hook':                 { label: 'Hook',                 plural: 'Hooks',                 glyph: '↯', blurb: 'Scripts that run on tool events.' },
    'env':                  { label: 'Env Var',              plural: 'Env Vars',              glyph: '$', blurb: 'Environment values Claude passes to tools.' },
    'keybinding':           { label: 'Keybinding',           plural: 'Keybindings',           glyph: '⌘', blurb: 'Shortcut chords.' },
    'plugin':               { label: 'Plugin',               plural: 'Plugins',               glyph: '⬡', blurb: 'Bundles that contribute skills and commands.' },
    'command':              { label: 'Slash Command',        plural: 'Slash Commands',        glyph: '/', blurb: 'Named prompts invoked with / inside chat.' },
  };

  // Entity-first display order, in descending importance/frequency.
  const TYPE_ORDER = ['standing-instruction','permission','plugin','skill','command','memory','hook','env','keybinding'];

  // Projects the user works in (decoded from ~/.claude/projects/<slug>/).
  const PROJECTS = [
    { slug: 'the-memory-register',      path: '~/code/the-memory-register',       active: true,  sessions: 47, lastActive: '2d ago',  turns: 1284 },
    { slug: 'claude-docs',  path: '~/code/claude-docs',   active: true,  sessions: 12, lastActive: '5d ago',  turns: 318 },
    { slug: 'api-gateway',  path: '~/work/api-gateway',   active: true,  sessions: 8,  lastActive: '3w ago',  turns: 142 },
    { slug: 'pilot-2024',   path: '~/archive/pilot-2024', active: false, sessions: 3,  lastActive: '4mo ago', turns: 47,  ghost: true },
    { slug: 'side-thing',   path: '~/tmp/side-thing',     active: false, sessions: 1,  lastActive: '6mo ago', turns: 9,   ghost: true },
  ];

  // Artifacts. Each one is a node. Identity keys make overrides detectable.
  // scopes/authors link back. "identity" is the override-identity-key (§5.4.1).
  const A = [
    // ── CLAUDE.md sections
    { id:'g-claude-style',   type:'standing-instruction', scope:'global',  author:'you',       title:'Writing style',        intent:'Prefer concise, direct prose. No marketing fluff.', identity:'h2:writing-style', imports:['@style-guide.md'] },
    { id:'p-claude-style',   type:'standing-instruction', scope:'project', author:'you',       title:'Writing style',        intent:'Docs use active voice, present tense, 2nd-person.', identity:'h2:writing-style' },
    { id:'l-claude-style',   type:'standing-instruction', scope:'local',   author:'you',       title:'Writing style',        intent:'(dev-only) allow dry humor in code comments.',       identity:'h2:writing-style' },

    { id:'g-claude-review',  type:'standing-instruction', scope:'global',  author:'you',       title:'Code review',          intent:'Always run pnpm typecheck before commit.',           identity:'h2:code-review' },
    { id:'p-claude-review',  type:'standing-instruction', scope:'project', author:'you',       title:'Code review',          intent:'Also run bun test --coverage on PRs.',               identity:'h2:code-review' },

    { id:'g-claude-output',  type:'standing-instruction', scope:'global',  author:'you',       title:'Output formatting',    intent:'No emoji. Tables only when comparing ≥3 things.',     identity:'h2:output-formatting' },

    { id:'p-claude-stack',   type:'standing-instruction', scope:'project', author:'you',       title:'Stack notes',          intent:'Next.js 15 + React 19. No class components.',         identity:'h2:stack-notes',  imports:['@docs/stack.md','@./missing-notes.md'] },

    // ── Skills
    { id:'g-skill-plans',    type:'skill',   scope:'global',  author:'anthropic', title:'writing-plans',         intent:'Structured implementation-plan generator.',            identity:'skill:writing-plans' },
    { id:'g-skill-commit',   type:'skill',   scope:'global',  author:'anthropic', title:'commit-messages',       intent:'Write conventional commits from a diff.',              identity:'skill:commit-messages' },
    { id:'g-skill-brainstorm',type:'skill',  scope:'global',  author:'you',       title:'brainstorm',            intent:'Loose divergent ideation mode.',                       identity:'skill:brainstorm' },
    { id:'pl-skill-sqlfmt',  type:'skill',   scope:'plugin',  author:'community', title:'sqlfmt',                intent:'Format SQL with sqlfluff.',                            identity:'skill:sqlfmt', plugin:'dbtools' },
    { id:'pl-skill-mdx',     type:'skill',   scope:'plugin',  author:'community', title:'mdx-lint',              intent:'Lint MDX files for broken imports.',                   identity:'skill:mdx-lint', plugin:'mdx-pack' },
    { id:'pl-skill-review',  type:'skill',   scope:'plugin',  author:'unknown',   title:'pr-review',             intent:'(no description)',                                     identity:'skill:pr-review', plugin:'legacy-kit' },
    { id:'p-skill-dbmig',    type:'skill',   scope:'project', author:'you',       title:'db-migrations',         intent:'Run Postgres migrations with drizzle-kit.',            identity:'skill:db-migrations' },

    // ── Settings entries (permissions, hooks, env)
    { id:'g-perm-bash-git',  type:'permission', scope:'global', author:'you',     title:'Bash(git *)',           intent:'Allow all git shell commands.',                        identity:'perm:Bash(git *)' },
    { id:'p-perm-bash-git',  type:'permission', scope:'project',author:'you',     title:'Bash(git *)',           intent:'Allow, but block force-push pattern.',                 identity:'perm:Bash(git *)' },
    { id:'g-perm-bash-rm',   type:'permission', scope:'global', author:'you',     title:'Bash(rm *)',            intent:'Deny. Always ask first.',                              identity:'perm:Bash(rm *)' },

    { id:'g-hook-pretool',   type:'hook',    scope:'global',  author:'you',       title:'PreToolUse → log',      intent:'Log every tool call to ~/.claude/audit.log.',          identity:'hook:PreToolUse/log' },
    { id:'p-hook-posttool',  type:'hook',    scope:'project', author:'you',       title:'PostToolUse → format',  intent:'Run biome on any edited .ts file.',                    identity:'hook:PostToolUse/format' },

    { id:'g-env-editor',     type:'env',     scope:'global',  author:'you',       title:'EDITOR',                intent:'code --wait',                                           identity:'env:EDITOR' },
    { id:'l-env-editor',     type:'env',     scope:'local',   author:'you',       title:'EDITOR',                intent:'hx (helix) — local override',                           identity:'env:EDITOR' },
    { id:'g-env-timeout',    type:'env',     scope:'global',  author:'you',       title:'MCP_TIMEOUT',           intent:'30000',                                                 identity:'env:MCP_TIMEOUT' },

    // ── Memory (slug)
    { id:'s-mem-user-tone',  type:'memory',  scope:'slug',    author:'you',       title:'user_tone.md',          intent:'User prefers short direct answers, no preamble.',      identity:'mem:user_tone', slugRef:'the-memory-register' },
    { id:'s-mem-feedback-1', type:'memory',  scope:'slug',    author:'you',       title:'feedback_no_emoji.md',  intent:'Corrected 4× for using emoji in code comments.',       identity:'mem:feedback_no_emoji', slugRef:'the-memory-register' },
    { id:'s-mem-project-stack',type:'memory',scope:'slug',    author:'you',       title:'project_stack.md',      intent:'Project uses Drizzle ORM, not Prisma.',                identity:'mem:project_stack', slugRef:'the-memory-register' },
    { id:'s-mem-ref-schema', type:'memory',  scope:'slug',    author:'you',       title:'reference_schema.md',   intent:'Indexed copy of the DB schema, stale 2w.',             identity:'mem:reference_schema', slugRef:'the-memory-register', stale:true },

    // ── Slash commands
    { id:'g-cmd-ship',       type:'command', scope:'global',  author:'you',       title:'/ship',                  intent:'Create PR with conventional-commit title + changelog.',identity:'cmd:ship' },
    { id:'p-cmd-ship',       type:'command', scope:'project', author:'you',       title:'/ship',                  intent:'Project override — also run bun test before opening PR.', identity:'cmd:ship' },
    { id:'g-cmd-review',     type:'command', scope:'global',  author:'you',       title:'/review',                intent:'Review the current diff for regressions + style.',    identity:'cmd:review' },
    { id:'pl-cmd-sql',       type:'command', scope:'plugin',  author:'community', title:'/sql',                   intent:'Run a SQL query against the project DB (dbtools).',    identity:'cmd:sql', plugin:'dbtools' },
    { id:'p-cmd-migrate',    type:'command', scope:'project', author:'you',       title:'/migrate',               intent:'Generate + apply next drizzle migration.',             identity:'cmd:migrate' },

    // ── Keybindings
    { id:'g-kb',             type:'keybinding', scope:'global', author:'you',     title:'keybindings.json',      intent:'12 chords defined. cmd-K = command palette.',           identity:'kb:set' },

    // ── Plugin manifests
    { id:'pl-plug-dbtools',  type:'plugin',  scope:'plugin',  author:'community', title:'dbtools',               intent:'DB utilities — 3 skills.',                             identity:'plugin:dbtools' },
    { id:'pl-plug-mdx',      type:'plugin',  scope:'plugin',  author:'community', title:'mdx-pack',              intent:'MDX helpers — 2 skills.',                              identity:'plugin:mdx-pack' },
    { id:'pl-plug-legacy',   type:'plugin',  scope:'plugin',  author:'unknown',   title:'legacy-kit',            intent:'No manifest author. Installed 8mo ago.',               identity:'plugin:legacy-kit', warn:true },
  ];

  // Cross-entity relationships (beyond scope override).
  // Each edge is: { from, to, kind, note }.
  // kind: 'provides' | 'invokes' | 'gates' | 'imports' | 'fires-on' | 'accretes-from'
  const RELATIONS = [
    // Plugins provide skills and commands
    { from:'pl-plug-dbtools', to:'pl-skill-sqlfmt', kind:'provides' },
    { from:'pl-plug-mdx',     to:'pl-skill-mdx',    kind:'provides' },
    { from:'pl-plug-legacy',  to:'pl-skill-review', kind:'provides' },
    { from:'pl-plug-dbtools', to:'pl-cmd-sql',      kind:'provides' },

    // Permissions gate tool families
    { from:'g-perm-bash-git', to:'tool:Bash',  kind:'gates', note:'allows git shell calls' },
    { from:'p-perm-bash-git', to:'tool:Bash',  kind:'gates', note:'denies force-push' },
    { from:'g-perm-bash-rm',  to:'tool:Bash',  kind:'gates', note:'denies rm' },

    // Hooks fire on tool events
    { from:'g-hook-pretool',  to:'tool:*',     kind:'fires-on', note:'PreToolUse on every call' },
    { from:'p-hook-posttool', to:'tool:Write', kind:'fires-on', note:'PostToolUse on .ts writes' },

    // Standing instructions import other files
    { from:'g-claude-style',  to:'@style-guide.md', kind:'imports' },
    { from:'p-claude-stack',  to:'@docs/stack.md',  kind:'imports' },
    { from:'p-claude-stack',  to:'@./missing-notes.md', kind:'imports', broken:true },

    // Memories accrete from sessions
    { from:'s-mem-user-tone',    to:'slug:the-memory-register', kind:'accretes-from', note:'47 sessions' },
    { from:'s-mem-feedback-1',   to:'slug:the-memory-register', kind:'accretes-from', note:'4 corrections' },
    { from:'s-mem-project-stack',to:'slug:the-memory-register', kind:'accretes-from', note:'12 sessions' },
    { from:'s-mem-ref-schema',   to:'slug:the-memory-register', kind:'accretes-from', note:'stale 14d' },
  ];

  const REL_KINDS = {
    'provides':      { label: 'provides',      arrow: '→', inbound: 'provided by' },
    'invokes':       { label: 'invokes',       arrow: '→', inbound: 'invoked by' },
    'gates':         { label: 'gates',         arrow: '⊸', inbound: 'gated by' },
    'imports':       { label: 'imports',       arrow: '@',  inbound: 'imported by' },
    'fires-on':      { label: 'fires on',      arrow: '↯', inbound: 'triggers' },
    'accretes-from': { label: 'accretes from', arrow: '◉', inbound: 'feeds' },
  };

  // Health issues — ghost slugs, dead imports, stale memory, unknown authors.
  const HEALTH = [
    { kind:'ghost-slug',   severity:'warn',  title:'pilot-2024',        detail:'Project path missing. 3 sessions orphaned.' },
    { kind:'ghost-slug',   severity:'warn',  title:'side-thing',        detail:'Project path missing. 1 session orphaned.' },
    { kind:'dead-import',  severity:'error', title:'@./missing-notes.md', detail:'Referenced from project CLAUDE.md → Stack notes.' },
    { kind:'unknown-author',severity:'warn', title:'legacy-kit',        detail:'Plugin manifest has no author. Installed 8mo ago.' },
    { kind:'stale-memory', severity:'info',  title:'reference_schema.md', detail:'Not touched in 14d. DB schema likely drifted.' },
    { kind:'contradiction',severity:'warn',  title:'EDITOR',            detail:'Global says `code --wait`; local says `hx`.' },
  ];

  return { SCOPES, AUTHORS, TYPES, TYPE_ORDER, PROJECTS, ARTIFACTS: A, RELATIONS, REL_KINDS, HEALTH };
})();
