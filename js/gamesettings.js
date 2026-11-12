'use strict';
/* ---------- Game Settings: everything about how play feels (dice, sound, flow, this story) ---------- */
const seg = (path, opts) => {   /* a row of buttons; opts: [[value, label, small]] */
  const curV = getPath(S.settings, path);
  return `<div class="gseg">${opts.map(([v, l, sub]) => `<button class="segbtn ${curV === v ? 'on' : ''}" data-act="gset" data-path="${path}" data-v='${esc(JSON.stringify(v))}'><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>`;
};
const slider = (path, label, min, max, step, show) => { const v = Number(getPath(S.settings, path)); return `<label class="f"><span>${label} <i class="sval">${show(v)}</i></span><input type="range" min="${min}" max="${max}" step="${step}" data-bind="${path}" value="${v}" style="width:100%;accent-color:var(--gold)"></label>`; };
const pct = v => Math.round(v * 100) + '%';

function gameSettingsHTML() {
  const c = cur(); const tabsList = [['dice', '🎲 Dice'], ['sound', '🔊 Sound'], ['flow', '📖 Game flow']];
  if (c) tabsList.push(['story', '⚖ This story']);
  const tab = tabsList.some(t => t[0] === S.modalTab) ? S.modalTab : 'dice';
  const tabs = tabsList.map(([id, l]) => tabBtn(id, l, tab)).join('');
  const ui = S.settings.ui; let body = '';
  if (tab === 'dice') {
    body = `<div class="sect" style="font-size:18px;margin-top:0">Who rolls the dice</div>
      ${seg('ui.physicalDice', [[false, 'The app rolls', 'Tap Roll and the app throws a d20'], [true, 'My own dice', 'Roll real dice, then type the number you got']])}
      <div class="sect" style="font-size:18px">How often the GM asks for a roll</div>
      ${seg('ai.dice', [['less', 'Fewer', 'Only for danger and big moments'], ['normal', 'Normal', 'When it\'s uncertain and matters'], ['more', 'More', 'Whenever there\'s any doubt']])}
      <p class="hint">Want a roll for one action anyway? Add <b>(roll)</b> to what you write, e.g. "I try to talk the guard down (roll)".</p>
      <div class="sect" style="font-size:18px">Roll results</div>
      ${seg('ui.diceMath', [[true, 'Show the math', 'Die + bonuses = total vs DC'], [false, 'Just the result', 'Total and success or failure']])}
      <p class="hint">How rolls work: d20 + your stat bonus + any trait bonuses. Meet or beat the DC to succeed. A natural 20 is a critical success, a natural 1 a critical failure. In a fight, successes build Momentum (spend it for +3 or a reroll).</p>`;
  } else if (tab === 'sound') {
    body = `<div class="sect" style="font-size:18px;margin-top:0">Background music</div>
      ${seg('ui.music', [[true, 'On', 'Changes with the scene'], [false, 'Off', '']])}
      ${ui.music !== false ? `${slider('ui.musicVol', 'Music volume', 0, 1, 0.05, pct)}
      <label class="f"><span>What plays</span><select data-bind="ui.musicMood"><option value="auto" ${(ui.musicMood || 'auto') === 'auto' ? 'selected' : ''}>Automatic: follows the scene (calm, town, battle, dread…)</option>${MOOD_KEYS.map(k => `<option value="${k}" ${ui.musicMood === k ? 'selected' : ''}>Always: ${esc(MOODS[k].label)}</option>`).join('')}</select></label>
      <p class="hint" id="musicNow">${musicNowHTML()}</p>
      <p class="hint">Music gets quieter while voices read, and switches when a fight starts or the mood changes.</p>` : ''}
      <div class="sect" style="font-size:18px">Ambient sounds</div>
      ${seg('ui.ambience', [[true, 'On', 'Rain, wind, waves, fire, night'], [false, 'Off', '']])}
      ${ui.ambience !== false ? `${slider('ui.ambVol', 'Ambience volume', 0, 1, 0.05, pct)}
      <p class="hint">Made from the weather and the place in the story${AMB.kind ? `: now <b>${AMB_LABEL[AMB.kind]}</b>` : ''}.</p>` : ''}
      <div class="sect" style="font-size:18px">Voices</div>
      ${voiceSettingsHTML()}
      <div class="sect" style="font-size:18px">Music credits</div>
      <p class="hint">Free music under the <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> license. ${MUSIC_CREDITS.map(m => `Music by <b>${esc(m.who)}</b> (<a href="${m.url}" target="_blank" rel="noopener">${esc(m.url.replace('https://', ''))}</a>)`).join('; ')}. Tracks were re-encoded to load faster; nothing else was changed.</p>`;
  } else if (tab === 'flow') {
    const im = S.settings.image;
    body = `<label class="f"><span>Scene length</span><select data-bind="text.length">${Object.entries(SCENE_LEN).map(([k, v]) => `<option value="${k}" ${(S.settings.text.length || 'short') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <p class="hint">Short scenes keep things moving: the GM shows one moment, then hands it back to you.</p>
      <div class="sect" style="font-size:18px;margin-top:0">"The world shifts" box under scenes</div>
      ${seg('ui.shifts', [['big', 'Only big changes', 'Items, gold, quests, wounds, level ups'], ['all', 'Everything', 'Also EP, rumors, time, trust, fixes'], ['off', 'Never', 'Check the Panel instead']])}
      ${bindCheck('ui.showChoices', 'Suggested actions: show 3 ideas for what to do next under each scene')}
      ${bindCheck('ui.quick', 'Quick buttons: Make camp, Look around, Talk to the party')}
      ${bindCheck('ui.compTurns', 'Companions speak up and act on their own when it fits')}
      ${im.mode !== 'off' ? bindCheck('image.scenes', 'Paint scene pictures automatically at new places and big moments') : ''}
      ${S.settings.net?.on !== false ? bindCheck('net.auto', 'Let the GM look up real facts online by itself when the story needs them') : ''}
      <div class="sect" style="font-size:18px">Writing your turn</div>
      ${typingSettingsHTML()}`;
  } else if (tab === 'story' && c) {
    const comp = isCompanion(c); const g = c.gm || {};
    body = `<p class="hint" style="margin-top:0;color:var(--ink)">Only for <b>${esc(c.title)}</b>. Changes apply from the next turn.</p>
      <label class="f"><span>Content rating</span><select data-cbind="rating">${Object.keys(RATING_RULES).map(k => `<option ${(c.rating || 'PG-13') === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <p class="hint">${esc(RATING_RULES[c.rating || 'PG-13'] || '')}</p>
      <label class="f"><span>${comp ? 'Narrator' : 'Game Master'} personality</span><select data-cbind="gm.preset">${Object.entries(GM_PRESETS).map(([k, v]) => `<option value="${k}" ${(g.preset || 'storyteller') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      ${g.preset === 'custom' ? `<label class="f"><span>Describe your GM</span><textarea rows="2" data-cbind="gm.style" placeholder="A gravel-voiced old mercenary who narrates like he was there…">${esc(g.style || '')}</textarea></label>` : `<p class="hint">${esc(GM_PRESETS[g.preset || 'storyteller']?.style || '')}</p>`}
      ${!comp ? `<label class="f"><span>Magic</span><select data-cbind="magicCost">${Object.entries(MAGIC_LABEL).map(([k, v]) => `<option value="${k}" ${(c.magicCost || 'gm') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
      <label class="f"><span>Standing requests for the ${comp ? 'narrator' : 'GM'}</span><textarea rows="4" data-cbind="gmNotes" placeholder="More puzzles, less combat, keep scenes short…">${esc(c.gmNotes || '')}</textarea></label>
      <p class="hint">One request per line. The GM follows these every turn. "Ask the GM" and the Story Doc add to this list too.</p>`;
  }
  return [tabs, body];
}
