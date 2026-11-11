'use strict';
/* ---------- builder: Research & fill the world ---------- */
const WORLD_SECTIONS = ['PREMISE', 'TONE', 'WORLD', 'SECRETS', 'PINNED FACTS', 'PEOPLE', 'CAST', 'OPENING'];
function parseSections(text) {
  const out = {}; let cur = null;
  const head = new RegExp('^\\s*(?:#+\\s*|\\*\\*)?(' + WORLD_SECTIONS.join('|') + ')(?:\\*\\*)?\\s*:?\\s*(?:\\*\\*)?\\s*(.*)$', 'i');
  for (const line of String(text).split('\n')) {
    const m = line.match(head);
    if (m) { cur = m[1].toUpperCase(); out[cur] = m[2] ? [m[2]] : []; continue; }
    if (cur) out[cur].push(line);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n').trim();
  return out;
}
const bulletLines = t => String(t || '').split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(l => l.length > 2);
async function researchWorld(D) {
  const q = String(D.researchQ || '').trim(); if (!q) return toast('Type what to research first, like "Savannah, Georgia in 1868" or "Hogwarts in the 1990s".');
  if (!textReady()) return toast('Set up your Story AI first.');
  if (S.settings.net?.on === false) return toast('Online research is off in Settings → Story AI.');
  S.researching = true; const step = t => { S.researchStatus = t; renderNew(); };
  try {
    const { engine, sources } = await gatherSources(q, { pages: 3, perPage: 5000, onStep: step });
    if (!sources.length) throw new Error('Nothing useful came back from the search. Try different words.');
    step(`Writing the world from ${sources.length} source${sources.length > 1 ? 's' : ''}…`);
    const comp = D.mode === 'companion';
    const raw = stripThink(await chat([
      { role:'system', content:`You turn research into a campaign world for a tabletop RPG app. Use the SOURCES for accurate names, places, history and facts. Invent only to fill gaps, and keep inventions consistent with the sources. Fit the player's REQUEST.
Write exactly these sections, each starting on its own line with the heading and a colon, and nothing else:
PREMISE: max 400 characters. The situation at the start and why the player's character is involved.
TONE: max 150 characters.
WORLD: max 2400 characters of short bullet lines, most important first: setting and era; 4-6 key places (name, what it is, what it feels like); 3-5 factions or groups (name, what they want); how magic, technology or the supernatural works; customs, slang, money and daily-life details.
SECRETS: max 1400 characters. Hidden truths and twists the player doesn't know yet, plus a short hidden plot plan (beginning, midpoint twist, possible endings).
PINNED FACTS: 6-12 short lines, each a rule of this world that must always hold.
PEOPLE: 6-12 lines, each exactly: Name | who they are | appearance (age, build, hair, clothes) | where they're usually found
${comp ? 'CAST: 2-5 lines, each: Name, role, personality and flaws, how they talk, what they want, one private secret. All adults (18+).\n' : ''}OPENING: max 300 characters. Where and how the story should begin.
Everyone is an adult unless the source truly requires otherwise, and never write anyone under 18 into anything romantic or sexual.` },
      { role:'user', content:`REQUEST: ${q}\n${D.premise ? 'PLAYER\'S PREMISE SO FAR: ' + D.premise + '\n' : ''}${D.genre ? 'GENRE: ' + D.genre + '\n' : ''}MODE: ${comp ? 'Companion mode (dice-free, character-driven)' : D.mode === 'mp' ? 'Multiplayer D&D' : 'Single-player D&D'}\nRATING: ${D.rating}\n\n${sourcesText(sources)}` }
    ], { build:true, stream:false, maxTokens:2200, temperature:0.4, helper:true }));
    const sec = parseSections(raw);
    if (!sec.WORLD) throw new Error('The AI\'s reply didn\'t have the expected sections. Tap Research again.');
    /* text still copied from a preset adventure isn't the player's own, so research replaces it */
    const scen = SCENARIOS.find(x => x.id === D.scenario && x.id !== 'custom'); const preset = k => !String(D[k] || '').trim() || (scen && D[k] === scen[k]);
    if (scen) { if (preset('title')) D.title = q.replace(/\s+/g, ' ').slice(0, 60); if (preset('genre')) D.genre = q.slice(0, 80); D.scenario = 'custom'; }
    if (sec.PREMISE && preset('premise')) D.premise = sec.PREMISE.slice(0, 600);
    if (sec.TONE && preset('tone')) D.tone = sec.TONE.slice(0, 200);
    D.world = D.world.trim() ? (D.world.trim() + '\n\nRESEARCH NOTES:\n' + sec.WORLD) : sec.WORLD;
    if (sec.SECRETS) D.secrets = D.secrets.trim() ? D.secrets.trim() + '\n\n' + sec.SECRETS : sec.SECRETS;
    const facts = bulletLines(sec['PINNED FACTS']).slice(0, 14); D.pinned = [...new Set([...arr(D.pinned), ...facts])];
    const people = bulletLines(sec.PEOPLE).map(l => { const [name, who, look, where] = l.split('|').map(x => (x || '').trim()); return name && who ? { name: name.replace(/\*+/g, ''), text: who, look, where } : null; }).filter(Boolean).slice(0, 14);
    D.people = [...arr(D.people).filter(p => !people.some(x => x.name.toLowerCase() === p.name.toLowerCase())), ...people];
    if (comp && sec.CAST) D.castText = [D.castText, ...bulletLines(sec.CAST)].filter(Boolean).join('\n');
    if (sec.OPENING) D.gmNotes = [D.gmNotes, 'Open with: ' + sec.OPENING.replace(/\n/g, ' ')].filter(Boolean).join('\n');
    D.research = { topic: q, auto: true, sources: sources.map(s => ({ title: s.title, url: s.url })), engine };
    S.researchStatus = `✓ Researched ${sources.length} source${sources.length > 1 ? 's' : ''} (${engine === 'searxng' ? 'SearXNG' : engine === 'duckduckgo' ? 'DuckDuckGo' : 'Wikipedia'}). Added the world, secrets, ${facts.length} pinned facts and ${people.length} people. Edit anything below.`;
  } catch (e) { S.researchStatus = '✗ ' + (e.name === 'AbortError' ? 'The search took too long. Try again.' : e.message); }
  finally { S.researching = false; renderNew(); }
}
function researchBoxHTML(D) {
  if (S.settings.net?.on === false) return '';
  const r = D.research;
  return `<div class="card research"><b>${icon('search')} Research a real place, period or existing world</b>
    <div class="hint" style="margin:4px 0 8px">The app searches the web, reads the best sources (Wikipedia, fan wikis and more) and writes accurate world notes, secrets, pinned facts and people for you.</div>
    <div class="row"><input type="text" data-dpath="researchQ" value="${esc(D.researchQ || '')}" placeholder="Savannah, Georgia in 1868 · Hogwarts in the 1990s · Viking Age Iceland" style="flex:1;min-width:0">
    <button class="btn sm gold" data-act="research" ${S.researching ? 'disabled' : ''}>${S.researching ? '<span class="spin sm"></span>' : 'Research'}</button></div>
    ${S.researchStatus ? `<p class="hint" style="color:var(--ink)">${esc(S.researchStatus)}</p>` : ''}
    ${r?.sources?.length ? `<details><summary class="hint" style="cursor:pointer">Sources (${r.sources.length})</summary><p class="hint">${r.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>`).join('<br>')}</p></details>` : ''}
    ${arr(D.people).length || arr(D.pinned).length ? `<p class="hint">Ready to add when you start: ${arr(D.people).length} people (with portraits) and ${arr(D.pinned).length} pinned facts.</p>` : ''}</div>`;
}

/* ---------- during play: lookups cached as lore ---------- */
const loreOf = c => (c.lore = c.lore && typeof c.lore === 'object' ? c.lore : {});
const loreKey = n => String(n || '').trim().toLowerCase();
async function lookupLore(c, name, { manual = false } = {}) {
  name = String(name || '').trim(); if (!name || S.settings.net?.on === false || !textReady()) return null;
  const L = loreOf(c); const k = loreKey(name);
  if (!manual && L[k]) return L[k];
  const topic = String(c.research?.topic || '').trim();
  const q = topic && !name.toLowerCase().includes(topic.toLowerCase()) ? `${name} ${topic}` : name;
  try {
    const { sources } = await gatherSources(q, { pages: 2, perPage: 3500 });
    if (!sources.length) { L[k] = { name, text: '', none: true, t: Date.now() }; return null; }
    const raw = stripThink(await chat([
      { role:'system', content:`Using ONLY the SOURCES, write 2-4 short sentences of facts about "${name}" that matter for a story${topic ? ' set in ' + topic : ''}: who or what it is, key details, how it fits the setting. Plain sentences, no lists. If the sources don't clearly describe this exact "${name}", reply exactly NONE.` },
      { role:'user', content: sourcesText(sources) }
    ], { stream:false, maxTokens:260, temperature:0.2, helper:true })).trim();
    if (!raw || /^NONE\b/i.test(raw)) { L[k] = { name, text: '', none: true, t: Date.now() }; touch(c); return null; }
    const entry = { name, text: raw.slice(0, 700), url: sources[0].url, src: sources[0].title, t: Date.now(), day: worldOf(c).time.day };
    L[k] = entry;
    const e = arr(c.codex).find(x => loreKey(x.name) === k); if (e) e.lore = entry.text;
    touch(c); scheduleSync();
    return entry;
  } catch (e) { console.warn('Lookup failed', name, e); if (manual) throw e; return null; }
}
/* ---------- the AI looks things up by itself ---------- */
const scoutOn = () => S.settings.net?.on !== false && S.settings.net?.auto !== false;
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
async function scoutWeb(c, playerText, signal) {
  const known = Object.values(loreOf(c)).map(x => x.name).slice(-30);
  const topic = String(c.research?.topic || '').trim();
  const raw = await chat([
    { role:'system', content:`You decide whether a storyteller AI needs to look something up on the internet before replying to the player. Its own memory of real-world facts is unreliable.
SEARCH when the player's message mentions or asks about something REAL or ESTABLISHED that needs accurate facts: a real place, building, city or country; a real person, celebrity or historical figure; a historical event or period; real science, history, laws, sports, music, movies, books, games or news; or a character, place or thing from an existing book, show, movie or game universe${topic ? ` (this story is set in: ${topic})` : ''}.
DON'T SEARCH for ordinary actions, conversation, feelings, combat, made-up names invented in this story, or anything already known.
Already looked up: ${known.join(', ') || 'nothing yet'}.
Reply with JSON only:
{"search":null}
or {"search":"short search phrase, 2-6 words, the specific thing"}` },
    { role:'user', content:`STORY: ${c.title}. ${c.genre || ''} ${String(c.premise || '').slice(0, 300)}\n\nRECENT:\n${storyLines(c, 2) || '(start)'}\n\nTHE PLAYER'S MESSAGE NOW: ${playerText}` }
  ], { stream:false, signal, maxTokens:60, temperature:0.1, helper:true });
  const j = tryJSON(stripThink(raw));
  const q = j && typeof j.search === 'string' ? j.search.trim().replace(/^["']|["']$/g, '').slice(0, 80) : '';
  if (!q || q.length < 3 || /^(null|none)$/i.test(q)) return null;
  return known.some(n => n.toLowerCase() === q.toLowerCase()) ? null : q;
}
async function autoLookups(c, names) {
  if (S.settings.net?.on === false || S.settings.net?.auto === false || !c.research?.topic || c.research.auto === false) return;
  const L = loreOf(c); const todo = [...new Set(arr(names).map(n => String(n || '').trim()).filter(n => n && !L[loreKey(n)]))].slice(0, 3);
  for (const n of todo) { const r = await lookupLore(c, n); if (r && cur() === c) toast(`🔎 Looked up ${r.name}`, 2500); }
  if (todo.length && cur() === c && S.modal) renderModal();
}
/* the GM sees researched facts for whatever is on stage right now */
function loreForPrompt(c) {
  const L = loreOf(c); const all = Object.values(L).filter(x => x.text); if (!all.length) return '';
  const recent = (storyLines(c, 6) + ' ' + (c.location || '')).toLowerCase();
  const hits = all.filter(x => recent.includes(x.name.toLowerCase()) || recent.includes(x.name.toLowerCase().split(' ')[0]));
  let out = '', used = 0;
  for (const x of hits.slice(-5)) { const line = `- ${x.name}: ${x.text}\n`; if (used + line.length > 1800) break; out += line; used += line.length; }
  return out.trim();
}
function lookupHTML() {
  const c = cur(); const L = Object.values(loreOf(c)).filter(x => x.text).sort((a, b) => b.t - a.t);
  return `<p class="hint">Look up anything online: a place, a person, a creature, a bit of history. The facts are saved and the GM keeps them in mind whenever it comes up.${c.research?.topic ? ` Searches stay within <b>${esc(c.research.topic)}</b>.` : ''}</p>
    <div class="row"><input type="text" id="lookupQ" value="${esc(S.lookupQ || '')}" placeholder="The Shrieking Shack · Fort Pulaski · Valyrian steel" style="flex:1;min-width:0"><button class="btn sm gold" data-act="lookupgo" ${S.lookupBusy ? 'disabled' : ''}>${S.lookupBusy ? '<span class="spin sm"></span>' : icon('search') + ' Look up'}</button></div>
    ${S.lookupMsg ? `<p class="hint" style="color:var(--ink)">${esc(S.lookupMsg)}</p>` : ''}
    <div style="margin-top:10px">${L.length ? L.map(x => `<div class="quest"><div class="grow"><b>${esc(x.name)}</b><div class="hint" style="margin:3px 0 0;color:var(--ink)">${esc(x.text)}</div>${x.url ? `<a class="hint" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.src || 'source')}</a>` : ''}</div></div>`).join('') : '<p class="empty" style="font-size:18px">Nothing looked up yet.</p>'}</div>`;
}

/* ---------- undo / retry ---------- */
function lastIndex(c, role) { for (let i = c.messages.length - 1; i >= 0; i--) if (c.messages[i].role === role) return i; return -1; }
function regenerate() {
  const c = cur(); if (!c || S.busy) return;
  const g = lastIndex(c, 'gm'); if (g < 0) return;
  if (c.messages.slice(g + 1).some(x => x.role !== 'err' && x.role !== 'sys' && x.role !== 'comp')) return;
  restore(c, c.messages[g].before);
  c.messages.splice(g); c.pendingRoll = null; S.rollResult = null;
  c.summarizedUpTo = Math.min(c.summarizedUpTo || 0, c.messages.length);
  gmTurn();
}
function undoTurn() {
  const c = cur(); if (!c || S.busy) return;
  c.messages = c.messages.filter(m => m.role !== 'err');
  const g = lastIndex(c, 'gm'); if (g < 0) return;
  if (c.messages[g].cont) { let gi = g - 1; while (gi >= 0 && c.messages[gi].role !== 'gm') gi--; if (gi >= 0) { c.messages.splice(gi + 1); return undoTurn(); } }
  const prev = c.messages[g - 1];
  if (!prev || prev.hidden) { toast('That\'s the opening scene — use Retry to re-roll it.'); return; }
  restore(c, c.messages[g].before);
  c.messages.splice(g);
  const p = c.messages.pop();
  S.rollResult = null; S.invokeOpen = false;
  if (p.role === 'roll') { restore(c, p.before); c.pendingRoll = p.prevPending ? { ...p.prevPending } : null; }
  else {
    const b = c.messages[c.messages.length - 1];
    c.pendingRoll = b?.role === 'gm' && b.check ? { ...b.check, msgId: b.id, invokes: [], dcAdj: 0, momentumPlus: false } : null;
    S.undoText = p.text.replace(/^\(\(\s*|\s*\)\)$/g, ''); S.ooc = !!p.ooc;
  }
  c.summarizedUpTo = Math.min(c.summarizedUpTo || 0, c.messages.length);
  touch(c); renderGame();
  const inp = $('#input'); if (inp && S.undoText) { inp.value = S.undoText; S.undoText = ''; autoGrow(inp); inp.focus(); }
  scheduleSync();
}

/* =========================================================================
   Images
   ========================================================================= */
const SIZES = { landscape:[768,512], square:[640,640], portrait:[512,768], wide:[1024,576] };
