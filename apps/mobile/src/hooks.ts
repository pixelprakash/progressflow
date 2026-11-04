import { useMemo } from 'react';
import type { CriterionGuide, TKey } from '@progressflow/shared';
import { DEFAULT_PREFS, DEFAULT_TYPES, isBuiltinType, typeIcon } from './domain';
import type { AssessmentType, Prefs } from './domain';
import { useLang } from './lang';
import { useStore } from './store';

/** The rubric in use: the teacher's own if they have edited it, else the built-in four in the app language. */
export function useRubric(): CriterionGuide[] {
  const { data } = useStore();
  const { guides } = useLang();
  return data.rubric ?? guides;
}

export interface KindApi {
  /** The teacher's types, in their order. */
  types: AssessmentType[];
  label: (id: string) => string;
  icon: (id: string) => string;
}

/** Assessment types as the teacher has arranged them, with display names in the app language. */
export function useKinds(): KindApi {
  const { data } = useStore();
  const { t } = useLang();
  const types = data.types ?? DEFAULT_TYPES;
  return useMemo(
    () => ({
      types,
      label: (id) => {
        const custom = types.find((x) => x.id === id)?.label;
        if (custom) return custom;
        return isBuiltinType(id) || id === 'regular'
          ? t(`kind.${id === 'regular' ? 'assignment' : id}` as TKey)
          : id;
      },
      icon: typeIcon,
    }),
    [types, t],
  );
}

export function usePrefs(): Prefs {
  const { data } = useStore();
  return { ...DEFAULT_PREFS, ...data.prefs };
}
