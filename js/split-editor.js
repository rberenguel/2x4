/**
 * SplitEditor Module
 * Manages split lines and calculates output regions.
 */
export class SplitEditor {
  constructor() {
    // We might want state here if we support dragging,
    // but for now we can just use static helper methods or simple instance methods.
  }

  /**
   * Calculates crop regions based on split configuration.
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {Object} config - Page configuration { verticalSplits: [0.5], horizontalSplits: [] }
   * @returns {Array} Array of regions {x, y, w, h}
   */
  static calculateRegions(width, height, config) {
    const regions = [];

    // Default to no splits (whole image)
    let vSplits = [0, ...(config.verticalSplits || []), 1];
    let hSplits = [0, ...(config.horizontalSplits || []), 1];

    // Sort just in case
    vSplits.sort((a, b) => a - b);
    hSplits.sort((a, b) => a - b);

    // Create grid of regions
    // Reading order: usually Right-to-Left (Manga) or Left-to-Right (Western).
    // Vertical splits usually mean columns.
    // If RTL (Manga), we iterate columns right to left.

    const rtl = config.rtl !== false; // Default to RTL for manga? Or make it an option.

    // Horizontal rows (Top to Bottom)
    for (let r = 0; r < hSplits.length - 1; r++) {
      const tempRowRegions = [];
      const y1 = hSplits[r] * height;
      const y2 = hSplits[r + 1] * height;
      const h = y2 - y1;

      // Vertical columns
      for (let c = 0; c < vSplits.length - 1; c++) {
        const x1 = vSplits[c] * width;
        const x2 = vSplits[c + 1] * width;
        const w = x2 - x1;

        tempRowRegions.push({ x: x1, y: y1, w, h });
      }

      if (rtl) {
        tempRowRegions.reverse();
      }

      regions.push(...tempRowRegions);
    }

    return regions;
  }

  /**
   * Draws split lines on the canvas overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   * @param {Object} config
   */
  static drawOverlay(ctx, width, height, config) {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;

    // Vertical Splits (Red)
    if (config.verticalSplits) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
      ctx.beginPath();
      config.verticalSplits.forEach((pos) => {
        const x = pos * width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      });
      ctx.stroke();
    }

    // Horizontal Splits (Blue)
    if (config.horizontalSplits) {
      ctx.strokeStyle = "rgba(0, 0, 255, 0.8)";
      ctx.beginPath();
      config.horizontalSplits.forEach((pos) => {
        const y = pos * height;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      });
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Auto-detects split configuration based on aspect ratio.
   * @param {number} width
   * @param {number} height
   * @returns {Object} Config object with splits
   */
  static autoDetect(width, height) {
    const aspect = width / height;
    // Target roughly 0.6 (480/800)

    if (aspect > 1.2) {
      // Landscape, likely spread -> 2 pages
      // 50% split
      return { verticalSplits: [0.5], horizontalSplits: [] };
    }

    // Portrait, likely single page
    return { verticalSplits: [], horizontalSplits: [] };
  }
}
