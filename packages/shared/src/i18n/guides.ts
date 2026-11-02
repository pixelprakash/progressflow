import type { Language, PerformanceLevel } from '../enums.js';
import { RUBRIC_GUIDES } from '../rubricGuide.js';
import type { CriterionGuide } from '../rubricGuide.js';
import { t } from './index.js';
import type { TKey } from './en.js';

const k = (s: string) => s as TKey;

/** The rubric guidance in the chosen language. Colours and icons come from the English source. */
export function localizedGuides(lang: Language): CriterionGuide[] {
  return RUBRIC_GUIDES.map((g) => ({
    ...g,
    name: t(lang, k(`rubric.${g.key}.name`)),
    tagline: t(lang, k(`rubric.${g.key}.tagline`)),
    askStudent: t(lang, k(`rubric.${g.key}.ask`)),
    lookFor: [1, 2, 3].map((n) => ({
      title: t(lang, k(`rubric.${g.key}.look${n}.title`)),
      text: t(lang, k(`rubric.${g.key}.look${n}.text`)),
    })),
    levels: Object.fromEntries(
      [1, 2, 3, 4].map((l) => [l, t(lang, k(`rubric.${g.key}.level${l}`))]),
    ) as Record<PerformanceLevel, string>,
  }));
}

export const levelLabel = (lang: Language, level: number): string => t(lang, k(`level.${level}`));
