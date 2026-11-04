import { moveMedia, newId, useStore } from '../store';
import { sizeOf, toFileUri } from './quality';

/**
 * Puts photos (from the camera, the document scanner or the gallery) into a
 * class's inbox. The image file is kept exactly as received.
 */
export function useIntake(classId: string) {
  const { addInbox } = useStore();
  return async function intake(uris: string[]): Promise<number> {
    const now = new Date().toISOString();
    const items = [];
    for (const raw of uris) {
      try {
        const src = toFileUri(raw);
        const { width, height } = await sizeOf(src);
        const uri = await moveMedia(src, 'inbox', 'jpg');
        items.push({ id: newId(), classId, uri, width, height, createdAt: now });
      } catch {
        // An unreadable file is skipped; the rest still go in.
      }
    }
    if (items.length) addInbox(items);
    return items.length;
  };
}
