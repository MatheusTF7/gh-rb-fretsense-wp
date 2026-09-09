# Roteiro de avaliação visual da highway

**Estado:** aguardando execução e confirmação pelo desenvolvedor.

Este roteiro valida a apresentação `fretsense-highway@1.4.0` refinada na etapa 15A após os primeiros retornos em execução. A câmera e os receptores ficam fixos; a superfície do braço, as marcações, as notas e as caudas compartilham uma translação uniforme no plano da pista, convertida por uma única projeção em perspectiva. A textura em movimento fornece a referência de deslocamento inspirada em GH. Os rastros das notas foram removidos e sua entrada no horizonte recebeu transição de opacidade. Ele não mede o julgamento: a mesma chart, regras, calibração e sequência de entradas deve ser usada ao comparar configurações visuais.

A velocidade configurada representa pixels por segundo na altura dos receptores; a projeção determina o espaçamento e a velocidade aparente à distância. Toda a rolagem deriva do tempo visual da sessão, inclusive a textura, sem relógio de animação separado. Movimento reduzido omite a decoração móvel e mantém a grade e as notas necessárias à leitura. A percepção de movimento e conforto ainda depende de confirmação em execução pelo desenvolvedor; não foi verificada no navegador.

## Matriz de capturas

Registrar uma captura da configuração, uma durante a contagem, uma em trecho denso e uma durante pausa para cada grupo:

| Grupo | Viewport CSS | Densidade | Tema | Movimento | Efeitos |
| --- | --- | --- | --- | --- | --- |
| Celular estreito | 360 × 800 | 1x e maior disponível | claro/escuro | completo/reduzido | completo/desativado |
| Celular amplo | 430 × 932 | maior disponível | claro/escuro | completo/reduzido | completo/reduzido |
| Tablet | 768 × 1024 | 1x e maior disponível | claro/escuro | completo/reduzido | completo |
| Desktop | 1366 × 768 | 1x | claro/escuro | completo/reduzido | completo/desativado |
| Desktop amplo | 1920 × 1080 | 1x e 2x, se disponível | claro/escuro | completo/reduzido | completo |

Anotar navegador, sistema, zoom, escala do sistema, resolução física, DPR informado pelo navegador e se foi usado layout normal, foco ou tela cheia.

## Charts e cenários

- Executar notas simples em todas as pistas, com strum para cima/baixo, HOPO e tap.
- Executar acordes duplos/triplos próximos, alternando com notas simples.
- Executar sustains simples e em acordes até obter estados ativo, completo, quebrado e não avaliado.
- Usar uma chart na maior subdivisão e duração aceitas pela configuração para observar sobreposição e culling.
- Produzir acerto central, antecipado, atrasado, miss e strum extra, inclusive eventos simultâneos.
- Pausar durante uma cauda e durante um efeito; confirmar visualmente que ambos permanecem congelados.
- Redimensionar antes da tentativa e durante `running`; confirmar que tempo, BPM, scroll musical e linha de acerto não mudam.
- Alternar foco e tela cheia por gesto explícito e confirmar que a saída permanece visível.
- Manter uma sessão por ao menos 20 minutos e registrar qualquer degradação observável, sem estimar FPS.

## Critérios de leitura

- [ ] Nenhuma nota, cauda ou efeito é cortado nas margens ou encoberto pelo HUD.
- [ ] Cor, posição, letra/número, forma e símbolo continuam redundantes.
- [ ] As notas parecem presas à superfície que rola, preservando sua posição relativa à textura e às marcações, sem sensação de zoom independente perto dos receptores.
- [ ] Acordes são percebidos como unidade sem esconder seus frets.
- [ ] Linha de acerto e alvos têm maior contraste local que grade e fundo.
- [ ] Marcadores de subdivisão, tempo e compasso não competem com notas densas.
- [ ] Hits desaparecem de forma contínua no impacto, sem atravessar a área dos receptores como notas ampliadas.
- [ ] Sustains seguem a inclinação da pista desde o horizonte; quando acertados, permanecem ancorados nos receptores e encurtam até a conclusão; estados quebrado e não avaliado continuam distintos.
- [ ] Feedback antecipado/atrasado, miss, extra e sustain é localizado nos receptores, distinguível e curto.
- [ ] Movimento reduzido elimina a decoração móvel e o deslocamento/pulso dos efeitos, preservando a rolagem musical, os contornos e a opacidade.
- [ ] O HUD mostra combo, progresso, BPM, modo e estado sem deslocar a highway.
- [ ] Pausa recebe foco no controle de retomada e o foco visível permanece reconhecível.
- [ ] Tela cheia indisponível ou recusada preserva o layout normal.

## Registro de achados

Para cada falha, registrar: ID, data, ambiente, viewport/DPR, preset/seed, referência completa de apresentação, passos, captura, resultado esperado, resultado observado e gravidade. Medidas de frame time/FPS pertencem à etapa 15B e devem vir de ferramenta e protocolo informados pelo desenvolvedor; este documento não afirma desempenho medido.
