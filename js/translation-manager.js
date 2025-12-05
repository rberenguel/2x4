/**
 * Translation Manager
 * Manages export/import of translation text files with page markers
 */

export class TranslationManager {
  constructor() {
    this.pageMarker = "=== PAGE {number} ===";
    this.chapterMarker = "### CHAPTER {number}: {title} ###";
  }

  /**
   * Export pages to marked text file
   * @param {Array} pages - [{chapterIndex, chapterTitle, pageIndex, globalPageNumber, html}]
   * @param {Object} metadata - Book metadata {title, creator, language}
   * @returns {Blob} - Text file blob
   */
  exportPagesToText(pages, metadata) {
    let output = "BILINGUAL TRANSLATION FILE\n";
    output += `Book: ${metadata.title || "Unknown"}\n`;
    output += `Author: ${metadata.creator || "Unknown"}\n`;
    output += `Original Language: ${metadata.language || "unknown"}\n`;
    output += `Target Language: [TO BE FILLED]\n`;
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Instructions: Translate HTML between markers. Keep tags intact.\n`;
    output += `========================================\n\n`;

    let currentChapter = -1;

    for (const page of pages) {
      // Add chapter marker when chapter changes
      if (page.chapterIndex !== currentChapter) {
        output += `### CHAPTER ${page.chapterIndex + 1}: ${page.chapterTitle} ###\n\n`;
        currentChapter = page.chapterIndex;
      }

      // Add page marker and content
      output += `=== PAGE ${page.globalPageNumber} ===\n`;
      output += `${page.html}\n\n`;
    }

    return new Blob([output], { type: "text/plain;charset=utf-8" });
  }

  /**
   * Parse imported translation file
   * @param {string} text - File content
   * @returns {Map<number, string>} - Map of page number to translated HTML
   */
  parseTranslationFile(text) {
    const pageMap = new Map();

    // Regex to match page markers and extract content
    // Captures: page number and content until next marker or end
    const pageRegex =
      /=== PAGE (\d+) ===\n([\s\S]*?)(?=\n=== PAGE \d+ ===|\n### CHAPTER|$)/g;

    let match;
    while ((match = pageRegex.exec(text)) !== null) {
      const pageNumber = parseInt(match[1], 10);
      const html = match[2].trim();

      if (html.length > 0) {
        pageMap.set(pageNumber, html);
      }
    }

    return pageMap;
  }

  /**
   * Validate translation file structure
   * @param {string} text - File content
   * @param {number} expectedPageCount - Expected number of pages
   * @throws {Error} if validation fails
   */
  validateTranslationFile(text, expectedPageCount) {
    // Check for basic file structure
    if (!text.includes("BILINGUAL TRANSLATION FILE")) {
      throw new Error("Invalid translation file format - missing header");
    }

    if (!text.includes("=== PAGE")) {
      throw new Error(
        "Invalid translation file format - no page markers found",
      );
    }

    const pageMap = this.parseTranslationFile(text);

    // Check page count
    if (pageMap.size === 0) {
      throw new Error("No translated pages found in file");
    }

    if (pageMap.size !== expectedPageCount) {
      throw new Error(
        `Expected ${expectedPageCount} pages, found ${pageMap.size}`,
      );
    }

    // Check for sequential page numbers
    const pageNumbers = Array.from(pageMap.keys()).sort((a, b) => a - b);
    for (let i = 0; i < pageNumbers.length; i++) {
      const expected = i + 1;
      if (pageNumbers[i] !== expected) {
        throw new Error(
          `Missing or out-of-order page number. Expected ${expected}, found ${pageNumbers[i]}`,
        );
      }
    }

    // Check for duplicate page numbers
    const uniquePages = new Set(pageNumbers);
    if (uniquePages.size !== pageNumbers.length) {
      throw new Error("Duplicate page numbers found in file");
    }
  }
}
