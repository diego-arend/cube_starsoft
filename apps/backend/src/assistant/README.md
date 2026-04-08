# Módulo Assistant

Este módulo implementa o assistente inteligente do sistema, utilizando **LangGraph** para orquestração de fluxos de IA, **LangChain** para integração com modelos de linguagem (LLMs), e tecnologias de áudio para interação por voz.

O assistente foi projetado para atuar como um guia especializado na documentação do sistema, utilizando **RAG (Retrieval-Augmented Generation)** para fornecer respostas precisas com base em uma base de conhecimento privada.

## Arquitetura do Fluxo (LangGraph)

O fluxo de conversação é definido em `langgraph.flow.ts` e segue os seguintes passos:

1.  **`input_processor`**: Recebe a entrada do usuário (texto ou áudio). Se for áudio, realiza a transcrição (STT). Persiste a mensagem do usuário no banco de dados.
2.  **`retriever`**: Busca contextos relevantes no banco de vetores (Knowledge Base) com base na consulta do usuário.
3.  **`agent`**: Invoca o modelo de linguagem (LLM) enviando o histórico da conversa, o contexto recuperado e as diretrizes do sistema.
4.  **`tts_synthesis`**: Se configurado, converte a resposta textual do assistente em áudio (TTS). Persiste a resposta do assistente no banco de dados.

## Componentes Principais

### `AssistantService`

O coração do módulo. Gerencia a inicialização do grafo, a configuração dos adaptadores (LLM, STT, TTS) e expõe métodos para consultas síncronas (`query`) e via streaming (`streamQuery`).

### `AssistantController`

Interface REST que fornece endpoints para:

- Consulta simplificada (fallback HTTP).
- Histórico de sessões.
- Upload e transcrição de áudio.
- Servir arquivos de áudio gerados via link temporário.

### `AssistantGateway`

Interface **WebSockets (Socket.io)** para interação em tempo real, suportando:

- Streaming de respostas (parcial tokens).
- Notificações de transcrição em tempo real.
- Eventos de erro e finalização de processamento.

### `ConversationService`

Gerencia a persistência das mensagens no PostgreSQL e o armazenamento de áudios (ex: via S3).

## Configuração e Diretrizes

O comportamento do assistente é controlado através da `systemMessage` definida no `AssistantGraph`. Algumas regras críticas aplicadas:

- Respostas estritamente em Português (PT-BR).
- Foco em base de conhecimento (RAG) para perguntas técnicas.
- Padronização de respostas para saudações e conteúdos fora de escopo.
- Proteção contra _prompt injection_.

## Como Desenvolver / Testar

### Visualização do Grafo

O arquivo `studio-entry.ts` permite visualizar e testar o fluxo utilizando o **LangGraph Studio**.

### Dependências Relacionadas

- `@turborepo/llm`: Fornece os adaptadores para OpenAI/Whisper.
- `@turborepo/database`: Persistência de mensagens e histórico.

## Exemplo de Requisição (WebSocket)

O frontend deve emitir o evento `assistant.query` no namespace `assistant`:

```json
{
  "sessionId": "UUID-da-sessao",
  "messageId": "UUID-da-mensagem",
  "query": "Como altero minha senha?",
  "language": "pt"
}
```

E ouvir os eventos:

- `assistant.partial`: Chunks da resposta do assistente.
- `assistant.audio`: URL do áudio gerado.
- `assistant.transcription`: Texto detectado em caso de envio de áudio.
