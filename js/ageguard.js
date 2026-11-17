'use strict';
/* =========================================================================
   Age guard — the one place that decides who counts as a minor, and what
   that means for the story text and for pictures.

   It accepts every shape the app keeps people in:
     - a campaign's player character        { appearance, storyRole, backstory }
     - a same-device player                 same shape
     - a party companion                    { appearance, role, personality }
     - a People / NPC record                { name, text, look }
     - a companion-app companion            { age, face, body, tags, backstory }
     - one of your personas                 { name, look, about }
     - a whole campaign                     via subjectsOf(campaign)

   Keeping it here means the story text, companion chats and picture routing
   cannot drift apart: they all ask the same questions of the same rule.
   ========================================================================= */
const AGE = (() => {
  const MINOR_AGE = 16;

  /* an explicit age: "15", "15 years old", "age 15", "15yo" */
  const AGE_TEXT = /\b(?:(?:1[0-5]|[0-9])\s*-?\s*(?:years?|yrs?)(?:[- ]?old)?|(?:1[0-5]|[0-9])\s*(?:yo|y\/o)\b|aged?\s+(?:1[0-5]|[0-9])\b|age\s*[:=]?\s*(?:1[0-5]|[0-9])\b)/i;
  /* words that describe the person themself, not the people around them */
  const PERSON_WORDS = /\b(?:child(?:ren)?|kids?|toddlers?|infants?|newborns?|bab(?:y|ies)|little ones?)\b/i;
  /* a place that reads as nursery, whatever age the cast is */
  const SCHOOL_SETTING = /\b(?:(?:elementary|middle)[- ]|kindergarten|daycare|nursery|orphanage)\b/i;
  /* "her kid sister", "my nephew", "his daughter": family, not the person */
  const KIN = /\b(?:my|her|his|their|our|your)\s+(?:kid|kids|child|children|sons?|daughters?|nieces?|nephews?|sisters?|brothers?|baby|babies|students?)\b/gi;

  /* the parts that describe the person on screen */
  const IDENTITY = ['name','tagline','storyRole','role','appearance','look','face','body','clothing','tags'];
  /* the parts that tell their history or about the people around them */
  const BIO = ['backstory','about','personality','scenario','userRole','notes','text','desc'];

  const stripKin = s => String(s || '').replace(KIN, ' ');
  const join = (o, keys) => stripKin(keys.map(k => o?.[k]).filter(Boolean).join(' '));
  const ageOf = p => { const n = parseInt(String(p?.age ?? '').match(/\d+/)?.[0], 10); return Number.isFinite(n) ? n : null; };

  /* is this person a minor? */
  function isMinor(p) {
    if (!p) return false;
    const n = ageOf(p);
    if (n != null && n < MINOR_AGE) return true;
    const self = join(p, IDENTITY);
    if (AGE_TEXT.test(self) || PERSON_WORDS.test(self)) return true;
    /* a history may state an age; it may not call them a kid ("as a teenager she...") */
    return AGE_TEXT.test(join(p, BIO));
  }

  /* everyone the player actually plays in a campaign (or the draft itself while building) */
  const subjectsOf = c => {
    if (!c) return [];
    const list = [c.character, ...(Array.isArray(c.players) ? c.players : []), ...(Array.isArray(c.party) ? c.party : [])].filter(Boolean);
    return list.length ? list : (c.name ? [c] : []);
  };
  /* A character can be protected at any age: minors always are, and anyone else can be marked protected
     on their card. A minor is a stated age under 16, or (for anyone but a People record) how they are
     described; prose is too loose for NPCs ("the girl at the bar") to call someone a minor. */
  const statedMinor = p => { const n = ageOf(p); return n != null && n < MINOR_AGE; };
  const guardMinor = p => (p && p.kind === 'person' ? statedMinor(p) : isMinor(p));
  const isProtected = p => !!p && (p.protected === true || guardMinor(p));

  /* Protected characters named to the GM: the party plus the campaign's People records.
     The list is capped so the prompt cannot grow without limit; `more` counts whoever was left out. */
  const MAX_PROMPT_NAMES = 12;
  const peopleOfC = c => (Array.isArray(c?.codex) ? c.codex : []).filter(e => e && e.kind === 'person');
  const promptNames = c => {
    const uniq = [...new Set((c ? subjectsOf(c).concat(peopleOfC(c)) : []).filter(isProtected).map(p => p.name).filter(Boolean))];
    const names = uniq.slice(0, MAX_PROMPT_NAMES);
    return { names, more: uniq.length - names.length };
  };

  /* the one age rule that rides on every rating tier, including M */
  const promptRule = (names = [], more = 0) => 'One rule applies at every rating: sexual content only ever involves adults (16 or older). Never write anyone under 16 into a sexual or romantic scene, and keep pictures of a minor non-explicit.'
    + (names.length ? ` The player has also protected ${names.join(', ')}: never write them into sexual or romantic content, whatever their age.` : '')
    + (more > 0 ? ` ${more} more protected character${more === 1 ? ' is' : 's are'} not listed by name; none of them may appear in sexual or romantic content either.` : '');

  /* May this picture be painted with the explicit model? Judged per picture and per person: the
     subject being painted when the caller knows it, otherwise the player character. Another
     character in the same save being a minor does not lock this picture. */
  function imageAllowed({ prompt = '', campaign = null, subject = null } = {}) {
    const text = String(prompt || '');
    if (AGE_TEXT.test(text) || PERSON_WORDS.test(text)) return { allowed: false, why: 'the picture describes a minor' };
    const c = campaign || {};
    if (SCHOOL_SETTING.test([c.title, c.genre, c.premise, c.location].join(' '))) return { allowed: false, why: 'the setting is a school or nursery' };
    const who = subject || c.character;
    if (who && isProtected(who)) {
      const tag = who.name ? ' (' + who.name + ')' : '';
      return { allowed: false, why: (guardMinor(who) ? 'the picture is of a minor' : 'the picture is of a protected character') + tag };
    }
    return { allowed: true, why: '' };
  }

  /* A fixed set of cases anyone can run (Settings → Display & data → Check content rules).
     No AI, no network, no state: if one of these fails, the guard has regressed. */
  function selfTest() {
    const bad = [];
    const eq = (label, got, want) => { if (got !== want) bad.push(`${label} (got ${got}, expected ${want})`); };
    eq('15 is a minor', isMinor({ name: 'A', age: 15 }), true);
    eq('16 is not a minor', isMinor({ name: 'B', age: 16 }), false);
    eq('"14 years old" reads as a minor', isMinor({ name: 'C', look: 'a 14 years old courier' }), true);
    eq('a relative is not the person', isMinor({ name: 'D', text: 'his daughter is missing' }), false);
    eq('protected adult', isProtected({ name: 'E', age: 40, protected: true }), true);
    eq('a minor cannot be unprotected', isProtected({ name: 'F', age: 12, protected: false }), true);
    eq('open adult', isProtected({ name: 'G', age: 40, protected: false }), false);
    const camp = { character: { name: 'G', age: 40 }, party: [{ name: 'H', age: 15 }], codex: [
      { kind: 'person', name: 'I', age: 33, protected: true }, { kind: 'person', name: 'J', age: 30 }] };
    const names = promptNames(camp).names;
    eq('only the protected party member and NPC are named', names.join(','), 'H,I');
    eq('prose alone does not protect an NPC', isProtected({ kind: 'person', name: 'K', text: 'a teenage apprentice' }), false);
    eq('an NPC aged 17 is protected', isProtected({ kind: 'person', name: 'L', age: 17 }), true);
    const crowd = { character: { name: 'P', age: 40 }, codex: Array.from({ length: 20 }, (_, i) => ({ kind: 'person', name: 'N' + i, age: 30, protected: true })) };
    const capped = promptNames(crowd);
    eq('names are capped, the overflow counted and still ruled on',
      capped.names.length === MAX_PROMPT_NAMES && capped.more === 8 && /8 more protected characters/.test(promptRule(capped.names, capped.more)), true);
    eq('nobody is a minor', guardMinor(null), false);
    eq('the age rule always rides along', /never write anyone under 16/i.test(promptRule(names)), true);
    eq('protected NPC pictures stay safe', imageAllowed({ prompt: 'a portrait', campaign: camp, subject: camp.codex[0] }).allowed, false);
    eq('open adults still get their pictures', imageAllowed({ prompt: 'a portrait', campaign: camp, subject: camp.codex[1] }).allowed, true);
    eq('a prompt describing a child is blocked', imageAllowed({ prompt: 'a 12-year-old with a satchel', campaign: camp }).allowed, false);
    return bad;
  }

  return { isMinor, guardMinor, isProtected, promptNames, subjectsOf, promptRule, imageAllowed, selfTest };
})();

/* The rating tier text plus the age rule. Every prompt that sets content expectations reads this,
   so one step up the rating loosens the story, and the age rule can never be left out. */
const contentRules = (rating, campaign = null) => {
  const { names, more } = AGE.promptNames(campaign);
  return `${RATING_RULES[normRating(rating)]} ${AGE.promptRule(names, more)}`;
};
