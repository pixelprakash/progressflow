import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  LANGUAGE_LOCALES,
  LANGUAGE_NAMES,
  isLanguage,
  localizedGuides,
  t as translate,
} from '@progressflow/shared';
import type { CriterionGuide, Language, TKey, Vars } from '@progressflow/shared';

const KEY = 'pf-lang';

function stored(): Language | null {
  try {
    const v = localStorage.getItem(KEY);
    return isLanguage(v) ? v : null;
  } catch {
    return null; // private mode: just don't remember it
  }
}

interface Lang {
  lang: Language;
  t: (key: TKey, vars?: Vars) => string;
  setLang: (l: Language) => void;
  /** True if the person has picked a language themselves (vs. us guessing from the browser). */
  chosen: boolean;
  guides: CriterionGuide[];
  fmtDate: (iso: string) => string;
}

const Ctx = createContext<Lang | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const s = stored();
    if (s) return s;
    const nav = navigator.language?.slice(0, 2);
    return isLanguage(nav) ? nav : 'en';
  });
  const [chosen, setChosen] = useState(() => stored() !== null);

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_LOCALES[lang];
  }, [lang]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    setChosen(true);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* fine */
    }
  }, []);

  const value = useMemo<Lang>(
    () => ({
      lang,
      chosen,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      guides: localizedGuides(lang),
      fmtDate: (iso) =>
        new Date(iso).toLocaleDateString(LANGUAGE_LOCALES[lang], {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    }),
    [lang, chosen, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): Lang {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLang outside LangProvider');
  return v;
}

/** A language picker that works on its own: each language is named in its own script. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <label className="langswitch">
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Language)}
        aria-label={t('common.language')}
      >
        {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
          <option key={l} value={l} lang={LANGUAGE_LOCALES[l]}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
