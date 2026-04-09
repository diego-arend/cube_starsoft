# Plano de Melhorias de Interface — Cube Viewer

## Item 1 — Chunks como mini-cubos flutuantes (estilo Minecraft)
- Substituir PlaneGeometry + grid por BoxGeometry (miniatura 3D)
- InstancedMesh por tile (1024 instâncias, uma por quadrado 32×32)
- Gap de ~18% entre cubos: squareSize = step * 0.82
- cubeDepth = squareSize * 0.5 (cubo achatado)
- z = cubeDepth/2 → cubo "flutuando" sobre a face
- Checker pattern via InstancedMesh.setColorAt()
- Cores: 0x6e7a8a / 0x505a66 (cinza)

## Item 2 — Animação de "cair para dentro" ao clicar
- ChunkManager.hideSquare(tileKey, col, row): anima scale 1→0 + move z para dentro em 300ms
- Estado removido persistido em _removed: Map<tileKey, Set<idx>>
- SceneController._onClick chama hideSquare + onSquareClick simultaneamente

## Item 3 — Cor cinza no cubo sólido
- Cubo sólido: 0x4a90d9 → 0x6e7a8a
- Arestas: 0x8ab8e0 → 0x9aa5b0
- Faces e chunks: mesmo tom cinza

## Item 4 — Mancha escura no cubo sólido para quadrados removidos
- darkSpotsGroup: THREE.Group filho de solidGroup
- _updateDarkSpots() chamado em _returnToCube: cria PlaneGeometry escura para cada quadrado removido
- Posicionamento via tileGroup.localToWorld() para suportar todas as 6 faces
- Cor: 0x111111, opacity: 0.82

## Checklist
- [ ] chunk-manager.ts: InstancedMesh + hideSquare + getRemovedSquares + update(dt)
- [ ] scene-controller.ts: cores cinza, darkSpotsGroup, _updateDarkSpots, _onClick instanced, _onPointerMove instanced, chunkManager.update(delta) no loop
