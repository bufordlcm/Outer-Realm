'use strict';
/* =========================================================================
   Game screen pieces: the slide-out story panel (Character / Campaign / World),
   "The world shifts" card and the choice cards
   ========================================================================= */
const choiceParts = ch => { const s = String(ch || ''); const i = s.indexOf('|'); return i > 0 ? { title: s.slice(0, i).trim(), act: s.slice(i + 1).trim() || s.slice(0, i).trim() } : { title: '', act: s.trim() }; };
const TRUST_TAG = t => t >= 2 ? 'devoted' : t >= 1 ? 'friendly' : t <= -2 ? 'hostile' : t <= -1 ? 'wary' : 'neutral';
const tagHTML = f => f ? `<span class="rtag ${f}">${f}</span>` : '';

/* ---------- the world shifts ---------- */
function shiftHTML(notes) {
  notes = arr(notes); if (!notes.length) return '';
  const ic = k => k === 'bad' ? icon('heart') : k === 'gold' ? icon('spark') : icon('scroll');
  return `<div class="shift"><div class="sh">${icon('globe')} The world shifts</div>${notes.map(n => `<div class="srow ${n.k || ''}"><span class="si">${ic(n.k)}</span><span>${esc(n.t)}</span></div>`).join('')}</div>`;
}

/* ---------- choice cards ---------- */
function choiceCardsHTML(c, last) {
  if (S.settings.ui.showChoices === false || isCompanion(c) || !arr(last?.choices).length) return '';
  return `<div class="choices">${last.choices.map((ch, i) => { const p = choiceParts(ch); return `<button class="ccho" data-act="choice" data-i="${i}">${p.title ? `<span class="ct">${esc(p.title)}</span>` : ''}<span class="cd">${esc(p.act)}</span></button>`; }).join('')}
    <button class="ccho free" data-act="freechoice"><span class="ct">Free choice</span><span class="cd">Do anything else: type it below.</span></button></div>`;
}
function turnSettled(c) {
  const lg = lastIndex(c, 'gm'); const last = c.messages[lg];
  return !S.busy && last && !c.pendingRoll && !c.deathPending && !c.ended && lg >= 0 && c.messages.slice(lg + 1).every(m => m.role === 'sys' || m.role === 'comp') ? last : null;
}

/* ---------- the slide-out panel ---------- */
const PANEL_TABS = c => isCompanion(c) ? { char: 'You', camp: 'Story', world: 'Cast' } : { char: 'Character', camp: 'Campaign', world: 'World' };
function renderPanel() {
  const c = cur(); let el = $('#spanel');
  if (!c || !S.panel || S.view !== 'game') { el?.remove(); $('#spanelbg')?.remove(); return; }
  const tabs = PANEL_TABS(c); const t = tabs[S.panel] ? S.panel : 'char';
  if (!el) {
    const bg = document.createElement('div'); bg.id = 'spanelbg'; bg.dataset.act = 'panelclose'; document.body.appendChild(bg);
    el = document.createElement('aside'); el.id = 'spanel'; document.body.appendChild(el);
  }
  const scroll = el.querySelector('.pscroll')?.scrollTop || 0;
  el.innerHTML = `<div class="phead"><h2>${esc(c.title)}</h2><button class="iconbtn" data-act="panelclose" aria-label="Close">${icon('x')}</button></div>
    <div class="ptabs">${Object.entries(tabs).map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-act="paneltab" data-t="${k}">${icon(k === 'char' ? 'person' : k === 'camp' ? 'scroll' : 'globe')}${l}</button>`).join('')}</div>
    <div class="pscroll">${t === 'camp' ? panelCampHTML(c) : t === 'world' ? panelWorldHTML(c) : panelCharHTML(c)}</div>`;
  el.querySelector('.pscroll').scrollTop = scroll;
}
function panelCharHTML(c) {
  const ch = c.character; const pic = portraitOf(ch, c); const pct = ch.maxHp ? Math.round(ch.hp / ch.maxHp * 100) : 0;
  const comp = isCompanion(c);
  return `<div class="pcardbig">${pic ? `<img src="${esc(pic)}" alt="" onerror="this.style.display='none'">` : `<div class="ph">${initial(ch.name)}</div>`}
      <div class="pc"><b>${esc(ch.name)}</b><small>${esc(ch.storyRole || ch.pronouns || '')}</small>
      ${comp ? '' : `<div class="stats"><span>Lvl ${ch.level}</span><span>${icon('heart')} ${ch.hp}/${ch.maxHp}</span><span>${ch.gold} gold</span><span>EP ${ch.ep}</span></div>
      <div class="bar ${pct <= 50 ? 'low' : ''}"><i style="width:${pct}%"></i></div>`}</div></div>
    ${!comp && c.levelPending ? `<button class="btn white wide" data-act="levelup">${icon('spark')} Level up!</button>` : ''}
    ${!comp && ch.injuries?.length ? `<div class="lbl">Injuries</div>${ch.injuries.map(x => `<div class="pline bad">${esc(x.name || x)}</div>`).join('')}` : ''}
    ${!comp && ch.traits?.length ? `<div class="lbl">Traits</div><div class="chips">${ch.traits.map(x => `<span class="chip sm ${x.polarity === '-' ? 'neg' : ''}">${esc(x.name)} <span class="tb ${x.tier}">${x.tier}</span></span>`).join('')}</div>` : ''}
    ${!comp && ch.gear?.length ? `<div class="lbl">Gear</div>${ch.gear.slice(0, 10).map(g => `<div class="pline">${esc(g.name)}${g.qty > 1 ? ' ×' + g.qty : ''}</div>`).join('')}` : ''}
    ${comp && ch.backstory ? `<div class="lbl">About you</div><p class="ptext">${esc(ch.backstory.slice(0, 500))}</p>` : ''}
    <button class="btn wide" data-act="sheet" style="margin-top:14px">${icon('book')} ${comp ? 'Edit you' : 'Full character sheet'}</button>`;
}
function panelCampHTML(c) {
  const quests = arr(c.quests);
  const live = arr(c.threats).filter(t => !t.triggered && t.max);
  const danger = live.length ? Math.max(...live.map(t => t.progress / t.max)) : 0;
  const seg = 6, on = Math.round(danger * seg);
  const where = `${c.location || 'Unknown place'} · ${timeLabel(worldOf(c))}`;
  return `<div class="lbl">${icon('scroll')} ${isCompanion(c) ? 'The story' : 'Objective'}</div><p class="ptext">${esc(c.goal || String(c.premise || '').slice(0, 400))}</p>
    ${(() => { const r = roadmapState(c); if (!r) return ''; const n = r.acts.length, at = Math.min(num(c.rmAct), n); return `<div class="lbl">${icon('book')} Chapter ${Math.min(at + 1, n)} of ${n}</div><div class="meter chap">${r.acts.map((_, i) => `<i class="${i < at ? 'on done' : i === at ? 'on' : ''}"></i>`).join('')}</div>`; })()}
    <div class="lbl">${icon('compass')} Now</div><p class="ptext">${esc(where)}${c.combat ? ' · <b>In combat</b>' : ''}</p>
    ${!isCompanion(c) && live.length ? `<div class="lbl">Danger</div><div class="meter">${Array.from({ length: seg }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div><p class="hint">Something is building in the world. It grows when time passes or things go wrong.</p>` : ''}
    <div class="lbl">${icon('swords')} Quests <span class="count">${quests.filter(q => q.status !== 'active').length}/${quests.length}</span></div>
    ${quests.length ? quests.slice().sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1)).map(q => `<div class="quest2 ${q.status}"><span>${esc(q.title)}</span><em>${q.status === 'completed' ? 'Done' : q.status === 'failed' ? 'Failed' : 'Active'}</em></div>`).join('') : '<p class="hint">Quests appear here as the story gives them to you.</p>'}
    <button class="btn wide" data-act="journal" style="margin-top:14px">${icon('book')} Journal: quests, map, notes</button>
    ${c.storyDoc?.id ? `<a class="btn wide" href="${StoryDoc.url(c.storyDoc.id)}" target="_blank" rel="noopener" style="margin-top:8px">${icon('scroll')} Open the Story Doc</a><p class="hint">Edit it in Google Docs. Your changes reach the GM after the next sync.</p>` : (Drive.configured() ? '<p class="hint">The Story Doc is created in your Drive folder on the next sync.</p>' : '')}`;
}
function panelWorldHTML(c) {
  const party = activeParty(c); const people = peopleOf(c).slice().reverse();
  const pic = name => { const g = arr(c.gallery).find(x => x.name.toLowerCase() === String(name).toLowerCase()); return g && S.settings.image.mode !== 'off' ? imageUrl(g, c) : ''; };
  const row = (name, sub, tag, src, act, id) => `<button class="wrow" data-act="${act}" ${id ? `data-n="${esc(id)}"` : ''}>${src ? `<img src="${esc(src)}" alt="" onerror="this.style.display='none'">` : `<span class="ph">${initial(name)}</span>`}<span class="grow"><b>${esc(name)}</b><small>${esc(sub || '')}</small></span>${tagHTML(tag)}</button>`;
  return `${!isCompanion(c) ? `<div class="lbl">${icon('person')} You</div>${row(c.character.name, c.character.storyRole || '', '', portraitOf(c.character, c), 'sheet')}` : ''}
    <div class="lbl">${icon('users')} ${isCompanion(c) ? 'Cast' : 'Companions'} <span class="count">${party.length}</span></div>
    ${party.length ? party.map(p => row(p.name, p.role || p.personality || '', TRUST_TAG(num(p.trust)), p.portrait ? imageUrl(p.portrait, c) : pic(p.name), 'party')).join('') : `<p class="hint">${isCompanion(c) ? 'Add characters from the Cast button.' : 'Nobody travels with you yet.'}</p>`}
    <div class="lbl">${icon('person')} People <span class="count">${people.length}</span></div>
    ${people.length ? people.slice(0, 40).map(e => row(e.name, e.text, e.feel || '', pic(e.name), 'people')).join('') : '<p class="hint">People you meet are added here automatically.</p>'}
    <button class="btn wide" data-act="people" style="margin-top:14px">${icon('person')} Everyone you've met</button>`;
}
function panelAction(act, el, c) {
  switch (act) {
    case 'panel': S.panel = S.panel ? null : (S.panelLast || 'char'); renderPanel(); return true;
    case 'paneltab': S.panel = S.panelLast = el.dataset.t; renderPanel(); return true;
    case 'panelclose': S.panel = null; renderPanel(); return true;
    case 'freechoice': { const i = $('#input'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } return true; }
  }
  if (S.panel && ['sheet', 'journal', 'people', 'party', 'levelup', 'home'].includes(act)) { S.panel = null; renderPanel(); }
  return false;
}
