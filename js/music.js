'use strict';
/* ---------- background music & ambience ----------
   Tracks live in /music (free CC-BY 4.0 music, credits in music/CREDITS.md and in Game Settings).
   The bookkeeper tags each scene with a "music" mood; the app falls back to combat, tension,
   the place and the genre. Two <audio> players crossfade; music dips while voices speak.
   Ambience (rain, wind, fire, sea, night) is made in the browser from noise: no files needed. */
const MOODS = {
  calm:    { label:'Calm / exploring', tracks:['th-the-forest-awakes','th-daybreak','th-wild-waters','gt-magical-forest'] },
  town:    { label:'Town & tavern',    tracks:['gt-historic-village','th-home','gt-cats-eye-waltz'] },
  travel:  { label:'Journey',          tracks:['gt-long-road','th-lost-islands','th-the-journey-kroc-s-theme'] },
  mystic:  { label:'Magic & wonder',   tracks:['gt-magical-forest','th-a-memory-away','th-fate'] },
  tense:   { label:'Tense / sneaking', tracks:['th-surreptitious','th-ominosity','gt-dark-backstory-march'] },
  battle:  { label:'Battle',           tracks:['th-assault-on-mist-castle','th-reign-of-anarchy','th-now-or-never','gt-rhythm-battle'] },
  dread:   { label:'Dread & horror',   tracks:['th-the-haunting','th-halls-of-despair','th-purgatory-s-mansion','gt-ominous-overworld-drone'] },
  sad:     { label:'Sad / loss',       tracks:['th-hidden-tears','th-remember','gt-moody-and-sad'] },
  triumph: { label:'Victory',          tracks:['gt-the-sky-clears','th-fate'] },
  scifi:   { label:'Sci-fi',           tracks:['th-syntheticity','th-unknown'] }
};
const MOOD_KEYS = Object.keys(MOODS);
const MUSIC_CREDITS = [
  { who:'Tanner Helland', url:'https://github.com/tannerhelland/free-music', lic:'CC BY 4.0', prefix:'th-' },
  { who:'0xabad1dea (Glorytales)', url:'https://github.com/0xabad1dea/glorytales', lic:'CC BY 4.0', prefix:'gt-' }
];
const trackTitle = id => id.replace(/^(th|gt)-/, '').replace(/-s-/g, '\'s ').replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
const trackBy = id => (MUSIC_CREDITS.find(c => id.startsWith(c.prefix)) || MUSIC_CREDITS[0]).who;

const MUSIC = { a: null, b: null, front: null, mood: '', track: '', unlocked: false, duck: false, fadeT: null, last: {}, amb: null };
const musicVol = () => clamp(Number(S.settings.ui.musicVol ?? 0.35), 0, 1) * (MUSIC.duck ? 0.35 : 1);
const musicOn = () => S.settings.ui.music !== false;

/* pick the mood for the current scene */
function musicMood(c) {
  if (!c) return '';
  const fixed = S.settings.ui.musicMood; if (fixed && fixed !== 'auto' && MOODS[fixed]) return fixed;
  const g = `${c.scenario || ''} ${c.genre || ''}`.toLowerCase();
  const scifi = /sci|space|star|cyber|derelict|salvage|future/.test(g), horror = /horror|haunt|eldritch|cosmic/.test(g);
  if (c.combat) return 'battle';
  let m = MOODS[c.mood] ? c.mood : '';
  if (!m) {
    const t = arr(c.tensionLog).slice(-1)[0] ?? 0; const loc = String(c.location || '').toLowerCase();
    if (t >= 7) m = horror ? 'dread' : 'tense';
    else if (/crypt|tomb|catacomb|dungeon|cellar|ruin|grave|swamp|marsh|haunt/.test(loc)) m = 'dread';
    else if (/town|village|inn|tavern|market|city|square|hall|keep|castle|academy|dorm/.test(loc)) m = 'town';
    else if (/road|path|trail|sea|ship|river|pass|wilds|plains|journey/.test(loc)) m = 'travel';
    else m = horror ? 'tense' : 'calm';
  }
  if (scifi && ['calm','town','travel','mystic'].includes(m)) m = 'scifi';
  return m;
}
function nextTrack(mood) {
  const list = MOODS[mood]?.tracks || MOODS.calm.tracks;
  const last = MUSIC.last[mood];
  const pool = list.length > 1 ? list.filter(t => t !== last) : list;
  const t = pool[Math.floor(Math.random() * pool.length)]; MUSIC.last[mood] = t; return t;
}
function musicPlayers() {
  if (!MUSIC.a) for (const k of ['a', 'b']) { const el = new Audio(); el.preload = 'auto'; el.loop = false; el.volume = 0; el.onended = () => { if (el === MUSIC.front) playMusic(MUSIC.mood, true); }; MUSIC[k] = el; }
  return [MUSIC.a, MUSIC.b];
}
function fadeTo(el, target, ms, then) {
  const start = el.volume, t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms); try { el.volume = clamp(start + (target - start) * k, 0, 1); } catch {} if (k < 1) el._raf = requestAnimationFrame(step); else then?.(); };
  cancelAnimationFrame(el._raf); el._raf = requestAnimationFrame(step);
}
function playMusic(mood, force = false) {
  if (!musicOn() || !MUSIC.unlocked || !mood) return;
  if (mood === MUSIC.mood && !force && MUSIC.front && !MUSIC.front.paused) return;
  const [a, b] = musicPlayers(); const old = MUSIC.front; const nu = old === a ? b : a;
  MUSIC.mood = mood; MUSIC.track = nextTrack(mood);
  nu.src = `music/${MUSIC.track}.mp3`; nu.volume = 0;
  nu.play().then(() => fadeTo(nu, musicVol(), 2500)).catch(() => {});
  MUSIC.front = nu;
  if (old && !old.paused) fadeTo(old, 0, 2500, () => { try { old.pause(); } catch {} });
  renderMusicNow();
}
function stopMusic(ms = 1500) {
  MUSIC.mood = ''; MUSIC.track = '';
  for (const el of [MUSIC.a, MUSIC.b]) if (el && !el.paused) fadeTo(el, 0, ms, () => { try { el.pause(); } catch {} });
  renderMusicNow();
}
function musicLevel() { if (MUSIC.mood && MUSIC.front && !MUSIC.front.paused) fadeTo(MUSIC.front, musicVol(), 600); ambLevel(); }
function musicDuck(on) { if (MUSIC.duck === !!on) return; MUSIC.duck = !!on; musicLevel(); }
function unlockMusic() {
  if (MUSIC.unlocked) return; MUSIC.unlocked = true;
  musicPlayers().forEach(el => { try { el.src = SILENT; el.play().then(() => el.pause()).catch(() => {}); } catch {} });
  setTimeout(() => musicScene(cur() && S.view === 'game' ? cur() : null), 50);
}
/* called whenever the scene may have changed */
function musicScene(c) {
  if (!c || S.view !== 'game') { stopMusic(); ambScene(null); return; }
  if (musicOn()) playMusic(musicMood(c)); else stopMusic(600);
  ambScene(c);
}
function musicSkip() { if (MUSIC.mood) playMusic(MUSIC.mood, true); }
function renderMusicNow() { const n = document.getElementById('musicNow'); if (n) n.innerHTML = musicNowHTML(); }
function musicNowHTML() {
  if (!musicOn()) return 'Music is off.';
  if (!MUSIC.unlocked) return 'Music starts when you tap anything in a game.';
  if (!MUSIC.track) return S.view === 'game' ? 'Waiting for the next scene…' : 'Music plays during games.';
  return `Now playing: <b>${esc(trackTitle(MUSIC.track))}</b> by ${esc(trackBy(MUSIC.track))} · <i>${esc(MOODS[MUSIC.mood]?.label || '')}</i> <button class="link" data-act="musicskip">Next track</button>`;
}

/* ---------- ambience, made from noise ---------- */
const AMB = { ctx: null, nodes: {}, kind: '' };
const ambOn = () => S.settings.ui.ambience !== false;
const ambVol = () => clamp(Number(S.settings.ui.ambVol ?? 0.25), 0, 1) * (MUSIC.duck ? 0.5 : 1);
function ambKind(c) {
  if (!c) return '';
  const w = String(c.time?.weather || '').toLowerCase(), loc = String(c.location || '').toLowerCase(), part = String(c.time?.part || '');
  if (/storm|rain|drizzle|downpour|shower/.test(w)) return 'rain';
  if (/sea|ship|coast|harbor|harbour|beach|dock|shore|pier/.test(loc)) return 'sea';
  if (/wind|gale|blizzard|snow|gust/.test(w) || /peak|mountain|cliff|tower top|tundra|pass\b/.test(loc)) return 'wind';
  if (/campfire|camp|hearth|fireplace|tavern|inn\b/.test(loc)) return 'fire';
  if (/night/.test(part) && !/city|town|station|ship/.test(loc)) return 'night';
  return '';
}
function noiseBuffer(ctx, brown) {
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return buf;
}
function ambBuild(kind) {
  const ctx = AMB.ctx; const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, kind !== 'rain'); src.loop = true;
  const f = ctx.createBiquadFilter(); const lfo = ctx.createOscillator(); const lfoG = ctx.createGain(); const stops = [src, lfo];
  if (kind === 'rain')  { f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4; lfo.frequency.value = 0.07; lfoG.gain.value = 250; lfoG.connect(f.frequency); }
  if (kind === 'wind')  { f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 4; lfo.frequency.value = 0.11; lfoG.gain.value = 320; lfoG.connect(f.frequency); }
  if (kind === 'sea')   { f.type = 'lowpass'; f.frequency.value = 700; lfo.frequency.value = 0.09; lfoG.gain.value = 0.5; const sw = ctx.createGain(); sw.gain.value = 0.6; lfoG.connect(sw.gain); f.connect(sw); sw.connect(out); }
  if (kind === 'fire' || kind === 'night') { f.type = 'lowpass'; f.frequency.value = kind === 'fire' ? 300 : 180; lfo.frequency.value = 0.05; lfoG.gain.value = 40; lfoG.connect(f.frequency); }
  lfo.connect(lfoG); src.connect(f); if (kind !== 'sea') f.connect(out);
  let timer = null;
  if (kind === 'fire') timer = setInterval(() => { if (Math.random() < 0.55) ambPop(ctx, out, 1800 + Math.random() * 2500, 0.012, 0.5); }, 140);
  if (kind === 'night') timer = setInterval(() => { if (Math.random() < 0.5) ambChirp(ctx, out); }, 900);
  src.start(); lfo.start();
  return { out, stop: () => { clearInterval(timer); stops.forEach(n => { try { n.stop(); } catch {} }); setTimeout(() => out.disconnect(), 50); } };
}
function ambPop(ctx, out, freq, dur, vol) {
  const o = ctx.createBufferSource(); o.buffer = noiseBuffer.cache || (noiseBuffer.cache = noiseBuffer(ctx, false));
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
  const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(bp); bp.connect(g); g.connect(out); o.start(t, Math.random() * 3, dur + 0.02);
}
function ambChirp(ctx, out) {   /* crickets */
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 4200 + Math.random() * 600;
  g.gain.value = 0; o.connect(g); g.connect(out);
  for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(0.06, t + i * 0.06); g.gain.setValueAtTime(0, t + i * 0.06 + 0.03); }
  o.start(t); o.stop(t + 0.2);
}
function ambScene(c) {
  const kind = ambOn() && MUSIC.unlocked ? ambKind(c) : '';
  if (kind === AMB.kind) return;
  const old = AMB.nodes; AMB.kind = kind; AMB.nodes = {};
  if (old.out) { const g = old.out.gain; try { g.setTargetAtTime(0, AMB.ctx.currentTime, 0.6); } catch {} setTimeout(() => old.stop(), 2500); }
  if (!kind) return;
  try { AMB.ctx = AMB.ctx || new (window.AudioContext || window.webkitAudioContext)(); AMB.ctx.resume?.(); } catch { return; }
  AMB.nodes = ambBuild(kind); ambLevel();
}
function ambLevel() { if (AMB.nodes.out && AMB.ctx) try { AMB.nodes.out.gain.setTargetAtTime(ambVol() * (AMB.kind === 'night' ? 0.6 : 1), AMB.ctx.currentTime, 0.8); } catch {} }
const AMB_LABEL = { rain:'Rain', wind:'Wind', sea:'Waves', fire:'Fire crackle', night:'Night crickets' };
