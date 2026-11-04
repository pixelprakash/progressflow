import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import type { RosterStudent } from '../domain';
import { matchRoster } from './match';
import type { Detection } from './match';

export type { Detection } from './match';
export { matchRoster } from './match';

/**
 * Reads the text on a photographed paper (on-device ML Kit, Latin script) and
 * matches it to the class roster. The name and roll number are normally at the
 * top of the page, so the top third is read first and the whole page only if
 * that finds nobody — this avoids a stray number in the drawing being taken for
 * a roll number.
 *
 * Limits: ML Kit has no Telugu model and is weak on cursive handwriting, so
 * ask students to write "Roll No: 12" and their name in block letters.
 */

const NONE: Detection = { studentId: null, confidence: 0, via: null, text: '' };

/** Reading a 12-megapixel photo is slow and needs a lot of memory; 1600 px is plenty for printed or block text. */
async function ocrCopy(uri: string, width: number, height: number): Promise<string | null> {
  if (Math.max(width, height) <= 1800) return null;
  const copy = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: width >= height ? { width: 1600 } : { height: 1600 } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  return copy.uri;
}

export async function detectStudent(
  uri: string,
  roster: RosterStudent[],
  size?: { width: number; height: number },
): Promise<Detection> {
  let copy: string | null = null;
  try {
    copy = size ? await ocrCopy(uri, size.width, size.height) : null;
    const res = await TextRecognition.recognize(copy ?? uri);
    const blocks = res.blocks ?? [];
    const extent = Math.max(0, ...blocks.map((b) => (b.frame?.top ?? 0) + (b.frame?.height ?? 0)));
    const header = blocks
      .filter((b) => b.frame && b.frame.top < extent * 0.35)
      .map((b) => b.text)
      .join('\n');
    const top = header ? matchRoster(header, roster) : NONE;
    return top.studentId ? top : matchRoster(res.text, roster);
  } catch {
    return NONE;
  } finally {
    if (copy) FileSystem.deleteAsync(copy, { idempotent: true }).catch(() => {});
  }
}
