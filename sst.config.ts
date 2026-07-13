/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Sprint Manager infrastructure (see PLAN.md §2–§4).
 *
 * One SST app: Next.js site (dashboard + API + Slack webhooks), a single
 * DynamoDB table, a 15-minute EventBridge tick, and Slack secrets.
 * Everything is sized to stay inside AWS always-free tiers.
 */

// Receives AWS Budget alerts at $3 and $5 (prod only).
const BUDGET_ALERT_EMAIL = "ashish.agrawal@josys.com";

export default $config({
  app(input) {
    return {
      name: "sprint-manager",
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: { region: "ap-northeast-1" },
      },
    };
  },
  async run() {
    // Single-table design (PLAN.md §2.2). GSI1 serves the "what's due now"
    // query: gsi1pk = DUE#<yyyy-mm-dd-hh-mm>.
    //
    // On-demand billing (SST's default): we run in a shared org account where
    // the DynamoDB always-free provisioned tier is already consumed org-wide,
    // so 24/7 provisioned capacity was billed for full. Our request volume is
    // tiny (a few thousand ops/week), so pay-per-request costs a fraction of a
    // cent vs. ~$6/mo for provisioned 5/5 (+5/5 GSI).
    const table = new sst.aws.Dynamo("Table", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        GSI1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
    });

    // Set after deploy with: sst secret set <name> <value> [--stage prod]
    const slackSigningSecret = new sst.Secret("SlackSigningSecret");
    const slackBotToken = new sst.Secret("SlackBotToken");
    // Sign in with Slack (OIDC) + Auth.js session encryption. Per-stage
    // values since dev/prod are separate Slack apps.
    const slackClientId = new sst.Secret("SlackClientId");
    const slackClientSecret = new sst.Secret("SlackClientSecret");
    const slackTeamId = new sst.Secret("SlackTeamId");
    const authSecret = new sst.Secret("AuthSecret");

    // App code reads plain env vars (src/lib/env.ts) so local dev works
    // from .env.local; links below still grant IAM access to the table.
    const sharedEnvironment = {
      SLACK_SIGNING_SECRET: slackSigningSecret.value,
      SLACK_BOT_TOKEN: slackBotToken.value,
      SLACK_TEAM_ID: slackTeamId.value,
      TABLE_NAME: table.name,
    };

    // Idempotent scheduler sweep: standup prompts, reminders, shift rollovers.
    new sst.aws.Cron("Tick", {
      // Quarter-hour aligned (not rate()) so ticks land on :00/:15/:30/:45,
      // matching the 15-minute increments standup times are restricted to.
      schedule: "cron(0/15 * * * ? *)",
      function: {
        handler: "functions/tick.handler",
        link: [table],
        environment: sharedEnvironment,
        timeout: "60 seconds",
        // Guardrail: a runaway tick can never fan out.
        concurrency: { reserved: 1 },
        logging: { retention: "2 weeks" },
      },
    });

    const site = new sst.aws.Nextjs("Site", {
      link: [table],
      environment: {
        ...sharedEnvironment,
        SLACK_CLIENT_ID: slackClientId.value,
        SLACK_CLIENT_SECRET: slackClientSecret.value,
        AUTH_SECRET: authSecret.value,
        // Auth.js needs its public URL behind CloudFront.
        AUTH_TRUST_HOST: "true",
      },
      server: {
        logging: { retention: "2 weeks" },
      },
    });

    // Cost guardrail (PLAN.md §4): alert at $3 and $5 actual spend.
    if ($app.stage === "prod") {
      new aws.budgets.Budget("MonthlyCostBudget", {
        budgetType: "COST",
        timeUnit: "MONTHLY",
        limitAmount: "5",
        limitUnit: "USD",
        notifications: [
          {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 60, // $3 of the $5 limit
            thresholdType: "PERCENTAGE",
            subscriberEmailAddresses: [BUDGET_ALERT_EMAIL],
          },
          {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 100, // $5
            thresholdType: "PERCENTAGE",
            subscriberEmailAddresses: [BUDGET_ALERT_EMAIL],
          },
        ],
      });
    }

    return {
      url: site.url,
      table: table.name,
    };
  },
});
