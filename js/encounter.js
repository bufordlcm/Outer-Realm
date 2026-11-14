'use strict';
/* =========================================================================
   ENCOUNTERS: long action scenes (a fight, a football game, a chase, a duel)
   played out turn by turn in their own pop-up window, then folded back into
   the story as a recap with the full log tucked underneath.
   - The GM offers one when a fight or contest starts (you say Begin or Not now),
     or you start one yourself with the ⚔ Encounter button.
   - Fights: health bars, turn order, attack and defense rolls, Momentum.
   - Contests: a scoreboard instead of health bars.
   - Auto fight: a switch; the app plays your side (best stat, fitting traits).
   - Ways out: win, lose, flee, surrender, or talk it out.
   ========================================================================= */
const ENC_TIERS = { minion: { hp: 8, def: 10, dmg: 'd6' }, soldier: { hp: 18, def: 13, dmg: 'd8+1' }, elite: { hp: 36, def: 16, dmg: 'd10+2' }, boss: { hp: 70, def: 19, dmg: '2d8+3' } };
const ENC_OUT = { win: 'Victory', loss: 'Defeat', down: 'You went down', fled: 'You got away', surrender: 'You surrendered', talked: 'Talked down', draw: 'A draw', left: 'Broken off' };
const ENC_DIFF = { easy: { hp: 0.7, adj: -2, l: 'Easy: weaker enemies, lower DCs' }, normal: { hp: 1, adj: 0, l: 'Normal' }, hard: { hp: 1.4, adj: 2, l: 'Hard: tougher enemies, higher DCs' } };
const encDiff = c => ENC_DIFF[c?.encDiff] || ENC_DIFF.normal;
const encBusy = () => !!S.encBusy;
/* party companions who are in this fight (they have their own health bars and act when you attack) */
const encAllyList = c => arr(c?.enc?.allies).map(id => arr(c.party).find(p => p.id === id)).filter(Boolean);
function encAllyTurns(c) {
  const e = c.enc; const out = [];
  for (const p of encAllyList(c)) {
    if (num(p.hp) <= 0) continue; const live = encFoes(e); if (!live.length) break;
    const foe = (encFoe(e, e.target) && !encFoe(e, e.target).out && encFoe(e, e.target)) || live.slice().sort((a, b) => a.hp - b.hp)[0];
    const stat = mod(p.stats.STR) >= mod(p.stats.DEX) ? 'STR' : 'DEX'; const roll = d(20); const total = roll + mod(p.stats[stat]); const hit = roll === 20 || total >= foe.def;
    const extras = [];
    if (hit) { const dmg = rollDice('d6', p, stat, roll === 20); foe.hp = Math.max(0, foe.hp - dmg.total); if (foe.hp <= 0) foe.out = 'down'; extras.push(`Hit for ${dmg.total}. ${foe.name}: ${foe.hp}/${foe.maxHp} HP${foe.hp <= 0 ? ', DOWN' : ''}.`); } else extras.push('Missed.');
    const label = `${p.name} attacks ${foe.name} (${SN(stat)}), vs Defense ${foe.def}`; const outcome = hit ? (roll === 20 ? 'CRITICAL SUCCESS' : 'SUCCESS') : 'FAILURE';
    const text = `${label}: rolled ${roll} ${fmt(mod(p.stats[stat]))} = ${total} → ${outcome}. ${extras.join(' ')}`;
    e.log.push({ id: uid(), role: 'roll', text, rollData: { d: roll, total, dc: foe.def, outcome, success: hit, label, extras } }); out.push(text);
  }
  return out.join(' ');
}
/* in a contest your companions are teammates: each time you make a play, one of them (taking turns) makes one too */
const encTeam = c => encAllyList(c).filter(p => !arr(c.enc.benched).includes(p.id));
function encTeamPlay(c, dc) {
  const e = c.enc; const team = encTeam(c); if (!team.length) return '';
  e.tmI = num(e.tmI) % team.length; const p = team[e.tmI]; e.tmI++;
  const stat = STATS.reduce((a, b) => p.stats[a] >= p.stats[b] ? a : b); const roll = d(20); const total = roll + mod(p.stats[stat]); const ok = roll === 20 || total >= dc;
  const outcome = roll === 20 ? 'CRITICAL SUCCESS' : total >= dc + 10 ? 'OVERWHELMING SUCCESS' : ok ? 'SUCCESS' : total <= dc - 10 ? 'DISASTER' : 'FAILURE';
  const label = `${p.name}'s play (${SN(stat)}), DC ${dc}`; const extras = [ok ? `${p.name} comes through for the team.` : `${p.name}'s play falls short.`];
  const text = `${label}: rolled ${roll} ${fmt(mod(p.stats[stat]))} = ${total} → ${outcome}. ${extras[0]}`;
  e.log.push({ id: uid(), role: 'roll', text, rollData: { d: roll, total, dc, outcome, success: ok, label, extras } });
  return text;
}
function encAllyDefend(c, who, p, withWhat) {
  const e = c.enc; const dc = who.def + 2; const roll = d(20); const total = roll + mod(p.stats.DEX); const ok = roll === 20 || total >= dc; const extras = [];
  if (!ok) { const dmg = rollDice(who.dmg || 'd6', null, null, roll === 1); p.hp = Math.max(0, num(p.hp) - dmg.total); extras.push(`${p.name} takes ${dmg.total} damage. HP ${p.hp}/${p.maxHp}${p.hp <= 0 ? ', DOWN' : ''}.`); } else extras.push(`${p.name} avoids it.`);
  const label = `${p.name} defends against ${who.name}'s ${cleanReason(withWhat || 'attack')}, DC ${dc}`; const outcome = ok ? 'SUCCESS' : 'FAILURE';
  e.log.push({ id: uid(), role: 'roll', text: `${label}: rolled ${roll} ${fmt(mod(p.stats.DEX))} = ${total} → ${outcome}. ${extras.join(' ')}`, rollData: { d: roll, total, dc, outcome, success: ok, label, extras } });
}
function encNorm(x) {
  const kind = /contest|game|match|race|chase|sport|tournament/i.test(String(x?.kind || '')) ? 'contest' : 'fight';
  return { kind, title: String(x?.title || (kind === 'contest' ? 'The contest' : 'A fight breaks out')).trim().slice(0, 60),
    foes: arr(x?.foes).map(f => String(typeof f === 'object' && f ? f.name || '' : f).trim()).filter(Boolean).slice(0, 8) };
}
function weaponDie(c) {
  const g = arr(c.character.gear).map(x => x.name).join(' ').toLowerCase();
  return /greatsword|greataxe|maul|halberd|warhammer|rifle|shotgun/.test(g) ? 'd10' : /sword|axe|mace|spear|bow|pistol|revolver|blade|hammer|wand|staff of/.test(g) ? 'd8' : /dagger|knife|club|staff|sling|cutter|baton/.test(g) ? 'd6' : 'd4';
}
const encFoes = e => arr(e.foes).filter(f => !f.out);
const encFoe = (e, id) => arr(e.foes).find(f => f.id === id);

/* ---------- cards shown in the story ---------- */
function encOfferHTML(m, c) {
  const o = m.encOffer; if (!o || c.enc || S.busy) return '';
  return `<div class="encoffer"><div class="h">⚔ Encounter: ${esc(o.title)}</div>
    <p>${o.kind === 'contest' ? 'Play this out one play at a time in its own window, then come back to the story.' : 'Play this fight out turn by turn in its own window, then come back to the story.'}</p>
    <div class="row"><button class="btn gold grow" data-act="encbegin" data-mid="${m.id}">Begin</button><button class="btn grow" data-act="encskip" data-mid="${m.id}">Not now</button></div></div>`;
}
function encLineHTML(x) {
  if (x.role === 'roll') { const r = x.rollData || {}; return `<div class="eline roll"><span class="d20 sm ${r.d === 20 ? 'crit' : r.d === 1 ? 'fumble' : ''}">${r.d ?? '?'}</span><span><b>${esc(r.label || '')}</b><br>${S.settings.ui.diceMath !== false ? `${r.d} ${fmt((r.total || 0) - (r.d || 0))} = ` : ''}<b>${r.total}</b> vs ${r.dc} <span class="o ${r.success ? 'success' : 'failure'}">${esc(r.outcome || '')}</span>${arr(r.extras).map(t => `<br>${esc(t)}`).join('')}</span></div>`; }
  if (x.role === 'you') return `<div class="eline you"><div>${esc(x.text)}</div></div>`;
  if (x.role === 'sys') return `<div class="eline sys">${esc(x.text)}</div>`;
  return `<div class="eline gm">${md(x.text)}</div>`;
}
function encLogHTML(m) {
  if (!arr(m.encLog).length) return '';
  const turns = m.encLog.filter(x => x.role === 'you').length;
  return `<details class="enclog"><summary>⚔ ${esc(m.encTitle || 'Encounter')} · ${esc(ENC_OUT[m.encOutcome] || 'Over')} · full log (${turns} turn${turns === 1 ? '' : 's'})</summary><div class="enclogin">${m.encLog.map(encLineHTML).join('')}</div></details>`;
}
function encDockHTML(c) {
  return `<div class="card encbanner"><b>⚔ ${esc(c.enc.title)}</b><span class="hint" style="margin:0">The story is paused until this encounter is over.</span>
    <div class="row"><button class="btn gold grow" data-act="encresume">Resume the encounter</button></div></div>`;
}

/* ---------- starting one ---------- */
async function encStart(c, info, fromMsg) {
  if (!c || c.enc || encBusy() || S.busy) return;
  if (!textReady()) return toast('Set up your Story AI first.');
  if (fromMsg) delete fromMsg.encOffer;
  const e = c.enc = { id: uid(), kind: info.kind, title: info.title, phase: 'setup', foes: [], score: null, round: 1, log: [], pending: null, auto: false, before: snapshot(c), wasCombat: !!c.combat, t: Date.now() };
  c.pendingRoll = null; S.rollResult = null; S.encOpen = true; S.encNew = null;
  const fight = e.kind === 'fight';
  await encBusyRun(c, 'Setting the scene…', async signal => {
    const spec = fight
      ? '{"foes":[{"name":"short name, e.g. Troll brute","tier":"minion|soldier|elite|boss"}],"opening":"2-3 sentences, second person, present tense: how the fight begins and where everyone stands"}'
      : '{"us":"the player\'s side (team or name)","them":"the opposing side","periods":["the parts the contest is played in, e.g. 1st quarter","2nd quarter","3rd quarter","4th quarter"],"opening":"2-3 sentences, second person, present tense: the contest begins and the first situation the player faces"}';
    let j = {};
    try {
      j = tryJSON(stripThink(await chat([
        { role: 'system', content: `You set up ${fight ? 'a fight' : 'a contest (a game, match, race, chase or duel of skill)'} for a tabletop RPG, from the story so far. Use only people and things the story already has. Never decide what the player character does, says, thinks or feels. ${fight ? 'List every enemy who is fighting (at most 6; group a crowd as one). Tier: minion = weak, soldier = trained, elite = dangerous, boss = the main threat.' : 'Pick the real sides from the story.'} Reply with JSON only:\n${spec}` },
        { role: 'user', content: `PLAYER CHARACTER: ${sheetBrief(c)}\n\nENCOUNTER: ${e.title}${info.foes.length ? `\nENEMIES OR OPPONENTS NAMED SO FAR: ${info.foes.join(', ')}` : ''}\n\nRECENT SCENES:\n${storyLines(c, 4)}` }
      ], { stream: false, signal, maxTokens: 500, temperature: 0.5, json: true }))) || {};
    } catch (err) { if (err.name === 'AbortError') throw err; console.warn('Encounter setup failed, using defaults', err); }
    if (fight) {
      const list = arr(j.foes).filter(f => f?.name).slice(0, 6); const src = list.length ? list : (info.foes.length ? info.foes : ['Enemy']).map(n => ({ name: n, tier: 'soldier' }));
      e.foes = src.map(f => { const t = ENC_TIERS[String(f.tier || '').toLowerCase()] || ENC_TIERS.soldier; const D = encDiff(c); const hp = Math.max(3, Math.round(t.hp * D.hp)); return { id: uid(), name: String(f.name).slice(0, 40), hp, maxHp: hp, def: t.def + D.adj, dmg: t.dmg, init: d(20) + Math.floor((t.def - 10) / 3) }; });
      e.allies = activeParty(c).filter(p => num(p.hp) > 0).map(p => p.id);
      c.combat = true;
      e.pending = { kind: 'check', passive: true, init: true, stat: 'DEX', dc: 12, reason: 'act before your enemies (initiative)', applies: [], invokes: [], dcAdj: 0 };
      e.phase = 'roll';
    } else {
      const per = arr(j.periods).map(p => String(p).slice(0, 24)).filter(Boolean).slice(0, 12);
      e.allies = activeParty(c).map(p => p.id); e.benched = [];
      e.score = { us: 0, them: 0, usName: String(j.us || c.character.name).slice(0, 30), themName: String(j.them || info.foes[0] || 'Opponents').slice(0, 30), periods: per.length ? per : ['First half', 'Second half'], pi: 0 };
      e.phase = 'action';
    }
    e.log.push({ id: uid(), role: 'gm', text: String(j.opening || (fight ? 'Steel is out. The fight is on.' : 'It begins.')).slice(0, 900) });
  });
}
/* run one AI step of the encounter: shows what is happening, can be stopped, never leaves the window stuck */
async function encBusyRun(c, label, fn) {
  S.encBusy = label; S.busy = true; S.abort = new AbortController(); const signal = S.abort.signal;
  try { renderEnc(); renderDock(); await fn(signal); }
  catch (err) { if (err.name === 'AbortError') toast('Stopped.'); else { toast('Encounter: ' + (err.message || err), 6000); console.warn(err); } if (c.enc && c.enc.phase === 'setup') { restore(c, c.enc.before); c.enc = null; S.encOpen = false; } else if (c.enc && c.enc.phase === 'busy') c.enc.phase = c.enc.pending ? (c.enc.pending.kind === 'defense' ? 'defense' : 'roll') : 'action'; }
  finally { S.encBusy = null; S.busy = false; S.abort = null; touch(c); if (S.view === 'game' && cur() === c) { renderHUD(); renderDock(); renderLog(); renderEnc(); } scheduleSync(); encAutoStep(c); }
}

/* ---------- the player's move ---------- */
async function encAct(c, text) {
  const e = c.enc; if (!e || encBusy() || e.phase !== 'action') return;
  text = String(text || '').trim(); if (!text) return;
  const traits = turnTraits(c, text).filter(t => t.polarity === '+'); const said = text.replace(TRAIT_TAG, ' ').replace(/\s+/g, ' ').trim();
  e.log.push({ id: uid(), role: 'you', text: said + (traits.length ? ` [✦ ${traits.map(t => t.name).join(', ')}]` : '') });
  e.phase = 'busy';
  await encBusyRun(c, 'The GM weighs your move…', async signal => {
    if (/\b(i\s+)?(surrender|yield|give (myself )?up|lay down my (weapon|arms))\b/i.test(said) && e.kind === 'fight') { e.over = 'surrender'; e.phase = 'over'; return; }
    let ck = encQuickCheck(c, said);
    if (!ck) ck = await encReferee(c, said, signal);
    if (!ck) return encGM(c, `THE PLAYER'S MOVE (no roll needed, it simply happens): ${said}`, signal);
    e.pending = { ...ck, said, invokes: [], dcAdj: 0, momentumPlus: false };
    if (traits.length) { S.encBusy = 'Checking how your traits help…'; renderEnc(); try { await traitRuling(c, e.pending, traits, said, signal); } catch (err) { if (err.name === 'AbortError') throw err; console.warn('Trait ruling failed', err); } }
    e.phase = 'roll';
  });
}
/* obvious moves don't need the AI to decide what to roll */
function encQuickCheck(c, said) {
  const e = c.enc; const ch = c.character; if (e.kind !== 'fight') return null;
  if (/\b(flee|run( away)?|escape|retreat|get away|bolt)\b/i.test(said)) return { kind: 'check', flee: true, stat: 'DEX', dc: 13 + encDiff(c).adj + (encFoes(e).some(f => f.def >= 16) ? 2 : 0), reason: 'get away from the fight', applies: [] };
  if (/\b(attack|strike|hit|slash|stab|cut|shoot|fire|punch|kick|swing|smash|lunge|thrust|charge|bash|cleave|shank)\b/i.test(said)) {
    const live = encFoes(e); if (!live.length) return null;
    const low = said.toLowerCase();
    const foe = live.find(f => low.includes(f.name.toLowerCase()) || f.name.toLowerCase().split(/\s+/).some(w => w.length > 3 && low.includes(w))) || encFoe(e, e.target) && !encFoe(e, e.target).out && encFoe(e, e.target) || live[0];
    const ranged = /\b(shoot|fire|bow|arrow|throw|pistol|rifle|sling)\b/i.test(said);
    const stat = ranged ? 'DEX' : mod(ch.stats.STR) >= mod(ch.stats.DEX) ? 'STR' : 'DEX';
    return { kind: 'attack', stat, dc: foe.def, reason: `hit ${foe.name}`, target: foe.id, damage: weaponDie(c), applies: [] };
  }
  return null;
}
async function encReferee(c, said, signal) {
  const e = c.enc; const fight = e.kind === 'fight';
  const raw = await chat([
    { role: 'system', content: `You are the DICE REFEREE for one ${fight ? 'fight' : 'contest'} in a tabletop RPG that uses a d20. Decide what the player rolls for their move.
${fight ? 'An attack on an enemy is kind "attack" (stat STR or DEX, or the casting stat for a spell; give "target" = the exact enemy name). Anything else risky (a stunt, a spell, a trick, talking them down, grabbing something) is kind "check".' : 'In a contest nearly every play is uncertain: call a check unless the move is trivial. Use kind "check".'}
No roll only for something safe and certain (a word, a look, drawing a weapon).
Stats: STR (force), DEX (agility, aim, speed), CON (endurance), INT (knowledge, tactics), WIS (perception, reading people, willpower), CHA (persuasion, leadership, intimidation).
DC: ${DC_LADDER}.
"reason": what the roll is for, under 10 words, starting with a verb (e.g. "slip the tackle and break for the end zone").
Reply with JSON only: {"check":null} or {"check":{"kind":"check","stat":"DEX","dc":15,"reason":"","target":""}}` },
    { role: 'user', content: `CHARACTER:\n${sheetBrief(c)}\n\n${encStateText(c)}\n\nWHAT JUST HAPPENED:\n${encRecent(e, 4)}\n\nTHE PLAYER'S MOVE NOW: ${said}` }
  ], { stream: false, signal, maxTokens: 200, temperature: 0.2, helper: true, json: true });
  const ck = tryJSON(stripThink(raw))?.check; if (!ck || typeof ck !== 'object' || !(ck.stat || ck.ability)) return null;
  const n = normCheck(ck, c); n.kind = n.kind === 'defense' ? 'check' : n.kind;
  if (n.kind === 'attack') { const foe = findByName(encFoes(e), ck.target) || encFoes(e)[0]; if (!foe) n.kind = 'check'; else { n.target = foe.id; n.dc = foe.def; n.damage = n.damage || weaponDie(c); n.reason = `hit ${foe.name}`; } }
  if (n.kind !== 'attack') n.dc = clamp(n.dc + encDiff(c).adj, 2, 40);
  return n;
}
const encRecent = (e, n) => e.log.slice(-n * 2).map(x => `${x.role === 'gm' ? 'GM' : x.role === 'roll' ? 'DICE' : x.role === 'you' ? 'PLAYER' : 'NOTE'}: ${x.text}`).join('\n');
function encStateText(c) {
  const e = c.enc; const ch = c.character;
  if (e.kind === 'fight') return `THE FIGHT: ${e.title} · round ${e.round}\n${ch.name}: HP ${ch.hp}/${ch.maxHp}\nENEMIES:\n${e.foes.map(f => `- ${f.name}: ${f.out ? (f.out === 'down' ? 'DOWN' : f.out.toUpperCase()) : `HP ${f.hp}/${f.maxHp}${f.hp <= f.maxHp / 2 ? ' (badly hurt)' : ''}`}`).join('\n')}${encAllyList(c).length ? `\nALLIES FIGHTING BESIDE ${ch.name}:\n${encAllyList(c).map(p => `- ${p.name}: ${num(p.hp) <= 0 ? 'DOWN' : `HP ${p.hp}/${p.maxHp}`}`).join('\n')}` : ''}`;
  const s = e.score; return `THE CONTEST: ${e.title}\nSCORE: ${s.usName} ${s.us} : ${s.them} ${s.themName}\nNOW: ${s.periods[s.pi]} (${s.pi + 1} of ${s.periods.length})${encTeam(c).length ? `\nTEAMMATES PLAYING ALONGSIDE ${ch.name} (voice them, give them things to do, never decide ${ch.name}'s moves): ${encTeam(c).map(p => `${p.name}${p.role ? ` (${p.role})` : ''}`).join(', ')}` : ''}`;
}

/* ---------- the roll (always a click, the DC always shown) ---------- */
async function encRoll(c, mode) {
  const e = c.enc; const r = e?.pending; if (!r || encBusy() || S.rolling || !['roll', 'defense'].includes(e.phase)) return;
  const ch = c.character; const def = r.kind === 'defense';
  if (def && !e.auto && !String(r.how || '').trim()) { toast('Say what you do first, then roll.'); $('#encHow')?.focus(); return; }
  const statKey = def && !r.nodmg ? defenseStat(ch, mode || 'dodge') : r.stat;
  S.rolling = true; document.querySelectorAll('#encRoot .encpend button').forEach(b => b.disabled = true);
  let roll;
  if (physical()) roll = await askDice(`${r.kind === 'attack' ? 'Attack' : def ? 'Defense' : SN(r.stat)}: ${r.reason}`, 20, 1);
  else { const die = $('#encdie'); for (let i = 0; i < 9; i++) { if (die) { die.classList.add('rolling'); die.textContent = d(20); } await sleep(55); } roll = d(20); }
  S.rolling = false;
  const mods = rollMods(c, r, statKey); if (def && e.guard) mods.push({ l: 'Braced', v: 2 });
  const total = roll + sumMods(mods); const dc = effDC(r, def && !r.nodmg ? mode : null);
  const success = roll === 20 || total >= dc; const big = roll === 20 || total >= dc + 10;
  const outcome = roll === 20 ? 'CRITICAL SUCCESS' : total >= dc + 10 ? 'OVERWHELMING SUCCESS' : total >= dc ? (roll === 1 ? 'SUCCESS (natural 1: complication)' : 'SUCCESS') : total <= dc - 10 ? 'DISASTER' : (roll === 1 ? 'FAILURE (natural 1: complication)' : 'FAILURE');
  const extras = []; let label; const notes = [];
  if (r.momentumPlus) ch.momentum = Math.max(0, num(ch.momentum) - 1);
  if (e.kind === 'fight' && !r.init) ch.momentum = success ? Math.min(3, num(ch.momentum) + 1) : 0;
  if (r.init) { label = 'Initiative (Dexterity): act before your enemies'; e.first = success ? 'you' : 'foes'; extras.push(success ? 'You act first.' : 'Your enemies move first.'); }
  else if (r.kind === 'attack') {
    const foe = encFoe(e, r.target) || encFoes(e)[0]; label = `Attack roll (${SN(statKey)}) to ${r.reason}, vs Defense ${dc}`;
    if (success && foe) { const dmg = await rollDiceAsync(r.damage || 'd6', ch, statKey, big, 'Your damage'); foe.hp = Math.max(0, foe.hp - dmg.total); extras.push(`Hit for ${dmg.total} (${dmg.text}${big ? ', dice doubled' : ''}). ${foe.name}: ${foe.hp}/${foe.maxHp} HP${foe.hp <= 0 ? ', DOWN' : ''}.`); if (foe.hp <= 0) foe.out = 'down'; }
    else extras.push('Missed.');
  } else if (def && !r.nodmg) {
    const m = mode || 'dodge'; label = `Defense roll (${m}, ${SN(statKey)}) against ${r.reason}, DC ${dc}`;
    const foe = encFoe(e, r.attacker);
    if (!success) { const dmg = await rollDiceAsync(r.enemy_damage || 'd6', null, null, roll === 1, 'Damage you take'); applyDamage(c, dmg.total, notes, roll === 1); extras.push(`You take ${dmg.total} damage (${dmg.text}). HP ${ch.hp}/${ch.maxHp}.`); }
    else if (m === 'counter' && foe && !foe.out) { const dmg = await rollDiceAsync(r.damage || 'd6', ch, statKey, big, 'Counter damage'); foe.hp = Math.max(0, foe.hp - dmg.total); extras.push(`Avoided it and countered for ${dmg.total}. ${foe.name}: ${foe.hp}/${foe.maxHp} HP${foe.hp <= 0 ? ', DOWN' : ''}.`); if (foe.hp <= 0) foe.out = 'down'; }
    else extras.push('Avoided the attack.');
    e.guard = false;
  } else label = `${SN(statKey)} ${def ? 'reaction' : 'check'} to ${r.reason} (DC ${dc})`;
  const how = String(r.how || r.said || '').trim();
  const text = `${label}${how ? ` — the player's move, in their words: "${how}"` : ''}: rolled ${roll} [${mods.map(x => `${x.l} ${fmt(x.v)}`).join(', ')}] = ${total} → ${outcome}. ${extras.join(' ')}`;
  if (def && how) e.log.push({ id: uid(), role: 'you', text: how });
  e.log.push({ id: uid(), role: 'roll', text, rollData: { d: roll, total, dc, outcome, success, label, extras } });
  logRoll(c, { label, d: roll, total, dc, ok: success, outcome, where: e.title });
  const fled = r.flee && success; e.pending = null; e.phase = 'busy'; renderHUD();
  if (e.kind === 'fight' && ch.hp <= 0) { e.over = 'down'; e.phase = 'over'; touch(c); renderEnc(); return; }
  if (fled) { e.over = 'fled'; e.phase = 'over'; touch(c); renderEnc(); return; }
  if (e.kind === 'fight' && !encFoes(e).length) { e.over = 'win'; e.phase = 'over'; touch(c); renderEnc(); return; }
  if (r.init) { e.phase = 'busy'; await encBusyRun(c, 'The fight begins…', signal => encGM(c, e.first === 'you' ? `INITIATIVE: ${ch.name} acts first. In one or two sentences show the enemies bracing, then stop so the player can make the first move. No enemy attack yet.` : `INITIATIVE: the enemies act first. One of them attacks ${ch.name} now: describe it and stop before it lands.`, signal)); return; }
  /* turns alternate: after you defend it is your move, so the enemies don't get a second attack in the same breath */
  const yourTurn = def && e.kind === 'fight';
  /* your companions follow your lead: when you attack, each of them attacks too */
  const teamTxt = e.kind === 'contest' && !def && !r.init ? encTeamPlay(c, dc) : '';
  const allyTxt = r.kind === 'attack' && e.kind === 'fight' ? encAllyTurns(c) : '';
  if (allyTxt && e.kind === 'fight' && !encFoes(e).length) { e.over = 'win'; e.phase = 'over'; touch(c); renderEnc(); return; }
  await encBusyRun(c, 'The GM narrates…', signal => encGM(c, `DICE RESULT (already applied by the app, narrate exactly this): ${text}${allyTxt ? `\nYOUR ALLIES' ATTACKS (already applied by the app; narrate them briefly, with exactly these results): ${allyTxt}` : ''}${teamTxt ? `\nYOUR TEAMMATE'S PLAY IN THE SAME EXCHANGE (already rolled by the app; narrate it with exactly this result, in that teammate's own style, and let it count: a success helps the team's position or score, a failure costs ground): ${teamTxt}` : ''}${yourTurn ? `\nThat was the enemies' attack for this round. Narrate how it lands or misses, then STOP: it is ${ch.name}'s turn now. No new attack ("attack": null).` : ''}`, signal, { noAttack: yourTurn }));
}

/* ---------- the GM's side of a round ---------- */
async function encGM(c, what, signal, o = {}) {
  const e = c.enc; const ch = c.character; const fight = e.kind === 'fight'; const s = e.score;
  const spec = fight
    ? `{"text":"2-4 sentences","attack":null,"foes":[{"name":"exact enemy name","status":"fled|surrendered"}],"over":null}
- "text": second person, present tense. First the result of the player's move exactly as the dice say (use the damage and HP numbers given, never invent others), then what the enemies do.
- "attack": when an enemy who is still standing now attacks ${ch.name}, describe the attack coming in "text", STOP before it lands, and set "attack": {"who":"exact enemy name","with":"what they attack with, 2-5 words","target":"${ch.name}${encAllyList(c).some(p => num(p.hp) > 0) ? `, or the exact name of an ally (${encAllyList(c).filter(p => num(p.hp) > 0).map(p => p.name).join(', ')})` : ''}"}. Enemies attack most rounds. Use null when nobody attacks this round.
- "foes": only enemies who run away or give up this round. The app tracks HP and who is down.
- "over": null while the fight goes on. "talked" if the player's words or actions made the enemies stand down, "surrender" if the player gave up.`
    : `{"text":"2-4 sentences","us_points":0,"them_points":0,"period_over":false,"react":null,"over":null}
- "text": second person, present tense. The result of the player's play exactly as the dice say, what the other side does in answer, then the next situation the player faces.
- "us_points" / "them_points": points scored in THIS exchange only (usually 0). Use the sport's real scoring.
- "period_over": true when this part of the contest (${s.periods[s.pi]}) has run its course; a period lasts about 2-4 exchanges.
- "react": when something comes straight at ${ch.name} and they must react at once (a tackler closing in, a shot at their goal), stop before it resolves and set {"what":"under 10 words","stat":"DEX","dc":14}. Otherwise null.
- "over": null while it goes on; the app ends the contest after the last period.`;
  const raw = await chat([
    { role: 'system', content: `${personaText(c)}\nYou are running ONE ${fight ? 'fight' : 'contest'} turn by turn. THE GOLDEN RULE: never write ${ch.name}'s words, actions, decisions, thoughts or feelings beyond the move the player made. Other characters speak in their own voices: put the speaker's name in braces before each quote, like {Name}"Words." Keep it tight and physical. Content rating: ${c.rating || 'PG-13'} — ${RATING_RULES[c.rating] || RATING_RULES['PG-13']}\nReply with JSON only:\n${spec}` },
    { role: 'user', content: `CHARACTER:\n${sheetBrief(c)}\n\n${encStateText(c)}\n\nSO FAR IN THIS ENCOUNTER:\n${encRecent(e, 5)}\n\nNOW:\n${what}` }
  ], { stream: false, signal, maxTokens: 480, temperature: 0.8, json: true });
  const clean = stripThink(raw).trim(); let j = tryJSON(clean);
  if (!j || typeof j.text !== 'string') j = { text: clean.replace(/^\s*\{[\s\S]*?"text"\s*:\s*"/, '').replace(/"\s*,\s*"(attack|foes|over|us_points)[\s\S]*$/, '') };
  const text = tidyScene(String(j.text || '').trim()).slice(0, 1400) || '…';
  e.log.push({ id: uid(), role: 'gm', text }); e.round++;
  if (S.settings.ui.voice === 'auto') speakMessage(c, { role: 'gm', text }, true);
  if (fight) {
    for (const u of arr(j.foes)) { const f = findByName(encFoes(e), u?.name); const st = String(u?.status || '').toLowerCase(); if (f && /fled|surrender/.test(st)) f.out = /fled/.test(st) ? 'fled' : 'gave up'; }
    const over = String(j.over || '').toLowerCase();
    if (over === 'talked' || over === 'surrender') { e.over = over; e.phase = 'over'; return; }
    if (!encFoes(e).length) { e.over = arr(e.foes).some(f => f.out === 'down') ? 'win' : 'talked'; e.phase = 'over'; return; }
    const who = !o.noAttack && j.attack && typeof j.attack === 'object' ? findByName(encFoes(e), j.attack.who) || encFoes(e)[0] : null;
    const allyHit = who ? encAllyList(c).find(p => num(p.hp) > 0 && findByName([p], j.attack.target)) : null;
    if (allyHit) { encAllyDefend(c, who, allyHit, j.attack.with); e.phase = 'action'; }
    else if (who) { e.pending = { kind: 'defense', stat: 'DEX', dc: who.def + 2, reason: `${who.name}'s ${cleanReason(j.attack.with || 'attack')}`, enemy_damage: who.dmg, damage: weaponDie(c), attacker: who.id, applies: [], invokes: [], dcAdj: 0 }; e.phase = 'defense'; }
    else e.phase = 'action';
    return;
  }
  s.us += clamp(num(j.us_points), 0, 20); s.them += clamp(num(j.them_points), 0, 20);
  e.exch = num(e.exch) + 1;
  if (j.period_over === true || e.exch >= 5) {
    e.exch = 0;
    if (s.pi >= s.periods.length - 1) { e.over = s.us > s.them ? 'win' : s.us < s.them ? 'loss' : 'draw'; e.phase = 'over'; return; }
    e.log.push({ id: uid(), role: 'sys', text: `End of ${s.periods[s.pi]} · ${s.usName} ${s.us} : ${s.them} ${s.themName}` }); s.pi++;
  }
  const re = j.react && typeof j.react === 'object' && String(j.react.what || '').trim() ? j.react : null;
  if (re) { e.pending = { kind: 'defense', nodmg: true, stat: normStat(re.stat), dc: clamp((num(re.dc) || 14) + encDiff(c).adj, 6, 30), reason: cleanReason(re.what), applies: [], invokes: [], dcAdj: 0 }; e.phase = 'defense'; }
  else e.phase = 'action';
}

/* ---------- auto fight: the app plays your side ---------- */
const COMBAT_WORDS = /fight|combat|battle|weapon|sword|blade|axe|bow|aim|shoot|strike|attack|brawl|duel|martial|warrior|soldier|tackl|block|dodge|reflex|strong|quick|fast|athlet|sport|football|run|throw|catch|lead|tactic/i;
function encAutoStep(c) {
  const e = c?.enc; if (!e || !e.auto || encBusy() || S.rolling || cur() !== c || !S.encOpen) return;
  clearTimeout(encAutoStep.t);
  encAutoStep.t = setTimeout(() => {
    const e2 = c.enc; if (!e2 || !e2.auto || encBusy() || S.rolling || !S.encOpen) return;
    const ch = c.character;
    if (e2.phase === 'roll') { const r = e2.pending; if (r && num(ch.momentum) >= 2 && !r.momentumPlus && !r.init) r.momentumPlus = true; return void encRoll(c); }
    if (e2.phase === 'defense') {
      const r = e2.pending; const best = r.nodmg ? null : ['dodge', 'block'].sort((a, b) => mod(ch.stats[defenseStat(ch, b)]) - mod(ch.stats[defenseStat(ch, a)]))[0];
      r.how = r.nodmg ? `I react as fast as I can to ${r.reason}.` : best === 'block' ? 'I plant my feet and block it.' : 'I twist out of the way.';
      return void encRoll(c, best || undefined);
    }
    if (e2.phase !== 'action') return;
    if (e2.kind === 'fight') {
      const live = encFoes(e2); if (!live.length) return;
      const foe = live.slice().sort((a, b) => a.hp - b.hp)[0]; e2.target = foe.id;
      const fit = arr(ch.traits).filter(t => t.polarity === '+' && COMBAT_WORDS.test([t.name, t.trigger, arr(t.effects).join(' ')].join(' '))).sort((a, b) => TV[b.tier] - TV[a.tier]).slice(0, 2);
      return void encAct(c, `I attack ${foe.name} with everything I have.${fit.map(t => ` [✦ ${t.name}]`).join('')}`);
    }
    encAutoPlay(c);
  }, 1100);
}
async function encAutoPlay(c) {
  const e = c.enc; const ch = c.character; if (!e || encBusy()) return;
  let move = '';
  await encBusyRun(c, 'Choosing your best play…', async signal => {
    const pos = arr(ch.traits).filter(t => t.polarity === '+');
    const raw = await chat([
      { role: 'system', content: `You play the PLAYER CHARACTER's side of a contest for a player who switched on auto-play. Choose the single best move for them right now, playing to their highest stats and the traits that genuinely fit. Reply with JSON only: {"move":"one sentence in first person, e.g. I fake the handoff and sprint for the corner","traits":["exact names of at most 2 of their positive traits that clearly help this move"]}` },
      { role: 'user', content: `CHARACTER:\n${sheetBrief(c)}\nStats: ${STATS.map(k => `${k} ${ch.stats[k]}`).join(', ')}\nPositive traits: ${pos.map(traitLine).join(' | ') || 'none'}\n\n${encStateText(c)}\n\nWHAT JUST HAPPENED:\n${encRecent(e, 3)}` }
    ], { stream: false, signal, maxTokens: 160, temperature: 0.6, helper: true, json: true });
    const j = tryJSON(stripThink(raw)) || {};
    const ts = arr(j.traits).map(n => findByName(pos, n)).filter(Boolean).slice(0, 2);
    move = (String(j.move || '').trim().slice(0, 240) || 'I make the smartest play I can see.') + ts.map(t => ` [✦ ${t.name}]`).join('');
  });
  if (move && c.enc && c.enc.auto && c.enc.phase === 'action') encAct(c, move);
}

/* ---------- ending: a recap goes into the story, the full log folds under it ---------- */
async function encFinish(c) {
  const e = c.enc; if (!e || encBusy()) return;
  const ch = c.character; const out = e.over || 'left';
  let recap = '';
  await encBusyRun(c, 'Writing it into the story…', async signal => {
    try {
      recap = tidyScene(stripThink(await chat([
        { role: 'system', content: `${personaText(c)}\nAn encounter that was played out turn by turn has just ended. Write it into the main story as ONE scene: 4-7 sentences, second person, present tense, covering how it went, the turning points that actually happened, how it ended (${ENC_OUT[out] || out}) and exactly where things stand now. Use only events from the log. Never add new actions, words, thoughts or feelings for ${ch.name}. Stop at the moment the player decides what to do next. Story text only.` },
        { role: 'user', content: `${encStateText(c)}\nOUTCOME: ${ENC_OUT[out] || out}\n${ch.name}: HP ${ch.hp}/${ch.maxHp}\n\nFULL LOG:\n${e.log.map(x => `${x.role === 'gm' ? 'GM' : x.role === 'roll' ? 'DICE' : x.role === 'you' ? 'PLAYER' : 'NOTE'}: ${x.text}`).join('\n').slice(-6000)}` }
      ], { stream: false, signal, maxTokens: 600, temperature: 0.7 })).trim());
    } catch (err) { if (err.name === 'AbortError') throw err; console.warn('Encounter recap failed', err); }
    if (!recap) recap = `${e.title} is over: ${(ENC_OUT[out] || out).toLowerCase()}.${e.score ? ` Final score: ${e.score.usName} ${e.score.us}, ${e.score.themName} ${e.score.them}.` : ''}`;
    const notes = []; const ep = out === 'win' ? (arr(e.foes).some(f => f.maxHp >= 60) ? 4 : 3) : out === 'talked' ? 3 : out === 'left' ? 0 : 1;
    if (ep) { ch.ep += ep; notes.push({ t: `+${ep} EP`, k: 'gold' }); }
    if (e.score) notes.push({ t: `Final score: ${e.score.usName} ${e.score.us} : ${e.score.them} ${e.score.themName}`, k: '' });
    c.combat = false; ch.momentum = 0; c.pendingRoll = null;
    c.messages.push({ id: uid(), role: 'gm', text: recap, t: Date.now(), before: e.before, notes, choices: [], encLog: e.log.map(x => ({ role: x.role, text: x.text, ...(x.rollData ? { rollData: x.rollData } : {}) })), encTitle: e.title, encOutcome: out, encKind: e.kind });
    c.mood = out === 'win' || out === 'talked' ? 'triumph' : out === 'loss' || out === 'down' ? 'sad' : 'calm';
    c.enc = null; S.encOpen = false; c.stall = 0;
  });
  if (!c.enc && cur() === c) { renderGame(); autoSpeak(c.messages[c.messages.length - 1], c); setTimeout(() => { if (!S.busy) memoryCheck(c); }, 1500); }
}

/* ---------- the window ---------- */
function renderEnc() {
  const c = cur(); let root = $('#encRoot'); const e = c?.enc;
  if (S.view !== 'game' || !c || (!S.encNew && !(e && S.encOpen))) { root?.remove(); return; }
  if (!root) { root = document.createElement('div'); root.id = 'encRoot'; document.body.appendChild(root); }
  if (!e) {   /* starting one yourself */
    const n = S.encNew;
    root.innerHTML = `<div class="encwrap"><div class="encwin small"><header><b>⚔ Start an encounter</b><button class="iconbtn" data-act="encnewcancel" aria-label="Close">${icon('x')}</button></header>
      <div class="encform"><p class="hint" style="margin-top:0;color:var(--ink)">Play out what is happening right now, turn by turn, in its own window. When it ends, the story picks up from the result.</p>
      <div class="gseg"><button class="segbtn ${n.kind === 'fight' ? 'on' : ''}" data-act="encnewkind" data-k="fight"><b>A fight</b><small>Health bars, attacks, defense</small></button><button class="segbtn ${n.kind === 'contest' ? 'on' : ''}" data-act="encnewkind" data-k="contest"><b>A contest</b><small>A game, race, chase or duel with a score</small></button></div>
      <label class="f"><span>What is it? (optional)</span><input id="encNewTitle" value="${esc(n.title || '')}" placeholder="${n.kind === 'fight' ? 'e.g. Ambush on the forest road' : 'e.g. Friday night game vs Chattahoochee'}"></label>
      <button class="btn gold wide" data-act="encnewgo" style="margin-top:12px">Begin</button></div></div></div>`;
    return;
  }
  const ch = c.character; const keep = $('#encInput')?.value || ''; const keepHow = $('#encHow')?.value;
  const hpPct = ch.maxHp ? Math.round(ch.hp / ch.maxHp * 100) : 0;
  const bar = (name, hp, max, cls, extra = '') => `<div class="ebar ${cls}" ${extra}><div class="en"><b>${esc(name)}</b><span>${hp}/${max}</span></div><div class="hpbar ${max && hp / max > .5 ? 'ok' : ''}"><i style="width:${max ? Math.round(hp / max * 100) : 0}%"></i></div></div>`;
  const turnNow = e.phase === 'defense' ? (encFoe(e, e.pending?.attacker)?.name || 'Opponent') : e.phase === 'over' ? '' : ch.name;
  const order = e.kind === 'fight' && e.first ? (al => e.first === 'you' ? [ch.name, ...al, ...encFoes(e).slice().sort((a, b) => b.init - a.init).map(f => f.name)] : [...encFoes(e).slice().sort((a, b) => b.init - a.init).map(f => f.name), ch.name, ...al])(encAllyList(c).filter(p => num(p.hp) > 0).map(p => p.name)) : [];
  const top = e.kind === 'fight'
    ? `<div class="encbars"><div class="ecol">${bar(ch.name, ch.hp, ch.maxHp, 'me')}${encAllyList(c).map(p => num(p.hp) <= 0 ? `<div class="ebar out"><div class="en"><b>${esc(p.name)}</b><span>Down</span></div></div>` : bar(p.name, p.hp, p.maxHp, 'ally')).join('')}<div class="emom">Momentum ${[0, 1, 2].map(i => `<i class="pip ${i < num(ch.momentum) ? 'on' : ''}"></i>`).join('')}</div></div>
        <div class="ecol foes">${e.foes.map(f => f.out ? `<div class="ebar out"><div class="en"><b>${esc(f.name)}</b><span>${f.out === 'down' ? 'Down' : f.out === 'fled' ? 'Fled' : 'Gave up'}</span></div></div>` : bar(f.name, f.hp, f.maxHp, `foe ${e.target === f.id ? 'target' : ''}`, `data-act="enctarget" data-id="${f.id}" title="Tap to target"`)).join('')}</div></div>
       ${order.length ? `<div class="eorder"><span>Turn order</span>${order.map(n => `<i class="${n === turnNow ? 'on' : ''}">${esc(n)}</i>`).join('')}</div>` : ''}`
    : !e.score ? '<div class="eorder"><span>Getting the sides ready…</span></div>'
    : `<div class="escore"><div><small>${esc(e.score.usName)}</small><b>${e.score.us}</b></div><div class="eper"><span>${esc(e.score.periods[e.score.pi])}</span><small>${e.score.pi + 1} of ${e.score.periods.length}</small></div><div><small>${esc(e.score.themName)}</small><b>${e.score.them}</b></div></div>
       <div class="eorder"><span>${bar(ch.name, ch.hp, ch.maxHp, 'me slim')}</span></div>
       ${encAllyList(c).length ? `<div class="eorder team"><span>Teammates</span>${encAllyList(c).map(p => `<button class="chip ${arr(e.benched).includes(p.id) ? '' : 'on'}" data-act="encbench" data-id="${p.id}" title="Tap to put them in or sit them out">${esc(p.name)}${arr(e.benched).includes(p.id) ? ' · sitting out' : ''}</button>`).join('')}</div>` : ''}`;
  const r = e.pending; let bot = '';
  if (encBusy()) bot = `<div class="encwait"><span class="spin sm"></span> ${esc(S.encBusy)} <button class="link" data-act="encstop">Stop</button></div>`;
  else if (e.phase === 'over') bot = `<div class="encover"><div class="h">${esc(ENC_OUT[e.over] || 'Over')}</div>${e.score ? `<p>${esc(e.score.usName)} ${e.score.us} : ${e.score.them} ${esc(e.score.themName)}</p>` : ''}<button class="btn gold wide" data-act="encreturn">Return to the story</button></div>`;
  else if (r && (e.phase === 'roll' || e.phase === 'defense')) {
    const def = r.kind === 'defense'; const mods = rollMods(c, r, def && !r.nodmg ? null : r.stat); const momAvail = num(ch.momentum) - (r.momentumPlus ? 1 : 0);
    const title = r.init ? 'Roll for initiative' : r.kind === 'attack' ? `Attack roll: ${r.reason}` : def ? `Incoming: ${r.reason}` : `Roll to ${r.reason}`;
    const sub = r.kind === 'attack' ? `${SN(r.stat)} · you need ${effDC(r)} or more to hit` : def && !r.nodmg ? `Defense roll · DC ${effDC(r)} · a hit does ${r.enemy_damage}` : `${SN(r.stat)} ${r.passive || def ? 'roll' : 'check'} · DC ${effDC(r)}`;
    const tot = m => fmt(sumMods(rollMods(c, r, defenseStat(ch, m))) + (e.guard ? 2 : 0));
    bot = `<div class="encpend rollcard"><div class="h">${esc(title[0].toUpperCase() + title.slice(1))}</div><div class="r">${esc(sub)}</div>
      ${def ? `<label class="rollhow"><span>What do you do?</span><textarea id="encHow" rows="2" placeholder="${r.nodmg ? 'e.g. I spin off the tackle and keep my feet' : 'e.g. I duck under it and shove him back'}">${esc(keepHow ?? r.how ?? '')}</textarea></label>` : r.passive ? '<p class="rollwhy">A straight check: just roll.</p>' : r.said ? `<p class="rollsaid">Your move: “${esc(r.said)}”</p>` : ''}
      ${S.settings.ui.diceMath === false ? '' : `<div class="mods">${mods.map(x => `<div class="${x.v > 0 ? 'pos' : x.v < 0 ? 'neg' : ''}"><span>${esc(x.l)}${x.why ? `<small>${esc(x.why)}</small>` : ''}</span><span>${fmt(x.v)}</span></div>`).join('')}${r.dcAdj ? `<div class="pos"><span>Good use of a trait: DC lowered</span><span>DC ${fmt(r.dcAdj)}</span></div>` : ''}</div>`}
      ${!r.init && e.kind === 'fight' && momAvail >= 1 && !r.momentumPlus ? '<button class="btn sm wide" data-act="encmom" style="margin-top:6px">Spend 1 Momentum: +3</button>' : ''}
      <div class="d20 bigdie" id="encdie">d20</div>
      ${def && !r.nodmg ? `<div class="defbtns"><button class="btn gold" data-act="encroll" data-mode="dodge">Dodge<small>Dexterity ${tot('dodge')}</small></button><button class="btn gold" data-act="encroll" data-mode="block">Block<small>Strength ${tot('block')}</small></button><button class="btn gold" data-act="encroll" data-mode="counter">Counter<small>${SN(defenseStat(ch, 'counter'))} ${tot('counter')} · DC+3</small></button></div>` : `<button class="btn gold wide" data-act="encroll">🎲 Roll${r.init ? ' for initiative' : ''}</button>`}</div>`;
  } else {
    const fight = e.kind === 'fight'; const q = fight ? [['attack', '⚔ Attack'], ['defend', '🛡 Defend'], ['item', '🎒 Use item'], ['talk', '💬 Talk it out'], ['flee', '🏃 Flee'], ['surrender', '🏳 Surrender']] : [['item', '🎒 Use item'], ['talk', '💬 Say something']];
    bot = `<div class="equick">${q.map(([k, l]) => `<button class="chip" data-act="encquick" data-k="${k}">${l}</button>`).join('')}${arr(ch.traits).some(t => t.polarity === '+') ? `<button class="chip ${S.encDrawer === 'traits' ? 'on' : ''}" data-act="encquick" data-k="traits">✦ Trait</button>` : ''}</div>
      ${S.encDrawer === 'item' ? `<div class="ditems">${arr(ch.gear).map((g, i) => `<button class="ditem" data-act="encpick" data-k="gear" data-i="${i}"><b>${esc(g.name)}</b></button>`).join('') || '<p class="hint">You are not carrying anything.</p>'}</div>` : ''}
      ${S.encDrawer === 'traits' ? `<div class="ditems">${arr(ch.traits).filter(t => t.polarity === '+').map(t => `<button class="ditem" data-act="encpick" data-k="trait" data-id="${esc(t.id)}"><b>✦ ${esc(t.name)} <span class="tb ${t.tier}">${t.tier}</span></b></button>`).join('')}</div>` : ''}
      <div class="composer"><textarea id="encInput" rows="1" placeholder="${fight ? 'What do you do? e.g. I feint high and slash at his leg' : 'What do you do? Describe your play'}">${esc(keep)}</textarea><button class="sendbtn" data-act="encsend" aria-label="Send">${icon('send')}</button></div>`;
  }
  root.innerHTML = `<div class="encwrap"><div class="encwin">
    <header><div class="grow"><b>⚔ ${esc(e.title)}</b><small>${e.kind === 'fight' ? `Round ${e.round}` : 'Contest'}${turnNow && e.phase !== 'over' ? ` · ${e.phase === 'defense' ? esc(turnNow) + ' acts' : 'your move'}` : ''}</small></div>
      <button class="autotog ${e.auto ? 'on' : ''}" data-act="encauto" title="The app plays your side for you. Switch it off any time to step back in.">Auto ${e.kind === 'fight' ? 'fight' : 'play'}<span class="tog ${e.auto ? 'on' : ''}"></span></button>
      <button class="iconbtn" data-act="encmenu" aria-label="More">${icon('dots')}</button></header>
    ${S.encMenu ? `<div class="encmenu"><button class="btn sm" data-act="encmin">Look at the story (pause)</button><button class="btn sm" data-act="sheet">Character sheet</button><button class="btn sm ghost" data-act="encabandon">Call it off (undo the encounter)</button></div>` : ''}
    <div class="enctop">${top}</div>
    <div class="enclogv" id="enclogv">${e.log.map(encLineHTML).join('')}</div>
    <div class="encbot">${bot}</div></div></div>`;
  const lv = $('#enclogv'); if (lv) lv.scrollTop = lv.scrollHeight;
  const inp = $('#encInput'); if (inp) { autoGrow(inp); if (!isPhone() && !S.modal) inp.focus(); }
}

/* ---------- buttons ---------- */
function encAction(act, el, c) {
  if (!c) return false; const e = c.enc;
  switch (act) {
    case 'encbegin': { const m = c.messages.find(x => x.id === el.dataset.mid); if (m?.encOffer) encStart(c, m.encOffer, m); return true; }
    case 'encskip': { const m = c.messages.find(x => x.id === el.dataset.mid); if (m) { delete m.encOffer; touch(c); renderLog(); renderDock(); } return true; }
    case 'encmanual': if (e) { S.encOpen = true; renderEnc(); return true; } if (S.busy) return true; S.encNew = { kind: c.combat ? 'fight' : 'fight', title: '' }; renderEnc(); setTimeout(() => $('#encNewTitle')?.focus(), 40); return true;
    case 'encnewkind': S.encNew = { kind: el.dataset.k, title: $('#encNewTitle')?.value || '' }; renderEnc(); return true;
    case 'encnewcancel': S.encNew = null; renderEnc(); return true;
    case 'encnewgo': { const n = S.encNew; if (!n) return true; const title = ($('#encNewTitle')?.value || '').trim(); encStart(c, encNorm({ kind: n.kind, title: title || (n.kind === 'fight' ? 'The fight' : 'The contest') })); return true; }
    case 'encresume': S.encOpen = true; renderEnc(); return true;
    case 'encmin': S.encOpen = false; S.encMenu = false; renderEnc(); renderDock(); return true;
    case 'encmenu': S.encMenu = !S.encMenu; renderEnc(); return true;
    case 'encstop': S.abort?.abort(); return true;
    case 'encabandon': if (e && !encBusy() && confirm('Call off this encounter and put everything back as it was before it started?')) { restore(c, e.before); c.combat = !!e.wasCombat; c.enc = null; S.encOpen = false; S.encMenu = false; touch(c); renderGame(); } return true;
    case 'encauto': if (e) { e.auto = !e.auto; touch(c); renderEnc(); if (e.auto) encAutoStep(c); else clearTimeout(encAutoStep.t); } return true;
    case 'encbench': if (e) { const id = el.dataset.id; e.benched = arr(e.benched).includes(id) ? e.benched.filter(x => x !== id) : [...arr(e.benched), id]; touch(c); renderEnc(); } return true;
    case 'enctarget': if (e) { e.target = el.dataset.id; renderEnc(); } return true;
    case 'encmom': if (e?.pending) { e.pending.momentumPlus = true; renderEnc(); } return true;
    case 'encroll': if (e) { const h = $('#encHow'); if (h && e.pending) e.pending.how = h.value.trim().slice(0, 400); encRoll(c, el.dataset.mode); } return true;
    case 'encsend': { const inp = $('#encInput'); const t = (inp?.value || '').trim(); if (t && e) { inp.value = ''; S.encDrawer = null; encAct(c, t); } return true; }
    case 'encreturn': encFinish(c); return true;
    case 'encpick': { const inp = $('#encInput'); if (!inp) return true; let ins = ''; if (el.dataset.k === 'gear') { const g = arr(c.character.gear)[num(el.dataset.i)]; if (g) ins = `I use my ${g.name}`; } else { const t = arr(c.character.traits).find(x => x.id === el.dataset.id); if (t) ins = `[✦ ${t.name}]`; }
      if (ins) { inp.value = (inp.value ? inp.value.replace(/\s*$/, ' ') : '') + ins + ' '; S.encDrawer = null; const v = inp.value; renderEnc(); const n = $('#encInput'); if (n) { n.value = v; n.focus(); autoGrow(n); } } return true; }
    case 'encquick': { if (!e || encBusy()) return true; const k = el.dataset.k; const inp = $('#encInput');
      if (k === 'item' || k === 'traits') { S.encDrawer = S.encDrawer === k ? null : k; renderEnc(); return true; }
      S.encDrawer = null;
      if (k === 'attack') { const f = encFoe(e, e.target) && !encFoe(e, e.target).out ? encFoe(e, e.target) : encFoes(e)[0]; if (f) encAct(c, `I attack ${f.name}.`); }
      else if (k === 'defend') { e.guard = true; encAct(c, 'I hold my ground and brace myself.'); }
      else if (k === 'flee') encAct(c, 'I break away and flee the fight.');
      else if (k === 'surrender') { if (confirm('Surrender? The fight ends and the story continues from there.')) encAct(c, 'I surrender.'); }
      else if (k === 'talk' && inp) { inp.value = e.kind === 'fight' ? 'I lower my weapon and try to talk them down: "' : '"'; inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      return true; }
  }
  return false;
}
document.addEventListener('keydown', ev => {
  if (ev.target.id === 'encInput' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && window.matchMedia('(pointer:fine)').matches) { ev.preventDefault(); $('[data-act="encsend"]')?.click(); }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'encInput') autoGrow(ev.target);
  else if (ev.target.id === 'encHow') { const r = cur()?.enc?.pending; if (r) r.how = ev.target.value.slice(0, 400); }
});
