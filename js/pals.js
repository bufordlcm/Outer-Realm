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
const palStage = p => PAL_STAGES.find(s => s.k === p.stage) || PAL_STAGES[0];
const palsOf = chat => arr(chat?.palIds).map(id => PALS.pals[id]).filter(Boolean);
const curChat = () => PALS.chats[S.palChat];

/* the picture engine and voice engine expect a game; this is the companion's stand-in */
function palCtx(p, chat) {
  const adultOK = p.adult && S.settings.ui.palAdult;
  const ctx = p._ctx || (Object.defineProperty(p, '_ctx', { value: {}, enumerable: false, writable: true }), p._ctx);
  Object.assign(ctx, { id: 'pal_' + p.id, title: p.name, genre: '', premise: '', location: chat?.scene || '', artStyle: p.art || 'photorealistic, natural light, detailed',
    rating: adultOK ? 'Adult (18+)' : 'PG-13', character: { name: meName(), appearance: p.look, backstory: p.backstory, storyRole: '' },
    party: chat ? palsOf(chat) : [p], codex: [], voiceMap: chat ? (chat.voiceMap = chat.voiceMap || {}) : {} });
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
  if (!S.settings.ui.palAdultAsked && !pals.length) return `<section class="hsec"><div class="card palhero">
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
  const adultOn = !!S.settings.ui.palAdult;
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
        <div class="kv">${f('name', 'Name', 'Mara')}${f('age', 'Age (18+)', '25', 'number')}</div>
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
      <label class="f"><span>Where it can go</span><select data-pd="goal">${Object.entries(PAL_GOALS).map(([k, l]) => `<option value="${k}" ${D.goal === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f"><span>Where you start</span><select data-pd="stage">${PAL_STAGES.filter(s => D.goal !== 'friends' || !s.romance).map(s => `<option value="${s.k}" ${D.stage === s.k ? 'selected' : ''}>${s.l}</option>`).join('')}</select></label>
      <p class="hint">${esc(palStage(D).d)} The relationship moves on its own as you talk.</p>
      <div class="sect">Your rules</div>
      <label class="f"><span>Intensity</span><select data-pd="intensity"><option value="gentle" ${D.intensity === 'gentle' ? 'selected' : ''}>Gentle: soft and slow</option><option value="balanced" ${D.intensity !== 'gentle' && D.intensity !== 'bold' ? 'selected' : ''}>Balanced</option><option value="bold" ${D.intensity === 'bold' ? 'selected' : ''}>Bold: intense, takes initiative</option></select></label>
      ${t('limits', 'Hard limits (they will never go here)', 'Anything you never want in your chats, one per line', 2)}
      <label class="chk"><input type="checkbox" data-pd="adult" ${D.adult ? 'checked' : ''} ${adultOn ? '' : 'disabled'}> <span>Allow 18+ content with this companion</span></label>${adultOn ? '' : '<p class="hint">18+ is off for the whole app. <button class="link" data-act="palme">Turn it on in About you</button> (it asks you to confirm you\'re 18 or older), then tick this box.</p>'}
      ${f('art', 'Picture style', 'photorealistic, natural light, detailed')}
    </div>
    <div class="row wrap" style="margin-bottom:30px"><button class="btn gold" data-act="palsave">${icon('check')} Save${S.palDraftNew ? ' and start chatting' : ''}</button>${!S.palDraftNew ? `<button class="btn ghost" data-act="paldelete" data-id="${D.id}">${icon('trash')} Delete companion</button>` : ''}</div>
  </main></div>`;
  buildTimer();
}
function palValidate(D) {
  if (!String(D.name || '').trim()) return 'Give them a name.';
  if (num(D.age) < 18) return 'Companions must be adults (18 or older).';
  const txt = [D.look, D.backstory, D.personality, D.tagline, D.scenario].join(' ');
  if (CHAR_MINOR.test(txt) || /\b(teen(ager)?|high school(er)?|middle school|child|kid|minor|underage|years? old\b[^.]{0,8}\b1[0-7]\b)/i.test(txt)) return 'Companions must be adults: remove anything that describes them as under 18.';
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
    if (num(j.age) >= 18) D.age = num(j.age); else D.age = Math.max(18, num(D.age) || 25);
    if (arr(j.vibes).length) D.vibes = arr(j.vibes).map(v => String(v).toLowerCase()).filter(v => PAL_VIBES.includes(v)).slice(0, 4);
    toast('Companion drafted. Read it over and save.');
  } catch (e) { toast('Build failed: ' + e.message, 6000); }
  S.palBuilding = 0; renderPalEditor();
}
function palSave() {
  const D = S.palDraft; const err = palValidate(D); if (err) return toast(err, 5000);
  D.age = Math.max(18, num(D.age)); if (!S.settings.ui.palAdult) D.adult = false;
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
  const adultAll = ps.every(p => p.adult) && S.settings.ui.palAdult;
  const desc = p => {
    const st = palStage(p);
    return [`### ${p.name} (${p.age}${p.pronouns ? ', ' + p.pronouns : ''})${p.tagline ? ' — ' + p.tagline : ''}`,
      p.look && `Look: ${p.look}`, p.personality && `Personality: ${p.personality}`, arr(p.vibes).length && `Vibe: ${p.vibes.join(', ')}`,
      p.speech && `How they talk: ${p.speech}`, p.backstory && `Backstory: ${p.backstory}`, p.likes && `Likes/dislikes: ${p.likes}`,
      p.userRole && `Who ${you} is to them: ${p.userRole}`,
      `Relationship with ${you} now: ${st.l} (affection ${Math.round(num(p.affection))}/100). ${st.d}${p.goal === 'friends' ? ' This stays platonic: friendship only, never romance.' : ''}`,
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
    adultAll ? `This is an adults-only app and every character is an adult (18+). Romantic and sexual content is allowed when the relationship and the moment lead there and ${you} wants it; follow ${you}'s lead and stay within the hard limits.` : `Keep things PG-13: affection and flirting are fine, nothing explicit.`,
    '', ...ps.map(desc), '',
    ch.scene ? `CURRENT SETTING: ${ch.scene}` : '',
    ch.summary ? `YOUR HISTORY TOGETHER SO FAR: ${ch.summary}` : '',
    person
      ? `RIGHT NOW YOU ARE TOGETHER IN PERSON. Write the moment as a roleplay scene from your side: *actions, expressions and body language in asterisks* mixed with your spoken dialogue in quotes, plus a little of the surroundings. ${group ? 'Start each character\'s part with their name in braces, e.g. {Name} *smiles* "Hi."' : ''} ${PAL_LENGTHS[ch.length || 'normal'].rule || 'One to three short paragraphs.'} Leave room for ${you} to respond.`
      : `RIGHT NOW YOU ARE TEXTING (phone, online, messages; not together). Write like real text messages: casual, in your own texting style${arr(ps[0].vibes).includes('bubbly') ? ' with emojis' : ''}. Send 1-4 separate messages, each on its own line with a blank line between them (each becomes a bubble). No narration and no *actions*: only what you type. ${group ? 'Start every message with the sender\'s name in braces, e.g. {Name} hey!' : ''} ${PAL_LENGTHS[ch.length || 'normal'].rule}`,
    `Extras you can use when it fits naturally:
- To send a photo/selfie, put on its own line: [photo: what the picture shows, e.g. selfie in my kitchen, messy bun, holding coffee]. Do this when ${you} asks for a pic, or now and then when it's natural${person ? ' (not while together in person)' : ''}.
${person ? '' : '- To send a voice message instead of text, start that message with [voice].\n'}- If you two part ways or one of you leaves, end your reply with [[texting]]. If you meet up or arrive at the same place, end your reply with [[in person]].`
  ].filter(x => x !== '');
  return sys.join('\n');
}
function palHistory(ch, upto) {
  const msgs = arr(ch.messages).slice(0, upto ?? undefined).filter(m => !m.streaming);
  const group = palsOf(ch).length > 1; const out = [];
  for (const m of msgs.slice(-40)) {
    if (m.role === 'sys') { out.push({ role: 'user', content: `((${m.text}))` }); continue; }
    if (m.role === 'user') out.push({ role: 'user', content: (m.mode === 'person' ? '' : '') + m.text });
    else out.push({ role: 'assistant', content: (group ? `{${PALS.pals[m.who]?.name || ''}} ` : '') + m.text + (m.image ? `\n[photo: ${m.image.desc || 'sent a photo'}]` : '') });
  }
  /* the API needs alternating turns: merge neighbours with the same role */
  const merged = [];
  for (const x of out) { const l = merged[merged.length - 1]; if (l && l.role === x.role) l.content += '\n\n' + x.content; else merged.push({ ...x }); }
  return merged;
}
async function palReply(ch, opts = {}) {
  if (S.palBusy) return; if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  const ps = palsOf(ch); if (!ps.length) return;
  const ctl = new AbortController(); S.palBusy = { chat: ch.id, ctl };
  const replace = opts.reroll ? ch.messages.find(m => m.id === opts.reroll) : null;
  const upto = replace ? ch.messages.indexOf(replace) : undefined;
  const msg = replace || { id: uid(), role: 'pal', who: ps[0].id, text: '', mode: ch.channel === 'person' ? 'person' : 'text', t: Date.now() };
  if (replace) { msg.alts = arr(msg.alts).length ? msg.alts : [{ text: msg.text, image: msg.image || null }]; msg.text = ''; delete msg.image; }
  else ch.messages.push(msg);
  msg.streaming = true; if (S.view === 'palchat') renderPalChat();
  const hist = palHistory(ch, upto);
  if (opts.opener && !hist.length) hist.push({ role: 'user', content: `((Start the conversation: send ${ps.length > 1 ? 'the group\'s' : 'your'} first message to ${meName()}${ps[0].scenario ? `. The situation: ${ps[0].scenario}` : ''}.))` });
  if (opts.cont) hist.push({ role: 'user', content: '((Continue: keep going from where you left off, adding something new.))' });
  if (!hist.length || hist[hist.length - 1].role !== 'user') hist.push({ role: 'user', content: '((Continue.))' });
  try {
    const raw = await chat([{ role: 'system', content: palSystem(ch) }, ...hist], {
      stream: !!S.settings.text.stream && msg.mode === 'person', signal: ctl.signal, maxTokens: PAL_LENGTHS[ch.length || 'normal'].tok, temperature: 0.9,
      onToken: full => { msg.text = palClean(full).text; paintPalLog(); } });
    const r = palClean(stripThink(raw), ch);
    msg.text = r.text || '…'; msg.t = Date.now();
    if (r.who) msg.who = r.who;
    if (r.photo && S.settings.image.mode !== 'off') { const p = PALS.pals[msg.who] || ps[0]; msg.image = { prompt: `${p.look || p.name}, ${r.photo}, photo`, seed: d(999999), desc: r.photo }; }
    if (replace) { msg.alts.push({ text: msg.text, image: msg.image || null }); msg.altI = msg.alts.length - 1; }
    delete msg.streaming;
    if (r.split.length) {   /* group replies: one message per character */
      const i = ch.messages.indexOf(msg);
      ch.messages.splice(i, 1, ...r.split.map(s => ({ id: uid(), role: 'pal', who: s.who, text: s.text, mode: msg.mode, t: Date.now() })));
    }
    if (r.chan && r.chan !== ch.channel) { ch.channel = r.chan; ch.messages.push({ id: uid(), role: 'sys', text: r.chan === 'person' ? `You're together now${ch.scene ? ' · ' + ch.scene : ''}` : 'You went your separate ways · texting', t: Date.now() }); }
    for (const p of ps) { p.lastChat = Date.now(); }
    ch.memTurns = num(ch.memTurns) + 1;
    palTouch(ch); savePals();
    if (ch.autovoice || /^\[voice\]/im.test(raw)) setTimeout(() => palSpeak(ch, ch.messages[ch.messages.length - 1]), 100);
    if (ch.memTurns >= 6) setTimeout(() => palMemory(ch), 1500);
  } catch (e) {
    delete msg.streaming;
    if (e.name === 'AbortError') { if (!msg.text) ch.messages = ch.messages.filter(m => m !== msg); }
    else { if (!msg.text) ch.messages = ch.messages.filter(m => m !== msg); toast('No reply: ' + e.message, 6000); }
    if (replace && !msg.text && msg.alts?.length) { const a = msg.alts[msg.alts.length - 1]; msg.text = a.text; msg.image = a.image || undefined; ch.messages.splice(upto, 0, msg); }
  } finally { S.palBusy = null; if (S.view === 'palchat') renderPalChat(); }
}
/* tidy a reply: channel tags, photo tags, {Name} speakers, stray self-labels */
function palClean(text, ch) {
  let t = String(text || ''); let chan = '', photo = '', who = '';
  if (/\[\[\s*in[ -]?person\s*\]\]/i.test(t)) chan = 'person'; if (/\[\[\s*text(ing)?\s*\]\]/i.test(t)) chan = 'text';
  t = t.replace(/\[\[[^\]]*\]\]/g, '');
  t = t.replace(/\[(?:photo|selfie|pic|image)\s*:\s*([^\]]+)\]/gi, (_, x) => { photo = photo || x.trim(); return ''; });
  const split = [];
  if (ch && palsOf(ch).length > 1) {
    const ps = palsOf(ch); const parts = t.split(/(?=\{[^{}\n]{1,40}\})/);
    for (const part of parts) { const m = part.match(/^\{([^{}\n]{1,40})\}\s*([\s\S]*)$/); if (!m) { if (part.trim() && split.length) split[split.length - 1].text += '\n\n' + part.trim(); else if (part.trim()) split.push({ who: ps[0].id, text: part.trim() }); continue; }
      const p = ps.find(x => x.name.toLowerCase() === m[1].trim().toLowerCase()) || ps.find(x => m[1].toLowerCase().includes(x.name.split(/\s+/)[0].toLowerCase()));
      const txt = m[2].trim(); if (!txt) continue;
      const lw = split[split.length - 1]; if (lw && lw.who === (p || ps[0]).id) lw.text += '\n\n' + txt; else split.push({ who: (p || ps[0]).id, text: txt }); }
    if (split.length === 1) { who = split[0].who; t = split[0].text; split.length = 0; }
  } else if (ch) { const p = palsOf(ch)[0]; if (p) t = t.replace(new RegExp(`^\\s*(\\{${p.name}\\}|${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:)\\s*`, 'gim'), ''); }
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return { text: t, chan, photo, who, split };
}

/* ---------- long-term memory & relationship ---------- */
async function palMemory(ch, force = false) {
  const ps = palsOf(ch); if (!ps.length || ch.memBusy) return;
  const recent = arr(ch.messages).filter(m => m.role !== 'sys').slice(-24).map(m => `${m.role === 'user' ? meName().toUpperCase() : (PALS.pals[m.who]?.name || '').toUpperCase()}: ${String(m.text).slice(0, 600)}`).join('\n');
  if (!recent) return; ch.memBusy = true;
  try {
    const raw = await chat([
      { role:'system', content:`You keep the long-term memory for characters in a companion app. Read the latest conversation and update what each character knows. Reply with JSON only:
{"summary":"3-6 sentences: the story of this relationship so far, including the newest events (rewrite the old summary to include them)",
 "characters":[{"name":"","facts":["new lasting facts about ${meName()} or the relationship worth remembering: names, job, likes, plans, important moments, promises"],"jokes":["new inside jokes or recurring bits"],"affection_change":0}]}
affection_change: -10 to +10, how much closer (or further) this conversation brought them. Only real things from the conversation; use [] when nothing new.` },
      { role:'user', content:`OLD SUMMARY: ${ch.summary || '(none)'}\n\n${ps.map(p => `${p.name} already remembers:\n${arr(p.memory).slice(-30).map(m => '- ' + m).join('\n') || '(nothing)'}\nAffection now: ${Math.round(num(p.affection))}/100, stage: ${palStage(p).l}`).join('\n\n')}\n\nLATEST CONVERSATION:\n${recent}` }
    ], { stream:false, maxTokens:900, temperature:0.2, helper:true, json:true });
    const j = tryJSON(stripThink(raw)) || {};
    if (j.summary) ch.summary = String(j.summary).slice(0, 1500);
    for (const x of arr(j.characters)) {
      const p = ps.find(q => q.name.toLowerCase() === String(x.name || '').toLowerCase()) || (ps.length === 1 ? ps[0] : null); if (!p) continue;
      p.memory = arr(p.memory); for (const f of arr(x.facts).map(s => String(s).trim()).filter(Boolean)) if (!p.memory.some(m => m.toLowerCase() === f.toLowerCase())) p.memory.push(f.slice(0, 200));
      if (p.memory.length > 80) p.memory = p.memory.slice(-80);
      p.jokes = arr(p.jokes); for (const f of arr(x.jokes).map(s => String(s).trim()).filter(Boolean)) if (!p.jokes.includes(f)) p.jokes.push(f.slice(0, 120));
      palAffect(p, ch, clamp(num(x.affection_change), -10, 10));
      palTouch(p);
    }
    ch.memTurns = 0; palTouch(ch); savePals();
    if (force) toast('Memory updated.');
  } catch (e) { console.warn('Companion memory failed', e); if (force) toast('Memory update failed: ' + e.message, 5000); }
  finally { ch.memBusy = false; if (S.view === 'palchat' && S.palMenu) renderPalChat(); }
}
function palAffect(p, ch, delta) {
  const before = palStage(p);
  p.affection = clamp(num(p.affection) + delta, 0, 100);
  const allowed = PAL_STAGES.filter(s => p.goal !== 'friends' || !s.romance);
  let next = [...allowed].reverse().find(s => p.affection >= s.at) || allowed[0];
  /* move one step at a time, so a relationship never jumps from strangers to dating */
  const bi = PAL_STAGES.indexOf(before), ni = PAL_STAGES.indexOf(next);
  if (ni > bi + 1) next = PAL_STAGES[bi + 1]; else if (ni < bi - 1) next = PAL_STAGES[bi - 1];
  if (p.goal === 'open' && PAL_STAGES.indexOf(next) < PAL_STAGES.indexOf(before)) next = before;
  if (next.k !== before.k) { p.stage = next.k; ch.messages.push({ id: uid(), role: 'sys', text: `${PAL_STAGES.indexOf(next) > bi ? '💗' : '💔'} You and ${p.name}: ${next.l}`, t: Date.now() }); }
}

/* ---------- voice ---------- */
function palSpeak(ch, m) {
  if (!m) return; const p = palWho(ch, m); const ctx = palCtx(p, ch);
  stopVoice(); unlockTTS();
  const voice = voiceOf(ctx, p, p.name);
  const text = String(m.text || '').replace(/^\[voice\]\s*/gim, '');
  if (m.mode === 'person') {   /* actions in the narrator's voice, dialogue in theirs */
    const parts = text.split(/(\*[^*\n]+\*)/g).map(s => s.trim()).filter(Boolean);
    for (const part of parts) { const act = /^\*.*\*$/.test(part); const tx = cleanSpeech(part.replace(/^\*|\*$/g, '').replace(/[“”"]/g, '')); if (tx) VOICE.items.push({ text: tx, voice: act ? narratorVoice() : voice, eng: engine() }); }
  } else VOICE.items.push({ text: cleanSpeech(text.replace(/\n+/g, ' ')), voice, eng: engine() });
  savePals(false);
  if (!VOICE.playing) runVoice();
}

/* ---------- picture of the moment ---------- */
function palScenePicture(ch) {
  const ps = palsOf(ch); const last = [...arr(ch.messages)].reverse().find(m => m.role === 'pal'); if (!last) return toast('Talk a little first.');
  const looks = ps.map(p => `${p.name}: ${p.look}`).join('; ');
  last.image = { prompt: `${looks}. ${ch.scene || ''}. ${String(last.text).replace(/[“”"]/g, '').slice(0, 350)}`.replace(/\s+/g, ' '), seed: d(999999), desc: 'a picture of this moment' };
  palTouch(ch); savePals(); renderPalChat();
}

/* ---------- actions ---------- */
function palAction(act, el) {
  const ch = curChat();
  switch (act) {
    case 'palnew': openPalEditor(); return true;
    case 'paledit': S.palMenu = false; openPalEditor(el.dataset.id); return true;
    case 'palback': S.palDraft = null; S.homeTab = 'pals'; renderLibrary(); return true;
    case 'palvibe': { const D = S.palDraft; const v = el.dataset.v; D.vibes = arr(D.vibes).includes(v) ? D.vibes.filter(x => x !== v) : [...arr(D.vibes), v].slice(-5); el.classList.toggle('on'); return true; }
    case 'palai': palAIBuild(); return true;
    case 'palsave': palSave(); return true;
    case 'paldelete': { const p = PALS.pals[el.dataset.id]; if (!p) return true; if (S.palDelArm !== p.id) { S.palDelArm = p.id; toast(`Tap Delete again to delete ${p.name} and your chats with them.`); return true; }
      delete PALS.pals[p.id]; PALS.deleted[p.id] = Date.now(); for (const c2 of palChats()) if (c2.palIds.includes(p.id)) { delete PALS.chats[c2.id]; PALS.deleted[c2.id] = Date.now(); }
      savePals(); S.palDraft = null; S.homeTab = 'pals'; renderLibrary(); toast(`${p.name} deleted.`); return true; }
    case 'palportrait': { const D = S.palDraft; D.portrait = { prompt: `portrait photo of ${D.look}, ${D.age} years old adult, looking at the camera`, seed: d(999999) }; renderPalEditor(); return true; }
    case 'palchat': palStartChat([el.dataset.id]); return true;
    case 'palopen': palOpenChat(el.dataset.id); return true;
    case 'palgroup': S.palPick = []; openModal('palgroup'); return true;
    case 'palgpick': { const id = el.dataset.id; S.palPick = S.palPick.includes(id) ? S.palPick.filter(x => x !== id) : [...S.palPick, id]; renderModal(); return true; }
    case 'palgstart': if (S.palPick.length < 2) { toast('Pick at least two.'); return true; } closeModal(); palStartChat([...S.palPick]); return true;
    case 'palme': openModal('palme'); return true;
    case 'palmesave': { for (const k of ['name','pronouns','about']) PALS.me[k] = ($('#pme_' + k)?.value || '').trim(); PALS.me.updatedAt = Date.now();
      const adult = !!$('#pme_adult')?.checked; S.settings.ui.palAdult = adult; S.settings.ui.palAdultAsked = true; saveSettings(); savePals(); closeModal(); if (S.view === 'paledit') renderPalEditor(); else renderLibrary(); toast('Saved.'); return true; }
    case 'palexit': stopVoice(); if (S.palBusy) S.palBusy.ctl.abort(); S.palMenu = false; S.homeTab = 'pals'; renderLibrary(); return true;
    case 'palsend': { const inp = $('#palInput'); const t = (inp?.value || '').trim(); if (!t || !ch) return true; inp.value = '';
      ch.messages.push({ id: uid(), role: 'user', text: t, mode: ch.channel === 'person' ? 'person' : 'text', t: Date.now() }); palTouch(ch); savePals(false); palReply(ch); return true; }
    case 'palstop': S.palBusy?.ctl.abort(); return true;
    case 'palchan': { if (!ch) return true; const k = el.dataset.k; if (ch.channel === k) return true; ch.channel = k;
      ch.messages.push({ id: uid(), role: 'sys', text: k === 'person' ? `You meet up in person${ch.scene ? ' · ' + ch.scene : ''}` : 'Back to texting', t: Date.now() }); palTouch(ch); savePals(); renderPalChat(); return true; }
    case 'palmenu': S.palMenu = !S.palMenu; renderPalChat(); return true;
    case 'palsceneset': { if (!ch) return true; const v = ($('#palScene')?.value || '').trim(); ch.scene = v; if (v) { ch.channel = 'person'; ch.messages.push({ id: uid(), role: 'sys', text: `Scene: ${v}`, t: Date.now() }); } S.palMenu = false; palTouch(ch); savePals(); renderPalChat(); return true; }
    case 'palquick': { if (!ch) return true; const k = el.dataset.k;
      if (k === 'scene') { palScenePicture(ch); return true; }
      if (k === 'cont') { palReply(ch, { cont: true }); return true; }
      const inp = $('#palInput'); if (!inp) return true;
      if (k === 'ooc') { inp.value = (inp.value ? inp.value + ' ' : '') + '(( ))'; inp.focus(); const p = inp.value.length - 3; inp.setSelectionRange(p, p); return true; }
      if (k === 'selfie') { inp.value = ch.channel === 'person' ? 'Can I take a picture of you?' : 'Send me a pic? 📷'; inp.focus(); return true; }
      return true; }
    case 'palspeak': { const m = ch?.messages.find(x => x.id === el.dataset.id); if (m) palSpeak(ch, m); return true; }
    case 'paleditmsg': S.palEdit = el.dataset.id; renderPalChat(); setTimeout(() => $('#palEditBox')?.focus(), 30); return true;
    case 'paleditcancel': S.palEdit = null; renderPalChat(); return true;
    case 'paleditsave': { const m = ch?.messages.find(x => x.id === el.dataset.id); if (m) { m.text = ($('#palEditBox')?.value || '').trim() || m.text; if (m.alts && m.altI != null) m.alts[m.altI].text = m.text; } S.palEdit = null; palTouch(ch); savePals(); renderPalChat(); return true; }
    case 'paldelmsg': { if (!ch) return true; ch.messages = ch.messages.filter(x => x.id !== el.dataset.id); palTouch(ch); savePals(); renderPalChat(); return true; }
    case 'palreroll': { const m = ch?.messages.find(x => x.id === el.dataset.id); if (m) palReply(ch, { reroll: m.id }); return true; }
    case 'palalt': { const m = ch?.messages.find(x => x.id === el.dataset.id); if (!m || !arr(m.alts).length) return true; const i = clamp((m.altI ?? m.alts.length - 1) + num(el.dataset.d), 0, m.alts.length - 1); m.altI = i; m.text = m.alts[i].text; m.image = m.alts[i].image || undefined; palTouch(ch); savePals(); renderPalChat(); return true; }
    case 'palforget': { const p = PALS.pals[el.dataset.id]; if (p) { p.memory.splice(num(el.dataset.i), 1); palTouch(p); savePals(); renderPalChat(); } return true; }
    case 'palmemadd': { const p = PALS.pals[el.dataset.id]; const v = ($('#palMemAdd')?.value || '').trim(); if (p && v) { p.memory = arr(p.memory); p.memory.push(v); palTouch(p); savePals(); renderPalChat(); } return true; }
    case 'palmemnow': if (ch) palMemory(ch, true); return true;
    case 'palclear': { if (!ch) return true; if (S.palClearArm !== ch.id) { S.palClearArm = ch.id; toast('Tap Clear again to delete every message in this chat. Memories are kept.'); return true; } ch.messages = []; ch.summary = ''; palTouch(ch); savePals(); S.palMenu = false; renderPalChat(); return true; }
  }
  return false;
}
function palModalHTML(kind) {
  if (kind === 'palme') return ['About you', `<p class="hint" style="margin-top:0">Your companions use this to know who they're talking to.</p>
    <label class="f"><span>Your name</span><input id="pme_name" value="${esc(PALS.me.name || '')}" placeholder="What they call you"></label>
    <label class="f"><span>Pronouns</span><input id="pme_pronouns" value="${esc(PALS.me.pronouns || '')}" placeholder="he/him"></label>
    <label class="f"><span>About you (optional)</span><textarea id="pme_about" rows="3" placeholder="Your job, what you're into, anything you want them to know">${esc(PALS.me.about || '')}</textarea></label>
    <label class="chk"><input type="checkbox" id="pme_adult" ${S.settings.ui.palAdult ? 'checked' : ''}> <span>I'm 18 or older and want 18+ content available (you still turn it on per companion)</span></label>
    <button class="btn gold wide" data-act="palmesave">Save</button>`];
  if (kind === 'palgroup') return ['New group chat', `<p class="hint" style="margin-top:0">Pick two or more companions.</p>
    <div class="palgpick">${allPals().map(p => `<button class="palgp ${S.palPick.includes(p.id) ? 'on' : ''}" data-act="palgpick" data-id="${p.id}">${palAvatar(p)}<b>${esc(p.name)}</b></button>`).join('')}</div>
    <button class="btn gold wide" data-act="palgstart" style="margin-top:10px">Start group chat</button>`];
  return ['', ''];
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset?.pd && S.palDraft) { const k = el.dataset.pd; S.palDraft[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? num(el.value) : el.value; if (k === 'goal' || k === 'stage') renderPalEditor(); }
  else if (el.id === 'palIdea') S.palIdea = el.value;
  else if (el.dataset?.pch && curChat()) { const ch = curChat(); ch[el.dataset.pch] = el.type === 'checkbox' ? el.checked : el.value; palTouch(ch); savePals(); }
  else if (el.id === 'palInput') autoGrow(el);
});
document.addEventListener('change', e => { const el = e.target; if (el.dataset?.pd && S.palDraft && el.tagName === 'SELECT') { S.palDraft[el.dataset.pd] = el.value; if (el.dataset.pd === 'goal' || el.dataset.pd === 'stage') renderPalEditor(); } });
document.addEventListener('keydown', e => {
  if (e.target.id === 'palInput' && e.key === 'Enter' && !e.shiftKey && !isPhone()) { e.preventDefault(); palAction('palsend', e.target); }
});
