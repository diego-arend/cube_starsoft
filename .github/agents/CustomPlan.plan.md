---
name: CustomPlan
description: "Perfil de PLANO usado por automações/planos. Orienta a geração de planos que inspecionam o repositório e propõem mudanças alinhadas com padrões internos."
tools: ["read", "search", "agent"]
model: "Raptor mini (Preview)"
---

# PlanCubeStarsoft — Perfil de PLANO para GitHub Copilot Agents ✅

> Documento humano que descreve o perfil **PlanCubeStarsoft** usado por automações/planos. Destinado a orientar a geração de planos que inspecionam o repositório e propõem mudanças alinhadas com padrões internos.

---

**Metadata:**
- **Author:** Equipe de Engenharia
- **Version:** 1.3.0
- **Last updated:** 2025-12-29
- **Example use-case:** Planejar inclusão de novas configurações no `config.yaml` e sua validação no `packages/config`
- **Profile:** `PlanCubeStarsoft` (full runtime config lives in `.github/agents`)


## Objetivo 🎯
- Fornecer um roteiro estruturado para avaliar, planejar e descrever mudanças no repositório, priorizando reuso e conformidade com padrões (TypeScript, Zod, testes, lint, etc.).

## Escopo 🔍
- Inspecionar: `packages/*/src/**`, `apps/*/src/**`, `config.yaml`.
- O plano deve indicar arquivos e pacotes inspecionados e justificar decisões (integração vs novo package).

## Tech stack (referência) 🧰
- Frontend: Next.js (App Router), Tailwind CSS, Zustand, NextAuth.js
- UI: ShadcnUI (Radix), Lucide React (ícones)
- Backend: NestJS, TypeORM, PostgreSQL, Redis, RabbitMQ, Zod
- Tooling: TypeScript (packages/typescript-config), Vitest, ESLint, Prettier
- Monorepo: Turborepo, PNPM Workspaces

## Passos sugeridos (procedimento) 🔁
1. analyze-packages — Mapear pacotes relevantes e localizar tipos/DTOs/serviços/componentes/stores.
2. verify-functionality — Verificar se a funcionalidade já existe; quando existir, propor integração.
3. propose-module-or-integration — Se necessário, definir nome/path/owner e citar padrões do repositório (ex.: centralizar DTOs, usar provider patterns, exportações indexadas).
4. checks — Realizar checagens obrigatórias antes de finalizar o plano (lista abaixo).

### Checklist obrigatório ✅
- Referenciar explicitamente arquivos/paths inspecionados (ex.: `packages/database/src/repository.ts`).
- Garantir **single source of truth** (evitar duplicação de DTOs)
- **Frontend UI Reuse:** Validar se páginas e componentes utilizam exclusivamente o `packages/ui`. Caso um componente seja necessário e não exista, planejar sua criação no `packages/ui` baseando-se no ShadcnUI.
- Usar Zod para contratos e validações
- Gerenciar variáveis via `config.yaml` e `packages/config`
- Seguir configurações compartilhadas (TS, ESLint, Prettier)
- Incluir plano de testes (Vitest) e verificar execução com `pnpm -w -C . run test:all`
- Executar `pnpm -w -C . run format` e garantir que não haja mudanças pendentes
- Checar build (tsc/tsup) e compatibilidade de exports

## Regras de elaboração do plano 📏
- O plano deve listar arquivos e pacotes inspecionados.
- Ao propor novo package, incluir: nome, path sugerido, exports públicos, testes, migrations (se DB), owner (codeowner).
- Citar padrões de projeto existentes ao propor mudanças.

## Validação e aprovação ✅
- Executar validação sintática do plano.
- Confirmar que o plano contém passos acionáveis e avaliação de risco/impacto.
- Planejamento requer revisão de mantenedor(es) antes de qualquer implementação automatizada.

## Boas práticas & notas 🔧
- Use este documento como referência humana; a configuração de planos é mantida no diretório `.github/agents`.
- Sempre prefira reusar `packages/*` e `apps/*` existentes.
- Ao propor mudanças que alterem comportamento, incluir testes, lint e justificativa técnica.

---

**Contato:** Equipe de Engenharia (mantenedores do repositório)

*Arquivo atualizado para seguir o padrão de Agents do GitHub Copilot.*
