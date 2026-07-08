# CONTEXT.md — Session resume file

> Purpose: if this Claude session ends (e.g. account/usage switch), start a fresh session,
> say "read CONTEXT.md and continue", and pick up exactly where we left off.
> Keep this file updated after every meaningful step.

## Project

In-house Geekbot (async standups) + Rotation.app (duty rotations) replacement.
Slack-first, admin web dashboard, hard cost ceiling $5/month on AWS.
**Full architecture and product spec: PLAN.md** (read it first — data model, flows, milestones).

## Current state (last updated: 2026-07-07, Phase 0 complete locally)

- Branch: `phase-0-scaffolding` (from `main`)
- **Phase 0 scaffolding is DONE and verified locally**: lint ✅ typecheck ✅ 5 unit tests ✅ `next build` ✅
- Not yet deployed to AWS (needs user's AWS account + OIDC role, see below)

### What exists

- Next.js 15.5 (App Router, TS, Tailwind 4, `src/` dir, npm), placeholder landing page
- `sst.config.ts` (SST v3.19): `sst.aws.Nextjs` site, `sst.aws.Dynamo` single table
  (pk/sk + GSI1 gsi1pk/gsi1sk, transformed to PROVISIONED 5/5 table + 5/5 GSI for free tier),
  `sst.aws.Cron` every 15 min → `functions/tick.ts` stub (reserved concurrency 1, 2-wk logs),
  `sst.Secret` SlackSigningSecret + SlackBotToken, AWS Budget alerts at $3/$5 (prod only,
  email vikasahu09@gmail.com). Region **ap-south-1**.
- `src/lib/due.ts` + tests: `dueKey()`/`floorToTick()` — GSI1 `DUE#yyyy-mm-dd-hh-mm` key helpers
- Vitest (`npm test`), `npm run typecheck`; `sst.config.ts` excluded from tsconfig + eslint
  (its types come from generated `.sst/platform`, which is gitignored)
- `.github/workflows/ci.yml` (PRs + non-main pushes: lint/typecheck/test, then `sst diff --stage prod`
  **only if** repo variable `AWS_OIDC_ROLE_ARN` is set) and `deploy.yml` (main → checks + `sst deploy --stage prod`)

### Next steps

1. Commit Phase 0 on `phase-0-scaffolding`, push, open PR to `main` (repo: ashish979/sprint-manager)
2. **User actions before first deploy:**
   - Create AWS IAM role trusted by GitHub OIDC (`token.actions.githubusercontent.com`,
     repo `ashish979/sprint-manager`), admin-ish perms for SST; set repo variable `AWS_OIDC_ROLE_ARN`
   - Locally: `npx sst deploy` (dev stage) or merge PR to deploy prod
   - After deploy: `npx sst secret set SlackSigningSecret <val> --stage prod` (and SlackBotToken)
3. **Phase 1** (PLAN.md §7): `slack-manifest.yml`, `/api/slack/{events,interactivity,commands}`
   routes with signature verification (5-min replay window), Sign in with Slack via Auth.js,
   team-id check + admin allowlist in `TEAM#SETTINGS`

## Standing rules from the user

- **Commits: user's git identity only.** Never add `Co-Authored-By: Claude` trailers or any
  Claude/AI mention in commit messages or PR bodies.

## Decisions made

- Region **ap-south-1** (user in India; PLAN.md left it open)
- npm as package manager (Node v20.19.0)
- Next.js pinned 15.x per PLAN.md; SST v3 (Ion)
- DynamoDB PROVISIONED via `transform` (SST default is on-demand, which isn't always-free)
- CI skips `sst diff` gracefully until `AWS_OIDC_ROLE_ARN` repo variable exists
- Budget alert email: vikasahu09@gmail.com (constant in sst.config.ts — change there if needed)

## Gotchas

- `sst.config.ts` must stay excluded from tsconfig/eslint until `.sst/platform` is generated
  (first `sst` command creates it); don't import `sst` package types in app code yet
- `functions/tick.ts` is a no-op stub; Phase 2 gives it the GSI1 DUE sweep
- Don't use `Resource.*` from `sst` in app code until first deploy generates `sst-env.d.ts`
