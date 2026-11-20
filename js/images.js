'use strict';
/* ---------- Stable Diffusion on your own PC (Forge / AUTOMATIC1111 API) ---------- */
const FORGE_PRESETS = {
  lightning: { label:'SDXL Lightning — realistic and fast (recommended)', base:'xl', steps:6, cfg:1.5, sampler:'DPM++ SDE', scheduler:'Karras' },
  sdxl:      { label:'SDXL standard — most detail, slow', base:'xl', steps:28, cfg:5, sampler:'DPM++ 2M', scheduler:'Karras' },
  sd15:      { label:'SD 1.5 — fastest, smaller pictures', base:'15', steps:25, cfg:6, sampler:'DPM++ 2M', scheduler:'Karras' }
};
const FORGE_SIZES = { xl: { landscape:[1216,832], square:[1024,1024], portrait:[832,1216], wide:[1344,768] }, '15': { landscape:[768,512], square:[512,512], portrait:[512,768], wide:[896,512] } };
const FORGE_NEG = 'cartoon, anime, illustration, painting, drawing, sketch, 3d render, cgi, plastic skin, airbrushed, deformed, disfigured, extra fingers, bad hands, bad anatomy, blurry, lowres, watermark, text, logo, signature, jpeg artifacts';
/* the standing additions from Settings → Images, on every picture */
function picLook() { return String(S.settings.image.look || '').replace(/\s+/g, ' ').trim().slice(0, 300); }
function picAvoid() { return String(S.settings.image.avoid || '').replace(/\s+/g, ' ').trim().slice(0, 400); }
/* what is actually sent to the painter (our own cache key stays based on the picture's own prompt) */
function forgeBodyPrompt(prompt) { return [prompt, picLook()].filter(Boolean).join(', '); }
function forgeBodyNeg(neg, safe) {
  const s = S.settings.image;
  return [(s.forgeNeg || '').trim() || FORGE_NEG, neg, picAvoid(), safe ? SAFE_NEG : ''].filter(Boolean).join(', ');
}
const PHOTO_STYLE = 'photorealistic, cinematic film still, 35mm photograph, natural lighting, detailed skin texture, shallow depth of field, sharp focus';
/* ---------- portraits in the character builder ---------- */
const draftCtx = D => ({ rating: D.rating, artStyle: D.art, character: { storyRole: D.storyRole, appearance: lookOf(D), backstory: D.backstory } });
function draftPortraitHTML(D) {
  if (S.settings.image.mode === 'off') return '<p class="hint">Turn on pictures in Settings → Images to paint a portrait here.</p>';
  const p = D.portrait;
  return `<div class="dport">${p ? `<img class="port xl" src="${esc(imageUrl(p, draftCtx(D)))}" alt="Portrait">` : `<div class="port xl ph2">${esc((D.name || '?')[0])}</div>`}
    <div><div class="hint" style="margin:0 0 8px">${p ? 'Your character\'s portrait. Change the appearance and paint again until it looks right.' : 'Paint your character from the appearance above.'}${S.settings.image.mode === 'local' ? ' On your PC this takes 20 seconds to 2 minutes.' : ''}</div>
    <div class="row"><button class="btn sm gold" data-act="draftport">${icon('image')} ${p ? 'Paint again' : 'Paint portrait'}</button>${(() => { const per = myPersona(); return per?.portrait ? `<button class="btn sm ghost" data-act="draftpersonaport">Use ${esc(per.name)}'s photo</button>` : ''; })()}${p ? '<button class="btn sm ghost" data-act="draftportdel">Remove</button>' : ''}</div></div></div>`;
}
/* ---------- SFW / NSFW picture models ----------
   Models are shown as "SFW" / "NSFW", never by file name. An adventure only uses the NSFW model when it is rated
   M (Mature) AND nothing about the player character suggests they are under 16. Any single picture whose
   description mentions a child or teen goes to the SFW model with sexual content blocked, whatever the rating. */
const NSFW_NAME = /porn|nsfw|lust|xxx|hentai|sex|nude|naked|erot|lewd|adult|r18|18\+/i;
/* Whether a picture may use the explicit model is decided in js/ageguard.js (AGE.imageAllowed),
   the same rule that decides what the story text may contain. */
const SAFE_NEG = 'nsfw, nude, naked, nudity, nipples, topless, lingerie, sexual, explicit';
const modelKind = m => NSFW_NAME.test(m) ? 'nsfw' : 'sfw';
function modelLabel(m) {
  if (!m) return 'Whatever Forge has loaded';
  const all = [...new Set([...(S.forgeModels || []), S.settings.image.forgeModelSfw, S.settings.image.forgeModelNsfw].filter(Boolean))];
  const same = all.filter(x => modelKind(x) === modelKind(m)); const n = same.indexOf(m);
  return (modelKind(m) === 'nsfw' ? 'NSFW' : 'SFW') + (same.length > 1 ? ' ' + (n + 1) : '');
}
function autoAssignModels() {
  const im = S.settings.image; const all = S.forgeModels || [];
  if (!im.forgeModelSfw && im.forgeModel && modelKind(im.forgeModel) === 'sfw') im.forgeModelSfw = im.forgeModel;
  if (!im.forgeModelNsfw && im.forgeModel && modelKind(im.forgeModel) === 'nsfw') im.forgeModelNsfw = im.forgeModel;
  if (!im.forgeModelSfw || (all.length && !all.includes(im.forgeModelSfw))) im.forgeModelSfw = all.find(m => modelKind(m) === 'sfw') || all[0] || '';
  if (!im.forgeModelNsfw || (all.length && !all.includes(im.forgeModelNsfw))) im.forgeModelNsfw = all.find(m => modelKind(m) === 'nsfw') || '';
  saveSettings();
}
function pickForgeModel(c, prompt, subject = null, wanted = '') {
  const im = S.settings.image;
  const guard = AGE.imageAllowed({ prompt, campaign: c, subject });
  const unsafe = !guard.allowed;
  const adult = normRating(c?.rating) === 'M' && !unsafe;
  /* a model chosen on the picture wins, but never past the age guard: a minor always gets the safe model */
  const want = unsafe ? '' : String(wanted || '').trim();
  const auto = (adult && im.forgeModelNsfw) || im.forgeModelSfw || im.forgeModel || '';
  const model = want || auto;
  return { model, safe: !adult, kind: adult && model && model === im.forgeModelNsfw ? 'nsfw' : 'sfw' };
}
/* "Auto" reads the model's file name: Lightning/Turbo/Hyper/DMD/LCM models need few steps; anything else gets the standard SDXL settings */
function forgePresetKey(model) {
  const s = S.settings.image; const k = s.forgePreset || 'auto';
  if (k !== 'auto' && FORGE_PRESETS[k]) return k;
  const m = String(model ?? s.forgeModelSfw ?? s.forgeModel ?? '');
  if (/lightning|turbo|hyper|dmd|lcm/i.test(m)) return 'lightning';
  if (/sd[-_ ]?1\.?5|sd15|v1-5|realistic[-_ ]?vision/i.test(m)) return 'sd15';
  return m ? 'sdxl' : 'lightning';
}
const forgeUrl = () => String(LS.get('iq.forgeUrl', '') || 'http://localhost:7861').trim().replace(/\/+$/, '');
const LOCAL = { url: {}, fail: {}, jobs: {}, queue: [], running: false, found: false };
function hashStr(s) { let h1 = 0x811c9dc5, h2 = 0x9e3779b1; for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 16777619); h2 = Math.imul(h2 ^ ch, 2246822507); } return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16); }
const IDB = {
  db: null,
  open() { if (!this.db) this.db = new Promise((res, rej) => { const r = indexedDB.open('ironquill-images', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return this.db; },
  async get(k) { try { const db = await this.open(); return await new Promise(res => { const q = db.transaction('img').objectStore('img').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } },
  async put(k, v) { try { const db = await this.open(); await new Promise(res => { const t = db.transaction('img', 'readwrite'); t.objectStore('img').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch {} }
};
function forgeJob(prompt, seed, c, neg = '', ref = null, subject = null, model = '') {
  const s = S.settings.image; const pick = pickForgeModel(c, prompt, subject, model); const pk = forgePresetKey(pick.model); const P = FORGE_PRESETS[pk];
  const [FW, FH] = FORGE_SIZES[P.base][s.size] || FORGE_SIZES[P.base].square;
  /* "Fast" draws SDXL pictures at 3/4 size: about half the pixels, so roughly twice as quick on smaller cards */
  const small = [Math.round(FW * 0.75 / 64) * 64, Math.round(FH * 0.75 / 64) * 64];
  const fast = P.base === 'xl' && (s.forgeRes || 'fast') === 'fast';
  const [W, H] = fast ? small : [FW, FH];
  const keyOf = (w, h) => 'k' + hashStr([prompt, seed, w, h, pk, pick.model, pick.safe, s.forgeNeg, ...(neg ? [neg] : []), ...(ref ? ['ref:' + ref.key + ':' + (Number(s.refWeight) || 0.7)] : [])].join('|'));
  /* a picture already painted at the other size is reused instead of painted again */
  const alt = P.base === 'xl' ? (fast ? keyOf(FW, FH) : keyOf(small[0], small[1])) : '';
  return { prompt, seed, W, H, P, model: pick.model, safe: pick.safe, k: keyOf(W, H), alt, neg, ref };
}
const localPH = k => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><desc>${k}</desc></svg>`);
const localFailURL = k => 'data:,fail-' + k;
function localImageUrl(prompt, seed, c, neg = '', ref = null, subject = null, model = '') {
  const job = forgeJob(prompt, seed, c, neg, ref, subject, model);
  /* which game this picture belongs to, so Drive can file it in that game's own Photos folder */
  job.ctx = c && c.id ? { id: c.id, folder: c.driveFolder || '', title: c.title || 'Adventure' } : null;
  if (LOCAL.url[job.k]) return LOCAL.url[job.k];
  if (LOCAL.fail[job.k] && Date.now() - (LOCAL.failAt?.[job.k] || 0) < 30000) return localFailURL(job.k);
  if (LOCAL.fail[job.k]) delete LOCAL.fail[job.k];
  if (!LOCAL.jobs[job.k]) { LOCAL.jobs[job.k] = job; LOCAL.queue.push(job); setTimeout(pumpLocal, 0); }
  return localPH(job.k);
}
async function pumpLocal() {
  if (LOCAL.running) return; LOCAL.running = true;
  try {
    while (LOCAL.queue.length) {
      /* never paint while the story AI is mid-turn: they'd fight over the graphics card (low-memory warnings, slow turns) */
      for (let w = 0; S.busy && S.settings.image.forgeShare !== false && w < 600; w++) await new Promise(r => setTimeout(r, 1000));
      const job = LOCAL.queue.pop();   /* newest first: the scene you're looking at paints before old thumbnails */
      try {
        let blob = await IDB.get(job.k);
        if (!blob) { blob = await DriveImg.get(job.k); if (blob) IDB.put(job.k, blob); }
        if (!blob && job.alt) { blob = await IDB.get(job.alt) || await DriveImg.get(job.alt); if (blob) IDB.put(job.k, blob); }
        if (!blob) { blob = await forgeGenerate(job); await IDB.put(job.k, blob); if (S.settings.image.driveSave !== false && Drive.configured()) DriveImg.queue(job.k, job.ctx); }
        LOCAL.url[job.k] = URL.createObjectURL(blob);
      } catch (e) { LOCAL.fail[job.k] = e.message || String(e); (LOCAL.failAt = LOCAL.failAt || {})[job.k] = Date.now(); }
      LOCAL.cur = null; delete LOCAL.jobs[job.k]; swapLocal(job.k);
    }
  } finally { LOCAL.running = false; }
}
let libRefresh = null;
function swapLocal(k) {
  const ph = localPH(k); const nu = LOCAL.url[k] || localFailURL(k);
  document.querySelectorAll('img').forEach(im => { if (im.getAttribute('src') === ph) im.src = nu; });
  if (S.view === 'library' && LOCAL.url[k]) { clearTimeout(libRefresh); libRefresh = setTimeout(() => { if (S.view === 'library' && !S.modal) renderLibrary(); }, 400); }
}
async function freeOllamaVRAM() {
  if (S.busy) return;   /* never pull the story AI out from under a turn that's running */
  for (const cn of conns()) {
    if (cn.preset !== 'ollama' || !cn.model) continue;
    try { await fetch(cn.baseUrl.replace(/\/v1\/?$/, '') + '/api/generate', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ model: cn.model, keep_alive: 0 }) }); } catch {}
  }
}
/* ---------- the VRAM bump ----------
   When replies or pictures start crawling, something is sitting in the graphics card's memory that
   isn't needed right now. The helper on the PC knows how to unload both engines (Ollama models and
   Forge's checkpoint); this asks it to. It never pulls a model out from under a reply that is writing. */
/* No fixed trigger: a 12B model on a 1070 Ti takes far longer than a cloud model on a good day, so
   "normal" is learned per model (the middle of the last few timings) and the bump waits for about two
   and a half times that. A model with no history yet gets two minutes. */
const BUMP_MIN = 45000;          /* never before this, however fast the model is */
const BUMP_SLOW = 2.5;           /* this many times normal counts as crawling */
const BUMP_COLD = 120000;        /* no timings for this model yet: two minutes */
const BUMP_KEEP = 12;            /* timings that make "normal" */
const BUMP_MAX_SAMPLE = 300000;  /* a tab left open isn't a real timing */
const bumpTimes = LS.get('iq.bumpTimes', null) || {};
let bumpBusy = false, bumpAt = 0;
const bumpOn = () => S.settings.ai.bump !== false;
/* the helper version that knows how to free memory; an older one answers /iq/health but not /iq/bump */
const HELPER_BUMP = 4;
let helperV = null, helperVAt = 0;
async function helperVersion(force) {
  if (!force && helperV !== null && Date.now() - helperVAt < 60000) return helperV;
  try {
    /* health also probes Forge and SearXNG, so give it room: 4 s + 5 s when neither is up yet */
    const r = await fetch(forgeUrl() + '/iq/health', { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
    helperV = r.ok ? (num((await r.json().catch(() => ({}))).helper) || 0) : 0;   /* 0: answering, but not the helper */
  } catch { helperV = -1; }   /* -1: nothing answering at that address */
  helperVAt = Date.now();
  return helperV;
}
/* one plain sentence for why a bump did nothing, instead of failing silently */
function bumpProblem(v) {
  if (v <= 0) return `Couldn't reach the picture helper at ${forgeUrl()}. If its window is already open, close it and run Start Outer Realm.bat (freeing VRAM needs the updated helper); otherwise start it.`;
  if (v < HELPER_BUMP) return `The picture helper running now is v${v}; freeing VRAM needs v${HELPER_BUMP}. Close its window and run Start Outer Realm.bat, then try again.`;
  return 'The helper answered but could not free memory this time. Its window says why.';
}
/* shown in Settings → Images, so an out-of-date helper is visible before you click anything */
function helperNoteHTML() {
  if (helperV === null) {
    helperVersion().then(() => { if (S.modal === 'settings') renderModal(); });
    return '<p class="hint">Checking the picture helper…</p>';
  }
  if (helperV <= 0) return `<p class="hint">✗ No picture helper answering at <code>${esc(forgeUrl())}</code>: Free VRAM needs it running next to Forge.</p>`;
  if (helperV < HELPER_BUMP) return `<p class="hint">✗ The helper running now is v${helperV}; Free VRAM needs v${HELPER_BUMP}. Restart it: close its window and run <b>Start Outer Realm.bat</b>.</p>`;
  return `<p class="hint">✓ Helper v${helperV}: Free VRAM is ready.</p>`;
}
function bumpKey(kind) {
  if (kind === 'picture') { const im = S.settings.image; return `picture|${im.forgeModelSfw || im.forgeModel || 'auto'}|${im.forgePreset || 'auto'}`; }
  const cn = typeof activeConn === 'function' ? activeConn() : null;
  return `reply|${cn?.preset || ''}|${cn?.model || ''}`;
}
/* the middle timing, so one slow reply (or one quick one) doesn't move the line */
function bumpNormal(kind) {
  const list = bumpTimes[bumpKey(kind)];
  const xs = (Array.isArray(list) ? list : []).slice(-BUMP_KEEP).sort((a, b) => a - b);
  return xs.length >= 3 ? xs[Math.floor(xs.length / 2)] : 0;
}
function bumpWait(kind) {
  const normal = bumpNormal(kind);
  return normal ? Math.max(BUMP_MIN, normal * BUMP_SLOW) : BUMP_COLD;
}
function bumpNote(kind, ms) {
  if (!(ms >= 3000)) return;   /* stopped, cancelled or failed instantly: not a real timing */
  const k = bumpKey(kind);
  bumpTimes[k] = [...(Array.isArray(bumpTimes[k]) ? bumpTimes[k] : []), Math.round(Math.min(ms, BUMP_MAX_SAMPLE))].slice(-BUMP_KEEP);
  LS.set('iq.bumpTimes', bumpTimes);
}
async function bumpVRAM(target = 'both') {
  if (!bumpOn() || bumpBusy) return false;
  const doForge = target !== 'ollama';
  const doOllama = target !== 'forge' && !S.busy && !S.palBusy;   /* never mid-reply */
  if (!doForge && !doOllama) return false;
  bumpBusy = true;
  try {
    const r = await fetch(forgeUrl() + '/iq/bump', { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ollama: doOllama, forge: doForge }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined });
    if (!r.ok) { toast(bumpProblem(await helperVersion(true)), 9000); return false; }
    const j = await r.json().catch(() => ({}));
    bumpAt = Date.now(); helperV = HELPER_BUMP; helperVAt = Date.now();
    const freed = [String(j.ollama || '').startsWith('unloaded') ? 'story AI' : '', j.forge === 'unloaded' ? 'picture model' : ''].filter(Boolean);
    if (freed.length) toast(`Freed graphics memory: ${freed.join(' + ')}.`);
    return true;
  } catch { toast(bumpProblem(await helperVersion(true)), 9000); return false; }
  finally { bumpBusy = false; }
}
/* Fires once if this step runs far past normal for this model; call what it returns when the step ends,
   so the timing feeds the next "normal" (kind is 'reply' or 'picture'). */
function slowBump(kind = 'reply') {
  if (!bumpOn()) return () => {};
  const wait = bumpWait(kind), t0 = Date.now();
  const t = setTimeout(() => bumpVRAM(kind === 'picture' ? 'ollama' : 'forge'), wait);
  return () => { clearTimeout(t); bumpNote(kind, Date.now() - t0); };
}
/* is there an IP-Adapter face model in Forge? (asked once, then every few minutes) */
async function cnFind(force) {
  if (!force && LOCAL.cn !== undefined && Date.now() - (LOCAL.cnAt || 0) < 300000) return LOCAL.cn;
  LOCAL.cnAt = Date.now();
  try {
    const get = async p => { const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 5000); try { const r = await fetch(forgeUrl() + p, { signal: ctl.signal }); return r.ok ? await r.json() : null; } finally { clearTimeout(tm); } };
    const [m, p] = await Promise.all([get('/controlnet/model_list'), get('/controlnet/module_list')]);
    if (!m || !p) { LOCAL.cn = null; S.cnStatus = '✗ Forge\'s ControlNet isn\'t answering, so reference photos are off. Pictures still use the saved look.'; return null; }
    const xl = FORGE_PRESETS[forgePresetKey()].base === 'xl';
    const all = arr(m.model_list).filter(x => /ip.?adapter/i.test(x) && !/instant/i.test(x)); const fit = all.filter(x => xl ? /xl/i.test(x) : !/xl/i.test(x)); const pool = fit.length ? fit : all;
    const model = pool.find(x => /plus.?face/i.test(x)) || pool.find(x => /face/i.test(x) && !/faceid/i.test(x)) || pool.find(x => /face/i.test(x)) || pool[0];
    const mods = arr(p.module_list);
    const want = !model ? [] : /faceid/i.test(model) ? [/insightface.*clip/i, /face_?id_?plus/i, /face_?id/i] : /vit-?g|bigg/i.test(model) ? [/bigg|clip_g\b|clip-vit-g/i] : [/clip-?vit-?h|clip_h\b|vit-?h|clip_sdxl_plus_vith/i];
    const module = model && (want.map(r => mods.find(x => r.test(x))).find(Boolean) || mods.find(x => /ip-adapter-auto/i.test(x)) || mods.find(x => /ip.?adapter/i.test(x)));
    if (!model || !module) { LOCAL.cn = null; S.cnStatus = '✗ No IP-Adapter face model found in Forge, so reference photos are off. Pictures still use the saved look.'; return null; }
    LOCAL.cn = { model, module }; S.cnStatus = `✓ Reference photos ready (${model.replace(/\s*\[[^\]]*\]$/, '')})`;
  } catch (e) { LOCAL.cn = null; S.cnStatus = '✗ Couldn\'t ask Forge about reference photos: ' + (e.message || e); }
  return LOCAL.cn;
}
async function forgeGenerate(job, retried = false, noRef = false) {
  const s = S.settings.image;
  if (s.forgeShare !== false) await freeOllamaVRAM();
  /* the character's reference photo keeps the face: sent to Forge's IP-Adapter, and skipped (never fails the picture) when that isn't set up */
  let unit = null;
  if (job.ref && !noRef && s.refPhotos !== false) {
    try { const cn = await cnFind(); const b64 = cn ? await job.ref.get() : null;
      if (cn && b64) unit = { enabled: true, image: String(b64).replace(/^data:[^,]+,/, ''), module: cn.module, model: cn.model, weight: clamp(Number(s.refWeight) || 0.7, 0.2, 1.2), resize_mode: 'Crop and Resize', processor_res: 512, guidance_start: 0, guidance_end: 1, control_mode: 'Balanced', pixel_perfect: false };
    } catch (e) { console.warn('Reference photo skipped', e); }
  }
  const body = { prompt: forgeBodyPrompt(job.prompt), negative_prompt: forgeBodyNeg(job.neg, job.safe), seed: job.seed, width: job.W, height: job.H, steps: job.P.steps, cfg_scale: job.P.cfg,
    sampler_name: job.P.sampler, scheduler: job.P.scheduler, batch_size: 1, n_iter: 1, send_images: true, save_images: false };
  if (job.model) { body.override_settings = { sd_model_checkpoint: job.model }; body.override_settings_restore_afterwards = false; }
  if (unit) body.alwayson_scripts = { ControlNet: { args: [unit] } };
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 360000);
  LOCAL.cur = { k: job.k, ctl, t: Date.now() };
  const doneBump = slowBump('picture');   /* slow picture: free the story AI's models if they are parked in the card */
  let r;
  try { r = await fetch(forgeUrl() + '/sdapi/v1/txt2img', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); }
  catch (e) {
    clearTimeout(tm); doneBump();
    if (e.name === 'AbortError') throw new Error(LOCAL.cancelled === job.k ? 'Cancelled.' : 'Your PC took more than 6 minutes on one picture. Try the SDXL Lightning or SD 1.5 preset.');
    if (!retried && await forgeFind(true)) return forgeGenerate(job, true, noRef);
    throw new Error(`Couldn't reach Stable Diffusion at ${forgeUrl()}. Make sure Forge is running on your PC (with the --api and --cors-allow-origins settings from the guide).`);
  }
  clearTimeout(tm); doneBump();
  if (!r.ok && unit) { const t = await r.text().catch(() => ''); console.warn('Forge refused the reference photo, painting without it', r.status, t.slice(0, 200)); LOCAL.cn = null; LOCAL.cnAt = Date.now(); S.cnStatus = `✗ Forge refused the reference photo (error ${r.status}), so it is off for a few minutes. Pictures still use the saved look.`; return forgeGenerate(job, retried, true); }
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`Stable Diffusion error ${r.status}${r.status === 404 ? ' (the API is off: add --api to Forge\'s settings)' : ''}: ${t.slice(0, 160)}`); }
  const j = await r.json(); const b64 = j.images?.[0]; if (!b64) throw new Error('Stable Diffusion sent back no picture.');
  const img = new Image(); img.src = 'data:image/png;base64,' + String(b64).replace(/^data:[^,]+,/, ''); await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext('2d').drawImage(img, 0, 0);
  return await new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.9));
}
async function forgeFind(silent) {
  /* 7861 is the Ironquill picture bridge (adds the CORS header Forge leaves out); 7860 is Forge itself */
  const cands = [LS.get('iq.forgeUrl', ''), 'http://localhost:7861', 'http://127.0.0.1:7861', 'http://localhost:7860', 'http://127.0.0.1:7860'];
  for (const cn of conns()) { const m = String(cn.baseUrl || '').match(/^https:\/\/[^/:]+\.ts\.net/); if (m) cands.push(m[0] + ':8443'); }
  if (!silent) { S.forgeStatus = 'Looking for Stable Diffusion…'; renderModal(); }
  for (const u of [...new Set(cands.filter(Boolean).map(x => String(x).replace(/\/+$/, '')))]) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(u + '/sdapi/v1/sd-models', { signal: ctl.signal }); clearTimeout(tm);
      if (!r.ok) continue;
      S.forgeModels = (await r.json()).map(x => x.title || x.model_name).filter(Boolean);
      LS.set('iq.forgeUrl', u); LOCAL.found = true; autoAssignModels(); cnFind(true).then(() => { if (S.modal === 'settings') renderModal(); });
      S.forgeStatus = `✓ Found Stable Diffusion at ${u} · ${S.forgeModels.length} model${S.forgeModels.length === 1 ? '' : 's'} (${S.forgeModels.map(modelLabel).join(', ')})`;
      if (!silent || S.modal === 'settings') renderModal();
      return true;
    } catch {}
  }
  if (!silent) { S.forgeStatus = '✗ Couldn\'t find it. Are Forge and the picture helper window running on your PC? On your phone, is Tailscale connected and the 8443 line pointing to 7861?'; renderModal(); }
  return false;
}
function forgeSettingsHTML() {
  const im = S.settings.image; const models = S.forgeModels || [];
  return `<p class="hint" style="color:var(--ink)">Pictures are painted by Stable Diffusion (Forge) running on your PC: free, no limits, no filter, and the most realistic option. See the README section "Realistic pictures on your PC" to install it.</p>
    <label class="f"><span>Forge address on this device</span><input type="text" id="forgeUrlIn" value="${esc(forgeUrl())}" placeholder="http://localhost:7861"></label>
    <p class="hint">On the PC: <code>http://localhost:7861</code> (the picture bridge). On your phone: your Tailscale address with <code>:8443</code> (e.g. <code>https://michael.tailfc0cb4.ts.net:8443</code>). <b>Find it</b> tries both.</p>
    <div class="row"><button class="btn sm gold" data-act="forgefind">Find it &amp; load models</button></div>
    ${S.forgeStatus ? `<p class="hint">${esc(S.forgeStatus)}</p>` : ''}
    ${(() => { const all = [...new Set([...models, im.forgeModelSfw, im.forgeModelNsfw].filter(Boolean))];
      const opts = sel => all.map(m => `<option value="${esc(m)}" ${sel === m ? 'selected' : ''}>${modelLabel(m)}</option>`).join('');
      return `<label class="f"><span>Pictures for regular adventures</span><select data-bind="image.forgeModelSfw">${all.length ? opts(im.forgeModelSfw) : '<option value="">Tap "Find it" to load models</option>'}</select></label>
      <label class="f"><span>Pictures for M (Mature) adventures</span><select data-bind="image.forgeModelNsfw"><option value="" ${im.forgeModelNsfw ? '' : 'selected'}>Same as regular (SFW)</option>${opts(im.forgeModelNsfw)}</select></label>
      <p class="hint">The app chooses for you: M (Mature) adventures use the NSFW model, everything else uses SFW. If the player character might be under 16, or a picture shows a child or teen, the SFW model is used with adult content blocked.</p>
      ${all.length ? `<details style="margin-top:6px"><summary class="hint" style="cursor:pointer">Show file names</summary><p class="hint">${all.map(m => `${modelLabel(m)}: ${esc(m)}`).join('<br>')}</p></details>` : ''}`; })()}
    <label class="f"><span>Quality preset</span><select data-bind="image.forgePreset"><option value="auto" ${(im.forgePreset || 'auto') === 'auto' ? 'selected' : ''}>Auto: match each model</option>${Object.entries(FORGE_PRESETS).map(([k, v]) => `<option value="${k}" ${im.forgePreset === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <p class="hint">Auto picks the right speed settings for each model: fast for the SFW model, standard SDXL for the NSFW one.</p>
    <div class="sect" style="font-size:18px">Reference photos (keep the same face)</div>
    ${bindCheck('image.refPhotos', 'Use each character\'s reference photo when painting them, so their face stays the same')}
    ${slider('image.refWeight', 'How closely to follow the reference photo', 0.3, 1, 0.05, v => Math.round(v * 100) + '%')}
    <p class="hint">${esc(S.cnStatus || 'Not checked yet.')} <button class="link" data-act="cnfind">Check again</button></p>
    <p class="hint">Needs an IP-Adapter face model in Forge's ControlNet models folder (for SDXL, for example <code>ip-adapter-plus-face_sdxl_vit-h</code>), then restart Forge. Pick a reference by opening any picture of a character large and tapping "Use this picture as … reference". Without the model, pictures use the saved look only. Higher follows the face more closely but leaves less room for the pose you ask for.</p>
    ${bindCheck('image.driveSave', 'Save pictures to Google Drive (your phone and PC share them, and the phone can show them even when Forge isn\'t reachable)')}
    ${bindCheck('image.forgeShare', 'Pictures and the story AI share one graphics card (pictures wait for the GM\'s turn and free the story AI\'s memory first). Turn this OFF if Forge runs on its own second graphics card.')}
    ${bindCheck('ai.bump', 'Free VRAM automatically when a reply or a picture starts taking a long time')}
    <div class="row" style="margin:-2px 0 8px"><button class="btn sm ghost" data-act="vrambump">Free VRAM now</button></div>
    <p class="hint">The bump asks the picture helper to unload the story AI's loaded models and Forge's painting model from the graphics card, then carries on. It learns how long your model normally takes here and only fires once something runs about two and a half times longer than that (never before 45 seconds; two minutes for a model it hasn't timed yet), so a slow model on a normal day doesn't trigger it. It never interrupts a reply that is being written.${bumpAt ? ` Last freed ${esc(ago(bumpAt))}.` : ''}</p>
    ${helperNoteHTML()}
    ${bindInput('image.forgeNeg', 'Things to avoid (negative prompt)', { ph: FORGE_NEG.slice(0, 60) + '…', hint:'Leave empty for the built-in list, which steers away from cartoons and bad hands.' })}
    ${bindArea('image.look', 'Always add to the picture prompt', { ph: 'soft diffused lighting, clean natural skin texture, detailed photograph', hint: 'Added to every picture, on your PC and with the online services. Clear it to send prompts exactly as written.' })}
    ${bindArea('image.avoid', 'Always add to the negative prompt', { ph: 'film grain, noise, gritty texture…', hint: 'Kept out of every picture, alongside the list above.' })}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="photostyle">Make ${cur() ? 'this adventure' : 'the default style'} photo-realistic</button></div>
    <p class="hint">Sets the art style to "${esc(PHOTO_STYLE)}". Pictures are saved on each device; the same scene repaints identically on another device.</p>`;
}

/* before a picture is painted: a small confirm so you can flag it NSFW up front. Flagged pictures stay
   out of the Gallery until you switch its NSFW filter on. */
/* the shared model chooser for pictures made from a prompt: '' = the usual model for this adventure.
   Hidden with online services, which pick their own model. */
function modelPickHTML(key, cur = '', label = 'Model for this picture', elId = 'model_' + key) {
  const s = S.settings.image;
  if (s.mode !== 'local') return '';
  const all = [...new Set([...(S.forgeModels || []), s.forgeModelSfw, s.forgeModelNsfw].filter(Boolean))];
  const val = String(cur || '');
  return `<label class="f"><span>${esc(label)}</span><select id="${elId}" data-pmodel="${key}"><option value="">Usual one${s.forgeModelSfw ? ` (${esc(modelLabel(s.forgeModelSfw))})` : ''}</option>${all.map(m => `<option value="${esc(m)}" ${m === val ? 'selected' : ''}>${esc(modelLabel(m))}</option>`).join('')}</select></label>
    ${all.length ? '<p class="hint" style="margin-top:-4px">If the picture involves a minor, the safe model is used whichever one you pick.</p>' : '<p class="hint">Tap "Find it" in Settings → Images to load the models from your PC.</p>'}`;
}

/* ask for the prompt (and which model) before painting: scene illustrations, portraits, persona photos */
function askPicPrompt(o, then) {
  const el = document.createElement('div');
  el.setAttribute('role', 'dialog');
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:20px';
  el.innerHTML = `<div class="card" style="max-width:520px;width:100%;padding:18px;max-height:92vh;overflow:auto">
      <b style="font-size:18px">${esc(o.title || 'Paint a picture')}</b>
      <label class="f"><span>Prompt</span><textarea id="askPromptText" rows="${num(o.rows) || 4}">${esc(o.prompt || '')}</textarea></label>
      ${modelPickHTML('ask', o.model || '')}
      <p class="hint" id="askGuard" style="display:none;margin-top:-4px;color:var(--red)"></p>
      <label class="chk"><input type="checkbox" id="askNsfwFlag" ${o.nsfw ? 'checked' : ''}> <span>Mark it NSFW — gore, explicit, or anything you'd rather keep hidden</span></label>
      <div class="row" style="margin-top:12px;justify-content:flex-end;gap:8px"><button class="btn ghost sm" data-ask="no">Cancel</button><button class="btn gold sm" data-ask="yes">Paint it</button></div></div>`;
  /* the age guard always wins: as the prompt is typed, a blocked picture loses the model choice and says why */
  const guardWhy = () => {
    if (!o.guard) return '';
    try {
      const g = AGE.imageAllowed({ prompt: el.querySelector('#askPromptText')?.value || '', campaign: o.guard.campaign || null, subject: o.guard.subject || null });
      return g.allowed ? '' : (g.why || 'a minor or protected character');
    } catch { return ''; }
  };
  const syncGuard = () => {
    const why = guardWhy();
    const sel = el.querySelector('#model_ask');
    if (sel) { sel.disabled = !!why; if (why) sel.value = ''; }
    const note = el.querySelector('#askGuard');
    if (note) { note.style.display = why ? '' : 'none'; note.textContent = why ? `Safe model only: ${why}. The model choice is ignored.` : ''; }
    return why;
  };
  const done = ok => {
    const prompt = (el.querySelector('#askPromptText')?.value || '').replace(/\s+/g, ' ').trim().slice(0, 900);
    const why = syncGuard();
    const model = why ? '' : (el.querySelector('#model_ask')?.value || '');
    const nsfw = !!el.querySelector('#askNsfwFlag')?.checked;
    el.remove(); document.removeEventListener('keydown', onKey);
    if (!ok) return;
    if (!prompt) return toast('Write what the picture should show.');
    if (why) toast(`Safe model used: ${why}. The model choice is ignored for this picture.`, 5000);
    then({ prompt, model, nsfw, blocked: !!why, why });
  };
  const onKey = e => { if (e.key === 'Escape') done(false); };
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-ask]')?.dataset.ask;
    if (a === 'yes') done(true); else if (a === 'no' || e.target === el) done(false);
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el);
  syncGuard();   /* a prefilled prompt can already be blocked (a portrait of a minor, say) */
  el.querySelector('#askPromptText')?.addEventListener('input', syncGuard);
  setTimeout(() => el.querySelector('#askPromptText')?.focus(), 40);
}

function askPicNsfw(then, what = 'this picture', pre = false) {
  const el = document.createElement('div');
  el.setAttribute('role', 'dialog');
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:20px';
  el.innerHTML = `<div class="card" style="max-width:440px;width:100%;padding:18px">
      <b style="font-size:18px">Paint ${esc(what)}?</b>
      <p class="hint" style="color:var(--ink);margin:8px 0 10px">You can flag it now: flagged pictures stay out of the Gallery until you show NSFW there.</p>
      <label class="chk"><input type="checkbox" id="picNsfwFlag" ${pre ? 'checked' : ''}> <span>Mark it NSFW — gore, explicit, or anything you'd rather keep hidden</span></label>
      <div class="row" style="margin-top:14px;justify-content:flex-end;gap:8px"><button class="btn ghost sm" data-pic="no">Cancel</button><button class="btn gold sm" data-pic="yes">Paint it</button></div></div>`;
  const done = ok => {
    const flag = !!ok && !!el.querySelector('#picNsfwFlag')?.checked;
    el.remove(); document.removeEventListener('keydown', onKey); if (ok) then(flag);
  };
  const onKey = e => { if (e.key === 'Escape') done(false); };
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-pic]')?.dataset.pic;
    if (a === 'yes') done(true); else if (a === 'no' || e.target === el) done(false);
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el);
}

/* the store key a picture is painted under on this device: the same key imageUrl/forgeJob use */
function localKeyFor(img, c, subject = null, ref = null) {
  const s = S.settings.image;
  const style = ((c && c.artStyle) || s.style || '').trim();
  const prompt = (img.prompt + (style ? ', ' + style : '')).replace(/\s+/g, ' ').slice(0, 900);
  const neg = String(img.neg || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  return forgeJob(prompt, img.seed || 1, c, neg, ref, subject, img.model).k;
}
function imageUrl(img, c) {
  const s = S.settings.image;
  const style = ((c && c.artStyle) || s.style || '').trim();
  const prompt = (img.prompt + (style ? ', ' + style : '')).replace(/\s+/g, ' ').slice(0, 900);
  const neg = String(img.neg || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  /* who this picture is of, when the app knows: a companion, the player, a party member or an NPC */
  const subject = img.subj && typeof subjChar === 'function' ? subjChar(img.subj) : null;
  /* the local painter adds the standing extra itself, so the picture store key stays tied to the picture's own prompt */
  if (s.mode === 'local') return localImageUrl(prompt, img.seed || 1, c, neg, s.refPhotos !== false && img.subj && typeof subjRef === 'function' ? subjRef(img.subj) : null, subject, img.model);
  /* online services take the standing additions in the request itself */
  const fullPrompt = img.prompt && picLook() ? `${prompt}, ${picLook()}`.slice(0, 1200) : prompt;
  const fullNeg = [neg, picAvoid()].filter(Boolean).join(', ').slice(0, 700);
  const [W, H] = SIZES[s.size] || SIZES.landscape; const seed = img.seed || 1; const p = encodeURIComponent(fullPrompt);
  if (s.mode === 'template' && s.template.trim()) return s.template.trim().replaceAll('{prompt}', p).replaceAll('{seed}', seed).replaceAll('{width}', W).replaceAll('{height}', H);
  const model = encodeURIComponent(s.polliModel || 'flux');
  const safe = (pickForgeModel(c, img.prompt, subject).safe ? '&safe=true' : '') + (fullNeg ? '&negative_prompt=' + encodeURIComponent(fullNeg) : '');
  if (s.polliKey.trim()) return `https://gen.pollinations.ai/image/${p}?model=${model}&width=${W}&height=${H}&seed=${seed}&nologo=true${safe}&key=${encodeURIComponent(s.polliKey.trim())}`;
  return `https://image.pollinations.ai/prompt/${p}?model=${model}&width=${W}&height=${H}&seed=${seed}&nologo=true${safe}`;
}
function sceneHTML(m, c) {
  if (!m.image || S.settings.image.mode === 'off') return '';
  const local = S.settings.image.mode === 'local';
  const shape = S.settings.image.size || 'square';
  return `<div class="scene sh-${shape}"><div class="ph"><div class="spin"></div><div>${local ? 'Painting on your PC… (usually 20 seconds to 2 minutes)' : 'Painting the scene…'}</div></div>
    <img ${local ? '' : 'loading="lazy"'} alt="${esc(m.image.prompt)}" src="${esc(imageUrl(m.image, c))}" onload="if(this.src.indexOf('data:image/svg')){this.classList.add('ld');this.previousElementSibling.style.display='none'}" onerror="imgFail(this)">
    <div class="sbtn"><button data-act="newimg" data-mid="${m.id}">New image</button></div></div>`;
}
window.imgFail = el => { const ph = el.previousElementSibling; if (!ph) return;
  const k = (el.getAttribute('src') || '').split('fail-')[1];
  const why = S.settings.image.mode === 'local' ? (LOCAL.fail[k] || 'Stable Diffusion on your PC didn\'t answer.') : 'The image didn\'t load (free image services allow about one image every 15 seconds without a key).';
  ph.style.display = ''; ph.innerHTML = `<div>${esc(why)}</div><button class="btn sm" data-act="retryimg">Try again</button>`; };
function illustrate(mid) {
  const c = cur(); const m = c?.messages.find(x => x.id === mid); if (!m) return;
  if (S.settings.image.mode === 'off') return toast('Images are turned off in Settings.');
  const def = m.image?.prompt || (m.text.replace(/["“”]/g, '').split(/\n+/)[0].slice(0, 300) + ', illustration of the scene, no text');
  askPicPrompt({ title: 'Illustrate this moment', prompt: def, model: m.image?.model || '', nsfw: !!m.image?.nsfw, rows: 5, guard: { campaign: c, subject: null } }, ({ prompt, model, nsfw }) => {
    m.image = { prompt, seed: d(999999), ...(model ? { model } : {}), ...(nsfw ? { nsfw: true } : {}) };
    touch(c); renderLog(); scheduleSync();
  });
}

/* =========================================================================
   Google Drive — one folder you choose; one subfolder per adventure
   ========================================================================= */
const qs = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const Drive = {
  token: null, exp: 0, files: {},
  init() { const t = LS.get('iq.drivetoken', null); if (t && t.exp > Date.now() + 60000) { this.token = t.token; this.exp = t.exp; } },
  valid() { return !!this.token && this.exp > Date.now() + 60000; },
  configured() { return !!S.settings.drive.clientId.trim() && !!folderIdFrom(S.settings.drive.folder); },
  root() { return folderIdFrom(S.settings.drive.folder); },
  loadGIS() { return new Promise((res, rej) => { if (window.google?.accounts?.oauth2) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load Google sign-in.')); document.head.appendChild(s); }); },
  async connect(interactive) {
    if (this.valid()) return this.token;
    const cid = S.settings.drive.clientId.trim();
    if (!cid) throw new Error('Add your Google OAuth Client ID in Settings → Google Drive.');
    if (!this.root()) throw new Error('Add your Drive folder link in Settings → Google Drive.');
    if (!/^https?:/.test(location.protocol)) throw new Error('Google Drive needs the app opened from a web address (https:// or http://localhost), not as a local file.');
    if (!interactive) throw new Error('Drive needs you to reconnect — tap Sync.');
    await this.loadGIS();
    return new Promise((res, rej) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cid, scope: 'https://www.googleapis.com/auth/drive',
        callback: r => { if (r.error) return rej(new Error(r.error_description || r.error)); this.token = r.access_token; this.exp = Date.now() + (num(r.expires_in) || 3600) * 1000; LS.set('iq.drivetoken', { token: this.token, exp: this.exp }); LS.set('iq.driveok', true); this.who(); res(this.token); },
        error_callback: e => rej(new Error(e?.type === 'popup_closed' ? 'Google sign-in was closed.' : (e?.message || 'Google sign-in failed — allow pop-ups for this site.')))
      });
      client.requestAccessToken({ prompt: LS.get('iq.driveok', false) ? '' : 'consent' });
    });
  },
  /* which Google account this session belongs to, so a permissions error can name it */
  async who() {
    if (!this.valid()) return S.driveAs || '';
    try {
      const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(this.token));
      if (!r.ok) return S.driveAs || '';
      const j = await r.json(); if (j.email) S.driveAs = j.email;
      return S.driveAs || '';
    } catch { return S.driveAs || ''; }
  },
  disconnect() { try { if (this.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(this.token, () => {}); } catch {} this.token = null; this.exp = 0; this.files = {}; localStorage.removeItem('iq.drivetoken'); localStorage.removeItem('iq.driveok'); },
  async api(url, opts = {}) {
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + this.token } });
    if (r.status === 401) { this.token = null; localStorage.removeItem('iq.drivetoken'); throw new Error('Drive session expired — tap Sync to reconnect.'); }
    if (r.status === 404) throw new Error('Drive folder not found — check the folder link in Settings and that it belongs to the account you signed in with.');
    if (r.status === 403) {
      let t = ''; try { t = await r.text(); } catch {}
      let reason = ''; try { reason = JSON.parse(t)?.error?.errors?.[0]?.reason || ''; } catch {}
      const denied = /insufficientPermissions|forbidden|notAuthorized|appNotAuthorized/i.test(reason + ' ' + t);
      const hint = denied ? ' Google will not let this account edit that item: the folder, or a file inside it, probably belongs to another Google account, or was shared with you as Viewer instead of Editor.' : '';
      const who = S.driveAs ? ` Signed in as ${S.driveAs}.` : '';
      throw new Error(`Drive refused that change (403${reason ? ' ' + reason : ''}).${hint}${who} Sign in with the folder's owner, or paste a link to a folder you own, then tap Sync.`);
    }
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch {} throw new Error(`Drive error ${r.status}: ${t.slice(0, 200)}`); }
    return r;
  },
  async list(q) {
    let out = [], pageToken = '';
    do {
      const p = new URLSearchParams({ q, fields:'nextPageToken,files(id,name,mimeType,appProperties,modifiedTime,parents)', pageSize:'200', supportsAllDrives:'true', includeItemsFromAllDrives:'true' });
      if (pageToken) p.set('pageToken', pageToken);
      const j = await (await this.api('https://www.googleapis.com/drive/v3/files?' + p)).json();
      out = out.concat(j.files || []); pageToken = j.nextPageToken || '';
    } while (pageToken);
    return out;
  },
  async createFolder(name, parent, appProperties) {
    const r = await this.api('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents:[parent], appProperties }) });
    const id = (await r.json()).id; this.files[parent + '/' + name] = id; return id;
  },
  /* find a folder by name, or make it */
  async folder(parent, name, appProperties) {
    const key = 'dir:' + parent + '/' + name; if (this.files[key]) return this.files[key];
    const f = await this.list(`name='${qs(name)}' and '${parent}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`);
    return (this.files[key] = f[0]?.id || await this.createFolder(name, parent, appProperties));
  },
  /* move a file or folder to a new parent (used to tidy old saves into Games) */
  async move(id, to, from) {
    const p = new URLSearchParams({ addParents: to, removeParents: from, supportsAllDrives:'true', fields:'id,parents' });
    await this.api(`https://www.googleapis.com/drive/v3/files/${id}?` + p, { method:'PATCH' });
  },
  async patch(id, meta) { await this.api(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(meta) }); },
  async fileId(parent, name) {
    const key = parent + '/' + name; if (this.files[key]) return this.files[key];
    const f = await this.list(`name='${qs(name)}' and '${parent}' in parents and trashed=false`);
    return (this.files[key] = f[0]?.id || null);
  },
  async put(parent, name, content, mime) {
    const id = await this.fileId(parent, name);
    if (id) { await this.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true`, { method:'PATCH', headers:{ 'Content-Type': mime }, body: content }); return id; }
    const b = 'iq_' + uid();
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents:[parent], mimeType: mime })}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${b}--`;
    const r = await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true', { method:'POST', headers:{ 'Content-Type':'multipart/related; boundary=' + b }, body });
    return (this.files[parent + '/' + name] = (await r.json()).id);
  },
  /* write a file from binary (a picture), creating it or replacing it */
  async putFile(parent, name, blob, mime) {
    const id = await this.fileId(parent, name);
    if (id) { await this.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true`, { method:'PATCH', headers:{ 'Content-Type': mime }, body: blob }); return id; }
    const b = 'iq_' + uid(); const meta = JSON.stringify({ name, parents:[parent], mimeType: mime });
    const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${b}--`]);
    const r = await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true', { method:'POST', headers:{ 'Content-Type':'multipart/related; boundary=' + b }, body });
    return (this.files[parent + '/' + name] = (await r.json()).id);
  },
  async getJSON(id) { const r = await this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`); try { return await r.json(); } catch { return null; } },
  async getText(id) { const r = await this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`); return r.text(); }
};
/* ---------- pictures painted on the PC are kept in Drive → "Ironquill pictures", so every device shares them ---------- */
const DriveImg = {
  folder: null, index: null, loading: null, busy: false,
  ready() { return S.settings.image.driveSave !== false && Drive.configured() && Drive.valid(); },
  async ensure() {
    if (this.index) return;
    if (!this.loading) this.loading = (async () => {
      const root = Drive.root();
      const f = await Drive.list(`name='Ironquill pictures' and '${root}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`);
      this.folder = f[0]?.id || await Drive.createFolder('Ironquill pictures', root);
      const files = await Drive.list(`'${this.folder}' in parents and trashed=false`);
      const idx = {}; for (const x of files) idx[String(x.name).replace(/\.jpg$/i, '')] = x.id; this.index = idx;
    })().catch(e => { this.loading = null; throw e; });
    await this.loading;
  },
  async get(k) {
    if (!this.ready()) return null;
    try {
      await this.ensure();
      let id = this.index[k];
      if (!id) { await this.scanPhotos(); id = this.index[k]; }   /* not in the old shared folder: look in the games' and companions' own Photos folders */
      if (!id) return null;
      const r = await Drive.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`); const b = await r.blob(); return b.size ? b : null;
    }
    catch (e) { console.warn('Drive picture read failed', e); return null; }
  },
  /* the one folder every game's pictures live in: <game folder>/Photos */
  async photosOf(parent, key) {
    this.dirs = this.dirs || {}; if (this.dirs[key]) return this.dirs[key];
    return (this.dirs[key] = await Drive.folder(parent, 'Photos'));
  },
  /* one slow pass over the Pictures folders of every game and companion, only when a picture isn't found */
  async scanPhotos() {
    if (this.scanned) return; if (this.scanning) return this.scanning;
    this.scanning = (async () => {
      const root = Drive.root();
      const add = list => { for (const x of list) this.index[String(x.name).replace(/\.jpg$/i, '')] = x.id; };
      const games = await Drive.folder(root, 'Games', { iqGames: '1' });
      for (const g of await Drive.list(`'${games}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`)) {
        if (!g.appProperties?.iqCampaign) continue;
        const p = (await Drive.list(`name='Photos' and '${g.id}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`))[0];
        if (p) add(await Drive.list(`'${p.id}' in parents and trashed=false`));
      }
      const comps = (await Drive.list(`name='Companions' and '${root}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`))[0];
      if (comps) for (const pal of await Drive.list(`'${comps.id}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`)) {
        const p = (await Drive.list(`name='Photos' and '${pal.id}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`))[0];
        if (p) add(await Drive.list(`'${p.id}' in parents and trashed=false`));
        /* pictures saved straight into the companion folder by an older version */
        add((await Drive.list(`'${pal.id}' in parents and trashed=false`)).filter(x => /\.jpg$/i.test(x.name)));
      }
      this.scanned = true;
    })().catch(e => console.warn('Picture folders', e)).finally(() => { this.scanning = null; });
    return this.scanning;
  },
  async upload(k, blob, ctx) {
    await this.ensure(); if (this.index[k]) return;
    let dir = this.folder;
    if (ctx && ctx.folder) { try { dir = await this.photosOf(ctx.folder, 'camp:' + (ctx.id || ctx.folder)); } catch (e) { console.warn('Game Photos folder', e); } }
    this.index[k] = await Drive.putFile(dir, k + '.jpg', blob, 'image/jpeg');
  },
  /* remember what still needs uploading (the picture itself waits in this device's storage) */
  pending() { return arr(LS.get('iq.imgPending', [])); },
  queue(k, ctx) {
    const p = this.pending();
    const same = x => (typeof x === 'string' ? x : x.k) === k && (!ctx?.folder || (typeof x === 'object' && x.ctx?.folder === ctx.folder));
    if (!p.some(same)) { p.push(ctx && ctx.folder ? { k, ctx: { id: ctx.id, folder: ctx.folder, title: ctx.title } } : k); LS.set('iq.imgPending', p.slice(-500)); }
    this.flush();
  },
  async flush() {
    if (this.busy || !this.ready() || !this.pending().length) return; this.busy = true;
    try {
      for (const item of this.pending()) {
        const k = typeof item === 'string' ? item : item.k; const ctx = typeof item === 'string' ? null : item.ctx;
        const blob = await IDB.get(k);
        if (blob) { try { await this.upload(k, blob, ctx); } catch (e) { console.warn('Drive picture upload failed', e); break; } }
        LS.set('iq.imgPending', this.pending().filter(x => x !== item));
      }
    } finally { this.busy = false; }
  }
};
/* Any file in the Ironquill folder whose name starts with "ironquill-keys" (.json, .txt, .env)
   or a Google Doc named that way is read as a keys file. */
async function pullKeysFromDrive(root) {
  const files = (await Drive.list(`'${root}' in parents and trashed=false and name contains 'ironquill-keys'`))
    .filter(f => f.mimeType !== FOLDER_MIME).sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
  const seen = LS.get('iq.keysSeen', {}); let added = 0;
  for (const f of files) {
    if (seen[f.id] === f.modifiedTime) continue;
    const text = f.mimeType === 'application/vnd.google-apps.document'
      ? await (await Drive.api(`https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`)).text()
      : await Drive.getText(f.id);
    added += (await importKeys(text, { quiet: true })).length;
    seen[f.id] = f.modifiedTime;
  }
  LS.set('iq.keysSeen', seen);
  if (added) toast(`Loaded ${added} AI key${added > 1 ? 's' : ''} from your Drive folder.`, 4500);
}
async function saveKeysToDrive() {
  try {
    await Drive.connect(true);
    await Drive.put(Drive.root(), KEYS_FILE, keysFileContent(), 'application/json');
    toast(`Saved ${KEYS_FILE} to your Drive folder — other devices pick it up when they connect.`, 5000);
  } catch (e) { toast(e.message, 5000); }
}

const safeName = s => String(s || 'Adventure').replace(/[\\/:*?"<>|#%]/g, '').trim().slice(0, 80) || 'Adventure';
function characterMD(c) {
  const ch = c.character; const tl = t => `- **${t.name}** [${t.tier}, ${t.polarity === '-' ? '−' : '+'}${TV[t.tier]}]${t.trigger ? ` — ${t.trigger}` : ''}${t.effects?.length ? `\n  - ${t.effects.join('\n  - ')}` : ''}`;
  return [`# ${ch.name}`, ch.storyRole ? `*${ch.storyRole}*` : '', '',
    `**Level** ${ch.level} · **HP** ${ch.hp}/${ch.maxHp} · **EP** ${ch.ep} · **TP** ${ch.tp} · **Gold** ${ch.gold}`, '',
    '## Stats', '| ' + STATS.map(SN).join(' | ') + ' |', '|' + STATS.map(() => ' --- ').join('|') + '|', '| ' + STATS.map(k => `${ch.stats[k]} (${fmt(mod(ch.stats[k]))})`).join(' | ') + ' |', '',
    '## Positive traits', ...(ch.traits.filter(t => t.polarity === '+').map(tl)), '',
    '## Negative traits', ...(ch.traits.filter(t => t.polarity === '-').map(tl)), '',
    ch.injuries.length ? '## Injuries\n' + ch.injuries.map(i => `- ${i.name}: ${i.effect}`).join('\n') + '\n' : '',
    '## Gear', ...ch.gear.map(g => `- ${g.name}${g.tier ? ` [${g.tier}]` : ''}${g.desc ? ` — ${g.desc}` : ''}`), '',
    ch.signatures.length ? '## Signatures\n' + ch.signatures.map(s => `- ${s.name}${s.desc ? ` — ${s.desc}` : ''}`).join('\n') + '\n' : '',
    '## Appearance', lookOf(ch) || '—', '', '## Backstory', ch.backstory || '—'].join('\n');
}
function storyMD(c) {
  const lines = [`# ${c.title}`, '', `*${c.genre || ''}*`, '', c.premise, '', '---', ''];
  for (const m of c.messages) {
    if (m.hidden || m.role === 'err' || m.streaming) continue;
    if (m.role === 'gm') lines.push(stripSpeakerTags(m.text), '');
    else if (m.role === 'player') lines.push(`> **${c.character.name}:** ${m.text}`, '');
    else if (m.role === 'roll') lines.push(`*🎲 ${m.text}*`, '');
    else if (m.role === 'sys') lines.push(`**${m.text}**`, '');
  }
  if (c.summary) lines.push('---', '## Story so far (summary)', c.summary);
  return lines.join('\n');
}
/* Settings without secrets (keys travel only in the keys file) */
function publicSettings() { const s = deep(S.settings); delete s.ai; s.image.polliKey = ''; return s; }
function exportData() { return { app: APP, version: 2, savedAt: Date.now(), settings: publicSettings(), campaigns: S.campaigns, deleted: S.deleted }; }
function mergeSettings(rs) {
  if (!rs || (rs.updatedAt || 0) <= (S.settings.updatedAt || 0)) return false;
  const keep = { ai: S.settings.ai, polliKey: S.settings.image.polliKey, clientId: S.settings.drive.clientId, folder: S.settings.drive.folder };
  S.settings = mergeDefaults({ ...rs, ai: keep.ai }, DEFAULT_SETTINGS);
  S.settings.image.polliKey = keep.polliKey;
  S.settings.drive.clientId = keep.clientId || S.settings.drive.clientId; S.settings.drive.folder = keep.folder;
  saveSettings(false); return true;
}
function mergeIn(remote) {   /* backup files */
  if (!remote || typeof remote !== 'object') return 0;
  let changed = 0; const tomb = { ...S.deleted };
  for (const [id, t] of Object.entries(remote.deleted || {})) tomb[id] = Math.max(tomb[id] || 0, t);
  for (const [id, rc] of Object.entries(remote.campaigns || {})) {
    if (tomb[id] && tomb[id] >= (rc.updatedAt || 0)) continue;
    const lc = S.campaigns[id];
    if (!lc || (rc.updatedAt || 0) > (lc.updatedAt || 0)) { if (!(S.busy && id === S.activeId)) { S.campaigns[id] = migrate(rc); changed++; } }
  }
  for (const id of Object.keys(tomb)) if (S.campaigns[id] && (S.campaigns[id].updatedAt || 0) <= tomb[id]) { delete S.campaigns[id]; changed++; }
  S.deleted = tomb; if (mergeSettings(remote.settings)) changed++;
  saveCampaigns(); return changed;
}

async function syncNow(interactive) {
  if (S.syncing) { S.resync = true; return; }
  if (!Drive.configured()) { if (interactive) { toast('Add your Google Client ID and folder link first.'); openModal('settings', 'drive'); } return; }
  S.syncing = true; setSync('Syncing…'); Drive.who();
  try {
    await Drive.connect(interactive);
    const root = Drive.root();
    let changed = 0;
    try { await pullKeysFromDrive(root); } catch (e) { console.warn('Keys file', e); }
    /* 1. index: settings + deletions */
    const idxId = await Drive.fileId(root, INDEX_FILE);
    const idx = idxId ? await Drive.getJSON(idxId) : null;
    if (idx) { for (const [id, t] of Object.entries(idx.deleted || {})) S.deleted[id] = Math.max(S.deleted[id] || 0, t); if (mergeSettings(idx.settings)) changed++; }
    /* 2. adventure folders: every game lives in Games/<game name>, with its own Photos folder inside */
    const gamesRoot = await Drive.folder(root, 'Games', { iqGames: '1' });
    const looseFolders = await Drive.list(`'${root}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`);
    /* saves from before the Games folder are tidied into it once */
    for (const f of looseFolders) if (f.appProperties?.iqCampaign) { try { await Drive.move(f.id, gamesRoot, root); } catch (e) { console.warn('Could not move an old save into Games', f.name, e); } }
    const allFolders = (await Drive.list(`'${gamesRoot}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`))
      .concat(looseFolders.filter(f => !f.appProperties?.iqCampaign && !['Games', 'Companions', 'Personas', 'Ironquill pictures'].includes(f.name)));
    /* adventure folders copied or uploaded from another Drive lose their hidden tag: find their campaign.json and tag them again */
    const seen = LS.get('iq.adoptSeen', {});
    for (const f of allFolders) {
      if (f.appProperties?.iqCampaign || seen[f.id]) continue;
      seen[f.id] = 1;
      try {
        const fid = await Drive.fileId(f.id, 'campaign.json'); const data = fid ? await Drive.getJSON(fid) : null;
        if (data && data.id) { f.appProperties = { iqCampaign: data.id, iqUpdated: String(data.updatedAt || 0) }; await Drive.patch(f.id, { appProperties: f.appProperties }); }
      } catch (e) { console.warn('Could not read folder', f.name, e); }
    }
    LS.set('iq.adoptSeen', seen);
    const folders = allFolders.filter(f => f.appProperties?.iqCampaign);
    const remote = {}; for (const f of folders) remote[f.appProperties.iqCampaign] = f;
    for (const [id, f] of Object.entries(remote)) {
      const rUpd = num(f.appProperties.iqUpdated);
      if (S.deleted[id] && S.deleted[id] >= rUpd) { await Drive.patch(f.id, { trashed: true }); delete remote[id]; continue; }
      const lc = S.campaigns[id];
      if ((!lc || rUpd > (lc.updatedAt || 0)) && !(S.busy && id === S.activeId)) {
        const fid = await Drive.fileId(f.id, 'campaign.json');
        const data = fid ? await Drive.getJSON(fid) : null;
        if (data && data.id === id) { S.campaigns[id] = migrate(data); changed++; }
      }
    }
    /* remember where each game lives, so a picture painted later is filed in that game's Photos folder */
    for (const [id, f] of Object.entries(remote)) if (S.campaigns[id]) S.campaigns[id].driveFolder = f.id;
    for (const id of Object.keys(S.campaigns)) if (S.deleted[id] && S.deleted[id] >= (S.campaigns[id].updatedAt || 0)) { delete S.campaigns[id]; changed++; }
    /* 2b. Story Docs: pick up anything edited in Google Docs */
    let docs = {};
    try { docs = await StoryDoc.listAll(); changed += await StoryDoc.pullEdits(docs, id => remote[id]?.id); } catch (e) { console.warn('Story Docs', e); }
    saveCampaigns();
    /* 3. push local adventures that are newer */
    for (const c of Object.values(S.campaigns)) {
      const f = remote[c.id]; const rUpd = num(f?.appProperties?.iqUpdated);
      if (f && rUpd >= (c.updatedAt || 0)) { if (!docs[f.id]) try { await StoryDoc.write(c, f.id, null); saveCampaigns(); } catch (e) { console.warn('Story Doc', e); } continue; }
      const name = safeName(c.title);
      let folderId = f?.id;
      if (!folderId) folderId = await Drive.createFolder(name, gamesRoot, { iqCampaign: c.id, iqUpdated: String(c.updatedAt || 0) });
      if (c.driveFolder !== folderId) { c.driveFolder = folderId; }   /* so a picture painted now lands in this game's own Photos folder */
      try { await StoryDoc.write(c, folderId, docs[folderId] || (c.storyDoc?.folder === folderId ? c.storyDoc : null)); } catch (e) { console.warn('Story Doc', e); }
      await Drive.put(folderId, 'campaign.json', JSON.stringify(c), 'application/json');
      await Drive.put(folderId, 'Character Sheet.md', characterMD(c), 'text/markdown');
      await Drive.put(folderId, 'Story Log.md', storyMD(c), 'text/markdown');
      await Drive.patch(folderId, { name, appProperties: { iqCampaign: c.id, iqUpdated: String(c.updatedAt || 0) } });
    }
    saveCampaigns();
    /* 3b. companions and personas */
    try { changed += await syncPals(root); } catch (e) { console.warn('Companions sync', e); }
    /* 4. index */
    await Drive.put(root, INDEX_FILE, JSON.stringify({ app: APP, version: 2, savedAt: Date.now(), settings: publicSettings(), deleted: S.deleted }), 'application/json');
    setSync('Synced with Google Drive · ' + new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }));
    DriveImg.flush();
    if ((changed || S.view === 'setup') && !S.busy) rerender();
    if (interactive) toast(changed ? 'Synced — pulled newer saves from Drive.' : 'Synced with Google Drive.');
  } catch (e) { setSync('Not synced — ' + e.message); if (interactive) toast(e.message, 5000); }
  finally { S.syncing = false; if (S.resync) { S.resync = false; setTimeout(() => syncNow(false), 200); } }
}
/* After 20 quiet minutes, sync anyway: picks up what another device saved while this one sat idle.
   Any activity (pointer, typing, scrolling) pushes the 20 minutes back, so it only runs when you've stepped away. */
let idleTimer = null, idleMark = 0;
/* Settings → Google Drive: off, 5, 20 or 60 minutes */
const idleMinutes = () => Math.max(0, num(S.settings.drive.idleSync));
function armIdleSync() {
  clearTimeout(idleTimer); idleTimer = null; idleMark = Date.now();
  const m = idleMinutes(); if (!m) return;   /* off: nothing armed */
  idleTimer = setTimeout(idleTick, m * 60 * 1000);
}
function idleTick() {
  idleTimer = null;
  if (idleMinutes() && S.settings.drive.autoSync && Drive.configured() && Drive.valid() && !S.busy && !S.syncing) syncNow(false);
  armIdleSync();
}
function noteActivity() { if (idleMinutes() && Date.now() - idleMark > 30000) armIdleSync(); }
let syncTimer;
function scheduleSync() { if (!S.settings.drive.autoSync || !Drive.configured() || !Drive.valid()) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => { syncTimer = null; if (!S.busy) syncNow(false); else scheduleSync(); }, 3000); }
function setSync(t) { S.syncStatus = t; const a = $('#syncline'); if (a) a.textContent = t; const b = $('#driveStatus'); if (b) b.textContent = t; }

/* =========================================================================
   Character builder
   ========================================================================= */
function newDraft(sc = SCENARIOS[0]) {
  return { scenario: sc.id, title: sc.title, genre: sc.genre, premise: sc.premise, tone: sc.tone, art: sc.art, rating: sc.rating || 'PG-13', magicCost: sc.magic || 'gm', gmNotes:'',
    worldPrompt:'', world: sc.world || '', secrets: sc.secrets || '', plan: sc.plan || '', roadmap: sc.roadmap || '', threats: (sc.threats || []).map(t => ({ ...t })), factions: (sc.factions || []).map(f => ({ ...f })),
    people: (sc.people || []).map(p => ({ ...p })), pinned: [...(sc.pinned || [])], cards: [], gmPreset:'storyteller', gmName:'', gmStyle:'',
    concept:'', name:'', sex:'', pronouns:'', storyRole:'', appearance:'', backstory:'', profile:{},
    stats: Object.fromEntries(STATS.map(k => [k, 8])), traits: [], gear: (sc.gear || []).map(normGear), signatures: [], tpToEp: 0, tpToStats: 0, gold: START_GOLD };
}
function draftBudget(D) {
  let pos = 0, neg = 0, gear = 0, sig = 0;
  for (const t of D.traits) { if (t.polarity === '-') neg += NEG_BUILD[t.tier]; else pos += POS_COST[t.tier]; }
  for (const g of D.gear) if (g.tier) gear += GEAR_COST[g.tier] || 0;
  for (const s of D.signatures) sig += clamp(num(s.cost) || 8, 8, 15);
  const conv = Math.max(0, num(D.tpToEp)) * 2;
  const extra = Math.max(0, num(D.tpToStats)); const statTP = extra * 2;
  return { pos, neg, gear, sig, conv, statTP, extra, cap: STAT_BUDGET + extra, left: START_TP + neg - pos - gear - sig - conv - statTP, points: statPoints(D.stats) };
}
const BUILDER_RULES = `You help a player build a character for IRONQUILL, a solo tabletop RPG run by an AI Game Master. Turn their concept into a complete, playable build that fits the setting.

RULES
- Six stats STR DEX CON INT WIS CHA, each 8-20, bought with 35 points. Cost of a score: 8=0 9=1 10=2 11=3 12=4 13=5 14=7 15=9 16=10 17=11 18=12 19=13 20=15. Spend 32-35 points; the total must not exceed 35.
- Traits are both skills and weaknesses, rated by tier: D (±1), C (±2), B (±3), A (±4), S (±5). Positive traits ("polarity":"+") cost Trait Points: D2 C4 B6 A8 S10. Negative traits ("polarity":"-") give TP back: D1 C3 B5 A7 S9. The budget is 10 TP plus whatever negatives give back; spend all but 0-3 TP.
- Each trait has a short name, a narrow trigger (exactly when it applies: "brewing potions", "spells that must be spoken aloud", "running or climbing"), and story effects: 1 at D or C, 2 at B or A, 3 at S. Positive effects are things the character can do ("brews in 2 days instead of 3"); negative effects are real restrictions ("can't sprint").
- Draw negatives from the concept and make them matter; never pointless filler.
- Gear: 3-6 ordinary items that fit, each with a one-line desc and "tier":"" (free). Add at most one special item with a tier (costs D1 C2 B3 A4 S5 TP) only if the concept clearly calls for it.
- story_role: a label that fits the world (a school house, rank, guild, post) — not a game class.
- backstory: two short paragraphs of character history ending with one unresolved hook. appearance: one vivid sentence.

Reply with ONLY this JSON:
{"name":"","gender":"male|female","story_role":"","appearance":"","backstory":"","stats":{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10},"traits":[{"name":"","polarity":"+","tier":"B","trigger":"","effects":[""]}],"gear":[{"name":"","desc":"","tier":""}]}`;

const WORLD_RULES = `You are a veteran tabletop RPG designer building the setting for a solo game run by an AI Game Master. Turn the player's short idea into a world that is rich, specific and ready to play tonight.
- If the idea names an existing fictional world (a book, film, show or game), set the adventure inside that world: use its real places, factions, rules and well-known characters, and keep its tone and lore. Place the player's story in a gap where an original character fits.
- Otherwise invent an original world. Make it feel lived-in: concrete names, smells, sounds, local customs, what things cost, what people fear.
QUALITY BAR
- Specific beats generic. Not "a dark forest" but "the Hushwood, where birds stopped singing three winters ago". Avoid stock clichés (chosen ones, ancient evil simply awakening, the dark lord) unless you give them a fresh twist.
- Everything connects: every secret involves at least one named person and one named place; factions want things that clash with each other; every key person wants something, hides something, and has a distinct way of talking.
- The opening premise drops the player into an immediate situation with stakes and a clear first problem in the first scene, not a long backstory. Describe the world and situation only: never decide what the player character does, thinks or feels.
- The roadmap escalates: each act raises the stakes and its beats name people, places and factions from this world.
FIELDS
- world: 10-16 short bullet lines ("- "): the starting place and 3-4 other key places (each with a sensory detail), factions or houses, how magic or technology works and what it costs, daily life, current tensions.
- secrets: 4-6 bullet lines of hidden truths the GM reveals only through play (a traitor, a hidden cause, a coming threat, a lie everyone believes).
- magic_cost: "free" where casters use magic freely (e.g. wizarding schools), "strain" where magic is costly or rare, "none" where the player has no magic.
- art_style: a short phrase for an illustrator matching the world's look.
- plan: 4-6 sentences of hidden campaign direction: likely twists, how the story will test the character, and a possible ending or two.
- roadmap: the plot in 4 acts, as text. Each act on its own line as "Act 1: Short title | the act's goal", followed by 3-4 beats, each on a line starting "- ". Beats are things that can happen in the world (discoveries, arrivals, reveals, dangers), never things the player character must decide or do.
- people: 5-7 key characters: {"name","text":"two sentences: who they are, what they want and what they hide, and how they talk","where","sex":"male|female","feel":"friendly|neutral|wary|hostile"}. Adults only. Include at least one ally, one rival and one who is not what they seem.
- threats: 2-3 dangers that advance over time if ignored, each with max 4-8 and what happens when it fills.
- factions: 3-5 groups with a one-line description of what they want.
Reply with ONLY this JSON:
{"title":"","genre":"","premise":"","tone":"","art_style":"","magic_cost":"free","world":"- ...","secrets":"- ...","plan":"","roadmap":"Act 1: ... | ...\n- ...","threats":[{"name":"","max":6,"effect":""}],"factions":[{"name":"","desc":""}],"people":[{"name":"","text":"","where":"","sex":"","feel":""}]}`;
/* a live timer on the Build button, so a long build visibly is still working */
function buildTimer() {
  clearInterval(buildTimer.t);
  buildTimer.t = setInterval(() => {
    const st = S.worlding || S.drafting || S.palBuilding; if (!st) return clearInterval(buildTimer.t);
    document.querySelectorAll('.buildsecs').forEach(el => { el.textContent = Math.round((Date.now() - st) / 1000) + 's'; });
  }, 1000);
}
async function worldWithAI() {
  const D = S.draft; if (!D || S.worlding) return;
  if (!textReady()) { toast('Set up your Story AI first.'); return openModal('settings', 'ai'); }
  if (!D.worldPrompt.trim()) { toast('Describe the world you want first.'); return $('[data-dpath="worldPrompt"]')?.focus(); }
  S.worlding = Date.now(); renderNew(true); buildTimer();
  try {
    const raw = await chat([{ role:'system', content: WORLD_RULES }, { role:'user', content: `PLAYER'S IDEA: ${D.worldPrompt}\n\nReturn the JSON.` }], { build:true, stream:false, maxTokens:4000, temperature:0.85, json:true });
    const j = tryJSON(stripThink(raw));
    if (!j || !(j.premise || j.world)) throw new Error('The AI\'s reply wasn\'t a usable world. Try again, or reword your idea.');
    const list = v => Array.isArray(v) ? v.map(x => '- ' + String(x).replace(/^[-*•]\s*/, '')).join('\n') : String(v || '');
    D.title = String(j.title || D.title || '').slice(0, 80); D.genre = String(j.genre || '').slice(0, 120);
    D.premise = String(j.premise || '').slice(0, 1500); D.tone = String(j.tone || '').slice(0, 120);
    D.art = String(j.art_style || j.artStyle || D.art || '').slice(0, 200);
    if (['free','strain','none'].includes(j.magic_cost)) D.magicCost = j.magic_cost;
    D.world = list(j.world).slice(0, 3000); D.secrets = list(j.secrets).slice(0, 1500);
    D.plan = String(j.plan || '').slice(0, 2000); D.threats = arr(j.threats).slice(0, 5); D.factions = arr(j.factions).slice(0, 8);
    D.roadmap = (Array.isArray(j.roadmap) ? j.roadmap.map(a => typeof a === 'string' ? a : `Act ${a.act || ''}: ${a.title || ''} | ${a.goal || ''}\n${arr(a.beats).map(b => '- ' + b).join('\n')}`).join('\n') : String(j.roadmap || '')).slice(0, 3000);
    if (arr(j.people).length) D.people = arr(j.people).slice(0, 8).filter(p => p?.name);
    D.scenario = 'custom';
    toast('World ready — read it over and change anything. GM secrets stay hidden unless you open them.', 5000);
  } catch (e) { toast(e.message, 6000); }
  finally { S.worlding = false; renderNew(true); }
}
async function draftWithAI(convert = false) {
  const D = S.draft; if (!D || S.drafting) return;
  if (!textReady()) { toast('Set up your Story AI first.'); return openModal('settings', 'ai'); }
  if (!D.concept.trim()) { toast(convert ? 'Paste your character into the box first.' : 'Describe your character first.'); return $('[data-dpath="concept"]')?.focus(); }
  S.drafting = Date.now(); renderNew(true); buildTimer();
  try {
    const raw = await chat([{ role:'system', content: BUILDER_RULES },
      { role:'user', content:`SETTING\nTitle: ${D.title}\nGenre: ${D.genre}\nPremise: ${D.premise}\nTone: ${D.tone}${D.world ? `\nWorld:\n${D.world}` : ''}\n\n${convert ? 'AN EXISTING CHARACTER TO CONVERT (keep everything it says: name, gender, role, looks, history, personality, abilities, items; turn abilities and flaws into traits and items into gear; only fill in what is missing and fit the numbers to the rules)' : 'PLAYER\'S CHARACTER CONCEPT'}\n${D.concept}${D.name ? `\nName: ${D.name}` : ''}\n\nReturn the JSON build.` }],
      { build:true, stream:false, maxTokens:3200, temperature:0.75, json:true });
    const j = tryJSON(stripThink(raw));
    if (!j || !j.stats) throw new Error('The AI\'s reply wasn\'t a usable build. Try again, or pick a larger model.');
    if ((convert || !D.name.trim()) && j.name) D.name = String(j.name).slice(0, 60);
    { const g = String(j.gender || j.sex || '').toLowerCase(); if ((convert || !D.sex) && /^(f|m)/.test(g)) D.sex = g[0] === 'f' ? 'female' : 'male'; }
    D.storyRole = String(j.story_role || j.storyRole || D.storyRole || '').slice(0, 60);
    { profSeed(D); const ap = String(j.appearance || profOf(D).appearance || '').slice(0, 500); if (ap) profOf(D).appearance = ap; profSync(D); }
    D.backstory = String(j.backstory || D.backstory || '').slice(0, 2000);
    for (const k of STATS) D.stats[k] = clamp(num(j.stats[k]) || 10, 8, 20);
    let guard = 0; while (statPoints(D.stats) > draftBudget(D).cap && guard++ < 60) { const k = STATS.reduce((a, b) => D.stats[a] >= D.stats[b] ? a : b); D.stats[k]--; }
    D.traits = arr(j.traits).map(t => normTrait(t)).filter(t => t.name !== 'Unnamed trait').slice(0, 12);
    const ag = arr(j.gear).map(normGear).filter(g => g.name !== 'Item');
    if (ag.length) D.gear = ag.slice(0, 8);
    toast(convert ? 'Your character is sorted into the sheet. Check it over.' : 'Draft ready — change anything you like.');
  } catch (e) { toast(e.message, 6000); }
  finally { S.drafting = false; renderNew(true); }
}

function createCampaign(s0 = false) {
  const D = S.draft; const b = draftBudget(D);
  if (!D.name.trim()) { toast('Give your character a name.'); return $('[data-dpath="name"]')?.focus(); }
  if (!D.premise.trim()) { toast('Add a premise so the GM knows the story.'); return $('[data-dpath="premise"]')?.focus(); }
  if (b.points > b.cap) return toast(`Stats use ${b.points} of ${b.cap} points — lower some scores, or buy more stat points with TP under Bank & convert.`);
  if (b.left < 0) return toast(`You're ${-b.left} TP over budget — drop a positive or add a negative.`);
  if (D.traits.some(t => !t.name.trim() || t.name === 'Unnamed trait')) return toast('Every trait needs a name.');
  const maxHp = Math.max(1, 10 + mod(D.stats.CON));
  const id = uid();
  const c = {
    id, rules: 2, title: D.title.trim() || D.name.trim() + '\'s Tale', genre: D.genre.trim(), premise: D.premise.trim(), tone: D.tone.trim(), rating: D.rating,
    artStyle: D.art.trim(), gmNotes: D.gmNotes.trim(), magicCost: D.magicCost, world: (D.world || '').trim(), secrets: (D.secrets || '').trim(),
    gm: { preset: D.gmPreset || 'storyteller', name: (D.gmName || '').trim() || 'The Narrator', style: (D.gmStyle || '').trim() }, pinned: [], saves: [], tableTalk: [],
    plan: (D.plan || '').trim(), roadmap: (D.roadmap || '').trim(), rmAct: 0, rmDone: [], threats: [], factions: [], phase: s0 ? 'session0' : 'play', session0: [], createdAt: Date.now(), updatedAt: Date.now(),
    character: { name: D.name.trim(), sex: D.sex || '', storyRole: D.storyRole.trim(), appearance: lookOf(D), backstory: D.backstory.trim(), profile: deep(D.profile || {}), ...(num(D.age) > 0 ? { age: num(D.age) } : {}),
      stats: { ...D.stats }, level: 1, hp: maxHp, maxHp, ep: Math.max(0, num(D.tpToEp)), tp: b.left, gold: num(D.gold),
      traits: D.traits.map(t => ({ ...t, source:'build' })), gear: D.gear.filter(g => g.name.trim()), signatures: D.signatures.filter(s => s.name.trim()), injuries: [], momentum: 0, strain: 0 },
    location:'', quests: [], memory: [], summary:'', summarizedUpTo: 0, pendingRoll: null, combat: false, levelPending: false,
    messages: [{ id: uid(), role:'player', hidden:true, t: Date.now(), text:'Begin the adventure. Open with a specific scene that shows where my character is, what is happening around them and who is present, using the world and their backstory, and introduces a hook. Describe ONLY the surroundings and other characters: my character does not move, speak, decide, think or feel anything in this scene. Stop at the moment I decide what to do. Include an image_prompt for this opening scene.' }]
  };
  c.mode = D.mode === 'companion' || D.mode === 'mp' ? D.mode : 'solo';
  if (c.mode === 'companion') {
    c.magicCost = 'gm'; c.style = COMP_STYLES[D.compStyle] ? D.compStyle : 'chat';
    c.messages[0].text = c.style === 'chat' ? 'Start our chat: send me a first message in character, the way you would text someone you know, short and natural. Mention something specific about your day or about us.' : 'Begin the story. Open with a specific scene that shows where I am, what is happening around me and who is present, bringing in my cast naturally. Show only what I perceive; I don\'t act or speak yet.';
  }
  if (c.mode === 'mp' && !S.addingPlayer) { c.players = [c.character]; c.activeP = 0; }
  if (S.addingPlayer && S.campaigns[S.addingPlayer]) {
    const t = S.campaigns[S.addingPlayer]; S.addingPlayer = null; relinkPlayers(t); syncPlayers(t);
    const nc = c.character; if (D.portrait) { nc.portrait = { ...D.portrait }; t.gallery = arr(t.gallery); t.gallery.unshift({ id: uid(), kind:'character', name: nc.name, prompt: D.portrait.prompt, seed: D.portrait.seed, day: worldOf(t).time.day, t: Date.now() }); }
    t.mode = 'mp'; t.players = arr(t.players).length ? t.players : [t.character]; t.players.push(nc); t.activeP = t.players.length - 1; t.character = nc;
    t.messages.push({ id: uid(), role:'sys', text:`${nc.name} joins the table.` });
    t.messages.push({ id: uid(), role:'player', hidden:true, t: Date.now(), text:`(A new player character joins the group: ${nc.name}${nc.storyRole ? ', ' + nc.storyRole : ''}. ${nc.appearance ? 'Looks: ' + nc.appearance + '. ' : ''}${nc.backstory || ''} Bring them into the current scene in a natural way. Describe only what they perceive; they don't act yet.)` });
    touch(t); saveCampaigns(); S.draft = null; openGame(t.id); gmTurn(); return;
  }
  if (S.replacing && S.campaigns[S.replacing]) {
    const old = S.campaigns[S.replacing]; S.replacing = null; worldOf(old);
    old.fallen = arr(old.fallen).concat([{ name: old.character.name, day: old.time.day }]);
    const was = old.character.name; old.character = c.character; if (D.portrait) { old.character.portrait = { ...D.portrait }; old.gallery = arr(old.gallery); old.gallery.unshift({ id: uid(), kind:'character', name: c.character.name, prompt: D.portrait.prompt, seed: D.portrait.seed, day: worldOf(old).time.day, t: Date.now() }); } old.deathPending = false; old.ended = false; old.pendingRoll = null; old.combat = false;
    old.messages.push({ id: uid(), role:'sys', text:`${was} is gone. ${c.character.name} enters the story.` });
    old.messages.push({ id: uid(), role:'player', hidden:true, t: Date.now(), text:`(${was} has died. The player now plays a new character, ${c.character.name}: ${c.character.storyRole || ''}. ${c.character.backstory || ''} Bring them into the story in a natural way, near where events stand. Describe only what they perceive; they do not act yet.)` });
    touch(old); saveCampaigns(); S.draft = null; openGame(old.id); gmTurn(); return;
  }
  worldOf(c); addThreats(c, D.threats); addFactions(c, D.factions);
  c.research = { topic: D.research?.topic || '', auto: true, sources: arr(D.research?.sources) };
  if (arr(D.pinned).length) c.pinned = [...new Set([...arr(c.pinned), ...D.pinned])];
  if (arr(D.people).length) { c.codex = arr(c.codex); upsertPeople(c, D.people.map(x => ({ ...x, madeBy: 'research' }))); }
  if (arr(D.cards).length) c.cards = D.cards.map(x => ({ ...x }));
  if (D.portrait) { c.character.portrait = { ...D.portrait }; c.gallery = [{ id: uid(), kind:'character', name: c.character.name, prompt: D.portrait.prompt, seed: D.portrait.seed, day: 1, t: Date.now() }]; }
  S.campaigns[id] = c; delete S.deleted[id]; saveCampaigns();
  const cast = c.mode === 'companion' ? String(D.castText || '').split('\n').map(x => x.replace(/^\s*[-*•\d.)]+\s*/, '').trim()).filter(Boolean).slice(0, 8) : [];
  S.draft = null; openGame(id);
  if (autoPortraitsOn()) peopleOf(c).filter(e => e.madeBy === 'research').slice(0, 4).forEach(e => npcPortrait(c, e.name, true));
  if (cast.length) { S.busy = true; renderDock(); buildCast(c, cast).finally(() => { S.busy = false; renderGame(); if (s0) session0Say(''); else gmTurn(); }); return; }
  if (s0) session0Say(''); else gmTurn();
}
function deleteCampaign(id) {
  const c = S.campaigns[id]; if (!c) return;
  if (!confirm(`Delete "${c.title}"? This removes it from this device${Drive.configured() ? ' and moves its Drive folder to the trash on next sync' : ''}.`)) return;
  /* tombstone is never older than the copy being deleted, so a small clock difference between devices can't revive it */
  S.deleted[id] = Math.max(Date.now(), (c.updatedAt || 0) + 1);
  delete S.campaigns[id]; saveCampaigns(); renderLibrary();
  if (Drive.configured() && Drive.valid()) syncNow(false);
}

/* =========================================================================
   Level up
   ========================================================================= */
function openLevelUp() {
  const c = cur(); if (!c?.levelPending) return;
  S.lu = { orig: deep(c.character), ch: deep(c.character), hp: null, conv: 0, removed: [] };
  openModal('levelup');
}
function luCompute() {
  const L = S.lu, o = L.orig, ch = L.ch;
  let ep = 0; for (const k of STATS) for (let s = o.stats[k] + 1; s <= ch.stats[k]; s++) ep += epCostTo(s);
  let tp = 0;
  for (const t of ch.traits) { const ot = o.traits.find(x => x.id === t.id); if (!ot) tp += POS_COST[t.tier]; else if (t.polarity === '+' && t.tier !== ot.tier) tp += POS_COST[t.tier] - POS_COST[ot.tier]; }
  for (const id of L.removed) { const ot = o.traits.find(x => x.id === id); if (ot) tp += POS_COST[ot.tier]; }
  const epAvail = o.ep + 5 + L.conv, tpAvail = o.tp + 2 - 2 * L.conv;
  return { epSpent: ep, tpSpent: tp, epLeft: epAvail - ep, tpLeft: tpAvail - tp, epAvail, tpAvail };
}
function finishLevelUp() {
  const c = cur(); const L = S.lu; if (!c || !L) return;
  const b = luCompute();
  if (L.hp == null) return toast('Roll your HP first.');
  if (b.epLeft < 0 || b.tpLeft < 0) return toast('You\'ve spent more than you have.');
  const ch = L.ch;
  ch.traits = ch.traits.filter(t => !L.removed.includes(t.id));
  ch.ep = b.epLeft; ch.tp = b.tpLeft; ch.level = L.orig.level + 1; ch.maxHp = L.orig.maxHp + L.hp; ch.hp = Math.min(ch.maxHp, L.orig.hp + L.hp);
  c.character = ch; c.levelPending = false;
  c.messages.push({ id: uid(), role:'sys', text:`Level ${ch.level}! +${L.hp} max HP.` });
  const grew = [];
  for (const p of activeParty(c)) { const g = Math.max(1, d(8) + mod(p.stats.CON)); p.level += 1; p.maxHp += g; p.hp = Math.min(p.maxHp, p.hp + g); const k = STATS.slice().sort((a, b) => p.stats[b] - p.stats[a])[d(3) - 1]; p.stats[k] = Math.min(20, p.stats[k] + 1); grew.push(`${p.name} (+${g} HP, +1 ${k})`); }
  if (grew.length) c.messages.push({ id: uid(), role:'sys', text:'The party grows too: ' + grew.join(', ') + '.' });
  S.lu = null; touch(c); closeModal(); renderGame(); scheduleSync();
}

/* =========================================================================
   Rendering
   ========================================================================= */
const app = () => $('#app');
function rerender() { if (S.view === 'palchat') renderPalChat(); else if (S.view === 'paledit') renderPalEditor(); else if (S.view === 'game' && cur()) renderGame(); else if (S.view === 'new') renderNew(true); else if (S.view === 'setup') renderSetup(); else renderLibrary(); if (S.modal) renderModal(); }
function openGame(id) { relinkPlayers(S.campaigns[id]); S.activeId = id; S.view = 'game'; LS.set('iq.active', id); S.rollResult = null; S.invokeOpen = false; S.editing = null; if (S.recap && S.recap.id !== id) S.recap = null; renderGame(); makeRecap(S.campaigns[id], false); }


