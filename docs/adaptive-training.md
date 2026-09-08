# Treino corretivo e progressão

## Escopo

A etapa 13 introduz uma política determinística entre o diagnóstico congelado de uma tentativa e a configuração da próxima. O motor não altera o `SessionSnapshot` nem o `SessionResult` de origem: ele produz uma `TrainingRecommendation` versionada, e a decisão do usuário é gravada em um registro separado.

## Condições comparáveis

Uma sequência só conta para progressão quando preserva modo, técnica, nível, padrão e versão, BPM, subdivisão, frets, comprimento do padrão, articulação, strum automático, acordes, sustains, direção, metas, regra e gerador. A semente pode variar. A comparação usa apenas tentativas concluídas e elegíveis; abandono, interrupção e ausência de dados continuam visíveis no histórico, mas não promovem competência.

O mínimo estrutural é de oito notas. A promoção exige o maior valor entre três tentativas e `goals.consistentAttempts`, precisão igual ou superior a `goals.minimumAccuracy`, erros iguais ou inferiores a `goals.maximumErrors` e cumprimento integral das metas técnicas habilitadas. Alternate strum exige dispositivo direcional e métrica de direção disponível mesmo se a meta opcional tiver sido desligada.

## Política de mudança

As regras priorizam uma dimensão interpretável por recomendação:

- inversão ou diferença entre direções de transição cria um padrão manual curto com a pior transição observada;
- acorde incompleto/incorreto, strum irregular, tendência de timing ou sustain interrompido reduz o BPM em até 10, sem cruzar o mínimo da técnica;
- na ausência de diagnóstico recorrente, precisão abaixo da meta ou excesso de erros também reduz o BPM;
- duas falhas comparáveis consecutivas no BPM mínimo podem simplificar para o preset do nível anterior;
- uma sequência estável de sucessos aumenta até 5 BPM; no máximo da técnica, pode avançar ao preset do próximo nível;
- níveis nunca sobem ou descem por uma única tentativa fora do padrão.

Diagnósticos corretivos precisam de pelo menos quatro amostras e duas ocorrências. Toda recomendação carrega política, causa, contagens de amostras e consistência, IDs de diagnóstico, referências de evidência, mudança proposta e configuração resultante.

## Decisão e persistência

A tela de resultado explica evidência e efeito antes de oferecer `aceitar exatamente`, `ajustar antes de iniciar` ou `ignorar`. Aceitar carrega a configuração somente para a próxima tentativa. Ajustar carrega a proposta na tela de configuração e grava a configuração efetivamente usada quando a próxima tentativa começa. Ignorar não altera configuração alguma.

O IndexedDB `fretsense-sessions` passa à versão física 2 e recebe o object store `recommendations`, indexado pelo ID da sessão de origem. Os schemas dos registros de sessão permanecem na versão 1. A migração somente adiciona o store; recomendações e decisões não reescrevem a sessão que gerou a evidência.

O modo adaptativo é opcional. O usuário escolhe previamente entre 1 e 12 blocos; cada continuidade ainda depende de confirmação e o botão de aceitação exata é bloqueado quando o limite da cadeia é alcançado. Ajustar ou ignorar encerra a continuidade automática da cadeia.

## Verificação desta entrega

A implementação foi revisada somente por análise estática manual de contratos, regras, limites, imports, estados, persistência e interface. Não foram executados testes, lint, formatação automática, build, typecheck, servidor ou navegador; o comportamento em execução e a migração do IndexedDB dependem de confirmação pelo desenvolvedor.
