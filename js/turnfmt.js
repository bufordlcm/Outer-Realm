'use strict';
/* =========================================================================
   How the player writes a turn
     say mode (default): plain text = what my character says,
                         *text in asterisks* = what my character does
     act mode:           plain text = what my character does,
                         "text in quotes" = what my character says
     both:               (( double parentheses )) = out of character, to the GM
   The composer's buttons insert the marks. Each message is turned into a clear
   "X says / X does / to the GM" form for the AI, so it never mixes them up.
   ========================================================================= */
const typeMode = () => S.settings.ui.typeMode === 'act' ? 'act' : 'say';
const traitDesc = t => t.trigger || arr(t.effects).join('; ') || t.desc || '';
const TRAIT_TAG = /\[✦\s*([^\]]+?)\s*\]/g;
/* traits the player tagged in a turn with the ✦ Trait button */
function turnTraits(c, text) {
  const ts = arr(c?.character?.traits); const out = [];
  for (const m of String(text || '').matchAll(TRAIT_TAG)) { const n = m[1].toLowerCase(); const t = ts.find(x => x.name.toLowerCase() === n) || ts.find(x => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())); if (t && !out.includes(t)) out.push(t); }
  return out;
}
function parseTurn(text, mode = 'act') {
  const parts = []; const s = String(text || '').replace(TRAIT_TAG, ' ');
  const add = (k, t) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (!t || !/[\p{L}\p{N}]/u.test(t)) return; const p = parts[parts.length - 1]; if (p && p.k === k) p.t += ' ' + t; else parts.push({ k, t }); };
  const re = /\(\(([\s\S]*?)\)\)|\*([^*\n]+)\*|[“"]([^”"]+)[”"]/g; let i = 0, m;
  while ((m = re.exec(s))) {
    add(mode === 'say' ? 'say' : 'act', s.slice(i, m.index));
    if (m[1] !== undefined) add('ooc', m[1]); else if (m[2] !== undefined) add('act', m[2]); else add('say', m[3]);
    i = re.lastIndex;
  }
  add(mode === 'say' ? 'say' : 'act', s.slice(i));
  return parts;
}
const turnAllOOC = (text, mode) => { const p = parseTurn(text, mode); return p.length > 0 && p.every(x => x.k === 'ooc'); };
/* what the AI sees for one player message */
function turnForGM(c, text, mode = 'act') {
  const n = c.character?.name || 'The player';
  const tr = turnTraits(c, text).map(t => t.polarity === '-' ? `(${n} gives in to their flaw "${t.name}"${traitDesc(t) ? ': ' + traitDesc(t) : ''}.)` : `(${n} draws on their trait "${t.name}"${traitDesc(t) ? ': ' + traitDesc(t) : ''}. Let it shape how this goes.)`).join('\n');
  const body = turnBody(c, String(text || '').replace(TRAIT_TAG, ' ').trim() ? text : '', mode, n);
  return [body, tr].filter(Boolean).join('\n');
}
function turnBody(c, text, mode, n) {
  const parts = parseTurn(text, mode);
  if (!parts.length) return String(text || '').replace(TRAIT_TAG, '').trim();
  if (parts.every(p => p.k === 'ooc')) return `(( ${parts.map(p => p.t).join(' ')} ))`;
  if (parts.every(p => p.k === 'act')) return parts.map(p => p.t).join(' ');
  if (isCompanion(c) && parts.every(p => p.k === 'say')) return parts.map(p => p.t).join(' ');
  return parts.map(p => p.k === 'say' ? `${n} says: "${p.t}"` : p.k === 'act' ? `${n} does: ${p.t}` : `(( out of character, to you the GM: ${p.t} ))`).join('\n');
}
/* how the message looks in the story */
function turnHTML(text, mode = 'act') {
  const tags = [...String(text || '').matchAll(TRAIT_TAG)].map(m => `<span class="ttrait">✦ ${esc(m[1])}</span>`).join(' ');
  return (tags ? tags + ' ' : '') + parseTurn(text, mode).map(p => p.k === 'act' ? `<em class="tact">${esc(p.t)}</em>` : p.k === 'ooc' ? `<span class="tooc">(( ${esc(p.t)} ))</span>` : `<span class="tsay">${mode === 'act' ? '“' + esc(p.t) + '”' : esc(p.t)}</span>`).join(' ');
}
/* composer buttons: wrap the selection, or drop in the marks with the cursor between them */
function fmtInsert(k) {
  const el = $('#input'); if (!el) return;
  const [a, b] = k === 'act' ? ['*', '*'] : k === 'ooc' ? ['(( ', ' ))'] : ['"', '"'];
  const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s, v = el.value, sel = v.slice(s, e);
  const lead = s > 0 && !/\s$/.test(v.slice(0, s)) ? ' ' : '';
  el.value = v.slice(0, s) + lead + a + sel + b + v.slice(e);
  const pos = sel ? s + lead.length + a.length + sel.length + b.length : s + lead.length + a.length;
  el.focus(); el.setSelectionRange(pos, pos); autoGrow(el);
}
function fmtBarHTML(c) {
  if (c.phase === 'session0') return '';
  const say = typeMode() === 'say';
  return `<div class="fmtbar">
    <button class="fmtbtn" data-act="fmt" data-k="act" title="What your character does">✋ Action</button>
    ${say ? '' : '<button class="fmtbtn" data-act="fmt" data-k="say" title="What your character says">💬 Say</button>'}
    <button class="fmtbtn" data-act="fmt" data-k="ooc" title="Out of character, to the GM">(( )) Talk to GM</button>
    ${!isCompanion(c) && arr(c.character?.traits).length ? `<button class="fmtbtn ${S.drawer === 'traits' ? 'on' : ''}" data-act="drawer" data-k="traits" title="Use one of your traits in this turn">✦ Trait</button>` : ''}
    ${!isCompanion(c) ? `<button class="fmtbtn ${S.drawer === 'gear' ? 'on' : ''}" data-act="drawer" data-k="gear" title="Check your gear without leaving the text box">🎒 Gear</button>` : ''}
    <span class="fmthint">${say ? 'Plain text is what you say.' : 'Plain text is what you do.'}</span></div><div id="fmtDrawer">${drawerHTML(c)}</div>`;
}
/* the drawer above the text box: gear or traits, tap one to drop it into your turn */
function drawerHTML(c) {
  const ch = c?.character; if (!ch || !S.drawer) return '';
  if (S.drawer === 'gear') {
    const g = arr(ch.gear);
    return `<div class="drawer"><div class="dhd"><b>🎒 Gear</b><span>${ch.gold} gold · ${ch.hp}/${ch.maxHp} HP</span><button class="link" data-act="drawer" data-k="">Close</button></div>
      ${g.length ? `<div class="ditems">${g.map((x, i) => `<button class="ditem" data-act="drawpick" data-k="gear" data-i="${i}" title="Tap to mention it in your turn"><b>${esc(x.name)}</b>${x.desc ? `<small>${esc(x.desc)}</small>` : ''}</button>`).join('')}</div>` : '<p class="hint">You\'re not carrying anything.</p>'}
      <p class="hint" style="margin:6px 0 0">Tap an item to add it to what you're writing.</p></div>`;
  }
  const ts = arr(ch.traits);
  const row = t => `<button class="ditem ${t.polarity === '-' ? 'flaw' : ''}" data-act="drawpick" data-k="trait" data-id="${esc(t.id)}"><b>${t.polarity === '-' ? '⚠ ' : '✦ '}${esc(t.name)} <span class="tb ${t.tier}">${t.tier}</span></b>${traitDesc(t) ? `<small>${esc(traitDesc(t))}</small>` : ''}</button>`;
  return `<div class="drawer"><div class="dhd"><b>✦ Use a trait</b><span>Tap one to add it to your turn</span><button class="link" data-act="drawer" data-k="">Close</button></div>
    <div class="ditems">${ts.filter(t => t.polarity !== '-').map(row).join('')}${ts.filter(t => t.polarity === '-').map(row).join('')}</div>
    <p class="hint" style="margin:6px 0 0">Strengths help your action, and if it needs a roll the GM adds their bonus automatically. Playing into a flaw (⚠) can earn you EP.</p></div>`;
}
function toggleDrawer(k) { S.drawer = k && S.drawer !== k ? k : null; const d = $('#fmtDrawer'); if (d) d.innerHTML = drawerHTML(cur()); document.querySelectorAll('.fmtbtn[data-act=drawer]').forEach(b => b.classList.toggle('on', b.dataset.k === S.drawer)); }
function drawerPick(el) {
  const c = cur(); const inp = $('#input'); if (!c || !inp) return;
  let ins = '';
  if (el.dataset.k === 'gear') { const g = arr(c.character.gear)[num(el.dataset.i)]; if (g) ins = g.name; }
  else { const t = arr(c.character.traits).find(x => x.id === el.dataset.id); if (t) { if (turnTraits(c, inp.value).includes(t)) return toast(t.name + ' is already in this turn.'); ins = `[✦ ${t.name}]`; } }
  if (!ins) return;
  const s = inp.selectionStart ?? inp.value.length, v = inp.value;
  const lead = s > 0 && !/\s$/.test(v.slice(0, s)) ? ' ' : ''; const tail = /^\S/.test(v.slice(s)) ? ' ' : '';
  inp.value = v.slice(0, s) + lead + ins + tail + v.slice(s);
  const pos = s + lead.length + ins.length + tail.length; inp.focus(); inp.setSelectionRange(pos, pos); autoGrow(inp);
}
document.addEventListener('pointerdown', e => { if (e.target.closest?.('.fmtbtn, .ditem, .drawer .link')) e.preventDefault(); });   /* keep the cursor in the text box */
