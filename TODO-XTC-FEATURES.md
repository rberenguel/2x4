# XTC Format Feature TODO

Based on official specification: `docs/xtc-xtg-xth-xtch.md`

---

## ✅ CONFIRMED: Cover Image Support in XTC Format

**Good news!** The XTC format specification **DOES support cover pages** natively.

### How Cover Pages Work (From Spec)

**Metadata Field** (offset 0xF4, 2 bytes):
- `coverPage`: Cover page number (0-based index)
- Value `0xFFFF` (65535) means no cover
- Points to an existing page in the XTC file

**Current Implementation Gap:**
- ✅ Our `xtc-builder.js` creates metadata structure
- ❌ We don't set the `coverPage` field (currently missing)
- ❌ No UI to select which page should be the cover

---

## Implementation Plan: Cover Page Support

### Phase 1: Basic Cover Page Support ✨ HIGH PRIORITY

**Goal**: Allow users to designate a cover page from existing pages

#### Code Changes Needed:

1. **Update `js/xtc-builder.js`** - Add coverPage field
   ```javascript
   // In metadata section (currently missing offset 0xF4)
   view.setUint16(metadataOffset + 0xF4, this.coverPageIndex ?? 0xFFFF, true);
   ```

2. **Add method to XTCBuilder class**:
   ```javascript
   setCoverPage(pageIndex) {
     // pageIndex is 0-based
     this.coverPageIndex = pageIndex;
   }
   ```

3. **Add UI control in `index.html`**:
   - Dropdown: "Cover page" with options:
     - "None" (default)
     - "First page"
     - "Use EPUB cover" (if available)
     - "Custom page number"

4. **Update `js/main.js`**:
   - Call `xtcBuilder.setCoverPage(0)` if user selects "First page"
   - Extract EPUB cover if user selects "Use EPUB cover"

#### Tasks:
- [ ] Add `coverPageIndex` property to XTCBuilder
- [ ] Add `setCoverPage(pageIndex)` method
- [ ] Write `coverPage` field at offset 0xF4 in metadata
- [ ] Add UI dropdown for cover page selection
- [ ] Test on device to verify cover displays

---

### Phase 2: EPUB Cover Extraction 📚 MEDIUM PRIORITY

**Goal**: Extract actual cover image from EPUB and insert as page 0

#### Implementation:

1. **Extend `js/epub-parser.js`**:
   ```javascript
   async getCoverImage() {
     // 1. Check metadata for cover-image reference
     // 2. Look for common cover file names (cover.jpg, cover.png)
     // 3. Return image blob or null
   }
   ```

2. **Insert cover as XTC page**:
   - Render EPUB cover image to 480×800 canvas
   - Encode as XTH format
   - Insert as page 0 (shift all other pages +1)
   - Set `coverPage = 0` in metadata

3. **UI Enhancement**:
   - Checkbox: "Include EPUB cover as first page"
   - Show cover preview if found

#### Tasks:
- [ ] Add `getCoverImage()` to EPUBParser
- [ ] Parse EPUB metadata for cover reference
- [ ] Handle common cover image locations
- [ ] Render cover image to canvas (resize to 480×800)
- [ ] Insert as first XTH page in XTC
- [ ] Update UI with cover preview
- [ ] Test with various EPUB files

---

### Phase 3: Custom Cover Upload 🎨 LOW PRIORITY

**Goal**: Allow users to upload a custom cover image

#### Implementation:

1. **Add file upload control**:
   ```html
   <input type="file" id="custom-cover" accept="image/*">
   ```

2. **Process custom cover**:
   - Load user's image file
   - Resize/crop to 480×800
   - Apply dithering for e-ink
   - Encode as XTH
   - Insert as page 0

3. **Cover position options**:
   - Before first page (insert as page 0)
   - After last page
   - Replace first page

#### Tasks:
- [ ] Add custom cover upload input
- [ ] Image processing: resize, crop, center
- [ ] Apply e-ink optimizations (contrast, dithering)
- [ ] UI for cover position selection
- [ ] Preview custom cover before conversion

---

## Current Implementation Issues to Fix

### Missing Metadata Fields

Our current `xtc-builder.js` is missing several fields from the spec:

#### Header (48 bytes) - NEEDS FIXES:
```javascript
// Current implementation
view.setUint8(8, 0);        // Should be: readDirection
view.setUint8(9, 1);        // Should be: hasMetadata (correct)
view.setUint8(10, 0);       // Should be: hasThumbnails
view.setUint8(11, hasChapters);  // Correct
view.setUint32(12, 1, true);     // Should be: currentPage

// Missing from current code:
view.setUint16(4, 0x0100, true); // version field (we're setting bytes 4-5 incorrectly)
```

#### Metadata (256 bytes) - NEEDS ADDITIONS:
```javascript
// Currently implemented:
// 0x00-0x7F: title (128 bytes) ✅
// 0x80-0xBF: author (64 bytes) ✅
// 0xF0-0xF3: createTime (4 bytes) ✅
// 0xF6-0xF7: chapterCount (2 bytes) ✅

// MISSING:
// 0xC0-0xDF: publisher (32 bytes) ❌
// 0xE0-0xEF: language (16 bytes) ❌
// 0xF4-0xF5: coverPage (2 bytes) ❌ ← CRITICAL FOR COVER SUPPORT
// 0xF8-0xFF: reserved (8 bytes) ❌
```

### Tasks - Fix Current Implementation:
- [ ] Fix header version field (offset 0x04, should be `0x0100`)
- [ ] Fix readDirection field (offset 0x08)
- [ ] Add hasThumbnails field (offset 0x0A)
- [ ] Fix currentPage field (offset 0x0C, currently wrong type)
- [ ] Add publisher field to metadata (offset 0xC0, 32 bytes)
- [ ] Add language field to metadata (offset 0xE0, 16 bytes)
- [ ] **Add coverPage field to metadata (offset 0xF4, 2 bytes)** ← CRITICAL
- [ ] Add reserved field to metadata (offset 0xF8, 8 bytes)

---

## Other Features from Spec

### Reading Direction Support
- [ ] Add UI dropdown for reading direction:
  - 0 = Left to Right (default)
  - 1 = Right to Left (manga)
  - 2 = Top to Bottom (vertical)
- [ ] Store in header offset 0x08
- [ ] Test if device respects this setting

### Thumbnail Support (Optional)
- [ ] Generate small thumbnails for each page
- [ ] Store at `thumbOffset`
- [ ] Set `hasThumbnails = 1` in header
- [ ] Create thumbnail index (same format as page index)
- [ ] **Low priority**: Only if device uses thumbnails for page navigation

### Publisher & Language Metadata
- [ ] Extract publisher from EPUB metadata
- [ ] Extract language code from EPUB
- [ ] Add to XTC metadata structure
- [ ] Store in correct offsets (0xC0, 0xE0)

### Current Page Tracking
- [ ] Store last read page in XTC file (offset 0x0C)
- [ ] Device can resume from this page
- [ ] Update when file is opened (device responsibility)

---

## Spec Compliance Checklist

### Header (48 bytes)
- [x] ✅ Magic "XTC\0" (offset 0x00)
- [ ] ❌ Version 0x0100 (offset 0x04) - **Currently broken**
- [x] ✅ Page count (offset 0x06)
- [ ] ❌ Reading direction (offset 0x08) - **Using wrong value**
- [x] ✅ Has metadata flag (offset 0x09)
- [ ] ❌ Has thumbnails flag (offset 0x0A) - **Not set**
- [x] ✅ Has chapters flag (offset 0x0B)
- [ ] ❌ Current page (offset 0x0C) - **Wrong type**
- [x] ✅ Metadata offset (offset 0x10)
- [x] ✅ Index offset (offset 0x18)
- [x] ✅ Data offset (offset 0x20)
- [ ] ⚠️  Thumbnail offset (offset 0x28) - **Set to 0 (unused)**

### Metadata (256 bytes)
- [x] ✅ Title (offset 0x00, 128 bytes)
- [x] ✅ Author (offset 0x80, 64 bytes)
- [ ] ❌ Publisher (offset 0xC0, 32 bytes) - **Missing**
- [ ] ❌ Language (offset 0xE0, 16 bytes) - **Missing**
- [x] ✅ Create time (offset 0xF0, 4 bytes)
- [ ] ❌ **Cover page (offset 0xF4, 2 bytes) - MISSING** ← Critical
- [x] ✅ Chapter count (offset 0xF6, 2 bytes)
- [ ] ❌ Reserved (offset 0xF8, 8 bytes) - **Missing**

### Chapters (96 bytes each)
- [x] ✅ Chapter name (offset 0x00, 80 bytes)
- [x] ✅ Start page (offset 0x50, 2 bytes)
- [x] ✅ End page (offset 0x52, 2 bytes)
- [ ] ❌ Reserved (offset 0x54, 4 bytes) - **Missing**

### Page Index (16 bytes per page)
- [x] ✅ Offset (8 bytes)
- [x] ✅ Size (4 bytes)
- [x] ✅ Width (2 bytes)
- [x] ✅ Height (2 bytes)

### Data Area
- [x] ✅ XTH page data concatenated

---

## Priority Order

### 🔴 Critical (Fix ASAP):
1. **Fix header version field** - Currently setting wrong bytes
2. **Add coverPage field to metadata** - Required for cover support
3. **Fix currentPage field type** - Should be uint32_t, not wrong type

### 🟡 High Priority (Cover Feature):
1. Add `setCoverPage()` method to XTCBuilder
2. Add UI for cover page selection
3. Implement "First page as cover" option
4. Test cover display on device

### 🟢 Medium Priority (EPUB Cover):
1. Extract EPUB cover image
2. Insert as first page
3. Auto-set as cover page

### 🔵 Low Priority (Polish):
1. Custom cover upload
2. Thumbnail generation
3. Reading direction support
4. Publisher/language metadata

---

## Reference Files

- **Specification**: `docs/xtc-xtg-xth-xtch.md` - Official format spec
- **Current Code**: `js/xtc-builder.js` - XTC generator (needs fixes)
- **Sample Code**: `js/xtc-sample.js` - Reference implementation
- **Image Encoder**: `js/xth-encoder.js` - XTH format encoder
- **EPUB Parser**: `js/epub-parser.js` - Extract metadata and cover

---

## Testing Checklist

Once changes are implemented:

- [ ] Generate XTC with coverPage = 0 (first page)
- [ ] Verify file structure with hex editor
- [ ] Test on Xteink X4 device - does cover display?
- [ ] Generate XTC with coverPage = 0xFFFF (no cover)
- [ ] Test reading direction flags
- [ ] Test with EPUB that has cover image
- [ ] Test with EPUB without cover image
- [ ] Verify all metadata fields are correct
- [ ] Check file compatibility with device

---

*Created: 2025-11-30*
*Updated: 2025-11-30 - Added official spec information*
*Status: **Ready for implementation** - cover support is confirmed in spec*
