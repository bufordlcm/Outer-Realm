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
const HOME_TABS = { games: ['swords', 'Games'], discover: ['compass', 'Campaigns'], chars: ['person', 'Characters'], gallery: ['image', 'Gallery'] };

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
  const body = tab === 'discover' ? discoverHTML() : tab === 'chars' ? charsHTML() : tab === 'gallery' ? homeGalleryHTML() : gamesHTML();
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
function gamesHTML() {
  const filt = S.gameFilter || 'all';
  const q = String(S.gameQ || '').toLowerCase();
  const all = allGames();
  if (!all.length) return `<section class="hero">
      <h1>Your story starts with a single choice.</h1>
      <p>Pick a ready-made world or build your own. Your Game Master runs on your own AI: no turn limits, no filters.</p>
      <div class="row center"><button class="btn white lg" data-act="new">${icon('play')} Start new game</button><button class="btn lg" data-act="htab" data-t="discover">${icon('compass')} Browse campaigns</button></div></section>`;
  const list = all.filter(c => (filt === 'all' || (filt === 'solo' ? !c.mode || c.mode === 'solo' : c.mode === filt)) && (!q || `${c.title} ${c.character?.name}`.toLowerCase().includes(q)));
  const sel = S.campaigns[S.gameSel] && list.includes(S.campaigns[S.gameSel]) ? S.campaigns[S.gameSel] : list[0];
  return `<div class="hhead"><h1>My Games</h1>
      <div class="seg">${[['all', 'All'], ['solo', 'Single player'], ['mp', 'Multiplayer'], ['companion', 'Companion']].map(([k, l]) => `<button class="${filt === k ? 'on' : ''}" data-act="gfilter" data-k="${k}">${l}</button>`).join('')}</div></div>
    <div class="gamesplit">
      <div class="glist panelbox">
        <label class="search">${icon('search')}<input type="search" id="gameQ" placeholder="Search" value="${esc(S.gameQ || '')}"></label>
        ${list.length ? list.map(c => `<button class="gamerow ${c === sel ? 'on' : ''}" data-act="gsel" data-id="${c.id}">
            <span class="gthumb">${imgTag(coverOf(c)) || initial(c.title)}</span>
            <span class="grow"><b>${esc(c.title)}${c.character?.name && c.mode !== 'companion' ? ', ' + esc(c.character.name) : ''}</b><small>${gameKind(c)} · played ${esc(ago(c.updatedAt))}</small></span>
            <span class="chev">›</span></button>`).join('') : '<p class="empty">Nothing matches.</p>'}
      </div>
      ${sel ? gamePreviewHTML(sel) : '<div class="gprev panelbox"></div>'}
    </div>`;
}
function gamePreviewHTML(c) {
  const ch = c.character || {}; const pic = portraitOf(ch, c);
  const party = c.mode === 'mp' && arr(c.players).length > 1 ? c.players : [ch];
  return `<div class="gprev panelbox">
    <h2>${esc(c.title)}</h2>
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
  const list = SCENARIOS.filter(s => s.id !== 'custom');
  const custom = SCENARIOS.find(s => s.id === 'custom');
  return `<div class="hhead"><h1>Discover Campaigns</h1></div>
    <div class="lbl">${icon('spark')} Ready-made worlds</div>
    <div class="ccards">${list.map(sc => `<article class="camcard">
        <div class="cimg" style="--h:${(sc.id.length * 47) % 360}">${imgTag(scenCover(sc), '', sc.title)}</div>
        <div class="cbody"><h3>${esc(sc.title)}</h3><div class="cgenre">${esc(sc.genre)}</div><p>${esc(sc.premise)}</p>
          <div class="cfoot"><span class="tagline">${esc(sc.tone)}</span><button class="btn sm" data-act="scenplay" data-id="${sc.id}">${icon('play')} Play</button></div></div></article>`).join('')}
      ${custom ? `<article class="camcard make" data-act="scenplay" data-id="custom"><div class="cimg mk">${icon('plus')}</div><div class="cbody"><h3>Create your own</h3><p>Pick a world, tell the story, play. Or type a real place or a book, show or game world and press Research.</p><div class="cfoot"><span></span><button class="btn sm white" data-act="scenplay" data-id="custom">${icon('plus')} Create</button></div></div></article>` : ''}
    </div>`;
}

/* ---------- Characters (everyone you've played) ---------- */
function charsHTML() {
  const rows = [];
  for (const c of allGames()) for (const p of (c.mode === 'mp' && arr(c.players).length ? c.players : [c.character])) if (p?.name) rows.push({ p, c });
  return `<div class="hhead"><h1>My Characters <span class="count">${rows.length}</span></h1><button class="btn" data-act="new">${icon('plus')} Create character</button></div>
    ${rows.length ? `<div class="pcards">${rows.map(({ p, c }) => { const pct = p.maxHp ? Math.round(p.hp / p.maxHp * 100) : 0; return `<button class="pcard" data-act="open" data-id="${c.id}">
        <div class="pimg">${imgTag(portraitOf(p, c), '', p.name) || `<span class="ph">${initial(p.name)}</span>`}</div>
        <div class="pbody"><b>${esc(p.name)}</b><small>${esc(p.storyRole || '')}</small>
          ${c.mode === 'companion' ? '' : `<div class="stats"><span>Lvl ${p.level || 1}</span><span>${icon('heart')} ${p.hp}/${p.maxHp}</span><span>${p.gold ?? 0} gold</span></div><div class="bar"><i style="width:${pct}%"></i></div>`}
          <div class="in">in ${esc(c.title)}</div></div></button>`; }).join('')}</div>` : '<p class="empty">Characters you play show up here.</p>'}`;
}

/* ---------- Gallery (pictures from every game) ---------- */
function homeGalleryHTML() {
  if (S.settings.image.mode === 'off') return `<div class="hhead"><h1>Gallery</h1></div><p class="empty">Pictures are turned off. Turn them on in Settings → Images.</p>`;
  const items = [];
  for (const c of allGames()) {
    for (const g of arr(c.gallery)) items.push({ src: imageUrl(g, c), name: g.name, c });
    for (const m of arr(c.messages)) if (m.image && !arr(c.gallery).some(g => g.prompt === m.image.prompt)) items.push({ src: imageUrl(m.image, c), name: '', c });
  }
  return `<div class="hhead"><h1>Gallery <span class="count">${items.length}</span></h1></div>
    ${items.length ? `<div class="gal">${items.slice(0, 240).map(x => `<button class="gtile" data-act="lightbox" data-src="${esc(x.src)}" data-cap="${esc((x.name ? x.name + ' · ' : '') + x.c.title)}">${imgTag(x.src, '', x.name)}<span>${esc(x.name || x.c.title)}</span></button>`).join('')}</div>` : '<p class="empty">Portraits and scene pictures from your games collect here.</p>'}`;
}
function openLightbox(src, cap) {
  const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${esc(src)}" alt=""><div class="cap">${esc(cap || '')}</div><button class="iconbtn" aria-label="Close">${icon('x')}</button>`;
  d.addEventListener('click', () => d.remove()); document.body.appendChild(d);
}

/* ---------- home actions (called from the main click handler) ---------- */
function homeAction(act, el) {
  switch (act) {
    case 'htab': S.homeTab = el.dataset.t; S.view = 'library'; renderLibrary(); window.scrollTo?.(0, 0); return true;
    case 'gfilter': S.gameFilter = el.dataset.k; renderLibrary(); return true;
    case 'gsel': S.gameSel = el.dataset.id; renderLibrary(); if (innerWidth < 760) $('.gprev')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true;
    case 'scenplay': { const sc = SCENARIOS.find(s => s.id === el.dataset.id) || SCENARIOS[0]; S.draft = newDraft(sc); S.draft.mode = 'solo'; S.addingPlayer = null; S.replacing = null; renderNew(); return true; }
    case 'lightbox': openLightbox(el.dataset.src, el.dataset.cap); return true;
  }
  return false;
}
document.addEventListener('input', e => {
  if (e.target.id === 'gameQ') { S.gameQ = e.target.value; const pos = e.target.selectionStart; renderLibrary(); const i = $('#gameQ'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
});
