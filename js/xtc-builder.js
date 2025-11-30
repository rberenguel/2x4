/**
 * XTC Builder Module
 * Creates XTC container files for Xteink X4 devices.
 * Based on the format specification from xtc-sample.js
 */

export class XTCBuilder {
  constructor() {
    this.pages = [];
    this.chapters = [];
    this.metadata = {
      title: "Untitled",
      creator: "Unknown"
    };
  }

  /**
   * Set metadata for the XTC file
   * @param {Object} metadata - { title, creator }
   */
  setMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Add a page (XTH binary data)
   * @param {ArrayBuffer} xthBuffer - The XTH binary data
   */
  addPage(xthBuffer) {
    this.pages.push(xthBuffer);
  }

  /**
   * Add a chapter marker
   * @param {string} name - Chapter name (max 79 chars)
   * @param {number} startPage - First page of chapter (0-indexed)
   */
  addChapter(name, startPage) {
    const normalizedName = this.normalizeChapterName(name);
    this.chapters.push({
      name: normalizedName,
      startPage: startPage,
      endPage: -1 // Will be calculated during generation
    });
  }

  /**
   * Normalize chapter name (remove control chars, limit length)
   */
  normalizeChapterName(name) {
    return name.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, 79);
  }

  /**
   * Generate the complete XTC file
   * @returns {ArrayBuffer}
   */
  generate() {
    const headerSize = 48;
    const metadataSize = 256;
    const chapterEntrySize = 96;
    const indexEntrySize = 16;

    const actualPageCount = this.pages.length;
    console.log(`XTCBuilder.generate(): ${actualPageCount} pages, ${this.chapters.length} chapters`);

    // Calculate chapter end pages
    const validChapters = this.chapters.filter(c => c.startPage >= 0 && c.startPage < actualPageCount);
    for (let i = 0; i < validChapters.length; i++) {
      if (i < validChapters.length - 1) {
        validChapters[i].endPage = validChapters[i + 1].startPage - 1;
      } else {
        validChapters[i].endPage = actualPageCount - 1;
      }
      if (validChapters[i].endPage < validChapters[i].startPage) {
        validChapters[i].endPage = validChapters[i].startPage;
      }
    }

    const chapterCount = validChapters.length;
    const hasChapters = chapterCount > 0 ? 1 : 0;

    // Calculate total data size
    let totalDataSize = 0;
    for (const page of this.pages) {
      totalDataSize += page.byteLength;
    }

    // Calculate offsets
    const metadataOffset = headerSize;
    const chaptersOffset = metadataOffset + metadataSize;
    const chaptersSize = chapterCount * chapterEntrySize;
    const indexOffset = chaptersOffset + chaptersSize;
    const actualIndexSize = actualPageCount * indexEntrySize;
    const actualDataOffset = indexOffset + actualIndexSize;
    const finalTotalSize = actualDataOffset + totalDataSize;

    // Create buffer
    const buffer = new ArrayBuffer(finalTotalSize);
    const view = new DataView(buffer);
    const dataArray = new Uint8Array(buffer);

    // === HEADER (48 bytes) ===
    // Magic "XTC\0"
    view.setUint8(0, 0x58); // 'X'
    view.setUint8(1, 0x54); // 'T'
    view.setUint8(2, 0x43); // 'C'
    view.setUint8(3, 0x00); // '\0'
    view.setUint8(4, 0x00);
    view.setUint8(5, 0x01); // Version?
    view.setUint16(6, actualPageCount, true); // Page count
    view.setUint8(8, 0);
    view.setUint8(9, 1);
    view.setUint8(10, 0);
    view.setUint8(11, hasChapters); // Has chapters flag
    view.setUint32(12, 1, true);

    // Offsets (8-byte addresses)
    view.setBigUint64(16, BigInt(metadataOffset), true);
    view.setBigUint64(24, BigInt(indexOffset), true);
    view.setBigUint64(32, BigInt(actualDataOffset), true);
    view.setBigUint64(40, BigInt(0), true);

    // === METADATA (256 bytes) ===
    const encoder = new TextEncoder();

    // Title (128 bytes, 0x00-0x7F)
    const titleBytes = encoder.encode(this.metadata.title);
    for (let i = 0; i < Math.min(titleBytes.length, 127); i++) {
      dataArray[metadataOffset + i] = titleBytes[i];
    }

    // Author (64 bytes, 0x80-0xBF)
    const authorBytes = encoder.encode(this.metadata.creator);
    for (let i = 0; i < Math.min(authorBytes.length, 63); i++) {
      dataArray[metadataOffset + 0x80 + i] = authorBytes[i];
    }

    // Timestamp (0xF0-0xF3)
    view.setUint32(metadataOffset + 0xF0, Math.floor(Date.now() / 1000), true);

    // Reserved (0xF4-0xF5)
    view.setUint16(metadataOffset + 0xF4, 0, true);

    // Chapter count (0xF6-0xF7)
    view.setUint16(metadataOffset + 0xF6, chapterCount, true);

    // === CHAPTERS (96 bytes each) ===
    for (let i = 0; i < validChapters.length; i++) {
      const chapterOffset = chaptersOffset + i * chapterEntrySize;
      const chapter = validChapters[i];

      // Chapter name (80 bytes, 0x00-0x4F)
      const nameBytes = encoder.encode(chapter.name);
      for (let j = 0; j < Math.min(nameBytes.length, 79); j++) {
        dataArray[chapterOffset + j] = nameBytes[j];
      }

      // Start page (0x50-0x51)
      view.setUint16(chapterOffset + 0x50, chapter.startPage, true);

      // End page (0x52-0x53)
      view.setUint16(chapterOffset + 0x52, chapter.endPage, true);
    }

    // === PAGE INDEX (16 bytes per page) ===
    let absoluteOffset = actualDataOffset;
    for (let i = 0; i < actualPageCount; i++) {
      const indexEntryAddr = indexOffset + i * indexEntrySize;
      const pageData = new Uint8Array(this.pages[i]);

      // Offset (8 bytes)
      view.setBigUint64(indexEntryAddr, BigInt(absoluteOffset), true);

      // Size (4 bytes)
      view.setUint32(indexEntryAddr + 8, pageData.byteLength, true);

      // Width (2 bytes)
      view.setUint16(indexEntryAddr + 12, 480, true);

      // Height (2 bytes)
      view.setUint16(indexEntryAddr + 14, 800, true);

      absoluteOffset += pageData.byteLength;
    }

    // === PAGE DATA ===
    let writeOffset = actualDataOffset;
    for (let i = 0; i < actualPageCount; i++) {
      const pageData = new Uint8Array(this.pages[i]);
      dataArray.set(pageData, writeOffset);
      writeOffset += pageData.byteLength;
    }

    return buffer;
  }

  /**
   * Clear all pages and chapters
   */
  clear() {
    this.pages = [];
    this.chapters = [];
    this.metadata = {
      title: "Untitled",
      creator: "Unknown"
    };
  }
}
