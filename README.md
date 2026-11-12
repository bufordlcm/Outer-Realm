# Outer Realm: Personal AI Game Master

An AI tabletop RPG that runs on your own PC: the story AI (Ollama), pictures (Forge) and web research (the helper) are all yours, so there are no turn limits and no filters. Saves live in the browser and in your Google Drive folder. Play single player, same-device multiplayer, or Companion mode.

---

## Project layout

| Path | What it is |
|---|---|
| `index.html` | The page shell: loads the styles and scripts below |
| `css/app.css` | Base styles for every screen |
| `css/realm.css` | The Outer Realm look (navy and violet theme, home screens, story panel, choice cards) |
| `js/core.js` | Rules, helpers, built-in content, app state |
| `js/stories.js` | The built-in stories written out in full: world, secrets, factions, threats, key people, plot roadmap. Add new stories here |
| `js/ai.js` | AI connections and the GM's prompts |
| `js/turn.js` | One turn: dice referee, web lookup, writer, agency guard, bookkeeper, rolls |
| `js/story.js` | Session zero, death, storybook, menus, People tracker, multiplayer |
| `js/voice.js` | Voices: narrator plus a unique male or female voice per character (PC voices or device voices) |
| `js/companion.js` | Companion mode |
| `js/research.js` | World research and lookups during play |
| `js/images.js` | Pictures: Pollinations, Forge on your PC, Drive picture storage |
| `js/storydoc.js` | Plot roadmap (acts and beats the GM steers toward) and the two-way Story Doc: one Google Doc per story in its Drive folder |
| `js/screens.js` | Character builder, game screen, settings |
| `js/setup.js` | Setup wizard, keys, backup |
| `js/home.js` | Home: My Games, Discover Campaigns, Characters, Gallery |
| `js/panel.js` | Story panel (Character / Campaign / World), "The world shifts", choice cards |
| `js/events.js` | Click and input handling, startup |
| `helper/` | Files for your PC: the picture, search and voice helper, its start file, and `Install voices.bat` |
| `netlify.toml` | Netlify settings (no build step) |

The scripts are plain files loaded in order; there is nothing to build or install. Netlify publishes every change pushed to GitHub.

---

## Your setup (Mike's PC)

| Part | Setting |
|---|---|
| App address | **https://outer-realm.netlify.app** (Netlify, deploys automatically from GitHub bufordlcm/Outer-Realm; the old site was ironquillstories.netlify.app) |
| Story AI | **Ollama** on the GTX 1070 Ti: **Wayfarer 12B** writes, **dolphin3** runs the rule steps |
| Pictures | **Forge** on the GTX 1060 6GB, reached through the helper on port 7861 |
| Ollama settings (Windows user variables) | `OLLAMA_ORIGINS` = your app address(es), comma separated · `OLLAMA_CONTEXT_LENGTH` = `12288` · `OLLAMA_HOST` = `0.0.0.0:11434` · `CUDA_VISIBLE_DEVICES` = the 1070 Ti |
| Phone access | Tailscale. PC address **https://michael.tailfc0cb4.ts.net** (Ollama) and port **8443** (the helper) |
| Saves | Google Drive folder `1aWDwaZ…` (built into the app). The Google OAuth client must list every app address under Authorized JavaScript origins |
| World builder AI | OpenRouter free key: builds worlds and characters; play stays on your PC |
| Voices | Kokoro natural voices made by the helper on the PC's processor (`/iq/tts`). One-time install: `Install voices.bat` next to `iq-helper.py`; files go in a `voice` folder beside it, apart from Forge's packages |

**When the app address changes**, update these four places: `OLLAMA_ORIGINS`, the Google OAuth client's Authorized JavaScript origins, `helper/allowed-sites.txt` on the PC (one address per line), and `--cors-allow-origins` in Forge's `webui-user.bat`.

---

## 2. Connect free AI keys (Setup)

Open **Setup** (first launch shows it, or tap Setup on the home screen). Get one or more free keys:

| Provider | Get a key | Key looks like | Notes |
|---|---|---|---|
| **OpenRouter** | openrouter.ai/settings/keys | `sk-or-v1-…` | Best all-round: dozens of free open models (DeepSeek, Llama, Qwen). Daily free limit. |
| **Google Gemini** | aistudio.google.com/apikey | `AQ.…` or `AIza…` | Sign in with Google. Strong storyteller, generous free limits. |
| **Ollama** | ollama.com/download | (no key) | Free and local on your own computer, see section 5. |

**Not supported:** Groq, OpenAI, Anthropic and Cerebras keys. Those services block apps that run in a web browser, so Outer Realm can't reach them. The app skips them if you paste one.

**Adding keys.** Three ways, all on the Setup screen or under Settings → Story AI:
- **Paste.** Paste one key or several at once, in any format: bare keys, `NAME=key` lines, a `.env` file. The app recognizes each provider, finds a good free model, tests it, and marks it **Ready**.
- **Import a keys file.** Tap **Blank key file** to download `ironquill-keys.txt`, fill it in, then tap **Import keys file**. The file can also hold your Google Client ID and Drive folder link.
- **From Drive (any device).** Put the filled-in file in your Outer Realm Drive folder, keeping a name that starts with `ironquill-keys`, or tap **Save keys to Drive**. Every device then loads your keys automatically when it connects to Google Drive.

**Choosing what to use.** Each key shows as a card. Tap **Use** to switch to it, tap the model box to pick a different model, or tap **Auto-pick** to let the app choose. With **Auto-switch** on (the default), if the one in use is busy or out of free requests, the app moves to your next working key and tells you. That's why having both free keys beats having one.

**Model tip:** bigger models play far better (DeepSeek V3, Llama 3.3 70B, Qwen large, Gemini Flash). If the GM starts ignoring rules, switch models; your campaign carries over.

**Keep keys private.** Anyone with a key can use your free quota. The keys file sits in your private Drive; don't share that folder.

---

## 3. Images (Settings → Images)

The default is **Pollinations** (open models like Flux), with **no key needed**. It allows roughly one image every 15 seconds, and images carry a small Pollinations mark. (Since November 2026, Pollinations keys cost money, using "Pollen" credits, and the old free `pk_` keys no longer generate anything. The free, no-key images are all you need.)

The GM only requests an image when you reach a new place or meet someone important. You can also tap **Illustrate** on any turn, or **New image** to re-roll one.

**Custom image URL:** point at any service that returns an image from a URL, using the placeholders `{prompt}`, `{seed}`, `{width}`, `{height}`.

---

## 4. Google Drive sync (play on any device)

Saves go into **your own Drive folder** (Settings → Google Drive → *Drive folder link*; it comes prefilled with your folder). Inside it:

```
Your folder/
├── _ironquill-index.json        ← settings + deleted adventures
├── Veyrmont Academy/
│   ├── campaign.json            ← the full save the app reads back
│   ├── Character Sheet.md       ← readable sheet
│   └── Story Log.md             ← the whole adventure as text
└── The Lantern Road/
    └── …
```

Each new adventure gets its own subfolder, named after the adventure (renaming the adventure renames the folder). Deleting an adventure moves its folder to the Drive trash on the next sync.

Because the app writes into a folder *you* created, it asks for full Google Drive access. It only ever touches your chosen folder, but Google will show an **"unverified app"** screen the first time. That's expected for a personal app: choose **Advanced → Go to Outer Realm (unsafe) → Continue**.

One-time setup (about 10 minutes, free):

1. Go to **console.cloud.google.com** → create a project (e.g. "Outer Realm").
2. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type **External**.
   - App name "Outer Realm", with your email as both support and developer email.
   - Under **Audience / Test users**, add your own Gmail address.
   - Leaving it in **Testing** mode is fine for personal use.
4. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add your site's address exactly as the app shows it in Settings → Google Drive (e.g. `https://ironquill-mike.netlify.app`). No trailing slash, no path. Optionally also add `http://localhost:8080` for local testing.
   - Create, then copy the **Client ID** (`…apps.googleusercontent.com`).
5. In the app: **Settings → Google Drive** → check the folder link → paste the Client ID → **Connect & sync** → choose the Google account that owns the folder → Advanced → Continue → Allow.
6. Repeat step 5 on each device, using the same site URL.

How syncing works:
- **Auto-sync** runs after every turn while you're connected.
- Google sessions last about an hour. When yours expires, tap **Sync** to reconnect, which takes one tap.
- The newest version of each adventure wins. Deletions sync too.
- AI keys travel only in the keys file (`ironquill-…keys`) in your folder, never in the adventure saves. With that file in place, setting up a new device is: open the link → **Connect Google Drive** → done.
- **Once you have a Client ID**, it can be built into the app (it isn't a secret). Then no device ever has to type it.
- Since the app is in "Testing" mode, Google may ask you to re-approve about once a week. That's normal.

**No Drive?** Use **Backup** (downloads a `.json` file) and **Restore** on the other device.

---

## 5. Run the AI on your own computer (Ollama)

Free, with no daily limit and no outside company filtering content. The PC must be on while you play.

1. Install Ollama from ollama.com/download. Choose **"No thanks, I'll use Ollama locally"**, since no account is needed.
2. Quit Ollama (right-click the tray llama icon → **Quit**). Add these Windows **user** environment variables (Start → "Edit environment variables for your account" → New):
   - `OLLAMA_ORIGINS` = `*`, which lets the web app talk to it.
   - `OLLAMA_CONTEXT_LENGTH` = `12288`. Without it, cards under 24 GB get only 4k, and the GM forgets its rules.
3. Start Ollama again. In Command Prompt run `ollama pull dolphin3`, then `ollama run dolphin3 "hi"`, then `ollama ps`. You want **100% GPU** and **12288**.
4. In the app it's found automatically, or tap Setup → **Find Ollama**. If Chrome asks about local network access, choose **Allow**.

**Choosing a model by graphics card memory:** 8 GB → `dolphin3` (8B, fits fully). 12 GB → `mistral-nemo`. 16 GB+ → larger 14–24B models. With lots of system RAM, a model slightly too big for the card still runs, split with the CPU, just slower.

**If Ollama errors with "PTX was compiled with an unsupported toolchain":** update the NVIDIA driver (GTX 10-series: 582.78 or newer, from nvidia.com/drivers), then restart.

**Playing from your phone:** the phone can't reach `localhost` on the PC. Use **Tailscale** (free): install it on the PC and the phone and sign in to both with the same account. On the PC, run `tailscale serve --bg 11434` in Command Prompt. That gives a fixed private address like `https://your-pc.tailXXXX.ts.net` that only your own devices can open. In the app on your phone: Setup → More → **Ollama** → paste that address followed by `/v1` → Add. We'll walk through this together. If the phone gets a 403 error, Ollama is rejecting the Tailscale address, and setting `OLLAMA_HOST` = `0.0.0.0:11434` fixes it.

---

## 5a. A better story model: Wayfarer 12B

Wayfarer was made by the AI Dungeon team (Latitude) specifically for second-person, present-tense text adventures where the player can fail. It's uncensored and free. At 12B it's larger than dolphin3 (8B), so it writes better scenes. On your 8 GB card part of it runs from RAM, so expect each scene to take longer. The new short-scene setting keeps that manageable.

**Install (on the PC, in Command Prompt):**
```
ollama pull hf.co/LatitudeGames/Wayfarer-12B-GGUF:IQ4_XS
```
That's about 6.7 GB. If you'd rather have slightly better quality and slower turns, use `Q4_K_M` (7.5 GB) instead of `IQ4_XS`.

**Use it:**
1. Settings → Story AI → your Ollama card → tap **Auto-pick**. It now prefers Wayfarer when it's installed. You can also type `hf.co/LatitudeGames/Wayfarer-12B-GGUF:IQ4_XS` in the model box.
2. Set **Creativity** to `0.8` (Latitude's recommended setting).
3. The app **pairs the models automatically**. When Wayfarer is the story model and dolphin3 is installed, it puts `dolphin3:latest` in **Helper model** and shows "Paired: Wayfarer writes the story, dolphin3 handles dice and records." Wayfarer writes the scenes; dolphin3 runs the referee, agency guard and bookkeeper, which need exact, structured answers. The two models swap on your 8 GB card, which adds a few seconds per turn. If you'd rather try Wayfarer alone, clear the Helper model field.
4. Keep dolphin3 installed. If you ever remove it, the app will remind you to run `ollama pull dolphin3`.
5. Do this on each device, because model choice is saved per device like your keys.

**Optional speed-up:** add the Windows environment variable `OLLAMA_KV_CACHE_TYPE` = `q8_0`, together with `OLLAMA_FLASH_ATTENTION` = `1`, then restart Ollama. This halves the memory the story history uses, so more of the model fits on the graphics card. If Ollama errors afterwards, delete both variables and restart it.

**How a turn works now**
1. **Dice referee** (Balanced and Best): decides whether your action needs a roll.
2. **The GM writes one short beat**: story text only, the immediate result of what you did and how the world reacts, then it stops.
3. **Agency guard**: cuts any line where the GM speaks, acts, thinks or feels for you.
4. **Bookkeeper**: reads the scene and updates HP, items, gold, quests, location, time, People, Codex, handouts, pictures, companions and the suggested choices.

Settings → Story AI → **Turn quality**:
- **Fast:** steps 2–4 only, with no dice referee.
- **Balanced** (recommended): all four steps.
- **Best:** adds private planning and a continuity rewrite.
- **Custom:** turn each step on or off yourself.

**Scene length:** Short (recommended), Medium or Long.

## 5b. Realistic pictures on your PC (Stable Diffusion / Forge)

Free, no limits, no content filter. It runs on the same PC as Ollama, and they take turns on the graphics card.

**1. Install Forge**
1. Install **7-Zip** from 7-zip.org.
2. Go to **github.com/lllyasviel/stable-diffusion-webui-forge**. In its README, under *Installing Forge*, download the one-click package for **CUDA 12.1 + PyTorch 2.3.1** (`webui_forge_cu121_torch231.7z`). Older cards like the GTX 1070 Ti need this one; the newer CUDA 12.4 / 12.8 packages may not support them.
3. Right-click the file → 7-Zip → Extract to **`E:\Forge`**. Keep it out of `E:\IronQuill`, because that folder gets uploaded to Netlify.
4. Double-click **`update.bat`**, then **`run.bat`**. The first start downloads a few GB and opens a page at `http://127.0.0.1:7860`. When that page loads, close the black window.

**2. Get a realistic model**
1. Open **huggingface.co/SG161222/RealVisXL_V5.0_Lightning** → *Files and versions* and download the `.safetensors` file (about 6–7 GB).
2. Put it in **`E:\Forge\webui\models\Stable-diffusion\`**.
3. Want something faster with smaller pictures? Any SD 1.5 realism model (e.g. Realistic Vision) goes in the same folder. Pick the **SD 1.5** preset for it in the app.

**3. Let the app talk to Forge**
1. Open **`E:\Forge\webui\webui-user.bat`** in Notepad.
2. Change the `set COMMANDLINE_ARGS=` line to:
   ```
   set COMMANDLINE_ARGS=--api --cors-allow-origins=https://ironquillstories.netlify.app --always-offload-from-vram
   ```
   (`--always-offload-from-vram` hands the graphics card back to Ollama after each picture.)
3. Save, and start **`run.bat`** again.
4. To start it automatically: press **Win+R**, type `shell:startup`, and put a shortcut to `E:\Forge\run.bat` in that folder.

**3b. The picture bridge (needed)**
The helper does two jobs: pictures and research. Forge doesn't always send the permission header the Outer Realm website needs, so its replies get blocked ("No 'Access-Control-Allow-Origin' header"). The bridge adds that header.
1. Put `iq-helper.py` and `Start Outer Realm.bat` (from the `helper` folder, placed in `E:\Forge\webui_forge_cu121_torch231\webui` next to `iq-helper.py`) in **`E:\Forge`**, next to the `webui_forge_cu121_torch231` folder.
2. Start everything with **`Start Outer Realm.bat` (from the `helper` folder, placed in `E:\Forge\webui_forge_cu121_torch231\webui` next to `iq-helper.py`)**. It opens Forge (minimized) and a small "picture helper" window. Keep both open.
3. In Outer Realm, the Forge address on the PC is `http://localhost:7861`. **Find it** tries it automatically.
4. For auto-start, put a shortcut to `Start Outer Realm.bat` (from the `helper` folder, placed in `E:\Forge\webui_forge_cu121_torch231\webui` next to `iq-helper.py`) in `shell:startup`, replacing the old shortcut to `run`.

**4. Phone access (Tailscale)**
Open **Command Prompt as administrator** and run:
```
tailscale serve --bg --https=8443 http://localhost:7861
```
Your phone then reaches Forge at `https://michael.tailfc0cb4.ts.net:8443`.

**5. Turn it on in Outer Realm**
1. Go to Settings → Images → **Stable Diffusion on my PC**.
2. Tap **Find it & load models**. It tries `localhost` on the PC and the Tailscale address on the phone. Do this once on each device.
3. Pick the model and the preset (**SDXL Lightning** for RealVisXL Lightning).
4. Tap **Test image**. The first one takes longer while the model loads.
5. Tap **Make this adventure photo-realistic** to switch the art style to photographic, then **New image** on any scene to repaint it.

**Notes**
- **Saving:** every picture Forge paints is saved to your Google Drive folder, in a subfolder called **Ironquill pictures**. Your phone and PC share them, and the phone can show pictures already painted even when it can't reach Forge. Pictures painted while Drive isn't connected upload at the next sync. Turn this off in Settings → Images → *Save pictures to Google Drive*.
- **Speed:** with *Share the graphics card* on, the app unloads the story AI before each picture, so the next turn takes a few extra seconds while Ollama reloads.
- **Forge's own page:** `http://127.0.0.1:7860` still works for making pictures by hand.

## 5c. Internet research (world building + lookups during play)

The AI on your PC can't browse the web, so the app does the searching and reading, then hands the AI real sources.

**How it searches:**
1. **The Outer Realm helper on your PC** (`iq-helper.py`, the same window that handles pictures) searches the whole web and reads full pages. It uses **SearXNG** if it's installed (free, private, no limits), otherwise DuckDuckGo, with Wikipedia as backup.
2. **Without the helper** (for example on your phone away from home), research uses Wikipedia directly.

**In the builder:** type what to research in the **Research** box (e.g. "Savannah, Georgia in 1868", "Hogwarts in the 1990s") and tap **Research**. It reads the best sources, then fills in the premise, world notes, secrets, pinned facts and important people, with portraits. It also saves the topic so lookups during play stay on track.

**During play:**
- When you reach a new place or meet a new named character in a researched story, the app looks them up in the background and saves the facts. The GM sees those facts whenever that place or person is in the scene. Each topic is looked up once.
- **More → Look something up** searches anything by hand.
- **People** and **Journal → Codex** have **Look up** buttons.
- You can change the research topic, or turn auto-lookups off for one story, in **More → Campaign tools → Campaign**. The global switches are in **Settings → Story AI → Internet research**, along with **Check research**.

### Installing SearXNG (best results, no limits)
1. **Docker Desktop:** download it from docker.com/products/docker-desktop and install it. Keep the WSL 2 option ticked, and restart if asked. Open Docker Desktop, skip the sign-in, then go to **Settings → General** and tick **Start Docker Desktop when you sign in to your computer**.
2. **Settings file:** make a folder **`E:\SearXNG`** and put the `settings.yml` file there.
3. **Start SearXNG:** open **Command Prompt** and run (one line):
   ```
   docker run -d --name searxng --restart unless-stopped -p 127.0.0.1:8888:8080 -v "E:\SearXNG:/etc/searxng" searxng/searxng:latest
   ```
   The first time, it downloads for a minute or two.
4. **Check it:** open `http://localhost:8888` in your browser. You should see a search page.
5. **Restart the helper:** close the "picture helper" window and start **Start Outer Realm** again. Its window should now say `Web search: SearXNG at http://127.0.0.1:8888`.
6. **In Outer Realm:** go to **Settings → Story AI → Check research**. It should say "web search via SearXNG (no limits)".

SearXNG restarts on its own whenever Docker Desktop starts.

## 6. Playing

**Your GM (Release 1)**
- **Personality:** pick a GM personality and name when you create an adventure (warm storyteller, witty veteran, strict referee, grim chronicler, theatrical bard, or write your own). Change it later in Journal → Campaign.
- **Ask GM:** the button left of the text box opens out-of-character table talk: rulings, recaps, what you know, hints. Lasting requests like "fewer fights" are saved and followed.
- **Smarter turns:** each turn the GM plans privately, then writes, then a continuity check fixes contradictions and any lines where it acted for your character. You'll see "✓ Continuity corrected" when it fixes something. Both steps can be turned off in Settings → Story AI to get faster turns.
- **Fixing the story:**
  - **Edit** under any GM message lets you change its text.
  - **Fix story** lets you tell the GM what's wrong; it shows its changes before saving.
  - Journal → **Facts** holds things that must always be true.
- **Saves:** Journal → **Saves** lets you make save points and load them. One is made automatically at each chapter end.
- **Previously on…:** a recap appears when you come back after a couple of hours. You can also ask for one anytime in Journal → Story so far.
- **Physical dice:** Settings → Display & data → **Use my own physical dice**. Every roll then asks for the number you rolled.
- **More AI memory:** on the PC, change `OLLAMA_CONTEXT_LENGTH` to `16384` and restart Ollama. Then in Setup, set the Ollama card's **AI memory** to 16384 on each device.

**A living world (Release 2)**
- **Session zero:** at the end of the New adventure page, choose **Session zero first**. You chat with your GM about what you want, what to keep out, and your character's goals and people. Press **I'm ready** and it builds the world, factions, hidden threats, a secret campaign plan and your opening scene from the conversation. **Skip straight to the adventure** still works, and the world builder now makes a plan, threats and factions too.
- **Time and weather** show next to your location at the top ("Day 4 · morning · clear and cold").
- **Factions:** groups remember how you treat them. See your standing in Journal → World.
- **The world turn:** when days pass, villains and factions act off-screen, hidden threats move closer, and you hear rumors about it.
- **Pacing:** the GM tracks how intense scenes are and alternates action with quieter moments.
- **Flaw rewards:** playing into a negative trait in a way that costs you earns 1–3 bonus EP.
- **Spoilers:** the hidden plan, threats and GM notes sit behind the spoiler toggle in Journal → World.

**Finding things (new layout)**
- Top of the game screen: **Party**, **Journal** and **More**.
- **Journal** holds your keepsakes: Quests, Codex, Map, Factions & rumors, Handouts, Diary, Gallery.
- **More** holds Campaign tools (World & secrets, Facts, Memory, Story so far, Saves, Campaign settings), Fix the story, Previously on…, Storybook, Google Drive sync, Settings and the guide. Where earlier notes say "Journal → World/Facts/Saves/Campaign", it's now **More → Campaign tools**.
- Under the suggested actions are quick actions: **Make camp**, **Look around**, **Talk to the party**. You can turn them off in Settings → Display & data.
- The home screen has a big **Continue** button for your latest adventure.

**Your party (Release 3)**
- **Getting companions:**
  - The GM brings allies into the story.
  - **Party → Create a companion** describes one and lets the GM build it. Choose "card hidden" to keep their secrets a surprise, or "show me everything".
  - **Party → Write one myself** makes a companion whose full card you always see.
  - Companions can also come out of session zero if you ask for them.
- **Hidden cards:** a GM-made companion's card stays hidden until you tap **Reveal full card** and confirm.
- **Giving orders:** tell them what to do in the story ("Mara, watch the door"). Whether they obey depends on their **trust** in you (−5 to +5), and trust changes with how you treat them.
- **Their own dice and turns:** when a companion tries something risky, the app rolls their d20 at random (their roll shows under the scene). At big moments a companion acts and speaks for themselves in a blue bubble, and then the GM continues. Undo turn takes back the whole exchange.
- **Growing and leaving:** companions heal when you rest, level up with you (more HP and a stat), and can be hurt, leave, or die when the story calls for it.
- **Camp scenes:** **Make camp** or resting gives banter and companions opening up.
- **If your character dies**, choose one:
  - **Continue as** one of your companions.
  - **Bring in a new character**, which opens the builder with your world already filled in.
  - **End the story** with an epilogue.
  - **Load a save.**
- Each companion card has **Portrait** (paints them) and **Talk to…**, plus their own **voice** if your device has several.

**People you've met**
- The **People** button at the top lists every named NPC you've met or heard about. Each one shows where you met them and what you know about them, with **Portrait** and **Talk** buttons.
- The bookkeeper adds new people after each scene and updates the ones you know. You'll see 👤 *name* under the scene.
- For an adventure started before this update, tap **Find people from the story so far** once to fill the list in.

**Game modes**
Tapping **New adventure** asks how you want to play:
- **Single player D&D:** the full game, with dice, stats, a party and a living world.
- **Multiplayer D&D · same device:** friends share one phone or PC.
  - Build Player 1, start, then tap **+ Add player** above the text box for each friend.
  - Tap a name in the **Acting:** row to choose who's acting, then type. Messages are labeled with who acted.
  - The GM knows every player character and won't act for any of them.
  - Damage can hit anyone, and level-ups reach everyone when it's their turn.
  - You can't switch players while someone still has a roll to make.
- **Multiplayer D&D · different devices:** coming soon.
- **Companion mode:** no dice, no stats. You build a world just like a D&D one, write who *you* are, and list your **cast** (one character per line). The AI builds each cast member with a personality, a voice, goals and a past.
  - A narrator describes the world and events, while the cast talk and act on their own, each in their own chat bubble. Group conversations work naturally.
  - **Photos:** ask for a selfie or picture ("Mara, send me a photo?"), or tap **📷 Ask for a photo**. It's painted with your SFW/NSFW image setup, and the same under-18 safeguard applies.
  - **Memory:** things you share about yourself and important moments are saved to long-term memory (More → Story tools → Memory), and the story and cast know them.
  - **Voice:** use **Read** on any bubble, or turn on automatic reading. Each cast member can have their own voice (Cast → their card → Voice).
  - **Cast** (top bar) shows everyone. You can add more characters, paint portraits, and see how close each one feels to you.
  - Everyone in a companion cast is an adult (18+).

**Portraits**
- **Character builder:** tap **Paint portrait** under Appearance to see your character before you start. Change the appearance and tap **Paint again** until it's right.
- **Character sheet:** your portrait sits at the top, with a **New portrait** button.
- **Party:** companions you create or write yourself get a portrait automatically.
- **People:** tap **Add a person** to make your own NPC (name, who they are, appearance). You can have the GM bring them into the story, and their portrait is painted for you.
- **GM-made characters:** every new companion or named character the GM introduces gets painted once, automatically. Turn this off in Settings → Images.
- Scene pictures don't appear every turn. They're only added when you arrive somewhere new or an important character first appears, and you can tap **Illustrate** on any scene to get one.

**Keepsakes (Release 4)**
- **Gallery:** every scene picture of a place or character is saved here. **↻** paints a new version and the bin deletes one. Paint portraits for your character and companions.
- **Codex:** people, places, creatures, lore and items you learn about get added automatically. You can search and filter it.
- **Map:** the places you visit, with lines between places you travelled between. Gold marks where you are.
- **Handouts:** letters, posters and pages you find appear as parchment in the story and are kept here.
- **Diary:** tap to have your character write an entry about recent events, in their own voice.
- **Voice (free, built into your device):**
  - Every scene has a **Read** button.
  - Settings → Display & data → Voice can read every scene automatically, and lets you pick the narrator voice and speed.
  - The **microphone** next to the text box lets you speak your action.
- **Storybook:** More → Storybook opens your whole adventure as an illustrated book. Tap **Print / Save as PDF** to keep it.

**Building a world**
- On **New adventure**, describe the world you want in a line ("Harry Potter world, first year…", "Game of Thrones, a minor house in the North…") and tap **Build my world with AI**. It fills in the title, premise, tone, art style and magic rules, plus **World notes** (places, factions, characters) and hidden **GM secrets** behind a spoiler toggle. Both stay editable later in Journal → **World**.

**Agency guard:** after each scene, a quick step checks every sentence. The app cuts any line where the GM gave your character words, actions, thoughts or feelings you didn't write, and you'll see "✂ Removed 2 lines…" under the scene. If it cut too much, tap **Put cut lines back**. Your latest action also goes to the GM with a reminder to do only what you wrote. You can turn the guard off in Settings → Story AI.

**You control your character; the GM controls everything else.** The GM never moves your character, speaks for them, or tells you what they think or feel. It describes what you perceive and what the world and NPCs do, then waits for you. Prefer to come up with every action yourself? Settings → Display → turn off **Show suggested actions**.

**Building a character**
- Pick a story, describe your character in a sentence or two, and tap **Draft my build with AI**. It fills in stats, positive and negative traits (tiers, triggers, story effects), gear and backstory. Change anything.
- The bar at the top tracks your budgets: **35 stat points** and **10 TP**, plus whatever your negative traits give back. You can't start over budget. Leftover TP is banked, or converted to EP (2 TP → 1 EP).

**Checks**
- **Dice referee:** before the GM writes, a quick step decides whether your action needs a roll (sneaking, locks, persuading, climbing, attacks, and so on). If it does, the roll card appears even if the GM forgot to call one. You can turn it off in Settings → Story AI, and set **How often to roll** to *More dice*.
- **Force a roll:** add **(roll)** to any action, like "I try to talk the guard down (roll)".
- When the outcome is uncertain, the GM stops and a roll card appears: the stat, the DC and its reason, and every modifier, including negative traits the GM says apply.
- **Invoke a trait:** pick your positive traits and say exactly how they help. The GM rules full fit (whole bonus), partial (half) or no fit, and may lower the DC for a good argument.
- **Roll.** The app does the math. Beat the DC by 10+ for an Overwhelming Success; miss by 10+ for a Disaster.

**Combat**
- **Attacks** roll against the enemy's Defense; on a hit the app rolls your weapon damage.
- **Defense:** enemies telegraph their moves, and you pick **Dodge** (DEX), **Block** (STR) or **Counter** (DC +3, hits back). Fail and the app applies their damage.
- **Momentum:** each success builds it (max 3). Spend 1 for +3 before a roll, or a reroll after a miss.
- **Injuries:** big hits leave injuries (−2 until rest). Permanent wounds become negative traits and pay you TP.

**The HUD** across the top shows HP, level, EP, TP, Momentum, Strain, injuries and gold. Tap it for your full sheet (stats, traits, gear, signatures, backstory).

**Level-ups** come at story milestones. A **Level up!** button appears; roll HP, get +5 EP and +2 TP, convert TP to EP, raise stats, upgrade or add traits, and pay off weaknesses if the story allows.

**Other controls**
- **OOC:** ask the GM a question out of character.
- **Retry** rewrites the last GM reply. **Undo turn** takes back your last action, including a roll's damage.
- **Journal:** quests, the GM's long-term memory, the "story so far" summary, and campaign settings (premise, tone, magic cost, art style, standing requests). All editable.
- **Long campaigns:** older turns are condensed into the summary automatically, so small-context free models stay consistent.

**Saves from the first version** are upgraded automatically: your old inventory becomes gear, and the character starts with no traits. They'll gain traits at level-ups and through the story.

---

## Privacy

Your key is stored only in your browser (and in Drive if you opt in). It is sent only to the AI provider you picked. Image prompts go to the image service. Nothing goes anywhere else.

---

## Plot roadmaps and the Story Doc

**Roadmap.** Every story can have a plot roadmap: `Act 1: Title | goal` on one line, then that act's beats on lines starting with `-`. The GM steers gently toward the current act's beats (the player's choices always come first), the bookkeeper ticks beats off as they happen, and a "Chapter N begins" note appears when an act closes. Edit it in the builder (under the spoilers), in Story tools, or in the Story Doc. The story panel shows "Chapter N of M".

**Story Doc.** On each Drive sync the app writes a Google Doc called *Story Doc* inside the story's Drive folder: premise, world, roadmap, where the story is now, secrets, factions, people, pinned facts, things to remember, story so far, player character, and notes for the GM. Edit any section in Google Docs (keep the `§` headings) and the next sync pulls your changes into the story, so the GM uses them from the next turn. "Where the story is now" and "Player character" are written by the app only.
