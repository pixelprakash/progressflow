import { LEVEL_LABELS, PERFORMANCE_LEVELS, RUBRIC_GUIDES } from '@progressflow/shared';
import { prisma } from '../db.js';

/** Fixed id: every phone references the default rubric by this id. */
export const DEFAULT_RUBRIC_ID = '00000000-0000-4000-8000-000000000001';

/** Idempotent; runs on startup. Descriptor text is the draft wording in @progressflow/shared. */
export async function ensureDefaultRubric(): Promise<void> {
  await prisma.rubric.upsert({
    where: { id: DEFAULT_RUBRIC_ID },
    update: {},
    create: {
      id: DEFAULT_RUBRIC_ID,
      schoolId: null,
      title: 'Middle-school art & design',
      context: 'Classes VI–VIII',
      language: 'en',
    },
  });
  for (const [order, g] of RUBRIC_GUIDES.entries()) {
    const descriptors = PERFORMANCE_LEVELS.map((level) => ({
      level,
      label: LEVEL_LABELS[level],
      descriptor: g.levels[level],
      exemplarImageKey: null,
    }));
    await prisma.criterion.upsert({
      where: { rubricId_key: { rubricId: DEFAULT_RUBRIC_ID, key: g.key } },
      update: { name: g.name, order, descriptors },
      create: { rubricId: DEFAULT_RUBRIC_ID, key: g.key, name: g.name, order, descriptors },
    });
  }
}
