# CBZ to XTC Converter - Implementation Plan

## Overview

A new section in the epubx4 PWA for converting CBZ (Comic Book ZIP) files to XTC format with fine-grained control over page splitting, transforms, and dithering. Unlike automated tools like cbz2xtc, this converter prioritizes **user control** with live preview and per-page customization.

---

## Architecture

### Reusable Components from Existing Codebase

| Component             | Source                         | Reuse Strategy                                                        |
| --------------------- | ------------------------------ | --------------------------------------------------------------------- |
| XTH Encoder           | `js/xth-encoder.js`            | Direct reuse - 4-level dithering is superior to cbz2xtc's 1-bit       |
| XTC Builder           | `js/xtc-builder.js`            | Direct reuse - native metadata/chapters support                       |
| Conversion Controller | `js/conversion-controller.js`  | Adapt for image-based pipeline                                        |
| Dithering Algorithms  | `eink-bg/index.html`           | Extract and modularize (Atkinson, Bayer, Blue Noise, Floyd-Steinberg) |
| UI Patterns           | `index.html` + `css/style.css` | Follow two-panel layout pattern                                       |

### New Components Required

| Component               | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `CBZParser`             | Unzip CBZ in memory, extract/sort images |
| `ImagePaginator`        | Navigate comic pages, handle splits      |
| `SplitEditor`           | Draggable split lines UI per page        |
| `ImageTransformer`      | Rotation, contrast, cropping per page    |
| `CBZConversionPipeline` | Orchestrate image → XTH → XTC flow       |

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  CBZ Converter                                         [Load CBZ]    │
├─────────────────────────┬────────────────────────────────────────────┤
│                         │                                            │
│  FILE INFO              │   ┌─────────────┐    ┌─────────────┐      │
│  ─────────────          │   │             │    │             │      │
│  filename.cbz           │   │  ORIGINAL   │    │  PREVIEW    │      │
│  245 pages              │   │             │    │  (dithered) │      │
│  Output: ~312 pages     │   │   [drag     │    │             │      │
│                         │   │    split    │    │             │      │
│  PAGE NAVIGATION        │   │    lines]   │    │             │      │
│  ─────────────          │   │             │    │             │      │
│  [<] Page 12/245 [>]    │   │             │    │             │      │
│  Output pages: 24-25    │   └─────────────┘    └─────────────┘      │
│                         │                                            │
│  TRANSFORMS             │   Split Preview:                           │
│  ─────────────          │   ┌──────┐ ┌──────┐                        │
│  [Auto] [Reset]         │   │ 24   │ │ 25   │  (shows resulting     │
│                         │   └──────┘ └──────┘   output pages)       │
│  Rotation: [0°▼]        │                                            │
│  ○ None ○ 90° ○ 180°    ├────────────────────────────────────────────┤
│                         │  Page 12 Splits: V1 @ 33% | V2 @ 66%       │
│  SPLITS                 │  [Clear All Splits] [Apply to Similar]     │
│  ─────────────          │                                            │
│  Vertical: [0] [1] [2]  │  Navigation: [◀ Prev] [Next ▶]             │
│  Horizontal: [0] [1]    │              [◀◀ -10] [+10 ▶▶]             │
│  [Auto-detect splits]   │                                            │
│                         │  Zoom: [Fit] [100%] [+] [-]                │
│  IMAGE ADJUSTMENTS      │                                            │
│  ─────────────          ├────────────────────────────────────────────┤
│  Brightness [====●===]  │                                            │
│  Contrast   [====●===]  │  PROGRESS                                  │
│  Sharpness  [====●===]  │  Processing page 45/245...                 │
│                         │  [████████████░░░░░░░░] 45%                │
│  DITHERING              │                                            │
│  ─────────────          │  [Convert to XTC]                          │
│  Algorithm: [Floyd ▼]   │                                            │
│  Strength:  [====●===]  │                                            │
│                         │                                            │
│  OUTPUT                 │                                            │
│  ─────────────          │                                            │
│  Format: [XTC▼]         │                                            │
│  Split files: [Off▼]    │                                            │
│                         │                                            │
└─────────────────────────┴────────────────────────────────────────────┘
```

---

## Core Features

### 1. CBZ Loading & Parsing

```javascript
class CBZParser {
  async load(file) {
    // Use JSZip (already in project) to extract
    // Filter for image files: jpg, jpeg, png, gif, webp, bmp
    // Exclude: __MACOSX/, .DS_Store, Thumbs.db
    // Sort alphabetically (natural sort for "page1, page2, page10")
    // Return: { images: Blob[], metadata: { filename, pageCount } }
  }

  async getPage(index) {
    // Return image as ImageBitmap for canvas rendering
  }
}
```

### 2. Split System

#### Split Types

- **Vertical splits** (along the long edge): 0, 1, 2, or 3 split lines → 1-4 output pages
- **Horizontal splits** (along the short edge): 0 or 1 split line → 1-2 output rows
- Combined: up to 4×2 = 8 output pages per source page (though 4-6 is more realistic)

#### Split Data Structure

```javascript
// Per-page configuration
pageConfig = {
  sourceIndex: 12,
  rotation: 0, // 0, 90, 180, 270
  brightness: 100, // 0-200
  contrast: 100, // 0-200
  verticalSplits: [0.33, 0.66], // normalized positions (0-1)
  horizontalSplits: [0.5], // normalized positions (0-1)
  outputPages: [
    // computed from splits
    { x: 0, y: 0, w: 0.33, h: 0.5 },
    { x: 0.33, y: 0, w: 0.33, h: 0.5 },
    // ...
  ],
};
```

#### Auto-Detection Logic

```javascript
function autoDetectSplits(
  imageWidth,
  imageHeight,
  targetW = 480,
  targetH = 800,
) {
  const aspectRatio = imageWidth / imageHeight;
  const targetAspect = targetW / targetH; // 0.6 for portrait

  // Case 1: Already portrait-ish (0.5 - 0.75) → no splits
  if (aspectRatio >= 0.5 && aspectRatio <= 0.75) {
    return { rotation: 0, verticalSplits: [], horizontalSplits: [] };
  }

  // Case 2: Landscape/spread (1.0 - 1.5) → single vertical split (two pages)
  if (aspectRatio >= 1.0 && aspectRatio <= 1.5) {
    return { rotation: 0, verticalSplits: [0.5], horizontalSplits: [] };
  }

  // Case 3: Very wide (>1.5) → possibly 3-4 vertical panels
  if (aspectRatio > 1.5) {
    const panels = Math.round(aspectRatio / 0.6);
    const splits = [];
    for (let i = 1; i < panels; i++) splits.push(i / panels);
    return { rotation: 0, verticalSplits: splits, horizontalSplits: [] };
  }

  // Case 4: Very tall (<0.5) → horizontal split + rotation consideration
  if (aspectRatio < 0.5) {
    return { rotation: 0, verticalSplits: [], horizontalSplits: [0.5] };
  }

  return { rotation: 0, verticalSplits: [], horizontalSplits: [] };
}
```

### 3. Draggable Split Editor

The split editor overlays the original image preview:

```javascript
class SplitEditor {
  constructor(canvas, onSplitChange) {
    this.canvas = canvas;
    this.verticalSplits = [];    // Array of 0-1 positions
    this.horizontalSplits = [];
    this.dragTarget = null;      // { type: 'v'|'h', index: number }
    this.onSplitChange = onSplitChange;
  }

  render() {
    // Draw semi-transparent overlay lines
    // Vertical: red dashed lines
    // Horizontal: blue dashed lines
    // Drag handles at line endpoints
  }

  // Interaction
  onMouseDown(e) { /* hit-test split lines, start drag */ }
  onMouseMove(e) { /* update split position during drag */ }
  onMouseUp(e)   { /* finalize, call onSplitChange */ }

  // Add/remove splits
  addVerticalSplit()    { if (this.verticalSplits.length < 3) ... }
  addHorizontalSplit()  { if (this.horizontalSplits.length < 1) ... }
  removeVerticalSplit(index) { ... }
  clearAllSplits() { ... }
}
```

**Visual Design:**

- Split lines are **dashed**, with distinct colors (red=vertical, blue=horizontal)
- **Drag handles**: circles at line ends, enlarge on hover
- **Snap zones**: optional snap to common positions (25%, 33%, 50%, 66%, 75%)
- **Ghost preview**: while dragging, show semi-transparent resulting regions

### 4. Dual Preview System

Two side-by-side canvases:

| Left Canvas (Original)       | Right Canvas (Dithered)      |
| ---------------------------- | ---------------------------- |
| Source image with transforms | Final output preview         |
| Split lines overlay          | Shows actual XTH rendering   |
| Draggable interaction        | 4-level grayscale simulation |

**Split Preview Thumbnails:**
Below the main preview, show small thumbnails of each output page that will be generated from the current source page (numbered to show reading order).

### 5. Dithering Options

Extract algorithms from `eink-bg` into a reusable module:

```javascript
// js/dither-algorithms.js
export const DITHER_ALGORITHMS = {
  floyd: { name: "Floyd-Steinberg", fn: floydSteinberg },
  atkinson: { name: "Atkinson", fn: atkinson },
  bayer: { name: "Bayer 4x4", fn: bayer4x4 },
  bluenoise: { name: "Blue Noise", fn: blueNoise },
  xth4level: { name: "XTH 4-Level (Default)", fn: xth4Level }, // existing
};

// User selects algorithm; default to XTH 4-level for best e-ink results
```

**Note:** The existing `xth-encoder.js` uses Floyd-Steinberg with 4-level quantization, which is generally best for e-ink. Other algorithms could be interesting for artistic effects or specific manga styles.

### 6. Image Adjustments

Per-page adjustable parameters:

| Parameter  | Range         | Default | Notes                                       |
| ---------- | ------------- | ------- | ------------------------------------------- |
| Brightness | 0-200%        | 100%    | CSS filter during preview, manual in export |
| Contrast   | 0-200%        | 100%    | Especially useful for faded scans           |
| Sharpness  | 0-200%        | 100%    | Convolution kernel (optional)               |
| Rotation   | 0/90/180/270° | Auto    | Per-page override                           |

**Global vs Per-Page:**

- Global defaults in settings panel
- Per-page overrides stored in `pageConfigs[]`
- "Apply to all" and "Apply to similar" bulk operations

### 7. Conversion Pipeline

```javascript
class CBZConversionPipeline {
  async *convert(parser, pageConfigs, options) {
    const { format, ditherAlgorithm, jpegQuality } = options;

    yield { type: "init", totalSourcePages: parser.pageCount };

    let outputPageIndex = 0;

    for (let i = 0; i < parser.pageCount; i++) {
      const config = pageConfigs[i];
      const sourceImage = await parser.getPage(i);

      yield { type: "source-page-start", sourceIndex: i };

      // Apply rotation and adjustments
      const transformed = this.applyTransforms(sourceImage, config);

      // Generate output pages from splits
      const regions = this.calculateRegions(config);

      for (const region of regions) {
        const cropped = this.cropRegion(transformed, region);
        const scaled = this.scaleToTarget(cropped, 480, 800);
        const dithered = this.applyDither(scaled, ditherAlgorithm);

        yield {
          type: "output-page-complete",
          sourceIndex: i,
          outputIndex: outputPageIndex++,
          canvas: dithered,
        };
      }

      yield { type: "source-page-complete", sourceIndex: i };
    }

    // Build final output
    yield* this.buildOutput(format, options);
  }
}
```

---

## File Structure

```
epubx4/
├── cbz.html                      # New entry point (or section in index.html)
├── css/
│   └── cbz.css                   # CBZ-specific styles
├── js/
│   ├── cbz-parser.js             # CBZ extraction and image management
│   ├── split-editor.js           # Draggable split line UI
│   ├── image-transformer.js      # Rotation, brightness, contrast
│   ├── dither-algorithms.js      # Extracted/unified dithering
│   ├── cbz-conversion-pipeline.js# Image→XTC conversion orchestration
│   ├── cbz-main.js               # UI controller for CBZ section
│   │
│   ├── xth-encoder.js            # (existing) - reuse
│   ├── xtc-builder.js            # (existing) - reuse
│   └── conversion-controller.js  # (existing) - adapt
```

---

## Implementation Phases

### Phase 1: Core Infrastructure

1. Create `cbz-parser.js` - JSZip extraction, image sorting
2. Create `cbz.html` with basic two-panel layout
3. Implement basic navigation (prev/next page)
4. Display original image in left preview

### Phase 2: Preview System

1. Implement dual-canvas preview (original + dithered)
2. Add brightness/contrast sliders with live preview
3. Integrate existing XTH encoder for dithered preview
4. Add zoom/pan controls

### Phase 3: Split System

1. Create `split-editor.js` with draggable lines
2. Implement auto-detection algorithm
3. Add split preview thumbnails
4. Store per-page configurations

### Phase 4: Conversion Pipeline

1. Create `cbz-conversion-pipeline.js`
2. Wire up to existing XTC builder
3. Add progress reporting
4. Implement file download

### Phase 5: Polish & Advanced Features

1. Batch operations ("apply to similar pages")
2. Settings persistence (IndexedDB)
3. Additional dithering algorithms
4. Export presets
5. Keyboard shortcuts (←→ navigation, number keys for quick splits)

---

## UX Considerations

### Reading Order

For manga (right-to-left), splits should generate pages in RTL order. Add a toggle:

- [ ] Manga mode (RTL)
- [x] Western mode (LTR)

### Spread Detection

Two-page spreads (centerfold images) should ideally NOT be split. Consider:

- Auto-detect based on aspect ratio close to 2:1
- Visual indicator: "Detected as spread - rotate instead of split?"

### Undo/Redo

Per-page config changes should be undoable:

```javascript
class ConfigHistory {
  constructor() { this.stack = []; this.index = -1; }
  push(state) { ... }
  undo() { ... }
  redo() { ... }
}
```

### Keyboard Shortcuts

| Key         | Action                           |
| ----------- | -------------------------------- |
| ← / →       | Previous / Next page             |
| Shift+← / → | Jump 10 pages                    |
| 1-4         | Set vertical split count         |
| H           | Toggle horizontal split          |
| R           | Rotate 90°                       |
| Space       | Toggle original/dithered preview |
| Enter       | Start conversion                 |

---

## Technical Notes

### Memory Management

CBZ files can be large (100MB+). Strategies:

- Load images on-demand, not all at once
- Use `createImageBitmap()` for efficient decoding
- Release `ImageBitmap` objects when navigating away
- Consider Web Workers for dithering heavy pages

### Canvas Rendering

For the split preview thumbnails, render at reduced resolution (e.g., 120×200) to avoid performance issues when showing 4-8 thumbnails simultaneously.

### Mobile Support

The split editor needs touch support:

- Touch to select split line
- Drag to move
- Long-press to delete
- Pinch-to-zoom on preview

---

## Differences from cbz2xtc

| Feature       | cbz2xtc              | This Tool                              |
| ------------- | -------------------- | -------------------------------------- |
| Dithering     | 1-bit only           | 4-level grayscale (better quality)     |
| Split control | Auto only            | Manual per-page with live preview      |
| Preview       | None                 | Full live preview with dithered output |
| Adjustments   | Global contrast only | Per-page brightness/contrast/rotation  |
| Interaction   | CLI batch            | Interactive GUI                        |
| Reading order | Fixed                | Configurable (LTR/RTL)                 |

---

## Open Questions

1. **Separate page or tab in existing app?**

   - Recommendation: New HTML file (`cbz.html`) sharing CSS/JS modules

2. **Chapter markers in XTC?**

   - Could detect "chapter break" images (often solid black/white pages)
   - Or allow manual chapter marking

3. **Batch processing multiple CBZ files?**

   - v1: Single file focus
   - v2: Queue system like extension's article queue

4. **Presets/profiles?**
   - Save split configurations for series with consistent layouts
   - "Magazine style", "Manga style", "Webtoon style" presets
