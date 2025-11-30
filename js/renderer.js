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

  setJPEGQuality(quality) {
    this.jpegQuality = quality;
  }

  /**
   * Helper: Downscales a high-res canvas to 480x800
   */
  downscaleCanvas(highResCanvas) {
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = this.width;
    finalCanvas.height = this.height;

    const ctx = finalCanvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      highResCanvas,
      0, 0, highResCanvas.width, highResCanvas.height,
      0, 0, this.width, this.height
    );

    return finalCanvas;
  }

  /**
   * Internal: Renders element to high-res (1440x2400) canvas
   */
  async _renderToHighResCanvas(pageElement) {
    if (typeof html2canvas === "undefined") throw new Error("html2canvas missing");

    const tempContainer = document.createElement("div");
    Object.assign(tempContainer.style, {
      position: "absolute", left: "-9999px", top: "0",
      width: `${this.width}px`, height: `${this.height}px`,
      overflow: "hidden", backgroundColor: "#ffffff"
    });

    const clone = pageElement.cloneNode(true);
    tempContainer.appendChild(clone);
    document.body.appendChild(tempContainer);

    // Hyphenate
    if (window.Hyphenopoly && window.Hyphenopoly.hyphenators) {
      const paragraphs = tempContainer.querySelectorAll("p");
      for (const p of paragraphs) await window.Hyphenopoly.hyphenators["en-us"](p);
    }

    if (document.fonts) await document.fonts.ready;
    
    // Increased delay to help prevent "Blob not found" errors
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#ffffff",
        scale: this.scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: this.width,
        height: this.height,
      });
      
      this.applyGrayscale(canvas);
      return canvas;
    } finally {
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * Public: Returns a Canvas (for XTH Encoder)
   */
  async renderPageToCanvas(pageElement, fontFamily, styles = {}) {
    const highResCanvas = await this._renderToHighResCanvas(pageElement);
    return this.downscaleCanvas(highResCanvas);
  }

  /**
   * Public: Returns a JPEG Blob (for ZIP/EPUB)
   */
  async renderPageToImage(pageElement, fontFamily, styles = {}) {
    const highResCanvas = await this._renderToHighResCanvas(pageElement);
    const finalCanvas = this.downscaleCanvas(highResCanvas);
    
    return new Promise((resolve, reject) => {
      finalCanvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Blob failed")),
        "image/jpeg",
        this.jpegQuality
      );
    });
  }

  applyGrayscale(canvas) {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
  }
}