/**
 * Arxiv HTML Parser
 * Fetches and extracts content from Arxiv HTML papers
 */

export class ArxivParser {
  constructor() {
    this.arxivUrlPattern = /arxiv\.org\/html\/(\d+\.\d+)(v\d+)?/;
  }

  /**
   * Check if URL is valid Arxiv HTML link
   * @param {string} url
   * @returns {boolean}
   */
  isValidArxivUrl(url) {
    return this.arxivUrlPattern.test(url);
  }

  /**
   * Extract Arxiv ID from URL
   * @param {string} url - e.g., "https://arxiv.org/html/2511.15304v2"
   * @returns {string} - e.g., "2511.15304v2"
   */
  extractArxivId(url) {
    const match = url.match(this.arxivUrlPattern);
    return match ? match[1] + (match[2] || "") : null;
  }

  /**
   * Fetch Arxiv HTML paper
   * @param {string} url - Arxiv HTML URL
   * @returns {Promise<Document>} Parsed HTML document
   */
  async fetchPaper(url) {
    try {
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      return parser.parseFromString(html, "text/html");
    } catch (error) {
      throw new Error(`Failed to fetch Arxiv paper: ${error.message}`);
    }
  }

  /**
   * Extract paper metadata
   * @param {Document} doc
   * @returns {Object} - { title, authors, abstract, arxivId }
   */
  extractMetadata(doc) {
    const title =
      doc
        .querySelector("h1.ltx_title, .ltx_title_document, h1")
        ?.textContent?.trim() || "Untitled";

    // Extract authors
    const authorElements = doc.querySelectorAll(
      ".ltx_author, .ltx_personname, .ltx_authors",
    );
    const authors =
      Array.from(authorElements)
        .map((el) => el.textContent.trim())
        .filter((a) => a)
        .join(", ") || "Unknown";

    // Extract abstract
    const abstractEl = doc.querySelector(".ltx_abstract");
    const abstract = abstractEl ? abstractEl.textContent.trim() : "";

    return { title, authors, abstract };
  }

  /**
   * Clean and extract main content
   * @param {Document} doc
   * @returns {HTMLElement} Cleaned article content
   */
  extractContent(doc) {
    // Try to find main content container
    let article = doc.querySelector("article, main, .ltx_document, body");

    if (!article) {
      throw new Error("Could not find article content");
    }

    // Clone to avoid modifying original
    article = article.cloneNode(true);

    // Remove unwanted elements
    const removeSelectors = [
      "nav",
      "header",
      "footer",
      ".ltx_navigation",
      ".ltx_footer",
      ".ltx_header",
      ".ltx_page_footer",
      ".ltx_page_header",
      ".ltx_TOC",
      "script",
      "style",
      '[class*="navigation"]',
      '[class*="menu"]',
    ];

    removeSelectors.forEach((selector) => {
      article.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // Remove LaTeXML metadata comments
    const comments = [];
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_COMMENT);
    let comment;
    while ((comment = walker.nextNode())) {
      comments.push(comment);
    }
    comments.forEach((c) => c.remove());

    return article;
  }

  /**
   * Process paper from URL: fetch, extract, clean
   * @param {string} url
   * @returns {Promise<Object>} - { metadata, content, arxivId }
   */
  async processPaperFromUrl(url) {
    if (!this.isValidArxivUrl(url)) {
      throw new Error("Invalid Arxiv HTML URL");
    }

    const doc = await this.fetchPaper(url);

    // Fix image URLs BEFORE extracting (while in original doc context)
    const images = doc.querySelectorAll("img");
    for (const img of images) {
      try {
        // Convert relative to absolute URL
        const absoluteUrl = new URL(img.getAttribute("src"), url).href;
        img.setAttribute("src", absoluteUrl);
      } catch (e) {
        console.warn("Failed to resolve image URL:", img.src);
      }
    }

    const metadata = this.extractMetadata(doc);
    const content = this.extractContent(doc);

    // Images are now absolute URLs - html2canvas will handle them with useCORS/allowTaint

    return {
      metadata,
      content: content.innerHTML,
      arxivId: this.extractArxivId(url),
    };
  }

  /**
   * Process paper from pasted HTML
   * @param {string} html - Full HTML source
   * @returns {Object} - { metadata, content }
   */
  processPaperFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const metadata = this.extractMetadata(doc);
    const content = this.extractContent(doc);

    return {
      metadata,
      content: content.innerHTML,
      arxivId: null,
    };
  }
}
