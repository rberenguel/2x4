/**
 * Font Embedding Module
 * Loads font files and converts them to base64 for SVG embedding
 */

export class FontEmbedder {
  constructor() {
    this.fontCache = new Map();
    this.fontDefinitions = {
      Inter: [
        {
          path: "fonts/InterDisplay-Regular.woff2",
          weight: "normal",
          style: "normal",
        },
        {
          path: "fonts/InterDisplay-Bold.woff2",
          weight: "bold",
          style: "normal",
        },
        {
          path: "fonts/InterDisplay-Italic.woff2",
          weight: "normal",
          style: "italic",
        },
      ],
      Reforma: [
        {
          path: "fonts/Reforma1969-Blanca.woff2",
          weight: "normal",
          style: "normal",
        },
        {
          path: "fonts/Reforma1969-Negra.woff",
          weight: "bold",
          style: "normal",
        },
        {
          path: "fonts/Reforma1969-BlancaItalica.woff2",
          weight: "normal",
          style: "italic",
        },
      ],
      Roboto: [
        {
          path: "fonts/Roboto-Regular.woff",
          weight: "normal",
          style: "normal",
        },
      ],
      Monoid: [
        {
          path: "fonts/monoid-regular.woff2",
          weight: "normal",
          style: "normal",
        },
        { path: "fonts/monoid-bold.woff2", weight: "bold", style: "normal" },
        {
          path: "fonts/monoid-italic.woff2",
          weight: "normal",
          style: "italic",
        },
      ],
    };
  }

  /**
   * Load a font family and all its variants
   * @param {string} fontFamily - Font family name (Inter, Reforma, Roboto, Monoid)
   * @returns {Promise<Array>} Array of font data with base64
   */
  async loadFontFamily(fontFamily) {
    if (!this.fontDefinitions[fontFamily]) {
      throw new Error(`Unknown font family: ${fontFamily}`);
    }

    // Check cache first
    const cacheKey = fontFamily;
    if (this.fontCache.has(cacheKey)) {
      return this.fontCache.get(cacheKey);
    }

    const fonts = this.fontDefinitions[fontFamily];
    const loadedFonts = [];

    for (const font of fonts) {
      try {
        const base64 = await this.loadFontAsBase64(font.path);
        const format = this.getFontFormat(font.path);

        loadedFonts.push({
          family: fontFamily,
          weight: font.weight,
          style: font.style,
          base64: base64,
          format: format,
        });
      } catch (error) {
        console.warn(`Failed to load font: ${font.path}`, error);
      }
    }

    // Cache the result
    this.fontCache.set(cacheKey, loadedFonts);

    return loadedFonts;
  }

  /**
   * Load a font file and convert to base64
   * @param {string} path - Path to font file
   * @returns {Promise<string>} Base64 encoded font
   */
  async loadFontAsBase64(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch font: ${path}`);
    }

    const blob = await response.blob();
    return this.blobToBase64(blob);
  }

  /**
   * Convert blob to base64
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Extract just the base64 part (remove data:... prefix)
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get font format from file extension
   * @param {string} path
   * @returns {string}
   */
  getFontFormat(path) {
    if (path.endsWith(".woff2")) return "woff2";
    if (path.endsWith(".woff")) return "woff";
    if (path.endsWith(".ttf")) return "truetype";
    if (path.endsWith(".otf")) return "opentype";
    return "woff2"; // default
  }

  /**
   * Generate CSS @font-face rules for embedding in SVG
   * @param {Array} fonts - Array of loaded fonts
   * @returns {string} CSS string
   */
  generateFontFaceCSS(fonts) {
    return fonts
      .map((font) => {
        return `
        @font-face {
          font-family: '${font.family}';
          font-weight: ${font.weight};
          font-style: ${font.style};
          src: url('data:font/${font.format};base64,${font.base64}') format('${font.format}');
        }
      `;
      })
      .join("\n");
  }

  /**
   * Get complete CSS for a font family (preloaded)
   * @param {string} fontFamily
   * @returns {Promise<string>}
   */
  async getFontCSS(fontFamily) {
    const fonts = await this.loadFontFamily(fontFamily);
    return this.generateFontFaceCSS(fonts);
  }

  /**
   * Preload all fonts for faster conversion
   * @returns {Promise<void>}
   */
  async preloadAllFonts() {
    const fontFamilies = Object.keys(this.fontDefinitions);
    await Promise.all(
      fontFamilies.map((family) => this.loadFontFamily(family)),
    );
  }

  /**
   * Clear font cache
   */
  clearCache() {
    this.fontCache.clear();
  }
}
