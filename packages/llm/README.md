# @turborepo/llm

Este pacote fornece uma camada de abstração para diferentes provedores de IA (OpenAI, etc.), unificando a interface para chamadas Multimodais, Speech-to-Text (STT), Text-to-Speech (TTS) e Embeddings.

É construído sobre o ecossistema **LangChain**, facilitando a integração com componentes de fluxo como o LangGraph.

## Estrutura do Pacote

- `src/multimodal`: Adaptadores para modelos de chat e visão.
- `src/stt`: Adaptadores para transcrição de áudio.
- `src/tts`: Adaptadores para síntese de voz.
- `src/embeddings`: Utilitários para geração de vetores.
- `src/schema.ts`: Definição de schemas Zod para todas as configurações.

## Instalação

```bash
pnpm install @turborepo/llm
```

## Uso

### Multimodal (Chat)

```typescript
import { createMultimodalAdapter } from "@turborepo/llm";

const adapter = createMultimodalAdapter({
  provider: "openai",
  apiKey: "sua-chave",
  modelName: "gpt-4o",
  temperature: 0.7,
});

const response = await adapter.invoke("Olá, como você pode me ajudar?");
```

### Speech-to-Text (STT)

```typescript
import { createSTTAdapter } from "@turborepo/llm";

const stt = createSTTAdapter({
  provider: "openai",
  apiKey: "sua-chave",
  model: "whisper-1",
});

const result = await stt.transcribe(audioBuffer, { language: "pt" });
console.log(result.text);
```

### Text-to-Speech (TTS)

```typescript
import { createTTSAdapter } from "@turborepo/llm";

const tts = createTTSAdapter({
  provider: "openai",
  apiKey: "sua-chave",
  model: "tts-1",
});

const audio = await tts.synthesize("Olá mundo", { voice: "alloy" });
```

### Embeddings

```typescript
import { createEmbeddingsAdapter } from "@turborepo/llm";

const embeddings = createEmbeddingsAdapter({
  provider: "openai",
  apiKey: "sua-chave",
  model: "text-embedding-3-small",
});

const vector = await embeddings.embedQuery("texto para vetorizar");
```

## Configuração

O pacote utiliza **Zod** para validar as configurações em runtime. As principais variáveis incluem:

| Campo       | Descrição                                                       |
| :---------- | :-------------------------------------------------------------- |
| `provider`  | O provedor de IA (ex: `openai`).                                |
| `apiKey`    | Chave de API do provedor.                                       |
| `baseUrl`   | (Opcional) URL base customizada para proxies ou modelos locais. |
| `modelName` | Nome do modelo específico para multimodal.                      |
| `model`     | Nome do modelo específico para STT/TTS.                         |

## Boas Práticas

- **Fail-fast**: O pacote valida as configurações no momento da criação do adaptador (`createAdapter`).
- **Logs**: Utiliza o pacote `@turborepo/logging` para telemetria e debug das chamadas de IA.
- **Tipagem**: Todos os retornos e entradas são tipados para garantir previsibilidade no monorepo.

## Telemetria (OpenTelemetry / GenAI)

Todos os adaptadores instrumentam automaticamente as chamadas à API seguindo a **OTel GenAI Semantic Conventions v1.40** via `@turborepo/observability`. Não é necessário nenhum código extra no consumidor.

### O que é gerado por adapter

| Adapter | Nome do span | Token usage |
|---|---|---|
| `createEmbeddingsAdapter` (openai) | `embeddings {model}` | ✅ `prompt_tokens` → `gen_ai.usage.input_tokens` |
| `createMultimodalAdapter` (openai) | `chat {modelName}` | ✅ `input_tokens` + `output_tokens` via `usage_metadata` |
| `createSTTAdapter` (openai) | `stt {model}` | — |
| `createSTTAdapter` (whisper-local) | `stt {model}` | — |
| `createTTSAdapter` (openai) | `tts {model}` | — |
| `createTTSAdapter` (qwen3-tts) | `tts {model}` | — |

### Atributos no span

Cada span inclui obrigatoriamente:

| Atributo | Exemplo |
|---|---|
| `gen_ai.operation.name` | `embeddings` / `chat` / `stt` / `tts` |
| `gen_ai.provider.name` | `openai`, `whisper-local`, `qwen3-tts` |
| `gen_ai.request.model` | `text-embedding-3-small` |
| `server.address` | `api.openai.com` |
| `server.port` | `443` |

Quando a resposta inclui metadados do modelo e tokens, são adicionados atributos extras:

| Atributo | Adapter |
|---|---|
| `gen_ai.response.model` | embeddings, chat |
| `gen_ai.usage.input_tokens` | embeddings, chat |
| `gen_ai.usage.output_tokens` | chat |
| `gen_ai.embeddings.dimension.count` | embeddings |
| `gen_ai.request.temperature` | chat |
| `error.type` | todos (em caso de exceção) |

### Métricas emitidas

| Métrica | Tipo | Quando |
|---|---|---|
| `gen_ai.client.operation.duration` | Histogram (`s`) | A cada chamada, automaticamente |
| `gen_ai.client.token.usage` | Histogram (`{token}`) | Quando a resposta inclui `usage` |

### Visualização no Grafana

O **Grafana Dashboard ID 22028 (LLM Observability)** consome as métricas `gen_ai.*` e os spans gerados acima. Para ativá-lo é necessário configurar as dimensões `gen_ai.*` no conector `spanmetrics` do OTel Collector — ver instruções em `packages/observability/README.md`.

---

Mantido pela equipe de engenharia.
