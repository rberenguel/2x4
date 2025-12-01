# To X4

A browser-based PWA that converts EPUB files and HTML ArXiv preprints (the newer ones) into optimized JPEG images for the **Xteink X4** (480×800).

> WARNING:
> Work in progress. Can be broken in weird ways.

## Features

- **Browser-based:** No server or build tools required
- **Reasonably good rendering:** 3x resolution with antialiasing, downscaled to target size
- **Customizable typography:** Choose among some fonts, sizes, and line heights
- **Live preview:** See exactly how pages will look before conversion
- **Grayscale optimization:** Images optimized for e-ink displays
- **Several output formats:**
  - **XTC:** Native image container format. This is the one you want!
  - **EPUB:** Image-based EPUB files ready to read on the X4 eventually
  - **ZIP:** All pages as numbered JPEGs in a ZIP file, because why not
- **Testing limits:** Export just N pages or N chapters for quick testing
- **Auto-break:** To avoid huge files, by default it will split every 100 pages and generate a separate "booklet". Customizable.

> NOTE:
> Conversion is very slow for "reasons". I will try to speed it up eventually. But nothing prevents you having several tabs converting in parallel.s

## How to Use

### 1. Serve the application

You need a local HTTP server. For example,

```bash
# Python 3
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Or use it from Github pages here.

### 2. Convert an EPUB / ArXiV paper

1. **Upload:** Click "Choose EPUB File" and select your `.epub` file
2. **Adjust settings:**
   - Choose font family (Inter, Reforma, Roboto, Monoid)
   - Adjust font size (12-24px)
   - Set line height (1.2-2.0)
   - Set JPEG quality (60-100%)
   - Add custom CSS if needed
3. **Choose output format:**
   - **XTC:** This is why you are here
   - **EPUB:** Creates an image-based EPUB
   - **ZIP:** Just the images in a ZIP file
4. **Set limits (optional for testing):**
   - Limit by number of pages (e.g., export only 5 pages)
   - Limit by number of chapters (e.g., export only 2 chapters)
5. **Preview:** Use navigation buttons to preview pages. You can scale the "real" preview to match your device size (sadly pixels-to-centimeters is buggy, getting you to do it with your particular screen is best)
6. **Convert:** Click "Convert & Export" to start
7. **Download:** File will download automatically when complete

For ArXiv, just use the toggle and paste the URL. I assume you are smart enough for that one if you want to read papers in such a tiny device.

### 3. Transfer to device

- **XTC format:** Preferred. Transfer the `.epub` file directly to your Xteink X4
- **EPUB format:** Transfer the `.epub` file directly to your Xteink X4. Currently (20251201, Chinese or English firmware) it will not render anything.
- **ZIP format:** Extract and transfer the individual images. I don't think you want this.

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

I have only tried Chrome. Should work in any browser, but no promises.

## Credits

- Rendering approach inspired by [YACME](https://github.com/ruben-vb/yacme)'s SVG-to-Canvas pipeline.
- Initial XTC implementation based on [u/h0rm0n](https://x4converter.rho.sh/)'s version (originally posted [here](https://www.reddit.com/r/xteinkereader/comments/1pad8mc/i_built_a_tool_to_convert_epubs_to_xtc_set_of/))
- Specs from [Serge Baranov](https://github.com/CrazyCoder) ([gist](https://gist.github.com/CrazyCoder/b125f26d6987c0620058249f59f1327d)) and thanks to XTeink themselves
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) by Jake Archibald
- [hyphenopoly](https://github.com/mnater/Hyphenopoly)
- [html2canvas](https://github.com/niklasvh/html2canvas)
- Claude
- Gemini
- The XTEInk folks. I really like this device.

## License

MIT
