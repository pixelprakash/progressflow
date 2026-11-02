/**
 * Guards the translations. The compiler already guarantees every key exists in
 * every language; this checks what it cannot: that placeholders survived, that
 * nothing is empty, and that no English was pasted into hi/te by mistake.
 *   npx tsx test/i18n.test.ts
 */
import { en } from '../src/i18n/en.js';
import { hi } from '../src/i18n/hi.js';
import { te } from '../src/i18n/te.js';

let failed = 0;
const fail = (m: string) => { console.log('FAIL  ' + m); failed++; };
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort().join(',');
const SCRIPT = { hi: /[ऀ-ॿ]/, te: /[ఀ-౿]/ };
// words that legitimately stay in Latin script
const KEEP = /ProgressFlow|Google Play services|youtube\.com|example\.org|https?:\/\/|px|7-B|\{\w+\}|[0-9×·→↑↓…–—:,.()/\s]|Roll|[a-z]+\.[a-z]+/gi;

let n = 0;
for (const [lang, dict] of [['hi', hi], ['te', te]] as const) {
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    n++;
    const a = en[key], b = dict[key];
    if (!b.trim()) fail(`${lang} ${key}: empty`);
    if (holes(a) !== holes(b)) fail(`${lang} ${key}: placeholders differ (en ${holes(a) || '-'} vs ${holes(b) || '-'})`);
    const latinLeft = b.replace(KEEP, '');
    if (/[A-Za-z]{3,}/.test(latinLeft) && !SCRIPT[lang].test(b)) fail(`${lang} ${key}: looks untranslated: ${b.slice(0, 50)}`);
    if (!SCRIPT[lang].test(b) && /[A-Za-z]/.test(b.replace(KEEP, ''))) fail(`${lang} ${key}: no ${lang} script`);
  }
}
console.log(`${n} translations checked`);
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
