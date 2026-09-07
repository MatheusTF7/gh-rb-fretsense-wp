# Treino jogável — etapa 07

**Estado:** implementação concluída e revisada somente por análise estática manual. Execução no navegador, áudio e hardware ainda dependem de confirmação do desenvolvedor.

## Fluxo disponível

A rota `/play` conecta configuração, `TrainingSession`, entrada, áudio, julgamento, highway e resultado em memória. O usuário escolhe um perfil salvo, a conexão correspondente quando usa Gamepad, BPM, repetições, modo de áudio e calibração. Estão disponíveis:

- subida/descida de cinco frets por strum ou tap;
- nota repetida por strum;
- acorde repetido de dois ou três frets por strum.

HOPO, sustains, níveis adicionais e cenários mistos continuam fora desta etapa. O catálogo identifica as quatro famílias com exercício inicial sem apresentar as demais como operacionais.

## Controlador e ciclo de recursos

`useTrainingSession` é o proprietário da tentativa e das dependências de plataforma. O início prepara uma configuração validada, captura o snapshot com perfil/calibração, ativa o julgador, inicia a captura antes da contagem e sincroniza o metrônomo. O mesmo loop de animação avança o relógio da sessão e publica apenas a visão necessária à interface. Na borda da contagem, a própria fronteira de entrada pode abrir `running` pelo instante observado antes de entregar o ataque, evitando que o strum do tick zero dependa da ordem entre polling e frame visual.

Pausa congela tempo/julgamento, encerra a captura e para os agendamentos; retomada cria outra captura, sincroniza o baseline e passa por nova contagem. Reiniciar e repetir descartam a captura e o áudio anteriores antes de criar outra tentativa. Sair ou desmontar a rota também cancela `requestAnimationFrame`, polling de Gamepad, listeners e `AudioContext`. Uma interrupção nunca retoma automaticamente.

O modo com som exige ativação por gesto. O modo silencioso preserva contagem e relógio sem criar contexto de áudio. Uma calibração salva precisa pertencer ao perfil/modo; em áudio habilitado, taxa de amostragem e identificador de saída também precisam coincidir. Sem seleção salva, o snapshot usa uma calibração padrão de offsets zero para o contexto atual.

## Highway e feedback

`HighwayRenderer` recebe apenas chart, tempo ativo, offset visual, frets ativos e eventos já decididos pelo motor. Ele não julga notas. A posição vertical usa o tempo restante e uma velocidade fixa de 300 px/s; mudar BPM altera a grade musical, não essa velocidade visual.

O renderer ajusta a resolução ao tamanho CSS e limita a densidade a 2. Uma busca binária encontra a primeira nota visível e o laço termina ao sair do horizonte futuro, evitando desenhar a chart inteira. Pistas e notas usam cor acompanhada de posição/letra; os receptores mostram frets ativos. Combo, progresso, contagem e feedback textual de timing permanecem em HTML.

## Resultado e recuperação

Ao terminar, a página mostra acertos/planejadas, precisão, melhor combo, timing médio, strums extras e duração ativa. Resultados interrompidos são identificados e preservam somente a parte julgada. Repetir conserva a configuração e a semente, gerando a mesma chart com outro ID. O resultado desaparece ao sair da página; persistência pertence à etapa 12.

Falhas de áudio oferecem modo silencioso. Entrada ausente aponta para mapeamento/conexão, calibração incompatível aponta para recalibração e configuração inválida retorna ao formulário sem iniciar uma tentativa parcial.

Revisão desta entrega: **somente análise estática manual**. Não foram executados testes, lint, formatação automática, build, typecheck, aplicação, preview ou navegador.
