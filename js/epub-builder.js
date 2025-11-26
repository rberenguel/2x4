/**
 * EPUB Builder Module
 * Creates image-based EPUB files
 */

export class EPUBBuilder {
  constructor() {
    this.images = [];
    this.metadata = {
      title: "Converted EPUB",
      creator: "Unknown",
      language: "en",
      identifier: this.generateUUID(),
    };
  }

  /**
   * Set metadata for the EPUB
   * @param {Object} metadata
   */
  setMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Add an image to the EPUB
   * @param {Blob} blob - Image blob
   * @param {number} index - Page number
   */
  addImage(blob, index) {
    this.images.push({
      blob: blob,
      filename: `images/page-${String(index).padStart(4, "0")}.jpg`,
      id: `img-${String(index).padStart(4, "0")}`,
      xhtmlFilename: `text/page-${String(index).padStart(4, "0")}.xhtml`,
      xhtmlId: `page-${String(index).padStart(4, "0")}`,
    });
  }

  /**
   * Generate EPUB file
   * @returns {Promise<Blob>}
   */
  async generate() {
    const zip = new JSZip();

    // Add mimetype (must be first, uncompressed)
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

    // Add META-INF/container.xml
    zip.file("META-INF/container.xml", this.generateContainerXML());

    // Add content.opf
    zip.file("OEBPS/content.opf", this.generateContentOPF());

    // Add toc.ncx (for older readers)
    zip.file("OEBPS/toc.ncx", this.generateTocNCX());

    // Add images
    for (const image of this.images) {
      zip.file(`OEBPS/${image.filename}`, image.blob);
    }

    // Add XHTML files (one per image)
    for (const image of this.images) {
      zip.file(`OEBPS/${image.xhtmlFilename}`, this.generateImageXHTML(image));
    }

    // Generate ZIP
    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/epub+zip",
    });

    return blob;
  }

  /**
   * Generate container.xml
   */
  generateContainerXML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  /**
   * Generate content.opf
   */
  generateContentOPF() {
    const manifestItems = this.images
      .map(
        (img) => `
    <item id="${img.id}" href="${img.filename}" media-type="image/jpeg"/>
    <item id="${img.xhtmlId}" href="${img.xhtmlFilename}" media-type="application/xhtml+xml"/>`,
      )
      .join("");

    const spineItems = this.images
      .map(
        (img) => `
    <itemref idref="${img.xhtmlId}"/>`,
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${this.metadata.identifier}</dc:identifier>
    <dc:title>${this.escapeXML(this.metadata.title)}</dc:title>
    <dc:creator>${this.escapeXML(this.metadata.creator)}</dc:creator>
    <dc:language>${this.metadata.language}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().split(".")[0]}Z</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>${manifestItems}
  </manifest>
  <spine toc="ncx">${spineItems}
  </spine>
</package>`;
  }

  /**
   * Generate toc.ncx
   */
  generateTocNCX() {
    const navPoints = this.images
      .map(
        (img, index) => `
    <navPoint id="navpoint-${index + 1}" playOrder="${index + 1}">
      <navLabel>
        <text>Page ${index + 1}</text>
      </navLabel>
      <content src="${img.xhtmlFilename}"/>
    </navPoint>`,
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${this.metadata.identifier}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${this.escapeXML(this.metadata.title)}</text>
  </docTitle>
  <navMap>${navPoints}
  </navMap>
</ncx>`;
  }

  /**
   * Generate XHTML file for an image
   */
  generateImageXHTML(image) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Page</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      text-align: center;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="../${image.filename}" alt="Page"/>
</body>
</html>`;
  }

  /**
   * Escape XML special characters
   */
  escapeXML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Generate UUID for identifier
   */
  generateUUID() {
    return (
      "urn:uuid:" +
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })
    );
  }

  /**
   * Clear images
   */
  clear() {
    this.images = [];
  }
}
