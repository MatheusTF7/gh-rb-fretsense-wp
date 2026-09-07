import input from './input';
import timing from './timing';

export default {
  input,
  timing,
  app: {
    tagline: 'Five-fret practice',
    workspace: 'Your practice space',
    preview: 'In development',
    navigation: 'Main navigation',
    openMenu: 'Open navigation',
    closeMenu: 'Close navigation',
    skipContent: 'Skip to content',
    footer: 'One technique at a time.',
  },
  navigation: {
    home: 'Home',
    train: 'Catalog',
    play: 'Practice space',
    devices: 'Devices',
    calibration: 'Calibration',
    history: 'History',
    results: 'Session result',
    settings: 'Settings',
    notFound: 'Page not found',
  },
  common: {
    planned: 'Coming soon',
    backHome: 'Back to home',
    backCatalog: 'Back to catalog',
    browseCatalog: 'Explore techniques',
    viewDevices: 'About devices',
    viewSettings: 'Customize your space',
    viewCalibration: 'About calibration',
    viewHistory: 'Go to history',
    viewPractice: 'View practice space',
    clearSearch: 'Clear search',
  },
  home: {
    eyebrow: 'Practice with intention',
    title: 'Five frets. More control.',
    description:
      'Build your practice around the details: each transition, each strum, each note held.',
    notice:
      'The first playable exercises are being prepared. For now, explore the techniques and customize your space.',
    fretTitle: 'Know your five lanes',
    fretDescription: 'A number, a letter and a color identify each position.',
    stepsTitle: 'Get to know your practice space',
    catalogTitle: 'Find your focus',
    catalogDescription: 'Learn what each technique develops before choosing your next challenge.',
    devicesTitle: 'Your way to play',
    devicesDescription: 'See how keyboards, guitars and conventional controllers fit into practice.',
    settingsTitle: 'Make room for focus',
    settingsDescription: 'Choose your language, appearance and visual effects.',
  },
  frets: {
    label: 'Five fret positions',
    G: 'Green',
    R: 'Red',
    Y: 'Yellow',
    B: 'Blue',
    O: 'Orange',
  },
  catalog: {
    eyebrow: 'Choose your focus',
    title: 'Technique catalog',
    description: 'Get to know the movements that will shape your practice.',
    notice:
      'This is a guide to the planned techniques. Exercises, levels and practice configuration are not available yet.',
    search: 'Search techniques',
    count: 'No techniques shown | {count} technique shown | {count} techniques shown',
    emptyTitle: 'No techniques found',
    emptyDescription: 'Try another word or clear the search to see the full guide.',
  },
  techniques: {
    'single-strum': {
      title: 'Single strum',
      description: 'Coordinate a clear strum with the right fret, one note at a time.',
      focus: 'Timing and coordination',
    },
    'alternate-strum': {
      title: 'Alternate strum',
      description: 'Keep a steady rhythm while alternating downstrokes and upstrokes.',
      focus: 'Rhythm and direction',
    },
    hopo: {
      title: 'HOPO',
      description: 'Connect hammer-ons and pull-offs, and recover the chain after a missed note.',
      focus: 'Transitions and continuity',
    },
    tapping: {
      title: 'Tapping',
      description: 'Play patterns through fret presses and releases, including repeated notes.',
      focus: 'Fret control',
    },
    sequences: {
      title: 'Sequences',
      description: 'Work through ascending runs, descending runs, zigzags and position changes.',
      focus: 'Order and movement',
    },
    chords: {
      title: 'Chords',
      description: 'Bring two or three frets together at the moment of the strum.',
      focus: 'Simultaneous frets',
    },
    sustains: {
      title: 'Sustains',
      description: 'Hold a note or chord through its tail and release at the right moment.',
      focus: 'Holding and release',
    },
    mixed: {
      title: 'Mixed scenarios',
      description: 'Combine techniques and keep control as the pattern changes.',
      focus: 'Technique changes',
    },
  },
  devices: {
    eyebrow: 'Your input',
    title: 'Devices',
    description: 'The same five lanes, with different ways to play.',
    notice: 'Select a device, map its actions and inspect the received inputs.',
    keyboardTitle: 'Keyboard',
    keyboardDescription:
      'Remappable frets and up/down strums. Simultaneous key detection depends on your keyboard.',
    guitarTitle: 'Guitar controller',
    guitarDescription:
      'Map guitars recognized as gamepads using the controls received by the browser.',
    gamepadTitle: 'Conventional controller',
    gamepadDescription:
      'Map buttons and axes. Strum direction depends on the distinct actions configured.',
    calibrationTitle: 'Timing is part of the setup',
    calibrationDescription:
      'Use guided calibration or manual adjustments to align your input and visual reference.',
  },
  calibration: {
    eyebrow: 'Your timing reference',
    title: 'Calibration',
    description: 'Bring sound, visuals and input into alignment.',
    stateTitle: 'Prepare your timing reference',
    stateDescription:
      'Choose an input profile and confirm your audio output before measuring or loading compensation.',
  },
  history: {
    eyebrow: 'Your progress',
    title: 'Practice history',
    description: 'A place for your attempts, results and next steps.',
    stateTitle: 'Your history starts with the first practice',
    stateDescription:
      'Session recording and reports are not available yet. Explore the technique guide while practice is being prepared.',
  },
  play: {
    title: 'Room to focus',
    description: 'This space is reserved for the five-lane practice view.',
    stateTitle: 'No practice is available to start yet',
    stateDescription:
      'Playable exercises are being prepared. You can return to the catalog and get to know the techniques.',
    laneCaption: 'Lane numbers identify positions; they are not keyboard bindings.',
    footer: 'Your catalog search stays with you when you return.',
  },
  results: {
    title: 'Result unavailable',
    description:
      'There are no session results available to view in this version. Return to history or explore the catalog.',
  },
  settings: {
    eyebrow: 'Your space',
    title: 'Settings',
    description: 'Adjust the interface to make practice feel comfortable.',
    notice: 'Preferences are saved in this browser when storage is available.',
    language: 'Language',
    languageDescription: 'Applies to navigation and interface messages.',
    appearance: 'Appearance',
    appearanceDescription: 'Choose a theme or follow your system preference.',
    dark: 'Dark',
    light: 'Light',
    system: 'System',
    accessibility: 'Visual comfort',
    reducedMotion: 'Reduce visual effects',
    reducedMotionDescription: 'System preferences for reduced motion are also respected.',
    fretTitle: 'Color is one part of the reference',
    fretDescription: 'Each fret also has a number and a letter throughout the interface.',
  },
  errors: {
    notFoundTitle: 'This page is not here',
    notFoundDescription: 'The address may have changed. Return home to find your way.',
  },
};
