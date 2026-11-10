# OMAN ENGLISH QUEST 3D – The Treasures of Oman 🇴🇲
### رحلة التحدي ثلاثية الأبعاد – كنوز عُمان

**Created by Ms. Jawaher Alkhusaibi.**

A 3D platform adventure for English learners. The student's own Omani heroine
runs and jumps across 10 stages inspired by Oman's governorates, hits grammar
blocks to answer 50 English questions, and finally climbs **Burj Al Sahwa
(برج الصحوة)** to raise the Omani flag and become an *Oman English Champion*.

Built with React, Three.js (React Three Fiber), Zustand and optional Supabase.

## Play / develop

```bash
cd oman-quest
npm install
npm run dev          # http://localhost:5173
npm test             # 99 unit tests (questions, levels, physics, scoring, saving)
npm run build        # static site in dist/  (deploy anywhere)
npm run build:single # one self-contained HTML file in dist-single/
```

**Public link:** pushing to `main` runs `.github/workflows/oman-quest-pages.yml`,
which tests, builds and publishes the game to GitHub Pages. Enable it once in
*Settings → Pages → Source: GitHub Actions*.

## What's in the game

| Feature | Where |
|---|---|
| Hero puppet made from the original character art (face, clothes, colours untouched), animated: run, jump, land, turn, celebrate | `src/scenes/Hero.jsx`, `tools/cutout_character.py` |
| ? blocks (coins, stars, mushrooms), brick platforms, moving & lift platforms, gold coins, stars, red mushroom (super jump + double jump), turquoise mushroom (golden shield) | `src/scenes/Props.jsx`, `src/game/sim.js` |
| Green pipes, secret pipes to a hidden falaj cave, snapping desert-rose plants, original "Grumpy Date" enemies (stompable) | same |
| Omani scenery: forts, palms, Hajar mountains, sea & dhows, dunes, camels, frankincense trees, beehive tombs, falaj, smiling clouds | `src/scenes/Environment.jsx` |
| Burj Al Sahwa: dark-brown pillars, round crenellated turrets, blue arch clock faces with real-time hands and gold 8-point stars, gold Arabic lettering, white arched base walls; rising Omani flag, fireworks, orbiting stars | `src/scenes/Burj.jsx`, `src/scenes/GameScene.jsx` |
| 10 stages / 2 worlds, deterministic level generator (every gap is provably jumpable) | `src/data/stages.js`, `src/game/level.js` |
| 50 unique questions, 5 per stage, 12+ grammar topics, hints + explanations | `src/data/questions.js` |
| 3D adventure map of Oman with golden path, flags, chests, locks | `src/scenes/MapScene.jsx` |
| HUD, touch controls, pause menu, results, champion screen, certificate (download + print), leaderboard, teacher dashboard, English/Arabic (RTL) | `src/ui/` |
| All tuning numbers | `src/data/tuning.js` |

### Scoring rules
* Correct answer = **10 coins**, only once per question (max **500**).
* Wrong answer → gentle *Try again* + a hint, no coins. A second wrong answer reveals
  the correct answer with the explanation (no coins) so the student can move on.
* Each stage's gate opens only after its 5 questions are done; stages unlock in order.
* World coins/stars keep the **best** run per stage, so replays can't farm points.
* Score = coins + 5 × stars.

## Saving, leaderboard and teachers

**Without setup** everything is saved in the browser of that device (ideal for a
class iPad). Several students can play on one device; the teacher dashboard is
protected by a PIN the teacher creates on first use (stored as a SHA-256 hash).

**With Supabase** (shared online progress + leaderboard across devices):
1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. *Authentication → Providers*: enable **Anonymous sign-ins** (students).
3. Add teacher users (email + password), then register them:
   `insert into public.teachers (user_id) select id from auth.users where email = 'teacher@school.om';`
4. Put the project URL and **anon** key in `oman-quest/.env` (see `.env.example`)
   or as repository *Variables* for the Pages build.

Row Level Security lets a student read/write only their own row; teachers (listed
in `teachers`) can view everyone and reset progress through a checked function;
the public leaderboard function exposes only name, score, stages and coins.
The service-role key is never used by the game.

## Tests and evidence
* `npm test` – includes a bot that plays every stage from start to finish headlessly.
* Screenshots from the browser play-test (desktop, iPhone portrait/landscape, iPad):
  `production/qa/evidence/oman-quest/`.

## Asset note
All 3D models and textures are original, built in code. The reference images were
used for style only; nothing from them (or any copyrighted game character) is
included. The hero art is the project's own character.
