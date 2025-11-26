/**
 * Renderer Module
 * Converts paginated HTML to images using html2canvas
 */

export class Renderer {
  constructor(fontEmbedder) {
    this.fontEmbedder = fontEmbedder;
    this.width = 480;
    this.height = 800;
    this.scale = 3; // 3x for antialiasing
    this.jpegQuality = 0.85;
  }

  /**
   * Update JPEG quality setting
   * @param {number} quality - Quality from 0 to 1
   */
  setJPEGQuality(quality) {
    this.jpegQuality = quality;
  }

  /**
   * Render a page element to JPEG blob
   * @param {HTMLElement} pageElement - The page container element
   * @param {string} fontFamily - Font family being used
   * @param {Object} styles - Additional styles object
   * @returns {Promise<Blob>}
   */
  async renderPageToImage(pageElement, fontFamily, styles = {}) {
    try {
      if (typeof html2canvas === "undefined") {
        throw new Error("html2canvas library not loaded");
      }

      // Create a temporary container in the document for html2canvas
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = `${this.width}px`;
      tempContainer.style.height = `${this.height}px`;
      tempContainer.style.overflow = "hidden";
      tempContainer.style.backgroundColor = "#ffffff";

      // Clone the page element
      const clone = pageElement.cloneNode(true);
      tempContainer.appendChild(clone);
      document.body.appendChild(tempContainer);

      // Hyphenate the cloned content
      if (window.Hyphenopoly && window.Hyphenopoly.hyphenators) {
        const paragraphs = tempContainer.querySelectorAll("p");
        for (const p of paragraphs) {
          await window.Hyphenopoly.hyphenators["en-us"](p);
        }
      }

      // Wait for fonts to be ready
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Small delay for rendering
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Render with html2canvas at high resolution
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#ffffff",
        scale: this.scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: this.width,
        height: this.height,
      });

      // Remove temp container
      document.body.removeChild(tempContainer);

      // Apply grayscale
      this.applyGrayscale(canvas);

      // Convert to JPEG blob (downscaled)
      const blob = await this.canvasToBlob(canvas);

      return blob;
    } catch (error) {
      console.error("Error rendering page to image:", error);
      throw error;
    }
  }

  /**
   * Apply grayscale filter to canvas
   * @param {HTMLCanvasElement} canvas
   */
  applyGrayscale(canvas) {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale using luminosity method
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray; // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      // Alpha (data[i + 3]) remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Convert canvas to blob (downscaled to target resolution)
   * @param {HTMLCanvasElement} highResCanvas
   * @returns {Promise<Blob>}
   */
  async canvasToBlob(highResCanvas) {
    // Create final canvas at target resolution
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = this.width;
    finalCanvas.height = this.height;

    const ctx = finalCanvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    // Downscale with high quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw downscaled image
    ctx.drawImage(
      highResCanvas,
      0,
      0,
      highResCanvas.width,
      highResCanvas.height,
      0,
      0,
      this.width,
      this.height,
    );

    // Convert to blob
    return new Promise((resolve, reject) => {
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        },
        "image/jpeg",
        this.jpegQuality,
      );
    });
  }

  /**
   * Batch render multiple pages
   * @param {Array} pageElements - Array of page elements
   * @param {string} fontFamily
   * @param {Object} styles
   * @param {Function} progressCallback - Called with (current, total)
   * @returns {Promise<Array<Blob>>}
   */
  async renderPages(pageElements, fontFamily, styles, progressCallback) {
    const blobs = [];
    const total = pageElements.length;

    for (let i = 0; i < total; i++) {
      if (progressCallback) {
        progressCallback(i + 1, total);
      }

      const blob = await this.renderPageToImage(
        pageElements[i],
        fontFamily,
        styles,
      );
      blobs.push(blob);

      // Small delay to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return blobs;
  }

  /**
   * Test render a single page (for debugging)
   * @param {HTMLElement} pageElement
   * @param {string} fontFamily
   * @param {Object} styles
   * @returns {Promise<string>} Data URL of rendered image
   */
  async testRender(pageElement, fontFamily, styles) {
    const blob = await this.renderPageToImage(pageElement, fontFamily, styles);
    return URL.createObjectURL(blob);
  }
}
