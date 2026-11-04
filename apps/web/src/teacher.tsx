import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CriterionGuide, TeacherConfig, TKey } from '@progressflow/shared';
import { useApi } from './data';
import { useLang } from './i18n';

/** Types the dictionary has a name for. Anything else is a type the teacher made up. */
const KNOWN = new Set([
  'assignment',
  'exam1',
  'exam2',
  'quarterly',
  'sketch',
  'regular',
  'progress',
  'portfolio',
]);

interface Teacher {
  /** The rubric in use: the teacher's own if they edited it on the phone, else the standard four. */
  guides: CriterionGuide[];
  /** The name to show for an assessment type id. */
  kindLabel: (kind: string) => string;
}

const Ctx = createContext<Teacher | null>(null);

export function TeacherProvider({ children }: { children: ReactNode }) {
  const { t, guides: standard } = useLang();
  const { data } = useApi<TeacherConfig>('/v1/config');
  const value = useMemo<Teacher>(() => {
    const custom = data?.rubric;
    const labels = new Map(data?.types.flatMap((x) => (x.label ? [[x.id, x.label] as const] : [])));
    return {
      guides: custom ? custom.map((c) => ({ ...c, levels: c.levels })) : standard,
      kindLabel: (kind) => labels.get(kind) ?? (KNOWN.has(kind) ? t(`kind.${kind}` as TKey) : kind),
    };
  }, [data, standard, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeacher(): Teacher {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTeacher outside TeacherProvider');
  return v;
}
