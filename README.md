# 2X4 - EPUB & Web Article Converter for Xteink X4

A browser-based PWA and Chrome extension that converts EPUB files, ArXiv papers, and web articles into optimized formats for the **Xteink X4** e-reader (480×800).

> **WARNING:** Work in progress. Can be broken in weird ways.

## Features

### Core Functionality

- **Browser-based:** No server or build tools required
- **Multiple input formats:**
  - **EPUB files:** Full EPUB 2/3 support with proper pagination
  - **Comics (CBZ/CBR):** Smart conversion with auto-split and dithering (still in progress, manual split only)
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

### Chrome Extension (Web Articles & ArXiv with Images)

- **One-click extraction:** Extract articles from any webpage using Mozilla Readability
- **ArXiv paper support:** Extract ArXiv papers with embedded images (bypasses CORS restrictions)
- **Reading queue:** Build a multi-article queue before converting
- **Queue management:** Add, remove, reorder articles
- **Self-contained converter:** Extension includes its own converter interface with full PWA features
- **No PWA needed:** Convert directly in the extension - all typography, format, and preview options available
- **Persistent storage:** Queue survives browser restarts
- **Smart separation:** ArXiv papers are automatically exported individually (e.g., `2510.04618v1.xtc`), while regular web articles are bundled together (e.g., `2x4-3-20251207.xtc`)
- **Device file manager:** Browse, upload, rename, delete files, and create folders on X4 device via WiFi (hotspot mode)

### XTC Viewer

- **View XTC files:** Open and browse through XTC files directly in browser
- **Metadata display:** View title, author, chapters, and file information
- **Navigation:** Navigate pages with buttons or keyboard (arrows, Page Up/Down, Home/End, Space)
- **Chapter jumping:** Click chapters in metadata panel to jump to specific sections
- **Actual size preview:** Adjustable scale preview (10-140%) to match real device size
- **Keyboard shortcut:** Press `v` to open viewer in new tab (works in both PWA and extension)

### Comic Converter (Alpha)

- **Formats:** Supports `.cbz` (ZIP) and `.cbr` (RAR) files
- **Smart Processing:**
  - **Auto-split:** Automatically detects panel gaps to split double-page spreads
  - **Manual Trim:** Crop margins per page or globally
  - **Batch Actions:** "Apply to Remaining" for Rotation, Splits, Brightness, Contrast, and B&W Mode
- **Display Modes:**
  - **Actual Size:** Calibrated 1:1 preview for X4 screen size
  - **Dithered:** Preview the exact 1-bit or 2-bit output
- **Optimized:** High-quality dithering algorithms (Atkinson, Floyd-Steinberg, etc.)

> **NOTE:**
> Conversion is slow for "reasons" (html2canvas overhead). Multiple tabs converting in parallel works fine.

## How to Use

### Option 1: Chrome Extension (Recommended for Web Articles)

1. **Install Extension:**

   ```bash
   # Clone or download this repo
   git clone https://github.com/rberenguel/2x4
   cd 2x4

   # In Chrome, go to chrome://extensions/
   # Enable "Developer mode"
   # Click "Load unpacked"
   # Select the "extension" folder (contains manifest.json)
   ```

2. **Extract & Convert Articles:**

   - Browse to any article (Medium, news sites, blogs, etc.) or ArXiv paper
   - Click the 2X4 extension icon in Chrome toolbar
   - Click "Add Current Page" to extract article
   - Repeat for more articles to build a queue
   - Use arrow buttons to reorder articles as needed
   - Click "Convert Queue" button
   - Extension opens converter interface in new tab
   - Queue is automatically loaded
   - Adjust typography/format settings if desired
   - Preview articles with navigation
   - Click "Convert & Export" to generate XTC file(s)
   - ArXiv papers are exported individually with their ArXiv ID as filename
   - Regular articles are bundled together with date-based filename

   **Note:** ArXiv papers with heavy mathematical notation can take 10-30 seconds per page to render. Consider converting them separately from web articles.

### Option 2: Standalone PWA (EPUB / ArXiv)

> **⚠️ Note:** The Chrome extension has additional features including device file management (browse, upload, rename, delete files via WiFi). For the full feature set, consider using the extension instead.

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
   - **⚠️ Note:** PWA cannot load images due to CORS restrictions. For papers with figures, use the Chrome extension instead.
   - Paste ArXiv HTML URL (e.g., `https://arxiv.org/html/2511.15304v2`)
   - OR paste full HTML source from browser (View Source)
   - Click "Load from URL" or "Load from HTML"
   - Adjust settings and convert

4. **Convert a Comic (CBZ/CBR):**

   - Open the extension popup and click "Comic Converter (alpha)"
   - Or navigate to `cbz.html`
   - Upload a `.cbz` or `.cbr` file
   - **Calibrate:** Use the ruler to match the physical screen size
   - **Edit:** Rotate, crop, or split pages as needed
   - **Batch:** Use "Apply to Remaining" to propagate settings
   - **Dither:** Choose a dithering algorithm (Atkinson recommended)
   - Click "Convert" to download the XTC file

### 3. View XTC Files

1. **Open viewer:**

   - Press `v` keyboard shortcut in PWA or extension to open viewer in new tab
   - Or navigate directly to `viewer.html`

2. **Load and browse:**
   - Click "Choose XTC File" to select an `.xtc` or `.xtch` file
   - View file metadata (title, author, chapters)
   - Navigate with buttons or keyboard shortcuts:
     - `←` / `→` or `PageUp` / `PageDown` - Previous/Next page
     - `Space` - Next page
     - `Home` / `End` - First/Last page
   - Click chapters in metadata panel to jump
   - Adjust scale slider (10-140%) to match real device size

### 4. Transfer to Device

**Recommended method (Extension users):**

- Use the built-in WiFi file manager (see Extension Device File Manager below)
- Connect to device WiFi hotspot, upload files directly

**Alternative methods:**

- **SD Card:** Remove SD card from device, copy files via card reader
- **Third-party apps:** Use apps like [Hojo](https://github.com/meta-boy/hojo) (unaffiliated) for WiFi transfer

**Supported formats:**

- **XTC format:** Recommended - native X4 format with chapters
- **EPUB format:** Currently unsupported by device firmware (as of 2024-12-04)
- **ZIP format:** Individual images (not recommended - no chapters, harder to navigate)

## XTC Volume Splitting

By default, XTC export creates a **single file** containing the entire book. For very large books (>1000 pages), you can optionally split into volumes:

1. Expand "Output Format" settings
2. Adjust "Split into volumes" slider (0 = no split, 50-500 pages per volume)
3. Files will be named: `0001-bookname-0100.xtc`, `0101-bookname-0200.xtc`, etc.

**Recommendation:** Use no split (0) for most books. Use 100-page splits only for books >500 pages to keep file sizes manageable (~9MB per 100 pages).

## Extension Device File Manager

The Chrome extension includes a WiFi-based file manager for the Xteink X4 device:

1. **Connect to device:**

   - Enable WiFi hotspot on X4 device (SSID: "E-Paper", password: "12345678")
   - Connect your computer to the device hotspot
   - Enter device IP (default: 192.168.3.3) in extension

2. **Browse and manage files:**

   - Click "Manage files on device" to open file browser
   - Navigate folders by clicking folder names
   - Use ".." to go up one level

3. **File operations:**
   - **Upload:** Click "Upload Here" button, select files from your computer
   - **Rename:** Click ✏️ button next to any file or folder, enter new name
   - **Delete:** Click ✕ button next to any file, confirm deletion
   - **New Folder:** Click "New Folder" button, enter folder name
   - Upload to multiple folders without closing the browser

**Note:** Especially useful for cleaning up Spotlight's hidden files (`.DS_Store`, etc.) that pollute the SD card when connected via USB.

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
2x4/
├── index.html             (Main PWA interface for EPUB/ArXiv)
├── viewer.html            (XTC file viewer)
├── manifest-pwa.json      (PWA manifest)
├── extension/             (Chrome Extension)
│   ├── manifest.json      (Extension manifest V3)
│   ├── background.js      (Service worker, queue management)
│   ├── content.js         (Article extraction with Readability)
│   ├── popup.html/js/css  (Extension popup UI)
│   ├── converter.html/js  (Self-contained converter interface)
│   ├── lib/Readability.js (Mozilla Readability library)
│   ├── jszip.min.js       (Local JSZip for CSP compliance)
│   ├── hyphenopoly-config.js (Hyphenation config)
│   └── icons/             (Extension icons)
├── js/                    (Shared conversion code)
│   ├── main.js            (PWA app logic - EPUB/ArXiv only)
│   ├── viewer-main.js     (XTC viewer app logic)
│   ├── xtc-parser.js      (XTC file parsing)
│   ├── xth-renderer.js    (XTH image decoding and rendering)
│   ├── epub-parser.js     (EPUB parsing with JSZip)
│   ├── arxiv-parser.js    (ArXiv HTML parsing)
│   ├── article-parser.js  (Web article queue parsing - used by extension)
│   ├── paginator.js       (CSS column pagination)
│   ├── renderer.js        (Canvas rendering with html2canvas)
│   ├── xth-encoder.js     (4-level grayscale encoding)
│   ├── xtc-builder.js     (XTC container format)
│   ├── conversion-pipeline.js (Core conversion logic)
│   ├── conversion-controller.js (UI progress handling)
│   └── ...
├── css/                   (Shared styles)
│   ├── style.css          (Main UI, Solarized Light theme)
│   ├── reader.css         (Book content styling)
│   └── arxiv.css          (ArXiv-specific styles)
└── fonts/                 (Embedded fonts for rendering)
```

### Extension Architecture

1. **Popup UI** (`popup.html`) → Queue management (add, remove, reorder)
2. **Background worker** (`background.js`) → Stores queue in `chrome.storage.local`
3. **Content script** (`content.js`) → Extracts articles with Mozilla Readability
4. **Converter interface** (`extension/converter.html`) → Self-contained converter with full PWA features
5. **Queue auto-loading** → Converter reads from `chrome.storage.local` on launch
6. **No PWA dependency** → Extension works completely standalone

### Browser Compatibility

Tested on **Chrome**. Should work on any Chromium-based browser (Edge, Brave, Opera). Firefox/Safari not tested.

Extension requires Chrome/Chromium for `chrome.storage` and Manifest V3 support.

## Troubleshooting

### Extension Not Working

- Make sure you loaded the **extension folder** (containing `manifest.json`)
- Check `chrome://extensions/` for errors
- Ensure "Developer mode" is enabled
- Verify extension icon appears in Chrome toolbar

### Articles Not Auto-Loading in Converter

- Open browser console (F12) and check for errors
- Verify queue is not empty (extension badge should show count)
- Try closing and reopening the converter tab
- Check `chrome.storage.local` in extension background worker console

### Slow Conversion

- html2canvas is CPU-intensive
- **ArXiv papers with heavy math**: Papers with lots of inline SVG equations (LaTeX math) can be extremely slow (10-30 seconds per page). This is an html2canvas limitation when processing complex SVG structures. Consider:
  - Converting ArXiv papers separately from web articles
  - Starting the conversion and letting it run in the background
  - Using the PWA text-only mode (no images) for reading without figures
- Use "Testing Limits" to export fewer pages initially
- Open multiple PWA tabs to convert in parallel
- Consider reducing JPEG quality (70-80% is usually fine)

### Images Missing in Articles

- **PWA ArXiv mode:** Cannot load images due to CORS restrictions - use Chrome extension for papers with figures
- **Extension:** Embeds images as data URIs when possible, bypasses CORS for ArXiv papers
- Some websites may still block image downloads (CORS)
- External images may fail to load on certain sites

## Credits

- Initial idea from [YACME](https://github.com/ruben-vb/yacme)'s SVG-to-Canvas approach
- XTC implementation inspired by [u/h0rm0n](https://x4converter.rho.sh/)'s converter ([Reddit post](https://www.reddit.com/r/xteinkereader/comments/1pad8mc/i_built_a_tool_to_convert_epubs_to_xtc_set_of/))
- XTC/XTH specs from [Serge Baranov](https://github.com/CrazyCoder) ([gist](https://gist.github.com/CrazyCoder/b125f26d6987c0620058249f59f1327d))
- [Mozilla Readability](https://github.com/mozilla/readability) for article extraction
- [JSZip](https://stuk.github.io/jszip/) for EPUB parsing
- [html2canvas](https://github.com/niklasvh/html2canvas) for rendering
- [bitjs](https://github.com/google/bitjs) for RAR/CBR support
- [Hyphenopoly](https://github.com/mnater/Hyphenopoly) for text hyphenation
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) by Jake Archibald
- Claude & Gemini for development assistance
- The XTEInk team for creating this awesome device

## License

MIT License - See LICENSE file for details

---

**Enjoy reading on your Xteink X4!** 📖✨
