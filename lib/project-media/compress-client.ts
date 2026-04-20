/**
 * Browser-side image compression for the photos uploader.
 *
 * Why client-side: shrinking from a 6MB iPhone photo to a 400KB WebP
 * before upload saves 90%+ of the bytes on the wire — critical for
 * crew uploading from a jobsite over LTE. No server-side resizing
 * dep needed (sharp etc), and the user sees instant feedback.
 *
 * Uses HTMLCanvasElement.toBlob — a built-in browser API. No deps.
 *
 * Targets:
 *   - max width 2400px (preserves aspect ratio)
 *   - JPEG (or WebP if the input is WebP) at quality 0.82
 *   - target file size ≤ 500KB; if first pass overshoots, recompress
 *     once at quality 0.7
 *
 * Returns a fresh File with the original filename + a hint suffix so
 * the user can recognize their original photo in error messages.
 */

const MAX_WIDTH = 2400;
const TARGET_BYTES = 500 * 1024;
const FALLBACK_QUALITY = 0.7;
const FIRST_QUALITY = 0.82;

export type CompressedImage = {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
};

export async function compressImage(input: File): Promise<CompressedImage> {
  // Skip non-images entirely — caller already filtered, but be safe.
  if (!input.type.startsWith("image/")) {
    return {
      file: input,
      width: 0,
      height: 0,
      originalBytes: input.size,
      compressedBytes: input.size,
    };
  }

  const bitmap = await loadBitmap(input);
  const ratio = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
  const targetWidth = Math.round(bitmap.width * ratio);
  const targetHeight = Math.round(bitmap.height * ratio);

  // Canvas may not be available in some legacy contexts (e.g. tests
  // running in jsdom without the canvas module). Fall back to original.
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      file: input,
      width: bitmap.width,
      height: bitmap.height,
      originalBytes: input.size,
      compressedBytes: input.size,
    };
  }
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  // WebP if the input was WebP, otherwise JPEG (broadest browser/render
  // compatibility for marketing-site embedding). PNG → JPEG too — we lose
  // transparency but project photos don't need it.
  const outMime = input.type === "image/webp" ? "image/webp" : "image/jpeg";
  const outExt = outMime === "image/webp" ? "webp" : "jpg";

  let blob = await canvasToBlob(canvas, outMime, FIRST_QUALITY);
  if (blob && blob.size > TARGET_BYTES) {
    const second = await canvasToBlob(canvas, outMime, FALLBACK_QUALITY);
    if (second) blob = second;
  }
  if (!blob) {
    // Failed to encode — return original.
    return {
      file: input,
      width: bitmap.width,
      height: bitmap.height,
      originalBytes: input.size,
      compressedBytes: input.size,
    };
  }

  // Replace the extension on the original filename so the resulting
  // file's name reflects the actual encoded format.
  const baseName = input.name.replace(/\.[^.]+$/, "") || "photo";
  const file = new File([blob], `${baseName}.${outExt}`, {
    type: outMime,
    lastModified: Date.now(),
  });
  return {
    file,
    width: targetWidth,
    height: targetHeight,
    originalBytes: input.size,
    compressedBytes: file.size,
  };
}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}
