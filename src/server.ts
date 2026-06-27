import { app } from "./app";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";
import { startWorkers } from "./workers";

async function bootstrap() {
  await startWorkers();
  app.listen(env.PORT, function () {
    console.log("Server listening on http://localhost:" + env.PORT);
  });
}

bootstrap().catch(async function (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
