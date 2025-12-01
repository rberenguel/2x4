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

    this.epubLoaded = false;
    this.isConverting = false;
    this.currentMode = 'epub'; // 'epub' or 'arxiv'
    this.arxivChapters = []; // For multi-section Arxiv papers
    this.currentFilename = null; // For persistent settings
    this.settingsDebounceTimer = null; // For debouncing font settings updates

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
    };

    // Initialize output format UI
    this.updateOutputFormatUI();
  }

  attachEventListeners() {
    this.elements.modeEpub.addEventListener("change", () => this.switchMode('epub'));
    this.elements.modeArxiv.addEventListener("change", () => this.switchMode('arxiv'));
    this.elements.epubUpload.addEventListener("change", (e) => this.handleFileUpload(e));
    this.elements.loadArxivBtn.addEventListener("click", () => this.loadArxivFromUrl());
    this.elements.loadArxivPasteBtn.addEventListener("click", () => this.loadArxivFromPaste());
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
    this.elements.applyCSSBtn.addEventListener("click", () => this.updatePaginatorSettings());
    this.elements.outputFormat.addEventListener("change", () => this.updateOutputFormatUI());
    this.elements.xtcSplitPages.addEventListener("input", (e) => {
      this.elements.xtcSplitValue.textContent = e.target.value;
    });
    this.elements.limitType.addEventListener("change", (e) => {
      const limitType = e.target.value;
      this.elements.limitValueGroup.style.display = limitType === "none" ? "none" : "block";
      if (limitType === "chapters" && this.epubLoaded) {
        this.elements.limitValue.max = this.getTotalChapters();
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
    this.elements.sizeCalibration.addEventListener("input", (e) => {
      const scale = e.target.value / 100;
      this.elements.sizeCalibrationValue.textContent = e.target.value;
      this.elements.actualSizeViewport.style.transform = `scale(${scale})`;
      this.saveCalibrationScale(parseInt(e.target.value));
    });
    this.elements.convertBtn.addEventListener("click", () => this.startConversion());
  }

  initializeCollapsibleSections() {
    // Find all collapsible section headers
    const collapsibleHeaders = document.querySelectorAll('.settings-section h2.collapsible');

    collapsibleHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
      });
    });
  }

  initializePreviewTabs() {
    const tabs = document.querySelectorAll('.preview-tab');
    const columns = document.querySelectorAll('.preview-column');

    // Set first column as active by default
    if (columns.length > 0) {
      columns[0].classList.add('active');
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const previewType = tab.dataset.preview;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active column
        columns.forEach(col => {
          if (col.dataset.preview === previewType) {
            col.classList.add('active');
          } else {
            col.classList.remove('active');
          }
        });
      });
    });
  }

  updateOutputFormatUI() {
    const format = this.elements.outputFormat.value;
    this.elements.xtcSplitSettings.style.display = (format === 'xtc') ? 'block' : 'none';
    this.elements.xtcFilenameSettings.style.display = (format === 'xtc') ? 'block' : 'none';
  }

  switchMode(mode) {
    this.currentMode = mode;

    if (mode === 'epub') {
      this.elements.epubModeSections.style.display = 'block';
      this.elements.arxivModeSections.style.display = 'none';
    } else {
      this.elements.epubModeSections.style.display = 'none';
      this.elements.arxivModeSections.style.display = 'block';
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
      this.elements.arxivHtmlPaste.value = '';

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
      language: "en"
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
      const html = this.currentMode === 'arxiv'
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
    const title = this.currentMode === 'arxiv'
      ? (chapterIndex === 0 ? this.parser.metadata.title : `Section ${chapterIndex + 1}`)
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
    this.elements.nextChapterBtn.disabled = pageInfo.currentChapter >= this.getTotalChapters();
  }

  async updateImagePreview() {
    const scaledPreview = document.querySelector("#preview-viewport");
    const actualSizePreview = document.querySelector("#actual-size-viewport");

    scaledPreview.innerHTML = '<div class="preview-placeholder"><p>Rendering...</p></div>';
    actualSizePreview.innerHTML = '<div class="preview-placeholder"><p>Rendering...</p></div>';

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

      // Update scaled preview (fits to viewport)
      scaledPreview.innerHTML = `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: contain;" />`;

      // Update actual-size preview (shows at real 480×800 pixels)
      actualSizePreview.innerHTML = `<img src="${imageUrl}" />`;

      setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
    } catch (error) {
      console.error("Error updating preview:", error);
      scaledPreview.innerHTML = '<div class="preview-placeholder"><p>Preview error</p></div>';
      actualSizePreview.innerHTML = '<div class="preview-placeholder"><p>Preview error</p></div>';
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

    // Save settings after update completes
    await this.saveCurrentSettings();
  }

  async loadSavedSettings(filename) {
    try {
      const savedSettings = await this.settingsStorage.getSettingsForFile(filename);

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
      lineHeight: parseFloat(this.elements.lineHeight.value)
    };

    try {
      if (this.currentFilename && this.epubLoaded) {
        // Save for specific file
        await this.settingsStorage.saveSettingsForFile(this.currentFilename, settings);
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
    return this.currentMode === 'arxiv' ? this.arxivChapters.length : this.parser.spine.length;
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

      // Apply settings to paginator BEFORE conversion starts
      this.paginator.updateSettings(settings);

      const limitType = this.elements.limitType.value;
      const limitValue = parseInt(this.elements.limitValue.value);
      let globalPageNumber = 1;

      // Use different chapter sources based on mode
      const totalChapters = this.currentMode === 'arxiv' ? this.arxivChapters.length : this.parser.spine.length;
      let maxPages = Infinity;

      if (limitType === "chapters") totalChapters = Math.min(limitValue, totalChapters);
      else if (limitType === "pages") maxPages = limitValue;

      // XTC volume splitting variables
      const xtcSplitPages = outputFormat === "xtc" ? parseInt(this.elements.xtcSplitPages.value) : 0;
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

      // === PROCESSING LOOP ===
      for (let chapterIndex = 0; chapterIndex < totalChapters; chapterIndex++) {
        if (globalPageNumber > maxPages) break;
        this.updateProgress(`Loading chapter ${chapterIndex + 1}/${totalChapters}...`, 0);

        // Get chapter content based on mode
        const html = this.currentMode === 'arxiv'
          ? this.arxivChapters[chapterIndex]
          : await this.parser.getChapterContent(chapterIndex);

        await this.paginator.loadChapter(html, chapterIndex);
        const pageCount = this.paginator.pageCount;

        // Add chapter marker for XTC format (0-indexed page number)
        if (outputFormat === "xtc") {
          const chapterTitle = this.currentMode === 'arxiv'
            ? (chapterIndex === 0 ? this.parser.metadata.title : `Section ${chapterIndex + 1}`)
            : this.parser.getChapterTitle(chapterIndex);

          if (currentVolume) {
            currentVolume.builder.addChapter(chapterTitle, pagesInCurrentVolume);
          } else {
            this.xtcBuilder.addChapter(chapterTitle, globalPageNumber - 1);
          }
        }

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          if (globalPageNumber > maxPages) break;

          // Check if we need to start a new XTC volume
          if (outputFormat === "xtc" && (currentVolume === null || pagesInCurrentVolume >= xtcSplitPages)) {
            if (currentVolume !== null) {
              // Generate and download completed volume immediately
              const currentProgress = (chapterIndex * 100 + (pageIndex / pageCount) * 100) / totalChapters;
              this.updateProgress(`Generating & downloading volume ${currentVolume.volumeNumber}...`, currentProgress);

              const xtcBuffer = currentVolume.builder.generate();
              const outputBlob = new Blob([xtcBuffer], { type: "application/octet-stream" });

              const customPattern = this.elements.xtcFilenamePattern.value.trim();
              const baseTitle = customPattern ? this.sanitizeFilename(customPattern) : this.sanitizeFilename(this.parser.metadata.title);
              const startPage = String(currentVolume.startPage).padStart(4, "0");
              const endPage = String(currentVolume.startPage + currentVolume.pagesInVolume - 1).padStart(4, "0");
              const filename = `${startPage}-${baseTitle}-${endPage}.xtc`;

              const a = document.createElement("a");
              a.href = URL.createObjectURL(outputBlob);
              a.download = filename;
              a.click();
              URL.revokeObjectURL(a.href);

              await new Promise(resolve => setTimeout(resolve, 300));

              xtcVolumes.push(currentVolume);
              volumeNumber++;
            }

            // Create new volume
            const xtcBuilder = new XTCBuilder();
            xtcBuilder.setMetadata({
              title: this.parser.metadata.title,
              creator: this.parser.metadata.creator || "Unknown"
            });

            currentVolume = {
              builder: xtcBuilder,
              volumeNumber: volumeNumber,
              startPage: globalPageNumber,
              pagesInVolume: 0
            };

            pagesInCurrentVolume = 0;
          }

          this.paginator.goToPage(pageIndex);
          const progress = (chapterIndex * 100 + (pageIndex / pageCount) * 100) / totalChapters;

          // Start timing this page
          pageStartTime = performance.now();

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
                   if (currentVolume) {
                     currentVolume.builder.addPage(xthBuffer);
                     currentVolume.pagesInVolume++;
                     pagesInCurrentVolume++;
                   } else {
                     this.xtcBuilder.addPage(xthBuffer);
                   }
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

          // Track render time
          const pageEndTime = performance.now();
          const renderTime = pageEndTime - pageStartTime;
          totalRenderTime += renderTime;
          pagesRendered++;

          // Calculate time estimate
          let timeEstimate = '';
          if (pagesRendered >= 3 && estimatedTotalPages > 0) {
            avgTimePerPage = totalRenderTime / pagesRendered;
            const pagesRemaining = Math.min(estimatedTotalPages, maxPages) - pagesRendered;
            const secondsRemaining = Math.ceil((avgTimePerPage * pagesRemaining) / 1000);
            if (secondsRemaining > 60) {
              const minutes = Math.floor(secondsRemaining / 60);
              const seconds = secondsRemaining % 60;
              timeEstimate = ` • ~${minutes}m${seconds}s left`;
            } else if (secondsRemaining > 5) {
              timeEstimate = ` • ~${secondsRemaining}s left`;
            }
          }

          this.updateProgress(`Converting page ${globalPageNumber}... (Ch ${chapterIndex + 1}, Pg ${pageIndex + 1})${timeEstimate}`, progress);

          globalPageNumber++;
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

      // === FINAL GENERATION ===
      let outputBlob;
      let filename;

      if (outputFormat === "xtc") {
        // Generate final volume if using splitting
        if (currentVolume !== null && currentVolume.pagesInVolume > 0) {
          this.updateProgress(`Generating final volume ${currentVolume.volumeNumber}...`, 100);

          const xtcBuffer = currentVolume.builder.generate();
          outputBlob = new Blob([xtcBuffer], { type: "application/octet-stream" });

          const customPattern = this.elements.xtcFilenamePattern.value.trim();
          const baseTitle = customPattern ? this.sanitizeFilename(customPattern) : this.sanitizeFilename(this.parser.metadata.title);

          // Only use page numbers if this is truly a multi-volume book
          // (i.e., we already have other volumes, or this volume is split)
          if (xtcVolumes.length > 0) {
            // Multiple volumes - use page numbers
            const startPage = String(currentVolume.startPage).padStart(4, "0");
            const endPage = String(currentVolume.startPage + currentVolume.pagesInVolume - 1).padStart(4, "0");
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
          outputBlob = new Blob([xtcBuffer], { type: "application/octet-stream" });
          const customPattern = this.elements.xtcFilenamePattern.value.trim();
          const baseTitle = customPattern ? this.sanitizeFilename(customPattern) : this.sanitizeFilename(this.parser.metadata.title);
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