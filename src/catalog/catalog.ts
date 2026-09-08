import type { DrillConfig, DrillLevel, Subdivision, Technique } from '@/engine/domain';
import { parseDrillConfig, requireCondition } from '@/engine/domain';
import { generateCatalogDrill } from '@/engine/generation';
import type {
  CatalogMetric, CatalogMutation, DrillPreset, TechniqueCapabilities, TechniqueDescriptor,
} from './contracts';

export const CATALOG_REFERENCE = Object.freeze({ id: 'fretsense-catalog', version: '1.0.0' });

interface PresetSpec {
  readonly technique: Technique;
  readonly level: DrillLevel;
  readonly bpm: number;
  readonly subdivision: Subdivision;
  readonly allowedFrets: number;
  readonly patternLength: number;
  readonly chordSize: 1 | 2 | 3;
  readonly articulation: 'strum' | 'hopo' | 'tap' | 'mixed';
  readonly sustainTicks?: number;
  readonly automaticStrum?: boolean;
  readonly direction?: 'none' | 'alternate';
}

const PRESET_SPECS: readonly PresetSpec[] = [
  { technique: 'single-strum', level: 'beginner', bpm: 80, subdivision: 2, allowedFrets: 7, patternLength: 4, chordSize: 1, articulation: 'strum', automaticStrum: true },
  { technique: 'single-strum', level: 'intermediate', bpm: 105, subdivision: 3, allowedFrets: 15, patternLength: 6, chordSize: 1, articulation: 'strum' },
  { technique: 'single-strum', level: 'advanced', bpm: 135, subdivision: 4, allowedFrets: 31, patternLength: 8, chordSize: 1, articulation: 'strum' },
  { technique: 'alternate-strum', level: 'beginner', bpm: 80, subdivision: 2, allowedFrets: 3, patternLength: 6, chordSize: 1, articulation: 'strum', direction: 'alternate' },
  { technique: 'alternate-strum', level: 'intermediate', bpm: 110, subdivision: 4, allowedFrets: 7, patternLength: 8, chordSize: 1, articulation: 'strum', direction: 'alternate' },
  { technique: 'alternate-strum', level: 'advanced', bpm: 140, subdivision: 6, allowedFrets: 31, patternLength: 10, chordSize: 1, articulation: 'strum', direction: 'alternate' },
  { technique: 'hopo', level: 'beginner', bpm: 75, subdivision: 2, allowedFrets: 3, patternLength: 4, chordSize: 1, articulation: 'mixed' },
  { technique: 'hopo', level: 'intermediate', bpm: 100, subdivision: 3, allowedFrets: 15, patternLength: 6, chordSize: 1, articulation: 'mixed' },
  { technique: 'hopo', level: 'advanced', bpm: 130, subdivision: 4, allowedFrets: 31, patternLength: 10, chordSize: 1, articulation: 'mixed' },
  { technique: 'tapping', level: 'beginner', bpm: 75, subdivision: 2, allowedFrets: 3, patternLength: 6, chordSize: 1, articulation: 'tap' },
  { technique: 'tapping', level: 'intermediate', bpm: 100, subdivision: 3, allowedFrets: 7, patternLength: 8, chordSize: 1, articulation: 'tap' },
  { technique: 'tapping', level: 'advanced', bpm: 130, subdivision: 6, allowedFrets: 31, patternLength: 10, chordSize: 1, articulation: 'mixed' },
  { technique: 'sequences', level: 'beginner', bpm: 80, subdivision: 2, allowedFrets: 15, patternLength: 6, chordSize: 1, articulation: 'strum', automaticStrum: true },
  { technique: 'sequences', level: 'intermediate', bpm: 105, subdivision: 3, allowedFrets: 15, patternLength: 7, chordSize: 1, articulation: 'strum' },
  { technique: 'sequences', level: 'advanced', bpm: 135, subdivision: 4, allowedFrets: 31, patternLength: 10, chordSize: 1, articulation: 'strum' },
  { technique: 'chords', level: 'beginner', bpm: 70, subdivision: 2, allowedFrets: 7, patternLength: 4, chordSize: 2, articulation: 'strum' },
  { technique: 'chords', level: 'intermediate', bpm: 95, subdivision: 3, allowedFrets: 15, patternLength: 8, chordSize: 2, articulation: 'strum' },
  { technique: 'chords', level: 'advanced', bpm: 120, subdivision: 4, allowedFrets: 31, patternLength: 8, chordSize: 3, articulation: 'strum' },
  { technique: 'sustains', level: 'beginner', bpm: 70, subdivision: 2, allowedFrets: 7, patternLength: 4, chordSize: 1, articulation: 'strum', sustainTicks: 480 },
  { technique: 'sustains', level: 'intermediate', bpm: 90, subdivision: 3, allowedFrets: 15, patternLength: 4, chordSize: 2, articulation: 'strum', sustainTicks: 480 },
  { technique: 'sustains', level: 'advanced', bpm: 115, subdivision: 4, allowedFrets: 31, patternLength: 6, chordSize: 2, articulation: 'strum', sustainTicks: 240 },
  { technique: 'mixed', level: 'beginner', bpm: 75, subdivision: 2, allowedFrets: 7, patternLength: 6, chordSize: 1, articulation: 'mixed' },
  { technique: 'mixed', level: 'intermediate', bpm: 100, subdivision: 3, allowedFrets: 15, patternLength: 8, chordSize: 2, articulation: 'mixed' },
  { technique: 'mixed', level: 'advanced', bpm: 125, subdivision: 4, allowedFrets: 31, patternLength: 12, chordSize: 3, articulation: 'mixed', sustainTicks: 240, direction: 'alternate' },
] as const;

function patternId(spec: PresetSpec): string {
  return `${spec.technique}-${spec.level}`;
}

function makePreset(spec: PresetSpec): DrillPreset {
  const direction = spec.direction === 'alternate'
    ? { kind: 'alternate' as const, firstDirection: 'down' as const, resetAfterRestTicks: 960 }
    : { kind: 'none' as const };
  return Object.freeze({
    id: patternId(spec),
    catalog: CATALOG_REFERENCE,
    technique: spec.technique,
    level: spec.level,
    config: parseDrillConfig({
      schemaVersion: 1,
      technique: spec.technique,
      level: spec.level,
      pattern: { id: patternId(spec), version: '1.0.0' },
      bpm: spec.bpm,
      subdivision: spec.subdivision,
      allowedFrets: spec.allowedFrets,
      patternLength: spec.patternLength,
      length: { kind: 'repetitions', count: 4 },
      articulation: spec.articulation,
      automaticStrum: spec.automaticStrum ?? false,
      chordSize: spec.chordSize,
      sustainTicks: spec.sustainTicks ?? 0,
      strumDirectionGoal: direction,
      goals: {
        minimumAccuracy: spec.level === 'beginner' ? 0.85 : spec.level === 'intermediate' ? 0.9 : 0.93,
        maximumErrors: spec.level === 'beginner' ? 5 : spec.level === 'intermediate' ? 4 : 3,
        consistentAttempts: 3,
        requireArticulation: ['hopo', 'tapping', 'mixed'].includes(spec.technique),
        requireStrumDirection: spec.direction === 'alternate',
        requireFullSustains: (spec.sustainTicks ?? 0) > 0,
      },
      seed: `fretsense-${patternId(spec)}`,
      ruleProfile: { id: 'fretsense-v1', version: '1.0.0' },
    }),
  });
}

export const DRILL_PRESETS: readonly DrillPreset[] = Object.freeze(PRESET_SPECS.map(makePreset));

const CAPABILITIES: Readonly<Record<Technique, TechniqueCapabilities>> = Object.freeze({
  'single-strum': { minimumFrets: 2, maximumSimultaneousFrets: 1, needsStrum: true, needsStrumDirection: false, usesSustains: false },
  'alternate-strum': { minimumFrets: 2, maximumSimultaneousFrets: 1, needsStrum: true, needsStrumDirection: true, usesSustains: false },
  hopo: { minimumFrets: 2, maximumSimultaneousFrets: 1, needsStrum: true, needsStrumDirection: false, usesSustains: false },
  tapping: { minimumFrets: 2, maximumSimultaneousFrets: 1, needsStrum: true, needsStrumDirection: false, usesSustains: false },
  sequences: { minimumFrets: 2, maximumSimultaneousFrets: 1, needsStrum: true, needsStrumDirection: false, usesSustains: false },
  chords: { minimumFrets: 2, maximumSimultaneousFrets: 3, needsStrum: true, needsStrumDirection: false, usesSustains: false },
  sustains: { minimumFrets: 2, maximumSimultaneousFrets: 2, needsStrum: true, needsStrumDirection: false, usesSustains: true },
  mixed: { minimumFrets: 3, maximumSimultaneousFrets: 3, needsStrum: true, needsStrumDirection: true, usesSustains: true },
});

const METRICS: Readonly<Record<Technique, readonly CatalogMetric[]>> = Object.freeze({
  'single-strum': ['noteAccuracy', 'timing'],
  'alternate-strum': ['noteAccuracy', 'timing', 'strumDirectionCompliance'],
  hopo: ['noteAccuracy', 'timing', 'articulationCompliance'],
  tapping: ['noteAccuracy', 'timing', 'articulationCompliance'],
  sequences: ['noteAccuracy', 'timing'],
  chords: ['noteAccuracy', 'timing'],
  sustains: ['noteAccuracy', 'timing', 'sustainCompletion'],
  mixed: ['noteAccuracy', 'timing', 'articulationCompliance', 'strumDirectionCompliance', 'sustainCompletion'],
});

const TECHNIQUE_IDS = ['single-strum', 'alternate-strum', 'hopo', 'tapping', 'sequences', 'chords', 'sustains', 'mixed'] as const;

export const TECHNIQUE_DESCRIPTORS: readonly TechniqueDescriptor[] = Object.freeze(TECHNIQUE_IDS.map((technique) => {
  const presets = DRILL_PRESETS.filter((preset) => preset.technique === technique);
  return Object.freeze({
    id: technique,
    objectiveKey: `techniques.${technique}.objective`,
    capabilities: CAPABILITIES[technique],
    parameters: {
      bpm: { minimum: Math.min(...presets.map(({ config }) => config.bpm)), maximum: Math.max(...presets.map(({ config }) => config.bpm)) },
      subdivisions: [...new Set(presets.map(({ config }) => config.subdivision))],
      articulations: [...new Set(presets.map(({ config }) => config.articulation))],
      chordSizes: [...new Set(presets.map(({ config }) => config.chordSize))],
      patternIds: presets.map(({ config }) => config.pattern.id),
    },
    metrics: METRICS[technique],
    presetIds: presets.map(({ id }) => id),
  });
}));

export function getTechniqueDescriptor(technique: Technique): TechniqueDescriptor {
  return TECHNIQUE_DESCRIPTORS.find(({ id }) => id === technique) as TechniqueDescriptor;
}

export function getDrillPreset(id: string): DrillPreset | undefined {
  return DRILL_PRESETS.find((preset) => preset.id === id);
}

export function mutateDrillPreset(id: string, mutation: CatalogMutation): DrillConfig {
  const preset = getDrillPreset(id);
  requireCondition(preset !== undefined, 'catalog.preset', 'Catalog preset does not exist.', 'unsupported');
  const descriptor = getTechniqueDescriptor(preset.technique);
  const bpm = mutation.bpm ?? preset.config.bpm;
  const subdivision = mutation.subdivision ?? preset.config.subdivision;
  requireCondition(bpm >= descriptor.parameters.bpm.minimum && bpm <= descriptor.parameters.bpm.maximum,
    'mutation.bpm', 'BPM is outside this technique policy.');
  requireCondition(descriptor.parameters.subdivisions.includes(subdivision),
    'mutation.subdivision', 'Subdivision is outside this technique policy.');
  const config = parseDrillConfig({
    ...preset.config,
    bpm,
    subdivision,
    allowedFrets: mutation.allowedFrets ?? preset.config.allowedFrets,
    length: { kind: 'repetitions', count: mutation.repetitions
      ?? (preset.config.length.kind === 'repetitions' ? preset.config.length.count : 1) },
    seed: mutation.seed ?? preset.config.seed,
  });
  // Materializar a chart também valida articulação, frets e simultaneidade específicos do padrão.
  generateCatalogDrill(config);
  return config;
}
