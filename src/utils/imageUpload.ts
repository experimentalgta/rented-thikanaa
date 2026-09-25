import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ProcessedImage {
  id: string;
  url: string;
  caption: string;
  is_cover: boolean;
  file?: File;
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Downscales dimensions to max 1280px while preserving aspect ratio.
 * Outputs a lightweight, crisp JPEG blob (~150-250KB).
 */
export async function compressImage(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context not available'));
        }

        // Draw image smoothly onto canvas
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              // Fallback to dataUrl if toBlob fails
              resolve({ blob: new Blob([dataUrl], { type: 'image/jpeg' }), dataUrl });
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image to Supabase Storage (bucket: 'property-images').
 * If upload fails or Supabase is not reachable, falls back to the compressed Data URL.
 */
export async function uploadPropertyImage(file: File, userId?: string): Promise<string> {
  const { blob, dataUrl } = await compressImage(file);

  if (!supabase || !isSupabaseConfigured) {
    return dataUrl;
  }

  try {
    const fileExt = 'jpg';
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = `${Date.now()}-${randomId}.${fileExt}`;
    const filePath = `listings/${userId || 'anon'}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('property-images')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase storage upload failed, using optimized local data URL:', uploadError.message);
      return dataUrl;
    }

    const { data: publicData } = supabase.storage
      .from('property-images')
      .getPublicUrl(filePath);

    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }

    return dataUrl;
  } catch (err) {
    console.warn('Error during image upload, using fallback data URL:', err);
    return dataUrl;
  }
}
