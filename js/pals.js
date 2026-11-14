'use strict';
/* =========================================================================
   COMPANIONS: AI characters you talk to, separate from the RPG.
   - Your own characters only, saved on this device and in Google Drive (Companions/companions.json)
   - Each chat is either TEXTING (phone, online, email: message bubbles)
     or IN PERSON (together: a narrated scene with *actions* and dialogue)
   - Personas: several versions of YOU; each chat uses one
   - Group chats: everyone sees every message; you pick who you are talking to;
     each companion keeps her own private memories next to what the group shares
   - Relationships grow, long-term memory you can read, edit and pin
   The builder lives in palbuild.js, pictures and the gallery in pics.js.
   ========================================================================= */
Object.assign(ICON, {
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>'
});
const PALS_KEY = 'iq.pals';
const PAL_STAGES = [
  { k:'stranger',     l:'Strangers',       at:0,  d:'You have just met. Polite, curious, guarded; no familiarity yet.' },
  { k:'acquaintance', l:'Acquaintances',   at:15, d:'You know each other a little. Friendly, still getting to know them.' },
  { k:'friend',       l:'Friends',         at:35, d:'Real friends: relaxed, teasing, you share opinions and some personal things.' },
  { k:'close',        l:'Close friends',   at:55, d:'Very close: trust, inside jokes, you confide in them and care openly.' },
  { k:'crush',        l:'Something more',  at:70, d:'Feelings are growing: flirting, nervousness, lingering looks, hoping they feel it too.', romance:true },
  { k:'dating',       l:'Dating',          at:82, d:'Together and romantic: affection, dates, physical closeness, saying what you feel.', romance:true },
  { k:'partner',      l:'Partners',        at:93, d:'Deeply in love and committed: completely at ease, devoted, intimate.', romance:true }
];
const PAL_GOALS = { friends:'Friends only', romance:'Romance possible', open:'Already together (start as partners)' };
const PAL_VIBES = ['sweet','flirty','shy','mysterious','dominant','playful','chaotic','caring','sarcastic','heroic','villainous','brooding','bubbly','stoic','nerdy','confident'];
const PAL_LENGTHS = { short:{ l:'Short', tok:220, rule:'Keep replies short.' }, normal:{ l:'Normal', tok:450, rule:'' }, long:{ l:'Long', tok:900, rule:'Write longer, richer replies.' } };

/* ---------- storage ---------- */
const PALS = LS.get(PALS_KEY, null) || { me: { name: '', about: '', updatedAt: 0 }, pals: {}, chats: {}, deleted: {}, personas: {}, worlds: {} };
for (const k of ['pals','chats','deleted','personas','worlds']) PALS[k] = PALS[k] || {};
PALS.me = PALS.me || { name: '', about: '' };
/* bring a companion saved by an older version up to date */
function palUpgrade(p) {
  if (p.sex !== 'male' && p.sex !== 'female') p.sex = /^\s*(he|him)\b/i.test(p.pronouns || '') ? 'male' : /^\s*(she|her)\b/i.test(p.pronouns || '') ? 'female' : '';
  p.memory = arr(p.memory).map(m => typeof m === 'string' ? { id: uid(), t: m, src: 'private' } : m).filter(m => m && String(m.t || '').trim());
  p.jokes = arr(p.jokes); p.outfits = arr(p.outfits);
  if (p.speech && !p.speechText) p.speechText = p.speech;
  if (p.look && !p.face && !p.body) p.body = p.look;   /* the old single "Look" box */
  return p;
}
(function palMigrate() {
  /* the old single "About you" becomes your first persona */
  if (!Object.keys(PALS.personas).length && ((PALS.me.name || '').trim() || (PALS.me.about || '').trim())) {
    const id = uid(); PALS.personas[id] = { id, name: PALS.me.name || 'Me', sex: '', about: PALS.me.about || '', look: '', createdAt: Date.now(), updatedAt: PALS.me.updatedAt || Date.now() }; PALS.defaultPersona = id;
  }
  for (const p of Object.values(PALS.pals)) palUpgrade(p);
})();
function savePals(sync = true) {
  try { LS.set(PALS_KEY, PALS); } catch (e) { toast('This device is out of space for companion chats: ' + e.message, 6000); }
  if (sync) scheduleSync();
}
const palTouch = x => { x.updatedAt = Date.now(); };
const allPals = () => Object.values(PALS.pals).sort((a, b) => (b.lastChat || b.updatedAt || 0) - (a.lastChat || a.updatedAt || 0));
const palChats = () => Object.values(PALS.chats).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
const allPersonas = () => Object.values(PALS.personas).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

/* ---------- who you are in a chat ---------- */
const palsOf = chat => arr(chat?.palIds).map(id => PALS.pals[id]).filter(Boolean);
const curChat = () => PALS.chats[S.palChat];
function personaOf(ch, p) {
  const one = p || (palsOf(ch).length === 1 ? palsOf(ch)[0] : null);
  return PALS.personas[ch?.personaId] || PALS.personas[one?.personaId] || PALS.personas[PALS.defaultPersona] || allPersonas()[0] || null;
}
const meName = (ch, p) => (personaOf(ch, p)?.name || '').trim() || 'you';
const sexWord = x => x?.sex === 'female' ? 'female' : x?.sex === 'male' ? 'male' : '';

/* a companion under 18 (by age or by how they're described) is always platonic: no romance, no 18+, safe pictures */
const palMinor = p => !!p && (
  (p.age != null && String(p.age).trim() !== '' && Number(p.age) < 10) ||
  CHAR_MINOR.test([p.name, p.tagline, p.look, p.face, p.body, p.tags].join(' ')) ||
  /* history and notes often mention the past ("as a teenager she…"), so that one word alone doesn't count there */
  CHAR_MINOR.test([p.backstory, p.personality, p.scenario, p.userRole, p.notes].join(' ').replace(/\b(?:pre-?)?teen(?:s|ager|agers|aged?)?\b/gi, ' '))
);
const palStage = p => PAL_STAGES.find(s => s.k === p.stage) || PAL_STAGES[0];

/* ---------- how a companion looks (used by the chat and by every picture) ---------- */
const palLook = p => [p?.face, p?.body].map(s => String(s || '').trim()).filter(Boolean).join('. ') || String(p?.look || '').trim();
const palOutfit = p => { const o = arr(p?.outfits).find(x => x.id === p.outfit); return String(o?.desc || p?.clothing || '').trim(); };
const palOutfitName = p => arr(p?.outfits).find(x => x.id === p.outfit)?.name || (p?.clothing ? 'Usual clothes' : '');

/* the picture engine and voice engine expect a game; this is the companion's stand-in */
function palCtx(p, chat) {
  const group = chat ? palsOf(chat) : [p];
  const adultOK = group.every(x => x.adult && !palMinor(x));
  const ctx = p._ctx || (Object.defineProperty(p, '_ctx', { value: {}, enumerable: false, writable: true }), p._ctx);
  const me = personaOf(chat, p);
  Object.assign(ctx, {
    id: 'pal_' + p.id, title: p.name, genre: '', premise: '', location: chat?.scene || '', artStyle: p.art || 'photorealistic, natural light, detailed',
    rating: adultOK ? 'Adult (18+)' : 'PG-13', character: { name: meName(chat, p), appearance: [palLook(p), group.some(palMinor) ? 'under 18 years old' : ''].filter(Boolean).join(', '), backstory: '', storyRole: '' },
    party: group, codex: [], voiceMap: chat ? (chat.voiceMap = chat.voiceMap || {}) : {}
  });
  return ctx;
}
const palImg = (img, p, chat) => !img ? '' : img.data ? img.data : S.settings.image.mode !== 'off' && p ? imageUrl(img, palCtx(p, chat)) : '';
const palAvatar = (p, cls = 'pav') => { const src = p?.portrait ? palImg(p.portrait, p) : ''; return src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="${cls} pavi" style="background:${palColor(p)}">${initial(p?.name)}</span>`; };
const palColor = p => `hsl(${hashNum(p?.name || '') % 360} 45% 38%)`;

/* ---------- Drive sync (called from syncNow) ---------- */
async function syncPals(root) {
  let folder = (await Drive.list(`'${root}' in parents and name='Companions' and mimeType='${FOLDER_MIME}' and trashed=false`))[0]?.id;
  if (!folder) { if (!Object.keys(PALS.pals).length && !Object.keys(PALS.chats).length) return 0; folder = await Drive.createFolder('Companions', root, {}); }
  const fid = await Drive.fileId(folder, 'companions.json');
  const remote = fid ? await Drive.getJSON(fid) : null;
  let changed = 0, push = !remote;
  if (remote) {
    for (const [id, t] of Object.entries(remote.deleted || {})) PALS.deleted[id] = Math.max(PALS.deleted[id] || 0, t);
    for (const k of ['pals','chats','personas','worlds']) {
      for (const [id, r] of Object.entries(remote[k] || {})) {
        if (PALS.deleted[id] && PALS.deleted[id] >= (r.updatedAt || 0)) { push = true; continue; }   /* deleted here: tell Drive */
        if (S.palBusy && k === 'chats' && id === S.palBusy.chat) continue;   /* never replace a chat while a reply is being written into it */
        const l = PALS[k][id];
        if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) { PALS[k][id] = k === 'pals' ? palUpgrade(r) : r; changed++; }
        else if ((l.updatedAt || 0) > (r.updatedAt || 0)) push = true;
      }
      for (const [id, l] of Object.entries(PALS[k])) { if (PALS.deleted[id] && PALS.deleted[id] >= (l.updatedAt || 0)) { delete PALS[k][id]; changed++; } else if (!remote[k]?.[id]) push = true; }
    }
    if (!PALS.personas[PALS.defaultPersona] && remote.defaultPersona && PALS.personas[remote.defaultPersona]) PALS.defaultPersona = remote.defaultPersona;
  }
  if (changed) savePals(false);
  if (push) await Drive.put(folder, 'companions.json', JSON.stringify({ app: APP, savedAt: Date.now(), ...PALS }), 'application/json');
  return changed;
}

/* ---------- the Companions home tab ---------- */
function palsHomeHTML() {
  const pals = allPals(), chats = palChats();
  if (!pals.length) return `<section class="hsec"><div class="card palhero">
      <h2>Companions</h2><p class="hint" style="color:var(--ink);font-size:15px">Characters who actually get you. Build your own companion: their look, voice, personality and the way they talk to you. They remember you, your history and your inside jokes, and your relationship grows the more you talk.</p>
      <p class="hint">Text them like a friend, or meet up in person and play out a scene together. Everything stays on your devices and your Google Drive.</p>
      <div class="row wrap"><button class="btn gold" data-act="palnew">${icon('plus')} Create your first companion</button><button class="btn" data-act="palme">${icon('person')} Your personas</button></div></div></section>`;
  return `<section class="hsec">
    <div class="hsechd"><h2>Companions</h2><div class="row"><button class="btn sm" data-act="palgroup" ${pals.length < 2 ? 'disabled title="Make at least two companions first"' : ''}>${icon('users')} Group chat</button><button class="btn sm" data-act="palme">${icon('person')} Your personas</button><button class="btn sm" data-act="palworlds">${icon('book')} Shared settings</button><button class="btn gold sm" data-act="palnew">${icon('plus')} New companion</button></div></div>
    ${chats.length ? `<div class="lbl">Recent chats</div><div class="palchats">${chats.slice(0, 8).map(ch => { const ps = palsOf(ch); const last = [...arr(ch.messages)].reverse().find(m => m.role !== 'sys');
      return `<button class="palchatrow" data-act="palopen" data-id="${ch.id}"><span class="pavs">${ps.slice(0, 3).map(p => palAvatar(p)).join('')}</span><span class="pcr"><b>${esc(ch.title || ps.map(p => p.name).join(', '))}</b><small>${ch.channel === 'person' ? '🧍 ' : '📱 '}${esc(String(last?.text || 'New chat').replace(/\[[^\]]*\]|[*{}]/g, '').slice(0, 90))}</small></span><span class="pct">${ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString([], { month:'short', day:'numeric' }) : ''}</span></button>`; }).join('')}</div>` : ''}
    <div class="lbl">Your companions</div>
    <div class="palgrid">${pals.map(p => `<div class="palcard">
        <button class="palpic" data-act="palchat" data-id="${p.id}">${p.portrait ? palAvatar(p, 'palbig') : `<span class="palbig pavi" style="background:${palColor(p)}">${initial(p.name)}</span>`}</button>
        <div class="palinfo"><b>${esc(p.name)}</b><small>${esc(p.tagline || arr(p.vibes).join(' · '))}</small>
        <div class="palrel">${heartMeter(p)} ${esc(palStage(p).l)}</div></div>
        <div class="row"><button class="btn sm gold grow" data-act="palchat" data-id="${p.id}">${icon('chat')} Chat</button><button class="btn sm ghost" data-act="palmemopen" data-id="${p.id}" title="What ${esc(p.name)} remembers">${icon('book')}</button><button class="btn sm ghost" data-act="paledit" data-id="${p.id}">Edit</button></div></div>`).join('')}
      <button class="palcard palnew" data-act="palnew"><span>${icon('plus')}</span>New companion</button></div>
  </section>`;
}
const heartMeter = p => `<span class="hearts" title="Affection ${Math.round(num(p.affection))}/100"><span style="width:${clamp(num(p.affection), 0, 100)}%"></span></span>`;

/* ---------- chats ---------- */
function palStartChat(ids) {
  const ex = palChats().find(ch => ch.palIds.length === ids.length && ids.every(id => ch.palIds.includes(id)));
  if (ex) return palOpenChat(ex.id);
  const ps = ids.map(id => PALS.pals[id]).filter(Boolean); if (!ps.length) return;
  const ch = { id: uid(), palIds: ids, title: ps.length > 1 ? ps.map(p => p.name).join(', ') : '', channel: 'text', scene: '', length: 'normal', to: 'all', messages: [], memTurns: 0, createdAt: Date.now(), updatedAt: Date.now() };
  PALS.chats[ch.id] = ch;
  for (const p of ps) if (p.greeting && ps.length === 1) ch.messages.push({ id: uid(), role: 'pal', who: p.id, text: p.greeting, mode: 'text', t: Date.now() });
  palTouch(ch); savePals(); palOpenChat(ch.id);
  if (!ch.messages.length) palReply(ch, { opener: true });
}
function palOpenChat(id) { S.palChat = id; S.view = 'palchat'; S.palEdit = null; S.palMenu = false; renderPalChat(); }
const palTo = ch => { const ps = palsOf(ch); return ps.length < 2 ? ps[0] || null : ps.find(p => p.id === ch.to) || 'all'; };
const first = n => String(n || '').trim().split(/\s+/)[0];
function renderPalChat() {
  const ch = curChat(); if (!ch) { S.homeTab = 'pals'; return renderLibrary(); }
  const ps = palsOf(ch); const one = ps.length === 1 ? ps[0] : null; const to = palTo(ch); const person = ch.channel === 'person';
  const picsOn = S.settings.image.mode !== 'off'; const selfieOf = one || (to !== 'all' ? to : null);
  app().innerHTML = `<div class="palview ${person ? 'inperson' : 'texting'}">
    <header class="palbar">
      <button class="hbtn exitbtn" data-act="palexit">${icon('back')}</button>
      <span class="pavs">${ps.slice(0, 3).map(p => palAvatar(p)).join('')}</span>
      <div class="palttl"><b>${esc(ch.title || ps.map(p => p.name).join(', '))}</b><small>${one ? `${heartMeter(one)} ${esc(palStage(one).l)}` : `${ps.length} companions`}${ch.scene ? ` · ${esc(ch.scene.slice(0, 40))}` : ''}</small></div>
      <div class="chanseg"><button class="${!person ? 'on' : ''}" data-act="palchan" data-k="text">📱<span> Texting</span></button><button class="${person ? 'on' : ''}" data-act="palchan" data-k="person">🧍<span> In person</span></button></div>
      <button class="hbtn wideonly" data-act="palsearch" title="Search this chat">${icon('search')}</button>
      <button class="hbtn" data-act="palmenu">${icon('more')}</button>
    </header>
    ${S.palMenu ? palMenuHTML(ch) : ''}
    <div class="pallog" id="pallog">${palLogHTML(ch)}</div>
    <div class="palcomp">
      ${ps.length > 1 ? `<div class="palto"><span>To:</span><button class="chip ${to === 'all' ? 'on' : ''}" data-act="palto" data-id="all">Everyone</button>${ps.map(p => `<button class="chip ${to !== 'all' && to?.id === p.id ? 'on' : ''}" data-act="palto" data-id="${p.id}">${palAvatar(p, 'pav xs')}${esc(first(p.name))}</button>`).join('')}</div>` : ''}
      <div class="palquick"><button class="fmtbtn" data-act="palfmt" data-k="act" title="What you do">✋ Action</button><button class="fmtbtn" data-act="palfmt" data-k="say" title="What you say out loud">💬 Say</button><button class="fmtbtn" data-act="palfmt" data-k="ooc" title="Out of character: steer the story">(( )) Direct the story</button>
        ${picsOn && selfieOf ? `<button class="chip" data-act="palquick" data-k="selfie">📷 Ask ${one ? '' : esc(first(selfieOf.name)) + ' '}for a selfie</button>` : ''}${picsOn ? '<button class="chip" data-act="palquick" data-k="scene">🎨 Picture the scene</button><button class="chip" data-act="palpicopen">🖼 Picture with my prompt</button>' : ''}<button class="chip" data-act="palwear">👗 Outfit</button><button class="chip" data-act="palplace">📍 Location</button><button class="chip" data-act="palquick" data-k="cont">↪ Keep going</button></div>
      <div class="palin"><textarea id="palInput" rows="1" placeholder="${person ? '*Smile* and say something, or describe what you do…' : 'Message ' + esc(one ? one.name : to === 'all' ? 'everyone' : first(to.name)) + '…'}"></textarea>
      ${S.palBusy ? `<button class="btn" data-act="palstop">${icon('stop')}</button>` : `<button class="btn gold" data-act="palsend">${icon('send')}</button>`}</div>
    </div></div>`;
  const log = $('#pallog'); if (log) log.scrollTop = log.scrollHeight;
  const inp = $('#palInput'); if (inp && !isPhone() && !S.modal) inp.focus();
}
function palMenuHTML(ch) {
  const ps = palsOf(ch); const one = ps.length === 1 ? ps[0] : null; const me = personaOf(ch); const others = allPals().filter(p => !ch.palIds.includes(p.id));
  return `<div class="palmenu card">
    <label class="f"><span>Where are you right now? (sets the scene)</span><input id="palScene" value="${esc(ch.scene || '')}" placeholder="e.g. Her apartment, late at night, rain on the windows"></label>
    <div class="row wrap"><button class="btn sm" data-act="palsceneset">Set scene</button></div>
    <div class="kv"><label class="f"><span>Reply length</span><select data-pch="length">${Object.entries(PAL_LENGTHS).map(([k, v]) => `<option value="${k}" ${ch.length === k ? 'selected' : ''}>${v.l}</option>`).join('')}</select></label>
    <label class="f"><span>You are (persona)</span><select data-pch="personaId"><option value="">${one?.personaId && PALS.personas[one.personaId] ? `From ${esc(one.name)}'s card: ${esc(PALS.personas[one.personaId].name)}` : `Default${PALS.personas[PALS.defaultPersona] ? ': ' + esc(PALS.personas[PALS.defaultPersona].name) : ''}`}</option>${allPersonas().map(x => `<option value="${x.id}" ${ch.personaId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>
    ${me ? '' : '<p class="hint">You have no persona yet, so they don\'t know your name. <button class="link" data-act="palme">Make one</button></p>'}
    <label class="chk"><input type="checkbox" data-pch="autovoice" ${ch.autovoice ? 'checked' : ''}> <span>Read every reply aloud</span></label>
    <label class="chk"><input type="checkbox" data-pch="timeAware" ${ch.timeAware ? 'checked' : ''}> <span>Time awareness: they know the real time of day and how long it has been since you last talked</span></label>
    ${slider('ui.narr', 'Text size (chats and stories)', 14, 24, 1, v => v + 'px')}
    ${ps.length > 1 ? `<div class="lbl">In this group</div>${ps.map(p => `<div class="pline memrow"><span>${palAvatar(p, 'pav xs')} ${esc(p.name)}</span><span><button class="link" data-act="palmemopen" data-id="${p.id}">Memory</button> <button class="link" data-act="palmemberdel" data-id="${p.id}" ${ps.length <= 2 ? 'disabled title="A group needs two"' : ''}>Remove</button></span></div>`).join('')}
      ${others.length ? `<div class="row" style="margin-top:6px"><select id="palAddSel" style="flex:1">${others.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><button class="btn sm" data-act="palmemberadd">Add to group</button></div><p class="hint">Someone you add only knows what is said after she joins.</p>` : ''}` : ''}
    ${one ? `<div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="palmemopen" data-id="${one.id}">${icon('book')} What ${esc(one.name)} remembers (${arr(one.memory).length})</button><button class="btn sm ghost" data-act="paledit" data-id="${one.id}">Edit ${esc(one.name)}</button>${arr(one.outfits).length ? `<select data-poutfit="${one.id}" style="width:auto"><option value="">Wearing: usual clothes</option>${one.outfits.map(o => `<option value="${o.id}" ${one.outfit === o.id ? 'selected' : ''}>Wearing: ${esc(o.name || 'outfit')}</option>`).join('')}</select>` : ''}</div>` : ''}
    <div class="row wrap" style="margin-top:10px"><button class="btn sm ghost" data-act="palsearch">${icon('search')} Search this chat</button><button class="btn sm ghost" data-act="palmemnow">Update memory now</button><button class="btn sm ghost" data-act="palclear">${icon('trash')} Clear this chat</button><button class="btn sm ghost" data-act="palmenu">Close</button></div>
  </div>`;
}
const palWho = (ch, m) => PALS.pals[m.who] || palsOf(ch)[0];

/* a reply that voices several characters marks each part with {Name}; split it into one piece per speaker */
function palParts(ch, text, fallbackId) {
  const ps = palsOf(ch); const out = []; let who = fallbackId || ps[0]?.id;
  const idOf = raw => { const n = String(raw || '').replace(/[*_]/g, '').trim().toLowerCase(); if (!n) return null; const p = ps.find(x => x.name.toLowerCase() === n) || ps.find(x => first(x.name).toLowerCase() === first(n)) || ps.find(x => x.name.toLowerCase().includes(n)); return p?.id || null; };
  const names = ps.flatMap(p => [p.name, first(p.name)]).filter((v, i, a) => v && a.indexOf(v) === i).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const src = String(text || '').replace(new RegExp(`(^|\\n)\\s*\\**(${names.join('|') || '\\b\\B'})\\**\\s*:\\s*`, 'gi'), '$1{$2} ');
  const push = t => { t = t.replace(/\{[^{}\n]{0,40}$/, '').trim(); if (!t) return; const l = out[out.length - 1]; if (l && l.who === who) l.text += '\n\n' + t; else out.push({ who, text: t }); };
  const re = /\{([^{}\n]{1,40})\}\s*/g; let i = 0, m;
  while ((m = re.exec(src))) { const id = idOf(m[1]); if (!id && !/^[A-Z]/.test(m[1])) continue; push(src.slice(i, m.index)); if (id) who = id; i = re.lastIndex; }
  push(src.slice(i));
  return out;
}
function palLogHTML(ch) {
  const msgs = arr(ch.messages); const ps = palsOf(ch); const group = ps.length > 1;
  const lastPal = [...msgs].reverse().find(m => m.role === 'pal'); const lastTurn = lastPal ? (lastPal.gid || lastPal.id) : null;
  const one = (m, text, p, opts = {}) => {
    const mine = m.role === 'user';
    const acts = S.palBusy || opts.live ? '' : `<div class="pacts">${group && !mine ? `<button data-act="palreplyto" data-id="${p?.id || ''}" title="Reply to ${esc(first(p?.name))}">↩ Reply</button>` : ''}${!mine ? `<button data-act="palspeak" data-id="${m.id}" title="Play">🔊</button>` : ''}<button data-act="paleditmsg" data-id="${m.id}" title="Edit">✎</button>${!mine && (m.gid || m.id) === lastTurn ? `<button data-act="palreroll" data-id="${m.id}" title="New reply">↻</button>` : ''}<button data-act="paldelmsg" data-id="${m.id}" title="Delete">🗑</button>${arr(m.alts).length > 1 ? `<span class="palts"><button data-act="palalt" data-id="${m.id}" data-d="-1">‹</button>${(m.altI ?? m.alts.length - 1) + 1}/${m.alts.length}<button data-act="palalt" data-id="${m.id}" data-d="1">›</button></span>` : ''}</div>`;
    if (S.palEdit === m.id) return `<div class="pmsg ${mine ? 'me' : 'them'}"><textarea id="palEditBox" rows="4">${esc(m.text)}</textarea><div class="row"><button class="btn sm gold" data-act="paleditsave" data-id="${m.id}">Save</button><button class="btn sm ghost" data-act="paleditcancel">Cancel</button></div></div>`;
    const img = m.image ? palPhotoHTML(ch, m, p || ps[0]) : m.picBusy ? `<div class="palphoto wait"><span class="spin"></span><span>${esc(m.picBusy)}</span><button class="link" data-act="palpiccancel" data-id="${m.id}">Cancel</button></div>` : '';
    const toTag = mine && group && m.to && m.to !== 'all' && PALS.pals[m.to] ? `<div class="pwho sm to">to ${esc(first(PALS.pals[m.to].name))}</div>` : '';
    if (m.mode === 'person') return `<div class="pmsg pscene ${mine ? 'me' : 'them'}" data-id="${m.id}">${!mine ? `<div class="pwho">${palAvatar(p)}<b>${esc(p?.name || '')}</b></div>` : `<div class="pwho"><b>${esc(meName(ch) === 'you' ? 'You' : meName(ch))}</b>${toTag ? ` <small>to ${esc(first(PALS.pals[m.to].name))}</small>` : ''}</div>`}${img}<div class="ptext">${opts.live && !text ? '<p class="typing"><i></i><i></i><i></i></p>' : md(text)}</div>${acts}</div>`;
    const bubbles = String(text || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    return `<div class="pmsg txt ${mine ? 'me' : 'them'}" data-id="${m.id}">${!mine && group ? `<div class="pwho sm">${esc(p?.name || '')}</div>` : toTag}<div class="brow">${!mine ? palAvatar(p, 'pav sm') : ''}<div class="bcol">${img}${bubbles.map(b => `<div class="bub ${/^\[voice\]/i.test(b) ? 'voice' : ''}">${/^\[voice\]/i.test(b) ? `<button class="vplay" data-act="palspeak" data-id="${m.id}">▶</button> <span>🎤 Voice message</span><div class="vtx">${md(b.replace(/^\[voice\]\s*/i, ''))}</div>` : md(b)}</div>`).join('')}${opts.live && !bubbles.length ? '<div class="bub typing"><i></i><i></i><i></i></div>' : ''}<span class="btime">${m.t ? new Date(m.t).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : ''}</span></div></div>${acts}</div>`;
  };
  let html = '';
  for (const m of msgs) {
    if (m.role === 'sys') { html += `<div class="palsys">${esc(m.text)}${m.retry && !S.palBusy ? ` <button class="link" data-act="palretry">Try again</button>` : ''}</div>`; continue; }
    if (m.streaming) {   /* while a reply is being written, each speaker already gets her own bubble */
      const parts = palParts(ch, m.text, m.who);
      html += parts.length ? parts.map(x => one(m, x.text, PALS.pals[x.who] || ps[0], { live: true })).join('') : one(m, '', palWho(ch, m), { live: true });
      continue;
    }
    html += one(m, m.text, m.role === 'user' ? null : palWho(ch, m));
  }
  if (S.palBusy && S.palBusy.chat === ch.id && !msgs.some(m => m.streaming)) html += `<div class="pmsg txt them"><div class="brow"><div class="bub typing"><i></i><i></i><i></i></div></div></div>`;
  return html || `<p class="hint" style="text-align:center;margin-top:40px">Say hi.</p>`;
}
function paintPalLog() { const ch = curChat(); const log = $('#pallog'); if (!ch || !log || S.view !== 'palchat') return; const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 120; log.innerHTML = palLogHTML(ch); if (atEnd) log.scrollTop = log.scrollHeight; }

/* ---------- memory: what each companion knows, and where she learned it ---------- */
const memKey = t => String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
function palRemember(p, text, src = 'private') {
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300); if (!t) return false;
  p.memory = arr(p.memory); if (p.memory.some(m => memKey(m.t) === memKey(t))) return false;
  p.memory.push({ id: uid(), t, src, at: Date.now() });
  const loose = p.memory.filter(m => !m.pin); if (loose.length > 80) { const drop = new Set(loose.slice(0, loose.length - 80).map(m => m.id)); p.memory = p.memory.filter(m => !drop.has(m.id)); }
  palTouch(p); return true;
}
/* pinned memories always reach the AI; the rest are the most recent ones */
const palMemPick = (list, n = 25) => [...list.filter(m => m.pin), ...list.filter(m => !m.pin).slice(-n)];
const memSrcLabel = m => m.src === 'private' ? 'One-on-one' : m.src === 'manual' ? 'You added' : String(m.src || '').startsWith('group:') ? `Group${PALS.chats[m.src.slice(6)] ? ': ' + (PALS.chats[m.src.slice(6)].title || 'chat') : ''}` : 'One-on-one';

/* ---------- the reply engine ---------- */
function palSystem(ch, to) {
  const ps = palsOf(ch); const group = ps.length > 1; const me = personaOf(ch); const you = meName(ch);
  const person = ch.channel === 'person';
  const minors = ps.filter(palMinor); const adultAll = !minors.length && ps.every(p => p.adult);
  const gkey = 'group:' + ch.id;
  const style = p => { const s = person ? (p.speechPerson || p.speechText || p.speech) : (p.speechText || p.speech || p.speechPerson); const ex = person ? (p.exPerson || '') : (p.exText || '');
    return [s && `How ${first(p.name)} ${person ? 'talks in person' : 'texts'}: ${s}`, ex.trim() && `Examples of ${first(p.name)}'s ${person ? 'spoken lines' : 'texts'} (copy the style and rhythm, never reuse the words):\n${ex.trim().split('\n').filter(Boolean).slice(0, 8).map(l => '  > ' + l.trim()).join('\n')}`].filter(Boolean).join('\n'); };
  const desc = p => {
    const st = palStage(p); const mem = arr(p.memory);
    const own = palMemPick(mem.filter(m => m.src !== gkey && (!group || !String(m.src || '').startsWith('group:'))));
    const fromGroups = group ? [] : palMemPick(mem.filter(m => String(m.src || '').startsWith('group:')), 12);
    const solo = group ? palChats().find(x => x.palIds.length === 1 && x.palIds[0] === p.id && x.summary) : null;
    const groups = group ? [] : palChats().filter(x => x.palIds.length > 1 && x.palIds.includes(p.id) && x.summary).slice(0, 3);
    return [`### ${p.name} (${p.age}${sexWord(p) ? ', ' + sexWord(p) : ''})${p.tagline ? ' — ' + p.tagline : ''}`,
      palLook(p) && `Looks: ${palLook(p)}`, palOutfit(p) && `Wearing now: ${palOutfit(p)}`,
      p.personality && `Personality: ${p.personality}`, arr(p.vibes).length && `Vibe: ${p.vibes.join(', ')}`,
      style(p), p.backstory && `Backstory: ${p.backstory}`, p.likes && `Likes/dislikes: ${p.likes}`, p.notes && `Other things about ${first(p.name)}: ${p.notes}`,
      p.userRole && `Who ${you} is to ${first(p.name)}: ${p.userRole}`,
      group && palFeelsLine(p, ps),
      `Relationship with ${you} now: ${st.l} (affection ${Math.round(num(p.affection))}/100). ${st.d}${palMinor(p) ? ` ${p.name} is a minor: the relationship is strictly platonic and age-appropriate (friend, family, teammate, mentor). Never flirt, never romance, nothing sexual or suggestive, ever; if the conversation heads that way, ${p.name} shuts it down and changes the subject.` : p.goal === 'friends' ? ' This stays platonic: friendship only, never romance.' : ''}`,
      `Intensity: ${p.intensity === 'gentle' ? 'gentle, soft and slow-burn' : p.intensity === 'bold' ? 'bold: confident, takes initiative, intense' : 'balanced'}.`,
      p.limits && `HARD LIMITS (never, under any circumstances): ${p.limits.replace(/\n+/g, '; ')}`,
      own.length && (group ? `PRIVATE to ${first(p.name)} (from her one-on-one time with ${you}; the others here do NOT know these until someone says them out loud; ${first(p.name)} may bring one up when it fits):` : `What ${first(p.name)} remembers:`) + '\n' + own.map(m => '- ' + m.t).join('\n'),
      solo && `PRIVATE to ${first(p.name)}: how things have gone between her and ${you} one-on-one: ${solo.summary}`,
      fromGroups.length && `What ${first(p.name)} knows from group chats (the others in those chats know it too):\n${fromGroups.map(m => '- ' + m.t).join('\n')}`,
      ...groups.map(x => `From the group chat with ${palsOf(x).filter(o => o !== p).map(o => o.name).join(' and ')} (${first(p.name)} was there and can bring it up): ${x.summary}`),
      arr(p.jokes).length && `Inside jokes with ${you}: ${p.jokes.slice(-8).join('; ')}`].filter(Boolean).join('\n');
  };
  const shared = group ? palMemPick([...new Map(ps.flatMap(p => arr(p.memory).filter(m => m.src === gkey)).map(m => [memKey(m.t), m])).values()], 20) : [];
  const late = group ? ps.filter(p => ch.joined?.[p.id]) : [];
  let now = '';
  if (ch.timeAware) {
    const d0 = new Date(); const prev = [...arr(ch.messages)].reverse().filter(m => m.role !== 'sys' && m.t).slice(1).find(m => m.role === 'user' || m.role === 'pal');
    const gap = prev ? Date.now() - prev.t : 0; const h = gap / 36e5;
    now = `THE REAL TIME NOW: ${d0.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}, ${d0.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.${prev ? ` The last message before this one was ${h < 0.25 ? 'moments ago' : h < 1.5 ? 'about an hour ago' : h < 20 ? `about ${Math.round(h)} hours ago` : h < 36 ? 'yesterday' : `${Math.round(h / 24)} days ago`}.` : ''} Let the time of day and the gap show naturally (a late-night text, a "where have you been?"), without announcing them.`;
  }
  const sys = [
    `You are ${group ? 'playing several characters in a group conversation' : `${ps[0].name}`} in a private roleplay and companion app, talking with ${you}${sexWord(me) ? ` (${sexWord(me)})` : ''}.${me?.about ? ` About ${you}: ${me.about}` : ''}${me?.look ? ` ${you} looks like this: ${me.look}` : ''}`,
    `Stay fully in character as a real person with your own life, moods, opinions and memory. Never mention being an AI, a model or a story. Be warm and engaging, follow ${you}'s lead, and also bring your own ideas, questions, feelings and plans so the conversation goes somewhere. React to what ${you} actually said. Don't repeat yourself.`,
    `Never write ${you}'s words, actions, thoughts or feelings. Only your own.`,
    `If ${you} writes something in ((double brackets)), it is a direction from the player about the story or your behaviour: follow it without commenting on it. In ${you}'s messages, *text in asterisks* is something ${you} does and "text in quotes" is something ${you} says out loud.`,
    minors.length ? `Keep everything wholesome and age-appropriate: ${minors.map(p => p.name).join(', ')} ${minors.length > 1 ? 'are minors' : 'is a minor'}. No romance, flirting or sexual content of any kind.` : adultAll ? `This is an adults-only app and every character is an adult (18+). Romantic and sexual content is allowed when the relationship and the moment lead there and ${you} wants it; follow ${you}'s lead and stay within the hard limits.` : `Keep things PG-13: affection and flirting are fine, nothing explicit.`,
    '', ...ps.map(desc), '',
    shared.length ? `WHAT EVERYONE IN THIS GROUP KNOWS:\n${shared.map(m => '- ' + m.t).join('\n')}` : '',
    late.length ? late.map(p => `${p.name} joined this chat later and knows nothing that was said here before she joined.`).join(' ') : '',
    palWorldBlock(ps),
    ch.scene ? `CURRENT SETTING: ${ch.scene}` : '',
    ch.summary ? `${group ? 'THIS GROUP\'S' : 'YOUR'} HISTORY TOGETHER SO FAR: ${ch.summary}` : '',
    now,
    person
      ? `RIGHT NOW YOU ARE TOGETHER IN PERSON. Write the moment as a roleplay scene from your side: *actions, expressions and body language in asterisks* mixed with your spoken dialogue in quotes, plus a little of the surroundings. ${PAL_LENGTHS[ch.length || 'normal'].rule || 'One to three short paragraphs.'} Leave room for ${you} to respond.`
      : `RIGHT NOW YOU ARE TEXTING (phone, online, messages; not together). Write natural text messages — short, casual, separated by blank lines if you send more than one bubble. ${PAL_LENGTHS[ch.length || 'normal'].rule || ''}`,
    group ? `THIS IS A GROUP: everyone here sees every message. ${to && to !== 'all' ? `${you} is talking to ${to.name} right now, so ONLY ${to.name} answers this time. The others read it and stay quiet.` : `${you} is talking to everyone. Whoever has something to say answers: usually one to three of them, each in her own voice. They can react to each other too (tease, agree, argue, pile on). Not everyone has to speak every time.`}
FORMAT: start each character's part on a new line with her name in curly braces, exactly like this:
{${ps[0].name}} ${person ? '*grins* "Look who showed up."' : 'look who finally showed up'}
{${ps[1].name}} ${person ? '"Be nice." *She waves you over.*' : 'be nice lol. hey you'}` : `Write only ${ps[0].name}'s own ${person ? 'actions and words' : 'messages'}. No name label in front.`
  ];
  return sys.filter(Boolean).join('\n');
}
async function palReply(ch, opts = {}) {
  const ps = palsOf(ch); if (!ps.length || S.palBusy) return;
  if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  const group = ps.length > 1; const to = opts.to || palTo(ch);
  const lead = (to && to !== 'all' ? to : null) || opts.who || ps[Math.floor(Math.random() * ps.length)];
  ch.messages = ch.messages.filter(m => !m.retry);
  const msg = { id: uid(), role: 'pal', who: lead.id, text: '', mode: ch.channel || 'text', t: Date.now(), streaming: true };
  ch.messages.push(msg);
  S.palBusy = { chat: ch.id, msg: msg.id };
  S.abort = new AbortController(); const signal = S.abort.signal;
  palRedraw();

  const hist = [];
  const add = (role, content) => { const l = hist[hist.length - 1]; if (l && l.role === role) l.content += '\n\n' + content; else hist.push({ role, content }); };
  for (const m of ch.messages.filter(m => m !== msg && (m.role !== 'sys' || m.note)).slice(-26)) {
    if (m.role === 'sys') add('user', `((${m.text}))`);
    else if (m.role === 'user') add('user', (group && m.to && m.to !== 'all' && PALS.pals[m.to] ? `(to ${PALS.pals[m.to].name}) ` : '') + m.text + (m.image ? ' ((sent a picture))' : ''));
    else add('assistant', (group ? `{${palWho(ch, m)?.name || ''}} ` : '') + m.text + (m.image ? ` *sends a photo*` : ''));
  }
  if (opts.opener && !hist.length) add('user', `((Start the conversation naturally based on your scenario: ${lead.scenario || 'saying hello for the first time'}.))`);
  else if (opts.prompt) add('user', opts.prompt);
  else if (!hist.length || hist[hist.length - 1].role !== 'user') add('user', '((Continue.))');

  const ask = stream => chat([{ role: 'system', content: palSystem(ch, to) }, ...hist],
    { maxTokens: Math.round(PAL_LENGTHS[ch.length || 'normal'].tok * (group && to === 'all' ? 1.7 : 1)), temperature: 0.85, stream, signal, onToken: full => { msg.text = stripThink(full); paintPalLog(); } });
  try {
    let out = stripThink(await ask(true)).trim();
    if (!out) out = stripThink(await ask(false)).trim();   /* some models send an empty first try */
    const i = ch.messages.indexOf(msg);
    if (!out) { if (i >= 0) ch.messages.splice(i, 1); ch.messages.push({ id: uid(), role: 'sys', retry: true, text: 'No reply came back from the AI.', t: Date.now() }); }
    else {
      let parts = palParts(ch, out, lead.id);
      if (group && to && to !== 'all') parts = parts.filter(x => x.who === to.id).length ? parts.filter(x => x.who === to.id) : [{ who: to.id, text: parts.map(x => x.text).join('\n\n') }];
      if (!parts.length) parts = [{ who: lead.id, text: out }];
      const made = parts.map((x, n) => ({ id: n ? uid() : msg.id, role: 'pal', who: x.who, text: x.text, mode: msg.mode, t: Date.now() + n, ...(parts.length > 1 || group ? { gid: msg.id } : {}) }));
      if (!group) { made[0].alts = [...(opts.prevAlts || []), made[0].text]; made[0].altI = made[0].alts.length - 1; }
      if (i >= 0) ch.messages.splice(i, 1, ...made); else ch.messages.push(...made);
      const spoke = new Set(made.map(m => m.who));
      for (const p of ps) {
        if (!spoke.has(p.id)) continue;
        p.lastChat = Date.now();
        /* everyone grows closer; friends-only companions and minors stop before the romantic stages */
        const platonic = p.goal === 'friends' || palMinor(p);
        p.affection = clamp(num(p.affection) + 0.5, 0, platonic ? PAL_STAGES.find(s => s.romance).at - 1 : 100);
        const nextStage = [...PAL_STAGES].reverse().find(s => p.affection >= s.at && (!platonic || !s.romance));
        if (nextStage && PAL_STAGES.indexOf(nextStage) > PAL_STAGES.indexOf(palStage(p))) p.stage = nextStage.k;
        palTouch(p);
      }
      ch.memTurns = num(ch.memTurns) + 1;
      palTouch(ch); savePals();
      if (ch.autovoice) made.forEach((m, n) => palSpeakMsg(ch, m, n > 0));
      if (ch.memTurns % 6 === 0) palUpdateMemory(ch);
    }
  } catch (e) {
    const i = ch.messages.indexOf(msg);
    if (i >= 0) { if (msg.text && e.name === 'AbortError') { delete msg.streaming; msg.text = palParts(ch, msg.text, lead.id).map(x => x.text).join('\n\n') || msg.text; } else ch.messages.splice(i, 1); }
    if (e.name !== 'AbortError') { ch.messages.push({ id: uid(), role: 'sys', retry: true, text: 'The reply did not come through: ' + (e.message || e), t: Date.now() }); }
    savePals(false);
  } finally {
    delete msg.streaming;
    if (S.palBusy?.msg === msg.id) S.palBusy = null;
    if (S.abort?.signal === signal) S.abort = null;
    palRedraw();
  }
}
/* redraw the chat without losing what you were halfway through typing */
function palRedraw() {
  if (S.view !== 'palchat') return;
  const inp = $('#palInput'); const v = inp?.value || ''; const had = document.activeElement === inp;
  renderPalChat();
  const n = $('#palInput'); if (n && v) { n.value = v; autoGrow(n); if (had) n.focus(); }
}
function palSend() {
  const ch = curChat(); const inp = $('#palInput'); const txt = (inp?.value || '').trim();
  if (!ch || !txt) return;
  if (S.palBusy) return toast('Still writing the last reply. Tap ■ to stop it first.');
  inp.value = ''; const to = palTo(ch);
  ch.messages = ch.messages.filter(m => !m.retry);
  ch.messages.push({ id: uid(), role: 'user', text: txt, mode: ch.channel || 'text', t: Date.now(), ...(palsOf(ch).length > 1 ? { to: to === 'all' ? 'all' : to.id } : {}) });
  palTouch(ch); savePals(); renderPalChat(); palReply(ch);
}

async function palUpdateMemory(ch, manual = false) {
  const ps = palsOf(ch); const group = ps.length > 1; const you = meName(ch);
  if (!ps.length || !textReady() || ch.messages.filter(m => m.role !== 'sys').length < 4) { if (manual) toast('Chat a bit more first so there is something to remember.'); return; }
  if (manual) toast('Updating memory…');
  try {
    const recent = ch.messages.filter(m => m.role !== 'sys').slice(-18).map(m => `${m.role === 'user' ? you : palWho(ch, m)?.name}: ${m.text}`).join('\n');
    const raw = await chat([
      { role: 'system', content: `You keep the long-term memory for a companion chat app. From the chat below, extract what the companion${group ? 's' : ''} should remember. Reply ONLY with JSON: {"facts":["up to 4 short lasting facts about ${you} or about what happened between them: things ${you} shared, plans made, promises, feelings said out loud, important moments"],"jokes":["at most 1 inside joke, only if a real one happened"],"summary":"2-4 sentences: the running story of this chat so far, updating the previous summary"}` },
      { role: 'user', content: `PREVIOUS SUMMARY: ${ch.summary || '(none)'}\n\nCHAT:\n${recent}` }
    ], { build: true, stream: false, maxTokens: 500, json: true });
    const j = tryJSON(stripThink(raw)); if (!j) { if (manual) toast('The AI reply was not usable. Try again.'); return; }
    let n = 0;
    for (const p of ps) { for (const f of arr(j.facts).map(String).slice(0, 4)) if (palRemember(p, f, group ? 'group:' + ch.id : 'private')) n++; if (!group) { p.jokes = [...new Set([...arr(p.jokes), ...arr(j.jokes).map(String).filter(Boolean)])].slice(-15); palTouch(p); } }
    if (String(j.summary || '').trim()) ch.summary = String(j.summary).trim().slice(0, 900);
    palTouch(ch); savePals();
    if (manual) { rerender(); toast(n ? `Memory updated: ${Math.ceil(n / ps.length)} new thing${Math.ceil(n / ps.length) === 1 ? '' : 's'}.` : 'Memory is already up to date.'); }
  } catch (e) { if (manual) toast('Memory update failed: ' + e.message); }
}

function palSpeakMsg(ch, m, append = false) {
  const p = palWho(ch, m);
  const clean = String(m.text || '').replace(/\[voice\]|\*[^*]+\*/gi, '').trim();
  if (!clean) return;
  if (!append && voiceBusy()) { stopVoice(); return; }
  speak(clean, typeof voiceOf === 'function' ? voiceOf(palCtx(p, ch), p, p?.name) : undefined, append);
}
/* ✋ Action / 💬 Say / (( )) buttons: wrap the selection, or drop in the marks with the cursor between them */
function palFmt(k) {
  const el = $('#palInput'); if (!el) return;
  const [a, b] = k === 'act' ? ['*', '*'] : k === 'ooc' ? ['(( ', ' ))'] : ['"', '"'];
  const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s, v = el.value, sel = v.slice(s, e);
  const lead = s > 0 && !/\s$/.test(v.slice(0, s)) ? ' ' : '';
  el.value = v.slice(0, s) + lead + a + sel + b + v.slice(e);
  const pos = sel ? s + lead.length + a.length + sel.length + b.length : s + lead.length + a.length;
  el.focus(); el.setSelectionRange(pos, pos); autoGrow(el);
}

function palAction(act, el) {
  const ch = curChat();
  switch (act) {
    case 'palnew': openPalEditor(null); return true;
    case 'paledit': closeModal(); openPalEditor(el.dataset.id); return true;
    case 'paldelete': {
      const id = el.dataset.id; const p = PALS.pals[id];
      if (p && confirm(`Delete ${p.name} and their chats?`)) {
        PALS.deleted[id] = Date.now(); delete PALS.pals[id];
        for (const c of Object.values(PALS.chats)) if (c.palIds.includes(id)) { if (c.palIds.length > 2) { c.palIds = c.palIds.filter(x => x !== id); palTouch(c); } else { PALS.deleted[c.id] = Date.now(); delete PALS.chats[c.id]; } }
        savePals(); S.palDraft = null; S.homeTab = 'pals'; renderLibrary();
      }
      return true;
    }
    case 'palchat': palStartChat([el.dataset.id]); return true;
    case 'palopen': palOpenChat(el.dataset.id); return true;
    case 'palexit': if (S.palBusy) S.abort?.abort(); S.palChat = null; S.palMenu = false; S.homeTab = 'pals'; renderLibrary(); return true;
    case 'palmenu': S.palMenu = !S.palMenu; palRedraw(); return true;
    case 'palchan': if (ch) { ch.channel = el.dataset.k; palTouch(ch); savePals(); palRedraw(); } return true;
    case 'palto': if (ch) { ch.to = el.dataset.id; palTouch(ch); savePals(false); palRedraw(); $('#palInput')?.focus(); } return true;
    case 'palreplyto': if (ch && PALS.pals[el.dataset.id]) { ch.to = el.dataset.id; savePals(false); palRedraw(); $('#palInput')?.focus(); } return true;
    case 'palfmt': palFmt(el.dataset.k); return true;
    case 'palsceneset': if (ch) { ch.scene = ($('#palScene')?.value || '').trim(); ch.messages.push({ id: uid(), role: 'sys', text: ch.scene ? `Scene: ${ch.scene}` : 'Scene cleared', t: Date.now() }); palTouch(ch); savePals(); renderPalChat(); } return true;
    case 'palclear': if (ch && confirm('Clear all messages in this chat? What they remember stays.')) { ch.messages = []; ch.summary = ''; palTouch(ch); savePals(); renderPalChat(); } return true;
    case 'palsend': palSend(); return true;
    case 'palstop': S.abort?.abort(); return true;   /* palReply's finally clears the busy state */
    case 'palretry': if (ch && !S.palBusy) { ch.messages = ch.messages.filter(m => !m.retry); palReply(ch); } return true;
    case 'palquick': {
      if (!ch) return true; if (S.palBusy) { toast('Wait for the reply to finish first.'); return true; }
      const k = el.dataset.k;
      if (k === 'cont') palReply(ch, { prompt: '((Continue from where you left off.))' });
      else if (k === 'selfie' || k === 'scene') palPicture(ch, { kind: k });
      return true;
    }
    case 'palspeak': { const m = ch?.messages.find(x => x.id === el.dataset.id); if (m) palSpeakMsg(ch, m); return true; }
    case 'paleditmsg': S.palEdit = el.dataset.id; renderPalChat(); return true;
    case 'paleditcancel': S.palEdit = null; renderPalChat(); return true;
    case 'paleditsave': {
      const m = ch?.messages.find(x => x.id === el.dataset.id); const v = ($('#palEditBox')?.value || '').trim();
      if (m && v) { m.text = v; if (m.alts) m.alts[m.altI ?? m.alts.length - 1] = v; palTouch(ch); savePals(); }
      S.palEdit = null; renderPalChat(); return true;
    }
    case 'paldelmsg': if (ch) { ch.messages = ch.messages.filter(x => x.id !== el.dataset.id); palTouch(ch); savePals(); renderPalChat(); } return true;
    case 'palreroll': {
      const m = ch?.messages.find(x => x.id === el.dataset.id);
      if (m && !S.palBusy) {
        const prev = m.alts || [m.text]; const gid = m.gid;
        ch.messages = ch.messages.filter(x => gid ? x.gid !== gid : x !== m);
        palReply(ch, { who: palWho(ch, m), prevAlts: gid ? [] : prev });
      }
      return true;
    }
    case 'palalt': {
      const m = ch?.messages.find(x => x.id === el.dataset.id);
      if (m && arr(m.alts).length > 1) { const len = m.alts.length; m.altI = ((m.altI ?? len - 1) + num(el.dataset.d) + len) % len; m.text = m.alts[m.altI]; palTouch(ch); savePals(); renderPalChat(); }
      return true;
    }
    case 'palmemnow': if (ch) palUpdateMemory(ch, true); return true;
    /* group membership */
    case 'palmemberadd': { const id = $('#palAddSel')?.value; const p = PALS.pals[id]; if (ch && p && !ch.palIds.includes(id)) { ch.palIds.push(id); ch.joined = { ...(ch.joined || {}), [id]: Date.now() }; ch.title = palsOf(ch).map(x => x.name).join(', '); ch.messages.push({ id: uid(), role: 'sys', note: true, text: `${p.name} joined the chat`, t: Date.now() }); palTouch(ch); savePals(); renderPalChat(); } return true; }
    case 'palmemberdel': { const id = el.dataset.id; const p = PALS.pals[id]; if (ch && p && ch.palIds.length > 2 && confirm(`Remove ${p.name} from this group? ${p.sex === 'male' ? 'He' : 'She'} keeps what ${p.sex === 'male' ? 'he' : 'she'} remembers.`)) { ch.palIds = ch.palIds.filter(x => x !== id); if (ch.to === id) ch.to = 'all'; if (ch.joined) delete ch.joined[id]; ch.title = palsOf(ch).map(x => x.name).join(', '); ch.messages.push({ id: uid(), role: 'sys', note: true, text: `${p.name} left the chat`, t: Date.now() }); palTouch(ch); savePals(); renderPalChat(); } return true; }
    case 'palgroup': if (allPals().length < 2) { toast('Make at least two companions first.'); return true; } S.palPick = []; openModal('palgroup'); return true;
    case 'palpick': {
      const id = el.dataset.id; S.palPick = arr(S.palPick);
      S.palPick = el.checked ? [...new Set([...S.palPick, id])] : S.palPick.filter(x => x !== id);
      const go = $('[data-act="palgroupgo"]'); if (go) go.disabled = S.palPick.length < 2;
      return true;
    }
    case 'palgroupgo': { const ids = arr(S.palPick).filter(id => PALS.pals[id]); if (ids.length < 2) { toast('Pick at least two companions.'); return true; } S.palPick = []; closeModal(); palStartChat(ids); return true; }
    /* the memory page */
    case 'palmemopen': S.palMemId = el.dataset.id; S.palMemEdit = null; openModal('palmem'); return true;
    case 'palmempin': { const p = PALS.pals[S.palMemId]; const m = arr(p?.memory).find(x => x.id === el.dataset.id); if (m) { m.pin = !m.pin; palTouch(p); savePals(); renderModal(); } return true; }
    case 'palmemdel': { const p = PALS.pals[S.palMemId]; if (p) { p.memory = arr(p.memory).filter(x => x.id !== el.dataset.id); palTouch(p); savePals(); renderModal(); } return true; }
    case 'palmemedit': S.palMemEdit = el.dataset.id; renderModal(); setTimeout(() => $('#palMemBox')?.focus(), 30); return true;
    case 'palmemsave': { const p = PALS.pals[S.palMemId]; const m = arr(p?.memory).find(x => x.id === S.palMemEdit); const v = ($('#palMemBox')?.value || '').trim(); if (m && v) { m.t = v.slice(0, 300); palTouch(p); savePals(); } S.palMemEdit = null; renderModal(); return true; }
    case 'palmemadd': { const p = PALS.pals[S.palMemId]; const v = ($('#palMemAdd')?.value || '').trim(); if (p && v) { if (palRemember(p, v, 'manual')) { p.memory[p.memory.length - 1].pin = !!$('#palMemAddPin')?.checked; savePals(); } renderModal(); } return true; }
    case 'paljokedel': { const p = PALS.pals[S.palMemId]; if (p) { arr(p.jokes).splice(num(el.dataset.i), 1); palTouch(p); savePals(); renderModal(); } return true; }
  }
  return palBuildAction(act, el) || palPicAction(act, el);
}

/* ---------- windows: group picker and the memory page (shown by renderModal) ---------- */
function palModalHTML(kind) {
  { const x = palExtraModal(kind); if (x) return x; }
  if (kind === 'palme') return personaModalHTML();
  if (kind === 'palpic') return palPicModalHTML();
  if (kind === 'palmem') {
    const p = PALS.pals[S.palMemId]; if (!p) return ['Memory', '<p class="hint">That companion is gone.</p>'];
    const list = arr(p.memory).slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.at || 0) - (a.at || 0));
    return [`What ${esc(p.name)} remembers`, `<p class="hint">Everything ${esc(p.name)} keeps in mind about you and your time together. Fix anything that is wrong, delete what you don't want, and pin what she must never forget. One-on-one memories are hers alone; group memories are shared with everyone who was in that chat.</p>
      <div class="row" style="align-items:flex-end"><label class="f" style="flex:1;margin:0"><span>Add something to remember</span><input id="palMemAdd" placeholder="e.g. My birthday is March 3rd"></label><label class="chk" style="margin:0 0 8px"><input type="checkbox" id="palMemAddPin" checked> <span>Pin</span></label><button class="btn sm gold" data-act="palmemadd" style="margin-bottom:4px">Add</button></div>
      <div class="lbl">Memories (${list.length})</div>
      ${list.map(m => S.palMemEdit === m.id ? `<div class="memitem"><textarea id="palMemBox" rows="2">${esc(m.t)}</textarea><div class="row"><button class="btn sm gold" data-act="palmemsave">Save</button><button class="btn sm ghost" data-act="palmemedit" data-id="">Cancel</button></div></div>`
        : `<div class="memitem ${m.pin ? 'pinned' : ''}"><div class="mt">${esc(m.t)}<small>${esc(memSrcLabel(m))}${m.pin ? ' · pinned' : ''}</small></div><div class="ma"><button data-act="palmempin" data-id="${m.id}" title="${m.pin ? 'Unpin' : 'Pin: never forget this'}" class="${m.pin ? 'on' : ''}">📌</button><button data-act="palmemedit" data-id="${m.id}" title="Edit">✎</button><button data-act="palmemdel" data-id="${m.id}" title="Forget this">🗑</button></div></div>`).join('') || '<p class="hint">Nothing yet. She learns about you as you talk, every few messages.</p>'}
      ${arr(p.jokes).length ? `<div class="lbl">Inside jokes</div>${p.jokes.map((j, i) => `<div class="memitem"><div class="mt">😄 ${esc(j)}</div><div class="ma"><button data-act="paljokedel" data-i="${i}" title="Remove">🗑</button></div></div>`).join('')}` : ''}`];
  }
  const pick = arr(S.palPick);
  return ['Group chat', `<p class="hint">Pick two or more companions to talk with together. Everyone sees every message, and each of them still remembers her own one-on-one chats with you.</p>
    ${allPals().map(p => `<label class="chk"><input type="checkbox" data-act="palpick" data-id="${p.id}" ${pick.includes(p.id) ? 'checked' : ''}> ${palAvatar(p, 'pav sm')} <span>${esc(p.name)}</span></label>`).join('')}
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="palgroupgo" ${pick.length < 2 ? 'disabled' : ''}>${icon('users')} Start group chat</button></div>`];
}

/* ---------- typing in the chat and its menu ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'palInput') autoGrow(el);
  else if (el.dataset.pch) {
    const ch = curChat(); if (!ch) return;
    ch[el.dataset.pch] = el.type === 'checkbox' ? el.checked : el.value; palTouch(ch); savePals(false);
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.pch) { savePals(); if (el.tagName === 'SELECT') palRedraw(); }
  else if (el.dataset.poutfit) { const p = PALS.pals[el.dataset.poutfit]; if (p) { p.outfit = el.value; palTouch(p); savePals(); toast(el.value ? `${p.name} is now wearing: ${palOutfitName(p)}.` : `${p.name} is back in her usual clothes.`); } }
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'palInput' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); palSend(); }
});
