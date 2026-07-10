/**
 * Compresses an image file for upload or PDF embedding using an offscreen canvas.
 * Reduces the image dimensions to a max width of 500px and returns a JPEG data URL.
 * 
 * @param {File} file - The image file to compress
 * @returns {Promise<string|null>} - A promise that resolves to the compressed JPEG data URL or null on error
 */
export async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize while maintaining aspect ratio
        if (width > 500) { 
          height = (height * 500) / width; 
          width = 500; 
        }
        
        canvas.width = width; 
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        
        // Return compressed JPEG data URL
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = () => resolve(null);
    };
    reader.onerror = () => resolve(null);
  });
}
