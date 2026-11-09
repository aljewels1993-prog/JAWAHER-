# 🐻 WOW CITY – The Great Places Adventure

A 3D English vocabulary adventure for **Grade 6, Unit 3: PLACES**, built with React + Three.js (React Three Fiber).

The girl in the purple headscarf (the player) and her friend Bear arrive in WOW CITY, but every building has lost its name.
Each of the 6 missions brings back 2 names. When all 12 are back, the golden treasure opens.

## Play it

```bash
cd wow-city
npm install
npm run dev        # open the printed address (also works from an iPad/iPhone on the same Wi-Fi)
```

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Static website in `dist/` (upload to any web host) |
| `npm run build:single` | **One file**: `dist-single/index.html`. Copy it anywhere and open it in a browser |
| `npm test` | Unit tests for questions, scoring and city movement |

The microphone (Mission 5) only works on `https://` or `localhost`. If there is no microphone, students answer out loud and tap "I said it".

## The 12 words

Castle · Harbour · Stadium · Tower · Skyscraper · Factory · Hospital · Palace · Swimming pool · Sports centre · Office building · Apartment building

## Missions

1. **Word Hunter**: match each 3D place and picture with its word (all 12 words).
2. **Guess the Place**: Bear reads a clue (the four textbook clues always appear) and students choose the place.
3. **City Explorer**: walk around the 3D city (joystick / arrow keys, JUMP / Space), find 6 places and collect coins.
4. **The Mystery Quiz**: 15 random questions: multiple choice, picture, true/false, complete the sentence, word matching.
5. **Speaking Adventure**: record answers to *What is this place? / Have you visited it? / What can people do there?* and play them back.
6. **The Golden Treasure**: 5 questions, 5 golden keys, then the chest opens with a 3D celebration and the Golden Trophy.

## Scoring

- Correct answer: **+10 points**
- Finishing a mission (first time): **+20 bonus**
- 1–3 stars per mission (accuracy; in City Explorer it depends on coins)
- All 6 missions: **Golden Trophy** and a printable certificate

Progress is saved in the browser (localStorage) for each student name.

## For teachers: editing content

All words, clues, sentences and example answers are in `src/game/words.js`. Change them there and every level updates.

## Code map

```
src/game/      words, question generators, scoring store, audio (Web Audio + speech), city layout
src/scenes/    3D characters, 12 animated buildings, city, stage and treasure scenes
src/ui/        HUD, speech bubble, joystick, start / map / mission complete / trophy screens
src/levels/    the six missions
tests/         unit tests (vitest)
```
