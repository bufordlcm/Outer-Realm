'use strict';
/* =========================================================================
   Story Bibles: a whole campaign written outside the app (by you, ChatGPT or Claude),
   imported from a file, a paste, or a Google Doc in your Drive folder.
   Big settings don't fit in the GM's memory at once, so the bible is split into
   STORY CARDS (people, places, items, events, creatures, lore, maps). Each turn the GM
   gets only the cards that matter right now: what's named in recent scenes, the
   current place, and anything marked "Always: yes".
   ========================================================================= */
const CARD_KINDS = ['person','place','item','event','creature','lore','map','faction','rule'];

const BIBLE_TEMPLATE = `# STORY BIBLE: <Title>

## Setup
Title: <the adventure's name>
Genre: <e.g. Grim low fantasy, cyberpunk heist, 1920s cosmic horror>
Tone: <e.g. Tense and mysterious, with dark humor>
Art style: <a short phrase for the illustrator>
Magic: <free | strain | none>
Rating: <Family-friendly | PG-13 | Mature (R) | Adult (18+)>

## Premise
<2-4 sentences: the situation the player character starts in and the hook. Never decide what the player does or feels.>

## Opening scene
<Where and how the very first scene begins: place, time, who is present, what is happening right now.>

## World
- <one short line per fact: places, how society works, magic or technology, daily life, current tensions>

## Secrets
- <hidden truths the GM reveals only through play>

## Campaign plan
<4-8 sentences of hidden direction: twists, how the story tests the hero, possible endings.>

## Plot roadmap
Act 1: <Title> | <the act's goal>
- <beat: something that can happen in the world>
- <beat>
Act 2: <Title> | <goal>
- <beat>

## Threats
- <Name> | <clock size 4-8> | <what happens when it fills>

## Factions
- <Name>: <what they want, who they clash with>

## Pinned facts
- <things that are always true and the GM must never contradict>

## GM notes
- <standing requests: style, pacing, what to emphasize or avoid>

## Cards

### Person: <Full name>
Sex: <male | female>
Where: <where they are usually found>
Attitude: <friendly | neutral | wary | hostile> toward the player
Also called: <nicknames, titles, separated by commas>
<Who they are, what they want, what they hide, how they talk, how they look. 2-6 sentences.>

### Place: <Name>
Also called: <other names>
<What it looks, sounds and smells like, who is there, what can happen here, hidden things.>

### Map: <Name of the place it maps>
<A text map: the layout room by room or district by district, exits, distances, where things are.>

### Item: <Name>
<What it is, what it does, where it is, who wants it.>

### Event: <Name>
Trigger: <when it happens: a day, an act, or a condition>
<What happens and how it changes the world.>

### Creature: <Name>
<Looks, behaviour, how dangerous (minion, soldier, elite, boss), weaknesses.>

### Lore: <Topic>
Always: <yes, if the GM must always keep this in mind; otherwise leave this line out>
<History, religion, legends, rules of magic.>
`;

const BIBLE_PROMPT = `You are an expert tabletop RPG campaign designer. Write a complete STORY BIBLE for a solo roleplaying campaign that an AI Game Master will run. My idea:

[DESCRIBE YOUR STORY IDEA HERE: setting, genre, mood, the kind of hero I'll play, anything that must be in it]

Rules:
- Follow the template below EXACTLY: same headings, same "Key: value" lines, one "### Kind: Name" heading per card. Kinds allowed: Person, Place, Map, Item, Event, Creature, Lore, Faction, Rule.
- Be specific and vivid: real names, sensory details, what things cost, what people fear. No generic fantasy filler.
- Everything connects: every secret involves named people and places; factions clash; every person wants something, hides something, and has a distinct voice.
- Write 10-20 Person cards, 8-15 Place cards (with a Map card for the 2-4 most important places), 4-10 Item cards, 5-10 Event cards, 3-8 Creature cards and 3-6 Lore cards.
- The Plot roadmap has 4-6 acts that escalate, each with 3-5 beats. Beats are things that happen in the world, never decisions the player character must make.
- Never decide what the player character does, thinks or feels. Leave room for the player to choose.
- All characters in any romantic or sexual content are adults.
- Output ONLY the filled-in template as plain text (markdown headings are fine). No commentary before or after.

TEMPLATE:
` + BIBLE_TEMPLATE;

/* ---------- parsing ---------- */
function parseBible(text) {
  const src = String(text || '').replace(/\r/g, '').replace(/^﻿/, '');
  const out = { setup: {}, sections: {}, cards: [] };
  let sec = '', card = null;
  const pushCard = () => { if (card && card.name) { card.text = card.lines.join('\n').trim(); delete card.lines; out.cards.push(card); } card = null; };
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const h3 = line.match(/^\s*#{3,}\s*([A-Za-z ]+?)\s*[:\-–]\s*(.+?)\s*$/);
    const h2 = line.match(/^\s*#{1,2}\s+(.+?)\s*$/);
    if (h3 && CARD_KINDS.includes(h3[1].toLowerCase().trim())) { pushCard(); card = { id: uid(), kind: h3[1].toLowerCase().trim(), name: h3[2].replace(/[*_]/g, '').trim(), keys: [], lines: [] }; continue; }
    if (h2 && !/^#{3,}/.test(line.trim())) { pushCard(); sec = h2[1].replace(/[*_:]/g, '').replace(/^STORY BIBLE.*$/i, '').trim().toLowerCase(); continue; }
    if (card) {
      const kv = line.match(/^\s*(?:[-*]\s*)?\**(Sex|Gender|Where|Location|Attitude|Feel|Also called|Aliases?|Trigger|When|Always)\**\s*:\s*(.+)$/i);
      if (kv && card.lines.filter(Boolean).length === 0) {
        const k = kv[1].toLowerCase(), v = kv[2].trim();
        if (/^(sex|gender)$/.test(k)) card.sex = /female|woman|\bf\b/i.test(v) ? 'female' : /male|man|\bm\b/i.test(v) ? 'male' : '';
        else if (/^(where|location)$/.test(k)) card.where = v;
        else if (/^(attitude|feel)$/.test(k)) card.feel = (v.match(/devoted|friendly|neutral|wary|hostile/i) || [''])[0].toLowerCase();
        else if (/^(also called|alias|aliases)$/.test(k)) card.keys = v.split(/[,;\/]/).map(s => s.trim()).filter(s => s.length > 1);
        else if (/^(trigger|when)$/.test(k)) card.trigger = v;
        else if (k === 'always') card.always = /^y/i.test(v);
        continue;
      }
      card.lines.push(line); continue;
    }
    if (!sec) continue;
    if (sec === 'setup') { const kv = line.match(/^\s*(?:[-*]\s*)?\**([A-Za-z ]+?)\**\s*:\s*(.+)$/); if (kv) out.setup[kv[1].toLowerCase().trim()] = kv[2].trim(); continue; }
    (out.sections[sec] = out.sections[sec] || []).push(line);
  }
  pushCard();
  for (const k of Object.keys(out.sections)) out.sections[k] = out.sections[k].join('\n').trim();
  return out;
}
const bibleSec = (b, ...names) => { for (const n of names) { const k = Object.keys(b.sections).find(x => x === n || x.startsWith(n)); if (k && b.sections[k]) return b.sections[k]; } return ''; };
const bulletList = t => String(t || '').split('\n').map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(s => s && !/^<.*>$/.test(s));

/* fill a new-game draft (or merge into a running game) from a parsed bible */
function applyBible(target, b, isGame) {
  const su = b.setup; const set = (k, v) => { if (v && !/^<.*>$/.test(v)) target[k] = v; };
  set('title', su.title); set('genre', su.genre); set('tone', su.tone);
  set(isGame ? 'artStyle' : 'art', su['art style'] || su.art);
  const magic = String(su.magic || '').toLowerCase(); if (['free','strain','none'].includes(magic)) target.magicCost = magic;
  if (su.rating && RATING_RULES[su.rating.trim()]) target.rating = su.rating.trim();
  const prem = bibleSec(b, 'premise'); if (prem) target.premise = prem.slice(0, 1500);
  const open = bibleSec(b, 'opening'); if (open) target.gmNotes = [String(target.gmNotes || '').trim(), 'Open with: ' + open.replace(/\n+/g, ' ')].filter(Boolean).join('\n');
  const world = bibleSec(b, 'world'); if (world) target.world = world.slice(0, 4000);
  const sec = bibleSec(b, 'secrets'); if (sec) target.secrets = sec.slice(0, 2500);
  const plan = bibleSec(b, 'campaign plan', 'plan');
  const events = b.cards.filter(x => x.kind === 'event').map(e => `- ${e.name}${e.trigger ? ' (' + e.trigger + ')' : ''}`).join('\n');
  if (plan || events) target.plan = [plan, events ? 'Planned events:\n' + events : ''].filter(Boolean).join('\n\n').slice(0, 3000);
  const rm = bibleSec(b, 'plot roadmap', 'roadmap'); if (rm) target.roadmap = rm.slice(0, 4000);
  const notes = bulletList(bibleSec(b, 'gm notes', 'notes')); if (notes.length) target.gmNotes = [String(target.gmNotes || '').trim(), ...notes].filter(Boolean).join('\n');
  const pins = bulletList(bibleSec(b, 'pinned')); if (pins.length) target.pinned = [...new Set([...arr(target.pinned), ...pins])];
  const threats = bulletList(bibleSec(b, 'threats')).map(l => { const [name, max, effect] = l.split('|').map(s => s.trim()); return { name, max: clamp(num(max) || 6, 3, 10), effect: effect || '' }; }).filter(t => t.name);
  const factions = bulletList(bibleSec(b, 'factions')).map(l => { const m = l.match(/^([^:]+):\s*(.*)$/); return m ? { name: m[1].trim(), desc: m[2].trim() } : { name: l, desc: '' }; });
  for (const f of b.cards.filter(x => x.kind === 'faction')) factions.push({ name: f.name, desc: f.text.slice(0, 200) });
  const people = b.cards.filter(x => x.kind === 'person').map(p => ({ name: p.name, text: p.text.replace(/\n+/g, ' ').slice(0, 300), where: p.where || '', sex: p.sex || '', feel: p.feel || 'neutral' }));
  if (isGame) {
    worldOf(target);
    if (threats.length) addThreats(target, threats);
    if (factions.length) addFactions(target, factions);
    if (people.length) upsertPeople(target, people.map(x => ({ ...x, madeBy: 'research' })));
  } else {
    if (threats.length) target.threats = threats;
    if (factions.length) target.factions = factions.slice(0, 12);
    if (people.length) target.people = people;
  }
  /* cards: replace ones with the same kind and name, add the rest */
  target.cards = arr(target.cards);
  for (const cd of b.cards) {
    const i = target.cards.findIndex(x => x.kind === cd.kind && x.name.toLowerCase() === cd.name.toLowerCase());
    if (i >= 0) target.cards[i] = { ...cd, id: target.cards[i].id }; else target.cards.push(cd);
  }
  return { cards: b.cards.length, people: people.length, acts: rm ? (typeof parseRoadmap === 'function' ? parseRoadmap(rm).length : 0) : 0 };
}

const looksLikeBible = b => b.cards.length >= 2 || ['premise','world','plot roadmap','secrets'].filter(k => Object.keys(b.sections).some(x => x.startsWith(k))).length >= 2;
async function sortIntoBible(text) {
  return stripThink(await chat([
    { role:'system', content:`You turn a player's notes about a story (in any format: lists, prose, a chat answer, a wiki page) into a STORY BIBLE for a tabletop RPG run by an AI Game Master.
- Keep EVERY detail from the notes: every name, place, item, event, relationship, rule and secret. Put each one where it belongs in the template.
- Every person, place, map or layout, item, event, creature and bit of lore gets its own "### Kind: Name" card.
- Only fill in what the notes leave out when the template needs it (a premise, an opening scene, a short roadmap), and keep it true to the notes.
- Never decide what the player character does, thinks or feels.
- Output ONLY the filled-in template as plain text, with the same headings and "Key: value" lines. Leave out lines you have nothing for.

TEMPLATE:
${BIBLE_TEMPLATE}` },
    { role:'user', content: 'THE NOTES:\n\n' + text.slice(0, 60000) }
  ], { build:true, stream:false, maxTokens:8000, temperature:0.3 }));
}
function bibleTimer() { clearInterval(bibleTimer.t); bibleTimer.t = setInterval(() => { if (!S.bibleSorting) return clearInterval(bibleTimer.t); const el = $('#bibleSecs'); if (el) el.textContent = Math.round((Date.now() - S.bibleSorting) / 1000) + 's'; }, 1000); }

/* ---------- what the GM sees each turn ---------- */
function cardsForPrompt(c, budget = 2600) {
  const cards = arr(c.cards); if (!cards.length) return '';
  const recent = (storyLines(c, 4) + ' ' + (c.location || '') + ' ' + arr(c.threads).filter(t => t.status === 'open').map(t => t.text).join(' ')).toLowerCase();
  const loc = String(c.location || '').toLowerCase();
  const names = cd => [cd.name, ...arr(cd.keys)].map(n => n.toLowerCase()).filter(n => n.length > 2);
  const mentioned = cd => names(cd).some(n => recent.includes(n) || (n.split(/\s+/)[0].length > 3 && recent.includes(n.split(/\s+/)[0])));
  const here = cd => loc && names(cd).some(n => loc.includes(n) || n.includes(loc));
  const score = cd => (cd.always ? 100 : 0) + (here(cd) ? 50 : 0) + (mentioned(cd) ? 20 : 0) + (cd.kind === 'map' && here(cd) ? 30 : 0);
  const picked = cards.map(cd => ({ cd, s: score(cd) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  let out = '', used = 0;
  for (const { cd } of picked) {
    const line = `- [${cd.kind}] ${cd.name}${cd.where ? ' (at ' + cd.where + ')' : ''}${cd.trigger ? ' (when: ' + cd.trigger + ')' : ''}: ${cd.text.replace(/\n+/g, ' ')}\n`;
    if (used + line.length > budget) { if (!used) out += line.slice(0, budget) + '\n'; break; }
    out += line; used += line.length;
  }
  return out.trim() ? 'STORY CARDS (from the story bible; stay consistent with them)\n' + out.trim() : '';
}

/* ---------- import UI ---------- */
function bibleHTML() {
  const inGame = S.bibleFor === 'game' && cur();
  const files = S.bibleFiles;
  return `<p class="hint" style="margin-top:0;color:var(--ink)">${inGame ? `Add people, places, events and more to <b>${esc(cur().title)}</b>. Cards with the same name are updated.` : 'Build a whole campaign from a story bible: the setup, roadmap, secrets and every card fill in at once.'}</p>
    <div class="sect" style="font-size:17px">1. Write it with ChatGPT or Claude</div>
    <p class="hint">Copy the prompt, paste it into ChatGPT or Claude, and replace the idea line with your story. Then paste the reply straight into the box below. (You can also save it as a Google Doc named <b>Story Bible - Your Title</b> in your Iron Quill Stories folder.)</p>
    <div class="row"><button class="btn sm" data-act="biblecopy" data-k="prompt">${icon('book')} Copy the prompt</button><button class="btn sm ghost" data-act="biblecopy" data-k="template">Copy the blank template</button></div>
    <div class="sect" style="font-size:17px">2. Bring it in</div>
    <div class="row"><button class="btn sm" data-act="biblefile">${icon('upload')} From a file</button><button class="btn sm" data-act="bibledrive" ${S.bibleLoading ? 'disabled' : ''}>${icon('cloud')} From Google Drive</button></div>
    ${S.bibleLoading ? '<p class="hint"><span class="spin sm"></span> Looking in your Drive folder…</p>' : ''}
    ${files ? (files.length ? `<div class="ditems" style="margin-top:8px">${files.map(f => `<button class="ditem" data-act="biblepick" data-id="${esc(f.id)}"><b>${esc(f.name)}</b><small>${esc(new Date(f.modifiedTime || 0).toLocaleDateString())}</small></button>`).join('')}</div>` : '<p class="hint">No files with "Story Bible" in the name in your Drive folder yet.</p>') : ''}
    <label class="f" style="margin-top:10px"><span>Or paste it here</span><textarea id="bibleText" rows="8" placeholder="# STORY BIBLE: …">${esc(S.bibleText || '')}</textarea></label>
    <button class="btn gold wide" data-act="bibleimport" ${S.bibleSorting ? 'disabled' : ''}>${S.bibleSorting ? '<span class="spin sm"></span> The AI is sorting your text… <span id="bibleSecs"></span>' : icon('spark') + (inGame ? ' Add to this game' : ' Fill in my new game')}</button>
    <p class="hint">Any format works: paste a ChatGPT or Claude answer, your own notes, or a wiki page. If it isn't already in the template's shape, the AI sorts it into people, places, maps, items, events, secrets and the roadmap for you.</p>
    ${S.bibleResult ? `<p class="hint" style="color:var(--green)">${esc(S.bibleResult)}</p>` : ''}`;
}
async function bibleAction(act, el) {
  switch (act) {
    case 'bibleopen': S.bibleFor = el.dataset.for || (S.view === 'game' ? 'game' : 'draft'); S.bibleResult = ''; S.bibleFiles = null; openModal('bible'); return true;
    case 'biblecopy': { const t = el.dataset.k === 'template' ? BIBLE_TEMPLATE : BIBLE_PROMPT; try { await navigator.clipboard.writeText(t); toast(el.dataset.k === 'template' ? 'Template copied.' : 'Prompt copied. Paste it into ChatGPT or Claude.'); } catch { S.bibleText = t; renderModal(); toast('Couldn\'t copy: it\'s in the paste box, select it and copy.'); } return true; }
    case 'biblefile': $('#bibleFile').click(); return true;
    case 'bibledrive': {
      if (!Drive.configured()) { toast('Connect Google Drive first (Settings → Google Drive).'); return true; }
      S.bibleLoading = true; renderModal();
      try { await Drive.connect(true); const root = Drive.root();
        S.bibleFiles = (await Drive.list(`'${root}' in parents and trashed=false and name contains 'Story Bible'`)).filter(f => f.mimeType !== FOLDER_MIME); }
      catch (e) { toast('Drive: ' + e.message, 5000); }
      S.bibleLoading = false; renderModal(); return true;
    }
    case 'biblepick': {
      const f = arr(S.bibleFiles).find(x => x.id === el.dataset.id); if (!f) return true;
      try { const r = await Drive.api(f.mimeType === 'application/vnd.google-apps.document' ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain` : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`);
        S.bibleText = await r.text(); renderModal(); toast(`Loaded "${f.name}". Tap the gold button to use it.`); }
      catch (e) { toast('Couldn\'t read that file: ' + e.message, 5000); }
      return true;
    }
    case 'bibleimport': {
      const text = ($('#bibleText')?.value || S.bibleText || '').trim(); if (!text) { toast('Paste a story bible or pick a file first.'); return true; }
      let b = parseBible(text);
      /* anything not already in the template's shape (notes, a ChatGPT answer, a wiki page): the AI sorts it */
      if (!looksLikeBible(b)) {
        if (!textReady()) { toast('Set up an AI first so it can sort your text.'); return true; }
        S.bibleSorting = Date.now(); renderModal(); bibleTimer();
        try { b = parseBible(await sortIntoBible(text)); } catch (e) { toast('Sorting failed: ' + e.message, 6000); }
        S.bibleSorting = 0; renderModal();
        if (!looksLikeBible(b)) { toast('The AI couldn\'t sort that into a story. Try again, or paste more detail.', 6000); return true; }
      }
      const game = S.bibleFor === 'game' && cur();
      const target = game ? cur() : S.draft; if (!target) { toast('Start a new game first.'); return true; }
      const r = applyBible(target, b, !!game);
      S.bibleText = ''; S.bibleResult = `✓ ${r.cards} cards, ${r.people} people${r.acts ? `, ${r.acts}-act roadmap` : ''} added.`;
      if (game) { touch(game); scheduleSync(); renderModal(); } else { target.scenario = 'custom'; closeModal(); renderNew(true); toast(S.bibleResult + ' Read it over, then build your character.', 5000); }
      return true;
    }
  }
  return false;
}
document.addEventListener('input', e => { if (e.target.id === 'bibleText') S.bibleText = e.target.value; });
