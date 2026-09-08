# Plano de desenvolvimento do Fretsense

**Status:** etapas 01–08 revisadas estaticamente, sem confirmação em execução. Etapas 09–20 pendentes.
**Objetivo:** entregar um treinador web de técnicas de Guitar Hero / Rock Band com cinco frets, exercícios configuráveis, avaliação de execução e progressão adaptativa.  
**Referências:** [ideia do produto](./fretsense-idea.md), [orientações para agentes](../AGENTS.md), [dependências e scripts](../package.json) e [configuração Quasar](../quasar.config.ts).

## 1. Premissas e limites de execução

- Preservar a stack atual: Vue 3, Quasar com Vite, TypeScript, Pinia e Vue I18n.
- Atender guitarra, controle convencional e teclado pelo mesmo motor. Teclado é uma entrada completa e também facilita o trabalho do desenvolvedor.
- Priorizar treino de cinco frets com conteúdo procedural e padrões manuais. Música comercial e arquivos externos de charts não são dependências do produto inicial.
- Implementar regras próprias, explícitas e versionadas. Perfis com comportamento específico de versões de GH/RB são uma expansão.
- Manter geração, julgamento e análise em TypeScript, independentes de Vue, Quasar e APIs do navegador.
- Trabalhar com dados locais, sem exigir conta ou backend na primeira versão.
- Usar regras estatísticas para diagnóstico e adaptação inicial. Aprendizado de máquina é uma evolução condicionada a uma necessidade concreta.
- Não estabelecer datas antes de o responsável definir disponibilidade e avaliar o primeiro marco jogável. A ordem abaixo expressa dependências técnicas, não um cronograma em dias.

### Política de validação

Conforme o `AGENTS.md`, o agente deve realizar somente análise estática manual: leitura de código, revisão de diferenças, contratos, imports, tipos, estados e coerência da lógica. Não executar lint, formatação automática, testes, aplicação, preview, navegador, build, typecheck ou outras verificações automatizadas. Não criar testes, suítes ou roteiros de teste e não instalar dependências apenas para validar alterações.

Os critérios de conclusão deste plano descrevem os comportamentos a entregar. A revisão estática permite concluir a implementação do agente, mas não comprova funcionamento em execução. O desenvolvedor responsável realiza os testes que considerar necessários e relata os erros. Cada entrega deve distinguir **implementação revisada estaticamente** de **funcionamento confirmado pelo desenvolvedor**.

## 2. Ponto de partida

No início do plano, o repositório continha a estrutura inicial do Quasar:

| Área existente | Situação e aproveitamento |
| --- | --- |
| `src/pages/IndexPage.vue`, `SecondPage.vue` | Páginas de exemplo; serão substituídas pelo fluxo do treinador |
| `src/layouts/MainLayout.vue` | Layout com links do Quasar; será adaptado para navegação do produto |
| `src/router/routes.ts` | Rotas manuais; manter essa organização e o modo hash atual |
| `src/stores/index.ts` | Pinia já configurado; criar stores de aplicação conforme cada etapa |
| `src/boot/i18n.ts`, `src/i18n` | Vue I18n configurado com `en-US`; ampliar mensagens e adicionar `pt-BR` |
| `src/css` | Base para tema, estilos globais e acessibilidade visual |
| `quasar.config.ts` | TypeScript estrito e configuração do projeto; preservar convenções |

A etapa 01 acrescentou os contratos iniciais em `src/engine/domain` e o perfil documentado em [regras de gameplay](./gameplay-rules.md). A etapa 02 substituiu a interface de exemplo por navegação do produto, catálogo informativo, estrutura da área de treino, estados de indisponibilidade e preferências visuais/idioma em memória. A etapa 03 implementou validação, geração inicial determinística, conversões musicais, snapshots imutáveis e ciclo de tentativas limitadas, descritos em [núcleo inicial](./engine-foundation.md). A etapa 04 acrescentou captura e mapeamento de teclado/Gamepad, monitor de entradas e persistência de perfis/preferências, descritos em [entrada e preferências](./input-and-preferences.md). A etapa 05 acrescentou relógio monotônico, conversão de timestamps, metrônomo Web Audio e calibração guiada/manual persistida por contexto, descritos em [relógio e calibração](./timing-and-calibration.md). A etapa 06 acrescentou julgamento inicial e a etapa 07 integrou os módulos em um primeiro [treino jogável](./playable-training.md). A etapa 08 completou [articulações e sustains](./articulations-and-sustains.md), direção e a renderização correspondente. Ainda precisam ser implementados catálogo completo, relatórios detalhados e persistência de sessões. A existência de configuração de PWA no arquivo padrão não significa que a experiência offline esteja pronta.

## 3. Marcos de entrega

| Marco | Etapas | Resultado esperado |
| --- | --- | --- |
| M1 — Primeiro treino jogável | 01–07 | Mapear teclado ou Gamepad, calibrar, executar uma sequência de cinco frets e receber resultado básico |
| M2 — Catálogo e avaliação | 08–11 | Praticar todas as famílias principais com níveis, configurações reproduzíveis e diagnóstico por cenário |
| M3 — Treinador completo local | 12–14 | Salvar sessões, consultar evolução e receber sugestões corretivas explicáveis |
| M4 — Primeira versão preparada para entrega | 15–16 | Consolidar acessibilidade, tratamento de falhas, documentação e encaminhamento ao desenvolvedor |
| Expansões | 17–20 | WebHID, PWA, perfis específicos e recursos opcionais avançados |

A execução padrão segue a numeração. Dependências na tabela abaixo indicam o que deve estar disponível antes de iniciar a etapa, mesmo se a ordem for ajustada futuramente.

| Etapa | Dependências diretas | Prioridade |
| --- | --- | --- |
| 01. Contratos e regras | Nenhuma | Base |
| 02. Interface e navegação | 01 | Base |
| 03. Domínio, geração inicial e sessão | 01 | Base |
| 04. Teclado, Gamepad e mapeamento | 02, 03 | Base |
| 05. Relógio, áudio e calibração | 03, 04 | Base |
| 06. Julgamento inicial | 03, 05 | Base |
| 07. Highway e integração jogável | 02, 04, 05, 06 | M1 |
| 08. Articulações e sustains | 06, 07 | Núcleo completo |
| 09. Catálogo procedural e níveis | 03, 08 | Núcleo completo |
| 10. Prática e avaliação completas | 07, 09 | Fluxo completo |
| 11. Diagnóstico detalhado | 08, 10 | M2 |
| 12. Persistência e histórico de sessões | 10, 11 | Dados locais |
| 13. Adaptação e progressão | 09, 11, 12 | Treino adaptativo |
| 14. Relatórios e evolução | 11, 12, 13 | M3 |
| 15. Robustez, desempenho e acessibilidade | 14 | Consolidação |
| 16. Documentação e preparação de entrega | 15 | M4 |
| 17. WebHID | 04, 15, 16 | Expansão |
| 18. PWA e offline | 12, 15, 16 | Expansão |
| 19. Perfis específicos de gameplay | 08, 09, 11, 16 | Expansão |
| 20. IA local e integrações opcionais | 12, 13, 16 | Expansão |

## 4. Arquitetura proposta

### Organização de arquivos

Criar diretórios quando houver implementação correspondente, evitando uma árvore de pastas vazias.

```text
src/
  engine/
    domain/          # Notas, acordes, técnicas, regras e contratos
    generation/      # PRNG com semente, padrões e composição de exercícios
    timing/          # Conversões musicais e contrato de relógio
    judgment/        # Acertos, erros, articulações, combo e sustains
    session/         # Ciclo de vida, eventos e resultados da tentativa
    analysis/        # Métricas, alinhamento e classificação de erros
    adaptation/      # Recomendações e progressão por regras
  platform/
    input/           # Adaptadores de teclado, Gamepad e futuro WebHID
    audio/           # Relógio do navegador, metrônomo e efeitos
    storage/         # Preferências, perfis, sessões e migrações
  rendering/         # Renderer Canvas da highway
  catalog/           # Presets e descritores de técnicas/níveis
  composables/       # Integração Vue com sessão, dispositivos e áudio
  stores/            # Estado de interface, preferências e resumos
  components/
    training/
    devices/
    reports/
  pages/
  layouts/
  router/
  i18n/
  css/
```

### Responsabilidades e fluxo de dados

1. A interface monta uma configuração válida e seleciona um perfil de regras.
2. O gerador transforma configuração e semente em notas esperadas, com identificadores estáveis.
3. A sessão captura uma cópia imutável da configuração, chart, regras e calibração.
4. Os adaptadores entregam ações normalizadas e timestamps convertidos para a linha de tempo da sessão.
5. O motor julga as ações e a passagem do tempo, produzindo resultados e eventos.
6. A highway lê o estado do motor e o relógio; seu desenho não decide acertos.
7. A análise usa registros da tentativa para produzir métricas e diagnósticos.
8. A persistência salva a tentativa; a adaptação propõe a configuração da próxima.

Vue e Pinia recebem snapshots e resumos na frequência necessária para a interface. Buffers de entrada, relógio e estado interno de julgamento ficam fora da reatividade profunda. O núcleo recebe dependências por contratos, sem acessar `window`, `navigator`, Canvas, armazenamento ou áudio diretamente.

### Contratos mínimos

| Contrato | Conteúdo essencial |
| --- | --- |
| `ChartNote` | ID, posição em ticks musicais, máscara de frets, duração, articulação e trecho/técnica de origem |
| `DrillConfig` | Técnica, nível, BPM, subdivisão, frets, tamanho, repetições, metas e semente |
| `RuleProfile` | ID e versão, janelas temporais, política de frets, HOPO/tap, acordes, sustains e direção de strum |
| `NormalizedInputEvent` | Ordem sequencial, tempo de sessão, frets ativos/pressionados/liberados, strum e origem |
| `DeviceProfile` | Identidade de perfil, mapeamento, capacidades e referências de calibração |
| `CalibrationProfile` | Offsets com unidade e sinal definidos, dispositivo, saída de áudio identificável e contexto da calibração |
| `SessionSnapshot` | ID, modo, configuração, notas geradas, versões do gerador/regras e calibração usada |
| `JudgmentEvent` | Nota associada quando houver, resultado, erro temporal, causa e efeito no combo |
| `SessionResult` | Estado final, duração ativa, métricas, interrupções, diagnósticos e disponibilidade de dados |
| `TrainingRecommendation` | Evidência, objetivo, alteração proposta e configuração resultante |

Frets usam uma máscara de cinco bits. Acordes são uma nota com vários bits, não notas independentes. Tempos de sessão usam milissegundos; posições musicais usam ticks com resolução declarada. Conversões para segundos do áudio ficam no adaptador. Strum sem direção conhecida deve ser representável sem confundir a ação com ausência de strum.

## 5. Etapas de execução

### Etapa 01 — Definir domínio e regras do treinador

**Objetivo:** remover ambiguidades antes de construir o julgamento.

**Tarefas:**

- [x] Documentar o perfil inicial `fretsense-v1` em `docs/gameplay-rules.md`, com sua versão.
- [x] Fixar convenções de tempo, ticks, ordenação de eventos e sinal dos offsets.
- [x] Definir janela de acerto, critério de associação entre entrada e nota, expiração de notas e desempate entre candidatas.
- [x] Definir como strum, tap, HOPO, acordes e sustains são representados, mesmo quando entregues em etapas posteriores.
- [x] Adotar correspondência exata de frets como regra inicial; permitir que tolerância a frets adicionais e ancoragem sejam opções explícitas futuras do perfil.
- [x] Definir recuperação de HOPO após erro, acionamento de notas repetidas, penalização de strum extra e impacto de sustains no combo.
- [x] Separar acerto da nota, cumprimento da técnica e diagnóstico posterior. Acertar o timing sem alternar a direção pode satisfazer a nota e falhar a meta técnica, conforme o exercício.
- [x] Definir tratamento de tentativas pausadas, abandonadas e interrompidas na avaliação e progressão.

**Entregáveis:** regras documentadas e tipos iniciais em `src/engine/domain`.

**Critério de conclusão:** cada resultado observável tem uma regra definida, sem depender de interpretação dentro de um componente de interface. Os valores iniciais são decisões do treinador, não declarações de equivalência com GH/RB.

**Registro da etapa — 2026-09-07:**

- **Estado:** revisada estaticamente.
- **Tarefas entregues:** todas as definições acima, documentação do perfil e os dez contratos mínimos da arquitetura, com tipos auxiliares e exportações públicas.
- **Arquivos:** `docs/gameplay-rules.md` e `src/engine/domain/{music,drill,rules,input,judgment,analysis,session,index}.ts`.
- **Decisões relevantes:** perfil `fretsense-v1@1.0.0`, 480 ticks por semínima, janela inclusiva de ±120 ms, candidata mais antiga na janela, frets exatos, acordes de até três frets por strum e ausência de sobreposição de sustains. Strum voluntário em tap/HOPO elegível pode acertar musicalmente e falhar a técnica. Qualquer interrupção impede progressão automática naquela tentativa.
- **Revisão realizada:** somente análise estática manual de código, imports, tipos, regras, estados e coerência documental; sem comandos de validação automatizada ou execução da aplicação.
- **Limitações e pendências:** esta entrega define contratos e políticas; validação em execução, geração, relógio, julgamento, adaptação e interface continuam nas etapas previstas. `readonly` não substitui cópia imutável nem validação nas fronteiras.
- **Confirmação/erros informados pelo desenvolvedor:** nenhuma confirmação em execução recebida.
- **Próxima etapa liberada:** etapa 02, interface e navegação; a etapa 03 também tem sua dependência documental atendida, mantendo a ordem padrão de execução.

### Etapa 02 — Construir a estrutura da interface

**Objetivo:** estabelecer a navegação e as convenções visuais.

**Tarefas:**

- [x] Adaptar `MainLayout.vue` para início, catálogo, dispositivos, histórico e configurações.
- [x] Preparar layout de treino com foco na highway e controles essenciais.
- [x] Organizar rotas para `/`, `/train`, `/play`, `/devices`, `/calibration`, `/history`, `/results/:id` e `/settings`; ativar telas conforme a funcionalidade estiver disponível.
- [x] Substituir os exemplos do Quasar quando seus usos forem removidos, incluindo `SecondPage`, links e store de exemplo.
- [x] Definir tema, espaçamentos e identidade visual das cinco pistas com números/símbolos além das cores.
- [x] Adicionar `pt-BR` como idioma inicial proposto, mantendo `en-US` e o esquema de mensagens coerentes.
- [x] Criar componentes de feedback, estados vazios e erros recuperáveis, sem mostrar métricas fictícias.
- [x] Prever foco visível, navegação por teclado, tamanhos legíveis e organização responsiva para configurações e relatórios.

**Entregáveis:** layouts, rotas, estilos e mensagens de interface.

**Critério de conclusão:** a navegação leva aos recursos disponíveis e preserva contexto; funcionalidades ainda pendentes não aparecem como operacionais.

**Registro da etapa — 2026-09-07:**

- **Estado:** revisada estaticamente.
- **Tarefas entregues:** navegação responsiva com seção ativa, layouts principal e de treino, oito rotas previstas e recuperação de rota desconhecida; início do produto, guia de técnicas com busca, páginas informativas e configurações de interface.
- **Arquivos:** `src/layouts/{MainLayout,TrainingLayout}.vue`, `src/pages`, `src/router/{routes,index}.ts`, `src/router/meta.d.ts`, componentes compartilhados e `src/components/training/FretLegend.vue`, `src/stores/interface.ts`, `src/i18n`, `src/boot/i18n.ts`, `src/App.vue`, `src/css`, `quasar.config.ts`, `index.html` e `public/favicon.svg`.
- **Decisões relevantes:** idioma inicial `pt-BR`, alternativa `en-US` com esquema compartilhado e tradução do Quasar sincronizada; tema escuro inicial, opção clara/sistema e redução de efeitos. Busca e preferências são mantidas pelo Pinia durante a visita; a interface informa que recarregar restaura os padrões. Os frets têm cor, posição 1–5, letra e nome. Títulos de página, atributo `lang`, salto ao conteúdo e foco após navegação acompanham a interface; o menu móvel contempla abertura, fechamento, Escape pelo Quasar e circulação do foco por teclado.
- **Disponibilidade real:** catálogo é um guia informativo das oito técnicas do domínio, não um conjunto de exercícios executáveis. Dispositivos/calibração/histórico indicam preparação. `/play` reserva a área de treino e oferece retorno ao catálogo/configurações; `/results/:id` apresenta resultado indisponível com recuperação. Nenhum desses estados gera notas, captura controles ou apresenta métricas fictícias.
- **Exemplos removidos:** `SecondPage.vue`, `EssentialLink.vue`, `example-store.ts` e logo de exemplo; navegação e favicon da aplicação usam a identidade do Fretsense.
- **Revisão realizada:** somente análise estática manual de templates, imports, tipos, rotas, traduções, estado e estilos. Não houve execução de testes, lint, formatação automática, build, typecheck, aplicação, preview ou navegador.
- **Limitações e pendências:** aparência, responsividade e interação ainda não foram confirmadas em execução. Persistência de preferências permanece na etapa 04; captura, calibração, controles de sessão e highway jogável nas etapas 03–08; catálogo procedural na etapa 09; resultados e histórico nas etapas posteriores.
- **Confirmação/erros informados pelo desenvolvedor:** nenhuma confirmação em execução recebida.
- **Próxima etapa liberada:** etapa 03, domínio, geração inicial e ciclo da sessão.

### Etapa 03 — Implementar domínio, geração inicial e ciclo da sessão

**Objetivo:** produzir uma tentativa determinística antes da integração com hardware.

**Tarefas:**

- [x] Implementar os contratos definidos na etapa 01 e conversões de ticks para tempo de sessão.
- [x] Implementar geração com semente e versão, começando pela sequência `G R Y B O → O B Y R G` e notas repetidas para strum.
- [x] Representar acordes, duração e articulação por nota desde o primeiro modelo.
- [x] Validar configurações: valores finitos, intervalos permitidos, máscara válida, subdivisão, tamanho e combinações executáveis.
- [x] Limitar notas por tentativa e tamanho dos buffers; treino contínuo deve funcionar em blocos delimitados.
- [x] Implementar estados `idle`, `ready`, `countdown`, `running`, `paused`, `completed` e `aborted`, com transições explícitas.
- [x] Implementar início, pausa, retomada, reinício e encerramento, com resultado emitido uma única vez.
- [x] Capturar configuração e chart imutáveis por tentativa, incluindo versão do gerador e perfil de regras.
- [x] Permitir repetir exatamente a tentativa ou gerar uma variação com nova semente.

**Entregáveis:** módulos `domain`, `generation`, `timing` e `session`, ainda sem dependência de interface.

**Critério de conclusão:** a leitura dos fluxos mostra que a mesma configuração, semente e versão produzem o mesmo exercício e que uma tentativa possui início/fim e recursos limitados.

#### Registro da etapa 03 — 2026-09-07

- **Estado:** revisada estaticamente.
- **Tarefas entregues:** validação nas fronteiras, geração com semente/versão, conversões musicais, limites de recursos, snapshots congelados e ciclo completo de uma tentativa, com resultado consumido uma única vez e novas instâncias para repetição/variação/reinício.
- **Arquivos relevantes:** `src/engine/domain/{configuration,validation,immutable,limits}.ts`, perfil e contratos atualizados; módulos `src/engine/generation`, `src/engine/timing` e `src/engine/session`; [documentação do núcleo inicial](./engine-foundation.md).
- **Decisões relevantes:** `initial-generator@1.0.0`, padrões `ascending-descending@1.0.0` e `repeated-strum@1.0.0`, inicialmente no nível iniciante. Configuração padrão com 40 notas a 120 BPM; 40–300 BPM permitidos, no máximo 4.096 notas/10 minutos musicais por tentativa, 65.536 entradas, 131.072 julgamentos e 64 interrupções. Contagem de quatro semínimas; espera final pelo julgador limitada a cinco segundos ativos. Os limites são iniciais, sem medição em execução.
- **Reprodução:** mesmo contexto/semente/versão preserva todos os valores da chart; outro ID identifica cada tentativa. Variação exige nova semente, mas pode preservar as notas de um padrão canônico ou escolher novamente uma máscara de um conjunto finito. Versões não suportadas e charts divergentes são rejeitadas.
- **Disponibilidade real:** núcleo TypeScript independente da interface. O encerramento recebe um contrato de relatório do futuro julgador; não há cálculo de hits/misses nesta etapa. Sem relatório, o abandono preserva notas não julgadas e métricas indisponíveis. Excesso de recursos ou ausência de conclusão dentro do limite final produzem motivos explícitos de abandono.
- **Revisão realizada:** somente análise estática manual de contratos, imports, tipos, fórmulas, limites, geração, cópias e transições. Não foram criados ou executados testes, nem executados lint, formatação automática, build, typecheck, aplicação, preview ou navegador.
- **Limitações e pendências:** captura/mapeamento na etapa 04, relógio/áudio/calibração da plataforma na etapa 05, julgamento nas etapas 06/08 e integração jogável na etapa 07. Encadeamento automático do treino contínuo, catálogo completo e persistência permanecem nas etapas posteriores. Esta entrega não habilita gameplay na interface existente.
- **Confirmação/erros informados pelo desenvolvedor:** nenhuma confirmação em execução recebida.
- **Próxima etapa liberada:** etapa 04, teclado, Gamepad e mapeamento.

### Etapa 04 — Implementar teclado, Gamepad e mapeamento

**Objetivo:** fornecer o mesmo conjunto de ações de gameplay por teclado, guitarra ou controle.

**Tarefas:**

- [x] Criar contrato de adaptador com conexão, disponibilidade, captura, limpeza e descarte.
- [x] Implementar teclado com códigos de tecla configuráveis para cinco frets, strum para cima/baixo e pausa.
- [x] Ignorar repetição automática de tecla; preservar pressionamentos e liberações reais.
- [x] Restringir captura à sessão ou ao assistente de mapeamento; não consumir entradas de formulários fora desse contexto.
- [x] Implementar Gamepad com comparação de estados, botões e eixos mapeáveis, limiares e retorno ao neutro para ações de strum.
- [x] Permitir selecionar o dispositivo ativo, sem presumir uma ordem universal de botões ou mesclar controles acidentalmente.
- [x] Criar assistente de mapeamento e visualização dos frets, acordes e strums detectados.
- [x] Salvar perfis e preferências em um repositório pequeno e versionado, inicialmente com `localStorage`, tratando falha de gravação.
- [x] Registrar capacidades: direção do strum, frets simultâneos e botões adicionais identificáveis.
- [x] Pausar e limpar entradas em perda de foco, dispositivo desconectado ou troca de dispositivo; retomar somente por ação do usuário.
- [x] Descartar listeners e ciclos de captura ao sair do fluxo; não inferir mão ou dedo usado a partir de frets comuns.

**Entregáveis:** `src/platform/input`, repositório de preferências, página de dispositivos e componentes de mapeamento.

**Critério de conclusão:** todos os adaptadores alimentam o mesmo contrato; limitações de capacidade ficam explícitas e não viram acertos técnicos presumidos.

#### Registro da etapa 04 — 2026-09-07

- **Estado:** revisada estaticamente.
- **Tarefas entregues:** contrato e captura exclusiva de teclado/Gamepad, validação de mapeamento, descoberta/seleção explícita de conexão, assistente de atribuição, monitor de frets/strums/acordes, capacidades observadas e persistência de perfis/preferências com estados de falha.
- **Arquivos relevantes:** `src/platform/input`, `src/platform/preferences/repository.ts`, `src/pages/DevicesPage.vue`, `src/components/devices`, `src/components/StorageNotice.vue`, store/interface, aplicação e mensagens `pt-BR`/`en-US`. Uso e fronteiras documentados em [entrada e preferências](./input-and-preferences.md).
- **Decisões relevantes:** teclado inicial A/S/D/F/G, setas cima/baixo e Escape; Gamepad sem índices universais presumidos, com aprendizado de botões/eixos e limiares iniciais 0,6/0,3. Captura só em área focada, com Tab livre, pausa prioritária, retorno ao neutro e reinício explícito após interrupções. Todos os eventos usam timestamp de observação nesta etapa.
- **Capacidades:** confirma somente acordes e controles extras realmente recebidos; não deduz máximo de teclas, alternância bem-sucedida, mão ou dedo. Mudanças de mapeamento limpam evidências anteriores; salvar cria nova versão e invalida referências de calibração do perfil editado.
- **Persistência:** chave `fretsense.preferences.v1`, esquema 1, até 16 perfis e 262.144 unidades de texto. Guarda idioma, tema, redução de efeitos e perfil selecionado; conexão física e busca são transitórias. Falhas mantêm alterações em memória; dados inválidos/incompatíveis são preservados sem sobrescrita automática.
- **Integração preparada:** `createSessionInput` encaminha eventos, baseline e interrupções à sessão, preservando sequência ao retomar/substituir adaptadores. Exige o relógio ativo da etapa 05 e um coordenador proprietário do descarte; ainda não é acionado pela área jogável.
- **Revisão realizada:** somente análise estática manual de tipos, imports, transições, limites, callbacks, descarte, componentes, mensagens e tratamento de armazenamento. Consulta às especificações primárias de Gamepad/UI Events; não foram criados ou executados testes, nem executados lint, formatação automática, build, typecheck, aplicação ou verificações no navegador.
- **Limitações e pendências:** hardware, visual e comportamento ainda não confirmados em execução; sem WebHID, calibração, áudio ou treino jogável. Limiares são preservados por perfil e recebem os padrões ao remapear. Não há sincronização de preferências entre abas ou migração de esquemas desconhecidos.
- **Confirmação/erros informados pelo desenvolvedor:** nenhuma confirmação em execução recebida.
- **Próxima etapa liberada:** etapa 05, relógio, áudio e calibração.

### Etapa 05 — Implementar relógio, áudio e calibração

**Objetivo:** alinhar notas, entrada, áudio e visualização em uma única referência temporal.

**Tarefas:**

- [x] Implementar um relógio de sessão monotônico com início, tempo ativo e exclusão dos períodos de pausa.
- [x] Converter timestamps de entrada e tempo de áudio para a referência comum; documentar fallback quando o dispositivo não fornecer timestamp utilizável.
- [x] Manter ordenação estável para eventos observados no mesmo instante, sem inventar precisão que o dispositivo não fornece.
- [x] Criar metrônomo e contagem de entrada com Web Audio, agendando sons antecipadamente no relógio de áudio.
- [x] Inicializar ou retomar áudio a partir de interação do usuário e tratar indisponibilidade ou suspensão.
- [x] Cancelar sons pendentes e reancorar relógios ao pausar/reiniciar; uma pausa não deve acumular sons ou entradas para a retomada.
- [x] Criar calibração guiada e ajustes manuais com unidades e sentido do ajuste claros.
- [x] Tratar a medição guiada inicial como compensação combinada; não afirmar que ela isolou latência de áudio, vídeo e entrada individualmente.
- [x] Aplicar offset de julgamento uma única vez. Offset visual deve deslocar a highway sem alterar o resultado musical por efeito colateral.
- [x] Salvar calibração por perfil/contexto e permitir retorno aos valores padrão; indicar quando uma mudança de dispositivo ou saída exige revisão.
- [x] Preparar modo sem áudio com informação clara de que a referência sonora está indisponível.

**Entregáveis:** adaptadores de relógio e áudio, metrônomo, página de calibração e contratos de tempo documentados.

**Critério de conclusão:** geração, julgamento, áudio e desenho usam conversões explícitas; pausa e calibração não contam o tempo duas vezes nem alteram notas já julgadas.

#### Registro da etapa 05 — 2026-09-07

- **Estado:** revisada estaticamente.
- **Tarefas entregues:** relógio monotônico e projeção de tempo ativo, timestamps de teclado/Gamepad com fallback e sequência estável, conversões explícitas de áudio, metrônomo com contagem antecipada, calibração guiada/manual, modo sem áudio e persistência por contexto.
- **Arquivos relevantes:** `src/platform/{timing,audio,calibration}`, `src/platform/input`, `src/engine/timing`, `src/engine/session/training-session.ts`, `src/stores/calibration.ts`, `src/pages/CalibrationPage.vue` e traduções `pt-BR`/`en-US`. Contratos e uso em [relógio e calibração](./timing-and-calibration.md).
- **Decisões temporais:** a sessão continua sendo a única proprietária da exclusão de pausas/contagens. `SessionInputTimeline` entrega tempo bruto; `judgmentTime` e `visualTime` centralizam correções independentes. A sessão usa a primeira função na validação de relatórios; a prévia usa somente a segunda. Julgador e highway deverão consumir essas fronteiras nas etapas 06–07.
- **Áudio e interrupções:** gesto explícito para preparar/retomar, ativação limitada a três segundos, janela de agendamento de 120 ms consultada a cada 25 ms, no máximo 16 nós e 4.096 pulsos/610 segundos. Interrupção cancela sons e amostras; retomada da sessão reancora áudio e preserva a posição da grade musical. Nenhuma retomada automática.
- **Calibração:** quatro pulsos de preparação e 16 strums a 90 BPM; mínimo de 12 amostras, janela de ±250 ms, mediana e MAD máximo de 40 ms. A estimativa combina resposta humana e atrasos do conjunto. Ajustes manuais aceitam ±1.000 ms; salvar e restaurar padrões são ações explícitas.
- **Persistência:** chave `fretsense.calibrations.v1`, esquema 1, até 64 ajustes e 262.144 unidades de texto. Compatibilidade exige perfil/versão e contexto de áudio/navegador/plataforma. Saída desconhecida exige conferência; alterações detectadas limpam o rascunho e solicitam revisão. Falhas mantêm dados em memória; dados incompatíveis não são sobrescritos.
- **Revisão realizada:** somente análise estática manual de imports, tipos, fórmulas, estados, callbacks, limites, persistência e descarte. Consulta às especificações primárias de Web Audio, High Resolution Time e Gamepad. Não foram criados ou executados testes, nem executados lint, formatação automática, build, typecheck, aplicação ou verificações no navegador.
- **Limitações e pendências:** calibração e metrônomo disponíveis na página própria; `SessionAudio` e `createSessionInput` aguardam o coordenador jogável da etapa 07. Precisão física, áudio, visual e hardware não foram confirmados em execução. Sem sincronização entre abas ou migração de dados desconhecidos.
- **Confirmação/erros informados pelo desenvolvedor:** nenhuma confirmação em execução recebida.
- **Próxima etapa liberada:** etapa 06, julgamento inicial.

### Etapa 06 — Implementar julgamento inicial

**Objetivo:** avaliar notas simples e acordes em tempo real sem depender da renderização.

**Tarefas:**

- [x] Implementar seleção determinística da nota candidata dentro da janela e regras de desempate.
- [x] Julgar notas de strum usando a ação de strum e os frets ativos; manter um botão pressionado não produz novas ações.
- [x] Julgar tap por transições de frets elegíveis; segurar o mesmo fret não acerta automaticamente todas as notas futuras.
- [x] Implementar notas duplas/triplas como um resultado musical único e registrar detalhes de frets ausentes/adicionais.
- [x] Definir tolerância de formação de acorde conforme o perfil, limitada pela janela da nota, sem permitir acertos retroativos ilimitados.
- [x] Expirar notas pelo relógio mesmo sem eventos de entrada; consumir cada nota uma única vez.
- [x] Registrar acerto, antecipação/atraso dentro da janela, omissão, fret incorreto e strum extra/ausente.
- [x] Calcular combo, melhor combo e precisão básica com regras para não duplicar penalizações do mesmo fato.
- [x] Diferenciar strum extra sem nota associada de erro de uma nota; registrá-lo separadamente no resultado.
- [x] Encerrar a tentativa depois da janela final aplicável, preservando dados suficientes para a análise posterior.

**Entregáveis:** julgador inicial, eventos de resultado e agregação básica.

**Critério de conclusão:** cada nota alcança um estado final, cada evento tem tratamento definido e os resultados não dependem da taxa de atualização da interface.

#### Registro da etapa 06 — 2026-09-07

- **Estado:** implementação concluída e revisada estaticamente.
- **Tarefas entregues:** julgador determinístico de strum/tap e acordes de dois/três frets, expiração por relógio, evidência de strum ausente, detalhes de frets incorretos, strums extras separados, combo, precisão e timing básico, com registros imutáveis e encerramento após a janela final.
- **Arquivos relevantes:** `src/engine/judgment/{initial-judge,index}.ts`, `src/engine/session/training-session.ts`, README e documentação de integrações. Contratos de uso em [julgamento inicial](./initial-judgment.md).
- **Decisões musicais:** perfil `fretsense-v1@1.0.0` preservado; candidata mais antiga na janela inclusiva de ±120 ms, sem filtro prévio por fret/articulação. Strum tem prioridade no evento e consome no máximo um início. Acorde não pode ser completado depois do strum (`formationGraceMs = 0`). Tap repetido exige liberação real do alvo e novo pressionamento; strum em tap pode acertar com falha técnica.
- **Tempo e métricas:** offset aplicado uma vez pelo julgador em entradas/horizontes; imagem independente. Expirações registram a borda tardia, embora só sejam emitidas depois dela. Precisão usa notas resolvidas; timing usa hits com média, erro absoluto e desvio populacional incremental. Ausência de amostras e direção desconhecida não produzem sucesso presumido.
- **Integração com sessão:** `enableInitialJudgment()` ativa o produtor em `ready`; `recordInput` e `advance` encaminham dados e atualizam o relatório. `advance` conclui automaticamente após a janela final; pausa/abandono não concluem automaticamente por essa chamada e preservam notas futuras não julgadas. Repetição/variação/reinício criam julgador e registros novos. `getEvaluation()` e `getJudgments()` expõem dados imutáveis para o coordenador futuro.
- **Limites e escopo naquele registro:** validava snapshot/chart canônicos e ainda rejeitava HOPO/sustains antes da contagem julgada; essa restrição foi removida na etapa 08. Conserva limites de 4.096 notas, 65.536 entradas e 131.072 julgamentos, sem sobrescrita de registros. Metas por direção materializadas nas notas são observadas; catálogo e cenários completos continuam nas etapas posteriores.
- **Revisão realizada:** somente análise estática manual de tipos, imports, máscaras, janelas, ordem, agregação, limites, pausa/retomada, conclusão e referências documentais. Não foram criados ou executados testes, nem executados lint, formatação automática, build, typecheck, aplicação ou navegador.
- **Limitações e pendências naquele registro:** a integração jogável ainda dependia da etapa 07 e HOPO/caudas da etapa 08; ambas foram entregues posteriormente. Diagnóstico detalhado, histórico e progressão permanecem nas etapas 11–14. Não houve confirmação prática de funcionamento ou desempenho.
- **Confirmação/erros informados pelo desenvolvedor:** nenhuma confirmação em execução recebida.
- **Próxima etapa liberada:** etapa 07, highway e primeiro treino jogável.
- **Revisão de conclusão — 2026-09-07:** o WIP foi auditado e corrigido para que uma entrada posterior à borda final apenas feche o horizonte, sem criar `extra-strum`, registro ou elegibilidade dependentes da ordem de atualização; `recordInput` agora conclui a sessão nesse mesmo fluxo. A ausência conhecida de direção também é reportada como `unsupported-capability` desde a primeira avaliação. Revisão exclusivamente estática e manual, ainda sem confirmação em execução.

### Etapa 07 — Integrar highway e primeiro treino jogável

**Objetivo:** concluir o marco M1 com um fluxo utilizável de ponta a ponta.

**Tarefas:**

- [x] Implementar highway em Canvas 2D com cinco pistas, linha de acerto, notas simples e acordes.
- [x] Calcular a posição das notas a partir do tempo restante; velocidade visual e BPM são parâmetros distintos.
- [x] Desenhar somente a região necessária, considerando tamanho do Canvas e densidade de pixels.
- [x] Exibir frets ativos, contagem inicial, combo, progresso e feedback de timing sem depender apenas de cor.
- [x] Integrar um composable controlador da sessão, mantendo o renderer separado do julgador.
- [x] Permitir escolher perfil de entrada, usar calibração, selecionar o padrão inicial e configurar BPM, repetições e articulação disponível.
- [x] Integrar iniciar, pausar, retomar com contagem, reiniciar e sair, descartando os recursos da sessão anterior.
- [x] Ao completar, mostrar notas acertadas/esperadas, precisão, combo e timing básico; permitir repetir o mesmo exercício.
- [x] Encaminhar indisponibilidade de dispositivo, áudio ou configuração inválida para uma ação de recuperação.

**Entregáveis:** página de treino, renderer, componentes de gameplay e resultado básico em memória.

**Critério de conclusão:** o fluxo implementado conecta seleção de entrada, configuração, tentativa e resultado para teclado e Gamepad. Confirmação em hardware e navegador fica com o desenvolvedor.

#### Registro da etapa 07 — 2026-09-07

- **Estado:** implementação concluída e revisada estaticamente; M1 concluído no código.
- **Tarefas entregues:** configuração dos dois padrões iniciais, strum/tap/acordes, perfil e conexão de entrada, calibração salva ou padrão, metrônomo/silêncio, contagem, highway Canvas, feedback, controles de ciclo e resultado básico em memória.
- **Arquivos relevantes:** `src/rendering`, `src/components/training/TrainingHighway.vue`, `src/composables/useTrainingSession.ts`, `src/pages/{PlayPage,CatalogPage}.vue`, integração de sessão/entrada, estilos e mensagens `en-US`/`pt-BR`. Contratos de uso em [treino jogável](./playable-training.md).
- **Decisões relevantes:** velocidade visual fixa de 300 px/s, independente do BPM; busca binária limita o desenho ao intervalo visível; densidade do Canvas limitada a 2. A fronteira de entrada abre `running` no prazo da contagem sem antecipar o horizonte do julgador, preservando o ataque do tick zero. O resultado não é persistido; repetir conserva configuração e semente determinística, mas cria nova tentativa.
- **Recuperação e recursos:** falhas de áudio oferecem modo silencioso; perfil/conexão e calibração apontam para suas telas. Reiniciar descarta frame, captura, metrônomo e `AudioContext` da tentativa anterior; sair ou desmontar também encerra a descoberta periódica de Gamepads.
- **Revisão realizada:** somente análise estática manual de templates, tipos, imports, estados, transições, timestamps e descarte. Não foram executados testes, lint, formatação, build, typecheck, aplicação ou navegador.
- **Limitações e pendências:** funcionamento visual, áudio, timing e hardware não foram confirmados em execução. HOPO/sustains seguem na etapa 08; catálogo/avaliação completos, diagnóstico e persistência seguem nas etapas posteriores.
- **Confirmação/erros informados pelo desenvolvedor:** foram relatados e corrigidos três diagnósticos estáticos: alias de `this` na captura exclusiva, associação do rótulo acessível do highway e ausência de `sinkId` no tipo padrão de `AudioContext`. Ainda não houve confirmação do fluxo em execução.
- **Próxima etapa liberada:** etapa 08, articulações e sustains.

### Etapa 08 — Completar articulações e sustains

**Objetivo:** sustentar as mecânicas necessárias ao catálogo completo.

**Tarefas:**

- [x] Implementar HOPO com elegibilidade por nota e estado de cadeia, conforme `fretsense-v1`.
- [x] Exigir o início/recuperação por strum definidos no perfil e tratar strum voluntário em nota HOPO de forma consistente.
- [x] Completar regras de tapping, incluindo notas repetidas, alternância e interação com frets mantidos.
- [x] Implementar sustains com duração em ticks, estado dos frets mantidos e liberação antecipada.
- [x] Separar resultado do início da nota da duração sustentada; definir encerramento do sustain e seu impacto no combo.
- [x] Suportar mudanças entre nota simples e acorde, acordes duplos/triplos e articulações diferentes dentro do mesmo trecho.
- [x] Implementar avaliação de alternate strum com direção conhecida, primeiro sentido configurável e reinício da alternância após pausas musicais definidas no cenário.
- [x] Representar direção indisponível como técnica não avaliada; nunca como falha ou sucesso inventado.
- [x] Definir se sobreposições de sustains são suportadas pelo perfil; rejeitar na configuração os padrões ainda não suportados.
- [x] Estender highway, eventos e métricas para os novos estados, finalizando a sessão apenas depois das caudas e janelas finais.

**Entregáveis:** perfil de regras completo para as técnicas da primeira versão e renderização correspondente.

**Critério de conclusão:** notas, articulações e sustains seguem regras explícitas em cenários isolados e mistos; o modelo de dados inicial permanece suficiente.

**Registro da etapa — 2026-09-07:**

- **Estado:** revisada estaticamente.
- **Tarefas entregues:** cadeia HOPO com início/recuperação e repetição por strum; tapping por transições reais; caudas concluídas, quebradas, não avaliadas ou canceladas; direção de alternate strum; suporte do julgador a máscaras/articulações variadas e padrão-base misto `articulation-transitions@1.0.0`; encerramento após cabeças, caudas e janela final.
- **Arquivos:** `src/engine/judgment/initial-judge.ts`, integração em `src/engine/session`, validação em `src/engine/domain/configuration.ts`, padrão-base em `src/engine/generation/generator.ts`, `src/rendering/highway-renderer.ts`, área jogável em `src/{composables,pages,i18n}`, além de `docs/articulations-and-sustains.md` e atualizações documentais.
- **Decisões relevantes:** o nome público `InitialJudge` foi preservado por compatibilidade; a cadeia HOPO é estado explícito e pausa a desarma. Caudas mantêm evento separado da cabeça, preservam combo ao concluir, zeram uma vez ao quebrar e são canceladas sem falha no abandono. A retomada confere o baseline no tempo congelado. O perfil continua rejeitando sobreposição musical; caudas ativas usam coleção para aceitar uma próxima cabeça antecipada na janela. Direção desconhecida/automática permanece não avaliada.
- **Interface disponível:** subida/descida por strum, HOPO ou tap; sustains de 120/240 ticks; notas/acordes repetidos; alternate strum de nota simples com primeiro sentido configurável. Círculo, losango, quadrado, setas e linhas de cauda diferenciam os estados na highway.
- **Revisão realizada:** somente análise estática manual de código, imports, tipos, eventos, invariantes temporais, estados de pausa/abandono, métricas, traduções, documentação e diferenças. Não houve testes, lint, formatação automática, build, typecheck, aplicação, preview ou navegador.
- **Limitações e pendências:** o cenário misto base é determinístico e não aparece como catálogo completo; composição procedural, novos padrões e níveis pertencem à etapa 09. Aparência, timing, hardware e comportamento em execução ainda não foram confirmados pelo desenvolvedor.
- **Confirmação/erros informados pelo desenvolvedor:** nenhuma confirmação em execução recebida.
- **Próxima etapa liberada:** etapa 09, catálogo procedural e níveis.

### Etapa 09 — Construir catálogo procedural e níveis

**Objetivo:** transformar as mecânicas em exercícios úteis e progressivos.

**Tarefas:**

- [ ] Criar descritores de técnica com objetivo, parâmetros permitidos, capacidades necessárias e métricas relevantes.
- [ ] Implementar geradores de strum simples/alternado: repetição, mudanças de fret, rajadas e pausas.
- [ ] Implementar sequências ascendentes/descendentes, trills, zig-zags, escadas, saltos e mudanças de direção.
- [ ] Implementar padrões de HOPO e tapping, diferenciando geometria do padrão e articulação da nota.
- [ ] Implementar acordes duplos/triplos, trocas de acordes e alternância entre acordes e notas simples.
- [ ] Implementar sustains e composição de cenários mistos com identificação dos trechos e transições.
- [ ] Criar presets inicial, intermediário e avançado por família; expressar dificuldade por estrutura, densidade e transições, além do BPM.
- [ ] Acrescentar subdivisões regulares e tercinas respeitando a resolução musical escolhida.
- [ ] Garantir que mutações respeitem frets permitidos, capacidades, articulações e limites de simultaneidade.
- [ ] Oferecer edição simples de padrões manuais pelo mesmo modelo, com limites de tamanho e feedback de configuração inválida.
- [ ] Versionar catálogo e geradores; manter a chart realizada no snapshot para reprodução mesmo após atualização do algoritmo.

**Entregáveis:** catálogo de técnicas, presets e geradores reproduzíveis.

**Critério de conclusão:** cada família listada na ideia tem exercícios em três níveis, objetivo identificável e geração compatível com o perfil selecionado.

### Etapa 10 — Completar os modos prática e avaliação

**Objetivo:** permitir treino livre e avaliações em condições registradas.

**Tarefas:**

- [ ] Construir a seleção de técnica e nível com configurações avançadas para BPM, frets, subdivisão, duração, regras e metas.
- [ ] Mostrar resumo do exercício e requisitos de entrada antes de iniciar, com prévia das notas planejadas.
- [ ] Oferecer prática em blocos repetidos e foco em trecho; mudanças de configuração produzem uma nova tentativa identificável.
- [ ] Oferecer avaliação com snapshot congelado, duração/repetições definidas e resultado ao final.
- [ ] Marcar pausa/interrupção em avaliação como condição que impede progressão automática; permitir reiniciar uma avaliação completa.
- [ ] Diferenciar repetir a mesma chart, gerar uma variação e aplicar uma recomendação.
- [ ] Preservar a configuração ao consultar resultados e voltar ao treino.
- [ ] Impedir mudanças de dispositivo, regras ou calibração no meio de uma tentativa sem encerrá-la ou invalidar sua comparabilidade.
- [ ] Tratar navegação direta para `/play` sem configuração e para resultados inexistentes com estados recuperáveis.

**Entregáveis:** catálogo navegável, configurador completo e fluxos de prática/avaliação.

**Critério de conclusão:** o usuário entende o objetivo, as condições e o resultado de cada tentativa; ajustes não modificam silenciosamente o histórico da tentativa anterior.

### Etapa 11 — Implementar análise e diagnóstico de erros

**Objetivo:** explicar os resultados por técnica e trecho, além de apresentar uma porcentagem total.

**Tarefas:**

- [ ] Definir métricas com numerador, denominador, unidade e política para dados ausentes.
- [ ] Calcular precisão de notas como notas acertadas / notas esperadas elegíveis, contando um acorde como uma nota; apresentar análise de frets separadamente.
- [ ] Calcular média com sinal, erro absoluto e dispersão do timing apenas sobre eventos elegíveis, sempre com quantidade de amostras.
- [ ] Calcular precisão por fret/transição, erros de acordes, duração sustentada e cumprimento da direção de strum.
- [ ] Implementar alinhamento temporal para análise posterior, limitado por trecho e distância temporal para evitar associações sem relação musical.
- [ ] Classificar omissões, entradas extras, substituições e inversões com base no alinhamento e nos eventos originais.
- [ ] Evitar classificar uma formação de acorde como sequência invertida ou uma mesma falha como várias ocorrências independentes.
- [ ] Separar fatos observados de hipóteses: mostrar evidência e quantidade de ocorrências para um padrão sugerido.
- [ ] Detectar tendência de antecipação/atraso e diferenças entre subida/descida apenas quando houver dados suficientes.
- [ ] Preservar julgamentos e combo originais; diagnóstico posterior não reescreve a execução já apresentada.
- [ ] Executar análise ao terminar o bloco/tentativa e impor limites de dados e custo. Caso necessário, usar Worker com mensagens versionadas, cancelamento e descarte de resultados de sessões antigas.

**Entregáveis:** módulos de métricas e diagnóstico, formato de relatório e seção detalhada do resultado. Esta etapa conclui M2.

**Critério de conclusão:** todo diagnóstico pode ser relacionado a eventos registrados; dados insuficientes ou capacidades ausentes aparecem como indisponíveis, sem valores artificiais.

### Etapa 12 — Persistir sessões e histórico local

**Objetivo:** conservar resultados, configurações e contexto sem exigir backend.

**Tarefas:**

- [ ] Criar repositórios com contratos separados da implementação de armazenamento.
- [ ] Manter preferências e perfis pequenos no armazenamento versionado da etapa 04; usar IndexedDB para sessões, charts e resultados.
- [ ] Definir versões de esquema, migrações e tratamento de dados antigos ou incompatíveis sem apagar histórico silenciosamente.
- [ ] Persistir snapshot, chart realizada, regras/gerador, calibração, dispositivo/capacidades, métricas e estado final.
- [ ] Salvar cada tentativa por ID de forma idempotente e manter gravações grandes fora do caminho de julgamento.
- [ ] Definir retenção e limites para eventos brutos; guardar resumo e informar quando diagnóstico/reprodução detalhada não estiver mais disponível.
- [ ] Diferenciar replay do exercício de replay da execução; não oferecer replay da execução sem os eventos necessários.
- [ ] Oferecer listagem paginada/filtros e consulta de detalhes de sessão.
- [ ] Tratar cota, armazenamento indisponível e falha de migração com modo em memória e indicação de que a sessão não foi salva.
- [ ] Permitir exportar resultados e configurações em JSON versionado e remover sessões por ação explícita do usuário.
- [ ] Manter importação de backups como evolução separada, com validação de esquema e tamanho quando implementada.

**Entregáveis:** persistência local, migrações iniciais, acesso a resultados por ID e histórico básico.

**Critério de conclusão:** resultados preservam o contexto da execução; falhas de armazenamento não interrompem a gameplay nem são apresentadas como gravações bem-sucedidas.

### Etapa 13 — Implementar treino corretivo e progressão

**Objetivo:** transformar diagnósticos em uma próxima ação compreensível.

**Tarefas:**

- [ ] Criar regras que relacionem padrões de erro a exercícios: transição problemática, inversão, acorde incompleto, strum irregular ou sustain interrompido.
- [ ] Definir quantidade mínima de amostras, limite de erros, precisão desejada e repetições consistentes como parâmetros de progressão.
- [ ] Excluir tentativas abandonadas ou avaliações interrompidas de promoções automáticas; manter seus resultados identificados no histórico.
- [ ] Não promover competência de alternate strum quando a direção não foi observada.
- [ ] Propor redução/aumento limitado de BPM, simplificação do padrão ou foco em uma transição, respeitando os limites do catálogo.
- [ ] Alterar preferencialmente uma dimensão de dificuldade por recomendação para manter a evolução interpretável.
- [ ] Implementar estabilidade na progressão: não alternar nível para cima/baixo por uma única tentativa fora do padrão.
- [ ] Apresentar a evidência e o efeito da recomendação antes de iniciar o próximo exercício.
- [ ] Permitir aceitar, ignorar ou ajustar a sugestão; o modo adaptativo pode encadear blocos dentro de limites previamente escolhidos.
- [ ] Registrar recomendação, decisão do usuário e configuração resultante, sem modificar a sessão que originou a sugestão.

**Entregáveis:** motor de adaptação por regras e fluxo de exercício corretivo.

**Critério de conclusão:** toda mudança proposta tem uma causa rastreável e só passa a valer na próxima tentativa; a progressão depende de condições comparáveis.

### Etapa 14 — Completar relatórios e acompanhamento

**Objetivo:** tornar dificuldades e evolução legíveis ao longo das sessões.

**Tarefas:**

- [ ] Organizar relatório com resumo, timing, frets, transições, acordes, strum, sustains e recomendações aplicáveis.
- [ ] Exibir no resultado técnica/nível, BPM, regra usada, dispositivo, calibração e condição da tentativa.
- [ ] Criar distribuição de timing e mapa de erros do padrão com representação textual/tabelada equivalente.
- [ ] Separar resultados por técnica e trecho em exercícios mistos.
- [ ] Criar histórico filtrável por período, família, nível, modo e condição de conclusão.
- [ ] Comparar apenas grupos compatíveis ou exibir claramente as diferenças de BPM, chart, regra, janela e calibração.
- [ ] Mostrar evolução e limites de BPM a partir de tentativas registradas com amostras suficientes; não extrapolar habilidade a partir de uma única sessão.
- [ ] Permitir abrir uma sessão, repetir sua chart salva ou criar treino focado em um problema identificado.
- [ ] Distinguir dado inexistente, amostra insuficiente e técnica não avaliada de desempenho igual a zero.

**Entregáveis:** relatórios completos, histórico e painel de evolução. Esta etapa conclui M3.

**Critério de conclusão:** o usuário consegue localizar uma dificuldade, entender sua evidência, comparar sessões compatíveis e iniciar uma ação de treino relacionada.

### Etapa 15 — Consolidar robustez, desempenho e acessibilidade

**Objetivo:** revisar os caminhos de falha e a manutenção dos recursos ao longo do uso.

**Tarefas:**

- [ ] Revisar estaticamente descarte de listeners, ciclos de renderização/captura, agendamentos de áudio, Workers e conexões de armazenamento.
- [ ] Revisar pausa/retomada em foco perdido, aba oculta, áudio suspenso, desconexão e mudança de rota.
- [ ] Garantir que interrupções não se convertam em uma sequência de misses nem provoquem retomada inesperada.
- [ ] Evitar persistência síncrona, análise pesada e alocações desnecessárias por nota no caminho de gameplay.
- [ ] Limitar buffers, duração, densidade de charts e trabalho por trecho; definir recuperação para configurações fora dos limites.
- [ ] Disponibilizar diagnóstico local opcional com versão, perfil, semente e informações de sessão úteis para relatos do desenvolvedor, sem coleta remota automática.
- [ ] Revisar foco, rótulos, contraste, pistas diferenciadas por símbolos, redução de efeitos e controles remapeáveis.
- [ ] Evitar anúncios acessíveis a cada nota; priorizar estado da sessão, ações e resumo final.
- [ ] Tratar redimensionamento e preferências visuais sem reiniciar o julgamento ou mudar a velocidade musical.
- [ ] Documentar capacidades esperadas por entrada/navegador, distinguindo suporte planejado de compatibilidade confirmada pelo desenvolvedor.
- [ ] Incorporar problemas relatados pelo desenvolvedor e ajustar limites com base nessas evidências, sem declarar latência ou desempenho medidos pelo agente.

**Entregáveis:** tratamento consistente de falhas, recursos revisados e registro de limitações conhecidas.

**Critério de conclusão:** a revisão manual não identifica recursos sem descarte, estados sem recuperação ou limitações ocultas. Confirmações práticas de desempenho e compatibilidade permanecem responsabilidade do desenvolvedor.

### Etapa 16 — Preparar documentação e entrega da primeira versão

**Objetivo:** tornar a versão implementada utilizável e sua situação verificável pelo responsável.

**Tarefas:**

- [ ] Atualizar README com funcionalidades realmente disponíveis, navegação e links para regras e plano.
- [ ] Documentar mapeamento, calibração, modos de treino, interpretação de métricas e recuperação de falhas.
- [ ] Registrar as versões de esquema, catálogo, gerador e regras usadas na entrega.
- [ ] Documentar limitações de dispositivos, teclado, precisão observável e diferenças em relação a perfis específicos de GH/RB.
- [ ] Consolidar alterações e pendências materiais, separando requisitos implementados, confirmações do desenvolvedor e expansões futuras.
- [ ] Preparar informações de hospedagem estática e contexto seguro para APIs de dispositivos, mantendo o roteamento hash escolhido.
- [ ] Encaminhar empacotamento, execução, testes e publicação ao desenvolvedor responsável; o agente não executa essas ações sob as orientações atuais.
- [ ] Registrar os erros relatados com contexto disponível, corrigir o código e entregar revisão estática das correções.

**Entregáveis:** documentação da versão, notas de entrega e pendências atualizadas. Esta etapa conclui M4 do trabalho de implementação.

**Critério de conclusão:** os fluxos das etapas 01–15 estão implementados e descritos, sem pendências essenciais ocultas. O estado de publicação e funcionamento confirmado deve refletir somente o que o desenvolvedor efetivamente informou.

## 6. Etapas de expansão

As etapas abaixo fazem parte da evolução planejada e não bloqueiam M1–M4. Devem ser priorizadas por necessidade observada, depois da primeira versão.

### Etapa 17 — Ampliar dispositivos com WebHID

- [ ] Priorizar modelos concretos que não sejam atendidos pelo adaptador Gamepad.
- [ ] Consultar documentação oficial atual das APIs e dos dispositivos antes de definir compatibilidade.
- [ ] Implementar adaptadores por formato de relatório conhecido, reutilizando entrada normalizada, mapeamento e calibração.
- [ ] Tratar seleção, permissão negada, desconexão e indisponibilidade com retorno ao teclado/Gamepad.
- [ ] Registrar capacidades adicionais, como botões solo distinguíveis, sem inferir ações que o hardware não reporta.

**Conclusão:** os modelos explicitamente atendidos usam o mesmo fluxo de treino, com limitações documentadas e confirmação de hardware a cargo do desenvolvedor.

### Etapa 18 — Oferecer PWA e uso offline

- [ ] Planejar recursos locais necessários para interface, catálogo, áudio e dados de sessão.
- [ ] Configurar manifesto, cache e atualização de recursos conforme a versão do Quasar usada no projeto.
- [ ] Adiar aplicação de atualizações enquanto houver tentativa ativa.
- [ ] Manter migrações e dados locais coerentes entre versões e oferecer recuperação para cache incompatível.
- [ ] Explicar o que precisa de uma primeira carga online e o que permanece disponível depois dela.

**Conclusão:** a implementação contempla instalação, cache e atualização sem perda silenciosa de sessão. Preparação de build, uso offline em execução e publicação ficam com o desenvolvedor.

### Etapa 19 — Adicionar perfis específicos de gameplay

- [ ] Selecionar um jogo e versão de referência por vez e documentar suas regras com fontes primárias ou comportamento confirmado pelo responsável.
- [ ] Implementar variações de HOPO, tapping, ancoragem, acordes, sustains e janelas dentro de perfis versionados.
- [ ] Declarar o subconjunto de mecânicas atendidas e impedir que resultados de perfis distintos sejam comparados como equivalentes.
- [ ] Adaptar presets às capacidades do perfil e manter o perfil próprio do Fretsense disponível.

**Conclusão:** cada perfil declara regras e alcance; equivalência com um jogo não é presumida pelo nome do perfil.

### Etapa 20 — Avaliar IA local e integrações opcionais

- [ ] Identificar uma tarefa em que as regras da etapa 13 sejam insuficientes, como classificação de padrões mais complexos.
- [ ] Definir dados necessários, limites de memória/armazenamento, execução fora do julgamento e fallback por regras antes de selecionar uma biblioteca ou modelo.
- [ ] Exigir evidência fornecida pelo desenvolvedor de que a abordagem melhora o diagnóstico antes de torná-la padrão.
- [ ] Preservar explicações baseadas nos eventos e opção de usar o treinador sem baixar modelos.
- [ ] Planejar separadamente conta, sincronização, compartilhamento e importação de charts somente se passarem a ser prioridades de produto.
- [ ] Para sincronização futura, definir IDs, conflitos, versionamento e consentimento de envio sem alterar o funcionamento local existente.

**Conclusão:** cada recurso adicional precisa de escopo próprio e benefício demonstrável; sua ausência não compromete o treinador local entregue.

## 7. Riscos e decisões que acompanham a execução

| Ponto | Tratamento planejado | Etapas |
| --- | --- | --- |
| Diferenças entre regras de GH/RB | Perfil próprio explícito, versões e expansão por jogo | 01, 08, 19 |
| Guitarras com botões/eixos diferentes | Mapeamento configurável e capacidades registradas | 04, 17 |
| Direção de strum indisponível | Avaliar timing e indicar alternância não avaliada | 04, 08, 11 |
| Limites de acordes no teclado | Visualização das entradas e remapeamento antes do treino | 04 |
| Entrada obtida por amostragem | Preservar precisão observável; não reconstruir transições que não foram capturadas | 04, 05, 15 |
| Áudio, entrada e imagem fora de sincronia | Relógio comum, calibração e offsets com aplicação única | 05 |
| Pausa ou aba em segundo plano | Limpeza de entrada, contagem de retomada e condição da avaliação registrada | 03, 05, 10, 15 |
| Julgamento e diagnóstico divergentes | Manter resultado original e análise posterior separados | 06, 11 |
| Histórico não comparável | Guardar snapshot e filtrar/destacar diferenças de condições | 10, 12, 14 |
| Gravação local indisponível | Modo em memória, status de gravação e exportação | 12 |
| Adaptação baseada em poucos dados | Amostras mínimas, estabilidade de progressão e evidência visível | 11, 13 |
| Processamento pesado durante gameplay | Trabalho limitado, análise entre blocos e Worker quando necessário | 11, 15 |
| Confundir botão com mão/dedo | Relatar apenas ações observáveis do dispositivo | 04, 11, 17 |

Parâmetros de tolerância, metas e limites devem ter valores iniciais registrados na etapa correspondente. Refinamentos motivados pelo desenvolvedor devem produzir novas versões quando alterarem o significado das métricas ou a comparabilidade de resultados.

## 8. Procedimento para executar e acompanhar cada etapa

1. Ler `AGENTS.md`, a etapa escolhida e os contratos dos quais ela depende.
2. Conferir o estado real do repositório; este plano não é evidência de que uma etapa anterior já foi implementada.
3. Implementar um conjunto coeso de tarefas dentro da etapa, reutilizando as dependências existentes e registrando decisões que afetem outras etapas.
4. Fazer somente revisão estática manual das alterações e de seus pontos de integração.
5. Atualizar os checkboxes de tarefas efetivamente implementadas e registrar arquivos, limitações e decisões relevantes.
6. Entregar um resumo ao desenvolvedor, indicando explicitamente a forma de revisão e o que depende de confirmação em execução.
7. Incorporar relatos de erro antes de considerar confirmados os comportamentos afetados; reabrir tarefas se necessário.

### Modelo de registro por etapa

```text
Etapa:
Estado: pendente | em implementação | revisada estaticamente | confirmada pelo desenvolvedor
Tarefas entregues:
Arquivos e decisões relevantes:
Revisão realizada: análise estática manual
Limitações e pendências:
Confirmação/erros informados pelo desenvolvedor:
Próxima etapa liberada pelas dependências:
```

O primeiro conjunto de trabalho deve começar pela **etapa 01** e seguir até M1. As etapas seguintes ampliam a mesma sessão e os mesmos contratos; cada marco deve permanecer utilizável enquanto o próximo é desenvolvido.
