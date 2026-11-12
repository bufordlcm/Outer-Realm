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
function parseTurn(text, mode = 'act') {
  const parts = []; const s = String(text || '');
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
  const parts = parseTurn(text, mode); const n = c.character?.name || 'The player';
  if (!parts.length) return String(text || '');
  if (parts.every(p => p.k === 'ooc')) return `(( ${parts.map(p => p.t).join(' ')} ))`;
  if (parts.every(p => p.k === 'act')) return parts.map(p => p.t).join(' ');
  if (isCompanion(c) && parts.every(p => p.k === 'say')) return parts.map(p => p.t).join(' ');
  return parts.map(p => p.k === 'say' ? `${n} says: "${p.t}"` : p.k === 'act' ? `${n} does: ${p.t}` : `(( out of character, to you the GM: ${p.t} ))`).join('\n');
}
/* how the message looks in the story */
function turnHTML(text, mode = 'act') {
  return parseTurn(text, mode).map(p => p.k === 'act' ? `<em class="tact">${esc(p.t)}</em>` : p.k === 'ooc' ? `<span class="tooc">(( ${esc(p.t)} ))</span>` : `<span class="tsay">${mode === 'act' ? '“' + esc(p.t) + '”' : esc(p.t)}</span>`).join(' ');
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
    <span class="fmthint">${say ? 'Plain text is what you say.' : 'Plain text is what you do.'}</span></div>`;
}
document.addEventListener('pointerdown', e => { if (e.target.closest?.('.fmtbtn')) e.preventDefault(); });   /* keep the cursor in the text box */
