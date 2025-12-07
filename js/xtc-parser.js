/**
 * XTC Parser Module
 * Reads and parses XTC container files for Xteink X4 devices.
 */

export class XTCParser {
  constructor(arrayBuffer) {
    this.buffer = arrayBuffer;
    this.view = new DataView(arrayBuffer);
    this.data = new Uint8Array(arrayBuffer);

    this.header = null;
    this.metadata = null;
    this.chapters = [];
    this.pageIndex = [];

    this.parse();
  }

  /**
   * Main parse method
   */
  parse() {
    this.parseHeader();

    if (this.header.hasMetadata) {
      this.parseMetadata();
    }

    if (
      this.header.hasChapters &&
      this.metadata &&
      this.metadata.chapterCount > 0
    ) {
      this.parseChapters();
    }

    this.parsePageIndex();
  }

  /**
   * Parse 48-byte header
   */
  parseHeader() {
    // Check magic number "XTC\0"
    const magic = String.fromCharCode(
      this.view.getUint8(0),
      this.view.getUint8(1),
      this.view.getUint8(2),
    );

    if (magic !== "XTC") {
      throw new Error(`Invalid XTC file: magic is "${magic}", expected "XTC"`);
    }

    this.header = {
      magic: magic,
      version: this.view.getUint16(4, true),
      pageCount: this.view.getUint16(6, true),
      readDirection: this.view.getUint8(8),
      hasMetadata: this.view.getUint8(9) === 1,
      hasThumbnails: this.view.getUint8(10) === 1,
      hasChapters: this.view.getUint8(11) === 1,
      currentPage: this.view.getUint32(12, true),
      metadataOffset: Number(this.view.getBigUint64(16, true)),
      indexOffset: Number(this.view.getBigUint64(24, true)),
      dataOffset: Number(this.view.getBigUint64(32, true)),
      thumbOffset: Number(this.view.getBigUint64(40, true)),
    };

    console.log("XTC Header:", this.header);
  }

  /**
   * Parse 256-byte metadata section
   */
  parseMetadata() {
    const offset = this.header.metadataOffset;
    const decoder = new TextDecoder("utf-8");

    // Title (128 bytes, 0x00-0x7F)
    const titleBytes = this.data.slice(offset, offset + 128);
    const titleEnd = titleBytes.indexOf(0);
    const title = decoder.decode(
      titleBytes.slice(0, titleEnd === -1 ? 128 : titleEnd),
    );

    // Author (64 bytes, 0x80-0xBF)
    const authorBytes = this.data.slice(offset + 0x80, offset + 0x80 + 64);
    const authorEnd = authorBytes.indexOf(0);
    const author = decoder.decode(
      authorBytes.slice(0, authorEnd === -1 ? 64 : authorEnd),
    );

    // Timestamp (0xF0-0xF3)
    const timestamp = this.view.getUint32(offset + 0xf0, true);

    // Chapter count (0xF6-0xF7)
    const chapterCount = this.view.getUint16(offset + 0xf6, true);

    this.metadata = {
      title: title || "Untitled",
      author: author || "Unknown",
      timestamp: timestamp,
      createTime: new Date(timestamp * 1000),
      chapterCount: chapterCount,
    };

    console.log("XTC Metadata:", this.metadata);
  }

  /**
   * Parse chapter entries (96 bytes each)
   */
  parseChapters() {
    const chaptersOffset = this.header.metadataOffset + 256;
    const chapterCount = this.metadata.chapterCount;
    const decoder = new TextDecoder("utf-8");

    for (let i = 0; i < chapterCount; i++) {
      const chapterOffset = chaptersOffset + i * 96;

      // Chapter name (80 bytes, 0x00-0x4F)
      const nameBytes = this.data.slice(chapterOffset, chapterOffset + 80);
      const nameEnd = nameBytes.indexOf(0);
      const name = decoder.decode(
        nameBytes.slice(0, nameEnd === -1 ? 80 : nameEnd),
      );

      // Start page (0x50-0x51)
      const startPage = this.view.getUint16(chapterOffset + 0x50, true);

      // End page (0x52-0x53)
      const endPage = this.view.getUint16(chapterOffset + 0x52, true);

      this.chapters.push({
        name: name,
        startPage: startPage,
        endPage: endPage,
      });
    }

    console.log("XTC Chapters:", this.chapters);
  }

  /**
   * Parse page index table (16 bytes per page)
   */
  parsePageIndex() {
    const indexOffset = this.header.indexOffset;
    const pageCount = this.header.pageCount;

    for (let i = 0; i < pageCount; i++) {
      const entryOffset = indexOffset + i * 16;

      this.pageIndex.push({
        offset: Number(this.view.getBigUint64(entryOffset, true)),
        size: this.view.getUint32(entryOffset + 8, true),
        width: this.view.getUint16(entryOffset + 12, true),
        height: this.view.getUint16(entryOffset + 14, true),
      });
    }

    console.log(`XTC Page Index: ${this.pageIndex.length} pages`);
  }

  /**
   * Get raw XTH data for a specific page
   * @param {number} pageIndex - Page index (0-based)
   * @returns {ArrayBuffer} XTH binary data
   */
  getPageData(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pageIndex.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const entry = this.pageIndex[pageIndex];
    return this.buffer.slice(entry.offset, entry.offset + entry.size);
  }

  /**
   * Get page dimensions
   * @param {number} pageIndex - Page index (0-based)
   * @returns {Object} {width, height}
   */
  getPageDimensions(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pageIndex.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const entry = this.pageIndex[pageIndex];
    return { width: entry.width, height: entry.height };
  }
}
