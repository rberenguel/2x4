# 2X4 Article Extractor - Chrome Extension

Extract web articles into a reading queue for offline conversion to XTC format on Xteink X4 e-readers.

## Installation

### Load as Unpacked Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repository
5. The extension icon should appear in your toolbar

## Usage

### Building Your Reading Queue

1. **Browse the web** - Navigate to any article you want to read offline
2. **Click the extension icon** - Opens the queue management popup
3. **Click "Add Current Page"** - Extracts the article using Mozilla Readability
4. **Repeat** - Add as many articles as you want from different sites
5. **Manage queue** - Reorder articles (⬆️⬇️) or remove unwanted ones (❌)

### Exporting Queue

1. Click the extension icon to open the popup
2. Review your queue (shows article count and total reading time)
3. Click **"Export Queue"** button
4. Save the file (default: `reading-queue-YYYY-MM-DD.html`)

### Converting to XTC

1. Open the [2X4 PWA](../index.html)
2. Select **"Web Article"** mode
3. Upload the exported queue file
4. Configure typography settings as desired
5. Click **"Convert"** to generate XTC file
6. Transfer XTC file to your Xteink X4 device

## Features

- **Queue-based workflow** - Accumulate articles before exporting
- **Persistent storage** - Queue survives browser restarts
- **Image embedding** - Articles are self-contained with embedded images (no CORS issues)
- **Queue management** - Reorder, remove, or clear articles
- **Reading time estimates** - Based on word count (200 words/min)
- **Badge counter** - Shows queue size on extension icon
- **Duplicate detection** - Won't add the same URL twice

## Supported Sites

Works on most article-based websites:

- **News sites** - NYTimes, Guardian, BBC, Reuters, etc.
- **Blogs** - Medium, Substack, personal WordPress/Ghost blogs
- **Documentation** - MDN, dev.to, technical docs
- **Long-form content** - Any site with article-like structure

## Limitations

- **Cannot extract paywalled content** beyond preview text
- **Image-heavy articles** may create large files (>5MB images are skipped)
- **JavaScript-heavy sites** with dynamic content may not work well
- **PDF-based content** not supported (use PWA's Arxiv mode instead)
- **Single-page apps** may not have extractable article content

## Troubleshooting

### "Could not extract article from this page"

- The page might not have article-like content
- Try using Chrome's Reader View first to verify readability
- Some sites use anti-scraping techniques that block extraction

### Images not showing in converted XTC

- Images larger than 5MB are automatically skipped during extraction
- Some images may be behind authentication or CORS restrictions
- Check browser console for image embedding errors

### Queue not persisting

- Check that Chrome has sufficient storage quota
- Clear browser cache and reload extension
- Reimport extension if issue persists

### Export file is very large

- Each article with images can be 500KB-5MB
- Queue of 20+ articles may exceed 50MB
- Consider exporting in smaller batches
- Remove image-heavy articles from queue

## Privacy

This extension:

- **Only runs when you click "Add Current Page"**
- **Does not collect or transmit any data**
- **Stores data locally in Chrome storage only**
- **Works entirely offline after extraction**
- **Source code is fully open for inspection**

## Technical Details

- **Mozilla Readability** - Same algorithm as Firefox Reader View
- **Manifest V3** - Modern Chrome extension format
- **Data URI images** - Embedded as base64 for portability
- **JSON export format** - Structured data compatible with PWA

## Development

### File Structure

```
extension/
├── manifest.json       # Extension configuration
├── background.js       # Queue management & export
├── content.js          # Article extraction
├── popup.html          # Queue UI
├── popup.js            # UI logic
├── popup.css           # Styling
├── lib/
│   └── Readability.js  # Mozilla library
└── icons/
    ├── icon-16.png     # Toolbar icon
    ├── icon-48.png     # Extension manager
    └── icon-128.png    # Chrome Web Store
```

### Local Development

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click reload icon on the extension card
4. Test changes in browser

## License

Same as parent project.

## Credits

- [Mozilla Readability](https://github.com/mozilla/readability) - Article extraction library
- Built for [Xteink X4](https://xteink.com/) e-paper devices
