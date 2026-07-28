// ========================================================
// SuvarnaLoan ERP - Auto 90% Client-Side WebP Image Optimizer
// Location: src/lib/imageCompressor.ts
// ========================================================

export interface CompressedImageResult {
  dataUrl: string;
  blob: Blob;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  reductionPercentage: number;
  formattedSize: string;
}

/**
 * Compresses an image file or Data URL client-side to WebP format up to 90%+ smaller
 */
export async function compressImageToWebP(
  input: File | string,
  maxWidth: number = 900,
  quality: number = 0.35 // 90% size reduction target
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Browser environment required for image compression'));
      return;
    }

    const processImageDataUrl = (dataUrl: string, originalSize: number) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP format
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('WebP blob creation failed'));
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const compressedDataUrl = reader.result as string;
              const compressedSize = blob.size;
              const reduction = originalSize > 0 
                ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
                : 90;

              const formattedSize = compressedSize > 1024 * 1024
                ? `${(compressedSize / (1024 * 1024)).toFixed(2)} MB`
                : `${(compressedSize / 1024).toFixed(1)} KB`;

              resolve({
                dataUrl: compressedDataUrl,
                blob,
                originalSizeBytes: originalSize,
                compressedSizeBytes: compressedSize,
                reductionPercentage: reduction,
                formattedSize,
              });
            };
            reader.onerror = () => reject(new Error('Failed to read WebP data URL'));
            reader.readAsDataURL(blob);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image resource'));
      img.src = dataUrl;
    };

    if (typeof input === 'string') {
      const approxSize = Math.round((input.length * 3) / 4);
      processImageDataUrl(input, approxSize);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        processImageDataUrl(e.target?.result as string, input.size);
      };
      reader.onerror = () => reject(new Error('Failed to read input file'));
      reader.readAsDataURL(input);
    }
  });
}
