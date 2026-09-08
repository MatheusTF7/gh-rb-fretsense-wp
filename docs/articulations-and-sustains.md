# Articulações e sustains — etapa 08

**Estado:** implementação concluída e revisada somente por análise estática manual. Não foram executados testes, lint, formatação automática, build, typecheck, aplicação, preview ou navegador. O funcionamento prático ainda depende de confirmação do desenvolvedor.

## Julgamento completo do perfil

O julgador interno mantém o nome público `InitialJudge` por compatibilidade, mas agora cobre todas as articulações do perfil `fretsense-v1@1.0.0`: `strum`, `hopo`, `tap`, acordes e caudas. As regras permanecem no núcleo TypeScript, sem dependências de Vue, Canvas ou APIs do navegador.

HOPO usa uma cadeia explícita. Ela começa desarmada, é armada por qualquer início acertado por strum e mantida por um HOPO elegível. O primeiro HOPO, a recuperação após erro e uma repetição do mesmo fret exigem strum. Um strum voluntário em HOPO que já poderia ser acionado por transição preserva o acerto e o combo, mas registra falha de articulação. Tap continua independente da cadeia: transições válidas acertam e desarmam HOPO; um strum em tap acerta musicalmente com falha técnica.

Misses, strums extras, quebras de sustain e pausas desarmam a cadeia. Uma transição que chega aos frets corretos sem elegibilidade preserva a nota pendente e permite recuperação por strum dentro da janela. O motor trabalha por nota e aceita a alternância entre notas simples, acordes duplos/triplos e articulações em uma chart válida. O padrão determinístico `articulation-transitions@1.0.0` materializa um cenário-base misto de seis passos; a composição procedural de novos cenários pertence ao catálogo da etapa 09.

## Ciclo das caudas

Cada cabeça é resolvida definitivamente antes de sua cauda. Um hit com `durationTicks > 0` ativa um sustain identificado pela mesma nota. A máscara exata precisa permanecer ativa até o fim musical:

- manter os frets conclui a cauda com combo preservado;
- mudar a máscara antes do fim emite uma única quebra, zera o combo e desarma HOPO;
- acertar a cabeça em ou depois do fim da cauda emite `not-evaluated / head-after-tail`;
- abandonar cancela caudas ativas sem transformá-las em falha;
- uma liberação exatamente no fim é aceita porque a conclusão é processada antes da entrada.

A duração exigível começa no maior entre o instante nominal e o hit. A duração mantida é limitada entre esse início e o fim musical. Embora o perfil rejeite sobreposição musical na chart, o julgador mantém uma coleção de caudas ativas para o caso em que a cabeça seguinte seja acertada antecipadamente na janela.

Pausar suspende a observação no tempo ativo congelado. Durante a nova contagem, o adaptador atualiza somente o baseline. Ao reabrir a janela musical, o julgador confere a máscara restaurada: se corresponder, a cauda continua sem cobrar o período pausado; caso contrário, quebra no instante congelado com `inputSequence: null`.

## Métricas, direção e encerramento

`sustainCompletion` usa `completed / (completed + broken)`. Caudas canceladas ou não avaliáveis não entram no denominador e tornam indisponíveis os dados de uma meta obrigatória. `brokenSustains` participa dos erros sem alterar o acerto já registrado para a cabeça. A tentativa só conclui depois de resolver todas as cabeças, todas as caudas e ultrapassar a janela final inclusiva.

A direção esperada continua materializada por nota. Direções conhecidas são comparadas sem deslocar o padrão após erro; entrada `unknown` ou strum automático produz técnica não avaliada. O gerador reinicia a alternância no começo de cada trecho e quando o intervalo musical configurado atinge `resetAfterRestTicks`.

## Interface jogável

A área de treino expõe HOPO na subida/descida, caudas de 120 ou 240 ticks para os padrões existentes e alternate strum na nota simples repetida, com primeiro sentido para baixo ou para cima. A highway desenha círculos para strum, losangos para HOPO, quadrados para tap, setas de direção e linhas de sustain; caudas completas, interrompidas e indisponíveis recebem estados visuais derivados dos eventos do motor.

O resultado básico apresenta conclusão e quebras de sustain, além da conformidade de direção quando aplicável. Cenários mistos, novos padrões, níveis e edição manual continuam na etapa 09; histórico e persistência continuam nas etapas posteriores.
