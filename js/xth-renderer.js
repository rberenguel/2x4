/**
 * XTH Renderer Module
 * Decodes XTH binary data and renders to canvas
 */

export class XTHRenderer {
  /**
   * Render XTH data to canvas
   * @param {ArrayBuffer} xthBuffer - XTH binary data
   * @param {HTMLCanvasElement} canvas - Target canvas element
   */
  static renderToCanvas(xthBuffer, canvas) {
    const view = new DataView(xthBuffer);
    const data = new Uint8Array(xthBuffer);

    // Parse XTH header (22 bytes)
    const header = this.parseHeader(view);

    // Set canvas dimensions
    canvas.width = header.width;
    canvas.height = header.height;

    // Decode bit planes to pixels
    const pixels = this.decodePixels(data, header);

    // Render to canvas
    this.drawPixels(canvas, pixels, header.width, header.height);
  }

  /**
   * Parse XTH header
   * @param {DataView} view
   * @returns {Object} {width, height, dataSize}
   */
  static parseHeader(view) {
    // Check magic number "XTH\0"
    const magic = view.getUint32(0, false);
    if (magic !== 0x58544800) {
      throw new Error(`Invalid XTH file: magic is 0x${magic.toString(16)}, expected 0x58544800`);
    }

    return {
      width: view.getUint16(4, true),
      height: view.getUint16(6, true),
      dataSize: view.getUint32(10, true),
      checksum: Number(view.getBigUint64(14, true)),
    };
  }

  /**
   * Decode XTH bit planes to pixel array
   * @param {Uint8Array} data - Full XTH file data
   * @param {Object} header - Parsed header
   * @returns {Uint8Array} Pixel values (0-3)
   */
  static decodePixels(data, header) {
    const { width, height, dataSize } = header;
    const headerSize = 22;

    // Calculate plane size
    const planeSize = dataSize / 2;

    // Extract bit planes (data after header)
    const plane1 = data.slice(headerSize, headerSize + planeSize);
    const plane2 = data.slice(headerSize + planeSize, headerSize + dataSize);

    // Create pixel array
    const pixels = new Uint8Array(width * height);

    // Decode in vertical scan order (right to left, top to bottom in 8-pixel blocks)
    let byteIndex = 0;
    for (let x = width - 1; x >= 0; x--) {
      for (let y = 0; y < height; y += 8) {
        const byte1 = plane1[byteIndex];
        const byte2 = plane2[byteIndex];
        byteIndex++;

        // Extract 8 pixels from this byte pair
        for (let i = 0; i < 8; i++) {
          if (y + i < height) {
            // Extract bits (MSB first, so bit 7 is y+0, bit 0 is y+7)
            const bit1 = (byte1 >> (7 - i)) & 1;
            const bit2 = (byte2 >> (7 - i)) & 1;

            // Combine to 2-bit value
            const twoBitValue = (bit1 << 1) | bit2;

            // Invert (encoding inverts with 3 - value, so we invert back)
            const pixelValue = 3 - twoBitValue;

            // Store in pixel array (row-major order)
            const pixelIndex = (y + i) * width + x;
            pixels[pixelIndex] = pixelValue;
          }
        }
      }
    }

    return pixels;
  }

  /**
   * Draw pixels to canvas
   * @param {HTMLCanvasElement} canvas
   * @param {Uint8Array} pixels - Pixel values (0-3)
   * @param {number} width
   * @param {number} height
   */
  static drawPixels(canvas, pixels, width, height) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < pixels.length; i++) {
      const pixelValue = pixels[i];
      const grayscale = this.pixelToGrayscale(pixelValue);

      const dataIndex = i * 4;
      data[dataIndex] = grayscale;     // R
      data[dataIndex + 1] = grayscale; // G
      data[dataIndex + 2] = grayscale; // B
      data[dataIndex + 3] = 255;       // A
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Map 2-bit pixel value to grayscale
   * @param {number} pixelValue - 0-3
   * @returns {number} 0-255 grayscale value
   */
  static pixelToGrayscale(pixelValue) {
    // Based on encoding thresholds:
    // 0 → Black (0)
    // 1 → Light Grey (170)
    // 2 → Dark Grey (85)
    // 3 → White (255)
    switch (pixelValue) {
      case 0:
        return 0;   // Black
      case 1:
        return 170; // Light Gray
      case 2:
        return 85;  // Dark Gray
      case 3:
        return 255; // White
      default:
        return 0;
    }
  }
}
