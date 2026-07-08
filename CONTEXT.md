# CONTEXT.md — Session resume file

> Purpose: user switches Claude accounts when usage runs out. In a fresh session:
> read this file + PLAN.md, then continue exactly from "What's pending" below.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md.** Repo: github.com/ashish979/sprint-manager.

## Git state (as of 2026-07-08 ~16:00 IST, verified against origin)

- `origin/main` = Phase 0 + Phase 1 + Phase 2 merged (PR #1 `bfd7374`, PR #2 `bca090e`,
  PR #3 `a3f1bf3`).
- Branch `phase-3-rotations` — Rotations MVP, committed (`0ff983f`), rebased cleanly
  onto updated `main`, pushed, **PR #4 open** since 2026-07-08T09:29:59Z — **not yet
  merged**.
- **Next action: merge PR #4**, then `git checkout main && git pull` before further work.

## What works right now (verified live in the org's JOSYS Slack workspace)

- Full outbound standup loop, locally, no AWS/tunnel:
  dashboard (http://localhost:3001, dev-bypass session) → create standup → "Start now"
  → real DM prompt to user + anchor message in channel. `npm run tick` = manual scheduler
  sweep (prompts due in each tz, reminders, close-at-missed, day close, anchor updates).
- **Rotations MVP verified live** (2026-07-08): `advanceRotationNow()` called directly
  (bypassing the dashboard UI, via a throwaway script) against real Slack — channel
  announce landed in `C0BFQA2H1C3` and the on-duty DM landed for `U07QGT22ZUL`, both
  confirmed by the user. Shift record + conditional-write idempotency also confirmed.
  **Not yet tried**: the dashboard UI itself (`/rotations/new` → detail → "Rotate now"
  button click), multi-member round-robin with more than one real Slack id, override
  queueing end-to-end, or `usergroupsUsersUpdate` (no test Slack user group id available
  yet), or `/rota who` (needs a live interactivity/commands URL — see below).
- Slack app **sprint_manager** (created from scratch, installed in JOSYS workspace,
  bot scopes: chat:write, im:write, users:read). Token verified via auth.test.
- User's Slack member id: **U07QGT22ZUL** (DEV_USER + test participant).
- `.env.local` (gitignored) is fully set up: real bot token, DEV_USER, DynamoDB Local
  config. DO NOT overwrite it.

## Why some things work locally and some don't (came up 2026-07-08, worth keeping)

The split is **outbound vs. inbound**, not which Slack app or which phase:

- **Outbound** (app → Slack: `chat.postMessage`, `conversations.open`, `views.open`) is
  just an outgoing HTTPS call — works from anywhere, including `localhost`. This is
  everything verified live so far: standup DMs/anchors, rotation announce/DM.
- **Inbound** (Slack → app: button clicks, modal submissions, `/rota`, the "Sign in with
  Slack" OAuth redirect) requires Slack's servers to call back into a **public** HTTPS
  URL. `localhost:3001` isn't reachable from the internet, so none of this works without
  either a tunnel (ngrok) or a real deploy (AWS). User explicitly ruled out ngrok early
  on — see "What does NOT work yet" below.
- **Socket Mode** (the user recalled using this on a past project) is a third option:
  the app dials **out** to Slack over a WebSocket (app-level token, `xapp-...`), and
  Slack pushes inbound events down that same connection — no public URL needed at all.
  PLAN.md's architecture deliberately does **not** use it in production ("no Socket
  Mode, since Lambda is request-driven") because it needs a persistent always-on
  process, which conflicts with the serverless/$5-budget design. It *could* still be
  added as **local-dev-only** tooling (a small script run alongside `npm run dev` that
  forwards Socket Mode payloads into the existing route handlers) to test buttons/
  modal/`/rota` before ever touching AWS. **Not built — user said "wait" on 2026-07-08,
  no decision yet between this and going straight to AWS.**

## What does NOT work yet (by design, no public URL)

Answer/Skip buttons, answer modal, thread replies, `/rota`, real Slack sign-in — all
inbound webhooks (see explanation above). Slack app still needs, from
slack-manifest.yml: interactivity URL, commands URL, events URL, OAuth redirect + user
scopes (openid/email/profile) + remaining bot scopes (commands, usergroups:read/write,
channels:read), then reinstall. **Note: slack-manifest.yml already declares all these
bot scopes — nothing to add there; it's the live installed app in the workspace that's
missing them until reinstalled with the full manifest** (which itself needs a real
public URL to put in the manifest's `<BASE_URL>` placeholders first).

## What's pending (agreed order)

1. **User**: merge PR #4 (`phase-3-rotations`) to main.
2. **Decision needed from user** (currently parked as "wait"): unblock inbound testing
   via local-only Socket Mode, or skip straight to AWS deploy. Nothing built for either
   yet.
3. Once decided — if AWS: user runs `aws configure` (ap-south-1), then:
   `npx sst deploy --stage dev` → 6× `sst secret set` (SlackBotToken,
   SlackSigningSecret, SlackClientId, SlackClientSecret, SlackTeamId, AuthSecret)
   → redeploy → update Slack app URLs → seed TEAM#SETTINGS adminSlackIds=[U07QGT22ZUL]
   → verify buttons/modal/`/rota` work. Check budget email in sst.config.ts
   (currently `vikasahu09@gmail.com`).
   - Slack app decision: **reuse the existing `sprint_manager` app** rather than
     creating a separate dev app — simpler for a solo project; PLAN.md's dev/prod app
     split is optional, not required.
   - Credentials to gather before this step: AWS access key + secret (IAM user w/
     AdministratorAccess to start), SlackSigningSecret + SlackClientId +
     SlackClientSecret + SlackTeamId (all from api.slack.com/apps → Basic Information),
     and a generated AuthSecret (e.g. `npx auth secret`).
4. Later: GitHub OIDC role + `AWS_OIDC_ROLE_ARN` repo var (CI's sst steps skip until set);
   Phase 4 polish (standup EDIT form is missing, report history, README runbook).

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
- Local DynamoDB also has an orphaned `ROTA#live-test-rota` SHIFT item (config already
  deleted after the live verification test) — harmless, same "config gone, history stays"
  design as standups
