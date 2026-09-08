# Treino jogável — etapa 07

**Estado:** base implementada na etapa 07 e ampliada na etapa 08, revisada somente por análise estática manual. Execução no navegador, áudio e hardware ainda dependem de confirmação do desenvolvedor.

## Fluxo disponível

A rota `/play` conecta configuração, `TrainingSession`, entrada, áudio, julgamento, highway e resultado. Ao terminar, a tentativa é encaminhada ao repositório local descrito em [persistência e histórico](./session-persistence.md), sem incluir armazenamento no caminho de julgamento. O usuário escolhe um perfil salvo, a conexão correspondente quando usa Gamepad, BPM, repetições, modo de strum, modo de áudio e calibração. O strum automático vem selecionado por padrão para teclado e Gamepad. Estão disponíveis:

- subida/descida de cinco frets por strum ou tap;
- subida/descida por HOPO, com início e recuperação por strum;
- nota repetida por strum;
- acorde repetido de dois ou três frets por strum;
- caudas de 120 ou 240 ticks nos padrões iniciais;
- strum alternado em nota simples repetida, iniciando para cima ou para baixo.

Níveis adicionais e cenários procedurais mistos continuam fora deste fluxo. O catálogo completo permanece na etapa 09.

## Controlador e ciclo de recursos

`useTrainingSession` é o proprietário da tentativa e das dependências de plataforma. O início prepara uma configuração validada, captura o snapshot com perfil/calibração, ativa o julgador, inicia a captura antes da contagem e sincroniza o metrônomo. O mesmo loop de animação avança o relógio da sessão e publica apenas a visão necessária à interface. Na borda da contagem, a própria fronteira de entrada pode abrir `running` pelo instante observado antes de entregar o ataque, evitando que o strum do tick zero dependa da ordem entre polling e frame visual.

Pausa congela tempo/julgamento, encerra a captura e para os agendamentos; retomada cria outra captura, sincroniza o baseline e passa por nova contagem. Reiniciar e repetir descartam a captura e o áudio anteriores antes de criar outra tentativa. Sair ou desmontar a rota também cancela `requestAnimationFrame`, polling de Gamepad, listeners e `AudioContext`. Uma interrupção nunca retoma automaticamente.

O modo com som exige ativação por gesto. O modo silencioso preserva contagem e relógio sem criar contexto de áudio. Uma calibração salva precisa pertencer ao perfil/modo; em áudio habilitado, taxa de amostragem e identificador de saída também precisam coincidir. Sem seleção salva, o snapshot usa uma calibração padrão de offsets zero para o contexto atual.

No strum automático, pressionar os frets exatos dentro da janela aciona uma nota de strum sem exigir outra tecla, botão ou eixo. Acordes podem ser formados progressivamente e só disparam quando uma nova pressão completa a máscara esperada; notas repetidas exigem soltar e pressionar novamente. O modo não interfere em tapping nem declara uma direção de palhetada. Desativá-lo restaura integralmente a exigência do strum físico mapeado.

## Highway e feedback

`HighwayRenderer` recebe apenas chart, tempo ativo, offset visual, frets ativos e eventos já decididos pelo motor. Ele não julga notas. A posição vertical usa o tempo restante e uma velocidade fixa de 300 px/s; mudar BPM altera a grade musical, não essa velocidade visual.

O renderer ajusta a resolução ao tamanho CSS e limita a densidade a 2. Uma busca binária encontra a primeira nota visível e o laço termina ao sair do horizonte futuro, evitando desenhar a chart inteira. Pistas e notas usam cor acompanhada de posição/letra; círculos, losangos e quadrados distinguem strum, HOPO e tap, setas mostram direção e linhas representam caudas. Os receptores mostram frets ativos. Combo, progresso, contagem e feedback textual permanecem em HTML.

## Resultado e recuperação

Ao terminar, a página mostra acertos/planejadas, precisão, melhor combo, timing médio, strums extras, conclusão/quebras de sustain, conformidade de direção quando aplicável e duração ativa. Resultados interrompidos são identificados e preservam somente a parte julgada. Repetir conserva a configuração e a semente, gerando a mesma chart com outro ID. O resultado permanece no histórico IndexedDB quando a gravação é bem-sucedida; em caso de falha, fica somente na memória da visita e a interface informa essa condição.

Falhas de áudio oferecem modo silencioso. Entrada ausente aponta para mapeamento/conexão, calibração incompatível aponta para recalibração e configuração inválida retorna ao formulário sem iniciar uma tentativa parcial.

Revisão desta entrega: **somente análise estática manual**. Não foram executados testes, lint, formatação automática, build, typecheck, aplicação, preview ou navegador.
