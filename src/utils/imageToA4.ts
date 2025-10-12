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
 * Load image from File
 */
const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Arrange images into A4-sized pages
 * Each page fits as many images as possible without cutting any image
 */
export const arrangeImagesIntoA4Pages = async (
  images: ImageData[]
): Promise<HTMLCanvasElement[]> => {
  const pages: A4Page[] = [];
  let currentPage: A4Page | null = null;
  let currentY = PADDING;

  const maxImageWidth = A4_WIDTH_PX - (PADDING * 2);
  const maxImageHeight = A4_HEIGHT_PX - (PADDING * 2);

  for (const imageData of images) {
    const img = await loadImage(imageData.file);
    const resizedCanvas = await resizeImageIfNeeded(img, maxImageWidth, maxImageHeight);
    const imageHeight = resizedCanvas.height;

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
      const ctx = currentPage.canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, A4_WIDTH_PX, A4_HEIGHT_PX);

      pages.push(currentPage);
      currentY = PADDING;
    }

    // Draw image on current page
    const ctx = currentPage.canvas.getContext('2d')!;
    const x = (A4_WIDTH_PX - resizedCanvas.width) / 2; // Center horizontally
    ctx.drawImage(resizedCanvas, x, currentY);

    currentY += imageHeight + PADDING;
    currentPage.imageCount++;

    // Clean up
    URL.revokeObjectURL(img.src);
  }

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
