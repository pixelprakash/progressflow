import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ReportDoc } from './model';
import { FORMAT_INFO, renderCsv, renderDocx, renderHtml, renderXlsx } from './render';
import type { ReportFormat } from './render';

/** Writes the report to the phone's cache and opens the system share sheet (Drive, WhatsApp, Files, email…). */
export async function exportReport(
  doc: ReportDoc,
  format: ReportFormat,
  lang: string,
  dialogTitle: string,
) {
  const info = FORMAT_INFO[format];
  const target = `${FileSystem.cacheDirectory ?? ''}${doc.slug}.${info.ext}`;
  await FileSystem.deleteAsync(target, { idempotent: true });

  if (format === 'pdf') {
    const { uri } = await Print.printToFileAsync({
      html: renderHtml(doc, lang),
      width: 842,
      height: 595,
    });
    await FileSystem.moveAsync({ from: uri, to: target });
  } else if (format === 'csv') {
    await FileSystem.writeAsStringAsync(target, renderCsv(doc));
  } else {
    const b64 = format === 'docx' ? await renderDocx(doc) : await renderXlsx(doc);
    await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 });
  }

  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  await Sharing.shareAsync(target, { mimeType: info.mime, UTI: info.uti, dialogTitle });
}
