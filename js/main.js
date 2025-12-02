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
import { ArxivParser } from "./arxiv-parser.js";
import { SettingsStorage } from "./settings-storage.js";
import { HTMLExtractor } from "./html-extractor.js";
import { TranslationManager } from "./translation-manager.js";

class EPUBConverterApp {
  constructor() {
    this.parser = new EPUBParser();
    this.arxivParser = new ArxivParser();
    this.fontEmbedder = new FontEmbedder();
    this.paginator = new Paginator("#virtual-device");
    this.renderer = new Renderer(this.fontEmbedder);
    this.epubBuilder = new EPUBBuilder();
    this.xthEncoder = new XTHEncoder();
    this.xtcBuilder = new XTCBuilder();
    this.settingsStorage = new SettingsStorage();
    this.htmlExtractor = new HTMLExtractor();
    this.translationManager = new TranslationManager();

    this.epubLoaded = false;
    this.isConverting = false;
    this.currentMode = "epub"; // 'epub' or 'arxiv'
    this.arxivChapters = []; // For multi-section Arxiv papers
    this.currentFilename = null; // For persistent settings
    this.settingsDebounceTimer = null; // For debouncing font settings updates
    this.originalMap = null; // Map<pageNumber, originalHTML> - edited original for matching
    this.translationMap = null; // Map<pageNumber, translatedHTML>
    this.exportMode = "normal"; // 'normal' | 'text-for-translation'
    this.currentImportedPageIndex = 0; // Index in the sorted page numbers array
    this.importedPageNumbers = []; // Sorted array of page numbers
    this.lastShownWasOriginal = true; // Track whether we're showing original or translation

    this.initializeUI();
    this.attachEventListeners();
    this.initializeCollapsibleSections();
    this.initializePreviewTabs();
    this.preloadFonts();
    this.loadCalibrationScale();
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
      xtcSplitSettings: document.getElementById("xtc-split-settings"),
      xtcSplitPages: document.getElementById("xtc-split-pages"),
      xtcSplitValue: document.getElementById("xtc-split-value"),
      xtcFilenameSettings: document.getElementById("xtc-filename-settings"),
      xtcFilenamePattern: document.getElementById("xtc-filename-pattern"),
      modeEpub: document.getElementById("mode-epub"),
      modeArxiv: document.getElementById("mode-arxiv"),
      epubModeSections: document.getElementById("epub-mode-sections"),
      arxivModeSections: document.getElementById("arxiv-mode-sections"),
      arxivUrl: document.getElementById("arxiv-url"),
      loadArxivBtn: document.getElementById("load-arxiv-btn"),
      arxivHtmlPaste: document.getElementById("arxiv-html-paste"),
      loadArxivPasteBtn: document.getElementById("load-arxiv-paste-btn"),
      arxivInfo: document.getElementById("arxiv-info"),
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
      sizeCalibration: document.getElementById("size-calibration"),
      sizeCalibrationValue: document.getElementById("size-calibration-value"),
      actualSizeViewport: document.getElementById("actual-size-viewport"),
      enableTranslation: document.getElementById("enable-translation"),
      exportForTranslationBtn: document.getElementById("export-for-translation-btn"),
      importOriginalBtn: document.getElementById("import-original-btn"),
      originalFileUpload: document.getElementById("original-file-upload"),
      originalImportStatus: document.getElementById("original-import-status"),
      importTranslationBtn: document.getElementById("import-translation-btn"),
      translationFileUpload: document.getElementById("translation-file-upload"),
      translationImportStatus: document.getElementById("translation-import-status"),
      translationTargetLang: document.getElementById("translation-target-lang"),
    };

    // Initialize output format UI
    this.updateOutputFormatUI();
  }

  attachEventListeners() {
    this.elements.modeEpub.addEventListener("change", () =>
      this.switchMode("epub"),
    );
    this.elements.modeArxiv.addEventListener("change", () =>
      this.switchMode("arxiv"),
    );
    this.elements.epubUpload.addEventListener("change", (e) =>
      this.handleFileUpload(e),
    );
    this.elements.loadArxivBtn.addEventListener("click", () =>
      this.loadArxivFromUrl(),
    );
    this.elements.loadArxivPasteBtn.addEventListener("click", () =>
      this.loadArxivFromPaste(),
    );
    this.elements.fontFamily.addEventListener("change", () => {
      this.updatePaginatorSettings();
      this.saveCurrentSettings();
    });
    this.elements.fontSize.addEventListener("input", (e) => {
      this.elements.fontSizeValue.textContent = e.target.value;
      this.debouncedUpdatePaginatorSettings();
    });
    this.elements.lineHeight.addEventListener("input", (e) => {
      this.elements.lineHeightValue.textContent = e.target.value;
      this.debouncedUpdatePaginatorSettings();
    });
    this.elements.jpegQuality.addEventListener("input", (e) => {
      this.elements.jpegQualityValue.textContent = e.target.value;
      this.renderer.setJPEGQuality(e.target.value / 100);
    });
    this.elements.applyCSSBtn.addEventListener("click", () =>
      this.updatePaginatorSettings(),
    );
    this.elements.outputFormat.addEventListener("change", () =>
      this.updateOutputFormatUI(),
    );
    this.elements.xtcSplitPages.addEventListener("input", (e) => {
      this.elements.xtcSplitValue.textContent = e.target.value;
    });
    this.elements.limitType.addEventListener("change", (e) => {
      const limitType = e.target.value;
      this.elements.limitValueGroup.style.display =
        limitType === "none" ? "none" : "block";
      if (limitType === "chapters" && this.epubLoaded) {
        this.elements.limitValue.max = this.getTotalChapters();
      } else if (limitType === "pages") {
        this.elements.limitValue.max = 100;
      }
    });
    this.elements.limitValue.addEventListener("input", (e) => {
      this.elements.limitValueDisplay.textContent = e.target.value;
    });
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
    this.elements.sizeCalibration.addEventListener("input", (e) => {
      const scale = e.target.value / 100;
      this.elements.sizeCalibrationValue.textContent = e.target.value;
      this.elements.actualSizeViewport.style.transform = `scale(${scale})`;
      this.saveCalibrationScale(parseInt(e.target.value));
    });
    this.elements.exportForTranslationBtn.addEventListener("click", () =>
      this.exportForTranslation(),
    );
    this.elements.importOriginalBtn.addEventListener("click", () =>
      this.elements.originalFileUpload.click(),
    );
    this.elements.originalFileUpload.addEventListener("change", (e) =>
      this.handleOriginalImport(e),
    );
    this.elements.importTranslationBtn.addEventListener("click", () =>
      this.elements.translationFileUpload.click(),
    );
    this.elements.translationFileUpload.addEventListener("change", (e) =>
      this.handleTranslationImport(e),
    );
    this.elements.convertBtn.addEventListener("click", () =>
      this.startConversion(),
    );
  }

  initializeCollapsibleSections() {
    // Find all collapsible section headers
    const collapsibleHeaders = document.querySelectorAll(
      ".settings-section h2.collapsible",
    );

    collapsibleHeaders.forEach((header) => {
      header.addEventListener("click", () => {
        const section = header.parentElement;
        section.classList.toggle("collapsed");
      });
    });
  }

  initializePreviewTabs() {
    const tabs = document.querySelectorAll(".preview-tab");
    const columns = document.querySelectorAll(".preview-column");

    // Set first column as active by default
    if (columns.length > 0) {
      columns[0].classList.add("active");
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const previewType = tab.dataset.preview;

        // Update active tab
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Update active column
        columns.forEach((col) => {
          if (col.dataset.preview === previewType) {
            col.classList.add("active");
          } else {
            col.classList.remove("active");
          }
        });
      });
    });
  }

  updateOutputFormatUI() {
    const format = this.elements.outputFormat.value;
    this.elements.xtcSplitSettings.style.display =
      format === "xtc" ? "block" : "none";
    this.elements.xtcFilenameSettings.style.display =
      format === "xtc" ? "block" : "none";
  }

  switchMode(mode) {
    this.currentMode = mode;

    if (mode === "epub") {
      this.elements.epubModeSections.style.display = "block";
      this.elements.arxivModeSections.style.display = "none";
    } else {
      this.elements.epubModeSections.style.display = "none";
      this.elements.arxivModeSections.style.display = "block";
    }

    // Reset state
    this.epubLoaded = false;
    this.arxivChapters = [];
    this.elements.convertBtn.disabled = true;
  }

  async loadArxivFromUrl() {
    const url = this.elements.arxivUrl.value.trim();

    if (!url) {
      this.elements.arxivInfo.textContent = "Please enter an Arxiv URL";
      this.elements.arxivInfo.classList.remove("hidden");
      this.elements.arxivInfo.style.color = "#dc322f";
      return;
    }

    try {
      this.elements.arxivInfo.textContent = "Loading paper...";
      this.elements.arxivInfo.classList.remove("hidden");
      this.elements.arxivInfo.style.color = "";

      const paper = await this.arxivParser.processPaperFromUrl(url);

      await this.loadArxivPaper(paper);
    } catch (error) {
      console.error("Error loading Arxiv paper:", error);
      this.elements.arxivInfo.textContent = `Error: ${error.message}. Try paste method instead.`;
      this.elements.arxivInfo.style.color = "#dc322f";
    }
  }

  async loadArxivFromPaste() {
    const html = this.elements.arxivHtmlPaste.value.trim();

    if (!html) {
      this.elements.arxivInfo.textContent = "Please paste HTML source";
      this.elements.arxivInfo.classList.remove("hidden");
      this.elements.arxivInfo.style.color = "#dc322f";
      return;
    }

    try {
      this.elements.arxivInfo.textContent = "Processing pasted HTML...";
      this.elements.arxivInfo.classList.remove("hidden");
      this.elements.arxivInfo.style.color = "";

      const paper = this.arxivParser.processPaperFromHtml(html);

      await this.loadArxivPaper(paper);

      // Clear textarea to free memory
      this.elements.arxivHtmlPaste.value = "";
    } catch (error) {
      console.error("Error processing pasted HTML:", error);
      this.elements.arxivInfo.textContent = `Error: ${error.message}`;
      this.elements.arxivInfo.style.color = "#dc322f";
    }
  }

  async loadArxivPaper(paper) {
    // Wrap content with e-ink styles
    const styledContent = `
      <div class="arxiv-content">
        <h1>${paper.metadata.title}</h1>
        <p style="font-style: italic; margin: 1em 0;">${paper.metadata.authors}</p>
        ${paper.content}
      </div>
    `;

    // Store as single chapter for conversion
    this.arxivChapters = [styledContent];

    // Update metadata for export
    // Use arxiv ID as title for filename if available, otherwise use paper title
    const exportTitle = paper.arxivId || paper.metadata.title;
    this.parser.metadata = {
      title: exportTitle,
      creator: paper.metadata.authors,
      language: "en",
    };

    // Pre-populate filename pattern with arxiv ID if available
    if (paper.arxivId) {
      this.elements.xtcFilenamePattern.value = paper.arxivId;
    }

    this.epubLoaded = true; // Mark as loaded so updatePaginatorSettings works

    // Load saved settings for this arxiv paper (use arxiv ID as identifier)
    this.currentFilename = paper.arxivId || paper.metadata.title;
    await this.loadSavedSettings(this.currentFilename);

    // Apply current typography settings before loading
    const settings = {
      fontFamily: this.elements.fontFamily.value,
      fontSize: parseInt(this.elements.fontSize.value),
      lineHeight: parseFloat(this.elements.lineHeight.value),
      customCSS: this.elements.customCSS.value,
    };
    this.paginator.updateSettings(settings);

    // Load into paginator with current settings applied
    await this.paginator.loadChapter(styledContent, 0);
    this.updateChapterInfo(0, this.paginator.getPageInfo().totalPages);
    this.updateNavigationButtons();

    this.elements.arxivInfo.textContent = `Loaded: ${paper.metadata.title}`;
    this.elements.arxivInfo.style.color = "";
    this.elements.convertBtn.disabled = false;

    await this.updateImagePreview();
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

      // Load saved settings for this file
      this.currentFilename = file.name;
      await this.loadSavedSettings(file.name);

      await this.loadChapter(0);
    } catch (error) {
      console.error("Error loading EPUB:", error);
      this.elements.fileInfo.textContent = `Error: ${error.message}`;
      this.elements.fileInfo.style.color = "#dc322f";
    }
  }

  async loadChapter(index) {
    try {
      if (index < 0 || index >= this.getTotalChapters()) return;

      // Get chapter content based on mode
      const html =
        this.currentMode === "imported"
          ? this.importedChapters[index]
          : this.currentMode === "arxiv"
          ? this.arxivChapters[index]
          : await this.parser.getChapterContent(index);

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
    // Get chapter title based on mode
    const title =
      this.currentMode === "arxiv"
        ? chapterIndex === 0
          ? this.parser.metadata.title
          : `Section ${chapterIndex + 1}`
        : this.parser.getChapterTitle(chapterIndex);

    this.elements.chapterTitle.textContent = title;
    const pageInfo = this.paginator.getPageInfo();
    this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.getTotalChapters()}`;
  }

  updateNavigationButtons() {
    const pageInfo = this.paginator.getPageInfo();
    this.elements.prevPageBtn.disabled = !pageInfo.hasPrevPage;
    this.elements.nextPageBtn.disabled = !pageInfo.hasNextPage;
    this.elements.prevChapterBtn.disabled = pageInfo.currentChapter <= 1;
    this.elements.nextChapterBtn.disabled =
      pageInfo.currentChapter >= this.getTotalChapters();
  }

  async updateImagePreview() {
    const scaledPreview = document.querySelector("#preview-viewport");
    const actualSizePreview = document.querySelector("#actual-size-viewport");

    scaledPreview.innerHTML =
      '<div class="preview-placeholder"><p>Rendering...</p></div>';
    actualSizePreview.innerHTML =
      '<div class="preview-placeholder"><p>Rendering...</p></div>';

    try {
      const pageElement = this.paginator.getCurrentPageElement();
      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };
      const blob = await this.renderer.renderPageToImage(
        pageElement,
        settings.fontFamily,
        settings,
      );
      const imageUrl = URL.createObjectURL(blob);

      // Update scaled preview (fits to viewport)
      scaledPreview.innerHTML = `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: contain;" />`;

      // Update actual-size preview (shows at real 480×800 pixels)
      actualSizePreview.innerHTML = `<img src="${imageUrl}" />`;

      setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
    } catch (error) {
      console.error("Error updating preview:", error);
      scaledPreview.innerHTML =
        '<div class="preview-placeholder"><p>Preview error</p></div>';
      actualSizePreview.innerHTML =
        '<div class="preview-placeholder"><p>Preview error</p></div>';
    }
  }

  debouncedUpdatePaginatorSettings() {
    // Clear existing timer
    if (this.settingsDebounceTimer) {
      clearTimeout(this.settingsDebounceTimer);
    }

    // Set new timer - wait 300ms after last input before updating
    this.settingsDebounceTimer = setTimeout(() => {
      this.updatePaginatorSettings();
    }, 300);
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

    // Save settings after update completes (skip for imported mode)
    if (this.currentMode !== "imported") {
      await this.saveCurrentSettings();
    }
  }

  async loadSavedSettings(filename) {
    try {
      const savedSettings =
        await this.settingsStorage.getSettingsForFile(filename);

      if (savedSettings) {
        // Apply to UI controls
        this.elements.fontFamily.value = savedSettings.fontFamily;
        this.elements.fontSize.value = savedSettings.fontSize;
        this.elements.fontSizeValue.textContent = savedSettings.fontSize;
        this.elements.lineHeight.value = savedSettings.lineHeight;
        this.elements.lineHeightValue.textContent = savedSettings.lineHeight;
      }
    } catch (error) {
      console.warn("Failed to load saved settings:", error);
    }
  }

  async saveCurrentSettings() {
    const settings = {
      fontFamily: this.elements.fontFamily.value,
      fontSize: parseInt(this.elements.fontSize.value),
      lineHeight: parseFloat(this.elements.lineHeight.value),
    };

    try {
      if (this.currentFilename && this.epubLoaded) {
        // Save for specific file
        await this.settingsStorage.saveSettingsForFile(
          this.currentFilename,
          settings,
        );
      } else {
        // Save as global defaults
        await this.settingsStorage.saveGlobalSettings(settings);
      }
    } catch (error) {
      console.warn("Failed to save settings:", error);
    }
  }

  async loadCalibrationScale() {
    try {
      const scale = await this.settingsStorage.getCalibrationScale();
      this.elements.sizeCalibration.value = scale;
      this.elements.sizeCalibrationValue.textContent = scale;
      this.elements.actualSizeViewport.style.transform = `scale(${scale / 100})`;
    } catch (error) {
      console.warn("Failed to load calibration scale:", error);
    }
  }

  async saveCalibrationScale(scale) {
    try {
      await this.settingsStorage.saveCalibrationScale(scale);
    } catch (error) {
      console.warn("Failed to save calibration scale:", error);
    }
  }

  getTotalChapters() {
    if (this.currentMode === "imported") return this.importedChapters?.length || 0;
    return this.currentMode === "arxiv"
      ? this.arxivChapters.length
      : this.parser.spine.length;
  }

  /**
   * Get chapter title based on mode
   * @param {number} chapterIndex
   * @returns {string}
   */
  getChapterTitle(chapterIndex) {
    return this.currentMode === "arxiv"
      ? chapterIndex === 0
        ? this.parser.metadata.title
        : `Section ${chapterIndex + 1}`
      : this.parser.getChapterTitle(chapterIndex);
  }

  /**
   * Export pages as text for translation
   */
  async exportForTranslation() {
    this.exportMode = "text-for-translation";
    await this.startConversion();
    this.exportMode = "normal";
  }

  /**
   * Handle original file import (edited original for matching with translation)
   * @param {Event} event - File input change event
   */
  async handleOriginalImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Validate basic structure
      if (!text.includes('BILINGUAL TRANSLATION FILE')) {
        throw new Error('Invalid file format - missing header');
      }

      if (!text.includes('=== PAGE')) {
        throw new Error('Invalid file format - no page markers found');
      }

      // Parse original pages
      const pageMap = this.translationManager.parseTranslationFile(text);

      if (pageMap.size === 0) {
        throw new Error('No pages found in file');
      }

      // Store as original map
      this.originalMap = pageMap;

      // Show success
      this.elements.originalImportStatus.textContent = `✓ Imported ${pageMap.size} original pages`;
      this.elements.originalImportStatus.classList.remove('hidden');
      this.elements.originalImportStatus.style.color = '#859900';

      // If we have both maps, construct interleaved EPUB and load it
      if (this.originalMap && this.translationMap) {
        await this.loadInterleavedAsEPUB();
      }
    } catch (error) {
      this.elements.originalImportStatus.textContent = `✗ Error: ${error.message}`;
      this.elements.originalImportStatus.style.color = '#dc322f';
      this.elements.originalImportStatus.classList.remove('hidden');
    }

    // Reset file input
    event.target.value = '';
  }

  /**
   * Handle translation file import
   * @param {Event} event - File input change event
   */
  async handleTranslationImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Parse translation file
      const pageMap = this.translationManager.parseTranslationFile(text);

      if (pageMap.size === 0) {
        throw new Error("No translated pages found in file");
      }

      // Store in state
      this.translationMap = pageMap;

      // Show success
      this.elements.translationImportStatus.textContent = `✓ Imported ${pageMap.size} translated pages`;
      this.elements.translationImportStatus.classList.remove("hidden");
      this.elements.translationImportStatus.style.color = "#859900";

      // If we have both maps, construct interleaved EPUB and load it
      if (this.originalMap && this.translationMap) {
        await this.loadInterleavedAsEPUB();
      }
    } catch (error) {
      this.elements.translationImportStatus.textContent = `✗ Error: ${error.message}`;
      this.elements.translationImportStatus.style.color = "#dc322f";
      this.elements.translationImportStatus.classList.remove("hidden");
    }

    // Clear file input
    event.target.value = "";
  }

  /**
   * Load interleaved original+translation as virtual chapters
   * (separate chapters for pagination, but exported as single chapter)
   */
  async loadInterleavedAsEPUB() {
    try {
      const isBilingual = this.elements.enableTranslation?.checked || false;

      // Get all page numbers sorted
      const pageNumbers = Array.from(this.originalMap.keys()).sort((a, b) => a - b);

      // Build array of "virtual chapters" (each imported page is separate for pagination)
      this.importedChapters = [];

      for (const pageNum of pageNumbers) {
        const originalHTML = this.originalMap.get(pageNum);
        if (originalHTML && originalHTML.trim()) {
          this.importedChapters.push(originalHTML);
        }

        if (isBilingual) {
          const translatedHTML = this.translationMap?.get(pageNum);
          if (translatedHTML && translatedHTML.trim()) {
            this.importedChapters.push(translatedHTML);
          }
        }
      }

      // Load as imported mode with virtual chapters
      this.epubLoaded = true;
      this.currentMode = "imported";
      this.suppressChapterMarkers = true; // Flag to suppress chapter markers in export

      // Load first virtual chapter
      await this.loadChapter(0);

      // Enable convert button
      this.elements.convertBtn.disabled = false;

      console.log(`Loaded ${this.importedChapters.length} virtual chapters for pagination`);
    } catch (error) {
      console.error('Error loading interleaved content:', error);
      alert(`Error loading interleaved content: ${error.message}`);
    }
  }

  /**
   * Export bilingual content from imported files only (no EPUB)
   */
  async exportFromImportedFiles(zip, outputFormat, settings, originalMap, translationMap) {
    try {
      const isZipBased = outputFormat === "zip" || outputFormat === "xth";
      const isBilingual = this.elements.enableTranslation?.checked || false;

      // Get all page numbers (use original map as source of truth)
      const pageNumbers = Array.from(originalMap.keys()).sort((a, b) => a - b);
      const totalPages = isBilingual ? pageNumbers.length * 2 : pageNumbers.length;

      let globalPageNumber = 1;

      // Initialize XTC builder if needed
      if (outputFormat === "xtc") {
        this.xtcBuilder.clear();
        this.xtcBuilder.setMetadata({
          title: "Imported Translation",
          creator: "Unknown",
        });
        this.xtcBuilder.addChapter("Imported Pages", 0);
      } else if (outputFormat === "epub") {
        this.epubBuilder.clear();
        this.epubBuilder.setMetadata({
          title: "Imported Translation",
          creator: "Unknown",
          language: "en",
        });
      }

      for (const pageNum of pageNumbers) {
        const progress = (globalPageNumber / totalPages) * 100;

        // Render original page
        const originalHTML = originalMap.get(pageNum);
        this.updateProgress(`Rendering original page ${pageNum}...`, progress);

        const { scaledElement: origElement } = await this.paginator.loadTranslatedPageWithScaling(
          originalHTML,
          settings.fontSize,
        );

        await this.renderAndAddPage(origElement, outputFormat, zip, globalPageNumber, settings);
        globalPageNumber++;

        // Render translated page if bilingual mode
        if (isBilingual && translationMap.has(pageNum)) {
          const translatedHTML = translationMap.get(pageNum);
          this.updateProgress(`Rendering translated page ${pageNum}...`, progress);

          const { scaledElement: transElement } = await this.paginator.loadTranslatedPageWithScaling(
            translatedHTML,
            settings.fontSize,
          );

          await this.renderAndAddPage(transElement, outputFormat, zip, globalPageNumber, settings);
          globalPageNumber++;
        }
      }

      // Generate output file
      await this.finalizeExport(outputFormat, zip, "imported-translation");

      this.updateProgress(`Export complete! ${globalPageNumber - 1} pages exported.`, 100);

      setTimeout(() => {
        this.elements.progressContainer.classList.add("hidden");
        this.elements.convertBtn.disabled = false;
        this.isConverting = false;
      }, 3000);
    } catch (error) {
      console.error("Export error:", error);
      this.updateProgress(`Error: ${error.message}`, 100);
      this.elements.convertBtn.disabled = false;
      this.isConverting = false;
    }
  }

  /**
   * Render page element and add to output
   */
  async renderAndAddPage(pageElement, outputFormat, zip, globalPageNumber, settings) {
    if (outputFormat === "xth" || outputFormat === "xtc") {
      const canvas = await this.renderer.renderPageToCanvas(pageElement, settings.fontFamily, settings);
      if (canvas) {
        const xthBlob = this.xthEncoder.encode(canvas);
        if (outputFormat === "xth") {
          const filename = `page-${String(globalPageNumber).padStart(4, "0")}.xth`;
          zip.file(filename, xthBlob);
        } else {
          const xthBuffer = await xthBlob.arrayBuffer();
          this.xtcBuilder.addPage(xthBuffer);
        }
      }
    } else {
      const blob = await this.renderer.renderPageToImage(pageElement, settings.fontFamily, settings);
      if (outputFormat === "zip") {
        const filename = `page-${String(globalPageNumber).padStart(4, "0")}.jpg`;
        zip.file(filename, blob);
      } else if (outputFormat === "epub") {
        this.epubBuilder.addImage(blob, globalPageNumber);
      }
    }
  }

  /**
   * Finalize and download export
   */
  async finalizeExport(outputFormat, zip, baseFilename) {
    let blob, filename;

    if (outputFormat === "xth" || outputFormat === "zip") {
      blob = await zip.generateAsync({ type: "blob" });
      filename = `${baseFilename}.zip`;
    } else if (outputFormat === "xtc") {
      const xtcBuffer = this.xtcBuilder.generate();
      blob = new Blob([xtcBuffer], { type: "application/octet-stream" });
      filename = `${baseFilename}.xtc`;
    } else if (outputFormat === "epub") {
      blob = await this.epubBuilder.build();
      filename = `${baseFilename}.epub`;
    }

    // Download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /**
   * Show preview of imported page
   * @param {number} pageNumber - Page number to preview
   * @param {boolean} showOriginal - True to show original, false to show translation
   */
  async showImportedPagePreview(pageNumber, showOriginal = true) {
    try {
      console.log('showImportedPagePreview called with pageNumber:', pageNumber, 'showOriginal:', showOriginal);

      // Get HTML from appropriate map
      const html = showOriginal
        ? this.originalMap?.get(pageNumber)
        : this.translationMap?.get(pageNumber);

      console.log('HTML found:', html ? html.substring(0, 100) : 'null');

      if (!html) {
        console.warn(`No imported page found for page ${pageNumber} (${showOriginal ? 'original' : 'translation'})`);
        return;
      }

      // Get current settings
      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };

      // Create a temporary container with the HTML
      const tempContainer = document.createElement('div');
      tempContainer.style.width = `${this.paginator.width}px`;
      tempContainer.style.height = `${this.paginator.height}px`;
      tempContainer.style.padding = `${this.paginator.padding}px`;
      tempContainer.style.overflow = 'hidden';
      tempContainer.style.position = 'relative';
      tempContainer.style.backgroundColor = '#fff';
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.fontFamily = settings.fontFamily;
      tempContainer.style.fontSize = `${settings.fontSize}px`;
      tempContainer.style.lineHeight = settings.lineHeight;
      tempContainer.innerHTML = html;

      console.log('tempContainer created, innerHTML length:', tempContainer.innerHTML.length);

      // Update HTML preview viewport
      console.log('htmlPreviewContainer exists:', !!this.paginator.htmlPreviewContainer);

      if (this.paginator.htmlPreviewContainer) {
        this.paginator.htmlPreviewContainer.innerHTML = '';

        // Create wrapper to hold the preview
        const wrapper = document.createElement('div');
        wrapper.style.width = `${this.paginator.width}px`;
        wrapper.style.height = `${this.paginator.height}px`;
        wrapper.style.overflow = 'hidden';
        wrapper.style.position = 'relative';
        wrapper.style.backgroundColor = '#fff';

        wrapper.appendChild(tempContainer);
        this.paginator.htmlPreviewContainer.appendChild(wrapper);

        console.log('Preview added to htmlPreviewContainer');
      } else {
        console.error('htmlPreviewContainer not found!');
      }

      // Update page info
      const isBilingual = this.elements.enableTranslation?.checked || false;
      const totalPages = isBilingual
        ? (this.originalMap?.size || 0) * 2
        : Math.max(this.originalMap?.size || 0, this.translationMap?.size || 0);

      const pageType = showOriginal ? 'Original' : 'Translation';
      this.elements.chapterTitle.textContent = `Imported ${pageType}`;
      this.elements.pageInfo.textContent = `Page ${pageNumber} (${pageType})`;
    } catch (error) {
      console.error('Error showing imported page preview:', error);
    }
  }

  async goToPrevPage() {
    if (this.paginator.prevPage()) {
      const pageInfo = this.paginator.getPageInfo();
      this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.getTotalChapters()}`;
      this.updateNavigationButtons();
      await this.updateImagePreview();
    }
  }

  async goToNextPage() {
    if (this.paginator.nextPage()) {
      const pageInfo = this.paginator.getPageInfo();
      this.elements.pageInfo.textContent = `Page ${pageInfo.currentPage}/${pageInfo.totalPages} • Chapter ${pageInfo.currentChapter}/${this.getTotalChapters()}`;
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
    if (newIndex < this.getTotalChapters()) await this.loadChapter(newIndex);
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

      // Get metadata based on mode
      const metadata = this.currentMode === "imported"
        ? { title: "Imported Translation", creator: "Unknown", language: "en" }
        : this.parser.metadata;

      if (outputFormat === "epub") {
        this.epubBuilder.clear();
        this.epubBuilder.setMetadata({
          title: `${metadata.title} (x4-imaged)`,
          creator: metadata.creator,
          language: metadata.language,
        });
      } else if (outputFormat === "xtc") {
        this.xtcBuilder.clear();
        this.xtcBuilder.setMetadata({
          title: metadata.title,
          creator: metadata.creator || "Unknown",
        });
      }

      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };

      // Apply settings to paginator BEFORE conversion starts
      this.paginator.updateSettings(settings);

      const limitType = this.elements.limitType.value;
      const limitValue = parseInt(this.elements.limitValue.value);
      let globalPageNumber = 1;

      // Use different chapter sources based on mode
      let totalChapters =
        this.currentMode === "imported"
          ? this.importedChapters.length
          : this.currentMode === "arxiv"
          ? this.arxivChapters.length
          : this.parser.spine.length;
      let maxPages = Infinity;

      if (limitType === "chapters")
        totalChapters = Math.min(limitValue, totalChapters);
      else if (limitType === "pages") maxPages = limitValue;

      // XTC volume splitting variables
      const xtcSplitPages =
        outputFormat === "xtc"
          ? parseInt(this.elements.xtcSplitPages.value)
          : 0;
      const xtcVolumes = [];
      let currentVolume = null;
      let pagesInCurrentVolume = 0;
      let volumeNumber = 1;

      // Time tracking
      let pageStartTime = null;
      let totalRenderTime = 0;
      let pagesRendered = 0;
      let avgTimePerPage = 0;
      let estimatedTotalPages = 0;

      // For text export mode
      const pages = [];

      // === PROCESSING LOOP ===
      for (let chapterIndex = 0; chapterIndex < totalChapters; chapterIndex++) {
        if (globalPageNumber > maxPages) break;
        this.updateProgress(
          `Loading chapter ${chapterIndex + 1}/${totalChapters}...`,
          0,
        );

        // Get chapter content based on mode
        const html =
          this.currentMode === "imported"
            ? this.importedChapters[chapterIndex]
            : this.currentMode === "arxiv"
            ? this.arxivChapters[chapterIndex]
            : await this.parser.getChapterContent(chapterIndex);

        await this.paginator.loadChapter(html, chapterIndex);
        const pageCount = this.paginator.pageCount;

        // Add chapter marker for XTC format (0-indexed page number)
        // Skip if suppressChapterMarkers is set (for imported virtual chapters)
        if (outputFormat === "xtc" && !this.suppressChapterMarkers) {
          const chapterTitle =
            this.currentMode === "arxiv"
              ? chapterIndex === 0
                ? this.parser.metadata.title
                : `Section ${chapterIndex + 1}`
              : this.parser.getChapterTitle(chapterIndex);

          if (currentVolume) {
            currentVolume.builder.addChapter(
              chapterTitle,
              pagesInCurrentVolume,
            );
          } else {
            this.xtcBuilder.addChapter(chapterTitle, globalPageNumber - 1);
          }
        } else if (outputFormat === "xtc" && this.suppressChapterMarkers && chapterIndex === 0) {
          // For imported mode, add a single chapter marker at the beginning
          const title = "Imported Translation";
          if (currentVolume) {
            currentVolume.builder.addChapter(title, 0);
          } else {
            this.xtcBuilder.addChapter(title, 0);
          }
        }

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          if (globalPageNumber > maxPages) break;

          // Check if we need to start a new XTC volume
          if (
            outputFormat === "xtc" &&
            (currentVolume === null || pagesInCurrentVolume >= xtcSplitPages)
          ) {
            if (currentVolume !== null) {
              // Generate and download completed volume immediately
              const currentProgress =
                (chapterIndex * 100 + (pageIndex / pageCount) * 100) /
                totalChapters;
              this.updateProgress(
                `Generating & downloading volume ${currentVolume.volumeNumber}...`,
                currentProgress,
              );

              const xtcBuffer = currentVolume.builder.generate();
              const outputBlob = new Blob([xtcBuffer], {
                type: "application/octet-stream",
              });

              const customPattern =
                this.elements.xtcFilenamePattern.value.trim();
              const baseTitle = customPattern
                ? this.sanitizeFilename(customPattern)
                : this.sanitizeFilename(this.parser.metadata.title);
              const startPage = String(currentVolume.startPage).padStart(
                4,
                "0",
              );
              const endPage = String(
                currentVolume.startPage + currentVolume.pagesInVolume - 1,
              ).padStart(4, "0");
              const filename = `${startPage}-${baseTitle}-${endPage}.xtc`;

              const a = document.createElement("a");
              a.href = URL.createObjectURL(outputBlob);
              a.download = filename;
              a.click();
              URL.revokeObjectURL(a.href);

              await new Promise((resolve) => setTimeout(resolve, 300));

              xtcVolumes.push(currentVolume);
              volumeNumber++;
            }

            // Create new volume
            const xtcBuilder = new XTCBuilder();
            xtcBuilder.setMetadata({
              title: this.parser.metadata.title,
              creator: this.parser.metadata.creator || "Unknown",
            });

            currentVolume = {
              builder: xtcBuilder,
              volumeNumber: volumeNumber,
              startPage: globalPageNumber,
              pagesInVolume: 0,
            };

            pagesInCurrentVolume = 0;
          }

          this.paginator.goToPage(pageIndex);
          const progress =
            (chapterIndex * 100 + (pageIndex / pageCount) * 100) /
            totalChapters;

          // Start timing this page
          pageStartTime = performance.now();

          // Use imported original HTML if available, otherwise use paginated element
          let pageElement;
          if (this.originalMap?.has(globalPageNumber)) {
            // Use imported original HTML
            const originalHTML = this.originalMap.get(globalPageNumber);
            const { scaledElement } = await this.paginator.loadTranslatedPageWithScaling(
              originalHTML,
              settings.fontSize,
            );
            pageElement = scaledElement;
          } else {
            // Use paginated element
            pageElement = this.paginator.getCurrentPageElement();
          }

          // TEXT EXPORT MODE: Extract HTML only, no rendering
          if (this.exportMode === "text-for-translation") {
            const simplifiedHTML =
              this.htmlExtractor.extractSimplifiedHTML(pageElement);
            pages.push({
              chapterIndex,
              chapterTitle: this.getChapterTitle(chapterIndex),
              pageIndex,
              globalPageNumber,
              html: simplifiedHTML,
            });

            this.updateProgress(
              `Extracting page ${globalPageNumber}... (Ch ${chapterIndex + 1}, Pg ${pageIndex + 1})`,
              progress,
            );

            globalPageNumber++;
            continue; // Skip rendering
          }

          // >>> START OF FIXED LOGIC
          try {
            if (outputFormat === "xth" || outputFormat === "xtc") {
              // 1. Render to Canvas
              const canvas = await this.renderer.renderPageToCanvas(
                pageElement,
                settings.fontFamily,
                settings,
              );

              // 2. Encode to XTH
              if (canvas) {
                const xthBlob = this.xthEncoder.encode(canvas);

                if (outputFormat === "xth") {
                  const filename = `page-${String(globalPageNumber).padStart(4, "0")}.xth`;
                  zip.file(filename, xthBlob);
                } else {
                  // Convert Blob to ArrayBuffer for XTC
                  const xthBuffer = await xthBlob.arrayBuffer();
                  if (currentVolume) {
                    currentVolume.builder.addPage(xthBuffer);
                    currentVolume.pagesInVolume++;
                    pagesInCurrentVolume++;
                  } else {
                    this.xtcBuilder.addPage(xthBuffer);
                  }
                  console.log(
                    `Added page ${globalPageNumber} to XTC (${xthBuffer.byteLength} bytes)`,
                  );
                }
              } else {
                console.warn(
                  `Page ${globalPageNumber}: Canvas rendering returned null`,
                );
              }
            } else {
              // 1. Render to JPEG Blob
              const blob = await this.renderer.renderPageToImage(
                pageElement,
                settings.fontFamily,
                settings,
              );

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
            console.error(
              `  Chapter: ${chapterIndex + 1}, Page in chapter: ${pageIndex + 1}`,
            );
          }
          // <<< END OF FIXED LOGIC

          // Track render time
          const pageEndTime = performance.now();
          const renderTime = pageEndTime - pageStartTime;
          totalRenderTime += renderTime;
          pagesRendered++;

          // Calculate time estimate
          let timeEstimate = "";
          if (pagesRendered >= 3 && estimatedTotalPages > 0) {
            avgTimePerPage = totalRenderTime / pagesRendered;
            const pagesRemaining =
              Math.min(estimatedTotalPages, maxPages) - pagesRendered;
            const secondsRemaining = Math.ceil(
              (avgTimePerPage * pagesRemaining) / 1000,
            );
            if (secondsRemaining > 60) {
              const minutes = Math.floor(secondsRemaining / 60);
              const seconds = secondsRemaining % 60;
              timeEstimate = ` • ~${minutes}m${seconds}s left`;
            } else if (secondsRemaining > 5) {
              timeEstimate = ` • ~${secondsRemaining}s left`;
            }
          }

          this.updateProgress(
            `Converting page ${globalPageNumber}... (Ch ${chapterIndex + 1}, Pg ${pageIndex + 1})${timeEstimate}`,
            progress,
          );

          globalPageNumber++;

          // BILINGUAL MODE: Render translated page if available
          const bilingualMode = this.elements.enableTranslation?.checked || false;
          if (bilingualMode && this.translationMap?.has(globalPageNumber - 1)) {
            const translatedHTML = this.translationMap.get(globalPageNumber - 1);

            try {
              // Load with auto-scaling
              const { scaledElement, finalFontSize } =
                await this.paginator.loadTranslatedPageWithScaling(
                  translatedHTML,
                  settings.fontSize,
                );

              // Render translated page
              if (outputFormat === "xth" || outputFormat === "xtc") {
                const canvas = await this.renderer.renderPageToCanvas(
                  scaledElement,
                  settings.fontFamily,
                  settings,
                );

                if (canvas) {
                  const xthBlob = this.xthEncoder.encode(canvas);

                  if (outputFormat === "xth") {
                    const filename = `page-${String(globalPageNumber).padStart(4, "0")}.xth`;
                    zip.file(filename, xthBlob);
                  } else {
                    const xthBuffer = await xthBlob.arrayBuffer();
                    if (currentVolume) {
                      currentVolume.builder.addPage(xthBuffer);
                      currentVolume.pagesInVolume++;
                      pagesInCurrentVolume++;
                    } else {
                      this.xtcBuilder.addPage(xthBuffer);
                    }
                  }
                }
              } else {
                const blob = await this.renderer.renderPageToImage(
                  scaledElement,
                  settings.fontFamily,
                  settings,
                );

                if (outputFormat === "zip") {
                  const filename = `page-${String(globalPageNumber).padStart(4, "0")}.jpg`;
                  zip.file(filename, blob);
                } else {
                  this.epubBuilder.addImage(blob, globalPageNumber);
                }
              }

              this.updateProgress(
                `Converting translated page ${globalPageNumber}... (Ch ${chapterIndex + 1}, Pg ${pageIndex + 1})`,
                progress,
              );

              globalPageNumber++;

              // Restore original settings
              this.paginator.updateSettings(settings);
            } catch (transErr) {
              console.error(
                `ERROR rendering translated page ${globalPageNumber - 1}:`,
                transErr,
              );
            }
          }
        }

        // Update estimated total pages after rendering this chapter
        if (estimatedTotalPages === 0) {
          estimatedTotalPages = (globalPageNumber - 1) * totalChapters;
        } else {
          const chaptersProcessed = chapterIndex + 1;
          const avgPagesPerChapter = (globalPageNumber - 1) / chaptersProcessed;
          estimatedTotalPages = Math.ceil(avgPagesPerChapter * totalChapters);
        }
      }

      // TEXT EXPORT MODE: Generate text file and return early
      if (this.exportMode === "text-for-translation") {
        this.updateProgress(
          `Generating text file with ${pages.length} pages...`,
          100,
        );

        const textBlob = this.translationManager.exportPagesToText(
          pages,
          this.parser.metadata,
        );
        const textFilename = `${this.sanitizeFilename(this.parser.metadata.title)}-pages.txt`;

        // Download
        const a = document.createElement("a");
        a.href = URL.createObjectURL(textBlob);
        a.download = textFilename;
        a.click();
        URL.revokeObjectURL(a.href);

        const completionMsg = `Export complete! ${pages.length} pages exported to ${textFilename}`;
        this.updateProgress(completionMsg, 100);

        setTimeout(() => {
          this.elements.progressContainer.classList.add("hidden");
          this.elements.convertBtn.disabled = false;
          this.isConverting = false;
        }, 3000);

        return; // Skip normal output generation
      }

      // === FINAL GENERATION ===
      let outputBlob;
      let filename;

      if (outputFormat === "xtc") {
        // Generate final volume if using splitting
        if (currentVolume !== null && currentVolume.pagesInVolume > 0) {
          this.updateProgress(
            `Generating final volume ${currentVolume.volumeNumber}...`,
            100,
          );

          const xtcBuffer = currentVolume.builder.generate();
          outputBlob = new Blob([xtcBuffer], {
            type: "application/octet-stream",
          });

          const customPattern = this.elements.xtcFilenamePattern.value.trim();
          const baseTitle = customPattern
            ? this.sanitizeFilename(customPattern)
            : this.sanitizeFilename(metadata.title);

          // Only use page numbers if this is truly a multi-volume book
          // (i.e., we already have other volumes, or this volume is split)
          if (xtcVolumes.length > 0) {
            // Multiple volumes - use page numbers
            const startPage = String(currentVolume.startPage).padStart(4, "0");
            const endPage = String(
              currentVolume.startPage + currentVolume.pagesInVolume - 1,
            ).padStart(4, "0");
            filename = `${startPage}-${baseTitle}-${endPage}.xtc`;
          } else {
            // Single volume - omit page numbers
            filename = `${baseTitle}.xtc`;
          }

          xtcVolumes.push(currentVolume);
        } else {
          // Single XTC file (no splitting)
          this.updateProgress("Generating XTC file...", 100);
          const xtcBuffer = this.xtcBuilder.generate();
          outputBlob = new Blob([xtcBuffer], {
            type: "application/octet-stream",
          });
          const customPattern = this.elements.xtcFilenamePattern.value.trim();
          const baseTitle = customPattern
            ? this.sanitizeFilename(customPattern)
            : this.sanitizeFilename(metadata.title);
          filename = `${baseTitle}.xtc`;
        }
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

      let completionMsg = `Conversion complete! ${globalPageNumber - 1} pages exported as ${outputFormat.toUpperCase()}.`;
      if (outputFormat === "xtc" && xtcVolumes.length > 0) {
        completionMsg = `Conversion complete! ${globalPageNumber - 1} pages exported as ${xtcVolumes.length} XTC volume(s).`;
      }
      this.updateProgress(completionMsg, 100);
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
