'use strict';
/* =========================================================================
   Home screens: top menu, My Games, Discover Campaigns, Characters, Gallery
   ========================================================================= */
Object.assign(ICON, {
  play: '<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5L18 3h3v3l-3.5 8.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'
});
const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-24 16 16)"/><circle cx="16" cy="16" r="4.5" fill="currentColor"/><circle cx="26.5" cy="10" r="1.8" fill="currentColor"/></svg>`;
const HOME_TABS = { games: ['swords', 'Games'], pals: ['heart', 'Companions'], discover: ['compass', 'Campaigns'], chars: ['person', 'Characters'], gallery: ['image', 'Gallery'] };

function topNavHTML(active) {
  return `<header class="topnav">
    <button class="brandmark" data-act="htab" data-t="games" aria-label="${APP} home">${LOGO}<span>${APP.toUpperCase()}</span></button>
    <nav class="navtabs">${Object.entries(HOME_TABS).map(([k, [ic, label]]) => `<button class="tab ${active === k ? 'on' : ''}" data-act="htab" data-t="${k}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav>
    <div class="navend">
      <button class="iconbtn" data-act="sync" aria-label="Sync with Google Drive" title="Sync with Google Drive">${icon('cloud')}</button>
      <button class="iconbtn" data-act="settings" aria-label="Settings" title="Settings">${icon('gear')}</button>
      <button class="btn white" data-act="new">${icon('play')}<span>Start new game</span></button>
    </div></header>`;
}
const allGames = () => Object.values(S.campaigns).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
const gameKind = c => c.mode === 'companion' ? 'Companion' : c.mode === 'mp' ? 'Multiplayer' : 'Single player';
const turnsOf = c => arr(c.messages).filter(m => m.role === 'player' && !m.hidden).length;
function coverOf(c) {
  if (S.settings.image.mode === 'off') return '';
  const m = [...arr(c.messages)].reverse().find(x => x.image); if (m) return imageUrl(m.image, c);
  const g = arr(c.gallery).find(x => x.kind === 'place') || arr(c.gallery)[0]; return g ? imageUrl(g, c) : '';
}
const portraitOf = (ch, c) => ch?.portrait && S.settings.image.mode !== 'off' ? imageUrl(ch.portrait, c) : '';
const imgTag = (src, cls = '', alt = '') => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.display='none'">` : '';
const initial = s => esc((String(s || '?').trim()[0] || '?').toUpperCase());

/* the latest story text, for the "current situation" preview */
function situationOf(c) {
  const m = [...arr(c.messages)].reverse().find(x => x.role === 'gm' && String(x.text || x.raw || '').trim()) || [...arr(c.messages)].reverse().find(x => x.role === 'comp');
  const t = String(m?.text || m?.raw || '').replace(/\[[^\]]*\]/g, '').replace(/[*_#>]/g, '').trim();
  return t ? t.split(/\n{2,}/).slice(0, 2).join('\n\n') : c.premise || '';
}

function renderLibrary() {
  S.view = 'library'; musicScene(null);
  const tab = HOME_TABS[S.homeTab] ? S.homeTab : 'games';
  const body = tab === 'pals' ? palsHomeHTML() : tab === 'discover' ? discoverHTML() : tab === 'chars' ? charsHTML() : tab === 'gallery' ? homeGalleryHTML() : gamesHTML();
  app().innerHTML = `<div class="home">${topNavHTML(tab)}<main class="hmain">
    ${!textReady() ? `<div class="card notice"><b>Welcome to ${APP}! Let's get you set up.</b><p class="hint" style="color:var(--ink)">About five minutes: connect your AI (your own PC with Ollama, or a free key), and optionally Google Drive.</p><div class="row" style="margin-top:12px"><button class="btn white" data-act="setup">${icon('spark')} Start setup</button>${Drive.configured() && /^https?:/.test(location.protocol) ? `<button class="btn" data-act="sync">${icon('cloud')} I've set up before: connect Drive</button>` : ''}</div></div>` : ''}
    ${body}
    <footer class="hfoot">
      <div class="row wrap">
        <button class="btn sm ghost" data-act="setup">${icon('spark')} Setup</button>
        <button class="btn sm ghost" data-act="export">${icon('download')} Backup</button>
        <button class="btn sm ghost" data-act="import">${icon('upload')} Restore</button>
        <button class="btn sm ghost" data-act="guide">${icon('help')} Rules &amp; guide</button>
      </div>
      <div class="syncline" id="syncline">${esc(S.syncStatus || (Drive.configured() ? 'Google Drive ready: tap the cloud to sync' : 'Saved on this device'))}</div>
    </footer></main></div>`;
}

/* ---------- My Games ---------- */
/* when the mode tab, the rating filter and the search between them hide every game, say which ones did it */
function emptyGamesMsg(filt, rf, q) {
  const mode = { solo: 'Single player', mp: 'Multiplayer', companion: 'Companion' }[filt] || '';
  let msg = 'No';
  if (rf !== 'all') msg += ` ${rf}`;
  msg += ' games';
  if (q) msg += ` match "${esc(q)}"`;
  if (mode) msg += ` in ${mode} mode`;
  return msg + '.';
}
/* one sort control for the three lists that hold a lot of things */
function sortedBy(list, mode, nameOf, timeOf) {
  const l = list.slice(); const s = String(mode || 'recent');
  if (s === 'az' || s === 'za') return l.sort((a, b) => String(nameOf(a) || '').localeCompare(String(nameOf(b) || '')) * (s === 'za' ? -1 : 1));
  if (s === 'oldest') return l.sort((a, b) => (timeOf(a) || 0) - (timeOf(b) || 0));
  return l.sort((a, b) => (timeOf(b) || 0) - (timeOf(a) || 0));
}
function sortSelect(id, val, label = 'Sort') {
  return `<select id="${id}" aria-label="${label}" style="width:auto">${[['recent', 'Newest first'], ['oldest', 'Oldest first'], ['az', 'A–Z'], ['za', 'Z–A']].map(([v, l]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
}

function gamesHTML() {
  const filt = S.gameFilter || 'all';
  const q = String(S.gameQ || '').toLowerCase();
  const all = allGames();
  const sort = S.gameSort || 'recent';
  if (!all.length) return `<section class="hero">
      <h1>Your story starts with a single choice.</h1>
      <p>Pick a ready-made world or build your own. Your Game Master runs on your own AI: no turn limits, no filters.</p>
      <div class="row center"><button class="btn white lg" data-act="new">${icon('play')} Start new game</button><button class="btn lg" data-act="htab" data-t="discover">${icon('compass')} Browse campaigns</button></div></section>`;
  const rf = S.ratingFilter && RATINGS.includes(S.ratingFilter) ? S.ratingFilter : 'all';
  const list = sortedBy(all.filter(c => (filt === 'all' || (filt === 'solo' ? !c.mode || c.mode === 'solo' : c.mode === filt))
    && (rf === 'all' || normRating(c.rating) === rf)
    && (!q || `${c.title} ${c.character?.name} ${normRating(c.rating)} ${RATING_LABEL[normRating(c.rating)]} ${RATING_BLURB[normRating(c.rating)]}`.toLowerCase().includes(q))), sort, c => c.title, c => c.updatedAt);
  const sel = S.campaigns[S.gameSel] && list.includes(S.campaigns[S.gameSel]) ? S.campaigns[S.gameSel] : list[0];
  return `<div class="hhead"><h1>My Games</h1>
      <div class="row wrap" style="gap:8px;align-items:center">
        <select id="ratingFilter" aria-label="Filter by content rating" style="width:auto" title="Show only one content rating">${[['all', 'All ratings'], ...RATINGS.map(r => [r, RATING_LABEL[r]])].map(([v, l]) => `<option value="${v}" ${rf === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${sortSelect('gameSort', sort)}
        <div class="seg">${[['all', 'All'], ['solo', 'Single player'], ['mp', 'Multiplayer'], ['companion', 'Companion']].map(([k, l]) => `<button class="${filt === k ? 'on' : ''}" data-act="gfilter" data-k="${k}">${l}</button>`).join('')}</div>
      </div></div>
    <div class="gamesplit">
      <div class="glist panelbox">
        <label class="search">${icon('search')}<input type="search" id="gameQ" placeholder="Search" value="${esc(S.gameQ || '')}"></label>
        ${list.length ? list.map(c => `<button class="gamerow ${c === sel ? 'on' : ''}" data-act="gsel" data-id="${c.id}">
            <span class="gthumb">${imgTag(coverOf(c)) || initial(c.title)}</span>
            <span class="grow"><b>${esc(c.title)}${c.character?.name && c.mode !== 'companion' ? ', ' + esc(c.character.name) : ''}</b><small>${gameKind(c)} · ${esc(normRating(c.rating))} · played ${esc(ago(c.updatedAt))}</small></span>
            <span class="chev">›</span></button>`).join('') : `<p class="empty">${emptyGamesMsg(filt, rf, q)}</p>`}
      </div>
      ${sel ? gamePreviewHTML(sel) : '<div class="gprev panelbox"></div>'}
    </div>`;
}
function gamePreviewHTML(c) {
  const ch = c.character || {}; const pic = portraitOf(ch, c);
  const party = c.mode === 'mp' && arr(c.players).length > 1 ? c.players : [ch];
  return `<div class="gprev panelbox">
    <h2>${esc(c.title)}</h2>
    <p class="hint" style="margin:2px 0 10px">${esc(ratingTag(c))} · ${esc(RATING_BLURB[normRating(c.rating)])}</p>
    <div class="lbl">${icon('scroll')} Current situation</div>
    <div class="situ">${esc(situationOf(c)).replace(/\n\n/g, '</p><p>').replace(/^/, '<p>') + '</p>'}</div>
    <div class="lbl">${icon('person')} ${c.mode === 'companion' ? 'You' : party.length > 1 ? 'Characters' : 'Character'}</div>
    <div class="row wrap">${party.map(p => `<div class="charchip">${imgTag(portraitOf(p, c), 'cp') || `<span class="cp ph">${initial(p.name)}</span>`}<span><b>${esc(p.name)}</b><small>${esc(p.storyRole || gameKind(c))}</small>${c.mode === 'companion' ? '' : `<em>Lvl ${p.level || 1}</em>`}</span></div>`).join('')}</div>
    <div class="lbl">${icon('redo')} ${turnsOf(c)} turn${turnsOf(c) === 1 ? '' : 's'} played${arr(c.party).length ? ` · ${c.mode === 'companion' ? 'Cast' : 'Party'}: ${esc(activeParty(c).map(p => p.name).join(', ') || 'none')}` : ''}</div>
    <div class="gpfoot"><button class="link danger" data-act="del" data-id="${c.id}">${icon('trash')} Delete game</button>
      <button class="btn white" data-act="open" data-id="${c.id}">${icon('play')} Continue</button></div></div>`;
}

/* ---------- Discover Campaigns ---------- */
const scenCover = sc => S.settings.image.mode === 'off' ? '' : imageUrl({ prompt: `${sc.title}, ${sc.genre}. ${sc.premise.split('.')[0]}. Wide establishing shot of the setting, no text`, seed: 4242 + sc.id.length * 31 }, { artStyle: sc.art, rating: 'PG-13' });
function discoverHTML() {
  const all = SCENARIOS.filter(s => s.id !== 'custom');
  const custom = SCENARIOS.find(s => s.id === 'custom');
  const rf = S.scenRating && RATINGS.includes(S.scenRating) ? S.scenRating : 'all';
  const q = String(S.scenQ || '').trim(); const ql = q.toLowerCase();
  const list = all.filter(sc => (rf === 'all' || normRating(sc.rating) === rf)
    && (!ql || `${sc.title} ${sc.genre} ${sc.tone} ${sc.premise} ${ratingShort(sc)} ${ratingTag(sc)}`.toLowerCase().includes(ql)));
  const card = sc => `<article class="camcard">
        <div class="cimg" style="--h:${(sc.id.length * 47) % 360}">${imgTag(scenCover(sc), '', sc.title)}</div>
        <div class="cbody"><h3>${esc(sc.title)}</h3><div class="cgenre">${esc(sc.genre)} ${ratingChip(sc)}</div><p>${esc(sc.premise)}</p>
          <div class="cfoot"><span class="tagline">${esc(sc.tone)}</span><button class="btn sm" data-act="scenplay" data-id="${sc.id}">${icon('play')} Play</button></div></div></article>`;
  const customCard = custom ? `<article class="camcard make" data-act="scenplay" data-id="custom"><div class="cimg mk">${icon('plus')}</div><div class="cbody"><h3>Create your own</h3><p>Pick a world, tell the story, play. Or type a real place or a book, show or game world and press Research.</p><div class="cfoot"><span></span><button class="btn sm white" data-act="scenplay" data-id="custom">${icon('plus')} Create</button></div></div></article>` : '';
  return `<div class="hhead"><h1>Discover Campaigns <span class="count">${list.length}</span></h1>
    <div class="row wrap" style="gap:8px;align-items:center">
      <label class="search" style="min-width:220px">${icon('search')}<input type="search" id="scenQ" placeholder="Search campaigns" value="${esc(q)}"></label>
      <select id="scenRating" aria-label="Filter by content rating" style="width:auto" title="Show only campaigns at one content rating">${[['all', 'All ratings'], ...RATINGS.map(r => [r, RATING_LABEL[r]])].map(([v, l]) => `<option value="${v}" ${rf === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div></div>
    <div class="lbl">${icon('spark')} Ready-made worlds</div>
    ${list.length ? '' : `<p class="empty">No ${rf === 'all' ? '' : esc(rf) + ' '}campaigns${q ? ` match "${esc(q)}"` : ''}.</p>`}
    <div class="ccards">${list.map(card).join('')}${customCard}</div>`;
}

/* ---------- Characters (everyone you've played) ---------- */
function charsHTML() {
  const rows = [];
  for (const c of allGames()) for (const p of (c.mode === 'mp' && arr(c.players).length ? c.players : [c.character])) if (p?.name) rows.push({ p, c });
  const rf = S.ratingFilter && RATINGS.includes(S.ratingFilter) ? S.ratingFilter : 'all';
  const pf = S.protFilter === 'protected' || S.protFilter === 'open' ? S.protFilter : 'all';
  const sort = S.charSort || 'recent';
  const list = sortedBy((rf === 'all' ? rows : rows.filter(r => normRating(r.c.rating) === rf))
    .filter(r => pf === 'all' || (pf === 'protected' ? AGE.isProtected(r.p) : !AGE.isProtected(r.p))), sort, r => r.p.name, r => r.c.updatedAt);
  const emptyMsg = rows.length ? `No ${pf !== 'all' ? (pf === 'protected' ? 'protected' : 'open') + ' ' : ''}characters${rf !== 'all' ? ' at ' + rf : ''}.` : 'Characters you play show up here.';
  return `<div class="hhead"><h1>My Characters <span class="count">${list.length}</span></h1>
    <div class="row wrap" style="gap:8px;align-items:center">
      <select id="ratingFilter" aria-label="Filter by content rating" style="width:auto" title="Show only characters from games with one content rating">${[['all', 'All ratings'], ...RATINGS.map(r => [r, RATING_LABEL[r]])].map(([v, l]) => `<option value="${v}" ${rf === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select id="protFilter" aria-label="Filter by protection" style="width:auto" title="Show only protected or open characters">${[['all', 'All characters'], ['protected', '🔒 Protected only'], ['open', 'Open only']].map(([v, l]) => `<option value="${v}" ${pf === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${sortSelect('charSort', sort)}
      <button class="btn" data-act="new">${icon('plus')} Create character</button>
    </div></div>
    ${list.length ? `<div class="pcards">${list.map(({ p, c }) => { const pct = p.maxHp ? Math.round(p.hp / p.maxHp * 100) : 0; return `<button class="pcard" data-act="open" data-id="${c.id}">
        <div class="pimg">${imgTag(portraitOf(p, c), '', p.name) || `<span class="ph">${initial(p.name)}</span>`}</div>
        <div class="pbody"><b>${esc(p.name)}</b><small>${esc(p.storyRole || '')}</small>
          ${c.mode === 'companion' ? '' : `<div class="stats"><span>Lvl ${p.level || 1}</span><span>${icon('heart')} ${p.hp}/${p.maxHp}</span><span>${p.gold ?? 0} gold</span></div><div class="bar"><i style="width:${pct}%"></i></div>`}
          <div class="in">in ${esc(c.title)} · ${esc(normRating(c.rating))}${AGE.isProtected(p) ? ` · 🔒 ${AGE.isMinor(p) ? 'Under 18' : 'Protected'}` : ' · Open'}</div></div></button>`; }).join('')}</div>` : `<p class="empty">${emptyMsg}</p>`}`;
}

/* the Gallery (grouped by story or chat) and the large picture view are in pics.js */

/* ---------- home actions (called from the main click handler) ---------- */
function homeAction(act, el) {
  switch (act) {
    case 'htab': S.homeTab = el.dataset.t; S.view = 'library'; renderLibrary(); window.scrollTo?.(0, 0); return true;
    case 'gfilter': S.gameFilter = el.dataset.k; renderLibrary(); return true;
    case 'gsel': S.gameSel = el.dataset.id; renderLibrary(); if (innerWidth < 760) $('.gprev')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true;
    case 'scenplay': { const sc = SCENARIOS.find(s => s.id === el.dataset.id) || SCENARIOS[0]; S.draft = newDraft(sc); S.draft.mode = 'solo'; S.addingPlayer = null; S.replacing = null; renderNew(); return true; }
    case 'lightbox': { let ref = null; try { ref = el.dataset.ref ? JSON.parse(el.dataset.ref) : null; } catch {} openLightbox(el.dataset.src, el.dataset.cap, ref); return true; }
    case 'galsel': S.galSel = el.dataset.k || ''; renderLibrary(); return true;
    case 'galnsfw': S.galNsfw = !S.galNsfw; renderLibrary(); return true;
  }
  return false;
}
document.addEventListener('input', e => {
  if (e.target.id === 'gameQ') { S.gameQ = e.target.value; const pos = e.target.selectionStart; renderLibrary(); const i = $('#gameQ'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
  else if (e.target.id === 'ratingFilter') { S.ratingFilter = e.target.value; renderLibrary(); }
  else if (e.target.id === 'protFilter') { S.protFilter = e.target.value; renderLibrary(); }
  else if (e.target.id === 'scenQ') { S.scenQ = e.target.value; const pos = e.target.selectionStart; renderLibrary(); const i = $('#scenQ'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
  else if (e.target.id === 'scenRating') { S.scenRating = e.target.value; renderLibrary(); }
  else if (e.target.id === 'gameSort') { S.gameSort = e.target.value; renderLibrary(); }
  else if (e.target.id === 'charSort') { S.charSort = e.target.value; renderLibrary(); }
  else if (e.target.id === 'palSort') { S.palSort = e.target.value; renderLibrary(); }
});
