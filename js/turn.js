'use strict';
/* ---------- the bookkeeper ---------- */
function companionSpec(c) {
  const f = [
    '"location": a short place name, ONLY if the player is now somewhere other than CURRENT PLACE.',
    '"time_of_day": dawn|morning|midday|afternoon|evening|night|late night when time moved on. "days_passed": number when whole days passed. "weather": short phrase when it changed.',
    `"remember": ["short lasting fact"] for anything worth remembering long-term: things ${c.character.name} shared about themselves (likes, history, plans, feelings they expressed), promises, inside jokes, important moments between ${c.character.name} and a cast member. Use this generously but only for real facts.`,
    '"people": [{"name":"","text":"one sentence: who they are and what the player knows","where":"place","feel":"how they feel about the player: devoted, friendly, neutral, wary or hostile","sex":"male, female or unknown","look":"short physical description if shown"}] for every NAMED character who appears or is mentioned and is NOT in the cast.',
    '"codex": [{"name":"","kind":"place|creature|lore|item","text":"one sentence"}] for notable places, lore or items.',
    '"handout": {"title":"","kind":"note|letter|poster|page","text":"the exact words"} if a written message, letter or note was given or read.',
    '"quest_updates": [{"title":"","status":"active|completed|failed"}] only for clear goals the player took on or finished.',
    '"companion_updates": [{"name":"","trust":1,"status":"active|left|dead"}] when a cast member grew closer (+) or more distant (-) (trust -2..2), or left the story.',
    '"new_companions": [{"name":"","role":"","personality":"","voice":"","goals":"","appearance":"","secrets":"","trust":0}] only if someone new clearly became a regular part of the player\'s circle. Adults only.',
    `"photo": {"of":"cast member's name, or \"\" for a picture of the place","prompt":"~30 words: what the photo shows (pose, setting, lighting, mood)"} ONLY when ${c.character.name} asked for a photo/picture/selfie or a character chose to send one in this scene.`,
    '"image_prompt": ONLY when arriving somewhere new: ~40 words for an illustrator (no names, no text). With it, "image_subject": {"kind":"place","name":""}.',
    '"tension": 0-10, how intense this scene was.',
    '"music": the mood of the music that fits how this scene ENDS, one of calm|town|travel|mystic|tense|battle|dread|sad|triumph|scifi.'
  ];
  return f.map(x => '- ' + x).join('\n');
}
function bookkeeperSpec(c, hasCheck) {
  if (isCompanion(c)) return companionSpec(c);
  const party = activeParty(c).length > 0;
  const f = [
    `"choices": exactly 3 clearly different things ${c.character.name} might do next, each written as "Short title | the action in one sentence, phrased as the player's action" (title 2-5 words, sentence under 25 words)${hasCheck ? '. Use [] now: a dice roll is pending' : ''}.`,
    '"location": a short place name, ONLY if the character is now somewhere other than CURRENT PLACE.',
    `"hp_change": a negative number for damage ${c.character.name} actually took in this scene, positive for healing. NOT damage the app's dice already applied (see DICE RESULT).`,
    '"injury": {"name":"<injury>","effect":"<penalty, e.g. -2 to physical rolls until rest>"} for a real injury.',
    '"gold_change": coins gained (+) or spent/lost (-).',
    '"items_gained": [{"name":"","desc":""}], "items_lost": ["name"] for things actually picked up, given, bought, lost or used up.',
    '"quest_updates": [{"title":"","status":"active|completed|failed"}] when a goal is set, finished or failed.',
    '"remember": ["short lasting fact"] for promises, debts, names, secrets learned (rarely).',
    '"rest": true only if a full night\'s rest or long downtime happened.',
    '"time_of_day": dawn|morning|midday|afternoon|evening|night|late night when time moved on. "days_passed": number when whole days passed. "weather": short phrase when it changed.',
    `"combat": true if a fight started, false if it ended (now: ${c.combat ? 'in combat' : 'not in combat'}).`,
    hasCheck ? '' : '"check": ONLY if the scene ends with an enemy attack coming at the player: {"kind":"defense","stat":"DEX","dc":13,"reason":"<what attacks: who and with what>","enemy_damage":"<dice, e.g. d8+1>","damage":"<the player\'s weapon die>"} (dc = enemy Defense + 2: minion 12, soldier 15, elite 18; damage = the player\'s weapon die). Otherwise leave it out.',
    '"ep_gain": 1 minor challenge, 2 real challenge, 3-5 major victory overcome in THIS scene.',
    '"level_up": true only at a major story milestone (end of a chapter). Very rare.',
    '"people": [{"name":"","text":"one sentence: who they are and what the player knows","where":"place","feel":"how they feel about the player: devoted, friendly, neutral, wary or hostile","sex":"male, female or unknown","look":"short physical description if the scene shows one (age, build, hair, clothes)"}] for every NAMED character who appears or is mentioned (not the player, not party companions). Include known people again only if something new was learned.',
    '"codex": [{"name":"","kind":"place|creature|lore|item","text":"one sentence"}] for notable places, creatures, lore or items the player learned about (not people).',
    '"handout": {"title":"","kind":"note|letter|poster|page","text":"the exact words"} if the player received or read a written document.',
    '"image_prompt": ONLY when arriving somewhere new or when an important character or creature appears for the first time: ~40 words for an illustrator (subject, setting, lighting, mood; no names, no text). With it, "image_subject": {"kind":"place|character","name":""}.',
    '"reputation": [{"faction":"exact name","change":-1,"why":""}] (-3..3) when a faction would see the player differently.',
    '"threat_updates": [{"name":"exact threat name","advance":1}] when a hidden threat moved closer.',
    '"flaw_reward": {"trait":"exact negative trait name","ep":2,"why":""} if the player played into a negative trait in a way that cost them.',
    '"rumor": a short piece of talk the player overheard, if any.',
    '"tension": 0-10, how intense this scene was.',
    '"music": the mood of the music that fits how this scene ENDS, one of calm|town|travel|mystic|tense|battle|dread|sad|triumph|scifi.',
    roadmapBookkeep(c).spec,
    party ? '"companion_updates": [{"name":"","trust":1,"hp_change":-4,"status":"active|left|dead"}] (trust -2..2) when a companion was hurt, pleased, upset, left or died.' : '',
    party ? '"companion_checks": [{"name":"","stat":"DEX","dc":15,"reason":""}] when a companion started something risky and the scene stops before the result.' : '',
    party && S.settings.ui.compTurns !== false ? '"companion_turns": ["name"] at most one companion who would naturally speak up or act on their own right now (a decision touching their goals, a direct question, a fight). Usually leave it out.' : '',
    '"new_companions": [{"name":"","role":"","personality":"","voice":"","goals":"","appearance":"","secrets":"","stats":{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10},"trust":1}] only if someone clearly agreed to join and travel with the player.',
    `"player_dead": true only if ${c.character.name} is at 0 HP and truly died in this scene.`,
    isMP(c) && c.players.length > 1 ? `"others_hp": [{"name":"","change":-3}] damage or healing for the OTHER player characters (${c.players.filter(p => p !== c.character).map(p => p.name).join(', ')}); "hp_change" is only for ${c.character.name}.` : ''
  ];
  return f.filter(Boolean).map(x => '- ' + x).join('\n');
}
async function bookkeep(c, scene, ctx, signal) {
  const ch = c.character; const hasCheck = !!ctx.check;
  const state = [
    `CURRENT PLACE: ${c.location || 'unknown (the opening scene: give a location)'}`,
    `TIME: ${timeLabel(c)}${c.combat ? ' · IN COMBAT' : ''}`,
    `PLAYER CHARACTER: ${ch.name}, HP ${ch.hp}/${ch.maxHp}, gold ${ch.gold}, carrying: ${ch.gear.map(g => g.name).join(', ') || 'nothing'}`,
    ch.traits.some(t => t.polarity === '-') ? `NEGATIVE TRAITS: ${ch.traits.filter(t => t.polarity === '-').map(t => t.name).join(', ')}` : '',
    `ACTIVE QUESTS: ${arr(c.quests).filter(q => q.status === 'active').map(q => q.title).join('; ') || 'none'}`,
    peopleOf(c).length ? `KNOWN PEOPLE: ${peopleOf(c).map(e => e.name).join(', ')}` : '',
    activeParty(c).length ? `PARTY COMPANIONS: ${activeParty(c).map(p => `${p.name} (trust ${fmt(p.trust)}, HP ${p.hp}/${p.maxHp})`).join(', ')}` : '',
    c.factions.length ? `FACTIONS: ${c.factions.map(f => f.name).join(', ')}` : '',
    c.threats.filter(t => !t.triggered).length ? `HIDDEN THREATS: ${c.threats.filter(t => !t.triggered).map(t => t.name).join('; ')}` : '',
    isCompanion(c) ? '' : roadmapBookkeep(c).state
  ].filter(Boolean).join('\n');
  const msgs = [
    { role:'system', content:`You are the BOOKKEEPER for a tabletop RPG app. Read the newest scene and report what changed, as one JSON object. Only report what the scene actually shows happened; never invent events. Leave out every field that didn't change.\n\nFIELDS:\n${bookkeeperSpec(c, hasCheck)}\n\nReply with the JSON object only.` },
    { role:'user', content:`${state}${ctx.photoAsk ? '\nTHE PLAYER ASKED FOR A PHOTO in their last message: include "photo".' : ''}\n\nTHE PLAYER'S LAST ACTION: ${ctx.playerText || '(none: this is the opening scene)'}${ctx.roll ? `\nDICE RESULT (already applied by the app): ${ctx.roll}` : ''}${hasCheck ? `\nA DICE CHECK IS PENDING: ${ctx.check.reason}` : ''}\n\nTHE NEW SCENE:\n${scene}` }
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chat(msgs, { stream:false, signal, maxTokens: 900, temperature: attempt ? 0.1 : 0.2, helper: true, json: true });
    const j = tryJSON(stripThink(raw));
    if (j && typeof j === 'object' && !Array.isArray(j)) return j;
  }
  return null;
}

async function gmTurn(opts = {}) {
  const c = cur(); if (!c || S.busy) return;
  let again = false;
  if (!textReady()) { toast('Set up your Story AI first.'); openModal('settings'); return; }
  S.busy = true; S.recap = null; c.messages = c.messages.filter(m => m.role !== 'err'); renderDock();
  S.abort = new AbortController(); const signal = S.abort.signal;
  let msg = null;
  try {
    await maybeSummarize(c);
    let msgs = buildWriterMessages(c);
    msg = { id: uid(), role:'gm', text:'', streaming:true, t: Date.now(), ...(opts.cont ? { cont: true } : {}) };
    c.messages.push(msg);
    const pi = c.messages.indexOf(msg);
    if (isCompanion(c)) msg.companion = true;
    const trig = c.messages[pi - 1];
    const prevAct = c.messages.slice(0, pi).reverse().find(m => m.role === 'player' || m.role === 'roll');
    let playerText = prevAct && !prevAct.hidden ? (prevAct.gm || prevAct.text) : '';
    if (prevAct?.role === 'roll') {   /* resolving a roll: the action is the player's message before it */
      const act = c.messages.slice(0, c.messages.indexOf(prevAct)).reverse().find(m => m.role === 'player' && !m.ooc);
      playerText = `${act && !act.hidden ? (act.gm || act.text) : ''}\n[DICE RESULT: ${prevAct.text}]`.trim();
    }
    const isOOC = trig?.role === 'player' && trig.ooc;

    /* 1. the dice referee and the web scout don't depend on each other: ask both at once */
    const T = msg.timing = {}; const t0 = Date.now(); const lap = k => { T[k] = Math.round((Date.now() - t0) / 100) / 10; };
    let refCheck = null;
    const wantRef = aiOn('referee') && !isCompanion(c) && !opts.cont && !opts.noRoll && trig?.role === 'player' && !trig.hidden && !trig.ooc;
    const wantScout = scoutOn() && !opts.cont && trig?.role === 'player' && !trig.hidden && !trig.ooc && scoutWorth(c, trig.text);
    if (wantRef || wantScout) { msg.phase = wantRef ? 'Deciding whether this needs a roll…' : 'Thinking…'; renderLog(true); }
    const [refRes, scoutRes] = await Promise.allSettled([
      wantRef ? refereeCall(c, trig.gm || trig.text, signal) : null,
      wantScout ? scoutWeb(c, trig.gm || trig.text, signal) : null
    ]);
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    if (refRes.status === 'fulfilled') refCheck = refRes.value; else console.warn('Referee failed', refRes.reason);
    lap('referee');
    /* a roll is needed: ask for it right away. The GM writes one scene afterwards, with the result. */
    if (refCheck) {
      const ck = normCheck(refCheck, c);
      msg.text = ''; msg.rollAsk = true; msg.check = ck; msg.notes = []; msg.choices = []; delete msg.streaming; delete msg.phase;
      msg.before = snapshot(c);
      c.pendingRoll = { ...ck, msgId: msg.id, invokes: [], dcAdj: 0, momentumPlus: false };
      S.rollResult = null; S.invokeOpen = false; S.invokeSel = [];
      const tagged = turnTraits(c, trig.text).filter(t => t.polarity === '+');
      if (tagged.length) { msg.checking = 'Checking how your traits help…'; renderLog(); try { await traitRuling(c, c.pendingRoll, tagged, trig.gm || trig.text, signal); } catch (e) { if (e.name === 'AbortError') throw e; console.warn('Trait ruling failed', e); } delete msg.checking; }
      return;
    }
    const want = scoutRes.status === 'fulfilled' ? scoutRes.value : null;
    if (scoutRes.status === 'rejected') console.warn('Web scout failed', scoutRes.reason);
    if (want) {
      try {
        msg.phase = `🔎 Looking up ${want}…`; renderLog(true);
        const r = await withTimeout(lookupLore(c, want), 25000);
        if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
        if (r && r.text) {
          const L = msgs[msgs.length - 1];
          L.content = L.content.replace(REPLY_NOTE, '') + `\n\n[FACTS THE APP JUST LOOKED UP ONLINE about ${r.name} (accurate; use what fits, in your own words, without mentioning searching): ${r.text}]` + REPLY_NOTE;
          msg.looked = { name: r.name, url: r.url, src: r.src };
        }
      } catch (e) { if (e.name === 'AbortError') throw e; console.warn('Web lookup failed', e); }
      lap('lookup');
    }
    /* 2. optional private plan */
    if (aiOn('deliberate') && !isOOC) {
      msg.phase = `${gmOf(c).name} is planning the scene…`; renderLog(true);
      try {
        const plan = stripThink(await chat(planMessages(msgs), { stream:false, signal, maxTokens:300, temperature:0.5 })).trim();
        if (plan) { c.lastPlan = plan.slice(0, 2000); msgs = withPlan(msgs, c.lastPlan); }
      } catch (e) { if (e.name === 'AbortError') throw e; console.warn('Plan step failed', e); }
    }
    /* 3. the writer: story text only, one short beat */
    msg.phase = ''; renderLog(true);
    const wt = isOOC ? 400 : isCompanion(c) && compStyle(c) === 'chat' ? 260 : sceneLen().tokens;
    let raw = await chat(msgs, { stream: !!S.settings.text.stream, signal, maxTokens: wt, onToken: full => streamPaint(msg, full) });
    if (!stripThink(raw).trim()) raw = await chat(msgs, { stream:false, signal, maxTokens: wt });
    const { narration, state: writerState } = parseGM(raw);
    if (!narration) throw new Error('The AI sent back an empty reply. Tap Retry, or try a different model.');
    msg.text = tidyScene(narration); delete msg.streaming; lap('writer');

    /* 4. optional continuity rewrite, then the agency guard */
    let fixed = false, cut = null;
    if (aiOn('verify') && !isOOC) {
      msg.checking = 'Checking continuity…'; renderLog();
      try {
        const f = await continuityCheck(c, msg.text, playerText + (refCheck ? '\n(A DICE ROLL IS PENDING for this attempt: the scene must stop at the moment of truth. If the scene says or implies whether the attempt succeeded or failed, cut that part and end on the attempt.)' : ''), signal);
        if (f) { msg.text = f; fixed = true; }
      } catch (e) { if (e.name === 'AbortError') throw e; console.warn('Continuity check failed', e); }
    }
    /* the agency guard and the bookkeeper both read the finished scene: run them together.
       Only if the guard changes the scene does the bookkeeper run again on the new text. */
    const book = (scene) => bookkeep(c, scene, { playerText, roll: prevAct?.role === 'roll' ? prevAct.text : '', check: refCheck, photoAsk: isCompanion(c) && PHOTO_ASK.test(playerText) }, signal);
    let state;
    msg.checking = isOOC ? 'Checking the scene…' : 'Updating the records…'; renderLog();
    const [gRes, bRes] = await Promise.allSettled([
      aiOn('agency') && !isOOC ? agencyGuard(c, msg.text, playerText, signal) : null,
      isOOC ? null : book(msg.text)
    ]);
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    let bookRes = bRes.status === 'fulfilled' ? bRes.value : null; if (bRes.status === 'rejected') console.warn('Bookkeeper failed', bRes.reason);
    const g = gRes.status === 'fulfilled' ? gRes.value : null; if (gRes.status === 'rejected') console.warn('Agency guard failed', gRes.reason);
    if (g) {
      msg.original = msg.text; msg.text = g.text; msg.cut = g.cut; cut = g.rewrote ? 0 : g.cut.length;
      const risky = bookRes && (arr(bookRes.items_gained).length || num(bookRes.gold_change) || arr(bookRes.quest_updates).length);   /* lines written for the player may have invented these */
      if (!isOOC && risky) { try { bookRes = await book(msg.text) || bookRes; } catch (e) { if (e.name === 'AbortError') throw e; console.warn('Bookkeeper failed', e); } }
    }
    lap('checks');
    if (isOOC) {
      const prevGM = c.messages.slice(0, pi).reverse().find(m => m.role === 'gm');
      state = { choices: arr(prevGM?.choices), check: c.pendingRoll && prevGM?.check ? prevGM.check : null };
      msg.ooc = true;
    } else {
      state = { ...(writerState || {}), ...(bookRes || {}) };
      if (!bookRes && !Object.keys(writerState || {}).length) msg.bookFail = true;
    }
    delete msg.checking;
    if (refCheck) { state.check = refCheck; state.choices = []; }
    if (isOOC && !(c.pendingRoll && state.check)) state.check = null;

    const bubbles = isCompanion(c) ? castBubbles(c, msg) : null;
    applyState(c, msg, state); if (S.activeId === c.id) musicScene(c);
    if (isCompanion(c)) { delete msg.image; if (state.image_prompt && compStyle(c) !== 'chat' && S.settings.image.mode !== 'off' && S.settings.image.scenes !== false) msg.image = { prompt: String(state.image_prompt), seed: d(999999) }; attachPhoto(c, msg, bubbles, state.photo); }
    if (fixed) msg.notes.unshift({ t:'✓ Continuity corrected', k:'' });
    if (msg.looked) msg.notes.unshift({ t:`🔎 Looked up ${msg.looked.name} online`, k:'' });
    if (cut) msg.notes.unshift({ t:`✂ Removed ${cut} line${cut > 1 ? 's' : ''} where the GM spoke or acted for you`, k:'' });
    if (msg.bookFail) msg.notes.push({ t:'Records not updated this turn (tap Retry if HP, items or quests look wrong)', k:'' });
    if (state.level_up === true) makeSave(c, `Chapter end (level ${c.character.level})`, true);
    if (msg.worldTurn) await worldTurn(c, msg.worldTurn, signal);
    autoSpeak(msg, c); if (S.settings.ui.voice === 'auto') for (const b of arr(bubbles)) if (b.role === 'comp') { speakMessage(c, b, true); }
    let ranTurn = false;
    if (!opts.cont && !c.pendingRoll && !c.deathPending) {
      for (const id of arr(msg.compTurns)) {
        const p = arr(c.party).find(x => x.id === id); if (!p) continue;
        S.compThinking = p.name; renderLog(true);
        try { const before = c.messages.length; await companionTurn(c, p, signal); if (c.messages.length > before) ranTurn = true; autoSpeak(c.messages[c.messages.length - 1], c); }
        catch (e) { if (e.name === 'AbortError') throw e; console.warn('Companion turn failed', e); }
        S.compThinking = null;
      }
      again = ranTurn || arr(msg.compRolls).length > 0;
    }
  } catch (e) {
    if (msg) c.messages = c.messages.filter(m => m !== msg);
    if (e.name === 'AbortError') toast('Stopped.');
    else c.messages.push({ id: uid(), role:'err', text: e.message || String(e) });
  } finally {
    S.busy = false; S.abort = null; S.compThinking = null;
    touch(c); renderGame(); scheduleSync();
  }
  if (msg && arr(msg.lookups).length && c.messages.includes(msg)) autoLookups(c, msg.lookups);
  if (msg && !msg.rollAsk && c.messages.includes(msg) && !again) setTimeout(() => { if (!S.busy) memoryCheck(c); }, 1500);   /* runs while you read and type */
  if (again && cur() === c && !c.messages.some(m => m.role === 'err')) gmTurn({ cont: true });
}
/* small models sometimes start with "GM:" or end with a question to the player about what they do */
function tidyScene(t) {
  return String(t).replace(/^\s*(?:\*\*)?(?:GM|Game Master|Narrator|DM)(?:\*\*)?\s*:\s*/i, '')
    .replace(/\n+\s*\(?\s*(?:what (?:do|will) you do( next)?\??|how do you respond\??|the choice is yours\.?)\s*\)?\s*$/i, '').trim();
}

function addInjury(c, inj, notes) {
  const name = String(inj?.name || 'Injured').trim().slice(0, 50); if (!name) return;
  if (c.character.injuries.some(i => i.name.toLowerCase() === name.toLowerCase())) return;
  c.character.injuries.push({ name, effect: String(inj?.effect || '−2 to related rolls until rest').slice(0, 120) });
  notes.push({ t:'Injury: ' + name, k:'bad' });
}
function applyDamage(c, amt, notes, crit) {
  const ch = c.character; const was = ch.hp;
  ch.hp = clamp(ch.hp - amt, 0, ch.maxHp);
  notes.push({ t: '−' + (was - ch.hp) + ' HP', k:'bad' });
  if (crit || amt > ch.maxHp / 2) addInjury(c, { name: crit ? 'Grievous blow' : 'Badly hurt', effect:'−2 to physical rolls until rest' }, notes);
  if (ch.hp === 0 && was > 0) notes.push({ t:'Down!', k:'bad' });
}

function applyState(c, msg, st) {
  const ch = c.character; const notes = [];
  msg.before = snapshot(c); const progBefore = progressKey(c);
  /* damage or a new injury the scene never showed is dropped: the story has to explain every wound */
  if (num(st.hp_change) < 0 && !sceneShowsHurt(msg.text)) { console.warn('Dropped unexplained damage', st.hp_change); st.hp_change = 0; }
  if (st.injury && !sceneShowsHurt(msg.text)) { console.warn('Dropped unexplained injury', st.injury); st.injury = null; }
  msg.choices = arr(st.choices).map(x => String(typeof x === 'object' ? (x.text || x.action || '') : x).trim()).filter(Boolean).slice(0, 4);

  applyRoadmap(c, st, notes);
  if (typeof st.combat === 'boolean') { if (c.combat && !st.combat) ch.momentum = 0; c.combat = st.combat; }
  const hp = num(st.hp_change);
  if (hp < 0) applyDamage(c, -hp, notes, false);
  else if (hp > 0) { const was = ch.hp; ch.hp = clamp(ch.hp + hp, 0, ch.maxHp); if (ch.hp > was) notes.push({ t:'+' + (ch.hp - was) + ' HP', k:'good' }); }
  const gold = num(st.gold_change); if (gold) { ch.gold = Math.max(0, ch.gold + gold); notes.push({ t: fmt(gold) + ' gold', k:'gold' }); }
  const ep = num(st.ep_gain); if (ep > 0) { ch.ep += ep; notes.push({ t:'+' + ep + ' EP', k:'gold' }); }
  const tp = num(st.tp_gain); if (tp > 0) { ch.tp += tp; notes.push({ t:'+' + tp + ' TP', k:'gold' }); }
  const strain = num(st.strain_change);
  if (strain && c.magicCost !== 'free' && c.magicCost !== 'none') { ch.strain = Math.max(0, ch.strain + strain); notes.push({ t: (strain > 0 ? '+' : '−') + Math.abs(strain) + ' Strain', k: strain > 0 ? 'bad' : 'good' }); }
  if (st.rest === true) {
    ch.hp = ch.maxHp; const healed = ch.injuries.length; ch.injuries = []; ch.strain = 0; ch.momentum = 0; c.combat = false;
    notes.push({ t:'Rested: full HP' + (healed ? ', injuries healed' : ''), k:'good' });
    for (const p of activeParty(c)) p.hp = p.maxHp;
  }
  if (st.injury && typeof st.injury === 'object' && st.injury.name) addInjury(c, st.injury, notes);
  for (const it of arr(st.items_gained)) { const g = normGear(it); if (g.name && g.name !== 'Item') { ch.gear.push(g); notes.push({ t:'+ ' + g.name, k:'good' }); } }
  for (const it of arr(st.items_lost)) {
    const name = String(typeof it === 'object' ? (it.name || '') : it).trim().toLowerCase(); if (!name) continue;
    let i = ch.gear.findIndex(x => x.name.toLowerCase() === name);
    if (i < 0) i = ch.gear.findIndex(x => x.name.toLowerCase().includes(name) || name.includes(x.name.toLowerCase()));
    if (i >= 0) { notes.push({ t:'− ' + ch.gear[i].name, k:'bad' }); ch.gear.splice(i, 1); }
  }
  for (const nt of arr(st.new_traits)) {
    const t = normTrait(nt, 'play'); if (!t.name || t.name === 'Unnamed trait') continue;
    if (ch.traits.some(x => x.name.toLowerCase() === t.name.toLowerCase())) continue;
    ch.traits.push(t);
    if (t.polarity === '-') { ch.tp += NEG_PLAY[t.tier]; notes.push({ t:`Lasting wound: ${t.name} (${t.tier}) · +${NEG_PLAY[t.tier]} TP`, k:'bad' }); }
    else notes.push({ t:`New trait: ${t.name} (${t.tier})`, k:'good' });
  }
  const prevLoc = c.location;
  if (st.location && typeof st.location === 'string' && st.location.trim()) c.location = st.location.trim().slice(0, 80);
  if (c.location && c.location !== prevLoc) { trackPlace(c, prevLoc, c.location); msg.lookups = [...arr(msg.lookups), c.location]; }
  for (const q of arr(st.quest_updates)) {
    const title = String(typeof q === 'object' ? (q.title || q.name || '') : q).trim(); if (!title) continue;
    const status = ['active','completed','failed'].includes(q.status) ? q.status : 'active';
    const ex = c.quests.find(x => x.title.toLowerCase() === title.toLowerCase());
    if (ex) { if (ex.status !== status) { ex.status = status; notes.push({ t:`Quest ${status}: ${title}`, k: status === 'failed' ? 'bad' : 'gold' }); } }
    else { c.quests.push({ title, status }); notes.push({ t:'New quest: ' + title, k:'gold' }); }
  }
  for (const r of arr(st.remember)) { const f = String(r).trim(); if (f && !c.memory.some(m => m.toLowerCase() === f.toLowerCase())) c.memory.push(f); }
  worldOf(c);
  const tod = String(st.time_of_day || '').toLowerCase().trim(); if (TIME_PARTS.includes(tod)) c.time.part = tod;
  const days = clamp(num(st.days_passed), 0, 60); if (days > 0) { c.time.day += days; msg.worldTurn = days; notes.push({ t:`Day ${c.time.day}`, k:'' }); }
  if (typeof st.weather === 'string' && st.weather.trim()) c.time.weather = st.weather.trim().slice(0, 40);
  if (typeof st.music === 'string' && MOODS[st.music.trim().toLowerCase()]) c.mood = st.music.trim().toLowerCase();
  if (st.tension != null && st.tension !== '') { c.tensionLog.push(clamp(num(st.tension), 0, 10)); if (c.tensionLog.length > 10) c.tensionLog = c.tensionLog.slice(-10); }
  const fr = st.flaw_reward;
  if (fr && typeof fr === 'object' && num(fr.ep) > 0) { const ep = clamp(num(fr.ep), 1, 3); const ft = ch.traits.find(x => x.polarity === '-' && x.name.toLowerCase() === String(fr.trait || '').toLowerCase()); ch.ep += ep; notes.push({ t:`+${ep} EP for playing ${ft ? ft.name : 'a flaw'}`, k:'gold' }); }
  for (const r of applyWorld(c, st, notes)) notes.push({ t:'📜 ' + r.text, k:'' });
  if (c.memory.length > 60) c.memory = c.memory.slice(-60);
  if (st.level_up === true && !c.levelPending) { c.levelPending = true; notes.push({ t:'Level up ready!', k:'gold' }); if (isMP(c)) c.players.forEach(p => { if (p !== c.character) p.lvlQueue = true; }); }

  const ck = st.check && typeof st.check === 'object' ? normCheck(st.check, c) : null;
  if (ck) { msg.check = ck; c.pendingRoll = { ...ck, msgId: msg.id, invokes: [], dcAdj: 0, momentumPlus: false }; }
  else c.pendingRoll = null;
  S.rollResult = null; S.invokeOpen = false; S.invokeSel = [];

  const ip = typeof st.image_prompt === 'string' ? st.image_prompt.trim() : '';
  if (ip && S.settings.image.mode !== 'off' && S.settings.image.scenes !== false) {
    msg.image = { prompt: ip, seed: d(999999) };
    const sub = st.image_subject && typeof st.image_subject === 'object' ? st.image_subject : {};
    addGallery(c, { kind: sub.kind === 'character' ? 'character' : 'place', name: String(sub.name || c.location || 'Scene'), prompt: ip, seed: msg.image.seed });
  }
  applyParty(c, st, msg, notes);
  applyKeepsakes(c, st, msg, notes);
  trackProgress(c, progBefore);
  msg.notes = notes;
}

function normCheck(x, c) {
  const kind = ['attack','defense','check'].includes(String(x.kind || '').toLowerCase()) ? String(x.kind).toLowerCase() : 'check';
  const stat = normStat(x.stat || x.ability, kind === 'defense' ? 'DEX' : 'DEX');
  const dc = clamp(num(x.dc) || 12, 2, 40);
  const ch = c.character;
  const applies = [];
  for (const name of arr(x.applies || x.negatives)) {
    const n = String(typeof name === 'object' ? name.name : name).toLowerCase().trim(); if (!n) continue;
    const t = ch.traits.find(t => t.polarity === '-' && (t.name.toLowerCase() === n || t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase())));
    if (t && !applies.some(a => a.id === t.id)) { applies.push({ id: t.id, name: t.name, val: -TV[t.tier], kind:'trait' }); continue; }
    const inj = ch.injuries.find(i => i.name.toLowerCase() === n || i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase()));
    if (inj && !applies.some(a => a.name === inj.name)) applies.push({ id: inj.name, name: inj.name, val: -2, kind:'injury' });
  }
  return { kind, stat, dc, reason: String(x.reason || 'the attempt').slice(0, 140), applies, damage: String(x.damage || '').slice(0, 20), enemy_damage: String(x.enemy_damage || '').slice(0, 20) };
}

/* ---------- the roll ---------- */
const effDC = (r, mode) => r.dc + (r.dcAdj || 0) + (mode === 'counter' ? 3 : 0);
function defenseStat(ch, mode) { return mode === 'dodge' ? 'DEX' : mode === 'block' ? 'STR' : (mod(ch.stats.STR) >= mod(ch.stats.DEX) ? 'STR' : 'DEX'); }
function rollMods(c, r, statKey) {
  const ch = c.character; const out = [];
  if (statKey) out.push({ l: SN(statKey), v: mod(ch.stats[statKey]) });
  for (const inv of r.invokes || []) {
    const t = ch.traits.find(x => x.id === inv.id); const tv = TV[t?.tier || inv.tier];
    const v = inv.fit === 'full' ? tv : inv.fit === 'partial' ? Math.floor(tv / 2) : 0;
    out.push({ l: `${inv.name} (${inv.fit === 'full' ? 'full fit' : inv.fit === 'partial' ? 'partial fit' : 'doesn\'t fit'})`, v, why: inv.reason });
  }
  for (const a of r.applies || []) out.push({ l: a.name, v: a.val });
  if (ch.strain > 0) out.push({ l:'Strain', v: -ch.strain });
  if (r.momentumPlus) out.push({ l:'Momentum', v: 3 });
  return out;
}
const sumMods = m => m.reduce((a, x) => a + x.v, 0);

function doRoll(mode) {
  const c = cur(); const r = c?.pendingRoll; if (!r || S.busy || S.rolling) return;
  const ch = c.character;
  const statKey = r.kind === 'defense' ? defenseStat(ch, mode || 'dodge') : r.stat;
  const reroll = S.rollResult && S.rollResult.msgId === r.msgId;
  if (reroll && (!c.combat || ch.momentum - (r.momentumPlus ? 1 : 0) < 1 || S.rollResult.rerolled)) return;
  const useMode = reroll ? S.rollResult.mode : (mode || null);
  S.rolling = true;
  document.querySelectorAll('.rollcard button').forEach(b => b.disabled = true);
  const resolve = roll => {
    const mods = rollMods(c, r, reroll ? S.rollResult.statKey : statKey); const total = roll + sumMods(mods);
    const dc = effDC(r, useMode);
    let outcome;
    if (roll === 20) outcome = 'CRITICAL SUCCESS';
    else if (total >= dc + 10) outcome = 'OVERWHELMING SUCCESS';
    else if (total >= dc) outcome = roll === 1 ? 'SUCCESS (natural 1 — complication)' : 'SUCCESS';
    else if (total <= dc - 10) outcome = 'DISASTER';
    else outcome = roll === 1 ? 'FAILURE (natural 1 — complication)' : 'FAILURE';
    const success = roll === 20 || total >= dc;
    S.rollResult = { msgId: r.msgId, mode: useMode, statKey: reroll ? S.rollResult.statKey : statKey, d: roll, mods, total, dc, outcome, success, big: roll === 20 || total >= dc + 10, rerolled: reroll };
    S.rolling = false;
    renderLog();
    const canReroll = c.combat && (ch.momentum - (r.momentumPlus ? 1 : 0)) >= 1 && !S.rollResult.rerolled && !success;
    if (!canReroll) setTimeout(finalizeRoll, 1100);
  };
  if (physical()) {
    const what = r.kind === 'attack' ? 'Attack' : r.kind === 'defense' ? `Defense (${useMode || 'dodge'})` : `${SN(r.stat)} check`;
    askDice(`${what}: ${r.reason}`, 20, 1).then(resolve);
    return;
  }
  const die = $('#bigdie'); if (die) { die.classList.add('rolling'); die.classList.remove('crit', 'fumble'); }
  let spins = 0;
  const timer = setInterval(() => {
    if (die) die.textContent = d(20);
    if (++spins < 12) return;
    clearInterval(timer);
    resolve(d(20));
  }, 60);
}

async function finalizeRoll() {
  const c = cur(); const r = c?.pendingRoll; const res = S.rollResult;
  if (!r || !res || res.msgId !== r.msgId || S.busy || S.finalizing) return;
  S.finalizing = true;
  try {
    const ch = c.character; const before = snapshot(c); const notes = []; const extras = [];
    const spent = (r.momentumPlus ? 1 : 0) + (res.rerolled ? 1 : 0);
    ch.momentum = Math.max(0, (ch.momentum || 0) - spent);
    if (c.combat) { if (res.success) { if (ch.momentum < 3) notes.push({ t:'+1 Momentum', k:'gold' }); ch.momentum = Math.min(3, ch.momentum + 1); } else { if (ch.momentum) notes.push({ t:'Momentum lost', k:'bad' }); ch.momentum = 0; } }
    let label;
    if (r.kind === 'attack') {
      label = `Attack (${SN(res.statKey)}) on ${r.reason} vs Defense ${res.dc}`;
      if (res.success) { const dmg = await rollDiceAsync(r.damage || 'd6', ch, res.statKey, res.big, 'Your damage'); extras.push(`Damage dealt: ${dmg.total} (${dmg.text}${res.big ? ', doubled dice' : ''}).`); notes.push({ t:`Hit for ${dmg.total}`, k:'good' }); }
    } else if (r.kind === 'defense') {
      const m = res.mode || 'dodge';
      label = `Defense — ${m} (${SN(res.statKey)}) against ${r.reason}, DC ${res.dc}`;
      if (!res.success) { const dmg = await rollDiceAsync(r.enemy_damage || 'd6', null, null, res.d === 1, 'Damage you take'); applyDamage(c, dmg.total, notes, res.d === 1); extras.push(`You take ${dmg.total} damage (${dmg.text}). HP now ${ch.hp}/${ch.maxHp}.`); }
      else if (m === 'counter') { const dmg = await rollDiceAsync(r.damage || 'd6', ch, res.statKey, res.big, 'Counter damage'); extras.push(`Avoided the attack and counter-hit for ${dmg.total} damage (${dmg.text}).`); notes.push({ t:`Counter for ${dmg.total}`, k:'good' }); }
      else extras.push('Avoided the attack.');
    } else label = `${SN(res.statKey)} check to ${r.reason} (DC ${res.dc})`;
    const modStr = res.mods.map(x => `${x.l} ${fmt(x.v)}`).join(', ');
    const how = String(r.how || '').trim();
    const text = `${label}${how ? ` — ${c.character.name}'s move, in the player's words: "${how}"` : ''}: rolled ${res.d}${modStr ? ` [${modStr}]` : ''} = ${res.total} → ${res.outcome}${res.success ? '' : ` (missed by ${res.dc - res.total})`}.${extras.length ? ' ' + extras.join(' ') : ''}${res.rerolled ? ' (Rerolled with Momentum.)' : ''}`;
    const rollData = { d: res.d, total: res.total, dc: res.dc, outcome: res.outcome, success: res.success, label, mods: res.mods, extras, how };
    const prev = deep(r);
    c.pendingRoll = null; S.rollResult = null; S.invokeOpen = false; S.invokeSel = [];
    S.finalizing = false;
    playerAct(text, 'roll', { rollData, before, prevPending: prev, notes });
  } finally { S.finalizing = false; }
}

async function traitRuling(c, r, traits, arg, signal) {
  const lastGM = [...c.messages].reverse().find(m => m.role === 'gm' && !m.rollAsk)?.text || '';
  const raw = await chat([
    { role:'system', content:'You are the Game Master ruling on whether a player\'s positive traits help one specific check in a tabletop RPG. Be fair and consistent. "full" = the trait clearly and specifically helps this exact action as described. "partial" = it helps indirectly or only somewhat. "none" = it doesn\'t fit or the description is vague. Instead of (or as well as) a bonus you may reward a good argument by lowering the DC by 1-4 (dc_change as a negative number). Reply with JSON only: {"rulings":[{"trait":"exact trait name","fit":"full|partial|none","reason":"under 15 words"}],"dc_change":0}' },
    { role:'user', content:`SCENE:\n${lastGM.slice(-1400)}\n\nCHECK: ${r.kind} — ${r.stat} vs DC ${r.dc} to ${r.reason}\n\nTRAITS INVOKED:\n${traits.map(traitLine).join('\n')}\n\nWHAT THE PLAYER WROTE: ${arg}` }
  ], { stream:false, maxTokens:400, temperature:0.3, signal });
  const j = tryJSON(stripThink(raw)) || {};
  const rulings = arr(j.rulings);
  r.invokes = traits.map(t => {
    const ru = rulings.find(x => String(x.trait || '').toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(String(x.trait || '').toLowerCase())) || rulings[traits.indexOf(t)] || {};
    const fit = ['full','partial','none'].includes(String(ru.fit).toLowerCase()) ? String(ru.fit).toLowerCase() : 'none';
    return { id: t.id, name: t.name, tier: t.tier, fit, reason: String(ru.reason || '').slice(0, 120) };
  });
  r.dcAdj = clamp(num(j.dc_change), -5, 0);
}
async function askRuling() {
  const c = cur(); const r = c?.pendingRoll; if (!r || S.ruling) return;
  const arg = ($('#invokeText')?.value || '').trim();
  const traits = S.invokeSel.map(id => c.character.traits.find(t => t.id === id)).filter(Boolean);
  if (!traits.length) return toast('Pick at least one trait to invoke.');
  if (!arg) return toast('Say how you use it. Specific beats vague.');
  S.invokeArg = arg; S.ruling = true; renderLog();
  try { await traitRuling(c, r, traits, arg); r.argument = arg; S.invokeOpen = false; touch(c); }
  catch (e) { toast('Ruling failed: ' + e.message, 5000); }
  finally { S.ruling = false; renderLog(); }
}

/* =========================================================================
   Release 1 — GM personality, plan-then-write, continuity check, Ask the GM,
   Fix the story, save points, "Previously on…", physical dice
   ========================================================================= */
const GM_PRESETS = {
  storyteller: { label:'Warm storyteller', style:'Warm, vivid and encouraging. Rich sensory detail, gentle humor, rewards curiosity. At the table: friendly, chatty and generous with explanations.' },
  veteran:     { label:'Witty veteran', style:'Dry wit and seasoned confidence. Punchy prose, memorable NPCs, a twinkle of sarcasm. At the table: banters and teases a little, never mean.' },
  referee:     { label:'Strict rules referee', style:'Precise, fair and consistent. Clear stakes, exact consequences, no softened blows. At the table: explains rulings and DCs plainly.' },
  chronicler:  { label:'Grim chronicler', style:'Somber, weighty and atmospheric. Danger feels real and victories are hard-won. At the table: measured, serious, a little ominous.' },
  bard:        { label:'Theatrical bard', style:'Dramatic and playful. Loves big moments, distinct NPC voices and cliffhangers. At the table: enthusiastic, celebrates clever play.' },
  custom:      { label:'Custom…', style:'' }
};
function gmOf(c) {
  const g = (c && c.gm) || {}; const p = GM_PRESETS[g.preset] || GM_PRESETS.storyteller;
  const style = g.preset === 'custom' ? (String(g.style || '').trim() || GM_PRESETS.storyteller.style) : p.style;
  return { name: String(g.name || '').trim() || 'The Narrator', style };
}
function personaText(c) { const g = gmOf(c); return `YOUR PERSONA: You are "${g.name}", the Game Master. Personality: ${g.style} Keep this same voice for the whole campaign, both when narrating and when talking with the player out of character.`; }
function keepRecent() { const a = activeConn(); const ctx = a ? (num(a.ctx) || PRESETS[a.preset]?.ctx || 0) : 0; return !ctx ? 20 : ctx >= 24000 ? 30 : ctx >= 16000 ? 20 : 14; }

/* ---------- plan, then write ---------- */
const REPLY_NOTE = '\n\n(GM: write the next short beat of the story. Story text only.)';
const PLAN_NOTE = "(GM PLANNING STEP — do not write the scene yet. In under 120 words of private notes decide: what the NPCs present want and will do next; the consequences of the player's last action or dice result; any threat that advances; facts that must stay consistent; and the exact moment the scene should end on. Never decide the player character's actions, words, thoughts or feelings. Output only the notes.)";
function planMessages(msgs) { const out = msgs.map(m => ({ ...m })); const l = out[out.length - 1]; l.content = l.content.replace(REPLY_NOTE, '') + '\n\n' + PLAN_NOTE; return out; }
function withPlan(msgs, plan) { const out = msgs.map(m => ({ ...m })); out[out.length - 1].content += `\n\n(GM's private plan for this turn — follow it, never reveal it: ${plan})`; return out; }

/* ---------- continuity check ---------- */
/* ---------- dice referee: decides on its own whether the player's action needs a roll ---------- */
const DC_LADDER = '8 very easy, 12 easy, 18 moderate, 20 hard, 25 very hard, 30 nearly impossible (adjust 2-5 for circumstances; an NPC opponent sets it by their skill: drunk guard 8, trained soldier 15, royal spymaster 22)';
async function refereeCall(c, playerText, signal) {
  const forced = /(^|\s)(\/roll|\(roll\)|#roll)\b/i.test(playerText) || /\b(roll for it|i want to roll|let me roll|make a roll)\b/i.test(playerText);
  const more = S.settings.ai.dice === 'more', less = S.settings.ai.dice === 'less';
  const raw = await chat([
    { role:'system', content:`You are the DICE REFEREE for a tabletop RPG that uses a d20. Decide whether the player's latest action needs a roll.
CALL A CHECK when the outcome is uncertain and failing would matter or be interesting: sneaking or hiding, picking locks, stealing, climbing, jumping, chasing or fleeing, forcing something open, searching or noticing something hidden, reading a person's lies or mood, persuading, lying to, bargaining with or intimidating someone who could refuse, recalling obscure lore, resisting poison, fear or magic, casting a risky spell, treating wounds, attacking anyone (kind "attack").
NO CHECK for safe, routine or certain actions: walking somewhere, ordinary conversation with no stakes, asking a question, buying things at a fair price, looking around a calm place, eating, resting.
${more ? 'The player wants MORE dice: whenever there is any doubt, call a check.' : less ? 'The player wants FEWER dice: call a check only when failure would be dangerous or change the story (fights, real risks, big moments). Let small things simply happen.' : 'When it is genuinely uncertain and something is at stake, call a check.'}${forced ? '\nThe player has explicitly asked to roll: you MUST call a check.' : ''}
Stats: STR (force), DEX (agility, stealth, aim), CON (endurance), INT (knowledge, reasoning), WIS (perception, insight, willpower), CHA (persuasion, deception, presence).
DC: ${DC_LADDER}. Set it from the task, never the character's level.
"applies": only names of the character's NEGATIVE traits or injuries that clearly hinder this attempt.
For an attack: kind "attack", stat STR or DEX, dc = the target's Defense (minion 10, soldier 13, elite 16, boss 19+), damage = weapon die (d4 unarmed, d6 light, d8 standard, d10 heavy).
Reply with JSON only, nothing else:
{"check":null}
or {"check":{"kind":"check","stat":"DEX","dc":18,"reason":"slip past the guard unseen","applies":[],"damage":""}}` },
    { role:'user', content:`CHARACTER:\n${sheetText(c)}\n\nRECENT SCENES:\n${storyLines(c, 4) || '(start of the adventure)'}\n\nTHE PLAYER'S ACTION NOW: ${playerText}` }
  ], { stream:false, signal, maxTokens:220, temperature:0.2, helper:true, json:true });
  const j = tryJSON(stripThink(raw));
  const ck = j && j.check && typeof j.check === 'object' ? j.check : null;
  return ck && (ck.stat || ck.ability) ? ck : null;
}
const refereeNote = ck => `\n\n[THE APP HAS CALLED A DICE CHECK for this action: ${normStat(ck.stat || ck.ability)} DC ${clamp(num(ck.dc) || 12, 2, 40)} to ${String(ck.reason || 'attempt it').slice(0, 120)}. Describe the attempt up to the moment of truth and STOP. Do NOT say or hint whether it succeeds or fails; the dice decide.]`;

/* ---------- agency guard: numbered-sentence check, the app cuts what the GM wrote for your character ---------- */
const AGENCY_HINT = /\byou(?:r)?\s+(?:say|said|ask|asked|reply|replied|tell|told|shout|whisper|mutter|murmur|answer|respond|agree|promise|insist|explain|add|call out|decide|choose|chose|feel|felt|think|thought|wonder|realize|realise|remember|recall|hope|fear|know|sense|nod|smile|grin|laugh|chuckle|sigh|shrug|frown|step|walk|head|reach|grab|take|took|pick|draw|turn|move|follow|enter|leave|climb|run|ran|sit|stand|stood|lean|kneel|hand|give|gave|offer|thank|greet|wave|raise|lower|clench|tighten|swallow|find yourself|can't help|cannot help|steel yourself)\b|["“][^"”]{2,}["”],?\s+you\s+\w+|\bwith a (?:smile|grin|nod|sigh|shrug)\b|\b(?:excitement|dread|determination|resolve|relief|anger|fear|joy)\s+(?:fills|floods|wells|rises|courses|washes)\b/i;
function sentencesOf(text) {
  const out = [];
  String(text).split(/\n{2,}/).forEach((p, pi) => {
    const parts = p.match(/[^.!?…]+(?:[.!?…]+["”’)\]]*|$)\s*/g) || [p];
    for (const s of parts) if (s.trim()) out.push({ pi, s });
  });
  return out;
}
async function agencyGuard(c, scene, playerText, signal) {
  const items = sentencesOf(scene); if (items.length < 2) return null;
  const name = pcNames(c).join(' / ');
  const list = items.map((x, i) => `${i + 1}. ${x.s.trim()}${AGENCY_HINT.test(x.s) ? '   ← check this one' : ''}`).join('\n');
  const raw = await chat([
    { role:'system', content:`You check one scene from a tabletop RPG for a single rule: the Game Master must never control the PLAYER CHARACTER (${name}, written as "you"). Only the player decides what ${name} does, says, thinks or feels.
A sentence BREAKS the rule if it gives ${name}:
- words in quotes, or says ${name} said/asked/replied/agreed to something, that the player did not write;
- any action, movement or gesture the player did not write (stepping forward, nodding, smiling, reaching, following, taking something, deciding);
- thoughts, decisions, memories, hopes, or emotions ("you feel a surge of hope", "you decide", "determination fills you").
A sentence is FINE if it:
- briefly retells what the player wrote their character does or says (in other words is fine);
- describes what ${name} sees, hears, smells, or physical sensations like cold, pain or the ground shaking;
- describes NPCs, companions, the world, or what NPCs say or do to ${name};
- shows how ${name}'s attempt turns out when a DICE RESULT is given (succeeding, failing, slipping, landing the blow).
${playerText ? '' : 'This is the OPENING scene: the player has not acted yet, so ANY action, words, thoughts or feelings for ' + name + ' break the rule.'}
Lines marked "← check this one" are only a hint; judge them yourself.
Reply with JSON only: {"bad":[numbers of the sentences that break the rule]}  ({"bad":[]} if none do).` },
    { role:'user', content:`WHAT THE PLAYER WROTE FOR ${name.toUpperCase()}:\n${playerText || '(nothing yet: opening scene)'}\n\nTHE SCENE, ONE SENTENCE PER LINE:\n${list}` }
  ], { stream:false, signal, maxTokens:150, temperature:0, helper:true, json:true });
  const j = tryJSON(stripThink(raw));
  const bad = new Set(arr(j?.bad).map(n => num(n) - 1).filter(i => i >= 0 && i < items.length));
  if (!bad.size) return null;
  /* rewrite the flagged sentences so the scene still flows (cutting them leaves holes the story then trips over) */
  try {
    const marked = items.map((x, i) => (bad.has(i) ? '>>' : '') + x.s.trim()).join(' ');
    const fixed = stripThink(await chat([
      { role:'system', content:`You edit one scene from a tabletop RPG. Sentences marked >> make the player character (${name}, "you") do, say, think or feel something the player did not write. Rewrite ONLY those sentences: turn them into what the world, the place or the other characters do, or drop them. Keep every other sentence word for word, keep every character, place and detail, and keep it reading smoothly. Never add new events or characters. Reply with the finished scene only, without the >> marks.` },
      { role:'user', content:`WHAT THE PLAYER WROTE:\n${playerText || '(opening scene)'}\n\nSCENE:\n${marked}` }
    ], { stream:false, signal, maxTokens: Math.min(900, Math.ceil(scene.length / 2.5) + 80), temperature:0.3 })).replace(/>>/g, '').trim();
    if (fixed && fixed.length >= scene.length * 0.5 && fixed.length <= scene.length * 1.6 + 60) return { text: tidyScene(fixed), cut: [...bad].sort((a, b) => a - b).map(i => items[i].s.trim()), rewrote: true };
  } catch (e) { if (e.name === 'AbortError') throw e; console.warn('Agency rewrite failed', e); }
  const keep = items.filter((_, i) => !bad.has(i));
  const kept = keep.map(x => x.s).join('').trim();
  if (kept.length < scene.length * 0.35) return null;   /* cutting most of the scene would wreck it; leave it to Retry */
  const paras = []; for (const x of keep) { (paras[x.pi] = paras[x.pi] || []).push(x.s.trim()); }
  return { text: paras.filter(Boolean).map(p => p.join(' ')).join('\n\n'), cut: [...bad].sort((a, b) => a - b).map(i => items[i].s.trim()) };
}

async function continuityCheck(c, scene, playerText, signal) {
  const facts = [
    c.pinned?.length ? 'PINNED FACTS (always true):\n' + c.pinned.map(f => '- ' + f).join('\n') : '',
    'PLAYER CHARACTER:\n' + sheetText(c),
    c.memory?.length ? 'MEMORY:\n' + c.memory.slice(-25).map(f => '- ' + f).join('\n') : '',
    c.summary ? 'STORY SO FAR:\n' + c.summary : ''
  ].filter(Boolean).join('\n\n');
  const raw = await chat([
    { role:'system', content:"You are a continuity editor for a tabletop roleplaying game. Check ONE scene and fix only real problems:\n1. It contradicts a pinned fact, the character sheet, memory or the story so far (wrong names, dead people alive again, items the character does not have).\n2. It writes the PLAYER CHARACTER's actions, movements, words, decisions, thoughts or feelings beyond exactly what the player wrote. Describing what the character perceives is fine.\nIf there are no problems, reply with exactly: OK\nOtherwise reply with the corrected scene only: same style and roughly the same length, changing as little as possible. No notes, no JSON." },
    { role:'user', content:`${facts}\n\nTHE PLAYER WROTE:\n${playerText || '(opening scene: the player has not acted yet, so the character must not act at all)'}\n\nSCENE TO CHECK:\n${scene}` }
  ], { stream:false, signal, maxTokens:900, temperature:0.2, helper:true });
  let t = stripThink(raw).trim().replace(/^["“]|["”]$/g, '');
  if (!t || /^ok\b/i.test(t) && t.length < 60) return null;
  t = t.replace(/<state>[\s\S]*$/i, '').replace(/^(the )?(corrected|fixed) scene[^\n]*\n+/i, '').replace(/^here is[^\n]*\n+/i, '').trim();
  t = stripChoiceList(t);
  if (t.length < scene.length * 0.4 || t.length > scene.length * 1.8) return null;
  return t === scene ? null : t;
}

/* ---------- Ask the GM (out of character table talk) ---------- */
const RULES_BRIEF = 'IRONQUILL RULES (brief): A check is d20 + stat modifier + every trait that applies, vs a DC set by the task (8 very easy, 12 easy, 18 moderate, 20 hard, 25 very hard, 30 nearly impossible). Beat it by 10+ = overwhelming success; miss by 10+ = disaster; a natural 20 always succeeds; a natural 1 adds a complication. Positive traits (D +1 to S +5) count when the player invokes them (full, half or no fit); negative traits always apply when relevant; there is no cap. Combat: attack vs enemy Defense, then weapon damage; enemies telegraph and the player defends (dodge DEX, block STR, counter at DC+3); successes build Momentum (max 3) for +3 or a reroll. Injuries give -2 until rest; lasting wounds become negative traits that pay TP. EP raises stats and TP buys traits, spent at level-ups, which come at story milestones.';
const storyLines = (c, n) => c.messages.filter(m => !m.hidden && !m.fromGM && ['gm','player','roll','comp'].includes(m.role)).slice(-n).map(m => `${m.role === 'gm' ? 'GM' : m.role === 'roll' ? 'DICE' : m.role === 'comp' ? 'COMPANION ' + m.name : (m.who ? m.who.toUpperCase() : 'PLAYER')}: ${m.role === 'gm' ? (m.raw || m.text) : m.text}`).join('\n\n');
async function askGM(text) {
  const c = cur(); if (!c || S.asking) return; text = String(text || '').trim(); if (!text) return;
  if (!textReady()) { toast('Set up your Story AI first.'); return; }
  c.tableTalk = c.tableTalk || []; c.tableTalk.push({ role:'you', text, t: Date.now() }); S.asking = true; renderModal(); scrollTalk();
  const recent = storyLines(c, 6);
  const sys = [personaText(c), '',
    'Right now you are talking with your player OUT OF CHARACTER, at the table between turns, like a real Game Master. Be yourself, in your persona\'s voice. Keep answers short and conversational unless asked for detail.',
    'You can explain rules and rulings, recap events, say what the player character would know, give a gentle hint if asked, and chat about the game. Never advance the story here and never narrate new events.',
    'Never reveal GM secrets, the hidden plan or companions\' hidden secrets; at most hint that there is more to discover.',
    'If the player asks for a lasting change to how you run the game (tone, pacing, content, focus, difficulty), agree and end with one line exactly like: REQUEST: <the change, under 15 words>',
    '', RULES_BRIEF, '',
    'CAMPAIGN', `Title: ${c.title}`, `Premise: ${c.premise}`, `Tone: ${c.tone || ''}`, `Content rating: ${c.rating}`,
    '', 'PLAYER CHARACTER', sheetText(c),
    c.pinned?.length ? '\nPINNED FACTS\n' + c.pinned.map(f => '- ' + f).join('\n') : '',
    c.world ? '\nWORLD\n' + c.world : '',
    c.memory?.length ? '\nMEMORY\n' + c.memory.map(f => '- ' + f).join('\n') : '',
    c.summary ? '\nSTORY SO FAR\n' + c.summary : '',
    c.gmNotes ? '\nPLAYER\'S STANDING REQUESTS\n' + c.gmNotes : '',
    recent ? '\nMOST RECENT SCENES\n' + recent : '',
    c.pendingRoll ? `\nA ${c.pendingRoll.kind} is waiting: ${c.pendingRoll.stat} vs DC ${c.pendingRoll.dc} to ${c.pendingRoll.reason}.` : ''
  ].join('\n');
  const hist = c.tableTalk.slice(-12).filter(m => !m.err).map(m => ({ role: m.role === 'gm' ? 'assistant' : 'user', content: m.text }));
  try {
    const raw = stripThink(await chat([{ role:'system', content: sys }, ...hist], { stream:false, maxTokens:600, temperature:0.7 })).trim();
    const reqs = [];
    const reply = raw.replace(/^\s*\**REQUEST:?\**\s*(.+)$/gim, (_, r) => { reqs.push(r.trim()); return ''; }).trim();
    for (const r of reqs) {
      const lines = (c.gmNotes || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.some(l => l.toLowerCase() === r.toLowerCase())) { lines.push(r); c.gmNotes = lines.join('\n'); }
    }
    c.tableTalk.push({ role:'gm', text: reply || '…', t: Date.now(), saved: reqs });
    if (reqs.length) toast('Saved as a standing request: ' + reqs.join('; '), 4500);
  } catch (e) { c.tableTalk.push({ role:'gm', text: '(Couldn\'t reach the GM: ' + e.message + ')', t: Date.now(), err: true }); }
  finally { S.asking = false; if (c.tableTalk.length > 80) c.tableTalk = c.tableTalk.slice(-80); touch(c); if (S.modal === 'askgm') { renderModal(); scrollTalk(); } scheduleSync(); }
}
function scrollTalk() { requestAnimationFrame(() => { const b = $('#modalBody'); if (b) b.scrollTop = b.scrollHeight; }); }
function askGMHTML() {
  const c = cur(); const g = gmOf(c); const talk = c.tableTalk || [];
  return `<p class="hint">Talk with ${esc(g.name)} out of character: rules, recaps, what you know, hints, or how you'd like the game run. Nothing here changes the story.</p>
    <div class="talk">${talk.length ? talk.map(m => `<div class="tt ${m.role}"><b>${m.role === 'gm' ? esc(g.name) : 'You'}</b><div>${md(m.text)}</div>${m.saved?.length ? `<span class="note gold" style="display:inline-block;margin-top:6px">Saved request: ${esc(m.saved.join('; '))}</span>` : ''}</div>`).join('') : `<p class="empty" style="font-size:18px">Ask ${esc(g.name)} anything.</p>`}
    ${S.asking ? `<div class="tt gm"><b>${esc(g.name)}</b><div class="row"><span class="spin sm"></span> <span class="hint" style="margin:0">thinking…</span></div></div>` : ''}</div>
    <div class="chips" style="margin-top:10px">${['Recap the story so far', 'What does my character know here?', 'Explain the last ruling', 'Give me a small hint'].map(q => `<button class="chip" data-act="askquick" data-q="${esc(q)}" ${S.asking ? 'disabled' : ''}>${esc(q)}</button>`).join('')}</div>
    <div class="row asksend"><textarea id="askText" class="grow" rows="2" placeholder="Why was that DC so high?">${esc(S.askDraft || '')}</textarea><button class="sendbtn" data-act="asksend" ${S.asking ? 'disabled' : ''} aria-label="Send">${icon('send')}</button></div>`;
}

/* ---------- Fix the story ---------- */
async function requestFix() {
  const c = cur(); const text = ($('#fixText')?.value || '').trim(); if (!c || S.fixing) return;
  if (!text) return toast('Describe what went wrong first.');
  S.fixText = text; S.fixing = true; S.fixProposal = null; renderModal();
  const g = lastIndex(c, 'gm'); const scene = g >= 0 ? c.messages[g].text : '';
  try {
    const raw = await chat([
      { role:'system', content:"You repair continuity in a tabletop roleplaying campaign after the player points out a problem. Change only what the correction requires. Never write the player character's actions, words, thoughts or feelings. Reply with JSON only:\n{\"explain\":\"one sentence saying what you changed\",\"scene\":\"the LAST scene rewritten to fix the problem, or an empty string if it needs no change\",\"memory_add\":[\"new long-term facts\"],\"memory_remove\":[\"existing memory lines to delete, copied exactly\"],\"pinned_add\":[\"facts that must always hold from now on\"],\"summary\":\"the corrected story so far, or an empty string if unchanged\",\"world\":\"the corrected world notes, or an empty string if unchanged\"}" },
      { role:'user', content:`PLAYER'S CORRECTION:\n${text}\n\nLAST SCENE:\n${scene || '(none)'}\n\nLONG-TERM MEMORY:\n${(c.memory || []).map(m => '- ' + m).join('\n') || '(none)'}\n\nPINNED FACTS:\n${(c.pinned || []).map(m => '- ' + m).join('\n') || '(none)'}\n\nSTORY SO FAR:\n${c.summary || '(none)'}\n\nWORLD NOTES:\n${c.world || '(none)'}` }
    ], { stream:false, maxTokens:2200, temperature:0.3 });
    const j = tryJSON(stripThink(raw));
    if (!j) throw new Error('The GM\'s reply wasn\'t usable. Try rewording the correction.');
    const p = { explain: String(j.explain || ''), scene: String(j.scene || '').trim(), add: arr(j.memory_add).map(String).filter(Boolean), remove: arr(j.memory_remove).map(String).filter(Boolean),
      pinned: arr(j.pinned_add).map(String).filter(Boolean), summary: String(j.summary || '').trim(), world: String(j.world || '').trim(), msgId: g >= 0 ? c.messages[g].id : null };
    if (p.scene) p.scene = stripChoiceList(p.scene.replace(/<state>[\s\S]*$/i, '').trim());
    if (p.scene === scene.trim()) p.scene = '';
    if (p.summary === (c.summary || '').trim()) p.summary = '';
    if (p.world === (c.world || '').trim()) p.world = '';
    S.fixProposal = p;
  } catch (e) { toast(e.message, 5000); }
  finally { S.fixing = false; if (S.modal === 'fix') renderModal(); }
}
function applyFix() {
  const c = cur(); const p = S.fixProposal; if (!c || !p) return;
  const low = s => String(s).toLowerCase().trim();
  if (p.scene && p.msgId) { const m = c.messages.find(x => x.id === p.msgId); if (m) { m.text = p.scene; m.edited = true; } }
  if (p.remove.length) c.memory = c.memory.filter(m => !p.remove.some(r => low(r) === low(m)));
  for (const a of p.add) if (!c.memory.some(m => low(m) === low(a))) c.memory.push(a);
  c.pinned = c.pinned || []; for (const a of p.pinned) if (!c.pinned.some(m => low(m) === low(a))) c.pinned.push(a);
  if (p.summary) c.summary = p.summary;
  if (p.world) c.world = p.world;
  S.fixProposal = null; S.fixText = ''; touch(c); closeModal(); scheduleSync(); toast('Story fixed.');
}
function fixHTML() {
  const p = S.fixProposal;
  if (!p) return `<p class="hint" style="color:var(--ink)">Tell the GM what went wrong: a forgotten event, a wrong name, someone who shouldn't be there. It fixes the last scene and its notes, and shows you every change before saving.</p>
    <textarea id="fixText" rows="4" placeholder="Mara died two scenes ago, so she can't be in this room.">${esc(S.fixText || '')}</textarea>
    <button class="btn gold wide" data-act="fixsend" style="margin-top:10px" ${S.fixing ? 'disabled' : ''}>${S.fixing ? '<span class="spin sm"></span> The GM is fixing it…' : 'Ask the GM to fix it'}</button>
    <p class="hint">Small slip? Tap <b>Edit</b> under any GM message to change the text yourself. Facts that must always hold go in Journal → <b>Facts</b>.</p>`;
  const list = (t, items, k) => items.length ? `<div class="sect" style="font-size:18px">${t}</div>${items.map(i => `<div class="note ${k}" style="display:block;margin-top:6px">${esc(i)}</div>`).join('')}` : '';
  const none = !p.scene && !p.add.length && !p.remove.length && !p.pinned.length && !p.summary && !p.world;
  return `<p style="color:var(--gold2)">${esc(p.explain || 'Proposed changes:')}</p>
    ${p.scene ? `<div class="sect" style="font-size:18px">Rewritten last scene</div><div class="card" style="font-family:var(--serif);line-height:1.6">${md(p.scene)}</div>` : ''}
    ${list('Memory: add', p.add, 'good')}${list('Memory: remove', p.remove, 'bad')}${list('New pinned facts', p.pinned, 'gold')}
    ${p.summary ? '<p class="hint">✓ Story-so-far summary updated</p>' : ''}${p.world ? '<p class="hint">✓ World notes updated</p>' : ''}
    ${none ? '<p class="hint">The GM didn\'t propose any changes. Try describing the problem more specifically.</p>' : ''}
    <div class="row" style="margin-top:14px">${none ? '' : '<button class="btn gold grow" data-act="fixapply">Apply changes</button>'}<button class="btn grow" data-act="fixredo">Change my request</button></div>`;
}

/* ---------- save points ---------- */
const MAX_SAVES = 20, MAX_AUTO = 6;
function makeSave(c, name, auto = false) {
  const data = deep(c); delete data.saves;
  c.saves = c.saves || [];
  c.saves.unshift({ id: uid(), name: String(name || 'Save').slice(0, 60), t: Date.now(), auto, level: c.character.level, turns: c.messages.filter(m => !m.hidden).length, data: JSON.stringify(data) });
  const autos = c.saves.filter(s => s.auto); if (autos.length > MAX_AUTO) { const drop = autos[autos.length - 1]; c.saves = c.saves.filter(s => s !== drop); }
  if (c.saves.length > MAX_SAVES) c.saves = c.saves.slice(0, MAX_SAVES);
}
function loadSave(id) {
  const c = cur(); const s = c?.saves?.find(x => x.id === id); if (!s || S.busy) return;
  if (!confirm(`Go back to "${s.name}"? Where you are now will be kept as a save too.`)) return;
  makeSave(c, `Before loading "${s.name}"`, true);
  const data = JSON.parse(s.data); const saves = c.saves;
  for (const k of Object.keys(c)) delete c[k];
  Object.assign(c, migrate(data)); c.saves = saves; c.pendingRoll = null; S.rollResult = null; S.recap = null;
  touch(c); closeModal(); renderGame(); scheduleSync(); toast(`Loaded "${s.name}".`);
}
function savesHTML() {
  const c = cur(); const list = c.saves || [];
  return `<p class="hint">Save points you can go back to, for example before a big fight. One is made automatically at each chapter end.</p>
    <div class="row" style="margin-top:8px"><input class="grow" type="text" id="saveName" placeholder="Before the dragon"><button class="btn sm gold" data-act="savenew">${icon('download')} Save now</button></div>
    ${list.length ? list.map(s => `<div class="quest"><div class="grow"><b>${esc(s.name)}</b>${s.auto ? ' <span class="note">auto</span>' : ''}<div class="hint" style="margin:2px 0 0">${new Date(s.t).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })} · Lv ${s.level} · ${s.turns} messages</div></div>
      <button class="btn sm" data-act="saveload" data-id="${s.id}">Load</button><button class="iconbtn sm" data-act="savedel" data-id="${s.id}" aria-label="Delete save">${icon('x')}</button></div>`).join('') : '<p class="empty" style="font-size:18px">No saves yet.</p>'}`;
}

/* ---------- "Previously on…" ---------- */
async function makeRecap(c, force) {
  if (!c || (S.recap && S.recap.loading) || !textReady()) return;
  if (!c.messages.some(m => !m.hidden && m.role === 'gm')) { if (force) toast('Nothing to recap yet.'); return; }
  if (!force && Date.now() - (c.updatedAt || 0) < 2 * 3600 * 1000) return;
  S.recap = { id: c.id, loading: true, text: '' }; if (S.view === 'game') renderLog(true);
  try {
    const t = stripThink(await chat([
      { role:'system', content: personaText(c) + '\nWrite a short "Previously on…" recap for your player, who is coming back to the game. 3-5 sentences, second person, in your voice, covering the key events and ending with exactly where things stand now. Do not invent events or reveal secrets. Output only the recap.' },
      { role:'user', content:`CHARACTER: ${c.character.name}\n\nSTORY SO FAR:\n${c.summary || '(none)'}\n\nMOST RECENT SCENES:\n${storyLines(c, 8)}` }
    ], { stream:false, maxTokens:400, temperature:0.6 })).trim();
    S.recap = t ? { id: c.id, text: t } : null;
  } catch (e) { S.recap = null; if (force) toast('Recap failed: ' + e.message, 5000); }
  if (S.view === 'game' && S.activeId === c.id) renderLog(true);
}
function recapHTML(c) {
  const r = S.recap; if (!r || r.id !== c.id) return '';
  return `<div class="msg"><div class="card recap"><div class="h">Previously on ${esc(c.title)}…</div>${r.loading ? `<div class="row"><span class="spin sm"></span> <span class="hint" style="margin:0">${esc(gmOf(c).name)} is catching you up…</span></div>` : `<div style="font-family:var(--serif);line-height:1.6">${md(r.text)}</div><button class="btn sm" data-act="recapdone" style="margin-top:10px">Continue</button>`}</div></div>`;
}

/* ---------- physical dice ---------- */
const physical = () => !!S.settings.ui.physicalDice;
function askDice(label, sides, count = 1) { return new Promise(resolve => { S.diceAsk = { label, sides, count, resolve }; renderDiceAsk(); }); }
function renderDiceAsk() {
  let el = $('#diceAsk'); const a = S.diceAsk;
  if (!a) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'diceAsk'; document.body.appendChild(el); }
  const min = a.count, max = a.count * a.sides;
  el.innerHTML = `<div class="modal" style="z-index:70"><div class="sheet" style="max-width:380px;padding:18px 18px calc(18px + var(--safe-b))">
    <div style="font-family:var(--display);font-size:26px;color:var(--gold2);font-weight:700">Roll your dice</div>
    <p style="margin:6px 0 0">${esc(a.label)}</p>
    <p class="hint">Roll <b>${a.count > 1 ? a.count : ''}d${a.sides}</b> and enter the ${a.count > 1 ? 'total' : 'number'} (${min}–${max}).</p>
    <input type="number" id="diceVal" min="${min}" max="${max}" inputmode="numeric" style="font-size:30px;text-align:center;margin-top:8px">
    <div class="row" style="margin-top:12px"><button class="btn gold grow" data-act="diceok">Use this roll</button><button class="btn grow" data-act="dicerand">Roll for me</button></div></div></div>`;
  setTimeout(() => $('#diceVal')?.focus(), 50);
}
function answerDice(random) {
  const a = S.diceAsk; if (!a) return;
  let v = 0;
  if (random) for (let i = 0; i < a.count; i++) v += d(a.sides);
  else { v = num($('#diceVal')?.value); if (v < a.count || v > a.count * a.sides) { toast(`Enter a number from ${a.count} to ${a.count * a.sides}.`); return; } }
  S.diceAsk = null; renderDiceAsk(); a.resolve(v);
}
async function rollDiceAsync(expr, ch, addStat, double = false, label = 'Damage') {
  if (!physical()) return rollDice(expr, ch, addStat, double);
  let e = String(expr || '').toUpperCase().replace(/\s+/g, '');
  if (!/D\d/.test(e)) e = 'D6' + (e && /^[+-]?\d+$/.test(e) ? (e.startsWith('-') || e.startsWith('+') ? e : '+' + e) : '');
  const tokens = e.match(/[+-]?[^+-]+/g) || []; let total = 0, hasStat = false; const parts = [];
  for (const tok of tokens) {
    const sign = tok.startsWith('-') ? -1 : 1; const body = tok.replace(/^[+-]/, ''); let m;
    if ((m = body.match(/^(\d*)D(\d+)$/))) {
      const n = clamp(num(m[1] || 1), 1, 20) * (double ? 2 : 1); const sides = clamp(num(m[2]), 2, 100);
      const v = await askDice(`${label}: ${n}d${sides}${double ? ' (big hit: dice doubled)' : ''}`, sides, n);
      total += sign * v; parts.push(`${n}d${sides}[${v}]`);
    } else if (/^\d+$/.test(body)) { total += sign * num(body); parts.push((sign < 0 ? '−' : '+') + body); }
    else if (STATS.includes(body) && ch) { hasStat = true; const v = mod(ch.stats[body]); total += sign * v; parts.push(`${SN(body)} ${fmt(sign * v)}`); }
  }
  if (addStat && ch && !hasStat) { const v = mod(ch.stats[addStat]); total += v; parts.push(`${SN(addStat)} ${fmt(v)}`); }
  return { total: Math.max(1, total), text: parts.join(' ') };
}

/* =========================================================================
   Release 2 — living world: session zero, hidden campaign plan, threats,
   time & weather, factions & reputation, world turn, pacing, flaw rewards
   ========================================================================= */
const TIME_PARTS = ['dawn','morning','midday','afternoon','evening','night','late night'];
const toList = v => Array.isArray(v) ? v.map(x => '- ' + String(typeof x === 'object' && x ? (x.name ? `${x.name}${x.desc ? ': ' + x.desc : ''}` : JSON.stringify(x)) : x).replace(/^[-*•]\s*/, '')).join('\n') : String(v || '');
function worldOf(c) { c.time = c.time || { day:1, part:'morning', weather:'' }; c.factions = arr(c.factions); c.threats = arr(c.threats); c.planNotes = arr(c.planNotes); c.rumors = arr(c.rumors); c.tensionLog = arr(c.tensionLog); return c; }
function timeLabel(c) { const t = c.time || {}; return `Day ${t.day || 1} · ${t.part || 'morning'}${t.weather ? ' · ' + t.weather : ''}`; }
const repLabel = r => r <= -4 ? 'Hostile' : r <= -2 ? 'Unfriendly' : r < 0 ? 'Wary' : r === 0 ? 'Neutral' : r <= 2 ? 'Friendly' : r <= 4 ? 'Allied' : 'Devoted';
function findByName(list, name) { const n = String(name || '').toLowerCase().trim(); if (!n) return null; return list.find(x => x.name.toLowerCase() === n) || list.find(x => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())) || null; }
function addThreats(c, list) {
  for (const t of arr(list)) {
    const name = String(t?.name || '').trim(); if (!name || findByName(c.threats, name)) continue;
    c.threats.push({ id: uid(), name: name.slice(0, 80), progress: clamp(num(t.progress), 0, 10), max: clamp(num(t.max) || 6, 3, 10), effect: String(t.effect || '').slice(0, 240), triggered: false });
  }
}
function addFactions(c, list) {
  for (const f of arr(list)) {
    const name = String((f && typeof f === 'object') ? f.name || '' : f || '').trim(); if (!name || findByName(c.factions, name)) continue;
    c.factions.push({ name: name.slice(0, 60), rep: clamp(num(f?.rep), -5, 5), desc: String(f?.desc || '').slice(0, 200) });
  }
}
/* shared by normal turns and the world turn; returns any new rumors */
function applyWorld(c, st, notes) {
  worldOf(c);
  for (const r of arr(st.reputation)) {
    const name = String(r?.faction || r?.name || '').trim(); const ch = clamp(num(r?.change), -3, 3); if (!name || !ch) continue;
    let f = findByName(c.factions, name); if (!f) { f = { name: name.slice(0, 60), rep: 0, desc: '' }; c.factions.push(f); }
    f.rep = clamp(f.rep + ch, -5, 5); if (notes) notes.push({ t: `${f.name} ${fmt(ch)} reputation`, k: ch < 0 ? 'bad' : 'good' });
  }
  for (const u of arr(st.threat_updates)) {
    const t = findByName(c.threats, u?.name); if (!t || t.triggered) continue;
    t.progress = clamp(t.progress + clamp(num(u?.advance) || 1, -3, 3), 0, t.max);
    if (t.progress >= t.max) { t.triggered = true; c.planNotes.push(`Threat came to pass: ${t.name}: ${t.effect}`); }
  }
  addThreats(c, st.new_threats);
  if (typeof st.plan_note === 'string' && st.plan_note.trim()) c.planNotes.push(st.plan_note.trim().slice(0, 300));
  if (c.planNotes.length > 16) c.planNotes = c.planNotes.slice(-16);
  const fresh = [];
  for (const r of arr(st.rumors).concat(st.rumor ? [st.rumor] : [])) {
    const t = String(r || '').trim(); if (!t || c.rumors.some(x => x.text === t)) continue;
    const item = { text: t.slice(0, 240), day: c.time.day }; c.rumors.unshift(item); fresh.push(item);
  }
  if (c.rumors.length > 20) c.rumors = c.rumors.slice(0, 20);
  return fresh;
}
function worldBrief(c) {
  worldOf(c);
  return [`TIME: ${timeLabel(c)}`, c.world ? 'WORLD:\n' + c.world : '', c.secrets ? 'SECRETS:\n' + c.secrets : '', c.plan ? 'CAMPAIGN PLAN:\n' + c.plan : '',
    c.planNotes.length ? 'GM NOTES:\n' + c.planNotes.slice(-8).map(n => '- ' + n).join('\n') : '',
    c.threats.length ? 'THREATS:\n' + c.threats.map(t => `- ${t.name}: ${t.progress}/${t.max}${t.triggered ? ' (has happened)' : ''}, when full: ${t.effect}`).join('\n') : '',
    c.factions.length ? 'FACTIONS:\n' + c.factions.map(f => `- ${f.name} (player standing ${fmt(f.rep)})${f.desc ? ': ' + f.desc : ''}`).join('\n') : '',
    c.summary ? 'STORY SO FAR:\n' + c.summary : '', 'RECENT SCENES:\n' + storyLines(c, 4)].filter(Boolean).join('\n\n');
}
async function worldTurn(c, days, signal) {
  worldOf(c);
  if (!c.factions.length && !c.threats.length && !c.plan && !c.world) return;
  try {
    const raw = await chat([
      { role:'system', content: personaText(c) + `\nWORLD TURN. ${days} day(s) have passed off-screen. Decide what the factions, villains and important NPCs did meanwhile, following their goals and the campaign plan. Advance threats nobody stopped, start a new one only if it truly fits, and give 1-2 rumors the player could hear about it (only what people would gossip about, never the hidden truth). Reply with JSON only: {"threat_updates":[{"name":"exact threat name","advance":1}],"new_threats":[{"name":"","max":6,"effect":""}],"reputation":[],"rumors":[""],"plan_note":"private note on what changed"}` },
      { role:'user', content: worldBrief(c) }
    ], { stream:false, signal, maxTokens:700, temperature:0.7 });
    const j = tryJSON(stripThink(raw)); if (!j) return;
    const fresh = applyWorld(c, j, null);
    if (fresh.length) c.messages.push({ id: uid(), role:'sys', text: '📜 Word going around: ' + fresh.map(r => r.text).join(' · ') });
  } catch (e) { if (e.name === 'AbortError') throw e; console.warn('World turn failed', e); }
}

