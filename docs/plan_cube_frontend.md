# Plano: Menu CUBE no Frontend

**Status:** Executado  
**Branch:** transfer_llm_flow_to_wroker  
**Referência:** `docs/Arquitetura_do_viewer_tridimensional_de_cubo.md`

---

## Arquivos inspecionados

| Arquivo | Relevância |
|---|---|
| `apps/frontend/src/components/layouts/sidebar.tsx` | Array `sidebarItems` — ponto de entrada do menu |
| `apps/frontend/src/app/(authenticated)/layout.tsx` | Layout protegido onde o viewer será renderizado |
| `apps/frontend/src/app/(authenticated)/assistant/page.tsx` | Padrão page / client-component split |
| `apps/frontend/package.json` | Three.js não estava nas dependências — adicionado |
| `packages/ui/src/index.ts` | Exports disponíveis (`Card`, `Badge`, `cn`, etc.) |

---

## Novos arquivos criados

```
apps/frontend/src/app/(authenticated)/cube/
├── page.tsx
└── cube-viewer.tsx

apps/frontend/src/components/cube/
├── scene-controller.ts
├── camera-controller.ts
├── representation-manager.ts
├── face-selection-manager.ts
├── chunk-manager.ts
└── cube-data-model.ts
```

---

## Etapas executadas

| # | Etapa | Status |
|---|---|---|
| 1 | Criar `plan_cube_frontend.md` | ✅ |
| 2 | Adicionar `three` + `@types/three` no `package.json` | ✅ |
| 3 | Atualizar `sidebar.tsx` com item CUBE | ✅ |
| 4 | Criar `cube-data-model.ts` | ✅ |
| 5 | Criar `scene-controller.ts` | ✅ |
| 6 | Criar `camera-controller.ts` | ✅ |
| 7 | Criar `representation-manager.ts` | ✅ |
| 8 | Criar `face-selection-manager.ts` | ✅ |
| 9 | Criar `chunk-manager.ts` | ✅ |
| 10 | Criar `cube-viewer.tsx` e `cube/page.tsx` | ✅ |

---

## Checklist de conformidade

- [x] Componentes UI exclusivamente de `@turborepo/ui`
- [x] `three` + `@types/three` em `apps/frontend/package.json`
- [x] Rota protegida via group `(authenticated)`
- [x] `dispose()` em `useEffect` cleanup
- [x] `dynamic` import com `ssr: false` — Three.js não executa no servidor
- [x] TypeScript strict — sem `any`
