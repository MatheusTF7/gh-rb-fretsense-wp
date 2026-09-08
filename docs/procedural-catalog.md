# Catálogo procedural v1

O catálogo `fretsense-catalog@1.0.0` liga objetivos pedagógicos a configurações reproduzíveis do motor. Seus gráficos são materializados por `procedural-catalog@1.0.0`; padrões manuais usam `manual-pattern-generator@1.0.0` e `manual-pattern@1.0.0`.

## Famílias e progressão

Cada família possui presets iniciante, intermediário e avançado. A progressão muda estrutura, densidade, transições, simultaneidade e subdivisão, não apenas BPM.

| Família | Estruturas cobertas | Métricas principais |
| --- | --- | --- |
| Strum simples | repetição, troca de fret, rajadas e pausas | precisão e timing |
| Strum alternado | repetição densa, direção e blocos separados por pausas | precisão, timing e direção |
| HOPO | cadeias curtas/longas e saltos | precisão, timing e articulação |
| Tapping | alternância, trills e saltos | precisão, timing e articulação |
| Sequências | escadas, zigue-zagues e mudanças de direção | precisão e timing |
| Acordes | duplos, triplos, trocas e notas simples | precisão e timing |
| Sustains | notas simples, acordes e transições sustentadas | precisão, timing e caudas completas |
| Misto | blocos e transições de articulação, acordes e sustains | todas as métricas técnicas aplicáveis |

Os descritores em `src/catalog` também declaram frets mínimos, simultaneidade máxima, necessidade de strum/direção, uso de sustains, articulações e parâmetros permitidos.

## Grade, variações e limites

- A grade deriva de 480 ticks por semínima. Subdivisões 2 e 4 são regulares; 3 e 6 representam tercinas.
- A seed escolhe rotações, saltos e acordes sem sair dos frets permitidos.
- `mutateDrillPreset` aceita somente BPM, subdivisão, frets, repetições e seed. A configuração e a chart são validadas antes do retorno.
- Geradores rejeitam acordes acima da simultaneidade, acordes sem strum, articulação incompatível, caudas sobrepostas e charts acima dos limites globais.
- Identidades de chart incluem id/versão do gerador e hash da configuração canônica.

## Padrões manuais

Um padrão manual define duração do ciclo e passos ordenados. Cada passo contém tick, máscara de frets, articulação, duração da cauda e identificador de trecho. O parser exige início em zero, ordem estritamente crescente, ausência de sobreposição, frets válidos e no máximo 128 passos. O editor simples no catálogo usa exatamente esse contrato e apresenta o caminho do campo inválido.

## Reprodutibilidade

O snapshot de sessão continua armazenando a chart materializada, além da configuração. Repetições verificam os dados congelados contra o gerador versionado; mudanças de algoritmo devem receber nova versão, preservando a implementação das versões já persistidas.
