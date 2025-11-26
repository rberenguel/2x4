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

You need a local HTTP server. Choose one:

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if you have http-server installed)
npx http-server -p 8000

# PHP
php -S localhost:8000
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

- **EPUB format:** Transfer the `.epub` file directly to your Xteink X4
- **ZIP format:** Extract and transfer the individual images

## Project Structure

```
epubx4/
├── index.html              # Main HTML
├── manifest.json           # PWA manifest
├── css/
│   ├── style.css          # App UI (Solarized Light)
│   └── reader.css         # Book content styles
├── js/
│   ├── main.js            # Main application logic
│   ├── epub-parser.js     # EPUB parsing with JSZip
│   ├── font-embed.js      # Font loading and base64 encoding
│   ├── paginator.js       # CSS column-based pagination
│   └── renderer.js        # SVG-to-Canvas rendering
└── fonts/                 # Web fonts (Inter, Reforma, Roboto, Monoid)
```

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

## Limitations (v0)

- No TOC (Table of Contents) preservation
- No special handling for existing images, code blocks, or formulas
- Memory limited by browser (very large EPUBs may cause issues)

## Roadmap

- **v1:** EPUB output (image-based EPUB files)
- **v2:** TOC preservation and mapping
- **v3:** Advanced content handling (images, code, formulas)

## Credits

Rendering approach inspired by [YACME](https://github.com/ruben-vb/yacme)'s SVG-to-Canvas pipeline.

## License

MIT
