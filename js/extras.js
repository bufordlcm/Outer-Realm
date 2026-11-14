'use strict';
/* =========================================================================
   Extras:
   - Back up everything: stories AND companions, personas, memories, shared settings
   - Search inside a chat or a story, and jump to the message
   - How each companion feels about the others (used in group chats)
   - 👗 Outfit and 📍 Location buttons in a chat
   - Shared settings: one world several companions live in
   - Favourite pictures (the star itself lives in pics.js)
   ========================================================================= */

/* ---------- 1. backup: companions travel in the same file as the stories ---------- */
const palExport = () => ({ pals: PALS.pals, chats: PALS.chats, personas: PALS.personas, worlds: PALS.worlds, defaultPersona: PALS.defaultPersona || '' });
/* restoring puts back exactly what the file holds, even over a newer or a deleted copy */
function palRestore(data) {
  if (!data || typeof data !== 'object') return 0; let n = 0;
  for (const k of ['pals', 'chats', 'personas', 'worlds']) for (const [id, x] of Object.entries(data[k] || {})) {
    if (!x || typeof x !== 'object') continue;
    PALS[k][id] = k === 'pals' ? palUpgrade(x) : x; PALS[k][id].updatedAt = Date.now(); delete PALS.deleted[id]; if (k === 'pals') n++;
  }
  if (!PALS.personas[PALS.defaultPersona] && PALS.personas[data.defaultPersona]) PALS.defaultPersona = data.defaultPersona;
  savePals(); return n;
}

/* ---------- 2. search ---------- */
const searchWhere = () => S.view === 'palchat' ? 'chat' : S.view === 'game' ? 'game' : '';
function searchRows(q) {
  q = String(q || '').trim().toLowerCase(); if (q.length < 2) return [];
  const out = [];
  if (searchWhere() === 'chat') {
    const ch = curChat(); if (!ch) return out;
    for (const m of arr(ch.messages)) { if (m.role === 'sys' || !String(m.text || '').toLowerCase().includes(q)) continue; out.push({ id: m.id, who: m.role === 'user' ? (meName(ch) === 'you' ? 'You' : meName(ch)) : (palWho(ch, m)?.name || ''), text: m.text, t: m.t }); }
  } else if (searchWhere() === 'game') {
    const c = cur(); if (!c) return out;
    for (const m of arr(c.messages)) {
      if (m.hidden || !['gm', 'player', 'comp', 'roll'].includes(m.role)) continue;
      const hay = [m.text, ...arr(m.encLog).map(x => x.text)].join('\n'); if (!hay.toLowerCase().includes(q)) continue;
      out.push({ id: m.id, who: m.role === 'gm' ? gmOf(c).name : m.role === 'comp' ? m.name : m.role === 'roll' ? 'Dice' : (m.who || c.character.name), text: String(m.text || '').toLowerCase().includes(q) ? m.text : arr(m.encLog).find(x => String(x.text).toLowerCase().includes(q)).text, t: m.t, enc: !String(m.text || '').toLowerCase().includes(q) });
    }
  }
  return out.reverse();
}
function searchSnip(text, q) {
  const s = stripSpeakerTags(String(text || '')).replace(/\s+/g, ' '); const i = s.toLowerCase().indexOf(q.toLowerCase()); if (i < 0) return esc(s.slice(0, 160));
  const a = Math.max(0, i - 60), b = Math.min(s.length, i + q.length + 90);
  return (a ? '…' : '') + esc(s.slice(a, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length, b)) + (b < s.length ? '…' : '');
}
function searchResultsHTML() {
  const q = (S.searchQ || '').trim(); if (q.length < 2) return '<p class="hint">Type at least two letters.</p>';
  const rows = searchRows(q); if (!rows.length) return `<p class="hint">Nothing found for "${esc(q)}".</p>`;
  return `<p class="hint">${rows.length} match${rows.length === 1 ? '' : 'es'}, newest first. Tap one to jump to it.</p>` + rows.slice(0, 80).map(r => `<button class="srow" data-act="searchgo" data-id="${r.id}"><b>${esc(r.who)}</b><small>${r.t ? new Date(r.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}${r.enc ? ' · in an encounter log' : ''}</small><span>${searchSnip(r.text, q)}</span></button>`).join('');
}
function searchModalHTML() {
  return [searchWhere() === 'chat' ? 'Search this chat' : 'Search this story', `<input type="text" id="searchQ" placeholder="A word, a name, a place…" value="${esc(S.searchQ || '')}"><div id="searchRes" style="margin-top:8px">${searchResultsHTML()}</div>`];
}
function searchGo(id) {
  S.modal = null; $('#modalRoot').innerHTML = '';
  const box = searchWhere() === 'chat' ? $('#pallog') : $('#log'); const el = box?.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!el) return toast('That message is no longer on screen.');
  if (el.querySelector('details.enclog')) el.querySelector('details.enclog').open = true;
  el.scrollIntoView({ block: 'center' }); el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 2600);
}

/* ---------- 3. how companions feel about each other ---------- */
function palFeelsHTML(D) {
  const others = allPals().filter(p => p.id !== D.id); if (!others.length) return '';
  D.feels = D.feels || {};
  return `<div class="lbl">How ${esc(first(D.name) || 'they')} sees your other companions (used in group chats)</div>
    <p class="hint" style="margin-top:0">Optional. A line each: friends, rivals, jealous of her, can't stand her, has never met her…</p>
    ${others.map(o => `<label class="f feel"><span>${esc(o.name)}</span><input data-pfeel="${o.id}" value="${esc(D.feels[o.id] || '')}" placeholder="e.g. best friend since school, but a little jealous"></label>`).join('')}`;
}
const palFeelsLine = (p, ps) => { const l = ps.filter(o => o !== p && String(p.feels?.[o.id] || '').trim()).map(o => `${o.name}: ${p.feels[o.id].trim()}`); return l.length ? `How ${first(p.name)} feels about the others here: ${l.join('; ')}` : ''; };

/* ---------- 5. shared settings ---------- */
const allWorlds = () => Object.values(PALS.worlds || {}).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const palWorldsFor = ps => allWorlds().filter(w => arr(w.palIds).some(id => ps.some(p => p.id === id)) && String(w.text || '').trim());
function palWorldBlock(ps) {
  return palWorldsFor(ps).slice(0, 2).map(w => { const here = ps.filter(p => arr(w.palIds).includes(p.id)).map(p => p.name);
    return `SHARED SETTING: ${w.name || 'Their world'} (${here.join(' and ')} live${here.length === 1 ? 's' : ''} in it and know${here.length === 1 ? 's' : ''} it well; treat it as true)\n${String(w.text).slice(0, 2600)}`; }).join('\n\n');
}
const WORLD_PROMPT = `Write a "shared setting" for an AI companion app: the world that several of my characters live in together, so they all know the same places and people. Use my idea:

[DESCRIBE THE SETTING HERE: the town or workplace, who my characters are to each other, anything that must be true]

Rules:
- Use exactly these four headings, each on its own line, with short "- " bullet lines under each:
PLACES
PEOPLE
WHO KNOWS WHOM
ROUTINES AND RULES
- PLACES: the town, homes, workplaces and hangouts, each with one concrete detail.
- PEOPLE: everyone who matters besides me, one line each: who they are and what they are like.
- WHO KNOWS WHOM: how the characters are connected: friends, family, exes, rivals, coworkers, what each thinks of the others.
- ROUTINES AND RULES: schedules, traditions, running situations, and anything that never changes.
- Adults only. Never decide what I say, do, think or feel.
- Output only the four sections as plain text.`;
function worldRead(W) { if ($('#wd_name')) { W.name = $('#wd_name').value.trim().slice(0, 60); W.text = $('#wd_text').value.slice(0, 6000); W.palIds = [...document.querySelectorAll('[data-wpal]')].filter(x => x.checked).map(x => x.dataset.wpal); } return W; }
async function worldSortAI() {
  const W = S.worldEdit; if (!W || S.worldBusy) return; worldRead(W);
  if (!String(W.text).trim()) return toast('Paste or write the setting first.');
  if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  S.worldBusy = true; renderModal();
  try {
    const cast = arr(W.palIds).map(id => PALS.pals[id]).filter(Boolean).map(p => `${p.name}: ${String(p.tagline || p.personality || '').slice(0, 120)}`).join('\n');
    const t = stripThink(await chat([
      { role: 'system', content: 'You organise notes about a shared setting for an AI companion app. Sort EVERYTHING the notes say under exactly these four headings, each on its own line, with short "- " bullet lines: PLACES, PEOPLE, WHO KNOWS WHOM, ROUTINES AND RULES. Keep every fact and name; do not invent new people or events; only tidy and sort. Output only the four sections as plain text.' },
      { role: 'user', content: `THE NOTES:\n${W.text}${cast ? `\n\nTHE CHARACTERS WHO LIVE THERE:\n${cast}` : ''}` }
    ], { build: true, stream: false, maxTokens: 1600, temperature: 0.3 })).trim();
    if (t.length > 40) W.text = t.slice(0, 6000); else throw new Error('the AI reply wasn\'t usable, try again');
  } catch (e) { toast('That didn\'t work: ' + e.message, 5000); }
  S.worldBusy = false; if (S.modal === 'palworld') renderModal();
}
function worldModalHTML() {
  const W = S.worldEdit;
  if (W) return [W.isNew ? 'New shared setting' : 'Edit shared setting', `<label class="f"><span>Name</span><input id="wd_name" value="${esc(W.name || '')}" placeholder="e.g. Maple Street, the salon, our friend group"></label>
    <label class="f"><span>The setting (paste anything: places, people, who knows whom, routines)</span><textarea id="wd_text" rows="12" placeholder="Paste a setting written in ChatGPT or Claude, or your own notes in any shape…">${esc(W.text || '')}</textarea></label>
    <div class="row wrap"><button class="btn sm gold" data-act="worldsort" ${S.worldBusy ? 'disabled' : ''}>${S.worldBusy ? '<span class="spin sm"></span> Sorting…' : icon('spark') + ' Sort it for me'}</button><button class="btn sm ghost" data-act="worldcopy">Copy a prompt for ChatGPT / Claude</button></div>
    <p class="hint">"Sort it for me" files your notes under Places, People, Who knows whom, and Routines and rules, keeping every fact. A setting written with the prompt is already in that shape.</p>
    <div class="lbl">Who lives in it</div>${allPals().map(p => `<label class="chk"><input type="checkbox" data-wpal="${p.id}" ${arr(W.palIds).includes(p.id) ? 'checked' : ''}> ${palAvatar(p, 'pav sm')} <span>${esc(p.name)}</span></label>`).join('') || '<p class="hint">Make a companion first.</p>'}
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="worldsave">${icon('check')} Save</button><button class="btn ghost" data-act="worldcancel">Cancel</button></div>`];
  const list = allWorlds();
  return ['Shared settings', `<p class="hint">A shared setting is a world that several companions live in: the town, the workplace, who knows whom. Everyone you tick knows it, in one-on-one chats and in groups, so their stories line up.</p>
    ${list.map(w => `<div class="memitem"><div class="mt"><b>${esc(w.name || 'Untitled')}</b><small>${esc(arr(w.palIds).map(id => PALS.pals[id]?.name).filter(Boolean).join(', ') || 'Nobody ticked yet')} · ${String(w.text || '').length} characters</small></div><div class="ma"><button data-act="worldedit" data-id="${w.id}" title="Edit">✎</button><button data-act="worlddel" data-id="${w.id}" title="Delete">🗑</button></div></div>`).join('') || '<p class="hint" style="color:var(--ink)">None yet.</p>'}
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="worldnew">${icon('plus')} New shared setting</button></div>`];
}

/* ---------- 4. outfit and location, one tap from the chat ---------- */
function wearModalHTML() {
  const ch = curChat(); if (!ch) return ['Outfit', ''];
  return ['Outfit', palsOf(ch).map(p => `<div class="lbl">${esc(p.name)}</div><div class="chips">
      <button class="chip ${!p.outfit ? 'on' : ''}" data-act="wearset" data-id="${p.id}" data-o="">Usual clothes</button>${arr(p.outfits).map(o => `<button class="chip ${p.outfit === o.id ? 'on' : ''}" data-act="wearset" data-id="${p.id}" data-o="${o.id}" title="${esc(o.desc || '')}">${esc(o.name || o.desc || 'Outfit')}</button>`).join('')}</div>
      <div class="row" style="margin-top:6px"><input data-wearnew="${p.id}" placeholder="Something new: e.g. red sundress, sandals, hair down" style="flex:1"><button class="btn sm" data-act="wearadd" data-id="${p.id}">Wear it</button></div>`).join('') + '<p class="hint">Used in the chat and in every picture until you change it. A new one is saved to her outfits.</p>'];
}
function placeModalHTML() {
  const ch = curChat(); if (!ch) return ['Location', ''];
  return ['Location', `<label class="f"><span>Where are you right now?</span><input id="placeIn" value="${esc(ch.scene || '')}" placeholder="e.g. Her apartment, late at night, rain on the windows"></label>
    ${arr(ch.places).length ? `<div class="lbl">Recent places</div><div class="chips">${ch.places.map((s, i) => `<button class="chip" data-act="placeset" data-i="${i}">${esc(s.length > 44 ? s.slice(0, 42) + '…' : s)}</button>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="placeset">Set location</button>${ch.scene ? '<button class="btn ghost" data-act="placeset" data-clear="1">Clear it</button>' : ''}</div>`];
}
function palSetScene(ch, v) {
  v = String(v || '').trim().slice(0, 200); if (v === (ch.scene || '')) return;
  ch.scene = v; if (v) ch.places = [v, ...arr(ch.places).filter(x => x !== v)].slice(0, 8);
  ch.messages.push({ id: uid(), role: 'sys', text: v ? `Scene: ${v}` : 'Scene cleared', t: Date.now() }); palTouch(ch); savePals();
}

/* windows opened from here (called by renderModal through palModalHTML) */
function palExtraModal(kind) {
  if (kind === 'palsearch') return searchModalHTML();
  if (kind === 'palworld') return worldModalHTML();
  if (kind === 'palwear') return wearModalHTML();
  if (kind === 'palplace') return placeModalHTML();
  return null;
}

/* ---------- buttons ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest?.('[data-act]'); if (!el) return; const act = el.dataset.act; const ch = curChat();
  switch (act) {
    case 'search': case 'palsearch': S.searchQ = ''; openModal(S.view === 'palchat' ? 'palsearch' : 'search'); setTimeout(() => $('#searchQ')?.focus(), 50); break;
    case 'searchgo': searchGo(el.dataset.id); break;
    case 'palwear': if (ch && !S.palBusy) openModal('palwear'); break;
    case 'wearset': { const p = PALS.pals[el.dataset.id]; if (p) { p.outfit = el.dataset.o || ''; palTouch(p); savePals(); closeModal(); toast(p.outfit ? `${p.name} is now wearing: ${palOutfitName(p)}.` : `${p.name} is back in ${p.sex === 'male' ? 'his' : 'her'} usual clothes.`); } break; }
    case 'wearadd': { const p = PALS.pals[el.dataset.id]; const v = (document.querySelector(`[data-wearnew="${el.dataset.id}"]`)?.value || '').trim(); if (!p) break; if (!v) { toast('Describe the outfit first.'); break; }
      const o = { id: uid(), name: v.split(/[,.;]/)[0].trim().slice(0, 28), desc: v.slice(0, 300) }; p.outfits = [...arr(p.outfits), o]; p.outfit = o.id; palTouch(p); savePals(); closeModal(); toast(`${p.name} is now wearing: ${o.name}.`); break; }
    case 'palplace': if (ch && !S.palBusy) { openModal('palplace'); setTimeout(() => $('#placeIn')?.focus(), 50); } break;
    case 'placeset': if (ch) { const v = el.dataset.clear ? '' : el.dataset.i != null ? arr(ch.places)[num(el.dataset.i)] : ($('#placeIn')?.value || ''); palSetScene(ch, v); closeModal(); } break;
    case 'palworlds': S.worldEdit = null; openModal('palworld'); break;
    case 'worldnew': S.worldEdit = { id: uid(), name: '', text: '', palIds: [], isNew: true }; renderModal(); break;
    case 'worldedit': { const w = PALS.worlds[el.dataset.id]; if (w) { S.worldEdit = deep(w); renderModal(); } break; }
    case 'worldcancel': S.worldEdit = null; renderModal(); break;
    case 'worldsort': worldSortAI(); break;
    case 'worldcopy': copyText(WORLD_PROMPT, 'Prompt copied. Paste it into ChatGPT or Claude, add your idea, then paste what it writes back here.'); break;
    case 'worlddel': { const w = PALS.worlds[el.dataset.id]; if (w && confirm(`Delete the shared setting "${w.name || 'Untitled'}"? Your companions stop knowing it.`)) { PALS.deleted[w.id] = Date.now(); delete PALS.worlds[w.id]; savePals(); renderModal(); } break; }
    case 'worldsave': { const W = S.worldEdit; if (!W) break; worldRead(W); if (!W.name) { toast('Give the setting a name.'); break; } if (!String(W.text).trim()) { toast('Write or paste the setting first.'); break; }
      delete W.isNew; W.createdAt = W.createdAt || Date.now(); palTouch(W); PALS.worlds[W.id] = W; savePals(); S.worldEdit = null; renderModal(); toast('Shared setting saved.'); break; }
  }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'searchQ') { S.searchQ = el.value; const r = $('#searchRes'); if (r) r.innerHTML = searchResultsHTML(); }
  else if (el.dataset.pfeel && S.palDraft) { S.palDraft.feels = S.palDraft.feels || {}; const v = el.value.trim().slice(0, 200); if (v) S.palDraft.feels[el.dataset.pfeel] = v; else delete S.palDraft.feels[el.dataset.pfeel]; }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'placeIn') { e.preventDefault(); $('[data-act="placeset"]:not([data-i]):not([data-clear])')?.click(); }
  else if (e.target.dataset?.wearnew) { e.preventDefault(); document.querySelector(`[data-act="wearadd"][data-id="${e.target.dataset.wearnew}"]`)?.click(); }
});
