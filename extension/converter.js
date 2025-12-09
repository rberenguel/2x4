/**
 * Extension Converter
 * Reuses PWA code but loads queue from chrome.storage automatically
 */

// Import all PWA modules (paths relative to parent directory)
import { ArticleParser } from "../js/article-parser.js";
import { XTHEncoder } from "../js/xth-encoder.js";
import { XTCBuilder } from "../js/xtc-builder.js";
import { FontEmbedder } from "../js/font-embed.js";
import { Paginator } from "../js/paginator.js";
import { Renderer } from "../js/renderer.js";
import { EPUBBuilder } from "../js/epub-builder.js";
import { ConversionPipeline } from "../js/conversion-pipeline.js";
import { ConversionController } from "../js/conversion-controller.js";

class ExtensionConverter {
  constructor() {
    this.articleParser = new ArticleParser();
    this.fontEmbedder = new FontEmbedder();
    this.paginator = new Paginator("#virtual-device");
    this.renderer = new Renderer(this.fontEmbedder);
    this.epubBuilder = new EPUBBuilder();
    this.xthEncoder = new XTHEncoder();
    this.xtcBuilder = new XTCBuilder();

    this.isConverting = false;
    this.currentChapterIndex = 0;

    this.initializeUI();

    // Create conversion pipeline and controller
    this.conversionPipeline = new ConversionPipeline({
      parser: this.articleParser,
      paginator: this.paginator,
      renderer: this.renderer,
      xthEncoder: this.xthEncoder,
      xtcBuilder: this.xtcBuilder,
      epubBuilder: this.epubBuilder,
    });

    this.conversionController = new ConversionController(
      this.conversionPipeline,
      {
        convertBtn: this.elements.convertBtn,
        progressBar: this.elements.progressFill,
        progressText: this.elements.progressText,
        progressContainer: this.elements.progressContainer,
      },
    );

    this.attachEventListeners();
    this.initializeCollapsibleSections();
    this.initializePreviewTabs();
    this.loadTypographySettings();
    this.loadQueueFromStorage();
    this.loadCalibrationScale();
  }

  initializeUI() {
    this.elements = {
      // Queue info
      queueStatus: document.getElementById("queue-status"),

      // Typography
      fontFamily: document.getElementById("font-family"),
      fontSize: document.getElementById("font-size"),
      fontSizeValue: document.getElementById("font-size-value"),
      lineHeight: document.getElementById("line-height"),
      lineHeightValue: document.getElementById("line-height-value"),

      // Image quality
      jpegQuality: document.getElementById("jpeg-quality"),
      jpegQualityValue: document.getElementById("jpeg-quality-value"),
      jpegQualitySection: document.getElementById("jpeg-quality-section"),

      // Output format
      outputFormat: document.getElementById("output-format"),
      xtcSplitSettings: document.getElementById("xtc-split-settings"),
      xtcFilenameSettings: document.getElementById("xtc-filename-settings"),
      xtcSplitPages: document.getElementById("xtc-split-pages"),
      xtcSplitValue: document.getElementById("xtc-split-value"),
      xtcFilenamePattern: document.getElementById("xtc-filename-pattern"),

      // Custom CSS
      customCSS: document.getElementById("custom-css"),
      applyCSSBtn: document.getElementById("apply-css-btn"),

      // Progress bars
      enableProgressBars: document.getElementById("enable-progress-bars"),

      // Convert
      convertBtn: document.getElementById("convert-btn"),
      progressContainer: document.getElementById("progress-container"),
      progressFill: document.getElementById("progress-fill"),
      progressText: document.getElementById("progress-text"),

      // Preview
      chapterTitle: document.getElementById("chapter-title"),
      pageInfo: document.getElementById("page-info"),
      htmlPreviewViewport: document.getElementById("html-preview-viewport"),
      prevChapterBtn: document.getElementById("prev-chapter-btn"),
      prevPageBtn: document.getElementById("prev-page-btn"),
      nextPageBtn: document.getElementById("next-page-btn"),
      nextChapterBtn: document.getElementById("next-chapter-btn"),

      // Preview tabs & viewports
      previewViewport: document.getElementById("preview-viewport"),
      actualSizeViewport: document.getElementById("actual-size-viewport"),
      sizeCalibration: document.getElementById("size-calibration"),
      sizeCalibrationValue: document.getElementById("size-calibration-value"),
    };

    // Update output format UI
    this.updateOutputFormatUI();
  }

  attachEventListeners() {
    // Typography
    this.elements.fontFamily.addEventListener("change", () => {
      this.updatePaginatorSettings();
      this.saveTypographySettings();
    });
    this.elements.fontSize.addEventListener("input", (e) => {
      this.elements.fontSizeValue.textContent = e.target.value;
      this.debouncedUpdatePaginatorSettings();
      this.saveTypographySettings();
    });
    this.elements.lineHeight.addEventListener("input", (e) => {
      this.elements.lineHeightValue.textContent = e.target.value;
      this.debouncedUpdatePaginatorSettings();
      this.saveTypographySettings();
    });

    // Image quality
    this.elements.jpegQuality.addEventListener("input", (e) => {
      this.elements.jpegQualityValue.textContent = e.target.value;
    });

    // Output format
    this.elements.outputFormat.addEventListener("change", () =>
      this.updateOutputFormatUI(),
    );
    this.elements.xtcSplitPages.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.elements.xtcSplitValue.textContent =
        value === 0 ? "No split" : `${value} pages each`;
    });

    // Custom CSS
    this.elements.applyCSSBtn.addEventListener("click", () => {
      this.updatePaginatorSettings();
    });

    // Progress bars
    this.elements.enableProgressBars.addEventListener("change", () => {
      this.handleProgressBarsToggle();
    });

    // Convert
    this.elements.convertBtn.addEventListener("click", () => {
      this.startConversion();
    });

    // Navigation
    this.elements.prevChapterBtn.addEventListener("click", () =>
      this.prevChapter(),
    );
    this.elements.prevPageBtn.addEventListener("click", () => this.prevPage());
    this.elements.nextPageBtn.addEventListener("click", () => this.nextPage());
    this.elements.nextChapterBtn.addEventListener("click", () =>
      this.nextChapter(),
    );

    // Size calibration
    this.elements.sizeCalibration.addEventListener("input", (e) => {
      const scale = e.target.value;
      this.elements.sizeCalibrationValue.textContent = scale;
      this.elements.actualSizeViewport.style.transform = `scale(${scale / 100})`;
      localStorage.setItem("calibrationScale", scale);
    });

    // Keyboard shortcut: 'v' to open viewer in new tab
    document.addEventListener("keydown", (e) => {
      // Only trigger if 'v' is pressed and we're not in a text input
      if (e.key === "v" || e.key === "V") {
        const activeElement = document.activeElement;
        const isTextInput =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable);

        if (!isTextInput) {
          e.preventDefault();
          chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
        }
      }
    });
  }

  initializeCollapsibleSections() {
    const collapsibles = document.querySelectorAll(".collapsible");
    collapsibles.forEach((header) => {
      header.addEventListener("click", () => {
        const section = header.closest(".settings-section");
        section.classList.toggle("collapsed");
      });
    });
  }

  initializePreviewTabs() {
    const tabs = document.querySelectorAll(".preview-tab");
    const columns = document.querySelectorAll(".preview-column");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const previewType = tab.dataset.preview;

        // Update active tab
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Update visible column
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

  loadTypographySettings() {
    const savedSettings = localStorage.getItem("typographySettings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.elements.fontFamily.value = settings.fontFamily || "Georgia";
        this.elements.fontSize.value = settings.fontSize || 16;
        this.elements.fontSizeValue.textContent = settings.fontSize || 16;
        this.elements.lineHeight.value = settings.lineHeight || 1.5;
        this.elements.lineHeightValue.textContent = settings.lineHeight || 1.5;

        // Apply to paginator
        this.paginator.updateSettings({
          fontFamily: this.elements.fontFamily.value,
          fontSize: parseInt(this.elements.fontSize.value),
          lineHeight: parseFloat(this.elements.lineHeight.value),
        });
      } catch (e) {
        console.warn("Failed to load typography settings:", e);
      }
    }
  }

  saveTypographySettings() {
    const settings = {
      fontFamily: this.elements.fontFamily.value,
      fontSize: parseInt(this.elements.fontSize.value),
      lineHeight: parseFloat(this.elements.lineHeight.value),
    };
    localStorage.setItem("typographySettings", JSON.stringify(settings));
  }

  loadCalibrationScale() {
    const savedScale = localStorage.getItem("calibrationScale");
    if (savedScale) {
      this.elements.sizeCalibration.value = savedScale;
      this.elements.sizeCalibrationValue.textContent = savedScale;
      this.elements.actualSizeViewport.style.transform = `scale(${savedScale / 100})`;
    }
  }

  updateOutputFormatUI() {
    const format = this.elements.outputFormat.value;
    const isXTC = format === "xtc";

    this.elements.xtcSplitSettings.style.display = isXTC ? "block" : "none";
    this.elements.xtcFilenameSettings.style.display = isXTC ? "block" : "none";
    // Show JPEG quality only for formats that use JPEG (EPUB and ZIP)
    this.elements.jpegQualitySection.style.display =
      format === "epub" || format === "zip" ? "block" : "none";
  }

  async loadQueueFromStorage() {
    try {
      const result = await chrome.storage.local.get("articleQueue");
      const queue = result.articleQueue || [];

      if (queue.length === 0) {
        this.elements.queueStatus.textContent = "No articles in queue";
        this.elements.queueStatus.style.color = "#dc322f";
        return;
      }

      // Create queue data structure
      const queueData = {
        version: "1.0",
        type: "article-queue",
        timestamp: Date.now(),
        metadata: {
          title:
            queue.length === 1
              ? queue[0].title
              : `Reading Queue (${queue.length} articles)`,
          creator: "Web Articles",
          language: queue[0]?.lang || "en",
        },
        articles: queue,
      };

      // Load into article parser
      await this.articleParser.loadFromData(queueData);

      // Embed images in all articles before preview
      console.log("2X4: Embedding images in loaded queue...");
      for (let i = 0; i < this.articleParser.articles.length; i++) {
        const article = this.articleParser.articles[i];
        const beforeLength = article.content.length;
        article.content = await this.embedImages(article.content);
        const afterLength = article.content.length;
        console.log(
          `Article ${i + 1}: content length ${beforeLength} -> ${afterLength} (${afterLength > beforeLength ? "images embedded" : "no change"})`,
        );
      }
      console.log("2X4: Image embedding complete for all articles");

      // Update UI
      const wordCount = this.articleParser.getTotalWordCount();
      const readingTime = Math.ceil(wordCount / 200);
      this.elements.queueStatus.innerHTML = `
        <strong>${queue.length} article${queue.length > 1 ? "s" : ""}</strong><br>
        ${wordCount.toLocaleString()} words • ~${readingTime} min read
      `;
      this.elements.queueStatus.style.color = "";

      // Enable convert button
      this.elements.convertBtn.disabled = false;

      // Apply initial settings (without reloading chapter since we haven't loaded one yet)
      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };
      this.paginator.updateSettings(settings);

      // Load first article
      await this.loadChapter(0);
    } catch (error) {
      console.error("Error loading queue:", error);
      this.elements.queueStatus.textContent = `Error: ${error.message}`;
      this.elements.queueStatus.style.color = "#dc322f";
    }
  }

  debouncedUpdatePaginatorSettings() {
    if (this.settingsDebounceTimer) {
      clearTimeout(this.settingsDebounceTimer);
    }
    this.settingsDebounceTimer = setTimeout(() => {
      this.updatePaginatorSettings();
    }, 500);
  }

  updatePaginatorSettings() {
    const settings = {
      fontFamily: this.elements.fontFamily.value,
      fontSize: parseInt(this.elements.fontSize.value),
      lineHeight: parseFloat(this.elements.lineHeight.value),
      customCSS: this.elements.customCSS.value,
    };

    this.paginator.updateSettings(settings);

    // Reload current chapter if loaded
    if (this.articleParser.articles.length > 0) {
      this.loadChapter(this.currentChapterIndex);
    }
  }

  async loadChapter(chapterIndex) {
    try {
      this.currentChapterIndex = chapterIndex;

      const html = await this.articleParser.getChapterContent(chapterIndex);
      await this.paginator.loadChapter(html, chapterIndex);

      this.updateChapterInfo();
      this.updateNavigationButtons();
      await this.updateImagePreview();
      this.updateActualSizePreview();
    } catch (error) {
      console.error("Error loading chapter:", error);
    }
  }

  async updateImagePreview() {
    this.elements.previewViewport.innerHTML =
      '<div class="preview-placeholder"><p>Rendering...</p></div>';

    try {
      const pageElement = this.paginator.getCurrentPageElement();
      const settings = {
        fontFamily: this.elements.fontFamily.value,
        fontSize: parseInt(this.elements.fontSize.value),
        lineHeight: parseFloat(this.elements.lineHeight.value),
        customCSS: this.elements.customCSS.value,
      };

      // Set JPEG quality on renderer
      this.renderer.setJPEGQuality(
        parseInt(this.elements.jpegQuality.value) / 100,
      );

      // Calculate progress info if enabled
      let progressInfo = null;
      if (this.elements.enableProgressBars.checked && this.pageMap) {
        const currentPageIndex = this.paginator.currentPageIndex;
        const currentPageInfo = this.pageMap[this.currentChapterIndex];
        // Progress at START of page (0-indexed), so page 0 = 0%, page 1 = 1/total, etc.
        const chapterProgress = currentPageIndex / currentPageInfo.pageCount;
        const bookProgress =
          (currentPageInfo.startPage - 1 + currentPageIndex) / this.totalPages;

        // Calculate chapter boundary positions
        const chapterMarkers = this.pageMap.map(
          (chapter) => (chapter.startPage - 1) / this.totalPages,
        );

        progressInfo = { chapterProgress, bookProgress, chapterMarkers };
      }

      const blob = await this.renderer.renderPageToImage(
        pageElement,
        settings.fontFamily,
        settings,
        progressInfo,
      );
      const url = URL.createObjectURL(blob);

      this.elements.previewViewport.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: contain;" />`;
    } catch (error) {
      console.error("Error updating image preview:", error);
      this.elements.previewViewport.innerHTML = `<div class="preview-placeholder"><p>Error: ${error.message}</p></div>`;
    }
  }

  updateActualSizePreview() {
    this.elements.actualSizeViewport.innerHTML =
      '<div class="preview-placeholder"><p>Rendering...</p></div>';

    try {
      const pageElement = this.paginator.getCurrentPageElement();

      // Just show the HTML directly in actual size viewport
      // The actual-size class already handles the 5.5cm × 9cm sizing
      const img = document.createElement("img");
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";

      // Reuse the blob from image preview if available
      const existingImg = this.elements.previewViewport.querySelector("img");
      if (existingImg && existingImg.src) {
        img.src = existingImg.src;
        this.elements.actualSizeViewport.innerHTML = "";
        this.elements.actualSizeViewport.appendChild(img);
      } else {
        // Fallback: render again
        this.renderer
          .renderPageToImage(pageElement, this.elements.fontFamily.value, {})
          .then((blob) => {
            img.src = URL.createObjectURL(blob);
            this.elements.actualSizeViewport.innerHTML = "";
            this.elements.actualSizeViewport.appendChild(img);
          });
      }
    } catch (error) {
      console.error("Error updating actual size preview:", error);
      this.elements.actualSizeViewport.innerHTML = `<div class="preview-placeholder"><p>Error</p></div>`;
    }
  }

  updateChapterInfo() {
    const title = this.articleParser.getChapterTitle(this.currentChapterIndex);
    const pageInfo = this.paginator.getPageInfo();

    this.elements.chapterTitle.textContent = title;
    this.elements.pageInfo.textContent = `Chapter ${this.currentChapterIndex + 1}/${this.articleParser.getChapterCount()} • Page ${pageInfo.currentPage}/${pageInfo.totalPages}`;
  }

  updateNavigationButtons() {
    const pageInfo = this.paginator.getPageInfo();
    const totalChapters = this.articleParser.getChapterCount();

    this.elements.prevPageBtn.disabled = !pageInfo.hasPrevPage;
    this.elements.nextPageBtn.disabled = !pageInfo.hasNextPage;
    this.elements.prevChapterBtn.disabled = this.currentChapterIndex === 0;
    this.elements.nextChapterBtn.disabled =
      this.currentChapterIndex >= totalChapters - 1;
  }

  async prevPage() {
    if (this.paginator.prevPage()) {
      this.updateChapterInfo();
      this.updateNavigationButtons();
      await this.updateImagePreview();
      this.updateActualSizePreview();
    }
  }

  async nextPage() {
    if (this.paginator.nextPage()) {
      this.updateChapterInfo();
      this.updateNavigationButtons();
      await this.updateImagePreview();
      this.updateActualSizePreview();
    }
  }

  async prevChapter() {
    if (this.currentChapterIndex > 0) {
      await this.loadChapter(this.currentChapterIndex - 1);
    }
  }

  async nextChapter() {
    if (this.currentChapterIndex < this.articleParser.getChapterCount() - 1) {
      await this.loadChapter(this.currentChapterIndex + 1);
    }
  }

  updateProgress(text, percentage) {
    this.elements.progressText.textContent = text;
    this.elements.progressFill.style.width = `${percentage}%`;
  }

  /**
   * Handle progress bars toggle
   */
  async handleProgressBarsToggle() {
    if (
      this.elements.enableProgressBars.checked &&
      this.articleParser.articles.length > 0
    ) {
      // Save current position
      const savedChapterIndex = this.currentChapterIndex;
      const savedPageIndex = this.paginator.currentPageIndex;

      // Trigger pre-pagination
      await this.prePaginateAll();

      // Restore position
      await this.loadChapter(savedChapterIndex);
      this.paginator.goToPage(savedPageIndex);
      this.updateNavigationButtons();
      await this.updateImagePreview();
      this.updateActualSizePreview();
    } else {
      this.pageMap = null;
      this.totalPages = 0;

      // Reset button text
      this.elements.convertBtn.textContent = "Convert & Export";

      // Reload current chapter to update preview (remove progress bars)
      if (this.articleParser.articles.length > 0) {
        await this.loadChapter(this.currentChapterIndex);
      }
    }
  }

  /**
   * Pre-paginate all chapters
   */
  async prePaginateAll() {
    const totalChapters = this.articleParser.getChapterCount();
    this.pageMap = [];
    this.totalPages = 0;

    this.elements.progressContainer.classList.remove("hidden");

    for (let i = 0; i < totalChapters; i++) {
      this.updateProgress(
        `Analyzing chapter ${i + 1}/${totalChapters}... (${this.totalPages} pages found)`,
        ((i + 1) / totalChapters) * 100,
      );

      const html = await this.articleParser.getChapterContent(i);
      await this.paginator.loadChapter(html, i);
      const pageCount = this.paginator.pageCount;

      this.pageMap.push({
        chapterIndex: i,
        chapterTitle: this.articleParser.getChapterTitle(i),
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
      const estimatedSeconds = Math.ceil(this.totalPages * 0.5);
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
   * Prepare conversion options from UI state
   * @returns {Object} Options object for ConversionPipeline
   */
  _prepareConversionOptions() {
    const outputFormat = this.elements.outputFormat.value;

    // Get metadata from article parser
    const metadata = {
      title:
        this.articleParser.articles.length === 1
          ? this.articleParser.articles[0].title
          : `Reading Queue (${this.articleParser.articles.length} articles)`,
      creator: "Web Articles",
      language: this.articleParser.articles[0]?.lang || "en",
    };

    // Typography settings
    const settings = {
      fontFamily: this.elements.fontFamily.value,
      fontSize: parseInt(this.elements.fontSize.value),
      lineHeight: parseFloat(this.elements.lineHeight.value),
      customCSS: this.elements.customCSS.value,
    };

    // Apply settings to paginator before conversion
    this.paginator.updateSettings(settings);

    // XTC-specific options
    const xtcSplitPages =
      outputFormat === "xtc" ? parseInt(this.elements.xtcSplitPages.value) : 0;
    const xtcFilenamePattern =
      outputFormat === "xtc"
        ? this.elements.xtcFilenamePattern.value.trim()
        : "";

    // JPEG quality for image/epub output
    const jpegQuality = parseInt(this.elements.jpegQuality.value) / 100;
    this.renderer.setJPEGQuality(jpegQuality);

    // Chapter source function
    const getChapterContent = async (chapterIndex) => {
      return await this.articleParser.getChapterContent(chapterIndex);
    };

    const getChapterTitle = (chapterIndex) => {
      return this.articleParser.getChapterTitle(chapterIndex);
    };

    return {
      format: outputFormat,
      settings,
      limits: {
        type: "none",
        value: 0,
      },
      xtc: {
        splitPages: xtcSplitPages,
        filenamePattern: xtcFilenamePattern,
      },
      jpegQuality,
      metadata,
      getChapterContent,
      getChapterTitle,
      totalChapters: this.articleParser.getChapterCount(),
      suppressChapterMarkers: false,
      enableProgressBars: this.elements.enableProgressBars.checked,
      pageMap: this.pageMap || null,
      totalPages: this.totalPages || 0,
    };
  }

  /**
   * Embed images in article content as data URIs
   * @param {string} htmlContent - HTML content with img tags
   * @returns {Promise<string>} HTML with embedded data URIs
   */
  async embedImages(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const images = doc.querySelectorAll("img");

    console.log(`2X4: Embedding ${images.length} images...`);

    let embedded = 0;
    let skipped = 0;
    let failed = 0;

    const promises = Array.from(images).map(async (img) => {
      try {
        const src = img.getAttribute("src") || img.src;

        // Skip if already data URI
        if (!src || src.startsWith("data:")) {
          skipped++;
          return;
        }

        // Fetch image
        const response = await fetch(src);
        if (!response.ok) {
          console.warn(`Failed to fetch ${src}: HTTP ${response.status}`);
          img.remove();
          failed++;
          return;
        }

        const blob = await response.blob();

        // Skip if too large (>5MB)
        if (blob.size > 5 * 1024 * 1024) {
          console.warn(
            `Image too large (${(blob.size / 1024 / 1024).toFixed(2)}MB), skipping: ${src}`,
          );
          img.remove();
          skipped++;
          return;
        }

        // Convert to data URI
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        img.setAttribute("src", dataUrl);
        embedded++;
        console.log(
          `Embedded image (${(blob.size / 1024).toFixed(0)}KB): ${src}`,
        );
      } catch (error) {
        console.warn(`Failed to embed image ${img.src}:`, error.message);
        img.remove();
        failed++;
      }
    });

    await Promise.all(promises);
    console.log(
      `2X4: Image embedding complete: ${embedded} embedded, ${skipped} skipped, ${failed} failed`,
    );
    return doc.body.innerHTML;
  }

  /**
   * Start conversion process using the pipeline
   */
  async startConversion() {
    if (this.articleParser.articles.length === 0 || this.isConverting) return;

    this.isConverting = true;

    // Save original parser
    const originalParser = this.articleParser;

    try {
      // Show UI progress
      this.elements.convertBtn.disabled = true;
      this.elements.progressContainer.classList.remove("hidden");

      // Images are already embedded during queue load, so skip that step
      console.log("2X4: Starting conversion (images already embedded)...");

      // Separate Arxiv papers from regular articles
      const arxivPapers = [];
      const regularArticles = [];

      for (let i = 0; i < this.articleParser.articles.length; i++) {
        const article = this.articleParser.articles[i];
        if (article.url && /arxiv\.org\/html\//.test(article.url)) {
          arxivPapers.push({ article, index: i });
        } else {
          regularArticles.push(i);
        }
      }

      // Convert each Arxiv paper individually
      for (let i = 0; i < arxivPapers.length; i++) {
        const { article, index } = arxivPapers[i];
        console.log(
          `Converting Arxiv paper ${i + 1}/${arxivPapers.length}: ${article.title}`,
        );

        // Update progress
        const arxivProgress =
          ((i + 1) /
            (arxivPapers.length + (regularArticles.length > 0 ? 1 : 0))) *
          100;
        this.elements.progressFill.style.width = `${arxivProgress}%`;
        this.elements.progressText.textContent = `Converting Arxiv papers... ${i + 1}/${arxivPapers.length}`;

        // Create temporary ArticleParser with single article
        const tempParser = new ArticleParser();
        tempParser.queueData = {
          type: "article-queue",
          articles: [article],
          exportedAt: Date.now(),
          version: "1.0",
        };
        tempParser.articles = [article];

        // Update pipeline parser temporarily
        this.conversionPipeline.parser = tempParser;

        // Prepare options for single paper
        const options = this._prepareConversionOptions();

        // Extract Arxiv ID for filename
        const arxivIdMatch = article.url.match(
          /arxiv\.org\/html\/(\d+\.\d+v?\d*)/,
        );
        const arxivId = arxivIdMatch ? arxivIdMatch[1] : `arxiv-${index}`;

        // Use filenamePattern for Arxiv papers
        options.xtc.filenamePattern = arxivId;

        console.log(`Converting ${arxivId} with filename: ${arxivId}.xtc`);

        // Convert this paper directly with pipeline (no controller overhead)
        for await (const event of this.conversionPipeline.convert(options)) {
          // Handle completion event to download files
          if (event.type === "complete") {
            event.files.forEach((file) => {
              this._downloadFile(file.blob, file.filename);
            });
          }
        }
      }

      // Convert regular articles together if any
      if (regularArticles.length > 0) {
        console.log(`Converting ${regularArticles.length} regular articles`);

        this.elements.progressText.textContent = `Converting regular articles...`;

        // Create parser with only regular articles
        const regularArticleList = regularArticles.map(
          (i) => originalParser.articles[i],
        );
        const tempParser = new ArticleParser();
        tempParser.queueData = {
          type: "article-queue",
          articles: regularArticleList,
          exportedAt: Date.now(),
          version: "1.0",
        };
        tempParser.articles = regularArticleList;

        // Update pipeline parser
        this.conversionPipeline.parser = tempParser;

        // Convert regular articles
        const options = this._prepareConversionOptions();
        for await (const event of this.conversionPipeline.convert(options)) {
          // Update progress from pipeline events
          if (event.type === "render") {
            const progress = (event.pageNumber / event.totalPages) * 100;
            this.elements.progressFill.style.width = `${progress}%`;
            this.elements.progressText.textContent = `Rendering page ${event.pageNumber}/${event.totalPages}`;
          }
          // Handle completion event to download files
          if (event.type === "complete") {
            event.files.forEach((file) => {
              this._downloadFile(file.blob, file.filename);
            });
          }
        }
      }

      // Success
      this.elements.progressFill.style.width = "100%";
      this.elements.progressText.textContent = "Conversion complete!";
    } catch (error) {
      console.error("Conversion error:", error);
      this.elements.progressText.textContent = `Error: ${error.message}`;
      // Don't use alert - just log and show in progress text
    } finally {
      // Restore original parser
      this.conversionPipeline.parser = originalParser;
      this.articleParser = originalParser;
      this.isConverting = false;

      // Re-enable button and hide progress after delay
      setTimeout(() => {
        this.elements.convertBtn.disabled = false;
        this.elements.progressContainer.classList.add("hidden");
      }, 2000);
    }
  }

  /**
   * Download file via browser
   * @private
   */
  _downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  }
}

/**
 * Device Uploader - handles communication with X4 device HTTP API
 */
class DeviceUploader {
  constructor() {
    this.deviceIP = "192.168.3.3";
    this.currentPath = "/";
    this.pendingFiles = []; // {blob, filename}
    this.previewCache = new Map(); // Cache previews by filename

    this.elements = {
      deviceIP: document.getElementById("device-ip"),
      browseDeviceBtn: document.getElementById("browse-device-btn"),
      deviceStatus: document.getElementById("device-status"),
      modal: document.getElementById("device-browser-modal"),
      closeBrowserBtn: document.getElementById("close-browser-btn"),
      cancelBrowserBtn: document.getElementById("cancel-browser-btn"),
      uploadHereBtn: document.getElementById("upload-here-btn"),
      newFolderBtn: document.getElementById("new-folder-btn"),
      currentPath: document.getElementById("current-path"),
      folderList: document.getElementById("folder-list"),
      previewModal: document.getElementById("xtc-preview-modal"),
      closePreviewBtn: document.getElementById("close-preview-btn"),
      previewFilename: document.getElementById("preview-filename"),
      previewContent: document.getElementById("preview-content"),
    };

    this.loadDeviceIP();
    this.attachEventListeners();
  }

  attachEventListeners() {
    this.elements.browseDeviceBtn.addEventListener("click", () =>
      this.openBrowser(),
    );
    this.elements.closeBrowserBtn.addEventListener("click", () =>
      this.closeBrowser(),
    );
    this.elements.cancelBrowserBtn.addEventListener("click", () =>
      this.closeBrowser(),
    );
    this.elements.uploadHereBtn.addEventListener("click", () =>
      this.uploadFiles(),
    );
    this.elements.newFolderBtn.addEventListener("click", () =>
      this.showNewFolderDialog(),
    );

    // Save device IP when it changes
    this.elements.deviceIP.addEventListener("change", () =>
      this.saveDeviceIP(),
    );
    this.elements.deviceIP.addEventListener("blur", () => this.saveDeviceIP());

    // Preview modal close
    this.elements.closePreviewBtn.addEventListener("click", () =>
      this.closePreview(),
    );
  }

  closePreview() {
    this.elements.previewModal.style.display = "none";
  }

  async openBrowser() {
    this.deviceIP = this.elements.deviceIP.value.trim();

    if (!this.deviceIP) {
      this.showStatus("Please enter device IP address", "error");
      return;
    }

    // Test connection and open browser
    try {
      this.showStatus("Connecting to device...", "info");
      const status = await this.getDeviceStatus();
      this.showStatus(
        `Connected! Device: ${status.device_type || "X4"} (${(status.usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB used)`,
        "success",
      );

      // Open browser modal
      this.currentPath = "/";
      this.elements.modal.style.display = "block";
      await this.loadFolder(this.currentPath);
    } catch (error) {
      this.showStatus(`Connection failed: ${error.message}`, "error");
    }
  }

  closeBrowser() {
    this.elements.modal.style.display = "none";
  }

  async getDeviceStatus() {
    const response = await fetch(`http://${this.deviceIP}/status`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  async loadFolder(path) {
    this.currentPath = path;
    this.elements.currentPath.textContent = path || "/";
    this.elements.folderList.innerHTML =
      '<div style="text-align: center; color: #93a1a1; padding: 2rem;">Loading...</div>';

    try {
      const encodedPath = encodeURIComponent(path);
      const response = await fetch(
        `http://${this.deviceIP}/list?dir=${encodedPath}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const items = await response.json();
      this.renderFolderList(items);
    } catch (error) {
      this.elements.folderList.innerHTML = `<div style="text-align: center; color: #dc322f; padding: 2rem;">Error: ${error.message}</div>`;
    }
  }

  renderFolderList(items) {
    let html = "";

    // Parent directory link (if not at root)
    if (this.currentPath !== "/" && this.currentPath !== "") {
      const parentPath = this.currentPath.substring(
        0,
        this.currentPath.lastIndexOf("/"),
      );
      html += `
        <div style="padding: 0.75rem; border-bottom: 1px solid #eee8d5; display: flex; align-items: center; gap: 0.5rem;"
             data-path="${parentPath}" data-type="dir">
          <span style="font-size: 1.2rem; cursor: pointer;" class="folder-link">📁</span>
          <span style="font-weight: bold; cursor: pointer;" class="folder-link">..</span>
        </div>
      `;
    }

    // Sort: folders first, then files
    const folders = items.filter((i) => i.type === "dir");
    const files = items.filter((i) => i.type !== "dir");

    folders.forEach((item) => {
      const fullPath =
        this.currentPath === "/"
          ? `/${item.name}`
          : `${this.currentPath}/${item.name}`;
      html += `
        <div style="padding: 0.75rem; border-bottom: 1px solid #eee8d5; display: flex; align-items: center; gap: 0.5rem;"
             data-path="${fullPath}" data-type="dir">
          <span style="font-size: 1.2rem; cursor: pointer;" class="folder-link">📁</span>
          <span style="flex: 1; cursor: pointer;" class="folder-link">${item.name}</span>
          <button class="rename-item-btn" data-path="${fullPath}" data-name="${item.name}" data-item-type="dir"
                  style="background: none; border: none; color: #268bd2; cursor: pointer; font-size: 1rem; padding: 0.25rem 0.5rem;">✏️</button>
        </div>
      `;
    });

    files.forEach((item) => {
      const sizeStr = item.size
        ? `${(item.size / 1024 / 1024).toFixed(2)}MB`
        : "";
      const fullPath =
        this.currentPath === "/"
          ? `/${item.name}`
          : `${this.currentPath}/${item.name}`;
      const isXTC = item.name.toLowerCase().endsWith(".xtc") ||
                    item.name.toLowerCase().endsWith(".xtch");

      html += `
        <div style="padding: 0.75rem; border-bottom: 1px solid #eee8d5; display: flex; align-items: center; gap: 0.5rem; color: #93a1a1;">
          <span style="font-size: 1.2rem;">📄</span>
          <span style="flex: 1;">${item.name}</span>
          <span style="font-size: 0.85rem;">${sizeStr}</span>
          ${isXTC ? `<button class="preview-file-btn" data-path="${fullPath}" data-name="${item.name}"
                  style="background: none; border: none; color: #268bd2; cursor: pointer; font-size: 1.2rem; padding: 0.25rem 0.5rem;" title="Preview">👁️</button>` : ''}
          <button class="rename-item-btn" data-path="${fullPath}" data-name="${item.name}" data-item-type="file"
                  style="background: none; border: none; color: #268bd2; cursor: pointer; font-size: 1rem; padding: 0.25rem 0.5rem;">✏️</button>
          <button class="delete-file-btn" data-path="${fullPath}" data-name="${item.name}"
                  style="background: none; border: none; color: #dc322f; cursor: pointer; font-size: 1.2rem; padding: 0.25rem 0.5rem;">✕</button>
        </div>
      `;
    });

    if (items.length === 0) {
      html =
        '<div style="text-align: center; color: #93a1a1; padding: 2rem;">Empty folder</div>';
    }

    this.elements.folderList.innerHTML = html;

    // Add click handlers for folder navigation
    this.elements.folderList.querySelectorAll(".folder-link").forEach((el) => {
      el.addEventListener("click", () => {
        const parent = el.closest("[data-path]");
        const path = parent.getAttribute("data-path");
        this.loadFolder(path);
      });
    });

    // Add click handlers for rename buttons
    this.elements.folderList
      .querySelectorAll(".rename-item-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const path = btn.getAttribute("data-path");
          const name = btn.getAttribute("data-name");
          const itemType = btn.getAttribute("data-item-type");
          this.showRenameDialog(path, name, itemType);
        });
      });

    // Add click handlers for delete buttons
    this.elements.folderList
      .querySelectorAll(".delete-file-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const path = btn.getAttribute("data-path");
          const name = btn.getAttribute("data-name");
          this.confirmDelete(path, name);
        });
      });

    // Add click handlers for preview buttons
    this.elements.folderList
      .querySelectorAll(".preview-file-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const path = btn.getAttribute("data-path");
          const name = btn.getAttribute("data-name");
          this.showXTCPreview(path, name);
        });
      });
  }

  async uploadFiles() {
    // Open file picker
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = ".xtc,.epub,.jpg,.png,.pdf,.*"; // Accept all files

    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);

      if (files.length === 0) {
        return; // User cancelled
      }

      this.elements.uploadHereBtn.disabled = true;
      this.elements.uploadHereBtn.textContent = `Uploading ${files.length} file(s)...`;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const targetPath =
            this.currentPath === "/"
              ? `/${file.name}`
              : `${this.currentPath}/${file.name}`;

          console.log(`Uploading ${file.name} to ${targetPath}...`);

          const formData = new FormData();
          formData.append("data", file, targetPath);

          const response = await fetch(`http://${this.deviceIP}/edit`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          console.log(`Uploaded ${file.name} successfully`);
        }

        // Show success and reload folder
        this.elements.uploadHereBtn.textContent = `✓ Uploaded ${files.length} file(s)`;
        setTimeout(() => {
          this.elements.uploadHereBtn.textContent = "Upload Here";
        }, 2000);

        // Reload folder to show new files
        await this.loadFolder(this.currentPath);
      } catch (error) {
        console.error("Upload failed:", error);
        this.elements.uploadHereBtn.textContent = `✗ Upload failed`;
        setTimeout(() => {
          this.elements.uploadHereBtn.textContent = "Upload Here";
        }, 2000);
      } finally {
        this.elements.uploadHereBtn.disabled = false;
      }
    };

    // Trigger file picker
    fileInput.click();
  }

  confirmDelete(path, name) {
    // Create inline confirmation dialog
    const confirmDiv = document.createElement("div");
    confirmDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fdf6e3;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001;
      max-width: 400px;
    `;

    confirmDiv.innerHTML = `
      <h3 style="margin: 0 0 1rem 0; color: #dc322f;">Delete File?</h3>
      <p style="margin: 0 0 1rem 0; color: #586e75; word-break: break-all;">
        Are you sure you want to delete:<br>
        <strong>${name}</strong>
      </p>
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button id="confirm-delete-btn" style="padding: 0.5rem 1rem; background: #dc322f; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Delete
        </button>
        <button id="cancel-delete-btn" style="padding: 0.5rem 1rem; background: #93a1a1; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(confirmDiv);

    // Event handlers
    const confirmBtn = confirmDiv.querySelector("#confirm-delete-btn");
    const cancelBtn = confirmDiv.querySelector("#cancel-delete-btn");

    confirmBtn.addEventListener("click", async () => {
      document.body.removeChild(confirmDiv);
      await this.deleteFile(path, name);
    });

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(confirmDiv);
    });
  }

  async deleteFile(path, name) {
    console.log(`Deleting file: ${path}`);

    try {
      const formData = new FormData();
      formData.append("path", path);

      const response = await fetch(`http://${this.deviceIP}/edit`, {
        method: "DELETE",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      console.log(`Deleted ${name} successfully`);

      // Reload folder to reflect deletion
      await this.loadFolder(this.currentPath);
    } catch (error) {
      console.error("Delete failed:", error);
      this.showToast(`Delete failed: ${error.message}`, "error");
    }
  }

  showRenameDialog(path, oldName, itemType) {
    const itemLabel = itemType === "dir" ? "folder" : "file";
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fdf6e3;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001;
      min-width: 300px;
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 1rem 0; color: #268bd2;">Rename ${itemLabel}</h3>
      <input type="text" id="rename-input" value="${oldName}"
             style="width: 100%; padding: 0.5rem; border: 1px solid #93a1a1; border-radius: 4px; margin-bottom: 1rem; font-family: inherit;">
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button id="confirm-rename-btn" style="padding: 0.5rem 1rem; background: #268bd2; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Rename
        </button>
        <button id="cancel-rename-btn" style="padding: 0.5rem 1rem; background: #93a1a1; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(dialog);

    const input = dialog.querySelector("#rename-input");
    const confirmBtn = dialog.querySelector("#confirm-rename-btn");
    const cancelBtn = dialog.querySelector("#cancel-rename-btn");

    input.focus();
    input.select();

    const doRename = async () => {
      const newName = input.value.trim();
      if (!newName || newName === oldName) {
        document.body.removeChild(dialog);
        return;
      }
      document.body.removeChild(dialog);
      await this.renameItem(path, newName);
    };

    confirmBtn.addEventListener("click", doRename);
    cancelBtn.addEventListener("click", () =>
      document.body.removeChild(dialog),
    );
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doRename();
      if (e.key === "Escape") document.body.removeChild(dialog);
    });
  }

  async renameItem(oldPath, newName) {
    // Calculate new full path (same directory, new name)
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const newPath =
      parentPath === "" ? `/${newName}` : `${parentPath}/${newName}`;

    console.log(`Renaming ${oldPath} to ${newPath}`);

    try {
      const formData = new FormData();
      formData.append("src", oldPath); // source (old path)
      formData.append("path", newPath); // destination (new path)

      const response = await fetch(`http://${this.deviceIP}/edit`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      console.log(`Renamed successfully`);
      await this.loadFolder(this.currentPath);
    } catch (error) {
      console.error("Rename failed:", error);
      this.showToast(`Rename failed: ${error.message}`, "error");
    }
  }

  showNewFolderDialog() {
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fdf6e3;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001;
      min-width: 300px;
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 1rem 0; color: #268bd2;">New Folder</h3>
      <input type="text" id="folder-name-input" placeholder="Folder name"
             style="width: 100%; padding: 0.5rem; border: 1px solid #93a1a1; border-radius: 4px; margin-bottom: 1rem; font-family: inherit;">
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button id="confirm-folder-btn" style="padding: 0.5rem 1rem; background: #268bd2; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Create
        </button>
        <button id="cancel-folder-btn" style="padding: 0.5rem 1rem; background: #93a1a1; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(dialog);

    const input = dialog.querySelector("#folder-name-input");
    const confirmBtn = dialog.querySelector("#confirm-folder-btn");
    const cancelBtn = dialog.querySelector("#cancel-folder-btn");

    input.focus();

    const doCreate = async () => {
      const folderName = input.value.trim();
      if (!folderName) {
        document.body.removeChild(dialog);
        return;
      }
      document.body.removeChild(dialog);
      await this.createFolder(folderName);
    };

    confirmBtn.addEventListener("click", doCreate);
    cancelBtn.addEventListener("click", () =>
      document.body.removeChild(dialog),
    );
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doCreate();
      if (e.key === "Escape") document.body.removeChild(dialog);
    });
  }

  async createFolder(folderName) {
    const newPath =
      this.currentPath === "/"
        ? `/${folderName}`
        : `${this.currentPath}/${folderName}`;
    // Add trailing slash to indicate it's a directory
    const folderPath = newPath.endsWith("/") ? newPath : `${newPath}/`;
    console.log(`Creating folder: ${folderPath}`);

    try {
      const formData = new FormData();
      formData.append("path", folderPath);

      const response = await fetch(`http://${this.deviceIP}/edit`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      console.log(`Folder created successfully`);
      await this.loadFolder(this.currentPath);
    } catch (error) {
      console.error("Create folder failed:", error);
      this.showToast(`Create folder failed: ${error.message}`, "error");
    }
  }

  showToast(message, type) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${type === "error" ? "#dc322f" : "#859900"};
      color: #fff;
      padding: 1rem 1.5rem;
      border-radius: 4px;
      z-index: 10001;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 2000);
  }

  loadDeviceIP() {
    const savedIP = localStorage.getItem("deviceIP");
    if (savedIP) {
      this.elements.deviceIP.value = savedIP;
      this.deviceIP = savedIP;
    }
  }

  saveDeviceIP() {
    const ip = this.elements.deviceIP.value.trim();
    if (ip) {
      localStorage.setItem("deviceIP", ip);
      this.deviceIP = ip;
    }
  }

  /**
   * Show XTC file preview (first page only)
   * Efficient: downloads only header + first page (~5-10KB)
   */
  async showXTCPreview(filePath, filename) {
    // Check cache first
    if (this.previewCache.has(filename)) {
      this.displayPreview(filename, this.previewCache.get(filename));
      return;
    }

    // Show preview modal with loading state
    this.elements.previewFilename.textContent = filename;
    this.elements.previewContent.innerHTML =
      '<div style="text-align: center; color: #93a1a1">Loading preview...</div>';
    this.elements.previewModal.style.display = "block";

    try {
      // Fetch file but abort after reading first 100KB
      const controller = new AbortController();
      const signal = controller.signal;

      const response = await fetch(
        `http://${this.deviceIP}${filePath}?download=true`,
        { signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const chunks = [];
      let bytesRead = 0;
      const maxBytes = 100 * 1024; // 100KB limit

      try {
        while (bytesRead < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          bytesRead += value.length;

          if (bytesRead >= maxBytes) {
            controller.abort();
            break;
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") throw err;
      } finally {
        reader.releaseLock();
      }

      // Combine chunks into single ArrayBuffer
      const arrayBuffer = new Uint8Array(bytesRead);
      let offset = 0;
      for (const chunk of chunks) {
        arrayBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`Preview: Read ${bytesRead} bytes, aborted connection`);

      // Use existing XTCParser and XTHRenderer (they already work!)
      const { XTCParser } = await import("../js/xtc-parser.js");
      const { XTHRenderer } = await import("../js/xth-renderer.js");

      const parser = new XTCParser(arrayBuffer.buffer);

      // Get first page data (XTH format with header)
      const pageData = parser.getPageData(0);

      // Render using existing renderer
      const canvas = document.createElement("canvas");
      XTHRenderer.renderToCanvas(pageData, canvas);

      // Cache the canvas data URL
      const dataURL = canvas.toDataURL();
      this.previewCache.set(filename, dataURL);

      // Display preview
      this.displayPreview(filename, dataURL);
    } catch (error) {
      console.error("Preview error:", error);
      this.elements.previewContent.innerHTML = `
        <div style="text-align: center; color: #dc322f">
          <p>Failed to load preview</p>
          <p style="font-size: 0.85em; color: #586e75">${error.message}</p>
        </div>
      `;
    }
  }

  displayPreview(filename, dataURL) {
    this.elements.previewFilename.textContent = filename;
    this.elements.previewContent.innerHTML = `
      <img src="${dataURL}" style="max-width: 100%; max-height: 100%; border: 1px solid #93a1a1;" />
    `;
  }

  showStatus(message, type) {
    this.elements.deviceStatus.style.display = "block";
    this.elements.deviceStatus.textContent = message;
    this.elements.deviceStatus.style.backgroundColor =
      type === "success" ? "#859900" : type === "error" ? "#dc322f" : "#268bd2";
    this.elements.deviceStatus.style.color = "#fff";
  }
}

// Initialize converter when page loads
window.addEventListener("DOMContentLoaded", () => {
  window.converter = new ExtensionConverter();
  window.deviceUploader = new DeviceUploader();
});
