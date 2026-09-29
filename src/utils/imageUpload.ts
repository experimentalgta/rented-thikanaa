import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  processListingImage,
  getThumbnailUrl,
  compressMainImage,
  createThumbnail,
  ProcessedListingImage,
  MAIN_IMAGE_MAX_BYTES,
  THUMBNAIL_MAX_BYTES,
} from './imageProcessor';

export {
  getThumbnailUrl,
  processListingImage,
  compressMainImage,
  createThumbnail,
  MAIN_IMAGE_MAX_BYTES,
  THUMBNAIL_MAX_BYTES,
};

export interface ProcessedImage {
  id: string;
  url: string;
  thumbnail_url?: string;
  caption: string;
  is_cover: boolean;
  file?: File;
}

export interface UploadPropertyImageResult {
  url: string;
  thumbnailUrl: string;
  mainSizeBytes: number;
  thumbSizeBytes: number;
  dataUrl: string;
  thumbnailDataUrl: string;
  toString: () => string;
}

/**
 * Uploads a property image to Supabase Storage ('property-images' bucket).
 * 
 * Flow:
 * 1. Process & compress main WebP image to <= 85 KB (87,040 bytes).
 * 2. Process & compress thumbnail WebP to <= 60 KB (61,440 bytes).
 * 3. Verify hard file-size limits before uploading.
 * 4. Upload main image to: listings/{userId}/{fileId}.webp
 * 5. Upload thumbnail to: listings/{userId}/thumbnails/{fileId}.webp
 * 6. Return public URLs for both main image and thumbnail.
 */
export async function uploadPropertyImage(
  file: File,
  userId?: string,
  onProgress?: (step: string) => void
): Promise<UploadPropertyImageResult> {
  onProgress?.('Optimizing image and generating thumbnail (WebP)...');

  // Step 1 & 2: Process image through dynamic compression engine
  const processed: ProcessedListingImage = await processListingImage(file);

  // Strict verification: Never upload uncompressed or oversized files
  if (processed.main.sizeBytes > MAIN_IMAGE_MAX_BYTES) {
    throw new Error(
      `Main image size (${processed.main.sizeBytes} bytes) exceeds hard limit of ${MAIN_IMAGE_MAX_BYTES} bytes (85 KB)`
    );
  }
  if (processed.thumbnail.sizeBytes > THUMBNAIL_MAX_BYTES) {
    throw new Error(
      `Thumbnail size (${processed.thumbnail.sizeBytes} bytes) exceeds hard limit of ${THUMBNAIL_MAX_BYTES} bytes (60 KB)`
    );
  }

  // Fallback to data URLs if Supabase is offline or not configured
  if (!supabase || !isSupabaseConfigured) {
    onProgress?.('Saved locally (offline mode)');
    return {
      url: processed.main.dataUrl,
      thumbnailUrl: processed.thumbnail.dataUrl,
      mainSizeBytes: processed.main.sizeBytes,
      thumbSizeBytes: processed.thumbnail.sizeBytes,
      dataUrl: processed.main.dataUrl,
      thumbnailDataUrl: processed.thumbnail.dataUrl,
      toString() {
        return processed.main.dataUrl;
      },
    };
  }

  try {
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const folder = `listings/${userId || 'anon'}`;
    const mainPath = `${folder}/${fileId}.webp`;
    const thumbPath = `${folder}/thumbnails/${fileId}.webp`;

    onProgress?.('Uploading compressed WebP to cloud storage...');

    // Parallel upload of main image and thumbnail to Supabase Storage
    const [mainUpload, thumbUpload] = await Promise.all([
      supabase.storage.from('property-images').upload(mainPath, processed.main.blob, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '31536000',
      }),
      supabase.storage.from('property-images').upload(thumbPath, processed.thumbnail.blob, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '31536000',
      }),
    ]);

    if (mainUpload.error) {
      console.warn('[ImageUpload] Supabase main upload failed, falling back to data URL:', mainUpload.error.message);
      return {
        url: processed.main.dataUrl,
        thumbnailUrl: processed.thumbnail.dataUrl,
        mainSizeBytes: processed.main.sizeBytes,
        thumbSizeBytes: processed.thumbnail.sizeBytes,
        dataUrl: processed.main.dataUrl,
        thumbnailDataUrl: processed.thumbnail.dataUrl,
        toString() {
          return processed.main.dataUrl;
        },
      };
    }

    const { data: mainPublicData } = supabase.storage.from('property-images').getPublicUrl(mainPath);
    const mainUrl = mainPublicData?.publicUrl || processed.main.dataUrl;

    let thumbUrl = processed.thumbnail.dataUrl;
    if (!thumbUpload.error) {
      const { data: thumbPublicData } = supabase.storage.from('property-images').getPublicUrl(thumbPath);
      thumbUrl = thumbPublicData?.publicUrl || processed.thumbnail.dataUrl;
    }

    onProgress?.('Upload complete!');

    return {
      url: mainUrl,
      thumbnailUrl: thumbUrl,
      mainSizeBytes: processed.main.sizeBytes,
      thumbSizeBytes: processed.thumbnail.sizeBytes,
      dataUrl: processed.main.dataUrl,
      thumbnailDataUrl: processed.thumbnail.dataUrl,
      toString() {
        return mainUrl;
      },
    };
  } catch (err) {
    console.warn('[ImageUpload] Error during upload, using compressed data URL:', err);
    return {
      url: processed.main.dataUrl,
      thumbnailUrl: processed.thumbnail.dataUrl,
      mainSizeBytes: processed.main.sizeBytes,
      thumbSizeBytes: processed.thumbnail.sizeBytes,
      dataUrl: processed.main.dataUrl,
      thumbnailDataUrl: processed.thumbnail.dataUrl,
      toString() {
        return processed.main.dataUrl;
      },
    };
  }
}

/**
 * Safely deletes a property image and its associated thumbnail from Supabase Storage.
 */
export async function deletePropertyImage(imageUrl: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || !imageUrl) {
    return false;
  }

  try {
    const match = imageUrl.match(/property-images\/(.+)$/);
    if (!match) return false;

    const mainPath = match[1];
    const thumbPath = mainPath.replace(/(listings\/[^/]+)\/([^/]+\.webp)$/, '$1/thumbnails/$2');

    const pathsToDelete = [mainPath];
    if (thumbPath !== mainPath) {
      pathsToDelete.push(thumbPath);
    }

    const { error } = await supabase.storage.from('property-images').remove(pathsToDelete);
    if (error) {
      console.warn('[ImageUpload] Could not delete image from Supabase storage:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[ImageUpload] Exception during image deletion:', err);
    return false;
  }
}

/**
 * Utility function to compress a legacy image URL on-demand.
 * Non-destructive: does NOT run automatically. Available for manual migration scripts.
 */
export async function optimizeExistingImageUrl(
  imageUrl: string,
  userId?: string
): Promise<UploadPropertyImageResult | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const file = new File([blob], 'legacy-migrated.webp', { type: blob.type || 'image/jpeg' });
    return uploadPropertyImage(file, userId);
  } catch {
    return null;
  }
}
