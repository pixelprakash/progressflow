import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { RosterStudent } from '../domain';

/**
 * Reads the text on a scanned artwork (on-device ML Kit, Latin script) and
 * matches it against the class roster. Roll number is the strong signal;
 * name is a fuzzy backup. Never files silently: the review screen always
 * shows who it matched and why, and the teacher can change it.
 *
 * Limits: ML Kit has no Telugu model and is weak on cursive handwriting, so
 * ask students to write "Roll No: 12" and their name in block letters.
 */

export interface Detection {
  studentId: string | null;
  confidence: number;
  via: 'roll' | 'name' | 'both' | null;
  text: string;
}

const NONE: Detection = { studentId: null, confidence: 0, via: null, text: '' };

const ROLL_RE =
  /(?:roll|r\.?\s?no|reg(?:istration)?|admission|adm)\.?\s*(?:no|number|num|#)?\.?\s*[:\-–#]?\s*(\d{1,4})/i;

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - dp[a.length]![b.length]! / Math.max(a.length, b.length);
}

export function matchRoster(text: string, roster: RosterStudent[]): Detection {
  const flat = text.replace(/\s+/g, ' ');
  const rollHit = ROLL_RE.exec(flat)?.[1];
  const byRoll = rollHit
    ? roster.find((s) => s.rollNo.replace(/^0+/, '') === rollHit.replace(/^0+/, ''))
    : undefined;

  const words = flat.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const nameHits = roster.filter((s) => {
    const first = s.name.toLowerCase().match(/[a-z]{3,}/)?.[0];
    return first !== undefined && words.some((w) => similarity(w, first) >= 0.8);
  });
  const byName = nameHits.length === 1 ? nameHits[0] : undefined;

  if (byRoll && byName && byRoll.id === byName.id)
    return { studentId: byRoll.id, confidence: 0.98, via: 'both', text: flat };
  if (byRoll)
    return { studentId: byRoll.id, confidence: byName ? 0.55 : 0.85, via: 'roll', text: flat };
  if (byName) return { studentId: byName.id, confidence: 0.6, via: 'name', text: flat };
  return { ...NONE, text: flat };
}

export async function detectStudent(uri: string, roster: RosterStudent[]): Promise<Detection> {
  try {
    const res = await TextRecognition.recognize(uri);
    return matchRoster(res.text, roster);
  } catch {
    return NONE;
  }
}
