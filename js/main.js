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
import { ConversionPipeline } from "./conversion-pipeline.js";
import { ConversionController } from "./conversion-controller.js";

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

    // Create conversion pipeline and controller
    this.conversionPipeline = new ConversionPipeline({
      parser: this.parser, // Will be swapped based on mode
      paginator: this.paginator,
      renderer: this.renderer,
      xthEncoder: this.xthEncoder,
      xtcBuilder: this.xtcBuilder,
      epubBuilder: this.epubBuilder,
    });

    this.conversionController = new ConversionController(
      this.conversionPipeline,
      {
        convertBtn: null, // Will be set after UI init
        progressBar: null,
        progressText: null,
        progressContainer: null,
      },
    );

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

    // Update controller with UI elements after initialization
    this.conversionController.ui = {
      convertBtn: this.elements.convertBtn,
      progressBar: this.elements.progressFill,
      progressText: this.elements.progressText,
      progressContainer: this.elements.progressContainer,
    };

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
      jpegQualitySection: document.getElementById("jpeg-quality-section"),
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
      exportForTranslationBtn: document.getElementById(
        "export-for-translation-btn",
      ),
      enableProgressBars: document.getElementById("enable-progress-bars"),
      importOriginalBtn: document.getElementById("import-original-btn"),
      originalFileUpload: document.getElementById("original-file-upload"),
      originalImportStatus: document.getElementById("original-import-status"),
      importTranslationBtn: document.getElementById("import-translation-btn"),
      translationFileUpload: document.getElementById("translation-file-upload"),
      translationImportStatus: document.getElementById(
        "translation-import-status",
      ),
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
      const value = parseInt(e.target.value);
      this.elements.xtcSplitValue.textContent =
        value === 0 ? "No split" : `${value} pages each`;
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
    this.elements.enableProgressBars.addEventListener("change", () => {
      this.handleProgressBarsToggle();
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

    // Keyboard shortcut: 'v' to open viewer in new tab
    document.addEventListener("keydown", (e) => {
      // Only trigger if 'v' is pressed and we're not in a text input
      if (e.key === 'v' || e.key === 'V') {
        const activeElement = document.activeElement;
        const isTextInput = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );

        if (!isTextInput) {
          e.preventDefault();
          window.open('viewer.html', '_blank');
        }
      }
    });
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
    // Show JPEG quality only for formats that use JPEG (EPUB and ZIP)
    this.elements.jpegQualitySection.style.display =
      format === "epub" || format === "zip" ? "block" : "none";
  }

  switchMode(mode) {
    this.currentMode = mode;

    // Hide all mode sections
    this.elements.epubModeSections.style.display = "none";
    this.elements.arxivModeSections.style.display = "none";

    // Show selected mode
    if (mode === "epub") {
      this.elements.epubModeSections.style.display = "block";
    } else if (mode === "arxiv") {
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

      console.log(
        "loadChapter: mode =",
        this.currentMode,
        "index =",
        index,
        "html length =",
        html?.length,
      );

      const pageCount = await this.paginator.loadChapter(html, index);
      console.log("loadChapter: pageCount =", pageCount);

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
    const title = this.getChapterTitle(chapterIndex);

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

      // Calculate progress info if enabled
      let progressInfo = null;
      if (this.elements.enableProgressBars.checked && this.pageMap) {
        const currentChapterIndex = this.paginator.currentChapterIndex;
        const currentPageIndex = this.paginator.currentPageIndex;
        const currentPageInfo = this.pageMap[currentChapterIndex];
        // Progress at START of page (0-indexed), so page 0 = 0%, page 1 = 1/total, etc.
        const chapterProgress = currentPageIndex / currentPageInfo.pageCount;
        const bookProgress =
          (currentPageInfo.startPage - 1 + currentPageIndex) / this.totalPages;

        // Calculate chapter boundary positions
        const chapterMarkers = this.pageMap.map(
          (chapter) => (chapter.startPage - 1) / this.totalPages,
        );

        progressInfo = { chapterProgress, bookProgress, chapterMarkers };
        console.log(
          "Progress bars enabled - progressInfo:",
          progressInfo,
          "chapterIdx:",
          currentChapterIndex,
          "pageIdx:",
          currentPageIndex,
          "pageMap:",
          this.pageMap,
        );
      } else {
        console.log(
          "Progress bars NOT active - checked:",
          this.elements.enableProgressBars?.checked,
          "pageMap:",
          !!this.pageMap,
        );
      }

      const blob = await this.renderer.renderPageToImage(
        pageElement,
        settings.fontFamily,
        settings,
        progressInfo,
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

        // Apply settings to paginator
        this.paginator.updateSettings({
          fontFamily: savedSettings.fontFamily,
          fontSize: savedSettings.fontSize,
          lineHeight: savedSettings.lineHeight,
        });
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
    if (this.currentMode === "imported")
      return this.importedChapters?.length || 0;
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
      if (!text.includes("BILINGUAL TRANSLATION FILE")) {
        throw new Error("Invalid file format - missing header");
      }

      if (!text.includes("=== PAGE")) {
        throw new Error("Invalid file format - no page markers found");
      }

      // Parse original pages
      const pageMap = this.translationManager.parseTranslationFile(text);

      if (pageMap.size === 0) {
        throw new Error("No pages found in file");
      }

      // Store as original map
      this.originalMap = pageMap;

      // Show success
      this.elements.originalImportStatus.textContent = `✓ Imported ${pageMap.size} original pages`;
      this.elements.originalImportStatus.classList.remove("hidden");
      this.elements.originalImportStatus.style.color = "#859900";

      // If we have both maps, construct interleaved EPUB and load it
      if (this.originalMap && this.translationMap) {
        await this.loadInterleavedAsEPUB();
      }
    } catch (error) {
      this.elements.originalImportStatus.textContent = `✗ Error: ${error.message}`;
      this.elements.originalImportStatus.style.color = "#dc322f";
      this.elements.originalImportStatus.classList.remove("hidden");
    }

    // Reset file input
    event.target.value = "";
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
      const pageNumbers = Array.from(this.originalMap.keys()).sort(
        (a, b) => a - b,
      );

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

      console.log(
        `Loaded ${this.importedChapters.length} virtual chapters for pagination`,
      );
    } catch (error) {
      console.error("Error loading interleaved content:", error);
      alert(`Error loading interleaved content: ${error.message}`);
    }
  }

  /**
   * Export bilingual content from imported files only (no EPUB)
   */
  async exportFromImportedFiles(
    zip,
    outputFormat,
    settings,
    originalMap,
    translationMap,
  ) {
    try {
      const isZipBased = outputFormat === "zip" || outputFormat === "xth";
      const isBilingual = this.elements.enableTranslation?.checked || false;

      // Get all page numbers (use original map as source of truth)
      const pageNumbers = Array.from(originalMap.keys()).sort((a, b) => a - b);
      const totalPages = isBilingual
        ? pageNumbers.length * 2
        : pageNumbers.length;

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

        const { scaledElement: origElement } =
          await this.paginator.loadTranslatedPageWithScaling(
            originalHTML,
            settings.fontSize,
          );

        await this.renderAndAddPage(
          origElement,
          outputFormat,
          zip,
          globalPageNumber,
          settings,
        );
        globalPageNumber++;

        // Render translated page if bilingual mode
        if (isBilingual && translationMap.has(pageNum)) {
          const translatedHTML = translationMap.get(pageNum);
          this.updateProgress(
            `Rendering translated page ${pageNum}...`,
            progress,
          );

          const { scaledElement: transElement } =
            await this.paginator.loadTranslatedPageWithScaling(
              translatedHTML,
              settings.fontSize,
            );

          await this.renderAndAddPage(
            transElement,
            outputFormat,
            zip,
            globalPageNumber,
            settings,
          );
          globalPageNumber++;
        }
      }

      // Generate output file
      await this.finalizeExport(outputFormat, zip, "imported-translation");

      this.updateProgress(
        `Export complete! ${globalPageNumber - 1} pages exported.`,
        100,
      );

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
  async renderAndAddPage(
    pageElement,
    outputFormat,
    zip,
    globalPageNumber,
    settings,
  ) {
    if (outputFormat === "xth" || outputFormat === "xtc") {
      const canvas = await this.renderer.renderPageToCanvas(
        pageElement,
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
          this.xtcBuilder.addPage(xthBuffer);
        }
      }
    } else {
      const blob = await this.renderer.renderPageToImage(
        pageElement,
        settings.fontFamily,
        settings,
      );
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
      console.log(
        "showImportedPagePreview called with pageNumber:",
        pageNumber,
        "showOriginal:",
        showOriginal,
      );

      // Get HTML from appropriate map
      const html = showOriginal
        ? this.originalMap?.get(pageNumber)
        : this.translationMap?.get(pageNumber);

      console.log("HTML found:", html ? html.substring(0, 100) : "null");

      if (!html) {
        console.warn(
          `No imported page found for page ${pageNumber} (${showOriginal ? "original" : "translation"})`,
        );
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
      const tempContainer = document.createElement("div");
      tempContainer.style.width = `${this.paginator.width}px`;
      tempContainer.style.height = `${this.paginator.height}px`;
      tempContainer.style.padding = `${this.paginator.padding}px`;
      tempContainer.style.overflow = "hidden";
      tempContainer.style.position = "relative";
      tempContainer.style.backgroundColor = "#fff";
      tempContainer.style.boxSizing = "border-box";
      tempContainer.style.fontFamily = settings.fontFamily;
      tempContainer.style.fontSize = `${settings.fontSize}px`;
      tempContainer.style.lineHeight = settings.lineHeight;
      tempContainer.innerHTML = html;

      console.log(
        "tempContainer created, innerHTML length:",
        tempContainer.innerHTML.length,
      );

      // Update HTML preview viewport
      console.log(
        "htmlPreviewContainer exists:",
        !!this.paginator.htmlPreviewContainer,
      );

      if (this.paginator.htmlPreviewContainer) {
        this.paginator.htmlPreviewContainer.innerHTML = "";

        // Create wrapper to hold the preview
        const wrapper = document.createElement("div");
        wrapper.style.width = `${this.paginator.width}px`;
        wrapper.style.height = `${this.paginator.height}px`;
        wrapper.style.overflow = "hidden";
        wrapper.style.position = "relative";
        wrapper.style.backgroundColor = "#fff";

        wrapper.appendChild(tempContainer);
        this.paginator.htmlPreviewContainer.appendChild(wrapper);

        console.log("Preview added to htmlPreviewContainer");
      } else {
        console.error("htmlPreviewContainer not found!");
      }

      // Update page info
      const isBilingual = this.elements.enableTranslation?.checked || false;
      const totalPages = isBilingual
        ? (this.originalMap?.size || 0) * 2
        : Math.max(this.originalMap?.size || 0, this.translationMap?.size || 0);

      const pageType = showOriginal ? "Original" : "Translation";
      this.elements.chapterTitle.textContent = `Imported ${pageType}`;
      this.elements.pageInfo.textContent = `Page ${pageNumber} (${pageType})`;
    } catch (error) {
      console.error("Error showing imported page preview:", error);
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
   * Handle progress bars toggle
   * When enabled, triggers pre-pagination and stores page map
   */
  async handleProgressBarsToggle() {
    if (this.elements.enableProgressBars.checked && this.epubLoaded) {
      // Save current position
      const savedChapterIndex = this.paginator.currentChapterIndex;
      const savedPageIndex = this.paginator.currentPageIndex;

      // Trigger pre-pagination
      await this.prePaginateAll();

      // Restore position
      await this.loadChapter(savedChapterIndex);
      this.paginator.goToPage(savedPageIndex);
      this.updateNavigationButtons();
      await this.updateImagePreview();
    } else {
      // Clear page map
      this.pageMap = null;
      this.totalPages = 0;

      // Reset button text
      this.elements.convertBtn.textContent = "Convert & Export";

      // Reload current chapter to update preview (remove progress bars)
      if (this.epubLoaded) {
        await this.loadChapter(this.paginator.currentChapterIndex);
      }
    }
  }

  /**
   * Pre-paginate all chapters to build page map
   */
  async prePaginateAll() {
    const totalChapters = this.getTotalChapters();
    this.pageMap = [];
    this.totalPages = 0;

    this.elements.progressContainer.classList.remove("hidden");

    for (let i = 0; i < totalChapters; i++) {
      this.updateProgress(
        `Analyzing chapter ${i + 1}/${totalChapters}... (${this.totalPages} pages found)`,
        ((i + 1) / totalChapters) * 100,
      );

      const html = await this.getChapterContentByMode(i);
      await this.paginator.loadChapter(html, i);
      const pageCount = this.paginator.pageCount;

      this.pageMap.push({
        chapterIndex: i,
        chapterTitle: this.getChapterTitle(i),
        pageCount,
        startPage: this.totalPages + 1,
        endPage: this.totalPages + pageCount,
      });

      this.totalPages += pageCount;
    }

    this.updateProgress(
      `Analysis complete! Found ${this.totalPages} pages total.`,
      100,
    );

    // Update convert button with time estimate
    this.updateConvertButtonWithEstimate();

    setTimeout(() => {
      this.elements.progressContainer.classList.add("hidden");
    }, 2000);
  }

  /**
   * Update convert button text with time estimate
   */
  updateConvertButtonWithEstimate() {
    if (this.totalPages > 0) {
      // Estimate ~500ms per page (based on html2canvas performance)
      const estimatedSeconds = Math.ceil((this.totalPages * 0.5));
      const minutes = Math.floor(estimatedSeconds / 60);
      const seconds = estimatedSeconds % 60;

      let timeStr = "";
      if (minutes > 0) {
        timeStr = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
      } else {
        timeStr = `${seconds}s`;
      }

      this.elements.convertBtn.textContent = `Convert & Export (~${timeStr})`;
    } else {
      this.elements.convertBtn.textContent = "Convert & Export";
    }
  }

  /**
   * Get chapter content based on current mode
   */
  async getChapterContentByMode(index) {
    if (this.currentMode === "imported") {
      return this.importedChapters[index];
    } else if (this.currentMode === "arxiv") {
      return this.arxivChapters[index];
    } else {
      return await this.parser.getChapterContent(index);
    }
  }

  /**
   * Prepare conversion options from UI state
   * @private
   */
  _prepareConversionOptions() {
    // Get metadata based on current mode
    const metadata =
      this.currentMode === "imported"
        ? { title: "Imported Translation", creator: "Unknown", language: "en" }
        : this.parser.metadata;

    // Determine total chapters based on mode
    let totalChapters;
    if (this.currentMode === "imported") {
      totalChapters = this.importedChapters.length;
    } else if (this.currentMode === "arxiv") {
      totalChapters = this.arxivChapters.length;
    } else {
      totalChapters = this.parser.spine.length;
    }

    // Create getChapterContent function based on mode
    const getChapterContent = async (index) => {
      if (this.currentMode === "imported") {
        return this.importedChapters[index];
      } else if (this.currentMode === "arxiv") {
        return this.arxivChapters[index];
      } else {
        return await this.parser.getChapterContent(index);
      }
    };

    // Create getChapterTitle function based on mode
    const getChapterTitle = (index) => {
      if (this.currentMode === "imported") {
        return `Page ${index + 1}`;
      } else if (this.currentMode === "arxiv") {
        return `Section ${index + 1}`;
      } else {
        return this.parser.spine[index]?.title || `Chapter ${index + 1}`;
      }
    };

    return {
      format: this.elements.outputFormat.value,
      settings: {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      },
      limits: {
        type: this.elements.limitType.value,
        value: parseInt(this.elements.limitValue.value) || 0,
      },
      xtc: {
        splitPages: parseInt(this.elements.xtcSplitPages.value) || 0,
        filenamePattern: this.elements.xtcFilenamePattern.value.trim(),
      },
      jpegQuality: parseInt(this.elements.jpegQuality.value) / 100,
      metadata,
      getChapterContent,
      getChapterTitle,
      totalChapters,
      suppressChapterMarkers: this.currentMode === "imported",
      enableProgressBars: this.elements.enableProgressBars.checked,
      pageMap: this.pageMap || null,
      totalPages: this.totalPages || 0,
    };
  }

  /**
   * Start conversion process using pipeline
   */
  async startConversion() {
    if (!this.epubLoaded || this.isConverting) return;

    this.isConverting = true;

    try {
      // Prepare conversion options
      const options = this._prepareConversionOptions();

      // Delegate to controller (which handles all UI updates)
      await this.conversionController.start(options);
    } catch (error) {
      console.error("Conversion error:", error);
      alert(`Conversion failed: ${error.message}`);
    } finally {
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
