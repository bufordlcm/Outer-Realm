'use strict';
/* every script is loaded now: bring saved campaigns up to date (one broken save can't stop the app) */
for (const c of Object.values(S.campaigns)) { try { migrate(c); } catch (e) { console.warn('Could not update a saved campaign', c?.title, e); } }
/* ---------- events ---------- */
document.addEventListener('click', e => {
  unlockTTS(); unlockMusic();
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act; const c = cur(); const D = S.draft;
  if (act.startsWith('bible')) { bibleAction(act, el); return; }
  if (homeAction(act, el) || panelAction(act, el, c) || memoryAction(act, el, c)) return;
  switch (act) {
    case 'party': S.compForm = null; openModal('party'); break;
    case 'people': openModal('people'); break;
    case 'npcscan': scanPeople(c); break;
    case 'draftport': { if (!D) break; const look = (D.appearance || '').trim(); if (!look && !D.name.trim()) { toast('Describe their appearance first.'); break; }
      D.portrait = { prompt: portraitPrompt(look || D.name, D.storyRole), seed: d(999999) }; renderNew(); break; }
    case 'draftportdel': if (D) { delete D.portrait; renderNew(); } break;
    case 'research': if (D) researchWorld(D); break;
    case 'lookup': S.lookupMsg = ''; openModal('lookup'); setTimeout(() => $('#lookupQ')?.focus(), 40); break;
    case 'lookupgo': { const q = ($('#lookupQ')?.value || '').trim(); if (!q) { toast('Type what to look up.'); break; } S.lookupQ = q; S.lookupBusy = true; S.lookupMsg = 'Searching and reading sources…'; renderModal();
      lookupLore(c, q, { manual: true }).then(r => { S.lookupMsg = r ? `✓ Saved what the sources say about ${r.name}.` : `The sources didn't clearly cover "${q}". Try other words.`; })
        .catch(e => { S.lookupMsg = '✗ ' + e.message; }).finally(() => { S.lookupBusy = false; renderModal(); }); break; }
    case 'npclook': { const n = el.dataset.n; el.disabled = true; el.innerHTML = '<span class="spin sm"></span>';
      lookupLore(c, n, { manual: true }).then(r => toast(r ? `🔎 Looked up ${r.name}` : `Nothing clear online about ${n}.`, 3000)).catch(e => toast(e.message, 4000)).finally(() => renderModal()); break; }
    case 'netcheck': NET.checked = 0; S.netStatus = 'Checking…'; renderModal(); NET.helper().then(h => { S.netStatus = h ? `✓ Helper on your PC found: web search via ${h.searxng ? 'SearXNG (no limits)' : 'DuckDuckGo (SearXNG isn\'t running; Wikipedia as backup)'}, plus full page reading.` : '✗ The helper on your PC isn\'t reachable, so research uses Wikipedia only. Start "Start Ironquill pictures" on your PC (and on the phone, connect Tailscale).'; renderModal(); }); break;
    case 'researchtoggle': c.research = { ...(c.research || {}), auto: el.checked }; touch(c); break;
    case 'npcadd': S.npcForm = true; renderModal(); setTimeout(() => $('#np_name')?.focus(), 40); break;
    case 'npccancel': S.npcForm = false; renderModal(); break;
    case 'npcsave': { const g = k => ($('#np_' + k)?.value || '').trim(); const name = g('name'); if (!name) { toast('Give them a name.'); break; }
      upsertPeople(c, [{ name, text: g('text') || 'Someone you created.', look: g('look'), where: g('where'), madeBy: 'player' }]);
      const e = peopleOf(c).find(x => x.name.toLowerCase() === name.toLowerCase()); if (e) { e.madeBy = 'player'; if (g('look')) e.look = g('look'); }
      if ($('#np_bring')?.checked) c.gmNotes = [c.gmNotes, `Bring ${name} into the story soon: ${g('text')}${g('look') ? ' (looks: ' + g('look') + ')' : ''}.`].filter(Boolean).join('\n');
      if (S.settings.image.mode !== 'off' && $('#np_paint')?.checked) npcPortrait(c, name, true);
      S.npcForm = false; touch(c); scheduleSync(); renderModal(); toast(`${name} added to People.`); break; }
    case 'npcport': npcPortrait(c, el.dataset.n); renderModal(); break;
    case 'npctalk': { const n = el.dataset.n; closeModal(); const inp = $('#input'); if (inp) { inp.value = `I turn to ${n}: "`; autoGrow(inp); inp.focus(); } break; }
    case 'npcdel': if (confirm(`Remove ${el.dataset.n} from your People list?`)) { c.codex = arr(c.codex).filter(e => !(e.kind === 'person' && e.name === el.dataset.n)); touch(c); scheduleSync(); renderModal(); } break;
    case 'menu': openModal('menu'); break;
    case 'tools': openModal('tools', el.dataset.tab); break;
    case 'storybook': exportStorybook(c); break;
    case 'quick': playerAct(el.dataset.q); break;
    case 'mic': startMic(); break;
    case 'speak': { const m = c?.messages.find(x => x.id === el.dataset.mid); if (m) { if (voiceBusy()) stopVoice(); else speakMessage(c, m); } break; }
    case 'voicestop': stopVoice(); break;
    case 'fmt': fmtInsert(el.dataset.k); break;
    case 'drawer': toggleDrawer(el.dataset.k); break;
    case 'drawpick': drawerPick(el); break;
    case 'rmnext': case 'rmback': { if (!c) break; const n = parseRoadmap(c.roadmap).length; c.rmAct = clamp(num(c.rmAct) + (act === 'rmnext' ? 1 : -1), 0, n); touch(c); saveCampaigns(); renderModal(); break; }
    case 'voicecheck': checkPCVoices(true).then(() => { renderModal(); toast(VOICE.pc ? 'Natural PC voices found.' : 'No PC voices found. Run Install voices.bat on the PC, then restart the helper.'); }); break;
    case 'voicetest': speak(`${gmOf(c || {}).name || 'The Narrator'} clears their throat. The tale begins.`); break;
    case 'compform': S.compForm = el.dataset.f; renderModal(); setTimeout(() => $('#compConcept, #cm_name')?.focus(), 40); break;
    case 'compcancel': S.compForm = null; renderModal(); break;
    case 'compmake': { const v = ($('#compConcept')?.value || '').trim(); if (!v) { toast('Describe the companion first.'); break; } makeCompanion(v, el.dataset.by); break; }
    case 'compsave': { const g = k => ($('#cm_' + k)?.value || '').trim(); if (!g('name')) { toast('Give them a name.'); break; }
      const p = normComp({ name: g('name'), role: g('role'), personality: g('personality'), voice: g('voice'), goals: g('goals'), appearance: g('appearance'), secrets: g('secrets'), trust: 2 }, 'player');
      c.party = arr(c.party); c.party.push(p); if (autoPortraitsOn()) portraitFor(c, p.id, true); c.gmNotes = [c.gmNotes, `${p.name} travels with the player as a companion; bring them into the scene.`].filter(Boolean).join('\n');
      S.compForm = null; touch(c); scheduleSync(); renderModal(); renderGame(); renderModal(); break; }
    case 'compreveal': { const p = arr(c.party).find(x => x.id === el.dataset.id); if (p && confirm(`Reveal ${p.name}'s full card, including their secrets? This may spoil surprises the GM has planned.`)) { p.revealed = true; touch(c); renderModal(); } break; }
    case 'compportrait': portraitFor(c, el.dataset.id); renderModal(); break;
    case 'comptalk': { const p = arr(c.party).find(x => x.id === el.dataset.id); closeModal(); const inp = $('#input'); if (p && inp) { inp.value = `I turn to ${p.name}: "`; autoGrow(inp); inp.focus(); } break; }
    case 'compdel': { const p = arr(c.party).find(x => x.id === el.dataset.id); if (p && confirm(`Remove ${p.name} from this adventure entirely? (To have them leave in the story, just play it out.)`)) { c.party = c.party.filter(x => x !== p); touch(c); scheduleSync(); renderModal(); } break; }
    case 'deathcomp': continueAsCompanion(el.dataset.id); break;
    case 'deathnew': newCharacterAfterDeath(); break;
    case 'deathend': endWithEpilogue(); break;
    case 'unend': c.ended = false; touch(c); renderDock(); break;
    case 'codexkind': S.codexKind = el.dataset.k; renderModal(); break;
    case 'diarywrite': writeDiary(c); break;
    case 'galregen': { const g = arr(c.gallery).find(x => x.id === el.dataset.id); if (g) { const old = g.seed; g.seed = d(999999); for (const p of [c.character, ...arr(c.party)]) if (p.portrait && p.portrait.seed === old) p.portrait.seed = g.seed; touch(c); scheduleSync(); renderModal(); } break; }
    case 'talkto': c.talkTo = el.dataset.id; touch(c); renderDock(); break;
    case 'compedit': S.compEdit = S.compEdit === el.dataset.id ? null : el.dataset.id; renderModal(); break;
    case 'compeditdone': S.compEdit = null; touch(c); scheduleSync(); renderModal(); renderGame(); break;
    case 'picstoggle': S.settings.image.scenes = S.settings.image.scenes === false; saveSettings(); renderModal(); toast(S.settings.image.scenes ? 'Scene pictures on.' : 'Scene pictures off. Tap Illustrate on any scene when you want one.', 3500); break;
    case 'galretry': LOCAL.fail = {}; LOCAL.failAt = {}; NET.checked = 0; renderModal(); toast(S.settings.image.mode === 'local' ? 'Trying again. Make sure Forge and the helper window are running on your PC.' : 'Trying again. The free picture service allows about one picture every 15 seconds.', 4500); break;
    case 'galdel': c.gallery = arr(c.gallery).filter(x => x.id !== el.dataset.id); touch(c); scheduleSync(); renderModal(); break;
    case 'modalbg': if (e.target === el) closeModal(); break;
    case 'close': closeModal(); break;
    case 'gamesettings': openModal('game', S.modal === 'game' ? S.modalTab : null); break;
    case 'gset': setPath(S.settings, el.dataset.path, JSON.parse(el.dataset.v)); saveSettings(); musicScene(cur()); musicLevel(); renderModal(); break;
    case 'musicskip': musicSkip(); break;
    case 'cidreset': S.settings.drive.clientId = DEFAULT_CLIENT_ID; saveSettings(); renderModal(); toast('Client ID fixed. Tap Connect & sync.'); break;
    case 'modelpick': S.modelPick = S.modelPick === el.dataset.id ? null : el.dataset.id; S.modelQ = ''; refreshConnUI(); break;
    case 'modelset': { const cn = conns().find(x => x.id === el.dataset.id); if (cn && el.dataset.m) { cn.model = el.dataset.m.trim(); cn.status = ''; cn.note = ''; S.modelPick = null; S.modelQ = ''; saveSettings(); setupConn(cn); } break; }
    case 'modellist': { const cn = conns().find(x => x.id === el.dataset.id); if (cn) { cn.typing = false; refreshConnUI(); } break; }
    case 'helpersame': S.settings.ai.helperAuto = 'off'; S.settings.ai.helperModel = ''; saveSettings(); renderModal(); toast('Your story model now does every step. Turns should start faster.'); break;
    case 'tab': S.modalTab = el.dataset.id; S.models = null; renderModal(); $('#modalBody').scrollTop = 0; break;
    case 'home': S.abort?.abort(); renderLibrary(); break;
    case 'new': renderModePick(); break;
    case 'pickmode': S.draft = newDraft(); S.draft.mode = el.dataset.mode; S.addingPlayer = null; S.replacing = null; renderNew(); break;
    case 'actor': setActor(c, Number(el.dataset.i)); break;
    case 'addcancel': { const id = S.addingPlayer; S.addingPlayer = null; S.draft = null; if (id && S.campaigns[id]) openGame(id); else renderLibrary(); break; }
    case 'addplayer': if (S.busy) break; addPlayerFlow(c); break;
    case 'open': if (!e.target.closest('[data-act="del"]')) openGame(el.dataset.id); break;
    case 'del': e.stopPropagation(); deleteCampaign(el.dataset.id); break;
    case 'scenario': { const sc = SCENARIOS.find(s => s.id === el.dataset.id); const n = newDraft(sc);
      for (const k of ['concept','name','pronouns','storyRole','appearance','backstory','stats','traits','signatures','tpToEp','tpToStats','worldPrompt','gmPreset','gmName','gmStyle']) n[k] = D[k];
      if (!D.gear.length || D.gear.every(g => SCENARIOS.some(s => s.gear.includes(g.name)))) n.gear = sc.gear.map(normGear); else n.gear = D.gear;
      S.draft = n; renderNew(true); break; }
    case 'aiconvert': draftWithAI(true); break;
    case 'aidraft': draftWithAI(); break;
    case 'aiworld': worldWithAI(); break;
    case 'dstat': { const k = el.dataset.k; D.stats[k] = clamp(D.stats[k] + num(el.dataset.d), 8, 20); renderNew(true); break; }
    case 'dadd': { const list = el.dataset.list;
      if (list === 'traits') D.traits.push(normTrait({ name:'', polarity: el.dataset.pol, tier:'D' }));
      else if (list === 'gear') D.gear.push({ id: uid(), name:'', desc:'', tier:'' });
      else D.signatures.push({ id: uid(), name:'', desc:'', cost: 8 });
      renderNew(true); break; }
    case 'ddel': D[el.dataset.list].splice(num(el.dataset.i), 1); renderNew(true); break;
    case 'begin': if (!textReady()) { toast('Finish AI setup first.'); openModal('settings', 'ai'); } else createCampaign(false); break;
    case 'begins0': if (!textReady()) { toast('Finish AI setup first.'); openModal('settings', 'ai'); } else createCampaign(true); break;
    case 's0send': sendInput(); break;
    case 's0ready': finishSession0(); break;
    case 'settings': openModal('settings'); break;
    case 'guide': openModal('guide'); break;
    case 'sheet': openModal('sheet'); break;
    case 'journal': openModal('journal'); break;
    case 'levelup': openLevelUp(); break;
    case 'sync': syncNow(true); break;
    case 'drivedisc': Drive.disconnect(); setSync('Disconnected from Google Drive.'); renderModal(); break;
    case 'export': exportFile(); break;
    case 'import': $('#importFile').click(); break;
    case 'wipe': if (confirm('Erase all adventures and settings on this device? (Google Drive copies are not touched.)')) { localStorage.clear(); location.reload(); } break;
    case 'setup': closeModal(); renderSetup(); app().querySelector('.page').scrollTop = 0; break;
    case 'noop': break;
    case 'findollama': detectOllama(); break;
    case 'keypaste': { const v = $('#keyPaste')?.value || ''; if (!v.trim()) { toast('Paste a key first.'); break; } importKeys(v); break; }
    case 'keyfile': $('#keysFile').click(); break;
    case 'keytemplate': download('ironquill-keys.txt', KEY_TEMPLATE, 'text/plain'); break;
    case 'keyexport': download(KEYS_FILE, keysFileContent()); toast('Keys file downloaded. Keep it private — it holds your keys.', 4500); break;
    case 'keydrive': saveKeysToDrive(); break;
    case 'keymanual': { const p = $('#manPreset').value; const addr = $('#manAddr').value.trim(); const key = $('#manKey').value.trim();
      if (PRESETS[p].key && !key) { toast('That provider needs a key.'); break; }
      if (p === 'custom' && !addr) { toast('Custom needs an address.'); break; }
      const c = newConn(p, key, addr ? { baseUrl: addr.replace(/\/+$/, '') } : {}); conns().push(c);
      if (!S.settings.ai.active) S.settings.ai.active = c.id; saveSettings(); refreshConnUI(); setupConn(c); break; }
    case 'connuse': S.settings.ai.active = el.dataset.id; saveSettings(); refreshConnUI(); toast('Now using ' + connName(activeConn())); break;
    case 'conndel': { const c0 = conns().find(x => x.id === el.dataset.id); if (!c0 || !confirm(`Remove ${c0.label} (${maskKey(c0.apiKey)}) from this device?`)) break;
      S.settings.ai.conns = conns().filter(x => x !== c0); if (S.settings.ai.active === c0.id) S.settings.ai.active = (conns().find(connReady) || conns()[0] || {}).id || ''; saveSettings(); refreshConnUI(); break; }
    case 'conntest': { const c0 = conns().find(x => x.id === el.dataset.id); if (c0) setupConn(c0); break; }
    case 'connpick': { const c0 = conns().find(x => x.id === el.dataset.id); if (c0) setupConn(c0, { repick: true }); break; }
    case 'connretry': S.settings.ai.active = el.dataset.id; saveSettings(); c.messages = c.messages.filter(m => m.role !== 'err'); gmTurn(); break;
    case 'testimg': testImage(); break;
    case 'forgefind': { const v = ($('#forgeUrlIn')?.value || '').trim(); if (v) LS.set('iq.forgeUrl', v.replace(/\/+$/, '')); LOCAL.fail = {}; forgeFind(false); break; }
    case 'photostyle': if (c) { c.artStyle = PHOTO_STYLE; touch(c); scheduleSync(); } else { S.settings.image.style = PHOTO_STYLE; saveSettings(); } toast('Photo-realistic style set. Tap "New image" on a scene to repaint it.', 4000); renderModal(); break;
    case 'send': sendInput(); break;
    case 'stop': S.abort?.abort(); break;
    case 'choice': { const ch = c.messages[lastIndex(c, 'gm')]?.choices?.[num(el.dataset.i)]; if (ch) playerAct(choiceParts(ch).act); break; }
    case 'ooc': case 'askgm': openModal('askgm'); scrollTalk(); setTimeout(() => $('#askText')?.focus(), 60); break;
    case 'asksend': { const v = ($('#askText')?.value || '').trim(); if (v) { S.askDraft = ''; askGM(v); } break; }
    case 'askquick': askGM(el.dataset.q); break;
    case 'editmsg': S.editing = el.dataset.mid; renderLog(); setTimeout(() => $('#editText')?.focus(), 30); break;
    case 'editcancel': S.editing = null; renderLog(); break;
    case 'editsave': { const m = c?.messages.find(x => x.id === el.dataset.mid); const v = ($('#editText')?.value || '').trim(); if (m && v) { m.text = v; m.edited = true; touch(c); scheduleSync(); } S.editing = null; renderLog(); break; }
    case 'fixopen': S.fixProposal = null; openModal('fix'); setTimeout(() => $('#fixText')?.focus(), 60); break;
    case 'fixsend': requestFix(); break;
    case 'fixapply': applyFix(); break;
    case 'fixredo': S.fixProposal = null; renderModal(); break;
    case 'savenew': { const name = ($('#saveName')?.value || '').trim() || `Save ${new Date().toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}`; makeSave(c, name, false); touch(c); renderModal(); scheduleSync(); toast('Saved: ' + name); break; }
    case 'saveload': loadSave(el.dataset.id); break;
    case 'savedel': { const sv = c.saves.find(x => x.id === el.dataset.id); if (sv && confirm(`Delete the save "${sv.name}"?`)) { c.saves = c.saves.filter(x => x !== sv); touch(c); renderModal(); scheduleSync(); } break; }
    case 'recap': closeModal(); makeRecap(c, true); break;
    case 'recapdone': S.recap = null; renderLog(); break;
    case 'diceok': answerDice(false); break;
    case 'dicerand': answerDice(true); break;
    case 'roll': doRoll(el.dataset.mode); break;
    case 'reroll': doRoll(); break;
    case 'rollok': finalizeRoll(); break;
    case 'momplus': if (c.pendingRoll) { c.pendingRoll.momentumPlus = true; renderLog(); } break;
    case 'invopen': S.invokeOpen = true; S.invokeSel = []; renderLog(); break;
    case 'invclose': S.invokeOpen = false; renderLog(); break;
    case 'invsel': { const id = el.dataset.id; S.invokeArg = $('#invokeText')?.value || ''; S.invokeSel = S.invokeSel.includes(id) ? S.invokeSel.filter(x => x !== id) : [...S.invokeSel, id]; renderLog(); break; }
    case 'ruling': askRuling(); break;
    case 'skiproll': { const rm = c.messages.find(m => m.id === c.pendingRoll?.msgId); if (rm?.rollAsk) { c.messages = c.messages.filter(m => m !== rm); c.pendingRoll = null; S.rollResult = null; touch(c); renderLog(); gmTurn({ noRoll: true }); break; } }
      c.pendingRoll = null; S.rollResult = null; S.invokeOpen = false; touch(c); renderLog(); renderDock(); $('#input')?.focus(); break;
    case 'regen': regenerate(); break;
    case 'uncut': { const m = c?.messages.find(x => x.id === el.dataset.mid); if (m?.original) { m.text = m.original; delete m.original; delete m.cut; m.notes = arr(m.notes).filter(n => !n.t.startsWith('✂')); touch(c); renderLog(); scheduleSync(); } break; }
    case 'retry': c.messages = c.messages.filter(m => m.role !== 'err'); gmTurn(); break;
    case 'undo': undoTurn(); break;
    case 'illustrate': illustrate(el.dataset.mid); break;
    case 'newimg': { const m = c?.messages.find(x => x.id === el.dataset.mid); if (m?.image) { m.image.seed = d(999999); touch(c); renderLog(); scheduleSync(); } break; }
    case 'retryimg': if (S.settings.image.mode === 'local') { const im = el.closest('.scene')?.querySelector('img'); const k = (im?.getAttribute('src') || '').split('fail-')[1]; if (k) delete LOCAL.fail[k]; renderLog(); break; }
    { const sc = el.closest('.scene'); const img = sc?.querySelector('img'); if (img) { sc.querySelector('.ph').innerHTML = '<div class="spin"></div><div>Painting the scene…</div>'; const u = img.src.replace(/&r=\d+$/, ''); img.src = u + '&r=' + d(9999); } break; }
    case 'qstatus': { const q = c.quests[num(el.dataset.i)]; q.status = q.status === 'active' ? 'completed' : q.status === 'completed' ? 'failed' : 'active'; touch(c); renderModal(); scheduleSync(); break; }
    case 'qdel': c.quests.splice(num(el.dataset.i), 1); touch(c); renderModal(); scheduleSync(); break;
    case 'qadd': { const v = $('#newQuest').value.trim(); if (v) { c.quests.push({ title: v, status:'active' }); touch(c); renderModal(); scheduleSync(); } break; }
    case 'injdel': c.character.injuries.splice(num(el.dataset.i), 1); touch(c); renderModal(); renderHUD(); scheduleSync(); break;
    case 'geardel': c.character.gear.splice(num(el.dataset.i), 1); touch(c); renderModal(); scheduleSync(); break;
    case 'gearadd': c.character.gear.push({ id: uid(), name:'New item', desc:'', tier:'' }); touch(c); renderModal(); break;
    case 'combattoggle': c.combat = el.checked; if (!c.combat) c.character.momentum = 0; touch(c); renderHUD(); break;
    /* level up */
    case 'luhp': if (physical()) askDice('Level-up hit points: 1d8', 8, 1).then(v => { if (S.lu) { S.lu.hp = Math.max(1, v + mod(S.lu.orig.stats.CON)); renderModal(); } }); else { S.lu.hp = Math.max(1, d(8) + mod(S.lu.orig.stats.CON)); renderModal(); } break;
    case 'luconv': { const L = S.lu; const nv = Math.max(0, L.conv + num(el.dataset.d)); const prev = L.conv; L.conv = nv; if (luCompute().tpLeft < 0) L.conv = prev; renderModal(); break; }
    case 'lustat': { const k = el.dataset.k; const L = S.lu; const dd = num(el.dataset.d); const nv = L.ch.stats[k] + dd;
      if (nv < L.orig.stats[k] || nv > 20) break; L.ch.stats[k] = nv; if (luCompute().epLeft < 0) L.ch.stats[k] -= dd; renderModal(); break; }
    case 'lutier': { const L = S.lu; const t = L.ch.traits.find(x => x.id === el.dataset.id); const ti = TIERS.indexOf(t.tier) + num(el.dataset.d); if (ti < 0 || ti > 4) break;
      const prev = t.tier; t.tier = TIERS[ti]; if (luCompute().tpLeft < 0) t.tier = prev; renderModal(); break; }
    case 'luadd': { const name = $('#luName').value.trim(); if (!name) { toast('Name the trait.'); break; }
      const t = normTrait({ name, polarity:'+', tier: $('#luTier').value, trigger: $('#luTrigger').value, effects: $('#luEffects').value.split('\n') }, 'level');
      S.lu.ch.traits.push(t); if (luCompute().tpLeft < 0) { S.lu.ch.traits.pop(); toast('Not enough TP for that tier.'); } renderModal(); break; }
    case 'ludelnew': S.lu.ch.traits = S.lu.ch.traits.filter(t => t.id !== el.dataset.id); renderModal(); break;
    case 'lurem': { const L = S.lu; const id = el.dataset.id; if (L.removed.includes(id)) L.removed = L.removed.filter(x => x !== id); else { L.removed.push(id); if (luCompute().tpLeft < 0) L.removed.pop(); } renderModal(); break; }
    case 'lureset': openLevelUp(); break;
    case 'lufinish': finishLevelUp(); break;
  }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.bind) {
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value;
    setPath(S.settings, el.dataset.bind, v); if (el.dataset.bind === 'ai.helperModel') S.settings.ai.helperAuto = v ? '' : 'off'; saveSettings();
    if (/^ui\.(music|amb)/.test(el.dataset.bind)) { musicScene(cur()); musicLevel(); const sv = el.closest('label')?.querySelector('.sval'); if (sv) sv.textContent = pct(v); }
    if (el.tagName === 'SELECT' || el.dataset.bind === 'drive.folder') { if (el.tagName === 'SELECT') renderModal(); else { const h = el.closest('label')?.nextElementSibling; if (h && h.classList.contains('hint')) { const fid = folderIdFrom(el.value); h.innerHTML = fid ? `Folder ID: <code>${esc(fid)}</code>` : '<span style="color:var(--red)">Paste a Google Drive folder link.</span>'; } } }
  } else if (el.dataset.dpath && S.draft) {
    let v = el.value;
    if (el.dataset.list) v = v.split('\n').map(s => s.trim()).filter(Boolean);
    else if (el.dataset.num) v = num(v);
    setPath(S.draft, el.dataset.dpath, v);
    if (el.tagName === 'SELECT') renderNew(true); else updateBudgets();
  } else if (el.dataset.lpath && S.lu) {
    setPath(S.lu.ch, el.dataset.lpath, el.value.split('\n').map(s => s.trim()).filter(Boolean));
  } else if (el.dataset.cbind && cur()) {
    const c = cur(); let v = el.value;
    if (el.dataset.list) v = v.split('\n').map(s => s.trim()).filter(Boolean);
    else if (el.type === 'number') v = num(v);
    setPath(c, el.dataset.cbind, v);
    const ch = c.character; ch.maxHp = Math.max(1, ch.maxHp); ch.hp = clamp(ch.hp, 0, ch.maxHp); ch.momentum = clamp(num(ch.momentum), 0, 3); ch.strain = Math.max(0, num(ch.strain));
    touch(c); renderHUD(); scheduleSync();
    if (el.tagName === 'SELECT' && S.modal) renderModal();
  } else if (el.id === 'rollHow') { const r = cur()?.pendingRoll; if (r) { r.how = el.value.slice(0, 400); touch(cur()); } }
  else if (el.id === 'modelQ') { S.modelQ = el.value; const c2 = conns().find(x => x.id === el.dataset.cid); const l = $('#mlist'); if (c2 && l) l.innerHTML = modelListHTML(c2); }
  else if (el.id === 'input') autoGrow(el);
  else if (el.id === 'askText') S.askDraft = el.value;
  else if (el.dataset.pedit) { const p = arr(cur()?.party).find(x => x.id === el.dataset.pedit); if (p) { p[el.dataset.k] = el.value; touch(cur()); } }
  else if (el.id === 'lookupQ') S.lookupQ = el.value;
  else if (el.id === 'peopleQ') { S.peopleQ = el.value; const pos = el.selectionStart; renderModal(); const n = $('#peopleQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  else if (el.id === 'codexQ') { S.codexQ = el.value; const pos = el.selectionStart; renderModal(); const n = $('#codexQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'forgeUrlIn') { LS.set('iq.forgeUrl', el.value.trim().replace(/\/+$/, '')); LOCAL.fail = {}; return; }
  if (el.dataset.pvoice) { const p = arr(cur()?.party).find(x => x.id === el.dataset.pvoice); if (p) { const fld = engine() === 'pc' ? 'vPC' : 'vDev'; if (el.value) p[fld] = el.value; else delete p[fld]; if (fld === 'vDev') p.ttsVoice = el.value; touch(cur()); speak(`${p.name} here. This is how I sound.`, voiceOf(cur(), p, p.name)); } return; }
  if (el.dataset.conn) {   /* model typed or picked from the list */
    const c = conns().find(x => x.id === el.dataset.conn); if (!c) return;
    if (el.dataset.field === 'ctx') { c.ctx = Math.max(0, num(el.value)); saveSettings(); return; }
    if (el.value === '__type') { c.typing = true; refreshConnUI(); setTimeout(() => $(`input[data-conn="${c.id}"][data-field="model"]`)?.focus(), 50); return; }
    c[el.dataset.field] = el.value.trim(); c.status = ''; c.note = ''; if (el.tagName === 'SELECT') c.typing = false; saveSettings(); if (c.model) setupConn(c); else refreshConnUI();
  }
  if (S.view === 'setup' && el.dataset.bind && el.dataset.bind.startsWith('drive.')) renderSetup();
});
$('#bibleFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { S.bibleText = await f.text(); renderModal(); toast(`Loaded ${f.name}. Tap the gold button to use it.`); } catch (err) { toast('Couldn\'t read that file: ' + err.message, 5000); }
});
$('#keysFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { importKeys(await f.text()); } catch (err) { toast('Couldn\'t read that file: ' + err.message, 5000); }
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); sendInput(); }
  if (e.target.id === 'newQuest' && e.key === 'Enter') { e.preventDefault(); $('[data-act="qadd"]').click(); }
  if (e.target.id === 'askText' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); $('[data-act="asksend"]')?.click(); }
  if (e.target.id === 'diceVal' && e.key === 'Enter') { e.preventDefault(); answerDice(false); }
  if (e.target.id === 'saveName' && e.key === 'Enter') { e.preventDefault(); $('[data-act="savenew"]')?.click(); }
  if (e.key === 'Escape' && S.modal) closeModal();
});
/* Sync when you come back to the app, and push pending changes right away when you leave it
   (background tabs slow timers down, which could delay a scheduled sync by a minute). */
document.addEventListener('visibilitychange', () => {
  if (!Drive.valid() || S.busy || !S.settings.drive.autoSync) return;
  if (document.visibilityState === 'visible') syncNow(false);
  else if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; syncNow(false); }
});

/* ---------- boot ---------- */
(function boot() {
  if (!S.settings.image.v2) { S.settings.image.v2 = true; if (S.settings.image.size === 'landscape') S.settings.image.size = 'square'; if (S.settings.image.forgePreset === 'lightning') S.settings.image.forgePreset = 'auto'; LS.set('iq.settings', S.settings); }
  applyUI(); Drive.init(); saveCampaigns();
  const last = LS.get('iq.active', null);
  renderLibrary();   /* always open on Home; the Continue button resumes the last story */
  if (!isPhone() && !conns().some(c => c.preset === 'ollama') && (!LS.get('iq.ollamaProbed', false) || !textReady())) {
    LS.set('iq.ollamaProbed', true);
    detectOllama({ quiet: true }).then(found => { if (found && S.view === 'library') renderLibrary(); });
  }
  if (Drive.configured() && Drive.valid()) syncNow(false);
  else if (Drive.configured() && LS.get('iq.driveok', false)) setSync('Tap Sync to load your latest saves from Google Drive');
})();
