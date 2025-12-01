# Persistent Settings Storage Plan

## Goal
Store font settings (family, size, line height) persistently using IndexedDB, with per-file settings and global defaults.

## Implementation Strategy

### 1. Copy idb-keyval.js Library
- **Source**: `/Users/ruben/code/silence/lib/idb-keyval.js`
- **Destination**: `/Users/ruben/code/epubx4/js/lib/idb-keyval.js`
- **Add to HTML**: `<script type="module" src="js/lib/idb-keyval.js"></script>` (before main.js)

### 2. Create Settings Storage Module
**File**: `js/settings-storage.js`

```javascript
import { get, set } from './lib/idb-keyval.js';

export class SettingsStorage {
  constructor() {
    this.GLOBAL_SETTINGS_KEY = 'epubx4:global-settings';
  }

  /**
   * Get settings for a specific EPUB file (by filename)
   * Falls back to global settings if no file-specific settings exist
   * @param {string} filename - EPUB filename
   * @returns {Promise<Object|null>} Settings object or null
   */
  async getSettingsForFile(filename) {
    const fileKey = `epubx4:file:${filename}`;
    const fileSettings = await get(fileKey);

    if (fileSettings) {
      return fileSettings;
    }

    // Fallback to global settings
    return await this.getGlobalSettings();
  }

  /**
   * Get global default settings
   * @returns {Promise<Object|null>}
   */
  async getGlobalSettings() {
    return await get(this.GLOBAL_SETTINGS_KEY);
  }

  /**
   * Save settings for a specific file
   * Also updates global settings as "last used"
   * @param {string} filename - EPUB filename
   * @param {Object} settings - { fontFamily, fontSize, lineHeight }
   */
  async saveSettingsForFile(filename, settings) {
    const fileKey = `epubx4:file:${filename}`;
    const settingsToSave = {
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      lastUpdated: Date.now()
    };

    // Save file-specific settings
    await set(fileKey, settingsToSave);

    // Also update global settings as "last used"
    await set(this.GLOBAL_SETTINGS_KEY, settingsToSave);
  }

  /**
   * Save only global settings (when no file is loaded)
   * @param {Object} settings - { fontFamily, fontSize, lineHeight }
   */
  async saveGlobalSettings(settings) {
    const settingsToSave = {
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      lastUpdated: Date.now()
    };

    await set(this.GLOBAL_SETTINGS_KEY, settingsToSave);
  }
}
```

### 3. Integration Points in main.js

#### A. Initialize SettingsStorage
```javascript
import { SettingsStorage } from "./settings-storage.js";

class EPUBConverterApp {
  constructor() {
    // ... existing code ...
    this.settingsStorage = new SettingsStorage();
    // ... existing code ...
  }
}
```

#### B. Load Settings on EPUB Upload
**Location**: `handleFileUpload()` method (around line 119)

After loading EPUB:
```javascript
async handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    this.elements.fileInfo.textContent = "Loading EPUB...";
    this.elements.fileInfo.classList.remove("hidden");
    const info = await this.parser.load(file);
    this.elements.fileInfo.textContent = `Loaded: ${info.metadata.title} by ${info.metadata.creator} (${info.chapterCount} chapters)`;
    this.elements.convertBtn.disabled = false;
    this.epubLoaded = true;

    // NEW: Load saved settings for this file
    this.currentFilename = file.name;
    await this.loadSavedSettings(file.name);

    await this.loadChapter(0);
  } catch (error) {
    // ... error handling ...
  }
}
```

#### C. New Method: loadSavedSettings()
```javascript
async loadSavedSettings(filename) {
  try {
    const savedSettings = await this.settingsStorage.getSettingsForFile(filename);

    if (savedSettings) {
      // Apply to UI controls
      this.elements.fontFamily.value = savedSettings.fontFamily;
      this.elements.fontSize.value = savedSettings.fontSize;
      this.elements.fontSizeValue.textContent = savedSettings.fontSize;
      this.elements.lineHeight.value = savedSettings.lineHeight;
      this.elements.lineHeightValue.textContent = savedSettings.lineHeight;

      // Apply to paginator
      this.paginator.updateSettings({
        fontFamily: savedSettings.fontFamily,
        fontSize: savedSettings.fontSize,
        lineHeight: savedSettings.lineHeight,
        customCSS: this.elements.customCSS.value
      });
    }
  } catch (error) {
    console.warn("Failed to load saved settings:", error);
  }
}
```

#### D. Save Settings on Change
**Location**: Add to existing event listeners (around line 71-78)

```javascript
// After font family change
this.elements.fontFamily.addEventListener("change", () => {
  this.updatePaginatorSettings();
  this.saveCurrentSettings(); // NEW
});

// After font size change
this.elements.fontSize.addEventListener("input", (e) => {
  this.elements.fontSizeValue.textContent = e.target.value;
  this.updatePaginatorSettings();
  this.saveCurrentSettings(); // NEW
});

// After line height change
this.elements.lineHeight.addEventListener("input", (e) => {
  this.elements.lineHeightValue.textContent = e.target.value;
  this.updatePaginatorSettings();
  this.saveCurrentSettings(); // NEW
});
```

#### E. New Method: saveCurrentSettings()
```javascript
async saveCurrentSettings() {
  const settings = {
    fontFamily: this.elements.fontFamily.value,
    fontSize: parseInt(this.elements.fontSize.value),
    lineHeight: parseFloat(this.elements.lineHeight.value)
  };

  try {
    if (this.currentFilename && this.epubLoaded) {
      // Save for specific file
      await this.settingsStorage.saveSettingsForFile(this.currentFilename, settings);
    } else {
      // Save as global defaults
      await this.settingsStorage.saveGlobalSettings(settings);
    }
  } catch (error) {
    console.warn("Failed to save settings:", error);
  }
}
```

### 4. File Structure After Implementation

```
epubx4/
├── js/
│   ├── lib/
│   │   └── idb-keyval.js (NEW - copied from silence)
│   ├── settings-storage.js (NEW)
│   ├── main.js (MODIFIED)
│   └── ... (other files)
├── index.html (MODIFIED - add script tag)
└── ...
```

### 5. Implementation Steps

1. **Copy idb-keyval.js**
   - Copy from silence project to epubx4/js/lib/

2. **Create settings-storage.js**
   - Implement SettingsStorage class with methods above

3. **Update index.html**
   - Add script import for idb-keyval (must be before main.js)

4. **Update main.js**
   - Add SettingsStorage import
   - Add settingsStorage instance to constructor
   - Add currentFilename property
   - Modify handleFileUpload() to load settings
   - Add loadSavedSettings() method
   - Add saveCurrentSettings() method
   - Update event listeners to call saveCurrentSettings()

5. **Test**
   - Load EPUB, change settings, reload → settings should persist
   - Load different EPUB → should use global settings
   - Change settings on second EPUB → should save separately
   - Load first EPUB again → should restore its specific settings

### 6. Storage Schema

**IndexedDB Database**: `keyval-store`
**Object Store**: `keyval`

**Keys**:
- `epubx4:global-settings` - Global default settings (last used)
- `epubx4:file:{filename}` - Per-file settings (e.g., `epubx4:file:book.epub`)

**Value Format**:
```json
{
  "fontFamily": "Inter",
  "fontSize": 18,
  "lineHeight": 1.6,
  "lastUpdated": 1701234567890
}
```

### 7. Edge Cases to Handle

- **No saved settings**: Use HTML defaults (fontFamily: Inter, fontSize: 16, lineHeight: 1.5)
- **Corrupted settings**: Catch errors and fall back to defaults
- **Settings change while no file loaded**: Save to global settings only
- **Same filename, different books**: Acceptable - uses filename as identifier (good enough)

### 8. Future Enhancements (Optional)

- Store customCSS per file
- Store output format preferences
- Store XTC split pages setting
- Store last page/chapter position per file
- Add "Reset to defaults" button
- Add settings export/import functionality

---

## Testing Checklist

- [ ] Load EPUB for first time → uses defaults
- [ ] Change font size → saves automatically
- [ ] Reload page, load same EPUB → restores saved settings
- [ ] Load different EPUB → uses global settings (from last book)
- [ ] Change settings on new EPUB → saves separately
- [ ] Go back to first EPUB → restores its specific settings
- [ ] Change settings with no EPUB loaded → saves to global
- [ ] Browser DevTools → Application → IndexedDB → verify keys exist

---

**Status**: Ready for implementation
**Estimated Time**: 30-45 minutes
**Dependencies**: idb-keyval.js from silence project
