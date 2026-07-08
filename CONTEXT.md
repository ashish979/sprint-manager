# CONTEXT.md — Session resume file

> Purpose: user switches Claude accounts when usage runs out. In a fresh session:
> read this file + PLAN.md, then continue exactly from "What's pending" below.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md.** Repo: github.com/ashish979/sprint-manager.

## Git state (as of 2026-07-08 ~13:30 IST)

- `main` = Phase 0 + Phase 1 (PRs #1, #2 merged)
- Current branch `phase-2-standups` = 3 commits: Phase 2 standups MVP (`bec1b72`),
  dev sign-in bypass (`971707b`), context update (`54b9f10`) + this file's update
- **User was about to: `git push` this branch (2+ commits not on origin) and merge its PR.**
  Verify with `git log --oneline origin/main..HEAD` before assuming.

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

## What does NOT work yet (by design, no public URL)

Answer/Skip buttons, answer modal, thread replies, `/rota`, real Slack sign-in — all
inbound webhooks. User explicitly chose NO ngrok/tunnel; these unlock at AWS deploy.
Slack app still needs from slack-manifest.yml: interactivity URL, commands URL, events
URL, OAuth redirect + user scopes (openid/email/profile) + remaining bot scopes
(commands, usergroups:read/write, channels:read), then reinstall.

## What's pending (agreed order)

1. **User**: push `phase-2-standups`, merge PR to main
2. **Me**: Phase 3 — Rotations MVP on a fresh branch off updated main
   (PLAN.md §1.2/§2.4: ROTA CONFIG/SHIFT items, tick rollover, overrides/swaps,
   channel announce + on-duty DM, usergroup sync, `/rota who` in commands route,
   dashboard pages). Follow Phase 2 patterns: pure logic + tests, store with
   conditional writes, engine, force-"rotate now" admin action.
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

## Gotchas

- sst.config.ts excluded from tsconfig + eslint (needs generated .sst/platform types)
- Slack signature verified over RAW body (req.text() before parse)
- DynamoDB Local container needs `user: root` (root-owned volume, else sqlite hangs silently)
- tsx runs scripts as CJS → main() wrapper, no top-level await
- All dashboard pages force-dynamic (auth() at build would throw)
- Modal private_metadata = {standupId, date, dmChannel, dmTs}; modal title ≤24 chars
- Slack Web API wrapper uses form-encoding (JSON bodies not accepted by all methods)
