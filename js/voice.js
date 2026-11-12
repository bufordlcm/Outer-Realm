'use strict';
/* =========================================================================
   Voices: a narrator plus a unique voice for every character.
   Two engines:
     • PC voices: natural Kokoro voices made by the helper on your PC (/iq/tts),
       reached the same way as pictures (localhost on the PC, Tailscale on the phone).
     • Device voices: the voices built into the phone or browser (always available).
   Each character gets a male or female voice automatically, picked from their
   pronouns or description, and keeps it for the whole story.
   ========================================================================= */
const TTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
const ttsVoices = () => { if (!TTS) return []; const v = speechSynthesis.getVoices(); return v.slice().sort((a, b) => (b.lang.startsWith('en') - a.lang.startsWith('en')) || a.name.localeCompare(b.name)); };
if (TTS) speechSynthesis.onvoiceschanged = () => { if (S.modal) renderModal(); };

const PC_VOICES = {
  f: [['af_heart', 'Heart · US'], ['af_bella', 'Bella · US'], ['af_nicole', 'Nicole · US, soft'], ['af_sarah', 'Sarah · US'], ['af_sky', 'Sky · US'], ['af_nova', 'Nova · US'], ['af_jessica', 'Jessica · US'], ['af_river', 'River · US'], ['af_kore', 'Kore · US'], ['af_aoede', 'Aoede · US'], ['af_alloy', 'Alloy · US'], ['bf_emma', 'Emma · UK'], ['bf_isabella', 'Isabella · UK'], ['bf_alice', 'Alice · UK'], ['bf_lily', 'Lily · UK']],
  m: [['am_michael', 'Michael · US'], ['am_adam', 'Adam · US'], ['am_fenrir', 'Fenrir · US, deep'], ['am_onyx', 'Onyx · US, deep'], ['am_puck', 'Puck · US, playful'], ['am_echo', 'Echo · US'], ['am_eric', 'Eric · US'], ['am_liam', 'Liam · US'], ['bm_george', 'George · UK'], ['bm_lewis', 'Lewis · UK'], ['bm_daniel', 'Daniel · UK'], ['bm_fable', 'Fable · UK']]
};
const PC_LABEL = Object.fromEntries([...PC_VOICES.f, ...PC_VOICES.m]);
const PC_NARRATOR = 'bm_george';
const DEV_F = /female|woman|zira|aria|jenny|samantha|karen|moira|tessa|fiona|victoria|allison|\bava\b|susan|serena|\bkate\b|martha|catherine|nicky|joelle|sandy|shelley|\bflo\b|grandma|libby|sonia|natasha|clara|\bemma\b|michelle|hazel|heera|veena|kathy|princess|vicki|amelie|anna|alice|ellen|ioana|laura|luciana|mariska|melina|milena|monica|nora|paulina|sara|satu|yelda|yuna|zosia|zuzana|google us english/i;
const DEV_M = /\bmale\b|\bguy\b|david|\bmark\b|daniel|\balex\b|\bfred\b|aaron|arthur|gordon|rishi|oliver|\btom\b|thomas|reed|rocko|grandpa|eddy|ralph|albert|junior|ryan|george|christopher|\beric\b|brian|james|bruce|lee\b|diego|jorge|juan|luca|maged|rishi|xander|yuri|bad news|bahh|boing|bubbles|cellos|trinoids|whisper|zarvox/i;
const devGender = v => DEV_M.test(v.name) && !/female/i.test(v.name) ? 'm' : DEV_F.test(v.name) ? 'f' : '';

const VOICE = { pc: null, checkedAt: 0, items: [], gen: 0, playing: false, audio: null, cache: new Map() };
const voiceOn = () => S.settings.ui.voice !== 'off';
const engine = () => { const e = S.settings.ui.voiceEngine || 'auto'; return e === 'device' ? 'device' : e === 'pc' ? 'pc' : VOICE.pc ? 'pc' : 'device'; };
async function checkPCVoices(force) {
  if (!force && VOICE.checkedAt && Date.now() - VOICE.checkedAt < 60000) return VOICE.pc;
  VOICE.checkedAt = Date.now();
  try { const r = await fetch(forgeUrl() + '/iq/health', { signal: AbortSignal.timeout?.(4000) }); VOICE.pc = r.ok && !!(await r.json()).tts; }
  catch { VOICE.pc = false; }
  return VOICE.pc;
}
setTimeout(() => checkPCVoices(), 2500);

/* ---------- who is who ---------- */
const GF = /\b(she|her|hers|herself|woman|women|girl|lady|ladies|queen|princess|mother|mom|mum|daughter|sister|wife|widow|matron|priestess|witch|duchess|countess|empress|maid|madam|grandmother|granny|aunt|niece|goddess|heroine|actress|waitress|hostess|baroness|female|she's|bride|nun|abbess)\b/g;
const GM = /\b(he|him|his|himself|man|men|boy|lord|king|prince|father|dad|son|brother|husband|widower|priest|wizard|duke|count|emperor|sir|mister|grandfather|grandpa|uncle|nephew|god|hero|actor|waiter|host|baron|male|monk|knight|he's|groom|abbot|lad)\b/g;
function genderOf(e) {
  if (!e) return '';
  const pr = String(e.pronouns || '').toLowerCase();
  if (/\bshe\b|\bher\b/.test(pr)) return 'f';
  if (/\bhe\b|\bhim\b/.test(pr)) return 'm';
  const g = String(e.sex || e.gender || '').toLowerCase();
  if (/^(f|woman|girl|lady)/.test(g)) return 'f';
  if (/^(m|man|boy)\b/.test(g) || g === 'male') return 'm';
  const t = ' ' + [e.role, e.storyRole, e.text, e.look, e.appearance, e.personality, e.backstory].filter(Boolean).join(' ').toLowerCase() + ' ';
  const f = (t.match(GF) || []).length, m = (t.match(GM) || []).length;
  return f > m ? 'f' : m > f ? 'm' : '';
}
/* everyone the story knows, longest names first so "Captain Mara Vell" beats "Mara" */
function voiceCast(c) {
  const out = [];
  const add = (ent, kind) => { const n = String(ent?.name || '').trim(); if (n) out.push({ name: n, ent, kind }); };
  add(c.character, 'player'); arr(c.players).forEach(p => p !== c.character && add(p, 'player'));
  arr(c.party).forEach(p => add(p, 'party')); peopleOf(c).forEach(p => add(p, 'person'));
  const list = [];
  for (const x of out) {
    list.push({ key: x.name, ...x });
    const first = x.name.split(/\s+/)[0];
    if (first.length > 2 && first !== x.name && !out.some(y => y !== x && y.name.split(/\s+/)[0] === first)) list.push({ key: first, ...x });
    const last = x.name.split(/\s+/).pop();
    if (last.length > 3 && last !== first && !out.some(y => y !== x && y.name.split(/\s+/).pop() === last)) list.push({ key: last, ...x });
  }
  return list.sort((a, b) => b.key.length - a.key.length);
}
/* the voice a character speaks with (assigned once, then kept) */
function voiceOf(c, ent, name) {
  const eng = engine(); const fld = eng === 'pc' ? 'vPC' : 'vDev';
  let holder = ent;
  if (!holder) { c.voiceMap = c.voiceMap || {}; holder = c.voiceMap[String(name || '?').toLowerCase()] = c.voiceMap[String(name || '?').toLowerCase()] || { name }; }
  if (eng === 'device' && holder.ttsVoice && !holder.vDev) holder.vDev = holder.ttsVoice;
  if (holder[fld]) return holder[fld];
  if (S.settings.ui.charVoices === false) return '';
  const g = genderOf(holder) || (hashNum(holder.name || name) % 2 ? 'f' : 'm');
  const used = new Set([eng === 'pc' ? (S.settings.ui.voicePC || PC_NARRATOR) : S.settings.ui.voiceName]);
  for (const x of voiceCast(c)) if (x.ent?.[fld]) used.add(x.ent[fld]);
  for (const x of Object.values(c.voiceMap || {})) if (x[fld]) used.add(x[fld]);
  let pool;
  if (eng === 'pc') pool = PC_VOICES[g].map(v => v[0]);
  else { const en = ttsVoices().filter(v => /^en/i.test(v.lang)); pool = en.filter(v => devGender(v) === g).map(v => v.name); if (!pool.length) pool = en.map(v => v.name); }
  if (!pool.length) return '';
  const start = hashNum(holder.name || name) % pool.length;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  holder[fld] = ordered.find(v => !used.has(v)) || ordered[0];
  touch(c);
  return holder[fld];
}
function hashNum(s) { let h = 2166136261; for (const ch of String(s || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
const narratorVoice = () => engine() === 'pc' ? (S.settings.ui.voicePC || PC_NARRATOR) : (S.settings.ui.voiceName || '');

/* ---------- split a scene into narrator lines and character lines ---------- */
const SPEECH_TAG = /^\s*(?:[A-Z][\w'’-]*\s+){0,3}(?:says|said|asks|asked|calls|called|mutters|muttered|whispers|whispered|shouts|shouted|replies|replied|answers|answered|growls|growled|snaps|snapped|adds|added|continues|continued|sighs|sighed|yells|yelled|cries|cried|murmurs|murmured|grunts|grunted|hisses|hissed|barks|barked|tells|told|laughs|laughed|offers|offered|warns|warned|begins|began|insists|insisted|admits|admitted|demands|demanded|calls out|breathes|breathed)\b/;
const cleanSpeech = t => String(t || '').replace(/\[[^\]]*\]/g, '').replace(/[#>`_]/g, '').replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
function sceneSegments(c, text, fallback = null) {
  const t = cleanSpeech(text); const cast = voiceCast(c);
  const findName = s => { for (const x of cast) { const re = new RegExp(`(^|[^\\w'])${x.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\w]|$)`); if (re.test(s)) return x; } return null; };
  const segs = []; let last = { m: null, f: null, any: null };
  const re = /(?:\{([^{}\n]{1,40})\}\s*)?[“"]([^”"]{1,800})[”"]/g; let i = 0, m;
  const push = (who, text) => { text = text.replace(/\s+/g, ' ').trim(); if (!text || !/[a-z0-9]/i.test(text)) return; const p = segs[segs.length - 1]; if (p && p.who === who) p.text += ' ' + text; else segs.push({ who, text }); };
  while ((m = re.exec(t))) {
    /* "blessed water", "the Pale Mother": short quoted names or labels are narration, not speech.
       Speech ends with punctuation inside the quotes, runs five words or more, or has a speech tag next to it. */
    const tag = (m[1] || '').trim();
    if (tag) {   /* the GM named the speaker: no guessing needed */
      push(null, t.slice(i, m.index));
      const g = /^\W*(she|her)\b/i.test(t.slice(re.lastIndex, re.lastIndex + 30)) ? 'female' : /^\W*(he|his|him)\b/i.test(t.slice(re.lastIndex, re.lastIndex + 30)) ? 'male' : '';
      let who = findName(tag);
      if (!who) { c.voiceMap = c.voiceMap || {}; const k = tag.toLowerCase(); const ent = c.voiceMap[k] = c.voiceMap[k] || { name: tag }; if (g && !ent.sex) ent.sex = g; who = { name: tag, ent }; }
      const gg = genderOf(who.ent || who); if (gg) last[gg] = who; last.any = who;
      push(who, m[2]); i = re.lastIndex; continue;
    }
    const inner = m[2].trim(); const tagNext = SPEECH_TAG.test(t.slice(re.lastIndex, re.lastIndex + 60)) || /^\s*,?\s*(she|he|they)\s+\w+s\b/i.test(t.slice(re.lastIndex, re.lastIndex + 30));
    const speech = /[.,!?…—–-]$/.test(inner) || inner.split(/\s+/).length >= 5 || tagNext;
    if (!speech) { const p = segs[segs.length - 1]; const chunkText = t.slice(i, re.lastIndex).replace(/[“”"]/g, ''); if (p && p.who === null) p.text += ' ' + chunkText.replace(/\s+/g, ' ').trim(); else push(null, chunkText); i = re.lastIndex; continue; }
    const before = t.slice(i, m.index); push(null, before);
    const rawAfter = t.slice(re.lastIndex, re.lastIndex + 140).split(/(?<=[.!?])\s|[“"]/)[0];
    /* text after a quote only names the speaker when it's a tag ("…," she says / "…!" Holt shouts), not a new sentence */
    const isTag = /[,—–-]\s*$/.test(m[2]) || /^\s*[a-z]/.test(rawAfter) || (/[!?]\s*$/.test(m[2]) && SPEECH_TAG.test(rawAfter));
    const after = isTag ? rawAfter : '';
    const lead = (before.split(/(?<=[.!?])\s+/).filter(x => x.trim()).pop() || '').slice(-140);
    let who = findName(after);
    /* "…," he mutters: a man is speaking. Use the last man who spoke, or an unnamed one ("the guard") with a male voice */
    const tagG = /^\W*(she|her)\b/i.test(after) ? 'f' : /^\W*(he|his|him)\b/i.test(after) ? 'm' : '';
    if (!who && tagG) {
      const nounHit = lead.match(/\b(?:a|an|the|one)\s+((?:old|young|tall|fat|thin|grey|gray|nearby|other)\s+)?([a-z]+)\b(?![^.]*\b(?:a|an|the)\s+[a-z]+\b)/i);
      const recent = last[tagG];
      if (recent && (!nounHit || genderOf(recent.ent || recent) === tagG && findName(lead) === recent)) who = recent;
      else if (recent && !nounHit) who = recent;
      else { const nm = nounHit ? 'the ' + nounHit[2].toLowerCase() : (tagG === 'f' ? 'a woman' : 'a man'); c.voiceMap = c.voiceMap || {}; const ent = c.voiceMap[nm] = c.voiceMap[nm] || { name: nm, sex: tagG === 'f' ? 'female' : 'male' }; who = { name: nm, ent }; }
    }
    if (!who) who = findName(lead);
    if (!who) { const pron = lead.toLowerCase(); if (/\bshe\b|\bher\b/.test(pron) && last.f) who = last.f; else if (/\bhe\b|\bhis\b|\bhim\b/.test(pron) && last.m) who = last.m; }
    if (!who) who = last.any || fallback;
    if (who) { const g = genderOf(who.ent || who); if (g) last[g] = who; last.any = who; }
    push(who || { name: 'Stranger', ent: null }, m[2]);
    i = re.lastIndex;
  }
  push(null, t.slice(i));
  return segs;
}
/* what to say for one message, with whose voice */
function messageSegments(c, m) {
  /* one known speaker: *actions in asterisks* are narration, everything else is that speaker talking */
  const own = (me, text) => { const segs = []; cleanSpeech(stripSpeakerTags(text)).split(/(\*[^*]+\*)/).forEach(part => { const act = /^\*.*\*$/.test(part); const s = part.replace(/\*/g, '').replace(/[“”"]/g, '').trim(); if (s && /[a-z0-9]/i.test(s)) segs.push({ who: act ? null : me, text: s }); }); return segs; };
  if (m.role === 'comp') { const p = arr(c.party).find(x => x.id === m.compId); return own(p ? { name: p.name, ent: p } : { name: m.name || 'Companion', ent: null }, m.text); }
  if (m.role === 'player') {   /* what they say is their character's voice, what they do is the narrator's, (( notes )) are never read */
    const me = { name: c.character.name, ent: c.character };
    return parseTurn(cleanSpeech(m.text), m.mode || 'act').filter(p => p.k !== 'ooc').map(p => ({ who: p.k === 'say' ? me : null, text: p.t }));
  }
  return sceneSegments(c, m.text);
}

/* ---------- playback ---------- */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let ttsUnlocked = false;
function unlockTTS() {
  if (ttsUnlocked) return; ttsUnlocked = true;
  try { VOICE.audio = VOICE.audio || new Audio(); VOICE.audio.src = SILENT; VOICE.audio.play().catch(() => {}); } catch {}
  if (TTS) try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch {}
}
function stopVoice() {
  VOICE.gen++; VOICE.items = []; VOICE.playing = false;
  try { VOICE.audio?.pause(); } catch {}
  if (TTS) try { speechSynthesis.cancel(); } catch {}
  renderSpeakingState();
}
const voiceBusy = () => VOICE.playing;
const chunk = t => { const out = []; let cur = ''; for (const s of t.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [t]) { if ((cur + s).length > 320 && cur) { out.push(cur.trim()); cur = ''; } cur += s; } if (cur.trim()) out.push(cur.trim()); return out; };
function queueSegments(c, segs, append = false) {
  if (!voiceOn() || !segs.length) return;
  if (!append) stopVoice();
  for (const s of segs) {
    const voice = s.who ? voiceOf(c, s.who.ent, s.who.name) || narratorVoice() : narratorVoice();
    for (const part of chunk(s.text)) VOICE.items.push({ text: part, voice, eng: engine() });
  }
  if (!VOICE.playing) runVoice();
}
function pcClip(item) {
  const speed = Number(S.settings.ui.voiceRate) || 1; const k = item.voice + '|' + speed + '|' + item.text;
  if (VOICE.cache.has(k)) return VOICE.cache.get(k);
  const p = fetch(forgeUrl() + '/iq/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: item.text, voice: item.voice, speed }) })
    .then(r => { if (!r.ok) throw new Error('voice ' + r.status); return r.blob(); }).then(b => URL.createObjectURL(b));
  VOICE.cache.set(k, p); p.catch(() => VOICE.cache.delete(k));
  if (VOICE.cache.size > 60) VOICE.cache.delete(VOICE.cache.keys().next().value);
  return p;
}
function playUrl(url, gen) {
  return new Promise(res => {
    const a = VOICE.audio = VOICE.audio || new Audio();
    const done = () => { a.onended = a.onerror = null; res(); };
    a.onended = done; a.onerror = done; a.src = url;
    a.play().catch(done);
    const watch = setInterval(() => { if (gen !== VOICE.gen) { clearInterval(watch); try { a.pause(); } catch {} done(); } else if (a.ended || a.error) clearInterval(watch); }, 250);
  });
}
function sayDevice(item, gen) {
  return new Promise(res => {
    if (!TTS || gen !== VOICE.gen) return res();
    const u = new SpeechSynthesisUtterance(item.text);
    const v = ttsVoices().find(x => x.name === item.voice); if (v) u.voice = v;
    u.rate = Number(S.settings.ui.voiceRate) || 1; u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
  });
}
async function runVoice() {
  const gen = VOICE.gen; VOICE.playing = true; renderSpeakingState();
  try {
    while (VOICE.items.length && gen === VOICE.gen) {
      const it = VOICE.items.shift();
      if (it.eng === 'pc') {
        const mine = pcClip(it); mine.catch(() => {});
        const next = VOICE.items[0]; if (next?.eng === 'pc') pcClip(next).catch(() => {});   /* make the next line while this one plays */
        let url = null;
        try { url = await mine; } catch (e) { console.warn('PC voice failed, using the device voice', e); VOICE.pc = false; }
        if (gen !== VOICE.gen) break;
        if (url) await playUrl(url, gen); else await sayDevice({ ...it, voice: S.settings.ui.voiceName }, gen);
      } else await sayDevice(it, gen);
    }
  } finally { if (gen === VOICE.gen) { VOICE.playing = false; renderSpeakingState(); } }
}
function renderSpeakingState() { document.body.classList.toggle('speaking', VOICE.playing); musicDuck(VOICE.playing); }

/* ---------- what the rest of the app calls ---------- */
function speakMessage(c, m, append = false) { if (c && m) queueSegments(c, messageSegments(c, m), append); }
function speak(text, voiceName, append = false) {   /* plain text in one voice (tests, short lines) */
  if (!text) return; const c = cur() || { party: [], codex: [], character: {} };
  if (!append) stopVoice();
  VOICE.items.push({ text: cleanSpeech(text), voice: voiceName || narratorVoice(), eng: engine() }); if (!VOICE.playing) runVoice();
}
function autoSpeak(m, c) { if (S.settings.ui.voice === 'auto' && m) speakMessage(c, m, true); }
function voicePickerHTML(attr, current, gender) {
  if (engine() === 'pc') {
    const opt = (id, label) => `<option value="${id}" ${current === id ? 'selected' : ''}>${esc(label)}</option>`;
    const grp = (g, title) => `<optgroup label="${title}">${PC_VOICES[g].map(([id, l]) => opt(id, l)).join('')}</optgroup>`;
    return `<select ${attr}><option value="">Automatic${gender ? ` (${gender === 'f' ? 'female' : 'male'})` : ''}</option>${gender === 'm' ? grp('m', 'Male') + grp('f', 'Female') : grp('f', 'Female') + grp('m', 'Male')}</select>`;
  }
  return `<select ${attr}><option value="">Automatic${gender ? ` (${gender === 'f' ? 'female' : 'male'})` : ''}</option>${ttsVoices().map(v => `<option value="${esc(v.name)}" ${current === v.name ? 'selected' : ''}>${esc(v.name)}${devGender(v) ? ` · ${devGender(v) === 'f' ? 'female' : 'male'}` : ''}</option>`).join('')}</select>`;
}
