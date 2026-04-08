# /fe-crud

Scaffolda uma feature CRUD completa no frontend, seguindo exatamente o padrão de `apps/frontend/src/app/(authenticated)/admin/agents/`.

## Uso
```
/fe-crud <recurso> <endpoint-api>
```

**Exemplos:**
- `/fe-crud products /products`
- `/fe-crud contracts /admin/contracts`
- `/fe-crud invoices /billing/invoices`

## O que será gerado

Para o recurso informado, crie os seguintes arquivos em `apps/frontend/src/app/(authenticated)/admin/<recurso>/`:

### 1. `page.tsx` — Server Component (página principal)

- Server component (`async function`)
- Busca sessão com `auth()` do `@/auth`
- Passa `accessToken` da session para o client component da tabela
- Inclui título da página e botão "Criar <Recurso>" que abre o `CreateDialog`
- Não usa `"use client"`

### 2. `<recurso>-table.tsx` — Client Component (tabela com dados)

- `"use client"` no topo
- Usa `DataTable` do `@turborepo/ui`
- Busca dados com `apiFetch` do `@/lib/api-fetch` usando o `accessToken` recebido via props
- Colunas tipadas com `ColumnDef` do `@tanstack/react-table`
- Coluna de ações com `DropdownMenu` (Editar / Excluir)
- Estado local para controlar qual item está sendo editado/excluído
- Integra `useLoadingStore` via `useApiFetch` hook
- Exibe `toast.error` em caso de falha no fetch

### 3. `create-<recurso>-dialog.tsx` — Client Component

- `"use client"` no topo
- `Dialog` do `@turborepo/ui` com estado `open`/`onOpenChange`
- Schema Zod com todos os campos — mensagens de validação em **português**
- `useForm` com `zodResolver`
- Campos usando `Label` + `Input`/`Textarea` do `@turborepo/ui`
- `onSubmit`: POST para `<endpoint-api>` com `apiFetch`, `Authorization: Bearer ${token}`
- Em sucesso: `toast.success("... criado com sucesso!")`, `form.reset()`, `onClose()`, recarrega lista
- Em erro: `toast.error("Erro ao criar ...")`
- Botão de submit com estado `isSubmitting` do form

### 4. `edit-<recurso>-dialog.tsx` — Client Component

- Mesma estrutura do create, mas:
- Recebe `item` e `open` via props
- `useEffect` para `form.reset(item)` quando `item` muda
- `onSubmit`: PATCH para `<endpoint-api>/${item.id}`
- Mensagens de toast: "... atualizado com sucesso!" / "Erro ao atualizar ..."

### 5. `delete-<recurso>-dialog.tsx` — Client Component

- `AlertDialog` ou `Dialog` simples de confirmação
- Recebe `itemId`, `itemName`, `open`, `onClose`, `onDeleted` via props
- `onConfirm`: DELETE para `<endpoint-api>/${itemId}` com `apiFetch`
- Em sucesso: `toast.success("... excluído com sucesso!")`, `onDeleted()`
- Em erro: `toast.error("Erro ao excluir ...")`
- Botão "Cancelar" e botão "Excluir" com variante `destructive`

## Regras obrigatórias a seguir

- Todos os imports de componentes UI vêm de `@turborepo/ui` — nunca de `@/components/ui`
- `cn()` para merge de classes, importado de `@turborepo/ui`
- `apiFetch` para **todas** as chamadas HTTP — nunca `fetch` diretamente
- Mensagens de validação Zod e textos de toast em **português**
- Nenhum `console.log` — use `toast` para feedback ao usuário
- Tipos explícitos para props e retornos de função
- Path aliases `@/` para imports internos

## Após gerar os arquivos

1. Informe o usuário que precisa:
   - Adicionar o link da nova rota na sidebar (`src/components/layouts/sidebar.tsx`)
   - Criar os tipos/DTOs correspondentes se não existirem em `@turborepo/database`
2. Mostre o trecho exato a adicionar na sidebar
