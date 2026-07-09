# CONTEXT.md — Session resume file

> Purpose: user switches Claude accounts when usage runs out. In a fresh session:
> read this file + PLAN.md, then continue exactly from "What's pending" below.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md.** Repo: github.com/ashish979/sprint-manager.

## Deployed to AWS — prod is LIVE (as of 2026-07-09)

- **Account 340752826805** (josys **pre-staging** — a shared account), region
  **ap-northeast-1**, SST v3 stage `prod`.
- **Live URL:** https://d3vupucqaofzm6.cloudfront.net (CloudFront → Next.js Lambda).
- **Main DynamoDB table:** `sprint-manager-prod-TableTable-vevxvzmt`.
- **Admin allowlist** (TEAM#SETTINGS.adminSlackIds): `U03GMA4EW93`, `U07QGT22ZUL`.
- **Slack team id:** `T039G19V4CR` (JOSYS). Slack app `sprint_manager` reinstalled with the
  full manifest (all bot+user scopes); interactivity/commands/events/OAuth URLs point at the
  CloudFront host. Bot token was NOT rotated by the reinstall (the `SlackBotToken` prod
  secret is still valid).
- Region change ap-south-1 → ap-northeast-1 and budget email → ashish.agrawal@josys.com were
  merged to main via **PR #6**.

## CI/CD — LIVE (as of 2026-07-09)

Push/merge to `main` → GitHub Actions `.github/workflows/deploy.yml`: npm ci → lint →
typecheck → test → assume OIDC role → `sst deploy --stage prod`.

- OIDC deploy role: `arn:aws:iam::340752826805:role/sprint-manager-gha-deploy`, trust scoped
  to `repo:ashish979/sprint-manager:*`. Repo variable `AWS_OIDC_ROLE_ARN` holds the ARN.
- Role has a **least-privilege** inline policy `sst-deploy-least-priv`: only the services SST
  touches, scoped to `sprint-manager-*` **plus** the unprefixed resources SST's
  QueueLambdaSubscriber creates (`Site*` function, `prod-Site*` role, `/aws/lambda/Site*` log
  group). If a future deploy hits `AccessDenied` on a new resource name, widen that policy.
- The six SST secrets already live in SSM for stage `prod`; CI reuses them.

## What works right now (verified live in the org's JOSYS Slack workspace)

- **Outbound** (verified earlier, locally + prod): standup DMs/anchors, rotation announce +
  on-duty DM. `npm run tick` = manual scheduler sweep locally.
- **Real "Sign in with Slack"** on the deployed dashboard — verified live: signs in and lands
  as **admin** (allowlist snapshotted into the JWT at sign-in; re-login needed to pick up
  allowlist changes). Admin UI (New standup / rotation management) visible.
- **Inbound is now unblocked** by the public CloudFront URL (this was the whole point of
  deploying). See "What's pending" for the flows still to click through end-to-end.

## What's pending (agreed order)

1. **Finish live inbound verification** (was task 7): standup **Answer** button → modal →
   threaded reply + anchor tally update; `/rota who <name>`; rotation "Rotate now" from the
   dashboard UI. Sign-in already verified; these button/modal/slash flows are the last
   unverified inbound paths.
2. Phase 4 polish: standup EDIT form is missing; report history; README runbook.
3. Housekeeping: workflow Node bumped 20 → 22 (this branch). Note the GitHub annotation about
   Node20 *action runtimes* (checkout/setup-node/configure-aws-credentials) is separate — that
   depends on action versions, not our `node-version`.

## Local dev (unchanged, still set up on this machine)

- `docker compose up -d` (DynamoDB Local :8000) — recreate table with `npm run db:local`.
- `npm run dev -- -p 3001` (3000 taken by josys-ui). `npm run tick` = one sweep.
- Checks: `npm run lint && npm run typecheck && npm test && npm run build`.
- `.env` (gitignored; the file is named `.env`, older notes said `.env.local`) holds real bot
  token + Slack client/signing secrets + `DEV_USER`/`DEV_ADMIN` + DynamoDB Local config.
  **DO NOT overwrite it.** `SLACK_TEAM_ID` in it was empty; the real value is T039G19V4CR.

## Deploying manually (local `sst deploy`) — two gotchas CI avoids

CI is clean (no `.env` in checkout, OIDC creds), but a **local** `npx sst deploy` needs both:
1. **Move `.env` aside for the build.** SST/Next.js load `.env`, which sets
   `AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000`; that gets baked into the build and the
   deployed Lambda then fails with `ECONNREFUSED 127.0.0.1:8000`. Move `.env` out, deploy,
   move it back (use a trap so it's always restored).
2. **Pulumi can't use the SSO profile directly** ("Invalid credentials"). Resolve static
   creds first: `eval "$(aws configure export-credentials --profile <p> --format env)"` then
   `unset AWS_PROFILE; export AWS_REGION=ap-northeast-1` before `./node_modules/.bin/sst deploy`.
- Use the **local** sst (`./node_modules/.bin/sst` after `npm ci`) — bare `npx sst` fetches
  sst v4, which is wrong (repo is pinned to v3.19.3).
- SSO profile `josys-pre-staging-Dvlopr-Pro-Max-340752826805`; token expires ~daily →
  `aws sso login --profile ...`.

## Standing rules from the user

- **Commits: user's git identity only. NEVER add `Co-Authored-By: Claude` or any Claude/AI
  mention in commit messages or PR bodies.**
- User prefers step-by-step guidance for Slack/AWS console tasks.
- Use **ashish.agrawal@josys.com** for all project email (AWS budgets, alerts).

## Key decisions

- Region ap-northeast-1; npm; Next.js 15.x; SST v3 Ion; DynamoDB PROVISIONED 5/5 via transform.
- App code reads plain env vars (never `Resource.*`) — SST injects in cloud, `.env` locally.
- Deploy target is the shared pre-staging account; the $5 AWS budget there measures the WHOLE
  account (already ~$1,200/mo of other teams' spend), so its alerts are noise for us — kept
  but not meaningful. A dedicated account would make the budget guardrail real (deferred).
- Tick due-check = window (schedule→closeAt) + conditional-write idempotency; cron(0/15 * * * ? *).
- Anchor date = participant's local date; anchor posted before first DM (thread parent).
- Reminders: increment counter BEFORE DM send (fail = skip nudge, never spam).
- DEV_USER synthetic session via src/lib/session.ts getSession() — ignored in production, so
  the deployed dashboard requires real Slack OAuth. All pages/authz use getSession().
- Rotations: one calendar-date (UTC) boundary for the whole rotation; cadence math in
  src/lib/rotation/schedule.ts (pure). `cursor` advances every auto shift regardless of
  overrides. Overrides (ROTA#<id>/OVERRIDE#<date>) are dashboard-only for MVP.
- listStandups()/listRotations() scans MUST filter by pk prefix (shared sk="CONFIG").

## Gotchas

- sst.config.ts excluded from tsconfig + eslint (needs generated .sst/platform types).
- Slack signature verified over RAW body (req.text() before parse).
- DynamoDB Local container needs `user: root`. tsx scripts run as CJS → main() wrapper.
- All dashboard pages force-dynamic. Modal private_metadata = {standupId, date, dmChannel,
  dmTs}; modal title ≤24 chars.
- Slack Web API wrapper uses form-encoding; `usergroups.users.update` wants a comma-joined
  string for `users` (join before passing).
- **zsh gotcha when generating IAM policy JSON:** in an unquoted heredoc, `$VAR:role` /
  `$VAR:log-group` trigger zsh history modifiers (`:r`, `:l`) and silently corrupt ARNs. Use
  a quoted heredoc (`<<'JSON'`) with literal account/region.
- Local DynamoDB has leftover `smoke1` STANDUP + orphaned `ROTA#live-test-rota` SHIFT —
  harmless (config gone, history stays), left alone.
