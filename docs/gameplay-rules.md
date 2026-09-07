# Regras de gameplay do Fretsense

**Perfil:** `fretsense-v1` · **Versão:** `1.0.0` · **Registro:** 2026-09-07.  
**Estado:** especificação, contratos, núcleo inicial e adaptadores de teclado/Gamepad revisados por análise estática manual. Relógio da plataforma e julgamento destas regras permanecem nas etapas 05–08 do [plano de desenvolvimento](./fretsense-development-plan.md). O escopo já implementado está descrito em [núcleo inicial](./engine-foundation.md) e [entrada e preferências](./input-and-preferences.md), sem confirmação em execução.

Este é um perfil próprio de treinamento, sem equivalência declarada com versões de Guitar Hero, Rock Band ou outros jogos. Seus números são decisões iniciais do produto, não medições de hardware. A referência em código é [`FRETSENSE_V1_RULE_PROFILE`](../src/engine/domain/rules.ts).

## 1. Limites do perfil e versionamento

- Cinco frets, notas simples e acordes de dois ou três frets. Não há notas abertas, acordes de quatro/cinco frets ou mecanismos especiais de pontuação.
- Correspondência exata de frets. Frets adicionais e ancoragem não são tolerados. Essas alternativas exigirão políticas explícitas em uma nova versão; não são opções já implementadas.
- `strum`, `hopo` e `tap` pertencem a cada nota. Acordes usam somente `strum` nesta versão. Notas de qualquer articulação admitida podem ter sustain.
- BPM constante por tentativa, resolução de 480 ticks por semínima e subdivisões `1`, `2`, `3`, `4`, `6` e `8` por semínima. Mudança de BPM inicia outra tentativa.
- Inícios simultâneos são um único acorde. Duas notas com o mesmo tick são uma chart inválida, mesmo com frets diferentes. Na chart, não há sobreposição de sustains, nem outro início estritamente antes do fim de uma cauda.
- Regras, padrão e gerador têm ID e versão independentes. Configurações e registros têm `schemaVersion: 1`. Alterações de julgamento, janelas, métricas ou comparabilidade exigem revisão da versão correspondente; correções de texto sem mudança semântica não exigem.
- A janela padrão é de **120 ms antes e 120 ms depois**, com ambas as bordas inclusivas. Janelas personalizadas futuras precisam de outro perfil identificado e capturado por inteiro no snapshot, sem modificar o objeto padrão ou resultados antigos.

## 2. Representação musical e configuração

| Conceito | Convenção |
| --- | --- |
| Frets | `G=1`, `R=2`, `Y=4`, `B=8`, `O=16`; posições 1–5 nessa ordem |
| Máscara | Inteiro de `0` a `31`; `0` significa nenhuma tecla de fret ativa e não é uma nota |
| Acorde | Uma `ChartNote` com dois/três bits, um ID, uma articulação, uma duração e um resultado de início |
| Posição e duração | `tick` inteiro não negativo; `durationTicks=0` para nota sem cauda |
| Identidade | IDs não vazios, únicos na chart e estáveis para a mesma configuração, semente e versão do gerador |
| Origem | Trecho, padrão, técnica e índice de repetição baseado em zero; a origem não muda a regra musical |
| Ordem | `Chart.notes` em ordem crescente de tick; seu índice é a ordem canônica de desempate |
| Extensão | `Chart.lengthTicks` inclui pausas musicais e caudas; cada início é menor que a extensão e cada fim é menor ou igual a ela |

`DrillConfig` contém técnica, nível, padrão versionado, BPM, subdivisão, frets permitidos, tamanho do padrão, articulação, tamanho de acorde, duração de sustain, metas, semente e referência do perfil. `length` escolhe **repetições ou duração em ticks**; não aceita os dois limites concorrentes. Treino contínuo será uma sequência de tentativas finitas.

Em uma duração fixa, o gerador só pode incluir notas inteiras que caibam na extensão, incluindo caudas. Não encurta sustains silenciosamente. `articulation: 'mixed'` delega a escolha de cada nota ao padrão versionado. Metas de direção são materializadas em `expectedStrumDirection` por nota de `strum`; nas demais articulações esse campo é `null` neste perfil.

Todas as grandezas numéricas precisam ser finitas; ticks, contadores, índices e sequências são inteiros nos intervalos correspondentes. BPM, extensão, tamanho do padrão, repetições e quantidade de tentativas consistentes são positivos; razões ficam em `[0, 1]`, limites de erros são não negativos. Uma chart precisa conter ao menos uma nota. Frets de cada nota devem estar contidos em `allowedFrets`; valores de quantidade de bits e articulação também precisam respeitar o perfil. A etapa 03 implementou validação e limites iniciais em `ENGINE_LIMITS`, detalhados no [núcleo inicial](./engine-foundation.md), sem presumir que um objeto tipado já foi validado.

## 3. Relógio, offsets e ordenação

### Referência única

O tempo ativo bruto da sessão, `sessionTimeMs`, é monotônico, começa em zero ao entrar em `running` e exclui pausas e contagens de entrada/retomada. Pausas musicais dentro da chart continuam contando. Datas ISO são apenas metadados de histórico. O motor usa milissegundos, admite frações e não usa datas civis para julgar.

As conversões obrigatórias são:

```text
noteTimeMs = tick × 60000 / (bpm × ticksPerQuarter)
noteEndMs = (tick + durationTicks) × 60000 / (bpm × ticksPerQuarter)
judgedInputMs = sessionTimeMs - judgmentOffsetMs
judgedNowMs = activeClockMs - judgmentOffsetMs
timingErrorMs = judgedInputMs - noteTimeMs
visualTimeMs = activeClockMs - visualOffsetMs
```

Offset de julgamento **positivo** compensa uma entrada observada tarde. Por exemplo, uma entrada bruta em `1030 ms`, com offset `+30 ms`, é julgada em `1000 ms`. O adaptador fornece tempo bruto normalizado; o julgador subtrai o offset uma única vez e aplica a mesma transformação ao avanço do relógio para expiração. Tempos corrigidos negativos são válidos. O gráfico de timing mostra erro negativo como antecipação e positivo como atraso; zero significa coincidência exata, sem uma faixa extra de “perfeito”.

Offset visual **positivo** atrasa a imagem: a highway usa um tempo menor e as notas chegam à linha depois. Esse ajuste não modifica o relógio musical, os timestamps das entradas ou o julgamento. Áudio usa o tempo bruto musical; o adaptador converte milissegundos em segundos e ancora o agendamento no relógio de áudio. Não soma novamente o offset de julgamento ao áudio.

Perfis de calibração padrão têm ambos os offsets em zero e `sampleCount=0`. Calibração guiada inicial é `guided-combined`: estima uma compensação conjunta, sem afirmar que separou latências de áudio, vídeo e entrada. O snapshot guarda método, valores, dispositivo/versionamento e contexto de saída. Uma saída sem ID identificável usa `null`, nunca uma identidade presumida. Alterar esse contexto exige revisão da calibração e uma nova tentativa.

### Admissão e ordem dos eventos

1. Só o dispositivo selecionado alimenta a tentativa. Cada evento traz perfil, conexão, origem e uma sequência inteira crescente, iniciada em zero e preservada após pausas.
2. `sessionTimeMs` nunca recua; empates são permitidos. A ordem total é `(sessionTimeMs, sequence)`. Eventos no mesmo instante mantêm a ordem observada, sem agrupar ações independentes para facilitar acertos.
3. `activeFrets` é o estado **depois** da atualização; `pressedFrets = active & ~previous & 31` e `releasedFrets = previous & ~active & 31`. Não se inventam transições intermediárias em uma amostra de Gamepad.
4. Um strum é uma borda de acionamento, exige retorno ao neutro antes do próximo e não se repete por manutenção do botão/tecla. `strum: null` significa ausência; `strum: 'unknown'` é uma ação real sem direção observável.
5. O adaptador converte timestamps de dispositivo para a referência comum. Se o timestamp não for utilizável, retroceder ou anteceder o horizonte já entregue ao motor, usa o instante de observação e registra `timeSource: 'observation'`. Nunca reabre uma nota já julgada. Se nem a observação mantiver o relógio coerente, interrompe com `input-timing-invalid`.
6. A captura entrega os eventos disponíveis até um horizonte bruto antes de avançar o motor até esse horizonte. Antes de cada evento, processam-se os prazos em ordem musical: expiram apenas notas cujo limite tardio seja **estritamente menor** que o tempo corrigido do evento, e concluem-se caudas cujo fim seja menor ou igual a ele. Ao final do lote, o relógio processa os prazos restantes já alcançados mesmo sem entrada, com as mesmas desigualdades.
7. Caudas que chegam ao seu fim são concluídas antes de entradas naquele mesmo instante. Em uma entrada, primeiro se atualizam frets/sustains ativos e depois se julga o possível início. Strum tem prioridade sobre a transição de frets do mesmo evento: cada entrada pode consumir no máximo um início.

Uma expiração registra o instante musical do limite tardio em `JudgmentEvent.timeMs`, embora sua emissão só aconteça depois de ultrapassá-lo. A sequência de saída desempata efeitos no mesmo instante; não precisa coincidir com a sequência de entrada. Falhas de uma mesma entrada que afetem uma cauda anterior e outro início são fatos distintos, com IDs de nota distintos.

Em uma amostra com múltiplas bordas de strum distintas, o adaptador emite um evento por borda, no mesmo timestamp e na ordem dos respectivos `bindings`. Só o primeiro carrega as transições de frets; os demais preservam a máscara ativa e usam máscaras pressionadas/liberadas zeradas. Isso não presume uma ordem física entre bordas observadas juntas. Uma única borda física não é duplicada por mapeamentos conflitantes. Perfis de teclado usam controles `key`; perfis Gamepad usam `button`/`axis`. Limiares usam magnitude normalizada, com `0 <= releaseThreshold < pressThreshold <= 1`; eixos aplicam antes o sentido configurado. A validação de mapeamento e os adaptadores ficam na etapa 04.

## 4. Associação, acerto, expiração e combo

Para uma nota no instante `N`, a janela é `[N - 120, N + 120]` na linha de tempo corrigida. O julgador primeiro trata as expirações anteriores, depois seleciona a **primeira nota pendente em ordem musical dentro da janela**, sem filtrar por fret, articulação ou direção. Se janelas se sobrepõem, a mais antiga tem precedência, mesmo que uma posterior esteja mais próxima ou tenha frets iguais à entrada. O índice canônico da chart desempata candidatas; ticks duplicados são rejeitados na validação deste perfil.

| Situação | Resultado musical | Combo/cadeia HOPO |
| --- | --- | --- |
| Strum com candidata e máscara exata | `note-hit`, consumindo o início uma vez; articulação conforme a seção 5 | Combo +1; arma a cadeia |
| Strum com candidata e frets incorretos | `note-miss / wrong-frets`, consumindo o início; registrar bits ausentes e extras | Zera combo e desarma cadeia |
| Strum sem candidata | `extra-strum`, sem nota associada | Zera combo e desarma cadeia |
| Transição elegível de tap/HOPO com máscara exata | `note-hit`, consumindo um início | Combo +1; cadeia conforme a seção 5 |
| Transição incorreta ou sem articulação elegível | Nota continua pendente; entrada permanece no registro para análise | Preserva combo e cadeia, salvo quebra de sustain |
| Relógio estritamente depois de `N + 120` | `note-miss`, consumindo um início pendente | Zera combo e desarma cadeia |

Um strum incorreto associado não gera também um strum extra nem um segundo miss por expiração. `missingFrets = expected & ~active & 31` e `extraFrets = active & ~expected & 31`. Ambos os detalhes pertencem ao mesmo erro do acorde. Entradas antecipadas/tardias fora da janela não acertam: strums sem outra candidata são extras; transições isoladas não geram penalidade imediata.

Na expiração, a causa é `missing-strum` se houve, dentro da janela, uma transição chegando aos frets exatos enquanto a nota exigia strum (`strum` ou HOPO sem elegibilidade). Caso contrário, é `window-expired`. Isso registra evidência observada, sem supor intenção. Expiração não tem entrada causadora nem erro temporal medido: esses campos são `null`. Notas já consumidas nunca são reconsideradas.

O combo começa em zero, cresce uma vez por início acertado e guarda seu maior valor. Miss, strum extra e quebra de sustain zeram o combo; zerá-lo quando já está em zero continua sendo um evento de erro, sem valores negativos. Técnica falha ou indisponível não muda o acerto nem o combo. O perfil não define score ou multiplicadores nesta etapa.

## 5. Articulações, acordes e direção

### Strum e acordes

`strum` exige uma nova ação de strum e a máscara exata no mesmo evento. Apenas formar ou manter os frets não acerta a nota. Acordes podem ser preparados gradualmente **antes** da palhetada, desde que todos os frets esperados estejam ativos nela. A tolerância para completar frets **depois** do strum é `0 ms`; não há acerto retroativo. Não se exige que todos os botões tenham sido pressionados no mesmo timestamp.

### Tap e notas repetidas

Um tap usa uma transição real de frets, com ao menos um bit pressionado ou liberado, cujo estado final seja exatamente o esperado. Soltar um fret adicional para chegar à nota também é uma transição válida, salvo a restrição de repetição a seguir. Apenas manter a máscara não acerta outras notas. Quando a nota anterior na chart tem os mesmos frets e foi acertada, repetir sem strum exige liberar o próprio fret alvo depois daquele acerto e pressioná-lo novamente no evento de acerto atual. A liberação pode preceder a janela da próxima nota, mas o novo pressionamento precisa estar dentro dela. Pressionar e soltar apenas um fret adicional enquanto mantém o alvo não satisfaz essa repetição.

Um strum com frets corretos também pode acertar musicalmente uma nota de tap; a articulação recebe `failed / strum-used-for-tap`. Isso permite distinguir acerto de execução técnica. Tap acertado por transição não arma a cadeia HOPO e a desarma se estiver armada; tap acertado por strum arma a cadeia.

### HOPO

A cadeia começa desarmada. HOPO por transição exige cadeia armada, início imediatamente anterior na chart acertado e máscara diferente da nota anterior. A transição pode pressionar ou liberar frets e precisa terminar na máscara exata. Não há limite adicional de distância em ticks: a elegibilidade musical já está explicitada na articulação de cada nota.

Qualquer início acertado por strum arma a cadeia; um HOPO elegível acertado por transição a mantém. Miss, strum extra, quebra de sustain e pausa a desarmam. Uma nota HOPO com os mesmos frets da anterior **sempre exige strum**, inclusive após soltar/pressionar. A primeira nota de uma tentativa HOPO e a recuperação após erro também exigem strum.

Strum necessário para início, repetição ou recuperação satisfaz a articulação. Strum voluntário quando o HOPO já poderia ser executado por transição acerta a nota, mas registra `failed / voluntary-strum-on-hopo`. A falha técnica não desarma a cadeia nem reescreve o combo. Uma transição sem a elegibilidade exigida mantém a nota pendente para recuperação por strum dentro da janela.

### Direção do strum

Direção é uma meta técnica independente. `expectedStrumDirection: null` significa `not-applicable`. Uma direção conhecida diferente da esperada registra falha técnica; `unknown` registra `not-evaluated / unknown-strum-direction`, preservando o acerto musical. Capacidade desconhecida nunca é um acerto técnico presumido, e o dispositivo não permite inferir mão ou dedo.

Meta fixa usa a direção configurada em cada nota de strum. Na alternância, o gerador atribui baixo/cima em ordem de **notas esperadas**, começando em `firstDirection`. Miss e strum extra não deslocam o padrão esperado das notas seguintes. A alternância reinicia na primeira nota de cada trecho, após uma nota de outra articulação ou após um intervalo musical sem notas maior ou igual a `resetAfterRestTicks` (inteiro positivo), medido do fim da nota anterior até o próximo início. Uma pausa do usuário não altera as direções já gravadas na chart.

## 6. Sustains

O início é julgado normalmente e seu resultado fica definitivo. Somente um início acertado ativa uma cauda; um início perdido não produz também uma quebra de sustain. O sustain exige a **máscara exata continuamente**, sem frets adicionais; tolerância de liberação antecipada é `0 ms`.

- Uma mudança de máscara antes do fim quebra a cauda uma vez, zera combo e desarma HOPO, preservando o acerto do início. Reapertar depois não recupera a cauda nem gera nova quebra dela.
- Manter os frets até o fim conclui a cauda, sem incremento de combo. Liberar exatamente no fim é permitido, pois a conclusão precede a entrada. Manter os frets depois do fim não é penalidade musical; poderá ser contexto de diagnóstico.
- Strum com a mesma máscara não quebra a cauda por si só; segue as regras de associação/strum extra. Ele não aumenta a duração sustentada nem reinicia o sustain.
- Sobreposição na chart é rejeitada quando qualquer próximo início ocorre antes do fim da cauda. Um início no tick exato do fim é permitido. Se o jogador antecipar a troca de frets dentro da janela desse próximo início, ainda pode quebrar a cauda anterior: são dois objetos musicais distintos. Se os frets forem iguais, um novo strum antecipado pode ativar a próxima cauda enquanto a anterior termina; cada cauda mantém seu próprio ID, medição e conclusão, sem fundir durações.

Se `H` é o tempo corrigido do acerto e `E` o fim musical, a duração exigível é `max(0, E - max(H, N))`. Tempo mantido antes de `N` não infla a duração; um acerto tardio não cobra tempo anterior ao acionamento. Uma quebra em `B` registra duração mantida `max(0, min(B, E) - max(H, N))`, limitada à duração exigível. A máscara precisa permanecer correta desde o acionamento, inclusive quando ele antecede `N`.

Se o início for acertado em/depois de `E`, ainda dentro de sua janela, conserva o acerto, mas emite sustain `not-evaluated / head-after-tail`: não houve cauda observável, não há falha de sustain nem sucesso técnico presumido. Em abandono, caudas ativas são `cancelled / attempt-aborted`, preservam o combo e não contam como quebras. Pausas suspendem a observação como descrito a seguir.

## 7. Tentativa, interrupção e encerramento

O snapshot captura cópias completas de configuração, chart/semente/gerador, regras, dispositivo/capacidades e calibração. IDs/versões de referências devem coincidir com os objetos capturados; BPM e semente da chart devem coincidir com a configuração. Nem prática nem avaliação alteram essas condições no meio da tentativa. Repetir a mesma chart usa outro ID de sessão; variar troca a semente; modificar dispositivo, mapeamento, regras ou calibração encerra a tentativa como `aborted / context-changed` antes de preparar outra.

| Estado | Transições admitidas |
| --- | --- |
| `idle` | `ready` após configuração/chart/contexto válidos |
| `ready` | `countdown` ao iniciar; `aborted` ao sair/reiniciar |
| `countdown` | `running` ao concluir a contagem; `paused` por pausa/interrupção; `aborted` ao encerrar |
| `running` | `paused`, `completed` ou `aborted` |
| `paused` | `countdown` por retomada explícita; `aborted` ao encerrar |
| `completed`, `aborted` | Terminais para aquele ID; preparar/repetir/reiniciar cria outra tentativa |

Somente `running` julga entradas. Em contagem/retomada, os frets atuais servem para sincronizar o estado inicial, sem acionar notas. O tick zero marca o início musical; sua porção de janela anterior a `running` não admite entradas da contagem. Se o padrão precisar de preparação jogável antes da primeira nota, deve conter uma pausa musical inicial explícita.

Pausa manual, perda de foco, aba oculta, desconexão, suspensão de áudio e relógio incoerente congelam o tempo ativo e registram `SessionInterruption`. A interrupção tem prioridade sobre entradas ainda não processadas no seu instante; a limpeza sintética de controles não chega ao julgador como releases. Não são criados misses durante pausa, não se acumulam ações para retomar e sons pendentes são cancelados pelo adaptador.

A retomada é explícita, passa por nova contagem e preserva notas pendentes e combo. Reancora relógios e sincroniza frets sem produzir ataques. HOPO volta desarmado. Uma cauda ativa fica suspensa; na retomada, se a máscara não foi restaurada, quebra no tempo musical congelado, com `inputSequence: null`. Se foi restaurada, continua, excluindo o período pausado da medição. As direções técnicas planejadas não são recalculadas.

Uma tentativa completa somente depois de `judgedNowMs` ultrapassar o maior entre extensão musical da chart, último início mais a janela tardia e último fim de sustain, com todos os inícios e caudas resolvidos. O pequeno intervalo final de julgamento faz parte do tempo ativo. Um abandono resolve apenas o que já foi julgado; notas pendentes permanecem **não julgadas**, sem misses inventados. Reiniciar emite `aborted / restart` para a tentativa ativa. Um estado terminal emite exatamente um resultado, mesmo que outra ação de encerramento chegue depois.

O núcleo inicial limita a espera final por conclusão a cinco segundos ativos adicionais e aborta com `evaluation-timeout` caso o coordenador avance até esse limite sem conclusão. Exceder buffers/interrupções usa `resource-limit`, preservando os registros já aceitos. Esses motivos são falhas de encerramento/recursos, não erros musicais. A etapa 03 recebe relatórios do futuro julgador; não calcula acertos, misses ou resolução de caudas por conta própria.

**Progressão automática:** somente tentativas completas, sem qualquer pausa/interrupção e com dados das metas exigidas disponíveis são elegíveis, tanto em prática quanto em avaliação. Pausar e retomar não restaura essa elegibilidade. Tentativas abandonadas/interrompidas continuam no histórico, claramente identificadas. Elegibilidade não é promoção: metas, amostra mínima e consistência serão implementadas na etapa 13. Prática pausada ainda pode fundamentar sugestões informativas, sem promoção automática.

## 8. Resultados, técnica e diagnóstico

`JudgmentEvent` registra fatos imutáveis de início, strum extra e cauda, com sequência de saída, instante musical e efeito no combo. Um hit tem entrada e erro temporal; expiração não possui esses dados; strum extra não possui nota. O evento de sustain é separado do início e nunca muda a contagem de notas acertadas.

`TechniqueAssessment` separa `passed`, `failed`, `not-evaluated` e `not-applicable`. Um erro musical não recebe um segundo erro musical por descumprir uma técnica. Métricas técnicas dos inícios usam apenas hits aplicáveis; a precisão musical continua necessária para avaliar o exercício inteiro.

| Métrica inicial | Definição |
| --- | --- |
| Precisão musical | `hitNotes / (hitNotes + missedNotes)`; acorde conta como uma nota |
| Notas não julgadas | `plannedNotes - hitNotes - missedNotes`; podem existir em resultados abandonados |
| Erros para `maximumErrors` | Misses de início + strums extras + quebras de sustain; falha técnica tem meta separada |
| Timing | Média com sinal, média absoluta e desvio padrão populacional dos erros temporais de hits, com número de amostras |
| Articulação/direção | Resultados `passed / (passed + failed)` entre hits aplicáveis e observáveis |
| Sustains completos | Caudas `completed / (completed + broken)`; canceladas/não avaliadas não entram |

Em tentativa completa, todos os inícios são elegíveis e o denominador musical equivale à quantidade planejada. Em abandono, precisão descreve apenas a parte julgada e deve ser apresentada junto de planejadas/não julgadas; não é uma avaliação integral. Nenhum denominador zero vira `0%` ou `100%`: `RatioMetric`/`TimingMetrics` usam `unavailable` com motivo. Um único hit permite média e desvio populacional zero, mas não uma conclusão sobre consistência.

Se uma métrica técnica tiver observações avaliáveis e outras indisponíveis, pode mostrar a razão do subconjunto observado com seu denominador, mas os eventos devem preservar a lacuna. Qualquer lacuna em uma meta obrigatória impede progressão (`required-data-unavailable`), mesmo com razão observada de 100%. Metas de direção sem capacidade observável não são aprovadas; exigir uma técnica sem notas aplicáveis torna essa meta indisponível. Quando ativadas, `requireArticulation`, `requireStrumDirection` e `requireFullSustains` exigem razão 1 nas respectivas métricas aplicáveis aos hits, além de dados completos. Isso é cumprimento de meta, separado de elegibilidade. Precisão, teto de erros e sequência de tentativas consistentes serão combinados pela política de progressão, sem mudar a sessão encerrada.

Diagnóstico posterior referencia sessões, notas, entradas e julgamentos, informa ocorrências/amostras e distingue fato `observed` de hipótese `inferred`. Substituição, inversão, tendência de timing e outras classificações não reescrevem hits, misses ou combo. Mão/dedo não são deduzidos de frets comuns. Falta de registros detalhados aparece em `availability`, separada de desempenho zero.

`TrainingRecommendation` contém política versionada, evidência, objetivo, uma alteração proposta e configuração resultante completa. Seus contratos iniciais cobrem BPM, nível e padrão. Aplicar uma sugestão cria outra tentativa; não modifica o snapshot que a originou. Regras de diagnóstico, valores de metas padrão e decisões de adaptação ficam nas etapas correspondentes.

## 9. Contratos entregues e próximos módulos

| Arquivo | Contratos |
| --- | --- |
| [`music.ts`](../src/engine/domain/music.ts) | Unidades, bits, técnicas, `ChartNote`, `Chart` e referências versionadas |
| [`drill.ts`](../src/engine/domain/drill.ts) | `DrillConfig`, metas e direção exigida |
| [`rules.ts`](../src/engine/domain/rules.ts) | `RuleProfile` e constante `fretsense-v1@1.0.0` |
| [`input.ts`](../src/engine/domain/input.ts) | `NormalizedInputEvent`, `DeviceProfile`, mapeamento e `CalibrationProfile` |
| [`judgment.ts`](../src/engine/domain/judgment.ts) | `JudgmentEvent`, resultado técnico e efeito no combo |
| [`session.ts`](../src/engine/domain/session.ts) | Estados, `SessionSnapshot`, interrupções, `SessionResult` e elegibilidade |
| [`analysis.ts`](../src/engine/domain/analysis.ts) | Métricas, evidências, diagnóstico e `TrainingRecommendation` |
| [`index.ts`](../src/engine/domain/index.ts) | Exportações públicas do domínio |

Os contratos usam dados serializáveis, imports locais e propriedades/coleções `readonly`, sem Vue, Quasar, Pinia ou APIs do navegador. Os aliases de unidades continuam sendo números; `readonly` não valida dados nem congela objetos em execução. A etapa 03 acrescentou validação nas fronteiras e captura de cópias congeladas, além de geração, conversões musicais e ciclo da sessão. A etapa 04 implementou adaptadores e mapeamento em `src/platform/input`, separados do núcleo. Relógio da plataforma e julgador permanecem nas etapas 05–08. Nenhuma funcionalidade deve aparecer como operacional só por possuir um tipo.

Revisão desta entrega: **somente análise estática manual** de regras, contratos, imports, tipos e coerência entre documentos. Não foram criados/executados testes nem executados lint, formatação automática, build, typecheck, aplicação, preview ou navegador. Funcionamento em execução permanece sem confirmação do desenvolvedor.
