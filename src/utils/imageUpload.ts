/**
 * Client-side device image compressor for Edkawy.
 * Resizes and compresses any image picked from the user's phone/computer
 * into an optimized WebP/JPEG Data URL safely under Firestore's 1MB document limit.
 */

export const MAX_UPLOADED_IMAGE_CHARS = 220_000;

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxChars?: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('تعذر قراءة ملف الصورة من الجهاز.'));
      }
    };
    reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة الصورة من الجهاز.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('ملف الصورة غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP.'));
    img.src = src;
  });
}

export async function compressDeviceImageToDataUrl(
  file: File,
  options?: CompressImageOptions
): Promise<string> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح من جهازك.');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('حجم الصورة كبير جداً (أكثر من ١٥ ميجابايت). يرجى اختيار صورة أصغر.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);

  const targetMaxW = options?.maxWidth ?? 920;
  const targetMaxH = options?.maxHeight ?? 920;
  const initialQuality = options?.quality ?? 0.78;
  const maxAllowedChars = Math.min(
    MAX_UPLOADED_IMAGE_CHARS,
    Math.max(40_000, options?.maxChars ?? MAX_UPLOADED_IMAGE_CHARS)
  );

  let width = img.naturalWidth || img.width || 640;
  let height = img.naturalHeight || img.height || 480;

  if (width > targetMaxW || height > targetMaxH) {
    const ratio = Math.min(targetMaxW / width, targetMaxH / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر معالجة الصورة على هذا المتصفح.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // Try WebP first, then JPEG, stepping down quality/dimensions if needed
  const mimeCandidates = ['image/webp', 'image/jpeg'];
  const qualitySteps = [initialQuality, 0.66, 0.54, 0.42];

  for (const mime of mimeCandidates) {
    for (const q of qualitySteps) {
      const encoded = canvas.toDataURL(mime, q);
      if (
        encoded.startsWith(`data:${mime}`) &&
        encoded.length <= maxAllowedChars
      ) {
        return encoded;
      }
    }
  }

  // Compact pass at 600px then 480px max dimension if still above limit
  for (const [dimLimit, fallbackQ] of [
    [600, 0.5],
    [480, 0.45],
  ] as const) {
    const compactScale = Math.min(1, dimLimit / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * compactScale));
    canvas.height = Math.max(1, Math.round(height * compactScale));
    const compactCtx = canvas.getContext('2d');
    if (compactCtx) {
      compactCtx.fillStyle = '#FFFFFF';
      compactCtx.fillRect(0, 0, canvas.width, canvas.height);
      compactCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    const fallbackEncoded = canvas.toDataURL('image/jpeg', fallbackQ);
    if (fallbackEncoded.length <= maxAllowedChars) {
      return fallbackEncoded;
    }
  }

  throw new Error('تعذر ضغط الصورة بالحجم المناسب. يرجى اختيار صورة أوضح بحجم أقل.');
}

export function isValidUploadedImageUrl(value?: string | null): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 16 || trimmed.length > 750_000) return false;
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  );
}
