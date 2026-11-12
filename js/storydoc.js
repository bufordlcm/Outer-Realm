'use strict';
/* =========================================================================
   Plot roadmap  +  the Story Doc (one Google Doc per story, two-way)

   Roadmap text (written in the builder, the Story Doc or story settings):
     Act 1: Title | goal
     - beat
     - beat
   The GM steers toward the current act's beats (gently: the player's choices
   come first); the bookkeeper ticks beats off and closes acts.

   Story Doc: a Google Doc named "Story Doc" inside each story's Drive folder.
   The app rewrites it whenever the story changes. Any section you edit in
   Google Docs flows back into the story and the GM uses it from the next turn.
   ========================================================================= */

/* ---------- roadmap ---------- */
function parseRoadmap(text) {
  const acts = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(/^(?:act|chapter|part)\s*([0-9ivx]+)?\s*[:.\-–]\s*(.*)$/i);
    if (m) { const [title, ...goal] = m[2].split('|'); acts.push({ title: title.trim(), goal: goal.join('|').trim(), beats: [] }); continue; }
    const b = line.replace(/^[-*•]\s*/, '').trim();
    if (!acts.length) acts.push({ title: 'The story', goal: '', beats: [] });
    if (b) acts[acts.length - 1].beats.push(b);
  }
  return acts;
}
const beatKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
function roadmapState(c) {
  const acts = parseRoadmap(c.roadmap); if (!acts.length) return null;
  const i = clamp(num(c.rmAct), 0, acts.length - 1); const done = new Set(arr(c.rmDone).map(beatKey));
  const act = acts[i]; const left = act.beats.filter(b => !done.has(beatKey(b)));
  return { acts, i, act, left, done, finished: num(c.rmAct) >= acts.length };
}
function roadmapPrompt(c) {
  const r = roadmapState(c); if (!r) return '';
  if (r.finished) return 'PLOT ROADMAP: every act is complete. Follow the player into whatever comes next, or toward an ending.';
  const later = r.acts.slice(r.i + 1).map((a, k) => `Act ${r.i + 2 + k}: ${a.title}`).join('; ');
  return [`PLOT ROADMAP (hidden from the player). Steer gently toward it: offer hooks, let consequences lead there, and never force the player or decide their actions. If they wander, let the world move on without them.`,
    `NOW: Act ${r.i + 1} of ${r.acts.length}: ${r.act.title}${r.act.goal ? ' | ' + r.act.goal : ''}`,
    r.left.length ? `Beats still to come in this act (any order): ${r.left.map(b => '\n- ' + b).join('')}` : 'Every beat of this act has happened: bring the act to a close and open the next.',
    later ? `Later acts (foreshadow only): ${later}` : 'This is the final act.'].join('\n');
}
function roadmapBookkeep(c) {
  const r = roadmapState(c); if (!r || r.finished) return { state: '', spec: '' };
  return {
    state: `PLOT ACT NOW: Act ${r.i + 1}: ${r.act.title}${r.act.goal ? ' (' + r.act.goal + ')' : ''}. Beats not yet happened: ${r.left.join(' / ') || 'none'}`,
    spec: '"roadmap": {"beats_done": ["copy the exact words of any listed beat that clearly happened in THIS scene"], "act_done": true only when the act\'s goal was clearly reached}'
  };
}
function applyRoadmap(c, st, notes) {
  const r = roadmapState(c); const rm = st?.roadmap; if (!r || r.finished || !rm || typeof rm !== 'object') return;
  c.rmDone = arr(c.rmDone);
  for (const b of arr(rm.beats_done)) {
    const k = beatKey(b); if (!k) continue;
    const hit = r.act.beats.find(x => beatKey(x) === k || beatKey(x).startsWith(k.slice(0, 24)) || k.startsWith(beatKey(x).slice(0, 24)));
    if (hit && !r.done.has(beatKey(hit))) { c.rmDone.push(hit); r.done.add(beatKey(hit)); }
  }
  const allDone = r.act.beats.length && r.act.beats.every(b => r.done.has(beatKey(b)));
  if (rm.act_done === true || allDone) {
    c.rmAct = r.i + 1;
    notes.push(c.rmAct >= r.acts.length ? { t: '📜 The final chapter is complete', k: 'gold' } : { t: `📜 Chapter ${c.rmAct + 1} begins`, k: 'gold' });
  }
}
function roadmapProgressText(c) {
  const r = roadmapState(c); if (!r) return 'No roadmap yet.';
  if (r.finished) return `All ${r.acts.length} acts complete.`;
  return [`Now in Act ${r.i + 1} of ${r.acts.length}: ${r.act.title}.`, ...r.act.beats.map(b => `${r.done.has(beatKey(b)) ? '[done]' : '[ ]'} ${b}`)].join('\n');
}

/* ---------- Story Doc ---------- */
const DOC_MIME = 'application/vnd.google-apps.document';
const DOC_NAME = 'Story Doc';
const DOC_SECTIONS = [
  ['premise', 'Premise', true], ['world', 'World', true], ['roadmap', 'Plot roadmap', true], ['progress', 'Where the story is now', false],
  ['secrets', 'Secrets (the Game Master keeps these hidden in play)', true], ['factions', 'Factions', true], ['people', 'People', true],
  ['pinned', 'Pinned facts (always true)', true], ['memory', 'Things to remember', true], ['summary', 'Story so far', true],
  ['character', 'Player character', false], ['notes', 'Notes for the Game Master', true]
];
function docSections(c) {
  const ch = c.character || {};
  return {
    premise: c.premise || '', world: c.world || '', roadmap: c.roadmap || '', progress: roadmapProgressText(c), secrets: c.secrets || '',
    factions: arr(c.factions).map(f => `${f.name}: ${f.desc || ''}`.trim()).join('\n'),
    people: peopleOf(c).map(e => `${e.name}: ${String(e.text || '').replace(/\n/g, ' ')}`).join('\n'),
    pinned: arr(c.pinned).join('\n'), memory: arr(c.memory).join('\n'), summary: c.summary || '',
    character: [`${ch.name || ''}${ch.storyRole ? ', ' + ch.storyRole : ''}${isCompanion(c) ? '' : ` · Level ${ch.level || 1} · HP ${ch.hp}/${ch.maxHp} · ${ch.gold ?? 0} gold`}`, ch.appearance || '', ch.backstory || ''].filter(Boolean).join('\n'),
    notes: c.gmNotes || ''
  };
}
const docNorm = s => String(s || '').replace(/\r/g, '').split('\n').map(l => l.replace(/^\s*[*•]\s+/, '- ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
function docHTML(c) {
  const s = docSections(c);
  const para = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('') || '<p></p>';
  return `<html><body><h1>${esc(c.title || 'Untitled story')}</h1>
<p><i>This is the ${esc(APP)} Story Doc for this adventure. The app updates it as you play. Edit any section and the Game Master will use your changes from the next turn. Keep the § headings as they are. "Where the story is now" and "Player character" are only updated by the app.</i></p>
${DOC_SECTIONS.map(([k, label]) => `<h2>§ ${esc(label)}</h2>${para(s[k])}`).join('\n')}</body></html>`;
}
function parseDoc(text) {
  const out = {}; let key = null; const labels = DOC_SECTIONS.map(([k, l]) => [k, l.toLowerCase()]);
  for (const raw of String(text || '').replace(/^﻿/, '').split('\n')) {
    const line = raw.replace(/\r$/, '');
    const h = line.match(/^\s*§\s*(.+?)\s*$/);
    if (h) { const want = h[1].toLowerCase(); const hit = labels.find(([, l]) => l === want || l.startsWith(want) || want.startsWith(l.split(' (')[0])); key = hit ? hit[0] : null; if (key) out[key] = []; continue; }
    if (key) out[key].push(line);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}
const docHash = s => hashStr(docNorm(s));
/* apply edits made in Google Docs; returns true if anything changed */
function applyDocEdits(c, parsed) {
  const sent = c.storyDoc?.sent || {}; let changed = [];
  for (const [k, , editable] of DOC_SECTIONS) {
    if (!editable || parsed[k] === undefined) continue;
    if (sent[k] && docHash(parsed[k]) === sent[k]) continue;   /* untouched since the app wrote it */
    if (!sent[k] && docHash(parsed[k]) === docHash(docSections(c)[k])) continue;
    const v = docNorm(parsed[k]);
    const lines = v.split('\n').map(l => l.replace(/^- /, '').trim()).filter(Boolean);
    switch (k) {
      case 'premise': c.premise = v; break;
      case 'world': c.world = v; break;
      case 'secrets': c.secrets = v; break;
      case 'summary': c.summary = v; break;
      case 'notes': c.gmNotes = v; break;
      case 'roadmap': c.roadmap = v; c.rmAct = clamp(num(c.rmAct), 0, Math.max(0, parseRoadmap(v).length)); break;
      case 'pinned': c.pinned = lines.slice(0, 40); break;
      case 'memory': c.memory = lines.slice(0, 120); break;
      case 'factions': {
        const old = arr(c.factions); c.factions = lines.map(l => { const [n, ...d] = l.split(':'); const name = n.trim().slice(0, 60); const was = old.find(f => f.name.toLowerCase() === name.toLowerCase()); return { name, rep: was ? was.rep : 0, desc: d.join(':').trim().slice(0, 200) }; }).filter(f => f.name);
        break;
      }
      case 'people': {
        c.codex = arr(c.codex); const keep = new Set();
        for (const l of lines) {
          const [n, ...d] = l.split(':'); const name = n.trim(); const text = d.join(':').trim(); if (!name) continue; keep.add(name.toLowerCase());
          const ex = c.codex.find(e => e.kind === 'person' && e.name.toLowerCase() === name.toLowerCase());
          if (ex) { if (text) ex.text = text.slice(0, 400); } else c.codex.push({ name: name.slice(0, 60), kind: 'person', text: text.slice(0, 400), where: '', day: worldOf(c).time.day, madeBy: 'doc', t: Date.now() });
        }
        c.codex = c.codex.filter(e => e.kind !== 'person' || keep.has(e.name.toLowerCase()));
        break;
      }
    }
    changed.push(DOC_SECTIONS.find(x => x[0] === k)[1].split(' (')[0]);
  }
  return changed;
}
const StoryDoc = {
  url: id => `https://docs.google.com/document/d/${id}/edit`,
  async listAll() {
    const p = new URLSearchParams({ q: `name='${DOC_NAME}' and mimeType='${DOC_MIME}' and trashed=false`, fields: 'files(id,parents,modifiedTime)', pageSize: '500', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
    const j = await (await Drive.api('https://www.googleapis.com/drive/v3/files?' + p)).json();
    const byFolder = {}; for (const f of j.files || []) for (const par of f.parents || []) byFolder[par] = f; return byFolder;
  },
  async read(id) { return (await Drive.api(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`)).text(); },
  async write(c, folderId, existing) {
    const html = docHTML(c); let r;
    if (existing?.id) {
      r = await Drive.api(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,modifiedTime&supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'text/html; charset=UTF-8' }, body: html });
    } else {
      const b = 'iq_' + uid();
      const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: DOC_NAME, mimeType: DOC_MIME, parents: [folderId] })}\r\n--${b}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${b}--`;
      r = await Drive.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime&supportsAllDrives=true', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
    }
    const j = await r.json(); const s = docSections(c);
    c.storyDoc = { id: j.id, folder: folderId, wroteAt: Date.parse(j.modifiedTime) || Date.now(), sent: Object.fromEntries(DOC_SECTIONS.map(([k]) => [k, docHash(s[k])])) };
    return c.storyDoc;
  },
  /* pull edits for every story that has a doc; returns number of stories changed */
  async pullEdits(docs, folderOf) {
    let n = 0;
    for (const c of Object.values(S.campaigns)) {
      const folder = folderOf(c.id); const d = folder && docs[folder]; if (!d) continue;
      const mod = Date.parse(d.modifiedTime) || 0;
      if (c.storyDoc?.id === d.id && mod <= (c.storyDoc.wroteAt || 0) + 1500) continue;
      if (S.busy && c.id === S.activeId) continue;
      try {
        const changed = applyDocEdits(c, parseDoc(await this.read(d.id)));
        c.storyDoc = { ...(c.storyDoc || {}), id: d.id, folder, wroteAt: mod };
        if (changed.length) { touch(c); n++; c.messages.push({ id: uid(), role: 'sys', text: `📄 Story Doc changes picked up: ${changed.join(', ')}.` }); }
      } catch (e) { console.warn('Story Doc read failed', c.title, e); }
    }
    return n;
  }
};
