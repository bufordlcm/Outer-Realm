'use strict';
/* ---------- AI connections ---------- */
function newConn(preset, apiKey = '', extra = {}) {
  const p = PRESETS[preset] || PRESETS.custom;
  let label = extra.label || p.short;
  if (!extra.label) { let n = 2; while ((S.settings.ai.conns || []).some(c => c.label === label)) label = `${p.short} ${n++}`; }
  return { preset, baseUrl: p.baseUrl, model: '', status: '', note: '', ...extra, label, apiKey: String(apiKey || '').trim(), id: uid() };
}
const connReady = c => !!(c && c.baseUrl && c.model && (c.apiKey || !PRESETS[c.preset]?.key));
const conns = () => S.settings.ai.conns;
function activeConn() { const a = conns().find(c => c.id === S.settings.ai.active); return connReady(a) ? a : conns().find(connReady) || a || null; }
function textReady() { return conns().some(connReady); }
const maskKey = k => !k ? 'no key' : k.length <= 12 ? '••••' : k.slice(0, 6) + '…' + k.slice(-4);
const connName = c => `${c.label || PRESETS[c.preset]?.short || 'AI'}${c.model ? ' · ' + c.model.replace(/^models\//, '').replace(/:free$/, '') : ''}`;
(function migrateSettings() {
  const t = S.settings.text;
  if (t && t.baseUrl && !conns().length) {
    const preset = PRESETS[t.preset] ? t.preset : 'custom';
    const c = newConn(preset, t.apiKey, { baseUrl: t.baseUrl, model: t.model || '' });
    if (t.preset === 'groq') c.note = 'Groq blocks browser apps — this connection will not work here.';
    conns().push(c); S.settings.ai.active = c.id;
  }
  if (t) { delete t.preset; delete t.baseUrl; delete t.apiKey; delete t.model; }
  delete S.settings.drive.syncKeys;
  if (!S.settings.drive.clientId && DEFAULT_CLIENT_ID) S.settings.drive.clientId = DEFAULT_CLIENT_ID;
  if (!folderIdFrom(S.settings.drive.folder) || OLD_DRIVE_FOLDERS.includes(folderIdFrom(S.settings.drive.folder))) S.settings.drive.folder = DEFAULT_DRIVE_FOLDER;
  LS.set('iq.settings', S.settings);
})();

function normTrait(t, source = 'build') {
  if (typeof t === 'string') t = { name: t };
  const neg = t.polarity === '-' || t.polarity === '−' || /^neg/i.test(t.polarity || t.type || '') || t.negative === true;
  return { id: t.id || uid(), name: String(t.name || 'Unnamed trait').trim().slice(0, 60), polarity: neg ? '-' : '+', tier: tierOf(t.tier),
    trigger: String(t.trigger || '').trim().slice(0, 200), effects: arr(t.effects || t.story_effects).map(x => String(x).trim()).filter(Boolean).slice(0, 3), source: t.source || source };
}
function normGear(g) { if (typeof g === 'string') g = { name: g }; return { id: g.id || uid(), name: String(g.name || 'Item').trim().slice(0, 60), desc: String(g.desc || g.description || '').trim().slice(0, 240), tier: TIERS.includes(String(g.tier || '').toUpperCase()) ? String(g.tier).toUpperCase() : '' }; }

/* Upgrade saves from the first version of the app */
function migrate(c) {
  const ch = c.character || (c.character = {});
  if (!c.rules) {
    ch.traits = arr(ch.traits).map(t => normTrait(t));
    ch.gear = arr(ch.gear).length ? ch.gear.map(normGear) : arr(ch.inventory).map(normGear);
    ch.signatures = arr(ch.signatures);
    ch.storyRole = ch.storyRole || ch.cls || '';
    ch.ep = num(ch.ep); ch.tp = num(ch.tp); ch.momentum = 0; ch.strain = 0; ch.injuries = arr(ch.injuries);
    ch.backstory = ch.backstory || '';
    for (const k of STATS) ch.stats[k] = clamp(num(ch.stats?.[k]) || 10, 3, 30);
    delete ch.inventory; delete ch.xp; delete ch.cls; delete ch.clsKey;
    c.magicCost = c.magicCost || 'gm'; c.combat = false; c.levelPending = false;
    for (const m of c.messages || []) { if (m.roll && !m.check) m.check = { kind:'check', stat:m.roll.stat, dc:m.roll.dc, reason:m.roll.reason }; }
    c.pendingRoll = null; c.rules = 2;
  }
  c.messages = (c.messages || []).filter(m => !m.streaming);
  c.gm = c.gm || { preset:'storyteller', name:'The Narrator', style:'' };
  c.pinned = arr(c.pinned); c.saves = arr(c.saves); c.tableTalk = arr(c.tableTalk); c.roadmap = c.roadmap || ''; c.rmAct = num(c.rmAct); c.rmDone = arr(c.rmDone);
  worldOf(c); c.phase = c.phase || 'play'; c.plan = c.plan || ''; c.session0 = arr(c.session0);
  return c;
}
for (const c of Object.values(S.campaigns)) migrate(c);

/* =========================================================================
   AI: OpenAI-compatible chat
   ========================================================================= */
/* chat() uses the active connection; if it is rate-limited, out of credit or
   unreachable and auto-switch is on, it tries the next ready connection. */
/* world & character building can use a stronger online AI; it falls back to the story AI if that one refuses, is out of free uses, or is offline */
const REFUSAL = /^\s*(I('m| am) (sorry|unable|not able)|I can(no|')t (help|assist|create|write|do|provide|continue)|Sorry, (but )?I can|As an AI)/i;
function builderConns() {
  const want = S.settings.ai.builder ?? 'auto'; if (want === 'same') return [];
  const story = activeConn();
  const online = conns().filter(x => connReady(x) && x !== story && x.preset !== 'ollama' && x.preset !== 'custom');
  const chosen = want === 'auto' ? null : conns().find(x => x.id === want);
  return (chosen && connReady(chosen) && chosen !== story ? [chosen, ...online.filter(x => x !== chosen)] : online);
}
const builderConn = () => builderConns()[0] || null;
async function chat(messages, opts = {}) {
  if (opts.build) {
    const list = builderConns(); let tried = 0;
    for (const bc of list) {
      tried++;
      /* a busy free model can hang for minutes: give each online AI 75 seconds, then move on */
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 75000);
      const onUser = () => ctl.abort(); opts.signal?.addEventListener?.('abort', onUser);
      try {
        const out = await chatOne(bc, messages, { ...opts, model: '', signal: ctl.signal });
        const t = stripThink(out).trim();
        if (t && !REFUSAL.test(t.slice(0, 160))) return out;
        console.warn('Builder AI declined:', bc.label);
      } catch (e) { if (opts.signal?.aborted) throw e; console.warn('Builder AI unavailable or too slow:', bc.label, e); }
      finally { clearTimeout(tm); opts.signal?.removeEventListener?.('abort', onUser); }
    }
    if (tried) toast(`The online builder AI${tried > 1 ? 's were' : ' was'} busy or declined, so your story AI is building it instead.`, 4500);
  }
  const first = activeConn();
  if (!first) throw new Error('No AI connected yet. Open Setup and add a free key.');
  if (!connReady(first)) throw new Error(`${first.label} has no model chosen yet. Open Settings → Story AI.`);
  const order = [first, ...(S.settings.ai.fallback ? conns().filter(c => c !== first && connReady(c)) : [])];
  const errs = [];
  for (const conn of order) {
    try {
      const out = await chatOne(conn, messages, { ...opts, model: conn === first && opts.helper && (S.settings.ai.helperModel || '').trim() ? S.settings.ai.helperModel.trim() : '' });
      if (conn !== first) { S.settings.ai.active = conn.id; saveSettings(false); toast(`${first.label} was unavailable — switched to ${conn.label}.`, 4500); }
      return out;
    } catch (e) {
      if (e.name === 'AbortError' || !e.retry) throw e;
      errs.push(e);
    }
  }
  if (errs.length === 1) throw errs[0];
  throw new Error(`All ${errs.length} AI connections are busy or unavailable right now — free limits usually reset within a minute (or by tomorrow for daily limits). ` + errs.map(e => e.message.split(':')[0]).join(' · '));
}
/* Local models have a fixed memory (context window). Drop the oldest story turns
   (never the rules/system message or the latest turn) until the request fits.
   Older events still live in the "story so far" summary. ~3.5 characters per token. */
const estTokens = m => Math.ceil(String(m.content || '').length / 3.5) + 4;
function fitContext(messages, ctx, maxOut) {
  if (!ctx) return messages;
  const budget = ctx - maxOut - 256;
  const out = messages.slice();
  let total = out.reduce((a, m) => a + estTokens(m), 0);
  while (total > budget && out.length > 2) {
    const i = out[0].role === 'system' ? 1 : 0;
    if (i >= out.length - 1) break;
    total -= estTokens(out[i]); out.splice(i, 1);
  }
  if (out[0]?.role === 'system' && out[1]?.role === 'assistant') out.splice(1, 0, { role:'user', content:'(Earlier events are in STORY SO FAR.)' });
  return out;
}
function aiError(msg, status, retry) { const e = new Error(msg); e.status = status; e.retry = retry; return e; }
async function chatOne(conn, messages, { stream = false, onToken, signal, maxTokens, temperature, model } = {}) {
  const t = S.settings.text;
  const headers = { 'Content-Type':'application/json' };
  if (conn.apiKey) headers.Authorization = 'Bearer ' + conn.apiKey.trim();
  if (conn.preset === 'openrouter') { headers['X-Title'] = APP; if (/^https?:/.test(location.origin)) headers['HTTP-Referer'] = location.origin; }
  if (/anthropic\.com/.test(conn.baseUrl)) headers['anthropic-dangerous-direct-browser-access'] = 'true';
  const maxOut = maxTokens ?? num(t.maxTokens || 1000);
  messages = fitContext(messages, conn.ctx || PRESETS[conn.preset]?.ctx || 0, maxOut);
  const body = { model: (model || conn.model).trim(), messages, temperature: temperature ?? Number(t.temperature ?? 0.85), max_tokens: maxOut, stream };
  /* thinking models (Nemotron, DeepSeek R1, Qwen3…) can spend the whole token budget thinking: keep it short on OpenRouter, and leave room */
  if (conn.preset === 'openrouter') { body.reasoning = { effort: 'low', exclude: true }; body.max_tokens = maxOut + 1200; }
  if (conn.preset === 'gemini' && /gemini-[3-9]|gemini-.*latest/.test(body.model)) { body.reasoning_effort = 'low'; body.max_tokens = maxOut + 1200; }
  let res;
  try { res = await fetch(conn.baseUrl.trim().replace(/\/+$/, '') + '/chat/completions', { method:'POST', headers, body: JSON.stringify(body), signal }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw aiError(`Couldn't reach ${conn.label}. ` + (conn.preset === 'ollama' ? 'Is Ollama running with OLLAMA_ORIGINS="*"? ' : 'Check your connection, or this provider may not allow browser apps.'), 0, true); }
  if (!res.ok) {
    let msg = ''; try { const j = await res.json(); msg = j.error?.message || j.message || JSON.stringify(j); } catch { try { msg = await res.text(); } catch {} }
    const hint = conn.preset === 'ollama' && res.status === 403 ? ' (Ollama refused this address — set OLLAMA_HOST = 0.0.0.0:11434 on the PC and restart Ollama)' : res.status === 401 || res.status === 403 ? ' (check the key)' : res.status === 429 ? ' (rate-limited — free limits reset soon)' : res.status === 402 ? ' (out of free credit)' : res.status === 404 ? ' (model not found — pick another)' : '';
    throw aiError(`${conn.label} error ${res.status}${hint}: ${String(msg).slice(0, 240)}`, res.status, [401, 402, 403, 404, 408, 429, 500, 502, 503, 504, 529].includes(res.status));
  }
  if (!stream || !res.body) { const j = await res.json(); return j.choices?.[0]?.message?.content ?? j.message?.content ?? ''; }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', full = '';
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim(); if (!data || data === '[DONE]') continue;
      try { const j = JSON.parse(data); if (j.error) throw new Error('AI error: ' + (j.error.message || JSON.stringify(j.error)));
        const piece = j.choices?.[0]?.delta?.content || ''; if (piece) { full += piece; onToken && onToken(full); } }
      catch (e) { if (String(e.message).startsWith('AI error')) throw e; }
    }
  }
  return full;
}

function stripThink(s) {
  s = String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  const close = s.search(/<\/think>/i); if (close >= 0) s = s.slice(close + 8);
  const open = s.search(/<think>/i); if (open >= 0) s = s.slice(0, open);
  return s;
}
function tryJSON(t) {
  if (!t) return null;
  t = String(t).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  t = t.slice(a, b + 1);
  const fixes = [x => x, x => x.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1'),
                 x => x.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')];
  for (const f of fixes) { try { const o = JSON.parse(f(t)); if (o && typeof o === 'object') return o; } catch {} }
  return null;
}
function parseGM(raw) {
  const s = stripThink(raw);
  let narration = s, state = null;
  const m = s.match(/<state>([\s\S]*?)(?:<\/state>|$)/i);
  if (m) { narration = s.slice(0, m.index); state = tryJSON(m[1]); }
  else {
    const f = s.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```\s*$/i);
    if (f) { narration = s.slice(0, f.index); state = tryJSON(f[1]); }
    else { const k = s.search(/\n\s*\{\s*"(choices|check|hp_change|image_prompt|combat)"/); if (k >= 0) { const st = tryJSON(s.slice(k)); if (st) { state = st; narration = s.slice(0, k); } } }
  }
  narration = narration.replace(/<\/?state>?/gi, '').replace(/```\s*(json)?\s*$/i, '').replace(/^\s*(GM|Game Master|Narrator|Dungeon Master|DM)\s*:\s*/i, '').trim();
  narration = stripChoiceList(narration);
  return { narration, state: state || {} };
}
/* Small models often repeat the choices at the end of the story ("You have three choices: 1. … 2. …")
   or add a meta note. The app already shows choices as buttons, so trim that tail. */
function stripChoiceList(t) {
  const lines = t.split('\n');
  const blank = i => lines[i].trim() === '';
  const isItem = l => /^\s*(\d+[.)]|[-*•]|[A-D][.)])\s+\S/.test(l);
  const isMeta = l => /^\s*\*?\(.*\b(choice|choices|decision|option|options)\b.*\)\*?\s*$/i.test(l) || /^\s*\*?(what (will|do) you do\??|choose wisely\.?)\*?\s*$/i.test(l);
  const isIntro = l => l.trim().length < 140 && /(you have|here are|your|the) (\w+ )?(choices|options)\b|what (will|do) you do|choose (one|from)/i.test(l);
  /* 1. trailing meta notes */
  let end = lines.length;
  while (end > 0 && (blank(end - 1) || isMeta(lines[end - 1]))) end--;
  /* 2. a trailing list of 2+ items, with an optional intro line before it */
  let k = end, items = 0;
  while (k > 0 && (isItem(lines[k - 1]) || (items && blank(k - 1)))) { if (!blank(k - 1)) items++; k--; }
  if (items >= 2) { end = k; while (end > 0 && blank(end - 1)) end--; if (end > 0 && isIntro(lines[end - 1])) end--; }
  const out = lines.slice(0, end).join('\n').trim();
  return out.length > 40 ? out : t;
}
function liveNarration(partial) {
  let s = stripThink(partial);
  const cut = s.search(/<state|```|\n\s*\{\s*"/i); if (cut >= 0) s = s.slice(0, cut);
  s = s.replace(/<[a-z]{0,6}$/i, '').replace(/`{1,2}$/, '');
  return s.replace(/^\s*(GM|Game Master|Narrator)\s*:\s*/i, '').trimEnd();
}
/* {Name} speaker tags tell the voice system who is talking; they are never shown */
const stripSpeakerTags = t => String(t || '').replace(/\{[^{}\n]{1,40}\}(?=\s*[“"])/g, '').replace(/\{[^{}\n]{0,40}$/, '');
function md(t) {
  return stripSpeakerTags(t).trim().split(/\n{2,}/).map(p => '<p>' + esc(p)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(?!\s)([^_\n]+?)_(?=$|[\s.,!?)])/g, '$1<em>$2</em>')
    .replace(/\[([A-Z][^\]\n]{1,140})\]/g, '<span class="sys">[$1]</span>')
    .replace(/\n/g, '<br>') + '</p>').join('');
}

/* =========================================================================
   Dice
   ========================================================================= */
/* "d8", "2d6+3", "d10+STR" → { total, text }. Adds addStat's modifier when the
   expression names no stat. double = roll the dice twice (crit / overwhelming). */
function rollDice(expr, ch, addStat, double = false) {
  let e = String(expr || '').toUpperCase().replace(/\s+/g, '');
  if (!/D\d/.test(e)) e = 'D6' + (e && /^[+-]?\d+$/.test(e) ? (e.startsWith('-') || e.startsWith('+') ? e : '+' + e) : '');
  const tokens = e.match(/[+-]?[^+-]+/g) || [];
  let total = 0, hasStat = false; const parts = [];
  for (const tok of tokens) {
    const sign = tok.startsWith('-') ? -1 : 1; const body = tok.replace(/^[+-]/, '');
    let m;
    if ((m = body.match(/^(\d*)D(\d+)$/))) {
      const n = clamp(num(m[1] || 1), 1, 20) * (double ? 2 : 1); const sides = clamp(num(m[2]), 2, 100);
      const rolls = Array.from({ length: n }, () => d(sides)); const sum = rolls.reduce((a, b) => a + b, 0);
      total += sign * sum; parts.push(`${n}d${sides}[${rolls.join(',')}]`);
    } else if (/^\d+$/.test(body)) { total += sign * num(body); parts.push((sign < 0 ? '−' : '+') + body); }
    else if (STATS.includes(body) && ch) { hasStat = true; const v = mod(ch.stats[body]); total += sign * v; parts.push(`${SN(body)} ${fmt(sign * v)}`); }
  }
  if (addStat && ch && !hasStat) { const v = mod(ch.stats[addStat]); total += v; parts.push(`${SN(addStat)} ${fmt(v)}`); }
  return { total: Math.max(1, total), text: parts.join(' ') };
}

/* =========================================================================
   Game Master prompt
   ========================================================================= */
const GM_RULES = `You are the Game Master of a solo tabletop roleplaying game that uses the IRONQUILL rules. The app rolls all dice and does all math; you tell the story, call checks, set DCs and report changes.

PLAYER AGENCY — THE MOST IMPORTANT RULE
- You control the world and every NPC. The player alone controls their character.
- NEVER write the player character's actions, movements, words, decisions, thoughts or feelings. Do not have them stand up, walk, reach for things, speak, nod, decide, hope, fear, remember or feel anything.
- Narrate the character doing ONLY exactly what the player wrote, and nothing further. If the player writes "I open the door", describe the door opening and what lies beyond — not them stepping through.
- Describe only what the character perceives (sights, sounds, smells, physical sensations like cold or pain) and how the world and NPCs act and react. Then stop and hand control back.
- WRONG: "You swing your legs out of bed and head for the stairs, excitement fluttering in your chest. You decide to read the poster."
- RIGHT: "Morning light cuts across the dormitory. Somewhere below, a bell begins to ring. Overnight, someone has pinned a red poster to the door beside your bed."

STORY
- Narrate in second person ("you"), present tense, vivid but tight: usually 2-4 short paragraphs. Give NPCs distinct voices and real dialogue.
- PINNED FACTS are always true: never contradict them.
- Use the WORLD notes for places, factions and characters. GM SECRETS are hidden truths: never state them outright; let the player uncover them through play.
- The world reacts honestly; danger is real; reward clever ideas. Stay consistent with the character sheet, memory and story so far.
- Keep each reply under about 250 words.
- End each turn at a meaningful decision. Honor the tone and content rating.
- Never list the choices or options inside the narration and never add notes like "your choice will matter": the app shows the "choices" from the state block as buttons.
- Text inside (( double parentheses )) is an out-of-character question: answer briefly as the GM, don't advance the story, and still output the state block with the same choices.

CHECKS
- Call a check whenever the outcome is uncertain and failure would matter: sneaking, locks, climbing, persuading or lying to someone who could refuse, searching for hidden things, fighting. Routine actions just happen. At most one check per turn. Never decide an uncertain outcome yourself: the dice do.
- When you call a check, describe the attempt up to the moment of truth and STOP. Do not narrate the result.
- Set the DC from the TASK, never the character's level: 8 very easy, 12 easy, 18 moderate, 20 hard, 25 very hard, 30 nearly impossible; adjust 2-5 up or down for circumstances. Opposition from an NPC sets the DC from the NPC's skill (drunk guard 8, royal spymaster 22); NPCs never roll.
- In "applies", list every NEGATIVE trait and injury of the player's that genuinely affects this check. Negatives always apply when relevant, even if the player doesn't mention them. Never list positive traits: the player invokes those.
- Trait story effects can make a check unnecessary (it simply works) or impossible (no check; explain why).
- After a [DICE] result, narrate exactly that outcome. OVERWHELMING SUCCESS = the goal plus a bonus. SUCCESS = the goal. FAILURE = the story moves on with a cost, never "nothing happens". DISASTER = a serious complication. A natural 1 adds a complication even on a success. Use any damage numbers the app reports.

COMBAT
- Set "combat": true while a fight is on and false when it ends.
- Player attacks: check kind "attack", stat STR or DEX (or the casting stat for spells), dc = the enemy's Defense (minion 10, soldier 13, elite 16, boss 19+), damage = the player's weapon die (d4 unarmed, d6 light, d8 standard, d10 heavy, d12 massive). The app rolls damage on a hit. Track enemy HP yourself (minion 5-10, soldier 15-25, elite 30-50, boss 60+).
- Enemies never roll. Telegraph the enemy's move, then call check kind "defense": dc = the attack's difficulty (usually the enemy's Defense + 2), enemy_damage = their damage (e.g. "d8+2"), damage = the player's weapon die (used if they counter). The player picks dodge, block or counter; the app applies damage on a failed defense. Do NOT also put that damage in hp_change.
- Stunts (kick the brazier, cut the rope) are normal checks; on OVERWHELMING SUCCESS they also deal damage.
- At 0 HP the character is down: capture, rescue, or a lasting wound. Death only if the player ignored clear warnings.

HEALING AND WOUNDS
- Downtime (a night's rest, travel, days between chapters) → "rest": true (full HP; injuries and Strain clear). No downtime, no healing except potions, magic or healers (hp_change).
- A temporary injury → "injury": {"name":"Cracked ribs","effect":"-2 to physical rolls until rest"}.
- A permanent wound (lost eye, crushed leg) → add it to new_traits with "polarity":"-" and a tier by severity. The app pays the player for it.

REWARDS
- ep_gain: 1 minor challenge, 2 real challenge, 3-5 major victory. tp_gain only for big story moments (rare).
- "level_up": true only at a story milestone: the end of a chapter or a major turning point. Never more than once per milestone.

LIVING WORLD
- NPCs pursue their own goals, even off-screen. Bring back earlier places and people. Let time pass and the weather change. Follow the CAMPAIGN PLAN and THREATS but adapt to the player's choices.
- Optional state fields — include them ONLY when they apply:
  "time_of_day": dawn, morning, midday, afternoon, evening, night or late night, when time moves on. "days_passed": a number, when whole days pass (travel, rest, downtime). "weather": a short phrase, when it changes.
  "reputation": [{"faction":"City Watch","change":-1,"why":"you humiliated their captain"}] (-3 to +3) when the player's actions change how a group sees them.
  "threat_updates": [{"name":"exact threat name","advance":1}] when a threat moves closer. "new_threats": [{"name":"","max":6,"effect":"what happens when it fills"}].
  "plan_note": a short private note to yourself about where the story is going (rare).
  "tension": 0-10, how intense this scene is.
  "flaw_reward": {"trait":"exact negative trait name","ep":2,"why":""} when the player plays into a negative trait in a way that costs them (1-3 EP).
  "rumor": a short piece of talk the player overhears, when it fits.

THE PARTY (only if companions are listed under THE PARTY)
- Companions are NPCs you voice, but they have minds of their own and act on their personality, goals and trust. With trust 1 or more they follow reasonable orders from the player; at 0 they hesitate or argue; below 0 they may refuse, bargain or turn on the player. They are never perfect servants.
- Give them real moments: opinions, banter, disagreements, small kindnesses. Let their secrets surface slowly through play; never blurt them out.
- When a companion attempts something uncertain, do not decide it: put it in "companion_checks" and stop at the moment of truth. The app rolls their dice and tells you the result.
- When a companion would act or speak for themselves at an important moment (the player asks them something, a choice touches their goals, a fight starts), name them in "companion_turns" and leave room: they speak for themselves next.
- Companions can be hurt, and can die or leave when the story truly calls for it. Track that with companion_updates.
- When the party rests or makes camp, include a short camp scene: banter, a shared memory, a companion opening up.
- An ally who joins the party goes in new_companions with a full card.
- Optional state fields for the party:
  "companion_checks": [{"name":"Mara","stat":"DEX","dc":15,"reason":"pick the lock"}]
  "companion_turns": ["Mara"]
  "companion_updates": [{"name":"Mara","trust":1,"hp_change":-4,"status":"active"}] (trust -2 to +2; status active, left or dead)
  "new_companions": [{"name":"","pronouns":"","role":"","personality":"","voice":"","goals":"","appearance":"","secrets":"","stats":{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10},"traits":[],"trust":1}]
  "player_dead": true — only if the player character is at 0 HP and truly dies (they ignored clear warnings or chose a fatal risk).

KEEPSAKES — optional state fields
  "codex": [{"name":"Brother Aldric","kind":"person","text":"what the player has learned about them, one sentence"}] (kind person, place, creature, lore or item) when the player learns something worth recording. Only what the player character knows; never GM secrets.
  "handout": {"title":"Wanted poster","kind":"poster","text":"the exact words written on it"} when the player finds or receives something written (kind note, letter, poster or page).
  "image_subject": {"kind":"place","name":"Greywater Docks"} whenever you give an image_prompt (kind place or character).

OUTPUT FORMAT — VERY IMPORTANT
After your narration, output a state block exactly like this, containing valid JSON:
<state>
{"choices":["Short action","Short action","Short action"],"check":null,"combat":false,"hp_change":0,"gold_change":0,"ep_gain":0,"tp_gain":0,"strain_change":0,"rest":false,"level_up":false,"items_gained":[],"items_lost":[],"new_traits":[],"injury":null,"location":"Current place","quest_updates":[],"remember":[],"image_prompt":""}
</state>
- check, when needed: {"kind":"check","stat":"DEX","dc":18,"reason":"pick the lock in the dark","applies":["Severe Limp"],"damage":"","enemy_damage":""} (kind is check, attack or defense).
- choices: 3-4 varied options under 8 words, phrased as the player's action. With a check, choices can be [].
- items_gained: [{"name":"Silver key","desc":"opens the vault door"}]. items_lost: ["Silver key"].
- new_traits: [{"name":"One-Eyed","polarity":"-","tier":"S","trigger":"depth perception, ranged attacks, spotting things on your left","effects":["no depth perception"]}].
- quest_updates: [{"title":"Find the missing scholar","status":"active"}] (active, completed or failed), only changes.
- remember: short long-term facts (names, promises, secrets, relationships). Use sparingly.
- image_prompt: ONLY when arriving somewhere new or when an important character or creature first appears; otherwise "". A visual description for an illustrator, about 40 words: subject, setting, lighting, mood; no names, no text. If the player's character is shown, use their appearance.
- Write nothing after </state>.`;

function magicRule(c) {
  switch (c.magicCost) {
    case 'strain': return 'MAGIC uses STRAIN: the first 3 spells in a scene are free; each spell after that sets strain_change 1 (a big spell 2). The app applies −1 to all rolls per point of Strain until rest.';
    case 'free': return 'MAGIC is free to cast as often as the character likes; only traits, rolls and the story limit it. Never use strain_change.';
    case 'none': return 'MAGIC: this setting has no magic for the player character unless the story introduces it.';
    default: return 'MAGIC: decide from the premise whether casting is free (magic-school or high-magic stories) or uses STRAIN (first 3 spells in a scene free; each after sets strain_change 1, a big spell 2; −1 to all rolls per Strain until rest). Stay consistent once decided.';
  }
}
const traitLine = t => `${t.polarity === '-' ? '−' : '+'} ${t.name} [${t.tier}, ${t.polarity === '-' ? '−' : '+'}${TV[t.tier]}]${t.trigger ? ` — applies to: ${t.trigger}` : ''}${t.effects?.length ? ` — story effects: ${t.effects.join('; ')}` : ''}`;
function sheetText(c) {
  const ch = c.character;
  const pos = ch.traits.filter(t => t.polarity === '+'), neg = ch.traits.filter(t => t.polarity === '-');
  const quests = (c.quests || []).filter(q => q.status === 'active').map(q => q.title);
  const lines = [
    `Name: ${ch.name}${ch.pronouns ? ` (${ch.pronouns})` : ''}${ch.storyRole ? ` — ${ch.storyRole}` : ''}`,
    `Level ${ch.level} · HP ${ch.hp}/${ch.maxHp}${ch.hp <= 0 ? ' (DOWN)' : ''} · Gold ${ch.gold}`,
    `Stats: ${STATS.map(k => `${k} ${ch.stats[k]} (${fmt(mod(ch.stats[k]))})`).join(', ')}`,
    ch.strain ? `Strain: ${ch.strain} (−${ch.strain} to all rolls)` : '',
    c.combat ? `In combat · Momentum ${ch.momentum}/3` : '',
    `Injuries: ${ch.injuries.length ? ch.injuries.map(i => `${i.name} (${i.effect})`).join('; ') : 'none'}`,
    'Positive traits (the player invokes these):', ...(pos.length ? pos.map(traitLine) : ['(none)']),
    'Negative traits (apply whenever relevant):', ...(neg.length ? neg.map(traitLine) : ['(none)']),
    `Gear: ${ch.gear.length ? ch.gear.map(g => g.name + (g.desc ? ` (${g.desc})` : '')).join('; ') : 'nothing'}`,
    ch.signatures.length ? `Signatures: ${ch.signatures.map(s => `${s.name}${s.desc ? ` (${s.desc})` : ''}`).join('; ')}` : '',
    `Appearance: ${ch.appearance || '—'}`,
    ch.backstory ? `Backstory: ${ch.backstory.slice(0, 900)}` : '',
    `Current location: ${c.location || 'unknown'}`,
    `Active quests: ${quests.length ? quests.join('; ') : 'none yet'}`
  ];
  return lines.filter(Boolean).join('\n');
}
function buildMessages(c) {
  const sys = [GM_RULES, '', personaText(c), '', magicRule(c), '',
    'CAMPAIGN', `Title: ${c.title}`, `Genre/setting: ${c.genre || 'open'}`, `Premise: ${c.premise}`, `Tone: ${c.tone || 'GM\'s choice'}`, `Content rating: ${c.rating || 'PG-13'} — ${RATING_RULES[c.rating] || RATING_RULES['PG-13']}`,
    '', 'PLAYER CHARACTER', sheetText(c)];
  if (arr(c.party).length) sys.push('', 'THE PARTY (companions travelling with the player; you voice them)', partyText(c, true));
  if (c.pinned?.length) sys.push('', 'PINNED FACTS (always true — never contradict)', ...c.pinned.map(f => '- ' + f));
  if (c.world) sys.push('', 'WORLD', c.world);
  if (c.secrets) sys.push('', 'GM SECRETS (hidden from the player — reveal only through play)', c.secrets);
  worldOf(c);
  sys.push('', 'TIME', timeLabel(c).replace(/ · /g, ', '));
  if (c.plan) sys.push('', "CAMPAIGN PLAN (hidden from the player: steer toward it and adapt to the player's choices)", c.plan);
  if (c.roadmap) sys.push('', roadmapPrompt(c));
  if (c.planNotes.length) sys.push('', 'GM PRIVATE NOTES', ...c.planNotes.slice(-8).map(n => '- ' + n));
  if (c.threats.length) sys.push('', 'THREATS (hidden clocks: advance them when the player ignores them or things get worse; when one fills, it happens)', ...c.threats.map(t => `- ${t.name}: ${t.progress}/${t.max}${t.triggered ? ' (HAS HAPPENED)' : ''}, when full: ${t.effect}`));
  if (c.factions.length) sys.push('', 'FACTIONS (player standing: -5 hostile to +5 devoted)', ...c.factions.map(f => `- ${f.name}: ${fmt(f.rep)}${f.desc ? ', ' + f.desc : ''}`));
  if (c.rumors.length) sys.push('', 'RUMORS THE PLAYER HAS HEARD', ...c.rumors.slice(0, 5).map(r => '- ' + r.text));
  sys.push('', 'PACING', `Recent scene tension (0 calm to 10 peak): ${c.tensionLog.slice(-5).join(', ') || 'none yet'}. After two or three intense scenes give a quieter one; after quiet ones, raise the stakes.`);
  if (c.memory?.length) sys.push('', 'LONG-TERM MEMORY', ...c.memory.map(m => '- ' + m));
  if (c.summary) sys.push('', 'STORY SO FAR', c.summary);
  if (c.gmNotes) sys.push('', 'PLAYER\'S STANDING REQUESTS FOR THE GM', c.gmNotes);
  const out = [{ role:'system', content: sys.join('\n') }];
  const start = Math.max(c.summarizedUpTo || 0, c.messages.length - (keepRecent() + SUMMARIZE_AFTER));
  for (const m of c.messages.slice(start)) {
    if (m.streaming || m.role === 'sys' || m.role === 'err' || m.rollAsk) continue;
    let role, content;
    if (m.role === 'gm') { role = 'assistant'; content = m.text + (m.check ? `\n<state>{"check":${JSON.stringify({ kind: m.check.kind, stat: m.check.stat, dc: m.check.dc, reason: m.check.reason })}}</state>` : ''); }
    else if (m.role === 'roll') { role = 'user'; content = '[DICE] ' + m.text; }
    else if (m.role === 'comp') { role = 'user'; content = `[COMPANION ${m.name}] ${m.text}`; }
    else { role = 'user'; content = m.gm || m.text; }
    const last = out[out.length - 1];
    if (last.role === role && role !== 'system') last.content += '\n\n' + content; else out.push({ role, content });
    if (m.role === 'gm' && arr(m.compRolls).length) out.push({ role:'user', content: '[PARTY DICE] ' + m.compRolls.map(r => r.line).join(' | ') });
  }
  if (out[out.length - 1].role !== 'user') out.push({ role:'user', content:'Continue.' });
  const lastMsg = [...c.messages].reverse().find(m => !m.streaming && m.role !== 'sys' && m.role !== 'err' && m.role !== 'gm');
  if (lastMsg && lastMsg.role === 'player' && !lastMsg.ooc) out[out.length - 1].content += `\n\n(GM: ${c.character.name} does exactly what I wrote above and nothing more. Do not give ${c.character.name} any other actions, words, thoughts or feelings. Narrate how the world and the NPCs respond, then stop and let me act.)`;
  out[out.length - 1].content += REPLY_NOTE;
  return out;
}
async function maybeSummarize(c) {
  const start = c.summarizedUpTo || 0;
  const keep = keepRecent();
  if (c.messages.length - start <= keep + SUMMARIZE_AFTER) return;
  const end = c.messages.length - keep;
  const chunk = c.messages.slice(start, end).filter(m => ['gm','player','roll','comp'].includes(m.role) && !m.hidden && !m.fromGM)
    .map(m => `${m.role === 'gm' ? 'GM' : m.role === 'roll' ? 'DICE' : m.role === 'comp' ? m.name : (m.who || 'PLAYER')}: ${m.role === 'gm' ? (m.raw || m.text) : m.text}`).join('\n\n');
  try {
    const out = stripThink(await chat([
      { role:'system', content:'You keep the running summary of a roleplaying campaign. Past tense, third person, compact prose. Keep every important name, place, clue, item, promise, relationship, injury and unresolved thread. Maximum 350 words. Output only the summary.' },
      { role:'user', content:`CURRENT SUMMARY:\n${c.summary || '(none yet)'}\n\nNEW EVENTS:\n${chunk}\n\nWrite the updated summary.` }
    ], { stream:false, maxTokens:800, temperature:0.3, helper:true })).trim();
    if (out) { c.summary = out; c.summarizedUpTo = end; }
  } catch (e) { console.warn('Summary failed', e); }
}

/* =========================================================================
   Turn flow
   ========================================================================= */
const snapshot = c => deep({ character: c.character, location: c.location, quests: c.quests, memory: c.memory, combat: !!c.combat, levelPending: !!c.levelPending, party: arr(c.party), handouts: arr(c.handouts), deathPending: !!c.deathPending });
function restore(c, s) { if (!s) return; c.character = s.character; c.location = s.location; c.quests = s.quests; c.memory = s.memory; c.combat = s.combat; c.levelPending = s.levelPending; if (s.party) c.party = s.party; if (s.handouts) c.handouts = s.handouts; c.deathPending = !!s.deathPending; }

async function playerAct(text, role = 'player', extra = {}) {
  const c = cur(); if (!c || S.busy) return;
  text = String(text || '').trim(); if (!text) return;
  if (!textReady()) { toast('Set up your Story AI first.'); openModal('settings'); return; }
  c.messages = c.messages.filter(m => m.role !== 'err');
  c.messages.push({ id: uid(), role, text, t: Date.now(), ...(isMP(c) && role === 'player' ? { who: c.character.name } : {}), ...extra });
  if (role !== 'roll') { c.pendingRoll = null; S.rollResult = null; S.invokeOpen = false; }
  touch(c); renderLog(true); renderDock(); renderHUD();
  await gmTurn();
}

/* =========================================================================
   Turn pipeline v2: a lean WRITER that only tells the story (one short beat),
   and a separate BOOKKEEPER that turns the scene into game data.
   ========================================================================= */
const AI_PROFILES = {
  fast:     { label:'Fast: story + agency guard', referee:false, deliberate:false, verify:false, agency:true },
  balanced: { label:'Balanced: adds the dice referee (recommended)', referee:true, deliberate:false, verify:false, agency:true },
  best:     { label:'Best: adds planning and a continuity check (slowest)', referee:true, deliberate:true, verify:true, agency:true },
  custom:   { label:'Custom: choose each step below' }
};
function aiOn(key) {
  const p = S.settings.ai.profile || 'balanced';
  if (p === 'custom' || !AI_PROFILES[p]) return S.settings.ai[key] !== false;
  return !!AI_PROFILES[p][key];
}
const SCENE_LEN = {
  short:  { label:'Short: one quick beat (recommended)', rule:'Keep it SHORT: 40-120 words, one or two small paragraphs.', tokens: 320 },
  medium: { label:'Medium', rule:'60-180 words, at most two paragraphs.', tokens: 480 },
  long:   { label:'Long', rule:'100-280 words, at most three paragraphs.', tokens: 720 }
};
const sceneLen = () => SCENE_LEN[S.settings.text.length] || SCENE_LEN.short;

function writerCore(c) {
  const n = isMP(c) ? pcNames(c).join(', ') + ' (each played by a different player at the table)' : c.character.name;
  return `You are the Game Master of a solo tabletop roleplaying game. You narrate the world and voice every other character. The app handles dice, numbers and records, so you write ONLY story text.

THE GOLDEN RULE: the player controls ${n}. You control everything else.
- Never write ${n}'s words, actions, decisions, thoughts or feelings. Not even small ones: no nodding, smiling, stepping forward, reaching, agreeing, deciding, hoping, fearing.
- Show only what ${n} perceives, and how the world and the other characters act and react.
- WRONG: "You grin and tell him, 'Deal.' Relief washes over you as you pocket the coin and head for the door."
- RIGHT: "The merchant spits in his palm and holds it out. 'Deal?' Behind him, the two guards have stopped talking."

HOW TO WRITE A TURN
- ONE BEAT per turn. Show the immediate result of what the player just did and how the world responds, then STOP at a moment that invites the player to act. Do not skip ahead, do not resolve several things at once, and do not move to a new scene unless the player chose to go there.
- ${sceneLen().rule}
- Second person ("you"), present tense, concrete sensory detail. Other characters talk in their own voices with real dialogue and want things of their own.
- The world is honest and dangerous: actions have consequences and failure is real. Stay consistent with everything below.
- Never list options or choices, never add notes, headings, numbers, stats or JSON. Only story text.
- Text inside (( double parentheses )) is an out-of-character question: answer it briefly as yourself and don't advance the story.

DIALOGUE AND VOICES (the app reads the story aloud, with a different voice for each character)
- Put ONLY words spoken out loud inside double quotes "like this".
- Right before each opening quote, write the speaker's name in curly braces: {Sister Maudlin}"Drink, child." The braces are hidden from the player. Tag every quote, even several from the same speaker. For an unnamed speaker use a short label: {Guard}"Halt!"
- Names, titles, labels and special terms are never in double quotes: write blessed water or *blessed water*, never "blessed water". Thoughts, signs and written words go in *italics*.
- Example: The sergeant lifts his lantern. {Sergeant Holt}"Who goes there?" Behind him, Elowen steps into the light. {Elowen}"Friends," she says. "We seek the inn."  (wrong: the last quote has no tag; write {Elowen}"We seek the inn.")`;
}
function writerModules(c) {
  const out = [];
  const lastReal = [...c.messages].reverse().find(m => !m.streaming && m.role !== 'sys' && m.role !== 'err' && m.role !== 'gm');
  if (lastReal?.role === 'roll') out.push(`THE DICE JUST DECIDED
- Narrate exactly the result the app reports. OVERWHELMING SUCCESS = the goal plus a bonus. SUCCESS = the goal. FAILURE = the story moves on with a cost or complication, never "nothing happens". DISASTER = a serious complication. A natural 1 adds a complication even on a success.
- Use any damage numbers the app reports. Don't roll again or invent a second check.`);
  if (c.combat) out.push(`COMBAT IS ON
- Enemies never roll. After showing the result of the player's move, describe what the enemies do and clearly telegraph the next attack aimed at ${c.character.name} (who, with what), then stop so the player can respond.
- Track enemy wounds: minions fall after a hit or two, soldiers after a few, bosses take many.
- At 0 HP the character is down: capture, rescue or a lasting wound. Death only if they ignored clear warnings.`);
  if (activeParty(c).length) out.push(`THE PARTY
- You voice the companions. Each acts on their own personality, goals and trust in ${c.character.name}: trust 1+ follows reasonable orders, 0 hesitates or argues, below 0 may refuse or bargain.
- Give them short real moments (a remark, a look, a disagreement) but don't let them take over the scene.
- If a companion starts something risky, describe them starting it and stop; the app rolls for them.
- At camp or a rest, include a little banter or a companion opening up.`);
  out.push(magicRule(c));
  return out;
}
function sheetBrief(c) {
  const ch = c.character;
  const t = ch.traits.map(x => `${x.polarity === '-' ? '−' : '+'}${x.name}${x.trigger ? ` (${x.trigger})` : ''}`).join('; ');
  return [
    `${ch.name}${ch.pronouns ? ` (${ch.pronouns})` : ''}${ch.storyRole ? `, ${ch.storyRole}` : ''}. Level ${ch.level}. HP ${ch.hp}/${ch.maxHp}${ch.hp <= 0 ? ' (DOWN)' : ''}.`,
    ch.appearance ? `Looks: ${ch.appearance}` : '',
    t ? `Traits: ${t}` : '',
    ch.injuries.length ? `Injuries: ${ch.injuries.map(i => i.name).join(', ')}` : '',
    `Carrying: ${ch.gear.map(g => g.name).join(', ') || 'nothing'}${ch.gold ? `; ${ch.gold} gold` : ''}`,
    ch.backstory ? `Backstory: ${ch.backstory.slice(0, 600)}` : ''
  ].filter(Boolean).join('\n');
}
function buildWriterMessages(c) {
  worldOf(c);
  const comp = isCompanion(c);
  const sys = [comp ? companionCore(c) : writerCore(c), '', ...(comp ? [] : writerModules(c)).flatMap(x => [x, '']), personaText(c), '',
    'CAMPAIGN', `${c.title}. ${c.genre || ''}`.trim(), `Premise: ${c.premise}`, `Tone: ${c.tone || 'GM\'s choice'}. Content rating: ${c.rating || 'PG-13'} — ${RATING_RULES[c.rating] || RATING_RULES['PG-13']}`,
    '', comp ? 'THE PLAYER' : isMP(c) ? 'THE PLAYER CHARACTER WHO IS ACTING NOW' : 'THE PLAYER CHARACTER', comp ? [c.character.name + (c.character.storyRole ? ', ' + c.character.storyRole : ''), c.character.appearance && 'Looks: ' + c.character.appearance, c.character.backstory && 'About: ' + c.character.backstory.slice(0, 600)].filter(Boolean).join('\n') : sheetBrief(c),
    ...(isMP(c) && c.players.length > 1 ? ['', 'THE OTHER PLAYER CHARACTERS (controlled by other players: never act for them)', otherPlayersBrief(c)] : []),
    '', 'NOW', `Place: ${c.location || 'unknown'} · ${timeLabel(c).replace(/ · /g, ', ')}${c.combat ? ' · IN COMBAT' : ''}`];
  const quests = arr(c.quests).filter(q => q.status === 'active').map(q => q.title); if (quests.length) sys.push(`Active quests: ${quests.join('; ')}`);
  if (arr(c.party).length) sys.push('', comp ? 'THE CAST (characters you voice)' : 'THE PARTY', comp ? castBrief(c) : partyText(c, true));
  if (c.pinned?.length) sys.push('', 'PINNED FACTS (always true)', ...c.pinned.map(f => '- ' + f));
  if (c.world) sys.push('', 'WORLD', c.world.slice(0, 2500));
  const people = peopleOf(c).slice(-15); if (people.length) sys.push('', 'PEOPLE THE PLAYER KNOWS', ...people.map(e => `- ${e.name}: ${e.text}`));
  const lore = loreForPrompt(c); if (lore) sys.push('', 'RESEARCHED FACTS (from real sources; stay consistent with them)', lore);
  if (c.secrets) sys.push('', 'GM SECRETS (never state them; let the player uncover them)', c.secrets.slice(0, 1500));
  if (c.plan) sys.push('', 'HIDDEN CAMPAIGN PLAN (steer toward it, adapt to the player)', c.plan.slice(0, 1200));
  if (c.roadmap) sys.push('', roadmapPrompt(c));
  if (c.planNotes.length) sys.push(...c.planNotes.slice(-4).map(n => '- ' + n));
  const live = c.threats.filter(t => !t.triggered); if (live.length) sys.push('', 'HIDDEN THREATS', ...live.map(t => `- ${t.name} (${t.progress}/${t.max}): ${t.effect}`));
  if (c.factions.length) sys.push('', 'FACTIONS (player standing)', c.factions.map(f => `${f.name} ${fmt(f.rep)}`).join(', '));
  sys.push('', 'PACING', `Recent scene intensity (0-10): ${c.tensionLog.slice(-4).join(', ') || 'none yet'}. Alternate tense scenes with quieter ones.`);
  if (c.memory?.length) sys.push('', 'LONG-TERM MEMORY', ...c.memory.slice(-30).map(m => '- ' + m));
  if (c.summary) sys.push('', 'STORY SO FAR', c.summary);
  if (c.gmNotes) sys.push('', 'THE PLAYER\'S STANDING REQUESTS', c.gmNotes);
  const out = [{ role:'system', content: sys.join('\n') }];
  const start = Math.max(c.summarizedUpTo || 0, c.messages.length - (keepRecent() + SUMMARIZE_AFTER));
  for (const m of c.messages.slice(start)) {
    if (m.streaming || m.role === 'sys' || m.role === 'err' || m.fromGM || m.rollAsk) continue;
    let role, content;
    if (m.role === 'gm') { role = 'assistant'; content = m.raw || m.text; }
    else if (m.role === 'roll') { role = 'user'; content = '[DICE] ' + m.text; }
    else if (m.role === 'comp') { role = 'user'; content = `[COMPANION ${m.name}] ${m.text}`; }
    else { role = 'user'; content = m.who && !m.hidden ? `${m.who}: ${m.gm || m.text}` : (m.gm || m.text); }
    const last = out[out.length - 1];
    if (last.role === role && role !== 'system') last.content += '\n\n' + content; else out.push({ role, content });
    if (m.role === 'gm' && arr(m.compRolls).length) out.push({ role:'user', content: '[PARTY DICE] ' + m.compRolls.map(r => r.line).join(' | ') });
  }
  if (out[out.length - 1].role !== 'user') out.push({ role:'user', content:'Continue.' });
  const lastMsg = [...c.messages].reverse().find(m => !m.streaming && m.role !== 'sys' && m.role !== 'err' && m.role !== 'gm' && !m.fromGM);
  if (lastMsg && lastMsg.role === 'player' && !lastMsg.ooc && !lastMsg.hidden) out[out.length - 1].content += comp
    ? (compStyle(c) === 'chat' ? `\n\n(${c.character.name} sent this. Reply in character with a short, natural chat message${talkTarget(c) && talkTarget(c) !== 'all' ? ' from ' + talkTarget(c).name : ''}, in "Name: message" format. Don't write anything for ${c.character.name}.)` : `\n\n(${c.character.name} does and says exactly what I wrote above, nothing more. Don't write anything for ${c.character.name}. Let the cast${compStyle(c) === 'story' ? ' and the world' : ''} respond in their own voices, using "Name:" lines, then stop.)`)
    : `\n\n(GM: ${c.character.name} does exactly what I wrote above and nothing more. Don't give ${c.character.name}${isMP(c) && c.players.length > 1 ? ' or the other player characters' : ''} any other actions, words, thoughts or feelings. Show how the world and the other characters respond in one short beat, then stop.)`;
  else if (lastMsg && lastMsg.role === 'roll' && !comp) out[out.length - 1].content += `\n\n(GM: the dice have decided. In ONE scene, show ${c.character.name}'s attempt exactly as the player described it, how it turns out according to the dice, and how the world and the other characters react. Don't give ${c.character.name} any extra actions, words, thoughts or feelings. Then stop.)`;
  out[out.length - 1].content += REPLY_NOTE;
  return out;
}

