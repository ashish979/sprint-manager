# CONTEXT.md — Session resume file

> Purpose: user switches Claude accounts when usage runs out. In a fresh session:
> read this file + PLAN.md, then continue exactly from "What's pending" below.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md.** Repo: github.com/ashish979/sprint-manager.

## Git state (as of 2026-07-08 ~15:30 IST, verified against origin)

- `origin/main` = Phase 0 + Phase 1 merged (PR #1 `bfd7374`, PR #2 `bca090e`).
  **Local `main` is stale — 2 commits behind origin.** Run `git checkout main && git pull`
  before merging PR #3.
- Branch `phase-2-standups` is **already pushed** (matches `origin/phase-2-standups`
  exactly, `eff1c5c`) with **PR #3 "Phase 2 standups" still open** (since
  2026-07-08T08:10:27 UTC) — not yet merged.
- **New branch `phase-3-rotations`** created off `phase-2-standups` (per user's choice,
  to not block on PR #3 merging first) — contains the full Rotations MVP implementation,
  **uncommitted** (all work so far is unstaged in the working tree; user has not asked
  to commit yet). Will need to be rebased onto `main` after PR #3 merges, or targeted
  as a PR against `phase-2-standups` — user hasn't decided which yet.
- **Next actions**: (1) merge PR #3 to main, (2) decide how `phase-3-rotations` lands
  (rebase onto main vs. stack on phase-2-standups), (3) commit Phase 3 work.

## What works right now (verified live in the org's JOSYS Slack workspace)

- Full outbound standup loop, locally, no AWS/tunnel:
  dashboard (http://localhost:3001, dev-bypass session) → create standup → "Start now"
  → real DM prompt to user + anchor message in channel. `npm run tick` = manual scheduler
  sweep (prompts due in each tz, reminders, close-at-missed, day close, anchor updates).
- Slack app **sprint_manager** (created from scratch, installed in JOSYS workspace,
  bot scopes: chat:write, im:write, users:read). Token verified via auth.test.
- User's Slack member id: **U07QGT22ZUL** (DEV_USER + test participant).
- `.env.local` (gitignored) is fully set up: real bot token, DEV_USER, DynamoDB Local
  config. DO NOT overwrite it.
- **Rotations MVP built (branch `phase-3-rotations`), verified with lint/typecheck/tests/
  build/store-smoke, but NOT yet exercised live against Slack** (no rotation created
  through the dashboard yet — that needs a real channel id + real member ids, which the
  user should do interactively; the engine calls `chat.postMessage`/`conversations.open`/
  `usergroups.users.update` for real, so don't fire it at a real channel casually).

## What does NOT work yet (by design, no public URL)

Answer/Skip buttons, answer modal, thread replies, `/rota`, real Slack sign-in — all
inbound webhooks. User explicitly chose NO ngrok/tunnel; these unlock at AWS deploy.
Slack app still needs from slack-manifest.yml: interactivity URL, commands URL, events
URL, OAuth redirect + user scopes (openid/email/profile) + remaining bot scopes
(commands, usergroups:read/write, channels:read), then reinstall. **Correction from
earlier note: slack-manifest.yml already declares all these bot scopes — nothing to
add there; it's the live installed app in the workspace that's missing them until
reinstalled with the full manifest.**

## What's pending (agreed order)

1. **User**: merge PR #3 (`phase-2-standups`) to main, then decide how
   `phase-3-rotations` lands (rebase onto updated main, or PR stacked on
   phase-2-standups) — currently uncommitted, built directly on phase-2-standups.
2. **Me**: Phase 3 — Rotations MVP. **Implementation complete** on `phase-3-rotations`
   (uncommitted): ROTA CONFIG/SHIFT/OVERRIDE store, pure cadence schedule.ts (daily/
   weekdays/weekly/biweekly/monthly, tested), engine.ts (sweep + rotate + "rotate now"),
   `/rota who <name>` command, usergroup sync, dashboard pages (list/new/detail with
   override queueing + shift history). Not yet done: live Slack verification (needs
   user to create a rotation via the dashboard with a real channel/members) and a
   commit.
3. **User+me, parallel**: AWS onboarding — user runs `aws configure` (ap-south-1),
   then: `npx sst deploy --stage dev` → 6× `sst secret set` (SlackBotToken,
   SlackSigningSecret, SlackClientId, SlackClientSecret, SlackTeamId, AuthSecret)
   → redeploy → update Slack app URLs → seed TEAM#SETTINGS adminSlackIds=[U07QGT22ZUL]
   → verify buttons/modal work. Check budget email in sst.config.ts (vikasahu09@gmail.com).
4. Later: GitHub OIDC role + `AWS_OIDC_ROLE_ARN` repo var (CI's sst steps skip until set);
   Phase 4 polish (standup EDIT form is missing, report history, README runbook).

## How to run locally (all of it already set up on this machine)

- `docker compose up -d` (DynamoDB Local :8000; container sprint-manager-dynamodb;
  Docker Desktop must be running) — table exists; recreate with `npm run db:local`
- `npm run dev -- -p 3001` (NOT 3000 — taken by user's josys-ui)
- `npm run tick` — one scheduler sweep
- Tests/checks: `npm run lint && npm run typecheck && npm test && npm run build`
- Store smoke test vs DynamoDB Local: env vars from .env.local + `node --import tsx scripts/store-smoke.ts`

## Standing rules from the user

- **Commits: user's git identity only. NEVER add `Co-Authored-By: Claude` or any
  Claude/AI mention in commit messages or PR bodies.** (Also saved in memory.)
- User prefers step-by-step guidance for Slack/AWS console tasks (new to Slack API).

## Key decisions

- Region ap-south-1; npm; Next.js 15.x; SST v3 Ion; DynamoDB PROVISIONED 5/5 via transform
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
- Local DynamoDB has a stray leftover `smoke1` STANDUP config (participants U_SMOKE_A/B,
  pre-existing, not from Phase 3) that makes `npm run tick` log a caught `user_not_found`
  error each run — harmless (per-participant errors are caught), left alone, not investigated
