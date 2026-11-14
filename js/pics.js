'use strict';
/* =========================================================================
   Pictures:
   - tap any picture to see it large, with the prompt that made it; change the
     prompt or the negative prompt there, regenerate it, or make more like it
   - companion selfies and scene pictures are written from what is happening in
     the chat right now, the companion's saved look, locked tags and current outfit
   - "Picture with my prompt": your own prompt plus a negative prompt
   - progress and Cancel while a picture is being made
   - the home Gallery is grouped by the story or chat each picture belongs to
   ========================================================================= */

/* ---------- the large view ---------- */
function lbImage(ref) {
  if (!ref) return null;
  if (ref.t === 'pal') return PALS.chats[ref.chat]?.messages.find(m => m.id === ref.msg)?.image || null;
  if (ref.t === 'game') return S.campaigns[ref.id]?.messages.find(m => m.id === ref.msg)?.image || null;
  if (ref.t === 'gal') return arr(S.campaigns[ref.id]?.gallery).find(g => g.id === ref.gid) || null;
  if (ref.t === 'port') return PALS.pals[ref.pal]?.portrait || null;
  return null;
}
function lbSrc(ref) {
  const img = lbImage(ref); if (!img) return '';
  if (ref.t === 'pal') { const ch = PALS.chats[ref.chat]; const m = ch.messages.find(x => x.id === ref.msg); return palImg(img, PALS.pals[m.who] || palsOf(ch)[0], ch); }
  if (ref.t === 'port') return palImg(img, PALS.pals[ref.pal]);
  return imageUrl(img, S.campaigns[ref.id]);
}
function lbSave(ref) {
  if (ref.t === 'pal' || ref.t === 'port') { const x = ref.t === 'pal' ? PALS.chats[ref.chat] : PALS.pals[ref.pal]; if (x) palTouch(x); savePals(); }
  else { const c = S.campaigns[ref.id]; if (c) { touch(c); scheduleSync(); } }
  if (S.view === 'palchat') palRedraw(); else if (S.view === 'game') { renderLog(); if (S.modal) renderModal(); } else if (S.view === 'library') renderLibrary();
}
function closeLightbox() { $('#lightbox')?.remove(); S.lb = null; }
function openLightbox(src, cap, ref) {
  closeLightbox(); if (!src) return;
  const img = ref && ref.t ? lbImage(ref) : null; const info = img || (ref && ref.prompt ? ref : null);
  S.lb = { src, cap, ref: ref && ref.t ? ref : null };
  const el = document.createElement('div'); el.className = 'lightbox'; el.id = 'lightbox';
  const local = String(src).startsWith('data:image/svg');
  el.innerHTML = `<button class="iconbtn lbx" data-lb="close" aria-label="Close">${icon('x')}</button>
    <div class="lbimg"><img src="${esc(src)}" alt="" ${local ? '' : 'class="ld"'} onload="if(this.src.indexOf('data:image/svg'))this.classList.add('ld')">${local ? '<div class="lbwait"><span class="spin"></span> Painting…</div>' : ''}</div>
    <div class="lbside">${cap ? `<div class="cap">${esc(cap)}</div>` : ''}${img ? `<button class="btn sm favbtn ${img.fav ? 'gold' : ''}" data-lb="fav">${img.fav ? '★ In your favorites' : '☆ Add to favorites'}</button>` : ''}
      ${info && info.prompt != null && !info.data ? (img ? `<label class="f"><span>Prompt</span><textarea id="lbPrompt" rows="5">${esc(img.prompt || '')}</textarea></label>
        <label class="f"><span>Negative prompt (things to leave out)</span><textarea id="lbNeg" rows="2" placeholder="e.g. glasses, hat, blurry, extra people">${esc(img.neg || '')}</textarea></label>
        <div class="row wrap"><button class="btn sm gold" data-lb="regen">${icon('redo')} Regenerate</button>${ref.t !== 'port' ? `<button class="btn sm" data-lb="more">${icon('plus')} More like this</button>` : ''}</div>
        <p class="hint">Regenerate repaints this picture from the prompt above (a new take each time). More like this keeps this one and adds another.</p>`
        : `<div class="lbprompt"><b>Prompt</b><p>${esc(info.prompt)}</p></div>`) : ''}</div>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]'); const k = b?.dataset.lb;
    if (k === 'close' || e.target === el || e.target.closest('.lbimg') && !e.target.closest('img')) return closeLightbox();
    if (!k || !S.lb?.ref) return;
    const r = S.lb.ref; const im = lbImage(r); if (!im) return closeLightbox();
    if (k === 'fav') { if (im.fav) delete im.fav; else im.fav = true; lbSave(r); return openLightbox(lbSrc(r), S.lb.cap, r); }
    const prompt = ($('#lbPrompt')?.value || '').replace(/\s+/g, ' ').trim() || im.prompt; const neg = ($('#lbNeg')?.value || '').replace(/\s+/g, ' ').trim();
    if (k === 'regen') { im.prompt = prompt; im.neg = neg; im.seed = d(999999); lbSave(r); openLightbox(lbSrc(r), S.lb.cap, r); }
    else if (k === 'more') {
      const nu = { prompt, neg, seed: d(999999), ...(im.kind ? { kind: im.kind } : {}), ...(im.user ? { user: im.user } : {}) }; let nr = r;
      if (r.t === 'pal') { const ch = PALS.chats[r.chat]; const i = ch.messages.findIndex(m => m.id === r.msg); const src0 = ch.messages[i]; const nm = { id: uid(), role: 'pal', who: src0.who, text: '', mode: src0.mode, pic: 'more', image: nu, t: Date.now() }; ch.messages.splice(i + 1, 0, nm); nr = { t: 'pal', chat: ch.id, msg: nm.id }; }
      else { const c = S.campaigns[r.id]; const g = { id: uid(), kind: im.kind === 'character' ? 'character' : 'place', name: (im.name || S.lb.cap || 'Scene').slice(0, 70), prompt, neg, seed: nu.seed, day: c.time?.day || 1, t: Date.now() }; c.gallery = arr(c.gallery); c.gallery.unshift(g); nr = { t: 'gal', id: c.id, gid: g.id }; }
      lbSave(nr); openLightbox(lbSrc(nr), S.lb.cap, nr);
    }
  });
  document.body.appendChild(el);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.lb) closeLightbox(); });
/* tap a story picture, a journal gallery picture or a companion photo to open it large */
document.addEventListener('click', e => {
  const t = e.target; if (!t || !t.closest || t.closest('.lightbox')) return;
  const sc = t.matches?.('.scene img') ? t : null;
  if (sc && !String(sc.getAttribute('src')).startsWith('data:')) {
    const c = cur(); const m = c?.messages.find(x => x.image && x.image.prompt === sc.alt); if (c && m) openLightbox(sc.src, c.title, { t: 'game', id: c.id, msg: m.id }); return;
  }
  const g = t.closest('[data-galzoom]');
  if (g) { const c = cur(); const it = arr(c?.gallery).find(x => x.id === g.dataset.galzoom); if (it) openLightbox(imageUrl(it, c), it.name, { t: 'gal', id: c.id, gid: it.id }); }
});

/* ---------- progress while Stable Diffusion paints ---------- */
setInterval(async () => {
  const cur0 = typeof LOCAL !== 'undefined' ? LOCAL.cur : null; const els = document.querySelectorAll('.imgprog'); if (!els.length) return;
  let pct = null;
  if (cur0 && S.settings.image.mode === 'local') { try { const r = await fetch(forgeUrl() + '/sdapi/v1/progress?skip_current_image=true', { signal: AbortSignal.timeout?.(1200) }); if (r.ok) pct = Math.round(((await r.json()).progress || 0) * 100); } catch {} }
  els.forEach(el => {
    const im = el.closest('.palphotow')?.querySelector('img'); const src = im?.getAttribute('src') || '';
    if (S.settings.image.mode !== 'local') { el.textContent = 'Painting…'; return; }
    const mine = cur0 && src === localPH(cur0.k);
    el.textContent = mine ? `Painting… ${pct != null && pct > 0 ? pct + '%' : Math.round((Date.now() - cur0.t) / 1000) + 's'}` : cur0 || LOCAL.queue.length ? 'Waiting its turn…' : S.busy ? 'Waiting for the story AI…' : 'Painting…';
  });
}, 1500);
function cancelLocalJob(img, ctx) {
  if (S.settings.image.mode !== 'local' || !img?.prompt) return;
  try {
    const style = ((ctx && ctx.artStyle) || S.settings.image.style || '').trim();
    const k = forgeJob((img.prompt + (style ? ', ' + style : '')).replace(/\s+/g, ' ').slice(0, 900), img.seed || 1, ctx, String(img.neg || '').replace(/\s+/g, ' ').trim().slice(0, 400)).k;
    LOCAL.queue = LOCAL.queue.filter(j => j.k !== k); delete LOCAL.jobs[k];
    if (LOCAL.cur?.k === k) { LOCAL.cancelled = k; LOCAL.cur.ctl.abort(); fetch(forgeUrl() + '/sdapi/v1/interrupt', { method: 'POST' }).catch(() => {}); }
  } catch (e) { console.warn('Cancel failed', e); }
}
window.palImgFail = el => { const ph = el.previousElementSibling; if (!ph) return; const k = (el.getAttribute('src') || '').split('fail-')[1];
  const why = S.settings.image.mode === 'local' ? (LOCAL.fail[k] || 'Stable Diffusion on your PC didn\'t answer.') : 'The picture didn\'t load (free picture services allow about one every 15 seconds).';
  ph.style.display = ''; ph.innerHTML = `<span>${esc(why)}</span><button class="link" data-act="palpicretry">Try again</button>`; };

/* ---------- a photo inside a companion chat ---------- */
function palPhotoHTML(ch, m, p) {
  const src = palImg(m.image, p, ch); if (!src) return '';
  return `<div class="palphotow"><div class="ph"><span class="spin"></span><span class="imgprog">Painting…</span><button class="link" data-act="palpiccancel" data-id="${m.id}">Cancel</button></div><img class="palphoto" data-act="palzoom" data-id="${m.id}" alt="photo" src="${esc(src)}" onload="if(this.src.indexOf('data:image/svg')){this.classList.add('ld');this.previousElementSibling.style.display='none'}" onerror="palImgFail(this)"></div>`;
}
/* write the picture from what is happening in the chat, then paint it */
async function palPicture(ch, o = {}) {
  const ps = palsOf(ch); if (!ps.length || S.palBusy) return;
  if (S.settings.image.mode === 'off') return toast('Pictures are off. Turn them on in Settings → Images.');
  const to = palTo(ch); const selfie = o.kind === 'selfie';
  const p = PALS.pals[o.who] || (ps.length === 1 ? ps[0] : to !== 'all' ? to : selfie ? null : ps[0]);
  if (!p) return toast('Pick who should send it first (the To: buttons).');
  const subjects = selfie || ps.length === 1 || o.who || to !== 'all' ? [p] : ps.slice(0, 3);
  const minor = ps.some(palMinor); const adult = !minor && ps.every(x => x.adult);
  const user = String(o.user || '').replace(/\s+/g, ' ').trim().slice(0, 500); const neg = String(o.neg ?? ch.picNeg ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const me = personaOf(ch); const you = meName(ch);
  if (selfie && !o.quiet) ch.messages.push({ id: uid(), role: 'user', text: user ? `Send me a selfie? ${user}` : 'Send me a selfie?', mode: ch.channel || 'text', t: Date.now(), ...(ps.length > 1 ? { to: p.id } : {}) });
  const msg = { id: uid(), role: 'pal', who: p.id, text: '', mode: ch.channel || 'text', t: Date.now() + 1, picBusy: selfie ? 'Taking a selfie…' : 'Picturing the scene…', ...(selfie ? {} : { pic: 'scene' }) };
  ch.messages.push(msg); S.palBusy = { chat: ch.id, msg: msg.id, pic: true };
  S.abort = new AbortController(); const signal = S.abort.signal; palRedraw();
  let j = null;
  try {
    if (o.ctx !== false && !o.exact && textReady()) {
      const recent = ch.messages.filter(m => m !== msg && m.role !== 'sys' && m.text).slice(-10).map(m => `${m.role === 'user' ? you : palWho(ch, m)?.name}: ${m.text}`).join('\n');
      const raw = await chat([
        { role: 'system', content: `You write the description of ONE still picture for an image model, from a private chat. ${selfie ? `It is a selfie that ${p.name} takes and sends right now: taken by ${p.sex === 'male' ? 'himself' : 'herself'} at arm's length or in a mirror, phone-camera look.` : `It shows the moment that is happening right now, as a photograph of the scene with ${subjects.map(x => x.name).join(' and ')}.`}
Base it on what is actually happening in the chat at this moment: where they are, what ${subjects.length > 1 ? 'they are' : first(p.name) + ' is'} doing, mood, time of day.
"prompt": 25-45 words of comma-separated visual phrases: pose and action, facial expression, framing and camera angle, the place, the lighting. Do NOT describe face, hair or body (the app adds the saved look) and use no names.
"wearing": what ${first(p.name)} is wearing in this exact moment if the chat makes it different from the usual outfit (${palOutfit(p) || 'not set'}); otherwise "".
"you_in_frame": true only if ${you} is clearly in the picture too.
"caption": ${selfie ? `the short message ${first(p.name)} sends with the selfie, in ${p.sex === 'male' ? 'his' : 'her'} own voice` : '""'}.
${minor ? 'IMPORTANT: someone in this chat is under 18. The picture is wholesome and fully clothed, nothing suggestive.' : adult ? 'This is an adults-only chat between adults; follow where the chat actually is.' : 'Keep it PG-13: fully clothed, nothing explicit.'}
${user ? `THE PLAYER ASKED FOR THIS IN THE PICTURE (it must be shown): ${user}` : ''}
Reply with JSON only: {"prompt":"","wearing":"","you_in_frame":false,"caption":""}` },
        { role: 'user', content: `${ch.scene ? `WHERE THEY ARE: ${ch.scene}\n` : ''}${ch.channel === 'person' ? 'They are together in person.' : 'They are texting, not in the same place.'}\n\nTHE CHAT RIGHT NOW:\n${recent || '(just starting)'}` }
      ], { stream: false, signal, maxTokens: 260, temperature: 0.7, json: true, helper: true });
      j = tryJSON(stripThink(raw));
    }
  } catch (e) { if (e.name === 'AbortError') { ch.messages = ch.messages.filter(m => m !== msg); S.palBusy = null; S.abort = null; savePals(false); return palRedraw(); } console.warn('Picture prompt failed, using the basic one', e); }
  const looks = subjects.map(x => [x.tags, palLook(x).slice(0, 260)].map(s => String(s || '').trim()).filter(Boolean).join(', '));
  const wearing = String(j?.wearing || '').trim() || palOutfit(p);
  const desc = String(j?.prompt || '').trim() || [selfie ? 'smiling at the camera' : 'candid moment', ch.scene || 'casual setting'].join(', ');
  const prompt = o.exact && user ? user : [selfie ? 'selfie, phone camera photo' : subjects.length > 1 ? `photo of ${subjects.length} people together` : 'candid photo', ...looks, wearing && subjects.length === 1 ? `wearing ${wearing}` : '', desc, user && !desc.toLowerCase().includes(user.toLowerCase().slice(0, 24)) ? user : '', j?.you_in_frame === true && me?.look ? `with ${me.sex === 'female' ? 'a woman' : 'a man'}: ${me.look.slice(0, 160)}` : ''].map(s => String(s || '').trim()).filter(Boolean).join(', ').replace(/\s+/g, ' ').slice(0, 860);
  delete msg.picBusy;
  msg.image = { prompt, seed: d(999999), neg, kind: selfie ? 'selfie' : 'scene', ...(user ? { user } : {}) };
  msg.text = selfie ? String(j?.caption || '').replace(/^["“]|["”]$/g, '').trim().slice(0, 300) || '*sends a selfie*' : '';
  if (o.saveNeg) ch.picNeg = neg;
  if (S.palBusy?.msg === msg.id) S.palBusy = null; if (S.abort?.signal === signal) S.abort = null;
  palTouch(ch); savePals(); palRedraw();
}
/* "Picture with my prompt" */
function palPicModalHTML() {
  const P = S.palPic; const ch = PALS.chats[P?.chat]; if (!P || !ch) return ['Picture', ''];
  const ps = palsOf(ch); const who = PALS.pals[P.who] || ps[0];
  return ['Picture with my prompt', `<div class="gseg"><button class="segbtn ${P.kind === 'selfie' ? 'on' : ''}" data-act="palpickind" data-k="selfie"><b>📷 Selfie</b><small>${esc(first(who.name))} takes it and sends it</small></button><button class="segbtn ${P.kind !== 'selfie' ? 'on' : ''}" data-act="palpickind" data-k="scene"><b>🎨 Scene</b><small>A picture of the moment</small></button></div>
    ${ps.length > 1 ? `<label class="f"><span>Who is in it</span><select id="ppWho">${P.kind === 'selfie' ? '' : `<option value="" ${!P.who ? 'selected' : ''}>Everyone here</option>`}${ps.map(p => `<option value="${p.id}" ${P.who === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}
    <label class="f"><span>What should the picture show? (pose, outfit, place, mood, camera angle…)</span><textarea id="ppUser" rows="4" placeholder="e.g. sitting cross-legged on her bed in an oversized hoodie, messy bun, laughing, warm lamp light, shot from above">${esc(P.user || '')}</textarea></label>
    <label class="f"><span>Negative prompt: things you don't want in it</span><textarea id="ppNeg" rows="2" placeholder="e.g. glasses, hat, extra people, blurry, text">${esc(P.neg || '')}</textarea></label>
    <label class="chk"><input type="checkbox" id="ppSaveNeg" ${P.saveNeg ? 'checked' : ''}> <span>Use this negative prompt for every picture in this chat</span></label>
    <label class="chk"><input type="checkbox" id="ppCtx" ${P.ctx !== false ? 'checked' : ''}> <span>Also use what is happening in the chat right now (place, mood, what she is doing)</span></label>
    <label class="chk"><input type="checkbox" id="ppExact" ${P.exact ? 'checked' : ''}> <span>Use my prompt exactly as written (don't add her saved look, tags or outfit)</span></label>
    <p class="hint">Her saved look, locked tags and current outfit (${esc(palOutfitName(who) || 'none set')}) are added for you, and your Settings → Images negative list still applies on top of this one.</p>
    <div class="row" style="margin-top:10px"><button class="btn gold" data-act="palpicgo">${icon('image')} Make the picture</button><button class="btn ghost" data-act="close">Cancel</button></div>`];
}
function palPicRead() { const P = S.palPic; if (!P || !$('#ppUser')) return P; P.user = $('#ppUser').value; P.neg = $('#ppNeg').value; P.saveNeg = $('#ppSaveNeg').checked; P.ctx = $('#ppCtx').checked; P.exact = $('#ppExact').checked; if ($('#ppWho')) P.who = $('#ppWho').value; return P; }
function palPicAction(act, el) {
  const ch = curChat();
  switch (act) {
    case 'palpicopen': { if (!ch) return true; const to = palTo(ch); const ps = palsOf(ch); S.palPic = { chat: ch.id, kind: 'scene', who: ps.length === 1 ? ps[0].id : to !== 'all' ? to.id : '', user: '', neg: ch.picNeg || '', saveNeg: !!ch.picNeg, ctx: true, exact: false }; openModal('palpic'); setTimeout(() => $('#ppUser')?.focus(), 50); return true; }
    case 'palpickind': { const P = palPicRead(); if (P) { P.kind = el.dataset.k; if (P.kind === 'selfie' && !P.who) P.who = palsOf(PALS.chats[P.chat])[0]?.id || ''; renderModal(); } return true; }
    case 'palpicgo': { const P = palPicRead(); const c2 = PALS.chats[P?.chat]; if (!P || !c2) return true;
      if (P.exact && !String(P.user).trim()) { toast('Write the prompt first, or untick "exactly as written".'); return true; }
      if (S.palBusy) { toast('Wait for the reply to finish first.'); return true; }
      if (!P.saveNeg && c2.picNeg && !String(P.neg).trim()) delete c2.picNeg;
      S.modal = null; $('#modalRoot').innerHTML = ''; palPicture(c2, { kind: P.kind, who: P.who, user: P.user, neg: P.neg, ctx: P.ctx, exact: P.exact, saveNeg: P.saveNeg }); S.palPic = null; return true; }
    case 'palzoom': { const m = ch?.messages.find(x => x.id === el.dataset.id); if (m?.image && !String(el.getAttribute('src')).startsWith('data:image/svg') && !String(el.getAttribute('src')).startsWith('data:,')) { const p = palWho(ch, m); openLightbox(el.src, `${p?.name || ''}${m.image.kind === 'selfie' ? ' · selfie' : ''}`, { t: 'pal', chat: ch.id, msg: m.id }); } return true; }
    case 'palpiccancel': { const m = ch?.messages.find(x => x.id === el.dataset.id); if (!m) return true;
      if (m.picBusy) { S.abort?.abort(); return true; }
      cancelLocalJob(m.image, palCtx(palWho(ch, m), ch)); delete m.image;
      if (!String(m.text || '').trim() || m.text === '*sends a selfie*') ch.messages = ch.messages.filter(x => x !== m);
      palTouch(ch); savePals(); palRedraw(); toast('Picture cancelled.'); return true; }
    case 'palpicretry': if (typeof LOCAL !== 'undefined') { LOCAL.fail = {}; LOCAL.failAt = {}; } palRedraw(); return true;
  }
  return false;
}

/* ---------- home Gallery, grouped by the story or chat each picture belongs to ---------- */
function galleryGroups() {
  const groups = [];
  for (const c of allGames()) {
    const items = [];
    for (const g of arr(c.gallery)) items.push({ src: imageUrl(g, c), name: g.name, fav: !!g.fav, ref: { t: 'gal', id: c.id, gid: g.id } });
    for (const m of arr(c.messages)) if (m.image && !arr(c.gallery).some(g => g.prompt === m.image.prompt && g.seed === m.image.seed)) items.push({ src: imageUrl(m.image, c), name: '', fav: !!m.image.fav, ref: { t: 'game', id: c.id, msg: m.id } });
    if (items.length) groups.push({ key: c.id, title: c.title, kind: gameKind(c) + ' story', items });
  }
  for (const ch of palChats()) {
    const ps = palsOf(ch); if (!ps.length) continue; const items = [];
    for (const m of arr(ch.messages)) if (m.image) { const p = PALS.pals[m.who] || ps[0]; const src = palImg(m.image, p, ch); if (src) items.push({ src, name: `${p.name}${m.image.kind === 'selfie' ? ' · selfie' : ''}`, fav: !!m.image.fav, ref: { t: 'pal', chat: ch.id, msg: m.id } }); }
    if (items.length) groups.push({ key: 'chat_' + ch.id, title: ch.title || ps.map(p => p.name).join(', '), kind: ps.length > 1 ? 'Group chat' : 'Companion chat', items: items.reverse() });
  }
  const ports = allPals().filter(p => p.portrait).map(p => ({ src: palImg(p.portrait, p), name: p.name, fav: !!p.portrait.fav, ref: p.portrait.data ? null : { t: 'port', pal: p.id } })).filter(x => x.src);
  if (ports.length) groups.push({ key: 'ports', title: 'Companion portraits', kind: 'Companions', items: ports });
  return groups;
}
function homeGalleryHTML() {
  if (S.settings.image.mode === 'off') return `<div class="hhead"><h1>Gallery</h1></div><p class="empty">Pictures are turned off. Turn them on in Settings → Images.</p>`;
  const groups = galleryGroups(); const total = groups.reduce((a, g) => a + g.items.length, 0);
  const favs = groups.flatMap(g => g.items.filter(x => x.fav).map(x => ({ ...x, name: x.name || g.title })));
  if (favs.length) groups.unshift({ key: 'favs', title: '★ Favorites', kind: 'Pictures you starred', items: favs });
  const sel = groups.find(g => g.key === S.galSel);
  const tile = (x, title) => `<button class="gtile" data-act="lightbox" data-src="${esc(x.src)}" data-cap="${esc((x.name ? x.name + ' · ' : '') + title)}" ${x.ref ? `data-ref='${esc(JSON.stringify(x.ref))}'` : ''}>${imgTag(x.src, '', x.name)}${x.fav ? '<i class="favstar">★</i>' : ''}<span>${esc(x.name || title)}</span></button>`;
  return `<div class="hhead"><h1>Gallery <span class="count">${total}</span></h1></div>
    ${groups.length ? `<div class="chips galchips"><button class="chip ${!sel ? 'on' : ''}" data-act="galsel" data-k="">All</button>${groups.map(g => `<button class="chip ${sel === g ? 'on' : ''}" data-act="galsel" data-k="${esc(g.key)}">${esc(g.title)} <small>${g.items.length}</small></button>`).join('')}</div>
      ${(sel ? [sel] : groups).map(g => `<section class="galsec"><div class="galhd"><div><b>${esc(g.title)}</b><small>${esc(g.kind)} · ${g.items.length} picture${g.items.length === 1 ? '' : 's'}</small></div>${!sel && g.items.length > 8 ? `<button class="link" data-act="galsel" data-k="${esc(g.key)}">Show all ${g.items.length}</button>` : ''}</div>
        <div class="gal">${(sel ? g.items.slice(0, 300) : g.items.slice(0, 8)).map(x => tile(x, g.title)).join('')}</div></section>`).join('')}` : '<p class="empty">Portraits and scene pictures from your games and chats collect here, sorted by the story or chat they came from.</p>'}`;
}
