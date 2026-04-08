# /fe-test

Gera testes Vitest + Testing Library para um componente, store ou hook do frontend.

## Uso
```
/fe-test [arquivo]
```

- Se `arquivo` for fornecido, usa-o como alvo
- Se não for fornecido, usa o arquivo atualmente aberto no editor
- Cria o arquivo de teste no mesmo diretório, com sufixo `.spec.tsx` (ou `.spec.ts` para stores/hooks)

**Exemplos:**
- `/fe-test` — testa o arquivo aberto
- `/fe-test src/components/assistant/AssistantChat.tsx`
- `/fe-test src/stores/assistant.store.ts`
- `/fe-test src/lib/api-fetch.ts`

## Processo

### 1. Leia e analise o arquivo alvo

Leia o arquivo completamente. Identifique:

**Para componentes React:**
- Props recebidas e seus tipos
- Estados internos relevantes (`useState`, stores Zustand)
- Event handlers (`onClick`, `onSubmit`, etc.)
- Chamadas a `apiFetch` ou outros efeitos colaterais
- Condicionais de renderização (`isLoading`, `error`, `isEmpty`, etc.)
- Textos e labels visíveis ao usuário

**Para Zustand stores:**
- Estado inicial
- Cada action/método público
- Efeitos colaterais (fetch, WebSocket, etc.)
- Seletores derivados

**Para hooks (`use*.ts`):**
- Parâmetros de entrada
- Valor de retorno
- Efeitos colaterais
- Casos de erro

**Para funções utilitárias (`lib/*.ts`):**
- Assinatura da função
- Casos nominais, edge cases e casos de erro

### 2. Leia um arquivo de teste existente para referência

Sempre leia pelo menos um arquivo `.spec.ts(x)` existente no projeto antes de gerar. Priorize:
- `apps/frontend/src/test/`
- Qualquer `*.spec.tsx` próximo ao arquivo alvo

Isso garante alinhamento com os padrões reais de setup do projeto (providers, mocks, etc.).

### 3. Gere o arquivo de teste

#### Estrutura base:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock de dependências externas
vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Wrapper com providers necessários (se componente usa session/theme)
function Wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe("<NomeDoComponente>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // casos de teste
});
```

### 4. Casos de teste a cobrir por tipo

#### Componentes com formulário:
- Renderiza todos os campos esperados
- Exibe erros de validação ao submeter form inválido (campo vazio, email inválido, etc.)
- Chama `apiFetch` com os dados corretos ao submeter form válido
- Exibe toast de sucesso e reseta o form após submit bem-sucedido
- Exibe toast de erro quando `apiFetch` rejeita
- Desabilita o botão de submit durante `isSubmitting`

#### Componentes com listagem/tabela:
- Renderiza estado de loading (spinner ou skeleton)
- Renderiza lista de itens quando dados carregam
- Renderiza estado vazio quando não há itens
- Renderiza mensagem de erro quando fetch falha
- Abre dialog de criação ao clicar no botão correspondente
- Abre dialog de edição ao clicar em "Editar" na linha
- Chama delete e atualiza lista ao confirmar exclusão

#### Zustand stores:
- Estado inicial está correto
- Cada action modifica o estado como esperado
- Actions assíncronas atualizam estado corretamente (loading → success / error)
- Actions de cleanup (reset, clear) funcionam

#### Hooks:
- Retorna valores corretos no caso nominal
- Lida corretamente com parâmetros inválidos ou ausentes
- Cleanup de efeitos é chamado no unmount

#### Funções utilitárias:
- Caso nominal retorna o valor esperado
- Edge cases (null, undefined, string vazia, array vazio)
- Casos de erro lançam ou retornam o esperado

### 5. Padrões de mock específicos do projeto

```typescript
// Mock de next-auth session
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      accessToken: "mock-token",
      user: { id: "user-1", email: "test@test.com", role: "user" },
    },
    status: "authenticated",
  })),
}));

// Mock do apiFetch
import { apiFetch } from "@/lib/api-fetch";
vi.mocked(apiFetch).mockResolvedValueOnce({ id: "1", name: "Mock" });
vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Network error"));

// Mock do Zustand store (para componentes que consomem store)
vi.mock("@/stores/assistant.store", () => ({
  useAssistantStore: vi.fn(() => ({
    messages: [],
    isStreaming: false,
    sendMessage: vi.fn(),
    connect: vi.fn(),
  })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));
```

### 6. Qualidade dos testes

- Priorize testes de **comportamento** (o que o usuário vê/faz), não de implementação
- Use queries acessíveis: `getByRole`, `getByLabelText`, `getByText` — evite `getByTestId`
- Prefira `userEvent` a `fireEvent` para simular interações reais
- Cada `it` testa uma coisa apenas — nomes descritivos em português ou inglês (siga o padrão do projeto existente)
- Não teste detalhes de implementação (nomes de variáveis internas, chamadas de hook específicas)
- Mínimo de 1 teste por caminho lógico relevante (happy path + error path + edge case)

### 7. Após gerar

- Informe o caminho do arquivo criado
- Liste os casos de teste gerados em formato de checklist
- Se identificou comportamentos que não conseguiu testar (ex: WebSocket real, OTEL), mencione e sugira como mockar
- Se o componente tem dependências complexas não mapeadas, liste-as e peça confirmação antes de finalizar

## Regras obrigatórias

- Vitest (`vi`, `describe`, `it`, `expect`) — nunca Jest
- `@testing-library/react` para componentes — nunca Enzyme
- `userEvent` para interações — não `fireEvent` para ações de usuário
- `vi.clearAllMocks()` no `beforeEach` sempre que houver mocks
- Sem `console.log` nos testes
- Arquivo de teste no **mesmo diretório** que o arquivo testado, sufixo `.spec.tsx` / `.spec.ts`
