# 2X4 - EPUB & Web Article Converter for Xteink X4

A browser-based PWA and Chrome extension that converts EPUB files, ArXiv papers, and web articles into optimized formats for the **Xteink X4** e-reader (480×800).

> **WARNING:** Work in progress. Can be broken in weird ways.

## Features

### Core Functionality

- **Browser-based:** No server or build tools required
- **Multiple input formats:**
  - **EPUB files:** Full EPUB 2/3 support with proper pagination
  - **ArXiv papers:** Direct from ArXiv HTML URLs or pasted HTML source
  - **Web articles:** Extract any article with the Chrome extension
- **Multiple output formats:**
  - **XTC:** Native X4 format with chapter markers (recommended!)
  - **EPUB:** Image-based EPUB (not yet supported by device firmware)
  - **ZIP:** Individual JPEG images
  - **XTH:** Individual XTH files per page

### Rendering & Typography

- **High-quality rendering:** 3x resolution (1440×2400) with antialiasing, downscaled to 480×800
- **Customizable typography:**
  - Font families: Inter, Reforma, Roboto, Monoid
  - Font sizes: 12-24px
  - Line heights: 1.2-2.0
  - Custom CSS support
- **Smart pagination:** CSS multi-column layout for natural text flow
- **Hyphenation:** Automatic hyphenation for justified text
- **Live preview:** Three views (Actual Size, Image, HTML) with real-time updates

### Advanced Features

- **Volume splitting:** Split large books into multiple XTC files (customizable page count, or disable for single file)
- **Testing limits:** Export just N pages or N chapters for quick testing
- **Bilingual mode:** Interleave original and translated pages (WIP)
- **Grayscale optimization:** 4-level XTH encoding optimized for e-ink displays
- **Image embedding:** Web articles include images as embedded data URIs

### Chrome Extension (Web Articles)

- **One-click extraction:** Extract articles from any webpage using Mozilla Readability
- **Reading queue:** Build a multi-article queue before converting
- **Queue management:** Add, remove, reorder articles
- **Seamless integration:** Click "Open in 2X4" → PWA automatically loads queue
- **Persistent storage:** Queue survives browser restarts
- **No export/import:** Extension and PWA communicate directly via chrome.storage

> **NOTE:**
> Conversion is slow for "reasons" (html2canvas overhead). Multiple tabs converting in parallel works fine.

## How to Use

### Option 1: Chrome Extension (Recommended for Web Articles)

1. **Install Extension:**

   ```bash
   # Clone or download this repo
   git clone https://github.com/yourusername/epubx4
   cd epubx4

   # In Chrome, go to chrome://extensions/
   # Enable "Developer mode"
   # Click "Load unpacked"
   # Select the epubx4 folder (root, which contains manifest.json)
   ```

2. **Extract Articles:**

   - Browse to any article (Medium, news sites, blogs, etc.)
   - Click the 2X4 extension icon in Chrome toolbar
   - Click "Add Current Page" to extract article
   - Repeat for more articles to build a queue
   - Use arrow buttons to reorder articles

3. **Convert:**
   - Click "🚀 Open in 2X4" button
   - PWA opens in new tab with queue automatically loaded
   - Adjust typography settings if desired
   - Navigate through articles as chapters
   - Click "Convert & Export" to generate XTC file

### Option 2: Standalone PWA (EPUB / ArXiv)

1. **Serve the application:**

   ```bash
   # Python 3
   python3 -m http.server 8000

   # Or any other HTTP server
   ```

   Open `http://localhost:8000` in your browser.
   **Or use it directly from:** [GitHub Pages](https://your-gh-pages-url)

2. **Convert an EPUB:**

   - Select "EPUB" mode
   - Click "Choose EPUB File" and select your `.epub`
   - Adjust typography settings (font, size, line height)
   - Set JPEG quality (default 85%)
   - Choose output format (XTC recommended)
   - Preview pages with navigation buttons
   - Click "Convert & Export"

3. **Convert an ArXiv paper:**

   - Select "Arxiv" mode
   - Paste ArXiv HTML URL (e.g., `https://arxiv.org/html/2511.15304v2`)
   - OR paste full HTML source from browser (View Source)
   - Click "Load from URL" or "Load from HTML"
   - Adjust settings and convert

4. **Convert web articles (without extension):**
   - Use extension to export queue (fallback option)
   - Select "Web Article" mode in PWA
   - Upload exported queue file
   - Convert as usual

### 3. Transfer to Device

- **XTC format:** Transfer `.xtc` file(s) to your Xteink X4 via USB
- **EPUB format:** Transfer `.epub` (currently unsupported by device firmware as of 2024-12-04)
- **ZIP format:** Extract and transfer individual images (not recommended)

## XTC Volume Splitting

By default, XTC export creates a **single file** containing the entire book. For very large books (>1000 pages), you can optionally split into volumes:

1. Expand "Output Format" settings
2. Adjust "Split into volumes" slider (0 = no split, 50-500 pages per volume)
3. Files will be named: `0001-bookname-0100.xtc`, `0101-bookname-0200.xtc`, etc.

**Recommendation:** Use no split (0) for most books. Use 100-page splits only for books >500 pages to keep file sizes manageable (~9MB per 100 pages).

## Technical Details

### Rendering Pipeline

1. **Parse:** Extract chapters from EPUB/ArXiv/Articles
2. **Paginate:** Use CSS multi-column layout (480px + 20px gap) in hidden container
3. **Render:** For each page:
   - Clone visible column to canvas via html2canvas
   - Render at 3x resolution (1440×2400)
   - Apply grayscale conversion
   - Downscale to 480×800 with bicubic interpolation
   - Encode as JPEG
4. **XTC Encoding:**
   - Decode JPEG to canvas
   - Convert to 4-level grayscale (2 bits per pixel)
   - Pack into XTH format (2 bitplanes per page)
   - Build XTC container with page index and chapter markers
5. **Download:** Generate XTC file(s) and trigger browser download

### Repository Structure

```
epubx4/
├── manifest.json          (Chrome extension manifest)
├── manifest-pwa.json      (PWA manifest)
├── index.html             (Main PWA interface, at root for clean URLs)
├── extension/             (Extension-specific code)
│   ├── background.js      (Service worker, queue management)
│   ├── content.js         (Article extraction with Readability)
│   ├── popup.html/js/css  (Extension popup UI)
│   ├── lib/Readability.js (Mozilla Readability library)
│   └── icons/             (Extension icons)
├── js/                    (Shared PWA/Extension code)
│   ├── main.js            (Main app logic, chrome.storage detection)
│   ├── epub-parser.js     (EPUB parsing with JSZip)
│   ├── arxiv-parser.js    (ArXiv HTML parsing)
│   ├── article-parser.js  (Web article queue parsing)
│   ├── paginator.js       (CSS column pagination)
│   ├── renderer.js        (Canvas rendering with html2canvas)
│   ├── xth-encoder.js     (4-level grayscale encoding)
│   ├── xtc-builder.js     (XTC container format)
│   └── ...
├── css/                   (Shared styles)
│   ├── style.css          (Main UI, Solarized Light theme)
│   ├── reader.css         (Book content styling)
│   └── arxiv.css          (ArXiv-specific styles)
└── fonts/                 (Embedded fonts for rendering)
```

### Extension ↔ PWA Communication

1. **Extension extracts articles** → Stores in `chrome.storage.local.articleQueue`
2. **User clicks "Open in 2X4"** → Extension opens `chrome-extension://[id]/index.html`
3. **PWA detects extension context** → Checks `typeof chrome !== 'undefined' && chrome.storage`
4. **PWA reads queue** → `chrome.storage.local.get('articleQueue')`
5. **Auto-loads articles** → Switches to Web Article mode, populates preview
6. **No file operations needed** → Seamless experience!

### Browser Compatibility

Tested on **Chrome**. Should work on any Chromium-based browser (Edge, Brave, Opera). Firefox/Safari not tested.

Extension requires Chrome/Chromium for `chrome.storage` and Manifest V3 support.

## Troubleshooting

### Extension Not Working

- Make sure you loaded the **root folder** (containing `manifest.json`), not the `extension/` subfolder
- Check `chrome://extensions/` for errors
- Ensure "Developer mode" is enabled

### Articles Not Auto-Loading

- Open browser console (F12) and check for errors
- Verify queue is not empty (extension badge should show count)
- Try refreshing the PWA tab

### Slow Conversion

- html2canvas is CPU-intensive
- Use "Testing Limits" to export fewer pages initially
- Open multiple PWA tabs to convert in parallel
- Consider reducing JPEG quality (70-80% is usually fine)

### Images Missing in Articles

- Some sites block image downloads (CORS)
- Extension embeds images as data URIs when possible
- External images may fail to load

## Credits

- Initial idea from [YACME](https://github.com/ruben-vb/yacme)'s SVG-to-Canvas approach
- XTC implementation inspired by [u/h0rm0n](https://x4converter.rho.sh/)'s converter ([Reddit post](https://www.reddit.com/r/xteinkereader/comments/1pad8mc/i_built_a_tool_to_convert_epubs_to_xtc_set_of/))
- XTC/XTH specs from [Serge Baranov](https://github.com/CrazyCoder) ([gist](https://gist.github.com/CrazyCoder/b125f26d6987c0620058249f59f1327d))
- [Mozilla Readability](https://github.com/mozilla/readability) for article extraction
- [JSZip](https://stuk.github.io/jszip/) for EPUB parsing
- [html2canvas](https://github.com/niklasvh/html2canvas) for rendering
- [Hyphenopoly](https://github.com/mnater/Hyphenopoly) for text hyphenation
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) by Jake Archibald
- Claude & Gemini for development assistance
- The XTEInk team for creating this awesome device

## License

MIT License - See LICENSE file for details

---

**Enjoy reading on your Xteink X4!** 📖✨
