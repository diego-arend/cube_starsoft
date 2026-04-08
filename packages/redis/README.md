# @turborepo/redis

## Objetivo

Integração centralizada do Redis para o monorepo. Fornece um `RedisService` amigável para Injeção de Dependências (DI), um serviço de fallback em memória, um adaptador de armazenamento de rate-limit tipado e um construtor de adaptador compatível com Fastify para uso com plugins de limitação de taxa.

## O que ele oferece

- `RedisModule` — um módulo global do NestJS para registrar o `RedisService` e o `FallbackService`.
- `RedisService` — gerencia o ciclo de vida de um cliente ioredis, expõe auxiliares de cache (`get`, `set`, `del`, `flushAll`, `invalidate`, `sAdd`, `sRem`, `sMembers`, `rPush`, `lRange`, `lTrim`) e fornece uma factory `getRateLimitStore()` para plugins de rate limiter.
- `FallbackService` — armazenamento de chave/valor em memória leve, utilizado quando o Redis está indisponível ou o fallback está explicitamente ativado.
- `RateLimitStoreAdapter` — um adaptador que implementa `incr`, `pttl`, `pexpire` e `del` usados por rate-limiters; suporta duas estratégias de failover (`in-memory`, `passthrough`).
- `createFastifyRateLimitStoreCtor(adapter)` — factory que cria um construtor compatível com o plugin `@fastify/rate-limit` em tempo de execução.

## Como outras aplicações utilizam este pacote

- Apps NestJS no Backend: importe `RedisModule.forRoot()` no `AppModule` para habilitar a integração de cache e rate limiting via DI.
  - NOTA: Espera-se que o `RedisModule.forRoot()` seja chamado apenas uma vez na raiz da aplicação (ex: `AppModule`). O módulo é global e fornecê-lo novamente em um módulo de funcionalidade pode criar múltiplas instâncias de provedores e conexões duplicadas ao Redis, levando a comportamentos inesperados.
- Para configurar plugins de rate-limiting, obtenha um store usando `RedisService.getRateLimitStore()` e adapte-o para o plugin usando `createFastifyRateLimitStoreCtor()` quando necessário.
- Para casos de uso de cache, injete o `RedisService` para chamar auxiliares como `get`, `set`, `del`, `invalidate`, `flushAll`, ou operações de lista como `rPush`, `lRange` e `lTrim`.
- As aplicações devem geralmente usar os auxiliares do `RedisService` para preservar as semânticas de ciclo de vida e failover. No entanto, o `RedisService.getInternalClient()` está disponível para adaptadores de baixo nível que precisam de acesso direto ao `ioredis` enquanto ele estiver saudável.

## Failover e Resiliência

- Quando o Redis está indisponível (ou se `REDIS_ENABLED=false`), o `RedisService` alterna para um modo de fallback usando o `FallbackService` e emite logs sobre a ativação do fallback.
- O serviço Redis implementa uma estratégia de reconexão: ele tenta a reconexão após um tempo de reset configurável (`REDIS_RESET_TIMEOUT_MS`) e reativa o armazenamento baseado em Redis quando bem-sucedido.
- O adaptador de rate-limit `RateLimitStoreAdapter` suporta estes modos de fallback:
  - `in-memory` (padrão) — conta as requisições localmente na memória com uma janela de TTL.
  - `passthrough` — estratégia de "fail-open": o adaptador não conta/limita as requisições enquanto o Redis estiver indisponível.

## Configuração e Ambiente

- Este pacote lê a configuração de `@turborepo/config` (configuração centralizada e tipada). As chaves relevantes incluem:
  - `REDIS_ENABLED` — se deve habilitar o cliente Redis (padrão: true/false dependendo do ambiente)
  - `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — configurações de conexão
  - `REDIS_FALLBACK_ENABLED` — se deve permitir o fallback para o armazenamento em memória
  - `REDIS_FAILURE_THRESHOLD` — número de erros consecutivos antes de ativar o fallback
  - `REDIS_RESET_TIMEOUT_MS` — milissegundos após os quais as tentativas de reconexão são feitas

## Detalhes de Integração do Rate Limiter

- Use `RedisService.getRateLimitStore(windowMs, strategy, logger)` para obter uma instância de `RateLimitStoreAdapter` para uso em plugins. Isso mantém as preocupações de ciclo de vida no `RedisService` e permite que os adaptadores usem o cliente Redis apenas quando disponível.
- Para registrar um store com `@fastify/rate-limit`, adapte-o usando `createFastifyRateLimitStoreCtor(adapter)` — a factory retorna um construtor de store compatível em tempo de execução.
- Prefira o fallback em memória por padrão para uma contagem de tokens mais segura; use `passthrough` apenas quando desejar falhar de forma aberta.

## Notas Operacionais

- Tarefas de migração e esquema não fazem parte deste pacote — este pacote foca apenas no comportamento de cache e store de rate-limit.
- O pacote inclui testes unitários para o comportamento de fallback e do adaptador; garanta que o CI execute esses testes e valide quaisquer mudanças de configuração.

## Manutenção e Restrições

- O pacote minimiza o vazamento do cliente ioredis bruto pelo workspace, mas expõe o `getInternalClient()` como uma válvula de escape para adaptadores internos.
- **Atualização Arquitetural**: Expus o cliente interno do Redis para permitir que adaptadores (como o de Rate Limit) o utilizem diretamente, removendo dependências circulares e melhorando a separação de responsabilidades.
- Mantenha as chaves de esquema estáveis em `@turborepo/config` e garanta que os consumidores usem a configuração tipada em vez de variáveis de ambiente brutas.
- Se uma aplicação exigir configuração ou comportamento especializado do Redis não fornecido aqui, prefira gerenciar um cliente Redis separado e específico da aplicação e registrá-lo de forma privada, em vez de modificar a API deste pacote.
