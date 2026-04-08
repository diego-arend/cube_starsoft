# /fe-page

Scaffolda uma nova página no App Router, no lugar certo e com a estrutura correta.

## Uso
```
/fe-page <nome> <rota> [protegida|publica]
```

**Exemplos:**
- `/fe-page settings /settings protegida`
- `/fe-page pricing /pricing publica`
- `/fe-page agent-logs /admin/agent-logs protegida`

Se o terceiro argumento for omitido, **assuma protegida**.

## O que fazer

### 1. Determine o destino correto

| Tipo | Diretório de destino |
|---|---|
| `protegida` | `apps/frontend/src/app/(authenticated)/<rota>/page.tsx` |
| `publica` | `apps/frontend/src/app/<rota>/page.tsx` |

Se a rota contiver subpastas (ex: `/admin/agent-logs`), crie os diretórios intermediários necessários.

### 2. Leia os arquivos de referência antes de criar

Sempre leia estes arquivos para entender o padrão atual:
- `apps/frontend/src/app/(authenticated)/layout.tsx` — como o layout protegido funciona
- `apps/frontend/src/app/(authenticated)/dashboard/page.tsx` — exemplo de server component protegido
- `apps/frontend/src/app/login/page.tsx` — exemplo de página pública com client component
- `apps/frontend/src/components/layouts/sidebar.tsx` — para adicionar o link depois

### 3. Crie o arquivo `page.tsx`

#### Para páginas **protegidas** (server component por padrão):

```tsx
// apps/frontend/src/app/(authenticated)/<rota>/page.tsx
import { auth } from "@/auth";

export default async function <Nome>Page() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">[Título da Página]</h1>
      </div>
      {/* conteúdo */}
    </div>
  );
}
```

- Se a página precisar de interatividade, crie um `<nome>-client.tsx` separado com `"use client"` e importe-o aqui
- Nunca coloque `"use client"` diretamente no `page.tsx` protegido

#### Para páginas **públicas** com formulário/interatividade:

```tsx
"use client";
// apps/frontend/src/app/<rota>/page.tsx
```

- Pode ser client component direto se a página inteira for interativa (ex: landing, login)
- Se tiver partes estáticas + interativas, separe em `page.tsx` (server) + `*-client.tsx` (client)

### 4. Regras de server vs client component

Pergunte-se: a página precisa de hooks, estado, event handlers, ou APIs browser-only?
- **Não** → server component (sem `"use client"`)
- **Sim** → client component OU server component + client component filho

### 5. Atualize a sidebar (apenas para rotas protegidas)

Após criar a página, leia `apps/frontend/src/components/layouts/sidebar.tsx` e adicione o item de navegação no lugar correto:

```tsx
{ href: "/<rota>", label: "<Nome>", icon: <IconeApropriado /> }
```

Escolha um ícone do `lucide-react` semanticamente relacionado ao contexto da página.

### 6. Informe o usuário

Ao finalizar, liste:
- Arquivo(s) criado(s) com caminho completo
- A entrada adicionada na sidebar (se aplicável)
- Se a página precisa de componentes filhos ainda não criados (sugira usar `/fe-crud` ou `/fe-form` se for o caso)

## Regras obrigatórias

- Nunca usar `useRouter`, `useSession` ou qualquer hook em `page.tsx` server component
- Sempre usar `auth()` (não `useSession()`) para obter sessão em server components
- Imports com path alias `@/` — nunca caminhos relativos longos (`../../../`)
- Componentes UI de `@turborepo/ui`
- Classes Tailwind com `cn()` quando houver lógica condicional
