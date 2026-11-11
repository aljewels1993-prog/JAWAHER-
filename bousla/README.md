# BOUSLA – بوصلة 🧭

> © 2026 الأستاذة: جواهر الخصيبي — جميع الحقوق محفوظة. See [COPYRIGHT.md](COPYRIGHT.md).

**Your Time, Your Success. · وقتك، نجاحك.**

A bilingual (Arabic-first, RTL) study planner and motivational companion for school
students, with a separate teacher dashboard. React + TypeScript + Vite, Supabase
(Auth, Postgres, Row Level Security), installable as a PWA.

| Area | What it does |
|---|---|
| Sign-in | **Students:** full name + grade only (no e-mail, no password). **Teacher:** a shared teacher code set by the owner. |
| Home | Greeting, date, points, tasks done, study time, level, daily progress ring, today's schedule, upcoming tasks, message of the day, Bousla the mascot with reactions |
| Planner | Sunday–Thursday week view, day view, upcoming list; subjects (7 defaults + custom), type, date, start time, duration, priority, reminder; edit / delete / complete |
| Timer | 25 / 30 / 45 / custom (10–120 min); start / pause / resume / reset; circular progress; break offer; sound + notification; keeps time across pages, sleeping tabs and refreshes |
| Rewards | +10 per finished session, +5 per task, +20 when every task of a day (≥ 2) is done; 5 badges; 7 levels; points history. **Computed on the server.** |
| Notifications | Homework / study / test reminders, daily reminder, session, bonus and badge notifications; read / delete; optional browser alerts |
| Reports | Weekly study time, tasks, sessions, points, top subject, daily chart, subject breakdown, badges; browse past weeks |
| Teacher | Most active students this week, students who need follow-up, and for every student: usage (study time, active days), commitment (share of planned tasks actually done, overdue tasks) and benefit (points, badges, streak). Filter by grade, search, sort; per-student reports (read-only) |

## 1. Run it locally

```bash
cd bousla
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

**Without `.env.local` the app runs in preview ("device") mode:** accounts and data are
stored only in that browser, and a yellow banner says so. This is for trying the app
on one device. It is not secure for a class, because everything runs in the browser.
For real use, set up Supabase.

## 2. Connect Supabase (project `svqojttxvfqmimhdlais`)

All of these are done once, in the Supabase dashboard of
<https://svqojttxvfqmimhdlais.supabase.co>:

1. **SQL Editor → New query:** paste the whole of
   **`supabase/setup/bousla_full_setup.sql`** and press **Run**. This one file holds
   both migrations, in order (all 11 tables, relationships, indexes, RLS policies
   and functions). It runs as a single transaction, and if BOUSLA is already
   installed it stops without changing anything.
   Then paste **`supabase/setup/verify_setup.sql`** and run it. Every row should say ✅.
   (The separate files are in `supabase/migrations/` for `supabase db push`.
   After changing a migration, run `bash supabase/build-setup.sh` to rebuild the
   combined file; `npm run test:db` fails if you forget.)
2. **Authentication → Sign In / Providers → "Allow anonymous sign-ins": ON.**
   Each device gets a private, anonymous session. The student's name + grade (or the
   teacher code) is then checked by the database.
3. **Authentication → Rate Limits:** raise *anonymous sign-ins per hour* (the default
   is 30 per IP address). A whole class on the school Wi-Fi shares one IP address, so
   use 100 or more.
4. **Set the teacher code** (the install starts with a random code nobody knows) in the SQL editor:

   ```sql
   select public.set_teacher_code('your-new-code');
   ```

   This also signs out every device that used the old code.
5. **Project Settings → API Keys:** copy the **Publishable key** (`sb_publishable_…`).
   - Local: create `bousla/.env.local` (git-ignored) from `.env.example` and paste it
     into `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - Netlify: *Site configuration → Environment variables →* add
     `VITE_SUPABASE_PUBLISHABLE_KEY`, then redeploy. The URL is already in `netlify.toml`.

   The publishable key is meant to be public, and the database rules (RLS) protect the
   data. Never use the **secret** key (`sb_secret_…`) or `service_role` key in the app.

Once the key is set, the yellow "preview mode" banner disappears, and everything is
saved in Supabase: students, points, badges, tasks, sessions and notifications.

### How sign-in works

- **Student:** types their full name and chooses a grade (1–12). The first time,
  this creates the student. Later, the same name + grade (on any device) opens the
  same plan, points and badges. Letter case and extra spaces don't matter.
- **Teacher:** opens the *Teacher* tab and enters the teacher code. The teacher sees
  every student's progress and can correct a student's name or grade, or delete a
  student account (points and badges can't be edited, so they stay fair). The code is
  checked on the server against a bcrypt hash. After 5 wrong codes, that device
  is blocked for 15 minutes, and the whole school is blocked after 30 wrong codes.

> **Trade-off of the simple sign-in:** there is no password, so anyone who types a
> student's exact name and grade opens that student's plan. Ask students to use
> their full name (first, father's and family name). For more protection, a 4-digit
> student PIN can be added later.

## 3. Security model

- **Row Level Security on every table.** A device sees only the student it is linked
  to (`student_devices`, which no client can read or write). Teacher devices can
  *read* student progress, but cannot change it and cannot read students'
  notifications. Nobody can read the teacher code hash.
- **Points can't be sent from the browser.** `points_transactions` and
  `student_profiles.total_points` have no client write access. Rewards are paid only
  inside these SQL functions:
  - `complete_study_session`: checks that the session's real time has passed on
    the **server clock**. A session pays once.
  - `set_task_completed`: pays once per task, with a cap of 20 paid tasks per day.
    The daily bonus is paid once per day, only for today or yesterday, and only when
    the day has 2 or more tasks.
  - A unique key `(student, reason, ref)` makes a double payment impossible, even
    with repeated clicks, refreshes or parallel requests.
- Students can edit their tasks, but the `completed` column can only be changed
  through the RPC (column-level grants).
- In preview mode the teacher code is checked in the browser (set it with
  `VITE_TEACHER_CODE` at build time). That is fine for a demo, but use Supabase for a
  real class.

## 4. Tests

```bash
npm test          # 32 unit tests: timer maths, rewards, streaks, levels, i18n, sign-in, teacher list
npm run test:db   # runs the real migration on a throwaway PostgreSQL and checks
                  # sign-in, teacher code + throttling, RLS, rewards, follow-up numbers (70+ checks)
npm run typecheck
npm run build
```

`test:db` needs PostgreSQL 15+ installed locally. It stands in for Supabase's
`auth` schema and roles (`supabase/tests/stub_supabase.sql`).

## 5. Deploy

**Live site:** <https://bousla-study-planner.netlify.app> (Netlify project
`bousla-study-planner`, separate from the Oman English Quest site).
It was deployed as a direct upload of `dist/`. To update it, build with the two
`VITE_SUPABASE_*` values set and upload `dist/` again (Netlify → Deploys → drag and
drop), or connect the project to this repository as below.
`public/_redirects` and `public/_headers` carry the routing and caching rules for
direct uploads. On Netlify's free plan, a "Powered by Netlify" badge is shown; the
app lifts its bottom bar above it so nothing is covered.

**Netlify:** create a new site from this repository, then set **Base directory =
`bousla`** (this folder's `netlify.toml` then applies: build `npm run build`, publish
`dist`, single-page-app redirects). Add `VITE_SUPABASE_PUBLISHABLE_KEY` under
*Site configuration → Environment variables* (the URL is already in `netlify.toml`).
The repository root `netlify.toml` belongs to the Oman English Quest game. Leave it
as it is.

Any static host works: serve `dist/`, and send unknown paths to `index.html`.

## 6. Install on phones (PWA)

- **Android / Chrome / Edge:** Profile → *Install app*, or the browser's install prompt.
- **iPhone / iPad:** Safari → Share → *Add to Home Screen*.

The app shell is cached, so it opens offline and shows a friendly offline page.
Study data needs a connection.

### Reminder limits (honest)

Reminders appear in the app and, if allowed, as browser/system alerts **while BOUSLA
is open** (also in a background tab on desktop). There is no push server, so a
closed app on a phone will not ring. Missed reminders wait in the Notifications
page. iPhones only allow web alerts for apps added to the Home Screen.
Adding true push (Web Push + a Supabase Edge Function on a schedule) is a possible
next step.

## Project layout

```
bousla/
├── supabase/migrations/   schema, RLS, reward functions
├── supabase/tests/        database security tests (local PostgreSQL)
├── public/                manifest, service worker, icons, offline page
├── src/api/               Api interface; Supabase backend; preview (device) backend
├── src/state/             auth, timer, notifications, feedback (toasts, mascot, badges)
├── src/pages/             Home, Planner, Timer, Achievements, Reports, Notifications, Profile, teacher/
├── src/components/        Mascot, task list/form, charts, UI primitives, app shell
├── src/i18n/              Arabic (default) and English text
├── src/lib/               dates, timer, rewards, motivation, sound, subjects
└── tests/                 unit tests
```

Screenshots from the last end-to-end run are in `production/qa/evidence/bousla/`.
