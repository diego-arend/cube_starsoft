# Docker Environment Guide

Este diretório contém a orquestração e as configurações de Docker para os ambientes de desenvolvimento e produção simulada.

## 🚀 Scripts Rápidos (pnpm)

| Comando | Descrição |
| :--- | :--- |
| `pnpm run docker:up` | Sobe o ambiente de **Desenvolvimento** (Hot-reload, 1 réplica). |
| `pnpm run docker:down` | Derruba o ambiente de Desenvolvimento. |
| `pnpm run docker:up:prod` | Sobe o ambiente de **Produção** (Build otimizado, réplicas, balanceamento). |
| `pnpm run docker:down:prod` | Derruba o ambiente de Produção e limpa infra. |

---

## 💾 Banco de Dados (Produção)

Como o ambiente de produção utiliza imagens imutáveis, as operações de banco de dados devem ser executadas **dentro** de um dos containers da aplicação para garantir que as configurações de rede interna (`host: postgres`) sejam respeitadas.

### 1. Executar Migrations
```bash
docker exec -it docker-backend-1 pnpm run migrate:run
```

### 2. Executar Seeds (Usuários iniciais)
```bash
docker exec -it docker-backend-1 pnpm run seed:users
```

> **Dica:** Use `docker ps` para confirmar o nome exato do container do backend se o comando acima falhar. O sufixo `-1` refere-se à primeira réplica.

---

## 🛠️ Ambientes

### 1. Desenvolvimento (`docker-compose-dev.yml`)
Focado em produtividade e depuração.
- **Backend/Frontend/Worker:** Executam via `pnpm dev` com live-reload.
- **Ports:** Exposição direta das portas padrão (3001, 3000, 5432, 6379, 5672).
- **Volumes:** Mapeamento de código fonte para dentro do container.

### 2. Produção (`docker-compose-production.yml`)
Simula um ambiente real de alta disponibilidade.
- **Replicação:**
  - **Backend:** 2 réplicas (balanceadas pelo Traefik).
  - **Worker:** 2 réplicas (balanceamento nativo via RabbitMQ Fair Dispatch).
  - **Frontend:** 1 réplica (SSR otimizado).
- **Traefik (Gateway):**
  - **Dashboard:** `http://localhost:8080`
  - **Entrypoint:** `http://localhost:8081`
  - **Routing:** `/api/*` -> Backend | `/*` -> Frontend.
- **Isolamento:** Volumes utilizam o sufixo `_prod` (ex: `postgres_data_prod`) para evitar conflito com dados de dev.
- **Recursos:** Limites de CPU e Memória definidos via `deploy.resources`.

### 3. Teste de Carga (`docker/test-load/docker-compose-test-load.yml`)
Ambiente específico para validação de performance e escalabilidade.
- **Configuração de Rotas (Traefik):**
    - **Backend (`/api`)**: `http://localhost:8081/api` (Prefixo removido no encaminhamento).
    - **Frontend (`/web`)**: `http://localhost:8081/web` (Prefixo removido, mapeia para a raiz do Next.js).
- **Variáveis Críticas:**
    - `NEXTAUTH_URL=http://localhost:8081/web` para suportar o roteamento via prefixo.
- **Uso:** Ideal para rodar os cenários do [Artillery](../load-tests/README.md).

---

##  Acesso aos Serviços (Produção e Teste)

| Serviço | URL | Credenciais (Padrão) |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:8081](http://localhost:8081) | - |
| **Frontend (Test-Load)** | [http://localhost:8081/web](http://localhost:8081/web) | - |
| **Backend API** | [http://localhost:8081/api](http://localhost:8081/api) | - |
| **Traefik Dashboard** | [http://localhost:8080](http://localhost:8080) | - |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | `rabbitmq` / `rabbitmq` |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | `minio` / `minio123` |
| **Mailpit (Emails)** | [http://localhost:8025](http://localhost:8025) | - |
| **pgAdmin** | [http://localhost:5050](http://localhost:5050) | `admin@admin.com` / `admin` |
| **Redis Insight** | [http://localhost:5540](http://localhost:5540) | - |

---

## �🏗️ Configurações Técnicas

### Dockerfiles
- Seguimos o padrão de **Multi-stage builds** usando `turbo prune`.
- **Frontend Otimizado:** Utiliza o modo `standalone` do Next.js para reduzir drasticamente o tamanho da imagem final, copiando apenas o necessário para o runtime.
- **Base:** Node 20-slim.
- **Installer:** Instala apenas as dependências necessárias para os pacotes filtrados.
- **Builder:** Gera o build de produção (`nest build` ou `next build`).
- **Runner:** Imagem final contendo apenas os artefatos de execução, rodando com usuário não-root (`node`).

### Traefik
Configurado via `docker/traefik_dynamic.yaml`. Realiza o roteamento baseado em prefixo de Path. O Backend escuta em `0.0.0.0:3001` para permitir o recebimento de tráfego externo ao container.

### Proxy & Autenticação (NextAuth/Auth.js)
Ao executar o Next.js atrás de um Reverse Proxy (Traefik, Nginx, Cloudflare), o Auth.js (v5) exige configurações específicas para confiar nos cabeçalhos de encaminhamento:

1.  **`AUTH_TRUST_HOST=true`**: Obrigatório quando a aplicação é acessada por uma URL/porta diferente da que o container escuta internamente. Sem isso, ocorre o erro `UntrustedHost`.
2.  **`AUTH_SECRET`**: Deve ser consistente entre o build e o runtime para garantir a validação dos tokens JWT.

---

## 🔭 Observabilidade e Logs (OTEL)

A stack de observabilidade é baseada em **OpenTelemetry**, enviando Traces para o **Tempo**, Métricas para o **Prometheus** e Logs para o **Loki**.

### 1. Conectividade e Variáveis de Ambiente (Frontend Dual-Context)

O Frontend possui um comportamento dual em relação ao OpenTelemetry, exigindo endpoints diferentes para o navegador (Client-side) e para o runtime Node.js (Server-side/SSR). As variáveis são gerenciadas via `config.prod.yaml` e injetadas no `.env` do frontend.

| Variável | Contexto | Valor em Produção Simulada | Motivo |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT` | **Navegador** | `http://localhost:8081` | O navegador do usuário fala com o **Traefik**, que faz o proxy para o coletor. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | **Servidor (SSR)** | `http://otel-collector:4318` | O container do frontend fala **diretamente** com o coletor via rede interna Docker. |

#### ⚠️ Importante para CI/CD e Cloud (AWS Amplify):
1.  **Build-time:** As variáveis `NEXT_PUBLIC_*` são fixadas no código durante o build. Se o build for feito em um ambiente de CI e o endpoint mudar, a imagem precisará ser reconstruída ou as variáveis injetadas via runtime (se suportado pelo framework).
2.  **Endpoints Públicos:** Em ambientes reais como AWS Amplify, ambos os endpoints geralmente apontarão para um endereço HTTPS público (ex: `https://otel.seudominio.com`), pois o container do frontend (Lambda/Managed) e o navegador podem não compartilhar uma rede privada DNS.
3.  **CORS:** O coletor de logs ou o gateway (Traefik/Nginx) deve permitir requisições CORS vindas do domínio do frontend para as rotas `/v1/traces`, `/v1/metrics` e `/v1/logs`.
4.  **Segurança:** Variáveis sem o prefixo `NEXT_PUBLIC_` (como `OTEL_EXPORTER_OTLP_ENDPOINT` puro) **não são expostas ao navegador**, protegendo endpoints internos de rede VPC.

### 2. Identidade dos Serviços
Cada serviço define seu próprio `OTEL_SERVICE_NAME` no compose para que os logs e traces sejam agrupados corretamente:
- **Backend:** `backend-api`
- **Worker:** `worker-notification`
- **Frontend:** `frontend-app`

### 3. Configuração de Logs (Pino + OTLP)
Os logs não são apenas impressos no stdout, mas também capturados e enviados via OTLP. 
- **Ativação:** Garantida pela variável `LOG_EXPORTER_ENABLED=true` (definida no `config.yaml` ou injetada).
- **Mapeamento de Labels:** O Coletor OTEL deve estar configurado para mapear o atributo `service.name` para a label `job` do Loki, permitindo consultas como `{job="backend-api"}` no Grafana.

---

## 🌐 Networking e Comunicação Interna (Split-Horizon)

Para garantir performance e compatibilidade entre ambientes locais e nuvem (AWS/Docker Swarm), a aplicação utiliza uma estratégia de **Split-Horizon Fetch**:

### Motivação
Em containers, o Next.js (SSR) tenta resolver `localhost:8081` e falha, pois esse endereço só existe no navegador do usuário (via Traefik). Internamente, o container do frontend deve falar diretamente com o container do backend.

### Funcionamento do "Auto-Patch"
No arquivo `apps/frontend/src/auth.ts`, implementamos uma lógica que:
1.  **Detecta o Ambiente:** Se estiver em `NODE_ENV=production` e a API apontar para `localhost`.
2.  **Aplica o Roteamento Interno:** Substitui automaticamente a chamada para `http://backend:3001`.
3.  **Benefícios:**
    *   **Zero Latência:** O tráfego de autenticação nunca sai da rede Docker (não passa por Load Balancers externos).
    *   **Segurança:** Credenciais de SSR são transmitidas apenas na rede privada de containers.
    *   **Portabilidade:** O mesmo build funciona no seu PC (Docker Compose), em um Cluster (Docker Swarm) ou na Nuvem (Amplify/Vercel) sem alterações de código.

---

> **Cloud & Docker Swarm:** Sim, estas configurações são **indispensáveis** em ambientes Cloud (AWS, GCP, DigitalOcean) usando Docker Swarm ou Kubernetes com Traefik. O Proxy atua como a borda (terminação TLS/SSL), e o Next.js precisa saber que deve confiar nos cabeçalhos `X-Forwarded-Host` e `X-Forwarded-Proto` enviados pelo Traefik para gerar URLs de callback corretas e permitir a sessão.

---

## 📋 Observações Importantes
- **Configuração:** 
  - O ambiente de **Desenvolvimento** utiliza o arquivo `config.yaml` na raiz.
  - O ambiente de **Produção** utiliza o arquivo `config.prod.yaml` na raiz (é copiado para dentro da imagem como `config.yaml` durante o build).
  - Use `config.prod.example.yaml` como base para criar seu arquivo de produção.
- **Socket Docker:** O Traefik em produção usa um arquivo estático para roteamento para evitar problemas de permissão com `/var/run/docker.sock` em diferentes sistemas operacionais.
- **Limpeza:** Para resetar o banco de dados de produção: `docker volume rm docker_postgres_data_prod`.

---

## ☁️ Estratégia de Deploy (Nuvem / AWS Amplify)

Se você optar por rodar o **Frontend** no **AWS Amplify** e o restante da stack em containers (EC2/ECS/Swarm), as seguintes alterações são necessárias:

### 1. Variáveis de Ambiente no Amplify
No console do Amplify, configure:
- `AUTH_TRUST_HOST=true`: Indispensável, pois o Amplify utiliza CloudFront como proxy.
- `AUTH_SECRET`: O mesmo segredo usado no backend para validar tokens JWT.
- `NEXT_PUBLIC_API_URL`: URL pública do seu Traefik (ex: `https://api.seudominio.com`).
- `API_URL`: Diferente do Docker, aqui deve ser a URL pública ou endpoint de VPC, pois o Amplify não acessa a rede interna do Docker.

### 2. Conectividade RabbitMQ (Worker)
- O **Next.js no Amplify (Serverless)** deve ser usado apenas para **publicar** mensagens.
- Os **Workers** (consumidores) **não devem** rodar no Amplify. Eles devem permanecer em containers persistentes (ECS/App Runner) para que o `prefetch` e o Fair Dispatch funcionem corretamente.

### 3. Cabeçalhos de Proxy
O Amplify (CloudFront) remove alguns cabeçalhos por padrão. Certifique-se de que sua API Backend via Traefik está configurada para aceitar e gerenciar corretamente os cabeçalhos `X-Forwarded-*`.
