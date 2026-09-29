/**
 * Production-Grade Image Compression & Thumbnail Processing Engine
 * Designed for Rentit (Rented Thikanaa)
 * 
 * Strict Storage Limits:
 * - Main Image: Target ~85 KB | Hard Maximum: 85 KB (87,040 bytes) | Format: WebP | Max Dim: 1600px
 * - Thumbnail: Target ~55 KB | Hard Maximum: 60 KB (61,440 bytes) | Format: WebP | Max Dim: 600px
 * 
 * Key Features:
 * - Dynamic / Iterative quality & dimension compression (no static quality guesses)
 * - Strict byte-level validation (1 KB = 1024 bytes)
 * - Full EXIF orientation auto-correction for iOS / Android Camera & Gallery uploads
 * - Preserves aspect ratio with zero distortion or upscaling
 * - WebP output with transparency preservation for PNGs
 */

export const BYTE_UNITS = 1024;
export const MAIN_IMAGE_MAX_BYTES = 85 * BYTE_UNITS; // 87,040 bytes
export const MAIN_IMAGE_TARGET_BYTES = 82 * BYTE_UNITS; // ~83,968 bytes
export const THUMBNAIL_MAX_BYTES = 60 * BYTE_UNITS; // 61,440 bytes
export const THUMBNAIL_TARGET_BYTES = 55 * BYTE_UNITS; // 56,320 bytes

export const MAIN_IMAGE_MAX_DIMENSION = 1600;
export const THUMBNAIL_MAX_DIMENSION = 600;

export const OUTPUT_FORMAT = 'image/webp';

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: 'image/webp';
}

export interface ProcessedListingImage {
  main: CompressedImageResult;
  thumbnail: CompressedImageResult;
  originalName: string;
  originalSizeBytes: number;
  previewUrl: string;
  thumbnailPreviewUrl: string;
}

/**
 * Reads EXIF orientation from JPEG Blob.
 * Values: 1 = Normal, 3 = 180 deg, 6 = 90 deg CW, 8 = 270 deg CW, etc.
 */
export async function getExifOrientation(blob: Blob): Promise<number> {
  try {
    if (!blob.type.includes('jpeg') && !blob.type.includes('jpg')) {
      return 1;
    }

    const slice = blob.slice(0, 65536);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    // Verify SOI marker (0xFFD8)
    if (view.getUint16(0, false) !== 0xffd8) {
      return 1;
    }

    let offset = 2;
    const length = view.byteLength;

    while (offset < length) {
      if (offset + 4 > length) break;
      const marker = view.getUint16(offset, false);
      offset += 2;

      // APP1 marker (0xFFE1)
      if (marker === 0xffe1) {
        offset += 2;
        // Check for 'Exif\0\0'
        if (
          offset + 6 <= length &&
          view.getUint32(offset, false) === 0x45786966 &&
          view.getUint16(offset + 4, false) === 0x0000
        ) {
          const tiffStart = offset + 6;
          const isLittle = view.getUint16(tiffStart, false) === 0x4949;

          if (view.getUint16(tiffStart + 2, isLittle) !== 0x002a) {
            return 1;
          }

          const ifdOffset = view.getUint32(tiffStart + 4, isLittle);
          let currentOffset = tiffStart + ifdOffset;

          if (currentOffset + 2 > length) return 1;
          const numEntries = view.getUint16(currentOffset, isLittle);
          currentOffset += 2;

          for (let i = 0; i < numEntries; i++) {
            if (currentOffset + 12 > length) break;
            const tag = view.getUint16(currentOffset, isLittle);
            // 0x0112 = Orientation
            if (tag === 0x0112) {
              const val = view.getUint16(currentOffset + 8, isLittle);
              if (val >= 1 && val <= 8) {
                return val;
              }
              return 1;
            }
            currentOffset += 12;
          }
        }
        break;
      } else if ((marker & 0xff00) === 0xff00 && marker !== 0xffd8 && marker !== 0xffd9) {
        const segLength = view.getUint16(offset, false);
        offset += segLength;
      } else {
        break;
      }
    }
  } catch (err) {
    console.warn('[ImageProcessor] EXIF inspection error:', err);
  }
  return 1;
}

/**
 * Applies EXIF orientation rotation/flip to a 2D canvas context.
 */
function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  srcWidth: number,
  srcHeight: number
): { canvasWidth: number; canvasHeight: number } {
  const isRotated90 = orientation >= 5 && orientation <= 8;
  const canvasWidth = isRotated90 ? srcHeight : srcWidth;
  const canvasHeight = isRotated90 ? srcWidth : srcHeight;

  switch (orientation) {
    case 2: // Horizontal flip
      ctx.translate(canvasWidth, 0);
      ctx.scale(-1, 1);
      break;
    case 3: // 180 rotate
      ctx.translate(canvasWidth, canvasHeight);
      ctx.rotate(Math.PI);
      break;
    case 4: // Vertical flip
      ctx.translate(0, canvasHeight);
      ctx.scale(1, -1);
      break;
    case 5: // Transposed
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6: // 90 deg CW (standard smartphone portrait)
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -canvasWidth);
      break;
    case 7: // Transverse
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(canvasHeight, -canvasWidth);
      ctx.scale(-1, 1);
      break;
    case 8: // 270 deg CW / 90 deg CCW
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-canvasHeight, 0);
      break;
    default:
      // Normal (1)
      break;
  }

  return { canvasWidth, canvasHeight };
}

/**
 * Loads an image into an upright, orientation-corrected HTMLCanvasElement.
 */
export async function loadOrientedCanvas(fileOrBlob: Blob): Promise<{
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}> {
  // 1. Try modern native browser orientation handling first
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(fileOrBlob, { imageOrientation: 'from-image' });
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        return { canvas, width: canvas.width, height: canvas.height };
      }
    } catch {
      // Fallback below
    }
  }

  // 2. Fallback: HTMLImageElement + manual EXIF matrix rotation
  const orientation = await getExifOrientation(fileOrBlob);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file as data URL'));
    reader.readAsDataURL(fileOrBlob);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image in browser'));
    el.src = dataUrl;
  });

  const isRotated90 = orientation >= 5 && orientation <= 8;
  const canvasWidth = isRotated90 ? img.height : img.width;
  const canvasHeight = isRotated90 ? img.width : img.height;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context could not be initialized');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  applyOrientationTransform(ctx, orientation, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  return { canvas, width: canvasWidth, height: canvasHeight };
}

/**
 * Converts a Canvas to a WebP Blob with specified quality.
 */
function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          try {
            const dataUrl = canvas.toDataURL(OUTPUT_FORMAT, quality);
            const byteString = atob(dataUrl.split(',')[1]);
            const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            resolve(new Blob([ab], { type: mimeString }));
          } catch (err) {
            reject(err);
          }
        }
      },
      OUTPUT_FORMAT,
      quality
    );
  });
}

/**
 * Converts a Blob to a Data URL string.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Calculates resized dimensions adhering to a maximum constraint
 * while strictly preserving original aspect ratio and NEVER upscaling.
 */
export function calculateFitDimensions(
  origWidth: number,
  origHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (origWidth <= 0 || origHeight <= 0) {
    return { width: maxDimension, height: maxDimension };
  }

  // Do not upscale if already smaller than maxDimension
  if (origWidth <= maxDimension && origHeight <= maxDimension) {
    return { width: origWidth, height: origHeight };
  }

  if (origWidth >= origHeight) {
    const scaledHeight = Math.max(1, Math.round((origHeight * maxDimension) / origWidth));
    return { width: maxDimension, height: scaledHeight };
  } else {
    const scaledWidth = Math.max(1, Math.round((origWidth * maxDimension) / origHeight));
    return { width: scaledWidth, height: maxDimension };
  }
}

/**
 * Compresses an image to the Main Image specifications:
 * - Target: ~85 KB
 * - Hard Maximum: 85 KB (87,040 bytes)
 * - Format: WebP
 * - Max dimension: 1600px (no upscaling, preserve aspect ratio)
 * - Iterative quality & dimension adjustment
 */
export async function compressMainImage(
  sourceCanvas: HTMLCanvasElement,
  options?: { maxBytes?: number; maxDimension?: number }
): Promise<CompressedImageResult> {
  const hardLimit = options?.maxBytes || MAIN_IMAGE_MAX_BYTES;
  const maxDim = options?.maxDimension || MAIN_IMAGE_MAX_DIMENSION;

  const initialDims = calculateFitDimensions(sourceCanvas.width, sourceCanvas.height, maxDim);
  let curWidth = initialDims.width;
  let curHeight = initialDims.height;

  let workingCanvas = document.createElement('canvas');
  workingCanvas.width = curWidth;
  workingCanvas.height = curHeight;

  let ctx = workingCanvas.getContext('2d');
  if (!ctx) throw new Error('Working canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, curWidth, curHeight);

  // Iterative compression configuration
  let quality = 0.88;
  const minQuality = 0.40;
  let bestBlob: Blob | null = null;
  let iteration = 0;
  const maxIterations = 16;

  while (iteration < maxIterations) {
    iteration++;
    const blob = await canvasToWebpBlob(workingCanvas, quality);

    if (blob.size <= hardLimit) {
      bestBlob = blob;
      break;
    }

    // Still above hard limit:
    if (quality > minQuality + 0.03) {
      const excessRatio = blob.size / hardLimit;
      const step = excessRatio > 1.8 ? 0.12 : excessRatio > 1.3 ? 0.08 : 0.05;
      quality = Math.max(minQuality, quality - step);
    } else {
      // Reached minimum acceptable quality threshold; downscale dimensions gradually (12%)
      curWidth = Math.max(320, Math.round(curWidth * 0.88));
      curHeight = Math.max(240, Math.round(curHeight * 0.88));

      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = curWidth;
      resizedCanvas.height = curHeight;
      const rCtx = resizedCanvas.getContext('2d')!;
      rCtx.imageSmoothingEnabled = true;
      rCtx.imageSmoothingQuality = 'high';
      rCtx.drawImage(workingCanvas, 0, 0, curWidth, curHeight);

      // Clean up previous canvas memory
      workingCanvas.width = 0;
      workingCanvas.height = 0;
      workingCanvas = resizedCanvas;

      // Reset quality slightly higher for the new crisp smaller dimension
      quality = 0.65;
    }
  }

  // Safety guarantee: ensure hard limit is NEVER exceeded
  while ((!bestBlob || bestBlob.size > hardLimit) && curWidth > 200) {
    curWidth = Math.round(curWidth * 0.80);
    curHeight = Math.round(curHeight * 0.80);

    const emergencyCanvas = document.createElement('canvas');
    emergencyCanvas.width = curWidth;
    emergencyCanvas.height = curHeight;
    const eCtx = emergencyCanvas.getContext('2d')!;
    eCtx.imageSmoothingEnabled = true;
    eCtx.imageSmoothingQuality = 'high';
    eCtx.drawImage(workingCanvas, 0, 0, curWidth, curHeight);

    workingCanvas.width = 0;
    workingCanvas.height = 0;
    workingCanvas = emergencyCanvas;

    bestBlob = await canvasToWebpBlob(workingCanvas, 0.45);
  }

  if (!bestBlob || bestBlob.size > hardLimit) {
    throw new Error(
      `Image compression could not meet the 85 KB hard limit (final size: ${bestBlob?.size || 0} bytes)`
    );
  }

  const dataUrl = await blobToDataUrl(bestBlob);

  // Clean up canvas memory
  const finalWidth = workingCanvas.width;
  const finalHeight = workingCanvas.height;
  workingCanvas.width = 0;
  workingCanvas.height = 0;

  return {
    blob: bestBlob,
    dataUrl,
    width: finalWidth,
    height: finalHeight,
    sizeBytes: bestBlob.size,
    format: 'image/webp',
  };
}

/**
 * Generates an optimized WebP Thumbnail from the oriented source:
 * - Target: ~55 KB
 * - Hard Maximum: 60 KB (61,440 bytes)
 * - Format: WebP
 * - Max dimension: ~600px (preserve aspect ratio)
 * - Iterative quality & dimension adjustment
 */
export async function createThumbnail(
  sourceCanvas: HTMLCanvasElement,
  options?: { maxBytes?: number; targetBytes?: number; maxDimension?: number }
): Promise<CompressedImageResult> {
  const hardLimit = options?.maxBytes || THUMBNAIL_MAX_BYTES;
  const targetBytes = options?.targetBytes || THUMBNAIL_TARGET_BYTES;
  const maxDim = options?.maxDimension || THUMBNAIL_MAX_DIMENSION;

  const initialDims = calculateFitDimensions(sourceCanvas.width, sourceCanvas.height, maxDim);
  let curWidth = initialDims.width;
  let curHeight = initialDims.height;

  let workingCanvas = document.createElement('canvas');
  workingCanvas.width = curWidth;
  workingCanvas.height = curHeight;

  let ctx = workingCanvas.getContext('2d');
  if (!ctx) throw new Error('Thumbnail canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, curWidth, curHeight);

  // Iterative thumbnail compression
  let quality = 0.84;
  const minQuality = 0.45;
  let bestBlob: Blob | null = null;
  let iteration = 0;
  const maxIterations = 14;

  while (iteration < maxIterations) {
    iteration++;
    const blob = await canvasToWebpBlob(workingCanvas, quality);

    // Sweet spot: target ~55 KB or within 60 KB with reasonable quality
    if (blob.size <= targetBytes || (blob.size <= hardLimit && quality <= 0.68)) {
      bestBlob = blob;
      break;
    }

    if (blob.size > hardLimit) {
      if (quality > minQuality + 0.03) {
        const excessRatio = blob.size / hardLimit;
        const step = excessRatio > 1.6 ? 0.10 : excessRatio > 1.2 ? 0.07 : 0.05;
        quality = Math.max(minQuality, quality - step);
      } else {
        // Quality at threshold; downscale thumbnail dimensions
        curWidth = Math.max(180, Math.round(curWidth * 0.86));
        curHeight = Math.max(140, Math.round(curHeight * 0.86));

        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = curWidth;
        resizedCanvas.height = curHeight;
        const rCtx = resizedCanvas.getContext('2d')!;
        rCtx.imageSmoothingEnabled = true;
        rCtx.imageSmoothingQuality = 'high';
        rCtx.drawImage(workingCanvas, 0, 0, curWidth, curHeight);

        workingCanvas.width = 0;
        workingCanvas.height = 0;
        workingCanvas = resizedCanvas;

        quality = 0.70;
      }
    } else {
      // Between targetBytes (55KB) and hardLimit (60KB), take it
      bestBlob = blob;
      break;
    }
  }

  // Safety check for thumbnail hard limit (60 KB)
  while ((!bestBlob || bestBlob.size > hardLimit) && curWidth > 120) {
    curWidth = Math.round(curWidth * 0.80);
    curHeight = Math.round(curHeight * 0.80);

    const emergencyCanvas = document.createElement('canvas');
    emergencyCanvas.width = curWidth;
    emergencyCanvas.height = curHeight;
    const eCtx = emergencyCanvas.getContext('2d')!;
    eCtx.imageSmoothingEnabled = true;
    eCtx.imageSmoothingQuality = 'high';
    eCtx.drawImage(workingCanvas, 0, 0, curWidth, curHeight);

    workingCanvas.width = 0;
    workingCanvas.height = 0;
    workingCanvas = emergencyCanvas;

    bestBlob = await canvasToWebpBlob(workingCanvas, 0.45);
  }

  if (!bestBlob || bestBlob.size > hardLimit) {
    throw new Error(
      `Thumbnail compression could not meet the 60 KB hard limit (final size: ${bestBlob?.size || 0} bytes)`
    );
  }

  const dataUrl = await blobToDataUrl(bestBlob);

  const finalWidth = workingCanvas.width;
  const finalHeight = workingCanvas.height;
  workingCanvas.width = 0;
  workingCanvas.height = 0;

  return {
    blob: bestBlob,
    dataUrl,
    width: finalWidth,
    height: finalHeight,
    sizeBytes: bestBlob.size,
    format: 'image/webp',
  };
}

/**
 * Master Pipeline:
 * Processes a raw user image file (camera or gallery) into:
 * 1. Oriented, aspect-preserved Main WebP Image (<= 85 KB)
 * 2. High-speed, aspect-preserved Thumbnail WebP Image (<= 60 KB)
 */
export async function processListingImage(file: File): Promise<ProcessedListingImage> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Selected file is not a valid image.');
  }

  // Step 1: Decode image with EXIF orientation correction
  const { canvas: orientedCanvas } = await loadOrientedCanvas(file);

  try {
    // Step 2: Compress Main Image (<= 85 KB)
    const main = await compressMainImage(orientedCanvas);

    // Step 3: Generate Thumbnail (<= 60 KB)
    const thumbnail = await createThumbnail(orientedCanvas);

    return {
      main,
      thumbnail,
      originalName: file.name,
      originalSizeBytes: file.size,
      previewUrl: main.dataUrl,
      thumbnailPreviewUrl: thumbnail.dataUrl,
    };
  } finally {
    // Clean up base canvas memory
    orientedCanvas.width = 0;
    orientedCanvas.height = 0;
  }
}

/**
 * Returns the best thumbnail URL for a given image or URL.
 * Follows the predictable Supabase storage structure:
 * Main: .../listings/{userId}/{id}.webp
 * Thumbnail: .../listings/{userId}/thumbnails/{id}.webp
 * 
 * Safely falls back to the original URL for legacy/external images.
 */
export function getThumbnailUrl(imageOrUrl?: { url?: string; thumbnail_url?: string } | string | null): string {
  if (!imageOrUrl) return '';

  if (typeof imageOrUrl !== 'string') {
    if (imageOrUrl.thumbnail_url) return imageOrUrl.thumbnail_url;
    if (imageOrUrl.url) return getThumbnailUrl(imageOrUrl.url);
    return '';
  }

  const url = imageOrUrl.trim();
  if (!url) return '';

  // Check if this is a WebP image stored in our Supabase property-images bucket
  if (
    url.includes('/property-images/listings/') &&
    url.endsWith('.webp') &&
    !url.includes('/thumbnails/') &&
    !url.includes('-thumb.')
  ) {
    // Transform: /listings/{userId}/{file}.webp -> /listings/{userId}/thumbnails/{file}.webp
    return url.replace(/(listings\/[^/]+)\/([^/]+\.webp)$/, '$1/thumbnails/$2');
  }

  return url;
}
