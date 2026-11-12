'use strict';
/* =========================================================================
   Long-term memory and story direction
   - Open threads: unresolved things (an injury, a promise, a locked door, a missing person)
     the GM must follow up on. Kept by a background memory check.
   - Continuity notes: corrections the memory check found (contradictions between scenes).
   - Pacing director: notices when the story is stuck in one situation and tells the GM
     to move it forward toward the next roadmap beat.
   The memory check runs by itself every few turns, while you read and type, and on demand
   from Panel → Memory.
   ========================================================================= */
const MEM_EVERY = 4;   /* turns between automatic memory checks */

/* ---------- progress & stalls ---------- */
const progressKey = c => JSON.stringify([String(c.location || '').toLowerCase(), c.rmAct, arr(c.rmDone).length, arr(c.quests).map(q => q.title + q.status), peopleOf(c).length, arr(c.codex).length, !!c.combat, arr(c.threads).filter(t => t.status !== 'open').length]);
function trackProgress(c, before) {
  const moved = progressKey(c) !== before;
  c.stall = moved ? 0 : num(c.stall) + 1;
  c.memTurns = num(c.memTurns) + 1;
}
function pacingDirective(c) {
  const r = typeof roadmapState === 'function' ? roadmapState(c) : null;
  const next = r && !r.finished && r.left.length ? r.left[0] : '';
  const lines = [];
  if (next) lines.push(`NEXT STORY BEAT TO AIM FOR (hidden): ${next}. Let the world steer toward it through hooks, people and events.`);
  const st = num(c.stall);
  if (st >= 3) lines.push(`THE STORY IS STUCK: the last ${st} scenes changed nothing important. THIS scene must move the story forward: ${next ? `make "${next}" start happening, or ` : ''}bring in something new that forces the issue (an arrival, an attack, a discovery, a deadline, someone changing their mind). Do not repeat the situation, descriptions or lines of earlier scenes.`);
  else if (st === 2) lines.push('The last scenes stayed in the same situation: make something change in this one (new information, a new problem, someone acts on their own goals).');
  return lines.length ? 'STORY DIRECTION\n' + lines.join('\n') : '';
}

/* ---------- prompt blocks the GM sees ---------- */
function memoryPrompt(c) {
  const open = arr(c.threads).filter(t => t.status === 'open').slice(-10);
  const out = [];
  if (open.length) out.push('OPEN THREADS (unresolved: keep them consistent and follow up on them when it fits; never forget them)', ...open.map(t => '- ' + t.text));
  const notes = arr(c.continuity).slice(-6);
  if (notes.length) out.push('', 'CONTINUITY (facts the memory check confirmed: always stay consistent with these)', ...notes.map(n => '- ' + n));
  return out.join('\n');
}

/* ---------- the memory check ---------- */
async function memoryCheck(c, force = false) {
  if (!c || c.memBusy || isCompanion(c) && !force) return;
  if (!force && num(c.memTurns) < MEM_EVERY) return;
  const scenes = c.messages.filter(m => ['gm','player','roll'].includes(m.role) && !m.hidden && !m.rollAsk && m.text).slice(-12)
    .map(m => `${m.role === 'gm' ? 'GM' : m.role === 'roll' ? 'DICE' : 'PLAYER'}: ${String(m.gm || m.text).slice(0, 900)}`).join('\n\n');
  if (!scenes) return;
  c.memBusy = true; renderMemNow(c);
  const ch = c.character;
  const open = arr(c.threads).filter(t => t.status === 'open');
  try {
    const raw = await chat([
      { role:'system', content:`You are the continuity keeper for a long tabletop RPG campaign. Read the story memory and the latest scenes and keep the memory accurate. Be strict and concrete.
Reply with JSON only:
{"threads_new":["short unresolved thing: a wound not yet treated, a promise, a debt, a locked door, a missing person, a clue not followed, an enemy who escaped"],
 "threads_resolved":[numbers of OPEN THREADS that were clearly resolved in the scenes],
 "facts":["short lasting fact worth remembering: who is where, who knows what, relationships, what an NPC promised, what the player character owns or lost"],
 "contradictions":[{"problem":"what the scenes or records got wrong or left unexplained (e.g. the player took damage but no scene shows how)","fix":"the true version the GM should stick to from now on"}]}
Only report real things from the scenes. Use [] when there is nothing.` },
      { role:'user', content:`CHARACTER: ${ch.name}. HP ${ch.hp}/${ch.maxHp}. Injuries: ${arr(ch.injuries).map(i => i.name).join(', ') || 'none'}. Gear: ${arr(ch.gear).map(g => g.name).join(', ') || 'none'}. Place: ${c.location || 'unknown'}.

STORY SO FAR:
${c.summary || '(no summary yet)'}

KNOWN FACTS:
${arr(c.memory).slice(-30).map(m => '- ' + m).join('\n') || '(none)'}

OPEN THREADS:
${open.map((t, i) => `${i + 1}. ${t.text}`).join('\n') || '(none)'}

LATEST SCENES:
${scenes}` }
    ], { stream:false, maxTokens:900, temperature:0.2, helper:true, json:true });
    const j = tryJSON(stripThink(raw)) || {};
    const found = [];
    for (const n of arr(j.threads_resolved)) { const t = open[num(n) - 1]; if (t) { t.status = 'resolved'; t.done = Date.now(); found.push('✓ ' + t.text); } }
    c.threads = arr(c.threads);
    for (const s of arr(j.threads_new).map(x => String(x).trim()).filter(Boolean).slice(0, 5))
      if (!c.threads.some(t => t.text.toLowerCase() === s.toLowerCase())) { c.threads.push({ id: uid(), text: s.slice(0, 200), status: 'open', t: Date.now() }); found.push('+ ' + s); }
    c.memory = arr(c.memory);
    for (const f of arr(j.facts).map(x => String(x).trim()).filter(Boolean).slice(0, 6))
      if (!c.memory.some(m => m.toLowerCase() === f.toLowerCase())) c.memory.push(f.slice(0, 200));
    if (c.memory.length > 60) c.memory = c.memory.slice(-60);
    c.continuity = arr(c.continuity);
    for (const x of arr(j.contradictions)) { const fix = String(x?.fix || '').trim(); if (fix) { c.continuity.push(fix.slice(0, 220)); found.push('⚠ ' + String(x.problem || fix).slice(0, 160)); } }
    if (c.continuity.length > 12) c.continuity = c.continuity.slice(-12);
    c.threads = c.threads.filter(t => t.status === 'open' || Date.now() - (t.done || 0) < 7 * 864e5).slice(-40);
    c.memChecked = Date.now(); c.memTurns = 0; c.memLast = found.slice(0, 12);
    touch(c); scheduleSync();
  } catch (e) { console.warn('Memory check failed', e); if (force) toast('Memory check failed: ' + e.message, 5000); }
  finally { c.memBusy = false; renderMemNow(c); }
}
function renderMemNow(c) { if (S.panel === 'mem' && cur() === c) renderPanel(); }

/* ---------- Panel → Memory ---------- */
function panelMemHTML(c) {
  const open = arr(c.threads).filter(t => t.status === 'open');
  const done = arr(c.threads).filter(t => t.status !== 'open').slice(-5);
  const when = c.memChecked ? new Date(c.memChecked).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : '';
  const nextIn = Math.max(0, MEM_EVERY - num(c.memTurns));
  return `<p class="hint" style="margin-top:0">What the GM is keeping track of. It checks itself every ${MEM_EVERY} turns while you play${when ? ` (last check ${when}${c.memBusy ? '' : nextIn ? `, next in ${nextIn} turn${nextIn > 1 ? 's' : ''}` : ', next after this turn'})` : ''}.</p>
    <button class="btn wide" data-act="memcheck" ${c.memBusy ? 'disabled' : ''}>${c.memBusy ? '<span class="spin sm"></span> Checking the story…' : icon('search') + ' Check memory now'}</button>
    ${arr(c.memLast).length ? `<div class="lbl">Last check found</div>${c.memLast.map(x => `<div class="pline ${x[0] === '⚠' ? 'bad' : ''}">${esc(x)}</div>`).join('')}` : ''}
    ${num(c.stall) >= 2 ? `<div class="lbl">Pacing</div><div class="pline bad">The story has stayed in the same situation for ${c.stall} scenes. The GM has been told to move it forward.</div>` : ''}
    <div class="lbl">Open threads</div>
    ${open.length ? open.map(t => `<div class="pline memrow"><span>${esc(t.text)}</span><button class="link" data-act="memdone" data-id="${t.id}" title="Mark resolved">✓</button></div>`).join('') : '<p class="hint">Nothing unresolved yet.</p>'}
    <div class="row" style="margin-top:6px"><input id="memAdd" placeholder="Add something the GM must not forget…" style="flex:1"><button class="btn sm" data-act="memadd">Add</button></div>
    ${arr(c.continuity).length ? `<div class="lbl">Continuity notes</div>${arr(c.continuity).slice(-6).map((n, i, a) => `<div class="pline memrow"><span>${esc(n)}</span><button class="link" data-act="memcont" data-i="${arr(c.continuity).length - a.length + i}" title="Remove">✕</button></div>`).join('')}` : ''}
    ${done.length ? `<div class="lbl">Recently resolved</div>${done.map(t => `<div class="pline" style="opacity:.6">✓ ${esc(t.text)}</div>`).join('')}` : ''}
    <div class="lbl">Story so far</div><p class="ptext">${esc(c.summary || 'Written automatically once the story gets long.')}</p>
    <div class="lbl">Key facts (${arr(c.memory).length})</div>
    ${arr(c.memory).slice(-12).reverse().map(m => `<div class="pline">${esc(m)}</div>`).join('') || '<p class="hint">None yet.</p>'}
    <div class="lbl">Story cards (${arr(c.cards).length})</div>
    ${arr(c.cards).length ? `<p class="hint">${['person','place','map','item','event','creature','lore','faction','rule'].map(k => [k, arr(c.cards).filter(x => x.kind === k).length]).filter(x => x[1]).map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(' · ')}. The GM gets the ones that matter in each scene.</p>` : '<p class="hint">Import a story bible to give the GM detailed people, places, maps and events.</p>'}
    <button class="btn sm wide" data-act="bibleopen" data-for="game">${icon('scroll')} Add a story bible or more cards</button>
    <button class="btn sm ghost wide" data-act="tools" style="margin-top:10px">Edit all memory in Campaign tools</button>`;
}
function memoryAction(act, el, c) {
  if (!c) return false;
  switch (act) {
    case 'memcheck': memoryCheck(c, true); return true;
    case 'memdone': { const t = arr(c.threads).find(x => x.id === el.dataset.id); if (t) { t.status = 'resolved'; t.done = Date.now(); touch(c); renderPanel(); } return true; }
    case 'memadd': { const v = ($('#memAdd')?.value || '').trim(); if (!v) return true; c.threads = arr(c.threads); c.threads.push({ id: uid(), text: v.slice(0, 200), status: 'open', t: Date.now() }); touch(c); renderPanel(); return true; }
    case 'memcont': { c.continuity = arr(c.continuity); c.continuity.splice(num(el.dataset.i), 1); touch(c); renderPanel(); return true; }
  }
  return false;
}

/* ---------- damage must be explained ---------- */
/* the record keeper sometimes reports damage the scene never showed; only apply it when the scene shows the hit */
const HURT_TEXT = /\b(you|your)\b[^.!?]{0,90}\b(hit|hits|struck|strikes?|slash\w*|cuts?|stab\w*|pierc\w*|wound\w*|bleed\w*|blood|pain|burn\w*|crush\w*|graz\w*|bruis\w*|gash\w*|injur\w*|hurt\w*|knock\w* (?:you )?(?:down|back|off)|sting\w*|bit(?:e|es|ten)|scald\w*|sear\w*|lands? (?:a|the) blow|catches you|take[sn]? the (?:hit|blow))\b|\b(hits?|strikes?|slams?|catches|cuts?|stabs?|bites?|gores?|clips?)\s+you\b/i;
const sceneShowsHurt = text => HURT_TEXT.test(String(text || ''));
