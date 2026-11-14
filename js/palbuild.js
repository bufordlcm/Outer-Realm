'use strict';
/* =========================================================================
   The companion builder (step by step), your personas, and the copy-and-paste
   prompts for ChatGPT / Claude that fill a companion, a persona or a D&D
   character sheet straight in (no AI rebuild: the layout is known).
   Every builder step can be written or rewritten by the AI, and everything
   stays editable after saving.
   ========================================================================= */
const PAL_STEPS = [
  { k: 'basics',      l: 'Name & gender',  keys: ['name', 'age', 'sex', 'tagline'] },
  { k: 'personality', l: 'Personality',    keys: ['personality', 'vibes'] },
  { k: 'backstory',   l: 'Backstory',      keys: ['backstory'] },
  { k: 'look',        l: 'Appearance',     keys: ['face', 'body', 'clothing', 'tags'] },
  { k: 'speech',      l: 'Language style', keys: ['speechText', 'speechPerson', 'exText', 'exPerson'] },
  { k: 'voice',       l: 'Voice',          keys: [] },
  { k: 'rel',         l: 'Relationship',   keys: ['userRole'] },
  { k: 'open',        l: 'Opening',        keys: ['scenario', 'greeting'] },
  { k: 'notes',       l: 'Other info',     keys: ['likes', 'notes'] }
];
/* what the AI is asked for, per field */
const PAL_FIELD_SPEC = {
  name: '"name":""', age: '"age":25', sex: '"sex":"female|male"', tagline: '"tagline":"one line that sums them up"',
  personality: '"personality":"3-4 sentences: what they are like, what makes them laugh, what annoys them, their flaws"',
  vibes: `"vibes":["2-4 of: ${PAL_VIBES.join(', ')}"]`,
  backstory: '"backstory":"4-6 sentences: where they come from, their life now, job, family, a secret or two"',
  face: '"face":"1-2 sentences: face shape, eyes, hair, skin, expression, distinctive marks"',
  body: '"body":"1-2 sentences: height, build, posture, tattoos or other details, how they carry themselves"',
  clothing: '"clothing":"1 sentence: what they usually wear"',
  tags: '"tags":"8-14 short comma-separated picture tags that pin down their look for an image model, e.g. 1woman, 27 years old, long auburn hair, green eyes, freckles, athletic build"',
  speechText: '"speechText":"how they TEXT: slang, emojis or none, capitals, pet names, message length"',
  speechPerson: '"speechPerson":"how they TALK in person: pace, accent, favourite phrases, gestures"',
  exText: '"exText":"3 example texts in their voice, one per line"', exPerson: '"exPerson":"3 example spoken lines in their voice, one per line"',
  userRole: '"userRole":"who the player is in their life"',
  scenario: '"scenario":"the situation when they first talk"', greeting: '"greeting":"their first message to the player, in their own voice"',
  likes: '"likes":"likes, dislikes and interests"', notes: '"notes":"other useful details: job, schedule, habits, quirks, people in their life"'
};
const PAL_TEXT_KEYS = ['name', 'tagline', 'personality', 'backstory', 'face', 'body', 'clothing', 'tags', 'speechText', 'speechPerson', 'exText', 'exPerson', 'userRole', 'scenario', 'greeting', 'likes', 'notes', 'limits', 'art'];

function palBlank() {
  return { id: uid(), name: '', age: 25, sex: '', tagline: '', look: '', face: '', body: '', clothing: '', tags: '', outfits: [], outfit: '', personality: '', vibes: [], backstory: '',
    speech: '', speechText: '', speechPerson: '', exText: '', exPerson: '', likes: '', notes: '', userRole: '', personaId: '', feels: {}, scenario: '', greeting: '',
    goal: 'romance', stage: 'stranger', affection: 5, adult: false, intensity: 'balanced', limits: '', art: 'photorealistic, natural light, detailed', memory: [], jokes: [], createdAt: Date.now(), updatedAt: Date.now() };
}
function openPalEditor(id) {
  S.palDraft = id && PALS.pals[id] ? palUpgrade(deep(PALS.pals[id])) : palBlank(); S.palDraftNew = !(id && PALS.pals[id]);
  S.palStep = 0; S.palStepBusy = null; S.view = 'paledit'; renderPalEditor(); window.scrollTo?.(0, 0);
}
const palStepDone = (D, st) => st.k === 'voice' ? !!(D.vPC || D.vDev) : st.k === 'rel' ? !!(D.userRole || D.personaId) : st.keys.filter(k => k !== 'age' && k !== 'sex').some(k => Array.isArray(D[k]) ? D[k].length : String(D[k] || '').trim());
/* keep the rules that follow from age and relationship choices */
function palRules(D) {
  if (palMinor(D)) { D.adult = false; D.goal = 'friends'; if (palStage(D).romance) D.stage = 'friend'; }
  if (D.goal === 'friends' && palStage(D).romance) D.stage = 'close';
}
function renderPalEditor() {
  const D = S.palDraft; if (!D) return renderLibrary();
  const si = clamp(num(S.palStep), 0, PAL_STEPS.length - 1); const st = PAL_STEPS[si]; const busy = S.palStepBusy === st.k;
  const f = (k, label, ph = '', type = 'text') => `<label class="f"><span>${label}</span><input type="${type}" data-pd="${k}" value="${esc(D[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
  const t = (k, label, ph = '', rows = 3) => `<label class="f"><span>${label}</span><textarea rows="${rows}" data-pd="${k}" placeholder="${esc(ph)}">${esc(D[k] || '')}</textarea></label>`;
  const picsOn = S.settings.image.mode !== 'off'; const minor = palMinor(D);
  let body = '';
  if (st.k === 'basics') body = `<div class="kv">${f('name', 'Name', 'Mara')}${f('age', 'Age', '25', 'number')}</div>
      <div class="kv"><label class="f"><span>Gender</span><select data-pd="sex"><option value="">Choose…</option><option value="female" ${D.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${D.sex === 'male' ? 'selected' : ''}>Male</option></select></label>${f('tagline', 'One-line tagline', 'Sarcastic tattoo artist with a soft heart')}</div>`;
  else if (st.k === 'personality') body = `${t('personality', 'Personality', 'What they are like, what makes them laugh, what annoys them, their flaws', 5)}
      <div class="lbl">Personality vibe</div><div class="chips">${PAL_VIBES.map(v => `<button class="chip ${arr(D.vibes).includes(v) ? 'on' : ''}" data-act="palvibe" data-v="${v}">${v}</button>`).join('')}</div>`;
  else if (st.k === 'backstory') body = t('backstory', 'Backstory', 'Where they come from, their life now, job, family, secrets', 8);
  else if (st.k === 'look') body = `<div class="palcols"><div class="palportrait">${D.portrait ? `<button class="plain" data-act="palbzoom">${palAvatar(D, 'palhuge')}</button>` : `<span class="palhuge pavi" style="background:${palColor(D)}">${initial(D.name)}</span>`}
        <button class="btn sm" data-act="palbport" ${!picsOn || !palLook(D) ? 'disabled' : ''}>${icon('image')} ${D.portrait ? 'New version' : 'Make her picture'}</button>
        <button class="btn sm ghost" data-act="palbupload">${icon('upload')} Upload a photo</button>${D.portrait ? '<button class="link" data-act="palbportdel">Remove</button>' : ''}
        <p class="hint">${!picsOn ? 'Turn on pictures in Settings → Images to make one here.' : !palLook(D) ? 'Describe the face or body first.' : 'This is the avatar. An uploaded photo is also used as the reference photo. To keep a face the same in new pictures, open any picture of them you like and tap "Use this picture as the reference".'}</p></div>
      <div class="grow">${t('face', 'Face', 'Face shape, eyes, hair, skin, expression, freckles or scars', 2)}${t('body', 'Body', 'Height, build, posture, tattoos, how they carry themselves', 2)}${t('clothing', 'Usual clothing', 'What they normally wear', 2)}</div></div>
      ${t('tags', 'Locked picture tags (added to every picture so the look stays the same)', '1woman, 27 years old, long auburn hair, green eyes, freckles, athletic build', 2)}
      <div class="row wrap"><button class="btn sm ghost" data-act="palbtags" ${busy ? 'disabled' : ''}>${icon('spark')} Suggest tags from the description</button></div>
      <div class="lbl">Saved outfits</div><p class="hint" style="margin-top:0">Whichever one is marked as worn is used in chats and pictures until you switch. Switch any time from the chat menu.</p>
      <label class="chk"><input type="radio" name="palwear" data-act="palbwear" data-id="" ${!D.outfit ? 'checked' : ''}> <span>Usual clothing (above)</span></label>
      ${arr(D.outfits).map((o, i) => `<div class="outrow"><input type="radio" name="palwear" data-act="palbwear" data-id="${o.id}" ${D.outfit === o.id ? 'checked' : ''} title="Wearing now"><input data-pout="${i}" data-k="name" value="${esc(o.name || '')}" placeholder="Name, e.g. Date night"><input class="grow" data-pout="${i}" data-k="desc" value="${esc(o.desc || '')}" placeholder="What it is: black slip dress, heels, gold hoops"><button class="iconbtn sm" data-act="palboutdel" data-i="${i}" aria-label="Remove">${icon('x')}</button></div>`).join('')}
      <button class="btn sm" data-act="palboutadd">${icon('plus')} Add an outfit</button>
      ${f('art', 'Picture style', 'photorealistic, natural light, detailed')}`;
  else if (st.k === 'speech') body = `<div class="sect" style="margin-top:0;font-size:18px">📱 Texting</div>${t('speechText', 'How they text', 'Lowercase, lots of emojis, short bursts, calls you "trouble"…', 2)}${t('exText', 'Example texts (optional, one per line)', 'omg you will NOT believe my day\nok but are you free saturday or not', 3)}
      <div class="sect" style="font-size:18px">🧍 In person</div>${t('speechPerson', 'How they talk in person', 'Soft voice, dry humour, talks with her hands, slight Southern accent…', 2)}${t('exPerson', 'Example spoken lines (optional, one per line)', 'Well, look what the cat dragged in.\nYou always do that thing with your eyebrow when you lie.', 3)}
      <p class="hint">Examples are optional. With them, the AI copies the style and rhythm; without them it works from the description alone.</p>`;
  else if (st.k === 'voice') {
    const fld = engine() === 'pc' ? 'vPC' : 'vDev';
    body = voiceOn() ? `<label class="f"><span>${esc(D.name || 'Their')} voice</span>${voicePickerHTML('data-pdvoice="1"', D[fld] || '', D.sex === 'male' ? 'm' : D.sex === 'female' ? 'f' : '')}</label>
      <div class="row wrap"><button class="btn sm" data-act="palbvoicetest">${icon('speaker')} Hear it</button></div>
      <p class="hint">Automatic picks a ${D.sex === 'male' ? 'male' : 'female'} voice from their gender and keeps it. ${engine() === 'pc' ? 'These are the natural voices from the helper on your PC.' : 'These are this device\'s built-in voices; natural PC voices appear here when the helper is running.'}</p>`
      : '<p class="hint">Voices are switched off. Turn narration on in Game Settings → Sound to pick a voice here.</p>';
  } else if (st.k === 'rel') body = `${t('userRole', 'Who you are to them', 'e.g. my neighbor I keep running into; my best friend since college; a stranger who matched with me', 2)}
      <label class="f"><span>Which of your personas they talk to</span><select data-pd="personaId"><option value="">Your default persona${PALS.personas[PALS.defaultPersona] ? ' (' + esc(PALS.personas[PALS.defaultPersona].name) + ')' : ''}</option>${allPersonas().map(x => `<option value="${x.id}" ${D.personaId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <p class="hint"><button class="link" data-act="palme">Manage your personas</button></p>
      ${minor ? `<p class="hint" style="color:var(--gold2)">${esc(D.name || 'They')} ${num(D.age) && num(D.age) < 18 ? `is ${num(D.age)}` : 'is described as under 18'}, so this is a platonic relationship: friends, family, teammates or mentoring. Romance and 18+ are off.</p>` : ''}
      <label class="f"><span>Where it can go</span><select data-pd="goal" ${minor ? 'disabled' : ''}>${Object.entries(PAL_GOALS).filter(([k]) => !minor || k === 'friends').map(([k, l]) => `<option value="${k}" ${D.goal === k || minor ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f"><span>Where you start</span><select data-pd="stage">${PAL_STAGES.filter(s => (D.goal !== 'friends' && !minor) || !s.romance).map(s => `<option value="${s.k}" ${D.stage === s.k ? 'selected' : ''}>${s.l}</option>`).join('')}</select></label>
      <p class="hint">${esc(palStage(D).d)} The relationship moves on its own as you talk.</p>
      <label class="f"><span>Intensity</span><select data-pd="intensity"><option value="gentle" ${D.intensity === 'gentle' ? 'selected' : ''}>Gentle: soft and slow</option><option value="balanced" ${D.intensity !== 'gentle' && D.intensity !== 'bold' ? 'selected' : ''}>Balanced</option><option value="bold" ${D.intensity === 'bold' ? 'selected' : ''}>Bold: intense, takes initiative</option></select></label>
      ${t('limits', 'Hard limits (they will never go here)', 'Anything you never want in your chats, one per line', 2)}
      ${palFeelsHTML(D)}
      ${minor ? '' : `<label class="chk"><input type="checkbox" data-pd="adult" ${D.adult ? 'checked' : ''}> <span>Allow 18+ content with this companion</span></label>`}`;
  else if (st.k === 'open') body = `${t('scenario', 'How it starts', 'e.g. We matched on a dating app last night', 3)}${t('greeting', 'Their first message', 'The AI writes one if you leave it empty', 3)}`;
  else body = `${t('likes', 'Likes, dislikes and interests', '', 3)}${t('notes', 'Anything else', 'Job, schedule, habits, pets, people in their life, things they would never do…', 5)}`;

  const aiRow = st.keys.length ? `<div class="aistep"><button class="btn sm gold" data-act="palbai" ${busy || S.palBuilding ? 'disabled' : ''}>${busy ? '<span class="spin sm"></span> Writing…' : icon('spark') + ' Write this step for me'}</button>
      <input id="palStepAsk" placeholder="Or say what to change: make her more sarcastic, give her a Texas accent…" value="${esc(S.palStepAsk || '')}"><button class="btn sm" data-act="palbai" data-rw="1" ${busy || S.palBuilding ? 'disabled' : ''}>${icon('redo')} Rewrite</button></div>` : '';
  app().innerHTML = `<div class="home">${topNavHTML('pals')}<main class="hmain palform">
    <div class="row"><button class="btn sm ghost" data-act="palback">${icon('back')} Back</button><h2 style="margin:0 0 0 6px;flex:1">${S.palDraftNew ? 'New companion' : 'Edit ' + esc(D.name)}</h2><button class="btn sm gold" data-act="palsave">${icon('check')} Save${S.palDraftNew ? ' & chat' : ''}</button></div>
    <details class="card qstart" ${S.palDraftNew && !D.name || S.palBuilding ? 'open' : ''}><summary><b>Quick start</b> <span class="hint" style="margin:0">Draft every step from one idea, or paste a finished character</span></summary>
      <textarea id="palIdea" rows="4" placeholder="e.g. Mara, 27, a sarcastic tattoo artist with a soft heart who pretends she doesn't care, lives above her shop in the city…  Or paste a character written with the prompt below.">${esc(S.palIdea || '')}</textarea>
      <div class="row wrap" style="margin-top:8px"><button class="btn gold" data-act="palai" ${S.palBuilding ? 'disabled' : ''}>${S.palBuilding ? `<span class="spin sm"></span> Drafting every step… <span class="buildsecs"></span>` : icon('spark') + ' Draft every step with AI'}</button><button class="btn sm ghost" data-act="palfill">Fill in from pasted text</button><button class="btn sm ghost" data-act="palcopy" data-k="prompt">Copy a prompt for ChatGPT / Claude</button><button class="btn sm ghost" data-act="palcopy" data-k="template">Copy the blank template</button></div>
      <p class="hint">A character written with the prompt fills every step straight away when you paste it, with no AI rebuild. Then edit any step.</p></details>
    <div class="steps">${PAL_STEPS.map((x, i) => `<button class="stepchip ${i === si ? 'on' : ''} ${palStepDone(D, x) ? 'done' : ''}" data-act="palbstep" data-i="${i}"><i>${i + 1}</i>${x.l}</button>`).join('')}</div>
    <div class="card stepcard"><div class="sect" style="margin-top:0">${si + 1}. ${st.l}</div>${body}${aiRow}</div>
    <div class="row" style="margin-bottom:30px"><button class="btn" data-act="palbstep" data-i="${si - 1}" ${si === 0 ? 'disabled' : ''}>${icon('back')} Back</button><span class="grow"></span>
      ${!S.palDraftNew ? `<button class="btn ghost" data-act="paldelete" data-id="${D.id}">${icon('trash')} Delete</button>` : ''}
      ${si < PAL_STEPS.length - 1 ? `<button class="btn gold" data-act="palbstep" data-i="${si + 1}">Next: ${PAL_STEPS[si + 1].l} ›</button>` : `<button class="btn gold" data-act="palsave">${icon('check')} Save${S.palDraftNew ? ' and start chatting' : ''}</button>`}</div>
  </main></div>`;
  buildTimer();
}
function palValidate(D) {
  if (!String(D.name || '').trim()) return [0, 'Give them a name.'];
  if (!num(D.age)) return [0, 'Fill in their age.'];
  if (D.sex !== 'male' && D.sex !== 'female') return [0, 'Choose their gender.'];
  return null;
}
function palApplyAI(D, j, keys) {
  for (const k of keys) {
    if (j[k] == null || j[k] === '') continue;
    if (k === 'age') { const a = parseInt(String(j.age).match(/\d+/)?.[0], 10); if (a) D.age = a; }   /* keep the real age so the under-18 rules apply */
    else if (k === 'sex') { const s = String(j.sex).toLowerCase(); if (/^(f|woman|girl)/.test(s)) D.sex = 'female'; else if (/^(m|man|boy|guy)/.test(s)) D.sex = 'male'; }
    else if (k === 'vibes') { const v = arr(Array.isArray(j.vibes) ? j.vibes : String(j.vibes).split(/[,;/|]/)).map(x => String(x).trim().toLowerCase()).filter(x => PAL_VIBES.includes(x)); if (v.length) D.vibes = v.slice(0, 4); }
    else D[k] = (Array.isArray(j[k]) ? j[k].join(k === 'tags' ? ', ' : '\n') : String(j[k])).trim().slice(0, 1500);
  }
  if (D.speechText) D.speech = D.speechText;
  D.look = palLook(D); palRules(D);
}
const palCard = (D, skip = []) => PAL_STEPS.flatMap(s => s.keys).filter(k => !skip.includes(k)).map(k => { const v = Array.isArray(D[k]) ? D[k].join(', ') : String(D[k] ?? '').trim(); return v ? `${k}: ${v}` : ''; }).filter(Boolean).join('\n');
async function palAIBuild() {
  const D = S.palDraft; const idea = ($('#palIdea')?.value || S.palIdea || '').trim(); if (!idea) return toast('Describe your companion or paste one first.');
  if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  const keys = PAL_STEPS.flatMap(s => s.keys); const me = personaOf(null, D);
  S.palIdea = idea; S.palBuilding = Date.now(); renderPalEditor();
  try {
    const raw = await chat([
      { role:'system', content:`You create characters for an AI companion and roleplay app. From the player's idea, or from a finished character they pasted (keep every detail it gives), write a vivid, specific, believable character who feels like a real person with their own life, opinions and voice. The character is an adult (18+). Gender is "female" or "male". Reply with ONLY this JSON:\n{${keys.map(k => PAL_FIELD_SPEC[k]).join(',')}}` },
      { role:'user', content: idea + (me?.name ? `\n\n(The player's name is ${me.name}.)` : '') }
    ], { build:true, stream:false, maxTokens:2800, temperature:0.85, json:true });
    const j = tryJSON(stripThink(raw)); if (!j) throw new Error('the AI reply wasn\'t usable, try again');
    palApplyAI(D, j, keys);
    toast('Every step is drafted. Go through them and change anything.');
  } catch (e) { toast('Build failed: ' + e.message, 6000); }
  S.palBuilding = 0; if (S.view === 'paledit') renderPalEditor();
}
/* write or rewrite one step, in keeping with everything already decided */
async function palAIStep(rewrite, onlyKeys) {
  const D = S.palDraft; const st = PAL_STEPS[clamp(num(S.palStep), 0, PAL_STEPS.length - 1)]; if (!D || S.palStepBusy) return;
  if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  const keys = onlyKeys || st.keys; if (!keys.length) return;
  const ask = rewrite ? ($('#palStepAsk')?.value || '').trim() : '';
  if (rewrite && !ask) { toast('Type what you want changed first.'); $('#palStepAsk')?.focus(); return; }
  const now = keys.map(k => { const v = Array.isArray(D[k]) ? D[k].join(', ') : String(D[k] ?? '').trim(); return v ? `${k}: ${v}` : ''; }).filter(Boolean).join('\n');
  S.palStepBusy = st.k; S.palStepAsk = ask; renderPalEditor();
  try {
    const raw = await chat([
      { role:'system', content:`You are helping build one character for an AI companion and roleplay app, a step at a time. Write ONLY the fields asked for, so that they fit everything already decided about this character. Be specific and vivid, never generic. The character is an adult (18+). Gender is "female" or "male". Reply with ONLY this JSON:\n{${keys.map(k => PAL_FIELD_SPEC[k]).join(',')}}` },
      { role:'user', content:`THE CHARACTER SO FAR:\n${palCard(D, keys) || '(nothing yet: invent someone interesting)'}${(S.palIdea || '').trim() ? `\n\nTHE PLAYER'S ORIGINAL IDEA: ${S.palIdea.trim().slice(0, 1200)}` : ''}\n\nSTEP TO WRITE: ${st.l}${now ? `\nWHAT IS THERE NOW:\n${now}` : ''}${ask ? `\n\nTHE PLAYER WANTS THIS CHANGE: ${ask}\nKeep what they did not ask to change.` : now ? '\n\nImprove and complete it; keep the facts the player already wrote.' : ''}` }
    ], { build:true, stream:false, maxTokens:900, temperature:0.85, json:true });
    const j = tryJSON(stripThink(raw)); if (!j) throw new Error('the AI reply wasn\'t usable, try again');
    palApplyAI(D, j, keys); S.palStepAsk = '';
  } catch (e) { toast('That didn\'t work: ' + e.message, 6000); }
  S.palStepBusy = null; if (S.view === 'paledit') { const y = scrollY; renderPalEditor(); scrollTo(0, y); }
}
function palSave() {
  const D = S.palDraft; const bad = palValidate(D); if (bad) { S.palStep = bad[0]; renderPalEditor(); return toast(bad[1], 5000); }
  D.age = Math.max(1, Math.round(num(D.age))); D.look = palLook(D); D.speech = D.speechText || D.speech || '';
  D.outfits = arr(D.outfits).filter(o => String(o.name || o.desc || '').trim()); if (!D.outfits.some(o => o.id === D.outfit)) D.outfit = '';
  palRules(D);
  if (D.goal === 'open') { D.stage = 'partner'; D.affection = Math.max(num(D.affection), 93); }
  else D.affection = Math.max(num(D.affection), palStage(D).at);
  palTouch(D); const isNew = S.palDraftNew; PALS.pals[D.id] = D; savePals();
  S.palDraft = null; S.palIdea = '';
  if (isNew) palStartChat([D.id]); else { S.homeTab = 'pals'; renderLibrary(); toast(`${D.name} saved.`); }
}
function palPortraitPrompt(D) { return [D.tags, `portrait photo of ${palLook(D)}`, palOutfit(D) && `wearing ${palOutfit(D)}`, D.tagline, 'head and shoulders, looking at the camera, expressive face, detailed'].map(s => String(s || '').trim()).filter(Boolean).join(', ').replace(/\s+/g, ' ').slice(0, 600); }
/* a photo you upload is shrunk and kept inside the companion's card, so it syncs with everything else */
function palUploadPortrait() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const file = inp.files[0]; const D = S.palDraft; if (!file || !D) return;
    try {
      const img = new Image(); img.src = URL.createObjectURL(file); await img.decode();
      const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight)); const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      D.portrait = { data: cv.toDataURL('image/jpeg', 0.82), uploaded: true }; URL.revokeObjectURL(img.src);
      if (S.view === 'paledit') renderPalEditor();
    } catch (e) { toast('Couldn\'t read that picture: ' + e.message, 5000); }
  };
  inp.click();
}

function palBuildAction(act, el) {
  const D = S.palDraft;
  switch (act) {
    case 'palback': S.palDraft = null; S.homeTab = 'pals'; renderLibrary(); return true;
    case 'palbstep': { const i = num(el.dataset.i); if (i >= 0 && i < PAL_STEPS.length) { S.palStep = i; S.palStepAsk = ''; renderPalEditor(); $('.steps')?.scrollIntoView({ block: 'start' }); } return true; }
    case 'palvibe': { const v = el.dataset.v; if (!D || !v) return true; D.vibes = arr(D.vibes).includes(v) ? D.vibes.filter(x => x !== v) : [...arr(D.vibes), v].slice(0, 5); const y = scrollY; renderPalEditor(); scrollTo(0, y); return true; }
    case 'palbport': if (D && palLook(D)) { D.portrait = { prompt: palPortraitPrompt(D), seed: d(999999), subj: { t: 'pal', id: D.id, port: true } }; const y = scrollY; renderPalEditor(); scrollTo(0, y); } return true;
    case 'palbportdel': if (D) { delete D.portrait; const y = scrollY; renderPalEditor(); scrollTo(0, y); } return true;
    case 'palbupload': palUploadPortrait(); return true;
    case 'palbzoom': if (D?.portrait) openLightbox(palImg(D.portrait, D), D.name, D.portrait.prompt ? { prompt: D.portrait.prompt } : null); return true;
    case 'palbtags': palAIStep(false, ['tags']); return true;
    case 'palbai': palAIStep(!!el.dataset.rw); return true;
    case 'palboutadd': if (D) { D.outfits = [...arr(D.outfits), { id: uid(), name: '', desc: '' }]; const y = scrollY; renderPalEditor(); scrollTo(0, y); } return true;
    case 'palboutdel': if (D) { const o = arr(D.outfits)[num(el.dataset.i)]; D.outfits = arr(D.outfits).filter(x => x !== o); if (D.outfit === o?.id) D.outfit = ''; const y = scrollY; renderPalEditor(); scrollTo(0, y); } return true;
    case 'palbwear': if (D) D.outfit = el.dataset.id || ''; return true;
    case 'palbvoicetest': if (D) speak(`${D.name || 'Hi'} here. This is how I sound.`, voiceOf(palCtx(D), D, D.name)); return true;
    case 'palai': palAIBuild(); return true;
    case 'palcopy': palCopy(el.dataset.k); return true;
    case 'palfill': palFillFromPaste(true); return true;
    case 'palsave': palSave(); return true;
    /* personas */
    case 'palme': S.perEdit = null; openModal('palme'); return true;
    case 'palpernew': S.perEdit = { id: uid(), name: '', sex: '', about: '', look: '', isNew: true }; S.perIdea = ''; renderModal(); return true;
    case 'palperedit': { const x = PALS.personas[el.dataset.id]; if (x) { S.perEdit = deep(x); S.perIdea = ''; renderModal(); } return true; }
    case 'palpercancel': S.perEdit = null; renderModal(); return true;
    case 'palperdefault': if (PALS.personas[el.dataset.id]) { PALS.defaultPersona = el.dataset.id; savePals(); renderModal(); } return true;
    case 'palperdel': { const x = PALS.personas[el.dataset.id]; if (x && confirm(`Delete the persona "${x.name}"? Chats that used it go back to your default.`)) { PALS.deleted[x.id] = Date.now(); delete PALS.personas[x.id]; if (PALS.defaultPersona === x.id) PALS.defaultPersona = allPersonas()[0]?.id || ''; savePals(); renderModal(); } return true; }
    case 'palpersave': {
      const P = S.perEdit; if (!P) return true; perRead(P);
      if (!P.name) { toast('Give this persona a name.'); return true; }
      const isNew = P.isNew; delete P.isNew; P.createdAt = P.createdAt || Date.now(); palTouch(P); PALS.personas[P.id] = P;
      if (isNew && !PALS.personas[PALS.defaultPersona]) PALS.defaultPersona = P.id;
      savePals(); S.perEdit = null; renderModal(); toast('Persona saved.'); return true;
    }
    case 'palperai': personaAI(); return true;
    case 'palperfill': personaFill(true); return true;
    case 'palpercopy': copyText(PERSONA_PROMPT, 'Prompt copied. Paste it into ChatGPT or Claude, add your idea, then paste what it writes back here.'); return true;
  }
  return false;
}

/* typing in the builder */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'palIdea') { S.palIdea = el.value; return; }
  if (el.id === 'palStepAsk') { S.palStepAsk = el.value; return; }
  if (el.id === 'perIdea') { S.perIdea = el.value; return; }
  if (el.dataset.pd && S.palDraft) S.palDraft[el.dataset.pd] = el.type === 'checkbox' ? el.checked : el.value;
  else if (el.dataset.pout && S.palDraft) { const o = arr(S.palDraft.outfits)[num(el.dataset.pout)]; if (o) o[el.dataset.k] = el.value.slice(0, 300); }
});
/* things that change what the editor shows (age, gender, goal, 18+) redraw it when you finish with the field */
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.pd && S.palDraft && S.view === 'paledit') {
    if (el.type === 'checkbox') S.palDraft[el.dataset.pd] = el.checked;
    if (['age', 'sex', 'face', 'body', 'backstory', 'tagline', 'goal', 'stage', 'adult', 'personality', 'scenario', 'userRole', 'notes', 'name'].includes(el.dataset.pd)) { palRules(S.palDraft); const y = scrollY; renderPalEditor(); scrollTo(0, y); }
  } else if (el.dataset.pdvoice && S.palDraft) {
    const D = S.palDraft; const fld = engine() === 'pc' ? 'vPC' : 'vDev'; if (el.value) D[fld] = el.value; else delete D[fld]; if (fld === 'vDev') D.ttsVoice = el.value;
    speak(`${D.name || 'Hi'} here. This is how I sound.`, voiceOf(palCtx(D), D, D.name));
  }
});

/* =========================================================================
   PASTE TO FILL: a companion written in ChatGPT / Claude with the template
   ========================================================================= */
const PAL_TEMPLATE = `<Name>
Age: <number>
Gender: <female | male>
Tagline: <one line that sums them up>
Vibes: <2-4 of: ${PAL_VIBES.join(', ')}>
Personality: <3-4 sentences: what they're like, what makes them laugh, what annoys them, their flaws>
Backstory: <4-6 sentences: where they come from, their life now, job, family, a secret or two>
Face: <1-2 sentences: face shape, eyes, hair, skin, expression, distinctive marks>
Body: <1-2 sentences: height, build, posture, tattoos, how they carry themselves>
Clothing: <what they usually wear>
Picture tags: <8-14 short comma-separated tags that pin down their look, e.g. 1woman, 27 years old, long auburn hair, green eyes>
Texting style: <how they text: slang, emojis or none, capitals, pet names, message length>
Texting examples: <3 example texts in their voice, separated by " / ">
In person style: <how they talk face to face: pace, accent, favourite phrases, gestures>
In person examples: <3 example spoken lines, separated by " / ">
Who I am to them: <who I am in their life>
Where it can go: <friends | romance | together>
Where we start: <strangers | acquaintances | friends | close friends | something more | dating | partners>
Intensity: <gentle | balanced | bold>
Hard limits: <anything that must never happen in our chats, or leave blank>
18+: <yes | no>
How it starts: <the situation when we first talk>
First message: <their first message to me, in character>
Likes: <likes, dislikes and interests>
Other info: <job, schedule, habits, people in their life, anything else>
Picture style: <e.g. photorealistic, natural light, detailed>`;
const PAL_PROMPT = `You are an expert character writer for an AI companion and roleplay app. Create one companion character for me from my idea:

[DESCRIBE WHO YOU WANT HERE: who they are, their vibe, how they know me, anything that must be true about them]

Rules:
- Follow the template below EXACTLY: their name alone on the first line, then the same "Key: value" lines in the same order, each on one line.
- Make them feel like a real person with their own life, opinions, flaws and a distinct voice. Be specific and vivid, no generic filler.
- "Face", "Body", "Clothing" and "Picture tags" must be concrete and visual, since they are used to draw their pictures.
- The examples and "First message" are written in their own voice, the way they would actually text or speak.
- Never decide what I say, do, think or feel.
- Any romantic or sexual content involves adults (18 or older) only.
- Output ONLY the filled-in template as plain text. No commentary before or after.

TEMPLATE:

${PAL_TEMPLATE}`;

const PAL_TPL_KEYS = {
  name:'name', age:'age', gender:'sex', sex:'sex', tagline:'tagline', 'one-line tagline':'tagline', vibes:'vibes', vibe:'vibes', 'personality vibe':'vibes',
  look:'look', looks:'look', appearance:'look', face:'face', body:'body', clothing:'clothing', clothes:'clothing', outfit:'clothing', 'usual clothing':'clothing',
  'picture tags':'tags', 'image tags':'tags', tags:'tags', personality:'personality',
  'how they talk':'speechText', speech:'speechText', 'texting style':'speechText', 'how they text':'speechText', 'texting examples':'exText', 'example texts':'exText',
  'in person style':'speechPerson', 'in-person style':'speechPerson', 'how they talk in person':'speechPerson', 'in person examples':'exPerson', 'in-person examples':'exPerson',
  backstory:'backstory', background:'backstory', likes:'likes', interests:'likes', 'likes, dislikes and interests':'likes', 'other info':'notes', notes:'notes', other:'notes',
  'who i am to them':'userRole', 'who you are to them':'userRole', 'how it starts':'scenario', scenario:'scenario',
  'first message':'greeting', 'their first message':'greeting', greeting:'greeting', 'where it can go':'goal', goal:'goal',
  'where we start':'stage', 'where you start':'stage', stage:'stage', intensity:'intensity',
  'hard limits':'limits', limits:'limits', '18+':'adult', adult:'adult', 'picture style':'art', 'art style':'art'
};
/* read "Key: value" text; returns null if it isn't in that shape */
function parseKeyed(text, keys, minFilled = 3) {
  const out = {}; let key = null; let firstLine = true;
  for (const raw of String(text).replace(/\r/g, '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(/^(?:[-*]\s*)?\**([A-Za-z0-9+ ,'\-]{2,40}?)\**\s*:\s*(.*)$/);
    const k = m && keys[m[1].trim().toLowerCase()];
    if (k) { key = k; out[k] = m[2].replace(/^\*+\s*/, '').trim(); }
    else if (firstLine && !key && line.length <= 70) {          /* the name alone on the first line, or a heading like "### Companion: Nadia" */
      const nm = line.replace(/^#+\s*/, '').replace(/^(?:companion|character|persona)\s*\d*\s*[:\-–—]\s*/i, '').replace(/[*_]/g, '').trim();
      if (nm && !/^<.*>$/.test(nm)) out.name = nm;
    }
    else if (key) out[key] += (out[key] ? '\n' : '') + line;
    firstLine = false;
  }
  const filled = Object.keys(out).filter(k => k !== 'name' && String(out[k]).trim()).length;
  return out.name && filled >= minFilled ? out : null;
}
const palParseTemplate = text => parseKeyed(text, PAL_TPL_KEYS, 3);
/* put parsed fields into the companion being edited */
function palApplyFields(D, j) {
  const val = v => String(v ?? '').replace(/^<.*>$/s, '').trim();
  const unq = v => v.replace(/^["“](.*)["”]$/s, '$1').trim();
  if (val(j.name)) D.name = val(j.name).slice(0, 80);
  for (const k of ['tagline','face','body','clothing','tags','personality','speechText','speechPerson','backstory','likes','notes','userRole','scenario','limits','art']) if (val(j[k])) D[k] = val(j[k]).slice(0, 1500);
  for (const k of ['exText','exPerson']) if (val(j[k])) D[k] = val(j[k]).split(/\s+\/\s+|\n/).map(s => unq(s.trim())).filter(Boolean).join('\n').slice(0, 1500);
  if (val(j.look) && !val(j.face) && !val(j.body)) { D.body = val(j.look).slice(0, 1500); D.face = ''; }
  if (val(j.greeting)) D.greeting = unq(val(j.greeting)).slice(0, 1500);
  const sx = val(j.sex).toLowerCase();
  if (sx) D.sex = /^(f|woman|girl)/.test(sx) ? 'female' : /^(m|man|boy|guy)/.test(sx) ? 'male' : D.sex;
  const age = parseInt(val(j.age).match(/\d+/)?.[0], 10); if (age) D.age = age;   /* keep the real age so the under-18 safeguards apply */
  const vibes = val(j.vibes).split(/[,;/|]/).map(v => v.trim().toLowerCase()).filter(v => PAL_VIBES.includes(v));
  if (vibes.length) D.vibes = vibes.slice(0, 4);
  const g = val(j.goal).toLowerCase();
  if (g) D.goal = /together|open|partner|already/.test(g) ? 'open' : /romance|more|love|dat/.test(g) ? 'romance' : /friend/.test(g) ? 'friends' : D.goal;
  const st = val(j.stage).toLowerCase().replace(/s$/, '');
  if (st) { const hit = PAL_STAGES.find(s => s.k === st || s.l.toLowerCase().replace(/s$/, '') === st) || (st.includes('close') ? PAL_STAGES.find(s => s.k === 'close') : null); if (hit) D.stage = hit.k; }
  const it = val(j.intensity).toLowerCase(); if (['gentle','balanced','bold'].includes(it)) D.intensity = it;
  if (val(j.adult)) D.adult = /^(y|yes|true|on|allow)/i.test(val(j.adult));
  D.speech = D.speechText || D.speech || ''; D.look = palLook(D);
  palRules(D);   /* same rules the editor applies when these fields change */
}
function palFillFromPaste(asked) {
  const D = S.palDraft; const text = ($('#palIdea')?.value || S.palIdea || '').trim(); if (!D) return false;
  if (!text) { if (asked) toast('Paste a character into the Quick start box first.'); return false; }
  const j = palParseTemplate(text);
  if (!j) { if (asked) toast('That isn\'t in the template\'s "Key: value" shape. Tap Draft every step with AI to sort it instead.', 6000); return false; }
  palApplyFields(D, j); S.palIdea = ''; S.palStep = 0;
  renderPalEditor();
  toast(`Filled in ${D.name || 'your companion'}. Go through the steps and save.`);
  return true;
}
function copyText(t, okMsg, onFail) {
  const fail = () => { if (onFail) onFail(); else toast('Couldn\'t copy on this device.', 4000); };
  try { navigator.clipboard.writeText(t).then(() => toast(okMsg, 4500), fail); } catch { fail(); }
}
function palCopy(k) {
  const t = k === 'template' ? PAL_TEMPLATE : PAL_PROMPT;
  copyText(t, k === 'template' ? 'Template copied.' : 'Prompt copied. Paste it into ChatGPT or Claude and replace the idea line.',
    () => { S.palIdea = t; const y = scrollY; renderPalEditor(); scrollTo(0, y); toast('Couldn\'t copy: it\'s in the Quick start box, select it and copy.', 5000); });
}
/* pasting a template-shaped character or persona fills the fields right away */
document.addEventListener('paste', e => {
  const id = e.target?.id;
  if (id === 'palIdea' && S.view === 'paledit') setTimeout(() => { S.palIdea = $('#palIdea')?.value || ''; palFillFromPaste(false); }, 0);
  else if (id === 'perIdea') setTimeout(() => { S.perIdea = $('#perIdea')?.value || ''; personaFill(false); }, 0);
  else if (e.target?.dataset?.dpath === 'concept' && S.view === 'new') setTimeout(() => { if (S.draft) { S.draft.concept = e.target.value; charFillFromPaste(false); } }, 0);
});

/* =========================================================================
   PERSONAS: the versions of you that companions talk to
   ========================================================================= */
const PERSONA_TEMPLATE = `<Name>
Gender: <male | female>
About me: <3-5 sentences: who I am, my job, my life, what I'm like, what I'm into>
Appearance: <1-2 sentences: face, hair, build, how I dress. Used when I appear in pictures.>`;
const PERSONA_PROMPT = `Write a short profile of ME, the user, for an AI companion app. The characters I talk to will read it so they know who I am. Use my idea:

[DESCRIBE YOURSELF OR THE PERSON YOU WANT TO PLAY HERE]

Rules:
- Follow the template below EXACTLY: the name alone on the first line, then the same "Key: value" lines, each on one line.
- Write in the first person ("I"). Specific and natural, no filler.
- Output ONLY the filled-in template as plain text.

TEMPLATE:

${PERSONA_TEMPLATE}`;
const PERSONA_KEYS = { name:'name', gender:'sex', sex:'sex', 'about me':'about', about:'about', bio:'about', appearance:'look', look:'look', looks:'look' };
function perRead(P) { const g = id => ($('#' + id)?.value || '').trim(); if ($('#per_name')) { P.name = g('per_name').slice(0, 60); P.sex = g('per_sex'); P.about = g('per_about').slice(0, 1500); P.look = g('per_look').slice(0, 600); } return P; }
function personaApply(P, j) {
  const val = v => String(v ?? '').replace(/^<.*>$/s, '').trim();
  if (val(j.name)) P.name = val(j.name).slice(0, 60);
  const s = val(j.sex).toLowerCase(); if (/^(m|man|boy|guy)/.test(s)) P.sex = 'male'; else if (/^(f|woman|girl)/.test(s)) P.sex = 'female';
  if (val(j.about)) P.about = val(j.about).slice(0, 1500);
  if (val(j.look)) P.look = val(j.look).slice(0, 600);
}
function personaFill(asked) {
  const P = S.perEdit; const text = ($('#perIdea')?.value || S.perIdea || '').trim(); if (!P) return false;
  if (!text) { if (asked) toast('Paste the profile into the box first.'); return false; }
  const j = parseKeyed(text, PERSONA_KEYS, 1);
  if (!j) { if (asked) toast('That isn\'t in the template\'s shape. Tap Write it for me to have the AI sort it.', 5000); return false; }
  perRead(P); personaApply(P, j); S.perIdea = ''; renderModal(); toast('Filled in. Check it and save.'); return true;
}
async function personaAI() {
  const P = S.perEdit; if (!P || S.perBusy) return; perRead(P);
  const idea = ($('#perIdea')?.value || '').trim(); if (!idea && !P.name && !P.about) return toast('Describe yourself in a line first.');
  if (!textReady()) return toast('Set up an AI first (Settings → Story AI).');
  S.perBusy = true; S.perIdea = idea; renderModal();
  try {
    const raw = await chat([
      { role:'system', content:'Write a short profile of the USER of an AI companion app, from their idea. First person ("I"), specific and natural. Keep everything they stated; only fill in what is missing. Gender is "male" or "female". Reply with ONLY this JSON: {"name":"","sex":"male|female","about":"3-5 sentences: who I am, my job, my life, what I\'m like, what I\'m into","look":"1-2 sentences: face, hair, build, how I dress"}' },
      { role:'user', content:`IDEA: ${idea || '(use what is filled in below)'}\n\nALREADY FILLED IN:\nname: ${P.name}\ngender: ${P.sex}\nabout: ${P.about}\nlook: ${P.look}` }
    ], { build:true, stream:false, maxTokens:600, temperature:0.8, json:true });
    const j = tryJSON(stripThink(raw)); if (!j) throw new Error('the AI reply wasn\'t usable, try again');
    personaApply(P, j); S.perIdea = '';
  } catch (e) { toast('That didn\'t work: ' + e.message, 5000); }
  S.perBusy = false; if (S.modal === 'palme') renderModal();
}
function personaModalHTML() {
  const P = S.perEdit;
  if (P) return [P.isNew ? 'New persona' : 'Edit persona', `<div class="card" style="border-color:#5b4519"><textarea id="perIdea" rows="2" placeholder="Describe yourself in a line, or paste a profile written with the prompt…">${esc(S.perIdea || '')}</textarea>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm gold" data-act="palperai" ${S.perBusy ? 'disabled' : ''}>${S.perBusy ? '<span class="spin sm"></span> Writing…' : icon('spark') + ' Write it for me'}</button><button class="btn sm ghost" data-act="palperfill">Fill in from pasted text</button><button class="btn sm ghost" data-act="palpercopy">Copy a prompt for ChatGPT / Claude</button></div></div>
    <div class="kv"><label class="f"><span>Name (what they call you)</span><input id="per_name" value="${esc(P.name || '')}"></label><label class="f"><span>Gender</span><select id="per_sex"><option value="">Choose…</option><option value="male" ${P.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${P.sex === 'female' ? 'selected' : ''}>Female</option></select></label></div>
    <label class="f"><span>About you</span><textarea id="per_about" rows="5" placeholder="Your job, your life, what you're into, anything you want them to know">${esc(P.about || '')}</textarea></label>
    <label class="f"><span>Appearance (used when you are in a picture)</span><textarea id="per_look" rows="2" placeholder="Tall, short brown hair, beard, usually in a flannel shirt and jeans">${esc(P.look || '')}</textarea></label>
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="palpersave">${icon('check')} Save persona</button><button class="btn ghost" data-act="palpercancel">Cancel</button></div>`];
  const list = allPersonas();
  return ['Your personas', `<p class="hint">A persona is a version of you: your name, who you are and how you look. Make as many as you like. Each companion talks to the one chosen in her card (Relationship step), and you can switch per chat from the chat menu.</p>
    ${list.map(x => `<div class="memitem ${PALS.defaultPersona === x.id ? 'pinned' : ''}"><div class="mt"><b>${esc(x.name)}</b>${sexWord(x) ? ` · ${sexWord(x)}` : ''}${PALS.defaultPersona === x.id ? ' · default' : ''}<small>${esc(String(x.about || 'No description yet.').slice(0, 140))}</small></div><div class="ma">${PALS.defaultPersona === x.id ? '' : `<button data-act="palperdefault" data-id="${x.id}" title="Make default">★</button>`}<button data-act="palperedit" data-id="${x.id}" title="Edit">✎</button><button data-act="palperdel" data-id="${x.id}" title="Delete">🗑</button></div></div>`).join('') || '<p class="hint" style="color:var(--ink)">No personas yet. Until you make one, companions don\'t know your name.</p>'}
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="palpernew">${icon('plus')} New persona</button></div>`];
}

/* =========================================================================
   D&D CHARACTER: a copy-ready prompt, and a pasted sheet that fills itself in
   ========================================================================= */
const CHAR_TEMPLATE = `Name: <name>
Gender: <male | female>
Story role: <a label that fits the world: house, rank, guild, post or job. Not a game class>
Appearance: <one or two vivid sentences. Used for pictures>
Backstory: <two short paragraphs of history, ending on one unresolved hook>
Stats: STR <8-20>, DEX <8-20>, CON <8-20>, INT <8-20>, WIS <8-20>, CHA <8-20>
Traits:
+ <Skill name> [<tier: D, C, B, A or S>] | <exactly when it applies> | <what it lets them do>; <a second effect for B or higher>
- <Weakness name> [<tier>] | <exactly when it applies> | <the restriction it causes>
Gear:
- <Item> | <what it is and what it does>`;
function charPrompt(D) {
  return `You are helping me build a character for a solo tabletop RPG run by an AI Game Master. Build one complete, playable character from my idea:

[DESCRIBE YOUR CHARACTER HERE]

THE SETTING
Title: ${D?.title || '[your story]'}
Genre: ${D?.genre || '[genre]'}
Premise: ${D?.premise || '[what is going on when the story starts]'}

RULES
- Six stats (STR DEX CON INT WIS CHA), each 8 to 20, bought with 35 points. Cost of a score: 8=0 9=1 10=2 11=3 12=4 13=5 14=7 15=9 16=10 17=11 18=12 19=13 20=15. Spend 32-35 points, never more than 35.
- Traits are skills (+) and weaknesses (-), each with a tier: D, C, B, A or S. Positive traits cost Trait Points: D 2, C 4, B 6, A 8, S 10. Negative traits give points back: D 1, C 3, B 5, A 7, S 9. The budget is 10 points plus whatever the negatives give back; spend all but 0-3.
- Each trait has a short name, a narrow trigger (exactly when it applies) and story effects: 1 effect at D or C, 2 at B or A, 3 at S. Negatives must be real restrictions that come from the concept.
- Gear: 3-6 ordinary items that fit the character.
- Gender is male or female.
- Never decide what I do, say, think or feel in the story.

Follow the template below EXACTLY, with the same labels in the same order. One trait per line starting with + or -, one item per line starting with -. Output ONLY the filled-in template as plain text.

TEMPLATE:

${CHAR_TEMPLATE}`;
}
/* read a sheet written in the template's shape; null when it isn't */
function charParseTemplate(text) {
  const out = { traits: [], gear: [] }; let sec = ''; let key = '';
  const keys = { name: 'name', gender: 'sex', sex: 'sex', 'story role': 'storyRole', role: 'storyRole', appearance: 'appearance', look: 'appearance', backstory: 'backstory', background: 'backstory', stats: 'stats' };
  for (const raw of String(text).replace(/\r/g, '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    if (/^\**traits\**\s*:?\s*$/i.test(line)) { sec = 'traits'; key = ''; continue; }
    if (/^\**gear\**\s*:?\s*$/i.test(line)) { sec = 'gear'; key = ''; continue; }
    const m = line.match(/^\**([A-Za-z ]{2,20}?)\**\s*:\s*(.*)$/); const k = m && keys[m[1].trim().toLowerCase()];
    if (k) { sec = ''; key = k; out[k] = m[2].replace(/^\*+\s*/, '').trim(); continue; }
    if (sec === 'traits') {
      const t = line.match(/^([+\-−–])\s*(.+?)\s*\[\s*(?:tier\s*:?\s*)?([DCBAS])\s*\]\s*(?:\|\s*(.*))?$/i);
      if (t) { const rest = String(t[4] || '').split('|').map(s => s.trim()); out.traits.push({ name: t[2].replace(/[*_]/g, ''), polarity: t[1] === '+' ? '+' : '-', tier: t[3].toUpperCase(), trigger: rest[0] || '', effects: String(rest.slice(1).join('; ')).split(/\s*;\s*/).filter(Boolean) }); }
      continue;
    }
    if (sec === 'gear') { const g = line.replace(/^[-*•]\s*/, '').split('|').map(s => s.trim()); if (g[0] && !/^<.*>$/.test(g[0])) out.gear.push({ name: g[0].replace(/[*_]/g, ''), desc: g[1] || '', tier: '' }); continue; }
    if (key && key !== 'stats') out[key] += '\n\n' + line;
  }
  if (!out.name || !out.stats) return null;
  const st = {}; for (const k of STATS) { const m = out.stats.match(new RegExp(k + '\\D{0,3}(\\d{1,2})', 'i')) || out.stats.match(new RegExp(STAT_FULL[k] + '\\D{0,3}(\\d{1,2})', 'i')); if (m) st[k] = clamp(num(m[1]), 8, 20); }
  if (Object.keys(st).length < 6) return null;
  out.stats = st; return out;
}
function charFillFromPaste(asked) {
  const D = S.draft; if (!D) return false; const j = charParseTemplate(D.concept || '');
  if (!j) return false;
  D.name = j.name.replace(/^<.*>$/, '').slice(0, 60) || D.name;
  const g = String(j.sex || '').toLowerCase(); if (/^(m|f)/.test(g)) D.sex = g[0] === 'f' ? 'female' : 'male';
  if (j.storyRole) D.storyRole = j.storyRole.slice(0, 60);
  if (j.appearance) D.appearance = j.appearance.slice(0, 400);
  if (j.backstory) D.backstory = j.backstory.slice(0, 2000);
  for (const k of STATS) D.stats[k] = j.stats[k];
  let guard = 0; while (statPoints(D.stats) > draftBudget(D).cap && guard++ < 80) { const k = STATS.reduce((a, b) => D.stats[a] >= D.stats[b] ? a : b); D.stats[k]--; }
  if (j.traits.length) D.traits = j.traits.map(t => normTrait(t)).filter(t => t.name !== 'Unnamed trait').slice(0, 12);
  if (j.gear.length) D.gear = j.gear.map(normGear).filter(x => x.name !== 'Item').slice(0, 8);
  D.concept = ''; renderNew(true);
  const b = draftBudget(D);
  toast(`${D.name}'s sheet is filled in${guard > 1 ? ' (stats trimmed to fit the 35-point budget)' : ''}${b.left < 0 ? `. Traits are ${-b.left} TP over budget: drop one or add a weakness` : ''}. Check it over.`, 6000);
  return true;
}
