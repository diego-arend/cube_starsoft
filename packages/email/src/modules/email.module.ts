import { Module, DynamicModule, Global } from "@nestjs/common";
import type { Env } from "@turborepo/config";
import { EmailService } from "../email.service";

@Global()
@Module({})
export class EmailModule {
  static forRoot(cfg: Env): DynamicModule {
    const provider = {
      provide: EmailService,
      useFactory: () => {
        const svc = new EmailService(undefined, cfg);
        return svc;
      },
    };
    return {
      module: EmailModule,
      providers: [provider],
      exports: [provider],
    };
  }
}
