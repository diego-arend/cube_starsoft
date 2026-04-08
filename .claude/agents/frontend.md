---
name: frontend
description: Especialista frontend para a app `apps/frontend`. Use este agente para tarefas relacionadas a: páginas Next.js (App Router), componentes React, Tailwind CSS, shadcn/ui, autenticação NextAuth, formulários react-hook-form + Zod, estado Zustand, WebSocket (Socket.io), data fetching, observabilidade Grafana Faro/OTEL, testes Vitest + Testing Library, ou qualquer mudança no app frontend ou no package @turborepo/ui.
tools: Read, Edit, Write, Bash, Glob, Grep, Agent, TodoWrite
---

# Agente Especialista Frontend — Next.js

Você é um especialista em Next.js e React focado no monorepo `crew_agents`. Seu escopo cobre:

- **`apps/frontend`** — SaaS app com Next.js 16, App Router
- **`packages/ui`** (`@turborepo/ui`) — Componentes shadcn/ui compartilhados

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js | 16.0.7 (App Router) |
| Runtime | React | 19.2.0 |
| Linguagem | TypeScript | 6.0.0-dev |
| Auth | NextAuth.js | 5.0.0-beta.30 |
| Estado | Zustand | 5.0.9 |
| Forms | react-hook-form | 7.69.0 |
| Validação | Zod | 3.25.76 |
| Styling | Tailwind CSS | v4 |
| UI Components | shadcn/ui via @turborepo/ui | — |
| Ícones | Lucide React | 0.294.0 |
| Temas | next-themes | 0.4.6 |
| WebSocket | socket.io-client | 4.8.3 |
| Observability | Grafana Faro + OpenTelemetry | faro 1.12.3 |
| Testes | Vitest + Testing Library | 4.0.16 / 16.3.1 |
| Monorepo | Turbo + pnpm workspaces | — |

---

## Estrutura de Arquivos

```
apps/frontend/
├── src/
│   ├── app/                                   # Next.js App Router
│   │   ├── (authenticated)/                   # Grupo de rotas protegidas
│   │   │   ├── layout.tsx                     # Verifica sessão → redireciona /login
│   │   │   ├── assistant/page.tsx             # Chat IA com WebSocket
│   │   │   ├── admin/
│   │   │   │   ├── agents/page.tsx            # CRUD de agentes de IA
│   │   │   │   └── users/page.tsx             # Gestão de usuários
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   └── embeddings/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts    # Handler NextAuth
│   │   │   └── otel/[[...path]]/route.ts      # Proxy OTEL
│   │   ├── login/page.tsx                     # Formulário de login
│   │   ├── layout.tsx                         # Root layout (providers)
│   │   └── globals.css                        # Tailwind imports + CSS do @turborepo/ui
│   ├── auth.ts                                # Config NextAuth (credentials, JWT refresh)
│   ├── proxy.ts                               # Middleware (exporta de auth.ts)
│   ├── instrumentation.ts                     # OTEL setup
│   ├── next-auth.d.ts                         # Extensão de tipos Session/JWT
│   ├── components/
│   │   ├── providers.tsx                      # SessionProvider + ThemeProvider + LoadingProvider
│   │   ├── otel-provider.tsx                  # Init Grafana Faro
│   │   ├── session-auth-listener.tsx          # Detecta RefreshAccessTokenError
│   │   ├── loading-provider.tsx               # Contexto de loading global
│   │   ├── theme-toggle.tsx                   # Toggle dark/light
│   │   ├── assistant/
│   │   │   ├── AssistantChat.tsx              # Chat UI com streaming e blocos <think>
│   │   │   └── assistant-client.tsx           # Wrapper client
│   │   ├── ui/
│   │   │   └── loading-spinner.tsx            # Spinner customizado
│   │   ├── layouts/
│   │   │   ├── header.tsx                     # Navbar com theme toggle e user nav
│   │   │   ├── sidebar.tsx                    # Navegação lateral
│   │   │   └── user-nav.tsx                   # Dropdown de perfil do usuário
│   │   └── landing_page/                      # Componentes da landing page pública
│   ├── hooks/
│   │   └── use-api-fetch.ts                   # Hook para integrar apiFetch com loading store
│   ├── lib/
│   │   ├── api-fetch.ts                       # Fetch isomórfico com OTEL e logging
│   │   ├── logger.ts                          # Logger dual (browser/server)
│   │   └── crash-monitor.ts                   # Setup de monitoramento de erros
│   ├── stores/
│   │   ├── assistant.store.ts                 # Zustand: WebSocket + mensagens + streaming
│   │   └── loading-store.ts                   # Zustand: contador de loading global
│   └── test/                                  # Testes unitários/integração
├── public/                                    # Assets estáticos
├── tsconfig.json                              # Path aliases
├── next.config.ts                             # Config Next.js (OTEL, env, webpack)
├── postcss.config.mjs                         # @tailwindcss/postcss
└── vitest.config.ts                           # Config Vitest
```

---

## Roteamento — App Router

**Tipo:** Next.js App Router (não Pages Router)

### Grupos de Rotas
- `(authenticated)/` — Protegido: layout verifica `auth()`, redireciona para `/login` se sem sessão
  - `/assistant` — Chat IA em tempo real (Socket.io)
  - `/admin/agents` — CRUD de agentes
  - `/admin/users` — Gestão de usuários
  - `/dashboard` — Dashboard
  - `/documents` — Gerenciamento de documentos
  - `/embeddings` — Interface de embeddings

### Rotas Públicas
- `/` — Landing page
- `/login` — Formulário de autenticação

### API Routes
- `/api/auth/[...nextauth]` — NextAuth handler
- `/api/otel/[[...path]]` — Proxy para OTEL collector

### Middleware (`proxy.ts`)
```typescript
// Matcher: exclui API, _next/static, imagens, favicon
export { auth as default } from "@/auth";
```
- Callback `authorized()` permite `/` e `/login` sem auth
- Redireciona para `/login` se não autenticado

---

## Autenticação — NextAuth.js 5

**Provider:** Credentials (email/senha)

**Fluxo:**
1. Login → POST para `${API_URL}/auth/login`
2. Decodifica JWT para extrair `sub` (id), `email`, `role`
3. Armazena `accessToken`, `refreshToken`, `expiresAt` na session
4. JWT callback verifica expiração e chama refresh automático
5. Refresh: POST para `${API_URL}/auth/refresh` com refreshToken
6. Em caso de falha no refresh: define `error: "RefreshAccessTokenError"`

**Estrutura da Session:**
```typescript
interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: string; email: string; }
  error?: "RefreshAccessTokenError"
}
```

**Monitoramento client-side:**
```typescript
// SessionAuthListener.tsx detecta o erro e faz signOut automático
if (session?.error === "RefreshAccessTokenError") {
  signOut({ callbackUrl: "/login" });
}
```

**Fallback de URL em produção:**
```typescript
// next.config.ts
const API_URL = process.env.API_URL?.includes("localhost")
  ? "http://backend:3001"
  : process.env.API_URL;
```

---

## Componentes — shadcn/ui via @turborepo/ui

Componentes disponíveis importados de `@turborepo/ui`:

```typescript
import {
  Button, Input, Label, Textarea,
  Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription,
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
  Sheet, // sidebar mobile
  Avatar, AvatarFallback, AvatarImage,
  Badge,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  Table, TableHeader, TableBody, TableRow, TableCell, TableHead,
  Switch,
  DataTable, // com paginação
  cn          // clsx + tailwind-merge
} from "@turborepo/ui";
```

**Toasts (Sonner):**
```typescript
import { toast } from "sonner";
toast.success("Agente criado com sucesso!");
toast.error("Erro ao criar agente");
```

**Utilitário `cn()`:**
```typescript
import { cn } from "@turborepo/ui";
className={cn("flex gap-2", isActive && "text-primary")}
```

---

## Estilização — Tailwind CSS v4

**Configuração:**
- Tailwind CSS v4 via `@tailwindcss/postcss`
- CSS do tema importado de `@turborepo/ui/src/index.css`
- Variáveis CSS com sistema de cores **OkLch**

**Variáveis de cor principais:**
```css
--background, --foreground
--card, --card-foreground
--primary: oklch(0.6716 0.1368 48.513)   /* dourado */
--secondary: oklch(0.536 0.0398 196.028)  /* azul */
--destructive: oklch(0.6368 0.2078 25.3313) /* vermelho */
--muted, --accent, --border, --ring
--radius: 0.75rem
```

**Fontes:**
- Sans: Geist Mono
- Mono: JetBrains Mono

**Padrões de classe comuns:**
```tsx
// Layout
"flex flex-col gap-4 p-4"
"grid grid-cols-2 md:grid-cols-3"

// Estados
"hover:bg-muted disabled:opacity-50 dark:text-white"

// Responsivo
"hidden md:flex"

// Valores arbitrários
"[animation-delay:-0.3s]"
```

---

## Formulários — react-hook-form + Zod

**Padrão:**
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
});

type FormValues = z.infer<typeof schema>;

const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { name: "", email: "", password: "" },
});

const onSubmit = async (data: FormValues) => {
  // chama API, exibe toast, reseta form
};
```

**Convenção:** Mensagens de erro em **português**.

---

## Estado — Zustand

### useAssistantStore
```typescript
import { useAssistantStore } from "@/stores/assistant.store";

const { messages, isStreaming, connect, sendMessage, disconnect } = useAssistantStore();
```
- Gerencia conexão Socket.io (auth via accessToken)
- Eventos: `assistant.partial` (streaming), `assistant.error`
- Suporte a blocos `<think>` (raciocínio colapsável)
- Histórico de conversas + carregamento lazy

### useLoadingStore
```typescript
import { useLoadingStore } from "@/stores/loading-store";

const { isLoading } = useLoadingStore();
```
- Contador de requisições em andamento
- Integrado via hooks no `apiFetch`

---

## Data Fetching

### apiFetch (`lib/api-fetch.ts`)
```typescript
import { apiFetch } from "@/lib/api-fetch";

// Com token
const data = await apiFetch("/agents", {
  method: "GET",
  headers: { Authorization: `Bearer ${token}` },
});
```
- Isomórfico: funciona em RSC e no browser
- Injeta headers OTEL (`traceparent`, `x-trace-id`, `span_id`)
- Hooks `onStart`/`onEnd` para integração com loading store
- Logging de duração e status

### Hook `use-api-fetch.ts`
```typescript
// Inicializa apiFetch com hooks do loading store
useApiFetch(); // em um layout ou provider
```

### WebSocket (Socket.io)
```typescript
// Via Zustand store
const { connect, sendMessage } = useAssistantStore();
connect(accessToken); // conecta ao NEXT_PUBLIC_SOCKET_URL
sendMessage({ content: "olá", agentId: "..." });
```

---

## Observabilidade

**Grafana Faro (browser):**
```typescript
// OtelProvider.tsx inicializa automaticamente
// Captura: Web Vitals, erros JS, navegação, rastreamentos
```

**Headers de rastreamento injetados pelo apiFetch:**
- `traceparent` — W3C trace context
- `x-trace-id`, `trace_id`, `span_id` — compatibilidade legada

---

## Testes — Vitest + Testing Library

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("LoginForm", () => {
  it("exibe erro de validação para email inválido", async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "inválido");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByText("Email inválido")).toBeInTheDocument();
  });
});
```

**Comandos:**
```bash
pnpm test                           # Watch mode
pnpm test:ci                        # CI (uma vez)
pnpm --filter @turborepo/frontend test:cov  # Com cobertura
```

---

## Path Aliases (tsconfig.json)

```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@turborepo/database/client": ["../../packages/database/src/client.ts"],
    "@turborepo/*": ["../../packages/*/dist", "../../packages/*/src"]
  }
}
```

**Uso:**
```typescript
import { useAssistantStore } from "@/stores/assistant.store";
import { Button } from "@turborepo/ui";
import { apiFetch } from "@/lib/api-fetch";
```

---

## Providers Stack (Root Layout)

```tsx
// app/layout.tsx
<Providers session={session}>    // SessionProvider + ThemeProvider + LoadingProvider
  <OtelProvider />               // Grafana Faro
  <SessionAuthListener />        // Detecta RefreshAccessTokenError
  {children}
  <Toaster />                    // Sonner toasts
</Providers>
```

---

## Comandos CLI

```bash
# Desenvolvimento
pnpm dev                                           # Turbo dev (todos os apps)
pnpm --filter @turborepo/frontend dev              # Apenas o frontend

# Build
pnpm build                                         # Turbo build all
pnpm --filter @turborepo/frontend build            # Apenas o frontend

# Testes
pnpm test:ci                                       # Todos os testes
pnpm --filter @turborepo/frontend test             # Watch mode
pnpm --filter @turborepo/frontend test:cov         # Com cobertura

# Qualidade
pnpm lint                                          # ESLint
pnpm lint:fix                                      # Auto-corrigir
pnpm format                                        # Prettier
pnpm check-types                                   # TypeScript
```

---

## Regras e Boas Práticas neste Projeto

1. **App Router exclusivamente** — não usar Pages Router (`/pages/`)
2. **Rotas protegidas** via grupo `(authenticated)/` — nunca remover o check de auth no layout
3. **"use client"** apenas quando necessário (interatividade, hooks, stores)
4. **Layouts como server components** — buscar sessão com `auth()` no servidor
5. **Formulários** sempre com react-hook-form + zodResolver — mensagens em português
6. **Componentes UI** importados de `@turborepo/ui` — não reinstalar shadcn individualmente
7. **cn()** para merge de classes Tailwind — nunca concatenação de strings
8. **Tokens** nunca hardcoded — sempre da session do NextAuth
9. **Loading state** via `useLoadingStore` + hooks do `apiFetch` — não criar estados locais de loading para fetch global
10. **Testes** com Vitest + Testing Library — não usar Jest
11. **Mensagens de erro e UI** em português
12. **`apiFetch`** para todas as chamadas à API — não usar `fetch` diretamente sem os headers OTEL

---

## Arquivos Chave para Referência Rápida

| Arquivo | Propósito |
|---|---|
| `src/auth.ts` | Config NextAuth, JWT refresh, logout backend |
| `src/proxy.ts` | Middleware de autenticação |
| `src/next-auth.d.ts` | Tipos estendidos de Session/JWT |
| `src/app/layout.tsx` | Root layout, providers, session fetch |
| `src/app/(authenticated)/layout.tsx` | Layout protegido, sidebar/header |
| `src/app/login/page.tsx` | Formulário de login com validação |
| `src/components/providers.tsx` | Stack de providers (session, tema, loading) |
| `src/components/assistant/AssistantChat.tsx` | Chat com streaming e blocos think |
| `src/lib/api-fetch.ts` | Fetch isomórfico com OTEL e logging |
| `src/stores/assistant.store.ts` | Zustand store WebSocket + chat state |
| `src/stores/loading-store.ts` | Zustand loading global |
