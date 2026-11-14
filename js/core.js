'use strict';
/* =========================================================================
   Outer Realm — personal AI Game Master (rules v2)
   Single-file app. Data lives in this browser and, optionally, in a
   Google Drive folder you choose (one subfolder per adventure).
   ========================================================================= */

const APP = 'Outer Realm';
const DEFAULT_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/1OmcF_QlkQbFngOgVjhxDZuYh6OeBkDeN';   /* Iron Quill Stories, michael@bufordlcm.com */
const OLD_DRIVE_FOLDERS = ['1aWDwaZMkUamrvVr7u8ErpXrJfdkXivEr'];
const INDEX_FILE = '_ironquill-index.json';
const KEYS_FILE = 'ironquill-keys.json';
const KEEP_RECENT = 14;
const SUMMARIZE_AFTER = 10;

/* ---------- rules ---------- */
const STATS = ['STR','DEX','CON','INT','WIS','CHA'];
const STAT_FULL = { STR:'Strength', DEX:'Dexterity', CON:'Constitution', INT:'Intelligence', WIS:'Wisdom', CHA:'Charisma' };
const STAT_DESC = {
  STR:'Raw physical power: hitting hard in melee, lifting, breaking things down, grappling, and blocking blows.',
  DEX:'Speed and precision: dodging, sneaking, aiming bows and thrown weapons, picking locks, sleight of hand, balance.',
  CON:'Toughness and stamina: it sets your hit points, and resists poison, sickness, cold, pain and exhaustion.',
  INT:'Knowledge and reasoning: lore and history, investigating clues, solving puzzles, studied magic.',
  WIS:'Awareness and willpower: noticing hidden things, reading people\'s intentions, survival, resisting fear and mind magic.',
  CHA:'Force of personality: persuading, lying, bargaining, intimidating, performing and leading others.'
};
const SN = k => STAT_FULL[k] || k;
const STAT_NAMES = { STRENGTH:'STR', DEXTERITY:'DEX', CONSTITUTION:'CON', INTELLIGENCE:'INT', WISDOM:'WIS', CHARISMA:'CHA' };
const TIERS = ['D','C','B','A','S'];
const TV = { D:1, C:2, B:3, A:4, S:5 };
const POS_COST = { D:2, C:4, B:6, A:8, S:10 };
const NEG_BUILD = { D:1, C:3, B:5, A:7, S:9 };
const NEG_PLAY = { D:1, C:2, B:4, A:6, S:8 };
const GEAR_COST = { D:1, C:2, B:3, A:4, S:5 };
const POINT_COST = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9, 16:10, 17:11, 18:12, 19:13, 20:15 };
const STAT_BUDGET = 35, START_TP = 10, START_GOLD = 15;
const RATINGS = ['Family-friendly','PG-13','Mature (R)','Adult (18+)'];
const RATING_RULES = {
  'Family-friendly': 'no gore, no sexual content, no strong language.',
  'PG-13': 'action violence without lingering gore, mild language, romance fades to black.',
  'Mature (R)': 'graphic violence, strong language and dark themes are fine; sexual scenes fade to black.',
  'Adult (18+)': 'graphic violence, strong language, dark themes and explicit sexual content are allowed when the story and the player lead there. Respect the player\'s lead and the standing requests. Sexual content only ever involves adults (18+), never anyone under 18.'
};
const MAGIC_LABEL = { gm:"GM's call", strain:'Strain', free:'Free casting', none:'No magic' };

/* ---------- helpers ---------- */
function folderIdFrom(s) { s = String(s || '').trim(); const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/); if (m) return m[1]; return /^[\w-]{10,}$/.test(s) ? s : ''; }
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0; };
const arr = v => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const deep = o => JSON.parse(JSON.stringify(o));
const mod = s => Math.floor((num(s) - 10) / 2);
const fmt = n => (n >= 0 ? '+' : '−') + Math.abs(n);
const d = sides => { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % sides); };
const effectSlots = t => t === 'S' ? 3 : (t === 'B' || t === 'A') ? 2 : 1;
const epCostTo = s => s <= 12 ? 3 : s <= 15 ? 5 : s <= 17 ? 8 : s <= 19 ? 12 : 15;
const statPoints = st => STATS.reduce((a, k) => a + (POINT_COST[clamp(num(st[k]), 8, 20)] ?? 0), 0);
const ago = t => { if (!t) return ''; const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60) + ' min ago'; if (s < 86400) return Math.floor(s/3600) + ' hr ago'; return new Date(t).toLocaleDateString(); };
function getPath(o, p) { return p.split('.').reduce((a, k) => a == null ? a : a[k], o); }
function setPath(o, p, v) { const ks = p.split('.'); let a = o; for (const k of ks.slice(0, -1)) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; } a[ks[ks.length - 1]] = v; }
function normStat(s, dflt = 'DEX') { let k = String(s || '').toUpperCase().trim(); k = STAT_NAMES[k] || k.slice(0, 3); return STATS.includes(k) ? k : dflt; }
const tierOf = t => TIERS.includes(String(t || '').toUpperCase()) ? String(t).toUpperCase() : 'D';

const LS = {
  get(k, dflt) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; } catch { return dflt; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast('Browser storage is full — export a backup and delete old adventures.'); return false; } }
};

const ICON = {
  back:'<path d="M15 18l-6-6 6-6"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  send:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  stop:'<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  redo:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  undo:'<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  cloud:'<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 17.2"/><path d="M6 19h11.5"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  download:'<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>',
  upload:'<path d="M12 21V9M6 13l6-6 6 6M4 3h16"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/>',
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  dots:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  scroll:'<path d="M8 3h11v15a3 3 0 0 1-3 3H7"/><path d="M5 3a2 2 0 0 0-2 2v2h5V5a2 2 0 0 0-2-2zM7 21a3 3 0 0 0 3-3V7"/><path d="M12 8h4M12 12h4"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  speaker:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${ICON[n]}</svg>`;
let toastTimer;
function toast(msg, ms = 3200) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------- providers & content ---------- */
/* Google OAuth Client ID for Drive sync. Not a secret — once you create one,
   paste it here so every device only has to tap "Connect Google Drive". */
const DEFAULT_CLIENT_ID = '18344580134-e8jbjhhmrieegn4tj57d8is6f7uspq1m.apps.googleusercontent.com';   /* Iron Quill project, michael@bufordlcm.com */
const OLD_CLIENT_IDS = ['62872295580-f6pf5i15jaoo5mnskkrooe8gfosjo7v8.apps.googleusercontent.com'];

const PRESETS = {
  openrouter: { label:'OpenRouter', short:'OpenRouter', baseUrl:'https://openrouter.ai/api/v1', key:true, keyUrl:'https://openrouter.ai/settings/keys', freeOnly:true,
    pick:[/deepseek.*(chat|v3|v4).*:free/, /deepseek.*:free/, /qwen.*(235b|72b|80b|32b|30b).*:free/, /llama.*(70b|405b|maverick).*:free/, /kimi.*:free/, /glm.*:free/, /mistral.*(medium|small|large).*:free/, /gemma.*(27b|31b|12b).*:free/, /nemotron.*:free/, /minimax.*:free/, /gemini.*flash.*:free/, /:free$/],
    note:'Free account, dozens of free open models (DeepSeek, Llama, Qwen, Mistral). Best all-round choice.' },
  gemini:     { label:'Google Gemini', short:'Gemini', baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai', key:true, keyUrl:'https://aistudio.google.com/apikey', defaultModel:'gemini-flash-latest',
    pick:[/^gemini-[\d.]+-flash$/, /^gemini-flash-latest$/, /^gemini-.*flash/],
    note:'Free key from Google AI Studio. Strong storyteller, generous free limits. Sign in with any Google account.' },
  pollinations:{ label:'Pollinations', short:'Pollinations', baseUrl:'https://gen.pollinations.ai/v1', key:true, keyUrl:'https://enter.pollinations.ai', defaultModel:'openai',
    pick:[/^openai$/, /^openai-large$/, /^mistral/, /^deepseek/, /./], note:'Paid with Pollen credits since Nov 2026; needs a secret sk_ key (pk_ keys no longer generate). Free scene images need no key.' },
  ollama:     { label:'Ollama (my own computer)', short:'Ollama', baseUrl:'http://localhost:11434/v1', key:false, keyUrl:'https://ollama.com/download', ctx:12288,
    pick:[/wayfarer/i, /^dolphin/, /mistral-nemo/, /^qwen/, /^llama/, /./],
    note:'Free, unlimited and private. On this PC use http://localhost:11434/v1; from your phone use your Tailscale address + /v1.' },
  custom:     { label:'Custom (OpenAI-compatible)', short:'Custom', baseUrl:'', key:false, pick:[/./], note:'LM Studio, KoboldCpp, text-generation-webui, a relay you host, etc.' }
};
/* Providers that refuse direct browser connections (no CORS) */
const NO_BROWSER = { groq:'Groq', cerebras:'Cerebras' };

const SCENARIOS = [
  { id:'fantasy', name:'Classic Fantasy', title:'The Lantern Road', genre:'High fantasy', magic:'strain',
    premise:'Caravans on the Lantern Road have been vanishing between the frontier town of Greywater and the mountain passes. You arrive in Greywater with empty pockets and a reason of your own to find out why.',
    tone:'Adventurous and warm, with real danger', art:'painterly fantasy illustration, rich color, cinematic lighting', gear:['Traveling clothes','Backpack','Dagger','Waterskin'] },
  { id:'academy', name:'Magic Academy Survival', title:'Veyrmont Academy', genre:'Magic academy with a game-like System', magic:'free',
    premise:'You wake in a dormitory of Veyrmont Academy, a sprawling school of magic where failing students simply disappear. On your first morning a translucent blue window flickers into view that only you can see: [SURVIVAL SYSTEM ONLINE]. It issues quests, tracks your progress, and rewards or punishes you. Survive the term, find out what happens to the students who vanish, and learn who installed the System. Show System messages in [square brackets].',
    tone:'Tense and mysterious, with wry humor', art:'anime-inspired fantasy illustration, magical academy, soft glow, detailed background', gear:['Academy uniform','Student wand','Blank grimoire','Dorm key'] },
  { id:'grim', name:'Grimdark', title:'The Ashen City', genre:'Grim low fantasy', magic:'strain',
    premise:'Plague has sealed the walls of Varrow. Bread is scarce, the watch is corrupt, and the cult of the Pale Mother promises salvation. You have three days to get someone you love out of the city before the gates are burned shut.',
    tone:'Gritty, desperate, morally gray', art:'dark oil painting, muted palette, chiaroscuro, grim atmosphere', gear:['Patched cloak','Knife','Stale bread','Bent lockpicks'] },
  { id:'scifi', name:'Sci-Fi Salvage', title:'Derelict: Morning Star', genre:'Grounded science fiction', magic:'none',
    premise:'Your two-person salvage tug has latched onto the Morning Star, a colony ship that went silent forty years ago. Your partner went aboard six hours ago and stopped answering. You suit up.',
    tone:'Tense and isolated, wonder mixed with dread', art:'cinematic sci-fi concept art, volumetric light, highly detailed', gear:['Vac suit (4 hrs air)','Plasma cutter','Hand scanner','Med patch'] },
  { id:'horror', name:'Cosmic Horror', title:'The Saltmarsh Letters', genre:'1920s cosmic horror investigation', magic:'gm',
    premise:'A letter from your estranged uncle arrives a week after his funeral, begging you to burn the house on Saltmarsh Lane before the tide turns. You arrive in the fishing town of Innsmere at dusk.',
    tone:'Slow-burn dread, investigative', art:'moody 1920s illustration, ink and wash, fog, eerie', gear:['Revolver (6 rounds)','Electric torch','Notebook','Uncle\'s letter'] },
  { id:'custom', name:'Write my own', title:'', genre:'', premise:'', tone:'', art:'', magic:'gm', gear:[] }
];

const DEFAULT_SETTINGS = {
  text: { temperature:0.85, maxTokens:1000, stream:true, length:'long', lenV2:true },
  ai:   { conns: [], active:'', fallback:true, deliberate:true, verify:true, referee:true, dice:'normal', people:true, agency:true, profile:'balanced', helperModel:'', helperAuto:'', builder:'auto' },
  image:{ mode:'pollinations', polliKey:'', polliModel:'flux', size:'square', style:'', template:'', forgePreset:'auto', forgeModel:'', forgeModelSfw:'', forgeModelNsfw:'', forgeShare:true, forgeNeg:'', autoPortraits:true, driveSave:true, scenes:true, forgeRes:'fast', refPhotos:true, refWeight:0.7 },
  drive:{ clientId: DEFAULT_CLIENT_ID, folder: DEFAULT_DRIVE_FOLDER, autoSync:true },
  net:  { on:true, auto:true },
  ui:   { narr:17, showChoices:true, physicalDice:false, voice:'tap', voiceName:'', voiceRate:1, voiceVol:1, voiceEngine:'auto', voicePC:'', charVoices:true, typeMode:'say', quick:true, music:true, musicVol:0.35, musicMood:'auto', ambience:true, ambVol:0.25, diceMath:true, compTurns:true, shifts:'big', bottomGap:'phone', bottomGapPx:64 },
  updatedAt: 0
};

/* ---------- state ---------- */
function mergeDefaults(v, dflt) { const out = deep(dflt); for (const k in v) { if (v[k] && typeof v[k] === 'object' && !Array.isArray(v[k]) && out[k] && typeof out[k] === 'object') out[k] = { ...out[k], ...v[k] }; else out[k] = v[k]; } return out; }
const S = {
  settings: mergeDefaults(LS.get('iq.settings', {}), DEFAULT_SETTINGS),
  campaigns: LS.get('iq.campaigns', {}),
  deleted: LS.get('iq.deleted', {}),
  view:'library', activeId:null, draft:null, drafting:false,
  busy:false, abort:null, ooc:false, syncing:false, syncStatus:'', modal:null, modalTab:null, models:null,
  invokeOpen:false, invokeSel:[], ruling:false, rollResult:null, rolling:false, lu:null
};
const cur = () => S.campaigns[S.activeId];
function saveSettings(touchIt = true) { if (touchIt) S.settings.updatedAt = Date.now(); LS.set('iq.settings', S.settings); applyUI(); }
function saveCampaigns() { LS.set('iq.campaigns', S.campaigns); LS.set('iq.deleted', S.deleted); }
function touch(c) { if (c.players && c.mode === 'mp') c.players[c.activeP || 0] = c.character; c.updatedAt = Date.now(); saveCampaigns(); }
function applyUI() {
  const r = document.documentElement; r.style.setProperty('--narr', (S.settings.ui.narr || 17) + 'px');
  /* free Netlify sites show a banner along the bottom on phones: keep a plain black strip there so it never covers the Send button */
  const g = S.settings.ui.bottomGap || 'phone';
  r.classList.toggle('nlgap', g === 'always' || (g === 'phone' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)));
  r.style.setProperty('--nl-gap', (Number(S.settings.ui.bottomGapPx) || 64) + 'px');
}
