# Análise e diagnóstico detalhados

A etapa 11 acrescenta uma análise posterior, pura e versionada pelo perfil
`fretsense-analysis@1.0.0`. Ela é executada quando uma tentativa com o julgador
inicial termina ou é encerrada. Os eventos, o combo e as decisões do julgador
permanecem inalterados; o relatório somente interpreta os registros congelados.

## Métricas e dados ausentes

Métricas de razão registram `numerator`, `denominator`, `value` em `[0, 1]` e
unidade `ratio`. Métricas de timing registram unidade `milliseconds`, quantidade
de amostras, média com sinal, erro absoluto médio e desvio-padrão populacional.
A duração sustentada usa milissegundos mantidos / milissegundos exigidos e
também informa quantos sustains contribuíram.

Uma métrica sem denominador não recebe zero artificial. Seu estado é
`unavailable`, distinguindo:

- `no-samples`: a técnica era aplicável, mas não produziu amostras elegíveis;
- `insufficient-data`: a quantidade não permite a conclusão pretendida;
- `unsupported-capability`: o dispositivo não observa a capacidade;
- `not-applicable`: a chart não exige aquela técnica.

Precisão de notas continua sendo acertos / notas esperadas já julgadas. Cada
acorde é uma nota nesse cálculo. A análise de seus frets é separada e conta,
para cada fret esperado, se ele esteve presente na entrada alinhada, além dos
usos inesperados. Transições são avaliadas dentro do mesmo trecho e só passam
quando as duas formas alinhadas estão exatas.

## Alinhamento e classificação

O alinhamento trabalha apenas com notas elegíveis, isto é, notas que já têm
um julgamento de acerto ou erro. Entradas de ataque são reconstruídas a partir
dos julgamentos que referenciam a entrada normalizada original e de transições
de fret divergentes próximas a notas de tap/HOPO. Eventos intermediários de
formação de acorde de strum que não acionaram nem consumiram uma nota não viram
ataques independentes, evitando tratá-los como uma sequência invertida.

O alinhamento de sequências é independente por `segmentId` e só associa pares
a até duas janelas de acerto de distância. Uma entrada mais distante continua
registrada como extra, sem ser associada artificialmente a um trecho. O custo
total é limitado a 2.100.000 células; acima disso, o relatório usa as associações
originais do julgador e declara `cost-limit`.

As operações alinhadas classificam omissão, entrada extra e substituição. Duas
notas simples adjacentes cruzadas formam uma única ocorrência de inversão e não
geram também duas substituições. Acordes nunca entram nessa regra: forma parcial,
frets excedentes e outra forma são diagnósticos específicos. Sustains quebrados
e direções de strum incorretas usam diretamente os julgamentos técnicos.

Cada diagnóstico informa se é um fato `observed` ou uma hipótese `inferred`, o
total de ocorrências, a quantidade de amostras e referências a sessão, notas,
entradas e julgamentos. Para limitar o resultado, são guardadas no máximo 64
evidências e 64 identificadores por evidência; o total de ocorrências não é
truncado. O relatório expõe no máximo 512 recortes de trecho e declara essa
limitação quando houver mais grupos.

Tendência de antecipação ou atraso só é sugerida com pelo menos 8 acertos e
média com sinal de pelo menos 15 ms em módulo. Diferença entre transições
ascendentes e descendentes exige ao menos 4 amostras de cada direção e diferença
de médias de pelo menos 15 ms. Esses valores são hipóteses explicáveis, não uma
reclassificação dos acertos.

## Relatório

`SessionAnalysisReport` guarda o perfil, disponibilidade, limites usados,
métricas de timing, frets, transições, acordes, sustains e direções, além de
recortes por técnica e trecho. A tela de resultado apresenta numerador e
denominador nas razões, amostras de timing e separa fatos observados de padrões
sugeridos. Registros incompletos produzem relatório parcial com as limitações
explícitas. Tentativas encerradas antes de resolver toda a chart excluem as notas
não julgadas e também são marcadas como parciais.

O processamento permanece síncrono porque ocorre somente ao encerrar a sessão
e tem custo limitado. Um Worker não é necessário para os limites atuais; se os
limites crescerem, sua adoção deve preservar versão de mensagem, cancelamento e
descarte de respostas pertencentes a outra sessão.
