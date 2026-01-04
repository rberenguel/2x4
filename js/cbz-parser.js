/**
 * CbzParser Module
 * Handles loading, unzipping, and extracting images from CBZ files.
 */
export class CbzParser {
  constructor() {
    this.zip = null;
    this.files = [];
    this.metadata = {
      filename: "",
      pageCount: 0,
    };
    this.imageCache = new Map(); // Cache for ImageBitmaps
  }

  /**
   * Loads a CBZ file and prepares it for reading.
   * @param {File} file - The CBZ file object
   * @returns {Promise<Object>} - Metadata including page count and filename
   */
  async load(file) {
    this.reset();
    this.metadata.filename = file.name;

    try {
      // JSZip should be available globally via script tag in index.html/cbz.html
      // If it's not a module, we depend on window.JSZip
      const jszip = new JSZip();
      this.zip = await jszip.loadAsync(file);

      // Filter for image files and sort them
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".bmp",
      ];

      this.files = Object.keys(this.zip.files)
        .filter((filename) => {
          const lowerName = filename.toLowerCase();
          // Exclude system files and directories
          if (
            filename.startsWith("__MACOSX/") ||
            filename.includes("/.") ||
            filename.includes("Thumbs.db")
          ) {
            return false;
          }
          if (this.zip.files[filename].dir) {
            return false;
          }
          return imageExtensions.some((ext) => lowerName.endsWith(ext));
        })
        .sort((a, b) => {
          // Natural sort for filenames (e.g., page1, page2, page10)
          return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

      this.metadata.pageCount = this.files.length;

      return this.metadata;
    } catch (error) {
      console.error("Error loading CBZ file:", error);
      throw new Error("Failed to load CBZ file: " + error.message);
    }
  }

  /**
   * Retrieves a page image by index.
   * @param {number} index - Page index (0-based)
   * @returns {Promise<ImageBitmap>} - The image as an ImageBitmap
   */
  async getPage(index) {
    if (index < 0 || index >= this.files.length) {
      throw new Error(`Page index ${index} out of bounds`);
    }

    // Check cache first
    if (this.imageCache.has(index)) {
      return this.imageCache.get(index);
    }

    const filename = this.files[index];
    const fileData = await this.zip.files[filename].async("blob");

    // precise memory management might require us to use createImageBitmap
    // and close it later, but for now we let GC handle it unless we implement explicit cleanup
    const bitmap = await createImageBitmap(fileData);

    // Cache management: keep recent 20 pages?
    // For now, simpler cache to avoid decoding same page repeatedly during edits
    // But we should be careful with memory.

    // Simple MRU or something could be good, but let's just cache and clear if needed?
    // Let's implement a simple size limit for the cache
    if (this.imageCache.size > 20) {
      // Remove the first key (oldest inserted if Map preserves order which it does)
      const firstKey = this.imageCache.keys().next().value;
      const oldBitmap = this.imageCache.get(firstKey);
      oldBitmap.close(); // Important to release memory
      this.imageCache.delete(firstKey);
    }

    this.imageCache.set(index, bitmap);
    return bitmap;
  }

  /**
   * Clears all data and cache.
   */
  reset() {
    this.zip = null;
    this.files = [];
    this.metadata = { filename: "", pageCount: 0 };
    // Close all bitmaps
    for (const bitmap of this.imageCache.values()) {
      if (bitmap && typeof bitmap.close === "function") {
        bitmap.close();
      }
    }
    this.imageCache.clear();
  }
}
