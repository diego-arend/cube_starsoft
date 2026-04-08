# @turborepo/logging

## Objetivo

Utilitários de logging centralizados para o monorepo. Construído sobre o `pino`, este pacote fornece formatação de log consistente, integração de correlação de traces (OpenTelemetry) e pequenos adaptadores para NestJS, middleware de servidor Next e ambientes compatíveis com edge.

## Principais exportações

- `createLogger(opts)` — configura uma instância do logger `pino` com metadados de trace OTEL opcionais e transporte (pretty vs json).
- `NestPinoLogger` & `LoggingModule` — uma implementação de logger para NestJS e um módulo `forRoot()` para registrar o logger em aplicativos NestJS no lado do servidor.
- `edgeSafeLogger()` — logger minimalista baseado em console utilizável em ambientes edge onde o `pino` ou similar não está disponível.
- Tipos e auxiliares de configuração — tipos usados pela biblioteca (LoggerOptions, NestLoggerOptions, NextLoggerOptions).

## Como as aplicações usam este pacote

- Aplicações NestJS: importe o `LoggingModule` (ou `NestPinoLogger`) para registrar o provedor globalmente e usar instâncias de logger injetadas por dependência em controladores e serviços.
- Páginas/API do lado do servidor Next: anexe o logger de nível de requisição importando de `src/lib/logger.ts` (isomórfico).
- Runtime Edge / serverless: use o `edgeSafeLogger()` como um logger pequeno e compatível quando o `pino` não estiver disponível ou ao operar em ambientes edge estritos.
- Traces e exportadores: A correlação é automática; o logger anexa IDs de trace às mensagens registradas quando um span OTEL estiver ativo no contexto. Para configurar o SDK OTEL, utilize `@turborepo/observability`.

## Como integrar a aplicação ao sistema de LOGs estruturados

Para garantir que os logs sejam corretamente indexados e correlacionados com traces no sistema de observabilidade (ex: Loki/Tempo), siga estas diretrizes:

1. **Defina o Nome do Serviço**: Cada aplicação deve ter um identificador único. Isso é feito definindo a variável `OTEL_SERVICE_NAME` no arquivo de configuração (`config.yaml`) ou passando a opção `serviceName` ao criar o logger.
2. **Padrão de Nomeação**:
   - Backend API: `backend-api`
   - Frontend Server: `frontend-web`
   - Workers: `worker-notification`, etc.
3. **Instrumentação**: No arquivo `instrumentation.ts` da sua aplicação, certifique-se de inicializar a observabilidade passando o nome do serviço:
   ```ts
   initObservability({ ...cfg, OTEL_SERVICE_NAME: "nome-do-seu-servico" });
   ```
4. **Instanciação do Logger**: Ao usar `createLogger`, sempre forneça o `serviceName`:
   ```ts
   const logger = createLogger({ serviceName: "nome-do-seu-servico" });
   ```
5. **Correlação**: O sistema injeta automaticamente `trace_id` e `span_id` permitindo que você encontre todos os logs de uma mesma transação no Grafana através da correlação de logs e traces.

## Configuração e ambiente

- O logger aceita opções como `level`, `pretty` (saída amigável para humanos vs JSON), `serviceName` e configuração de exportador; estes devem ser fornecidos através do pacote de configuração centralizada (`@turborepo/config`) em tempo de execução.
- Chaves de ambiente sugeridas para adicionar ao schema de configuração incluem: `LOG_LEVEL`, `LOG_FORMAT`, `LOG_EXPORTER_ENABLED`, `LOG_EXPORTER_TYPE`, `LOG_COLLECTOR_ENDPOINT`, `LOG_COLLECTOR_HEADERS`, `OTEL_ENABLED`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_EXPORTER_OTLP_HEADERS`.

## Notas de comportamento

- **Redação de Dados**: O logger está configurado para redigir automaticamente informações sensíveis. Campos como `password`, `token`, `accessToken`, `refreshToken`, `secret`, `authorization` e `cookie` são mascarados com `[REDACTED]` nos logs. Isso se aplica a objetos planos e aninhados (ex: `*.password`).
- **Correlação de Traces**: A função `createLogger` mistura IDs de trace e span do contexto ativo do OpenTelemetry quando presentes, permitindo a correlação de log para trace.
- **Integração NestJS**: O logger NestJS traduz chamadas de API de log de ciclo de vida do Nest (log, warn, error, debug, verbose) em chamadas de log do pino com metadados contextuais. Erros são anexados como payloads `err` nos logs quando aplicável.
- **Middleware NextJS**: O middleware NextJS anexa um logger por requisição que os consumidores podem usar durante a renderização no lado do servidor e manipuladores de API.

## Contrato de Dados (v1.0) - Observabilidade

Para garantir que os dashboards no Grafana/Loki funcionem sem quebras após refatorações, este pacote força um contrato de dados via **Zod** para logs de requisição HTTP.

Qualquer log que contenha atributos de requisição deve seguir a especificação abaixo:

| Campo              | Tipo     | Descrição                                              |
| :----------------- | :------- | :----------------------------------------------------- |
| `http.method`      | `string` | **Obrigatório**. Método HTTP (GET, POST, etc)          |
| `http.url`         | `string` | **Obrigatório**. Path ou URL completa                  |
| `http.status_code` | `number` | **Obrigatório**. Código de status HTTP (200, 404, etc) |
| `http.route`       | `string` | Template da rota (ex: `/users/:id`)                    |
| `http.user_agent`  | `string` | User Agent do cliente                                  |
| `http.client_ip`   | `string` | IP do originário                                       |
| `msg`              | `string` | **Obrigatório**. Mensagem descritiva do log            |
| `duration`         | `string` | Tempo de execução (ex: "45ms")                         |

**Como usar:**
O `NestPinoLogger` valida automaticamente esses campos se detectar um deles. Se algum campo obrigatório estiver faltando ou for do tipo errado, o log falhará na validação e emitirá um aviso em desenvolvimento, garantindo a integridade dos dados em produção.

- **Segurança Edge**: O logger seguro para edge implementa uma API minimalista compatível com pino usando funções de `console` para ambientes edge.

## Mantenedores e restrições

- O pacote expõe uma pequena superfície destinada ao uso por runtimes de servidor backend e frontend no monorepo. Não é uma plataforma de logging de propósito geral; customizações avançadas devem ser implementadas pela aplicação consumidora ou por um wrapper interno.
- Mantenha o `serviceName` estável para consumidores de telemetria; mudar o nome pode impactar dashboards e agregação de traces.
- Este pacote depende do `pino` e dos SDKs do OpenTelemetry; garanta versões consistentes em todo o monorepo para evitar comportamento conflitante em tempo de execução.

## Teste e desenvolvimento

- Testes unitários estão presentes e são executados com `vitest`. Execute os testes do pacote através do comando do workspace para este pacote.

# @turborepo/logging

Pacote de logging central para o monorepo. Construído sobre pino + pino-opentelemetry para fornecer correlação de traces relacionada a OTEL e auxiliares por stack.

## Uso

### Node/NestJS

```ts
import { NestPinoLogger } from "@turborepo/logging";
import { createLogger } from "@turborepo/logging";

const logger = createLogger({ level: "info", serviceName: "backend" });
app.useLogger(new NestPinoLogger());
```

### Next.js (Servidor & Isomorfismo)

Este pacote é otimizado para o Next.js 15. Recomendamos o seguinte padrão de uso em `lib/logger.ts` da aplicação frontend:

```ts
// Detecta automaticamente se está no servidor ou browser
// No servidor, usa pino + OTEL. No browser, console.log.
import { createLogger } from "@turborepo/logging";
const logger =
  typeof window === "undefined"
    ? createLogger({ serviceName: "frontend" })
    : console;
```

**Integração com SDK Nativo (OTEL):**
O `createLogger` utiliza o mixin nativo para extrair `trace_id` e `span_id` do contexto ativo do OpenTelemetry. Se você estiver usando o `@vercel/otel` (via `instrumentation.ts`), os logs gerados por este pacote serão automaticamente correlacionados com os traces capturados pelo Next.js.

### Edge (fallback)

Utilize o `edgeSafeLogger()` em middlewares do Next.js ou funções Edge onde o runtime é limitado e o `pino` não pode ser carregado completamente.

---

### OpenTelemetry (Node.js nativo)

Para aplicações puramente Node.js (como Backends NestJS), utilize o pacote `@turborepo/observability` para inicializar o SDK. O pacote de logging se integrará automaticamente assim que o SDK estiver ativo.

## Arquitetura de Telemetria Unificada

Adotamos a estratégia de **Hybrid OTLP Observatory** (Logs, Traces e Métricas via rede) para garantir paridade total entre ambientes de desenvolvimento e produção:

1. **Telemetria via Rede (SDK OpenTelemetry)**:
   - **Logs, Traces e Métricas** são enviados **diretamente** pela aplicação via rede (OTLP/gRPC ou HTTP) para o OTel Collector.
   - O SDK captura automaticamente os logs do `pino` e os correlaciona com os traces ativos, despachando-os para o coletor (local ou produção).
   - Isso permite que desenvolvedores usem a mesma stack de observabilidade (Grafana/Loki/Tempo) localmente para debug.

2. **Saída em Tempo Real (STDOUT)**:
   - Além do envio via rede, os logs continuam sendo emitidos no `STDOUT`.
   - Em desenvolvimento, o pipe `| pino-pretty` permite que o desenvolvedor leia os logs formatados no terminal enquanto os dados brutos fluem para o servidor de observabilidade.
   - Em produção (Docker/Fargate), o `STDOUT` serve como fallback seguro de infraestrutura capturado pelo host.

3. **Vantagem do Modelo**:
   - **Paridade de Debug**: Se você consegue ver o trace/log no Grafana local, ele funcionará identicamente em produção.
   - **Contrato de Dados**: O contrato via Zod garante que, mesmo enviando via SDK, o formato dos logs respeite o esquema v1.0, evitando dashboards quebrados.

---

Chaves de env sugeridas (adicione ao @repo/config):

- LOG_LEVEL
- LOG_FORMAT
- LOG_EXPORTER_ENABLED
- LOG_EXPORTER_TYPE
- LOG_COLLECTOR_ENDPOINT
- LOG_COLLECTOR_HEADERS
- OTEL_ENABLED
- OTEL_SERVICE_NAME
- OTEL_EXPORTER_OTLP_ENDPOINT
- OTEL_EXPORTER_OTLP_HEADERS

## Contrato de Dados de Observabilidade (v1.0)

Para garantir a compatibilidade com os dashboards de monitoramento e alertas (Grafana/Loki), o pacote forca um contrato de dados via **Zod**.

### Log de Resposta HTTP Tipado

O logger estendido possui o método `httpResponse`, que valida os dados em runtime:

```typescript
logger.httpResponse({
  "http.method": "GET",
  "http.url": "/api/health",
  "http.status_code": 200,
  msg: "Request completed",
});
```

### Validação Automática no NestJS

O `NestPinoLogger` intercepta automaticamente objetos passados para `logger.log()` ou `logger.error()`. Se o objeto contiver chaves como `http.method` ou `http.url`, ele validará contra o schema do contrato v1.0.
