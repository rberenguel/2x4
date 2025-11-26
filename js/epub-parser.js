/**
 * EPUB Parser Module
 * Handles parsing of EPUB files using JSZip
 */

export class EPUBParser {
  constructor() {
    this.zip = null;
    this.opfDoc = null;
    this.opfPath = null;
    this.basePath = '';
    this.metadata = {};
    this.spine = [];
    this.manifest = {};
  }

  /**
   * Load and parse an EPUB file
   * @param {File} file - The EPUB file from input
   * @returns {Promise<void>}
   */
  async load(file) {
    try {
      this.zip = await JSZip.loadAsync(file);

      // Find and parse container.xml to locate the OPF file
      const containerXml = await this.zip.file('META-INF/container.xml').async('text');
      const parser = new DOMParser();
      const containerDoc = parser.parseFromString(containerXml, 'text/xml');

      // Get OPF file path
      const rootfile = containerDoc.querySelector('rootfile');
      this.opfPath = rootfile.getAttribute('full-path');
      this.basePath = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1);

      // Parse OPF file
      const opfContent = await this.zip.file(this.opfPath).async('text');
      this.opfDoc = parser.parseFromString(opfContent, 'text/xml');

      // Extract metadata
      this.parseMetadata();

      // Parse manifest (all files in EPUB)
      this.parseManifest();

      // Parse spine (reading order)
      this.parseSpine();

      return {
        metadata: this.metadata,
        spine: this.spine,
        chapterCount: this.spine.length
      };
    } catch (error) {
      console.error('Error loading EPUB:', error);
      throw new Error('Failed to parse EPUB file. Please ensure it is a valid EPUB.');
    }
  }

  /**
   * Parse metadata from OPF
   */
  parseMetadata() {
    const metadata = this.opfDoc.querySelector('metadata');

    this.metadata = {
      title: this.getMetadataValue(metadata, 'dc\\:title', 'title') || 'Unknown Title',
      creator: this.getMetadataValue(metadata, 'dc\\:creator', 'creator') || 'Unknown Author',
      language: this.getMetadataValue(metadata, 'dc\\:language', 'language') || 'en',
      identifier: this.getMetadataValue(metadata, 'dc\\:identifier', 'identifier') || '',
      publisher: this.getMetadataValue(metadata, 'dc\\:publisher', 'publisher') || '',
      date: this.getMetadataValue(metadata, 'dc\\:date', 'date') || ''
    };
  }

  /**
   * Helper to get metadata value (handles both namespaced and non-namespaced)
   */
  getMetadataValue(metadata, selector, fallbackSelector) {
    let element = metadata.querySelector(selector);
    if (!element) {
      element = metadata.querySelector(fallbackSelector);
    }
    return element ? element.textContent.trim() : null;
  }

  /**
   * Parse manifest (all resources in EPUB)
   */
  parseManifest() {
    const manifestElement = this.opfDoc.querySelector('manifest');
    const items = manifestElement.querySelectorAll('item');

    items.forEach(item => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type');

      this.manifest[id] = {
        href: this.basePath + href,
        mediaType: mediaType
      };
    });
  }

  /**
   * Parse spine (reading order)
   */
  parseSpine() {
    const spineElement = this.opfDoc.querySelector('spine');
    const itemrefs = spineElement.querySelectorAll('itemref');

    this.spine = [];
    itemrefs.forEach((itemref, index) => {
      const idref = itemref.getAttribute('idref');
      const manifestItem = this.manifest[idref];

      if (manifestItem) {
        this.spine.push({
          id: idref,
          href: manifestItem.href,
          index: index
        });
      }
    });
  }

  /**
   * Get chapter content by spine index
   * @param {number} index - Spine index
   * @returns {Promise<string>} Chapter HTML content
   */
  async getChapterContent(index) {
    if (index < 0 || index >= this.spine.length) {
      throw new Error('Chapter index out of bounds');
    }

    const spineItem = this.spine[index];
    const chapterFile = this.zip.file(spineItem.href);

    if (!chapterFile) {
      throw new Error(`Chapter file not found: ${spineItem.href}`);
    }

    let content = await chapterFile.async('text');

    // Parse HTML and extract body content
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const body = doc.querySelector('body');

    if (!body) {
      return content; // Return raw content if no body tag
    }

    // Process images and other resources
    content = await this.processContent(body, spineItem.href);

    return content;
  }

  /**
   * Process content to resolve relative paths for images, CSS, etc.
   * @param {HTMLElement} body - Body element
   * @param {string} chapterPath - Path to current chapter
   * @returns {Promise<string>}
   */
  async processContent(body, chapterPath) {
    const chapterDir = chapterPath.substring(0, chapterPath.lastIndexOf('/') + 1);

    // Process images
    const images = body.querySelectorAll('img');
    for (const img of images) {
      const src = img.getAttribute('src');
      if (src) {
        try {
          const fullPath = this.resolvePath(chapterDir, src);
          const imageFile = this.zip.file(fullPath);

          if (imageFile) {
            const blob = await imageFile.async('blob');
            const dataUrl = await this.blobToDataURL(blob);
            img.setAttribute('src', dataUrl);
          }
        } catch (error) {
          console.warn(`Failed to load image: ${src}`, error);
        }
      }
    }

    return body.innerHTML;
  }

  /**
   * Resolve relative paths
   * @param {string} base - Base path
   * @param {string} relative - Relative path
   * @returns {string}
   */
  resolvePath(base, relative) {
    if (relative.startsWith('/')) {
      return relative.substring(1);
    }

    // Handle ../ and ./
    const parts = (base + relative).split('/');
    const resolved = [];

    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else if (part !== '.' && part !== '') {
        resolved.push(part);
      }
    }

    return resolved.join('/');
  }

  /**
   * Convert blob to data URL
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get chapter title (if available)
   * @param {number} index - Spine index
   * @returns {string}
   */
  getChapterTitle(index) {
    if (index < 0 || index >= this.spine.length) {
      return '';
    }

    // For now, just return chapter number
    // TODO: Parse TOC/NCX for actual chapter titles
    return `Chapter ${index + 1}`;
  }
}
