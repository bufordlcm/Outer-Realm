'use strict';
/* ---------- setup wizard ---------- */
function renderSetup() {
  musicScene(null);
  S.view = 'setup';
  const sc = $('.page')?.scrollTop || 0;
  const ready = textReady(); const fid = folderIdFrom(S.settings.drive.folder);
  const hosted = /^https?:/.test(location.protocol);
  app().innerHTML = `<div class="pagebar"><button class="iconbtn" data-act="home">${icon('back')}</button><h2>Setup</h2></div>
  <div class="page">
    <div class="sect">1 · Story AI <small>${ready ? '<span style="color:var(--green)">done</span>' : 'required'}</small></div>
    <p class="hint" style="color:var(--ink)">Get one or more free keys. More than one lets the app switch automatically when a free limit runs out.</p>
    ${getKeysHTML()}
    ${importHTML()}
    <div style="margin-top:12px">${connsHTML()}</div>

    <div class="sect">2 · Images <small><span style="color:var(--green)">ready</span></small></div>
    <p class="hint" style="color:var(--ink)">Scene pictures are free and need no key (they carry a small Pollinations mark, and allow about one picture every 15 seconds).</p>

    <div class="sect">3 · Google Drive saves <small>${Drive.valid() ? '<span style="color:var(--green)">connected</span>' : 'optional'}</small></div>
    <p class="hint" style="color:var(--ink)">Keeps every adventure in your Drive folder so you can play on any device.</p>
    <label class="f"><span>Drive folder link</span><input type="text" data-bind="drive.folder" value="${esc(S.settings.drive.folder)}"></label>
    <p class="hint">${fid ? `Folder ID <code>${esc(fid)}</code>` : '<span style="color:var(--red)">Paste a Google Drive folder link.</span>'}</p>
    <label class="f"><span>Google OAuth Client ID</span><input type="text" data-bind="drive.clientId" value="${esc(S.settings.drive.clientId)}" placeholder="xxxxxxxx.apps.googleusercontent.com"></label>
    <p class="hint">${hosted ? `Made once in Google Cloud Console (the README walks you through it). Its <b>Authorized JavaScript origin</b> must be exactly <code>${esc(location.origin)}</code>.` : 'Drive needs the app opened from its web address (Netlify, GitHub Pages…), not from a file on this device.'}</p>
    <button class="btn ${Drive.valid() ? '' : 'gold'}" data-act="sync" style="margin-top:10px" ${hosted && S.settings.drive.clientId && fid ? '' : 'disabled'}>${icon('cloud')} ${Drive.valid() ? 'Sync now' : 'Connect Google Drive'}</button>
    <p class="hint" id="driveStatus">${esc(S.syncStatus || '')}</p>

    <button class="btn gold wide" data-act="${ready ? 'home' : 'noop'}" style="margin-top:26px;min-height:52px;font-size:17px" ${ready ? '' : 'disabled'}>${ready ? 'Done — start playing' : 'Add a working key to continue'}</button>
  </div>`;
  if (sc) $('.page').scrollTop = sc;
}

function sheetHTML() {
  const c = cur(); if (!c) return ['', ''];
  const ch = c.character;
  const tab = ['sheet','traits','gear','story'].includes(S.modalTab) ? S.modalTab : 'sheet';
  const tabs = tabBtn('sheet','Sheet',tab) + tabBtn('traits','Traits',tab) + tabBtn('gear','Gear',tab) + tabBtn('story','Story',tab);
  const cf = (path, label, type = 'text') => `<label class="f"><span>${label}</span><input type="${type}" data-cbind="${path}" value="${esc(getPath(c, path) ?? '')}"></label>`;
  let body = '';
  if (isCompanion(c)) return ['', `<div style="text-align:center;margin:10px 0 4px">${S.settings.image.mode !== 'off' ? `<div class="sheetport">${ch.portrait ? `<img class="port xl" src="${esc(imageUrl(ch.portrait, c))}" alt="">` : `<div class="port xl ph2">${esc(ch.name[0] || '?')}</div>`}<button class="btn sm ghost" data-act="compportrait" data-id="main">${icon('image')} ${ch.portrait ? 'New portrait' : 'Paint portrait'}</button></div>` : ''}<div style="font-family:var(--display);font-size:30px;font-weight:700;color:var(--gold2)">${esc(ch.name)}</div></div>
    ${cf('character.storyRole', 'Who you are here')}<label class="f"><span>Appearance</span><textarea rows="2" data-cbind="character.appearance">${esc(ch.appearance || '')}</textarea></label><label class="f"><span>About you</span><textarea rows="5" data-cbind="character.backstory">${esc(ch.backstory || '')}</textarea></label>
    <p class="hint">The narrator and cast know what's written here. Things they learn about you as you talk are kept in More → Story tools → Memory.</p>`];
  if (tab === 'sheet') {
    body = `<div style="text-align:center;margin:10px 0 4px">${S.settings.image.mode !== 'off' ? `<div class="sheetport">${ch.portrait ? `<img class="port xl" src="${esc(imageUrl(ch.portrait, c))}" alt="">` : `<div class="port xl ph2">${esc(ch.name[0] || '?')}</div>`}<button class="btn sm ghost" data-act="compportrait" data-id="main">${icon('image')} ${ch.portrait ? 'New portrait' : 'Paint portrait'}</button></div>` : ''}<div style="font-family:var(--display);font-size:30px;font-weight:700;color:var(--gold2)">${esc(ch.name)}</div>
        <div class="hint">${esc(ch.storyRole || '')} · Level ${ch.level} · ${MAGIC_LABEL[c.magicCost] || ''}</div></div>
      <div class="kv">${cf('character.hp', 'HP', 'number')}${cf('character.maxHp', 'Max HP', 'number')}</div>
      <div class="kv">${cf('character.gold', 'Gold', 'number')}<label class="f"><span>Banked</span><div class="row" style="padding:10px 0"><b>${ch.ep}</b> EP · <b>${ch.tp}</b> TP</div></label></div>
      <label class="f"><span>Stats (raised with EP at level-ups)</span></label>
      <div class="statgrid">${STATS.map(k => `<div class="stat" title="${esc(STAT_DESC[k])}"><b>${SN(k)}</b><div class="v">${ch.stats[k]}</div><div class="mod">${fmt(mod(ch.stats[k]))}</div></div>`).join('')}</div>
      <label class="f"><span>Injuries</span></label>
      ${ch.injuries.length ? ch.injuries.map((i, n) => `<div class="quest"><div class="grow"><b>${esc(i.name)}</b> — ${esc(i.effect)}</div><button class="iconbtn sm" data-act="injdel" data-i="${n}">${icon('x')}</button></div>`).join('') : '<p class="hint">None.</p>'}
      <div class="kv">${cf('character.strain', 'Strain', 'number')}${cf('character.momentum', 'Momentum', 'number')}</div>
      <p class="hint">Edits here are seen by the GM next turn.</p>`;
  } else if (tab === 'traits') {
    const card = (t, i) => `<div class="tcard ${t.polarity === '-' ? 'neg' : ''}"><div class="row"><b style="flex:1">${esc(t.name)}</b><span class="tb ${t.tier}">${t.tier} ${t.polarity === '-' ? '−' : '+'}${TV[t.tier]}</span></div>
      <label class="f"><span>Applies to</span><input type="text" data-cbind="character.traits.${i}.trigger" value="${esc(t.trigger)}"></label>
      <label class="f"><span>Story effects (${effectSlots(t.tier)})</span><textarea rows="2" data-cbind="character.traits.${i}.effects" data-list="1">${esc(t.effects.join('\n'))}</textarea></label>
      ${t.source === 'play' ? '<p class="hint">Gained in play.</p>' : ''}</div>`;
    body = `<p class="hint">Tiers change only at level-ups. You can reword triggers and effects here.</p>
      <div class="sect" style="font-size:20px">Positive</div>${ch.traits.map((t, i) => t.polarity === '+' ? card(t, i) : '').join('') || '<p class="hint">None.</p>'}
      <div class="sect" style="font-size:20px">Negative</div>${ch.traits.map((t, i) => t.polarity === '-' ? card(t, i) : '').join('') || '<p class="hint">None.</p>'}`;
  } else if (tab === 'gear') {
    body = ch.gear.map((g, i) => `<div class="gearrow"><input type="text" data-cbind="character.gear.${i}.name" value="${esc(g.name)}">${g.tier ? `<span class="tb ${g.tier}">${g.tier}</span>` : '<span></span>'}<button class="iconbtn sm" data-act="geardel" data-i="${i}">${icon('x')}</button>
        <textarea rows="1" data-cbind="character.gear.${i}.desc" placeholder="What it does">${esc(g.desc)}</textarea></div>`).join('') + `<button class="btn sm" data-act="gearadd" style="margin-top:10px">${icon('plus')} Add item</button>`
      + `<div class="sect" style="font-size:20px">Signatures</div>` + (ch.signatures.length ? ch.signatures.map(s => `<div class="quest"><div class="grow"><b>${esc(s.name)}</b>${s.desc ? ' — ' + esc(s.desc) : ''}</div></div>`).join('') : '<p class="hint">None yet. Rare items, allies and connections you find go here.</p>');
  } else {
    body = `<label class="f"><span>Appearance</span><textarea rows="2" data-cbind="character.appearance">${esc(ch.appearance)}</textarea></label>
      <label class="f"><span>Story role</span><input type="text" data-cbind="character.storyRole" value="${esc(ch.storyRole)}"></label>
      <label class="f"><span>Backstory</span><textarea rows="8" data-cbind="character.backstory">${esc(ch.backstory)}</textarea></label>`;
  }
  return [tabs, body];
}

function journalHTML() {
  const c = cur(); if (!c) return ['', ''];
  const tab = ['quests','world','facts','memory','story','saves','setup'].includes(S.modalTab) ? S.modalTab : 'world';
  const tabs = tabBtn('world','World',tab) + tabBtn('facts','Facts',tab) + tabBtn('memory','Memory',tab) + tabBtn('story','Story so far',tab) + tabBtn('saves','Saves',tab) + tabBtn('setup','Campaign',tab);
  let body = '';
  if (tab === 'facts') body = `<p class="hint">Pinned facts are always true. The GM never contradicts them, and the continuity check enforces them. One per line.</p>
      <label class="f"><span>Pinned facts</span><textarea rows="10" data-cbind="pinned" data-list="1" placeholder="Mara is dead.&#10;I owe the Thieves' Guild 50 gold.">${esc((c.pinned || []).join('\n'))}</textarea></label>
      <button class="btn sm" data-act="fixopen" style="margin-top:12px">${icon('spark')} Fix the story with the GM</button>`;
  else if (tab === 'saves') body = savesHTML();
  else
  if (tab === 'world') body = `<p class="hint">The GM keeps these in mind every turn. Edit freely.</p>
      <label class="f"><span>World notes</span><textarea rows="12" data-cbind="world">${esc(c.world || '')}</textarea></label>
      <p class="hint">🕯 ${esc(timeLabel(worldOf(c)))}</p>
      ${c.factions.length ? `<div class="sect" style="font-size:20px">Factions</div>${c.factions.map(f => `<div class="quest"><div class="grow"><b>${esc(f.name)}</b>${f.desc ? `<div class="hint" style="margin:2px 0 0">${esc(f.desc)}</div>` : ''}</div><span class="pill" style="color:${f.rep > 0 ? 'var(--green)' : f.rep < 0 ? 'var(--red)' : 'var(--muted)'}">${repLabel(f.rep)} ${fmt(f.rep)}</span></div>`).join('')}` : ''}
      ${c.rumors.length ? `<div class="sect" style="font-size:20px">Rumors you've heard</div>${c.rumors.slice(0, 10).map(r => `<div class="quest"><div class="grow">${esc(r.text)}</div><span class="hint" style="margin:0">day ${r.day}</span></div>`).join('')}` : ''}
      <details style="margin-top:14px"><summary class="hint" style="cursor:pointer">Show GM secrets, hidden plan and threats (spoilers)</summary>
        <label class="f"><span>GM secrets</span><textarea rows="7" data-cbind="secrets">${esc(c.secrets || '')}</textarea></label>
        <label class="f"><span>Hidden campaign plan</span><textarea rows="5" data-cbind="plan">${esc(c.plan || '')}</textarea></label>
        <label class="f"><span>Plot roadmap (Act 1: Title | goal, then "- beat" lines)</span><textarea rows="9" data-cbind="roadmap">${esc(c.roadmap || '')}</textarea></label>
        ${c.roadmap ? `<p class="hint" style="white-space:pre-line">${esc(roadmapProgressText(c))}</p><div class="row"><button class="btn sm" data-act="rmback">◀ Previous act</button><button class="btn sm" data-act="rmnext">Next act ▶</button></div>` : ''}
        ${c.threats.length ? `<label class="f"><span>Threats</span></label>${c.threats.map(t => `<div class="quest"><div class="grow"><b>${esc(t.name)}</b> ${t.triggered ? '<span class="note bad">happened</span>' : ''}<div class="hint" style="margin:2px 0 0">${esc(t.effect)}</div></div><span class="pill">${t.progress}/${t.max}</span></div>`).join('')}` : ''}
        ${c.planNotes.length ? `<label class="f"><span>GM private notes</span></label><div class="hint">${c.planNotes.slice(-8).map(n => esc(n)).join('<br>')}</div>` : ''}</details>`;
  else if (tab === 'quests') body = `<p class="hint">📍 ${esc(c.location || 'Unknown location')}</p>` + (c.quests.length ? c.quests.map((q, i) => `<div class="quest ${q.status}"><div class="grow">${esc(q.title)}</div><button class="pill" data-act="qstatus" data-i="${i}">${q.status}</button><button class="iconbtn sm" data-act="qdel" data-i="${i}">${icon('x')}</button></div>`).join('') : '<p class="empty" style="font-size:18px">No quests yet.</p>')
      + `<div class="row" style="margin-top:12px"><input class="grow" type="text" id="newQuest" placeholder="Add a quest"><button class="btn sm" data-act="qadd">Add</button></div>`;
  else if (tab === 'memory') body = `<p class="hint">Facts the GM always keeps in mind. Edit freely (one per line).</p><label class="f"><span>Long-term memory</span><textarea rows="12" data-cbind="memory" data-list="1">${esc(c.memory.join('\n'))}</textarea></label>`;
  else if (tab === 'story') body = `<div class="row" style="margin-top:6px"><button class="btn sm" data-act="recap">${icon('book')} "Previously on…" recap</button><button class="btn sm" data-act="fixopen">${icon('spark')} Fix the story</button></div><p class="hint">Older turns are condensed here so the GM stays consistent on long campaigns.</p><label class="f"><span>Summary</span><textarea rows="14" data-cbind="summary">${esc(c.summary || '')}</textarea></label>`;
  else {
    const cf = (path, label, rows = 0) => rows ? `<label class="f"><span>${label}</span><textarea rows="${rows}" data-cbind="${path}">${esc(getPath(c, path) || '')}</textarea></label>` : `<label class="f"><span>${label}</span><input type="text" data-cbind="${path}" value="${esc(getPath(c, path) || '')}"></label>`;
    body = cf('title', 'Title') + cf('genre', 'Genre / setting') + cf('premise', 'Premise', 5) + cf('tone', 'Tone')
      + `<div class="kv"><label class="f"><span>Content rating</span><select data-cbind="rating">${RATINGS.map(r => `<option ${c.rating === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
         <label class="f"><span>Magic cost</span><select data-cbind="magicCost">${Object.entries(MAGIC_LABEL).map(([k, v]) => `<option value="${k}" ${c.magicCost === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>`
      + `<div class="kv"><label class="f"><span>GM personality</span><select data-cbind="gm.preset">${Object.entries(GM_PRESETS).map(([k, v]) => `<option value="${k}" ${(c.gm?.preset || 'storyteller') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>${cf('gm.name', 'GM name')}</div>`
      + (c.gm?.preset === 'custom' ? cf('gm.style', 'Describe your GM', 2) : `<p class="hint">${esc(GM_PRESETS[c.gm?.preset || 'storyteller']?.style || '')}</p>`)
      + cf('artStyle', 'Art style for this adventure') + cf('gmNotes', 'Standing requests for the GM (Ask the GM adds to these)', 3)
      + (isCompanion(c) ? `<label class="f"><span>Companion style</span><select data-cbind="style">${Object.entries(COMP_STYLES).map(([k, v]) => `<option value="${k}" ${compStyle(c) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>` : '')
      + cf('research.topic', 'Research topic (lookups during play search within this, e.g. "Harry Potter" or "Savannah 1868")')
      + `<label class="check"><input type="checkbox" data-act="researchtoggle" ${c.research?.auto !== false ? 'checked' : ''}><span>Look up new places, people and lore online during play</span></label>`
      + `<label class="check"><input type="checkbox" data-act="combattoggle" ${c.combat ? 'checked' : ''}><span>In combat (tracks Momentum)</span></label>`;
  }
  return [tabs, body];
}

function levelUpHTML() {
  const c = cur(); const L = S.lu; if (!c || !L) return '';
  const o = L.orig, ch = L.ch, b = luCompute();
  const posTraits = ch.traits.filter(t => t.polarity === '+'), negTraits = ch.traits.filter(t => t.polarity === '-');
  return `<div class="lusum"><span class="bpill ${b.epLeft < 0 ? 'over' : 'ok'}">EP ${b.epLeft}</span><span class="bpill ${b.tpLeft < 0 ? 'over' : 'ok'}">TP ${b.tpLeft}</span><span class="bpill">Level ${o.level} → ${o.level + 1}</span></div>
    <p class="hint" style="color:var(--ink)">You gain <b>+5 EP</b> and <b>+2 TP</b>. Roll HP, then spend what you like — the rest stays banked.</p>
    <div class="sect" style="font-size:20px">1 · Hit points</div>
    ${L.hp == null ? `<button class="btn gold" data-act="luhp">Roll 1d8 ${fmt(mod(o.stats.CON))} (Constitution)</button>` : `<p>+<b>${L.hp}</b> max HP → ${o.maxHp + L.hp}</p>`}
    <div class="sect" style="font-size:20px">2 · Convert TP → EP <small>2 TP = 1 EP</small></div>
    <div class="row"><button class="iconbtn sm" data-act="luconv" data-d="-1" ${L.conv <= 0 ? 'disabled' : ''}>${icon('minus')}</button><b>${L.conv} EP</b> <span class="hint" style="margin:0">(−${L.conv * 2} TP)</span><button class="iconbtn sm" data-act="luconv" data-d="1" ${b.tpLeft < 2 ? 'disabled' : ''}>${icon('plus')}</button></div>
    <div class="sect" style="font-size:20px">3 · Raise stats <small>EP</small></div>
    <div class="statgrid">${STATS.map(k => { const next = ch.stats[k] + 1; return `<div class="stat" title="${esc(STAT_DESC[k])}"><b>${SN(k)}</b><div class="v">${ch.stats[k]}${ch.stats[k] > o.stats[k] ? ` <small style="color:var(--green);font-size:13px">+${ch.stats[k] - o.stats[k]}</small>` : ''}</div><div class="mod">${fmt(mod(ch.stats[k]))}</div>
      <div class="act"><button class="iconbtn sm" data-act="lustat" data-k="${k}" data-d="-1" ${ch.stats[k] <= o.stats[k] ? 'disabled' : ''}>${icon('minus')}</button><button class="iconbtn sm" data-act="lustat" data-k="${k}" data-d="1" ${next > 20 || epCostTo(next) > b.epLeft ? 'disabled' : ''}>${icon('plus')}</button></div>
      <div class="hint" style="margin:2px 0 0;font-size:11.5px">${next <= 20 ? `next ${epCostTo(next)} EP` : 'max'}</div></div>`; }).join('')}</div>
    <div class="sect" style="font-size:20px">4 · Upgrade traits <small>TP</small></div>
    ${posTraits.map(t => { const ot = o.traits.find(x => x.id === t.id); const ti = TIERS.indexOf(t.tier); const isNew = !ot; const i = ch.traits.indexOf(t);
      const upCost = ti < 4 ? POS_COST[TIERS[ti + 1]] - POS_COST[t.tier] : 0;
      return `<div class="tcard"><div class="row"><b style="flex:1">${esc(t.name)}${isNew ? ' <span class="note good">new</span>' : ''}</b><span class="tb ${t.tier}">${t.tier} +${TV[t.tier]}</span>
        ${!isNew && ti > TIERS.indexOf(ot.tier) ? `<button class="iconbtn sm" data-act="lutier" data-id="${t.id}" data-d="-1">${icon('minus')}</button>` : ''}
        ${isNew ? `<button class="iconbtn sm" data-act="ludelnew" data-id="${t.id}">${icon('x')}</button>` : ti < 4 ? `<button class="btn sm" data-act="lutier" data-id="${t.id}" data-d="1" ${upCost > b.tpLeft ? 'disabled' : ''}>Up to ${TIERS[ti + 1]} (${upCost} TP)</button>` : ''}</div>
        ${(!isNew && t.tier !== ot.tier) || isNew ? `<label class="f"><span>Story effects (${effectSlots(t.tier)}) — one per line</span><textarea rows="2" data-lpath="traits.${i}.effects" data-list="1">${esc(t.effects.join('\n'))}</textarea></label>` : ''}</div>`; }).join('') || '<p class="hint">No positive traits yet.</p>'}
    <div class="card" style="margin-top:12px"><b>New positive trait</b>
      <div class="row" style="margin-top:8px"><input class="grow" type="text" id="luName" placeholder="Keen Hearing"><select id="luTier" style="width:auto">${TIERS.map(x => `<option value="${x}">${x} (${POS_COST[x]} TP)</option>`).join('')}</select></div>
      <input type="text" id="luTrigger" placeholder="Applies to… (listening, noticing sounds)" style="margin-top:8px">
      <textarea id="luEffects" rows="2" placeholder="Story effects, one per line" style="margin-top:8px"></textarea>
      <button class="btn sm" data-act="luadd" style="margin-top:8px">${icon('plus')} Add trait</button></div>
    <div class="sect" style="font-size:20px">5 · Overcome a weakness <small>only if the story allows</small></div>
    ${negTraits.map(t => { const on = L.removed.includes(t.id); return `<div class="tcard neg"><div class="row"><b style="flex:1;${on ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.name)}</b><span class="tb ${t.tier}">${t.tier} −${TV[t.tier]}</span>
        <button class="btn sm" data-act="lurem" data-id="${t.id}" ${!on && POS_COST[t.tier] > b.tpLeft ? 'disabled' : ''}>${on ? 'Keep it' : `Remove (${POS_COST[t.tier]} TP)`}</button></div></div>`; }).join('') || '<p class="hint">No negative traits.</p>'}
    <button class="btn gold wide" data-act="lufinish" style="margin-top:22px;min-height:50px" ${L.hp == null ? 'disabled' : ''}>Finish level-up</button>
    <button class="link" data-act="lureset" style="display:block;margin:8px auto 0">Start over</button>`;
}

function guideHTML() {
  const tab = ['rules','play','setup'].includes(S.modalTab) ? S.modalTab : 'rules';
  const tabs = tabBtn('rules','Rules',tab) + tabBtn('play','Playing',tab) + tabBtn('setup','Setup',tab);
  let body = '';
  if (tab === 'rules') body = `<div class="guide">
    <p><b>Every check:</b> d20 + stat modifier + every trait that applies, vs. the DC the GM sets from the task.</p>
    <ul><li><b>DCs:</b> 8 very easy · 12 easy · 18 moderate · 20 hard · 25 very hard · 30 nearly impossible.</li>
      <li><b>Results:</b> beat the DC by 10+ = Overwhelming Success; miss by 10+ = Disaster; natural 20 always succeeds; natural 1 adds a complication.</li>
      <li><b>Traits:</b> tier D–S = ±1 to ±5. Positives count when you invoke them; negatives count whenever they fit. No cap.</li>
      <li><b>Combat:</b> attack vs. enemy Defense, then roll weapon damage. Enemies telegraph moves and you defend — dodge (Dexterity), block (Strength) or counter (DC+3). Each success builds Momentum (max 3): spend for +3 or a reroll.</li>
      <li><b>Wounds:</b> losing over half your HP in one blow, or a natural 1 on defense, gives an injury (−2 until rest). Permanent wounds become negative traits and pay TP.</li>
      <li><b>Healing:</b> downtime heals fully; otherwise only potions, magic and healers.</li>
      <li><b>Growth:</b> EP raises stats, TP buys and upgrades traits — both spent at level-ups, which come at story milestones.</li></ul></div>`;
  else if (tab === 'play') body = `<div class="guide"><ol>
      <li>Type what you do, or tap a suggested action.</li>
      <li>When the GM calls a check, a roll card appears with the DC and every modifier.</li>
      <li>Tap <b>Invoke a trait</b>, pick traits and say exactly how they help. The GM rules full fit (whole bonus), partial (half) or no fit — or lowers the DC.</li>
      <li>Roll. In combat you can spend Momentum for +3 before, or a reroll after a miss.</li>
      <li>The HUD at the top shows HP, EP, TP, Momentum, Strain and injuries — tap it for your full sheet.</li>
      <li><b>Session zero:</b> when starting an adventure, chat with your GM first; it builds the world, factions, hidden threats and a campaign plan from what you say.</li>
      <li><b>The world moves:</b> time of day, weather and days pass; factions remember you (Journal → World); when days pass, villains act off-screen and rumors spread. Playing into your flaws can earn bonus EP.</li>
      <li><b>Ask GM</b> (next to the text box) opens table talk with your GM: rules, recaps, hints, or requests like "less combat". Requests are saved and followed.</li>
      <li><b>Edit</b> under any GM message fixes small slips. <b>Fix story</b> lets you tell the GM what went wrong; it shows its changes before saving. Journal → <b>Facts</b> holds things that are always true.</li>
      <li>Journal → <b>Saves</b>: make save points and go back to them. One is made automatically at each chapter end.</li>
      <li><b>Retry</b> rewrites the GM's last reply. <b>Undo turn</b> takes back your last action.</li>
      <li>Own dice? Settings → Display → <b>Use my own physical dice</b>.</li></ol></div>`;
  else body = `<div class="guide"><ol>
      <li><b>AI:</b> Settings → Story AI. OpenRouter is easiest — free account, "Get a free key", then Browse models and pick a free one.</li>
      <li><b>Images:</b> work with no setup (Pollinations).</li>
      <li><b>Any device:</b> host this file free (Netlify Drop, GitHub Pages, Cloudflare Pages); on iPhone use Share → Add to Home Screen.</li>
      <li><b>Google Drive:</b> paste your folder link and OAuth Client ID in Settings → Google Drive (README has the steps). Each adventure gets its own subfolder.</li></ol></div>`;
  return [tabs, body];
}

/* ---------- misc actions ---------- */
/* ---------- key import ---------- */
const KEY_PATTERNS = [
  ['openrouter', /sk-or-[A-Za-z0-9_-]{20,}/],
  ['gemini', /AIza[0-9A-Za-z_-]{30,}/],
  ['gemini', /\bAQ\.[0-9A-Za-z_-]{30,}/],
  ['groq', /\bgsk_[A-Za-z0-9]{20,}/]
];
const LABEL_WORDS = [['openrouter', /open\s*router/i], ['gemini', /gemini|google\s*ai|ai\s*studio/i], ['pollinations', /pollinations?/i], ['ollama', /ollama/i], ['groq', /groq/i], ['custom', /custom|lm\s*studio|kobold/i]];
const CLIENT_ID_RE = /[0-9]{6,}-[a-z0-9]{10,}\.apps\.googleusercontent\.com/;
const FOLDER_RE = /https?:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[\w-]{10,}/;
/* Reads anything: our key template, a .env file, a JSON export, or keys pasted from anywhere. */
function parseKeys(text) {
  const out = { conns: [], clientId: '', folder: '', polliKey: '', blocked: [] };
  text = String(text || '');
  try {
    const j = JSON.parse(text);
    if (j && Array.isArray(j.conns)) {
      for (const c of j.conns) if (c && (c.apiKey || c.preset === 'ollama' || c.preset === 'custom')) out.conns.push({ preset: PRESETS[c.preset] ? c.preset : 'custom', apiKey: c.apiKey || '', model: c.model || '', baseUrl: c.baseUrl || '', label: c.label || '' });
      out.clientId = j.clientId || ''; out.folder = j.folder || ''; out.polliKey = j.polliKey || '';
      return out;
    }
    if (j && typeof j === 'object') text = Object.entries(j).map(([k, v]) => `${k} = ${typeof v === 'string' ? v : ''}`).join('\n');
  } catch {}
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/^\s*(export\s+)?/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const cid = line.match(CLIENT_ID_RE); if (cid) { out.clientId = cid[0]; continue; }
    const fol = line.match(FOLDER_RE); if (fol) { out.folder = fol[0]; continue; }
    const sep = line.search(/=|:\s/);
    const label = sep > 0 ? line.slice(0, sep) : '';
    let value = (sep > 0 ? line.slice(sep + 1) : line).replace(/\s+#.*$/, '').replace(/^[\s:=]+/, '').replace(/^["'`]|["'`,;]+$/g, '').trim();
    let preset = (LABEL_WORDS.find(([, re]) => re.test(label)) || [])[0] || '';
    let key = '';
    for (const [p, re] of KEY_PATTERNS) { const m = value.match(re); if (m) { key = m[0]; if (!preset || p === 'openrouter') preset = p; break; } }
    if (!key && preset && value && !/\s/.test(value) && !/^https?:/.test(value)) key = value;
    const blockedName = preset === 'groq' ? 'Groq' : (!key.startsWith('sk-or-') && /cerebras/i.test(label)) ? 'Cerebras' : '';
    if (blockedName) { if (value) out.blocked.push(blockedName[0].toUpperCase() + blockedName.slice(1)); continue; }
    if (preset === 'ollama' || (preset === 'custom' && /^https?:/.test(value))) { if (/^https?:/.test(value)) out.conns.push({ preset, apiKey: '', baseUrl: value.replace(/\/+$/, ''), model: '' }); continue; }
    if (!key || !preset) continue;
    if (preset === 'pollinations') { if (!key.startsWith('sk_')) { out.blocked.push('Pollinations pk_ key (no longer generates — needs sk_)'); continue; } out.polliKey = key; }
    out.conns.push({ preset, apiKey: key, model: '' });
  }
  return out;
}
async function importKeys(text, { quiet } = {}) {
  const p = parseKeys(text); const added = [];
  for (const c of p.conns) {
    const ex = conns().find(x => (c.apiKey && x.apiKey === c.apiKey) || (!c.apiKey && x.baseUrl === (c.baseUrl || PRESETS[c.preset].baseUrl)));
    if (ex) { if (c.model && !ex.model) ex.model = c.model; continue; }
    const n = newConn(c.preset, c.apiKey, { ...(c.baseUrl ? { baseUrl: c.baseUrl } : {}), ...(c.model ? { model: c.model } : {}), ...(c.label ? { label: c.label } : {}) });
    conns().push(n); added.push(n);
  }
  let extras = [];
  if (p.polliKey && !S.settings.image.polliKey) { S.settings.image.polliKey = p.polliKey; extras.push('image key'); }
  if (p.clientId && S.settings.drive.clientId !== p.clientId) { S.settings.drive.clientId = p.clientId; extras.push('Google Client ID'); }
  if (p.folder && folderIdFrom(p.folder) && folderIdFrom(S.settings.drive.folder) !== folderIdFrom(p.folder)) { S.settings.drive.folder = p.folder; extras.push('Drive folder'); }
  if (!S.settings.ai.active || !conns().some(c => c.id === S.settings.ai.active)) S.settings.ai.active = (added[0] || conns()[0] || {}).id || '';
  saveSettings();
  if (!quiet) {
    const bits = [];
    if (added.length) bits.push(`Added ${added.map(c => c.label).join(', ')}`);
    if (extras.length) bits.push('saved ' + extras.join(', '));
    if (p.blocked.length) bits.push(`skipped ${[...new Set(p.blocked)].join(', ')} (blocks browser apps)`);
    toast(bits.length ? bits.join(' · ') + '.' : 'No new keys found. Check the text, or add one manually.', 5500);
  }
  rerender();
  for (const c of added) setupConn(c);
  return added;
}

/* ---------- models & testing ---------- */
async function listModels(conn) {
  const headers = {}; if (conn.apiKey) headers.Authorization = 'Bearer ' + conn.apiKey.trim();
  const r = await fetch(conn.baseUrl.trim().replace(/\/+$/, '') + '/models', { headers });
  if (!r.ok) throw new Error('HTTP ' + r.status + (conn.preset === 'ollama' && r.status === 403 ? ' — Ollama refused this address. On the PC, add the user variable OLLAMA_HOST = 0.0.0.0:11434 and restart Ollama' : r.status === 401 || r.status === 403 ? ' — check the key' : ''));
  const j = await r.json();
  let list = (j.data || j.models || []).map(m => ({ id: String(m.id || m.name || '').replace(/^models\//, ''), ctx: m.context_length || m.context_window || 0,
    free: /:free$/.test(m.id || '') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0) }))
    .filter(m => m.id && !/embed|whisper|tts|guard|moderation|image|audio|vision-only|aqa|imagen|veo|learnlm|native-audio|live/i.test(m.id));
  if (PRESETS[conn.preset]?.freeOnly) list = list.filter(m => m.free);
  list.sort((a, b) => (b.free - a.free) || (b.ctx - a.ctx) || a.id.localeCompare(b.id));
  return list;
}
/* Models in the order worth trying: preset preferences first, newest Gemini Flash first */
const verOf = id => (String(id).match(/(\d+(?:\.\d+)?)/) || [0, 0])[1] * 1;
function modelCandidates(conn, list) {
  let ids = list.map(m => m.id).filter(Boolean);
  if (conn.preset === 'gemini') {
    const flash = ids.filter(id => /^gemini-[\d.]+-flash$/.test(id)).sort((a, b) => verOf(b) - verOf(a));
    const flashx = ids.filter(id => /^gemini-[\d.]+-flash/.test(id) && !/(lite|image|tts|live|audio|embedding|thinking|native)/.test(id) && !flash.includes(id)).sort((a, b) => verOf(b) - verOf(a));
    ids = [...flash, ...(ids.includes('gemini-flash-latest') ? ['gemini-flash-latest'] : []), ...flashx, ...ids];
  } else {
    const out = []; for (const re of PRESETS[conn.preset]?.pick || [/./]) for (const id of ids) if (re.test(id) && !out.includes(id)) out.push(id);
    ids = [...out, ...ids];
  }
  ids = [...new Set(ids)];
  if (!ids.length && PRESETS[conn.preset]?.defaultModel) ids = [PRESETS[conn.preset].defaultModel];
  return ids;
}
function pickModel(conn, list) { return modelCandidates(conn, list)[0] || ''; }
async function testConn(conn) {
  if (!conn.model) throw new Error('No model chosen.');
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), conn.preset === 'ollama' ? 120000 : 60000);
  let r;
  try { r = stripThink(await chatOne(conn, [{ role:'user', content:'Reply with exactly: The tavern door creaks open.' }], { stream:false, maxTokens:300, temperature:0, signal: ctl.signal })).trim(); }
  catch (e) { if (e.name === 'AbortError') throw new Error(conn.preset === 'ollama' ? 'No answer after 2 minutes. Is Ollama running, and is the model loaded? Tap Test again.' : 'No answer after a minute: this free model is probably overloaded. Tap Test again later, or pick another model.'); throw e; }
  finally { clearTimeout(tm); }
  if (!r) throw new Error('Connected, but the reply was empty (it may be a "thinking" model that ran out of room). Tap Test again, or pick another model.');
  return r;
}
/* Story-only models (trained on narrative) write great scenes but are shaky at the JSON rule steps.
   When one is the story model and a good instruction model is installed, pair them automatically. */
const STORY_ONLY = /wayfarer|rocinante|celeste|nemomix|magnum|mn-12b|unslop/i;
const HELPER_PICK = [/^dolphin3/i, /^dolphin/i, /^hermes3/i, /qwen3/i, /^qwen/i, /^llama3/i];
async function autoPair(conn) {
  if (conn.preset !== 'ollama' || conn.id !== S.settings.ai.active) return;
  const ai = S.settings.ai;
  if (!STORY_ONLY.test(conn.model)) { if (ai.helperAuto && ai.helperModel === ai.helperAuto) { ai.helperModel = ''; ai.helperAuto = ''; toast('Story model can handle the rule steps itself; helper model cleared.', 4500); } return; }
  if (ai.helperModel.trim() || ai.helperAuto === 'off') return;   /* 'off': the player chose one model for everything */
  if (!conn.models?.length) { try { conn.models = (await listModels(conn)).slice(0, 400).map(m => m.id); } catch { return; } }
  const others = conn.models.filter(m => m !== conn.model && !STORY_ONLY.test(m));
  let h = ''; for (const re of HELPER_PICK) { h = others.find(m => re.test(m)) || ''; if (h) break; }
  if (h) { ai.helperModel = h; ai.helperAuto = h; toast(`Paired: ${conn.model.split('/').pop()} writes the story, ${h} handles dice and records.`, 6000); }
  else toast('Tip: this story model works best with a helper. On the PC run "ollama pull dolphin3", then pick Wayfarer again.', 8000);
}
/* Fetch models → auto-pick → test. Updates the card as it goes. */
async function setupConn(conn, { repick } = {}) {
  conn.status = 'working'; conn.note = 'Finding a free model…'; refreshConnUI();
  try {
    let list = null;
    const loadList = async () => { if (list) return list; list = []; try { list = await listModels(conn); conn.models = list.slice(0, 400).map(m => m.id); conn.modelInfo = list.slice(0, 400).map(m => ({ id: m.id, free: !!m.free })); } catch (e) { conn.note = 'Couldn\'t list models (' + e.message + ').'; } return list; };
    if (!conn.model || repick) { conn.model = pickModel(conn, await loadList()); if (!conn.model) throw new Error(conn.note || 'No usable models found for this key.'); }
    conn.note = 'Testing…'; refreshConnUI();
    /* if a model is retired or restricted (404/403), try the next good one automatically */
    try { await testConn(conn); }
    catch (e) {
      if (![400, 403, 404].includes(e.status) && !/not found|no longer|only available|not supported|unavailable/i.test(e.message)) throw e;
      const tried = new Set([conn.model]); let ok = false, last = e;
      for (const id of modelCandidates(conn, await loadList()).filter(x => !tried.has(x)).slice(0, 6)) {
        conn.model = id; tried.add(id); conn.note = `Trying ${id.split('/').pop()}…`; refreshConnUI();
        try { await testConn(conn); ok = true; break; } catch (e2) { last = e2; if (e2.retry && ![400, 403, 404].includes(e2.status)) break; }
      }
      if (!ok) throw last;
    }
    conn.status = 'ok'; conn.note = 'Ready';
    if (!connReady(conns().find(c => c.id === S.settings.ai.active)) || conns().find(c => c.id === S.settings.ai.active)?.status === 'error') S.settings.ai.active = conn.id;
    await autoPair(conn);
  } catch (e) { conn.status = 'error'; conn.note = e.message; }
  saveSettings(); refreshConnUI();
}
/* Looks for Ollama running on this computer and adds it, picking the best installed model. */
const isPhone = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
async function detectOllama({ quiet } = {}) {
  if (conns().some(c => c.preset === 'ollama' && /localhost|127\.0\.0\.1/.test(c.baseUrl))) { if (!quiet) toast('Ollama is already connected.'); return false; }
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('http://localhost:11434/api/tags', { signal: ctl.signal }); clearTimeout(tm);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); const names = (j.models || []).map(m => m.name || m.model).filter(Boolean);
    if (!names.length) { if (!quiet) toast('Ollama is running but has no models yet. In Command Prompt run: ollama pull dolphin3', 7000); return false; }
    const c = newConn('ollama', '', {}); conns().unshift(c); S.settings.ai.active = c.id; saveSettings();
    toast('Found Ollama on this computer — setting it up…', 4000); refreshConnUI(); await setupConn(c);
    return true;
  } catch (e) {
    if (!quiet) toast('Couldn\'t find Ollama on this computer. Is the llama icon by the clock? If Chrome asked about local network access, choose Allow.', 7000);
    return false;
  }
}
function refreshConnUI() { if (S.view === 'setup') renderSetup(); else if (S.modal === 'settings') renderModal(); else if (S.view === 'library') renderLibrary(); }
function keysFileContent() {
  return JSON.stringify({ ironquillKeys: 1, savedAt: new Date().toISOString(),
    conns: conns().map(c => ({ preset: c.preset, label: c.label, baseUrl: c.baseUrl, apiKey: c.apiKey, model: c.model })),
    polliKey: S.settings.image.polliKey, clientId: S.settings.drive.clientId, folder: S.settings.drive.folder }, null, 1);
}
function download(name, text, type = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const KEY_TEMPLATE = `# Outer Realm keys — fill in what you have, leave the rest blank.
# Then in the app: Setup (or Settings → Story AI) → Import keys file.
# Tip: put the filled-in file in your Drive folder and every device
# picks the keys up automatically when it connects to Google Drive.

# Story AI (free) — get at least one; both lets the app switch when one is busy
openrouter =          # https://openrouter.ai/settings/keys      (starts with sk-or-)
gemini =              # https://aistudio.google.com/apikey       (starts with AQ. or AIza)

# Scene images are free and need no key.

# Optional
ollama =              # http://localhost:11434/v1  (only if you run Ollama on this computer)

# Google Drive saving
google_client_id =    # from Google Cloud Console (ends in .apps.googleusercontent.com)
drive_folder = ${DEFAULT_DRIVE_FOLDER}
`;
async function testImage() {
  const box = $('#imgPrev'); if (!box) return;
  if (S.settings.image.mode === 'local') {
    box.innerHTML = '<div style="padding:14px" class="hint"><span class="spin sm" style="display:inline-block;vertical-align:-3px;margin-right:8px"></span>Painting on your PC… the first picture can take a minute or two while the model loads.</div>';
    const t0 = Date.now(); const style = (cur()?.artStyle || S.settings.image.style || PHOTO_STYLE).trim();
    try { const blob = await forgeGenerate(forgeJob('a lantern-lit stone tavern at dusk in a misty mountain village, an old innkeeper in the doorway, ' + style, d(99999), null));
      box.innerHTML = `<div class="hint">✓ Done in ${Math.round((Date.now() - t0) / 1000)} seconds.</div><img src="${URL.createObjectURL(blob)}" alt="">`; }
    catch (e) { box.innerHTML = `<div class="hint" style="color:var(--red)">✗ ${esc(e.message)}</div>`; }
    return;
  }
  const url = imageUrl({ prompt:'a lantern-lit stone tavern at dusk in a misty mountain village', seed: d(99999) }, null);
  box.innerHTML = `<div style="padding:14px" class="hint">Loading… (5–20 seconds)</div><img src="${esc(url)}" onload="this.previousElementSibling.remove()" onerror="this.previousElementSibling.textContent='✗ Image failed — check the key/model or wait 15 seconds.'">`;
}
function exportFile() {
  const blob = new Blob([JSON.stringify(exportData(false), null, 1)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ironquill-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const data = JSON.parse(await f.text()); if (!data.campaigns) throw new Error('Not an Outer Realm backup file.');
    for (const c of Object.values(data.campaigns)) c.updatedAt = Math.max(c.updatedAt || 0, (S.campaigns[c.id]?.updatedAt || 0) + 1);
    data.deleted = {}; mergeIn(data); toast(`Restored — ${Object.keys(data.campaigns).length} adventure(s).`); rerender(); scheduleSync();
  } catch (err) { toast('Restore failed: ' + err.message, 5000); }
});

