/**
 * Main Application Module
 * Wires everything together and handles UI interactions
 */

import { EPUBParser } from "./epub-parser.js";
import { XTHEncoder } from "./xth-encoder.js";
import { XTCBuilder } from "./xtc-builder.js";
import { FontEmbedder } from "./font-embed.js";
import { Paginator } from "./paginator.js";
import { Renderer } from "./renderer.js";
import { EPUBBuilder } from "./epub-builder.js";

class EPUBConverterApp {
  constructor() {
    this.parser = new EPUBParser();
    this.fontEmbedder = new FontEmbedder();
    this.paginator = new Paginator("#virtual-device");
    this.renderer = new Renderer(this.fontEmbedder);
    this.epubBuilder = new EPUBBuilder();
    this.xthEncoder = new XTHEncoder();
    this.xtcBuilder = new XTCBuilder();

    this.epubLoaded = false;
    this.isConverting = false;

    this.initializeUI();
    this.attachEventListeners();
    this.preloadFonts();
  }

  initializeUI() {
    this.elements = {
      epubUpload: document.getElementById("epub-upload"),
      fileInfo: document.getElementById("file-info"),
      fontFamily: document.getElementById("font-family"),
      fontSize: document.getElementById("font-size"),
      fontSizeValue: document.getElementById("font-size-value"),
      lineHeight: document.getElementById("line-height"),
      lineHeightValue: document.getElementById("line-height-value"),
      jpegQuality: document.getElementById("jpeg-quality"),
      jpegQualityValue: document.getElementById("jpeg-quality-value"),
      customCSS: document.getElementById("custom-css"),
      applyCSSBtn: document.getElementById("apply-css-btn"),
      outputFormat: document.getElementById("output-format"),
      limitType: document.getElementById("limit-type"),
      limitValue: document.getElementById("limit-value"),
      limitValueDisplay: document.getElementById("limit-value-display"),
      limitValueGroup: document.getElementById("limit-value-group"),
      convertBtn: document.getElementById("convert-btn"),
      progressContainer: document.getElementById("progress-container"),
      progressFill: document.getElementById("progress-fill"),
      progressText: document.getElementById("progress-text"),
      chapterTitle: document.getElementById("chapter-title"),
      pageInfo: document.getElementById("page-info"),
      prevChapterBtn: document.getElementById("prev-chapter-btn"),
      prevPageBtn: document.getElementById("prev-page-btn"),
      nextPageBtn: document.getElementById("next-page-btn"),
      nextChapterBtn: document.getElementById("next-chapter-btn"),
    };
  }

  attachEventListeners() {
    this.elements.epubUpload.addEventListener("change", (e) => this.handleFileUpload(e));
    this.elements.fontFamily.addEventListener("change", () => this.updatePaginatorSettings());
    this.elements.fontSize.addEventListener("input", (e) => {
      this.elements.fontSizeValue.textContent = e.target.value;
      this.updatePaginatorSettings();
    });
    this.elements.lineHeight.addEventListener("input", (e) => {
      this.elements.lineHeightValue.textContent = e.target.value;
      this.updatePaginatorSettings();
    });
    this.elements.jpegQuality.addEventListener("input", (e) => {
      this.elements.jpegQualityValue.textContent = e.target.value;
      this.renderer.setJPEGQuality(e.target.value / 100);
    });
    this.elements.applyCSSBtn.addEventListener("click", () => this.updatePaginatorSettings());
    this.elements.limitType.addEventListener("change", (e) => {
      const limitType = e.target.value;
      this.elements.limitValueGroup.style.display = limitType === "none" ? "none" : "block";
      if (limitType === "chapters" && this.epubLoaded) {
        this.elements.limitValue.max = this.parser.spine.length;
      } else if (limitType === "pages") {
        this.elements.limitValue.max = 100;
      }
    });
    this.elements.limitValue.addEventListener("input", (e) => {
      this.elements.limitValueDisplay.textContent = e.target.value;
    });
    this.elements.prevChapterBtn.addEventListener("click", () => this.goToPrevChapter());
    this.elements.prevPageBtn.addEventListener("click", () => this.goToPrevPage());
    this.elements.nextPageBtn.addEventListener("click", () => this.goToNextPage());
    this.elements.nextChapterBtn.addEventListener("click", () => this.goToNextChapter());
    this.elements.convertBtn.addEventListener("click", () => this.startConversion());
  }

  async preloadFonts() {
    try {
      await this.fontEmbedder.preloadAllFonts();
      console.log("All fonts preloaded");
    } catch (error) {
      console.warn("Failed to preload fonts:", error);
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      this.elements.fileInfo.textContent = "Loading EPUB...";
      this.elements.fileInfo.classList.remove("hidden");
      const info = await this.parser.load(file);
      this.elements.fileInfo.textContent = `Loaded: ${info.metadata.title} by ${info.metadata.creator} (${info.chapterCount} chapters)`;
      this.elements.convertBtn.disabled = false;
      this.epubLoaded = true;
      await this.loadChapter(0);
    } catch (error) {
      console.error("Error loading EPUB:", error);
      this.elements.fileInfo.textContent = `Error: ${error.message}`;
      this.elements.fileInfo.style.color = "#dc322f";
    }
  }

  async loadChapter(index) {
    try {
      if (index < 0 || index >= this.parser.spine.length) return;
      const html = await this.parser.getChapterContent(index);
      const pageCount = await this.paginator.loadChapter(html, index);
      this.updateChapterInfo(index, pageCount);
      this.updateNavigationButtons();
      await this.updateImagePreview();
    } catch (error) {
      console.error("Error loading chapter:", error);
      this.elements.chapterTitle.textContent = `Error loading chapter: ${error.message}`;
    }
  }

  updateChapterInfo(chapterIndex, pageCount) {
    const title = this.parser.getChapterTitle(chapterIndex);
    this.elements.chapterTitle.textContent = title;
    const pageInfo = this.paginator.getPageInfo();
    this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.parser.spine.length}`;
  }

  updateNavigationButtons() {
    const pageInfo = this.paginator.getPageInfo();
    this.elements.prevPageBtn.disabled = !pageInfo.hasPrevPage;
    this.elements.nextPageBtn.disabled = !pageInfo.hasNextPage;
    this.elements.prevChapterBtn.disabled = pageInfo.currentChapter <= 1;
    this.elements.nextChapterBtn.disabled = pageInfo.currentChapter >= this.parser.spine.length;
  }

  async updateImagePreview() {
    const previewContainer = document.querySelector(".preview-viewport");
    previewContainer.innerHTML = '<div class="preview-placeholder"><p>Rendering...</p></div>';
    try {
      const pageElement = this.paginator.getCurrentPageElement();
      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };
      const blob = await this.renderer.renderPageToImage(pageElement, settings.fontFamily, settings);
      const imageUrl = URL.createObjectURL(blob);
      previewContainer.innerHTML = `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: contain;" />`;
      setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
    } catch (error) {
      console.error("Error updating preview:", error);
      previewContainer.innerHTML = '<div class="preview-placeholder"><p>Preview error</p></div>';
    }
  }

  async updatePaginatorSettings() {
    if (!this.epubLoaded) return;
    const settings = {
      fontFamily: this.elements.fontFamily.value,
      fontSize: parseInt(this.elements.fontSize.value),
      lineHeight: parseFloat(this.elements.lineHeight.value),
      customCSS: this.elements.customCSS.value,
    };
    this.paginator.updateSettings(settings);
    await this.loadChapter(this.paginator.currentChapterIndex);
  }

  async goToPrevPage() {
    if (this.paginator.prevPage()) {
      const pageInfo = this.paginator.getPageInfo();
      this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.parser.spine.length}`;
      this.updateNavigationButtons();
      await this.updateImagePreview();
    }
  }

  async goToNextPage() {
    if (this.paginator.nextPage()) {
      const pageInfo = this.paginator.getPageInfo();
      this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.parser.spine.length}`;
      this.updateNavigationButtons();
      await this.updateImagePreview();
    }
  }

  async goToPrevChapter() {
    const newIndex = this.paginator.currentChapterIndex - 1;
    if (newIndex >= 0) await this.loadChapter(newIndex);
  }

  async goToNextChapter() {
    const newIndex = this.paginator.currentChapterIndex + 1;
    if (newIndex < this.parser.spine.length) await this.loadChapter(newIndex);
  }

  /**
   * Start conversion process
   */
  async startConversion() {
    if (!this.epubLoaded || this.isConverting) return;

    this.isConverting = true;
    this.elements.convertBtn.disabled = true;
    this.elements.progressContainer.classList.remove("hidden");

    try {
      const outputFormat = this.elements.outputFormat.value;
      const isZipBased = outputFormat === "zip" || outputFormat === "xth";

      // Initialize ZIP, EPUB, or XTC builder
      const zip = isZipBased ? new JSZip() : null;
      if (outputFormat === "epub") {
        this.epubBuilder.clear();
        this.epubBuilder.setMetadata({
          title: `${this.parser.metadata.title} (x4-imaged)`,
          creator: this.parser.metadata.creator,
          language: this.parser.metadata.language,
        });
      } else if (outputFormat === "xtc") {
        this.xtcBuilder.clear();
        this.xtcBuilder.setMetadata({
          title: this.parser.metadata.title,
          creator: this.parser.metadata.creator || "Unknown"
        });
      }

      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };

      const limitType = this.elements.limitType.value;
      const limitValue = parseInt(this.elements.limitValue.value);
      let globalPageNumber = 1;
      let totalChapters = this.parser.spine.length;
      let maxPages = Infinity;

      if (limitType === "chapters") totalChapters = Math.min(limitValue, totalChapters);
      else if (limitType === "pages") maxPages = limitValue;

      // === PROCESSING LOOP ===
      for (let chapterIndex = 0; chapterIndex < totalChapters; chapterIndex++) {
        if (globalPageNumber > maxPages) break;
        this.updateProgress(`Loading chapter ${chapterIndex + 1}/${totalChapters}...`, 0);

        const html = await this.parser.getChapterContent(chapterIndex);
        await this.paginator.loadChapter(html, chapterIndex);
        const pageCount = this.paginator.pageCount;

        // Add chapter marker for XTC format (0-indexed page number)
        if (outputFormat === "xtc") {
          const chapterTitle = this.parser.getChapterTitle(chapterIndex);
          this.xtcBuilder.addChapter(chapterTitle, globalPageNumber - 1);
        }

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          if (globalPageNumber > maxPages) break;

          this.paginator.goToPage(pageIndex);
          const progress = (chapterIndex * 100 + (pageIndex / pageCount) * 100) / totalChapters;
          this.updateProgress(`Converting page ${globalPageNumber}... (Ch ${chapterIndex + 1}, Pg ${pageIndex + 1})`, progress);

          const pageElement = this.paginator.getCurrentPageElement();

          // >>> START OF FIXED LOGIC
          try {
            if (outputFormat === "xth" || outputFormat === "xtc") {
              // 1. Render to Canvas
              const canvas = await this.renderer.renderPageToCanvas(pageElement, settings.fontFamily, settings);

              // 2. Encode to XTH
              if (canvas) {
                 const xthBlob = this.xthEncoder.encode(canvas);

                 if (outputFormat === "xth") {
                   const filename = `page-${String(globalPageNumber).padStart(4, "0")}.xth`;
                   zip.file(filename, xthBlob);
                 } else {
                   // Convert Blob to ArrayBuffer for XTC
                   const xthBuffer = await xthBlob.arrayBuffer();
                   this.xtcBuilder.addPage(xthBuffer);
                   console.log(`Added page ${globalPageNumber} to XTC (${xthBuffer.byteLength} bytes)`);
                 }
              } else {
                console.warn(`Page ${globalPageNumber}: Canvas rendering returned null`);
              }

            } else {
              // 1. Render to JPEG Blob
              const blob = await this.renderer.renderPageToImage(pageElement, settings.fontFamily, settings);

              // 2. Add to Output Container
              if (outputFormat === "zip") {
                const filename = `page-${String(globalPageNumber).padStart(4, "0")}.jpg`;
                zip.file(filename, blob);
              } else {
                this.epubBuilder.addImage(blob, globalPageNumber);
              }
            }
          } catch (pageErr) {
            console.error(`ERROR on page ${globalPageNumber}:`, pageErr);
            console.error(`  Chapter: ${chapterIndex + 1}, Page in chapter: ${pageIndex + 1}`);
          }
          // <<< END OF FIXED LOGIC

          globalPageNumber++;
        }
      }

      // === FINAL GENERATION ===
      let outputBlob;
      let filename;

      if (outputFormat === "xtc") {
        this.updateProgress("Generating XTC file...", 100);
        const xtcBuffer = this.xtcBuilder.generate();
        outputBlob = new Blob([xtcBuffer], { type: "application/octet-stream" });
        filename = `${this.sanitizeFilename(this.parser.metadata.title)}.xtc`;
      } else if (isZipBased) {
        this.updateProgress("Generating ZIP file...", 100);
        outputBlob = await zip.generateAsync({ type: "blob" });
        const ext = outputFormat === "xth" ? "xth" : "images";
        filename = `${this.sanitizeFilename(this.parser.metadata.title)}-${ext}.zip`;
      } else {
        this.updateProgress("Generating EPUB file...", 100);
        outputBlob = await this.epubBuilder.generate();
        filename = `${this.sanitizeFilename(this.parser.metadata.title)}-images.epub`;
      }

      // Download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(outputBlob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);

      this.updateProgress(`Conversion complete! ${globalPageNumber - 1} pages exported as ${outputFormat.toUpperCase()}.`, 100);
      setTimeout(() => {
        this.elements.progressContainer.classList.add("hidden");
        this.elements.convertBtn.disabled = false;
        this.isConverting = false;
      }, 3000);

    } catch (error) {
      console.error("Conversion error:", error);
      this.updateProgress(`Error: ${error.message}`, 0);
      this.elements.convertBtn.disabled = false;
      this.isConverting = false;
    }
  }

  updateProgress(text, percent) {
    this.elements.progressText.textContent = text;
    this.elements.progressFill.style.width = `${percent}%`;
  }

  sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.app = new EPUBConverterApp();
  });
} else {
  window.app = new EPUBConverterApp();
}