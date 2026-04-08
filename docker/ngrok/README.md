# Ambiente de Simulação com Ngrok e Traefik 🌐

Este diretório contém a infraestrutura necessária para rodar o ambiente completo da plataforma de forma simulada, utilizando **Ngrok** para exposição externa e **Traefik** como o cérebro do roteamento.

## Propósito do Ambiente 🎯

Diferente do ambiente local padrão, este setup simula condições reais de produção:
1.  **Acesso Externo Seguro**: O site fica disponível em um domínio HTTPS público (`*.ngrok-free.app`) com **Basic Auth** forçado.
2.  **Infraestrutura Agnóstica**: O roteamento entre Frontend e Backend é feito inteiramente pelo **Traefik**, sem depender de `rewrites` internos das aplicações. Isso permite que a mesma aplicação rode em qualquer Cloud (AWS, GCP, Azure) ou Docker Swarm sem alterações.
3.  **Cross-Origin Isolation**: Como o Frontend e o Backend compartilham o mesmo domínio público via Traefik, problemas de CORS e cookies de sessão (`SameSite`) são mitigados da mesma forma que em produção.

## Mecanismos de Roteamento (Traefik) ⚖️

O Traefik atua como o único Gateway de entrada no endereço `http://localhost:8081`. Ele utiliza regras de prioridade baseadas no caminho (`PathPrefix`) para distribuir o tráfego:

-   **Priority 200 (`/api/auth`)**: Encaminha para o **Frontend (Next.js)** para processar autenticação via NextAuth.
-   **Priority 200 (`/api/otel`)**: Encaminha para o **Frontend (Next.js)** para ingestão de telemetria.
-   **Priority 200 (`/socket.io`)**: Encaminha para o **Backend (NestJS)** para conexões WebSocket.
-   **Priority 100 (`/api`)**: Encaminha para o **Backend (NestJS)** aplicando o middleware `strip-api` (remove o prefixo `/api` antes de enviar ao backend).
-   **Priority 1 (`/`)**: Encaminha tudo o que sobrar para o **Frontend (Next.js)** (Páginas e arquivos estáticos).

## Comandos de Execução

### 1. Configurar Credenciais
Certifique-se de que o arquivo `docker/ngrok/.env.ngrok` existe com:
```env
NGROK_AUTHTOKEN=seu_token_aqui
NGROK_BASIC_AUTH=usuario:senha
NGROK_DOMAIN=seu-dominio.ngrok-free.app
```

### 2. Subir o Ambiente
```bash
# Na raiz do projeto
pnpm run docker:up:ngrok
```

### 3. Encerrar o Ambiente
```bash
# Na raiz do projeto
pnpm run docker:down:ngrok
```

## Estrutura do Ambiente

-   **Ngrok Entrypoint**: O ponto de entrada público HTTPS.
-   **Traefik Dashboard**: http://localhost:8080 (Para visualizar as rotas e serviços ativos).
-   **Traefik Gateway**: http://localhost:8081 (Internal entrypoint).
-   **Backend**: Escalonado por padrão para 2 réplicas (Docker Compose).
-   **Worker**: Escalonado por padrão para 2 réplicas para processamento de background.
