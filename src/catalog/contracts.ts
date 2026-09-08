import type {
  Articulation, DrillConfig, DrillLevel, NoteFrets, Subdivision, Technique, VersionedReference,
} from '@/engine/domain';

export type CatalogMetric =
  | 'noteAccuracy'
  | 'timing'
  | 'articulationCompliance'
  | 'strumDirectionCompliance'
  | 'sustainCompletion';

export interface TechniqueCapabilities {
  readonly minimumFrets: 1 | 2 | 3;
  readonly maximumSimultaneousFrets: 1 | 2 | 3;
  readonly needsStrum: boolean;
  readonly needsStrumDirection: boolean;
  readonly usesSustains: boolean;
}

export interface TechniqueParameterPolicy {
  readonly bpm: { readonly minimum: number; readonly maximum: number };
  readonly subdivisions: readonly Subdivision[];
  readonly articulations: readonly (Articulation | 'mixed')[];
  readonly chordSizes: readonly (1 | 2 | 3)[];
  readonly patternIds: readonly string[];
}

export interface TechniqueDescriptor {
  readonly id: Technique;
  /** Chave estável de tradução do objetivo pedagógico. */
  readonly objectiveKey: string;
  readonly capabilities: TechniqueCapabilities;
  readonly parameters: TechniqueParameterPolicy;
  readonly metrics: readonly CatalogMetric[];
  readonly presetIds: readonly string[];
}

export interface DrillPreset {
  readonly id: string;
  readonly catalog: VersionedReference;
  readonly technique: Technique;
  readonly level: DrillLevel;
  readonly config: DrillConfig;
}

/** Campos seguros para produzir uma variação sem trocar a identidade pedagógica do preset. */
export interface CatalogMutation {
  readonly bpm?: number;
  readonly subdivision?: Subdivision;
  readonly allowedFrets?: NoteFrets;
  readonly repetitions?: number;
  readonly seed?: string;
}
