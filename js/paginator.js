/**
 * Paginator Module
 * Handles CSS column-based pagination of EPUB content
 */

export class Paginator {
  constructor(containerSelector = "#virtual-device") {
    this.container = document.querySelector(containerSelector);
    this.previewContainer = document.querySelector("#preview-viewport");
    this.htmlPreviewContainer = document.querySelector(
      "#html-preview-viewport",
    );

    if (!this.container) {
      throw new Error("Virtual device container not found");
    }

    // Settings
    this.width = 480;
    this.height = 800;
    this.padding = 20; // Padding to prevent text clipping
    this.contentWidth = this.width - this.padding * 2;
    this.contentHeight = this.height - this.padding * 2;
    this.currentChapterIndex = 0;
    this.currentPageIndex = 0;
    this.chapters = [];
    this.pageCount = 0;

    // User settings
    this.settings = {
      fontFamily: "Inter",
      fontSize: 16,
      lineHeight: 1.5,
      customCSS: "",
    };

    this.setupContainer();
  }

  /**
   * Setup the virtual device container
   */
  setupContainer() {
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;
    this.container.style.padding = `${this.padding}px`;
    this.container.style.columnWidth = `${this.contentWidth}px`;
    this.container.style.columnGap = `${this.padding * 2}px`; // Gap between columns
    this.container.style.columnFill = "auto";
    this.container.style.boxSizing = "border-box";
  }

  /**
   * Update user settings
   * @param {Object} settings
   */
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.applySettings();
  }

  /**
   * Apply current settings to container
   */
  applySettings() {
    this.container.style.fontFamily = this.settings.fontFamily;
    this.container.style.fontSize = `${this.settings.fontSize}px`;
    this.container.style.lineHeight = this.settings.lineHeight;

    // Apply custom CSS
    let styleElement = document.getElementById("custom-reader-styles");
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = "custom-reader-styles";
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = `
      #virtual-device {
        font-family: ${this.settings.fontFamily}, sans-serif;
        font-size: ${this.settings.fontSize}px;
        line-height: ${this.settings.lineHeight};
      }
      ${this.settings.customCSS}
    `;
  }

  /**
   * Load chapter content and calculate pages
   * @param {string} html - Chapter HTML content
   * @param {number} chapterIndex - Chapter index
   * @returns {number} Number of pages in this chapter
   */
  async loadChapter(html, chapterIndex) {
    console.log("paginator.loadChapter: start, html length =", html?.length);
    this.currentChapterIndex = chapterIndex;
    this.currentPageIndex = 0;

    // Apply settings
    this.applySettings();
    console.log("paginator.loadChapter: settings applied");

    // Inject content
    this.container.innerHTML = html;
    console.log("paginator.loadChapter: content injected");

    // Wait for images and fonts to load
    console.log("paginator.loadChapter: waiting for content to load...");
    await this.waitForContentLoad();
    console.log("paginator.loadChapter: content loaded");

    // Trigger hyphenation
    if (window.Hyphenopoly && window.Hyphenopoly.hyphenators) {
      console.log("paginator.loadChapter: running hyphenation...");
      await window.Hyphenopoly.hyphenators["en-us"](this.container);
      console.log("paginator.loadChapter: hyphenation done");
    }

    // Calculate page count
    // Each page is contentWidth wide + gap between columns
    const containerWidth = this.container.scrollWidth;
    const pageWidth = this.contentWidth + this.padding * 2;
    this.pageCount = Math.ceil(containerWidth / pageWidth);
    console.log(
      "paginator.loadChapter: pageCount =",
      this.pageCount,
      "containerWidth =",
      containerWidth,
      "pageWidth =",
      pageWidth,
    );

    // Store chapter info
    if (!this.chapters[chapterIndex]) {
      this.chapters[chapterIndex] = {};
    }
    this.chapters[chapterIndex].pageCount = this.pageCount;
    this.chapters[chapterIndex].html = html;

    // Update preview
    console.log("paginator.loadChapter: updating preview...");
    this.updatePreview();
    console.log("paginator.loadChapter: preview updated");

    return this.pageCount;
  }

  /**
   * Wait for images and fonts to load
   * @returns {Promise<void>}
   */
  async waitForContentLoad() {
    // Wait for images
    const images = this.container.querySelectorAll("img");
    console.log("waitForContentLoad: found", images.length, "images");

    const imagePromises = Array.from(images).map((img, index) => {
      // Data URIs are embedded and load synchronously - no need to wait
      if (img.src && img.src.startsWith("data:")) {
        console.log(
          "waitForContentLoad: image",
          index,
          "is data URI, skipping wait",
        );
        return Promise.resolve();
      }

      if (img.complete) {
        console.log("waitForContentLoad: image", index, "already complete");
        return Promise.resolve();
      }

      return Promise.race([
        new Promise((resolve) => {
          img.onload = () => {
            console.log("waitForContentLoad: image", index, "loaded");
            resolve();
          };
          img.onerror = (e) => {
            console.log("waitForContentLoad: image", index, "error", e);
            resolve(); // Continue even if image fails
          };
        }),
        new Promise((resolve) => {
          setTimeout(() => {
            console.log("waitForContentLoad: image", index, "timeout after 5s");
            resolve();
          }, 5000); // 5 second timeout per image
        }),
      ]);
    });

    await Promise.all(imagePromises);
    console.log("waitForContentLoad: all images done");

    // Wait for fonts
    if (document.fonts) {
      await document.fonts.ready;
    }

    // Small additional delay for layout stabilization
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Navigate to specific page in current chapter
   * @param {number} pageIndex
   */
  goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pageCount) {
      return false;
    }

    this.currentPageIndex = pageIndex;
    this.updatePreview();
    return true;
  }

  /**
   * Go to next page
   * @returns {boolean} Success
   */
  nextPage() {
    return this.goToPage(this.currentPageIndex + 1);
  }

  /**
   * Go to previous page
   * @returns {boolean} Success
   */
  prevPage() {
    return this.goToPage(this.currentPageIndex - 1);
  }

  /**
   * Update preview viewport
   */
  updatePreview() {
    // Don't apply transform to the hidden container
    // Just update the visible preview

    // Update HTML preview container if exists
    if (this.htmlPreviewContainer) {
      this.updateHTMLPreviewViewport();
    }
  }

  /**
   * Update the HTML preview viewport with current page
   */
  updateHTMLPreviewViewport() {
    // Check if container has content
    if (!this.container || !this.container.innerHTML) {
      return;
    }

    // Clear preview
    this.htmlPreviewContainer.innerHTML = "";

    // STEP 1: Temporarily move container on-screen to force column rendering
    // CSS columns don't fully render when positioned far off-screen
    const originalLeft = this.container.style.left;
    const originalTop = this.container.style.top;
    const originalZIndex = this.container.style.zIndex;
    const originalOpacity = this.container.style.opacity;
    const originalPointerEvents = this.container.style.pointerEvents;

    this.container.style.left = "0px";
    this.container.style.top = "0px";
    this.container.style.zIndex = "-9999";
    this.container.style.opacity = "0";
    this.container.style.pointerEvents = "none";

    // STEP 2: Force reflow to ensure columns are calculated
    this.container.offsetHeight; // Reading this property forces layout calculation

    // STEP 3: Clone with proper column layout
    const clone = this.container.cloneNode(true);

    // Get the full width of all columns before moving back
    const fullWidth = this.container.scrollWidth;

    // STEP 4: Move original back off-screen
    this.container.style.left = originalLeft;
    this.container.style.top = originalTop;
    this.container.style.zIndex = originalZIndex;
    this.container.style.opacity = originalOpacity;
    this.container.style.pointerEvents = originalPointerEvents;

    // STEP 5: Setup clone for preview
    const tempContainer = document.createElement("div");
    tempContainer.style.width = `${this.width}px`;
    tempContainer.style.height = `${this.height}px`;
    tempContainer.style.overflow = "hidden";
    tempContainer.style.position = "relative";
    tempContainer.style.backgroundColor = "#fff";

    clone.style.position = "absolute";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.opacity = "1";
    clone.style.zIndex = "1";
    clone.style.pointerEvents = "auto"; // Enable text selection
    clone.style.userSelect = "text"; // Enable text selection
    clone.style.width = `${fullWidth}px`; // Set to full width to show all columns
    const pageWidth = this.contentWidth + this.padding * 2;
    clone.style.transform = `translateX(${-(this.currentPageIndex * pageWidth)}px)`;

    tempContainer.appendChild(clone);
    this.htmlPreviewContainer.appendChild(tempContainer);
  }

  /**
   * Get current page info
   * @returns {Object}
   */
  getPageInfo() {
    return {
      currentPage: this.currentPageIndex + 1,
      totalPages: this.pageCount,
      currentChapter: this.currentChapterIndex + 1,
      hasNextPage: this.currentPageIndex < this.pageCount - 1,
      hasPrevPage: this.currentPageIndex > 0,
    };
  }

  /**
   * Get the current page content as HTML (for rendering)
   * @returns {HTMLElement}
   */
  getCurrentPageElement() {
    // Create a container that shows only the current page
    const pageContainer = document.createElement("div");
    pageContainer.style.width = `${this.width}px`;
    pageContainer.style.height = `${this.height}px`;
    pageContainer.style.overflow = "hidden";
    pageContainer.style.position = "relative";

    // Clone content
    const clone = this.container.cloneNode(true);
    clone.style.position = "absolute";
    clone.style.left = "0";
    clone.style.top = "0";
    const pageWidth = this.contentWidth + this.padding * 2;
    clone.style.transform = `translateX(${-(this.currentPageIndex * pageWidth)}px)`;

    pageContainer.appendChild(clone);

    return pageContainer;
  }

  /**
   * Load translated HTML with auto font scaling if overflow
   * @param {string} translatedHTML - Translated HTML content
   * @param {number} baseFontSize - Original font size (px)
   * @param {number} maxHeight - Target height in pixels (default 800)
   * @returns {Promise<Object>} - {scaledElement, finalFontSize}
   */
  async loadTranslatedPageWithScaling(
    translatedHTML,
    baseFontSize,
    maxHeight = 800,
  ) {
    const minFontSize = 10;
    const maxIterations = 10;
    let currentFontSize = baseFontSize;

    for (let i = 0; i < maxIterations; i++) {
      // Apply current font size
      this.container.style.fontSize = `${currentFontSize}px`;
      this.container.innerHTML = translatedHTML;

      // Wait for layout
      await this.waitForContentLoad();

      // Measure actual height
      const actualHeight = this.container.scrollHeight;

      // If fits or at minimum, return
      if (actualHeight <= maxHeight || currentFontSize <= minFontSize) {
        return {
          scaledElement: this.getCurrentPageElement(),
          finalFontSize: currentFontSize,
        };
      }

      // Reduce font by 10%
      currentFontSize = Math.max(minFontSize, currentFontSize * 0.9);
    }

    // Fallback to minimum
    return {
      scaledElement: this.getCurrentPageElement(),
      finalFontSize: minFontSize,
    };
  }

  /**
   * Clear current content
   */
  clear() {
    this.container.innerHTML = "";
    this.previewContainer.innerHTML =
      '<div class="preview-placeholder"><p>Upload an EPUB file to preview</p></div>';
    this.currentChapterIndex = 0;
    this.currentPageIndex = 0;
    this.pageCount = 0;
  }

  /**
   * Get total pages across all loaded chapters
   * @returns {number}
   */
  getTotalPages() {
    return this.chapters.reduce(
      (sum, chapter) => sum + (chapter?.pageCount || 0),
      0,
    );
  }

  /**
   * Calculate global page number (across all chapters)
   * @returns {number}
   */
  getGlobalPageNumber() {
    let globalPage = this.currentPageIndex + 1;

    for (let i = 0; i < this.currentChapterIndex; i++) {
      if (this.chapters[i]) {
        globalPage += this.chapters[i].pageCount;
      }
    }

    return globalPage;
  }
}
