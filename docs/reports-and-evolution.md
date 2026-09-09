# Relatórios e evolução

## Escopo

A etapa 14 organiza o resultado congelado, o histórico e a evolução local sem
alterar julgamentos nem reescrever sessões. A política
`fretsense-reporting@1.0.0` deriva visualizações dos contratos das etapas 11–13.
Valores ausentes continuam ausentes: a interface distingue dado não gravado,
análise não realizada, amostra vazia, amostra insuficiente e zero observado.

## Resultado individual

O resultado mostra técnica, nível, BPM, chart, gerador, regra e janela de
acerto, apresentação e edição opcionais, dispositivo, método/offsets de
calibração e condição final. Novas sessões com snapshot v2 registram a
apresentação completa da etapa 15A; sessões v1 permanecem legíveis com esse dado
ausente. A edição continua `null` até que um perfil estudado seja implementado
na etapa 19.

O diagnóstico continua separado em timing, frets, transições, acordes,
direção de strum, sustains e recortes de técnica/trecho. Quando os julgamentos
brutos foram retidos, os acertos são distribuídos em cinco faixas de timing,
sempre acompanhadas por uma tabela textual. Sem eventos brutos, a distribuição
não é reconstruída a partir da média.

O mapa de erros relaciona notas da chart às evidências preservadas pelos
diagnósticos e informa tick, frets esperados, trecho e classificações. Ele é
limitado a 128 linhas visíveis e declara quantas foram omitidas. A ausência de
linhas significa que nenhum diagnóstico referenciou notas elegíveis, não que
dados inexistentes valham zero.

## Comparabilidade

Uma comparação direta exige igualdade de modo, técnica, nível, BPM, chart,
regra, janela, apresentação, edição, dispositivo e calibração. O resultado
procura a tentativa anterior compatível da mesma técnica. Se não houver, mostra
a tentativa anterior mais próxima e enumera as diferenças, sem calcular deltas
de desempenho. Com condições idênticas, apresenta apenas a variação de precisão
e do erro absoluto médio quando ambas as métricas existem.

## Histórico e evolução

O histórico filtra antes da paginação por período civil do encerramento,
família/técnica, nível, modo e estado final. O painel usa o mesmo recorte e
agrupa tentativas por estrutura pedagógica, regra, gerador, apresentação,
edição, dispositivo e calibração. BPM e identidade da chart são mostrados por
tentativa e não ficam ocultos dentro da agregação.

A faixa de BPM observada é apenas o menor e o maior valor registrados, sem
afirmar capacidade. Um BPM vira limite consistente somente quando há pelo menos
três tentativas concluídas e elegíveis naquele BPM, cada uma com ao menos oito
notas, que cumprem as metas configuradas. Se isso não ocorrer, o painel informa amostra insuficiente ou
ausência de um BPM consistente.

Cada resultado pode preparar a mesma configuração/semente para repetir a chart.
Trechos com erro ou precisão abaixo de 100% podem preparar um padrão focado por
meio do mesmo recorte já usado na tela de treino. A ação apenas preenche a
próxima configuração; uma nova tentativa continua exigindo confirmação.

## Verificação desta entrega

A implementação foi revisada somente por análise estática manual de contratos,
imports, filtros, estados, agrupamentos, comparações, ações e mensagens. Não
foram executados testes, lint, formatação automática, build, typecheck, servidor
ou navegador. Aparência, volume real do histórico e comportamento em execução
dependem de confirmação pelo desenvolvedor.
