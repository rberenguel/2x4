import { Unrarrer } from "./lib/bitjs/archive/decompress.js";

export class CbrParser {
  constructor() {
    this.metadata = {
      filename: "",
      pageCount: 0,
    };
    this.imageFiles = []; // Array of { filename, blob }
    this.pageCache = new Map(); // pageIndex -> ImageBitmap
  }

  async load(file) {
    this.reset();
    this.metadata.filename = file.name;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      // bitjs 1.2.5 Unrarrer
      const unrarrer = new Unrarrer(arrayBuffer);

      this.imageFiles = [];

      unrarrer.addEventListener("extract", (e) => {
        const { filename, fileData } = e.unarchivedFile;
        console.log("Extracted:", filename); // Debug log
        // Regex to find extension, allowing for trailing garbage (common in some RARs or encoding issues)
        const match = filename.match(/\.(jpg|jpeg|png|gif|webp)/i);
        if (match) {
          // Clean filename: truncate after the extension
          // This removes the garbage characters shown in logs
          const cleanFilename = filename.substring(
            0,
            match.index + match[0].length,
          );

          console.log("Accepted:", cleanFilename, "(Original:", filename, ")");

          // Store as Blob for easy ImageBitmap creation
          // MIME type guessing
          let mime = "image/jpeg";
          const lowerName = cleanFilename.toLowerCase();
          if (lowerName.endsWith(".png")) mime = "image/png";
          if (lowerName.endsWith(".webp")) mime = "image/webp";
          if (lowerName.endsWith(".gif")) mime = "image/gif";

          const blob = new Blob([fileData], { type: mime });
          this.imageFiles.push({ filename: cleanFilename, blob });
        }
      });

      unrarrer.addEventListener("finish", () => {
        // Sort images
        // Natural sort order
        this.imageFiles.sort((a, b) => {
          return a.filename.localeCompare(b.filename, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

        this.metadata.pageCount = this.imageFiles.length;
        console.log(`CBR Loaded: ${this.imageFiles.length} images.`);
        resolve(this.metadata);
      });

      unrarrer.addEventListener("error", (e) => {
        console.error("Unrar error:", e);
        reject(new Error("Unrar failed: " + (e.msg || "Unknown error")));
      });

      unrarrer.start();
    });
  }

  async getPage(index) {
    if (index < 0 || index >= this.imageFiles.length) {
      throw new Error(`Page index ${index} out of bounds`);
    }

    if (this.pageCache.has(index)) {
      return this.pageCache.get(index);
    }

    const imgEntry = this.imageFiles[index];
    const bitmap = await createImageBitmap(imgEntry.blob);

    this.pageCache.set(index, bitmap);
    return bitmap;
  }

  reset() {
    this.pageCache.forEach((bitmap) => bitmap.close());
    this.pageCache.clear();
    this.imageFiles = [];
    this.metadata = { filename: "", pageCount: 0 };
  }
}
