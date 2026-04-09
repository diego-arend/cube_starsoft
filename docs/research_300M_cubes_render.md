Este planejamento atualizado foca na eficiência de memória e processamento, utilizando a restrição de **interação exclusiva no zoom máximo** como o principal motor de performance.

---

# Planejamento Técnico: Visualização de 300M de Cubos em Three.js

## 1. Arquitetura de Dados (Divisão Hierárquica)

Para gerenciar 300 milhões de cubos, dividimos o espaço em uma estrutura de **Grades de Chunks**. A interação só é liberada quando o campo de visão (Frustum) se limita a uma vizinhança reduzida.

### A Divisão Matemática
* **Grade de Chunks:** $64 \times 64 \times 64$ (Total de 262.144 chunks).
* **Densidade por Chunk:** $11 \times 11 \times 11$ (Total de 1.331 mini-cubos por chunk).
* **Volume Total:** **348.913.664 cubos** (Margem de segurança acima dos 300M).

---

## 2. Gerenciamento de Níveis de Zoom (LOD)

A lógica de renderização é ditada pela distância da câmera, alternando entre representações estáticas e dinâmicas.

| Nível de Zoom | Visibilidade | Estado de Interação | Técnica Three.js |
| :--- | :--- | :--- | :--- |
| **Baixo (Macro)** | Cubo Total / Grandes Blocos | **Bloqueada** | `Mesh` único ou instâncias low-poly. |
| **Médio (Navegação)** | Grade de Chunks | **Bloqueada** | `InstancedMesh` com frustum culling. |
| **Máximo (Micro)** | **4 Chunks na tela** | **ATIVA** | `InstancedMesh` Dinâmico + Raycasting. |

---

## 3. O Conceito de Interação Seletiva

Como a interação ocorre apenas no zoom máximo, otimizamos o pipeline para ignorar 99,99% dos cubos durante o cálculo de eventos.

### Fluxo de Interação no Zoom Máximo:
1.  **Filtragem por Frustum:** O Three.js identifica quais Chunks (objetos `InstancedMesh`) estão visíveis. No seu caso, o foco são **4 chunks**.
2.  **Raycasting Localizado:** O clique do usuário é testado apenas contra esses 4 objetos. 
    * **Custo de processamento:** O Raycaster avalia apenas ~5.324 instâncias ($4 \times 1.331$), uma operação executada em microssegundos.
3.  **Feedback Visual:** A alteração (ex: mudar cor de um cubo) é feita via `instanceMatrix` ou `instanceColor` diretamente no buffer da GPU, garantindo resposta instantânea.

---

## 4. Otimização de Performance e Memória

Para evitar que o navegador trave com o volume de dados, aplicamos três pilares:

### I. InstancedMesh (GPU Instancing)
Em vez de 300 milhões de objetos, temos 262.144 objetos de "instância". Cada objeto desses diz à GPU: "Desenhe este mesmo cubo 1.331 vezes nestas posições". Isso reduz drasticamente o número de *Draw Calls*.

### II. Memória "Lazy" (Preguiçosa)
* **Dados Inativos:** Cubos em zoom baixo não possuem dados individuais em memória RAM; são apenas fórmulas matemáticas de posição.
* **Dados Ativos:** Apenas quando o usuário faz o zoom máximo, os dados detalhados daqueles chunks específicos são "inflados" para permitir a interação.

### III. GPU Picking
Para máxima performance na interação, utilizamos o `instanceId` retornado pelo Raycaster. Isso permite identificar exatamente qual dos cubos dentro do chunk foi clicado sem precisar de objetos individuais no Scene Graph.

---

## 5. Resumo da Etapa Final (Zoom Máximo)

* **Objetos representados na tela:** 4 Chunks principais (mais eventuais chunks parciais nas bordas).
* **Total de mini-cubos processando interação:** ~5.324 cubos.
* **Experiência do Usuário:** Navegação fluida em um universo massivo, com precisão de clique e resposta tátil apenas onde o detalhe é visível.

---

> **Vantagem deste conceito:** Esta arquitetura permite que o projeto rode em hardware comum, pois a complexidade computacional no ponto de interação é constante, independente se o cubo total tem 300 milhões ou 3 bilhões de sub-elementos.