// Shared UI primitives for the three the-memory-register variations.
// Editorial vibe: serif display, generous whitespace, monochrome ink,
// provenance-tinted cards. No emoji. No icons from libraries.

const { useState, useMemo, useEffect, useRef } = React;

const MEM = window.MEM_DATA;

// ── Design tokens ─────────────────────────────────────────────
const INK        = '#1a1713';
const PAPER      = '#f6f3ec';
const PAPER_DEEP = '#edeadf';
const RULE       = 'rgba(26,23,19,0.14)';
const RULE_SOFT  = 'rgba(26,23,19,0.08)';
const MUTED      = 'rgba(26,23,19,0.58)';
const FAINT      = 'rgba(26,23,19,0.38)';
const SERIF      = '"Inter Tight", "Helvetica Neue", system-ui, sans-serif'; // serif retired
const SANS       = '"Inter Tight", "Helvetica Neue", system-ui, sans-serif';
const MONO       = '"JetBrains Mono", ui-monospace, Menlo, monospace';

window.MEM_TOKENS = { INK, PAPER, PAPER_DEEP, RULE, RULE_SOFT, MUTED, FAINT, SERIF, SANS, MONO };

// Inject fonts + base styles once.
if (!document.getElementById('mem-fonts')) {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
  l.id = 'mem-fonts';
  document.head.appendChild(l);

  const s = document.createElement('style');
  s.textContent = `
    .mem * { box-sizing: border-box; }
    .mem-serif { font-family: ${SANS}; font-feature-settings: "liga","dlig"; }
    .mem-sans  { font-family: ${SANS}; }
    .mem-mono  { font-family: ${MONO}; }
    .mem-rule  { height:1px; background:${RULE}; }
    .mem-ruled { border-top:1px solid ${RULE}; }
    .mem-dbl   { border-top:3px double ${RULE}; }
    .mem-kbd   { font-family:${MONO}; font-size:10.5px; padding:1px 5px; border:1px solid ${RULE}; border-radius:3px; color:${MUTED}; background:${PAPER}; }
    .mem-smallcaps { font-variant: all-small-caps; letter-spacing: 0.1em; font-weight:500; }
    .mem-tick { font-family:${MONO}; font-size:10px; color:${FAINT}; letter-spacing:0.08em; text-transform:uppercase; }
    .mem-hover-lift { transition: transform .15s, box-shadow .15s; }
    .mem-hover-lift:hover { transform: translateY(-1px); }
    .mem-scroll::-webkit-scrollbar { width:6px; height:6px; }
    .mem-scroll::-webkit-scrollbar-thumb { background: ${RULE}; border-radius:3px; }
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────
function authorOf(a) { return MEM.AUTHORS[a.author] || MEM.AUTHORS.unknown; }
function scopeOf(a)  { return MEM.SCOPES[a.scope]; }
function typeOf(a)   { return MEM.TYPES[a.type]; }

// Group artifacts by override-identity so overrides can be shown together.
function overrideGroups(artifacts) {
  const groups = {};
  for (const a of artifacts) {
    if (!a.identity) continue;
    (groups[a.identity] ||= []).push(a);
  }
  // scope-precedence order, low → high
  const order = ['global','plugin','slug','project','local'];
  for (const k in groups) {
    groups[k].sort((x,y) => order.indexOf(x.scope) - order.indexOf(y.scope));
  }
  return groups;
}
window.MEM_HELPERS = { authorOf, scopeOf, typeOf, overrideGroups };

// ── AuthorDot / AuthorBadge ───────────────────────────────────
function AuthorDot({ author, size = 8 }) {
  const a = MEM.AUTHORS[author] || MEM.AUTHORS.unknown;
  return <span style={{display:'inline-block',width:size,height:size,borderRadius:'50%',background:a.color, flexShrink:0, verticalAlign:'middle'}} />;
}

function AuthorBadge({ author }) {
  const a = MEM.AUTHORS[author] || MEM.AUTHORS.unknown;
  return (
    <span className="mem-sans mem-smallcaps" style={{display:'inline-flex',alignItems:'center',gap:6, fontSize:9.5, color:a.ink}}>
      <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:a.color}} />
      {a.label}
    </span>
  );
}

// ── ScopeTick ─────────────────────────────────────────────────
function ScopeTick({ scope, active = true }) {
  const s = MEM.SCOPES[scope];
  return (
    <span className="mem-mono" style={{
      fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase',
      padding:'2px 6px',
      border:`1px solid ${active ? RULE : RULE_SOFT}`,
      borderRadius:2,
      color: active ? INK : FAINT,
      background: active ? 'transparent' : 'transparent',
      whiteSpace:'nowrap',
    }}>{s?.label || scope}</span>
  );
}

// ── ArtifactCard (editorial — provenance-tinted paper) ────────
function ArtifactCard({ a, dense=false, onClick, winner=false, loser=false }) {
  const auth = authorOf(a);
  const t    = typeOf(a);
  return (
    <div onClick={onClick} className="mem-hover-lift" style={{
      background: loser ? 'transparent' : auth.tint,
      border: `1px solid ${loser ? RULE_SOFT : RULE}`,
      borderLeft: `3px solid ${auth.color}`,
      borderRadius: 2,
      padding: dense ? '8px 10px' : '10px 12px',
      cursor: onClick ? 'pointer' : 'default',
      opacity: loser ? 0.55 : 1,
      position:'relative',
      boxShadow: winner ? `0 0 0 1px ${INK}` : 'none',
    }}>
      {winner && <span className="mem-sans mem-smallcaps" style={{
        position:'absolute', top:-7, right:8, background:INK, color:PAPER,
        padding:'1px 6px', borderRadius:2, fontSize:8.5, letterSpacing:'0.14em'
      }}>wins</span>}
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
        <div style={{display:'flex',alignItems:'baseline',gap:8,minWidth:0}}>
          <span className="mem-mono" style={{fontSize:10, color:FAINT, flexShrink:0}}>{t?.glyph}</span>
          <span className="mem-sans" style={{fontSize: dense ? 15 : 17, color:INK, fontWeight:500, lineHeight:1.15, letterSpacing:'-0.005em'}}>{a.title}</span>
        </div>
        <ScopeTick scope={a.scope} />
      </div>
      {a.intent && (
        <div className="mem-sans" style={{fontSize: dense ? 12 : 13, color:MUTED, marginTop:4, lineHeight:1.45}}>
          {a.intent}
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:10,marginTop:6, justifyContent:'space-between'}}>
        <AuthorBadge author={a.author} />
        {a.imports && a.imports.length > 0 && (
          <span className="mem-mono" style={{fontSize:10, color:FAINT}}>
            @{a.imports.length} import{a.imports.length>1?'s':''}
          </span>
        )}
      </div>
    </div>
  );
}

// ── HealthRibbon (always visible across variations) ───────────
function HealthRibbon({ compact = false }) {
  const by = { error:[], warn:[], info:[] };
  for (const h of MEM.HEALTH) by[h.severity].push(h);
  const dot = (sev) => ({
    error: 'oklch(0.55 0.16 28)',
    warn:  'oklch(0.70 0.14 75)',
    info:  'oklch(0.60 0.05 240)',
  }[sev]);
  return (
    <div style={{borderTop:`1px solid ${RULE}`, borderBottom:`1px solid ${RULE}`, padding:'8px 18px', background:PAPER_DEEP,
      display:'flex', alignItems:'center', gap:18, fontSize:12}}>
      <div className="mem-sans mem-smallcaps" style={{fontSize:9.5, color:MUTED, letterSpacing:'0.14em'}}>Health</div>
      <div style={{display:'flex', gap:14, alignItems:'center', flex:1, overflow:'hidden'}}>
        {MEM.HEALTH.map((h, i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', minWidth:0}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:dot(h.severity), flexShrink:0}} />
            <span className="mem-sans" style={{fontSize:12, color:INK, fontWeight:500}}>{h.title}</span>
            {!compact && <span className="mem-sans" style={{fontSize:11.5, color:MUTED, overflow:'hidden', textOverflow:'ellipsis'}}>— {h.detail}</span>}
          </div>
        ))}
      </div>
      <div className="mem-mono" style={{fontSize:10.5, color:MUTED, letterSpacing:'0.08em'}}>
        {by.error.length}E · {by.warn.length}W · {by.info.length}I
      </div>
    </div>
  );
}

// ── Masthead (editorial header) ───────────────────────────────
function Masthead({ subtitle, edition }) {
  const now = new Date();
  const fmt = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  return (
    <div style={{padding:'22px 28px 16px 28px', borderBottom:`3px double ${RULE}`, background:PAPER}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
        <span className="mem-mono mem-smallcaps" style={{fontSize:10, color:MUTED, letterSpacing:'0.2em'}}>Vol. I · No. 1 · {fmt}</span>
        <span className="mem-mono mem-smallcaps" style={{fontSize:10, color:MUTED, letterSpacing:'0.2em'}}>{edition}</span>
      </div>
      <div className="mem-sans" style={{fontSize:54, lineHeight:1, color:INK, fontWeight:500, letterSpacing:'-0.02em'}}>
        The Memory Register
      </div>
      {subtitle && (
        <div className="mem-sans" style={{fontSize:14, color:MUTED, marginTop:6, lineHeight:1.5}}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ── ProvenanceLegend ──────────────────────────────────────────
function ProvenanceLegend() {
  return (
    <div style={{display:'flex', gap:16, alignItems:'center'}}>
      {Object.values(MEM.AUTHORS).map(a => (
        <div key={a.key} style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:10,height:10,borderRadius:'50%',background:a.color}} />
          <span className="mem-sans" style={{fontSize:11, color:INK}}>{a.label}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  AuthorDot, AuthorBadge, ScopeTick, ArtifactCard, HealthRibbon, Masthead, ProvenanceLegend,
});
