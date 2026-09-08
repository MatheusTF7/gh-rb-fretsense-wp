# Plano de refinamento da highway e da tela de jogo

**Estado:** planejamento; refinamentos visuais na etapa 15A, consolidação transversal na etapa 15B e extensão por edição na etapa 19.

Distribuição deste documento:

- a etapa 15A implementa os contratos visuais, a Frente A e as seções B1–B3;
- a etapa 15B revisa ciclo de vida/desempenho da Frente A e implementa a seção B4;
- a etapa 19 implementa a Frente C, uma edição pesquisada por vez.

## 1. Objetivo e limites

A tela de jogo deve ter leitura imediata e ritmo visual comparáveis aos jogos de
cinco frets que inspiram o Fretsense, preservando uma identidade própria. O
objetivo não é reproduzir assets ou afirmar equivalência sem evidência, mas
adotar os princípios que tornam esse tipo de interface legível: highway
dominante, profundidade, linha de acerto inequívoca, notas reconhecíveis,
feedback curto e HUD com baixa interferência.

Decisões de arquitetura:

- Vue/Quasar e DOM continuam responsáveis por HUD, menus, configuração,
  mensagens, foco, tradução e controles acessíveis.
- Canvas desenha a highway e efeitos sincronizados à gameplay. A tela inteira
  não deve ser transferida para Canvas.
- Canvas 2D permanece o backend inicial. PixiJS ou outro backend GPU somente
  entra após requisito visual concreto ou medição do desenvolvedor demonstrar
  que o backend otimizado não atende aos dispositivos-alvo.
- O renderer recebe snapshots; não escolhe candidata, não julga entrada, não
  recalcula combo e não aplica offsets por conta própria.
- Aparência e regras são contratos distintos. Um perfil de edição pode
  combiná-los explicitamente, sem esconder qual janela de julgamento foi usada.

## 2. Contratos propostos

### `HighwayPresentationProfile`

Contrato serializável e versionado que deve conter, no mínimo:

- identidade, versão e nome de exibição;
- projeção plana ou em perspectiva, ponto de fuga e margens seguras;
- ordem, largura, separação e cores/tokens das cinco pistas;
- posição e espessura da linha de acerto;
- velocidade visual e limites ajustáveis, independentes do BPM;
- geometria e símbolos de strum, HOPO, tap e acordes;
- largura, terminação e estados das caudas de sustain;
- linhas de subdivisão, tempos e compassos, quando aplicáveis;
- duração, intensidade e prioridade dos efeitos de acerto/erro;
- tokens do HUD relacionados à gameplay e política de movimento reduzido;
- capacidades obrigatórias do backend e fallback suportado.

### `HighwayRendererBackend`

Fronteira pequena para permitir evolução sem contaminar o restante da
aplicação:

1. preparar chart e perfil de apresentação;
2. redimensionar viewport e densidade;
3. desenhar um frame a partir do tempo visual e estado congelado;
4. atualizar eventos visuais sem alterar eventos musicais;
5. descartar observers, buffers, texturas e contexto.

O backend Canvas 2D é obrigatório na primeira versão refinada. Um backend
futuro precisa consumir o mesmo frame e produzir o mesmo significado visual.

### `GameReferenceStudy`

Registro versionado do estudo que sustenta um perfil de edição:

- identidade exata do jogo, edição, plataforma/região e revisão observada;
- fontes, método de observação, cenários e medições reproduzíveis;
- evidências separadas por capacidade, com estado `researched`,
  `developer-confirmed` ou `approximate`;
- conflitos, limitações, lacunas e escolhas autorais do Fretsense;
- data, responsável e versão do estudo.

### `GameEditionProfile`

Contrato versionado que liga uma experiência pesquisada:

- jogo, edição, plataforma/região e versão estudadas;
- referência ao `GameReferenceStudy` exato;
- `RuleProfile` exato;
- `HighwayPresentationProfile` exato;
- versões de gerador/catálogo compatíveis;
- capacidades atendidas, não atendidas e ainda desconhecidas.

O nome do jogo não é suficiente para identificar o perfil. Port, plataforma,
região ou revisão com comportamento diferente deve receber outro ID/versão.

## 3. Frente A — Highway em Canvas 2D

### A1. Estrutura visual

- Projetar pista trapezoidal com profundidade configurável e alternativa plana.
- Manter linha de acerto e alvos dos cinco frets como os elementos de maior
  contraste local.
- Adicionar linhas de tempo e de compasso sem competir com notas e caudas.
- Calcular tamanho/posição por uma função de projeção testável por inspeção,
  compartilhada por notas, sustains e grade.
- Reservar margens para que notas e efeitos não sejam cortados nos extremos.

### A2. Vocabulário das notas

- Manter as cinco cores, letras e posições como canais redundantes.
- Definir silhuetas consistentes para strum, HOPO e tap.
- Tratar acordes como uma unidade visual ligada horizontalmente, sem deixar de
  mostrar cada fret participante.
- Desenhar sustains atrás da cabeça, com estados normal, ativo, completo,
  quebrado e não avaliado claramente diferentes.
- Mostrar direção de strum sem tornar a seta o único indicador da nota.
- Garantir leitura de notas próximas e acordes em charts densas.

### A3. Feedback e movimento

- Criar eventos visuais derivados de `JudgmentEvent`: pulso curto de acerto,
  indicação antecipado/atrasado, miss, strum extra e sustain quebrado/completo.
- Definir prioridade para eventos simultâneos e um limite de efeitos ativos.
- Reutilizar estruturas/partículas simples em vez de alocar por frame.
- Fazer efeitos expirarem pelo tempo visual da sessão; pausa deve congelá-los.
- Em movimento reduzido, trocar deslocamento/partículas por mudança curta de
  contorno, brilho ou opacidade.

### A4. Desempenho e ciclo de vida

- Cachear estilos CSS e invalidá-los apenas quando tema/perfil mudar.
- Pré-renderizar símbolos e primitivas repetidas em offscreen canvas quando
  isso reduzir trabalho, sem tornar texto borrado na densidade atual.
- Separar conceitualmente fundo/grade estáticos, notas móveis e efeitos; usar
  múltiplas camadas apenas se a medição do desenvolvedor justificar.
- Preservar busca binária/culling e limitar densidade de pixels, objetos visíveis
  e efeitos simultâneos.
- Evitar `getComputedStyle`, medição de layout, criação de fontes, arrays e maps
  temporários em todo frame.
- Redimensionar fora do desenho normal, preservando proporção e nitidez sem
  reiniciar sessão ou alterar velocidade musical.
- Descartar `ResizeObserver`, RAF, buffers e recursos do backend ao trocar rota,
  tentativa ou renderer.

### A5. Critério para considerar PixiJS

Abrir uma decisão técnica separada somente se ao menos um item ocorrer:

- o estilo aprovado depende de muitos sprites, filtros, blend modes ou
  partículas simultâneas;
- a perspectiva exige mesh/shader que seria frágil ou cara no Canvas 2D;
- medições reproduzíveis do desenvolvedor mostram frames fora do orçamento nos
  dispositivos-alvo depois das otimizações acima;
- mais de um modo visual precisa de scene graph/asset pipeline que o backend
  atual não consegue manter com clareza.

Uma prova de conceito deve comparar Canvas e a alternativa com a mesma chart,
perfil visual, resolução e efeitos. Tamanho do bundle, inicialização, fallback,
perda/restauração de contexto e descarte entram na decisão; aparência isolada
não justifica a migração.

## 4. Frente B — Tela de jogo

### B1. Hierarquia e foco

- Highway ocupa a maior área e permanece central no campo visual.
- HUD primário mostra combo, progresso, BPM, modo e estado da tentativa.
- Precisão parcial e feedback textual não devem competir com a leitura da
  próxima nota; detalhes pertencem ao resultado.
- Contagem, pausa, interrupção e encerramento usam camadas distintas, com ação
  principal inequívoca e foco restaurado corretamente.
- Controles de reinício/saída ficam protegidos contra ativação acidental, mas
  nunca escondidos em estado sem recuperação.

### B2. Modos de layout

- Preparar um modo de foco que recolhe navegação e configurações durante a
  tentativa.
- Oferecer tela cheia apenas por gesto explícito, com estado e saída visíveis;
  falha ou indisponibilidade mantém o layout normal.
- Em desktop amplo, usar painel lateral compacto; em telas estreitas, mover
  informações secundárias abaixo ou para uma gaveta sem cobrir a highway.
- Congelar a geometria essencial durante `running`; alterações de viewport não
  mudam tempo, scroll speed musical ou julgamento.

### B3. Configurações visuais

- Velocidade visual independente do BPM, dentro de limites por perfil.
- Escala de notas, intensidade de perspectiva e contraste da grade.
- Intensidade de efeitos: completa, reduzida ou desativada.
- Alto contraste e movimento reduzido integrados às preferências existentes.
- Prévia das mudanças fora de uma tentativa; opções estruturalmente
  incompatíveis ficam bloqueadas durante `running`.

### B4. Acessibilidade

- Manter nome acessível resumido para a highway e evitar anúncios por nota.
- Comunicar contagem, pausa, interrupção e resultado em pontos controlados.
- Preservar navegação por teclado e foco visível nos controles DOM.
- Oferecer identificação redundante por cor, letra, número, forma e posição.
- Não usar Canvas para informação essencial sem equivalente textual no HUD
  ou resumo final.

## 5. Frente C — Perfis estudados por edição

Cada edição é um pequeno projeto de pesquisa antes de ser uma implementação.

### C1. Dossiê obrigatório

O dossiê deve registrar:

1. identidade exata do jogo, edição, plataforma/região, versão e data do
   estudo;
2. fontes com links/citações, tipo da fonte e limitações;
3. protocolo de observação ou medição reproduzível;
4. regras confirmadas, valores aproximados, divergências e lacunas;
5. screenshots/esquemas autorais de geometria, sem incorporar assets do jogo;
6. matriz de mecânicas suportadas pelo Fretsense;
7. responsável e estado da confirmação prática.

### C2. Gameplay a estudar

- janela antecipada/tardia e sua variação, se houver;
- desempate e associação de entradas a notas;
- frets adicionais, ancoragem e formação de acordes;
- strum extra, strum sem fret e direção;
- limiar/espaçamento de HOPO, tapping, repetições e recuperação após erro;
- início, tolerância, quebra e pontuação de sustains;
- combo, multiplicadores e demais efeitos que alterem o resultado observável.

O que não for confirmado permanece indisponível ou usa explicitamente uma
regra Fretsense declarada; nunca é inferido pelo estilo visual.

### C3. Apresentação a estudar

- perspectiva, ponto de fuga, largura/proporção e sentido da pista;
- linha de acerto, alvos, marcadores de tempo e densidade aparente;
- geometria, contorno e escala das notas por profundidade;
- representação de HOPO/tap, acordes e sustains;
- animações/efeitos de acerto, miss e ativação dos frets;
- posição e hierarquia do HUD;
- relação entre velocidade visual, BPM e opções do jogo estudado.

As implementações devem usar arte e áudio próprios. O perfil captura a
gramática visual e o comportamento documentado, não os recursos proprietários.

### C4. Seleção e snapshot

- O seletor simples oferece Fretsense ou uma edição estudada e aplica o par
  regras/apresentação correspondente.
- Antes de iniciar, o resumo mostra IDs/versões, janela de acerto e limitações.
- Um modo avançado pode combinar apresentação e regras diferentes, mas nomeia a
  tentativa como personalizada e explica que ela não replica uma edição.
- `SessionSnapshot`, persistência e relatórios guardam as três referências:
  edição opcional, regras e apresentação.
- Trocar qualquer regra ou apresentação estrutural encerra a tentativa atual.

## 6. Ordem sugerida

1. Definir os contratos de apresentação e backend sem mudar a aparência.
2. Migrar o Canvas atual para esses contratos e preservar o comportamento.
3. Eliminar trabalho repetido por frame e consolidar resize/descarte.
4. Criar a apresentação própria refinada do Fretsense.
5. Reorganizar HUD, overlays, foco e layouts responsivos.
6. Adicionar preferências visuais e alternativas acessíveis.
7. Encaminhar os cenários visuais e de desempenho ao desenvolvedor.
8. Somente depois iniciar o primeiro dossiê de uma edição externa.
9. Implementar e confirmar uma edição por vez antes de abrir a seguinte.

## 7. Critérios de aceite

- A mesma chart, regras, calibração e sequência de eventos normalizados produz
  os mesmos julgamentos com qualquer apresentação cosmeticamente compatível.
- Alterar a janela exige outro `RuleProfile` e fica visível no snapshot/resultado.
- Notas, acordes, articulações, caudas e linha de acerto continuam legíveis nos
  tamanhos-alvo e com movimento reduzido.
- Pausa, resize, troca de tema e modo de foco não avançam nem reiniciam o tempo.
- O Canvas não contém o único acesso a uma informação ou ação essencial.
- Cada perfil de edição aponta para seu dossiê, versões e incertezas.
- Resultados de regras incompatíveis não aparecem como diretamente comparáveis.
- Nenhum asset proprietário é necessário para reconhecer a linguagem visual.

A revisão do agente permanece exclusivamente estática. Avaliação de fluidez,
latência percebida, fidelidade visual e compatibilidade de dispositivos depende
de execução e confirmação pelo desenvolvedor.
