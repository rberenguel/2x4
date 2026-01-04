/**
 * Dithering Algorithms Module
 * Provides various dithering strategies for 4-level grayscale (2-bit) output.
 */

// Bayer 4x4 Matrix
const bayerm4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * Returns the closest 2-bit palette color (0, 85, 170, 255)
 * @param {number} value - 0-255 input value
 * @returns {number} Quantized value
 */
function getClosestColor(value) {
  if (value < 43) return 0;
  if (value < 128) return 85;
  if (value < 213) return 170;
  return 255;
}

export const DITHER_ALGORITHMS = {
  floyd: {
    name: "Floyd-Steinberg",
    fn: (imageData, threshold = 128) => {
      const w = imageData.width;
      const h = imageData.height;
      const d = new Float32Array(imageData.data); // Copy to Float32 to avoid clamping during error diffusion

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const oldPixel = d[i]; // Assuming grayscale already, r=g=b
          const newPixel = getClosestColor(oldPixel);

          d[i] = d[i + 1] = d[i + 2] = newPixel;

          const quantError = oldPixel - newPixel;

          // Distribute error
          if (x + 1 < w) d[(y * w + x + 1) * 4] += (quantError * 7) / 16;
          if (y + 1 < h) {
            if (x > 0) d[((y + 1) * w + x - 1) * 4] += (quantError * 3) / 16;
            d[((y + 1) * w + x) * 4] += (quantError * 5) / 16;
            if (x + 1 < w)
              d[((y + 1) * w + x + 1) * 4] += (quantError * 1) / 16;
          }
        }
      }

      // Copy back to Uint8ClampedArray
      for (let i = 0; i < d.length; i++) imageData.data[i] = d[i];
      return imageData;
    },
  },
  atkinson: {
    name: "Atkinson",
    fn: (imageData) => {
      const w = imageData.width;
      const h = imageData.height;
      const d = new Float32Array(imageData.data);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const oldPixel = d[i];
          const newPixel = getClosestColor(oldPixel);

          d[i] = d[i + 1] = d[i + 2] = newPixel;
          const quantError = oldPixel - newPixel;

          // Atkinson only diffuses 3/4 of the error? No, it's 1/8 each neighbor
          //       X   1   1
          //   1   1   1
          //       1

          const distribute = (dx, dy) => {
            if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) {
              d[((y + dy) * w + x + dx) * 4] += quantError / 8;
            }
          };

          distribute(1, 0);
          distribute(2, 0);
          distribute(-1, 1);
          distribute(0, 1);
          distribute(1, 1);
          distribute(0, 2);
        }
      }
      // Copy back
      for (let i = 0; i < d.length; i++) imageData.data[i] = d[i];
      return imageData;
    },
  },
  bayer: {
    name: "Bayer 4x4",
    fn: (imageData) => {
      const w = imageData.width;
      const h = imageData.height;
      const d = imageData.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const gray = d[i];

          // Map generic 0-255 value to 0-15 space ?
          // Bayer threshold: (M(x%4, y%4) / 16) - 0.5 ?
          // Simple ordered dithering addition

          const mapValue = bayerm4[y % 4][x % 4];
          // Normalize mapValue to roughly -40 to +40 range to perturb the gray?
          // Or standard ordered dither thresholding?
          // For 4-level, we can add a dither offset

          // Offset = (map - 8) * scale
          const offset = (mapValue - 8) * 4;

          let val = gray + offset;
          val = Math.max(0, Math.min(255, val));

          const newPixel = getClosestColor(val);
          d[i] = d[i + 1] = d[i + 2] = newPixel;
        }
      }
      return imageData;
    },
  },
};
