import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { AppDataSource } from "./data-source";
import type { Env } from "@turborepo/config";

@Injectable()
export class DatabaseLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseLifecycleService.name);

  constructor(private readonly cfg: Env) {}

  async onModuleDestroy(): Promise<void> {
    try {
      if (AppDataSource && AppDataSource.isInitialized) {
        await AppDataSource.destroy();
        this.logger.log("Database connection closed");
      }
    } catch (err) {
      this.logger.error(
        "Error closing database connection",
        (err as Error).message
      );
    }
  }

  onModuleInit() {
    try {
      const migrationsRun = Boolean(AppDataSource.options?.migrationsRun);
      const synchronize = Boolean(AppDataSource.options?.synchronize);
      // `installExtensions` is a Postgres-specific option not present in the
      // generic DataSourceOptions type, so use a safe cast for logging.
      const installExtensions = Boolean(
        (AppDataSource.options as any)?.installExtensions
      );
      // DATABASE_MIGRATIONS_RUN / DATABASE_SYNCHRONIZE are typed as string
      // (z.string().optional()), so Boolean("false") would be truthy — use
      // strict equality against "true" to avoid false positives.
      const attemptedMigrationsRun =
        this.cfg.DATABASE_MIGRATIONS_RUN === "true";
      const attemptedSynchronize = this.cfg.DATABASE_SYNCHRONIZE === "true";
      this.logger.log(
        `database startup settings: migrationsRun=${migrationsRun}, synchronize=${synchronize}, installExtensions=${installExtensions}`
      );
      // If running in production, log a warning if either flag is true; the module
      // should already force them false, but this warns about misconfiguration.
      if (attemptedMigrationsRun || attemptedSynchronize) {
        this.logger.warn(
          `DATABASE_MIGRATIONS_RUN=${attemptedMigrationsRun} and DATABASE_SYNCHRONIZE=${attemptedSynchronize} were configured, but automatic schema changes at startup are disabled by runtime policy. Use the turbine migration commands to apply schema changes.`
        );
      }
      if (
        process.env.NODE_ENV === "production" &&
        (migrationsRun || synchronize)
      ) {
        this.logger.warn(
          "Production environment detected — but database startup is configured to modify schema. These options are ignored in production for safety."
        );
      }
    } catch {
      // ignore logging errors
    }
  }
}
