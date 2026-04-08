# /fe-form

Scaffolda um componente de formulário standalone seguindo o padrão do projeto: react-hook-form + Zod + apiFetch + toast.

## Uso
```
/fe-form <nome> <campos>
```

**Campos** são passados como lista separada por vírgulas, com tipo opcional após `:`:
- `nome`, `email:email`, `senha:password`, `descricao:textarea`, `ativo:boolean`, `papel:select`

**Exemplos:**
- `/fe-form invite-user email:email,role:select`
- `/fe-form edit-profile name,bio:textarea,avatar:url`
- `/fe-form change-password current:password,new:password,confirm:password`

## O que gerar

### 1. Determine onde criar o arquivo

- Se o usuário está trabalhando em uma feature específica (ex: está editando um arquivo dentro de `admin/agents/`), crie o form no mesmo diretório
- Se não houver contexto claro, pergunte onde criar antes de prosseguir

### 2. Crie o arquivo `<nome>-form.tsx`

#### Estrutura completa:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button, Input, Label, Textarea, cn } from "@turborepo/ui";
import { apiFetch } from "@/lib/api-fetch";

// Schema Zod — mensagens em português
const <nome>Schema = z.object({
  // campos gerados conforme a lista
});

type <Nome>FormValues = z.infer<typeof <nome>Schema>;

interface <Nome>FormProps {
  // props necessárias (token, onSuccess, initialData, etc.)
  accessToken: string;
  onSuccess?: () => void;
}

export function <Nome>Form({ accessToken, onSuccess }: <Nome>FormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<<Nome>FormValues>({
    resolver: zodResolver(<nome>Schema),
    defaultValues: {
      // valores padrão por campo
    },
  });

  const onSubmit = async (data: <Nome>FormValues) => {
    try {
      await apiFetch("<endpoint>", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      toast.success("<Ação> realizada com sucesso!");
      reset();
      onSuccess?.();
    } catch {
      toast.error("Erro ao <ação>. Tente novamente.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* campos gerados */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
```

### 3. Mapeamento de tipos de campo para componentes

| Tipo no comando | Componente gerado | Validação Zod |
|---|---|---|
| (padrão / `text`) | `<Input type="text" />` | `z.string().min(1, "Campo obrigatório")` |
| `email` | `<Input type="email" />` | `z.string().email("Email inválido")` |
| `password` | `<Input type="password" />` | `z.string().min(6, "Mínimo 6 caracteres")` |
| `textarea` | `<Textarea />` | `z.string().max(500).optional()` |
| `url` | `<Input type="url" />` | `z.string().url("URL inválida").optional()` |
| `boolean` | `<Switch />` | `z.boolean().default(false)` |
| `select` | `<select>` nativo com classes Tailwind | `z.enum([...]).` — **pergunte as opções** |
| `number` | `<Input type="number" />` | `z.coerce.number().min(0)` |
| `date` | `<Input type="date" />` | `z.string()` com transformação de data |

### 4. Padrão de campo com label + erro

```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="<campo>"><Label do Campo></Label>
  <Input
    id="<campo>"
    type="<tipo>"
    {...register("<campo>")}
    className={cn(errors.<campo> && "border-destructive")}
  />
  {errors.<campo> && (
    <p className="text-sm text-destructive">{errors.<campo>.message}</p>
  )}
</div>
```

### 5. Confirmação de senha (quando há campos `password` + `confirm`)

Adicione ao schema:
```typescript
.refine((data) => data.new === data.confirm, {
  message: "As senhas não coincidem",
  path: ["confirm"],
})
```

### 6. Após criar o arquivo

- Mostre o caminho completo do arquivo criado
- Indique onde importar e usar o componente
- Se o endpoint da API ainda não existir no backend, avise o usuário
- Se houver campo `select` com opções desconhecidas, pergunte antes de gerar o enum Zod

## Regras obrigatórias

- `"use client"` sempre presente (formulários são sempre client components)
- Todas as mensagens de validação em **português**
- Textos de toast em **português** ("criado com sucesso", "Erro ao criar", etc.)
- `apiFetch` — nunca `fetch` diretamente
- Componentes UI de `@turborepo/ui` — nunca `@/components/ui`
- `isSubmitting` do `formState` para desabilitar o botão e mostrar estado de loading
- `reset()` após submit bem-sucedido
- Nenhum `console.log` — use `toast.error` para erros
