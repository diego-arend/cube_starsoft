# @turborepo/email ✉️

Pacote de envio de e-mails via SMTP com suporte a templates HTML (Handlebars) e utilitários para envio de e-mails de teste.

## Resumo das mudanças recentes

- Loader refatorado: templates `.hbs` agora são importados como strings (`import tpl from './welcome.html.hbs?raw'`) e compilados com `Handlebars.compile` em tempo de inicialização (`packages/email/src/templates`).
- Removidos fallbacks frágeis de runtime (extração de HTML de JS gerado); agora o build garante que o conteúdo do template esteja disponível como string no pacote.
- Arquitetura mais previsível: atualize templates e _rebuild_ o pacote para que mudanças apareçam em produção.

## Estrutura de arquivos

- `src/templates/*.hbs` — arquivos Handlebars usados pelas mensagens (ex.: `welcome.html.hbs`).
- `src/templates/index.ts` — exporta `renderTemplate(type, data)` e compila templates usando `Handlebars.compile` a partir do conteúdo importado (`?raw`).
- `src/types/hbs.d.ts` — declaração de módulo para imports de `.hbs`.
- `src/email.service.ts` — API de alto nível usada pelo worker e demais serviços para enviar e-mails.

## Como usar (local)

1. Build do pacote:

```bash
pnpm -C packages/email build
```

2. Executar testes unitários:

```bash
pnpm -C packages/email test
```

3. Enviar e-mail de teste (dev usa Mailpit por padrão):

```bash
pnpm -C packages/email run send:test -- --to=you@example.com --template=welcome
```

## Notas sobre testes

- O Vitest foi ajustado para tratar `.hbs` como _assets_ (via `assetsInclude`) e os imports no código usam `?raw` para garantir compatibilidade entre bundler (tsup) e test runner (Vite/Vitest).
- Os testes de template validam que `renderTemplate(...)` retorne HTML esperado e que `EmailService` valide payloads antes de enviar.

## Boas práticas / recomendações ⚠️

- Rebuild obrigatório: editar um `.hbs` requer rebuild do pacote (`pnpm -C packages/email build`) antes de reiniciar o worker/backend em produção.
- Performance: se quiser reduzir overhead em runtime, considere pré-compilar templates com `handlebars precompile` no build (gera `TemplateDelegate` diretamente) — ótimo para produção.
- Mantenha templates idempotentes (evite lógica complexa no template) e faça validação dos payloads via `zod` (já usado internamente).

## Observabilidade & Debug 🔍

- Logs úteis:
  - `NotificationProcessorService` mostra `EmailService initialized` e logs de sucesso/falha ao enviar template.
  - Em caso de erro no template, verifique o HTML gerado e o resultado de `renderTemplate` em testes locais.
- Debug rápido: use Mailpit (Docker) para inspecionar e-mails enviados em dev.

## Migração

Se você tem código que dependia dos fallbacks antigos (ex.: leitura direta de `dist/*.js` para extrair string de template), atualize para importar o `.hbs` via `?raw` ou mova para pré-compilação durante o build.

## Contribuições

- Se for adicionar novos templates, coloque-os em `src/templates/` e atualize os testes em `src/test/unit/templates.spec.ts`.
- PRs que mudam a forma como os templates são exportados devem incluir um teste de integração que verifique `renderTemplate` em artefatos de build.

---
