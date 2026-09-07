import type enUS from '../en-US';
import input from './input';

const messages: typeof enUS = {
  input,
  app: {
    tagline: 'Treino de cinco frets',
    workspace: 'Seu espaço de prática',
    preview: 'Em desenvolvimento',
    navigation: 'Navegação principal',
    openMenu: 'Abrir navegação',
    closeMenu: 'Fechar navegação',
    skipContent: 'Pular para o conteúdo',
    footer: 'Uma técnica de cada vez.',
  },
  navigation: {
    home: 'Início',
    train: 'Catálogo',
    play: 'Área de treino',
    devices: 'Dispositivos',
    calibration: 'Calibração',
    history: 'Histórico',
    results: 'Resultado da sessão',
    settings: 'Configurações',
    notFound: 'Página não encontrada',
  },
  common: {
    planned: 'Em preparação',
    backHome: 'Voltar ao início',
    backCatalog: 'Voltar ao catálogo',
    browseCatalog: 'Conhecer as técnicas',
    viewDevices: 'Sobre os dispositivos',
    viewSettings: 'Personalizar seu espaço',
    viewCalibration: 'Sobre a calibração',
    viewHistory: 'Ir para o histórico',
    viewPractice: 'Ver área de treino',
    clearSearch: 'Limpar busca',
  },
  home: {
    eyebrow: 'Prática com intenção',
    title: 'Cinco frets. Mais controle.',
    description:
      'Construa seu treino a partir dos detalhes: cada transição, cada palhetada, cada nota sustentada.',
    notice:
      'Os primeiros exercícios jogáveis estão em preparação. Por enquanto, conheça as técnicas e personalize seu espaço.',
    fretTitle: 'Conheça suas cinco pistas',
    fretDescription: 'Um número, uma letra e uma cor identificam cada posição.',
    stepsTitle: 'Explore seu espaço de prática',
    catalogTitle: 'Encontre seu foco',
    catalogDescription: 'Conheça o que cada técnica desenvolve antes de escolher seu próximo desafio.',
    devicesTitle: 'Seu jeito de jogar',
    devicesDescription: 'Veja como teclado, guitarra e controle convencional se encaixam no treino.',
    settingsTitle: 'Abra espaço para a concentração',
    settingsDescription: 'Escolha o idioma, a aparência e os efeitos visuais.',
  },
  frets: {
    label: 'Cinco posições de fret',
    G: 'Verde',
    R: 'Vermelho',
    Y: 'Amarelo',
    B: 'Azul',
    O: 'Laranja',
  },
  catalog: {
    eyebrow: 'Escolha seu foco',
    title: 'Catálogo de técnicas',
    description: 'Conheça os movimentos que vão compor sua prática.',
    notice:
      'Este é um guia das técnicas previstas. Exercícios, níveis e configuração de treinos ainda não estão disponíveis.',
    search: 'Buscar técnicas',
    count: 'Nenhuma técnica exibida | {count} técnica exibida | {count} técnicas exibidas',
    emptyTitle: 'Nenhuma técnica encontrada',
    emptyDescription: 'Experimente outra palavra ou limpe a busca para ver o guia completo.',
  },
  techniques: {
    'single-strum': {
      title: 'Strum simples',
      description: 'Coordene uma palhetada clara com o fret correto, uma nota de cada vez.',
      focus: 'Timing e coordenação',
    },
    'alternate-strum': {
      title: 'Strum alternado',
      description: 'Mantenha o ritmo enquanto alterna palhetadas para baixo e para cima.',
      focus: 'Ritmo e direção',
    },
    hopo: {
      title: 'HOPO',
      description: 'Conecte hammer-ons e pull-offs e recupere a sequência depois de um erro.',
      focus: 'Transições e continuidade',
    },
    tapping: {
      title: 'Tapping',
      description: 'Execute padrões pressionando e soltando frets, incluindo notas repetidas.',
      focus: 'Controle dos frets',
    },
    sequences: {
      title: 'Sequências',
      description: 'Percorra subidas, descidas, zigue-zagues e mudanças de posição.',
      focus: 'Ordem e movimento',
    },
    chords: {
      title: 'Acordes',
      description: 'Reúna dois ou três frets no momento da palhetada.',
      focus: 'Frets simultâneos',
    },
    sustains: {
      title: 'Sustains',
      description: 'Mantenha uma nota ou acorde durante a cauda e solte no momento certo.',
      focus: 'Sustentação e liberação',
    },
    mixed: {
      title: 'Cenários mistos',
      description: 'Combine técnicas e mantenha o controle nas mudanças de padrão.',
      focus: 'Mudanças de técnica',
    },
  },
  devices: {
    eyebrow: 'Sua entrada',
    title: 'Dispositivos',
    description: 'As mesmas cinco pistas, com diferentes formas de jogar.',
    notice: 'Selecione um dispositivo, mapeie suas ações e observe as entradas recebidas.',
    keyboardTitle: 'Teclado',
    keyboardDescription:
      'Frets e strums remapeáveis. A detecção de teclas simultâneas depende do seu teclado.',
    guitarTitle: 'Guitarra',
    guitarDescription:
      'Mapeamento de guitarras reconhecidas como gamepads; configure os controles recebidos pelo navegador.',
    gamepadTitle: 'Controle convencional',
    gamepadDescription:
      'Mapeie botões e eixos. A direção do strum depende das ações distintas configuradas.',
    calibrationTitle: 'O timing faz parte da preparação',
    calibrationDescription:
      'A calibração ajudará a alinhar o que você ouve, o que vê e o momento em que sua entrada é recebida.',
  },
  calibration: {
    eyebrow: 'Sua referência de tempo',
    title: 'Calibração',
    description: 'Aproxime som, imagem e entrada do mesmo instante.',
    stateTitle: 'A calibração está em preparação',
    stateDescription:
      'A calibração guiada e os ajustes manuais estarão disponíveis junto da captura de entrada e do áudio. Nenhuma calibração foi aplicada aqui.',
  },
  history: {
    eyebrow: 'Sua evolução',
    title: 'Histórico de treino',
    description: 'Um lugar para suas tentativas, resultados e próximos passos.',
    stateTitle: 'Seu histórico começa com o primeiro treino',
    stateDescription:
      'O registro de sessões e os relatórios ainda não estão disponíveis. Explore o guia de técnicas enquanto o treino fica pronto.',
  },
  play: {
    title: 'Espaço para se concentrar',
    description: 'Esta área está reservada para o treino com cinco pistas.',
    stateTitle: 'Ainda não há um treino disponível para iniciar',
    stateDescription:
      'Os exercícios jogáveis estão em preparação. Você pode voltar ao catálogo e conhecer as técnicas.',
    laneCaption: 'Os números identificam as pistas; não são atalhos do teclado.',
    footer: 'Sua busca no catálogo continua com você ao voltar.',
  },
  results: {
    title: 'Resultado indisponível',
    description:
      'Ainda não há resultados de sessões disponíveis para consulta nesta versão. Volte ao histórico ou explore o catálogo.',
  },
  settings: {
    eyebrow: 'Seu espaço',
    title: 'Configurações',
    description: 'Ajuste a interface para tornar a prática confortável.',
    notice: 'As preferências são salvas neste navegador quando o armazenamento está disponível.',
    language: 'Idioma',
    languageDescription: 'Aplicado à navegação e às mensagens da interface.',
    appearance: 'Aparência',
    appearanceDescription: 'Escolha um tema ou acompanhe a preferência do sistema.',
    dark: 'Escuro',
    light: 'Claro',
    system: 'Sistema',
    accessibility: 'Conforto visual',
    reducedMotion: 'Reduzir efeitos visuais',
    reducedMotionDescription: 'A preferência do sistema por menos movimento também é respeitada.',
    fretTitle: 'A cor é uma parte da referência',
    fretDescription: 'Cada fret também tem um número e uma letra em toda a interface.',
  },
  errors: {
    notFoundTitle: 'Esta página não está aqui',
    notFoundDescription: 'O endereço pode ter mudado. Volte ao início para encontrar seu caminho.',
  },
};

export default messages;
