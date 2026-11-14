'use strict';
/* ---------- session zero ---------- */
async function session0Say(text) {
  const c = cur(); if (!c || S.asking || S.building) return;
  if (!textReady()) { toast('Set up your Story AI first.'); return; }
  c.session0 = arr(c.session0);
  if (text) c.session0.push({ role:'you', text, t: Date.now() });
  S.asking = true; renderLog(true); renderDock();
  const sys = personaText(c) + `\n\nSESSION ZERO. The campaign hasn't started yet. If rules come up, describe ONLY this app's real system (never invent another one, like dice pools): when an action is uncertain the player rolls one d20, adds their stat bonus and any trait bonuses, and must meet or beat a difficulty (DC); a natural 20 is a critical success and a natural 1 a critical failure; in fights, successes build Momentum (spend it for +3 or a reroll); playing into a flaw earns EP, and EP and TP raise stats and traits when leveling up. The app handles all the math. You are getting to know your player and what they want, like a real GM at a session-zero chat. Be warm and curious, in your persona's voice. Ask one or two questions at a time and react to the answers like a person would.\nOver the conversation, cover: what they want more and less of (combat, mystery, intrigue, romance, exploration, horror, humor); anything to keep out of the game; their character's goals, fears, secrets and the people they care about; how the character fits into this world; what kind of companions they'd enjoy travelling with; how dark or light the game should feel.\nBuild on what you already know (below). Never start the story or narrate scenes. Once you have enough (usually after 5-10 exchanges), tell them they can press "I'm ready" whenever they like.\n\nCAMPAIGN\nTitle: ${c.title}\nGenre: ${c.genre}\nPremise: ${c.premise}\nTone: ${c.tone}\nContent rating: ${c.rating}${c.world ? '\nWorld:\n' + c.world : ''}\n\nPLAYER CHARACTER\n${sheetText(c)}`;
  const hist = c.session0.filter(m => !m.err).slice(-24).map(m => ({ role: m.role === 'gm' ? 'assistant' : 'user', content: m.text }));
  if (!hist.length) hist.push({ role:'user', content:'(The player has just sat down for session zero. Greet them warmly in your persona and ask your first question.)' });
  else if (hist[hist.length - 1].role !== 'user') hist.push({ role:'user', content:'(continue)' });
  try { const t = stripThink(await chat([{ role:'system', content: sys }, ...hist], { build:true, stream:false, maxTokens:500, temperature:0.75 })).trim(); c.session0.push({ role:'gm', text: t || '…', t: Date.now() }); }
  catch (e) { c.session0.push({ role:'gm', text: '(Couldn\'t reach the GM: ' + e.message + ')', err: true, t: Date.now() }); }
  finally { S.asking = false; touch(c); if (cur() === c) { renderLog(true); renderDock(); } scheduleSync(); }
}
async function finishSession0() {
  const c = cur(); if (!c || S.asking || S.building) return;
  S.building = true; renderLog(true); renderDock();
  const talk = arr(c.session0).filter(m => !m.err).map(m => `${m.role === 'gm' ? 'GM' : 'PLAYER'}: ${m.text}`).join('\n\n');
  let ok = false;
  try {
    const raw = await chat([
      { role:'system', content: `You prepare a tabletop RPG campaign from a session-zero conversation. Use everything the player said: their wishes, limits, character goals, fears and relationships. Never decide what the player character does or feels. Reply with JSON only:\n{"premise":"the opening situation and hook, built from the conversation","roadmap":"the plot in 3-5 acts: each act as a line \"Act 1: Short title | goal\" followed by 3-4 lines starting \"- \" with beats (things that can happen in the world, never the player character's decisions)","world":"- 8-14 bullet lines: key places, factions, notable NPCs with motives, how magic or technology works, current tensions","secrets":"- 3-5 bullet lines of hidden truths, tied to the character where possible","plan":"3-5 sentences of hidden campaign direction: acts, likely twists, how the story will test the character's goals and fears","threats":[{"name":"","max":6,"effect":"what happens when it fills"}],"factions":[{"name":"","desc":""}],"time":{"part":"evening","weather":"light rain"},"requests":["standing requests: what the player wants more or less of, and what to keep out"],"memory":["key facts about the character's relationships, goals and promises"],"companions":[ONLY if the player wants travelling companions: 0-3 cards, each like ${COMP_SPEC}]}` },
      { role:'user', content: `CAMPAIGN SO FAR\nTitle: ${c.title}\nGenre: ${c.genre}\nPremise: ${c.premise}\nTone: ${c.tone}${c.world ? '\nWorld:\n' + c.world : ''}\n\nPLAYER CHARACTER\n${sheetText(c)}\n\nSESSION ZERO CONVERSATION\n${talk || '(the player skipped the conversation)'}` }
    ], { build:true, stream:false, maxTokens:4000, temperature:0.7, json:true });
    let j = tryJSON(stripThink(raw));
    if (!j) {   /* one more try on your own AI, asking strictly for JSON */
      try { j = tryJSON(stripThink(await chat([{ role:'system', content:'Turn these campaign notes into valid JSON with the keys premise, world, secrets, plan, roadmap, threats, factions, time, requests, memory, companions, opening. Reply with the JSON object only.' }, { role:'user', content: String(raw || '').slice(0, 12000) }], { stream:false, maxTokens:3000, temperature:0.2, json:true }))); } catch {}
    }
    if (!j) { j = {}; toast('The GM\'s extra notes couldn\'t be read, so the adventure starts from your campaign setup.', 6000); }
    worldOf(c);
    if (j.premise) c.premise = String(j.premise).slice(0, 1500);
    if (j.world) c.world = toList(j.world).slice(0, 3500);
    if (j.secrets) c.secrets = toList(j.secrets).slice(0, 2000);
    if (j.plan) c.plan = String(j.plan).slice(0, 2000);
    if (j.roadmap && !c.roadmap) { c.roadmap = String(Array.isArray(j.roadmap) ? j.roadmap.join('\n') : j.roadmap).slice(0, 3000); c.rmAct = 0; c.rmDone = []; }
    addThreats(c, j.threats); addFactions(c, j.factions);
    const tp = String(j.time?.part || '').toLowerCase(); if (TIME_PARTS.includes(tp)) c.time.part = tp;
    if (j.time?.weather) c.time.weather = String(j.time.weather).slice(0, 40);
    const reqs = arr(j.requests).map(String).filter(Boolean); if (reqs.length) c.gmNotes = [c.gmNotes, ...reqs].filter(Boolean).join('\n');
    for (const m of arr(j.memory)) { const f = String(m).trim(); if (f && !c.memory.includes(f)) c.memory.push(f); }
    c.party = arr(c.party); for (const x of arr(j.companions).slice(0, 3)) { const p = normComp(x, 'ai'); if (x?.name && !findByName(c.party, p.name)) c.party.push(p); }
    c.phase = 'play'; touch(c); ok = true;
  } catch (e) { toast(e.message, 6000); }
  finally { S.building = false; }
  if (ok) { renderGame(); scheduleSync(); gmTurn(); } else if (cur() === c) { renderLog(true); renderDock(); }
}
function session0LogHTML(c) {
  const g = gmOf(c);
  return `<div class="msg"><div class="card recap"><div class="h">Session zero with ${esc(g.name)}</div><div class="hint" style="color:var(--ink)">Before the story starts, talk with your GM about what you want from this campaign. When you're done, press <b>I'm ready</b> and ${esc(g.name)} builds the world, a hidden plan and your opening scene from this conversation.</div></div></div>
    <div class="talk">${arr(c.session0).map(m => `<div class="tt ${m.role}"><b>${m.role === 'gm' ? esc(g.name) : 'You'}</b><div>${md(m.text)}</div></div>`).join('')}
    ${S.asking ? `<div class="tt gm"><b>${esc(g.name)}</b><div class="row"><span class="spin sm"></span> <span class="hint" style="margin:0">thinking…</span></div></div>` : ''}
    ${S.building ? `<div class="tt gm"><b>${esc(g.name)}</b><div class="row"><span class="spin sm"></span> <span class="hint" style="margin:0">building your world, the hidden plan and the opening scene…</span></div></div>` : ''}</div>`;
}
function session0DockHTML(c) {
  const busy = S.asking || S.building;
  return `<div class="row" style="margin-bottom:8px"><button class="btn gold grow" data-act="s0ready" ${busy ? 'disabled' : ''}>${icon('spark')} I'm ready — start the adventure</button></div>
    <div class="composer"><textarea id="input" rows="1" placeholder="Answer ${esc(gmOf(c).name)}…" ${busy ? 'disabled' : ''}></textarea><button class="sendbtn" data-act="s0send" ${busy ? 'disabled' : ''} aria-label="Send">${icon('send')}</button></div>`;
}

/* =========================================================================
   Release 3 — the party: companions, orders, their own dice, independent
   turns, camp scenes, death options
   ========================================================================= */
const COMP_SPEC = '{"name":"","sex":"male|female","role":"","personality":"","voice":"how they talk","goals":"","appearance":"one vivid sentence","secrets":"1-2 hidden truths","stats":{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10},"traits":[{"name":"","polarity":"+","tier":"C","trigger":"","effects":[""]}],"trust":1}';
function normComp(x, madeBy = 'ai') {
  x = x && typeof x === 'object' ? x : { name: String(x || '') };
  const stats = {}; for (const k of STATS) stats[k] = clamp(num(x.stats?.[k]) || 10, 3, 20);
  const maxHp = Math.max(4, num(x.maxHp) || num(x.hp) || (10 + mod(stats.CON)));
  const txt = (v, n) => String(Array.isArray(v) ? v.join('; ') : (v || '')).trim().slice(0, n);
  return { id: x.id || uid(), name: txt(x.name, 40) || 'Companion', sex: /^\s*f/i.test(x.sex || x.gender || '') ? 'female' : /^\s*m/i.test(x.sex || x.gender || '') ? 'male' : '', pronouns: txt(x.pronouns, 20), role: txt(x.role || x.story_role, 60),
    personality: txt(x.personality, 300), voice: txt(x.voice || x.speech, 160), goals: txt(x.goals || x.goal, 240), appearance: txt(x.appearance, 300), secrets: txt(x.secrets || x.secret, 400),
    stats, traits: arr(x.traits).map(t => normTrait(t)).filter(t => t.name !== 'Unnamed trait').slice(0, 6), hp: Math.min(maxHp, num(x.hp) || maxHp), maxHp, level: Math.max(1, num(x.level) || 1),
    trust: clamp(num(x.trust), -5, 5), status: ['active','left','dead'].includes(x.status) ? x.status : 'active', madeBy: x.madeBy || madeBy,
    revealed: x.revealed ?? (madeBy === 'player'), ttsVoice: x.ttsVoice || '', portrait: x.portrait || null };
}
const activeParty = c => arr(c.party).filter(p => p.status === 'active');
function partyText(c, withSecrets) {
  const act = activeParty(c);
  const gone = arr(c.party).filter(p => p.status !== 'active').map(p => `${p.name} (${p.status === 'dead' ? 'dead' : 'left the party'})`);
  const lines = act.map(p => `- ${p.name}${gWord(p)}, ${p.role || 'companion'}, level ${p.level}, HP ${p.hp}/${p.maxHp}, trust in the player ${fmt(p.trust)} (-5 hostile to +5 devoted). Personality: ${p.personality || '—'}. Voice: ${p.voice || '—'}. Goals: ${p.goals || '—'}. Stats: ${STATS.map(k => k + ' ' + p.stats[k]).join(' ')}. Traits: ${p.traits.map(t => `${t.polarity}${t.name} [${t.tier}]`).join(', ') || 'none'}.${withSecrets && p.secrets ? ' THEIR SECRET (GM only): ' + p.secrets : ''}`);
  if (gone.length) lines.push(`Former companions: ${gone.join(', ')}.`);
  return lines.join('\n');
}
function rollForCompanion(p, q) {
  const stat = normStat(q?.stat); const dc = clamp(num(q?.dc) || 12, 2, 40); const roll = d(20); const m = mod(p.stats[stat]); const total = roll + m;
  const out = roll === 20 ? 'CRITICAL SUCCESS' : total >= dc + 10 ? 'OVERWHELMING SUCCESS' : total >= dc ? (roll === 1 ? 'SUCCESS (natural 1, complication)' : 'SUCCESS') : total <= dc - 10 ? 'DISASTER' : 'FAILURE';
  return { d: roll, line: `${p.name}'s ${SN(stat)} check to ${String(q?.reason || 'act').slice(0, 100)} (DC ${dc}): rolled ${roll} ${fmt(m)} = ${total} → ${out}`, ok: roll === 20 || total >= dc };
}
/* party changes from the GM's state block */
function applyParty(c, st, msg, notes) {
  c.party = arr(c.party);
  if (isMP(c)) for (const u of arr(st.others_hp)) {
    const p = c.players.find(x => x !== c.character && x.name.toLowerCase() === String(u?.name || '').toLowerCase()); const ch = num(u?.change);
    if (p && ch) { p.hp = clamp(p.hp + ch, 0, p.maxHp); notes.push({ t:`${p.name} ${fmt(ch)} HP`, k: ch < 0 ? 'bad' : 'good' }); }
  }
  for (const x of arr(st.new_companions)) {
    const p = normComp(x, 'ai'); if (findByName(c.party, p.name)) continue;
    c.party.push(p); notes.push({ t:`${p.name} joined the party`, k:'good' }); if (autoPortraitsOn()) portraitFor(c, p.id, true);
  }
  for (const u of arr(st.companion_updates)) {
    const p = findByName(c.party, u?.name); if (!p) continue;
    const tr = clamp(num(u.trust), -2, 2); if (tr) { p.trust = clamp(p.trust + tr, -5, 5); notes.push({ t:`${p.name} trust ${fmt(tr)}`, k: tr < 0 ? 'bad' : 'good' }); }
    const hp = num(u.hp_change); if (hp) { p.hp = clamp(p.hp + hp, 0, p.maxHp); notes.push({ t:`${p.name} ${fmt(hp)} HP`, k: hp < 0 ? 'bad' : 'good' }); }
    if (['left','dead','active'].includes(u.status) && u.status !== p.status) { p.status = u.status; notes.push({ t: u.status === 'dead' ? `${p.name} has died` : u.status === 'left' ? `${p.name} left the party` : `${p.name} rejoined`, k: u.status === 'active' ? 'good' : 'bad' }); }
  }
  const rolls = [];
  for (const q of arr(st.companion_checks).slice(0, 4)) { const p = findByName(activeParty(c), q?.name); if (p) rolls.push(rollForCompanion(p, q)); }
  if (rolls.length) msg.compRolls = rolls;
  msg.compTurns = arr(st.companion_turns).map(n => findByName(activeParty(c), typeof n === 'object' ? n?.name : n)).filter(Boolean).slice(0, 2).map(p => p.id);
  if (st.player_dead === true && c.character.hp <= 0) { c.deathPending = true; notes.push({ t:`${c.character.name} has fallen`, k:'bad' }); }
}
async function companionTurn(c, p, signal) {
  const recent = storyLines(c, 5);
  const raw = await chat([
    { role:'system', content:`You are ${p.name}${gWord(p)}, a companion travelling with ${c.character.name} in a tabletop roleplaying game. You are NOT the Game Master. Role: ${p.role}. Personality: ${p.personality}. How you talk: ${p.voice}. Your goals: ${p.goals}. Your own secret, which you guard: ${p.secrets || 'none'}. Your trust in ${c.character.name}: ${fmt(p.trust)} (-5 hostile to +5 devoted). Your HP: ${p.hp}/${p.maxHp}.\nDecide what YOU do or say right now, true to your personality, goals and trust. You may disagree with or refuse ${c.character.name}. Write 1-3 sentences: short action in third person plus your words in quotes, e.g. ${p.name} steps forward: "Not today." Never control ${c.character.name} or other companions and never narrate outcomes. Output only that.` },
    { role:'user', content:`WHAT JUST HAPPENED:\n${recent}` }
  ], { stream:false, signal, maxTokens:220, temperature:0.85 });
  const t = stripThink(raw).trim().replace(/<state>[\s\S]*$/i, '').trim();
  if (t) c.messages.push({ id: uid(), role:'comp', compId: p.id, name: p.name, text: t.slice(0, 700), t: Date.now() });
}
async function makeCompanion(concept, madeBy) {
  const c = cur(); if (!c) return;
  S.compBusy = true; renderModal();
  try {
    const raw = await chat([
      { role:'system', content:`You create a companion character for a solo tabletop RPG party. Fit the setting and the player's request. Stats 8-18 (three or four above 10). 2-4 traits from tier D to B, at least one negative ("polarity":"-"), each with a trigger and story effects. Give them goals of their own and 1-2 secrets that could matter later. Reply with JSON only: ${COMP_SPEC}` },
      { role:'user', content:`SETTING: ${c.title}. ${c.genre}. ${c.premise}${c.world ? '\nWORLD:\n' + c.world : ''}\n\nPLAYER CHARACTER: ${c.character.name}, ${c.character.storyRole}\n\nCOMPANION REQUEST: ${concept}` }
    ], { build:true, stream:false, maxTokens:1800, temperature:0.85, json:true });
    const j = tryJSON(stripThink(raw)); if (!j || !j.name) throw new Error('The GM\'s reply wasn\'t a usable companion. Try again.');
    const p = normComp(j, madeBy); c.party = arr(c.party); c.party.push(p); if (autoPortraitsOn()) portraitFor(c, p.id, true);
    c.messages.push({ id: uid(), role:'sys', text:`${p.name} is ready to join the party. The GM will bring them in.` });
    c.gmNotes = [c.gmNotes, `Introduce ${p.name} into the story soon as a new companion.`].filter(Boolean).join('\n');
    touch(c); scheduleSync(); toast(`${p.name} created${madeBy === 'ai' ? ' (card hidden until you reveal it)' : ''}.`, 4000);
  } catch (e) { toast(e.message, 5000); }
  finally { S.compBusy = false; S.compForm = null; renderModal(); }
}
function compCardHTML(c, p) {
  const hidden = !p.revealed;
  const port = p.portrait ? `<img class="port" src="${esc(imageUrl(p.portrait, c))}" alt="">` : `<div class="port ph2">${esc(p.name[0] || '?')}</div>`;
  const status = p.status === 'active' ? `<span class="pill" style="color:${p.trust > 0 ? 'var(--green)' : p.trust < 0 ? 'var(--red)' : 'var(--muted)'}">${isCompanion(c) ? 'Closeness' : 'Trust'} ${fmt(p.trust)}</span>` : `<span class="note bad">${p.status === 'dead' ? 'Dead' : 'Left'}</span>`;
  const voices = voiceOn() ? `<label class="f"><span>Voice</span>${voicePickerHTML(`data-pvoice="${p.id}"`, engine() === 'pc' ? p.vPC : (p.vDev || p.ttsVoice), genderOf(p))}</label>` : '';
  return `<div class="ccard ${p.status !== 'active' ? 'gone' : ''}"><div class="row">${port}<div class="grow"><b style="font-size:17px">${esc(p.name)}</b><div class="hint" style="margin:0">${esc(p.role || 'Companion')}${p.status === 'active' && !isCompanion(c) ? ` · Lv ${p.level} · ${p.hp}/${p.maxHp} HP` : ''}</div></div>${status}</div>
    ${hidden ? `<p class="hint">The GM made ${esc(p.name)}. Their full card and secrets are hidden so the story can surprise you.</p><button class="btn sm" data-act="compreveal" data-id="${p.id}">Reveal full card (spoilers)</button>`
      : `<div class="hint" style="color:var(--ink);margin-top:8px">${esc(p.personality)}${p.voice ? `<br><i>Talks: ${esc(p.voice)}</i>` : ''}${p.goals ? `<br>Wants: ${esc(p.goals)}` : ''}</div>
      ${isCompanion(c) ? '' : `<div class="statline">${STATS.map(k => `<span><b>${SN(k)}</b> ${p.stats[k]}</span>`).join('')}</div>`}
      ${p.traits.length ? `<div class="chips" style="margin-top:6px">${p.traits.map(t => `<span class="chip" style="font-size:12.5px;padding:5px 10px">${t.polarity === '-' ? '−' : '+'} ${esc(t.name)} <span class="tb ${t.tier}">${t.tier}</span></span>`).join('')}</div>` : ''}
      ${p.directive ? `<div class="hint" style="margin-top:4px">Replies: ${esc(p.directive)}</div>` : ''}
      ${p.secrets ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer">Secret${p.madeBy === 'ai' ? ' (spoiler)' : ''}</summary><p class="hint" style="color:var(--ink)">${esc(p.secrets)}</p></details>` : ''}
      ${S.compEdit === p.id ? `<div class="card" style="margin-top:8px">${[['name','Name'],['role','Role'],['personality','Personality',3],['voice','How they talk'],['directive','Response style (e.g. short flirty texts, lots of teasing; formal, never uses slang)',2],['goals','What they want'],['appearance','Appearance (for portraits and photos)',2],['secrets','Secrets',2]].map(([k, l, r]) => r ? `<label class="f"><span>${l}</span><textarea rows="${r}" data-pedit="${p.id}" data-k="${k}">${esc(p[k] || '')}</textarea></label>` : `<label class="f"><span>${l}</span><input type="text" data-pedit="${p.id}" data-k="${k}" value="${esc(p[k] || '')}"></label>`).join('')}<button class="btn sm" data-act="compeditdone" style="margin-top:8px">Done</button></div>` : ''}`}
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="compportrait" data-id="${p.id}">${icon('image')} Portrait</button>${!hidden ? `<button class="btn sm ghost" data-act="compedit" data-id="${p.id}">${icon('book')} Edit</button>` : ''}${p.status === 'active' ? `<button class="btn sm ghost" data-act="comptalk" data-id="${p.id}">Talk to ${esc(p.name.split(' ')[0])}</button>` : ''}<button class="iconbtn sm" data-act="compdel" data-id="${p.id}" aria-label="Remove">${icon('trash')}</button></div>
    ${voices}</div>`;
}
function partyHTML() {
  const c = cur(); const list = arr(c.party); const f = S.compForm;
  let form = '';
  if (S.compBusy) form = `<div class="card row"><span class="spin sm"></span> The GM is creating your companion…</div>`;
  else if (f === 'ai') form = `<div class="card"><b>Describe a companion</b><textarea id="compConcept" rows="3" style="margin-top:8px" placeholder="A loyal but reckless half-orc bodyguard who owes my family a debt…"></textarea><div class="row" style="margin-top:8px"><button class="btn sm gold" data-act="compmake" data-by="ai">GM builds it (card hidden)</button><button class="btn sm" data-act="compmake" data-by="player">Build it, show me everything</button><button class="link" data-act="compcancel">Cancel</button></div></div>`;
  else if (f === 'manual') form = `<div class="card"><b>Write your own companion</b>${['name:Name','role:Role (guard, scholar, thief…)','personality:Personality','voice:How they talk','goals:What they want','appearance:Appearance','secrets:Their secret (optional)'].map(x => { const [k, l] = x.split(':'); return `<label class="f"><span>${l}</span><input type="text" id="cm_${k}"></label>`; }).join('')}<div class="row" style="margin-top:10px"><button class="btn sm gold" data-act="compsave">Add to party</button><button class="link" data-act="compcancel">Cancel</button></div></div>`;
  else form = `<div class="row"><button class="btn sm gold" data-act="compform" data-f="ai">${icon('spark')} Create a companion</button><button class="btn sm" data-act="compform" data-f="manual">${icon('plus')} Write one myself</button></div>`;
  return `<p class="hint">${isCompanion(c) ? 'Your cast: the characters who share this story with you. They talk, act and remember on their own. Add as many as you like; the narrator can also bring new people in.' : 'Companions act on their own and follow your orders ("Mara, guard the door") depending on how much they trust you. The GM can also bring new companions into the story.'}</p>${form}
    <div style="margin-top:10px">${list.length ? list.map(p => compCardHTML(c, p)).join('') : '<p class="empty" style="font-size:18px">No companions yet.</p>'}</div>`;
}
/* ---------- death ---------- */
function deathDockHTML(c) {
  const comps = activeParty(c);
  return `<div class="card" style="border-color:#6a3328;background:#2a1713"><div style="font-family:var(--display);font-size:24px;font-weight:700;color:#f3b3a5">${esc(c.character.name)} has fallen.</div><p class="hint" style="color:var(--ink)">How does the story go on?</p>
    <div class="deathopts">${comps.length ? comps.map(p => `<button class="btn" data-act="deathcomp" data-id="${p.id}">Continue as ${esc(p.name)}</button>`).join('') : ''}
    <button class="btn" data-act="deathnew">Bring in a new character</button><button class="btn" data-act="deathend">End the story (epilogue)</button>${arr(c.saves).length ? '<button class="btn ghost" data-act="tools" data-tab="saves">Load a save</button>' : ''}</div></div>`;
}
function continueAsCompanion(id) {
  const c = cur(); const p = arr(c.party).find(x => x.id === id); if (!c || !p) return;
  const old = c.character; worldOf(c);
  c.fallen = arr(c.fallen).concat([{ name: old.name, day: c.time.day }]);
  c.character = { name: p.name, sex: p.sex, pronouns: p.pronouns, storyRole: p.role, appearance: p.appearance, backstory: [p.personality, p.goals && 'Goals: ' + p.goals, p.secrets && 'Secret: ' + p.secrets].filter(Boolean).join(' '),
    stats: { ...p.stats }, level: p.level, hp: Math.max(1, p.hp), maxHp: p.maxHp, ep: 0, tp: 0, gold: 0, traits: p.traits, gear: [], signatures: [], injuries: [], momentum: 0, strain: 0, portrait: p.portrait };
  c.party = c.party.filter(x => x !== p); c.deathPending = false;
  c.messages.push({ id: uid(), role:'sys', text:`You now play ${p.name}. ${old.name} is remembered.` });
  c.messages.push({ id: uid(), role:'player', hidden:true, t: Date.now(), text:`(${old.name} is dead. The player now plays ${p.name}. Continue the story from ${p.name}'s point of view, right where it stands. Describe only what ${p.name} perceives; they do not act yet.)` });
  touch(c); renderGame(); gmTurn();
}
function newCharacterAfterDeath() {
  const c = cur(); if (!c) return;
  const D = newDraft(SCENARIOS.find(s => s.id === 'custom'));
  Object.assign(D, { title: c.title, genre: c.genre, premise: c.premise, tone: c.tone, art: c.artStyle, rating: c.rating, magicCost: c.magicCost, world: c.world, secrets: c.secrets, scenario:'custom' });
  S.draft = D; S.replacing = c.id; renderNew(); toast('Build your new character, then tap Begin.', 4000);
}
async function endWithEpilogue() {
  const c = cur(); if (!c || S.busy) return;
  S.busy = true; renderDock();
  try {
    const t = stripThink(await chat([
      { role:'system', content: personaText(c) + `\nThe player character ${c.character.name} has died and the player chose to end the campaign. Write an epilogue in your voice, 2-4 short paragraphs: how ${c.character.name} is remembered, what became of the companions, the factions and the threats they left behind, and one last image. Do not invent a resurrection.` },
      { role:'user', content: worldBrief(c) + '\n\nPARTY:\n' + partyText(c, false) }
    ], { stream:false, maxTokens:900, temperature:0.8 })).trim();
    c.messages.push({ id: uid(), role:'gm', text: t || 'And so the tale ends.', epilogue: true, t: Date.now() });
    c.deathPending = false; c.ended = true; touch(c); scheduleSync();
  } catch (e) { toast('Epilogue failed: ' + e.message, 5000); }
  finally { S.busy = false; renderGame(); }
}

/* =========================================================================
   Release 4 — keepsakes: gallery, codex, map, diary, handouts, voice,
   storybook export
   ========================================================================= */
function addGallery(c, item) {
  c.gallery = arr(c.gallery);
  const name = String(item.name || 'Scene').slice(0, 80);
  const ex = c.gallery.find(g => g.kind === item.kind && g.name.toLowerCase() === name.toLowerCase());
  if (ex && item.kind === 'place') return ex;
  const g = { id: uid(), kind: item.kind || 'place', name, prompt: item.prompt, seed: item.seed || d(999999), day: worldOf(c).time.day, t: Date.now() };
  c.gallery.unshift(g); if (c.gallery.length > 80) c.gallery = c.gallery.slice(0, 80);
  return g;
}
const portraitPrompt = (look, role) => `portrait of ${look}${role ? ', ' + role : ''}, head and shoulders, expressive face, detailed`.replace(/\s+/g, ' ').slice(0, 420);
/* start painting right away on the PC (scene pictures are painted when shown; portraits shouldn't wait for you to open a menu) */
function warmImage(g, c) { if (S.settings.image.mode === 'local') imageUrl(g, c); }
const autoPortraitsOn = () => S.settings.image.mode !== 'off' && S.settings.image.autoPortraits !== false;
function portraitFor(c, who, quiet) {
  if (S.settings.image.mode === 'off') { if (!quiet) toast('Pictures are off in Settings → Images.'); return; }
  const isMain = who === 'main'; const p = isMain ? c.character : arr(c.party).find(x => x.id === who); if (!p) return;
  const g = { id: uid(), kind:'character', name: p.name, prompt: portraitPrompt(p.appearance || p.name, p.role || p.storyRole), seed: d(999999), day: worldOf(c).time.day, t: Date.now() };
  c.gallery = arr(c.gallery); c.gallery.unshift(g);
  p.portrait = { prompt: g.prompt, seed: g.seed }; touch(c); scheduleSync(); warmImage(g, c);
  if (!quiet) toast(`Painting ${p.name}'s portrait… it appears on their card and in Journal → Gallery.`, 4000);
}
function applyKeepsakes(c, st, msg, notes) {
  c.codex = arr(c.codex); c.handouts = arr(c.handouts); c.places = arr(c.places);
  const met = []; upsertPeople(c, st.people, met); for (const n of met) { notes.push({ t:'👤 ' + n, k:'' }); if (autoPortraitsOn()) npcPortrait(c, n, true); }
  if (met.length) msg.lookups = [...arr(msg.lookups), ...met];
  for (const x of arr(st.codex).slice(0, 6)) {
    const name = String(x?.name || '').trim().slice(0, 60); const text = String(x?.text || '').trim().slice(0, 500); if (!name || !text) continue;
    const kind = ['person','place','creature','lore','item'].includes(x.kind) ? x.kind : 'lore';
    const ex = findByName(c.codex, name);
    if (ex) { if (!ex.text.includes(text)) ex.text = (ex.text + ' ' + text).slice(-900); ex.kind = kind; }
    else { c.codex.push({ name, kind, text, day: worldOf(c).time.day }); notes.push({ t:'📖 Codex: ' + name, k:'' }); msg.lookups = [...arr(msg.lookups), name]; }
  }
  const h = st.handout;
  if (h && typeof h === 'object' && String(h.text || '').trim()) {
    const ho = { id: uid(), title: String(h.title || 'A document').slice(0, 80), kind: String(h.kind || 'note').slice(0, 20), text: String(h.text).slice(0, 2500), day: worldOf(c).time.day };
    c.handouts.unshift(ho); msg.handoutId = ho.id; notes.push({ t:'✉ Handout: ' + ho.title, k:'gold' });
  }
}
function trackPlace(c, prev, next) {
  if (!next) return; c.places = arr(c.places);
  let p = findByName(c.places, next); if (!p) { p = { name: next, links: [], day: worldOf(c).time.day }; c.places.push(p); }
  const q = prev && prev !== next ? findByName(c.places, prev) : null;
  if (q) { if (!q.links.includes(p.name)) q.links.push(p.name); if (!p.links.includes(q.name)) p.links.push(q.name); }
}
function mapSVG(c) {
  const ps = arr(c.places); if (!ps.length) return '<p class="empty" style="font-size:18px">Places you visit appear here.</p>';
  const W = 600, H = Math.max(320, 140 + ps.length * 22);
  const pos = ps.map((p, i) => { const a = i * 2.399963; const r = 40 + 26 * Math.sqrt(i); return { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a) }; });
  const idx = n => ps.findIndex(p => p.name === n);
  for (let it = 0; it < 220; it++) {
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y; const dist = Math.max(8, Math.hypot(dx, dy)); const f = 2600 / (dist * dist);
      pos[i].x -= f * dx / dist; pos[i].y -= f * dy / dist; pos[j].x += f * dx / dist; pos[j].y += f * dy / dist;
    }
    ps.forEach((p, i) => p.links.forEach(n => { const j = idx(n); if (j < 0) return; const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y; const dist = Math.hypot(dx, dy) || 1; const f = (dist - 110) * 0.02; pos[i].x += f * dx / dist; pos[i].y += f * dy / dist; }));
    pos.forEach(q => { q.x += (W / 2 - q.x) * 0.01; q.y += (H / 2 - q.y) * 0.01; q.x = clamp(q.x, 70, W - 70); q.y = clamp(q.y, 30, H - 30); });
  }
  const here = (c.location || '').toLowerCase();
  const lines = []; ps.forEach((p, i) => p.links.forEach(n => { const j = idx(n); if (j > i) lines.push(`<line x1="${pos[i].x}" y1="${pos[i].y}" x2="${pos[j].x}" y2="${pos[j].y}" stroke="#5b4b33" stroke-width="2" stroke-dasharray="5 5"/>`); }));
  const nodes = ps.map((p, i) => { const on = p.name.toLowerCase() === here; return `<g><circle cx="${pos[i].x}" cy="${pos[i].y}" r="${on ? 11 : 8}" fill="${on ? '#f0c56a' : '#a3977f'}" stroke="#13110f" stroke-width="2"/><text x="${pos[i].x}" y="${pos[i].y - 13}" text-anchor="middle" font-size="18" font-weight="600" fill="${on ? '#f0c56a' : '#ede4d1'}" font-family="sans-serif">${esc(p.name.length > 26 ? p.name.slice(0, 25) + '…' : p.name)}</text></g>`; });
  return `<svg viewBox="0 0 ${W} ${H}" class="mapsvg" role="img" aria-label="Map of places visited">${lines.join('')}${nodes.join('')}</svg><p class="hint">Gold = where you are now. Lines connect places you've travelled between.</p>`;
}
async function writeDiary(c) {
  if (!c || S.diaryBusy) return; S.diaryBusy = true; renderModal();
  try {
    const ch = c.character;
    const t = stripThink(await chat([
      { role:'system', content:`Write a short diary entry in the voice of ${ch.name}, the player character, first person, 120-200 words. Base it only on what ${ch.name} actually did and said in the recent scenes; keep any feelings modest and grounded in their actions. Background: ${ch.backstory || ch.storyRole || ''}. Output only the entry, starting with the in-world day.` },
      { role:'user', content:`TIME: ${timeLabel(worldOf(c))}\nSTORY SO FAR:\n${c.summary || ''}\n\nRECENT SCENES:\n${storyLines(c, 10)}` }
    ], { stream:false, maxTokens:450, temperature:0.75 })).trim();
    if (t) { c.diary = arr(c.diary); c.diary.unshift({ day: c.time.day, text: t, t: Date.now() }); touch(c); scheduleSync(); }
  } catch (e) { toast('Diary failed: ' + e.message, 5000); }
  finally { S.diaryBusy = false; renderModal(); }
}
function handoutHTML(h) { return `<div class="handout ${esc(h.kind)}"><div class="ht">${esc(h.title)}</div><div class="hb">${esc(h.text).replace(/\n/g, '<br>')}</div></div>`; }
function journalBookHTML() {
  const c = cur(); worldOf(c);
  const tab = ['quests','codex','map','handouts','diary','gallery','factions'].includes(S.modalTab) ? S.modalTab : 'quests';
  const tabs = ['quests:Quests','codex:Codex','map:Map','factions:Factions','handouts:Handouts','diary:Diary','gallery:Gallery'].map(x => { const [k, l] = x.split(':'); return tabBtn(k, l, tab); }).join('');
  let body = '';
  if (tab === 'quests') { const keep = S.modalTab; S.modalTab = 'quests'; body = journalHTML()[1]; S.modalTab = keep; }
  else if (tab === 'codex') {
    const q = (S.codexQ || '').toLowerCase(); const kind = S.codexKind || '';
    const list = arr(c.codex).filter(e => (!kind || e.kind === kind) && (!q || (e.name + ' ' + e.text).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    body = `<input type="text" id="codexQ" placeholder="Search the codex…" value="${esc(S.codexQ || '')}" style="margin-top:10px">
      <div class="chips" style="margin-top:8px">${['', 'person', 'place', 'creature', 'lore', 'item'].map(k => `<button class="chip ${kind === k ? 'on' : ''}" data-act="codexkind" data-k="${k}">${({ '':'All', person:'People', place:'Places', creature:'Creatures', lore:'Lore', item:'Items' })[k]}</button>`).join('')}</div>
      ${list.length ? list.map(e => { const g = arr(c.gallery).find(x => x.name.toLowerCase() === e.name.toLowerCase()); return `<div class="quest">${g ? `<img class="port sm" src="${esc(imageUrl(g, c))}" alt="">` : ''}<div class="grow"><b>${esc(e.name)}</b> <span class="note">${esc(e.kind)}</span><div class="hint" style="margin:3px 0 0;color:var(--ink)">${esc(e.text)}</div>${e.lore ? `<div class="hint" style="margin:4px 0 0;color:var(--ink)">🔎 ${esc(e.lore)}</div>` : ''}${S.settings.net?.on !== false && !e.lore ? `<button class="link" data-act="npclook" data-n="${esc(e.name)}" style="margin-top:4px">${icon('search')} Look it up</button>` : ''}</div></div>`; }).join('') : '<p class="empty" style="font-size:18px">The GM adds people, places, creatures and lore here as you discover them.</p>'}`;
  }
  else if (tab === 'map') body = mapSVG(c);
  else if (tab === 'factions') body = `<p class="hint">🕯 ${esc(timeLabel(c))}</p>${c.factions.length ? c.factions.map(f => `<div class="quest"><div class="grow"><b>${esc(f.name)}</b>${f.desc ? `<div class="hint" style="margin:2px 0 0">${esc(f.desc)}</div>` : ''}</div><span class="pill" style="color:${f.rep > 0 ? 'var(--green)' : f.rep < 0 ? 'var(--red)' : 'var(--muted)'}">${repLabel(f.rep)} ${fmt(f.rep)}</span></div>`).join('') : '<p class="hint">No factions known yet.</p>'}
      ${c.rumors.length ? `<div class="sect" style="font-size:20px">Rumors you've heard</div>${c.rumors.slice(0, 12).map(r => `<div class="quest"><div class="grow">${esc(r.text)}</div><span class="hint" style="margin:0">day ${r.day}</span></div>`).join('')}` : ''}`;
  else if (tab === 'handouts') body = arr(c.handouts).length ? c.handouts.map(handoutHTML).join('') : '<p class="empty" style="font-size:18px">Letters, posters and pages you find are kept here.</p>';
  else if (tab === 'diary') body = `<button class="btn sm gold" data-act="diarywrite" ${S.diaryBusy ? 'disabled' : ''} style="margin-top:10px">${S.diaryBusy ? '<span class="spin sm"></span> Writing…' : icon('book') + ` Write ${esc(c.character.name)}'s diary entry`}</button><p class="hint">Written in your character's voice from what they did and said recently.</p>
      ${arr(c.diary).map(e => `<div class="handout page"><div class="ht">Day ${e.day}</div><div class="hb">${esc(e.text).replace(/\n/g, '<br>')}</div></div>`).join('')}`;
  else body = `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="compportrait" data-id="main">${icon('image')} Paint ${esc(c.character.name)}'s portrait</button></div>
      ${arr(c.gallery).length ? `<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="galretry">${icon('redo')} Retry missing pictures</button></div><div class="gallery">${c.gallery.map(g => `<div class="gitem"><button class="plain" data-galzoom="${g.id}" title="See it large"><img loading="lazy" src="${esc(imageUrl(g, c))}" alt="" onerror="this.closest('.gitem').classList.add('bad')"></button><div class="gcap">${esc(g.name)}<span>${esc(g.kind)} · day ${g.day}</span></div><div class="row"><button class="iconbtn sm" data-act="galregen" data-id="${g.id}" aria-label="New version">${icon('redo')}</button><button class="iconbtn sm" data-act="galdel" data-id="${g.id}" aria-label="Delete">${icon('trash')}</button></div></div>`).join('')}</div>` : '<p class="empty" style="font-size:18px">Pictures of characters and important places are saved here.</p>'}`;
  return [tabs, body];
}

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
function startMic() {
  if (!SR) return toast('Voice input isn\'t available in this browser.');
  if (S.mic) { try { S.mic.stop(); } catch {} return; }
  const r = new SR(); r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = false;
  const inp = $('#input'); const base = inp ? inp.value : '';
  r.onresult = e => { const t = Array.from(e.results).map(x => x[0].transcript).join(''); const el = $('#input'); if (el) { el.value = (base ? base + ' ' : '') + t; autoGrow(el); } };
  r.onend = () => { S.mic = null; renderDock(); };
  r.onerror = e => { S.mic = null; if (e.error !== 'aborted') toast('Mic: ' + e.error); renderDock(); };
  S.mic = r; r.start(); renderDock();
}

/* ---------- storybook export ---------- */
function exportStorybook(c) {
  const ch = c.character; const g = gmOf(c);
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to open the storybook.');
  const story = c.messages.filter(m => !m.hidden && m.role !== 'err').map(m => {
    if (m.role === 'gm') return `${m.image && S.settings.image.mode !== 'off' ? `<figure><img src="${esc(imageUrl(m.image, c))}" alt=""></figure>` : ''}${md(m.text)}${m.handoutId ? (h => h ? handoutHTML(h) : '')(arr(c.handouts).find(x => x.id === m.handoutId)) : ''}`;
    if (m.role === 'player') return `<p class="act">${esc(ch.name)}: ${esc(m.text.replace(/^\(\(\s*|\s*\)\)$/g, ''))}</p>`;
    if (m.role === 'comp') return `<p class="comp">${esc(m.text)}</p>`;
    if (m.role === 'roll') return `<p class="roll">🎲 ${esc(m.rollData?.lines ? m.rollData.lines.join(' · ') : m.text)}</p>`;
    return `<p class="sys">${esc(m.text)}</p>`;
  }).join('\n');
  const codex = arr(c.codex).sort((a, b) => a.name.localeCompare(b.name)).map(e => `<p><b>${esc(e.name)}</b> <i>(${esc(e.kind)})</i>: ${esc(e.text)}</p>`).join('');
  const party = arr(c.party).map(p => `<p><b>${esc(p.name)}</b>, ${esc(p.role)}${p.status !== 'active' ? ` (${p.status})` : ''}: ${esc(p.personality)}</p>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.title)}</title><style>
    body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:0 auto;padding:24px;color:#2a2118;background:#fbf6ec;line-height:1.65;font-size:17px}
    h1{font-size:44px;text-align:center;margin:60px 0 6px}h2{font-size:26px;border-bottom:1px solid #c9b99a;padding-bottom:4px;margin-top:40px}
    .sub{text-align:center;font-style:italic;color:#6b5a40}figure{margin:18px 0}figure img{width:100%;border-radius:6px}
    .act{font-style:italic;color:#5b4a30;border-left:3px solid #c9a65a;padding-left:10px}.comp{color:#3d4f63}.roll,.sys{font-size:13px;color:#7a6a50;font-family:sans-serif}
    .handout{background:#f1e4c6;border:1px solid #c9b48a;padding:14px 18px;margin:14px 0;font-family:'Courier New',monospace;font-size:14px}.ht{font-weight:bold;margin-bottom:6px}
    .bar{position:sticky;top:0;background:#fbf6ec;padding:8px 0;text-align:right}.bar button{font-size:15px;padding:8px 14px}@media print{.bar{display:none}h1{page-break-before:avoid}h2{page-break-before:always}}
    </style></head><body><div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
    <h1>${esc(c.title)}</h1><p class="sub">The tale of ${esc(ch.name)}${ch.storyRole ? ', ' + esc(ch.storyRole) : ''}<br>as told by ${esc(g.name)}</p>
    ${ch.portrait ? `<figure><img src="${esc(imageUrl(ch.portrait, c))}" alt=""></figure>` : ''}
    <h2>The Story</h2>${story}${party ? '<h2>Companions</h2>' + party : ''}${codex ? '<h2>Codex</h2>' + codex : ''}
    <p class="sub" style="margin-top:50px">Made with Outer Realm</p></body></html>`);
  w.document.close();
}

/* ---------- menu & tools ---------- */
function menuHTML() {
  const c = cur();
  const item = (act, ic, label, sub, extra = '') => `<button class="mitem" data-act="${act}" ${extra}>${icon(ic)}<span><b>${label}</b><small>${sub}</small></span></button>`;
  return `<div class="menu">
    ${isCompanion(c) ? item('sheet', 'person', 'You', 'Your name, look and story') : ''}
    ${item('tools', 'scroll', isCompanion(c) ? 'Story tools' : 'Campaign tools', 'World &amp; secrets, facts, memory, saves, setup')}
    ${item('fixopen', 'spark', 'Fix the story', 'Tell the GM what went wrong')}
    ${item('recap', 'book', 'Previously on…', 'Get a recap of the story so far')}
    ${item('search', 'search', 'Search this story', 'Find a word, a name or a place and jump to it')}
    ${S.settings.net?.on !== false ? item('lookup', 'search', 'Look something up', 'Search the web; the GM remembers what it finds') : ''}
    ${S.settings.image.mode !== 'off' ? `<button class="mitem" data-act="picstoggle">${icon('image')}<span><b>Scene pictures: ${S.settings.image.scenes !== false ? 'On' : 'Off'}</b><small>${S.settings.image.scenes !== false ? 'Tap to stop painting scenes. Portraits, photos and Illustrate still work.' : 'Tap to paint a picture when you reach new places'}</small></span><span class="tog ${S.settings.image.scenes !== false ? 'on' : ''}"></span></button>` : ''}
    ${item('storybook', 'download', 'Storybook', 'Your adventure as an illustrated book (print or PDF)')}
    ${item('sync', 'cloud', 'Sync with Google Drive', esc(S.syncStatus || 'Save to and load from your Drive folder'))}
    ${item('gamesettings', 'gear', 'Game Settings', 'Dice, music, voices, game flow, this story')}
    ${item('settings', 'gear', 'App setup', 'AI connections, pictures, Google Drive')}
    ${item('guide', 'help', 'Rules &amp; guide', 'How everything works')}
  </div>`;
}


function compRollsHTML(m) {
  if (!arr(m.compRolls).length) return '';
  return `<div class="crolls">${m.compRolls.map(r => `<div class="croll"><span class="d20 sm ${r.d === 20 ? 'crit' : r.d === 1 ? 'fumble' : ''}">${r.d}</span><span>${esc(r.line)}</span></div>`).join('')}</div>`;
}
function compMsgHTML(m, c) {
  const p = arr(c.party).find(x => x.id === m.compId);
  const port = p?.portrait ? `<img class="port sm" src="${esc(imageUrl(p.portrait, c))}" alt="">` : `<div class="port sm ph2">${esc((m.name || '?')[0])}</div>`;
  const spk = TTS && S.settings.ui.voice !== 'off' ? `<button class="link" data-act="speak" data-mid="${m.id}" aria-label="Read aloud">${icon('speaker')}</button>` : '';
  const ts = isCompanion(c) && compStyle(c) === 'chat' && m.t ? `<span class="ts">${new Date(m.t).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}</span>` : '';
  return `<div class="msg comp ${isCompanion(c) ? 'cs-' + compStyle(c) : ''}" data-id="${m.id}">${port}<div class="cb"><div class="cn">${esc(m.name)}${spk}${ts}</div>${md(m.text)}${m.image ? sceneHTML(m, c) : ''}</div></div>`;
}
function quickHTML(c) {
  const q = [];
  if (!c.combat) q.push(['We make camp and rest for the night.', '🏕 Make camp']);
  q.push(['I take a careful look around.', '👀 Look around']);
  if (activeParty(c).length) q.push(['I check in with my companions. How is everyone holding up?', '💬 Talk to the party']);
  return `<div class="chips quick">${q.map(([t, l]) => `<button class="chip ghost" data-act="quick" data-q="${esc(t)}">${l}</button>`).join('')}</div>`;
}
function endedDockHTML(c) {
  return `<div class="card recap" style="text-align:center"><div class="h">The End</div><p class="hint" style="color:var(--ink)">${esc(c.character.name)}'s tale is complete.</p>
    <div class="deathopts"><button class="btn gold" data-act="storybook">${icon('download')} Open the storybook</button>${arr(c.saves).length ? '<button class="btn" data-act="tools" data-tab="saves">Load a save</button>' : ''}<button class="btn ghost" data-act="unend">Keep playing anyway</button></div></div>`;
}

/* ---------- People you've met: automatic NPC tracker + quick-access list ---------- */
const PEOPLE_RULES = `You keep the "People" list for a tabletop RPG: the named non-player characters the player has met or heard about.
From the TEXT, list every NAMED person or creature-with-a-name who appears, speaks, or is talked about. Leave out the player character and the party companions listed below. Unnamed people ("a guard", "the innkeeper") are left out unless the text gives a clear title that works as a name ("the Grey Abbess").
For each one write ONE short sentence of what the player character knows: who they are, how they relate to the player, anything important they said or did. If KNOWN PEOPLE already has them, give an updated sentence that keeps the old facts and adds the new. Never reveal hidden GM secrets; only what the player saw or heard.
"where": the place they were seen (short), or "".
"feel": how they feel about the player character: devoted, friendly, neutral, wary or hostile.
"sex": male, female or unknown.
Reply with JSON only: {"people":[{"name":"","text":"","where":"","feel":"","sex":""}]}  (an empty list if nobody named is there).`;
const FEELS = ['devoted', 'friendly', 'neutral', 'wary', 'hostile'];
const peopleOf = c => arr(c.codex).filter(e => e.kind === 'person');
function upsertPeople(c, list, notes) {
  c.codex = arr(c.codex); let added = 0;
  const skip = [c.character.name, ...arr(c.party).map(p => p.name)].map(n => String(n || '').toLowerCase());
  for (const x of arr(list).slice(0, 12)) {
    const name = String(x?.name || '').trim().slice(0, 60); const text = String(x?.text || '').trim().slice(0, 400);
    if (!name || !text || skip.includes(name.toLowerCase()) || /^(the )?(player|you|gm|narrator)$/i.test(name)) continue;
    const where = String(x?.where || '').trim().slice(0, 60); const sex = /^(male|female)$/i.test(String(x?.sex || '').trim()) ? String(x.sex).trim().toLowerCase() : ''; const feel = FEELS.includes(String(x?.feel || '').toLowerCase().trim()) ? String(x.feel).toLowerCase().trim() : ''; const day = worldOf(c).time.day; const look = String(x?.look || '').trim().slice(0, 300);
    const ex = c.codex.find(e => e.name.toLowerCase() === name.toLowerCase()) || c.codex.find(e => e.kind === 'person' && (e.name.toLowerCase().split(' ')[0] === name.toLowerCase().split(' ')[0]) && name.split(' ').length !== e.name.split(' ').length);
    if (ex) { ex.text = text.length >= ex.text.length * 0.6 ? text : (ex.text + ' ' + text).slice(-600); ex.kind = 'person'; if (where) ex.where = where; if (look && !ex.look) ex.look = look; if (feel) ex.feel = feel; if (sex && !ex.sex) ex.sex = sex; ex.lastDay = day; if (name.length > ex.name.length) ex.name = name; }
    else { c.codex.push({ name, kind: 'person', text, where, look, feel, sex, day, lastDay: day, madeBy: x?.madeBy || 'gm' }); added++; notes?.push(name); }
  }
  return added;
}
async function trackPeople(c, text) {
  if (!text || !textReady()) return;
  const known = peopleOf(c).map(e => `- ${e.name}: ${e.text}`).join('\n').slice(-2500);
  try {
    const raw = await chat([
      { role:'system', content: PEOPLE_RULES },
      { role:'user', content:`PLAYER CHARACTER: ${c.character.name}\nPARTY COMPANIONS: ${arr(c.party).map(p => p.name).join(', ') || 'none'}\nCURRENT PLACE: ${c.location || 'unknown'}\n\nKNOWN PEOPLE:\n${known || '(none yet)'}\n\nTEXT:\n${text}` }
    ], { stream:false, maxTokens:700, temperature:0.2, helper:true });
    const j = tryJSON(stripThink(raw)); if (!j) return;
    const names = []; upsertPeople(c, j.people, names);
    touch(c); scheduleSync();
    if (names.length && cur() === c && S.view === 'game') { toast(`👤 Added to People: ${names.join(', ')}`, 3500); renderGame(); if (S.modal === 'people') renderModal(); }
  } catch (e) { console.warn('People tracker failed', e); }
}
async function scanPeople(c) {
  if (!c || S.peopleBusy) return; S.peopleBusy = true; renderModal();
  try {
    const parts = [c.summary ? 'STORY SO FAR:\n' + c.summary : '', c.world ? 'WORLD NOTES (only include people the player has actually met or heard of in the story):\n' + c.world.slice(0, 1500) : ''];
    const lines = c.messages.filter(m => !m.hidden && ['gm','comp'].includes(m.role)).slice(-30).map(m => m.text);
    let chunk = []; const chunks = [];
    for (const l of lines) { chunk.push(l); if (chunk.join('\n\n').length > 3500) { chunks.push(chunk.join('\n\n')); chunk = []; } }
    if (chunk.length) chunks.push(chunk.join('\n\n'));
    const before = peopleOf(c).length;
    await trackPeople(c, parts.filter(Boolean).join('\n\n') || '(nothing)');
    for (const ch of chunks) await trackPeople(c, ch);
    toast(`Found ${peopleOf(c).length - before} new ${peopleOf(c).length - before === 1 ? 'person' : 'people'}.`, 3500);
  } finally { S.peopleBusy = false; renderModal(); renderGame(); }
}
function npcPortrait(c, name, quiet) {
  if (S.settings.image.mode === 'off') { if (!quiet) toast('Pictures are off in Settings → Images.'); return; }
  const e = peopleOf(c).find(x => x.name === name); if (!e) return;
  const g = { id: uid(), kind:'character', name: e.name, prompt: portraitPrompt(e.look || `${e.name}, ${e.text}`), seed: d(999999), day: worldOf(c).time.day, t: Date.now() };
  c.gallery = arr(c.gallery).filter(x => !(x.kind === 'character' && x.name.toLowerCase() === e.name.toLowerCase())); c.gallery.unshift(g);
  touch(c); scheduleSync(); warmImage(g, c); if (!quiet) toast(`Painting ${e.name}…`, 3000);
}
function peopleHTML() {
  const c = cur(); const q = (S.peopleQ || '').toLowerCase();
  const all = peopleOf(c).sort((a, b) => (b.lastDay || b.day || 0) - (a.lastDay || a.day || 0) || a.name.localeCompare(b.name));
  const list = all.filter(e => !q || (e.name + ' ' + e.text + ' ' + (e.where || '')).toLowerCase().includes(q));
  const card = e => {
    const g = arr(c.gallery).find(x => x.kind === 'character' && x.name.toLowerCase() === e.name.toLowerCase());
    const port = g && S.settings.image.mode !== 'off' ? `<img class="port" src="${esc(imageUrl(g, c))}" alt="">` : `<div class="port ph2">${esc(e.name[0] || '?')}</div>`;
    return `<div class="ccard"><div class="row" style="align-items:flex-start">${port}<div class="grow"><b style="font-size:17px">${esc(e.name)}</b>
      <div class="hint" style="margin:1px 0 4px">${[e.where, e.day ? `met day ${e.day}` : ''].filter(Boolean).map(esc).join(' · ')}</div>
      <div style="font-size:14.5px;line-height:1.45">${esc(e.text)}</div>${e.lore ? `<div class="hint" style="margin:6px 0 0;color:var(--ink)">🔎 ${esc(e.lore)}</div>` : ''}</div></div>
      <div class="row" style="margin-top:8px">${S.settings.image.mode !== 'off' ? `<button class="btn sm ghost" data-act="npcport" data-n="${esc(e.name)}">${icon('image')} ${g ? 'Repaint' : 'Portrait'}</button>` : ''}<button class="btn sm ghost" data-act="npctalk" data-n="${esc(e.name)}">💬 Talk</button>${S.settings.net?.on !== false ? `<button class="btn sm ghost" data-act="npclook" data-n="${esc(e.name)}">${icon('search')} Look up</button>` : ''}<button class="iconbtn sm" data-act="npcdel" data-n="${esc(e.name)}" aria-label="Remove">${icon('trash')}</button></div></div>`;
  };
  return `<p class="hint">Everyone you've met or heard about. The list fills in by itself after each scene.</p>
    <input type="text" id="peopleQ" placeholder="Search people…" value="${esc(S.peopleQ || '')}" style="margin-top:4px">
    ${S.npcForm ? `<div class="card" style="margin-top:10px"><b>Add a person</b>
      <label class="f"><span>Name</span><input type="text" id="np_name" placeholder="Captain Ilsa Varn"></label>
      <label class="f"><span>Who they are</span><input type="text" id="np_text" placeholder="Harbor captain who owes my family money"></label>
      <label class="f"><span>Appearance (used for the portrait)</span><input type="text" id="np_look" placeholder="Weathered woman in her 50s, grey braid, navy coat"></label>
      <label class="f"><span>Where they are (optional)</span><input type="text" id="np_where" placeholder="Greywater docks"></label>
      <label class="check"><input type="checkbox" id="np_bring" checked> Ask the GM to bring them into the story</label>
      ${S.settings.image.mode !== 'off' ? '<label class="check"><input type="checkbox" id="np_paint" checked> Paint their portrait</label>' : ''}
      <div class="row" style="margin-top:10px"><button class="btn sm gold" data-act="npcsave">Add</button><button class="link" data-act="npccancel">Cancel</button></div></div>` : ''}
    <div class="row" style="margin-top:8px">${S.npcForm ? '' : `<button class="btn sm gold" data-act="npcadd">${icon('plus')} Add a person</button>`}<button class="btn sm" data-act="npcscan" ${S.peopleBusy ? 'disabled' : ''}>${S.peopleBusy ? '<span class="spin sm"></span> Reading the story…' : icon('spark') + ' Find people from the story so far'}</button>${arr(c.party).length ? `<button class="btn sm ghost" data-act="party">${icon('users')} Your party</button>` : ''}</div>
    <div style="margin-top:12px">${list.length ? list.map(card).join('') : `<p class="empty" style="font-size:18px">${all.length ? 'Nobody matches that search.' : 'Nobody yet. Tap "Find people from the story so far" to fill this in from what\'s happened.'}</p>`}</div>`;
}

/* =========================================================================
   Game modes: single player D&D, same-device multiplayer D&D,
   different-device multiplayer (coming soon), and Companion mode
   ========================================================================= */
const MODES = {
  solo:      { ic:'person', title:'Single player D&D', sub:'You and the GM: dice, stats, a party and a living world.' },
  mp:        { ic:'users',  title:'Multiplayer D&D · same device', sub:'Friends share this phone or PC. Tap who\'s acting, then type.' },
  online:    { ic:'cloud',  title:'Multiplayer D&D · different devices', sub:'Each player on their own phone.', soon:true },
  companion: { ic:'spark',  title:'Companion mode', sub:'No dice. A world built just like D&D, with characters who talk, act and remember on their own. Group chats, photos and voice.' }
};
const modeOf = c => c?.mode || 'solo';
const isCompanion = c => modeOf(c) === 'companion';
const isMP = c => modeOf(c) === 'mp' && arr(c.players).length > 0;
function renderModePick() {
  S.view = 'modes';
  app().innerHTML = `<div class="pagebar"><button class="iconbtn" data-act="home">${icon('back')}</button><h2>New story</h2><span></span></div>
  <div class="page"><p class="hint" style="font-size:15px;color:var(--ink);margin-top:14px">How do you want to play?</p>
    ${Object.entries(MODES).map(([k, m]) => `<button class="modetile ${m.soon ? 'soon' : ''}" ${m.soon ? 'disabled' : `data-act="pickmode" data-mode="${k}"`}>${icon(m.ic)}<span><b>${m.title}${m.soon ? ' <em>Coming soon</em>' : ''}</b><small>${m.sub}</small></span></button>`).join('')}
  </div>`;
}

/* ---------- same-device multiplayer ---------- */
function pcNames(c) { return (isMP(c) ? c.players.map(p => p.name) : [c.character.name]).filter(Boolean); }
function syncPlayers(c) { if (isMP(c)) c.players[c.activeP || 0] = c.character; }
function relinkPlayers(c) { if (isMP(c)) { c.activeP = clamp(num(c.activeP), 0, c.players.length - 1); c.character = c.players[c.activeP]; } }
function setActor(c, i) {
  if (!isMP(c) || i === c.activeP || !c.players[i]) return;
  if (c.pendingRoll) { toast(`Finish ${c.character.name}'s roll first.`); return; }
  syncPlayers(c); c.activeP = i; c.character = c.players[i];
  if (c.character.lvlQueue) { delete c.character.lvlQueue; c.levelPending = true; }
  touch(c); renderHUD(); renderDock(); renderLog();
}
function actorBarHTML(c) {
  if (!isMP(c)) return '';
  return `<div class="actors"><span class="hint" style="margin:0">Acting:</span>${c.players.map((p, i) => `<button class="chip ${i === c.activeP ? 'on' : ''}" data-act="actor" data-i="${i}">${esc(p.name)}${p.hp <= 0 ? ' 💀' : ''}</button>`).join('')}<button class="chip ghost" data-act="addplayer">${icon('plus')} Add player</button></div>`;
}
function addPlayerFlow(c) {
  const D = newDraft(SCENARIOS.find(s => s.id === 'custom'));
  Object.assign(D, { title: c.title, genre: c.genre, premise: c.premise, tone: c.tone, art: c.artStyle, rating: c.rating, magicCost: c.magicCost, world: c.world, secrets: c.secrets, scenario:'custom', mode:'mp' });
  S.draft = D; S.addingPlayer = c.id; renderNew();
}
function otherPlayersBrief(c) {
  if (!isMP(c)) return '';
  return c.players.filter((p, i) => i !== c.activeP).map(p => `${p.name}${p.storyRole ? ', ' + p.storyRole : ''}, HP ${p.hp}/${p.maxHp}${p.appearance ? '. Looks: ' + p.appearance : ''}`).join('\n');
}

