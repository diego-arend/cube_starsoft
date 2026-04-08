<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Arquitetura do viewer tridimensional de cubo com detalhamento progressivo

## Caso de uso

O caso de uso desta aplicação é a visualização, no navegador, de um cubo tridimensional composto logicamente por 3 milhões de quadrados distribuídos em chunks nas faces do cubo. O usuário não precisa de texturas, iluminação complexa nem interações de manipulação avançada; a experiência é restrita à inspeção visual do objeto com controles de zoom in, zoom out e observação tridimensional estável do cubo.[^1][^2][^3]

Em níveis mais distantes de zoom out, o cubo deve ser percebido como um sólido único, sem necessidade de expor subdivisões finas que não agregam leitura visual nesse contexto. À medida que o zoom avança, a visualização passa a revelar gradualmente a divisão das áreas quadradas da superfície, preservando a coerência espacial da navegação e evitando materializar detalhe excessivo cedo demais.[^3][^4][^1]

A partir de um determinado nível de zoom in, a renderização deixa de enfatizar o cubo como volume e passa a enfatizar a face observada, exibindo explicitamente os quadrados e as zonas associadas aos chunks daquela face. Esse comportamento transforma a aplicação em um viewer hierárquico de representação progressiva, no qual a forma global é priorizada de longe e a estrutura superficial é priorizada de perto.[^2][^5][^6][^3]

## Visão geral

Este documento descreve a arquitetura recomendada para uma aplicação web de visualização tridimensional de um cubo navegável, em que o usuário pode girar o objeto e aplicar zoom, com troca progressiva de representação conforme a distância da câmera. O objetivo é evitar a renderização permanente de milhões de quadrados, substituindo esse custo por níveis de detalhe visuais coerentes com o zoom e com a face efetivamente observada.[^5][^6][^2][^3]

A proposta usa Three.js como base da camada gráfica porque o framework oferece os elementos exatos necessários para esse caso de uso: cena 3D, câmera ortográfica, controle orbital, gerenciamento de objetos, geometrias por buffer e instancing quando apropriado, sem impor a complexidade de uma engine mais ampla do que a demanda funcional da aplicação.[^4][^2][^3]

## Objetivos do sistema

A aplicação deve atender a quatro objetivos centrais: navegação fluida em torno do cubo, leitura visual estável em diferentes níveis de zoom, custo previsível de renderização e simplicidade estrutural de manutenção. Como o produto não requer texturas, simulação física ou visualização volumétrica complexa, o foco de engenharia deve estar na troca de representação, na gestão de visibilidade e na eficiência geométrica.[^2][^3][^4][^5]

Também é importante que o sistema escale para grandes quantidades lógicas de quadrados sem precisar materializar todos eles na GPU ao mesmo tempo. Isso exige separação clara entre modelo de dados e representação renderizada, permitindo que apenas a parcela relevante para o estado atual da câmera seja ativada visualmente.[^6][^7][^4][^2]

## Justificativa pelo Three.js

Three.js é a escolha mais adequada porque oferece um conjunto maduro de primitives para visualização 3D interativa no browser, com baixo atrito para implementar câmera ortográfica, órbita controlada e atualização seletiva da cena. Esse perfil casa melhor com um viewer técnico do que com uma engine mais opinativa ou orientada a casos de uso mais amplos.[^3][^4][^5][^2]

Outro motivo importante é a flexibilidade da camada de geometria. A aplicação precisa alternar entre um cubo sólido, uma face plana e uma grade detalhada, e essa variação é mais bem tratada com grupos de objetos, geometrias consolidadas e mecanismos de culling do que com uma abstração pesada de mundo ou cena de jogo.[^7][^4][^6][^2]

A câmera ortográfica tem papel central nessa decisão, porque ela preserva leitura geométrica e reduz distorção perceptiva em um caso de uso que se aproxima mais de inspeção técnica do que de navegação imersiva. Já o suporte a `InstancedMesh` e geometrias por buffer permite escolher a estratégia de desenho adequada por nível de detalhe sem multiplicar objetos na árvore da cena desnecessariamente.[^1][^5][^7][^2]

## Princípios de projeto

A arquitetura deve seguir cinco princípios principais: representação progressiva, separação entre dados e renderização, atualização incremental, visibilidade explícita e previsibilidade de transição entre estados. Esses princípios reduzem risco de gargalos de CPU e GPU e tornam o comportamento da aplicação mais estável durante interações contínuas de zoom e rotação.[^4][^6][^2][^3]

A regra mais importante é que o sistema não deve tratar o cubo como um conjunto de milhões de elementos sempre visíveis. Em vez disso, ele deve tratar o cubo como uma entidade lógica única com múltiplas representações renderizáveis, escolhidas conforme o contexto visual atual.[^6][^7][^2][^4]

## Estratégia de representação

A visualização deve ser organizada em três níveis principais de detalhe visual. No nível distante, o usuário vê apenas um cubo sólido; no nível intermediário, o sistema promove a face orientada para a câmera a uma representação plana; no nível próximo, essa face é detalhada em quadrados e chunks 2D renderizados sob demanda.[^5][^3][^6]

Essa estratégia é superior a uma renderização uniforme porque o observador não consegue perceber subdivisão fina quando está distante, e não precisa ver o volume completo quando está analisando uma única face de perto. O resultado esperado é uma aplicação mais leve, mais previsível e mais alinhada ao comportamento real do usuário.[^3][^4][^5][^6]

## Níveis de detalhe

### LOD distante

No estado mais afastado, a aplicação deve exibir um único cubo sólido como mesh simplificado. Esse nível existe para minimizar draw calls, evitar custo geométrico desnecessário e comunicar ao usuário a forma global do objeto com máxima estabilidade visual.[^2][^4][^6]

### LOD intermediário

Ao cruzar um threshold de zoom, a aplicação deve substituir a visão puramente sólida por uma leitura orientada à face dominante, isto é, a face mais alinhada ao vetor de visão da câmera. Nesse estágio, a representação ainda pode ser econômica, mostrando um plano limpo da face com contorno ou subdivisão agregada, sem ativar ainda o custo completo da grade detalhada.[^4][^5][^6][^2]

### LOD próximo

No estado de zoom mais próximo, a aplicação deve ativar a representação detalhada da face ativa, subdividida em quadrados renderizados por tiles ou chunks 2D. Esse nível deve ser restrito à superfície relevante e à área visualmente útil, para impedir que o sistema carregue detalhes que não estão contribuindo para a leitura da interface naquele instante.[^7][^6][^2][^4]

## Câmera e navegação

A navegação deve ser construída sobre câmera ortográfica e controles orbitais com foco exclusivo em rotação ao redor do centro do cubo e ajuste de zoom. Essa combinação é a mais consistente com um viewer geométrico, porque mantém a leitura dimensional estável e simplifica a relação entre nível de zoom e tamanho aparente da face observada.[^1][^5][^3]

Os limites de zoom e de rotação devem ser definidos explicitamente para preservar a usabilidade e a coerência dos estados de representação. Também é recomendável evitar transições abruptas em posições limítrofes da câmera, adotando faixas controladas para cada estado visual.[^8][^5][^3]

## Decisão por estado visual

A troca entre sólido, face plana e grade detalhada deve ser responsabilidade de um gerenciador de representação guiado por thresholds de zoom e por orientação da câmera. O sistema não deve depender de decisões implícitas do renderer, porque a previsibilidade visual e o controle de custo exigem uma política explícita de ativação e desativação de grupos de cena.[^6][^3][^4]

É recomendável usar histerese entre thresholds de entrada e saída para evitar flickering quando o usuário navega próximo da fronteira entre dois níveis de detalhe. Essa medida simples melhora bastante a sensação de continuidade da interface e reduz atualizações desnecessárias da cena.[^8][^3][^4]

## Seleção da face ativa

Quando a aplicação entra em modo de face, ela deve identificar a face do cubo com maior alinhamento em relação à direção de visão. Essa face passa a ser a superfície de inspeção principal, enquanto as demais deixam de competir pelo orçamento de renderização detalhada.[^5][^4][^6]

Esse desenho traz dois benefícios práticos: simplifica a leitura do usuário e reduz a área de processamento fino. Como o caso de uso é inspeção de superfície, e não exploração de interior ou de múltiplas faces simultaneamente, concentrar a representação detalhada em uma única face é a decisão mais racional.[^2][^4][^5][^6]

## Chunks bidimensionais por face

A aplicação deve abandonar a ideia de chunking volumétrico 3D e adotar chunking 2D por face no nível detalhado. Essa mudança reduz complexidade estrutural, porque o sistema deixa de gerenciar profundidade e passa a lidar apenas com partições da superfície efetivamente visível.[^7][^4][^6][^2]

Cada face pode ser dividida logicamente em tiles quadrados de tamanho fixo, ativados conforme zoom, enquadramento e região visível da câmera. Isso permite atualização incremental, caching de geometria e descarte seletivo sem reprocessar a face inteira a cada mudança pequena de navegação.[^4][^6][^7][^2]

## Organização da cena

A cena deve ser organizada em grupos independentes para permitir alternância rápida de visibilidade e manutenção clara do ciclo de vida dos objetos. Uma organização recomendada inclui um grupo para o cubo sólido, um grupo para faces planas simplificadas e um grupo para chunks detalhados da face ativa.[^6][^2][^4]

Com essa separação, a troca de representação pode ser feita principalmente por mudanças de visibilidade e substituição seletiva de subconjuntos da cena, evitando reconstruções globais frequentes. Essa decisão favorece manutenção, testes e previsibilidade de performance.[^3][^2][^4][^6]

## Camada de geometria

A camada de geometria deve priorizar estruturas consolidadas em vez de milhares de objetos independentes. Em termos arquiteturais, isso significa trabalhar preferencialmente com geometrias por chunk 2D e usar instancing apenas quando a repetição estrutural realmente compensar a estratégia escolhida.[^7][^2]

Essa escolha reduz custo de gerenciamento de cena, consumo de memória e overhead de atualização. Também mantém a aplicação aderente ao tipo de otimização para o qual Three.js oferece mecanismos maduros e bem documentados.[^2][^4][^7]

## Culling e visibilidade

Mesmo sendo um viewer visualmente simples, a aplicação deve usar culling por frustum e regras adicionais de visibilidade no nível dos chunks da face detalhada. Não há ganho em manter ativos tiles fora do enquadramento útil da câmera ou pertencentes a representações incompatíveis com o zoom corrente.[^9][^4][^6]

A combinação entre seleção da face ativa, chunking 2D e culling explícito é um dos principais fatores para escalar a solução sem aumentar drasticamente o custo de renderização. Esse é o ponto em que a simplicidade visual do produto se transforma em vantagem arquitetural real.[^3][^4][^6][^2]

## Modelo de dados

O modelo de dados deve ser independente da camada gráfica e representar o cubo como entidade lógica, com metadados suficientes para descrever suas faces, divisões e chunks sem exigir sua materialização total em memória gráfica. Em outras palavras, renderização deve ser tratada como projeção seletiva de dados, não como sinônimo do estado completo da aplicação.[^4][^6][^7][^2]

Esse desacoplamento facilita escalabilidade e evolução futura. Caso a aplicação passe a incorporar filtros, estados por célula ou atributos visuais adicionais, o impacto arquitetural será menor se os dados não estiverem acoplados diretamente aos objetos da cena.[^7][^2][^4]

## Pipeline de atualização

O pipeline de atualização deve seguir uma sequência estável: processar entrada do usuário, atualizar câmera, recalcular estado visual, escolher a face ativa, definir chunks necessários, atualizar a cena e renderizar. Essa ordem reduz inconsistências, evita trabalho redundante e facilita observabilidade durante testes e profiling.[^6][^2][^3][^4]

A aplicação deve evitar reconstrução ampla por frame. O custo pesado deve ocorrer apenas quando há mudança material de zoom, orientação dominante ou conjunto visível de chunks, e mesmo nesses casos a atualização deve ser incremental sempre que possível.[^3][^4][^6][^7]

## Componentes técnicos

Uma decomposição recomendada da aplicação inclui os seguintes componentes:


| Componente | Responsabilidade principal |
| :-- | :-- |
| Scene Controller | Inicialização do renderer, cena, resize e ciclo de renderização.[^4][^3] |
| Camera Controller | Gestão de câmera ortográfica, zoom e órbita controlada.[^3][^5] |
| Representation Manager | Decisão entre cubo sólido, face plana e grade detalhada.[^6][^3] |
| Face Selection Manager | Determinação da face ativa com base na orientação da câmera.[^5][^6] |
| Chunk Manager | Ativação, descarte, cache e atualização de chunks 2D da face ativa.[^7][^2] |
| Data Model | Estrutura lógica das faces, quadrados e particionamento.[^7][^2] |

Essa divisão facilita isolamento de responsabilidades e evolução incremental da aplicação. Também favorece testes mais objetivos, já que a lógica de decisão não fica espalhada diretamente dentro do loop de renderização.[^4][^6][^3]

## Fluxo de dados

O fluxo de dados deve partir da interação do usuário e percorrer uma cadeia de decisão curta e explícita. O movimento de câmera atualiza os parâmetros de visualização; esses parâmetros alimentam o gerenciador de representação; o gerenciador determina o modo visual; a seleção de face e o gerenciador de chunks definem o subconjunto necessário de geometria; por fim, a cena é atualizada e renderizada.[^5][^6][^3][^4]

Esse fluxo reduz acoplamento e ajuda a manter consistência entre intenção do usuário e resultado visual. Em um viewer com poucos tipos de interação, clareza de fluxo vale mais do que abstrações excessivas.[^2][^6][^3][^4]

## Estratégia de performance

A estratégia de performance deve se concentrar menos em “otimizações micro” e mais em evitar trabalho desnecessário estruturalmente. Os pilares são: poucos níveis de detalhe, poucas transições de estado, poucas geometrias ativas por vez e nenhuma materialização global do conjunto de quadrados.[^6][^7][^2][^4]

Dentro dessa lógica, as medidas mais relevantes são: ativar apenas a representação compatível com o zoom atual, detalhar apenas a face ativa, dividir a face detalhada em chunks 2D, manter cache dos chunks recentes e atualizar a cena apenas quando houver mudança real de estado visual ou enquadramento.[^2][^3][^6]

## Riscos técnicos

O principal risco técnico não está na renderização do cubo sólido, mas nas transições e no gerenciamento da face detalhada sob zoom contínuo. Sem thresholds bem calibrados e política estável de seleção da face ativa, a aplicação pode apresentar trocas desconfortáveis, oscilação de estado e recomputações frequentes.[^8][^3][^6]

Outro risco é deixar a modelagem lógica contaminar a cena com objetos pequenos demais ou numerosos demais. Esse problema costuma surgir quando a estrutura conceitual dos quadrados é espelhada diretamente como objetos de renderização, em vez de passar por uma camada de consolidação geométrica.[^7][^4][^2]

## Observabilidade e testes

O sistema deve ser projetado com métricas mínimas de observabilidade desde o início, incluindo contagem de chunks ativos, quantidade de grupos visíveis, tempo médio de atualização de estado e tempo de renderização por frame. Esses indicadores ajudam a separar gargalos de lógica de decisão, custo de atualização da cena e custo puro de renderização.[^3][^4][^6][^2]

Nos testes funcionais, os cenários prioritários devem validar estabilidade das transições de zoom, consistência da face ativa e ausência de flickering próximo aos thresholds. Já nos testes de performance, o foco deve estar na carga máxima de chunks detalhados simultaneamente visíveis e no comportamento da aplicação sob rotação contínua e zoom repetido.[^8][^5][^2][^3]

## Roadmap recomendado

Uma ordem segura de implementação é a seguinte:

1. Construir o núcleo da cena com cubo sólido, câmera ortográfica e controles orbitais.[^5][^3]
2. Implementar o gerenciador de estados visuais e os thresholds de zoom com histerese.[^8][^3]
3. Implementar seleção da face ativa baseada na orientação da câmera.[^5][^6]
4. Adicionar a representação plana simplificada das faces.[^4][^6]
5. Implementar chunking 2D da face ativa e ativação seletiva dos chunks.[^7][^2]
6. Consolidar políticas de culling, cache e atualização incremental.[^9][^4]
7. Instrumentar métricas e realizar tuning fino de thresholds e tamanho de chunk.[^2][^3]

Essa ordem reduz risco porque antecipa as decisões estruturais mais importantes e posterga a complexidade do nível detalhado até que navegação e transições já estejam estáveis.[^5][^3]

## Recomendação final

A recomendação arquitetural é implementar a solução como um viewer 3D orientado a representação progressiva, usando Three.js como camada gráfica e tratando o cubo como uma entidade lógica com múltiplos estados visuais. Essa abordagem é mais adequada do que uma engine voxel completa porque o caso de uso exige inspeção geométrica controlada, não simulação de mundo nem riqueza visual de cena.[^3][^4][^5][^2]

Em termos práticos, o sucesso da implementação dependerá menos do motor em si e mais de três decisões estruturais: thresholds estáveis de zoom, seleção correta da face ativa e chunking 2D eficiente para o nível detalhado. Com essas bases, o sistema tende a permanecer simples de evoluir, previsível em performance e alinhado ao comportamento esperado do usuário.[^6][^4][^5][^2][^3]
<span style="display:none">[^10][^11][^12][^13][^14][^15]</span>

<div align="center">⁂</div>

[^1]: https://threejs.org/docs/pages/OrthographicCamera.html

[^2]: https://threejs.org/docs/api/en/objects/InstancedMesh.html

[^3]: https://threejs.org/docs/pages/OrbitControls.html

[^4]: https://threejs.org/docs/

[^5]: https://discourse.threejs.org/t/orthographic-camera-views-w-orbitcontrols/23813

[^6]: https://discourse.threejs.org/t/is-there-an-object3d-poperty-to-check-if-its-within-camera-frustum/24751

[^7]: https://contextqmd.com/libraries/three-js/versions/latest/pages/docs/pages/InstancedMesh

[^8]: https://stackoverflow.com/questions/55814148/three-js-orthographic-camera-position-not-updating-after-zoom-with-orbitcontrol

[^9]: https://stackoverflow.com/questions/77752772/threejs-object3d-frustumculled/78494801

[^10]: https://discourse.threejs.org/t/debugging-culling-in-instancedmesh-and-orthographic-camera/46146

[^11]: https://www.threejs-blocks.com/docs/ComputeInstanceCulling

[^12]: https://discourse.threejs.org/t/instancedmesh2-easy-handling-and-frustum-culling/58622

[^13]: https://github.com/mattdesl/three-orbit-controls/issues/1

[^14]: https://discourse.threejs.org/t/how-to-do-frustum-culling-with-instancedmesh/22633

[^15]: https://dustinpfister.github.io/2018/05/17/threejs-camera-orthographic/

