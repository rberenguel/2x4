# Performance Optimization: Batch Canvas Rendering

## Problem

Currently, the extension renders each page individually during export:

```javascript
// For each page (N times):
1. Clone page element
2. Apply CSS transform to shift to current page
3. Call html2canvas (SLOW - 100-500ms per page)
4. Encode to XTH/JPEG
```

For a 300-page article, this means:

- **300 html2canvas calls** (the slowest operation)
- **30-150 seconds** of rendering time
- Browser becomes unresponsive during conversion

## Proposed Solution

Render entire chapter content to **one large canvas**, then slice into pages:

```javascript
// Once per chapter:
1. Render full multi-column container to large canvas
2. Slice canvas into 480×800 page chunks
3. Encode each chunk

// Result: 1 html2canvas call instead of N calls
```

### Expected Performance Improvement

- **Before**: 300 pages × 200ms = 60 seconds
- **After**: 1 render × 2-3 seconds + slicing overhead = ~5 seconds
- **Speedup**: ~12× faster for typical articles

## Implementation Approach

### 1. Canvas Size Limits

Different browsers have different canvas size limits:

| Browser | Max Dimension | Max Total Pixels | Pages @ 480×800 |
| ------- | ------------- | ---------------- | --------------- |
| Chrome  | 16,384px      | ~268M pixels     | ~200 pages      |
| Firefox | 11,180px      | ~124M pixels     | ~140 pages      |
| Safari  | 4,096px       | ~16M pixels      | ~5 pages        |

**Strategy**: Use conservative batching (100 pages per batch) to ensure compatibility.

### 2. Batching Algorithm

```javascript
async function renderChapterBatched(chapterContent, pageCount) {
  const BATCH_SIZE = 100; // Conservative limit
  const PAGE_HEIGHT = 800;
  const PAGE_WIDTH = 480;

  const batches = Math.ceil(pageCount / BATCH_SIZE);
  const allPages = [];

  for (let batch = 0; batch < batches; batch++) {
    const startPage = batch * BATCH_SIZE;
    const endPage = Math.min((batch + 1) * BATCH_SIZE, pageCount);
    const batchPages = endPage - startPage;
    const batchHeight = batchPages * PAGE_HEIGHT;

    // Render batch to large canvas
    const largeCanvas = await renderBatchToCanvas(
      chapterContent,
      startPage,
      endPage,
      PAGE_WIDTH,
      batchHeight,
    );

    // Slice into individual pages
    for (let i = 0; i < batchPages; i++) {
      const pageCanvas = sliceCanvas(
        largeCanvas,
        0,
        i * PAGE_HEIGHT,
        PAGE_WIDTH,
        PAGE_HEIGHT,
      );
      allPages.push(pageCanvas);
    }

    // Clear large canvas to free memory
    largeCanvas.width = 0;
    largeCanvas.height = 0;
  }

  return allPages;
}
```

### 3. Canvas Slicing

```javascript
function sliceCanvas(sourceCanvas, x, y, width, height) {
  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = width;
  targetCanvas.height = height;

  const ctx = targetCanvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
  });

  // Copy region from source canvas
  ctx.drawImage(
    sourceCanvas,
    x,
    y,
    width,
    height, // Source region
    0,
    0,
    width,
    height, // Target region
  );

  return targetCanvas;
}
```

### 4. Multi-Column Container Rendering

```javascript
async function renderBatchToCanvas(
  chapterContent,
  startPage,
  endPage,
  width,
  height,
) {
  // Create container with full multi-column content
  const container = document.createElement("div");
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.columnWidth = `${width}px`;
  container.style.columnGap = "0px";
  container.innerHTML = chapterContent;

  // Position to show correct page range
  const pageWidth = width;
  const offset = -(startPage * pageWidth);
  container.style.transform = `translateX(${offset}px)`;

  // Append off-screen
  container.style.position = "absolute";
  container.style.left = "-9999px";
  document.body.appendChild(container);

  try {
    // Render at 3x for antialiasing
    const canvas = await html2canvas(container, {
      scale: 3,
      width: width,
      height: height,
      backgroundColor: "#ffffff",
      logging: false,
    });

    return canvas;
  } finally {
    document.body.removeChild(container);
  }
}
```

## Tradeoffs

### Advantages ✅

- **12-20× faster** for typical articles (300 pages)
- **Fewer browser reflows/repaints** (1 vs N)
- **Better user experience** (faster conversions)
- **Lower CPU usage** (less overhead from repeated setup)

### Disadvantages ⚠️

- **Higher peak memory usage** (~100 pages × 480×800×4 bytes = ~150MB per batch)
- **More complex code** (batching logic, canvas slicing)
- **Need to handle batch boundaries** carefully
- **Slightly higher initial overhead** (but amortized over pages)

## Implementation Priority

**Best for: Extension only**

Rationale:

- Extension handles web articles (often 100+ pages)
- Users expect fast conversion for reading queues
- Extension already loads everything in memory (not streaming)
- PWA often handles EPUBs chapter-by-chapter (less benefit)

## Proposed Changes

### Files to Modify

1. **`extension/converter.js`**

   - Add `renderChapterBatched()` method
   - Add `sliceCanvas()` helper
   - Replace per-page rendering in conversion pipeline

2. **`js/conversion-pipeline.js`** (extension-specific path)

   - Add flag: `useBatchRendering: true` for extension
   - Keep existing per-page rendering as fallback

3. **`js/renderer.js`**
   - Add `renderBatchToCanvas()` method
   - Keep existing `renderPageToCanvas()` for compatibility

### Backward Compatibility

- Keep existing per-page rendering as fallback
- Add feature flag to enable/disable batch rendering
- Detect canvas size limits at runtime
- Fall back to per-page if batch rendering fails

## Testing Plan

1. **Small articles** (5-10 pages) - verify correctness
2. **Medium articles** (50-100 pages) - measure speedup
3. **Large articles** (200-300 pages) - verify batching works
4. **Memory profiling** - ensure no leaks between batches
5. **Browser compatibility** - test Chrome, Firefox, Safari limits

## Future Enhancements

1. **Progressive rendering** - Show progress during batch slicing
2. **Web Workers** - Offload canvas slicing to worker thread
3. **Adaptive batch size** - Detect available memory and adjust
4. **Streaming export** - Write sliced pages directly to zip/xtc without holding in memory

## Notes

- Progress bars would need updating (harder to show per-page progress)
- Preview rendering should still use per-page (only optimize export)
- Consider enabling only when exporting >50 pages
- May need to tune BATCH_SIZE based on real-world testing

---

**Status**: Proposed improvement
**Estimated effort**: 4-6 hours implementation + testing
**Expected benefit**: 10-20× speedup for article conversion
