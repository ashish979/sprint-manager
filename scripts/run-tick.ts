/**
 * Run one scheduler sweep locally (stands in for EventBridge):
 *   npm run tick
 * Requires .env.local (Slack token + DynamoDB Local settings).
 */
import { sweep as sweepRotations } from "../src/lib/rotation/engine";
import { sweep as sweepStandups } from "../src/lib/standup/engine";

async function main() {
  const started = Date.now();
  await sweepStandups();
  await sweepRotations();
  console.log(`tick: sweep done in ${Date.now() - started}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
