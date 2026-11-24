import { app } from "./app";
import { findEnumMismatches } from "./checkSchema";
import { config } from "./config";

async function start() {
  try {
    const problems = await findEnumMismatches();
    if (problems.length > 0) {
      console.error("Database schema does not match src/constants.ts:");
      for (const p of problems) console.error(`  - ${p}`);
      console.error("Update db/schema.sql, server/src/constants.ts and client/src/types.ts together.");
      process.exit(1);
    }
  } catch (err) {
    // DB not reachable yet: start anyway, requests will report the error.
    console.warn(`Skipped database schema check: ${(err as Error).message}`);
  }

  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

void start();
