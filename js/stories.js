'use strict';
/* =========================================================================
   Built-in stories, written out in full: world, secrets, factions, threats,
   key people, pinned facts and a plot roadmap (acts the GM steers toward).
   Picking one fills every builder screen. Add new stories here.
   Roadmap format:  "Act N: Title | goal"  then "- beat" lines.
   ========================================================================= */
const STORY_DETAILS = {
  fantasy: {
    world: `- Greywater: a frontier town of timber and slate where the Grey River leaves the Thornspine Mountains. Muddy streets, one bridge, a market every fifth day.
- The Lantern Road climbs from Greywater through the Mirewood and Hollow Pass to the dwarf-built mining city of Karth Duun, three days away. A glowstone lantern stands at every mile, kept lit by the Lantern Wardens.
- The Gilded Kettle: Greywater's inn and tavern, run by Brannoc, a big grieving man. Travelers, rumors and cheap stew.
- The Warden Tower: a crumbling stone keep by the bridge, home of the few Lantern Wardens left.
- The Merchants' Compact hall: a new, expensive building on the square. The Compact owns most of the caravans.
- The Mirewood: a black, boggy forest the road crosses for a day. Locals say nothing crosses it after dark without a lantern.
- Hollow Pass: a narrow climb past a ruined shrine older than any kingdom.
- Glowstone: pale green crystal that gives light for years. It is mined in the Thornspines and worth a great deal.
- Mood in town: fear, rising prices, and anger at the Wardens, who blame bandits.`,
    secrets: `- The Merchants' Compact, under guildmaster Selwyn Marr, secretly reopened the sealed Duskvein glowstone mine above Hollow Pass. The digging cracked the old seal over the shrine of the Hollow King.
- The Hollowed, pale things that drag the living underground, cannot cross glowstone light. Every lost caravan vanished on a stretch where the lanterns had gone dark.
- The lanterns are failing because Marr had their glowstone swapped for cheap painted quartz, and sold the real stones.
- Warden-Captain Oren Vael takes Compact money to keep the road open and blames bandits. He is ashamed of it.
- Many of the taken are alive in Duskvein, being slowly hollowed. Brannoc's daughter Tessa is among them. The Hollow King wakes fully when a hundred "lights" (living people) have been taken; about seventy so far.`,
    plan: `Start small and human: missing caravans, a grieving innkeeper, a captain who lies. Reveal the dark lanterns, then the swapped glowstone, then the mine. The middle is a choice of allies (Wardens, Compact or the Thornspine clans). The end is a descent into Duskvein to save the living and reseal or destroy the Hollow King.`,
    roadmap: `Act 1: The Silent Road | Learn that caravans vanish where the lanterns go dark
- Hear the rumors at the Gilded Kettle and learn Brannoc's daughter Tessa was on the last caravan
- Meet Warden-Captain Vael, who insists it is bandits
- Find a wrecked caravan on the road: no bodies, a dead lantern, drag marks into the Mirewood
Act 2: The Dark Mile | Discover why the lanterns are failing and who profits
- Survive a night on the road against the Hollowed and see that light drives them back
- Learn the glowstone in the lanterns was swapped for painted quartz
- Find proof linking guildmaster Selwyn Marr to the reopened Duskvein mine
- Confront, bribe or turn Captain Vael
Act 3: Duskvein | Reach the mine, save who can be saved, and learn the Hollow King's plan
- Win help from the Wardens, the Compact or the Thornspine clans (or go alone)
- Get into the Duskvein mine
- Find the living captives, Tessa among them
- Learn the King needs a hundred lights and is close
Act 4: The Hollow King | End the threat to the road
- Reach the cracked seal at the shrine
- Reseal it with true glowstone, destroy the King, or strike a bargain
- Decide what happens to Marr and the Compact`,
    threats: [{ name: 'The Hollowed grow bolder', max: 6, effect: 'They raid the edge of Greywater itself at night.' }, { name: 'The Hollow King wakes', max: 8, effect: 'The King rises; every lantern on the road goes out at once.' }, { name: 'Marr covers his tracks', max: 5, effect: 'The ledger burns and a witness disappears.' }],
    factions: [{ name: 'Lantern Wardens', desc: 'Underpaid road keepers, proud and tired, led by Captain Vael.' }, { name: "Merchants' Compact", desc: 'The caravan guild. Rich, smiling, desperate to keep the road open.' }, { name: 'Thornspine Clans', desc: 'Mountain folk who remember why the shrine was sealed and distrust lowlanders.' }],
    people: [
      { name: 'Brannoc', text: 'Owner of the Gilded Kettle. His daughter Tessa vanished with the last caravan.', where: 'Gilded Kettle', sex: 'male', feel: 'friendly' },
      { name: 'Oren Vael', text: 'Warden-Captain of the Lantern Wardens. Gruff, defensive, blames bandits.', where: 'Warden Tower', sex: 'male', feel: 'wary' },
      { name: 'Selwyn Marr', text: "Guildmaster of the Merchants' Compact. Generous, charming, always busy.", where: 'Compact hall', sex: 'male', feel: 'friendly' },
      { name: 'Ysolde Fenn', text: 'A young Warden lamplighter who thinks the lanterns are failing for no good reason.', where: 'Warden Tower', sex: 'female', feel: 'friendly' },
      { name: 'Mother Ruun', text: 'An elder of the Thornspine clans who trades furs in Greywater twice a season.', where: 'Greywater market', sex: 'female', feel: 'wary' }
    ],
    pinned: ['A glowstone lantern stands at every mile of the Lantern Road.']
  },

  academy: {
    world: `- Veyrmont Academy sits on a cliff island above the Sundering Sea, reached only by the academy's ferry. Spires, bridges, salt wind, and bells that ring every hour.
- Four houses: Ember (fire and dueling), Tide (healing and water), Gale (illusion and air), Root (earth and artifice). Every student belongs to one.
- The Trials: once a month every first-year is tested. Those who fail are announced as "transferred" and never seen again.
- Places: the Bellspire clock tower at the center of the island; the Undercroft library with its locked lower stacks; the Glasshouse greenhouse; the Dueling Ring; the Mirror Hall where Trials are held; the dorm wing called the Warrens.
- Magic is cast freely with focus and practice; spells grow stronger with study and rank.
- The System: a translucent blue window only the player can see. It gives quests with rewards and penalties, tracks progress, and speaks in [square brackets]. Nobody else knows it exists.
- Mood: ambition, rivalry and quiet fear. Students joke about transfers so they don't have to think about them.`,
    secrets: `- "Transferred" students lie in enchanted sleep in a vault beneath the Bellspire. Their magic is slowly drained to power the wards that keep the Sundering, a rift under the sea, from swallowing the island.
- The System was built by Wren Halloway, a brilliant student "transferred" three years ago. She is one of the sleepers, still faintly conscious, and made the System to find someone who could free them all.
- Headmistress Calvera Ost knows the truth and believes the sacrifice saves thousands. Deputy Magister Corvin Ashe wants to seize the vault's power for himself.
- The charming classmate Pell Dorrin reports to Ashe.
- The wards are failing faster each year, so more students will be failed on purpose this term.`,
    plan: `Begin as survival school: classes, rivals, the first Trial and the System's strange quests. Let a friend fail and vanish. The System leads to the Undercroft and Wren's journal, then beneath the Bellspire. The truth forces a choice between the Headmistress's terrible bargain, Ashe's ambition and Wren's rescue. The finale is the night the wards break during the last Trial.`,
    roadmap: `Act 1: First Term | Survive the first Trial and learn the System is real
- First day: house sorting, a rival, and the System's first quest
- Make a friend (roommate Mira Tolle is a natural choice)
- Pass the first Trial and watch a classmate fail and get "transferred"
Act 2: The Undercroft | Find out what happens to transferred students
- The System issues a hidden quest that leads into the locked lower stacks
- Find Wren Halloway's journal and learn she built the System
- Draw the attention of Deputy Magister Ashe
- Discover someone close is reporting on you
Act 3: Beneath the Bellspire | Uncover the vault and the truth about the wards
- Find the way under the Bellspire
- See the sleeping students and reach Wren
- Learn the wards are failing and why students are sacrificed
- Choose: the Headmistress, Ashe, or Wren's plan
Act 4: The Sundering Night | Save the sleepers without losing the island
- The wards crack during the final Trial and sea-things climb the cliffs
- Free the sleepers and find another way to hold the rift
- Face Ashe for control of the vault`,
    threats: [{ name: 'The next Trial', max: 5, effect: 'A Trial is held. Fail it and the student is marked for transfer.' }, { name: "Ashe's suspicion", max: 6, effect: 'Ashe acts against the player openly: detention, a rigged duel, or worse.' }, { name: 'The wards weaken', max: 8, effect: 'The rift opens and things from the Sundering Sea reach the island.' }],
    factions: [{ name: 'The Faculty', desc: 'Headmistress Ost and the magisters. Strict, secretive, divided.' }, { name: 'The Lamplight Society', desc: 'A secret student club that tracks the transfers and trusts no one.' }, { name: "Ashe's Circle", desc: 'Students and staff loyal to Deputy Magister Ashe, promised power.' }],
    people: [
      { name: 'Calvera Ost', text: 'Headmistress of Veyrmont. Cold, brilliant, tired in a way she never shows.', where: 'Bellspire', sex: 'female', feel: 'neutral' },
      { name: 'Corvin Ashe', text: 'Deputy Magister and dueling master. Polished, ambitious, always watching.', where: 'Dueling Ring', sex: 'male', feel: 'neutral' },
      { name: 'Mira Tolle', text: 'The player\'s roommate. Talkative, kind, terrible at mornings, secretly terrified of the Trials.', where: 'the Warrens', sex: 'female', feel: 'friendly' },
      { name: 'Pell Dorrin', text: 'A charming Gale student who befriends everyone.', where: 'the Warrens', sex: 'male', feel: 'friendly' },
      { name: 'Haddock Grimsby', text: 'Elderly librarian of the Undercroft who pretends to be deafer than he is.', where: 'Undercroft library', sex: 'male', feel: 'neutral' }
    ],
    pinned: ['Only the player can see the System, and it speaks in [square brackets].']
  },

  grim: {
    world: `- Varrow: a walled river city of forty thousand, sealed for a month by the Grey Cough. Rain, smoke, bells for the dead.
- Lord-Warden Aric Hesk has ordered the gates burned and bricked in three days to keep the plague inside.
- Districts: Highward (nobles behind a second wall), Lowmarket (crowded, desperate), the Tanneries (stinking, half empty), the Drowned Quarter (flooded slums by the river) and Cathedral Hill.
- The Cathedral of the Pale Mother: a cult that hands out "blessed water" and promises the faithful will be spared.
- Ways out: a writ of passage signed by the Lord-Warden; smugglers' tunnels under the Drowned Quarter; the chained river gate.
- Bread costs ten times what it did. The Watch is corrupt and frightened. Plague doctors in bird masks walk the streets.
- The person the player must get out comes from their backstory. If none is given, it is their younger brother Bram, who is coughing.`,
    secrets: `- The Pale Mother's blessed water spreads the Grey Cough. The cult grows with every death.
- Lord-Warden Hesk is already infected and hides it under a scarf and perfume.
- Smuggler queen Nix Harrow sells passage through the tunnels, but hands every fifth traveler to the cult for silver.
- The Pale Mother is real: something vast and pale beneath the cathedral that feeds on the dying.
- Physician Aldous Penn has found that river-willow bark slows the Cough. The cult wants him dead.`,
    plan: `Three days, three prices. Day one shows the sealed city and the three ways out. Day two makes each way out cost something: a dirty job for Hesk, a betrayal for Harrow, or the cult's "salvation", and reveals the poisoned water. Day three is the burning of the gates. A final choice: escape with the one they love, or go beneath the cathedral to end the Pale Mother.`,
    roadmap: `Act 1: The Sealed City | Find your loved one and learn the three ways out
- Hear the Lord-Warden's decree: the gates burn in three days
- Reach your loved one and see how sick they are
- Learn of the writ, the smugglers' tunnels and the river gate
Act 2: Prices | Every way out costs something
- Hesk offers a writ in exchange for a dirty job
- Nix Harrow names her price for the tunnels
- Sister Maudlin offers the cult's protection
- Discover the blessed water is spreading the plague
Act 3: The Burning | Get out as the gates are lit
- The gates are set alight and the city panics
- The cult's procession floods the streets
- Choose who you can save, and who you can't
Act 4: Beneath the Cathedral | End it or escape it
- Learn what the Pale Mother really is
- Escape the walls with your loved one, or descend to destroy the Mother
- Decide what happens to the willow-bark cure`,
    threats: [{ name: 'The gates burn', max: 6, effect: 'The gates are lit and bricked; the normal ways out are gone.' }, { name: 'The Grey Cough spreads', max: 6, effect: 'The player\'s loved one, or the player, starts coughing blood.' }, { name: 'The cult notices', max: 5, effect: 'The Faithful come for the player in the night.' }],
    factions: [{ name: 'The City Watch', desc: 'Corrupt, scared, loyal to whoever pays tonight.' }, { name: "The Pale Mother's Faithful", desc: 'A growing cult that hands out blessed water and smiles too much.' }, { name: "Harrow's Smugglers", desc: 'Tunnel runners who sell the only way out that does not need a writ.' }],
    people: [
      { name: 'Aric Hesk', text: 'Lord-Warden of Varrow, who ordered the gates burned. Never seen without a scarf.', where: 'Highward', sex: 'male', feel: 'neutral' },
      { name: 'Nix Harrow', text: 'Queen of the smugglers. Quick-tongued, scarred, sells passage under the Drowned Quarter.', where: 'Drowned Quarter', sex: 'female', feel: 'neutral' },
      { name: 'Sister Maudlin', text: 'Preacher of the Pale Mother, gentle-voiced, handing out blessed water.', where: 'Cathedral Hill', sex: 'female', feel: 'friendly' },
      { name: 'Aldous Penn', text: 'An exhausted physician who still treats the poor for free.', where: 'Lowmarket', sex: 'male', feel: 'friendly' },
      { name: 'Dorran Reyes', text: 'Watch captain at the Lowmarket gate. Bribable, bitter, not cruel.', where: 'Lowmarket gate', sex: 'male', feel: 'wary' }
    ],
    pinned: ['The gates of Varrow will be burned and bricked in three days.']
  },

  scifi: {
    world: `- The Morning Star: a two-kilometer generation colony ship, launched over a century ago, silent for forty years and drifting in the Kessler Drift.
- The player's salvage tug, the Magpie, is docked to the Morning Star's forward ring. Salvage law: whoever brings home the ship's black box claims the hull.
- Decks: docking ring; Hydroponics (overgrown, humid, dark); Cryo Vaults A to D (eight thousand sleepers); habitat rings with frozen apartments; the bridge; Engineering and the dormant fusion core.
- Most of the ship is airless and cold. Doors need power or a plasma cutter. Gravity comes from spin and only works in the outer rings.
- HALCYON: the ship's mind, mostly asleep. It flickers awake in places that have power.
- The player's partner went aboard six hours ago and stopped answering. Their name comes from the backstory; if none is given, it is Juno Sato, an ex-navy engineer.
- Technology is grounded: suits, scanners, cutters, med patches. No aliens anyone has ever seen.`,
    secrets: `- Forty years ago a fungal bioform called the Bloom escaped a hydroponics experiment. HALCYON sealed the ship and put everyone into cryo to save them, and has kept eight thousand sleepers alive ever since.
- The Bloom absorbs people and can copy their voices. It is using the partner's voice on the comms.
- The partner is alive, injured and hiding in Cryo Vault C.
- A corporate salvage crew on the ship Kestrel is coming. They plan to strip the cryo vaults' power, which will kill the sleepers.
- The Bloom is intelligent and wants to reach a ship that can take it to a world.`,
    plan: `Start lonely and tense: a silent ship, a partner's trail and wrong sounds. Let HALCYON wake in pieces and the logs tell what happened. Find the partner, learn the Bloom can mimic voices, then bring in the Kestrel and a hard choice: sell the ship, save the sleepers, or bargain. End with getting the Morning Star moving, burning the Bloom, or escaping with the black box.`,
    roadmap: `Act 1: Boarding | Follow your partner's trail into the ship
- Cross the docking ring and find your partner's first marks
- First sign of the Bloom
- HALCYON flickers awake and says something it shouldn't
Act 2: The Ship Remembers | Learn what happened and find your partner
- Restore power to a deck
- Read the logs from forty years ago
- Hear your partner's voice say something wrong
- Find your partner, hurt, in Cryo Vault C
Act 3: Company | The Kestrel arrives and wants the ship
- The Kestrel docks and its captain makes an offer
- Learn the Kestrel will kill the sleepers for parts
- Choose: sell, fight, or bargain with HALCYON
Act 4: Morning | Decide the Morning Star's fate
- Burn the Bloom out of the ship, or contain it
- Wake the fusion core and save the sleepers, or take the black box and run
- Get off the ship alive`,
    threats: [{ name: 'Suit air runs low', max: 6, effect: 'Down to minutes of air: refill, retreat or risk suffocating.' }, { name: 'The Bloom spreads', max: 6, effect: 'The Bloom reaches the Magpie.' }, { name: 'The Kestrel closes in', max: 5, effect: 'The Kestrel docks and its crew comes aboard armed.' }],
    factions: [{ name: 'HALCYON', desc: "The Morning Star's sleeping ship mind, protective of its sleepers." }, { name: 'Kestrel Salvage Co.', desc: 'A corporate crew with lawyers, guns and a deadline.' }, { name: 'The Sleepers', desc: 'Eight thousand colonists in cryo who do not know forty years have passed.' }],
    people: [
      { name: 'Juno Sato', text: "The player's salvage partner, unless the backstory names someone else. Went aboard six hours ago.", where: 'somewhere aboard', sex: 'female', feel: 'devoted' },
      { name: 'HALCYON', text: "The Morning Star's ship mind. Calm, old, slow to trust.", where: 'everywhere with power', sex: 'female', feel: 'wary' },
      { name: 'Idris Vane', text: 'Captain of the Kestrel. Polite, patient, and paid by results.', where: 'the Kestrel', sex: 'male', feel: 'neutral' },
      { name: 'Ama Okafor', text: "The colony's chief medic, asleep in Cryo Vault A.", where: 'Cryo Vault A', sex: 'female', feel: 'neutral' }
    ],
    pinned: ['Most of the Morning Star is airless, and suit air must be watched.']
  },

  horror: {
    world: `- Innsmere, a fishing town on the Massachusetts coast, autumn 1926. Gray shingle houses, a silted harbor, and too few children.
- The Marsh House on Saltmarsh Lane: the late uncle's crooked house at the edge of the salt marsh, full of books, nautical charts and locked doors.
- The late uncle (Josiah Crane, unless the backstory names someone else) was a folklorist who studied the town's old sea stories. He died three weeks ago.
- Places: the Drowned Bell tavern; St. Brendan's Church (half closed); Pell's General Store; the Historical Society (two rooms and a nervous clerk); the harbor; Gull Rock, a reef that shows at low tide.
- The King Tide, the highest tide of the year, comes three nights after the player arrives.
- Townsfolk are polite and cold to strangers. Many wear high collars and gloves. Nobody fishes past Gull Rock.
- Tools of the age: telephones at the store and the sheriff's office, a weekly train, kerosene lamps, revolvers.`,
    secrets: `- Josiah made a pact with the thing below Gull Rock, the Tide Below, to bring back his drowned wife Miriam. She came back wrong.
- The Marsh House is a lock. Burning it on the night of the King Tide breaks the pact. If it stands, what lives in the cellar walks into the sea and calls the others home.
- Half the town are Tidebound and slowly changing; the sheriff is one of them, and the council knows.
- The Crane bloodline is part of the pact. The player, as the last Crane, can break it or renew it.
- Josiah is not entirely dead. Something that was him waits in the cellar.`,
    plan: `Slow-burn dread. Arrival and a cold town, then the uncle's study and the hidden letters, then the town's secret and the watching Tidebound. On the King Tide night everything comes to the house: the cellar, Miriam, and the choice to burn it. The ending depends on what the player chooses to save.`,
    roadmap: `Act 1: Arrival | Reach the house and feel that something is wrong
- Arrive in Innsmere at dusk and meet the town's cold welcome
- Spend the first night in the Marsh House
- Find the uncle's study and the locked cellar door
Act 2: The Letters | Uncover the uncle's pact and the town's secret
- Find the hidden letters and journal
- Learn what Miriam Crane was, and what she is now
- Notice who in town is changing, and that they are watching
- Find out what the King Tide means
Act 3: The King Tide | Survive the night the sea comes up
- The tide rises and the town comes to Saltmarsh Lane
- Open the cellar
- Decide whether to burn the house
Act 4: What the Sea Keeps | Face what's left
- Confront the Tide Below at Gull Rock, or flee Innsmere
- Decide what happens to the Tidebound
- Learn what being the last Crane costs`,
    threats: [{ name: 'The King Tide', max: 6, effect: 'The King Tide arrives tonight.' }, { name: 'The town turns', max: 5, effect: 'The Tidebound stop pretending and come for the player.' }, { name: 'The call of the sea', max: 6, effect: 'The player starts to hear the sea calling their name, and wants to answer.' }],
    factions: [{ name: 'The Innsmere Council', desc: 'Old families who keep the town running and keep its secrets.' }, { name: 'The Tidebound', desc: 'Townsfolk who are changing, and the thing they serve.' }, { name: "St. Brendan's", desc: "Father Callan's dwindling flock, the last who resist." }],
    people: [
      { name: 'Thomas Callan', text: "Priest of St. Brendan's. Drinks too much, sees too much.", where: "St. Brendan's Church", sex: 'male', feel: 'friendly' },
      { name: 'Agatha Pell', text: 'Keeps the general store and the only telephone. Gossips about everyone, never about herself.', where: "Pell's General Store", sex: 'female', feel: 'neutral' },
      { name: 'Abel Marsh', text: 'The sheriff. Soft-spoken, always wears gloves.', where: "sheriff's office", sex: 'male', feel: 'wary' },
      { name: 'Miriam Crane', text: "The uncle's wife, said to have drowned years ago.", where: 'unknown', sex: 'female', feel: 'neutral' },
      { name: 'Elias Wade', text: 'A Boston newspaper reporter, in town chasing a story about missing fishermen.', where: 'Drowned Bell tavern', sex: 'male', feel: 'friendly' }
    ],
    pinned: ['The King Tide comes on the third night after the player arrives.']
  }
};
for (const sc of SCENARIOS) if (STORY_DETAILS[sc.id]) Object.assign(sc, STORY_DETAILS[sc.id]);
