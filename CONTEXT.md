# CONTEXT.md — Session resume file

> Purpose: if this Claude session ends (e.g. account/usage switch), start a fresh session,
> say "read CONTEXT.md and continue", and pick up exactly where we left off.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md** (read it first — data model, flows, milestones).

## Current state (last updated: 2026-07-08, Phase 1 complete locally)

- Phase 0 merged to `main` via PR #1 (repo: ashish979/sprint-manager)
- Branch: `phase-1-slack-app` — **Phase 1 done, verified locally**
  (lint ✅ typecheck ✅ 10 tests ✅ `next build` ✅), not yet pushed/deployed

### What exists

**Phase 0** (merged): Next.js 15.5 (App Router, TS, Tailwind 4, npm), `sst.config.ts`
(Nextjs site, DynamoDB single table pk/sk + GSI1, PROVISIONED 5/5, 15-min Cron →
`functions/tick.ts` stub, $3/$5 budget alerts, region ap-south-1), CI/CD via GitHub OIDC
(AWS steps skip until repo var `AWS_OIDC_ROLE_ARN` set), Vitest, `src/lib/due.ts` DUE-key helpers.

**Phase 1** (this branch):
- `src/lib/slack/verify.ts` — HMAC v0 signature check, 5-min replay window, timing-safe; tested
- `src/lib/slack/request.ts` — shared "read raw body + verify or 401" helper
- Webhooks: `src/app/api/slack/{events,interactivity,commands}/route.ts`
  (events handles `url_verification`; commands answers `/rota` with Phase 3 placeholder)
- `src/auth.ts` — next-auth v5 (beta) Slack OIDC; sign-in restricted to `SLACK_TEAM_ID`;
  `isAdmin` snapshotted into JWT at login from TEAM#SETTINGS `adminSlackIds` (re-login refreshes)
- `src/lib/db.ts` — DynamoDB DocumentClient + `getTeamSettings()`
- `src/lib/env.ts` — all config via plain env vars (see `.env.example`); SST injects them in
  deployed stages (secrets: SlackSigningSecret, SlackBotToken, SlackClientId, SlackClientSecret,
  SlackTeamId, AuthSecret)
- `slack-manifest.yml` — checked-in manifest; replace `<BASE_URL>` per stage
- Landing page has Sign in/out with Slack; `force-dynamic` so builds need no env

### Next steps

1. Push `phase-1-slack-app`, PR to main (user pushes/merges themself)
2. **User actions to make Phase 1 live:**
   - AWS OIDC role + repo var `AWS_OIDC_ROLE_ARN` (still pending from Phase 0)
   - First deploy; then create Slack app(s) from `slack-manifest.yml` with the CloudFront URL
   - `sst secret set` all six secrets per stage; write TEAM#SETTINGS item with `adminSlackIds`
3. **Phase 2 — Standups MVP** (PLAN.md §1.1/§2.3): standup CONFIG/DAY/REPORT items, tick sweep
   of GSI1 DUE keys, DM prompt + "Answer standup" button, Block Kit modal, anchor message +
   threaded replies + live status edits, configurable reminders, dashboard report views

## Standing rules from the user

- **Commits: user's git identity only.** Never add `Co-Authored-By: Claude` trailers or any
  Claude/AI mention in commit messages or PR bodies.

## Decisions made

- Region **ap-south-1**; npm; Next.js 15.x; SST v3 (Ion)
- DynamoDB PROVISIONED via `transform` (SST default on-demand isn't always-free)
- App code reads plain env vars (not `Resource.*`) so local dev + typecheck work without
  `.sst/platform`; SST `link` still grants table IAM
- Admin allowlist checked once at sign-in (JWT), not per request
- Budget alert email: vikasahu09@gmail.com (constant in sst.config.ts)

## Gotchas

- `sst.config.ts` excluded from tsconfig + eslint (types come from generated `.sst/platform`)
- Slack signature must be computed over the **raw** body — read `req.text()` before parsing
- Slack OIDC redirect requires HTTPS → local sign-in testing needs the deployed URL or a tunnel
- Landing page is `force-dynamic`; keep it that way or builds will call `auth()` without env
- `functions/tick.ts` still a no-op stub until Phase 2
