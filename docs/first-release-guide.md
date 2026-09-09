# Guia da primeira versão

## Situação e escopo

Este guia descreve a implementação local `0.0.1` preparada pelas etapas 01–16. O comportamento foi revisado apenas por análise estática manual; execução, precisão, compatibilidade de navegador/hardware e publicação não foram confirmadas para esta revisão.

O Fretsense usa regras próprias e versionadas. Nomes como strum, HOPO e tap descrevem técnicas do gênero, não fidelidade a Guitar Hero, Rock Band ou a uma edição específica. Não há perfil externo de jogo selecionável nesta versão.

## Fluxo recomendado

1. Em **Dispositivos**, escolha um perfil e confirme seu mapeamento.
2. Em **Calibração**, selecione o mesmo perfil, escolha o modo de áudio e salve um ajuste compatível com o contexto atual.
3. Em **Treinar**, escolha uma família, um nível e um preset. Na configuração, confira requisitos, prévia, dispositivo, áudio e calibração.
4. Inicie a tentativa. A configuração, chart, regra, apresentação, dispositivo e calibração ficam congelados para aquela sessão.
5. No resumo, repita a mesma chart, gere uma variação, aplique/ajuste uma recomendação ou abra o relatório completo.
6. Em **Histórico**, filtre sessões e consulte evolução apenas entre condições compatíveis.

## Entrada e mapeamento

### Teclado

O perfil inicial é `keyboard-default@1.0.0`:

| Ação | Tecla |
| --- | --- |
| Fret verde, vermelho, amarelo, azul e laranja | `A`, `S`, `D`, `F`, `G` |
| Strum para cima e para baixo | `↑`, `↓` |
| Pausa | `Esc` |

O teclado é uma entrada completa, mas não representa simultaneidade física ilimitada: combinações podem ser bloqueadas pelo ghosting/rollover do teclado e pelo sistema operacional. Use o monitor de entrada para observar acordes e combinações no equipamento real. Foco perdido, aba oculta ou timestamp inválido interrompem a captura; a aplicação pausa e exige retomada explícita.

### Gamepad e guitarras expostas como Gamepad

A Gamepad API informa conexões que o navegador reconhece, sem garantir que toda guitarra USB/Bluetooth apareça ou que os índices de botões sejam iguais entre modelos, sistemas e navegadores. Na página **Dispositivos**:

1. conecte e ative o controle por uma ação física;
2. atualize a lista e selecione a conexão compatível;
3. crie/edite um perfil e capture cada fret, strum e pausa;
4. confirme no monitor frets individuais, acordes e direções observáveis;
5. salve e selecione o perfil.

O ID reportado identifica um modelo/descrição, não um número de série confiável. Desconectar ou substituir o dispositivo durante uma tentativa causa pausa; reconecte uma correspondência válida ou encerre e reconfigure. Se o navegador não distingue as duas direções, use um strum sem direção e não habilite metas que exijam essa observação. Dispositivos disponíveis apenas por WebHID permanecem fora do escopo.

## Calibração

Uma calibração pertence à combinação de perfil/versão do dispositivo e contexto: modo de áudio, saída descrita/identificável, taxa de amostragem, navegador e plataforma reportados. Trocar essa combinação pode invalidar a seleção anterior.

- **Guiada:** depois de quatro pulsos de preparação, coleta até 16 ativações a 90 BPM e exige ao menos 12 amostras consistentes. A estimativa é combinada: inclui a resposta da pessoa e atrasos observáveis do conjunto, não mede separadamente áudio, vídeo e entrada.
- **Manual:** permite informar compensação de entrada e atraso visual entre `−1000` e `+1000 ms`.
- **Offsets zero:** salva o perfil padrão para o contexto.
- **Sem áudio:** mantém referência e ajuste visual, mas desabilita a coleta sonora guiada.

Compensação de entrada positiva desconta uma entrada observada tarde: `1030 ms` com `+30 ms` é julgada em `1000 ms`. Atraso visual positivo move somente a imagem para mais tarde; não altera notas, áudio ou julgamento. Ao mudar fone, saída, dispositivo, navegador ou sensação de sincronismo, confira o contexto e calibre novamente.

## Configuração e modos

O catálogo oferece single strum, alternate strum, HOPO, tapping, sequências, acordes, sustains e exercícios mistos, cada um com três níveis. É possível ajustar BPM, subdivisão, frets, extensão, trecho em foco, strum automático, metas e apresentação. O editor manual cria uma chart reproduzível sem importar conteúdo externo.

**Prática** e **avaliação** usam exatamente o mesmo gerador e julgamento. O modo fica registrado para separar histórico, comparação e evolução. Avaliação comunica uma tentativa formal e destaca sua inelegibilidade quando há pausa/interrupção; nenhuma tentativa interrompida ou abortada é elegível para progressão automática. Prática não transforma erros em acertos nem altera janelas.

O modo adaptativo opcional encadeia um número limitado de blocos. Cada recomendação é baseada em evidências locais e precisa ser aceita, ajustada ou ignorada; ela só altera a próxima configuração e nunca reescreve a sessão encerrada.

Durante a tentativa:

- **Pausar** congela o tempo ativo e cancela captura/áudio até uma retomada explícita com nova contagem;
- **Reiniciar** e **Sair** exigem confirmação e encerram a tentativa atual de forma rastreável;
- modo de foco e tela cheia são visuais e não mudam o julgamento;
- efeitos, alto contraste e redução de movimento podem mudar durante o jogo; velocidade, escala e perspectiva estruturais são congeladas no snapshot.

## Como interpretar o resultado

| Métrica | Interpretação |
| --- | --- |
| Precisão | acertos ÷ notas já julgadas; um acorde conta como uma nota |
| Acertos, erros e não julgadas | resolução musical da chart; notas não alcançadas após encerramento antecipado não viram zero implícito |
| Melhor combo | maior sequência de inícios acertados sem miss, strum extra ou sustain quebrado |
| Erro médio de timing | valor com sinal; negativo indica antecipação e positivo indica atraso |
| Erro absoluto médio | distância média até o instante esperado, ignorando o sinal |
| Desvio-padrão | dispersão do timing; menor indica execução mais consistente, sem provar baixa latência do equipamento |
| Conformidade de articulação | uso correto de strum/HOPO/tap nas amostras aplicáveis, separado do acerto musical |
| Conformidade de direção | direção correta nos strums em que direção era exigida e observável |
| Conclusão de sustains | tempo efetivamente mantido ÷ tempo exigido nas caudas elegíveis |
| Strums extras / sustains quebrados | penalidades específicas que também interrompem o combo |

Uma métrica pode aparecer indisponível por ausência/insuficiência de amostras, capacidade não observável ou técnica não aplicável. Isso não equivale a zero. Diagnósticos **observados** derivam diretamente dos eventos; diagnósticos **inferidos**, como tendência antecipada/tardia, são hipóteses limitadas por amostragem.

Comparações diretas exigem condições equivalentes: modo, técnica, nível, BPM, chart, regra/janela, apresentação, edição, dispositivo e calibração. Quando algo difere, o relatório enumera as diferenças e não fabrica um delta. Evolução e BPM demonstrado exigem tentativas elegíveis e amostra suficiente.

## Dados locais e recuperação

Preferências, perfis e calibrações usam `localStorage`; sessões e decisões adaptativas usam IndexedDB. Não há conta, nuvem ou envio automático. Exportar uma sessão gera JSON para diagnóstico/arquivo, mas a versão não oferece importação/restauração desse arquivo. Excluir uma sessão é explícito e também remove sua decisão adaptativa associada.

| Situação | Recuperação disponível |
| --- | --- |
| Nenhuma configuração em `#/play` | voltar ao catálogo e escolher um preset |
| Configuração inválida ou acima dos limites | reduzir duração, repetições ou densidade conforme o campo indicado |
| Dispositivo ausente/incompatível | abrir **Dispositivos**, reconectar/remapear ou selecionar o teclado |
| Calibração incompatível | abrir **Calibração** e salvar/carregar um contexto compatível |
| Web Audio indisponível/bloqueado | tentar a preparação por gesto novamente ou escolher modo sem áudio |
| Foco, visibilidade, áudio ou dispositivo interrompidos | corrigir a causa e usar **Retomar**; a tentativa fica marcada como interrompida |
| Canvas 2D indisponível | encerrar e usar um navegador com Canvas 2D disponível |
| IndexedDB/localStorage indisponível ou sem quota | continuar em memória quando oferecido, liberar armazenamento e usar **Tentar novamente**; dados só em memória somem ao recarregar |
| Registro local incompatível | preservar o dado, não sobrescrevê-lo e usar uma versão compatível para recuperá-lo |
| Rota de resultado inexistente | voltar ao histórico ou ao catálogo |

Com a tentativa pausada ou encerrada, o painel **Diagnóstico local** permite copiar/baixar versão, seed, perfil, estado e contagens úteis para um relato. Revise o conteúdo antes de compartilhar; ele não é enviado automaticamente.

## Limites de precisão e compatibilidade

O navegador observa eventos e amostras após camadas de hardware, firmware, sistema, driver e agendamento. `performance.now()`, Gamepad polling e `AudioContext.currentTime` dão referências monotônicas úteis, mas não revelam o instante elétrico da palhetada nem o momento físico em que som e pixels chegaram à pessoa. A calibração reduz desalinhamento percebido no contexto atual; não certifica latência absoluta.

Compatibilidade e desempenho não foram medidos por navegador ou dispositivo. Modo privado, políticas de reprodução automática, economia de energia, taxa de atualização, zoom, escalonamento de tela, polling do controle e limitações de armazenamento podem mudar o comportamento observado. As garantias implementadas e os pontos ainda não confirmados estão detalhados em [robustez, desempenho e acessibilidade](./robustness-accessibility.md).
