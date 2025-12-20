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
      0,
      0,
      highResCanvas.width,
      highResCanvas.height,
      0,
      0,
      this.width,
      this.height,
    );

    return finalCanvas;
  }

  /**
   * Internal: Renders element to high-res (1440x2400) canvas
   */
  async _renderToHighResCanvas(pageElement, progressInfo = null) {
    const perfStart = performance.now();
    if (typeof html2canvas === "undefined")
      throw new Error("html2canvas missing");

    const tempContainer = document.createElement("div");
    Object.assign(tempContainer.style, {
      position: "absolute",
      left: "-9999px",
      top: "0",
      width: `${this.width}px`,
      height: `${this.height}px`,
      overflow: "hidden",
      backgroundColor: "#ffffff",
    });

    const clone = pageElement.cloneNode(true);
    tempContainer.appendChild(clone);
    document.body.appendChild(tempContainer);
    const domTime = performance.now();

    // Expand all <details> elements to show hidden content
    const detailsElements = tempContainer.querySelectorAll("details");
    detailsElements.forEach((details) => {
      details.open = true;
    });

    // Hyphenate
    if (window.Hyphenopoly && window.Hyphenopoly.hyphenators) {
      const paragraphs = tempContainer.querySelectorAll("p");
      for (const p of paragraphs)
        await window.Hyphenopoly.hyphenators["en-us"](p);
    }
    const hyphenTime = performance.now();

    if (document.fonts) await document.fonts.ready;
    const fontTime = performance.now();

    // Delay to prevent "Blob not found" errors
    // TODO: Find root cause - likely image decoding or font rendering race
    await new Promise((resolve) => setTimeout(resolve, 150));
    const delayTime = performance.now();

    try {
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#ffffff",
        scale: this.scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: this.width,
        height: this.height,
        windowWidth: this.width,
        windowHeight: this.height,
        x: 0,
        y: 0,
      });
      const canvasTime = performance.now();

      this.applyGrayscale(canvas);
      const grayscaleTime = performance.now();

      // Log performance breakdown (only occasionally to avoid spam)
      if (Math.random() < 0.05) {
        console.log("Render performance (ms):", {
          dom: (domTime - perfStart).toFixed(1),
          hyphen: (hyphenTime - domTime).toFixed(1),
          fonts: (fontTime - hyphenTime).toFixed(1),
          delay: (delayTime - fontTime).toFixed(1),
          html2canvas: (canvasTime - delayTime).toFixed(1),
          grayscale: (grayscaleTime - canvasTime).toFixed(1),
          total: (grayscaleTime - perfStart).toFixed(1),
        });
      }

      return canvas;
    } finally {
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * Public: Returns a Canvas (for XTH Encoder)
   */
  async renderPageToCanvas(
    pageElement,
    fontFamily,
    styles = {},
    progressInfo = null,
  ) {
    const highResCanvas = await this._renderToHighResCanvas(
      pageElement,
      progressInfo,
    );
    const finalCanvas = this.downscaleCanvas(highResCanvas);

    // Add progress bars if requested
    if (progressInfo) {
      this.drawProgressBars(
        finalCanvas,
        progressInfo.chapterProgress,
        progressInfo.bookProgress,
        progressInfo.chapterMarkers,
      );
    }

    return finalCanvas;
  }

  /**
   * Public: Returns a JPEG Blob (for ZIP/EPUB)
   */
  async renderPageToImage(
    pageElement,
    fontFamily,
    styles = {},
    progressInfo = null,
  ) {
    const highResCanvas = await this._renderToHighResCanvas(
      pageElement,
      progressInfo,
    );
    const finalCanvas = this.downscaleCanvas(highResCanvas);

    // Add progress bars if requested
    if (progressInfo) {
      this.drawProgressBars(
        finalCanvas,
        progressInfo.chapterProgress,
        progressInfo.bookProgress,
        progressInfo.chapterMarkers,
      );
    }

    return new Promise((resolve, reject) => {
      finalCanvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Blob failed"))),
        "image/jpeg",
        this.jpegQuality,
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

  /**
   * Draw progress bars at the top of the canvas (10px from top)
   * Layout (top to bottom):
   * - Chapter markers (vertical ticks, 2px tall)
   * - Book progress bar (horizontal, 2px tall)
   * - Chapter progress bar (horizontal, 2px tall)
   *
   * @param {HTMLCanvasElement} canvas - The 480×800 canvas to draw on
   * @param {number} chapterProgress - Progress through current chapter (0.0 to 1.0)
   * @param {number} bookProgress - Progress through entire book (0.0 to 1.0)
   * @param {number[]} chapterMarkers - Array of chapter start positions (0.0 to 1.0)
   */
  drawProgressBars(canvas, chapterProgress, bookProgress, chapterMarkers = []) {
    console.log(
      "drawProgressBars called - canvas:",
      canvas.width,
      "x",
      canvas.height,
      "chapter:",
      chapterProgress,
      "book:",
      bookProgress,
      "markers:",
      chapterMarkers.length,
    );

    const ctx = canvas.getContext("2d");
    const tickHeight = 2; // Height of chapter marker ticks
    const barHeight = 2; // Height of each progress bar
    const topOffset = 12; // Start 12px from top

    // Position from top of canvas
    const ticksY = topOffset; // y=12
    const bookBarY = topOffset + tickHeight; // y=14
    const chapterBarY = topOffset + tickHeight + barHeight; // y=16

    // Chapter boundary markers - vertical ticks at the top
    if (chapterMarkers && chapterMarkers.length > 0) {
      ctx.strokeStyle = "#000000"; // Pure black
      ctx.lineWidth = 1;

      for (const marker of chapterMarkers) {
        const x = Math.round(canvas.width * marker);
        ctx.beginPath();
        ctx.moveTo(x, ticksY);
        ctx.lineTo(x, ticksY + tickHeight);
        ctx.stroke();
      }
    }

    // Book progress bar (below ticks) - lighter gray
    ctx.fillStyle = "#586e75"; // Solarized base01 (gray)
    ctx.fillRect(0, bookBarY, canvas.width * bookProgress, barHeight);

    // Chapter progress bar (below book bar) - darker gray
    ctx.fillStyle = "#073642"; // Solarized base02 (darker)
    ctx.fillRect(0, chapterBarY, canvas.width * chapterProgress, barHeight);

    // Draw progress dots indicator in bottom right corner
    this.drawProgressDots(canvas, bookProgress);

    console.log(
      "Progress bars drawn at top (10px offset) - book bar width:",
      canvas.width * bookProgress,
      "chapter bar width:",
      canvas.width * chapterProgress,
    );
  }

  /**
   * Draw a 3x3 pixel progress indicator in the bottom right corner
   * Shows book progress in 10% steps using a dice-like pattern
   *
   * Pattern (0-indexed coordinates):
   * 0-10%:  Empty
   * 10-20%: 1 dot - center [1,1]
   * 20-30%: 2 dots - diagonal [0,0], [2,2]
   * 30-40%: 3 dots - diagonal + center [0,0], [1,1], [2,2]
   * 40-50%: 4 dots - corners [0,0], [0,2], [2,0], [2,2]
   * 50-60%: 5 dots - corners + center [0,0], [0,2], [1,1], [2,0], [2,2]
   * 60-70%: 6 dots - sides [0,0], [0,2], [1,0], [1,2], [2,0], [2,2]
   * 70-80%: 7 dots - sides + center [0,0], [0,2], [1,0], [1,1], [1,2], [2,0], [2,2]
   * 80-90%: 8 dots - all edges [0,0], [0,1], [0,2], [1,0], [1,2], [2,0], [2,1], [2,2]
   * 90-100%: 9 dots - all filled (all positions)
   *
   * @param {HTMLCanvasElement} canvas - The 480×800 canvas to draw on
   * @param {number} bookProgress - Progress through entire book (0.0 to 1.0)
   */
  drawProgressDots(canvas, bookProgress) {
    const ctx = canvas.getContext("2d");

    // Position in bottom-right corner with padding (accounting for bezel)
    const rightOffset = 12; // 12px from right edge
    const bottomOffset = 12; // 12px from bottom edge
    const gridSize = 3;

    // Calculate starting position (top-left of 3x3 grid)
    const startX = canvas.width - rightOffset - gridSize;
    const startY = canvas.height - bottomOffset - gridSize;

    // Calculate progress segment (0-9)
    const segment = Math.min(9, Math.floor(bookProgress * 10));

    // Define dot patterns for each segment (dice-like)
    const patterns = [
      [], // 0-10%: empty
      [[1, 1]], // 10-20%: center
      [[0, 0], [2, 2]], // 20-30%: diagonal
      [[0, 0], [1, 1], [2, 2]], // 30-40%: diagonal + center
      [[0, 0], [0, 2], [2, 0], [2, 2]], // 40-50%: corners
      [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], // 50-60%: corners + center
      [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]], // 60-70%: sides
      [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 2]], // 70-80%: sides + center
      [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]], // 80-90%: edges
      [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], // 90-100%: all
    ];

    // Draw the dots
    ctx.fillStyle = "#000000"; // Pure black
    const pattern = patterns[segment];
    for (const [row, col] of pattern) {
      ctx.fillRect(startX + col, startY + row, 1, 1);
    }
  }
}
