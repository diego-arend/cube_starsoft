import { Module } from "@nestjs/common";
import { DatabaseModule } from "@turborepo/database";
import { DocumentEntity, DocumentEmbeddingEntity } from "@turborepo/database";
import { DocumentService } from "./document.service";
import { VectorizationService } from "./vectorization.service";
import { EmbeddingsService } from "./embeddings.service";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { DocumentController } from "./document.controller";
import {
  BucketModule,
  EMBEDDINGS_BUCKET_CLIENT,
  S3Adapter,
  BucketService,
  type IBucketAdapter,
} from "@turborepo/bucket";
import { typedEnv } from "../env";
import { KNOWLEDGE_BASE_BUCKET_SERVICE } from "./constants";

@Module({
  imports: [
    DatabaseModule.forFeature([DocumentEntity, DocumentEmbeddingEntity]),
    BucketModule.forRoot(typedEnv),
  ],
  providers: [
    DocumentService,
    VectorizationService,
    EmbeddingsService,
    KnowledgeBaseService,
    {
      provide: EMBEDDINGS_BUCKET_CLIENT,
      useFactory: (): IBucketAdapter => {
        return new S3Adapter({
          endpoint: typedEnv.S3_ENDPOINT,
          forcePathStyle: typedEnv.S3_FORCE_PATH_STYLE,
          region: typedEnv.S3_REGION,
          accessKeyId: typedEnv.S3_ACCESS_KEY_ID,
          secretAccessKey: typedEnv.S3_SECRET_ACCESS_KEY,
          bucket: typedEnv.LLM_EMBEDDINGS_S3_BUCKET,
        });
      },
    },
    {
      provide: KNOWLEDGE_BASE_BUCKET_SERVICE,
      useFactory: (client: IBucketAdapter) => {
        return new BucketService(client, typedEnv);
      },
      inject: [EMBEDDINGS_BUCKET_CLIENT],
    },
  ],
  controllers: [DocumentController],
  exports: [
    DocumentService,
    VectorizationService,
    KnowledgeBaseService,
    KNOWLEDGE_BASE_BUCKET_SERVICE,
  ],
})
export class DocumentModule {}
