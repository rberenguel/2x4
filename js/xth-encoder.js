/**
 * XTH Encoder Module
 * Ports logic from XTH-generator.html for Xteink X4 devices.
 * Handles 4-level grayscale dithering and binary format generation.
 */

export class XTHEncoder {
  constructor() {
    // Default settings from the Gist
    this.settings = {
      threshold1: 85,
      threshold2: 170,
      threshold3: 255,
      ditherStrength: 80,
      invertColors: false,
      enableDithering: true,
    };
  }

  /**
   * Encodes a Canvas element into an XTH file Blob
   * @param {HTMLCanvasElement} sourceCanvas
   * @returns {Blob} The XTH binary data
   */
  encode(sourceCanvas) {
    // 1. Create a working canvas to avoid modifying the original
    const canvas = document.createElement("canvas");
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(sourceCanvas, 0, 0);

    // 2. Apply Dithering and 4-level Grayscale
    this.applyDithering(ctx, canvas.width, canvas.height);

    // 3. Generate XTH Binary Data
    const buffer = this.generateBinaryData(ctx, canvas.width, canvas.height);

    return new Blob([buffer], { type: "application/octet-stream" });
  }

  /**
   * Applies Floyd-Steinberg dithering and reduces to 4 gray levels
   */
  applyDithering(ctx, width, height) {
    // Get context with willReadFrequently for better performance
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const errorMatrix = new Float32Array(width * height).fill(0);
    const strength = this.settings.ditherStrength / 100;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        let gray =
          data[index] * 0.299 +
          data[index + 1] * 0.587 +
          data[index + 2] * 0.114;

        // Add distributed error
        const currentError = errorMatrix[y * width + x];
        let ditheredGray = gray + currentError * strength;

        // Clamp
        ditheredGray = Math.max(0, Math.min(255, ditheredGray));

        // Quantize to 4 levels (0, 85, 170, 255)
        let newGray;
        if (ditheredGray < this.settings.threshold1) newGray = 0;
        else if (ditheredGray < this.settings.threshold2) newGray = 85;
        else if (ditheredGray < this.settings.threshold3) newGray = 170;
        else newGray = 255;

        // Calculate error
        const error = gray - newGray;

        // Distribute error (Floyd-Steinberg)
        if (this.settings.enableDithering) {
          if (x < width - 1) errorMatrix[y * width + x + 1] += (error * 7) / 16;
          if (y < height - 1) {
            if (x > 0) errorMatrix[(y + 1) * width + x - 1] += (error * 3) / 16;
            errorMatrix[(y + 1) * width + x] += (error * 5) / 16;
            if (x < width - 1)
              errorMatrix[(y + 1) * width + x + 1] += (error * 1) / 16;
          }
        }

        // Handle inversion
        if (this.settings.invertColors) {
          newGray = 255 - newGray;
        }

        // Write back
        data[index] = newGray;
        data[index + 1] = newGray;
        data[index + 2] = newGray;
        // Alpha remains unchanged (usually 255)
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Generates the specific binary format for XTH
   */
  generateBinaryData(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const arrayData1 = [];
    const arrayData2 = [];

    // Vertical scan: Right to Left
    for (let x = width - 1; x >= 0; x--) {
      for (let y = 0; y < height; y += 8) {
        let byte1 = 0;
        let byte2 = 0;

        for (let i = 0; i < 8; i++) {
          if (y + i < height) {
            const index = ((y + i) * width + x) * 4;
            const grayValue = data[index];

            // Map grayscale back to 2-bit value (0-3)
            let twoBitValue;
            if (grayValue < this.settings.threshold1)
              twoBitValue = 0; // Black
            else if (grayValue < this.settings.threshold2)
              twoBitValue = 2; // Dark Gray
            else if (grayValue < this.settings.threshold3)
              twoBitValue = 1; // Light Gray
            else twoBitValue = 3; // White

            // Invert logic for the hardware format? (Copied from Gist: 3 - value)
            twoBitValue = 3 - twoBitValue;

            const bit1 = (twoBitValue >> 1) & 1;
            const bit2 = twoBitValue & 1;

            byte1 |= bit1 << (7 - i);
            byte2 |= bit2 << (7 - i);
          }
        }
        arrayData1.push(byte1);
        arrayData2.push(byte2);
      }
    }

    return this.createXthFile(width, height, arrayData1, arrayData2);
  }

  /**
   * Adds the file header and checksum
   */
  createXthFile(width, height, data1, data2) {
    const headerSize = 22;
    const dataSize = data1.length + data2.length;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // Magic "XTH\0"
    view.setUint32(0, 0x58544800, false);
    view.setUint16(4, width, true);
    view.setUint16(6, height, true);
    view.setUint8(8, 0);
    view.setUint8(9, 0);
    view.setUint32(10, dataSize, true);

    // Checksum (Sum of all bytes)
    let checksum = 0;
    for (let i = 0; i < data1.length; i++) checksum += data1[i];
    for (let i = 0; i < data2.length; i++) checksum += data2[i];
    view.setBigUint64(14, BigInt(checksum), true);

    const dataArray = new Uint8Array(buffer, headerSize);
    dataArray.set(data1, 0);
    dataArray.set(data2, data1.length);

    return buffer;
  }
}
