import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import { decode } from 'jpeg-js';
import type { CaptureIssue, CaptureQuality } from '@progressflow/shared';

/**
 * On-device capture checks. Runs on a downscaled copy so it stays fast on
 * low-end phones. The numeric thresholds are STARTING VALUES — tune them on
 * real classroom photos (the review screen shows the raw readings).
 */
export const THRESHOLDS = {
  /** Shorter side of the scan, in pixels. */
  minShortSide: 900,
  /**
   * Laplacian variance ÷ luminance variance. Measured: sharp pages 2.4–3.1, mild
   * blur ~0.09, heavy blur ~0.01. Below this the page looks soft.
   */
  minSharpness: 0.3,
  minBrightness: 70,
  maxBrightness: 245,
  /** Aspect ratios outside this band look cropped or badly skewed. */
  minAspect: 0.4,
  maxAspect: 2.5,
  /** An edge strip this much darker than the middle means background crept in. */
  edgeDarkRatio: 0.55,
} as const;

export const toFileUri = (p: string) => (p.startsWith('/') ? `file://${p}` : p);

export const ISSUE_TEXT: Record<CaptureIssue, { title: string; fix: string; icon: string }> = {
  blurry: {
    title: 'Blurry',
    fix: 'Hold the phone steady and let it focus before the scan fires.',
    icon: 'blur',
  },
  low_resolution: {
    title: 'Low resolution',
    fix: 'Move closer so the artwork fills the frame.',
    icon: 'image-size-select-small',
  },
  too_dark: {
    title: 'Too dark',
    fix: 'Move to brighter light, or turn on the flash.',
    icon: 'brightness-4',
  },
  overexposed: {
    title: 'Washed out',
    fix: 'Avoid glare — tilt the page away from the window or lamp.',
    icon: 'brightness-7',
  },
  tilted_or_cropped: {
    title: 'Edges cut or background showing',
    fix: 'Keep all four corners in view and the page flat.',
    icon: 'crop-rotate',
  },
  orientation_mismatch: {
    title: 'Different orientation',
    fix: 'Rotate it to match the other pages, or keep it if the artwork is meant to be sideways.',
    icon: 'phone-rotate-landscape',
  },
};

function sizeOf(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
}

export async function analyseCapture(
  rawUri: string,
): Promise<{ uri: string; width: number; height: number; quality: CaptureQuality }> {
  const uri = toFileUri(rawUri);
  const { width, height } = await sizeOf(uri);

  const small = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: width >= height ? { width: 640 } : { height: 640 } }],
    { base64: true, compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const img = decode(Buffer.from(small.base64 ?? '', 'base64'), {
    useTArray: true,
    formatAsRGBA: true,
  });
  const { width: w, height: h, data } = img;

  const lum = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const y =
      0.299 * (data[i * 4] ?? 0) + 0.587 * (data[i * 4 + 1] ?? 0) + 0.114 * (data[i * 4 + 2] ?? 0);
    lum[i] = y;
    sum += y;
  }
  const mean = sum / (w * h);
  let varSum = 0;
  for (let i = 0; i < lum.length; i++) varSum += ((lum[i] ?? 0) - mean) ** 2;
  const lumVar = varSum / lum.length;

  // Variance of the 4-neighbour Laplacian: the classic focus measure.
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l =
        4 * (lum[i] ?? 0) -
        (lum[i - 1] ?? 0) -
        (lum[i + 1] ?? 0) -
        (lum[i - w] ?? 0) -
        (lum[i + w] ?? 0);
      lapSum += l;
      lapSq += l * l;
      n++;
    }
  }
  const lapVar = n ? lapSq / n - (lapSum / n) ** 2 : 0;
  const sharpness = lumVar > 1 ? lapVar / lumVar : 0;

  // Mean of each edge strip vs the middle of the page.
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  const regionMean = (x0: number, y0: number, x1: number, y1: number) => {
    let s = 0;
    let c = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        s += lum[y * w + x] ?? 0;
        c++;
      }
    return c ? s / c : 0;
  };
  const centre = regionMean(
    Math.round(w * 0.15),
    Math.round(h * 0.15),
    Math.round(w * 0.85),
    Math.round(h * 0.85),
  );
  const strips = [
    regionMean(0, 0, w, band),
    regionMean(0, h - band, w, h),
    regionMean(0, 0, band, h),
    regionMean(w - band, 0, w, h),
  ];
  const backgroundShowing =
    centre > 90 && strips.some((s) => s < centre * THRESHOLDS.edgeDarkRatio);

  const issues: CaptureIssue[] = [];
  if (sharpness < THRESHOLDS.minSharpness) issues.push('blurry');
  if (Math.min(width, height) < THRESHOLDS.minShortSide) issues.push('low_resolution');
  if (mean < THRESHOLDS.minBrightness) issues.push('too_dark');
  if (mean > THRESHOLDS.maxBrightness) issues.push('overexposed');
  const aspect = width / height;
  if (backgroundShowing || aspect < THRESHOLDS.minAspect || aspect > THRESHOLDS.maxAspect) {
    issues.push('tilted_or_cropped');
  }

  return {
    uri,
    width,
    height,
    quality: scoreQuality(issues, sharpness, mean),
  };
}

const PENALTY: Record<CaptureIssue, number> = {
  blurry: 0.4,
  low_resolution: 0.25,
  too_dark: 0.3,
  overexposed: 0.3,
  tilted_or_cropped: 0.25,
  orientation_mismatch: 0.1,
};

export function scoreQuality(
  issues: CaptureIssue[],
  sharpness: number,
  brightness: number,
): CaptureQuality {
  const score = Math.max(0, 1 - issues.reduce((a, i) => a + PENALTY[i], 0));
  return {
    score,
    issues,
    sharpness: Math.round(sharpness * 1000) / 1000,
    brightness: Math.round(brightness),
  };
}

/** Flag pages whose orientation differs from the majority of the batch. */
export function withOrientationFlags<
  T extends { width: number; height: number; quality: CaptureQuality },
>(pages: T[]): T[] {
  const landscape = pages.filter((p) => p.width > p.height).length;
  const majorityLandscape = landscape > pages.length / 2;
  return pages.map((p) => {
    const issues: CaptureIssue[] = p.quality.issues.filter((i) => i !== 'orientation_mismatch');
    if (pages.length > 1 && p.width > p.height !== majorityLandscape)
      issues.push('orientation_mismatch');
    return { ...p, quality: scoreQuality(issues, p.quality.sharpness, p.quality.brightness) };
  });
}

export async function rotate90(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(uri, [{ rotate: 90 }], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return r.uri;
}
