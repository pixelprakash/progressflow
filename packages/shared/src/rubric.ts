import { z } from 'zod';
import { Language, PerformanceLevel } from './enums.js';

/**
 * The rubric model (Component 1). A rubric is a set of criteria; each criterion
 * has four performance descriptors (levels 1-4) and an optional exemplar image.
 * Rubric content is authored with educators in Phase 0 and seeded server-side.
 */

export const PerformanceDescriptor = z.object({
  level: PerformanceLevel,
  /** Short label shown on the rating control, e.g. "Emerging". */
  label: z.string().min(1).max(40),
  /** What work at this level looks like. Shown when the teacher long-presses. */
  descriptor: z.string().min(1).max(400),
  /** Storage key / URL of an exemplar image for this level, if any. */
  exemplarImageKey: z.string().nullable().default(null),
});
export type PerformanceDescriptor = z.infer<typeof PerformanceDescriptor>;

export const Criterion = z.object({
  id: z.string().uuid(),
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, 'snake_case identifier')
    .max(40),
  name: z.string().min(1).max(80),
  /** Relative weight when computing a composite score. Defaults to equal. */
  weight: z.number().positive().default(1),
  order: z.number().int().nonnegative(),
  descriptors: z.array(PerformanceDescriptor).length(4),
});
export type Criterion = z.infer<typeof Criterion>;

export const Rubric = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid().nullable(), // null = ProgressFlow default rubric
  title: z.string().min(1).max(120),
  /** Free-text subject / grade band, e.g. "Middle-school art & design". */
  context: z.string().max(160).default(''),
  language: Language.default('en'),
  criteria: z.array(Criterion).min(1),
  version: z.number().int().positive().default(1),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type Rubric = z.infer<typeof Rubric>;

/**
 * The default middle-school art & design rubric from the pitch deck:
 * composition, colour theory, technical skill, conceptual depth.
 * Descriptors here are placeholders — replace with educator-authored text
 * during the Phase 0 rubric sessions.
 */
export const DEFAULT_RUBRIC_CRITERIA: ReadonlyArray<Pick<Criterion, 'key' | 'name' | 'order'>> = [
  { key: 'composition', name: 'Composition', order: 0 },
  { key: 'colour_theory', name: 'Colour theory', order: 1 },
  { key: 'technical_skill', name: 'Technical skill', order: 2 },
  { key: 'conceptual_depth', name: 'Conceptual depth', order: 3 },
];
