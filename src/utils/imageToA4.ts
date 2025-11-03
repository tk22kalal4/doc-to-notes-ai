// A4 dimensions in pixels at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PADDING = 20; // Padding around images
const MIN_IMAGE_HEIGHT = 100; // Minimum height to ensure OCR can read it

interface ImageData {
  file: File;
  url: string;
}

interface A4Page {
  canvas: HTMLCanvasElement;
  imageCount: number;
}

/**
 * Resize image if it's too small for OCR or too large for A4
 */
const resizeImageIfNeeded = async (
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let width = img.width;
  let height = img.height;

  // If image is too small, scale it up
  if (height < MIN_IMAGE_HEIGHT) {
    const scale = MIN_IMAGE_HEIGHT / height;
    width *= scale;
    height *= scale;
  }

  // If image is too wide, scale it down to fit A4 width
  if (width > maxWidth) {
    const scale = maxWidth / width;
    width *= scale;
    height *= scale;
  }

  // If image is too tall, scale it down to fit A4 height
  if (height > maxHeight) {
    const scale = maxHeight / height;
    width *= scale;
    height *= scale;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas;
};

/**
 * Load image from File with retry logic
 */
const loadImage = (file: File, retries = 3): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let currentObjectUrl: string | null = null;
    let currentTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const cleanup = () => {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }
      if (currentObjectUrl) {
        try {
          URL.revokeObjectURL(currentObjectUrl);
        } catch (e) {
          console.error('Failed to revoke object URL:', e);
        }
        currentObjectUrl = null;
      }
    };
    
    const attemptLoad = () => {
      // Clean up previous attempt
      cleanup();
      
      attempts++;
      const img = new Image();
      
      const handleSuccess = () => {
        if (currentTimeout) {
          clearTimeout(currentTimeout);
          currentTimeout = null;
        }
        // Don't revoke URL yet - image might still need it
        resolve(img);
      };
      
      const handleFailure = (error: any) => {
        console.error(`Image load attempt ${attempts} failed for ${file.name}:`, error);
        cleanup();
        
        if (attempts < retries) {
          console.log(`Retrying... (${attempts + 1}/${retries})`);
          setTimeout(() => attemptLoad(), 500 * attempts); // Increasing delay
        } else {
          reject(new Error(`Failed to load image ${file.name} after ${retries} attempts`));
        }
      };
      
      img.onload = handleSuccess;
      img.onerror = handleFailure;
      
      // Add timeout to prevent hanging
      currentTimeout = setTimeout(() => {
        if (img.complete) return;
        console.error(`Image load timeout for ${file.name}`);
        handleFailure(new Error('Timeout'));
      }, 10000);
      
      try {
        currentObjectUrl = URL.createObjectURL(file);
        img.src = currentObjectUrl;
      } catch (err) {
        cleanup();
        reject(new Error(`Failed to create object URL for ${file.name}: ${err}`));
      }
    };
    
    attemptLoad();
  });
};

/**
 * Arrange images into A4-sized pages
 * Each page fits as many images as possible without cutting any image
 */
export const arrangeImagesIntoA4Pages = async (
  images: ImageData[]
): Promise<HTMLCanvasElement[]> => {
  if (!images || images.length === 0) {
    throw new Error('No images provided to arrange');
  }

  const pages: A4Page[] = [];
  let currentPage: A4Page | null = null;
  let currentY = PADDING;

  const maxImageWidth = A4_WIDTH_PX - (PADDING * 2);
  const maxImageHeight = A4_HEIGHT_PX - (PADDING * 2);

  const errors: string[] = [];
  let successCount = 0;

  for (let i = 0; i < images.length; i++) {
    const imageData = images[i];
    try {
      console.log(`Processing image ${i + 1}/${images.length}: ${imageData.file.name}`);
      
      const img = await loadImage(imageData.file);
      const resizedCanvas = await resizeImageIfNeeded(img, maxImageWidth, maxImageHeight);
      const imageHeight = resizedCanvas.height;

      // Validate canvas
      if (!resizedCanvas || resizedCanvas.width === 0 || resizedCanvas.height === 0) {
        throw new Error(`Invalid canvas dimensions for ${imageData.file.name}`);
      }

      // Check if we need a new page
      if (!currentPage || currentY + imageHeight + PADDING > A4_HEIGHT_PX) {
        // Create new page
        currentPage = {
          canvas: document.createElement('canvas'),
          imageCount: 0,
        };
        currentPage.canvas.width = A4_WIDTH_PX;
        currentPage.canvas.height = A4_HEIGHT_PX;

        // Fill with white background
        const ctx = currentPage.canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, A4_WIDTH_PX, A4_HEIGHT_PX);

        pages.push(currentPage);
        currentY = PADDING;
      }

      // Draw image on current page
      const ctx = currentPage.canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context for drawing');
      }
      
      const x = (A4_WIDTH_PX - resizedCanvas.width) / 2; // Center horizontally
      ctx.drawImage(resizedCanvas, x, currentY);

      currentY += imageHeight + PADDING;
      currentPage.imageCount++;
      successCount++;

      // Clean up
      URL.revokeObjectURL(img.src);
      
      console.log(`Successfully processed image ${i + 1}/${images.length}`);
    } catch (error) {
      const errorMsg = `Failed to process image ${i + 1} (${imageData.file.name}): ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      
      // Clean up on error
      try {
        URL.revokeObjectURL(imageData.url);
      } catch (e) {
        console.error('Failed to revoke object URL:', e);
      }
    }
  }

  if (errors.length > 0) {
    console.warn(`Processed ${successCount}/${images.length} images. Errors:`, errors);
    if (successCount === 0) {
      throw new Error(`Failed to process all images:\n${errors.join('\n')}`);
    }
  }

  if (pages.length === 0) {
    throw new Error('No pages were created. Please check your images and try again.');
  }

  console.log(`Successfully created ${pages.length} page(s) from ${successCount} image(s)`);
  return pages.map(page => page.canvas);
};

/**
 * Convert canvas to blob
 */
export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/jpeg', 0.95);
  });
};

/**
 * Convert canvas pages to a virtual PDF-like file
 */
export const createVirtualPDFFromPages = async (
  pages: HTMLCanvasElement[]
): Promise<File> => {
  // For now, we'll create a simple marker file that signals image mode
  // The actual page data will be passed separately
  const blob = new Blob(['IMAGE_MODE'], { type: 'application/pdf' });
  return new File([blob], 'virtual-images.pdf', { type: 'application/pdf' });
};
