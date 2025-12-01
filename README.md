# EPUB to Image Converter

A browser-based PWA that converts EPUB files into optimized JPEG images for e-ink devices, specifically the **Xteink X4** (480×800).

## Features

- **Browser-based:** No server or build tools required
- **High-quality rendering:** 3x resolution with antialiasing, downscaled to target size
- **Customizable typography:** Choose fonts, sizes, and line heights
- **Live preview:** See exactly how pages will look before conversion
- **Grayscale optimization:** Images optimized for e-ink displays
- **Dual output formats:**
  - **EPUB:** Image-based EPUB files ready to read on your device
  - **ZIP:** All pages as numbered JPEGs in a ZIP file
- **Testing limits:** Export just N pages or N chapters for quick testing

## How to Use

### 1. Serve the application

You need a local HTTP server. For example,

```bash
# Python 3
python3 -m http.server 8000

```

Then open `http://localhost:8000` in your browser.

### 2. Convert an EPUB

1. **Upload:** Click "Choose EPUB File" and select your `.epub` file
2. **Adjust settings:**
   - Choose font family (Inter, Reforma, Roboto, Monoid)
   - Adjust font size (12-24px)
   - Set line height (1.2-2.0)
   - Set JPEG quality (60-100%)
   - Add custom CSS if needed
3. **Choose output format:**
   - **EPUB:** Creates an image-based EPUB (recommended for e-readers)
   - **ZIP:** Just the images in a ZIP file
4. **Set limits (optional for testing):**
   - Limit by number of pages (e.g., export only 5 pages)
   - Limit by number of chapters (e.g., export only 2 chapters)
5. **Preview:** Use navigation buttons to preview pages
6. **Convert:** Click "Convert & Export" to start
7. **Download:** File will download automatically when complete

### 3. Transfer to device

- **XTC format:** Preferred. Transfer the `.epub` file directly to your Xteink X4
- **EPUB format:** Transfer the `.epub` file directly to your Xteink X4
- **ZIP format:** Extract and transfer the individual images

## Technical Details

### Rendering Pipeline

1. **Parse EPUB:** Extract chapters using JSZip
2. **Paginate:** Use CSS multi-column layout to naturally paginate content
3. **Render:** For each page:
   - Wrap content in SVG with foreignObject
   - Embed fonts as base64
   - Convert SVG to Canvas at 3x resolution (1440×2400)
   - Apply grayscale conversion
   - Downscale to 480×800 with high-quality smoothing
   - Export as JPEG

### Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari

Requires modern browser with ES6 modules support.

## Credits

- Rendering approach inspired by [YACME](https://github.com/ruben-vb/yacme)'s SVG-to-Canvas pipeline.
- Initial XTC implementation based on [u/h0rm0n](https://x4converter.rho.sh/)'s version (originally posted [here](https://www.reddit.com/r/xteinkereader/comments/1pad8mc/i_built_a_tool_to_convert_epubs_to_xtc_set_of/))
- Specs from [Serge Baranov](https://github.com/CrazyCoder) ([gist](https://gist.github.com/CrazyCoder/b125f26d6987c0620058249f59f1327d)) and thanks to XTeink themselves

## License

MIT
