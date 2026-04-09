# Plano de Implementação: Refatoração para 348M Mini-cubos (Arquitetura LOD 3D)

**Baseado em:** `research_300M_cubes_render.md`  
**Versão:** 1.0.0  
**Data:** 2025-04-09  

---

## Objetivo

Migrar o viewer atual (2D por face, ~3M quadrados) para uma arquitetura volumétrica 3D com **348.913.664 mini-cubos** organizados em uma grade hierárquica de chunks, com LOD automático baseado em distância de câmera.

---

## Arquitetura Alvo

### Grade Matemática

| Nível       | Unidade        | Por Eixo | Total           |
|-------------|----------------|:--------:|-----------------|
| Chunk Grid  | Chunks         | 64       | 262.144 chunks  |
| Mini-cubo   | Mini-cubos     | 11       | 1.331 por chunk |
| **Total**   |                |          | **348.913.664** |

### Constantes
```
GRID_SIZE       = 64          // chunks por eixo
CHUNK_SIZE      = 11          // mini-cubos por eixo dentro do chunk
WORLD_SIZE      = 2           // cubo ocupa [-1, 1]³
CHUNK_WORLD_SIZE = 2 / 64     ≈ 0.03125
MINI_CUBE_STEP  = 0.03125 / 11 ≈ 0.002841
MINI_CUBE_SIZE  = MINI_CUBE_STEP × 0.82  (gap de 18%)
CHUNK_NAV_SIZE  = CHUNK_WORLD_SIZE × 0.85
```

---

## LOD por Distância de Câmera

| LOD     | dist. da origin | Visível                          | Interação    | Técnica                          |
|---------|:---------------:|----------------------------------|:------------:|----------------------------------|
| `macro` | > 4.0           | Cubo sólido (Mesh único)         | Bloqueada    | `MeshPhongMaterial` sólido       |
| `nav`   | 1.2 – 4.0       | Grade de 262k chunks (low-poly)  | Bloqueada    | 1 `InstancedMesh` 262k instâncias|
| `micro` | ≤ 1.2           | Até 4 chunks high-detail         | **ATIVA**    | ≤ 4 `InstancedMesh` × 1.331      |

---

## Arquivos Afetados (Ordem de Implementação)

### Passo 1 — `cube-data-model.ts` (rewrite completo)

**Remover:** `FaceId`, `SQUARES_PER_SIDE`, `TILE_SIZE`, `TILES_PER_SIDE`, `TileDescriptor`, `getTileRange`, `getAllTilesForFace`, `tileKey`

**Adicionar:**
```typescript
GRID_SIZE, CHUNK_SIZE, TOTAL_CHUNKS, CUBES_PER_CHUNK
WORLD_SIZE, CHUNK_WORLD_SIZE, MINI_CUBE_STEP, MINI_CUBE_SIZE, CHUNK_NAV_SIZE

interface ChunkCoord { cx, cy, cz }
chunkKey(coord): string
chunkIndex(coord): number
chunkFromIndex(idx): ChunkCoord
chunkWorldCenter(coord): [number, number, number]
cubeIndex(lx, ly, lz): number
cubeFromIndex(idx): { lx, ly, lz }
```

---

### Passo 2 — `camera-controller.ts` (rewrite significativo)

**Remover:**
- `CameraMode = "cube" | "face"` → substituído por `"macro" | "nav" | "micro"`
- `_faceNormal`, `_faceTangentX/Y`, `_faceFitDist`, `_faceMinDist`
- `animateToFace()`, `animateToCube()`, `onBackToCubeRequested`
- Handlers de pan manual (`_onMouseDown/Move/Up`)
- Handler de wheel customizado (OrbitControls cuida do zoom)

**Adicionar:**
- `onLodChanged?: (mode: CameraMode) => void`
- Detecção automática de LOD em `update()` via `controls.getDistance()`
- `animateTo(pos)` genérico para reset de câmera

**Manter:**
- `OrbitControls` sempre ativo
- `minDistance = 0.05` (permite entrar no cubo)
- `maxDistance = 18`
- Infraestrutura de animação suave

---

### Passo 3 — `chunk-manager.ts` (rewrite major)

**Estrutura interna:**
```
lowGroup: THREE.Group
  └─ _lowMesh: InstancedMesh (262.144 instâncias, construído lazy)
highGroup: THREE.Group  
  └─ _highCache: Map<chunkKey, InstancedMesh> (≤4 meshes × 1.331 instâncias)
_removed: Map<chunkKey, Set<cubeIdx>>    // persiste entre LOD changes
_hiding:  Map<animKey, HideAnimation>    // animações ativas
_highTtl: Map<chunkKey, frames>          // eviction counter (> 60 frames → evict)
```

**API Pública:**
```typescript
readonly lowGroup: THREE.Group
readonly highGroup: THREE.Group
buildLowMesh(): void          // lazy, chamado uma vez ao entrar em nav
updateLod(mode, camera): void // chamado a cada frame em nav/micro
hideCube(chunkKey, idx): void // inicia animação de remoção
getHighMeshes(): InstancedMesh[] // para raycasting
update(dt): void
dispose(): void
```

**Algoritmo `_getNearestChunks(camera, count=4)`:**
1. Converter `camera.position` para chunk coords via `floor((v + 1) / CHUNK_WORLD_SIZE)`
2. Checar vizinhança 5×5×5 = 125 candidatos (O(1) na prática)
3. Ordenar por distância² e retornar os `count` mais próximos

---

### Passo 4 — `representation-manager.ts` (atualização menor)

```typescript
type RepresentationMode = "macro" | "nav" | "micro"

constructor(solidGroup, chunkLowGroup, chunkHighGroup)

forceMode("macro"): solidGroup=true,  low=false, high=false
forceMode("nav"):   solidGroup=false, low=true,  high=false
forceMode("micro"): solidGroup=false, low=true,  high=true
```

---

### Passo 5 — `scene-controller.ts` (rewrite da orquestração)

**Remover:**
- `faceGroup`, `_buildFacePlanes()`
- `FaceSelectionManager` + instância
- `_activeFace`, `_suppressNextClick`
- `darkSpotsGroup`, `_updateDarkSpots()`
- `_onDblClick`, `_returnToCube`, `_snapNormalToFace`
- Imports de `FaceId`, `TILES_PER_SIDE`

**Adicionar:**
- `cameraController.onLodChanged` → `_onLodChanged(mode)`
- No animation loop: `chunkManager.updateLod(mode, camera)` a cada frame em micro
- SceneStats: remove `activeFace`, adiciona `nearChunks: number`
- Raycasting em micro mode usa `chunkManager.getHighMeshes()`
- Hover: posiciona em world-space via `mesh.matrixWorld`

**SceneStats atualizado:**
```typescript
interface SceneStats {
  mode: string;
  nearChunks: number;  // high-detail chunks ativos (0–4)
  fps: number;
  hint: string;
}
```

---

### Passo 6 — `cube-viewer.tsx` (HUD atualizado)

**Mudanças:**
- Badge de modo: `macro → "Macro"`, `nav → "Navegação"`, `micro → "Micro"`
- Remover badge `Face: +Z` (não existe mais navegação por face)
- Adicionar badge de chunks ativos: `N chunks detalhados` (apenas em micro)
- Hints por modo:
  - macro: `"Aproxime o zoom para navegar no grid de chunks"`
  - nav: `"Continue aproximando para interagir com os mini-cubos"`
  - micro: `"Clique em um mini-cubo para removê-lo"`

---

### Passo 7 — `face-selection-manager.ts` (deprecação)

Substituir conteúdo por stub vazio para evitar erro de compilação após remoção de `FaceId`.

---

## Decisões Arquiteturais

### D1 — 1 InstancedMesh para todos os 262k chunks no LOD nav
Em vez de criar 262.144 objetos separados, usa-se **1 único `InstancedMesh`** com 262.144 instâncias. Draw call count = 1 para toda a grade de navegação. A GPU trata depth-test automaticamente, descartando chunks ocultos.

### D2 — Lazy construction do Low Mesh
O `InstancedMesh` de 262k instâncias é construído apenas quando o usuário entra pela primeira vez no LOD `nav`. Aceita-se um hiccup de ~1 frame na transição macro→nav, evitando custo no startup para usuários que ficam no macro.

### D3 — Eviction com TTL de 60 frames
High-detail chunks que saem do campo de visão são removidos após 60 frames (~1 segundo a 60fps). Evita tanto memory leak quanto rebuild frequente ao fazer pan na câmera.

### D4 — Remoção de mini-cubo marca o chunk no LOD baixo
Quando um mini-cubo é removido via `hideCube()`, o chunk correspondente no `_lowMesh` é colorido com um tom mais escuro (`0x6b7280`). Isso preserva feedback visual na visão macro/nav sem precisar de "dark spots" separados.

### D5 — Zoom máximo travado no limiar `micro` (`minDistance = LOD_MICRO_THRESHOLD`)
O `OrbitControls.minDistance` é fixado em `1.2` (igual a `LOD_MICRO_THRESHOLD`) em vez de `0.05`. Isso impede que o usuário adentre o interior do volume além do ponto em que os chunks high-detail se tornam visíveis. A câmera permanece na "superfície" do LOD micro sem jamais ultrapassar esse ponto.

**Implementação:** em `camera-controller.ts` construtor:
```typescript
this.controls.minDistance = LOD_MICRO_THRESHOLD; // trava no nível micro
```

### D6 — Clique de seleção exige hit real em mini-cubo (sem disparo fantasma)
O callback `onSquareClick` (som + label "+1") só é invocado quando o raycast acerta uma instância de alto detalhe (`instanceId !== undefined`). Em qualquer outro contexto — modos `macro` / `nav`, ou clique no vazio em `micro` — o evento de mouse é ignorado para fins de seleção, servindo apenas ao `OrbitControls` (pan/rotate/zoom).

**Implementação:** em `scene-controller.ts` `_onClick`:
```typescript
// onSquareClick movido para dentro do bloco if(hit)
if (hits.length > 0 && hits[0]!.instanceId !== undefined) {
  // ... hideCube ...
  this.onSquareClick?.(e.clientX, e.clientY); // ← só aqui
}
// sem chamada fora do bloco
```

---

## Checklist de Conformidade

- [x] `ChunkCoord` e helpers definidos apenas em `cube-data-model.ts`
- [x] Frontend continua usando `@turborepo/ui` para HUD
- [x] TypeScript estrito — sem `any`
- [x] Sem variáveis de ambiente novas em `config.yaml`
- [ ] Tests: `cube-data-model.test.ts` cobrindo `chunkKey`, `chunkWorldCenter`, `cubeFromIndex`

---

## Sequência de Execução

```
Passo 1 → cube-data-model.ts      (base: novos tipos 3D)
Passo 2 → camera-controller.ts    (LOD detection)
Passo 3 → chunk-manager.ts        (lazy LOD meshes)
Passo 4 → representation-manager  (3 modos de visibilidade)
Passo 5 → scene-controller.ts     (orquestração LOD)
Passo 6 → cube-viewer.tsx          (HUD)
Passo 7 → face-selection-manager  (deprecation stub)
```
