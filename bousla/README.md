# BOUSLA – بوصلة 🧭

**Your Time, Your Success. · وقتك، نجاحك.**

A bilingual (Arabic-first, RTL) study planner and motivational companion for school
students, with a separate teacher dashboard. React + TypeScript + Vite, Supabase
(Auth, Postgres, Row Level Security), installable as a PWA.

| Area | What it does |
|---|---|
| Accounts | Sign up (full name, username, email, password), log in/out, password reset by email, sessions kept by Supabase Auth |
| Home | Greeting, date, points, tasks done, study time, level, daily progress ring, today's schedule, upcoming tasks, message of the day, Bousla the mascot with reactions |
| Planner | Sunday–Thursday week view, day view, upcoming list; subjects (7 defaults + custom), type, date, start time, duration, priority, reminder; edit / delete / complete |
| Timer | 25 / 30 / 45 / custom (10–120 min); start / pause / resume / reset; circular progress; break offer; sound + notification; keeps time across pages, sleeping tabs and refreshes |
| Rewards | +10 per finished session, +5 per task, +20 when every task of a day (≥ 2) is done; 5 badges; 7 levels; points history. **Computed on the server.** |
| Notifications | Homework / study / test reminders, daily reminder, session, bonus and badge notifications; read / delete; optional browser alerts |
| Reports | Weekly study time, tasks, sessions, points, top subject, daily chart, subject breakdown, badges; browse past weeks |
| Teacher | Student list with search, engagement, per-student profile, badges, weekly reports and tasks (read-only) |

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

## 2. Set up Supabase (required for real use)

1. Create a project at <https://supabase.com>.
2. **SQL Editor → New query**, paste all of
   `supabase/migrations/20261110000000_bousla_schema.sql`, and run it.
   (With the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Authentication → URL Configuration**
   - *Site URL*: your app's address, e.g. `https://bousla.netlify.app`
   - *Redirect URLs*: add `https://YOUR-SITE/login` and `https://YOUR-SITE/reset-password`
     (and `http://localhost:5173/*` for local development).
4. **Authentication → Providers → Email**: keep it enabled. "Confirm email" can stay
   on. Students then confirm their address before their first login.
5. **Project Settings → API**: copy the *Project URL* and the **anon public** key into
   `.env.local` (or your host's environment variables):

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   ⚠️ Never put the `service_role` key in the app. Anything prefixed `VITE_` is
   visible in the browser.

### Making a teacher account

Everyone who signs up is a **student**. A teacher role can only be given by the
project owner, in the SQL editor:

```sql
-- The teacher first signs up normally in the app, then:
select public.promote_to_teacher('teacher@school.om', 'School name');

-- To undo:
select public.demote_teacher('teacher@school.om');
```

Students cannot call these functions. They cannot write to `teacher_profiles`, and
the role in sign-up data is ignored.

## 3. Security model

- **Row Level Security on every table.** Students read and write only their own rows.
  Teachers can *read* student progress, but cannot change it and cannot read students'
  notifications.
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
- Passwords are handled by Supabase Auth and are never stored by the app. In preview
  mode they are stored as salted PBKDF2 hashes.

## 4. Tests

```bash
npm test          # 31 unit tests: timer maths, rewards, streaks, levels, i18n, device backend
npm run test:db   # runs the real migration on a throwaway PostgreSQL and checks
                  # RLS, roles, rewards and duplicate prevention (60+ checks)
npm run typecheck
npm run build
```

`test:db` needs PostgreSQL 15+ installed locally. It stands in for Supabase's
`auth` schema and roles (`supabase/tests/stub_supabase.sql`).

## 5. Deploy

**Netlify:** create a new site from this repository, then set **Base directory =
`bousla`** (this folder's `netlify.toml` then applies: build `npm run build`, publish
`dist`, single-page-app redirects). Add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` under *Site configuration → Environment variables*.
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
