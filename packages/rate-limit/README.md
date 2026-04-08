# @turborepo/rate-limit

Este pacote centraliza a lógica de rate limiting para as aplicações Fastify/NestJS do monorepo, expondo as funcionalidades `registerRateLimit` e `RateLimitModule`.

Ele utiliza internamente o `@fastify/rate-limit` combinado com o nosso `RateLimitStoreAdapter` do pacote `@turborepo/redis`.

## Funcionamento e Observabilidade

Ao monitorar requisições através de logs ou spans (OpenTelemetry), você observará operações como `INCR` e `PEXPIRE` seguidas no Redis. Este comportamento é esperado e faz parte do design do sistema:

1. **Janela Móvel:** O sistema utiliza uma janela de tempo (ex: 60 segundos) para monitorar tentativas.
2. **Design de "Contagem e Expiração":**
   - **`INCR`:** Registra a tentativa atual.
   - **`PEXPIRE`:** Define o TTL (Time to Live) da chave apenas na primeira tentativa da janela (`count === 1`). Isso garante que o contador expire automaticamente no Redis após o período configurado, evitando bloqueios permanentes e acúmulo de chaves órfãs.
3. **Fase de Execução (Guards):** O rate limit de login ocorre em um `Guard`, sendo executado **antes** da validação de senha. Portanto, o contador é incrementado no momento da tentativa de acesso, independentemente de o login ser bem-sucedido ou não posteriormente.

## Uso

- Importe `registerRateLimit` em suas aplicações e passe a instância do Nest Fastify app para registrar o rate limit baseado em IP.
- Utilize o `LoginRateLimitGuard` para proteções específicas de brute-force (por e-mail ou IP restrito).
- Opcionalmente, o sistema utiliza o Redis via `@turborepo/redis` se configurado, ou faz fallback automático para armazenamento em memória.
