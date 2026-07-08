# CONTEXT.md — Session resume file

> Purpose: if this Claude session ends (e.g. account/usage switch), start a fresh session,
> say "read CONTEXT.md and continue", and pick up exactly where we left off.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md** (read it first — data model, flows, milestones).

## Current state (last updated: 2026-07-08, Phase 2 complete locally)

- `main` has Phase 0 only (PR #1). **Phase 1 is NOT merged yet** — it lives on
  `phase-1-slack-app`; `phase-2-standups` (current branch) is based on it, so merge
  phase-1's PR first or let the phase-2 PR carry both.
- **Phase 2 (Standups MVP) done + verified**: lint ✅ typecheck ✅ 30 unit tests ✅ build ✅
  and a store-layer smoke test passed against DynamoDB Local (`scripts/store-smoke.ts`).
- Nothing deployed to AWS yet; the whole standup loop runs locally (see "Local run").

### What exists (Phase 2, this branch)

- **Types** `src/lib/types.ts` — StandupConfig/Report/StandupDay/UserProfile + defaults
- **Pure logic** (all unit-tested): `src/lib/tz.ts` (Intl-based localParts/timeToMinutes),
  `src/lib/standup/schedule.ts` (isPromptDue window + pendingReportAction remind/miss),
  `src/lib/standup/blockers.ts` (blocker question detection + answer heuristic)
- **Store** `src/lib/store/{standups,users,reports}.ts` — conditional writes for idempotency
  (report create is first-wins; pending→skipped/missed guarded; threadTs if_not_exists);
  user profiles cache Slack tz with 20 h TTL
- **Slack** `src/lib/slack/client.ts` (form-encoded Web API wrapper: postMessage, update,
  openDm, openView, userInfo, respond) and `blocks.ts` (anchor, DM prompt with
  Answer/Skip buttons, modal, thread reply)
- **Engine** `src/lib/standup/engine.ts` — sweep (due prompts in each tz, reminders,
  close-at-missed, cross-midnight safety net), anchor-first prompting, submit/skip flows,
  live anchor updates, day auto-close; `startStandupNow()` for the dashboard button
- **Tick** `functions/tick.ts` → engine.sweep; cron now `cron(0/15 * * * ? *)` (quarter-hour
  aligned, matches 15-min standup time increments)
- **Interactivity route** dispatches `standup:answer` (opens modal), `standup:skip`,
  `standup:submit` (view_submission); always acks 200 within 3 s, errors logged
- **Dashboard**: `/standups` (list), `/standups/new` (create form), `/standups/[id]`
  (config, date-picked reports, blocker highlighting, admin Start now / Delete);
  `src/lib/authz.ts` requireAdmin with `DEV_ADMIN=true` dev bypass
- **Local dev without AWS**: `docker-compose.yml` (DynamoDB Local :8000, `user: root`
  required — named volume is root-owned, otherwise sqlite hangs), `npm run db:local`
  (create table + optional `ADMIN_SLACK_ID=U… npm run db:local` seeds admin),
  `npm run tick` (one sweep via tsx, stands in for EventBridge), `scripts/store-smoke.ts`

### Local run (no AWS)

1. `docker compose up -d && npm run db:local`
2. `.env.local` exists (gitignored, pre-filled): user must set `SLACK_BOT_TOKEN` (xoxb-)
   and `DEV_USER` (their Slack member id). `DEV_USER` = dev-only sign-in bypass
   (`src/lib/session.ts` getSession()) → synthetic admin session, no OAuth/tunnel needed.
3. `npm run dev -- -p 3001` (3000 is taken by user's josys-ui)
4. Create standup in dashboard → "Start now" or `npm run tick` → real DMs + channel anchor
   appear in Slack. **Without a tunnel, inbound is dead**: Answer/skip buttons, modal,
   /rota, real sign-in all need ngrok or the deployed URL. User chose no-tunnel for now;
   moving to AWS (`sst dev`) later.

### Next steps

1. User pushes `phase-2-standups`, merges PRs (phase-1 first or together)
2. **Phase 3 — Rotations MVP** (PLAN.md §1.2/§2.4): ROTA CONFIG/SHIFT items, tick shift
   rollover with overrides/swaps, channel announce + on-duty DM, Slack usergroup sync,
   `/rota who` command (commands route has a placeholder), dashboard rotation pages
3. Later user actions for deploy: AWS OIDC role + `AWS_OIDC_ROLE_ARN` repo var, first
   deploy, Slack app from manifest with CloudFront URL, `sst secret set` × 6, TEAM#SETTINGS

## Standing rules from the user

- **Commits: user's git identity only.** Never add `Co-Authored-By: Claude` trailers or any
  Claude/AI mention in commit messages or PR bodies.

## Decisions made

- Region ap-south-1; npm; Next.js 15.x; SST v3; DynamoDB PROVISIONED via transform
- App code reads plain env vars (not `Resource.*`); SST injects; `.env.local` for dev
- Tick evaluates "due" as a window (schedule time → closeAt) with conditional-write
  idempotency, not exact tick-time equality; no per-user EventBridge schedules
- GSI1 exists in the table but Phase 2 sweeps configs directly (≤5 standups — a Scan is
  cheaper than maintaining DUE items; revisit only if standup count grows)
- Anchor day/date = each participant's local date; anchor posted by first-due participant
- Reminders increment counter BEFORE sending DM (skip a nudge on failure, never spam)
- Admin allowlist snapshotted into JWT at sign-in; `DEV_ADMIN=true` bypass in dev only

## Gotchas

- `sst.config.ts` excluded from tsconfig + eslint (generated `.sst/platform` types)
- Slack signature over the **raw** body; read `req.text()` before parsing
- Slack OIDC needs HTTPS → tunnel for local sign-in
- Landing + all dashboard pages are `force-dynamic` (auth() at build would fail)
- tsx runs scripts as CJS (no `"type": "module"`) → scripts use `main()` wrapper,
  no top-level await
- Modal `private_metadata` carries {standupId, date, dmChannel, dmTs} so submit can
  edit the original DM; modal title must stay ≤24 chars
