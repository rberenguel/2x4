# XTC Viewer Implementation Plan

## Overview

Create a standalone viewer page that can open, decode, and display XTC files with navigation and metadata inspection. This will serve as a debugging tool to verify XTC file structure and identify firmware compatibility issues.

## Components to Build

### 1. XTC Parser (`js/xtc-parser.js`)

**Purpose**: Read and parse XTC container files

**Class**: `XTCParser`

**Methods**:

- `constructor(arrayBuffer)` - Initialize with XTC file data
- `parseHeader()` - Read 48-byte header
  - Extract magic number, version, pageCount
  - Extract readDirection, hasMetadata, hasThumbnails, hasChapters
  - Extract currentPage
  - Extract offsets (metadataOffset, indexOffset, dataOffset, thumbOffset)
- `parseMetadata()` - Read 256-byte metadata section (if hasMetadata)
  - Extract title, author, publisher, language
  - Extract createTime, coverPage, chapterCount
- `parseChapters()` - Read chapter entries (if hasChapters)
  - Extract chapterName, startPage, endPage for each chapter
- `parsePageIndex()` - Read page index table (pageCount × 16 bytes)
  - Extract offset, size, width, height for each page
- `getPageData(pageIndex)` - Extract raw XTH data for specific page
  - Use index table to locate page data
  - Return ArrayBuffer of XTH image

**Properties**:

- `header` - Parsed header object
- `metadata` - Parsed metadata object (or null)
- `chapters` - Array of chapter objects (or empty)
- `pageIndex` - Array of page index entries
- `buffer` - Original ArrayBuffer

### 2. XTH Renderer (`js/xth-renderer.js`)

**Purpose**: Decode XTH binary data and render to canvas

**Class**: `XTHRenderer`

**Methods**:

- `static renderToCanvas(xthBuffer, canvas)` - Main rendering method
  - Parse XTH header (22 bytes)
  - Extract width, height, dataSize
  - Decode two bit planes
  - Render to canvas as grayscale image
- `static parseXTHHeader(buffer)` - Parse XTH header
  - Return { width, height, dataSize }
- `static decodePixels(buffer, width, height)` - Decode bit planes to pixel array
  - Read first bit plane (Bit1)
  - Read second bit plane (Bit2)
  - Combine to create pixel values (0-3)
  - Return Uint8Array of pixel values
- `static pixelToGrayscale(pixelValue)` - Map 2-bit value to grayscale
  - 0 (00) → White (255)
  - 1 (01) → Light Grey (170)
  - 2 (10) → Dark Grey (85)
  - 3 (11) → Black (0)

**Algorithm Notes**:

- XTH stores 2 bits per pixel in two separate bit planes
- Bit plane 1: All pixels' bit 1, packed 8 per byte (MSB first)
- Bit plane 2: All pixels' bit 0, packed 8 per byte (MSB first)
- Each plane size: `Math.ceil(width * height / 8)` bytes
- Pixels stored row-major order (left-to-right, top-to-bottom)
- Pixel value calculation: `(bit1 << 1) | bit2`

### 3. Viewer Page (`view.html`)

**Purpose**: UI for loading and viewing XTC files

**Layout**:

```
┌─────────────────────────────────────┐
│  XTC File Viewer                    │
├─────────────────────────────────────┤
│  [Choose XTC File]                  │
├─────────────────────────────────────┤
│  Metadata Panel (collapsible)       │
│  - Title: ...                       │
│  - Author: ...                      │
│  - Page Count: ...                  │
│  - Version: ...                     │
│  - Reading Direction: ...           │
│  - Chapters: ...                    │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │      Canvas Display         │   │
│  │      (480 × 800)            │   │
│  │                             │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  [< Previous]  Page X/Y  [Next >]   │
└─────────────────────────────────────┘
```

**Features**:

- File input to load XTC file
- Metadata display section showing:
  - Header fields (version, page count, flags)
  - Metadata fields (title, author, timestamps)
  - Chapter list (if present)
  - Technical info (offsets, sizes)
- Canvas for displaying current page
- Navigation buttons (Previous/Next)
- Page counter (current/total)
- Keyboard navigation (Arrow keys, Page Up/Down)
- Chapter jump menu (if chapters present)

**HTML Structure**:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>XTC Viewer</title>
    <style>
      /* Styling */
    </style>
  </head>
  <body>
    <div id="viewer">
      <h1>XTC File Viewer</h1>
      <input type="file" id="fileInput" accept=".xtc,.xtch" />

      <div id="metadata" class="panel collapsed">
        <h2>File Information</h2>
        <div id="metadataContent"></div>
      </div>

      <div id="display">
        <canvas id="pageCanvas" width="480" height="800"></canvas>
      </div>

      <div id="controls">
        <button id="prevBtn">← Previous</button>
        <span id="pageInfo">Page -/-</span>
        <button id="nextBtn">Next →</button>
      </div>
    </div>

    <script type="module" src="js/viewer-main.js"></script>
  </body>
</html>
```

### 4. Viewer Main Script (`js/viewer-main.js`)

**Purpose**: Coordinate parser, renderer, and UI

**Responsibilities**:

- Handle file input
- Initialize XTCParser with loaded file
- Display metadata in UI
- Manage current page state
- Handle navigation events
- Render current page using XTHRenderer
- Update UI (page counter, button states)

**Key Functions**:

- `loadXTCFile(file)` - Load and parse XTC file
- `displayMetadata(parser)` - Populate metadata panel
- `renderPage(pageIndex)` - Render specific page to canvas
- `nextPage()` / `prevPage()` - Navigation handlers
- `setupKeyboardNavigation()` - Arrow key handlers

## Implementation Steps

1. **Create XTC Parser** (`js/xtc-parser.js`)

   - Implement header parsing
   - Implement metadata parsing
   - Implement page index parsing
   - Implement page data extraction
   - Add error handling for invalid files

2. **Create XTH Renderer** (`js/xth-renderer.js`)

   - Implement bit plane decoding
   - Implement pixel value calculation
   - Implement canvas rendering
   - Test with known XTH data

3. **Create Viewer HTML** (`view.html`)

   - Basic layout structure
   - Canvas element
   - Navigation controls
   - Metadata panel
   - Styling

4. **Create Viewer Main Script** (`js/viewer-main.js`)

   - File loading logic
   - Parser integration
   - Renderer integration
   - Navigation logic
   - Keyboard controls

5. **Testing & Debugging**
   - Test with generated XTC files
   - Verify metadata display matches XTCBuilder output
   - Verify page rendering matches original images
   - Test navigation
   - Test edge cases (no metadata, no chapters)

## Technical Details

### XTH Bit Plane Decoding Algorithm

```javascript
// Pseudo-code for decoding XTH pixels
const totalPixels = width * height;
const planeSize = Math.ceil(totalPixels / 8);

// Bit plane 1 starts at offset 22
const plane1 = new Uint8Array(buffer, 22, planeSize);
// Bit plane 2 starts after plane 1
const plane2 = new Uint8Array(buffer, 22 + planeSize, planeSize);

const pixels = new Uint8Array(totalPixels);

for (let i = 0; i < totalPixels; i++) {
  const byteIndex = Math.floor(i / 8);
  const bitIndex = 7 - (i % 8); // MSB first

  const bit1 = (plane1[byteIndex] >> bitIndex) & 1;
  const bit2 = (plane2[byteIndex] >> bitIndex) & 1;

  pixels[i] = (bit1 << 1) | bit2; // Combine to 0-3
}
```

### Reading Direction Values

- 0: Left to Right (normal)
- 1: Right to Left (manga)
- 2: Top to Bottom (vertical)

### File Validation

- Check magic number (XTC: 0x00435458, XTCH: 0x48435458)
- Verify version (0x0100)
- Validate offsets are within file bounds
- Verify page count > 0
- Check index entries point to valid data

## Future Enhancements

- Thumbnail preview grid
- Jump to page dialog
- Export individual pages as PNG
- Compare two XTC files side-by-side
- Hex dump viewer for raw data inspection
- Validate file against spec and report issues
- Export metadata as JSON
- Edit metadata and re-save XTC

## Benefits

- **Debugging**: Verify XTC structure matches spec
- **Validation**: Confirm metadata is written correctly
- **Comparison**: See what device should display vs what it does
- **Development**: Test XTCBuilder output without device
- **Documentation**: Visual reference for XTC format
