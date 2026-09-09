# Entrega 0.0.1

## Estado da entrega

Esta é a primeira versão preparada para entrega do Fretsense e conclui o marco M4 do trabalho de implementação. As etapas 01–16 foram inspecionadas por análise estática manual. O agente não executou instalação, lint, formatação, typecheck, testes, build, servidor, navegador nem publicação; portanto, `0.0.1` é uma versão preparada, não uma publicação nem uma confirmação geral de funcionamento.

Não houve erro novo relatado pelo desenvolvedor durante a etapa 16. O histórico de retorno disponível vem da etapa 15A: o desenvolvedor primeiro relatou notas estáticas; depois confirmou movimento e o novo estilo, mas apontou sensação de zoom junto à hit zone e pediu melhores transições, hits e sustains. O código visual foi revisado para esses pontos, porém essa revisão e as garantias da etapa 15B ainda não receberam confirmação em execução.

## Manifesto de versões

| Área | Identidade usada na entrega | Observação |
| --- | --- | --- |
| Aplicação/pacote | `fretsense@0.0.1` | `package.json` e diagnóstico local |
| Configuração de exercício | schema `1` | `DrillConfig`; inclui padrão manual schema `1` |
| Catálogo | `fretsense-catalog@1.0.0` | descritores/presets; padrões catalogados usam versão `1.0.0` |
| Gerador catalogado | `procedural-catalog@1.0.0` | usado pelos presets atuais |
| Gerador manual | `manual-pattern-generator@1.0.0` | referência do padrão `manual-pattern@1.0.0` |
| Gerador inicial legado | `initial-generator@1.0.0` | permanece aceito nos exemplos/contratos iniciais |
| Regras | `fretsense-v1@1.0.0` | único perfil de julgamento implementado; janela inclusiva de ±120 ms |
| Apresentação base | `fretsense-highway@1.4.0`, schema `1` | a referência congelada acrescenta velocidade, escala, perspectiva, grade e política de movimento à versão base |
| Snapshot de sessão | schema `2` para novas sessões; schemas `1` e `2` aceitos | v2 congela a apresentação completa; v1 permanece legível com apresentação ausente |
| Resultado/análise | schemas `1`; `fretsense-analysis@1.1.0` | análise posterior e diagnósticos explicáveis |
| Adaptação | `fretsense-rule-adaptation@1.0.0`; registro schema `1` | recomendações por regras, armazenadas fora da sessão de origem |
| Relatórios/evolução | `fretsense-reporting@1.0.0` | comparabilidade e amostragem explícitas |
| Preferências | chave `fretsense.preferences.v1`, schema `2` | migra dados válidos do schema 1; inclui preferências da highway |
| Calibrações | chave `fretsense.calibrations.v1`, schema `1`; perfis `1.0.0` | até 64 contextos locais |
| Sessões locais | registro schema `1`; IndexedDB físico `2` | stores de sessões, resumos e recomendações |
| Exportação de sessão | schema `1` | exportação JSON; não há importação nesta versão |
| Diagnóstico local | schema `1` | cópia/download opcional, sem envio automático |
| Perfil de edição | ausente (`null`) | nenhum `GameEditionProfile` foi estudado ou implementado; etapa 19 |

A chart não possui um campo de schema próprio: sua reprodutibilidade é identificada pela referência do gerador, seed, configuração normalizada e dados congelados. Versões persistidas desconhecidas são preservadas e recusadas pelos parsers atuais, em vez de serem reinterpretadas ou apagadas automaticamente.

## Escopo consolidado

### Implementado e revisado estaticamente

- contratos, limites e regras próprias para cinco frets;
- interface responsiva e navegação hash em português/inglês;
- geração determinística inicial, catalogada e manual;
- captura/mapeamento por teclado e Gamepad;
- relógio monotônico, Web Audio, modo silencioso e calibração contextual;
- julgamento musical/técnico de strum, HOPO, tap, acordes, sustains e direção;
- fluxo completo de prática/avaliação e highway Canvas 2D versionada;
- análise detalhada, persistência/histórico, adaptação por regras e relatórios de evolução;
- recuperação de falhas, limites de recursos, acessibilidade e diagnóstico local.

### Funcionamento informado pelo desenvolvedor

- o movimento e o novo estilo visual intermediário da etapa 15A foram observados;
- a mesma observação registrou pontos visuais que motivaram outra revisão;
- não há confirmação fornecida para o conjunto final da etapa 15A, para a etapa 15B ou para a consolidação da etapa 16.

### Limitações materiais conhecidas

- compatibilidade, latência, frame rate, resize, tela cheia, armazenamento privado e sessões prolongadas não foram medidos;
- teclado depende do rollover físico; Gamepad depende do que navegador/driver expõem e não cobre dispositivos exclusivamente WebHID;
- a calibração estima compensação combinada e dependente do contexto, não latências físicas isoladas;
- a análise detalhada é síncrona após o fechamento musical, sob limites explícitos;
- dados locais não são sincronizados; dados mantidos apenas em memória se perdem ao recarregar;
- exportação JSON serve para arquivo/diagnóstico, sem importação ou restauração;
- não há conteúdo comercial, leitura de charts externos, backend, conta ou coleta remota;
- identidade visual e regras são autorais do Fretsense; não há estudo que sustente fidelidade a um jogo/edição.

### Expansões futuras, fora de M4

- etapa 17: adaptadores WebHID para modelos concretos;
- etapa 18: manifesto, instalação, cache e atualização PWA/offline;
- etapa 19: estudos e perfis versionados de jogos/edições específicos;
- etapa 20: avaliação condicionada de IA local, conta, sincronização e importações.

## Empacotamento e hospedagem

O repositório contém `package-lock.json` e exige Node.js conforme `package.json` (`>=26`, `^24` ou `^22.12`). Estes são comandos de encaminhamento para o desenvolvedor, não comandos executados nesta entrega:

```bash
npm ci
npm run build
```

Pela configuração atual do Quasar, o resultado SPA padrão fica em `dist/spa`. Publique o **conteúdo** desse diretório em um host estático por HTTPS. Não abra `index.html` por `file://`: o Quasar requer que a aplicação construída seja servida por HTTP e APIs/armazenamento do navegador podem variar nesse esquema.

O roteador permanece em `vueRouterMode: 'hash'`. Assim, por exemplo, uma URL publicada termina em `/#/history`, e o servidor recebe apenas o caminho anterior a `#`; não é necessário fallback de todas as rotas para `index.html`. Não altere para `history` sem também configurar esse fallback no host.

- **Raiz de domínio:** a configuração atual, sem `build.publicPath` explícito, usa o padrão `/`.
- **Subdiretório conhecido:** defina `build.publicPath` como `/<subdiretorio>/` antes de empacotar.
- **Diretório de montagem desconhecido:** a documentação do Quasar permite `publicPath: './'` com hash routing, desde que a URL termine em `/` ou `index.html`; prefira um caminho explícito quando conhecido.

Use HTTPS na publicação. `localhost` e loopback podem funcionar como origens potencialmente confiáveis no desenvolvimento, mas não substituem HTTPS no host público. O contexto seguro é importante para a exposição consistente de APIs modernas e já é requisito da expansão WebHID planejada.

Referências oficiais consultadas em 2026-09-09:

- [Quasar — Deploying a SPA](https://quasar.dev/quasar-cli-vite/developing-spa/deploying/)
- [Quasar — Configuring quasar.config file](https://quasar.dev/quasar-cli-vite/quasar-config-file/)
- [W3C — Secure Contexts](https://www.w3.org/TR/secure-contexts/)

## Encaminhamento ao responsável

O desenvolvedor decide e executa a instalação, os comandos de validação disponíveis, o build e a publicação. Também é dele a confirmação em navegadores e hardwares-alvo, inclusive teclado com acordes, Gamepads reais, áudio/modo silencioso, interrupções, persistência, layouts, acessibilidade e o visual revisado da highway. Erros encontrados devem ser relatados com rota, ação, resultado esperado/observado, ambiente e, quando seguro, o diagnóstico local; a correção entra em nova revisão sem reescrever dados históricos silenciosamente.

Não há workflow de deploy, configuração PWA ou `.openai/hosting.json` nesta entrega. Nenhum destino de publicação foi presumido.
