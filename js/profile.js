'use strict';
/* =========================================================================
   Character profile — the deep sheet behind a character.

   Fields come in three tiers, so a player can start with six answers and
   deepen the character later:
     req  Required      name, age, ancestry, basic look, background, personality
     rec  Recommended   likes, dislikes, hobbies, values, flaws, physical detail
     adv  Advanced      fine features, mannerisms, philosophy, history, people

   Nothing outside the required tier has to be filled in. Every section can be
   written by the AI from the story so far, or drawn out of the player by the
   AI interview (one question at a time). The appearance fields are the
   character's visual profile: portraits, scene pictures and AI-written picture
   prompts are built from them.
   ========================================================================= */
const PROF_TIER = { req: 'Required', rec: 'Recommended', adv: 'Advanced' };

const PROF_SECTIONS = [
  { id: 'identity', l: 'Identity & ancestry', fields: [
    { k: 'age', l: 'Age or age range', t: 'req', r: 1, ph: '34, mid-thirties, looks 25…' },
    { k: 'species', l: 'Ancestry / species', t: 'req', r: 1, ph: 'human, half-elf, android…' },
    { k: 'heritage', l: 'Ethnicity & cultural heritage', t: 'rec', r: 1 }
  ] },
  { id: 'appearance', l: 'Physical appearance & visual profile', fields: [
    { k: 'appearance', l: 'Basic appearance (the look every picture starts from)', t: 'req', r: 2, ph: 'Tall and weathered, braided red hair, green wool cloak…' },
    { k: 'skin', l: 'Complexion: skin tone, undertone, freckles, birthmarks', t: 'rec', r: 1 },
    { k: 'eyes', l: 'Eyes: colour, shape, size, distinguishing features', t: 'rec', r: 1 },
    { k: 'hair', l: 'Hair: colour, length, texture, style, facial hair', t: 'rec', r: 1 },
    { k: 'build', l: 'Body: height, build, proportions, posture', t: 'rec', r: 1 },
    { k: 'marks', l: 'Distinguishing features: scars, tattoos, piercings, unusual marks', t: 'rec', r: 1 },
    { k: 'presentation', l: 'Presentation: usual clothing, accessories, grooming, aesthetic', t: 'rec', r: 2 },
    { k: 'face', l: 'Face: shape, jawline, cheekbones, nose, lips', t: 'adv', r: 1 },
    { k: 'voice', l: 'Voice: accent, pitch, cadence, speech patterns', t: 'rec', r: 1 }
  ] },
  { id: 'personality', l: 'Personality, likes, dislikes & hobbies', fields: [
    { k: 'traits', l: 'Core personality traits', t: 'req', r: 2, ph: 'Introverted, patient, quietly funny, cautious with strangers…' },
    { k: 'likes', l: 'Likes', t: 'rec', r: 1, ph: 'Rain on a tin roof, cheap wine, woodworking…' },
    { k: 'dislikes', l: 'Dislikes', t: 'rec', r: 1, ph: 'Crowded taverns, being interrupted, liars…' },
    { k: 'hobbies', l: 'Hobbies', t: 'rec', r: 1, ph: 'Whittling, cards, collecting maps…' },
    { k: 'habits', l: 'Habits & nervous gestures', t: 'rec', r: 1 },
    { k: 'speech', l: 'Speech patterns: vocabulary, accent, humour, favourite phrases', t: 'rec', r: 1 },
    { k: 'social', l: 'How they act around strangers, friends, authorities, enemies', t: 'adv', r: 2 },
    { k: 'emotional', l: 'Emotional tendencies: stress, grief, fear, affection, conflict', t: 'adv', r: 2 }
  ] },
  { id: 'beliefs', l: 'Beliefs, values, motivations & fears', fields: [
    { k: 'values', l: 'Values', t: 'rec', r: 1, ph: 'Loyalty, freedom, knowledge, justice…' },
    { k: 'flaws', l: 'Flaws', t: 'rec', r: 1, ph: 'Pride, jealousy, impatience…' },
    { k: 'fears', l: 'Fears & insecurities', t: 'rec', r: 1 },
    { k: 'motivations', l: 'What drives them', t: 'rec', r: 1 },
    { k: 'beliefs', l: 'Beliefs: religious, philosophical, cultural, moral', t: 'adv', r: 1 },
    { k: 'ambitions', l: 'What they ultimately hope to achieve', t: 'adv', r: 1 },
    { k: 'secrets', l: 'Secrets: things they deliberately conceal', t: 'adv', r: 2 }
  ] },
  { id: 'history', l: 'Background, history & relationships', fields: [
    { k: 'upbringing', l: 'Birthplace & upbringing', t: 'rec', r: 1 },
    { k: 'family', l: 'Family & important relationships', t: 'rec', r: 1 },
    { k: 'occupation', l: 'Former or current occupation', t: 'rec', r: 1 },
    { k: 'education', l: 'Education & training', t: 'adv', r: 1 },
    { k: 'events', l: 'Important life events', t: 'adv', r: 2 },
    { k: 'regrets', l: 'Achievements & regrets', t: 'adv', r: 1 },
    { k: 'trauma', l: 'Past trauma or significant losses (optional)', t: 'adv', r: 1 },
    { k: 'duties', l: 'Current responsibilities', t: 'adv', r: 1 },
    { k: 'standing', l: 'Social standing & reputation', t: 'adv', r: 1 },
    { k: 'factions', l: 'Faction affiliations & rivalries', t: 'adv', r: 1 }
  ] },
  { id: 'craft', l: 'Class, attributes & skills', fields: [
    { k: 'klass', l: 'Class, calling or archetype', t: 'rec', r: 1, ph: 'Guild alchemist, wandering duelist…' },
    { k: 'skills', l: 'Skills & training worth naming', t: 'rec', r: 2, ph: 'Tracking, herb-lore, forgery…' }
  ] }
];

const PROF_FIELDS = PROF_SECTIONS.flatMap(s => s.fields);
const PROF_LOOK = ['appearance', 'species', 'heritage', 'skin', 'eyes', 'hair', 'build', 'marks', 'presentation'];

const profOf = x => (x && typeof x.profile === 'object' && x.profile) || {};
/* an untouched profile imports the character's old look and age once. After that the
   profile is the source of truth and the look fields below are only what it is built from. */
function profSeed(x) {
  if (!x) return {};
  if (!x.profile || typeof x.profile !== 'object') x.profile = {};
  const p = x.profile;
  if (!Object.keys(p).length) {
    if (x.appearance) p.appearance = String(x.appearance).slice(0, 500);
    if (x.age != null && x.age !== '') p.age = String(x.age);
  }
  return p;
}
/* the visual profile: what every picture and portrait is built from */
function profLook(x) {
  const p = profOf(x);
  const bits = PROF_LOOK.map(k => String(p[k] || '').trim()).filter(Boolean);
  /* a companion keeps their look on their card instead */
  if (!bits.length && x) bits.push(String(x.face || '').trim(), String(x.body || '').trim(), String(x.clothing || '').trim(), String(x.tags || '').trim());
  /* "grey eyes" in the basic look makes a separate "grey" eyes field a repeat, not a detail */
  const out = [];
  for (const b of bits.filter(Boolean)) if (!out.some(o => o.toLowerCase().includes(b.toLowerCase()))) out.push(b);
  return out.join(', ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').slice(0, 700);
}
/* x.appearance is a mirror for older code; it is never the source, so it is always
   rewritten (or removed) rather than left behind when the look is emptied */
function profSync(x) {
  if (!x) return '';
  const look = profLook(x);
  if (look) x.appearance = look; else delete x.appearance;
  const n = parseInt(String(profOf(x).age || '').match(/\d+/)?.[0], 10);
  if (Number.isFinite(n) && n > 0 && n < 120) x.age = n;
  return look;
}
/* what the GM and the picture prompts read: the profile first, the mirror only as a fallback */
const lookOf = x => profLook(x) || String((x && x.appearance) || '').trim();
function profBrief(x) {
  const p = profOf(x); const out = [];
  if (x?.name) out.push('Name: ' + x.name);
  if (p.age) out.push('Age: ' + p.age);
  if (x?.sex) out.push('Gender: ' + x.sex);
  if (x?.concept) out.push('Idea: ' + String(x.concept).slice(0, 400));
  for (const f of PROF_FIELDS) { const v = String(p[f.k] || '').trim(); if (v && f.k !== 'appearance') out.push(f.l + ': ' + v.slice(0, 400)); }
  for (const [key, lab] of [['storyRole', 'Story role'], ['backstory', 'Background'], ['face', 'Face'], ['body', 'Body'], ['clothing', 'Clothing'], ['tags', 'Picture tags'], ['notes', 'Other']]) {
    const v = String(x?.[key] || '').trim(); if (v) out.push(lab + ': ' + v.slice(0, 500));
  }
  return out.join('\n').slice(0, 1800);
}
function profCounts(x) {
  const p = profOf(x); const out = { req: [0, 0], rec: [0, 0], adv: [0, 0], missing: [] };
  for (const f of PROF_FIELDS) { out[f.t][1]++; if (String(p[f.k] || '').trim()) out[f.t][0]++; else if (f.t === 'req') out.missing.push(f.l); }
  out.req[1] += 2;
  if (String(x?.backstory || '').trim()) out.req[0]++; else out.missing.push('Background');
  if (String(x?.name || '').trim()) out.req[0]++; else out.missing.push('Name');
  return out;
}
function profFieldHTML(x, f, bind, prefix) {
  const v = String(profOf(x)[f.k] ?? '');
  const tag = f.r > 1 ? `<textarea rows="${f.r}" data-${bind}="${prefix}${f.k}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`
    : `<input type="text" data-${bind}="${prefix}${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
  return `<label class="f"><span>${esc(f.l)} <em style="font-style:normal;color:var(--muted);font-size:11.5px">· ${PROF_TIER[f.t]}</em></span>${tag}</label>`;
}
/* one section, ready to drop into a screen. bind: 'dpath' (builder) or 'cbind' (a saved character) */
function profSectionHTML(x, id, { bind = 'dpath', prefix = 'profile.', host = 'draft', ai = true } = {}) {
  const sec = PROF_SECTIONS.find(s => s.id === id); if (!sec) return '';
  profSeed(x);
  const busy = S.profBusy === id;
  return sec.fields.map(f => profFieldHTML(x, f, bind, prefix)).join('')
    + (ai ? `<div class="row wrap" style="margin-top:6px"><button class="btn sm ghost" data-act="profai" data-sec="${id}" data-host="${host}" ${busy || S.profBusy ? 'disabled' : ''}>${busy ? '<span class="spin sm"></span> Writing…' : icon('spark') + ' Fill this section with AI'}</button></div>` : '');
}
function profReviewHTML(x) {
  const n = profCounts(x);
  const line = (t, lab) => `${n[t][0]}/${n[t][1]} ${lab.toLowerCase()}`;
  return `<div class="card"><b>${esc(String(x?.name || 'This character'))}</b>
    <p class="hint" style="margin:4px 0 0">${line('req', 'Required')} · ${line('rec', 'Recommended')} · ${line('adv', 'Advanced')}</p>
    <p class="hint" style="margin:4px 0 0">${n.missing.length ? `Still needed: <b>${esc(n.missing.join(', '))}</b>. Everything else can grow during play.` : 'Everything required is filled in. The rest can grow during play.'}</p>
    <p class="hint" style="margin:4px 0 0">The look fields feed every portrait and picture prompt; the rest is what the GM knows.</p></div>`;
}
/* ---------- which object is being edited ---------- */
function profTarget(host) {
  if (host === 'sheet') { const c = cur(); return c && c.character ? { x: c.character, c } : null; }
  return S.draft ? { x: S.draft, c: S.draft } : null;
}
function profSetting(c) {
  c = c || {};
  return [c.title && `World: ${c.title}`, c.genre && `Genre: ${c.genre}`, c.premise && `Premise: ${String(c.premise).slice(0, 600)}`,
    c.tone && `Tone: ${c.tone}`, c.world && `Notes: ${String(c.world).slice(0, 800)}`, c.art && `Art style: ${c.art}`,
    `Content rating: ${normRating(c.rating)}`].filter(Boolean).join('\n');
}
function profRedraw(host) {
  if (S.modal) return renderModal();
  if (S.view === 'new') return renderNew(true);
  if (S.view === 'paledit' && typeof renderPalEditor === 'function') { const y = scrollY; renderPalEditor(); scrollTo(0, y); return; }
  rerender();
}
function profApply(host, t) {
  if (!t) return;
  profSync(t.x);
  if (host === 'sheet' && t.c && typeof touch === 'function') { touch(t.c); scheduleSync(); }
}
async function profChat(system, user, maxTokens = 700, temp = 0.85) {
  if (!textReady()) throw new Error('set up a Story AI first (Settings → Story AI)');
  const raw = await chat([{ role: 'system', content: system }, { role: 'user', content: user }],
    { stream: false, maxTokens, temperature: temp, json: true, frequencyPenalty: 0.3 });
  const j = tryJSON(stripThink(raw || ''));
  if (!j || typeof j !== 'object') throw new Error('the AI did not answer with JSON');
  return j;
}
/* local models drop the odd request (a 500 while the model reloads); one quiet retry
   saves the whole answer instead of falling back to a raw dump */
async function profChatTry(system, user, maxTokens = 350, tries = 2, temp = 0.85) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try { return await profChat(system, user, maxTokens, temp); }
    catch (e) {
      last = e;
      if (/no ai connected|set up a story ai|no model chosen/i.test(String(e && e.message))) break;
      /* a token loop aborts the same way every time at the same temperature, so warm the retry up */
      temp = Math.min(1.1, temp + 0.25);
      if (i < tries - 1) await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw last || new Error('the AI did not answer');
}
/* ---------- write one section with the AI ---------- */
async function profAIWrite(host, secId) {
  const t = profTarget(host); if (!t) return;
  const sec = PROF_SECTIONS.find(s => s.id === secId); if (!sec) return;
  const p = profSeed(t.x);
  const ask = sec.fields.filter(f => !String(p[f.k] || '').trim());
  if (!ask.length) return toast('That section is already filled in. Clear a field to have it rewritten.');
  S.profBusy = secId; profRedraw(host);
  try {
    const sys = `You write one character for a tabletop RPG. Stay inside the setting and the character already described; be concrete and specific, never generic.\n${profSetting(t.c)}\nReply with JSON only, keys exactly ${ask.map(f => `"${f.k}"`).join(', ')}. Each value is one or two sentences.`;
    const j = await profChat(sys, `THE CHARACTER SO FAR\n${profBrief(t.x)}\n\nWRITE ONLY THESE FIELDS: ${ask.map(f => `${f.l} (${f.k})`).join('; ')}`);
    let n = 0;
    for (const f of ask) { const raw = j[f.k]; const v = (Array.isArray(raw) ? raw.join('; ') : String(raw || '')).trim(); if (v) { p[f.k] = v.slice(0, 800); n++; } }
    profApply(host, t); profRedraw(host);
    toast(n ? `${sec.l}: ${n} field${n > 1 ? 's' : ''} written. Edit anything you like.` : 'The AI had nothing to add. Try again, or write it yourself.');
  } catch (e) { toast('Could not fill that section: ' + e.message, 6000); }
  finally { S.profBusy = ''; profRedraw(host); }
}
/* ---------- the interview: one question at a time ---------- */
const PROF_QUESTIONS = [
  ['upbringing', 'What kind of childhood did they have?'],
  ['habits', 'What makes them feel most at home?'],
  ['dislikes', 'What is something they refuse to tolerate?'],
  ['emotional', 'How do they usually respond when someone challenges them?'],
  ['family', 'Is there someone from their past they would do almost anything to protect?'],
  ['marks', 'What is the first physical feature someone notices about them?'],
  ['likes', 'What do they do when nobody is watching?'],
  ['flaws', 'What is the worst thing they believe about themselves?'],
  ['values', 'What would they sacrifice almost anything for?'],
  ['secrets', 'What do they hope no one ever finds out?'],
  ['motivations', 'What gets them out of bed in the morning?'],
  ['presentation', 'How do they dress when they want to be taken seriously?'],
  ['backstory', 'What is the one thing in their past that still shapes them?']
];
/* the answer can also fill the rest of its own section, so the AI gets a short list of
   related keys instead of all 39 fields */
function profAskKeys(p, field) {
  if (field === 'backstory') return ['backstory'];
  const sec = PROF_SECTIONS.find(s => s.fields.some(f => f.k === field));
  const open = new Set(PROF_FIELDS.filter(f => !String(p[f.k] || '').trim() || f.k === field).map(f => f.k));
  return [...new Set([field, ...(sec ? sec.fields.map(f => f.k) : [])].filter(k => open.has(k)))].slice(0, 8);
}
function ivyStart(host) {
  S.ivy = { host: host === 'sheet' ? 'sheet' : 'draft', log: [], q: '', field: '', busy: true, asked: [] };
  openModal('interview');
  ivyNext();
}
async function ivyNext() {
  const I = S.ivy; if (!I) return;
  const t = profTarget(I.host); if (!t) { S.ivy = null; return closeModal(); }
  const p = profSeed(t.x);
  I.busy = true; renderModal();
  let q = '', field = '';
  I.asked = I.asked || [];
  const missing = PROF_FIELDS.filter(f => !String(p[f.k] || '').trim() && !I.asked.includes(f.k));
  /* the background is required but lives outside the profile object, so the interview covers it too */
  if (!String(t.x.backstory || '').trim() && !I.asked.includes('backstory')) missing.push({ k: 'backstory', l: 'Background & life story', t: 'req' });
  /* the app chooses what to ask about — required first, then the questions written for this,
     then whatever is left — so coverage never depends on what a small model feels like asking */
  const rank = { req: 0, rec: 1, adv: 2 };
  const target = missing.slice().sort((a, b) => {
    const ai = PROF_QUESTIONS.findIndex(([k]) => k === a.k), bi = PROF_QUESTIONS.findIndex(([k]) => k === b.k);
    return ((rank[a.t] ?? 3) - (rank[b.t] ?? 3)) || ((ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi));
  })[0];
  if (target) { field = target.k; I.fieldLabel = target.l; }
  if (target && textReady()) {
    try {
      const j = await profChatTry(`You interview a player about their RPG character. Ask ONE warm, concrete question, under 25 words, about exactly one thing: ${target.l}. Speak to the player about the character in the second person ("What was home like for you growing up?"). Never mention the interview, the player's feelings about it, or yourself.\n${profSetting(t.c)}\nReply with JSON only: {"question":""}`,
        `THE CHARACTER SO FAR\n${profBrief(t.x)}`, 240, 2, 0.7);
      if (j && j.question) {
        q = String(j.question).replace(/^["'“]|["'”]$/g, '').replace(/\s+/g, ' ').trim();
        if (q.length > 200) { const end = q.slice(0, 200).search(/[^.?!]*$/); q = (end > 60 ? q.slice(0, end) : q.slice(0, 200)).trim(); }
      }
    } catch (e) { console.warn('Interview question fell back to the built-in wording', e); }
  }
  if (!q && field) q = (PROF_QUESTIONS.find(([k]) => k === field) || [])[1] || `Tell me about ${(target || {}).l ? target.l.toLowerCase() : 'them'}.`;
  if (!q) { I.busy = false; I.q = ''; renderModal(); return; }
  I.q = q; I.field = field; I.busy = false; if (!I.asked.includes(field)) I.asked.push(field);
  renderModal();
}
async function ivyAnswer(text) {
  const I = S.ivy; if (!I || !String(text || '').trim()) return toast('Write an answer first, or skip the question.');
  const t = profTarget(I.host); if (!t) return;
  const p = profSeed(t.x);
  const answer = String(text).trim().slice(0, 900);
  I.log.push({ q: I.q, a: answer });
  let n = 0;
  /* only fields still empty (and the one the question was about) may be written, so an
     answer can never overwrite what the player already typed */
  const open = PROF_FIELDS.filter(f => !String(p[f.k] || '').trim() || f.k === I.field);
  const asked = I.log.at(-1).q;
  I.q = ''; I.busy = true; renderModal();
  try {
    const keys = profAskKeys(p, I.field);
    const j = await profChatTry(`You split one answer about an RPG character into character-sheet fields. Use the answer's own details; never re-describe anything already known and never invent numbers or names. Most answers touch one or two fields; do not put everything in a single field.\n${profSetting(t.c)}\nReply with JSON only. Use at most three of these keys: ${keys.join(', ')}. Each value is one sentence.`,
      `THE PLAYER WAS ASKED: ${asked}\nTHE PLAYER ANSWERED: ${answer}`, 350, 2, 0.4);
    for (const f of open) {
      const raw = j[f.k]; const v = (Array.isArray(raw) ? raw.join('; ') : String(raw ?? '')).replace(/\s+/g, ' ').trim();
      if (v.length < 2) continue;
      const prev = String(p[f.k] || '').trim();
      if (prev && f.k !== I.field) continue;
      /* a small model loves echoing the one fact it knows into a second field */
      if (f.k !== I.field && [p.species, p.heritage, p.age, p.traits].some(x => String(x || '').trim().toLowerCase() === v.toLowerCase())) continue;
      p[f.k] = (prev ? prev + ' ' + v : v).slice(0, 800); n++;
    }
    const bg = (Array.isArray(j.backstory) ? j.backstory.join(' ') : String(j.backstory || '')).replace(/\s+/g, ' ').trim();
    if (bg.length > 20 && !String(t.x.backstory || '').trim()) { t.x.backstory = bg.slice(0, 1200); n++; }
  } catch (e) {
    console.warn('Interview: could not sort that answer into fields', e);
  }
  /* nothing landed (or the AI was unreachable): keep the answer itself rather than lose it */
  if (!n && I.field === 'backstory') { if (!String(t.x.backstory || '').trim()) t.x.backstory = answer.slice(0, 1200); }
  else if (!n && I.field) {
    const prev = String(p[I.field] || '').trim();
    p[I.field] = (prev ? prev + ' ' + answer : answer).slice(0, 800);
  }
  profApply(I.host, t);
  ivyNext();
}
function interviewHTML() {
  const I = S.ivy; if (!I) return '';
  const t = profTarget(I.host);
  const n = t ? profCounts(t.x) : { req: [0, 0], rec: [0, 0], adv: [0, 0] };
  return `<p class="hint">Answer in your own words. Each answer is sorted into the right fields, and you can edit everything afterwards.</p>
    <p class="hint"><b>${n.req[0]}/${n.req[1]} required</b> · ${n.rec[0]}/${n.rec[1]} recommended · ${n.adv[0]}/${n.adv[1]} advanced filled in</p>
    ${(I.log || []).slice(-5).map(x => `<div style="margin:10px 0"><div class="hint" style="margin:0">${esc(x.q)}</div><div>${esc(x.a)}</div></div>`).join('')}
    ${I.q ? `<div class="card"><b>${esc(I.q)}</b>${I.field ? `<div class="hint" style="margin:2px 0 0">fills in ${esc(I.fieldLabel || I.field)}</div>` : ''}</div>` : ''}
    ${I.busy ? '<p class="hint"><span class="spin sm"></span> Thinking of the next question…</p>' : `
      <label class="f"><span>Your answer</span><textarea id="ivyA" rows="4" placeholder="As much or as little as you like…"></textarea></label>
      <div class="row wrap"><button class="btn gold" data-act="ivyanswer">Answer &amp; continue</button><button class="btn sm ghost" data-act="ivyskip">Skip this one</button><button class="btn sm ghost" data-act="ivyfinish">Finish</button></div>`}`;
}
function ivyAction(act, el) {
  const I = S.ivy;
  if (act === 'ivyopen') { ivyStart(el.dataset.host); return true; }
  if (!I) return false;
  if (act === 'ivyskip') { ivyNext(); return true; }
  if (act === 'ivyanswer') { ivyAnswer($('#ivyA')?.value || ''); return true; }
  if (act === 'ivyfinish') {
    const t = profTarget(I.host); const n = t ? profCounts(t.x) : { req: [0, 0] };
    if (t) profApply(I.host, t);
    S.ivy = null; closeModal(); profRedraw(I.host);
    toast(`Interview saved: ${n.req[0]}/${n.req[1]} required fields and more. Edit anything on the sheet.`, 5000);
    return true;
  }
  return false;
}
function profAction(act, el) {
  if (act === 'profai') { profAIWrite(el.dataset.host || 'draft', el.dataset.sec); return true; }
  return false;
}
/* ---------- AI-written picture descriptions ---------- */
/* uses the character's visual profile and everything the sheet knows, so a photo
   screen can ask for a picture instead of the player writing a prompt */
async function picAIPrompt(btn, x, ctxText) {
  if (!btn) return;
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin sm"></span>';
  try {
    const look = profLook(x) || String(x?.name || 'the subject');
    const raw = await chat([
      { role: 'system', content: 'You write the description of ONE still photograph for an image model: 40-70 words of comma-separated visual phrases covering pose and body position, state of dress in plain words, hands and contact, expression, camera framing, the place, the light and the mood. No names, no text in the picture. Stay exactly at the intimacy the scene already has.' },
      { role: 'user', content: `WHO IS IN IT\n${look}\n\nWHAT THE SHEET KNOWS\n${profBrief(x).slice(0, 1000)}\n\nWHAT IS HAPPENING\n${String(ctxText || 'a quiet moment').slice(0, 1200)}` }
    ], { stream: false, maxTokens: 280, temperature: 0.85 });
    const t = String(stripThink(raw || '')).trim().replace(/^["'`]|["'`]$/g, '').replace(/\s+/g, ' ');
    if (!t) throw new Error('nothing came back');
    const box = $('#lbPose');
    if (box) box.value = t.slice(0, 700);
    toast('Description written. Regenerate to paint it.', 4000);
  } catch (e) { toast('Could not write that: ' + e.message, 5000); }
  finally { btn.disabled = false; btn.innerHTML = old; }
}
