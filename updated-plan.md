# EPUB to Image Converter - Updated Plan (v0: ZIP Export)

## Version 0 Scope
**Simplified goal:** Convert EPUB chapters to optimized JPEG images and export as ZIP file.
No EPUB generation complexity - just clean image output for the Kobo XtEink X4.

## Technical Constraints
1. **Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3
2. **Modularity:** Native ES Modules (`<script type="module">`)
3. **No Build Tools:** Run directly via simple HTTP server
4. **Dependencies (CDN only):**
   - JSZip: `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`

## Target Device
**Kobo XtEink X4:** 480px width x 800px height
- JPEG output (device compatibility)
- 3x resolution rendering (1440x2400) for antialiasing, downscale to 480x800
- Grayscale optimized
- Custom filename format (device-specific compatibility if needed)

## Available Fonts
Located in `/fonts/` (exclude iconoir folder):
- **Inter** - Sans-serif (Regular, Bold, Italic)
- **Monoid** - Monospace (Regular, Bold, Italic)
- **Roboto** - Sans-serif (Regular only)
- **Reforma** - Serif (Regular, Bold, Italic)

## Core Architecture

### File Structure
```
/index.html          - UI shell
/manifest.json       - PWA metadata
/css/
  style.css          - App UI styles
  reader.css         - Book content base styles
/js/
  main.js            - Entry point, UI handlers
  epub-parser.js     - EPUB parsing (JSZip)
  paginator.js       - CSS column pagination logic
  renderer.js        - SVG/Canvas rendering, image generation
  font-embed.js      - Font loading and base64 encoding
/fonts/              - Web fonts (already provided)
```

### Rendering Pipeline (v0)

#### 1. EPUB Parsing
- User uploads `.epub` file
- Parse using JSZip
- Extract spine order (reading sequence)
- Extract chapter XHTML content
- Store in memory for processing

#### 2. Page Pagination
- Hidden container `#virtual-device`: `480px x 800px`
- Inject chapter HTML
- Apply CSS: `height: 800px; width: auto; column-width: 480px; column-gap: 0;`
- Browser paginates content into columns
- Calculate number of pages per chapter

#### 3. SVG-to-Canvas Rendering (Inspired by yacme)
For each page:
1. Wrap column content in SVG `<foreignObject>`
2. Embed selected font as base64 in SVG `<style>` tag
3. Inline all critical CSS styles
4. Clone and serialize SVG to XML string
5. Create Blob and load as `<img>`
6. Draw to Canvas at **3x resolution** (1440x2400)
7. Downscale to 480x800 during JPEG encoding
8. Convert to **grayscale**
9. Export as JPEG (quality configurable)

#### 4. ZIP Export
- Iterate all chapters → all pages
- Generate JPEG for each page
- Add to ZIP with padded filenames: `page-001.jpg`, `page-002.jpg`, etc.
- Show progress bar during conversion
- Download `book-images.zip`

### UI Design (v0)

#### Left Panel: Settings
- **Font Family Dropdown**
  - Inter (default)
  - Monoid
  - Roboto
  - Reforma
- **Font Size Slider:** 12px - 24px (default: 16px)
- **Line Height Slider:** 1.2 - 2.0 (default: 1.5)
- **JPEG Quality Slider:** 60 - 100 (default: 85)
- **Custom CSS Textarea** (applies to book content only)
- **Convert Button:** Start conversion process

#### Right Panel: Preview
- Live 480x800 viewport showing current page
- Chapter name display
- Navigation:
  - [← Prev Page] [Next Page →]
  - [← Prev Chapter] [Next Chapter →]
  - Page indicator: "Page 3/12 - Chapter 2/15"

#### During Conversion
- Progress bar: "Converting... Page 47/320"
- Disable settings during process
- Auto-download ZIP when complete

## Implementation Checklist (v0)

### Phase 1: Basic Structure
- [ ] Create `index.html` with two-panel layout
- [ ] Create `css/style.css` for app UI
- [ ] Create `css/reader.css` for book content base styles
- [ ] Create `manifest.json` for PWA metadata
- [ ] Set up ES module structure

### Phase 2: EPUB Parsing
- [ ] `js/epub-parser.js`:
  - File upload handler
  - JSZip integration
  - Extract spine and chapters
  - Return chapter list with HTML content

### Phase 3: Font System
- [ ] `js/font-embed.js`:
  - Load font files from `/fonts/`
  - Convert to base64
  - Generate `@font-face` CSS for SVG embedding
  - Font selector in UI

### Phase 4: Pagination
- [ ] `js/paginator.js`:
  - Hidden container setup
  - Inject chapter HTML
  - Apply user CSS + font settings
  - Calculate column count (pages)
  - Navigate between pages/chapters
  - Update preview in real-time

### Phase 5: Rendering
- [ ] `js/renderer.js`:
  - Wrap content in SVG foreignObject
  - Embed fonts and styles
  - Serialize SVG to blob
  - Load to canvas at 3x resolution (1440x2400)
  - Apply grayscale filter
  - Downscale and encode to JPEG
  - Return blob for each page

### Phase 6: Export
- [ ] ZIP generation with JSZip
- [ ] Iterate all chapters and pages
- [ ] Show progress indicator
- [ ] Generate padded filenames: `page-001.jpg`, `page-002.jpg`
- [ ] Trigger download

### Phase 7: Polish
- [ ] Responsive layout
- [ ] Error handling (invalid EPUB, etc.)
- [ ] Loading states
- [ ] Test with real EPUBs

## Technical Details

### Grayscale Conversion
Options:
1. Canvas `filter: grayscale(100%)` - simple but may not be optimal
2. Manual pixel manipulation - more control over contrast
3. Desaturation via `ctx.globalCompositeOperation`

Start with option 1, upgrade if needed.

### Filename Format
Default: `page-001.jpg`, `page-002.jpg`, etc.
- Zero-padded to 3-4 digits (support up to 9999 pages)
- Option to customize prefix if X4 has specific requirements

### Memory Considerations
- Process one chapter at a time to avoid memory issues
- Clear canvas between renders
- Revoke blob URLs after adding to ZIP

## Future Enhancements (Post-v0)
- EPUB output generation (Phase 2)
- TOC preservation (Phase 3)
- Handle existing images in EPUB
- Handle code blocks with syntax highlighting
- Handle formulas (MathML)
- Batch conversion (multiple EPUBs)
- Background/foreground color customization
- Margin/padding controls

## Deliverables (v0)
- Working PWA that converts EPUB → ZIP of JPEGs
- Clean, modular ES6 code
- Responsive UI
- README with usage instructions
- Test with sample EPUB files

## Next Steps
1. Create basic HTML/CSS structure
2. Implement EPUB parser
3. Build pagination engine
4. Create SVG-to-Canvas renderer
5. Add ZIP export
6. Test and refine
