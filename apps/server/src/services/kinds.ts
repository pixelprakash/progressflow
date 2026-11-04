import { SyncType } from '@progressflow/shared';
import { prisma } from '../db.js';

/** Types the dictionary has a name for, in every language. */
export const BUILTIN_KINDS = new Set([
  'assignment',
  'exam1',
  'exam2',
  'quarterly',
  'sketch',
  'regular',
  'progress',
  'portfolio',
]);

/**
 * What a student should read for an assessment type. Built-ins keep their id so the page
 * translates them; a type the teacher made up shows the teacher's own label (students get
 * no teacher settings, so the name has to travel with the piece).
 */
export async function kindLabeller(teacherId: string | undefined) {
  const labels = new Map<string, string>();
  if (teacherId) {
    const user = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { settings: true },
    });
    const parsed = SyncType.array().safeParse(
      ((user?.settings ?? {}) as { types?: unknown }).types,
    );
    if (parsed.success) for (const t of parsed.data) if (t.label) labels.set(t.id, t.label);
  }
  return (kind: string) => (BUILTIN_KINDS.has(kind) ? kind : (labels.get(kind) ?? 'regular'));
}
