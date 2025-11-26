/**
 * Main Application Module
 * Wires everything together and handles UI interactions
 */

import { EPUBParser } from "./epub-parser.js";
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

    this.epubLoaded = false;
    this.isConverting = false;

    this.initializeUI();
    this.attachEventListeners();
    this.preloadFonts();
  }

  /**
   * Initialize UI elements
   */
  initializeUI() {
    this.elements = {
      // File upload
      epubUpload: document.getElementById("epub-upload"),
      fileInfo: document.getElementById("file-info"),

      // Settings
      fontFamily: document.getElementById("font-family"),
      fontSize: document.getElementById("font-size"),
      fontSizeValue: document.getElementById("font-size-value"),
      lineHeight: document.getElementById("line-height"),
      lineHeightValue: document.getElementById("line-height-value"),
      jpegQuality: document.getElementById("jpeg-quality"),
      jpegQualityValue: document.getElementById("jpeg-quality-value"),
      customCSS: document.getElementById("custom-css"),
      applyCSSBtn: document.getElementById("apply-css-btn"),

      // Output format
      outputFormat: document.getElementById("output-format"),

      // Export limits
      limitType: document.getElementById("limit-type"),
      limitValue: document.getElementById("limit-value"),
      limitValueDisplay: document.getElementById("limit-value-display"),
      limitValueGroup: document.getElementById("limit-value-group"),

      // Convert
      convertBtn: document.getElementById("convert-btn"),
      progressContainer: document.getElementById("progress-container"),
      progressFill: document.getElementById("progress-fill"),
      progressText: document.getElementById("progress-text"),

      // Preview
      chapterTitle: document.getElementById("chapter-title"),
      pageInfo: document.getElementById("page-info"),
      prevChapterBtn: document.getElementById("prev-chapter-btn"),
      prevPageBtn: document.getElementById("prev-page-btn"),
      nextPageBtn: document.getElementById("next-page-btn"),
      nextChapterBtn: document.getElementById("next-chapter-btn"),
    };
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // File upload
    this.elements.epubUpload.addEventListener("change", (e) =>
      this.handleFileUpload(e),
    );

    // Settings changes
    this.elements.fontFamily.addEventListener("change", () =>
      this.updatePaginatorSettings(),
    );
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
    this.elements.applyCSSBtn.addEventListener("click", () =>
      this.updatePaginatorSettings(),
    );

    // Export limits
    this.elements.limitType.addEventListener("change", (e) => {
      const limitType = e.target.value;
      if (limitType === "none") {
        this.elements.limitValueGroup.style.display = "none";
      } else {
        this.elements.limitValueGroup.style.display = "block";
        // Update max value based on type
        if (limitType === "chapters" && this.epubLoaded) {
          this.elements.limitValue.max = this.parser.spine.length;
        } else if (limitType === "pages") {
          this.elements.limitValue.max = 100; // reasonable max for testing
        }
      }
    });
    this.elements.limitValue.addEventListener("input", (e) => {
      this.elements.limitValueDisplay.textContent = e.target.value;
    });

    // Navigation
    this.elements.prevChapterBtn.addEventListener("click", () =>
      this.goToPrevChapter(),
    );
    this.elements.prevPageBtn.addEventListener("click", () =>
      this.goToPrevPage(),
    );
    this.elements.nextPageBtn.addEventListener("click", () =>
      this.goToNextPage(),
    );
    this.elements.nextChapterBtn.addEventListener("click", () =>
      this.goToNextChapter(),
    );

    // Convert
    this.elements.convertBtn.addEventListener("click", () =>
      this.startConversion(),
    );
  }

  /**
   * Preload fonts
   */
  async preloadFonts() {
    try {
      await this.fontEmbedder.preloadAllFonts();
      console.log("All fonts preloaded");
    } catch (error) {
      console.warn("Failed to preload fonts:", error);
    }
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Show loading
      this.elements.fileInfo.textContent = "Loading EPUB...";
      this.elements.fileInfo.classList.remove("hidden");

      // Parse EPUB
      const info = await this.parser.load(file);

      // Update UI
      this.elements.fileInfo.textContent = `Loaded: ${info.metadata.title} by ${info.metadata.creator} (${info.chapterCount} chapters)`;
      this.elements.convertBtn.disabled = false;
      this.epubLoaded = true;

      // Load first chapter
      await this.loadChapter(0);
    } catch (error) {
      console.error("Error loading EPUB:", error);
      this.elements.fileInfo.textContent = `Error: ${error.message}`;
      this.elements.fileInfo.style.color = "#dc322f";
    }
  }

  /**
   * Load a specific chapter
   */
  async loadChapter(index) {
    try {
      if (index < 0 || index >= this.parser.spine.length) {
        return;
      }

      // Get chapter content
      const html = await this.parser.getChapterContent(index);

      // Load into paginator
      const pageCount = await this.paginator.loadChapter(html, index);

      // Update UI
      this.updateChapterInfo(index, pageCount);
      this.updateNavigationButtons();

      // Render image preview
      await this.updateImagePreview();
    } catch (error) {
      console.error("Error loading chapter:", error);
      this.elements.chapterTitle.textContent = `Error loading chapter: ${error.message}`;
    }
  }

  /**
   * Update chapter info display
   */
  updateChapterInfo(chapterIndex, pageCount) {
    const title = this.parser.getChapterTitle(chapterIndex);
    this.elements.chapterTitle.textContent = title;

    const pageInfo = this.paginator.getPageInfo();
    this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.parser.spine.length}`;
  }

  /**
   * Update navigation buttons state
   */
  updateNavigationButtons() {
    const pageInfo = this.paginator.getPageInfo();

    this.elements.prevPageBtn.disabled = !pageInfo.hasPrevPage;
    this.elements.nextPageBtn.disabled = !pageInfo.hasNextPage;
    this.elements.prevChapterBtn.disabled = pageInfo.currentChapter <= 1;
    this.elements.nextChapterBtn.disabled =
      pageInfo.currentChapter >= this.parser.spine.length;
  }

  /**
   * Update preview with rendered image
   */
  async updateImagePreview() {
    const previewContainer = document.querySelector(".preview-viewport");

    // Show loading state
    previewContainer.innerHTML =
      '<div class="preview-placeholder"><p>Rendering...</p></div>';

    try {
      // Get current page element
      const pageElement = this.paginator.getCurrentPageElement();

      // Get settings
      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };

      // Render to image
      const blob = await this.renderer.renderPageToImage(
        pageElement,
        settings.fontFamily,
        settings,
      );
      const imageUrl = URL.createObjectURL(blob);

      // Display image
      previewContainer.innerHTML = `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: contain;" />`;

      // Clean up old URL after a delay
      setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
    } catch (error) {
      console.error("Error updating preview:", error);
      previewContainer.innerHTML =
        '<div class="preview-placeholder"><p>Preview error</p></div>';
    }
  }

  /**
   * Update paginator settings and reload chapter
   */
  async updatePaginatorSettings() {
    if (!this.epubLoaded) return;

    const settings = {
      fontFamily: this.elements.fontFamily.value,
      fontSize: parseInt(this.elements.fontSize.value),
      lineHeight: parseFloat(this.elements.lineHeight.value),
      customCSS: this.elements.customCSS.value,
    };

    this.paginator.updateSettings(settings);

    // Reload current chapter
    await this.loadChapter(this.paginator.currentChapterIndex);
  }

  /**
   * Navigation methods
   */
  async goToPrevPage() {
    const success = this.paginator.prevPage();
    if (success) {
      const pageInfo = this.paginator.getPageInfo();
      this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.parser.spine.length}`;
      this.updateNavigationButtons();
      await this.updateImagePreview();
    }
  }

  async goToNextPage() {
    const success = this.paginator.nextPage();
    if (success) {
      const pageInfo = this.paginator.getPageInfo();
      this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.parser.spine.length}`;
      this.updateNavigationButtons();
      await this.updateImagePreview();
    }
  }

  async goToPrevChapter() {
    const newIndex = this.paginator.currentChapterIndex - 1;
    if (newIndex >= 0) {
      await this.loadChapter(newIndex);
    }
  }

  async goToNextChapter() {
    const newIndex = this.paginator.currentChapterIndex + 1;
    if (newIndex < this.parser.spine.length) {
      await this.loadChapter(newIndex);
    }
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
      // Get output format
      const outputFormat = this.elements.outputFormat.value;

      // Initialize ZIP or EPUB builder
      const zip = outputFormat === "zip" ? new JSZip() : null;
      if (outputFormat === "epub") {
        this.epubBuilder.clear();
        this.epubBuilder.setMetadata({
          title: this.parser.metadata.title,
          creator: this.parser.metadata.creator,
          language: this.parser.metadata.language,
        });
      }

      // Get settings
      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };

      // Get export limits
      const limitType = this.elements.limitType.value;
      const limitValue = parseInt(this.elements.limitValue.value);

      let globalPageNumber = 1;
      let totalChapters = this.parser.spine.length;
      let maxPages = Infinity;

      // Apply chapter limit
      if (limitType === "chapters") {
        totalChapters = Math.min(limitValue, totalChapters);
      } else if (limitType === "pages") {
        maxPages = limitValue;
      }

      // Iterate through chapters
      for (let chapterIndex = 0; chapterIndex < totalChapters; chapterIndex++) {
        // Check if we've reached page limit
        if (globalPageNumber > maxPages) {
          break;
        }

        this.updateProgress(
          `Loading chapter ${chapterIndex + 1}/${totalChapters}...`,
          0,
        );

        // Load chapter
        const html = await this.parser.getChapterContent(chapterIndex);
        await this.paginator.loadChapter(html, chapterIndex);
        const pageCount = this.paginator.pageCount;

        // Render each page in the chapter
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          // Check page limit
          if (globalPageNumber > maxPages) {
            break;
          }

          this.paginator.goToPage(pageIndex);

          const progress =
            (chapterIndex * 100 + (pageIndex / pageCount) * 100) /
            totalChapters;
          this.updateProgress(
            `Converting page ${globalPageNumber}... (Chapter ${chapterIndex + 1}/${totalChapters}, Page ${pageIndex + 1}/${pageCount})`,
            progress,
          );

          // Get page element
          const pageElement = this.paginator.getCurrentPageElement();

          // Render to image
          const blob = await this.renderer.renderPageToImage(
            pageElement,
            settings.fontFamily,
            settings,
          );

          // Add to ZIP or EPUB builder
          if (outputFormat === "zip") {
            const filename = `page-${String(globalPageNumber).padStart(4, "0")}.jpg`;
            zip.file(filename, blob);
          } else {
            this.epubBuilder.addImage(blob, globalPageNumber);
          }

          globalPageNumber++;
        }
      }

      // Generate and download
      let outputBlob;
      let filename;

      if (outputFormat === "zip") {
        this.updateProgress("Generating ZIP file...", 100);
        outputBlob = await zip.generateAsync({ type: "blob" });
        filename = `${this.sanitizeFilename(this.parser.metadata.title)}-images.zip`;
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

      // Success
      this.updateProgress(
        `Conversion complete! ${globalPageNumber - 1} pages exported as ${outputFormat.toUpperCase()}.`,
        100,
      );

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

  /**
   * Update progress display
   */
  updateProgress(text, percent) {
    this.elements.progressText.textContent = text;
    this.elements.progressFill.style.width = `${percent}%`;
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.app = new EPUBConverterApp();
  });
} else {
  window.app = new EPUBConverterApp();
}
