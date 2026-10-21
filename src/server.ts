import { app } from "./app";
import { assertProductionSecrets, env } from "./config/env";
import { connectDatabase } from "./config/database";

async function start(): Promise<void> {
  assertProductionSecrets();
  await connectDatabase();
  app.listen(env.PORT, () => console.log(`LittleJoy API listening on port ${env.PORT}`));
}

void start().catch((error: unknown) => {
  console.error("Unable to start LittleJoy API", error);
  process.exitCode = 1;
});
