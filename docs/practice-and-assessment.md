# Prática e avaliação

A etapa 10 transforma os presets de `fretsense-catalog@1.0.0` em tentativas configuráveis. O fluxo permanece local e em memória; persistência e histórico entre visitas pertencem à etapa 12.

## Preparação

Uma tentativa parte de um preset e permite ajustar, dentro da política da família:

- modo prática ou avaliação;
- nível, BPM, subdivisão e frets permitidos;
- duração por blocos repetidos ou tempos musicais;
- foco em um trecho identificado do padrão;
- perfil de entrada, áudio e calibração;
- precisão mínima, limite de erros, consistência e exigência de dados técnicos.

Toda mudança materializa uma nova chart antes da liberação do botão de início. A prévia mostra as primeiras notas, quantidade total, articulações e caudas. O resumo declara necessidade de strum, direção observável, simultaneidade e sustains; incompatibilidades conhecidas do perfil bloqueiam o início.

O foco em trecho converte as notas daquele segmento em `manual-pattern@1.0.0`, preservando ticks, frets, articulações e caudas. Assim, o mesmo julgador e os mesmos limites continuam válidos.

## Tentativa congelada

Ao iniciar, configuração, chart, regras, dispositivo e calibração são copiados para um `SessionSnapshot`. Controles de preparação deixam de estar disponíveis até encerrar ou abortar a tentativa. Sair da página com uma tentativa ativa produz encerramento por abandono; não há troca silenciosa de contexto.

Prática e avaliação usam o mesmo julgamento. Na avaliação, qualquer pausa/interrupção preserva o resultado, mas inclui `attempt-interrupted` na inelegibilidade para progressão. Reiniciar cria outra tentativa completa e identificada.

## Resultado e próximas ações

Após o encerramento há ações semanticamente distintas:

- **repetir a mesma chart:** usa o snapshot anterior e cria outro ID de sessão;
- **gerar variação:** troca a seed e materializa outra chart do gerador versionado;
- **aplicar recomendação:** carrega a `resultingConfig` de uma recomendação disponível; a produção de recomendações pertence à etapa 13;
- **alterar configuração:** volta ao draft sem modificar o snapshot encerrado.

O último snapshot e resultado ficam no workspace Pinia apenas durante a visita. A rota `/results/:id` aceita somente esse registro; IDs ausentes exibem recuperação para configuração ou catálogo. Voltar do resultado restaura preset, foco, modo, perfil, áudio e calibração usados no draft.
