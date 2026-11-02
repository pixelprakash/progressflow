import type { Language } from '../enums.js';
import { en } from './en.js';
import type { Dict, TKey } from './en.js';
import { hi } from './hi.js';
import { te } from './te.js';

export type { Dict, TKey };

const DICTS: Record<Language, Dict> = { en, hi, te };

/** Name of each language in its own script, so a learner can find theirs. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  te: 'తెలుగు',
};

/** BCP-47 tags for the lang attribute and date formatting. */
export const LANGUAGE_LOCALES: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };

export type Vars = Record<string, string | number>;

/** Look up a string in a language. `{name}` placeholders are filled from `vars`. */
export function t(lang: Language, key: TKey, vars?: Vars): string {
  const raw = DICTS[lang][key] ?? en[key];
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const isLanguage = (x: unknown): x is Language => x === 'en' || x === 'hi' || x === 'te';
