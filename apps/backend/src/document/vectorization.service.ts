import { Injectable, Logger, Inject } from "@nestjs/common";
import { DOCUMENT_EMBEDDING_REPOSITORY } from "@turborepo/database";
import type { IDocumentEmbeddingRepository } from "@turborepo/database";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { EmbeddingsService } from "./embeddings.service";
import { DocumentEntity } from "@turborepo/database";
import { BucketService } from "@turborepo/bucket";
import { KNOWLEDGE_BASE_BUCKET_SERVICE } from "./constants";
import * as pdfjs from "pdfjs-dist";

@Injectable()
export class VectorizationService {
  private readonly logger = new Logger(VectorizationService.name);

  constructor(
    @Inject(DOCUMENT_EMBEDDING_REPOSITORY)
    private readonly embeddingRepo: IDocumentEmbeddingRepository,
    private readonly embeddingsService: EmbeddingsService,
    @Inject(KNOWLEDGE_BASE_BUCKET_SERVICE)
    private readonly kbBucket: BucketService
  ) {}

  /**
   * Extract text from PDF using pdfjs-dist.
   * This is more robust for ESM/CJS interop than pdf-parse.
   */
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDocument = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => (item as { str: string }).str)
        .join(" ");
      fullText += pageText + "\n";
    }

    return fullText;
  }

  async vectorizeDocument(
    document: DocumentEntity,
    buffer: Buffer
  ): Promise<void> {
    this.logger.log(`Starting vectorization for document ${document.id}`);

    try {
      // 0. Clean up existing embeddings to make it idempotent
      await this.embeddingRepo.deleteByDocumentId(document.id);

      // 1. Extract text
      const text = await this.extractTextFromPdf(buffer);

      if (!text || text.trim().length === 0) {
        this.logger.warn(
          `No text could be extracted from document ${document.id}. The file may be empty, image-only, or corrupted. Skipping vectorization.`
        );
        return;
      }

      // 2. Save source document to knowledge base bucket for isolation
      const kbSourceKey = `sources/${document.id}.pdf`;
      await this.kbBucket.upload(kbSourceKey, buffer, {
        contentType: "application/pdf",
        metadata: { originalId: document.id, ownerId: document.ownerId },
      });

      // 3. Save full text extract to knowledge base bucket
      const kbTextKey = `texts/${document.id}.txt`;
      await this.kbBucket.upload(kbTextKey, text, {
        contentType: "text/plain",
      });

      // 4. Chunk text
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunks = await splitter.splitText(text);
      this.logger.log(
        `Document ${document.id} split into ${chunks.length} chunks`
      );

      // 5. Generate embeddings and save
      // We process in batches for efficiency
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await this.embeddingsService.embedDocuments(batch);

        await Promise.all(
          batch.map(async (content, index) => {
            const embedding = embeddings[index];
            if (!embedding) return;

            // Also save chunk to bucket for audit/backup if needed
            const chunkIndex = i + index;
            const chunkKey = `chunks/${document.id}/${chunkIndex}.txt`;
            await this.kbBucket.upload(chunkKey, content, {
              contentType: "text/plain",
            });

            await this.embeddingRepo.save({
              documentId: document.id,
              content: content,
              embedding: embedding,
              metadata: {
                chunkIndex: chunkIndex,
                totalChunks: chunks.length,
                storageKey: chunkKey,
              },
            });
          })
        );
      }

      this.logger.log(`Vectorization completed for document ${document.id}`);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Error vectorizing document ${document.id}: ${errorMessage}`
      );
      throw err;
    }
  }
}
