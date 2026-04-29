// Type-dispatched inline editors. Each entity kind gets a form tailored
// to its actual shape — not a universal markdown blob.
//
// Shared shell: header · scope tab · resolve-conflict tab (if contested) ·
// right-rail (preview diff / save with backup) · close.
//
// Per-kind forms expose the "body" tab — skills/commands/memories/standing-
// instructions have a body + "view as markdown" escape hatch; permissions/
// hooks/env/keybindings/plugins are purely structured (no markdown view).

const EC_TC = window.MEM_TOKENS;
const EC_HC = window.MEM_HELPERS;
const ED = () => window.MEM_DATA;

// ── Shared shell ──────────────────────────────────────────────
function InlineEditorShell({ group, groupKey, onClose, onJump }) {
  const winner = group[group.length-1];
  const contested = group.length > 1;
  const [tab, setTab] = React.useState('edit');
  const [scope, setScope] = React.useState(winner.scope);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (ref.current) {
      const scroller = ref.current.closest('.mem-scroll');
      if (scroller) {
        const elTop = ref.current.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({ top: Math.max(0, elTop - 120), behavior:'smooth' });
      }
    }
  }, [groupKey]);

  const Form = pickForm(winner.type);
  const typeDef = ED().TYPES[winner.type];

  return (
    <div ref={ref} onClick={e => e.stopPropagation()} style={{
      borderTop:`1px solid ${EC_TC.RULE}`, borderBottom:`1px solid ${EC_TC.RULE}`,
      background:EC_TC.PAPER_DEEP, padding:'18px 28px',
      display:'grid', gridTemplateColumns:'1fr 320px', gap:24,
    }}>
      <div>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
          <span className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.18em'}}>Editing · {typeDef.label}</span>
          <span className="mem-sans" style={{fontSize:18, fontWeight:600, color:EC_TC.INK, letterSpacing:'-0.01em'}}>{winner.title}</span>
          <span style={{flex:1}} />
          <button onClick={onClose} style={ecBtn()}>close</button>
        </div>

        <div style={{display:'flex', gap:20, borderBottom:`1px solid ${EC_TC.RULE}`, marginBottom:16}}>
          {[['edit','Edit'],['scope','Move scope'],['resolve','Resolve conflict']].map(([k,l])=>{
            if (k==='resolve' && !contested) return null;
            const active = tab === k;
            return (
              <button key={k} onClick={()=>setTab(k)} style={{
                background:'none', border:'none', padding:'8px 0', cursor:'pointer',
                borderBottom: active ? `2px solid ${EC_TC.INK}` : '2px solid transparent',
                fontFamily:EC_TC.SANS, fontSize:12.5, fontWeight: active?600:500,
                color: active ? EC_TC.INK : EC_TC.MUTED,
              }}>{l}</button>
            );
          })}
        </div>

        {tab === 'edit'    && <Form winner={winner} group={group} />}
        {tab === 'scope'   && <ScopeMover winner={winner} scope={scope} setScope={setScope} />}
        {tab === 'resolve' && contested && <ResolveConflict group={group} />}
      </div>

      <RightRail winner={winner} />
    </div>
  );
}

function pickForm(type) {
  switch (type) {
    case 'skill':                return SkillForm;
    case 'permission':           return PermissionForm;
    case 'hook':                 return HookForm;
    case 'standing-instruction': return StandingInstructionForm;
    case 'memory':               return MemoryForm;
    case 'keybinding':           return KeybindingForm;
    case 'env':                  return EnvVarForm;
    case 'plugin':               return PluginForm;
    case 'command':              return CommandForm;
    default:                     return StandingInstructionForm;
  }
}

// ── Shared pieces ─────────────────────────────────────────────
function ecBtn(primary, destructive) {
  const c = destructive ? 'oklch(0.52 0.18 28)' : EC_TC.INK;
  return {
    background: primary ? c : 'transparent',
    color: primary ? EC_TC.PAPER : c,
    border:`1px solid ${c}`,
    padding:'5px 11px', borderRadius:2,
    fontFamily:EC_TC.SANS, fontSize:11.5, fontWeight:500,
    cursor:'pointer',
  };
}
function ecField() {
  return {
    width:'100%', padding:'8px 10px', border:`1px solid ${EC_TC.RULE}`, borderRadius:2,
    background:EC_TC.PAPER, fontFamily:EC_TC.SANS, fontSize:13.5,
    color:EC_TC.INK, resize:'vertical', outline:'none', lineHeight:1.5,
  };
}
function ecMono() {
  return { ...ecField(), fontFamily:EC_TC.MONO, fontSize:12.5 };
}

function FormRow({ label, hint, children, note }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:5}}>
        <span className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.18em'}}>{label}</span>
        {note && <span className="mem-mono" style={{fontSize:10, color:EC_TC.FAINT}}>· {note}</span>}
      </div>
      {children}
      {hint && <div className="mem-sans" style={{fontSize:11.5, color:EC_TC.FAINT, marginTop:4, lineHeight:1.45}}>{hint}</div>}
    </div>
  );
}

function Chip({ label, active, onClick, color, danger }) {
  const c = danger ? 'oklch(0.52 0.18 28)' : (color || EC_TC.INK);
  return (
    <button onClick={onClick} style={{
      padding:'4px 10px', borderRadius:2,
      border:`1px solid ${active ? c : EC_TC.RULE}`,
      background: active ? c : 'transparent',
      color: active ? EC_TC.PAPER : c,
      fontFamily:EC_TC.SANS, fontSize:11.5, fontWeight:500,
      cursor:'pointer', letterSpacing:'0.01em',
    }}>{label}</button>
  );
}

function BodyEditor({ value, onChange, placeholder, allowMarkdownToggle }) {
  const [mode, setMode] = React.useState('form'); // 'form' | 'markdown'
  const [unknownCount] = React.useState(0);
  return (
    <div style={{border:`1px solid ${EC_TC.RULE}`, borderRadius:2, background:EC_TC.PAPER}}>
      <div style={{padding:'6px 10px', borderBottom:`1px solid ${EC_TC.RULE_SOFT}`, display:'flex', alignItems:'center', gap:14}}>
        {['B','I','H','•','1.','>','</>','@link'].map((t,i) => (
          <button key={i} style={{background:'none', border:'none', cursor:'pointer', fontSize:12, color:EC_TC.MUTED,
            fontFamily: (i===6) ? EC_TC.MONO : EC_TC.SANS,
            fontWeight: i===0 ? 700 : 400, fontStyle: i===1 ? 'italic' : 'normal',
          }}>{t}</button>
        ))}
        {allowMarkdownToggle && (
          <>
            <span style={{flex:1}} />
            <div style={{display:'flex', gap:0, border:`1px solid ${EC_TC.RULE}`, borderRadius:2}}>
              {[['form','Form'],['markdown','Markdown']].map(([k,l])=>(
                <button key={k} onClick={()=>setMode(k)} style={{
                  padding:'3px 9px', border:'none', cursor:'pointer',
                  background: mode===k ? EC_TC.INK : 'transparent',
                  color: mode===k ? EC_TC.PAPER : EC_TC.MUTED,
                  fontFamily:EC_TC.SANS, fontSize:10.5, fontWeight:500, letterSpacing:'0.06em',
                }}>{l}</button>
              ))}
            </div>
          </>
        )}
      </div>
      {mode === 'form' ? (
        <textarea value={value} onChange={e=>onChange(e.target.value)} rows={6} placeholder={placeholder} style={{
          ...ecField(), border:'none', borderRadius:0, background:'transparent', padding:'12px 14px',
        }} />
      ) : (
        <div style={{padding:'12px 14px', fontFamily:EC_TC.MONO, fontSize:12, lineHeight:1.6, color:EC_TC.INK, whiteSpace:'pre-wrap'}}>
          {value}
        </div>
      )}
      {allowMarkdownToggle && unknownCount > 0 && (
        <div style={{padding:'6px 12px', borderTop:`1px solid ${EC_TC.RULE_SOFT}`, fontFamily:EC_TC.MONO, fontSize:10, color:EC_TC.FAINT}}>
          {unknownCount} unknown frontmatter field(s) preserved
        </div>
      )}
    </div>
  );
}

function ScopeMover({ winner, scope, setScope }) {
  return (
    <FormRow label="Move to scope" hint="Changes where this entity lives. Writes with a diff preview + backup.">
      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
        {Object.keys(ED().SCOPES).map(sk => (
          <Chip key={sk} label={sk.toUpperCase()} active={scope===sk} onClick={()=>setScope(sk)} />
        ))}
      </div>
      <div className="mem-sans" style={{fontSize:12, color:EC_TC.MUTED, marginTop:10}}>
        Current: <b style={{color:EC_TC.INK}}>{winner.scope}</b> {scope !== winner.scope && <>→ New: <b style={{color:EC_TC.INK}}>{scope}</b></>}
      </div>
    </FormRow>
  );
}

function ResolveConflict({ group }) {
  const winner = group[group.length-1];
  return (
    <div>
      <div className="mem-sans" style={{fontSize:13, color:EC_TC.MUTED, marginBottom:12, lineHeight:1.5}}>
        Pick one winner. Other scopes can be <b>deleted</b>, <b>merged</b> into the winner, or <b>kept as overrides</b>.
      </div>
      {group.map(a => {
        const isWinner = a === winner;
        return (
          <div key={a.id} style={{
            display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, alignItems:'center',
            padding:'10px 12px', borderTop:`1px solid ${EC_TC.RULE_SOFT}`,
            background: isWinner ? EC_TC.PAPER : 'transparent',
            border: isWinner ? `1px solid ${EC_TC.INK}` : 'none',
          }}>
            <span className="mem-mono mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.14em', minWidth:60}}>{a.scope}</span>
            <span className="mem-sans" style={{fontSize:13, color:EC_TC.INK}}>{a.intent}</span>
            <div style={{display:'flex', gap:6}}>
              {!isWinner && <button style={ecBtn()}>make winner</button>}
              {!isWinner && <button style={ecBtn(false,true)}>delete</button>}
              {isWinner && <span className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.INK, letterSpacing:'0.14em'}}>current winner</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RightRail({ winner }) {
  const typeDef = ED().TYPES[winner.type];
  const writePath = describePath(winner);
  return (
    <div style={{borderLeft:`1px solid ${EC_TC.RULE}`, paddingLeft:20}}>
      <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.2em', marginBottom:8}}>Safety</div>
      <div className="mem-sans" style={{fontSize:12, color:EC_TC.MUTED, lineHeight:1.5, marginBottom:12}}>
        Edits preview a diff, write a timestamped backup, then apply. Undo is one click.
      </div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:20}}>
        <button style={ecBtn()}>Preview diff</button>
        <button style={ecBtn(true)}>Save with backup</button>
      </div>
      <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.2em', marginBottom:6}}>Writes to</div>
      <div className="mem-mono" style={{fontSize:11, color:EC_TC.INK, lineHeight:1.5, wordBreak:'break-all'}}>
        {writePath}
      </div>
      <div className="mem-mono" style={{fontSize:10, color:EC_TC.FAINT, marginTop:3}}>
        {typeDef.label.toLowerCase()} · {winner.scope} scope
      </div>
    </div>
  );
}
function describePath(w) {
  const scope = ED().SCOPES[w.scope];
  const t = w.type;
  if (t === 'standing-instruction') return `${scope.path}/CLAUDE.md`;
  if (t === 'skill')      return `${scope.path}/skills/${w.title}.md`;
  if (t === 'command')    return `${scope.path}/commands/${(w.title||'').replace(/^\//,'')}.md`;
  if (t === 'permission') return `${scope.path}/settings.json`;
  if (t === 'hook')       return `${scope.path}/settings.json`;
  if (t === 'env')        return `${scope.path}/settings.json`;
  if (t === 'keybinding') return `${scope.path}/keybindings.json`;
  if (t === 'memory')     return `${scope.path}/${w.title}`;
  if (t === 'plugin')     return `${scope.path}/${w.title}/plugin.json`;
  return scope.path;
}

// ── Per-kind forms ────────────────────────────────────────────

// SKILL ─ name, description, allowed-tools, body · markdown escape hatch
function SkillForm({ winner }) {
  const [name, setName] = React.useState(winner.title);
  const [desc, setDesc] = React.useState(winner.intent);
  const [toolMode, setToolMode] = React.useState('all'); // 'all' | 'restrict'
  const [tools, setTools] = React.useState(['Read','Edit','Bash']);
  const [body, setBody] = React.useState('Detailed instructions for this skill. Include trigger conditions, constraints, and examples.');
  const ALL_TOOLS = ['Read','Write','Edit','Bash','Glob','Grep','WebFetch','WebSearch','TodoWrite','Task'];
  const toggle = (t) => setTools(tools.includes(t) ? tools.filter(x=>x!==t) : [...tools, t]);

  return (
    <div>
      <FormRow label="Name" note="folder name" hint="Used as the skill ID. Must be unique within scope.">
        <input value={name} onChange={e=>setName(e.target.value)} style={ecMono()} />
      </FormRow>
      <FormRow label="Description" hint="One line. This is what Claude reads when deciding whether to invoke the skill.">
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={ecField()} />
      </FormRow>
      <FormRow label="Tool access" hint="Which tools this skill may call while it is active.">
        <ToolAccessControl mode={toolMode} setMode={setToolMode} tools={tools} toggle={toggle} all={ALL_TOOLS} />
      </FormRow>
      <FormRow label="Instructions" hint="Shown to Claude when the skill is active. Toggle Markdown to view/edit the raw file.">
        <BodyEditor value={body} onChange={setBody} allowMarkdownToggle />
      </FormRow>
    </div>
  );
}

function ToolAccessControl({ mode, setMode, tools, toggle, all }) {
  return (
    <div>
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        <label style={{display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer'}}>
          <input type="radio" checked={mode==='all'} onChange={()=>setMode('all')} style={{marginTop:3}} />
          <div>
            <div className="mem-sans" style={{fontSize:13, color:EC_TC.INK, fontWeight:500}}>Inherit — all tools allowed</div>
            <div className="mem-sans" style={{fontSize:11.5, color:EC_TC.FAINT, lineHeight:1.4}}>Skill can use any tool permitted at the session level.</div>
          </div>
        </label>
        <label style={{display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer'}}>
          <input type="radio" checked={mode==='restrict'} onChange={()=>setMode('restrict')} style={{marginTop:3}} />
          <div style={{flex:1}}>
            <div className="mem-sans" style={{fontSize:13, color:EC_TC.INK, fontWeight:500}}>Restrict to selected tools</div>
            <div className="mem-sans" style={{fontSize:11.5, color:EC_TC.FAINT, lineHeight:1.4}}>Only the tools checked below are available. Everything else is blocked.</div>
          </div>
        </label>
      </div>
      {mode === 'restrict' && (
        <div style={{marginTop:10, padding:'10px 12px', border:`1px solid ${EC_TC.RULE_SOFT}`, borderRadius:2, background:EC_TC.PAPER}}>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {all.map(t => <Chip key={t} label={t} active={tools.includes(t)} onClick={()=>toggle(t)} />)}
          </div>
          {tools.length === 0 && (
            <div className="mem-sans" style={{fontSize:11.5, color:'oklch(0.55 0.18 28)', marginTop:8}}>
              No tools selected — skill will have no tool access at all.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// PERMISSION ─ pattern + allow/deny/ask (no body, no markdown)
function PermissionForm({ winner }) {
  const initial = parsePerm(winner.title);
  const [tool, setTool] = React.useState(initial.tool);
  const [pattern, setPattern] = React.useState(initial.pattern);
  const [mode, setMode] = React.useState(guessMode(winner.intent));
  const [reason, setReason] = React.useState('');

  const TOOLS = ['Bash','Read','Edit','Write','WebFetch','*'];
  const PRESETS = {
    Bash: ['git *','pnpm *','bun *','rm *','curl *'],
    Read: ['~/.ssh/**','~/.aws/**','.env*'],
    Write:['.env*','~/.config/**'],
  };

  return (
    <div>
      <FormRow label="Tool" hint="Which tool family this permission applies to.">
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {TOOLS.map(t => <Chip key={t} label={t} active={tool===t} onClick={()=>setTool(t)} />)}
        </div>
      </FormRow>
      <FormRow label="Pattern" hint="Glob against the tool's arguments. Leave blank for ALL calls.">
        <input value={pattern} onChange={e=>setPattern(e.target.value)} placeholder={`${tool}(...)`} style={ecMono()} />
        {PRESETS[tool] && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:6}}>
            {PRESETS[tool].map(p => (
              <button key={p} onClick={()=>setPattern(p)} style={{
                background:'transparent', border:`1px solid ${EC_TC.RULE_SOFT}`, borderRadius:2,
                padding:'2px 8px', fontFamily:EC_TC.MONO, fontSize:10.5, color:EC_TC.MUTED, cursor:'pointer',
              }}>{p}</button>
            ))}
          </div>
        )}
      </FormRow>
      <FormRow label="Effect">
        <div style={{display:'flex', gap:0, border:`1px solid ${EC_TC.RULE}`, borderRadius:2, width:'fit-content'}}>
          {[
            ['allow','Allow','oklch(0.50 0.12 155)'],
            ['ask',  'Ask',  'oklch(0.55 0.11 70)'],
            ['deny', 'Deny', 'oklch(0.55 0.18 28)'],
          ].map(([k,l,c])=>(
            <button key={k} onClick={()=>setMode(k)} style={{
              padding:'7px 16px', border:'none', cursor:'pointer',
              background: mode===k ? c : 'transparent',
              color: mode===k ? EC_TC.PAPER : EC_TC.INK,
              fontFamily:EC_TC.SANS, fontSize:12, fontWeight:600, letterSpacing:'0.04em',
              borderRight: k!=='deny' ? `1px solid ${EC_TC.RULE}` : 'none',
            }}>{l}</button>
          ))}
        </div>
      </FormRow>
      <FormRow label="Reason (optional)" hint="Comment stored alongside the rule. Helps you remember why you added it.">
        <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. blocks force-push on shared branches" style={ecField()} />
      </FormRow>

      <div style={{padding:'10px 12px', border:`1px dashed ${EC_TC.RULE}`, borderRadius:2, background:EC_TC.PAPER, marginTop:6}}>
        <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.14em', marginBottom:4}}>Compiled rule</div>
        <div className="mem-mono" style={{fontSize:13, color:EC_TC.INK}}>
          <b style={{color: mode==='deny' ? 'oklch(0.55 0.18 28)' : (mode==='allow' ? 'oklch(0.45 0.12 155)' : 'oklch(0.55 0.11 70)')}}>{mode}</b>
          {' · '}{tool}({pattern || '*'})
        </div>
      </div>
    </div>
  );
}
function parsePerm(title) {
  const m = /^(\w+)\s*\(([^)]*)\)$/.exec(title || '');
  return m ? { tool: m[1], pattern: m[2] } : { tool: 'Bash', pattern: '' };
}
function guessMode(intent='') {
  const s = intent.toLowerCase();
  if (s.includes('deny')) return 'deny';
  if (s.includes('ask'))  return 'ask';
  return 'allow';
}

// HOOK ─ event picker, matcher, command, run-as
function HookForm({ winner }) {
  const [event, setEvent] = React.useState(guessEvent(winner.title));
  const [matcher, setMatcher] = React.useState('*');
  const [cmd, setCmd] = React.useState(winner.intent.includes('audit') ? 'echo "$TOOL_NAME $TOOL_ARGS" >> ~/.claude/audit.log' : 'biome format --write "$FILE"');
  const [runAs, setRunAs] = React.useState('shell');
  const EVENTS = ['PreToolUse','PostToolUse','UserPromptSubmit','SubagentStop','SessionStart','SessionEnd','Notification'];

  return (
    <div>
      <FormRow label="Event" hint="When this hook fires in the agent loop.">
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {EVENTS.map(e => <Chip key={e} label={e} active={event===e} onClick={()=>setEvent(e)} />)}
        </div>
      </FormRow>
      <FormRow label="Matcher" hint="For tool events: glob against tool name. Use * to match all.">
        <input value={matcher} onChange={e=>setMatcher(e.target.value)} placeholder="Write, Edit, Bash(git:*)" style={ecMono()} />
      </FormRow>
      <FormRow label="Run as">
        <div style={{display:'flex', gap:6}}>
          {['shell','script','claude-prompt'].map(r => <Chip key={r} label={r} active={runAs===r} onClick={()=>setRunAs(r)} />)}
        </div>
      </FormRow>
      <FormRow label="Command" hint="Available variables: $TOOL_NAME, $TOOL_ARGS, $FILE, $SESSION_ID.">
        <textarea value={cmd} onChange={e=>setCmd(e.target.value)} rows={4} style={ecMono()} />
      </FormRow>

      <div style={{padding:'10px 12px', border:`1px dashed ${EC_TC.RULE}`, borderRadius:2, background:EC_TC.PAPER}}>
        <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.14em', marginBottom:4}}>Preview</div>
        <div className="mem-mono" style={{fontSize:12, color:EC_TC.INK, lineHeight:1.5}}>
          on <b>{event}</b> where tool matches <b>{matcher}</b> · run {runAs}: <span style={{color:EC_TC.MUTED}}>{cmd}</span>
        </div>
      </div>
    </div>
  );
}
function guessEvent(title='') {
  if (title.includes('PreTool'))  return 'PreToolUse';
  if (title.includes('PostTool')) return 'PostToolUse';
  return 'PreToolUse';
}

// STANDING INSTRUCTION ─ title (H2 heading) + markdown body
function StandingInstructionForm({ winner }) {
  const [heading, setHeading] = React.useState(winner.title);
  const [body, setBody] = React.useState(winner.intent + '\n\nAdd further detail without touching any markdown.');

  return (
    <div>
      <FormRow label="Heading" hint="Rendered as an H2 in CLAUDE.md. Keep short; Claude reads these as anchors.">
        <input value={heading} onChange={e=>setHeading(e.target.value)} style={ecField()} />
      </FormRow>
      <FormRow label="Body" hint="This section body. Toggle Markdown to view or edit the raw source.">
        <BodyEditor value={body} onChange={setBody} allowMarkdownToggle />
      </FormRow>
      <FormRow label="Imports" hint="@-references to other files merged into this section.">
        <ImportList winner={winner} />
      </FormRow>
    </div>
  );
}

function ImportList({ winner }) {
  const [imports, setImports] = React.useState(winner.imports || []);
  const rels = ED().RELATIONS.filter(r => r.from === winner.id && r.kind === 'imports');
  const isBroken = (path) => rels.some(r => r.to === path && r.broken);
  const remove = (p) => setImports(imports.filter(x => x !== p));
  const [newPath, setNewPath] = React.useState('');

  return (
    <div>
      {imports.length === 0 && <div className="mem-sans" style={{fontSize:12, color:EC_TC.FAINT, marginBottom:6}}>No imports.</div>}
      {imports.map(p => {
        const broken = isBroken(p);
        return (
          <div key={p} style={{
            display:'flex', alignItems:'center', gap:8, padding:'5px 10px',
            border:`1px solid ${broken ? 'oklch(0.55 0.18 28)' : EC_TC.RULE_SOFT}`,
            background: broken ? 'oklch(0.97 0.03 28)' : 'transparent',
            borderRadius:2, marginBottom:4,
          }}>
            <span className="mem-mono" style={{fontSize:11.5, color:EC_TC.INK, flex:1}}>{p}</span>
            {broken && <span className="mem-sans mem-smallcaps" style={{fontSize:9, color:'oklch(0.55 0.18 28)', letterSpacing:'0.14em'}}>missing</span>}
            <button onClick={()=>remove(p)} style={{background:'none', border:'none', cursor:'pointer', color:EC_TC.MUTED, fontSize:14}}>×</button>
          </div>
        );
      })}
      <div style={{display:'flex', gap:6, marginTop:6}}>
        <input value={newPath} onChange={e=>setNewPath(e.target.value)} placeholder="@path/to/file.md" style={{...ecMono(), flex:1}} />
        <button onClick={()=>{ if(newPath) { setImports([...imports, newPath]); setNewPath(''); } }} style={ecBtn()}>add</button>
      </div>
    </div>
  );
}

// MEMORY ─ title, body, provenance (read-only)
function MemoryForm({ winner }) {
  const [title, setTitle] = React.useState(winner.title);
  const [body, setBody]   = React.useState(winner.intent);
  const rel = ED().RELATIONS.find(r => r.from === winner.id && r.kind === 'accretes-from');

  return (
    <div>
      <FormRow label="File name">
        <input value={title} onChange={e=>setTitle(e.target.value)} style={ecMono()} />
      </FormRow>
      <FormRow label="Content" hint="Memory contents. Claude re-reads these at session start.">
        <BodyEditor value={body} onChange={setBody} allowMarkdownToggle />
      </FormRow>

      <div style={{
        padding:'12px 14px', border:`1px solid ${EC_TC.RULE_SOFT}`, borderRadius:2,
        background:EC_TC.PAPER_DEEP, marginTop:8,
      }}>
        <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.18em', marginBottom:6}}>Provenance</div>
        <div className="mem-sans" style={{fontSize:12.5, color:EC_TC.INK, lineHeight:1.6}}>
          Accreted from <b>{rel ? rel.to.replace(/^slug:/,'') : 'sessions'}</b>
          {rel?.note && <> · <span style={{color:EC_TC.MUTED}}>{rel.note}</span></>}
          {winner.stale && <> · <b style={{color:'oklch(0.55 0.11 70)'}}>stale (14d)</b></>}
        </div>
        <div style={{display:'flex', gap:6, marginTop:10, flexWrap:'wrap'}}>
          <button style={ecBtn()}>Re-accrete from recent sessions</button>
          <button style={ecBtn()}>View source turns</button>
          <button style={ecBtn(false,true)}>Dismiss memory</button>
        </div>
      </div>
    </div>
  );
}

// KEYBINDING ─ chord capture + action
function KeybindingForm({ winner }) {
  const [rows, setRows] = React.useState([
    { key:'⌘ K', action:'commandPalette.open' },
    { key:'⌘ ⇧ P', action:'commandPalette.open' },
    { key:'⌘ Enter', action:'chat.submit' },
    { key:'⌃ C', action:'chat.stop' },
    { key:'⌘ /', action:'chat.focusInput' },
  ]);
  const addRow = () => setRows([...rows, { key:'', action:'' }]);
  const update = (i, k, v) => { const r = [...rows]; r[i] = {...r[i], [k]:v}; setRows(r); };
  const remove = (i) => setRows(rows.filter((_,j)=>j!==i));

  return (
    <div>
      <FormRow label="Chords" hint="Click a chord cell and press the keys you want. Chords are captured, not typed.">
        <div style={{border:`1px solid ${EC_TC.RULE}`, borderRadius:2, background:EC_TC.PAPER}}>
          <div style={{display:'grid', gridTemplateColumns:'160px 1fr 30px', padding:'6px 10px', borderBottom:`1px solid ${EC_TC.RULE_SOFT}`, background:EC_TC.PAPER_DEEP}}>
            <span className="mem-sans mem-smallcaps" style={{fontSize:9.5, color:EC_TC.MUTED, letterSpacing:'0.18em'}}>Chord</span>
            <span className="mem-sans mem-smallcaps" style={{fontSize:9.5, color:EC_TC.MUTED, letterSpacing:'0.18em'}}>Action</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{display:'grid', gridTemplateColumns:'160px 1fr 30px', alignItems:'center', padding:'4px 10px', borderTop: i>0 ? `1px solid ${EC_TC.RULE_SOFT}` : 'none', gap:8}}>
              <div style={{
                padding:'4px 10px', border:`1px solid ${EC_TC.RULE}`, borderRadius:3,
                background:EC_TC.PAPER_DEEP, fontFamily:EC_TC.MONO, fontSize:12.5,
                color:EC_TC.INK, minHeight:16, cursor:'pointer', textAlign:'center',
              }}>{r.key || <span style={{color:EC_TC.FAINT}}>press chord…</span>}</div>
              <input value={r.action} onChange={e=>update(i,'action',e.target.value)} style={{...ecMono(), padding:'4px 8px', fontSize:11.5}} />
              <button onClick={()=>remove(i)} style={{background:'none', border:'none', cursor:'pointer', color:EC_TC.MUTED, fontSize:14}}>×</button>
            </div>
          ))}
          <div style={{padding:'8px 10px', borderTop:`1px solid ${EC_TC.RULE_SOFT}`}}>
            <button onClick={addRow} style={ecBtn()}>add chord</button>
          </div>
        </div>
      </FormRow>
    </div>
  );
}

// ENV VAR ─ key + value, optional secret masking
function EnvVarForm({ winner }) {
  const [key, setKey] = React.useState(winner.title);
  const [val, setVal] = React.useState(winner.intent);
  const [secret, setSecret] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);

  return (
    <div>
      <FormRow label="Variable">
        <input value={key} onChange={e=>setKey(e.target.value)} style={{...ecMono(), fontWeight:600, letterSpacing:'0.04em'}} />
      </FormRow>
      <FormRow label="Value">
        <div style={{display:'flex', gap:6}}>
          <input
            type={secret && !reveal ? 'password' : 'text'}
            value={val} onChange={e=>setVal(e.target.value)}
            style={{...ecMono(), flex:1}} />
          {secret && (
            <button onClick={()=>setReveal(!reveal)} style={ecBtn()}>{reveal ? 'hide' : 'reveal'}</button>
          )}
        </div>
      </FormRow>
      <FormRow label="Flags">
        <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
          <input type="checkbox" checked={secret} onChange={e=>setSecret(e.target.checked)} />
          <span className="mem-sans" style={{fontSize:12.5, color:EC_TC.INK}}>Mark as secret · value hidden by default, never printed in logs</span>
        </label>
      </FormRow>
    </div>
  );
}

// PLUGIN ─ metadata + contained entities (read-only links)
function PluginForm({ winner }) {
  const [name, setName]     = React.useState(winner.title);
  const [source, setSource] = React.useState('https://github.com/community/' + winner.title);
  const [enabled, setEnabled] = React.useState(true);

  // entities this plugin provides
  const provides = ED().RELATIONS.filter(r => r.from === winner.id && r.kind === 'provides');

  return (
    <div>
      <FormRow label="Name">
        <input value={name} onChange={e=>setName(e.target.value)} style={ecMono()} />
      </FormRow>
      <FormRow label="Source" hint="Git URL, registry name, or local path.">
        <input value={source} onChange={e=>setSource(e.target.value)} style={ecMono()} />
      </FormRow>
      <FormRow label="State">
        <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
          <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />
          <span className="mem-sans" style={{fontSize:12.5, color:EC_TC.INK}}>Enabled · {enabled ? 'provides skills and commands to all sessions' : 'disabled — entities below are not active'}</span>
        </label>
      </FormRow>

      <FormRow label={`Contains · ${provides.length}`} hint="Plugins don't have a body of their own — they provide other entities. Click to edit.">
        <div style={{border:`1px solid ${EC_TC.RULE}`, borderRadius:2, background:EC_TC.PAPER}}>
          {provides.length === 0 && <div style={{padding:'16px', color:EC_TC.FAINT, fontSize:12}}>Nothing provided yet.</div>}
          {provides.map((r, i) => {
            const child = ED().ARTIFACTS.find(a => a.id === r.to);
            if (!child) return null;
            const typeLabel = ED().TYPES[child.type].label;
            return (
              <div key={r.to} style={{
                display:'grid', gridTemplateColumns:'90px 1fr auto', gap:12, alignItems:'center',
                padding:'8px 12px', borderTop: i>0 ? `1px solid ${EC_TC.RULE_SOFT}` : 'none',
              }}>
                <span className="mem-mono mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.14em'}}>{typeLabel}</span>
                <span className="mem-sans" style={{fontSize:13, color:EC_TC.INK, fontWeight:500}}>{child.title}</span>
                <span className="mem-mono" style={{fontSize:10.5, color:EC_TC.MUTED, textDecoration:'underline', cursor:'pointer'}}>open →</span>
              </div>
            );
          })}
        </div>
      </FormRow>

      {winner.warn && (
        <div style={{padding:'10px 12px', border:`1px solid oklch(0.55 0.18 28)`, borderLeft:`3px solid oklch(0.55 0.18 28)`, background:'oklch(0.97 0.03 28)', borderRadius:2, marginTop:8}}>
          <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:'oklch(0.45 0.18 28)', letterSpacing:'0.18em', marginBottom:3}}>Warning</div>
          <div className="mem-sans" style={{fontSize:12.5, color:EC_TC.INK}}>No manifest author. Installed 8 months ago. Review its skills before trusting.</div>
        </div>
      )}
    </div>
  );
}

// COMMAND ─ slash command (prompt + optional args), with "Convert to Skill"
function CommandForm({ winner }) {
  const [name, setName]   = React.useState((winner.title || '').replace(/^\//, ''));
  const [desc, setDesc]   = React.useState(winner.intent);
  const [args, setArgs]   = React.useState('$ARGUMENTS');
  const [body, setBody]   = React.useState('When invoked, do the following:\n\n1. Read the current diff.\n2. Summarize it as a conventional-commit title.\n3. Open a PR with that title and a changelog body.');
  const [converting, setConverting] = React.useState(false);
  const [skillName, setSkillName]   = React.useState((winner.title || '').replace(/^\//, ''));
  const [skillDesc, setSkillDesc]   = React.useState(winner.intent);

  return (
    <div>
      <FormRow label="Name" note="invoked as /name" hint="Slash-command identifier. Used as the filename.">
        <div style={{display:'flex', alignItems:'center', gap:0, border:`1px solid ${EC_TC.RULE}`, borderRadius:2, background:EC_TC.PAPER, overflow:'hidden'}}>
          <span className="mem-mono" style={{padding:'8px 10px', background:EC_TC.PAPER_DEEP, color:EC_TC.MUTED, borderRight:`1px solid ${EC_TC.RULE}`, fontSize:12.5}}>/</span>
          <input value={name} onChange={e=>setName(e.target.value)} style={{...ecMono(), border:'none', borderRadius:0, flex:1}} />
        </div>
      </FormRow>
      <FormRow label="Description" hint="One line. Shown in the command-palette list.">
        <input value={desc} onChange={e=>setDesc(e.target.value)} style={ecField()} />
      </FormRow>
      <FormRow label="Arguments" hint="Reference user-typed arguments as $ARGUMENTS inside the prompt body.">
        <input value={args} onChange={e=>setArgs(e.target.value)} style={ecMono()} />
      </FormRow>
      <FormRow label="Prompt body" hint="Sent to Claude when the user runs this command. Toggle Markdown for raw source.">
        <BodyEditor value={body} onChange={setBody} allowMarkdownToggle />
      </FormRow>

      {/* Convert to Skill — commands and skills are both markdown-with-frontmatter.
          A command is invoked explicitly with /; a skill is invoked on-demand by
          Claude when its description matches. Converting is mostly a move + rename. */}
      <div style={{
        marginTop:14, padding:'12px 14px',
        border:`1px solid ${EC_TC.RULE_SOFT}`, borderLeft:`3px solid oklch(0.55 0.11 245)`,
        background:EC_TC.PAPER_DEEP, borderRadius:2,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:4}}>
          <span className="mem-sans mem-smallcaps" style={{fontSize:10, color:EC_TC.MUTED, letterSpacing:'0.18em'}}>Convert</span>
          <span className="mem-sans" style={{fontSize:13, color:EC_TC.INK, fontWeight:500}}>Make this a Skill instead</span>
          <span style={{flex:1}} />
          {!converting && <button onClick={()=>setConverting(true)} style={ecBtn()}>Convert to Skill…</button>}
        </div>
        <div className="mem-sans" style={{fontSize:11.5, color:EC_TC.MUTED, lineHeight:1.5}}>
          Skills are triggered by Claude when their description matches; commands are invoked explicitly with <span className="mem-mono" style={{color:EC_TC.INK}}>/name</span>. The prompt body carries over unchanged — only the invocation style and file location change.
        </div>

        {converting && (
          <div style={{
            marginTop:12, padding:'12px 14px', background:EC_TC.PAPER,
            border:`1px solid ${EC_TC.RULE}`, borderRadius:2,
          }}>
            <div className="mem-sans mem-smallcaps" style={{fontSize:9.5, color:EC_TC.MUTED, letterSpacing:'0.18em', marginBottom:8}}>Review before converting</div>
            <FormRow label="Skill name" note="folder name" hint="Must be unique among skills in this scope.">
              <input value={skillName} onChange={e=>setSkillName(e.target.value)} style={ecMono()} />
            </FormRow>
            <FormRow label="Skill description" hint="Claude reads this when deciding whether to auto-invoke. Be specific about when it should run.">
              <textarea value={skillDesc} onChange={e=>setSkillDesc(e.target.value)} rows={2} style={ecField()} />
            </FormRow>

            <div style={{padding:'10px 12px', border:`1px dashed ${EC_TC.RULE}`, borderRadius:2, background:EC_TC.PAPER_DEEP, marginTop:4}}>
              <div className="mem-sans mem-smallcaps" style={{fontSize:9.5, color:EC_TC.MUTED, letterSpacing:'0.16em', marginBottom:6}}>What this does</div>
              <ul className="mem-sans" style={{fontSize:12, color:EC_TC.INK, lineHeight:1.6, margin:0, paddingLeft:18}}>
                <li>Write prompt body to <span className="mem-mono" style={{color:EC_TC.INK}}>{`skills/${skillName}.md`}</span> with frontmatter <span className="mem-mono" style={{color:EC_TC.MUTED}}>name + description</span>.</li>
                <li>Back up original <span className="mem-mono" style={{color:EC_TC.MUTED}}>{`commands/${name}.md`}</span>, then delete it.</li>
                <li>Rewrite any relations pointing at this command to point at the new skill.</li>
                <li>The slash-invocation <span className="mem-mono" style={{color:EC_TC.INK}}>/{name}</span> will no longer work — auto-invocation takes over.</li>
              </ul>
            </div>

            <div style={{display:'flex', gap:8, marginTop:10}}>
              <button onClick={()=>setConverting(false)} style={ecBtn()}>cancel</button>
              <button style={ecBtn(true)}>Preview conversion diff</button>
              <button style={ecBtn(true)}>Convert &amp; back up</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.InlineEditorShell = InlineEditorShell;
