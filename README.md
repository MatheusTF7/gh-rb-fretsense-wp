# Fretsense

**Repositório:** `fretsense`

## Descrição

Treinador procedural para jogos rítmicos de cinco frets, com exercícios adaptativos, análise de timing, identificação de padrões de erro e IA executada localmente no navegador.

As etapas 01–04 entregaram os contratos do perfil `fretsense-v1`, a interface, o núcleo inicial de geração/sessão e a captura/mapeamento de teclado e Gamepad. A página de dispositivos permite selecionar uma conexão, atribuir controles e observar frets, acordes e strums. O teclado inicial usa A/S/D/F/G, setas cima/baixo e Escape; guitarras e controles reconhecidos como Gamepad são mapeados explicitamente.

Perfis, idioma, tema e redução de efeitos são persistidos neste navegador, com aviso e funcionamento em memória quando o armazenamento falha. Português e inglês estão disponíveis; a busca no catálogo continua restrita à visita. Consulte [entrada e preferências](docs/input-and-preferences.md) para mapeamento, capacidades observáveis e limites.

O núcleo TypeScript gera subida/descida e notas repetidas com semente/versão, valida configurações, captura snapshots imutáveis e controla tentativas com pausa, retomada, repetição e limites de recursos. Relógio/áudio da plataforma, calibração, julgamento, integração jogável e histórico ainda estão pendentes. Consulte o [plano de desenvolvimento](docs/fretsense-development-plan.md), as [regras de gameplay](docs/gameplay-rules.md) e a [documentação do núcleo](docs/engine-foundation.md). A entrega foi revisada somente por análise estática manual, sem confirmação em execução ou de compatibilidade com hardware.

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
