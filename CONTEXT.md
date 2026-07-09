# CONTEXT.md — Session resume file

> Purpose: user switches Claude accounts when usage runs out. In a fresh session:
> read this file + PLAN.md, then continue exactly from "What's pending" below.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md.** Repo: github.com/ashish979/sprint-manager.

## Git state (as of 2026-07-09, verified against origin)

- `main` fully merged through PR #6 (deploy-prod). No open PRs.
- **App is live on AWS, deployed via CI/CD** (`.github/workflows/deploy.yml` — push to
  `main` → `sst deploy --stage prod` via AWS OIDC role). Region **ap-northeast-1
  (Tokyo)**. Confirmed working end-to-end by the user: dashboard, standups, rotations,
  and the inbound Slack flows (buttons, modal, `/rota`, Sign in with Slack).
- Branch `standups-enhancements` (off latest `main`) — Round 1 of Geekbot
  basic-feature parity for standups, **implemented and live-verified locally,
  not yet committed**. See "Standups round 1" below.

## Standups round 1: Geekbot basic-feature parity (this session)

Competitor research (Geekbot, Standuply, DailyBot, Range) produced a 9-item candidate
list; user picked 6 for this round, all now built on `standups-enhancements`:

1. **Edit form** — `src/app/standups/[id]/edit/page.tsx` + `updateStandupAction`.
   Shares a new `src/app/standups/_components/standup-form.tsx` with the create page.
   Removing a participant auto-resolves their pending report(s) as `"skipped"`
   (`resolveRemovedParticipants` in `engine.ts`, via new `listOpenDays()` in
   `reports.ts`) so it can't block `maybeCloseDay` forever.
2. **Templates** — `STANDUP_TEMPLATES` in `types.ts` (Daily/Retro/Well-being), zero-JS
   `?template=` query-param picker on both new/edit pages.
3. **Anonymous responses** — `StandupConfig.anonymous`. Hides identity in the Slack
   thread reply (`replyMessage` in `blocks.ts`) AND on the admin dashboard itself (a
   separate unattributed "Responses (anonymous)" section on the detail page) —
   participation tracking (who has/hasn't responded) stays fully identified.
4. **Selective reminders** — admin "Remind" button per pending participant on the
   detail page (`sendManualReminder` in `engine.ts`, `sendReminderAction`). Bypasses
   `maxReminders` but still increments `remindersSent`.
5. **Preferred time** — global per-user (`UserProfile.preferredTime`, not per-standup)
   to avoid a write-race with admin edits. New self-service `/preferences` page
   (first non-admin write path in the app, `requireSession()` not `requireAdmin()`).
6. **Out-of-office** — `UserProfile.outOfOffice` (single active range), new `"ooo"`
   `ReportStatus`. `sweepParticipant` short-circuits before `isPromptDue`, but only
   creates the terminal `"ooo"` report once a `DAY` already exists (guards against an
   OOO participant being swept first and prematurely posting the anchor).

Deferred to later rounds (not built): report history view, result-visibility control,
CSV export, and all AI/insight features (blocker detection, summarization, sentiment,
NL Q&A over reports) — these were explicitly out of scope for this round.

**Verification done**: `npm run lint && npm run typecheck && npm test && npm run build`
all pass (45 unit tests, up from 41 — new `isOutOfOffice` cases). Extended
`scripts/store-smoke.ts` with `listOpenDays`/`setPreferredTime`/`setOutOfOffice`
coverage, run clean against DynamoDB Local. **Live-verified against real Slack** (not
just local dashboard): a real standup was OOO-blocked (confirmed nothing spurious
created while OOO), then prompted normally once OOO cleared, manually reminded, and
submitted with an anonymized thread reply — user confirmed all messages landed
correctly in the real workspace. Template picker and edit-form pre-fill confirmed via
direct page requests. Test data cleaned up.

**Not yet done**: commit/push `standups-enhancements` (user hasn't asked yet — full
plan is at `~/.claude-work/plans/bright-wiggling-stallman.md` if needed for reference).

## What works right now

- Everything above, plus all of Phase 0–3 (Slack app foundation, standups MVP,
  rotations MVP) — all live on AWS and confirmed working, including inbound webhooks.
- Locally: `.env.local` (gitignored) fully set up — real bot token, DEV_USER
  (**U07QGT22ZUL**), DynamoDB Local config. DO NOT overwrite it.

## What's pending

1. Decide whether to commit/push `standups-enhancements` and open a PR.
2. Next enhancement round(s), one theme at a time (per the deferred list above), or
   AI/insight features once the user wants to move past "basic parity."
3. Longer-standing, not urgent: double-check `TEAM#SETTINGS.adminSlackIds` is seeded
   with `U07QGT22ZUL` for the real (non-DEV_USER) Slack sign-in path; Phase 4 polish
   items from PLAN.md (README runbook) not yet done.

## How to run locally (all of it already set up on this machine)

- `docker compose up -d` (DynamoDB Local :8000; container sprint-manager-dynamodb;
  Docker Desktop must be running) — table exists; recreate with `npm run db:local`
- `npm run dev -- -p 3001` (NOT 3000 — taken by user's josys-ui)
- `npm run tick` — one scheduler sweep (standups + rotations)
- Tests/checks: `npm run lint && npm run typecheck && npm test && npm run build`
- Store smoke test vs DynamoDB Local: env vars from .env.local + `node --import tsx scripts/store-smoke.ts`

## Standing rules from the user

- **Commits: user's git identity only. NEVER add `Co-Authored-By: Claude` or any
  Claude/AI mention in commit messages or PR bodies.** (Also saved in memory.)
- User prefers step-by-step guidance for Slack/AWS console tasks (new to Slack API).
- Only commit/push when explicitly asked.

## Key decisions

- Region **ap-northeast-1**; npm; Next.js 15.x; SST v3 Ion; DynamoDB PROVISIONED 5/5
- Deploy is CI/CD-driven: push to `main` → GitHub Actions → `sst deploy --stage prod`
  via AWS OIDC role
- App code reads plain env vars (never `Resource.*`) — SST injects in cloud, .env.local locally
- Tick due-check = window (schedule→closeAt) + conditional-write idempotency; cron(0/15 * * * ? *)
- GSI1 exists but unused so far (config scan is cheaper at ≤5 standups)
- Anchor date = participant's local date; anchor posted before first DM (thread parent)
- Reminders: increment counter BEFORE DM send (fail = skip nudge, never spam)
- DEV_USER synthetic session via src/lib/session.ts getSession() — all pages/authz use
  getSession(), never auth() directly; guarded to NODE_ENV !== production
- Rotations: no per-member timezone (unlike standups) — one calendar-date (UTC) boundary
  applies to the whole rotation; cadence math lives in src/lib/rotation/schedule.ts (pure)
- Rotation fairness: `cursor` on RotationConfig advances every auto-created shift
  regardless of overrides, so one overridden/skipped turn doesn't permanently reshuffle
  the round-robin order
- Overrides (ROTA#<id>/OVERRIDE#<date>) are dashboard-only for MVP (no Slack modal) —
  queued ahead of time, consumed (and deleted) by the tick when it creates that date's
  SHIFT; PLAN.md's "swap" is just two overrides in opposite directions, same primitive
- listStandups()/listRotations() scans MUST filter by pk prefix, not just sk="CONFIG" —
  both entities use the same sk and share the table (fixed as part of Phase 3)
- Preferred time / out-of-office are global per-user (`UserProfile`), not per-standup —
  avoids a write-race with admin edits (StandupConfig is only ever saved as a full-
  object put), and rides the existing per-tick `ensureUserProfile` read for free
- `ensureUserProfile`'s Slack-refresh branch must explicitly preserve `preferredTime`/
  `outOfOffice` — it rebuilds the profile from scratch on every 20h TTL refresh

## Gotchas

- sst.config.ts excluded from tsconfig + eslint (needs generated .sst/platform types)
- Slack signature verified over RAW body (req.text() before parse)
- DynamoDB Local container needs `user: root` (root-owned volume, else sqlite hangs silently)
- tsx runs scripts as CJS → main() wrapper, no top-level await
- All dashboard pages force-dynamic (auth() at build would throw)
- Modal private_metadata = {standupId, date, dmChannel, dmTs}; modal title ≤24 chars
- Slack Web API wrapper uses form-encoding (JSON bodies not accepted by all methods)
- `usergroups.users.update` wants a comma-joined string for `users`, not JSON — client.ts's
  `call()` JSON.stringifies any object/array value, so join to a string before passing it
- Don't run `npm run build` (or anything that writes `.next/`) while a `next dev` server
  is running against the same directory — corrupts the shared `.next/` cache and causes
  a confusing unrelated-looking `TypeError: a[d] is not a function` in the dev server.
  Kill the dev server (or use a separate checkout) before building.
- Local DynamoDB has a stray leftover `smoke1` STANDUP config (participants U_SMOKE_A/B,
  pre-existing, harmless) that makes `npm run tick`/sweep log a caught `user_not_found`
  error each run — harmless (per-participant errors are caught), left alone
- `startStandupNow` ("start now" admin action) intentionally bypasses OOO and preferred
  time too, same as it already bypasses the weekday/time schedule — admin override
  wins over all personalization, consistent by design, not a bug
