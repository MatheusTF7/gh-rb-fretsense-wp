# Fretsense

**Repositório:** `fretsense`

## Descrição

Treinador procedural para jogos rítmicos de cinco frets, com exercícios adaptativos, análise de timing, identificação de padrões de erro e IA executada localmente no navegador.

As etapas 01–06 entregaram os contratos do perfil `fretsense-v1`, a interface, o núcleo inicial de geração/sessão/julgamento, a captura/mapeamento de teclado e Gamepad e a base de relógio, áudio e calibração. A página de dispositivos permite selecionar uma conexão, atribuir controles e observar frets, acordes e strums. O teclado inicial usa A/S/D/F/G, setas cima/baixo e Escape; guitarras e controles reconhecidos como Gamepad são mapeados explicitamente.

Perfis, idioma, tema e redução de efeitos são persistidos neste navegador, com aviso e funcionamento em memória quando o armazenamento falha. Português e inglês estão disponíveis; a busca no catálogo continua restrita à visita. Consulte [entrada e preferências](docs/input-and-preferences.md) para mapeamento, capacidades observáveis e limites.

A página de calibração oferece metrônomo, coleta guiada com quatro pulsos de preparação e 16 strums a 90 BPM, ajustes manuais independentes de entrada e imagem, valores padrão e modo sem áudio. A estimativa representa compensação combinada, incluindo a resposta da pessoa. Ajustes são salvos por perfil/versão e contexto, com confirmação da saída atual e tratamento de falhas de armazenamento. Consulte [relógio, áudio e calibração](docs/timing-and-calibration.md).

O núcleo TypeScript gera subida/descida e notas repetidas com semente/versão, valida configurações, captura snapshots imutáveis e controla tentativas com pausa, retomada, repetição e limites de recursos. O [julgador inicial](docs/initial-judgment.md) avalia strum, tap e acordes sem caudas, registra hits/misses/strums extras e calcula combo, precisão e timing. Sua ativação na sessão permite conclusão automática após a janela final. Integração jogável, HOPO/sustains e histórico ainda estão pendentes. Consulte o [plano de desenvolvimento](docs/fretsense-development-plan.md), as [regras de gameplay](docs/gameplay-rules.md) e a [documentação do núcleo](docs/engine-foundation.md). A entrega foi revisada somente por análise estática manual, sem confirmação em execução ou de compatibilidade com hardware.

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
