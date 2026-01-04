import { ImageTransformer } from "./image-transformer.js";
import { SplitEditor } from "./split-editor.js";
import { DITHER_ALGORITHMS } from "./dither-algorithms.js";
import { XTHEncoder } from "./xth-encoder.js";
import { XTCBuilder } from "./xtc-builder.js";

export class CBZConversionPipeline {
  /**
   * Run the conversion pipeline
   * @param {CbzParser} parser
   * @param {Map} pageConfigs
   * @param {Object} options { format: 'xtc'|'zip', ditherAlgo: 'floyd', outputFilename }
   * @param {Function} onProgress (percent, statusText) => void
   */
  /**
   * Run the conversion pipeline
   * @param {CbzParser} parser
   * @param {Map} pageConfigs
   * @param {Object} options { format: 'xtc'|'zip', ditherAlgo: 'floyd', outputFilename, defaultConfig }
   * @param {Function} onProgress (percent, statusText) => void
   */
  static async convert(parser, pageConfigs, options, onProgress) {
    const { format, ditherAlgo, outputFilename, defaultConfig } = options;
    const totalSourcePages = parser.metadata.pageCount;

    let outputPages = []; // Arrays of { buffer, filename }

    // Helper instances
    const xthEncoder = new XTHEncoder();
    // Set thresholds to match our dither output (standard)
    xthEncoder.settings.threshold1 = 85;
    xthEncoder.settings.threshold2 = 170;
    xthEncoder.settings.threshold3 = 255;

    const ditherFn = DITHER_ALGORITHMS[ditherAlgo]
      ? DITHER_ALGORITHMS[ditherAlgo].fn
      : DITHER_ALGORITHMS["floyd"].fn;

    // Base default if not provided
    const baseConfig = defaultConfig || {
      rotation: 0,
      brightness: 100,
      contrast: 100,
      verticalSplits: [],
      horizontalSplits: [],
      trim: { top: 0, left: 0, right: 0, bottom: 0 },
    };

    let processedCount = 0;

    for (let i = 0; i < totalSourcePages; i++) {
      onProgress(
        Math.floor((i / totalSourcePages) * 100),
        `Processing page ${i + 1}/${totalSourcePages}...`,
      );

      const sourceBitmap = await parser.getPage(i);

      // Merge page config with default config.
      // If pageConfig exists, it might be partial? No, updateConfig usually sets whole object.
      // But we can fallback to default if key missing, or better:
      // If page exists in map, use it. If not, use default.
      // CAUTION: If page exists but user only changed brightness, split might be empty?
      // updateConfig in Main does: `let config = this.pageConfigs.get() || this.getDefaultConfig()`.
      // So the object in Map should be complete "state" for that page.
      // However, verify if 'trim' is present.

      let config = pageConfigs.get(i);
      if (!config) {
        config = baseConfig;
      }
      // Ensure trim exists if missing (legacy check)
      if (!config.trim && baseConfig.trim) config.trim = baseConfig.trim;

      // 1. Transform Global (Rotate + Brightness/Contrast)
      let transformedCanvas = await ImageTransformer.process(
        sourceBitmap,
        config,
      );

      // 1b. Auto-Trim/Manual Trim
      // We follow Main's order: Process -> AutoTrim (if on) -> Manual Trim
      if (config.autoTrim) {
        transformedCanvas = ImageTransformer.autoTrim(transformedCanvas);
      }
      if (
        config.trim &&
        (config.trim.top > 0 ||
          config.trim.bottom > 0 ||
          config.trim.left > 0 ||
          config.trim.right > 0)
      ) {
        transformedCanvas = ImageTransformer.manualCrop(
          transformedCanvas,
          config.trim,
        );
      }

      // 2. Calculate Regions
      const regions = SplitEditor.calculateRegions(
        transformedCanvas.width,
        transformedCanvas.height,
        config,
      );

      // 3. Process Regions
      for (let j = 0; j < regions.length; j++) {
        const region = regions[j];

        // Crop
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = region.w;
        cropCanvas.height = region.h;
        const cropCtx = cropCanvas.getContext("2d");
        cropCtx.drawImage(
          transformedCanvas,
          region.x,
          region.y,
          region.w,
          region.h,
          0,
          0,
          region.w,
          region.h,
        );

        // Scale to 480x800
        const scaledCanvas = ImageTransformer.scale(cropCanvas, 480, 800);

        // Dither
        const ditherCtx = scaledCanvas.getContext("2d");
        const imageData = ditherCtx.getImageData(0, 0, 480, 800);
        ditherFn(imageData);
        ditherCtx.putImageData(imageData, 0, 0);

        // Encode
        if (format === "xtc" || format === "xth") {
          // Generate XTH buffer
          // We use generateBinaryData which packs pixels.
          // Since we already dithered to 4 levels, map logic in generateBinaryData will work fine.
          const xthBuffer = xthEncoder.generateBinaryData(ditherCtx, 480, 800);
          outputPages.push({ data: xthBuffer, ext: "xth" });
        } else {
          // PNG/JPG for ZIP
          const blob = await new Promise((resolve) =>
            scaledCanvas.toBlob(resolve, "image/png"),
          );
          outputPages.push({ data: blob, ext: "png" });
        }
      }

      // Cleanup bitmaps? Browser GC should handle it, but explicit close is better if we had handles.
      // sourceBitmap is cached in parser, parser manages it.
      processedCount++;
    }

    onProgress(100, "Generating output file...");

    // Build Output Container
    if (format === "xtc") {
      const builder = new XTCBuilder();
      builder.setMetadata({
        title:
          outputFilename || parser.metadata.filename.replace(/\.cbz$/i, ""),
        creator: "CBZ Converter",
      });

      outputPages.forEach((p) => builder.addPage(p.data));

      const xtcBuffer = builder.generate();
      return new Blob([xtcBuffer], { type: "application/octet-stream" });
    } else if (format === "zip") {
      // Use JSZip
      const zip = new JSZip();
      const folder = zip.folder(outputFilename || "images");

      outputPages.forEach((p, idx) => {
        const name = `page_${String(idx + 1).padStart(4, "0")}.${p.ext}`;
        folder.file(name, p.data);
      });

      return await zip.generateAsync({ type: "blob" });
    }

    return null;
  }
}
