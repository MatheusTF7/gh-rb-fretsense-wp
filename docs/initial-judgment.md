# Julgamento inicial — etapa 06

**Estado:** registro histórico da etapa 06, revisado somente por análise estática manual. O julgador foi ampliado na etapa 08; consulte [articulações e sustains](./articulations-and-sustains.md) para o escopo atual. Funcionamento em execução permanece sem confirmação do desenvolvedor.

## Escopo disponível

Na etapa 06, `src/engine/judgment/initial-judge.ts` introduziu `InitialJudge` para notas de strum/tap e acordes sem caudas. A etapa 08 preservou esse nome público e ampliou a mesma classe para HOPO e sustains segundo `fretsense-v1@1.0.0`. O construtor continua validando o snapshot, suas regras e a chart contra a geração canônica e capturando cópias imutáveis.

Os padrões iniciais da etapa 03 continuam delimitando as charts aceitas. Não há importação de charts arbitrárias nem ampliação do catálogo nesta etapa. A etapa 07 passou a oferecer a interface jogável, seleção das articulações disponíveis e resultado básico.

## Associação e ordem

O julgador recebe tempo ativo **bruto** por `processInput(event)` e `advance(rawTimeMs)`. Cada chamada converte esse tempo uma vez com `judgmentTime`; offset visual não participa. Antes de julgar uma entrada, expira as notas cujo limite tardio seja estritamente anterior ao tempo corrigido. `advance` faz a mesma expiração sem precisar de eventos de entrada.

Um cursor percorre a ordem canônica da chart. A candidata é a primeira nota pendente dentro da janela inclusiva de ±120 ms, sem filtrar previamente por fret, articulação ou direção. Isso preserva a precedência da mais antiga quando janelas se sobrepõem. Cada início é consumido uma vez; o cursor nunca recua. Expiração registra o instante do limite tardio, independentemente de quando o coordenador chamou o motor.

Se uma entrada válida avançar o horizonte para depois do limite final, as notas vencidas são resolvidas primeiro e a tentativa é encerrada sem julgar essa ação como `extra-strum` nem guardá-la como entrada da tentativa. Assim, entregar essa ação antes de `advance()` ou avançar o relógio primeiro não muda as métricas, a disponibilidade dos registros ou a elegibilidade na borda de encerramento. Depois de completo, o julgador não aceita novas entradas e avanços adicionais preservam o relatório final.

Entradas precisam ter tempo não regressivo, sequência crescente desde zero, máscaras coerentes e origem correspondente ao dispositivo/conexão. Empates de tempo seguem a sequência recebida; não há ordenação posterior ou agrupamento de ações. Entradas anteriores ao horizonte já entregue são rejeitadas antes de alterar o julgamento. O adaptador da plataforma continua responsável por escolher um timestamp utilizável ou cair no instante de observação.

Strum tem prioridade sobre a transição de frets do mesmo evento e consome no máximo um início:

| Entrada | Efeito |
| --- | --- |
| Strum com candidata e frets exatos | Hit e combo +1 |
| Strum com candidata e frets incorretos | Um miss `wrong-frets`, com bits ausentes/adicionais; combo zero |
| Strum sem candidata | `extra-strum`, sem nota associada; combo zero |
| Nova pressão com frets exatos e strum automático | Hit de nota `strum`; direção não é inventada |
| Transição correta para tap elegível | Hit e combo +1 |
| Transição incorreta, fora da janela ou chegando a nota de strum | Mantém a nota pendente |
| Relógio depois da borda tardia | Um miss por expiração; combo zero |

Acorde é um início único. Todos os frets devem estar ativos no strum; `formationGraceMs = 0` rejeita completar o acorde depois da palhetada. A mesma falha não gera também strum extra ou outro miss por expiração. Na expiração, `missing-strum` indica que uma transição chegou aos frets exatos da candidata de strum dentro da janela, mas nenhuma palhetada a resolveu. Sem essa evidência, a causa é `window-expired`.

Quando a configuração captura `automaticStrum: true`, uma transição sem strum físico também tem prioridade ao completar os frets exatos de uma candidata `strum` com ao menos um bit pressionado. Transições parciais não são penalizadas imediatamente, o que permite formar acordes em mais de um evento. Uma liberação que apenas chega à máscara correta não dispara a nota; a repetição exige nova pressão.

Tap exige pressionamento/liberação real e estado final exato. Manter um fret não acerta a próxima nota. Se a nota imediatamente anterior tem os mesmos frets e foi acertada, é necessário liberar o próprio alvo depois daquele hit e pressioná-lo no novo hit. Alternar apenas um fret adicional não satisfaz essa condição. A liberação pode acontecer antes da janela seguinte. Baselines e limpezas de pausa não contam como liberação; evidência real anterior à pausa é preservada. Um strum correto em tap acerta musicalmente, mas registra `failed / strum-used-for-tap`.

## Eventos e agregação

`getEvents()` devolve uma coleção imutável de `JudgmentEvent`, com sequência própria, tempo musical, nota/entrada associada e combo antes/depois. Hits guardam erro temporal com sinal e avaliações técnicas; misses por frets guardam máscaras; expiração não inventa entrada causadora ou timing medido. Entradas sem julgamento imediato continuam no buffer de `TrainingSession.getInputs()` para análise futura.

`getEvaluation()` produz `SessionEvaluation`, incluindo:

- Notas planejadas, acertadas, perdidas e não julgadas, strums extras, combo atual e melhor combo.
- Precisão `hits / (hits + misses)`, contando acorde uma vez e excluindo notas ainda não julgadas do denominador.
- Média com sinal, média absoluta e desvio padrão populacional dos erros de hits, com número de amostras. A agregação é incremental, na ordem das entradas; o desvio usa a atualização de Welford e proteção contra resíduos numéricos negativos.
- Articulação `passed / (passed + failed)` nos hits. Técnica falha não altera o acerto nem zera combo.
- Direção exigida por nota: compara direções conhecidas, preserva `unknown` como não avaliada e não desloca as direções planejadas após erros. Uma lacuna em meta obrigatória impede declarar dados técnicos completos.
- Quando a chart exige direção e o snapshot declara strum não direcional, a métrica nasce como `unsupported-capability`; não é necessário esperar um hit para reconhecer uma capacidade já ausente.
- Na entrega da etapa 06, sustains eram `not-applicable`; a etapa 08 passou a produzir conclusão, quebra, cancelamento e indisponibilidade de cauda.

Denominador zero produz `unavailable`, não 0% ou 100%. Uma amostra permite média e desvio populacional zero, sem inferir consistência. Metas e promoção continuam separadas das métricas. Inicialmente, antes da primeira entrada/avanço, o relatório tem horizonte sentinela de −1.000 ms e todas as notas não julgadas; a sessão só publica avaliação ao processar tempo de execução.

O trabalho de associação é constante por entrada, além das notas/caudas resolvidas naquele horizonte; cada cabeça e cauda é consumida uma vez. Tempos musicais e aplicabilidade da direção são calculados na preparação. Não há varredura da chart inteira por frame ou entrada. Os limites existentes são 4.096 notas, 65.536 entradas e 131.072 registros; cabeças, caudas e extras cabem nesse buffer sem sobrescrita. Consultar todos os eventos copia apenas a coleção; deve ser reservado ao consumo de registros, não usado como cálculo de métricas a cada frame.

## Integração com a sessão

Após `prepare`, ainda em `ready`, o coordenador chama `session.enableInitialJudgment()`. A ativação é idempotente e valida o escopo antes da contagem. Sem essa chamada, a porta preexistente de relatórios externos continua disponível; com ela, o julgador interno é o único produtor e `reportEvaluation` externo é rejeitado para impedir duas fontes de resultados.

`recordInput` valida e encaminha a entrada uma vez ao julgador, registrando no buffer as ações que pertencem à tentativa. Tanto `recordInput` quanto `advance` podem fechar o horizonte e concluir a tentativa; isso evita depender de outro ciclo da interface quando a entrada recebida já está depois da borda final. O coordenador continua entregando entradas disponíveis antes de fechar o horizonte; não deve reaplicar offsets ou chamar outro julgador para a mesma tentativa. `getEvaluation()` expõe o relatório atual congelado ou `null` antes de qualquer avaliação; `getJudgments()` expõe os registros. `getView().result` e `takeResult()` conservam o contrato existente.

`advance` completa automaticamente uma tentativa julgada quando o tempo corrigido ultrapassa a extensão/janela final, todos os inícios estão resolvidos e não há caudas. Um avanço tardio ainda processa os prazos em ordem; com julgamento completo, conclui antes de aplicar o timeout legado de espera por relatório. Sem julgador interno, o timeout de cinco segundos permanece.

Pausa avança somente até o instante de interrupção, processa prazos já vencidos e congela a sessão, sem concluir automaticamente por essa chamada. Durante pausa/contagem não há novos julgamentos. A retomada sincroniza frets sem ataques, preservando combo, notas e sequência. Abandono também processa apenas prazos já vencidos até o encerramento e mantém futuras notas não julgadas; não converte o restante da chart em misses. Os limites de recursos e o timeout continuam podendo produzir seus motivos terminais antes de uma pausa/saída.

`repeat`, `vary` e `restart` preservam a ativação do julgador, mas criam outra instância com outro ID e buffers/contadores novos. Resultados terminais continuam sendo entregues uma única vez. Depois do término, a integração da etapa 12 copia os registros elegíveis para o repositório de sessões sem alterar o julgamento original.

## Próxima integração

A etapa 07 conectou seleção do exercício, entrada, áudio, highway e resultado em memória, conforme [treino jogável](./playable-training.md). A etapa 08 completou HOPO, sustains, direção e seus estados visuais; cenários procedurais completos permanecem na etapa 09. A independência de taxa de frames continua sem confirmação em execução; foi revisada somente na lógica temporal e na ordem dos contratos.
