import {
  Module,
  DynamicModule,
  Provider,
  Logger,
  Global,
} from "@nestjs/common";
import type { Env } from "@turborepo/config";
import { BUCKET_CLIENT } from "../types";
import type { IBucketAdapter } from "../types";
import { S3Adapter } from "../adapters/s3.adapter";
import { BucketService } from "../bucket.service";

@Global()
@Module({})
export class BucketModule {
  private static _initialized = false;

  static forRoot(env: Env): DynamicModule {
    if (this._initialized) {
      return {
        module: BucketModule,
      };
    }
    this._initialized = true;

    const providers: Provider[] = [];

    // choose adapter based on env: prefer S3 client configured for prod or MinIO
    const clientProvider: Provider = {
      provide: BUCKET_CLIENT,
      useFactory: (): IBucketAdapter => {
        const endpoint = (env as any).S3_ENDPOINT;
        const logger = new Logger(BucketModule.name);
        if (endpoint) {
          // Using typed env to configure adapter (no debug prints)

          let adapter: S3Adapter;
          try {
            // constructing S3Adapter with typed environment

            adapter = new S3Adapter({
              endpoint,
              forcePathStyle: Boolean((env as any).S3_FORCE_PATH_STYLE),
              region: (env as any).S3_REGION,
              accessKeyId: (env as any).S3_ACCESS_KEY_ID,
              secretAccessKey: (env as any).S3_SECRET_ACCESS_KEY,
              bucket: (env as any).S3_BUCKET,
            });
          } catch (ctorErr: any) {
            logger.warn("Failed constructing S3Adapter");
            throw ctorErr;
          }
          return adapter;
        }
        // production: use default AWS configuration and only validate access
        let adapter: S3Adapter;
        try {
          // constructing S3Adapter (production) with typed environment

          adapter = new S3Adapter({
            region: (env as any).S3_REGION,
            accessKeyId: (env as any).S3_ACCESS_KEY_ID,
            secretAccessKey: (env as any).S3_SECRET_ACCESS_KEY,
            bucket: (env as any).S3_BUCKET,
          });
        } catch (ctorErr: any) {
          logger.warn("Failed constructing S3Adapter (prod)");
          throw ctorErr;
        }
        return adapter;
      },
    };

    providers.push(clientProvider);
    providers.push({
      provide: BucketService,
      useFactory: (client: IBucketAdapter) => new BucketService(client, env),
      inject: [BUCKET_CLIENT],
    });

    return {
      module: BucketModule,
      providers,
      exports: [BucketService, BUCKET_CLIENT],
    };
  }
}
