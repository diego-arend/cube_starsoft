import { AppDataSource } from "../data-source";

async function run() {
  await AppDataSource.initialize();
  console.log("Running migrations...");
  await AppDataSource.runMigrations();
  console.log("Migrations complete.");
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
