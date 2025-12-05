/**
 * Article Parser Module
 * Parses web article queue exports from the 2X4 Chrome Extension
 */

export class ArticleParser {
  constructor() {
    this.queueData = null;
    this.articles = [];
    this.metadata = null;
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
        chapterCount: this.articles.length,
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
   * Get chapter content (each article is a chapter)
   * @param {number} index - Article index (0-based)
   * @returns {string} - HTML content
   */
  async getChapterContent(index) {
    if (index < 0 || index >= this.articles.length) {
      throw new Error(
        `Article index ${index} out of range (0-${this.articles.length - 1})`,
      );
    }

    if (!this.queueData) {
      throw new Error("No queue loaded");
    }

    const article = this.articles[index];

    // Wrap content in article container with metadata header
    return `
      <article class="web-article" data-article-id="${article.id || index}">
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
   * Get chapter title (article title)
   * @param {number} index - Article index
   * @returns {string} - Article title
   */
  getChapterTitle(index) {
    if (index < 0 || index >= this.articles.length) {
      return "";
    }
    return this.articles[index].title || `Article ${index + 1}`;
  }

  /**
   * Get spine (list of articles as chapters)
   * @returns {Array} - Array of chapter objects
   */
  get spine() {
    return this.articles.map((article, index) => ({
      id: article.id || `article-${index}`,
      href: `article-${index}.html`,
      title: article.title || `Article ${index + 1}`,
    }));
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
