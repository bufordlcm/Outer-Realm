'use strict';
/* =========================================================================
   COMPANIONS: AI characters you talk to, separate from the RPG.
   - Your own characters only, saved on this device and in Google Drive (one folder per companion
     under Companions/, plus a combined companions.json there as a backup)
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
/* the persona the app treats as "you" when a screen needs one */
function myPersona() { return PALS.personas[PALS.defaultPersona] || allPersonas()[0] || null; }

/* ---------- who you are in a chat ---------- */
const palsOf = chat => arr(chat?.palIds).map(id => PALS.pals[id]).filter(Boolean);
const curChat = () => PALS.chats[S.palChat];
function personaOf(ch, p) {
  const one = p || (palsOf(ch).length === 1 ? palsOf(ch)[0] : null);
  return PALS.personas[ch?.personaId] || PALS.personas[one?.personaId] || PALS.personas[PALS.defaultPersona] || allPersonas()[0] || null;
}
const meName = (ch, p) => (personaOf(ch, p)?.name || '').trim() || 'you';
const sexWord = x => x?.sex === 'female' ? 'female' : x?.sex === 'male' ? 'male' : '';

/* a companion under 16 (by age or by how they're described) is always platonic: no romance, no 18+, safe pictures.
   The rule itself lives in js/ageguard.js (AGE.isMinor) so pictures and chats can never disagree. */
const palMinor = p => AGE.isMinor(p);
const palStage = p => PAL_STAGES.find(s => s.k === p.stage) || PAL_STAGES[0];

/* ---------- how a companion looks (used by the chat and by every picture) ---------- */
const palLook = p => [p?.face, p?.body].map(s => String(s || '').trim()).filter(Boolean).join('. ') || String(p?.look || '').trim();
const palOutfit = p => { const o = arr(p?.outfits).find(x => x.id === p.outfit); return String(o?.desc || p?.clothing || '').trim(); };
const palOutfitName = p => arr(p?.outfits).find(x => x.id === p.outfit)?.name || (p?.clothing ? 'Usual clothes' : '');

/* the picture engine and voice engine expect a game; this is the companion's stand-in */
function palCtx(p, chat) {
  const group = chat ? palsOf(chat) : [p];
  /* per character: this picture is of p, so only p's own card and age decide it */
  const adultOK = !!p.adult && !AGE.isProtected(p);
  const ctx = p._ctx || (Object.defineProperty(p, '_ctx', { value: {}, enumerable: false, writable: true }), p._ctx);
  const me = personaOf(chat, p);
  Object.assign(ctx, {
    id: 'pal_' + p.id, title: p.name, genre: '', premise: '', location: chat?.scene || '', artStyle: p.art || 'photorealistic, natural light, detailed',
    rating: adultOK ? 'M' : 'PG-13', character: { name: meName(chat, p), appearance: [palLook(p), AGE.isMinor(p) ? 'under 16 years old' : ''].filter(Boolean).join(', '), backstory: '', storyRole: '' },
    party: group, codex: [], voiceMap: chat ? (chat.voiceMap = chat.voiceMap || {}) : {}
  });
  return ctx;
}
const palImg = (img, p, chat) => !img ? '' : img.data ? img.data : S.settings.image.mode !== 'off' && p ? imageUrl(img, palCtx(p, chat)) : '';
const palAvatar = (p, cls = 'pav') => { const src = p?.portrait ? palImg(p.portrait, p) : ''; return src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="${cls} pavi" style="background:${palColor(p)}">${initial(p?.name)}</span>`; };
const palColor = p => `hsl(${hashNum(p?.name || '') % 360} 45% 38%)`;

/* ---------- Drive sync (called from syncNow) ---------- */
/* Each companion gets their own folder under Companions/, holding their card, their chats and their
   pictures. companions.json stays at the root as the combined backup and for older copies of the app. */
const palStamp = p => Object.values(PALS.chats).filter(ch => arr(ch.palIds).includes(p.id)).reduce((m, ch) => Math.max(m, ch.updatedAt || 0), p.updatedAt || 0);
const palFolderName = p => String(safeName(p.name || 'Companion')).slice(0, 60) || 'Companion';
/* a companion's painted portrait, as bytes. The lookup must use the same inputs the painter did,
   including the face reference and the subject, or the key never matches. */
async function palPicBlob(p) {
  try {
    const img = p.portrait, s = S.settings.image;
    const subject = img?.subj && typeof subjChar === 'function' ? subjChar(img.subj) : null;
    const ref = s.refPhotos !== false && img?.subj && typeof subjRef === 'function' ? subjRef(img.subj) : null;
    const k = localKeyFor(img, palCtx(p, null), subject, ref);
    return (await IDB.get(k)) || (await DriveImg.get(k)) || null;
  } catch (e) { console.warn('Companion portrait', e); return null; }
}
/* one attempt per picture per session: a picture painted on another device is not looked for on every sync */
const picTried = new Set();
/* the painted picture for a persona's photo, as bytes ready for the same upload path uploaded photos use */
async function personaPicBlob(img) {
  try { const k = localKeyFor(img, null); const b = await IDB.get(k) || await DriveImg.get(k); return b || null; }
  catch (e) { console.warn('Persona picture', e); return null; }
}
const personaMD = x => [`# ${x.name || 'Persona'}`, x.sex ? `*${x.sex}*` : '', '', '## About', x.about || '—', '', '## Appearance', x.look || '—'].join('\n');
function dataUrlBlob(u) {
  const m = /^data:([^;,]+);base64,(.*)$/i.exec(String(u || '')); if (!m) return null;
  try { const bin = atob(m[2]); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new Blob([bytes], { type: m[1] }); }
  catch { return null; }
}
async function syncPals(root) {
  let folder = (await Drive.list(`'${root}' in parents and name='Companions' and mimeType='${FOLDER_MIME}' and trashed=false`))[0]?.id;
  if (!folder) { if (!Object.keys(PALS.pals).length && !Object.keys(PALS.chats).length && !Object.keys(PALS.personas).length && !Object.keys(PALS.worlds).length) return 0; folder = await Drive.createFolder('Companions', root, {}); }
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

  /* one folder per companion */
  let folders = [];
  try { folders = await Drive.list(`'${folder}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`); } catch (e) { console.warn('Companion folders', e); }
  const byPal = {};
  for (const f of folders) { const pid = f.appProperties?.iqPal; if (pid) byPal[pid] = f; }
  /* pull anything a companion folder has that is newer */
  for (const [pid, f] of Object.entries(byPal)) {
    if (PALS.deleted[pid] && PALS.deleted[pid] >= num(f.appProperties?.iqUpdated)) continue;
    const local = PALS.pals[pid];
    if (local && palStamp(local) >= num(f.appProperties?.iqUpdated)) continue;
    try {
      const cf = await Drive.fileId(f.id, 'companion.json'); if (!cf) continue;
      const data = await Drive.getJSON(cf); if (!data || !data.pal) continue;
      if (PALS.deleted[pid] && PALS.deleted[pid] >= (data.pal.updatedAt || 0)) continue;   /* deleted on another device: do not resurrect */
      if (data.pal.updatedAt && (!local || (data.pal.updatedAt || 0) > (local.updatedAt || 0))) { PALS.pals[pid] = palUpgrade(data.pal); changed++; }
      for (const r of arr(data.chats)) {
        if (PALS.deleted[r.id] && PALS.deleted[r.id] >= (r.updatedAt || 0)) continue;
        if (S.palBusy && r.id === S.palBusy.chat) continue;
        const l = PALS.chats[r.id];
        if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) { PALS.chats[r.id] = r; changed++; }
      }
    } catch (e) { console.warn('Companion folder read failed', e); }
  }
  if (changed) savePals(false);
  /* push each companion's card, chats and pictures into their own folder */
  for (const p of Object.values(PALS.pals)) {
    const stamp = palStamp(p); let f = byPal[p.id];
    const chats = Object.values(PALS.chats).filter(ch => arr(ch.palIds).includes(p.id));
    const needsData = !f || num(f.appProperties?.iqUpdated) < stamp;
    /* a painted portrait may not be on this device: try once, not on every sync */
    const picMark = 'pal:' + p.id + ':' + stamp;
    const needsPortrait = !!p.portrait && !f?.appProperties?.iqPortrait && !picTried.has(picMark);
    if (f && !needsData && !needsPortrait) continue;
    try {
      if (!f) f = { id: await Drive.createFolder(palFolderName(p), folder, { iqPal: p.id, iqUpdated: '0' }), appProperties: {} };
      let port = null;
      if (needsData || needsPortrait) {
        port = dataUrlBlob(p.portrait?.data);
        if (!port && p.portrait?.prompt) port = await palPicBlob(p);
      }
      if (!port && p.portrait && !f?.appProperties?.iqPortrait) picTried.add(picMark);
      if (needsData) await Drive.put(f.id, 'companion.json', JSON.stringify({ app: APP, savedAt: Date.now(), pal: p, chats }), 'application/json');
      if (port) await Drive.putFile(f.id, 'portrait.jpg', port, 'image/jpeg');
      if (needsData) {
        const photos = chats.some(ch => arr(ch.messages).some(m => m && m.image && m.image.data)) ? await Drive.folder(f.id, 'Photos') : null;
        for (const ch of chats) for (const m of arr(ch.messages)) {
          const photo = photos && m && m.image && dataUrlBlob(m.image.data);
          if (photo) await Drive.putFile(photos, 'photo-' + String(m.id) + '.jpg', photo, 'image/jpeg');
        }
      }
      if (needsData || port) await Drive.patch(f.id, { name: palFolderName(p), appProperties: { iqPal: p.id, iqUpdated: String(stamp), ...(port ? { iqPortrait: '1' } : {}) } });
    } catch (e) { console.warn('Companion folder sync failed', e); }
  }

  /* one folder per persona, holding their profile */
  const personas = Object.values(PALS.personas);
  if (personas.length) {
    let pRoot = (await Drive.list(`name='Personas' and '${root}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`))[0]?.id;
    if (!pRoot) pRoot = await Drive.createFolder('Personas', root, { iqPersonas: '1' });
    let pf = [];
    try { pf = await Drive.list(`'${pRoot}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`); } catch (e) { console.warn('Persona folders', e); }
    const byPer = {}; for (const f of pf) { const pid = f.appProperties?.iqPersona; if (pid) byPer[pid] = f; }
    for (const [pid, f] of Object.entries(byPer)) {
      if (PALS.deleted[pid] && PALS.deleted[pid] >= num(f.appProperties?.iqUpdated)) continue;
      const local = PALS.personas[pid];
      if (local && (local.updatedAt || 0) >= num(f.appProperties?.iqUpdated)) continue;
      try {
        const id = await Drive.fileId(f.id, 'persona.json'); if (!id) continue;
        const data = await Drive.getJSON(id); if (!data || !data.persona) continue;
        if (PALS.deleted[pid] && PALS.deleted[pid] >= (data.persona.updatedAt || 0)) continue;
        if (!local || (data.persona.updatedAt || 0) > (local.updatedAt || 0)) { PALS.personas[pid] = data.persona; changed++; }
      } catch (e) { console.warn('Persona folder read failed', e); }
    }
    if (changed) savePals(false);
    for (const x of personas) {
      const stamp = x.updatedAt || 0; let f = byPer[x.id];
      const needsData = !f || num(f.appProperties?.iqUpdated) < stamp;
      /* a painted photo may not be on this device: try once, not on every sync */
      const picMark = 'per:' + x.id + ':' + stamp;
      const needsPortrait = !!(x.portrait?.data || x.portrait?.prompt) && !f?.appProperties?.iqPortrait && !picTried.has(picMark);
      if (f && !needsData && !needsPortrait) continue;
      try {
        if (!f) f = { id: await Drive.createFolder(palFolderName(x), pRoot, { iqPersona: x.id, iqUpdated: '0' }), appProperties: {} };
        let port = null;
        if (needsData || needsPortrait) {
          /* an uploaded photo is already bytes; a painted one is fetched from this device's store (or Drive) */
          port = dataUrlBlob(x.portrait?.data);
          if (!port && x.portrait?.prompt) port = await personaPicBlob(x.portrait);
        }
        if (needsData) {
          await Drive.put(f.id, 'persona.json', JSON.stringify({ app: APP, savedAt: Date.now(), persona: x }), 'application/json');
          await Drive.put(f.id, 'Persona.md', personaMD(x), 'text/markdown');
        }
        if (!port && (x.portrait?.data || x.portrait?.prompt) && !f?.appProperties?.iqPortrait) picTried.add(picMark);
        if (port) await Drive.putFile(f.id, 'portrait.jpg', port, 'image/jpeg');
        if (needsData || port) await Drive.patch(f.id, { name: palFolderName(x), appProperties: { iqPersona: x.id, iqUpdated: String(stamp), ...(port ? { iqPortrait: '1' } : {}) } });
      } catch (e) { console.warn('Persona folder sync failed', e); }
    }
  }
  changed = await syncWorlds(root, changed);
  return changed;
}

/* one folder per shared setting, holding its notes and who lives there */
async function syncWorlds(root, changed) {
  const worlds = Object.values(PALS.worlds);
  if (!worlds.length) return changed;
  let rootId = (await Drive.list(`name='Worlds' and '${root}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`))[0]?.id;
  if (!rootId) rootId = await Drive.createFolder('Worlds', root, { iqWorlds: '1' });
  let subs = [];
  try { subs = await Drive.list(`'${rootId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`); } catch (e) { console.warn('World folders', e); }
  const byWorld = {}; for (const f of subs) { const id = f.appProperties?.iqWorld; if (id) byWorld[id] = f; }
  for (const [id, f] of Object.entries(byWorld)) {
    if (PALS.deleted[id] && PALS.deleted[id] >= num(f.appProperties?.iqUpdated)) continue;
    const local = PALS.worlds[id];
    if (local && (local.updatedAt || 0) >= num(f.appProperties?.iqUpdated)) continue;
    try {
      const fid = await Drive.fileId(f.id, 'world.json'); if (!fid) continue;
      const data = await Drive.getJSON(fid); if (!data || !data.world) continue;
      if (PALS.deleted[id] && PALS.deleted[id] >= (data.world.updatedAt || 0)) continue;
      if (!local || (data.world.updatedAt || 0) > (local.updatedAt || 0)) { PALS.worlds[id] = data.world; changed++; }
    } catch (e) { console.warn('World folder read failed', e); }
  }
  if (changed) savePals(false);
  for (const w of worlds) {
    const stamp = w.updatedAt || 0; let f = byWorld[w.id];
    if (f && num(f.appProperties?.iqUpdated) >= stamp) continue;
    try {
      if (!f) f = { id: await Drive.createFolder(palFolderName(w), rootId, { iqWorld: w.id, iqUpdated: '0' }) };
      await Drive.put(f.id, 'world.json', JSON.stringify({ app: APP, savedAt: Date.now(), world: w }), 'application/json');
      await Drive.put(f.id, 'Setting.md', worldMD(w), 'text/markdown');
      await Drive.patch(f.id, { name: palFolderName(w), appProperties: { iqWorld: w.id, iqUpdated: String(stamp) } });
    } catch (e) { console.warn('World folder sync failed', e); }
  }
  return changed;
}
const worldMD = w => {
  const cast = arr(w.palIds).map(id => PALS.pals[id]?.name).filter(Boolean).map(n => '- ' + n);
  return [`# ${w.name || 'Shared setting'}`, '', w.text || '—', '', '## Who lives here', ...(cast.length ? cast : ['—'])].join('\n');
};

/* ---------- the Companions home tab ---------- */
function palsHomeHTML() {
  const chats = palChats();
  const sort = S.palSort || 'recent';
  const pals = sortedBy(allPals(), sort, p => p.name, p => p.lastChat || p.updatedAt);
  if (!pals.length) return `<section class="hsec"><div class="card palhero">
      <h2>Companions</h2><p class="hint" style="color:var(--ink);font-size:15px">Characters who actually get you. Build your own companion: their look, voice, personality and the way they talk to you. They remember you, your history and your inside jokes, and your relationship grows the more you talk.</p>
      <p class="hint">Text them like a friend, or meet up in person and play out a scene together. Everything stays on your devices and your Google Drive.</p>
      <div class="row wrap"><button class="btn gold" data-act="palnew">${icon('plus')} Create your first companion</button><button class="btn" data-act="palme">${icon('person')} Your personas</button></div></div></section>`;
  return `<section class="hsec">
    <div class="hsechd"><h2>Companions</h2><div class="row">${pals.length > 1 ? sortSelect('palSort', sort) : ''}<button class="btn sm" data-act="palgroup" ${pals.length < 2 ? 'disabled title="Make at least two companions first"' : ''}>${icon('users')} Group chat</button><button class="btn sm" data-act="palme">${icon('person')} Your personas</button><button class="btn sm" data-act="palworlds">${icon('book')} Shared settings</button><button class="btn gold sm" data-act="palnew">${icon('plus')} New companion</button></div></div>
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
  /* a new chat starts by asking whether it is texting or in person */
  const ch = { id: uid(), palIds: ids, title: ps.length > 1 ? ps.map(p => p.name).join(', ') : '', channel: '', scene: '', length: 'normal', to: 'all', messages: [], memTurns: 0, createdAt: Date.now(), updatedAt: Date.now() };
  PALS.chats[ch.id] = ch;
  for (const p of ps) if (p.greeting && ps.length === 1) ch.messages.push({ id: uid(), role: 'pal', who: p.id, text: p.greeting, mode: 'text', t: Date.now() });
  palTouch(ch); savePals(); palOpenChat(ch.id);
}
function palOpenChat(id) {
  const ch = PALS.chats[id];
  /* no channel yet (a brand-new chat): choose texting or in person first */
  if (ch && !ch.channel) { S.palSetupChat = id; openModal('palchan'); return; }
  S.palChat = id; S.view = 'palchat'; S.palEdit = null; S.palMenu = false; renderPalChat();
}
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
        ${picsOn && selfieOf ? `<button class="chip" data-act="palquick" data-k="selfie">📷 Ask ${one ? '' : esc(first(selfieOf.name)) + ' '}for a selfie</button>` : ''}${picsOn ? '<button class="chip" data-act="palquick" data-k="scene">🎨 Picture the scene</button><button class="chip" data-act="palpicopen">🖼 Picture with my prompt</button>' : ''}${S.settings.net?.on !== false ? '<button class="chip" data-act="pallookup">🔎 Look something up</button>' : ''}<button class="chip" data-act="palwear">👗 Outfit</button><button class="chip" data-act="palplace">📍 Location</button><button class="chip" data-act="palquick" data-k="cont">↪ Keep going</button></div>
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
  if (S.palBusy && S.palBusy.chat === ch.id && !msgs.some(m => m.streaming)) html += `<div class="pmsg txt them"><div class="brow"><div class="bub typing">${S.palBusy.looking ? `<span class="hint" style="margin:0">🔎 Looking up ${esc(S.palBusy.looking === '…' ? 'something' : S.palBusy.looking)}…</span>` : '<i></i><i></i><i></i>'}</div></div></div>`;
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
  const minors = ps.filter(palMinor); const adultAll = ps.every(p => p.adult && !AGE.isProtected(p));
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
  /* the model gets its own last lines spelled out, so it cannot claim it forgot them and deliver the same thing again */
  const said = arr(ch.messages).filter(m => m.role === 'pal' && String(m.text || '').trim() && !m.streaming).slice(-3).map(m => String(m.text).replace(/\s+/g, ' ').trim().slice(0, 160));
  const sys = [
    `You are ${group ? 'playing several characters in a group conversation' : `${ps[0].name}`} in a private roleplay and companion app, talking with ${you}${sexWord(me) ? ` (${sexWord(me)})` : ''}.${me?.about ? ` About ${you}: ${me.about}` : ''}${me?.look ? ` ${you} looks like this: ${me.look}` : ''}`,
    `Stay fully in character as a real person with your own life, moods, opinions and memory. Never mention being an AI, a model or a story. Be warm and engaging, follow ${you}'s lead, and also bring your own ideas, questions, feelings and plans so the conversation goes somewhere. React to what ${you} actually said. Don't repeat yourself: never reuse a sentence, phrase, joke, greeting or question you have already used, never open two replies the same way, and never say the same thing twice in one reply.`,
    `Never write ${you}'s words, actions, thoughts or feelings. Only your own.`,
    `If ${you} writes something in ((double brackets)), it is a direction from the player about the story or your behaviour: follow it without commenting on it. In ${you}'s messages, *text in asterisks* is something ${you} does and "text in quotes" is something ${you} says out loud.`,
    minors.length ? `Keep everything wholesome and age-appropriate: ${minors.map(p => p.name).join(', ')} ${minors.length > 1 ? 'are minors' : 'is a minor'}. No romance, flirting or sexual content of any kind.` : contentRules(adultAll ? 'M' : 'PG-13', { character: ps[0], party: ps }),
    '', ...ps.map(desc), '',
    shared.length ? `WHAT EVERYONE IN THIS GROUP KNOWS:\n${shared.map(m => '- ' + m.t).join('\n')}` : '',
    late.length ? late.map(p => `${p.name} joined this chat later and knows nothing that was said here before she joined.`).join(' ') : '',
    palWorldBlock(ps),
    ch.scene ? `CURRENT SETTING: ${ch.scene}` : '',
    ch.summary ? `${group ? 'THIS GROUP\'S' : 'YOUR'} HISTORY TOGETHER SO FAR: ${ch.summary}` : '',
    said.length ? `YOU HAVE ALREADY SAID THIS (your own most recent messages, newest last). Do not repeat these lines or their point, and do not ask a question you already asked; every reply must add something new:\n${said.map(l => '  > ' + l).join('\n')}` : '',
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
/* ---------- looking things up, the way the GM can in a campaign ---------- */
const palLore = ch => (ch.lore = ch.lore && typeof ch.lore === 'object' ? ch.lore : {});
function palLoreNote(ch) {
  /* one fact per lookup that actually found something; identical text from two questions is listed once */
  const seen = new Set();
  const facts = Object.values(palLore(ch)).filter(x => x && x.text).filter(x => {
    const k = String(x.text).toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(k)) return false; seen.add(k); return true;
  }).slice(-4);
  if (!facts.length) return '';
  return '((FACTS THE APP LOOKED UP ONLINE (accurate; use what fits, in your own words, without mentioning searching): ' + facts.map(x => `${x.name}: ${x.text}`).join(' | ') + '))';
}
async function palLookup(ch, q, signal) {
  q = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!q || S.settings.net?.on === false || !textReady()) return null;
  const L = palLore(ch); const k = q.toLowerCase();
  if (L[k]?.text) return L[k];
  const { sources } = await gatherSources(q, { pages: 2, perPage: 3500 });
  if (!sources.length) return null;
  const raw = stripThink(await chat([
    { role:'system', content:`Using ONLY the SOURCES, write 2-4 short sentences of facts about "${q}" that would matter in a conversation: who or what it is, key details, why people mention it. Plain sentences, no lists. If the sources don't clearly describe this exact thing, reply exactly NONE.` },
    { role:'user', content: sourcesText(sources) }
  ], { stream:false, maxTokens:260, temperature:0.2, helper:true, signal })).trim();
  if (!raw || /^NONE\b/i.test(raw)) return null;
  const entry = { name: q, text: raw.slice(0, 700), url: sources[0].url, src: sources[0].title, t: Date.now() };
  L[k] = entry; palTouch(ch); savePals();
  return entry;
}
/* ask a cheap helper whether the player's message needs the internet before the companion answers */
async function palScout(ch, text, signal) {
  const known = Object.values(palLore(ch)).map(x => x.name).slice(-30);
  const ps = palsOf(ch);
  const recent = ch.messages.filter(m => m.role !== 'sys' && String(m.text || '').trim()).slice(-8).map(m => `${m.role === 'user' ? meName(ch) : palWho(ch, m)?.name || ''}: ${m.text}`).join('\n');
  const raw = await chat([
    { role:'system', content:`You decide whether a companion in a private chat needs to look something up on the internet before answering well. Its own memory of real-world facts is unreliable.\nSEARCH when the message mentions or asks about something REAL or ESTABLISHED that needs accurate facts: a real place, city or building; a real person or historical figure; an event or period; real science, history, laws, sports, music, films, books, games, products or news; or a character, place or thing from an existing book, show, film or game.\nDON'T SEARCH for ordinary chat, feelings, plans, made-up names, or anything already known.\nAlready looked up: ${known.join(', ') || 'nothing yet'}.\nReply with JSON only:\n{"search":null}\nor {"search":"short search phrase, 2-6 words, the specific thing"}` },
    { role:'user', content:`CHAT WITH: ${ps.map(p => p.name).join(', ')}${ch.scene ? `\nWHERE: ${ch.scene}` : ''}\n\nRECENT:\n${recent || '(just starting)'}\n\nTHE PLAYER'S MESSAGE NOW: ${text}` }
  ], { stream:false, signal, maxTokens:60, temperature:0.1, helper:true, json:true });
  const j = tryJSON(stripThink(raw));
  const q = j && typeof j.search === 'string' ? j.search.trim().replace(/^["']|["']$/g, '').slice(0, 80) : '';
  if (!q || q.length < 3 || /^(null|none)$/i.test(q)) return null;
  return known.some(n => n.toLowerCase() === q.toLowerCase()) ? null : q;
}
/* ---------- living memory: read the whole chat back before answering ---------- */
/* Two layers. Ch.recal is what is happening right now, rebuilt from the actual messages so a long chat
   can never drift out of view; the lasting facts it finds are folded into what she remembers for good. */
async function palRecall(ch, signal) {
  const msgs = arr(ch.messages).filter(m => m.role !== 'sys' && String(m.text || '').trim());
  const cached = ch.recall && ch.recall.text ? ch.recall : null;
  if (msgs.length < 6 || !textReady() || signal?.aborted) return cached?.text || '';
  /* fresh enough: rebuilt every couple of messages, so chatting stays quick */
  if (cached && msgs.length - num(cached.n) < 2 && Date.now() - num(cached.at) < 10 * 60e3) return cached.text;
  const ps = palsOf(ch); const group = ps.length > 1; const you = meName(ch);
  const recent = msgs.slice(-40).map(m => `${m.role === 'user' ? you : palWho(ch, m)?.name || 'them'}: ${String(m.text).replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');
  const mem = palMemPick(ps.flatMap(p => arr(p.memory).filter(m => m.src !== 'group:' + ch.id)), 20).map(m => '- ' + m.t).join('\n');
  const ask = () => chat([
    { role: 'system', content: `You keep the memory of one long private conversation, the way a person remembers it before answering. Read the chat and write down what the companion must have in mind to reply well.\nBe exact and specific: use the real names, places, numbers, plans and promises from the chat. Never invent anything.\nReply with JSON only:\n{"scene":"1-2 sentences: exactly where things stand between them right now","open":["a plan, promise, question or problem still hanging in the air, if any"],"facts":["a specific thing ${you} said about themselves, or something that happened between them, that must not be forgotten"],"mood":"a few words on the tone between them right now"}` },
    { role: 'user', content: `WHAT THEY ALREADY REMEMBER LONG-TERM:\n${mem || '(nothing yet)'}\n\nOLDER SUMMARY OF THIS CHAT: ${ch.summary || '(none yet)'}\n\nTHE CHAT SO FAR (oldest first):\n${recent}` }
  ], { stream: false, maxTokens: 320, temperature: 0.2, helper: true, json: true, signal }).catch(e => { if (e.name !== 'AbortError') console.warn('Recall failed', e); return ''; });
  let raw = '';
  try { raw = await withTimeout(ask(), 9000); } catch (e) { if (e.name !== 'AbortError') console.warn('Recall failed', e); }
  const j = tryJSON(stripThink(raw || ''));
  if (!j) return cached?.text || '';
  const list = k => arr(j[k]).map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6);
  const text = [
    String(j.scene || '').replace(/\s+/g, ' ').trim(),
    list('open').length ? 'Still open: ' + list('open').join('; ') : '',
    list('facts').length ? 'Must not be forgotten: ' + list('facts').join('; ') : '',
    String(j.mood || '').replace(/\s+/g, ' ').trim() ? 'Tone right now: ' + String(j.mood).replace(/\s+/g, ' ').trim() : ''
  ].filter(Boolean).join('\n').trim();
  if (!text) return cached?.text || '';
  /* the lasting facts join her long-term memory, so they survive long after these messages scroll away */
  for (const f of list('facts')) for (const p of ps) palRemember(p, f, group ? 'group:' + ch.id : 'private');
  ch.recall = { text: text.slice(0, 900), n: msgs.length, at: Date.now() };
  palTouch(ch); savePals(false);
  return ch.recall.text;
}
/* small or tired models drift into saying the same thing again; these keep a reply from looping on itself */
const palLoopNorm = t => String(t || '').toLowerCase().replace(/\{[^{}]*\}/g, ' ').replace(/\*+/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const palLoopWords = t => new Set(palLoopNorm(t).split(' ').filter(w => w.length > 2));
/* how much of two lines is the same thing, 0…1 */
function palLoopSame(a, b) {
  const A = palLoopWords(a), B = palLoopWords(b);
  if (A.size < 4 || B.size < 4) return 0;
  let hit = 0; for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
}
/* drop a paragraph or a sentence the model wrote over and over in the same reply */
function palDedupeText(text) {
  const seen = new Set(); const out = []; let last = '';
  for (const p of String(text || '').split(/\n{2,}/)) {
    const k = palLoopNorm(p);
    if (k) { if (seen.has(k)) continue; seen.add(k); }
    const re = /([^.!?\n]+[.!?…]*|[^.!?\n]+$)([ \t]*)/g;
    let s = '', m;
    while ((m = re.exec(p))) {   /* the last kept sentence carries over from the paragraph before */
      const n = palLoopNorm(m[1]);
      if (n) { if (n === last) continue; last = n; }
      s += m[1] + m[2];
      if (!m[0]) re.lastIndex++;   /* never spin on an empty match */
    }
    if (s.trim()) out.push(s.trimEnd());
  }
  return out.join('\n\n');
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
  for (const m of ch.messages.filter(m => m !== msg && (m.role !== 'sys' || m.note)).slice(-40)) {
    if (m.role === 'sys') add('user', `((${m.text}))`);
    else if (m.role === 'user') add('user', (group && m.to && m.to !== 'all' && PALS.pals[m.to] ? `(to ${PALS.pals[m.to].name}) ` : '') + m.text + (m.image ? ' ((sent a picture))' : ''));
    else add('assistant', (group ? `{${palWho(ch, m)?.name || ''}} ` : '') + m.text + (m.image ? ` *sends a photo*` : ''));
  }
  if (opts.opener && !hist.length) add('user', `((Start the conversation naturally based on your scenario: ${lead.scenario || 'saying hello for the first time'}.))`);
  else if (opts.prompt) add('user', opts.prompt);
  else if (!hist.length || hist[hist.length - 1].role !== 'user') add('user', '((Continue.))');

  /* living memory: read the chat back while any lookup runs, so the reply starts with both */
  const recallP = palRecall(ch, signal);
  /* like the GM: if the player's message names something real, look it up before answering */
  const asked = [...ch.messages].reverse().find(m => m.role === 'user' && m.text && m !== msg);
  if (asked && scoutOn() && scoutWorth(palCtx(lead, ch), asked.text)) {
    S.palBusy = { ...(S.palBusy || {}), chat: ch.id, msg: msg.id, looking: '…' }; palRedraw();
    /* the whole lookup has the same 25-second budget as a campaign lookup: a slow source stack must not stall the reply */
    const lookDeadline = Date.now() + 25000;
    try {
      const want = await withTimeout(palScout(ch, asked.text, signal), 25000);
      if (want) {
        S.palBusy = { ...(S.palBusy || {}), looking: want }; palRedraw();
        const left = Math.max(1500, lookDeadline - Date.now());
        const r = await withTimeout(palLookup(ch, want, signal), left);
        if (r) { msg.looked = { name: r.name, url: r.url, src: r.src }; ch.messages.push({ id: uid(), role: 'sys', note: true, text: `🔎 Looked up ${r.name}`, t: Date.now() }); }
      }
    } catch (e) { if (e.name === 'AbortError') throw e; console.warn('Companion lookup failed', e); }
    finally { if (S.palBusy) delete S.palBusy.looking; palRedraw(); }
  }

  const loreNote = palLoreNote(ch);
  let recall = '';
  try { recall = (await recallP) || ''; } catch (e) { if (e.name !== 'AbortError') console.warn('Recall failed', e); }
  const sysMsg = { role: 'system', content: palSystem(ch, to) + (recall ? `\n\nMEMORY OF THIS CONVERSATION (your own recollection, read back from the messages: treat it as true, pick up what is still open, and never mention that it was written down):\n${recall}` : '') + (loreNote ? '\n\n' + loreNote : '') };
  const ask = (stream, extra) => chat([sysMsg, ...hist, ...(extra || [])],
    { maxTokens: Math.round(PAL_LENGTHS[ch.length || 'normal'].tok * (group && to === 'all' ? 1.7 : 1)), temperature: 0.85, stream, signal, onToken: full => { msg.text = palDedupeText(stripThink(full)); paintPalLog(); } });
  try {
    let out = palDedupeText(stripThink(await ask(true)).trim());
    if (!out) out = palDedupeText(stripThink(await ask(false)).trim());   /* some models send an empty first try */
    /* it just said this: one more try, asked plainly, instead of showing the same reply again */
    const prevPal = [...ch.messages].reverse().find(m => m.role === 'pal' && String(m.text || '').trim() && m !== msg);
    if (out && prevPal && !signal.aborted && palLoopSame(out, prevPal.text) >= 0.8) {
      const again = palDedupeText(stripThink(await ask(false, [{ role: 'user', content: '((That is almost exactly what you said last time. Say something genuinely different now: react to my last message, and add a new detail, question or plan in new words.))' }])).trim());
      if (again && palLoopSame(again, prevPal.text) < palLoopSame(out, prevPal.text)) out = again;
    }
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
      { role: 'user', content: `PREVIOUS SUMMARY: ${ch.summary || '(none)'}${ch.recall?.text ? `\n\nWHAT IS HAPPENING IN THE CHAT (read back just now):\n${ch.recall.text}` : ''}\n\nCHAT:\n${recent}` }
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
    case 'palchanset': {
      const id = S.palSetupChat || S.palChat; const c0 = PALS.chats[id]; if (!c0) return true;
      c0.channel = el.dataset.k === 'person' ? 'person' : 'text';
      S.palSetupChat = null; S.modal = null; $('#modalRoot').innerHTML = '';
      palTouch(c0); savePals(); palOpenChat(c0.id);
      if (!c0.messages.length) palReply(c0, { opener: true });
      return true;
    }
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
    /* web lookup, kept in this chat */
    case 'pallookup': if (!ch) return true; S.palLookQ = ''; S.palLookMsg = ''; S.palLookBusy = false; openModal('pallookup'); setTimeout(() => $('#palLookQ')?.focus(), 40); return true;
    case 'pallookgo': {
      const q = ($('#palLookQ')?.value || '').trim(); if (!q) { toast('Type what to look up.'); return true; }
      if (!ch) return true;
      S.palLookQ = q; S.palLookBusy = true; S.palLookMsg = 'Searching and reading sources…'; renderModal();
      palLookup(ch, q).then(r => {
        S.palLookMsg = r ? `✓ Looked up ${r.name}${r.src ? ' (' + r.src + ')' : ''}. The facts are saved for this chat.` : `The sources didn't clearly cover "${q}". Try other words.`;
        if (r) { ch.messages.push({ id: uid(), role: 'sys', note: true, text: `🔎 Looked up ${r.name}`, t: Date.now() }); palTouch(ch); savePals(); }
      }).catch(e => { S.palLookMsg = '✗ ' + (e.message || e); }).finally(() => { S.palLookBusy = false; renderModal(); palRedraw(); });
      return true;
    }
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
  if (kind === 'palchan') {
    const ch = PALS.chats[S.palSetupChat] || null; const names = ch ? palsOf(ch).map(p => p.name).join(', ') : 'your companion';
    return ['How does this start?', `<p class="hint" style="color:var(--ink)">Choose how you meet ${esc(names)}. You can switch any time in the chat with the Texting / In person buttons.</p>
      <div class="gseg" style="margin-top:10px"><button class="segbtn" data-act="palchanset" data-k="text"><b>📱 Texting</b><small>You message each other and they reply on their phone</small></button><button class="segbtn" data-act="palchanset" data-k="person"><b>🧍 In person</b><small>You are together: what you say and do happens face to face</small></button></div>`];
  }
  if (kind === 'pallookup') {
    const ch = curChat(); const names = ch ? palsOf(ch).map(p => p.name).join(', ') : '';
    return ['Look something up', `<p class="hint">Search the web and keep the facts in this chat: ${esc(names)} will know them from then on.</p>
      <label class="f"><span>What should I look up?</span><input id="palLookQ" placeholder="e.g. the 1987 Hamburg concert, or the Battle of Hastings" value="${esc(S.palLookQ || '')}"></label>
      <div class="row" style="margin-top:10px"><button class="btn gold" data-act="pallookgo" ${S.palLookBusy ? 'disabled' : ''}>${S.palLookBusy ? '<span class="spin sm"></span> Searching…' : icon('search') + ' Search'}</button><button class="btn ghost" data-act="close">Cancel</button></div>
      ${S.palLookMsg ? `<p class="hint" style="color:var(--ink)">${esc(S.palLookMsg)}</p>` : ''}`];
  }
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
