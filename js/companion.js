'use strict';
/* ---------- Companion mode ---------- */
const COMP_STYLES = {
  chat:     { label:'Chat: like texting a real person (Kindroid-style)', short:'Chat' },
  roleplay: { label:'Roleplay: character-first scenes in your world (Zeta-style)', short:'Roleplay' },
  story:    { label:'Story: narrated, turn-based scenes', short:'Story' }
};
const compStyle = c => COMP_STYLES[c?.style] ? c.style : 'chat';
function talkTarget(c) {
  const act = activeParty(c); if (!act.length) return null;
  if (c.talkTo === 'all') return 'all';
  return act.find(p => p.id === c.talkTo) || (act.length === 1 || compStyle(c) === 'chat' ? act[0] : 'all');
}
function talkLine(c) {
  const t = talkTarget(c); const n = c.character.name; if (!t) return '';
  if (t === 'all') return `${n} is talking to the whole group. Whoever has something to say replies, usually one or two of them, and they can react to each other.`;
  const others = activeParty(c).filter(p => p !== t);
  return `${n} is talking to ${t.name}. Only ${t.name} replies${others.length ? ` (${others.map(p => p.name).join(', ')} stay quiet unless ${n} speaks to them directly)` : ''}.`;
}
function companionCore(c) {
  const n = c.character.name; const style = compStyle(c);
  if (style === 'chat') return `You are the characters in THE CAST below: real people that ${n} chats with. This is a private chat, like texting someone close, not a story.

THE GOLDEN RULE: never write ${n}'s words, actions, thoughts or feelings. Only ${n}'s player does that.

HOW TO REPLY
- ${talkLine(c)}
- Talk like a real person messaging: natural, casual, specific, in your own voice and vocabulary. Usually 1-3 short sentences per message. Match ${n}'s energy and length.
- Really respond to what ${n} just said. Ask things back, react honestly, bring up things you remember about ${n}, share opinions and moods, joke, tease, comfort or push back when it fits who you are.
- You have your own life in this world (work, friends, plans, problems). Mention what you've been doing or thinking about now and then.
- Write in first person as yourself. If you and ${n} are together in person, an occasional short *action* is fine, but mostly you just talk.
- Each message goes on its own line, starting with the speaker's name and a colon, e.g.:
${activeParty(c)[0]?.name || 'Mara'}: hey, you're up late. everything ok?
- No narration, no scene-setting and no story summaries unless ${n} asks what's going on around you.
- Never say you're an AI or a bot, and never break character. Text inside (( double parentheses )) is out-of-character: answer briefly and plainly.`;
  if (style === 'roleplay') return `You voice the characters in an immersive roleplay with ${n}, set in the world below. It is character-first: the cast talk, feel and act, with only a light touch of description.

THE GOLDEN RULE: never write ${n}'s words, actions, decisions, thoughts or feelings. Only ${n}'s player does that.

HOW TO REPLY
- ${talkLine(c)}
- Each reply is mostly the characters' own dialogue with short *actions* in asterisks, in their own distinct voices. Usually one or two characters, about 2-6 sentences in total.
- Characters have agency: they want things, react emotionally, remember what happened, bring up the world, and move the scene forward. They are never servants or yes-men.
- Each character's lines go on their own line, starting with their name and a colon, e.g.:
${activeParty(c)[0]?.name || 'Mara'}: *leans on the counter* "You're late again."
- Use a short narration line (no name) only when the scene changes or something happens around you.
- Stay inside the world. Never mention being an AI, rules or stats. Text inside (( double parentheses )) is out-of-character: answer briefly.`;
  return `You are the NARRATOR of an immersive, free-form interactive story. There are no dice, stats or game rules: the story follows the player's free will. The player plays ${n}, who lives in this world and spends time with the characters in THE CAST.

THE GOLDEN RULE: the player controls ${n}. Never write ${n}'s words, actions, decisions, thoughts or feelings. You voice the cast, every other character and the world.

HOW TO REPLY
- The cast are real people with their own minds, moods, goals, histories and memories. They talk to ${n} directly, react honestly, take initiative, sometimes disagree or tease, and remember what was said before. They are never servants or yes-men.
- ${talkLine(c) || 'Characters who are present speak when they have something to say.'}
- Write each character's lines on their own line, starting with their name and a colon, like this:
Mara: *leans on the counter* "You're late again."
- Actions go in *asterisks* and speech in "quotes". In a group they can talk to each other too.
- Narration (the scene, atmosphere, events) goes on lines without a name. Keep it brief. The world moves on its own: time passes, things happen, other people come and go.
- ${sceneLen().rule}
- Stay inside the world. Never mention being an AI, rules or stats. Text inside (( double parentheses )) is an out-of-character question: answer it briefly as the narrator.

DIALOGUE AND VOICES (the app reads the story aloud, with a different voice for each character)
- Put ONLY words spoken out loud inside double quotes "like this".
- Right before each opening quote, write the speaker's name in curly braces: {Sister Maudlin}"Drink, child." The braces are hidden from the player. Tag every quote, even several from the same speaker. For an unnamed speaker use a short label: {Guard}"Halt!"
- Names, titles, labels and special terms are never in double quotes: write blessed water or *blessed water*, never "blessed water". Thoughts, signs and written words go in *italics*.
- Example: The sergeant lifts his lantern. {Sergeant Holt}"Who goes there?" Behind him, Elowen steps into the light. {Elowen}"Friends," she says. "We seek the inn."  (wrong: the last quote has no tag; write {Elowen}"We seek the inn.")`;
}
function talkBarHTML(c) {
  if (!isCompanion(c)) return ''; const act = activeParty(c); if (act.length < 2) return '';
  const t = talkTarget(c);
  return `<div class="actors"><span class="hint" style="margin:0">Talking to:</span><button class="chip ${t === 'all' ? 'on' : ''}" data-act="talkto" data-id="all">Everyone</button>${act.map(p => `<button class="chip ${t !== 'all' && t?.id === p.id ? 'on' : ''}" data-act="talkto" data-id="${p.id}">${esc(p.name.split(' ')[0])}</button>`).join('')}</div>`;
}
function castBrief(c) {
  const act = activeParty(c);
  const lines = act.map(p => `- ${p.name}${p.pronouns ? ` (${p.pronouns})` : ''}${p.role ? `, ${p.role}` : ''}. Personality: ${p.personality || '—'}. Talks: ${p.voice || '—'}. Wants: ${p.goals || '—'}. Looks: ${p.appearance || '—'}. Closeness to ${c.character.name}: ${fmt(p.trust)} (-5 cold to +5 very close).${p.directive ? ' How they reply: ' + p.directive + '.' : ''}${p.secrets ? ' Private (reveal only through play): ' + p.secrets : ''}`);
  const gone = arr(c.party).filter(p => p.status !== 'active').map(p => `${p.name} (${p.status === 'dead' ? 'dead' : 'gone'})`);
  if (gone.length) lines.push(`No longer around: ${gone.join(', ')}.`);
  return lines.join('\n');
}
/* the narrator writes "Name: line" for each speaker; split those into chat bubbles */
const NOT_NAMES = /^(narrator|narration|note|notes|scene|setting|time|location|place|choices|options|ooc|gm|game master|you|player)$/i;
function splitCast(c, text) {
  const cast = arr(c.party).filter(p => p.status === 'active');
  const known = [...cast.map(p => p.name), ...peopleOf(c).map(e => e.name)];
  const nameOf = raw => {
    const nm = raw.replace(/\*+/g, '').trim(); if (!nm || NOT_NAMES.test(nm)) return null;
    const hit = known.find(k => k.toLowerCase() === nm.toLowerCase()) || known.find(k => k.split(' ')[0].toLowerCase() === nm.toLowerCase());
    if (hit) return hit;
    return /^[A-Z][\w'’-]*(?: [A-Z][\w'’-]*){0,2}$/.test(nm) && nm !== c.character.name ? nm : null;
  };
  const parts = []; let narr = [];
  for (const line of String(text).split('\n')) {
    const m = line.match(/^\s*(?:\*\*)?([^:*"“\n]{1,40}?)(?:\*\*)?\s*:\s*(.+)$/);
    const who = m ? nameOf(m[1]) : null;
    if (who) {
      const last = parts[parts.length - 1];
      if (last && last.name === who && !narr.length) last.text += '\n' + m[2].trim(); else { if (narr.length) { parts.push({ narr: narr.join('\n').trim() }); narr = []; } parts.push({ name: who, text: m[2].trim() }); }
    } else narr.push(line);
  }
  if (narr.join('').trim()) parts.push({ narr: narr.join('\n').trim() });
  return parts.filter(p => (p.narr ?? p.text ?? '').trim());
}
function castBubbles(c, msg) {
  const parts = splitCast(c, msg.text);
  if (!parts.some(p => p.name)) return;
  msg.raw = msg.text;
  const first = parts[0]?.narr !== undefined ? parts.shift().narr : '';
  msg.text = first;
  const after = [];
  for (const p of parts) {
    if (p.narr !== undefined) { after.push({ id: uid(), role:'sys', narr:true, text: p.narr, fromGM: msg.id }); continue; }
    const comp = findByName(arr(c.party), p.name);
    after.push({ id: uid(), role:'comp', compId: comp?.id || null, name: comp?.name || p.name, text: p.text, t: Date.now(), fromGM: msg.id });
  }
  const i = c.messages.indexOf(msg); c.messages.splice(i + 1, 0, ...after);
  return after;
}
async function buildCast(c, concepts) {
  for (const concept of concepts) {
    c.messages.push({ id: uid(), role:'sys', text:`Bringing ${concept.length > 40 ? concept.slice(0, 40) + '…' : concept} to life…`, tmp:true }); renderLog(true);
    try {
      const raw = await chat([
        { role:'system', content:`You create a character for an immersive, free-form interactive story. They must be an ADULT (18 or older). Make them vivid and specific: a real personality with flaws, a way of talking, goals and a history of their own, and 1-2 private things they don't share easily. Fit the setting and the player's description. Reply with JSON only: ${COMP_SPEC}` },
        { role:'user', content:`SETTING: ${c.title}. ${c.genre}. ${c.premise}${c.world ? '\nWORLD:\n' + c.world.slice(0, 1500) : ''}\n\nTHE PLAYER: ${c.character.name}, ${c.character.storyRole || ''}\n\nCHARACTER TO CREATE: ${concept}` }
      ], { build:true, stream:false, maxTokens:1200, temperature:0.85 });
      const j = tryJSON(stripThink(raw)); if (!j?.name) throw new Error('no character');
      const p = normComp(j, 'player'); p.revealed = true; c.party = arr(c.party); c.party.push(p);
      if (autoPortraitsOn()) portraitFor(c, p.id, true);
    } catch (e) { console.warn('Cast build failed', e); c.messages.push({ id: uid(), role:'sys', text:`Couldn't create "${concept.slice(0, 40)}". You can add them later in Cast.` }); }
    c.messages = c.messages.filter(m => !m.tmp);
  }
  if (activeParty(c).length) c.messages.push({ id: uid(), role:'sys', text:`Your cast: ${activeParty(c).map(p => p.name).join(', ')}.` });
  touch(c); renderGame();
}
function companionQuickHTML(c) {
  const q = compStyle(c) === 'chat' ? [['Send me a pic?', '📷 Ask for a photo'], ['What have you been up to today?', '💬 What have you been up to?'], ['Tell me something about you I don\'t know yet.', '✨ Tell me something new']]
    : [['Could you send me a photo?', '📷 Ask for a photo'], ['Let some time pass. What happens next?', '⏩ Let time pass'], ['I take a moment to look around.', '👀 Look around']];
  return `<div class="chips quick">${q.map(([t, l]) => `<button class="chip ghost" data-act="quick" data-q="${esc(t)}">${l}</button>`).join('')}</div>`;
}
const PHOTO_ASK = /\b(selfie|photo|photograph|pic|picture|snapshot|snap)\b/i;
function attachPhoto(c, msg, after, ph) {
  if (!ph || typeof ph !== 'object' || S.settings.image.mode === 'off') return;
  const comp = ph.of ? findByName(arr(c.party), ph.of) || peopleOf(c).find(e => e.name.toLowerCase() === String(ph.of).toLowerCase()) : null;
  const look = comp?.appearance || comp?.look || '';
  const prompt = `candid photo of ${look || ph.of || 'the scene'}, ${String(ph.prompt || '').slice(0, 300)}`.replace(/\s+/g, ' ');
  const target = (after || []).filter(m => m.role === 'comp' && comp && m.name === (comp.name)).pop() || msg;
  target.image = { prompt, seed: d(999999) };
  addGallery(c, { kind: comp ? 'character' : 'place', name: `${comp?.name || 'Photo'} · day ${worldOf(c).time.day}`, prompt, seed: target.image.seed });
}

/* =========================================================================
   Research: the app looks things up (the local AI can't browse), then the
   helper model turns real sources into world notes and lore.
   Path 1: the Ironquill helper on your PC (SearXNG → DuckDuckGo → Wikipedia, full page reading)
   Path 2: Wikipedia straight from the browser when the helper can't be reached
   ========================================================================= */
const NET = {
  health: null, checked: 0,
  base() { return forgeUrl().replace(/\/+$/, ''); },
  async helper() {
    if (Date.now() - this.checked < 60000 && this.health !== null) return this.health;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(this.base() + '/iq/health', { signal: ctl.signal }); clearTimeout(tm);
      this.health = r.ok ? await r.json() : false;
    } catch { this.health = false; }
    this.checked = Date.now(); return this.health;
  },
  async getJSON(url, ms = 25000) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(tm); }
  },
  async search(q, n = 6) {
    if (await this.helper()) {
      try { const j = await this.getJSON(this.base() + '/iq/search?' + new URLSearchParams({ q, n })); if (j.results?.length) return { engine: j.engine, results: j.results }; } catch (e) { console.warn('helper search failed', e); }
    }
    const j = await this.getJSON('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action:'query', list:'search', srsearch:q, srlimit:String(n), format:'json', origin:'*' }));
    return { engine:'wikipedia', results: arr(j.query?.search).map(r => ({ title: r.title, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(r.title.replace(/ /g, '_')), snippet: String(r.snippet || '').replace(/<[^>]+>/g, '') })) };
  },
  async read(url) {
    const wiki = url.match(/^https?:\/\/(\w+)\.wikipedia\.org\/wiki\/([^#?]+)/);
    if (wiki) {
      try {
        const j = await this.getJSON(`https://${wiki[1]}.wikipedia.org/w/api.php?` + new URLSearchParams({ action:'query', prop:'extracts', explaintext:'1', redirects:'1', titles: decodeURIComponent(wiki[2]).replace(/_/g, ' '), format:'json', origin:'*' }));
        const pg = Object.values(j.query?.pages || {})[0];
        if (pg?.extract) return { title: pg.title, url, text: pg.extract.slice(0, 16000) };
      } catch (e) { console.warn('wiki read failed', e); }
    }
    if (await this.helper()) { const j = await this.getJSON(this.base() + '/iq/read?' + new URLSearchParams({ url })); if (j.text) return j; }
    return null;
  }
};
/* rank: encyclopedias and fan wikis first, then everything else; skip video/social pages that don't read well */
function rankSources(results) {
  const score = u => /wikipedia\.org/.test(u) ? 0 : /fandom\.com|wikia|wiki\b|\.wiki\//.test(u) ? 1 : /britannica\.com|wikivoyage|history\.com|nps\.gov|\.gov\/|\.edu\//.test(u) ? 2 : 3;
  return arr(results).filter(r => r.url && !/youtube\.com|tiktok\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|pinterest\.|reddit\.com\/(?!r\/\w+\/wiki)/.test(r.url))
    .sort((a, b) => score(a.url) - score(b.url));
}
async function gatherSources(query, { pages = 3, perPage = 5000, onStep } = {}) {
  onStep?.(`Searching the web for "${query}"…`);
  const { engine, results } = await NET.search(query, 8);
  const picks = rankSources(results).slice(0, pages + 2);
  const out = [];
  for (const r of picks) {
    if (out.length >= pages) break;
    onStep?.(`Reading ${r.title || r.url}…`);
    try { const pg = await NET.read(r.url); if (pg?.text && pg.text.length > 300) out.push({ title: pg.title || r.title, url: r.url, text: pg.text.slice(0, perPage) }); }
    catch (e) { console.warn('read failed', r.url, e); }
  }
  if (!out.length) for (const r of picks.slice(0, 4)) if (r.snippet) out.push({ title: r.title, url: r.url, text: r.snippet });
  return { engine, sources: out };
}
const sourcesText = srcs => srcs.map((s, i) => `SOURCE ${i + 1}: ${s.title} (${s.url})\n${s.text}`).join('\n\n---\n\n');

