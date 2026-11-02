import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  LANGUAGE_LOCALES,
  isLanguage,
  localizedGuides,
  t as translate,
} from '@progressflow/shared';
import type { CriterionGuide, Language, TKey, Vars } from '@progressflow/shared';
import { setScanNotice } from './capture/scan';

/**
 * App language. Remembered in a tiny file on the phone; until the teacher picks
 * one it follows the phone's own language, then their profile.
 */
const FILE = `${FileSystem.documentDirectory ?? ''}progressflow/lang.json`;

function deviceLanguage(): Language {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2);
    return isLanguage(tag) ? tag : 'en';
  } catch {
    return 'en';
  }
}

interface Lang {
  lang: Language;
  /** True once the teacher has picked a language themselves. */
  chosen: boolean;
  setLang: (l: Language) => void;
  /** Follow a suggestion (e.g. the profile language) without marking it as the teacher's own choice. */
  suggest: (l: Language) => void;
  t: (key: TKey, vars?: Vars) => string;
  guides: CriterionGuide[];
  shortDate: (iso: string) => string;
}

const Ctx = createContext<Lang | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(deviceLanguage);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    FileSystem.readAsStringAsync(FILE)
      .then((raw) => {
        const v = (JSON.parse(raw) as { lang?: unknown }).lang;
        if (isLanguage(v)) {
          setLangState(v);
          setChosen(true);
        }
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    setChosen(true);
    FileSystem.makeDirectoryAsync(FILE.replace(/[^/]+$/, ''), { intermediates: true })
      .then(() => FileSystem.writeAsStringAsync(FILE, JSON.stringify({ lang: l })))
      .catch(() => {});
  }, []);

  const suggest = useCallback((l: Language) => setLangState(l), []);

  useEffect(() => {
    setScanNotice({
      title: translate(lang, 'm.cap.unavailTitle'),
      body: translate(lang, 'm.cap.unavailBody'),
    });
  }, [lang]);

  const value = useMemo<Lang>(
    () => ({
      lang,
      chosen,
      setLang,
      suggest,
      t: (key, vars) => translate(lang, key, vars),
      guides: localizedGuides(lang),
      shortDate: (iso) =>
        new Date(iso).toLocaleDateString(LANGUAGE_LOCALES[lang], {
          day: 'numeric',
          month: 'short',
        }),
    }),
    [lang, chosen, setLang, suggest],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): Lang {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLang outside LangProvider');
  return v;
}
