# Núcleo inicial do Fretsense — etapa 03

**Estado:** implementação revisada somente por análise estática manual, sem confirmação em execução. A etapa 07 conectou este núcleo ao primeiro [treino jogável](./playable-training.md), e a etapa 08 ampliou o julgamento em [articulações e sustains](./articulations-and-sustains.md). As regras musicais permanecem em [gameplay-rules.md](./gameplay-rules.md).

Este documento registra a fundação da etapa 03. A etapa 04 acrescentou os adaptadores e o vínculo de entrada descritos em [entrada e preferências](./input-and-preferences.md). A etapa 05 acrescentou a projeção temporal da sessão, normalização de timestamps, áudio e calibração descritos em [relógio e calibração](./timing-and-calibration.md); a etapa 07 integrou esses recursos na área jogável.

## Módulos e contratos

| Módulo | Responsabilidade |
| --- | --- |
| `src/engine/domain` | Tipos, perfil congelado, validação de dados, limites e cópias imutáveis |
| `src/engine/generation` | `generateDrill`, configuração inicial e geração determinística |
| `src/engine/timing` | Conversões musicais, limite final da chart e porta `MonotonicClock` |
| `src/engine/session` | Snapshots, repetição/variação, buffer limitado e `TrainingSession` |
| `src/engine/judgment` | Julgamento inicial, eventos imutáveis e agregação básica da etapa 06 |

Os módulos usam TypeScript e imports locais. Relógio, identidade da tentativa e data civil são dependências fornecidas pelo coordenador; não há acesso a Vue, Pinia, dispositivos, armazenamento, áudio ou timers globais. As interfaces da etapa 01 continuam sendo os contratos compartilhados. Os adaptadores foram acrescentados nas etapas 04–05; o [julgador inicial](./initial-judgment.md), na etapa 06.

`parseDrillConfig(unknown)` valida e copia os campos reconhecidos da configuração. `generateDrill(unknown)` também verifica a geometria e as combinações suportadas pelo gerador antes de alocar notas. `createSessionSnapshot` valida perfis de dispositivo/calibração, suas referências e capacidades conhecidas antes de capturar configuração, chart, regras e contexto completos. Erros usam `EngineError`, com `code`, `path` e mensagem técnica; a interface deverá traduzi-los para o usuário.

Os dados capturados são cópias congeladas recursivamente. Alterações posteriores nos objetos fornecidos pelo chamador não alteram a tentativa. O perfil `FRETSENSE_V1_RULE_PROFILE` também é congelado em execução. A cópia admite somente dados simples finitos, sem ciclos, accessors ou propriedades simbólicas, com limites de profundidade e quantidade de valores.

## Geração e versões

O gerador é `initial-generator@1.0.0`, com o perfil `fretsense-v1@1.0.0`. Os dois padrões iniciais da etapa 03 têm versão `1.0.0` e aceitam apenas o nível `beginner`; a etapa 08 acrescentou um cenário-base misto na mesma versão do gerador sem alterar saídas antes suportadas:

| Padrão | Configurações suportadas |
| --- | --- |
| `ascending-descending` | Ao menos dois frets permitidos, notas simples e tamanho igual ao dobro da quantidade de frets. Técnicas `sequences`, `hopo`, `tapping` ou `sustains`; articulação uniforme `strum`, `hopo` ou `tap`, coerente com a técnica escolhida |
| `repeated-strum` | Uma máscara escolhida pela semente e repetida ao longo da tentativa. Técnicas `single-strum`, `alternate-strum`, `chords` ou `sustains`; articulação `strum`. Acordes de dois/três frets para `chords`; `alternate-strum` exige meta alternada e notas simples |
| `articulation-transitions` | Seis passos determinísticos entre nota simples, acorde duplo/triplo e `strum`/`hopo`/`tap`; cenário-base `mixed` para validar as transições do perfil, sem representar o catálogo procedural da etapa 09 |

A subida/descida conserva a repetição na inversão: com todos os frets, `G R Y B O O B Y R G`. Sustains podem acompanhar as articulações admitidas. A técnica `sustains` exige duração positiva. Uma cauda não ultrapassa o próximo início nem a extensão configurada; notas que não cabem inteiras em uma duração fixa são omitidas, sem encurtar caudas. Cada repetição identifica um trecho próprio; as metas alternadas reiniciam nesse trecho ou após o intervalo configurado sem notas.

`INITIAL_DRILL_CONFIG` usa todos os frets, 120 BPM, duas notas por semínima, padrão de dez notas, quatro repetições, strum automático e ausência de sustain. Isso representa 40 notas em 10 segundos musicais. As metas iniciais são precisão mínima de 90%, no máximo quatro erros e três tentativas consistentes, com articulação obrigatória. Essas metas são registradas; a decisão de progressão será implementada na etapa 13. Configurações `schemaVersion: 1` anteriores, sem o campo `automaticStrum`, continuam sendo interpretadas como modo manual.

A semente usa hash FNV-1a sobre unidades UTF-16 e PRNG inteiro local. O mesmo objeto de configuração normalizado, semente e versão gera os mesmos valores, IDs e ordem. O hash usado no ID da chart não é prova de igualdade nem identificador de sessão: a repetição compara os dados completos com a geração canônica.

`repeatSessionSnapshot` conserva exercício e contexto com outro ID de sessão. `varySessionSnapshot` exige uma semente diferente e preserva as demais condições. Uma nova semente **não garante notas diferentes**: a subida/descida e as transições-base são canônicas, e o padrão repetido tem um conjunto finito de máscaras. Importação de charts arbitrárias, migração de geradores antigos, níveis adicionais e composição procedural de padrões mistos permanecem fora desta etapa; versões não suportadas são rejeitadas explicitamente.

## Limites iniciais

Os valores estão centralizados em `ENGINE_LIMITS` e são decisões de implementação, sem medição de desempenho:

| Recurso | Limite |
| --- | --- |
| BPM | 40–300, finito |
| Resolução/subdivisões | 480 ticks por semínima; subdivisões 1, 2, 3, 4, 6 ou 8 |
| Padrão/repetições | Até 128 notas por padrão e 128 repetições |
| Tentativa | Até 4.096 notas, 1.440.000 ticks e 10 minutos musicais; todos os limites se aplicam conjuntamente |
| Entradas/julgamentos | Até 65.536 entradas e 131.072 registros de julgamento por tentativa |
| Interrupções | Até 64 registros por tentativa |
| Mapeamento | Até 64 bindings por perfil; controle físico sem duplicação |
| Offsets | De −1.000 a +1.000 ms, independentes para julgamento e imagem |
| Contagem inicial/retomada | Quatro semínimas no BPM da tentativa |
| Espera final pelo julgador | Até 5.000 ms ativos adicionais depois do limite final convertido para tempo bruto |

`BoundedBuffer` copia/congela cada item e rejeita excedentes antes de inseri-los, sem sobrescrever dados anteriores. A sessão possui seu próprio buffer de entradas; o limite de julgamentos está disponível para o produtor da etapa 06 e é verificado nos relatórios. Exceder entradas ou interrupções aborta com `resource-limit`. Não há tentativa musical infinita: o futuro treino contínuo deve encadear instâncias finitas, consumir seus resultados e liberar instâncias antigas.

## Tempo e ciclo da tentativa

`ticksToMilliseconds(ticks, bpm)` usa `ticks × 60000 / (bpm × 480)`. `millisecondsToTicks` permite posição fracionária e negativa para visualização. A chart continua usando ticks inteiros não negativos.

`TrainingSession` recebe `SessionServices`: `clock.nowMs()` finito e monotônico, `nextIdentity()` com ID inédito por tentativa e `utcNow()` em UTC ISO com milissegundos. Datas civis servem somente a metadados. O chamador deve garantir a unicidade global dos IDs; repetição/variação rejeitam reutilizar o ID da tentativa anterior. O núcleo não gera UUIDs nem lê a hora global.

| Operação | Efeito |
| --- | --- |
| `prepare` | De `idle` para `ready`, com snapshot válido |
| `enableInitialJudgment` | Em `ready`, ativa o julgador interno de strum, HOPO, tap, direção, acordes e caudas |
| `start` | De `ready` para `countdown` |
| `advance` | Atualiza contagem/tempo ativo; ao acabar a contagem passa a `running`, preservando atraso entre chamadas |
| `openInputWindow` | Na borda da contagem, passa a `running` pelo instante observado sem avançar o julgador antes da entrada |
| `pause` | De `countdown`/`running` para `paused`, congela o tempo e limpa o estado transitório de entrada |
| `resume` | De `paused` para nova contagem, exclusivamente por chamada explícita |
| `complete` | Encerra `running` depois do limite musical e de relatório com todas as notas/caudas resolvidas |
| `abort` | Encerra uma tentativa preparada com métricas disponíveis e motivo explícito |
| `restart` | Prepara outra instância com a mesma chart e encerra a atual com `restart`, caso ainda esteja ativa |
| `repeat` / `vary(seed)` | A partir de estado terminal, devolve outra instância em `ready` |
| `takeResult` | Entrega o resultado terminal uma vez; chamadas posteriores retornam `null` |

`getView` permite consultar estado e resultado imutável sem consumi-lo; `getSnapshot`, `getInputs`, `getEvaluation` e `getJudgments` expõem dados congelados. O relatório é `null` até haver avaliação, e os julgamentos ficam vazios sem julgador interno. Uma instância terminal não é reutilizada. Repetir chamadas de encerramento devolve o mesmo resultado e não o emite novamente.

Somente `running` aceita `recordInput`. Na preparação/contagem/pausa, `setInputBaseline` sincroniza frets mantidos sem criar ataques. Sequências começam em zero e crescem mesmo depois de pausas; timestamps podem empatar. Eventos precisam pertencer ao dispositivo capturado e à conexão corrente, respeitar as transições de máscaras e não anteceder o horizonte bruto já processado. Uma troca de conexão exige interrupção. A pausa limpa frets/conexão, preserva o contador de entradas e invalida a elegibilidade para progressão. Uma nova interrupção durante a contagem de retomada continua a interrupção aberta.

O coordenador deve entregar o lote capturado por `recordInput` antes de chamar `advance` para fechar seu horizonte; os adaptadores convertem timestamps para tempo ativo bruto. Com o julgador interno ativado, a sessão encaminha entradas/horizontes e recebe a avaliação internamente; `reportEvaluation` externo fica bloqueado para impedir dois produtores. O julgador subtrai `judgmentOffsetMs` uma única vez. O offset visual não participa do encerramento ou das métricas. Limpeza de entrada e cancelamento de áudio continuam sendo responsabilidades da integração; HOPO e sustains usam o mesmo relógio ativo desde a etapa 08.

Se o relógio recuar ou ficar inválido durante contagem/execução, a sessão pausa com `input-timing-invalid`; uma entrada afetada é rejeitada. Retomar exige uma leitura válida que não anteceda a última leitura aceita. Durante a pausa, `advance` não acumula tempo nem resolve notas.

## Encerramento e resultado

`SessionEvaluation` é a fronteira com o julgador: contém ID da tentativa, horizonte musical corrigido processado, métricas, quantidade de caudas pendentes/registros e disponibilidade dos dados. A porta externa continua verificando limites, contagens, razões, amostras e avanço dos relatórios quando não há julgador interno. A etapa 06 fornece um produtor próprio, ampliado na etapa 08; a validação de um relatório externo por si só não comprova sua origem.

Concluir exige ultrapassar estritamente o maior entre extensão da chart, último início mais a janela tardia e último fim de cauda, com todos os inícios/caudas resolvidos e relatório processado até o horizonte corrigido atual. Com o julgador inicial ativado, `advance` processa prazos e conclui automaticamente quando essas condições são atendidas, inclusive em um avanço tardio. Sem relatório conclusivo, a tentativa aborta com `evaluation-timeout` ao atingir a tolerância final de cinco segundos ativos, quando `advance` ou captura voltar a ser chamado. O núcleo não agenda tarefas nem encerra por tempo de parede enquanto estiver pausado.

Abandonos preservam o último relatório aceito; notas não resolvidas permanecem não julgadas. Sem relatório, todas as notas ficam não julgadas, as métricas derivadas são indisponíveis e a análise fica `not-performed`. O resultado informa retenção dos registros, inclusive entrada parcial por excesso de buffer. Cancelamento de caudas no abandono deverá ser relatado pelo julgador antes do encerramento. Caudas pendentes ou relatório anterior ao horizonte final impedem declarar registros completos; registros não gravados ou descartados mantêm esses estados.

Elegibilidade exige conclusão sem interrupções, captura iniciada e dados necessários às metas disponíveis. Não implica promoção, que também depende de precisão, erros e consistência futura. Resultados e diagnósticos da interface continuam indisponíveis até a integração; não foram criados dados demonstrativos ou métricas de execução nesta etapa.

## Revisão da entrega

Somente análise estática manual de imports, tipos, limites, fórmulas, geração, referências, imutabilidade e transições. Não foram criados ou executados testes, nem executados lint, formatação automática, build, typecheck, aplicação ou navegador. Confirmação de funcionamento permanece com o desenvolvedor, conforme `AGENTS.md`.
