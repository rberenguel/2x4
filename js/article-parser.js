/**
 * Article Parser Module
 * Parses web article queue exports from the 2X4 Chrome Extension
 */

export class ArticleParser {
  constructor() {
    this.queueData = null;
    this.articles = [];
    this.metadata = null;
    this.includeTOC = true; // Include table of contents by default
    this.tocIndexes = { start: null, end: null }; // Track TOC chapter indexes
  }

  /**
   * Load article queue from exported file
   * @param {File} file - The exported queue file from extension
   * @returns {Object} - { metadata, chapterCount }
   */
  async load(file) {
    try {
      const text = await file.text();

      // Parse JSON
      this.queueData = JSON.parse(text);

      // Validate structure
      if (!this.queueData.type || this.queueData.type !== "article-queue") {
        throw new Error(
          "Invalid file format. Expected article-queue export from 2X4 extension.",
        );
      }

      if (!this.queueData.articles || !Array.isArray(this.queueData.articles)) {
        throw new Error("No articles found in queue export.");
      }

      if (this.queueData.articles.length === 0) {
        throw new Error("Queue is empty.");
      }

      this.articles = this.queueData.articles;

      // Build metadata from queue
      const firstArticle = this.articles[0];
      this.metadata = {
        title:
          this.articles.length === 1
            ? firstArticle.title
            : `Reading Queue (${this.articles.length} articles)`,
        creator:
          this.articles.length === 1
            ? firstArticle.byline || firstArticle.siteName || "Unknown"
            : "Various",
        language: firstArticle.lang || "en",
      };

      return {
        metadata: this.metadata,
        chapterCount: this.getChapterCount(),
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          "Invalid JSON file. Make sure you're importing an exported queue from the 2X4 extension.",
        );
      }
      throw error;
    }
  }

  /**
   * Load article queue from data object (used when loading from chrome.storage)
   * @param {Object} queueData - Queue data structure
   * @returns {Object} - { metadata, chapterCount }
   */
  async loadFromData(queueData) {
    // Validate structure
    if (!queueData.type || queueData.type !== "article-queue") {
      throw new Error("Invalid data format. Expected article-queue structure.");
    }

    if (!queueData.articles || !Array.isArray(queueData.articles)) {
      throw new Error("No articles found in queue data.");
    }

    if (queueData.articles.length === 0) {
      throw new Error("Queue is empty.");
    }

    this.queueData = queueData;
    this.articles = queueData.articles;

    // Use provided metadata or build from articles
    this.metadata = queueData.metadata || {
      title:
        this.articles.length === 1
          ? this.articles[0].title
          : `Reading Queue (${this.articles.length} articles)`,
      creator:
        this.articles.length === 1
          ? this.articles[0].byline || this.articles[0].siteName || "Unknown"
          : "Various",
      language: this.articles[0].lang || "en",
    };

    return {
      metadata: this.metadata,
      chapterCount: this.articles.length,
    };
  }

  /**
   * Generate table of contents HTML
   * @returns {string} - TOC HTML content
   */
  generateTOC() {
    const entries = this.articles
      .map((article, index) => {
        const title = article.title || `Article ${index + 1}`;
        const domain =
          article.siteName || this._extractDomain(article.url) || "Unknown";

        return `
        <div class="toc-entry">
          <div class="toc-title">${this.escapeHtml(title)}</div>
          <div class="toc-domain">(${this.escapeHtml(domain)})</div>
        </div>
      `;
      })
      .join("");

    return `
      <div class="table-of-contents">
        <div class="toc-list">
          ${entries}
        </div>
        <div class="toc-footer">
          <p>${this.articles.length} article${this.articles.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
    `;
  }

  /**
   * Extract domain from URL
   * @param {string} url - URL to extract domain from
   * @returns {string} - Domain or empty string
   */
  _extractDomain(url) {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  /**
   * Get chapter content (each article is a chapter, with TOC at start and end)
   * @param {number} index - Chapter index (0-based, includes TOC chapters)
   * @returns {string} - HTML content
   */
  async getChapterContent(index) {
    const totalChapters = this.getChapterCount();

    if (index < 0 || index >= totalChapters) {
      throw new Error(
        `Chapter index ${index} out of range (0-${totalChapters - 1})`,
      );
    }

    if (!this.queueData) {
      throw new Error("No queue loaded");
    }

    // First chapter: TOC
    if (this.includeTOC && index === 0) {
      return this.generateTOC();
    }

    // Last chapter: TOC
    if (this.includeTOC && index === totalChapters - 1) {
      return this.generateTOC();
    }

    // Regular article chapter (offset by 1 if TOC is included)
    const articleIndex = this.includeTOC ? index - 1 : index;
    const article = this.articles[articleIndex];

    // Wrap content in article container with metadata header
    return `
      <article class="web-article" data-article-id="${article.id || articleIndex}">
        <header class="article-header">
          <h1 class="article-title">${this.escapeHtml(article.title)}</h1>
          ${article.byline ? `<p class="article-byline">by ${this.escapeHtml(article.byline)}</p>` : ""}
          ${article.siteName ? `<p class="article-source">${this.escapeHtml(article.siteName)}</p>` : ""}
          ${article.url ? `<p class="article-url">${this.escapeHtml(article.url)}</p>` : ""}
        </header>
        <div class="article-content">
          ${article.content}
        </div>
      </article>
    `;
  }

  /**
   * Get total chapter count (includes TOC chapters if enabled)
   * @returns {number} - Total chapters
   */
  getChapterCount() {
    if (!this.includeTOC) {
      return this.articles.length;
    }
    // TOC at start + articles + TOC at end
    return this.articles.length + 2;
  }

  /**
   * Get chapter title (article title or TOC title)
   * @param {number} index - Chapter index (includes TOC)
   * @returns {string} - Chapter title
   */
  getChapterTitle(index) {
    const totalChapters = this.getChapterCount();

    if (index < 0 || index >= totalChapters) {
      return "";
    }

    // First chapter: TOC
    if (this.includeTOC && index === 0) {
      return "Table of Contents";
    }

    // Last chapter: TOC
    if (this.includeTOC && index === totalChapters - 1) {
      return "Table of Contents";
    }

    // Regular article
    const articleIndex = this.includeTOC ? index - 1 : index;
    return this.articles[articleIndex]?.title || `Article ${articleIndex + 1}`;
  }

  /**
   * Get spine (list of articles as chapters, includes TOC)
   * @returns {Array} - Array of chapter objects
   */
  get spine() {
    const chapters = [];

    if (this.includeTOC) {
      // Add starting TOC
      chapters.push({
        id: "toc-start",
        href: "toc-start.html",
        title: "Table of Contents",
      });
    }

    // Add articles
    this.articles.forEach((article, index) => {
      chapters.push({
        id: article.id || `article-${index}`,
        href: `article-${index}.html`,
        title: article.title || `Article ${index + 1}`,
      });
    });

    if (this.includeTOC) {
      // Add ending TOC
      chapters.push({
        id: "toc-end",
        href: "toc-end.html",
        title: "Table of Contents",
      });
    }

    return chapters;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get total word count across all articles
   * @returns {number} - Total words
   */
  getTotalWordCount() {
    return this.articles.reduce(
      (sum, article) => sum + (article.wordCount || 0),
      0,
    );
  }

  /**
   * Get queue export timestamp
   * @returns {Date|null} - Export date
   */
  getExportDate() {
    return this.queueData?.exportedAt
      ? new Date(this.queueData.exportedAt)
      : null;
  }
}
