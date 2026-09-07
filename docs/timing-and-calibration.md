# Relógio, áudio e calibração — etapa 05

**Estado:** implementação revisada somente por análise estática manual. Não houve execução da aplicação, testes, lint, formatação automática, build, typecheck ou verificações no navegador. Sincronia percebida, comportamento visual, áudio e hardware ainda dependem de confirmação pelo desenvolvedor.

## Uso da página de calibração

Selecione um perfil de entrada já mapeado. Para Gamepad, escolha explicitamente a conexão correspondente. No modo **Com áudio**, use **Preparar e testar áudio**, confira a saída do sistema e confirme que é a saída atual. Uma descrição opcional, como “fone com fio”, diferencia contextos; esse campo não muda o dispositivo de saída do sistema.

**Iniciar calibração guiada** prepara 300 ms de antecedência, toca quatro pulsos de preparação e recebe uma ativação por pulso durante mais 16 pulsos, a 90 BPM. A captura aceita um strum mapeado, com ou sem direção, ou uma nova pressão de fret pelos mesmos adaptadores de teclado/Gamepad; o fret escolhido não altera a estimativa e precisa ser solto antes da próxima amostra. A área precisa manter foco; Tab, pausa mapeada, perda de foco, aba oculta, desconexão e interrupções de áudio encerram a rodada e descartam a amostra incompleta. Não há retomada automática nem mistura de amostras entre rodadas.

A estimativa é **compensação combinada**: diferença entre entrada e referência musical agendada, incluindo resposta da pessoa e atrasos observáveis do conjunto. Ela não mede isoladamente latência de áudio, vídeo ou dispositivo. Pulsos são associados pela posição mais próxima, com janela de ±250 ms; duplicatas e entradas fora da janela não substituem amostras já aceitas.

O algoritmo inicial exige pelo menos 12 amostras entre 16, calcula a mediana e o desvio absoluto mediano (MAD), e remove valores a mais de `max(30 ms, 3 × MAD)` da mediana. Exige novamente 12 amostras, MAD de no máximo 40 ms e no máximo quatro entradas rejeitadas por associação. A coleta admite até 64 entradas após a preparação. O resultado mostra amostras utilizadas, descartes e MAD. Esses parâmetros são decisões iniciais da versão `1.0.0`, sem validação empírica pelo agente.

Uma estimativa consistente preenche a compensação de entrada; só **Salvar ajuste** grava o resultado. Rodadas insuficientes não aplicam uma nova estimativa. Editar os campos manualmente usa método `manual` e zera a contagem de amostras atribuída ao ajuste final. A compensação visual continua independente e não é estimada automaticamente.

Os dois campos admitem valores finitos entre −1.000 e +1.000 ms:

- **Compensação da entrada positiva** desconta atraso. Entrada bruta em 1030 ms com +30 ms é julgada em 1000 ms.
- **Atraso visual positivo** atrasa a imagem. Não muda entrada, notas, áudio ou julgamento.

**Ouvir/ver metrônomo** apresenta uma prévia finita de 20 pulsos. O atraso visual desloca somente a imagem; a prévia conserva a cauda visual final quando o atraso é positivo. Na coleta guiada, o ajuste visual existente é ignorado para que a referência não inclua uma correção anterior. A coleta também não desconta o ajuste de entrada anterior: a estimativa resultante é absoluta, não um incremento.

Ao entrar na página, o ajuste mais recente do perfil é recarregado nos campos e seu modo/descrição de saída são restaurados. Em **Com áudio**, preparar o contexto revalida taxa e saída e reaplica automaticamente o registro exatamente compatível; os controles de calibração continuam exigindo a confirmação da saída atual. **Carregar ajuste salvo** permite reaplicar manualmente a correspondência exata. **Restaurar e salvar offsets zero** grava método `default`, ambos os offsets em zero e zero amostras. Em **Sem áudio**, a referência sonora é explicitamente indisponível, a coleta guiada fica desabilitada e continuam disponíveis ajustes manuais e prévia visual.

Depois de **Salvar ajuste**, a confirmação com os valores de entrada e visual aparece junto aos botões, sem depender de rolagem até o fim da página. O aviso de armazenamento distingue persistência no navegador de retenção somente em memória.

## Uma referência de tempo

`SessionClock` implementa a porta monotônica usando `performance.now()`. A `TrainingSession` continua sendo a única proprietária das âncoras de início, tempo acumulado, pausa e contagem. `projectActiveTime` projeta um instante dessa fonte sem avançar o horizonte já processado; pausa e contagem devolvem o tempo ativo congelado. Assim, não há um segundo relógio descontando os mesmos intervalos.

`SessionInputTimeline`, padrão de `createSessionInput`, consulta essa projeção e o último horizonte entregue. `InputTimeline.sample` também aceita `deviceTimestampMs` e pode devolver `{ sessionTimeMs, timeSource }`; devolver somente número conserva clientes de inspeção da etapa 04. Os adaptadores passam `KeyboardEvent.timeStamp` ou `Gamepad.timestamp` e continuam mantendo a ordem de sequência em empates.

A normalização aceita timestamps finitos e positivos, não futuros, com até 1.000 ms de idade observada e cuja projeção não anteceda o horizonte entregue nem a entrada anterior. Um timestamp legado de época pode ser convertido subtraindo `performance.timeOrigin`. Um timestamp ausente, zero, antigo, regressivo ou anterior à retomada usa o instante de observação, com `timeSource: 'observation'`. Se a própria observação retroceder em relação ao horizonte, a captura interrompe com `input-timing-invalid`. Não se reabrem notas nem se inventam transições entre amostras. Referências: [High Resolution Time](https://www.w3.org/TR/hr-time-3/) e [Gamepad](https://www.w3.org/TR/gamepad/).

`src/engine/timing/calibrated-time.ts` centraliza as conversões puras:

```text
tempo musical da nota = tick × 60000 / (BPM × 480)
tempo julgado = tempo ativo bruto − judgmentOffsetMs
tempo visual = tempo ativo bruto − visualOffsetMs
```

`judgmentTime` pertence à fronteira do julgador: uma aplicação por entrada e por avanço do horizonte. A sessão usa a mesma transformação para validar relatórios e encerrar a janela final. `visualTime` é exclusivo do desenho, já usado pela prévia da calibração. Os adaptadores continuam entregando tempo bruto. O [julgador inicial da etapa 06](./initial-judgment.md) já consome essa convenção, sem reaplicar a correção em eventos convertidos.

## Áudio e ciclo de vida

`Metronome` usa uma âncora com `AudioContext.currentTime` em segundos e `performance.now()` em milissegundos. `toAudioSeconds` e `fromAudioSeconds` convertem explicitamente entre essas referências. Essa âncora é de agendamento/renderização, não uma medição do instante físico em que o som chega ao ouvido; o atraso de saída permanece parte do contexto e da compensação combinada. Referência: [Web Audio API](https://www.w3.org/TR/webaudio/).

O agendador consulta uma janela de 120 ms a cada 25 ms, cria cliques curtos com envelope e acento a cada quatro pulsos e mantém no máximo 16 nós simultâneos. Admite até 4.096 pulsos e 610 segundos, limites suficientes para a tentativa de dez minutos e sua contagem. Se um pulso ainda não agendado já estiver atrasado, interrompe em vez de reproduzir sons acumulados.

O contexto de áudio é criado/retomado por gesto explícito. A ativação tem espera limitada a três segundos e um identificador de operação para que uma resposta assíncrona não reinicie trabalho cancelado. Sem Web Audio, com bloqueio ou suspensão, a página informa indisponibilidade e oferece escolha explícita do modo sem áudio. `stop` cancela o intervalo, interrompe e desconecta nós pendentes/ativos e invalida a âncora. Novo `start` reancora o agendamento. `dispose` também remove listeners e fecha o contexto.

Na calibração, **Preparar e testar áudio** emite um clique curto depois que o contexto entra em execução, tornando a confirmação da saída observável. O início de uma prévia ou coleta com som também retoma e confere o contexto novamente por ação do usuário antes de agendar os pulsos; uma suspensão invalida a confirmação e exige nova preparação.

`SessionAudio` é o vínculo preparado para o coordenador jogável. Após preparar áudio por gesto, a sessão deve capturar o contexto real e usar `SessionClock`. O coordenador chama `synchronize` ao iniciar/retomar, depois dos avanços e imediatamente após pausas/encerramentos. O vínculo usa o prazo exato da contagem, cancela sons ao pausar e prepara nova âncora ao retomar. Somente cliques futuros são agendados; o primeiro clique da contagem que já venceu quando o vínculo foi chamado é omitido. A grade mantém o início musical no prazo da sessão. Não há adição de offsets ao áudio nem avanço da sessão pelo metrônomo.

Ao retomar entre beats, a contagem permanece regular e a continuação aguarda a fração restante até o próximo beat da chart, preservando seu acento. O coordenador precisa iniciar o agendamento durante a contagem; se não houver mais pulso de preparação futuro, o vínculo pausa e exige novo início explícito.

Mudanças conhecidas de saída ou taxa de amostragem incompatível com o snapshot exigem outra tentativa. Suspensão ou atraso de agendamento pausa a sessão e notifica o coordenador para limpar a captura. O coordenador encaminha interrupções dos adaptadores para `synchronize` no mesmo fluxo e descarta o vínculo ao concluir/sair. A etapa 07 integrou o julgador, áudio e highway na [área jogável](./playable-training.md).

Na página de calibração, listeners de foco, visibilidade, conexão e mudanças de dispositivos interrompem a rodada. Saída não identificável tem ID `null` e aviso explícito; a confirmação atual não é persistida. O navegador pode não reportar todas as mudanças de saída, por isso a descrição e a conferência pelo usuário continuam relevantes. O frame da prévia, o intervalo de descoberta, a cauda visual, a captura e o contexto são descartados ao sair da rota.

## Persistência e contexto

`CalibrationRepository` usa `fretsense.calibrations.v1`, `schemaVersion: 1`, sem migrar ou sobrescrever o repositório de preferências da etapa 04. Guarda até 64 calibrações e 262.144 unidades de texto. A associação exige ID/versão do dispositivo, modo de áudio, ID/descrição da saída, taxa de amostragem, identificação do navegador e plataforma reportada. Uma gravação substitui apenas o ajuste do mesmo perfil/versão/contexto.

A identidade do navegador registra um trecho limitado do user agent e hash do texto completo; a plataforma é a string reportada pelo navegador, sem alegação de identificação precisa do sistema físico. Esses metadados ficam locais. Nenhum microfone, enumeração com permissão ou escolha automática de saída é necessário.

Perfis de calibração têm IDs novos e versão `1.0.0`. O repositório próprio é a fonte de consulta; salvar calibração não reversiona o dispositivo nem modifica sua lista opcional de referências `calibrations`. Remapear um dispositivo cria nova versão e deixa os ajustes antigos incompatíveis, preservando-os como dados locais. Snapshots anteriores mantêm suas cópias e não recebem novos offsets.

Falhas de gravação mantêm dados em memória e oferecem nova tentativa de salvamento. Dados inválidos ou de versão desconhecida permanecem intactos no armazenamento, com gravação automática bloqueada e aviso. Não há remoção automática de contextos antigos nem sincronização entre abas nesta etapa.

## Limitações da entrega

O código implementa calibração e referências temporais; não demonstra precisão medida nem equivalência de latência entre navegadores/dispositivos. A estimativa guiada é limitada à janela de ±250 ms para evitar ambiguidade entre pulsos; valores maiores podem ser configurados manualmente dentro do limite de ±1.000 ms. A integração jogável está implementada, mas sua precisão prática continua sem confirmação. Toda revisão feita pelo agente foi estática e manual, conforme `AGENTS.md`.
