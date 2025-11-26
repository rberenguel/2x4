# TODO - EPUB to Image Converter

## Recently Resolved

### Hyphenation Rendering (Fixed)
- **Issue**: CSS `hyphens: auto` worked in HTML preview but html2canvas didn't capture hyphens in exported images
- **Solution**: Implemented Hyphenopoly library to insert actual soft hyphen characters before rendering
- **Unexpected Outcome**: The CSS change caused text to reflow in a way that eliminates the need for hyphens while also avoiding justification artifacts (large white spaces)
- **Result**: Images look great without hyphens - problem solved!
- **Files Modified**:
  - `index.html` - Added Hyphenopoly configuration
  - `js/paginator.js` - Added hyphenation after content load
  - `js/renderer.js` - Added hyphenation before html2canvas capture
  - `css/reader.css` - Changed from `hyphens: auto` to `hyphens: manual`
  - Added library files: `js/Hyphenopoly_Loader.js`, `js/Hyphenopoly.js`, `js/patterns/en-us.wasm`

## High Priority

### Export Features
- [ ] **Export from current chapter**: Add option to start exporting from the currently displayed chapter instead of always starting from chapter 1
  - Add checkbox/toggle: "Start from current chapter"
  - Preserve chapter numbering or restart from 1?
  - Update progress indicator to show correct total

### Content Handling
- [ ] **TOC (Table of Contents) preservation**: Map original chapter references to image page numbers
  - Parse NCX/nav files from source EPUB
  - Track which chapter starts at which image page number
  - Generate TOC that points to correct image pages in output EPUB
  - Consider: Should TOC entries be per-chapter or per-page?

- [ ] **Embedded images in source EPUB**: Re-render or pass through
  - Detect images in chapter HTML
  - Options:
    - Re-render them as part of the page (current behavior)
    - Extract and optimize separately
    - Skip pages with images?

- [ ] **Code blocks**: Preserve syntax highlighting
  - Detect `<pre><code>` blocks
  - Apply syntax highlighting before rendering
  - Consider monospace font spacing issues
  - Test with different code block styles

- [ ] **Mathematical formulas**: Handle MathML and LaTeX
  - Detect MathML in source
  - Render formulas properly (MathJax?)
  - Consider image-based formulas (already in EPUB)
  - SVG formulas handling

## Medium Priority

### UI/UX Improvements
- [ ] **HTML preview alongside image preview**: Add second preview pane
  - Left: HTML/CSS preview (live)
  - Right: Rendered image preview (actual export)
  - Toggle between single/dual view?

- [ ] **Preview performance**: Currently renders image on every page change
  - Add caching for recently viewed pages
  - Debounce rapid navigation
  - Option to disable live preview for faster navigation

- [ ] **Settings presets**: Save/load favorite configurations
  - Save font, size, line-height, CSS combinations
  - Export/import settings as JSON
  - Common presets: "Compact", "Readable", "Large Print"

- [ ] **Batch conversion**: Process multiple EPUBs
  - Upload multiple files
  - Queue system
  - Apply same settings to all
  - Zip all outputs together

### Font & Typography
- [ ] **Custom font upload**: Allow users to upload their own fonts
  - Support .ttf, .otf, .woff, .woff2
  - Load and embed dynamically
  - Font validation

- [ ] **Font subsetting**: Reduce file size for EPUB output
  - Only include glyphs used in the book
  - Requires font subsetting library

- [ ] **Advanced typography controls**:
  - Paragraph indentation
  - Text alignment (justify, left, etc.)
  - Hyphenation control
  - Widow/orphan control

### Image Optimization
- [ ] **Dithering for B&W output**: Better than simple grayscale
  - Floyd-Steinberg dithering algorithm
  - Atkinson dithering (better for e-ink?)
  - User-selectable dithering type

- [ ] **Contrast/brightness adjustments**: Optimize for e-ink
  - Pre-process images for better e-ink display
  - Gamma correction
  - Contrast enhancement

- [ ] **Resolution presets**: Support different devices
  - XtEink X4: 480×800 (current)
  - Kindle Paperwhite: 758×1024
  - Kobo Clara: 758×1024
  - Custom resolution input

## Low Priority

### Advanced Features
- [ ] **Cover page generation**: Create custom cover page
  - Use original EPUB cover
  - Generate text-based cover
  - Custom image upload

- [ ] **Page numbers**: Add page numbers to footer
  - Configurable position and style
  - Include chapter name option
  - Skip on certain pages (covers, etc.)

- [ ] **Bookmarks/highlights preservation**: If source EPUB has them
  - Parse EPUB 3 annotations
  - Convert to visual markers
  - Or skip pages with bookmarks?

- [ ] **Split long books**: Option to split into multiple EPUBs
  - By chapter count
  - By file size
  - By page count

### Device-Specific
- [ ] **Xteink X4 filename compatibility**: Research specific naming requirements
  - Document any filename restrictions
  - Auto-sanitize for device compatibility
  - Test on actual device

- [ ] **Device calibration**: Per-device rendering tweaks
  - Xteink X4 specific optimizations
  - Gamma/contrast profiles
  - Safe margins/padding for device

### Code Quality
- [ ] **Error handling improvements**: Better user feedback
  - Graceful degradation
  - Helpful error messages
  - Recovery suggestions

- [ ] **Memory optimization**: Handle very large EPUBs
  - Stream processing instead of loading all at once
  - Clear unused image blobs
  - Progress checkpoints for resume

- [ ] **Tests**: Add basic test coverage
  - Unit tests for parsers
  - Integration tests for conversion
  - Sample EPUB test files

## Documentation
- [ ] **Troubleshooting guide**: Common issues and solutions
- [ ] **Device transfer guide**: How to sideload to XtEink X4
- [ ] **Custom CSS examples**: Gallery of useful snippets
- [ ] **Performance tips**: For large books

## Known Issues
- [ ] **HTML preview broken for pages 2+** (HIGH PRIORITY - needed for custom CSS feature)
  - Root cause: CSS columns don't render properly off-screen
  - Workaround: Using image preview instead
  - Fix: Need to find way to force column rendering before cloning
  - **Important**: Custom CSS feature requires working HTML preview for live feedback

## Device Info
**Target Device**: Xteink X4
- Resolution: 480×800 pixels
- Format: JPEG grayscale recommended
- Notes: Test actual device for filename/structure requirements
