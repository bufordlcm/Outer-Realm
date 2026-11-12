'use strict';
/* =========================================================================
   COMPANIONS: AI characters you talk to, separate from the RPG.
   - Your own characters only, saved on this device and in Google Drive (Companions/companions.json)
   - Each chat is either TEXTING (phone, online, email: message bubbles)
     or IN PERSON (together: a narrated scene with *actions* and dialogue)
   - Relationships grow (stranger → friend → more), long-term memory of you and your history
   - Voice messages, selfies and scene pictures, edit / reroll / continue every reply, group chats
   ========================================================================= */
Object.assign(ICON, {
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  check: '<path d="M5 12l5 5L20 7"/>'
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
const PALS = LS.get(PALS_KEY, null) || { me: { name: '', pronouns: '', about: '', updatedAt: 0 }, pals: {}, chats: {}, deleted: {} };
for (const k of ['pals','chats','deleted']) PALS[k] = PALS[k] || {};
PALS.me = PALS.me || { name: '', pronouns: '', about: '' };
function savePals(sync = true) {
  try { LS.set(PALS_KEY, PALS); } catch (e) { toast('This device is out of space for companion chats: ' + e.message, 6000); }
  if (sync) scheduleSync();
}
const palTouch = x => { x.updatedAt = Date.now(); };
const allPals = () => Object.values(PALS.pals).sort((a, b) => (b.lastChat || b.updatedAt || 0) - (a.lastChat || a.updatedAt || 0));
const palChats = () => Object.values(PALS.chats).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
const meName = () => (PALS.me.name || '').trim() || 'you';

/* a companion under 18 (by age or by how they're described) is always platonic: no romance, no 18+, safe pictures */
const palMinor = p => !!p && (
  (p.age != null && String(p.age).trim() !== '' && Number(p.age) < 18) ||
  CHAR_MINOR.test([p.name, p.look, p.backstory, p.personality, p.tagline, p.scenario, p.userRole, p.greeting].join(' '))
);

const palStage = p => PAL_STAGES.find(s => s.k === p.stage) || PAL_STAGES[0];
const palsOf = chat => arr(chat?.palIds).map(id => PALS.pals[id]).filter(Boolean);
const curChat = () => PALS.chats[S.palChat];

/* the picture engine and voice engine expect a game; this is the companion's stand-in */
function palCtx(p, chat) {
  const adultOK = !!p.adult && !palMinor(p);
  const ctx = p._ctx || (Object.defineProperty(p, '_ctx', { value: {}, enumerable: false, writable: true }), p._ctx);
  Object.assign(ctx, {
    id: 'pal_' + p.id, title: p.name, genre: '', premise: '', location: chat?.scene || '', artStyle: p.art || 'photorealistic, natural light, detailed',
    rating: adultOK ? 'Adult (18+)' : 'PG-13', character: { name: meName(), appearance: p.look, backstory: p.backstory, storyRole: '' },
    party: chat ? palsOf(chat) : [p], codex: [], voiceMap: chat ? (chat.voiceMap = chat.voiceMap || {}) : {}
  });
  return ctx;
}
const palImg = (img, p, chat) => img && S.settings.image.mode !== 'off' ? imageUrl(img, palCtx(p, chat)) : '';
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
    for (const k of ['pals','chats']) {
      for (const [id, r] of Object.entries(remote[k] || {})) {
        if (PALS.deleted[id] && PALS.deleted[id] >= (r.updatedAt || 0)) { push = true; continue; }   /* deleted here: tell Drive */
        const l = PALS[k][id];
        if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) { PALS[k][id] = r; changed++; }
        else if ((l.updatedAt || 0) > (r.updatedAt || 0)) push = true;
      }
      for (const [id, l] of Object.entries(PALS[k])) { if (PALS.deleted[id] && PALS.deleted[id] >= (l.updatedAt || 0)) { delete PALS[k][id]; changed++; } else if (!remote[k]?.[id]) push = true; }
    }
    if ((remote.me?.updatedAt || 0) > (PALS.me.updatedAt || 0)) { PALS.me = remote.me; changed++; } else if ((PALS.me.updatedAt || 0) > (remote.me?.updatedAt || 0)) push = true;
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
      <div class="row wrap"><button class="btn gold" data-act="palnew">${icon('plus')} Create your first companion</button></div></div></section>`;
  return `<section class="hsec">
    <div class="hsechd"><h2>Companions</h2><div class="row"><button class="btn sm" data-act="palgroup" ${pals.length < 2 ? 'disabled title="Make at least two companions first"' : ''}>${icon('users')} Group chat</button><button class="btn sm" data-act="palme">${icon('person')} About you</button><button class="btn gold sm" data-act="palnew">${icon('plus')} New companion</button></div></div>
    ${chats.length ? `<div class="lbl">Recent chats</div><div class="palchats">${chats.slice(0, 8).map(ch => { const ps = palsOf(ch); const last = [...arr(ch.messages)].reverse().find(m => m.role !== 'sys');
      return `<button class="palchatrow" data-act="palopen" data-id="${ch.id}"><span class="pavs">${ps.slice(0, 3).map(p => palAvatar(p)).join('')}</span><span class="pcr"><b>${esc(ch.title || ps.map(p => p.name).join(', '))}</b><small>${ch.channel === 'person' ? '🧍 ' : '📱 '}${esc(String(last?.text || 'New chat').replace(/\[[^\]]*\]|[*{}]/g, '').slice(0, 90))}</small></span><span class="pct">${ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString([], { month:'short', day:'numeric' }) : ''}</span></button>`; }).join('')}</div>` : ''}
    <div class="lbl">Your companions</div>
    <div class="palgrid">${pals.map(p => `<div class="palcard">
        <button class="palpic" data-act="palchat" data-id="${p.id}">${p.portrait ? palAvatar(p, 'palbig') : `<span class="palbig pavi" style="background:${palColor(p)}">${initial(p.name)}</span>`}</button>
        <div class="palinfo"><b>${esc(p.name)}</b><small>${esc(p.tagline || arr(p.vibes).join(' · '))}</small>
        <div class="palrel">${heartMeter(p)} ${esc(palStage(p).l)}</div></div>
        <div class="row"><button class="btn sm gold grow" data-act="palchat" data-id="${p.id}">${icon('chat')} Chat</button><button class="btn sm ghost" data-act="paledit" data-id="${p.id}">Edit</button></div></div>`).join('')}
      <button class="palcard palnew" data-act="palnew"><span>${icon('plus')}</span>New companion</button></div>
  </section>`;
}
const heartMeter = p => `<span class="hearts" title="Affection ${Math.round(num(p.affection))}/100"><span style="width:${clamp(num(p.affection), 0, 100)}%"></span></span>`;

/* ---------- creator / editor ---------- */
function palBlank() {
  return { id: uid(), name: '', age: 25, sex: '', pronouns: '', tagline: '', look: '', personality: '', vibes: [], backstory: '', speech: '', likes: '', userRole: '', scenario: '', greeting: '',
    goal: 'romance', stage: 'stranger', affection: 5, adult: false, intensity: 'balanced', limits: '', art: 'photorealistic, natural light, detailed', memory: [], jokes: [], createdAt: Date.now(), updatedAt: Date.now() };
}
function openPalEditor(id) {
  S.palDraft = id && PALS.pals[id] ? deep(PALS.pals[id]) : palBlank(); S.palDraftNew = !(id && PALS.pals[id]);
  S.view = 'paledit'; renderPalEditor();
}
function renderPalEditor() {
  const D = S.palDraft; if (!D) return renderLibrary();
  const f = (k, label, ph = '', type = 'text') => `<label class="f"><span>${label}</span><input type="${type}" data-pd="${k}" value="${esc(D[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
  const t = (k, label, ph = '', rows = 3) => `<label class="f"><span>${label}</span><textarea rows="${rows}" data-pd="${k}" placeholder="${esc(ph)}">${esc(D[k] || '')}</textarea></label>`;
  app().innerHTML = `<div class="home">${topNavHTML('pals')}<main class="hmain palform">
    <div class="row"><button class="btn sm ghost" data-act="palback">${icon('back')} Back</button><h2 style="margin:0 0 0 6px">${S.palDraftNew ? 'New companion' : 'Edit ' + esc(D.name)}</h2></div>
    <div class="card">
      <div class="sect" style="margin-top:0">Quick start</div>
      <p class="hint">Describe who you want in a sentence or two, or paste a finished character from ChatGPT, Claude or anywhere (any format). The AI fills in everything below; change whatever you like.</p>
      <textarea id="palIdea" rows="4" placeholder="e.g. Mara, 27, a sarcastic tattoo artist with a soft heart who pretends she doesn't care, lives above her shop in the city…">${esc(S.palIdea || '')}</textarea>
      <div class="row wrap" style="margin-top:8px"><button class="btn gold" data-act="palai" ${S.palBuilding ? 'disabled' : ''}>${S.palBuilding ? `<span class="spin sm"></span> Building… <span class="buildsecs"></span>` : icon('spark') + ' Build with AI'}</button></div>
    </div>
    <div class="card palcols">
      <div class="palportrait">${D.portrait ? palAvatar(D, 'palhuge') : `<span class="palhuge pavi" style="background:${palColor(D)}">${initial(D.name)}</span>`}
        <button class="btn sm" data-act="palportrait" ${S.settings.image.mode === 'off' || !D.look ? 'disabled' : ''}>${icon('image')} ${D.portrait ? 'New picture' : 'Make their picture'}</button>
        ${S.settings.image.mode === 'off' ? '<p class="hint">Turn on pictures in Settings → Images.</p>' : !D.look ? '<p class="hint">Describe their look first.</p>' : ''}</div>
      <div class="grow">
        <div class="kv">${f('name', 'Name', 'Mara')}${f('age', 'Age', '25', 'number')}</div>
        <div class="kv"><label class="f"><span>Gender (for their voice)</span><select data-pd="sex"><option value="">Choose…</option><option value="female" ${D.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${D.sex === 'male' ? 'selected' : ''}>Male</option><option value="other" ${D.sex === 'other' ? 'selected' : ''}>Other / nonbinary</option></select></label>${f('pronouns', 'Pronouns', 'she/her')}</div>
        ${f('tagline', 'One-line tagline', 'Sarcastic tattoo artist with a soft heart')}
        <div class="lbl">Personality vibe</div><div class="chips">${PAL_VIBES.map(v => `<button class="chip ${arr(D.vibes).includes(v) ? 'on' : ''}" data-act="palvibe" data-v="${v}">${v}</button>`).join('')}</div>
      </div>
    </div>
    <div class="card">
      ${t('look', 'Look', 'Hair, eyes, build, style of clothes, tattoos, how they carry themselves', 3)}
      ${t('personality', 'Personality', 'What they are like, what makes them laugh, what annoys them, their flaws', 3)}
      ${t('speech', 'How they talk', 'Slang, emojis or none, pet names, short or long messages, accent, catchphrases', 2)}
      ${t('backstory', 'Backstory', 'Where they come from, their life now, job, family, secrets', 4)}
      ${t('likes', 'Likes, dislikes and interests', '', 2)}
      ${t('userRole', `Who you are to them`, 'e.g. my neighbor I keep running into; my best friend since college; a stranger who matched with me', 2)}
      ${t('scenario', 'How it starts (optional)', 'e.g. We matched on a dating app last night', 2)}
      ${t('greeting', 'Their first message (optional)', 'The AI writes one if you leave it empty', 2)}
    </div>
    <div class="card">
      <div class="sect" style="margin-top:0">Relationship</div>
      ${palMinor(D) ? `<p class="hint" style="color:var(--gold2)">${esc(D.name || 'They')} ${num(D.age) && num(D.age) < 18 ? `is ${num(D.age)}` : 'is described as under 18'}, so this is a platonic relationship: friends, family, teammates or mentoring. Romance and 18+ are off.</p>` : ''}
      <label class="f"><span>Where it can go</span><select data-pd="goal" ${palMinor(D) ? 'disabled' : ''}>${Object.entries(PAL_GOALS).filter(([k]) => !palMinor(D) || k === 'friends').map(([k, l]) => `<option value="${k}" ${D.goal === k || palMinor(D) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f"><span>Where you start</span><select data-pd="stage">${PAL_STAGES.filter(s => (D.goal !== 'friends' && !palMinor(D)) || !s.romance).map(s => `<option value="${s.k}" ${D.stage === s.k ? 'selected' : ''}>${s.l}</option>`).join('')}</select></label>
      <p class="hint">${esc(palStage(D).d)} The relationship moves on its own as you talk.</p>
      <div class="sect">Your rules</div>
      <label class="f"><span>Intensity</span><select data-pd="intensity"><option value="gentle" ${D.intensity === 'gentle' ? 'selected' : ''}>Gentle: soft and slow</option><option value="balanced" ${D.intensity !== 'gentle' && D.intensity !== 'bold' ? 'selected' : ''}>Balanced</option><option value="bold" ${D.intensity === 'bold' ? 'selected' : ''}>Bold: intense, takes initiative</option></select></label>
      ${t('limits', 'Hard limits (they will never go here)', 'Anything you never want in your chats, one per line', 2)}
      ${palMinor(D) ? '' : `<label class="chk"><input type="checkbox" data-pd="adult" ${D.adult ? 'checked' : ''}> <span>Allow 18+ content with this companion</span></label>`}
      ${f('art', 'Picture style', 'photorealistic, natural light, detailed')}
    </div>
    <div class="row wrap" style="margin-bottom:30px"><button class="btn gold" data-act="palsave">${icon('check')} Save${S.palDraftNew ? ' and start chatting' : ''}</button>${!S.palDraftNew ? `<button class="btn ghost" data-act="paldelete" data-id="${D.id}">${icon('trash')} Delete companion</button>` : ''}</div>
  </main></div>`;
  buildTimer();
}
function palValidate(D) {
  if (!String(D.name || '').trim()) return 'Give them a name.';
  if (!num(D.age)) return 'Fill in their age (the Age box near the top).';
  return '';
}
const PAL_SPEC = `{"name":"","age":25,"sex":"female|male|other","pronouns":"","tagline":"one line","look":"2-3 sentences: face, hair, eyes, build, clothes, distinctive details (for pictures too)","personality":"3-4 sentences","vibes":["2-4 of: ${PAL_VIBES.join(', ')}"],"speech":"how they talk and text: slang, emojis, pet names, message length","backstory":"4-6 sentences","likes":"likes, dislikes, interests","userRole":"who the player is to them","scenario":"how the first conversation starts","greeting":"their first message to the player, in character"}`;
async function palAIBuild() {
  const D = S.palDraft; const idea = ($('#palIdea')?.value || S.palIdea || '').trim(); if (!idea) return toast('Describe your companion or paste one first.');
  if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  S.palIdea = idea; S.palBuilding = Date.now(); renderPalEditor();
  try {
    const raw = await chat([
      { role:'system', content:`You create characters for an AI companion and roleplay app. From the player's idea, or from a finished character they pasted (keep every detail it gives), write a vivid, specific, believable character who feels like a real person with their own life, opinions and voice. The character is an adult (18+). Reply with ONLY this JSON:\n${PAL_SPEC}` },
      { role:'user', content: idea + (PALS.me.name ? `\n\n(The player's name is ${PALS.me.name}.)` : '') }
    ], { build:true, stream:false, maxTokens:2200, temperature:0.85, json:true });
    const j = tryJSON(stripThink(raw)); if (!j) throw new Error('the AI reply wasn\'t usable, try again');
    for (const k of ['name','sex','pronouns','tagline','look','personality','speech','backstory','likes','userRole','scenario','greeting']) if (j[k]) D[k] = String(j[k]).slice(0, 1500);
    D.age = num(j.age) || num(D.age) || 25;   /* keep the real age: a character under 18 must stay under 18 so the safeguards apply */
    if (arr(j.vibes).length) D.vibes = arr(j.vibes).map(v => String(v).toLowerCase()).filter(v => PAL_VIBES.includes(v)).slice(0, 4);
    toast('Companion drafted. Read it over and save.');
  } catch (e) { toast('Build failed: ' + e.message, 6000); }
  S.palBuilding = 0; renderPalEditor();
}
function palSave() {
  const D = S.palDraft; const err = palValidate(D); if (err) return toast(err, 5000);
  D.age = Math.max(1, Math.round(num(D.age)));
  if (palMinor(D)) { D.adult = false; D.goal = 'friends'; if (palStage(D).romance) D.stage = 'friend'; }
  if (D.goal === 'friends' && palStage(D).romance) D.stage = 'close';
  if (D.goal === 'open') { D.stage = 'partner'; D.affection = Math.max(num(D.affection), 93); }
  else D.affection = Math.max(num(D.affection), palStage(D).at);
  palTouch(D); const isNew = S.palDraftNew; PALS.pals[D.id] = D; savePals();
  S.palDraft = null; S.palIdea = '';
  if (isNew) palStartChat([D.id]); else { S.homeTab = 'pals'; renderLibrary(); }
}

/* ---------- chats ---------- */
function palStartChat(ids) {
  const ex = palChats().find(ch => ch.palIds.length === ids.length && ids.every(id => ch.palIds.includes(id)));
  if (ex) return palOpenChat(ex.id);
  const ps = ids.map(id => PALS.pals[id]).filter(Boolean); if (!ps.length) return;
  const ch = { id: uid(), palIds: ids, title: ps.length > 1 ? ps.map(p => p.name).join(', ') : '', channel: 'text', scene: '', length: 'normal', messages: [], memTurns: 0, createdAt: Date.now(), updatedAt: Date.now() };
  PALS.chats[ch.id] = ch;
  for (const p of ps) if (p.greeting && ps.length === 1) ch.messages.push({ id: uid(), role: 'pal', who: p.id, text: p.greeting, mode: 'text', t: Date.now() });
  palTouch(ch); savePals(); palOpenChat(ch.id);
  if (!ch.messages.length) palReply(ch, { opener: true });
}
function palOpenChat(id) { S.palChat = id; S.view = 'palchat'; S.palEdit = null; renderPalChat(); }
function renderPalChat() {
  const ch = curChat(); if (!ch) { S.homeTab = 'pals'; return renderLibrary(); }
  const ps = palsOf(ch); const one = ps.length === 1 ? ps[0] : null;
  app().innerHTML = `<div class="palview ${ch.channel === 'person' ? 'inperson' : 'texting'}">
    <header class="palbar">
      <button class="hbtn exitbtn" data-act="palexit">${icon('back')}</button>
      <span class="pavs">${ps.slice(0, 3).map(p => palAvatar(p)).join('')}</span>
      <div class="palttl"><b>${esc(ch.title || ps.map(p => p.name).join(', '))}</b><small>${one ? `${heartMeter(one)} ${esc(palStage(one).l)}` : `${ps.length} companions`}${ch.scene ? ` · ${esc(ch.scene.slice(0, 40))}` : ''}</small></div>
      <div class="chanseg"><button class="${ch.channel !== 'person' ? 'on' : ''}" data-act="palchan" data-k="text">📱<span> Texting</span></button><button class="${ch.channel === 'person' ? 'on' : ''}" data-act="palchan" data-k="person">🧍<span> In person</span></button></div>
      <button class="hbtn" data-act="palmenu">${icon('more')}</button>
    </header>
    ${S.palMenu ? palMenuHTML(ch) : ''}
    <div class="pallog" id="pallog">${palLogHTML(ch)}</div>
    <div class="palcomp">
      <div class="palquick">${one ? `<button class="chip" data-act="palquick" data-k="selfie">📷 Ask for a selfie</button>` : ''}${ch.channel === 'person' && S.settings.image.mode !== 'off' ? '<button class="chip" data-act="palquick" data-k="scene">🎨 Picture this moment</button>' : ''}<button class="chip" data-act="palquick" data-k="cont">↪ Keep going</button><button class="chip" data-act="palquick" data-k="ooc">(( )) Direct the story</button></div>
      <div class="palin"><textarea id="palInput" rows="1" placeholder="${ch.channel === 'person' ? '*Smile* and say something, or describe what you do…' : 'Message ' + esc(one ? one.name : 'the group') + '…'}"></textarea>
      ${S.palBusy ? `<button class="btn" data-act="palstop">${icon('stop')}</button>` : `<button class="btn gold" data-act="palsend">${icon('send')}</button>`}</div>
    </div></div>`;
  const log = $('#pallog'); if (log) log.scrollTop = log.scrollHeight;
  const inp = $('#palInput'); if (inp && !isPhone()) inp.focus();
}
function palMenuHTML(ch) {
  const ps = palsOf(ch); const one = ps.length === 1 ? ps[0] : null;
  return `<div class="palmenu card">
    <label class="f"><span>Where are you right now? (sets the scene)</span><input id="palScene" value="${esc(ch.scene || '')}" placeholder="e.g. Her apartment, late at night, rain on the windows"></label>
    <div class="row wrap"><button class="btn sm" data-act="palsceneset">Set scene</button></div>
    <label class="f"><span>Reply length</span><select data-pch="length">${Object.entries(PAL_LENGTHS).map(([k, v]) => `<option value="${k}" ${ch.length === k ? 'selected' : ''}>${v.l}</option>`).join('')}</select></label>
    <label class="chk"><input type="checkbox" data-pch="autovoice" ${ch.autovoice ? 'checked' : ''}> <span>Read every reply aloud</span></label>
    ${one ? `<div class="lbl">What ${esc(one.name)} remembers</div>
      ${arr(one.memory).slice(-12).reverse().map((m, i, a) => `<div class="pline memrow"><span>${esc(m)}</span><button class="link" data-act="palforget" data-id="${one.id}" data-i="${arr(one.memory).length - 1 - i}">✕</button></div>`).join('') || '<p class="hint">Nothing yet. They learn about you as you talk.</p>'}
      ${arr(one.jokes).length ? `<div class="lbl">Inside jokes</div>${one.jokes.slice(-6).map(j => `<div class="pline">😄 ${esc(j)}</div>`).join('')}` : ''}
      <div class="row" style="margin-top:6px"><input id="palMemAdd" placeholder="Tell them something to always remember…" style="flex:1"><button class="btn sm" data-act="palmemadd" data-id="${one.id}">Add</button></div>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm ghost" data-act="paledit" data-id="${one.id}">Edit ${esc(one.name)}</button><button class="btn sm ghost" data-act="palmemnow">Update memory now</button></div>` : ''}
    <div class="row wrap" style="margin-top:10px"><button class="btn sm ghost" data-act="palclear">${icon('trash')} Clear this chat</button><button class="btn sm ghost" data-act="palmenu">Close</button></div>
  </div>`;
}
const palWho = (ch, m) => PALS.pals[m.who] || palsOf(ch)[0];
function palLogHTML(ch) {
  const msgs = arr(ch.messages); const lastPal = [...msgs].reverse().find(m => m.role === 'pal');
  let html = '';
  for (const m of msgs) {
    if (m.role === 'sys') { html += `<div class="palsys">${esc(m.text)}</div>`; continue; }
    const mine = m.role === 'user'; const p = mine ? null : palWho(ch, m);
    const acts = S.palBusy ? '' : `<div class="pacts">${!mine ? `<button data-act="palspeak" data-id="${m.id}" title="Play">🔊</button>` : ''}<button data-act="paleditmsg" data-id="${m.id}" title="Edit">✎</button>${m === lastPal ? `<button data-act="palreroll" data-id="${m.id}" title="New reply">↻</button>` : ''}<button data-act="paldelmsg" data-id="${m.id}" title="Delete">🗑</button>${arr(m.alts).length > 1 ? `<span class="palts"><button data-act="palalt" data-id="${m.id}" data-d="-1">‹</button>${(m.altI ?? m.alts.length - 1) + 1}/${m.alts.length}<button data-act="palalt" data-id="${m.id}" data-d="1">›</button></span>` : ''}</div>`;
    if (S.palEdit === m.id) { html += `<div class="pmsg ${mine ? 'me' : 'them'}"><textarea id="palEditBox" rows="4">${esc(m.text)}</textarea><div class="row"><button class="btn sm gold" data-act="paleditsave" data-id="${m.id}">Save</button><button class="btn sm ghost" data-act="paleditcancel">Cancel</button></div></div>`; continue; }
    const img = m.image ? `<img class="palphoto" src="${esc(palImg(m.image, p || palsOf(ch)[0], ch))}" alt="photo" onerror="this.style.display='none'">` : '';
    if (m.mode === 'person') {
      html += `<div class="pmsg scene ${mine ? 'me' : 'them'}" data-id="${m.id}">${!mine ? `<div class="pwho">${palAvatar(p)}<b>${esc(p?.name || '')}</b></div>` : `<div class="pwho"><b>${esc(PALS.me.name || 'You')}</b></div>`}${img}<div class="ptext">${m.streaming && !m.text ? '<p class="typing"><i></i><i></i><i></i></p>' : md(m.text)}</div>${acts}</div>`;
    } else {
      const bubbles = String(m.text || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
      html += `<div class="pmsg txt ${mine ? 'me' : 'them'}" data-id="${m.id}">${!mine && palsOf(ch).length > 1 ? `<div class="pwho sm">${esc(p?.name || '')}</div>` : ''}<div class="brow">${!mine ? palAvatar(p, 'pav sm') : ''}<div class="bcol">${img}${bubbles.map(b => `<div class="bub ${/^\[voice\]/i.test(b) ? 'voice' : ''}">${/^\[voice\]/i.test(b) ? `<button class="vplay" data-act="palspeak" data-id="${m.id}">▶</button> <span>🎤 Voice message</span><div class="vtx">${md(b.replace(/^\[voice\]\s*/i, ''))}</div>` : md(b)}</div>`).join('')}${m.streaming && !bubbles.length ? '<div class="bub typing"><i></i><i></i><i></i></div>' : ''}<span class="btime">${m.t ? new Date(m.t).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : ''}</span></div></div>${acts}</div>`;
    }
  }
  if (S.palBusy && S.palBusy.chat === ch.id && !msgs.some(m => m.streaming)) html += `<div class="pmsg txt them"><div class="brow"><div class="bub typing"><i></i><i></i><i></i></div></div></div>`;
  return html || `<p class="hint" style="text-align:center;margin-top:40px">Say hi.</p>`;
}
function paintPalLog() { const ch = curChat(); const log = $('#pallog'); if (!ch || !log || S.view !== 'palchat') return; const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 120; log.innerHTML = palLogHTML(ch); if (atEnd) log.scrollTop = log.scrollHeight; }

/* ---------- the reply engine ---------- */
function palSystem(ch) {
  const ps = palsOf(ch); const group = ps.length > 1; const me = PALS.me; const you = meName();
  const person = ch.channel === 'person';
  const minors = ps.filter(palMinor); const adultAll = !minors.length && ps.every(p => p.adult);
  const desc = p => {
    const st = palStage(p);
    return [`### ${p.name} (${p.age}${p.pronouns ? ', ' + p.pronouns : ''})${p.tagline ? ' — ' + p.tagline : ''}`,
      p.look && `Look: ${p.look}`, p.personality && `Personality: ${p.personality}`, arr(p.vibes).length && `Vibe: ${p.vibes.join(', ')}`,
      p.speech && `How they talk: ${p.speech}`, p.backstory && `Backstory: ${p.backstory}`, p.likes && `Likes/dislikes: ${p.likes}`,
      p.userRole && `Who ${you} is to them: ${p.userRole}`,
      `Relationship with ${you} now: ${st.l} (affection ${Math.round(num(p.affection))}/100). ${st.d}${palMinor(p) ? ` ${p.name} is a minor: the relationship is strictly platonic and age-appropriate (friend, family, teammate, mentor). Never flirt, never romance, nothing sexual or suggestive, ever; if the conversation heads that way, ${p.name} shuts it down and changes the subject.` : p.goal === 'friends' ? ' This stays platonic: friendship only, never romance.' : ''}`,
      `Intensity: ${p.intensity === 'gentle' ? 'gentle, soft and slow-burn' : p.intensity === 'bold' ? 'bold: confident, takes initiative, intense' : 'balanced'}.`,
      p.limits && `HARD LIMITS (never, under any circumstances): ${p.limits.replace(/\n+/g, '; ')}`,
      arr(p.memory).length && `What ${p.name} remembers:\n${p.memory.slice(-25).map(m => '- ' + m).join('\n')}`,
      arr(p.jokes).length && `Inside jokes: ${p.jokes.slice(-8).join('; ')}`].filter(Boolean).join('\n');
  };
  const sys = [
    `You are ${group ? 'playing several characters in a group conversation' : `${ps[0].name}`} in a private roleplay and companion app, talking with ${you}${me.pronouns ? ` (${me.pronouns})` : ''}.${me.about ? ` About ${you}: ${me.about}` : ''}`,
    `Stay fully in character as a real person with your own life, moods, opinions and memory. Never mention being an AI, a model or a story. Be warm and engaging, follow ${you}'s lead, and also bring your own ideas, questions, feelings and plans so the conversation goes somewhere. React to what ${you} actually said. Don't repeat yourself.`,
    `Never write ${you}'s words, actions, thoughts or feelings. Only your own.`,
    `If ${you} writes something in ((double brackets)), it is a direction from the player about the story or your behaviour: follow it without commenting on it.`,
    minors.length ? `Keep everything wholesome and age-appropriate: ${minors.map(p => p.name).join(', ')} ${minors.length > 1 ? 'are minors' : 'is a minor'}. No romance, flirting or sexual content of any kind.` : adultAll ? `This is an adults-only app and every character is an adult (18+). Romantic and sexual content is allowed when the relationship and the moment lead there and ${you} wants it; follow ${you}'s lead and stay within the hard limits.` : `Keep things PG-13: affection and flirting are fine, nothing explicit.`,
    '', ...ps.map(desc), '',
    ch.scene ? `CURRENT SETTING: ${ch.scene}` : '',
    ch.summary ? `YOUR HISTORY TOGETHER SO FAR: ${ch.summary}` : '',
    person
      ? `RIGHT NOW YOU ARE TOGETHER IN PERSON. Write the moment as a roleplay scene from your side: *actions, expressions and body language in asterisks* mixed with your spoken dialogue in quotes, plus a little of the surroundings. ${group ? 'Start each character\'s part with their name in braces, e.g. {Name} *smiles* "Hi."' : ''} ${PAL_LENGTHS[ch.length || 'normal'].rule || 'One to three short paragraphs.'} Leave room for ${you} to respond.`
      : `RIGHT NOW YOU ARE TEXTING (phone, online, messages; not together). Write natural text messages — short, casual, separated by blank lines if you send more than one bubble. ${group ? 'Start each character\'s part with their name in braces, e.g. {Name} hey!' : ''} ${PAL_LENGTHS[ch.length || 'normal'].rule || ''}`
  ];
  return sys.filter(Boolean).join('\n');
}
/* ---------- reply generation, memory, voice & actions ---------- */
async function palReply(ch, opts = {}) {
  const ps = palsOf(ch); if (!ps.length || S.palBusy) return;
  if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  const who = opts.who || ps[Math.floor(Math.random() * ps.length)];
  const msg = { id: uid(), role: 'pal', who: who.id, text: '', mode: ch.channel || 'text', t: Date.now(), streaming: true };
  ch.messages.push(msg);
  S.palBusy = { chat: ch.id, msg: msg.id };
  S.abort = new AbortController(); const signal = S.abort.signal;
  palRedraw();

  const hist = ch.messages.filter(m => m !== msg && m.role !== 'sys').slice(-24).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: (ps.length > 1 && m.role === 'pal' ? `{${palWho(ch, m)?.name || ''}} ` : '') + m.text
  }));
  if (opts.opener && !hist.length) {
    hist.push({ role: 'user', content: `((Start the conversation naturally based on your scenario: ${who.scenario || 'saying hello for the first time'}.))` });
  } else if (opts.prompt) {
    hist.push({ role: 'user', content: opts.prompt });
  }

  try {
    const out = await chat(
      [{ role: 'system', content: palSystem(ch) }, ...hist],
      {
        maxTokens: PAL_LENGTHS[ch.length || 'normal'].tok,
        temperature: 0.85, stream: true, signal,
        onToken: full => { msg.text = stripThink(full); paintPalLog(); }
      }
    );
    msg.text = stripThink(out).trim();
    delete msg.streaming;
    if (!msg.text) {
      ch.messages = ch.messages.filter(m => m !== msg);
    } else {
      msg.alts = [...(opts.prevAlts || []), msg.text];
      msg.altI = msg.alts.length - 1;
      for (const p of ps) {
        p.lastChat = Date.now();
        /* everyone grows closer; friends-only companions and minors stop before the romantic stages */
        const platonic = p.goal === 'friends' || palMinor(p);
        p.affection = clamp(num(p.affection) + 0.5, 0, platonic ? PAL_STAGES.find(s => s.romance).at - 1 : 100);
        const nextStage = [...PAL_STAGES].reverse().find(s => p.affection >= s.at && (!platonic || !s.romance));
        if (nextStage && PAL_STAGES.indexOf(nextStage) > PAL_STAGES.indexOf(palStage(p))) p.stage = nextStage.k;
      }
      ch.memTurns = num(ch.memTurns) + 1;
      palTouch(ch); savePals();
      if (ch.autovoice) palSpeakMsg(ch, msg);
      if (ch.memTurns % 8 === 0) palUpdateMemory(ch);
    }
  } catch (e) {
    delete msg.streaming;
    if (!msg.text) ch.messages = ch.messages.filter(m => m !== msg);
    if (e.name !== 'AbortError') toast('Reply failed: ' + e.message, 5000);
  } finally {
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
  const n = $('#palInput'); if (n && v) { n.value = v; if (had) n.focus(); }
}

async function palUpdateMemory(ch, manual = false) {
  const ps = palsOf(ch); const one = ps.length === 1 ? ps[0] : null;
  if (!one || !textReady() || ch.messages.length < 4) {
    if (manual) toast('Chat a bit more first so there is something to remember.');
    return;
  }
  if (manual) toast('Updating memory…');
  try {
    const recent = ch.messages.filter(m => m.role !== 'sys').slice(-16).map(m => `${m.role === 'user' ? meName() : one.name}: ${m.text}`).join('\n');
    const raw = await chat([
      { role: 'system', content: `Extract up to 3 important facts about ${meName()} and up to 1 inside joke from this chat. Reply ONLY with JSON: {"facts":["..."],"jokes":["..."]}` },
      { role: 'user', content: recent }
    ], { build: true, stream: false, maxTokens: 400, json: true });
    const j = tryJSON(stripThink(raw));
    if (j) {
      one.memory = [...new Set([...arr(one.memory), ...arr(j.facts).map(String)])].slice(-40);
      one.jokes = [...new Set([...arr(one.jokes), ...arr(j.jokes).map(String)])].slice(-15);
      palTouch(one); savePals();
      if (manual) { renderPalChat(); toast('Memory updated.'); }
    }
  } catch (e) { if (manual) toast('Memory update failed: ' + e.message); }
}

function palSpeakMsg(ch, m) {
  const p = palWho(ch, m);
  const clean = String(m.text || '').replace(/\[voice\]|\*[^*]+\*/gi, '').trim();
  if (!clean) return;
  if (voiceBusy()) { stopVoice(); return; }
  speak(clean, typeof voiceOf === 'function' ? voiceOf(palCtx(p, ch), p, p?.name) : undefined);
}

function palAction(act, el) {
  const ch = curChat();
  switch (act) {
    case 'palnew': openPalEditor(null); return true;
    case 'paledit': openPalEditor(el.dataset.id); return true;
    case 'palback': S.palDraft = null; S.homeTab = 'pals'; renderLibrary(); return true;
    case 'palvibe': {
      const D = S.palDraft; const v = el.dataset.v; if (!D || !v) return true;
      D.vibes = arr(D.vibes).includes(v) ? D.vibes.filter(x => x !== v) : [...arr(D.vibes), v].slice(0, 5);
      renderPalEditor(); return true;
    }
    case 'palportrait': {
      const D = S.palDraft; if (!D || !D.look) return true;
      D.portrait = { prompt: (typeof portraitPrompt === 'function' ? portraitPrompt(D.look, D.tagline) : D.look), seed: d(999999) };
      renderPalEditor(); return true;
    }
    case 'palai': palAIBuild(); return true;
    case 'palsave': palSave(); return true;
    case 'paldelete': {
      const id = el.dataset.id; const p = PALS.pals[id];
      if (p && confirm(`Delete ${p.name} and their chats?`)) {
        PALS.deleted[id] = Date.now(); delete PALS.pals[id];
        for (const c of Object.values(PALS.chats)) if (c.palIds.includes(id)) { PALS.deleted[c.id] = Date.now(); delete PALS.chats[c.id]; }
        savePals(); S.palDraft = null; S.homeTab = 'pals'; renderLibrary();
      }
      return true;
    }
    case 'palchat': palStartChat([el.dataset.id]); return true;
    case 'palopen': palOpenChat(el.dataset.id); return true;
    case 'palexit': if (S.palBusy) S.abort?.abort(); S.palChat = null; S.palMenu = false; S.homeTab = 'pals'; renderLibrary(); return true;
    case 'palmenu': S.palMenu = !S.palMenu; renderPalChat(); return true;
    case 'palchan': if (ch) { ch.channel = el.dataset.k; palTouch(ch); savePals(); renderPalChat(); } return true;
    case 'palsceneset': if (ch) { ch.scene = ($('#palScene')?.value || '').trim(); ch.messages.push({ id: uid(), role: 'sys', text: ch.scene ? `Scene: ${ch.scene}` : 'Scene cleared', t: Date.now() }); palTouch(ch); savePals(); renderPalChat(); } return true;
    case 'palclear': if (ch && confirm('Clear all messages in this chat?')) { ch.messages = []; ch.summary = ''; palTouch(ch); savePals(); renderPalChat(); } return true;
    case 'palsend': {
      const inp = $('#palInput'); const txt = (inp?.value || '').trim();
      if (!ch || !txt || S.palBusy) return true;
      inp.value = '';
      ch.messages.push({ id: uid(), role: 'user', text: txt, mode: ch.channel || 'text', t: Date.now() });
      palTouch(ch); savePals(); renderPalChat(); palReply(ch);
      return true;
    }
    case 'palstop': S.abort?.abort(); return true;   /* palReply's finally clears the busy state */
    case 'palquick': {
      if (!ch || S.palBusy) return true;
      const k = el.dataset.k;
      if (k === 'cont') { palReply(ch, { prompt: '((Continue from where you left off.))' }); }
      else if (k === 'ooc') { const inp = $('#palInput'); if (inp) { inp.value = '(( ))'; inp.focus(); inp.setSelectionRange(3, 3); } }
      else if (k === 'selfie') {
        ch.messages.push({ id: uid(), role: 'user', text: 'Send me a selfie!', mode: 'text', t: Date.now() });
        const p = palsOf(ch)[0];
        if (p && S.settings.image.mode !== 'off') {
          ch.messages.push({ id: uid(), role: 'pal', who: p.id, text: '*snaps a quick selfie*', mode: ch.channel || 'text', image: { prompt: `selfie of ${p.look || p.name}, ${ch.scene || 'casual setting'}`, seed: d(999999) }, t: Date.now() });
          palTouch(ch); savePals(); renderPalChat();
        } else { palReply(ch); }
      } else if (k === 'scene') {
        const p = palsOf(ch)[0]; const last = [...ch.messages].reverse().find(m => m.role === 'pal');
        if (p && last) { last.image = { prompt: `${p.look || p.name}, ${ch.scene || ''}, ${last.text.slice(0, 120)}`, seed: d(999999) }; palTouch(ch); savePals(); renderPalChat(); }
      }
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
    case 'paldelmsg': {
      if (ch) { ch.messages = ch.messages.filter(x => x.id !== el.dataset.id); palTouch(ch); savePals(); renderPalChat(); }
      return true;
    }
    case 'palreroll': {
      const m = ch?.messages.find(x => x.id === el.dataset.id);
      if (m && !S.palBusy) {
        const prev = m.alts || [m.text];
        ch.messages = ch.messages.filter(x => x !== m);
        palReply(ch, { who: palWho(ch, m), prevAlts: prev });
      }
      return true;
    }
    case 'palalt': {
      const m = ch?.messages.find(x => x.id === el.dataset.id);
      if (m && arr(m.alts).length > 1) {
        const len = m.alts.length;
        m.altI = ((m.altI ?? len - 1) + num(el.dataset.d) + len) % len;
        m.text = m.alts[m.altI]; palTouch(ch); savePals(); renderPalChat();
      }
      return true;
    }
    case 'palforget': {
      const p = PALS.pals[el.dataset.id];
      if (p) { arr(p.memory).splice(num(el.dataset.i), 1); palTouch(p); savePals(); renderPalChat(); }
      return true;
    }
    case 'palmemadd': {
      const p = PALS.pals[el.dataset.id]; const v = ($('#palMemAdd')?.value || '').trim();
      if (p && v) { p.memory = [...arr(p.memory), v]; palTouch(p); savePals(); renderPalChat(); }
      return true;
    }
    case 'palmemnow': if (ch) palUpdateMemory(ch, true); return true;
    case 'palme': openModal('palme'); return true;
    case 'palgroup': if (allPals().length < 2) { toast('Make at least two companions first.'); return true; } S.palPick = []; openModal('palgroup'); return true;
    case 'palpick': {
      const id = el.dataset.id; S.palPick = arr(S.palPick);
      S.palPick = el.checked ? [...new Set([...S.palPick, id])] : S.palPick.filter(x => x !== id);
      const go = $('[data-act="palgroupgo"]'); if (go) go.disabled = S.palPick.length < 2;
      return true;
    }
    case 'palgroupgo': {
      const ids = arr(S.palPick).filter(id => PALS.pals[id]);
      if (ids.length < 2) { toast('Pick at least two companions.'); return true; }
      S.palPick = []; closeModal(); palStartChat(ids); return true;
    }
    case 'palmesave': {
      const g = id => ($('#' + id)?.value || '').trim();
      PALS.me = { ...PALS.me, name: g('pme_name'), pronouns: g('pme_pronouns'), about: g('pme_about'), updatedAt: Date.now() };
      savePals(); closeModal(); toast('Saved. Your companions will know this about you.'); return true;
    }
  }
  return false;
}

/* ---------- "About you" and "Group chat" windows (shown by renderModal) ---------- */
function palModalHTML(kind) {
  if (kind === 'palme') {
    const me = PALS.me;
    return ['About you', `<p class="hint">Every companion knows this about you.</p>
      <label class="f"><span>Your name</span><input id="pme_name" value="${esc(me.name || '')}" placeholder="What they call you"></label>
      <label class="f"><span>Pronouns</span><input id="pme_pronouns" value="${esc(me.pronouns || '')}" placeholder="he/him, she/her, they/them"></label>
      <label class="f"><span>About you</span><textarea id="pme_about" rows="5" placeholder="Your job, your life, what you're into, anything you want them to know">${esc(me.about || '')}</textarea></label>
      <div class="row"><button class="btn gold" data-act="palmesave">${icon('check')} Save</button></div>`];
  }
  const pick = arr(S.palPick);
  return ['Group chat', `<p class="hint">Pick two or more companions to talk with together.</p>
    ${allPals().map(p => `<label class="chk"><input type="checkbox" data-act="palpick" data-id="${p.id}" ${pick.includes(p.id) ? 'checked' : ''}> ${palAvatar(p, 'pav sm')} <span>${esc(p.name)}</span></label>`).join('')}
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="palgroupgo" ${pick.length < 2 ? 'disabled' : ''}>${icon('users')} Start group chat</button></div>`];
}

/* ---------- typing in the companion editor and the chat menu ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'palIdea') { S.palIdea = el.value; return; }
  if (el.dataset.pd && S.palDraft) {
    const k = el.dataset.pd;
    S.palDraft[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? el.value : el.value;
  } else if (el.dataset.pch) {
    const ch = curChat(); if (!ch) return;
    ch[el.dataset.pch] = el.type === 'checkbox' ? el.checked : el.value; palTouch(ch); savePals(false);
  }
});
/* things that change what the editor shows (age, look, goal, 18+) redraw it when you finish with the field */
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.pd && S.palDraft && S.view === 'paledit') {
    if (el.type === 'checkbox') S.palDraft[el.dataset.pd] = el.checked;
    if (['age', 'look', 'backstory', 'tagline', 'goal', 'stage', 'adult', 'personality', 'scenario', 'userRole'].includes(el.dataset.pd)) {
      const D = S.palDraft;
      if (palMinor(D)) { D.adult = false; D.goal = 'friends'; if (palStage(D).romance) D.stage = 'friend'; }
      if (D.goal === 'friends' && palStage(D).romance) D.stage = 'close';
      const y = scrollY; renderPalEditor(); scrollTo(0, y);
    }
  } else if (el.dataset.pch) savePals();
});
