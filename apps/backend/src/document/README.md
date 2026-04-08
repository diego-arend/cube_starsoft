Módulo Document — Resumo de funcionamento

Breve descrição

- Gerencia upload, download e remoção de documentos PDF.

Comportamento das rotas principais

- POST /documents/upload
  - Aceita multipart/form-data (campo binário `file`) ou JSON com base64.
  - Valida magic bytes do PDF (começa com `%PDF-`) e tamanho máximo (5 MB por padrão).
  - O proprietário (`ownerId`) é derivado do token JWT do usuário autenticado e **não** deve ser fornecido pelo cliente.
  - Retorna metadados do documento (`UploadResponse` / `DocumentResponse`).

- GET /documents/:id/download
  - Retorna o conteúdo binário do PDF com `content-type: application/pdf` e `content-disposition: attachment`.
  - Retorna 404 se o documento não existir.

- DELETE /documents/:id
  - Remove o documento apenas se o usuário autenticado for o proprietário.
  - Retorna `{ success: true }` quando a remoção for bem-sucedida.

Observações operacionais

- Armazenamento: usa S3/MinIO via `packages/bucket`.
- Validação: checks online (HeadObject) e uma amostra dos primeiros bytes para garantir o formato PDF; não há varredura antivírus síncrona.
- Segurança: propriedade do documento é sempre validada contra o JWT; operações não autorizadas retornam 401/400 conforme apropriado.
- **Cache**: A listagem de documentos por usuário (`GET /documents/list_by_user/:userId`) é cacheada no Redis por 60 segundos. A chave de cache considera paginação e filtros (`q`, `sort`, `order`). Uploads e remoções invalidam o cache da lista do usuário proprietário (`documents:list_by_user/${userId}*`).

Notas de documentação

- Os schemas OpenAPI desse módulo expõem `DocumentResponse`, `UploadResponse` e `DeleteResponse` com exemplos para uso no Swagger UI.

Para desenvolvedores

- Para testes locais, consulte os testes unitários do módulo em `apps/backend/src/document/test/unit`.
- Para integração com MinIO, veja o `docker-compose.yml` na raiz (serviço `minio`).
