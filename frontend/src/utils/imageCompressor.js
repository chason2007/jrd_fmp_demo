/**
 * Compresses an image File or Blob on the client side using a canvas.
 * Scales the image down to a maximum dimension of 1200px (preserving aspect ratio)
 * and exports it as a JPEG with 0.8 quality.
 */
export function compressImage(file, maxDimension = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    // If it's not an image file, skip compression
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Skip compression if the image is already smaller than the max dimension
        if (width <= maxDimension && height <= maxDimension) {
          return resolve(file);
        }

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // Re-create a File object from the blob to preserve filename
            const compressedFile = new File([blob], file.name || 'photo.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file); // fallback to original file on error
    };
    reader.onerror = () => resolve(file); // fallback to original file on error
  });
}
