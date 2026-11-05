import { createClient } from '@/lib/supabase/client';

const MAX_DIMENSION = 800;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ProcessedImage {
  blob: Blob;
  ext: 'webp' | 'jpeg';
  contentType: 'image/webp' | 'image/jpeg';
}

/**
 * Resizes an image file in the browser using HTML5 Canvas and exports it as WebP Blob.
 * If WebP encoding is not supported by the browser, falls back to JPEG (0.85).
 */
export async function resizeImageToWebP(file: File): Promise<ProcessedImage> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Formato no permitido. Solo se aceptan imágenes JPEG, PNG o WebP.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('El archivo excede el límite máximo de 2 MB.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo inicializar el procesador de imágenes.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Attempt to encode as image/webp
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob && webpBlob.type === 'image/webp') {
            resolve({
              blob: webpBlob,
              ext: 'webp',
              contentType: 'image/webp',
            });
            return;
          }

          // Fallback to image/jpeg if webp encoding is unsupported
          canvas.toBlob(
            (jpegBlob) => {
              if (jpegBlob) {
                resolve({
                  blob: jpegBlob,
                  ext: 'jpeg',
                  contentType: 'image/jpeg',
                });
              } else {
                reject(new Error('No se pudo procesar la imagen seleccionada.'));
              }
            },
            'image/jpeg',
            0.85
          );
        },
        'image/webp',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Uploads an image to Supabase Storage bucket 'store-assets'.
 * Path format: {store_id}/{uuid}.{ext}
 */
export async function uploadStoreAsset(storeId: string, file: File): Promise<string> {
  const { blob, ext, contentType } = await resizeImageToWebP(file);
  const supabase = createClient();
  const fileUuid = crypto.randomUUID();
  const filePath = `${storeId}/${fileUuid}.${ext}`;

  const { error } = await supabase.storage
    .from('store-assets')
    .upload(filePath, blob, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Error al subir la imagen al almacenamiento.');
  }

  const { data } = supabase.storage.from('store-assets').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Safely deletes a previously stored image asset from 'store-assets' bucket if applicable.
 */
export async function deleteStoreAsset(url: string | null | undefined): Promise<void> {
  if (!url) return;

  try {
    const supabase = createClient();
    const marker = '/storage/v1/object/public/store-assets/';
    const index = url.indexOf(marker);

    if (index !== -1) {
      const filePath = url.substring(index + marker.length);
      if (filePath) {
        await supabase.storage.from('store-assets').remove([filePath]);
      }
    }
  } catch {
    // Non-blocking cleanup
  }
}
