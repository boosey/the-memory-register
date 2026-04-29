// Variation C — "Signal Flow" v4 (inline editor + pruning)
// Additions over v3:
//  • Click a row → inline editor drawer expands beneath it (no modal).
//  • Multi-select: checkboxes per row + persistent action bar.
//     Actions: Resolve to winner / Delete shadowed / Promote / Demote /
//              Delete entity / Dismiss stale / Remove dead import.
//  • Health ribbon items are clickable → filter rows to the problem.

const TC = window.MEM_TOKENS;
const HC = window.MEM_HELPERS;
const D = () => window.MEM_DATA;

function relationsFor(id) {
  const d = D(); const out=[], inb=[];
  for (const r of d.RELATIONS) { if (r.from===id) out.push(r); if (r.to===id) inb.push(r); }
  return { out, inb };
}
function findEntity(id) { return D().ARTIFACTS.find(a => a.id === id); }
function relatedIds(id) {
  const s = new Set();
  for (const r of D().RELATIONS) {
    if (r.from===id && findEntity(r.to)) s.add(r.to);
    if (r.to===id && findEntity(r.from)) s.add(r.from);
  }
  return s;
}

function VariationC() {
  const data = D();
  const [selectedType, setSelectedType] = React.useState('standing-instruction');
  const [pinnedId, setPinnedId] = React.useState(null);
  const [expandedId, setExpandedId] = React.useState(null);
  const [selected, setSelected] = React.useState(new Set());
  const [filter, setFilter] = React.useState(null); // null | 'contested' | 'stale' | 'unknown' | 'broken-import'
  const groups = React.useMemo(() => HC.overrideGroups(data.ARTIFACTS), []);

  const jumpTo = (id) => {
    const e = findEntity(id); if (!e) return;
    setSelectedType(e.type); setPinnedId(id); setExpandedId(null);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-row-id="${id}"]`);
      if (el) el.scrollIntoView({ block:'center', behavior:'smooth' });
    });
  };

  const pinned = pinnedId ? findEntity(pinnedId) : null;
  const highlightSet = React.useMemo(() => pinnedId ? relatedIds(pinnedId) : new Set(), [pinnedId]);

  const toggleSel = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const clearSel = () => setSelected(new Set());

  // Rows for current type, with filter applied.
  const rows = React.useMemo(() => {
    const seen = new Set(), out = [];
    for (const a of data.ARTIFACTS) {
      if (a.type !== selectedType) continue;
      const key = a.identity || a.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const g = a.identity && groups[a.identity] ? groups[a.identity] : [a];
      // filter
      if (filter === 'contested' && g.length < 2) continue;
      if (filter === 'stale' && !g.some(x => x.stale)) continue;
      if (filter === 'unknown' && !g.some(x => x.author==='unknown' || x.warn)) continue;
      if (filter === 'broken-import' && !g.some(x => (x.imports||[]).some(im => im.includes('missing')))) continue;
      out.push(g);
    }
    return out;
  }, [groups, selectedType, filter]);

  const curType = data.TYPES[selectedType];

  const highlightByType = React.useMemo(() => {
    const m = {};
    for (const id of highlightSet) { const e = findEntity(id); if (e) m[e.type] = (m[e.type]||0)+1; }
    return m;
  }, [highlightSet]);

  // Compute counts by problem type for health-ribbon filters.
  const problems = React.useMemo(() => ({
    contested: Object.values(groups).filter(g => g.length > 1).length,
    stale: data.ARTIFACTS.filter(a => a.stale).length,
    unknown: data.ARTIFACTS.filter(a => a.author==='unknown' || a.warn).length,
    broken: data.ARTIFACTS.filter(a => (a.imports||[]).some(i => i.includes('missing'))).length,
  }), [groups]);

  return (
    <div className="mem" style={{background:TC.PAPER, color:TC.INK, fontFamily:TC.SANS, minHeight:'100%', display:'flex', flexDirection:'column'}}>
      <Masthead
        subtitle="Trace entities, follow relationships, resolve and prune — all inline."
        edition="Signal Edition · v4"
      />

      <HealthRibbonFilterable filter={filter} setFilter={setFilter} problems={problems} />

      {pinned && (
        <div style={{
          borderBottom:`1px solid ${TC.RULE}`, background:TC.PAPER_DEEP,
          padding:'10px 28px', display:'flex', alignItems:'center', gap:14,
        }}>
          <span className="mem-sans mem-smallcaps" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.2em'}}>Tracing</span>
          <span className="mem-sans" style={{fontSize:16, fontWeight:600, color:TC.INK}}>{pinned.title}</span>
          <span className="mem-mono mem-smallcaps" style={{fontSize:9.5, color:TC.MUTED, letterSpacing:'0.14em'}}>
            {data.TYPES[pinned.type].label}
          </span>
          <span style={{flex:1}} />
          <span className="mem-sans" style={{fontSize:12, color:TC.MUTED}}>
            {highlightSet.size} related across {Object.keys(highlightByType).length} kinds
          </span>
          <button onClick={() => setPinnedId(null)} style={btnStyle()}>clear</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{padding:'14px 28px 0 28px', borderBottom:`1px solid ${TC.RULE}`}}>
        <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.2em', marginBottom:8}}>Trace by entity kind</div>
        <div style={{display:'flex', gap:20, alignItems:'flex-end', flexWrap:'wrap'}}>
          {data.TYPE_ORDER.map(t => {
            const active = selectedType === t;
            const count = data.ARTIFACTS.filter(a=>a.type===t).length;
            if (!count) return null;
            const hiCount = highlightByType[t] || 0;
            return (
              <button key={t} onClick={() => { setSelectedType(t); setExpandedId(null); }} style={{
                background:'none', border:'none', padding:'8px 0', cursor:'pointer',
                borderBottom: active ? `2px solid ${TC.INK}` : '2px solid transparent',
                fontFamily:TC.SANS, fontSize:16, fontWeight: active?600:500,
                color: active ? TC.INK : TC.MUTED,
              }}>
                {data.TYPES[t].plural}
                <span className="mem-mono" style={{fontSize:10, color:TC.FAINT, marginLeft:6}}>{count}</span>
                {hiCount > 0 && <span style={{display:'inline-block', marginLeft:6, width:8, height:8, borderRadius:'50%', background:'oklch(0.55 0.14 50)'}} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Blurb */}
      <div style={{padding:'14px 28px 0 28px'}}>
        <div className="mem-sans" style={{fontSize:12.5, color:TC.MUTED, lineHeight:1.55, maxWidth:780}}>
          {curType.blurb}
          {filter && <> <span style={{color:TC.FAINT}}>·</span> Filtered to <b style={{color:TC.INK}}>{filter}</b>. <button onClick={()=>setFilter(null)} style={{background:'none', border:'none', color:TC.INK, textDecoration:'underline', cursor:'pointer', fontFamily:TC.SANS, fontSize:12.5}}>clear filter</button></>}
        </div>
      </div>

      {/* Schematic body */}
      <div style={{flex:1, padding:'14px 28px 140px 28px', overflow:'auto'}} className="mem-scroll">
        <SchematicHeader />
        <div style={{marginTop:10}}>
          {rows.map(g => (
            <React.Fragment key={g[0].identity || g[0].id}>
              <SignalRow
                group={g}
                isPinned={pinnedId && g.some(a => a.id === pinnedId)}
                isRelated={g.some(a => highlightSet.has(a.id))}
                isExpanded={expandedId === (g[0].identity || g[0].id)}
                isChecked={g.some(a => selected.has(a.id))}
                onPin={(id) => setPinnedId(pinnedId === id ? null : id)}
                onJump={jumpTo}
                onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                onToggleSel={toggleSel}
              />
              {expandedId === (g[0].identity || g[0].id) && (() => {
                const Shell = window.InlineEditorShell;
                return <Shell group={g} groupKey={g[0].identity || g[0].id} onClose={() => setExpandedId(null)} onJump={jumpTo} />;
              })()}
            </React.Fragment>
          ))}
          {rows.length === 0 && (
            <div style={{padding:'40px 0', textAlign:'center', color:TC.MUTED, fontSize:13}}>
              No entities match this filter.
            </div>
          )}
        </div>
      </div>

      {/* Action bar — appears when selections exist */}
      {selected.size > 0 && <ActionBar selected={selected} onClear={clearSel} />}

      <div style={{borderTop:`1px solid ${TC.RULE}`, padding:'10px 28px', background:TC.PAPER_DEEP, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <ProvenanceLegend />
        <div className="mem-mono" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.1em'}}>
          click row to edit · check to select · resolve · promote · prune
        </div>
      </div>
    </div>
  );
}

function btnStyle(primary, destructive) {
  const c = destructive ? 'oklch(0.52 0.18 28)' : TC.INK;
  return {
    background: primary ? c : 'transparent',
    color: primary ? TC.PAPER : c,
    border: `1px solid ${c}`,
    padding:'5px 11px', borderRadius:2,
    fontFamily:TC.SANS, fontSize:11.5, fontWeight:500,
    cursor:'pointer', letterSpacing:'0.01em',
  };
}

function HealthRibbonFilterable({ filter, setFilter, problems }) {
  const chip = (k, label, n, sev) => {
    const active = filter === k;
    const tint = { err:'oklch(0.55 0.16 28)', warn:'oklch(0.65 0.14 70)', info:'oklch(0.55 0.05 240)' }[sev];
    return (
      <button key={k} onClick={() => setFilter(active ? null : k)} style={{
        display:'flex', alignItems:'center', gap:6, padding:'3px 9px',
        border:`1px solid ${active ? TC.INK : TC.RULE}`,
        background: active ? TC.INK : 'transparent',
        color: active ? TC.PAPER : TC.INK,
        borderRadius:2, cursor:'pointer',
        fontFamily:TC.SANS, fontSize:11.5, fontWeight:500,
      }}>
        <span style={{width:6, height:6, borderRadius:'50%', background:tint}} />
        {label}
        <span className="mem-mono" style={{fontSize:10, opacity:0.7}}>{n}</span>
      </button>
    );
  };
  return (
    <div style={{borderTop:`1px solid ${TC.RULE}`, borderBottom:`1px solid ${TC.RULE}`, padding:'8px 18px', background:TC.PAPER_DEEP, display:'flex', alignItems:'center', gap:10}}>
      <div className="mem-sans mem-smallcaps" style={{fontSize:9.5, color:TC.MUTED, letterSpacing:'0.14em', marginRight:6}}>Health · filter</div>
      {chip('contested','Contested',problems.contested,'warn')}
      {chip('stale','Stale memory',problems.stale,'info')}
      {chip('unknown','Unknown author',problems.unknown,'warn')}
      {chip('broken-import','Dead imports',problems.broken,'err')}
      <span style={{flex:1}} />
      <span className="mem-mono" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.08em'}}>
        2 ghost slugs · {problems.contested + problems.broken + problems.unknown + problems.stale} issues
      </span>
    </div>
  );
}

function SchematicHeader() {
  const cols = ['','Global','Plugin','Slug','Project','Local','Composite','Relations'];
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'22px 210px repeat(5, 1fr) 1.6fr 1.4fr',
      gap:10, paddingBottom:8, borderBottom:`1px solid ${TC.RULE}`,
    }}>
      <div />
      <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.2em'}}>Entity</div>
      {cols.slice(1).map((c, i) => (
        <div key={c+i} className="mem-sans mem-smallcaps" style={{
          fontSize:10, letterSpacing:'0.2em',
          color: (i===5 || i===6) ? TC.INK : TC.MUTED,
          textAlign: i<5 ? 'center' : 'left',
          borderBottom: i===5 ? `2px solid ${TC.INK}` : 'none',
          paddingBottom:4,
        }}>{c}</div>
      ))}
    </div>
  );
}

function SignalRow({ group, onPin, onJump, onExpand, onToggleSel, isPinned, isRelated, isExpanded, isChecked }) {
  const byScope = {};
  for (const a of group) byScope[a.scope] = a;
  const SCOPE_ORDER = ['global','plugin','slug','project','local'];
  const winner = group[group.length-1];
  const contested = group.length > 1;
  const auth = HC.authorOf(winner);
  const rels = relationsFor(winner.id);
  const groupKey = group[0].identity || group[0].id;

  return (
    <div data-row-id={winner.id} style={{
      display:'grid',
      gridTemplateColumns:'22px 210px repeat(5, 1fr) 1.6fr 1.4fr',
      gap:10, alignItems:'center',
      padding:'12px 6px',
      borderTop:`1px solid ${TC.RULE_SOFT}`,
      background: isExpanded ? TC.PAPER_DEEP : (isPinned ? 'oklch(0.97 0.03 55)' : (isRelated ? 'oklch(0.98 0.015 55)' : 'transparent')),
      boxShadow: isExpanded || isPinned ? `inset 0 0 0 1px ${TC.INK}` : (isRelated ? `inset 0 0 0 1px ${TC.RULE}` : 'none'),
      transition:'background .15s, box-shadow .15s',
      cursor:'pointer',
    }}
    onClick={() => onPin(winner.id)}
    >
      {/* checkbox */}
      <div onClick={(e) => { e.stopPropagation(); onToggleSel(winner.id); }} style={{display:'flex', justifyContent:'center'}}>
        <div style={{
          width:14, height:14, border:`1px solid ${isChecked ? TC.INK : TC.RULE}`,
          background: isChecked ? TC.INK : 'transparent', borderRadius:2,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {isChecked && <span style={{color:TC.PAPER, fontSize:10, lineHeight:1}}>✓</span>}
        </div>
      </div>

      {/* identity */}
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(groupKey); }}
          title={isExpanded ? 'Close editor' : 'Open editor'}
          style={{
            width:28, height:28, flexShrink:0,
            border:`1px solid ${isExpanded ? TC.INK : TC.RULE}`,
            background: isExpanded ? TC.INK : TC.PAPER,
            color: isExpanded ? TC.PAPER : TC.INK,
            borderRadius:3, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, fontWeight:600, lineHeight:1,
            transition:'background .15s, color .15s, border-color .15s',
          }}
        >
          <span style={{display:'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition:'transform .15s'}}>›</span>
        </button>
        <div style={{minWidth:0}}>
          <div className="mem-sans" style={{fontSize:15.5, fontWeight:600, lineHeight:1.15, color:TC.INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {winner.title}
          </div>
          <div className="mem-mono mem-smallcaps" style={{fontSize:9.5, color:TC.MUTED, letterSpacing:'0.12em', marginTop:2}}>
            {contested ? `${group.length} scopes` : 'single source'}
            {rels.out.length > 0 && <span> · {rels.out.length} out</span>}
            {rels.inb.length > 0 && <span> · {rels.inb.length} in</span>}
          </div>
        </div>
      </div>

      {SCOPE_ORDER.map(sk => {
        const a = byScope[sk];
        return (
          <div key={sk} style={{position:'relative', height:52, display:'flex', alignItems:'center', justifyContent:'center'}}>
            {a ? <SignalNode a={a} isWinner={a === winner && contested} shadowed={contested && a !== winner} /> : <EmptyLane />}
            {a && <WireSegment />}
          </div>
        );
      })}

      <div style={{
        padding:'8px 10px',
        border:`1.5px solid ${TC.INK}`,
        background:TC.PAPER,
        borderLeft:`3px solid ${auth.color}`,
        borderRadius:2,
      }}>
        <div className="mem-sans" style={{fontSize:13, fontWeight:500, color:TC.INK, lineHeight:1.35}}>
          {winner.intent.length > 56 ? winner.intent.slice(0,54)+'…' : winner.intent}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8, marginTop:3}}>
          <AuthorBadge author={winner.author} />
          <span className="mem-mono mem-smallcaps" style={{fontSize:9, letterSpacing:'0.14em', color:TC.MUTED}}>
            from {winner.scope}
          </span>
          {contested && <span className="mem-mono" style={{fontSize:10, color:TC.MUTED}}>· {group.length-1} shadowed</span>}
        </div>
      </div>

      <div onClick={e=>e.stopPropagation()} style={{display:'flex', flexDirection:'column', gap:3}}>
        {rels.out.map((r, i) => <RelationPill key={'o'+i} r={r} direction="out" onJump={onJump} />)}
        {rels.inb.map((r, i) => <RelationPill key={'i'+i} r={r} direction="in" onJump={onJump} />)}
        {rels.out.length === 0 && rels.inb.length === 0 && (
          <span className="mem-sans" style={{fontSize:12, color:TC.FAINT}}>—</span>
        )}
      </div>
    </div>
  );
}

function RelationPill({ r, direction, onJump }) {
  const data = D();
  const kind = data.REL_KINDS[r.kind];
  const otherId = direction === 'out' ? r.to : r.from;
  const otherEntity = findEntity(otherId);
  const label = otherEntity ? otherEntity.title : otherId;
  const otherType = otherEntity ? data.TYPES[otherEntity.type].label : (
    otherId.startsWith('tool:') ? 'Tool' :
    otherId.startsWith('slug:') ? 'Slug' :
    otherId.startsWith('@')     ? 'File' : '—'
  );
  const broken = r.broken;
  const verb = direction === 'out' ? kind.label : kind.inbound;
  const clickable = !!otherEntity;
  return (
    <div onClick={clickable ? () => onJump(otherId) : undefined} style={{
      display:'flex', alignItems:'center', gap:6, padding:'3px 6px',
      border:`1px solid ${broken ? 'oklch(0.65 0.16 28)' : TC.RULE_SOFT}`,
      borderLeft:`2px solid ${broken ? 'oklch(0.55 0.16 28)' : (direction==='out' ? TC.INK : TC.MUTED)}`,
      borderRadius:2, background: broken ? 'oklch(0.97 0.03 28)' : 'transparent',
      cursor: clickable ? 'pointer' : 'default',
    }}>
      <span className="mem-mono mem-smallcaps" style={{fontSize:8.5, color:TC.MUTED, letterSpacing:'0.14em', minWidth:62}}>{verb}</span>
      <span className="mem-sans" style={{
        fontSize:11.5, color: clickable ? TC.INK : TC.MUTED, fontWeight: clickable ? 500 : 400,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
        borderBottom: clickable ? `1px dotted ${TC.MUTED}` : 'none',
      }}>{label}</span>
      <span className="mem-mono" style={{fontSize:9, color:TC.FAINT, letterSpacing:'0.08em'}}>{otherType}</span>
    </div>
  );
}

function SignalNode({ a, isWinner, shadowed }) {
  const auth = HC.authorOf(a);
  return (
    <div style={{
      width:'100%', padding:'4px 7px',
      border:`1px solid ${isWinner ? TC.INK : TC.RULE}`,
      borderLeft:`3px solid ${auth.color}`,
      background: isWinner ? TC.PAPER : auth.tint,
      borderRadius:2, overflow:'hidden', whiteSpace:'nowrap', lineHeight:1.25,
      boxShadow: isWinner ? `1px 1px 0 ${TC.INK}` : 'none',
      opacity: shadowed ? 0.6 : 1,
    }} title={a.intent}>
      <div className="mem-mono mem-smallcaps" style={{fontSize:9, color:TC.MUTED, letterSpacing:'0.12em'}}>{a.scope}</div>
      <div className="mem-sans" style={{
        fontSize:11.5, color:TC.INK, fontWeight:400,
        overflow:'hidden', textOverflow:'ellipsis',
        textDecoration: shadowed ? 'line-through' : 'none', textDecorationColor: TC.FAINT,
      }}>{a.intent.length > 26 ? a.intent.slice(0,24)+'…' : a.intent}</div>
    </div>
  );
}

function EmptyLane() { return <div style={{width:'60%', height:1, borderTop:`1px dashed ${TC.RULE_SOFT}`}} />; }
function WireSegment() {
  return (
    <svg style={{position:'absolute', right:-8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none'}} width="16" height="10" viewBox="0 0 16 10">
      <path d="M0 5 L14 5" stroke={TC.MUTED} strokeWidth="1" fill="none" />
      <circle cx="14" cy="5" r="1.5" fill={TC.MUTED} />
    </svg>
  );
}

// ── Inline editor ─────────────────────────────────────────────
function InlineEditor({ group, groupKey, onClose, onJump }) {
  const winner = group[group.length-1];
  const [tab, setTab] = React.useState('edit');
  const [intent, setIntent] = React.useState(winner.intent);
  const [scope, setScope] = React.useState(winner.scope);
  const contested = group.length > 1;
  const ref = React.useRef(null);
  React.useEffect(() => {
    // scroll the editor into view inside the scrolling parent
    if (ref.current) {
      const el = ref.current;
      const scroller = el.closest('.mem-scroll');
      if (scroller) {
        const elTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({ top: Math.max(0, elTop - 120), behavior: 'smooth' });
      }
    }
  }, [groupKey]);

  return (
    <div ref={ref} style={{
      borderTop:`1px solid ${TC.RULE}`, borderBottom:`1px solid ${TC.RULE}`,
      background:TC.PAPER_DEEP, padding:'18px 28px',
      display:'grid', gridTemplateColumns:'1fr 320px', gap:24,
    }} onClick={e=>e.stopPropagation()}>
      <div>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:10}}>
          <span className="mem-sans mem-smallcaps" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.18em'}}>Editing</span>
          <span className="mem-sans" style={{fontSize:18, fontWeight:600, color:TC.INK}}>{winner.title}</span>
          <span style={{flex:1}} />
          <button onClick={onClose} style={btnStyle()}>close</button>
        </div>

        <div style={{display:'flex', gap:18, borderBottom:`1px solid ${TC.RULE}`, marginBottom:14}}>
          {[['edit','Edit'],['scope','Move scope'],['resolve','Resolve conflict'],['raw','Raw (escape hatch)']].map(([k,l])=>{
            if (k==='resolve' && !contested) return null;
            const active = tab===k;
            return (
              <button key={k} onClick={()=>setTab(k)} style={{
                background:'none', border:'none', padding:'8px 0', cursor:'pointer',
                borderBottom: active ? `2px solid ${TC.INK}` : '2px solid transparent',
                fontFamily:TC.SANS, fontSize:12.5, fontWeight: active?600:500,
                color: active ? TC.INK : TC.MUTED,
              }}>{l}</button>
            );
          })}
        </div>

        {tab === 'edit' && (
          <div>
            <FormField label="Intent" hint="One-sentence summary of what this does.">
              <textarea value={intent} onChange={e=>setIntent(e.target.value)} rows={3} style={fieldStyle()} />
            </FormField>
            <FormField label="Body" hint="Rendered as markdown. Toolbar above; no markdown knowledge required.">
              <div style={{border:`1px solid ${TC.RULE}`, borderRadius:2, background:TC.PAPER}}>
                <div style={{padding:'6px 10px', borderBottom:`1px solid ${TC.RULE_SOFT}`, display:'flex', gap:14}}>
                  {['B','I','•','1.','"','</>','@link'].map((t,i)=>(
                    <button key={i} style={{background:'none',border:'none',cursor:'pointer',fontSize:12, color:TC.MUTED, fontFamily:i===5?TC.MONO:TC.SANS, fontWeight:i===0?600:400, fontStyle:i===1?'italic':'normal'}}>{t}</button>
                  ))}
                </div>
                <div style={{padding:'12px 14px', minHeight:100, fontFamily:TC.SANS, fontSize:13.5, color:TC.INK, lineHeight:1.5}}>
                  {intent} Add further detail here without touching any markdown.
                </div>
              </div>
            </FormField>
          </div>
        )}

        {tab === 'scope' && (
          <FormField label="Move to scope" hint="Changes where this entity lives. Writes with a diff preview + backup.">
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {Object.keys(D().SCOPES).map(sk => {
                const active = scope===sk;
                return (
                  <button key={sk} onClick={()=>setScope(sk)} style={{
                    padding:'6px 12px', borderRadius:2,
                    border:`1px solid ${active ? TC.INK : TC.RULE}`,
                    background: active ? TC.INK : 'transparent',
                    color: active ? TC.PAPER : TC.INK,
                    fontFamily:TC.MONO, fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase',
                    cursor:'pointer',
                  }}>{sk}</button>
                );
              })}
            </div>
            <div className="mem-sans" style={{fontSize:12, color:TC.MUTED, marginTop:10}}>
              Current: <b style={{color:TC.INK}}>{winner.scope}</b> → New: <b style={{color:TC.INK}}>{scope}</b>
            </div>
          </FormField>
        )}

        {tab === 'resolve' && contested && (
          <div>
            <div className="mem-sans" style={{fontSize:13, color:TC.MUTED, marginBottom:12, lineHeight:1.5}}>
              Pick one winner. Other scopes can be <b>deleted</b>, <b>merged</b> into the winner, or <b>kept as overrides</b>.
            </div>
            {group.map((a, i) => {
              const isWinner = a === winner;
              return (
                <div key={a.id} style={{
                  display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, alignItems:'center',
                  padding:'10px 12px', borderTop:`1px solid ${TC.RULE_SOFT}`,
                  background: isWinner ? TC.PAPER : 'transparent',
                  border: isWinner ? `1px solid ${TC.INK}` : 'none',
                }}>
                  <span className="mem-mono mem-smallcaps" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.14em', minWidth:60}}>{a.scope}</span>
                  <span className="mem-sans" style={{fontSize:13, color:TC.INK}}>{a.intent}</span>
                  <div style={{display:'flex', gap:6}}>
                    {!isWinner && <button style={btnStyle()}>make winner</button>}
                    {!isWinner && <button style={btnStyle(false,true)}>delete</button>}
                    {isWinner && <span className="mem-sans mem-smallcaps" style={{fontSize:10, color:TC.INK, letterSpacing:'0.14em'}}>current winner</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'raw' && (
          <div style={{border:`1px solid ${TC.RULE}`, borderRadius:2, background:'#1f1c17', color:'#e9e3d6', fontFamily:TC.MONO, fontSize:12.5, lineHeight:1.6, padding:'14px 16px', minHeight:180, position:'relative'}}>
            <div style={{position:'absolute', top:8, right:12, fontFamily:TC.SANS, fontSize:9.5, color:'rgba(233,227,214,0.5)', letterSpacing:'0.14em', textTransform:'uppercase'}}>Escape hatch</div>
            <span style={{color:'#c5b68a'}}># {winner.title}</span>{'\n\n'}
            <span>{winner.intent}</span>
          </div>
        )}
      </div>

      {/* Right rail: context + save */}
      <div style={{borderLeft:`1px solid ${TC.RULE}`, paddingLeft:20}}>
        <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.2em', marginBottom:10}}>Context</div>
        <div className="mem-sans" style={{fontSize:12, color:TC.MUTED, lineHeight:1.5, marginBottom:12}}>
          Edits preview a diff, write a timestamped backup, then apply. Undo is one click.
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <button style={btnStyle()}>Preview diff</button>
          <button style={btnStyle(true)}>Save with backup</button>
        </div>
        <div className="mem-mono" style={{fontSize:10, color:TC.FAINT, marginTop:14, lineHeight:1.5}}>
          writes to <span style={{color:TC.MUTED}}>~/.claude/… .md</span>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div style={{marginBottom:16}}>
      <div className="mem-sans mem-smallcaps" style={{fontSize:10, color:TC.MUTED, letterSpacing:'0.18em', marginBottom:6}}>{label}</div>
      {children}
      {hint && <div className="mem-sans" style={{fontSize:11.5, color:TC.FAINT, marginTop:4, lineHeight:1.45}}>{hint}</div>}
    </div>
  );
}
function fieldStyle() {
  return {
    width:'100%', padding:'10px 12px', border:`1px solid ${TC.RULE}`, borderRadius:2,
    background:TC.PAPER, fontFamily:TC.SANS, fontSize:13.5, lineHeight:1.5,
    color:TC.INK, resize:'vertical', outline:'none',
  };
}

// ── Bulk action bar (pinned to bottom when items selected) ────
function ActionBar({ selected, onClear }) {
  const ids = [...selected];
  const ents = ids.map(findEntity).filter(Boolean);
  const contested = ents.filter(e => {
    const g = D().ARTIFACTS.filter(x => x.identity && x.identity === e.identity);
    return g.length > 1;
  });
  const stale    = ents.filter(e => e.stale);
  const ghosts   = ents.filter(e => e.warn || e.author==='unknown');

  const actions = [];
  if (contested.length) actions.push(['Resolve to winner', false]);
  if (contested.length) actions.push(['Delete shadowed',    true]);
  actions.push(['Promote to higher scope', false]);
  actions.push(['Demote to lower scope',   false]);
  if (stale.length)  actions.push(['Dismiss stale', false]);
  if (ghosts.length) actions.push(['Flag for review', false]);
  actions.push(['Delete entity', true]);

  return (
    <div style={{
      position:'absolute', left:18, right:18, bottom:54,
      background:TC.INK, color:TC.PAPER, borderRadius:4,
      padding:'10px 16px', display:'flex', alignItems:'center', gap:14,
      boxShadow:'0 12px 28px -8px rgba(0,0,0,0.35)',
      zIndex:20,
    }}>
      <span className="mem-sans mem-smallcaps" style={{fontSize:10, letterSpacing:'0.2em', opacity:0.7}}>Selected</span>
      <span className="mem-sans" style={{fontSize:14, fontWeight:600}}>{selected.size} entities</span>
      <span style={{opacity:0.5, fontSize:11}}>
        {contested.length ? `${contested.length} contested · ` : ''}
        {stale.length ? `${stale.length} stale · ` : ''}
        {ghosts.length ? `${ghosts.length} flagged` : ''}
      </span>
      <span style={{flex:1}} />
      {actions.map(([label, danger], i) => (
        <button key={i} style={{
          background:'transparent', color: danger ? 'oklch(0.75 0.18 28)' : TC.PAPER,
          border:`1px solid ${danger ? 'oklch(0.55 0.18 28)' : 'rgba(246,243,236,0.3)'}`,
          padding:'5px 10px', borderRadius:2, cursor:'pointer',
          fontFamily:TC.SANS, fontSize:11.5, fontWeight:500,
        }}>{label}</button>
      ))}
      <button onClick={onClear} style={{
        background:'transparent', color:TC.PAPER, border:'none',
        padding:'5px 10px', cursor:'pointer', opacity:0.6, fontFamily:TC.SANS, fontSize:11.5,
      }}>clear</button>
    </div>
  );
}

window.VariationC = VariationC;
