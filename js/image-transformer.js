/**
 * ImageTransformer Module
 * Handles geometric and color transformations on images.
 */
export class ImageTransformer {
  static async process(sourceImage, config) {
    // Create a canvas large enough for the rotated image
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const angle = config.rotation || 0;
    const rads = (angle * Math.PI) / 180;

    let width = sourceImage.width;
    let height = sourceImage.height;

    // Calculate new dimensions after rotation
    if (angle === 90 || angle === 270) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    // Draw rotated image
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rads);
    ctx.drawImage(sourceImage, -width / 2, -height / 2);
    ctx.restore();

    // Apply color filters
    // We can use ctx.filter for brightness/contrast BEFORE drawing, but it's often faster/easier
    // to do it via pixel manipulation if we want precise control or if we need grayscale anyway.
    // However, standard canvas filter strings are GPU accelerated.

    // Since we need to get raw pixels for grayscale conversion anyway, let's do it in one pass if possible.
    // But for preview speed, CSS filters (on the canvas element) are best.
    // For actual export, we need to bake them in.
    // I will bake them in here.

    // 2. Brightness/Contrast/Threshold
    // const ctx = canvas.getContext('2d'); // ctx is already defined
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const brightness =
      (config.brightness !== undefined ? config.brightness : 100) / 100; // 0 to 2
    const contrast =
      (config.contrast !== undefined ? config.contrast : 100) / 100; // 0 to 2

    // Threshold Mode
    if (config.bwMode) {
      const thresh = config.bwThreshold || 128;
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        // Luminance
        let val = 0.299 * r + 0.587 * g + 0.114 * b;

        // Apply brightness/contrast BEFORE threshold?
        // Or replace contrast with threshold?
        // Typically Threshold IS the contrast operation for B&W.
        // But let's allow brightness to shift the values before threshold.
        if (brightness !== 1) {
          // If brightness is not default (100%)
          val *= brightness;
        }

        // Threshold
        val = val >= thresh ? 255 : 0;

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
    } else {
      // Standard B/C
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply brightness
        if (brightness !== 1) {
          r *= brightness;
          g *= brightness;
          b *= brightness;
        }

        // Apply contrast
        if (contrast !== 1) {
          // The formula for contrast is often: output = (input - 128) * contrast_factor + 128
          // Where contrast_factor is derived from the contrast percentage.
          // Let's map config.contrast (0-200) to a factor.
          // If config.contrast is 100 (default), factor is 1.
          // If config.contrast is 0, factor is 0.
          // If config.contrast is 200, factor is 2.
          // So, contrast variable (0-2) is already our factor.

          r = (r - 128) * contrast + 128;
          g = (g - 128) * contrast + 128;
          b = (b - 128) * contrast + 128;
        }

        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  static scale(sourceCanvas, targetWidth, targetHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    // Fill with white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Scale "Contain" - maintain aspect ratio, fit within box
    const scale = Math.min(
      targetWidth / sourceCanvas.width,
      targetHeight / sourceCanvas.height,
    );
    const w = sourceCanvas.width * scale;
    const h = sourceCanvas.height * scale;
    const x = (targetWidth - w) / 2;
    const y = (targetHeight - h) / 2;

    ctx.drawImage(sourceCanvas, x, y, w, h);
    return canvas;
  }

  /**
   * Automatically trims uniform borders (usually white or black) from the image.
   */
  static autoTrim(sourceCanvas, tolerance = 30) {
    const ctx = sourceCanvas.getContext("2d");
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Helper to check pixel difference
    const isSame = (i, refR, refG, refB) => {
      return (
        Math.abs(data[i] - refR) <= tolerance &&
        Math.abs(data[i + 1] - refG) <= tolerance &&
        Math.abs(data[i + 2] - refB) <= tolerance
      );
    };

    // Get background color from top-left pixel
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    let top = 0,
      bottom = h,
      left = 0,
      right = w;

    // Scan Top
    for (let y = 0; y < h; y++) {
      let rowEmpty = true;
      for (let x = 0; x < w; x += 4) {
        // Sample every 4th pixel for speed
        const i = (y * w + x) * 4;
        if (!isSame(i, bgR, bgG, bgB)) {
          rowEmpty = false;
          break;
        }
      }
      if (!rowEmpty) {
        top = y;
        break;
      }
    }

    // Scan Bottom
    for (let y = h - 1; y >= top; y--) {
      let rowEmpty = true;
      for (let x = 0; x < w; x += 4) {
        const i = (y * w + x) * 4;
        if (!isSame(i, bgR, bgG, bgB)) {
          rowEmpty = false;
          break;
        }
      }
      if (!rowEmpty) {
        bottom = y + 1;
        break;
      }
    }

    // Scan Left
    for (let x = 0; x < w; x++) {
      let colEmpty = true;
      for (let y = top; y < bottom; y += 4) {
        const i = (y * w + x) * 4;
        if (!isSame(i, bgR, bgG, bgB)) {
          colEmpty = false;
          break;
        }
      }
      if (!colEmpty) {
        left = x;
        break;
      }
    }

    // Scan Right
    for (let x = w - 1; x >= left; x--) {
      let colEmpty = true;
      for (let y = top; y < bottom; y += 4) {
        const i = (y * w + x) * 4;
        if (!isSame(i, bgR, bgG, bgB)) {
          colEmpty = false;
          break;
        }
      }
      if (!colEmpty) {
        right = x + 1;
        break;
      }
    }

    const cropW = right - left;
    const cropH = bottom - top;

    // Safety check: don't crop if empty or too small
    if (cropW < 50 || cropH < 50) return sourceCanvas;

    const newCanvas = document.createElement("canvas");
    newCanvas.width = cropW;
    newCanvas.height = cropH;
    const newCtx = newCanvas.getContext("2d");
    newCtx.drawImage(sourceCanvas, left, top, cropW, cropH, 0, 0, cropW, cropH);

    return newCanvas;
  }

  /**
   * Crops image by percentage
   * @param {HTMLCanvasElement} canvas
   * @param {Object} trims { top: %, right: %, bottom: %, left: % }
   */
  static manualCrop(canvas, trims) {
    const w = canvas.width;
    const h = canvas.height;

    const topPx = Math.floor((h * (trims.top || 0)) / 100);
    const bottomPx = Math.floor((h * (trims.bottom || 0)) / 100);
    const leftPx = Math.floor((w * (trims.left || 0)) / 100);
    const rightPx = Math.floor((w * (trims.right || 0)) / 100);

    const cropW = w - leftPx - rightPx;
    const cropH = h - topPx - bottomPx;

    if (cropW <= 0 || cropH <= 0) return canvas;

    const newCanvas = document.createElement("canvas");
    newCanvas.width = cropW;
    newCanvas.height = cropH;
    const ctx = newCanvas.getContext("2d");

    ctx.drawImage(canvas, leftPx, topPx, cropW, cropH, 0, 0, cropW, cropH);
    return newCanvas;
  }
}
