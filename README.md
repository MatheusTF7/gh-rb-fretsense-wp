# Fretsense

**Repositório:** `fretsense`

## Descrição

Treinador procedural para jogos rítmicos de cinco frets, com exercícios adaptativos, análise de timing, identificação de padrões de erro e IA executada localmente no navegador.

As etapas 01–03 entregaram os contratos do perfil `fretsense-v1`, a estrutura da interface e o núcleo inicial de geração e sessão. A interface oferece navegação, guia de técnicas com busca, área de treino em preparação e configurações de idioma/aparência. Português e inglês estão disponíveis; busca e preferências duram a visita e são restauradas ao recarregar.

O núcleo TypeScript gera subida/descida e notas repetidas com semente/versão, valida configurações, captura snapshots imutáveis e controla tentativas com pausa, retomada, repetição e limites de recursos. Sua integração com a interface, julgamento, exercícios jogáveis, captura de dispositivos, calibração e histórico ainda estão pendentes. Consulte o [plano de desenvolvimento](docs/fretsense-development-plan.md), as [regras de gameplay](docs/gameplay-rules.md) e a [documentação do núcleo](docs/engine-foundation.md). A entrega foi revisada somente por análise estática manual, sem confirmação em execução.

## GitHub description

Browser-based procedural five-fret rhythm game trainer with adaptive drills, real-time performance analysis, error pattern detection, and on-device machine learning.

## Install the dependencies

```bash
pnpm install
# or: yarn/npm/bun install
```

### Start the app in development mode (HMR, error reporting, etc.)

```bash
quasar dev
```

### Format & Lint the files

```bash
pnpm run lint
# or: yarn/npm/bun run lint
```

...or just check formatting & linting:

```bash
pnpm run lint:check
# or: yarn/npm/bun run lint:check
```

### Build the app for production

```bash
quasar build
```

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-file).
