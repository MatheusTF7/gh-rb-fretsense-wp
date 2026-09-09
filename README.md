# Fretsense

Treinador local e procedural para jogos rítmicos de cinco frets. A aplicação gera exercícios reproduzíveis, recebe teclado ou controles expostos pela Gamepad API, aplica regras próprias de julgamento e transforma os resultados em diagnóstico, histórico e recomendações explicáveis.

## Estado da primeira versão

A implementação das etapas 01–16 está concluída e revisada por análise estática manual. A versão do pacote é `0.0.1`; build, execução, compatibilidade em hardware e publicação ainda dependem do desenvolvedor responsável. O projeto não declara equivalência com Guitar Hero, Rock Band ou uma edição específica desses jogos.

Disponível nesta versão:

- catálogo procedural com oito famílias de técnica, níveis e editor de padrão manual;
- prática e avaliação configuráveis, seed reproduzível e repetição da mesma chart ou de uma variação;
- highway Canvas 2D, metrônomo, calibração guiada/manual e modo sem áudio;
- mapeamento de teclado e Gamepad, monitor de entrada e validação das capacidades necessárias;
- julgamento de strum, HOPO, tap, direção, acordes e sustains;
- métricas, diagnóstico detalhado, recomendações por regras, histórico/evolução local e exportação JSON;
- português e inglês, temas, alto contraste, redução de movimento e diagnóstico local sem envio automático.

Não fazem parte desta versão: WebHID, instalação PWA/uso offline garantido, perfis de edições externas, importação de músicas/charts, conta ou sincronização em nuvem e aprendizado de máquina. Esses itens permanecem nas etapas 17–20 do plano.

## Primeiros passos

1. Abra **Dispositivos** e confirme o teclado padrão ou mapeie uma conexão Gamepad. O teclado inicial usa `A/S/D/F/G` nos frets, `↑/↓` no strum e `Esc` para pausar.
2. Abra **Calibração**, confira o contexto de áudio e salve um ajuste guiado, manual ou com offsets zero. Também é possível treinar sem áudio.
3. Em **Treinar**, escolha uma técnica/preset, ajuste o modo e as opções avançadas e inicie a tentativa.
4. Consulte o resultado completo e o histórico para diagnósticos, comparações compatíveis, evolução e recomendações.

O [guia da primeira versão](docs/first-release-guide.md) detalha mapeamento, calibração, modos, métricas, dados locais e recuperação de falhas. As [notas da versão 0.0.1](docs/release-0.0.1.md) registram versões de contratos, situação da entrega, limitações e hospedagem.

## Navegação

| Rota hash | Conteúdo |
| --- | --- |
| `#/` | apresentação e atalhos |
| `#/train` | catálogo, presets e padrões manuais |
| `#/play` | configuração, tentativa e resumo imediato |
| `#/devices` | perfis, mapeamento, conexões e monitor de entrada |
| `#/calibration` | metrônomo, coleta guiada e ajustes manuais |
| `#/history` | sessões salvas, filtros e evolução |
| `#/results/:id` | relatório detalhado de uma sessão |
| `#/settings` | idioma, tema, movimento e apresentação da highway |

## Regras e documentação

- [Regras de gameplay](docs/gameplay-rules.md)
- [Catálogo procedural](docs/procedural-catalog.md)
- [Prática e avaliação](docs/practice-and-assessment.md)
- [Análise detalhada](docs/detailed-analysis.md)
- [Treino adaptativo](docs/adaptive-training.md)
- [Persistência de sessões](docs/session-persistence.md)
- [Robustez, desempenho e acessibilidade](docs/robustness-accessibility.md)
- [Plano de desenvolvimento](docs/fretsense-development-plan.md)

## Desenvolvimento

Requer uma versão do Node.js compatível com o campo `engines` de `package.json` e usa o lockfile do npm.

```bash
npm ci
npm run dev
```

Comandos disponíveis também incluem `npm run build`, `npm run typecheck`, `npm run lint` e `npm run lint:check`. Conforme as regras deste repositório, empacotamento, execução e validações automatizadas ficam a cargo do desenvolvedor; não foram executados na preparação desta versão.

## Hospedagem estática

O projeto é uma SPA com Vue Router em modo `hash`, portanto as rotas ficam depois de `#` e um host estático não precisa reescrevê-las no servidor. O build padrão do Quasar produz `dist/spa`; seus arquivos devem ser servidos por HTTP(S), nunca abertos diretamente por `file://`. Para publicar em um subdiretório, defina `build.publicPath` em `quasar.config.ts` antes do build.

Use HTTPS na publicação. Além de proteger dados e código em trânsito, isso oferece o contexto seguro esperado pelas APIs modernas de navegador; `localhost` e endereços de loopback são tratados como potencialmente confiáveis para desenvolvimento. Consulte o [guia oficial de implantação SPA do Quasar](https://quasar.dev/quasar-cli-vite/developing-spa/deploying/), a [configuração de `publicPath` e roteamento](https://quasar.dev/quasar-cli-vite/quasar-config-file/) e a [definição de contexto seguro do W3C](https://www.w3.org/TR/secure-contexts/).

## Descrição curta

Browser-based procedural five-fret rhythm trainer with adaptive drills, timing analysis, error diagnostics, and local session history.
