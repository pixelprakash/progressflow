import { Alert } from 'react-native';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import * as ImagePicker from 'expo-image-picker';

/**
 * Opens the system document scanner: Google ML Kit on Android, VisionKit on
 * iOS. Both detect page edges live, auto-capture, and offer crop / rotate /
 * filters / retake / multi-page before returning. If the scanner isn't
 * available (e.g. a phone without Google Play services) we fall back to the
 * plain camera so the teacher is never blocked.
 */
export const MAX_PAGES = 30;

export async function scanPages(maxPages = MAX_PAGES): Promise<string[]> {
  try {
    const res = await DocumentScanner.scanDocument({
      croppedImageQuality: 100,
      maxNumDocuments: maxPages,
      responseType: ResponseType.ImageFilePath,
    });
    if (res.status !== ScanDocumentResponseStatus.Success) return [];
    return res.scannedImages ?? [];
  } catch {
    Alert.alert(
      'Scanner unavailable',
      'Using the basic camera instead. Edge detection needs Google Play services.',
    );
    return basicCamera();
  }
}

async function basicCamera(): Promise<string[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchCameraAsync({ quality: 1 });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}

export async function pickFromGallery(multiple = true): Promise<string[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    quality: 1,
  });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}
