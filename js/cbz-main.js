import { CbzParser } from "./cbz-parser.js";
import { CbrParser } from "./cbr-parser.js";
import { ImageTransformer } from "./image-transformer.js";
import { DITHER_ALGORITHMS } from "./dither-algorithms.js";
import { SplitEditor } from "./split-editor.js";
import { CBZConversionPipeline } from "./cbz-conversion-pipeline.js";

class CbzMain {
  constructor() {
    this.parser = null;
    this.pageConfigs = new Map(); // pageIndex -> config object
    this.currentPageIndex = 0;
    this.currentTransformedCanvas = null;
    this.currentRegions = []; // Store calculated regions
    this.globalTrim = null; // Store global trim settings

    // Cache DOM elements
    this.els = {
      fileInput: document.getElementById("cbz-upload"),
      fileInfo: document.getElementById("file-info"),

      // Nav
      prevBtn: document.getElementById("prev-btn"),
      nextBtn: document.getElementById("next-btn"),
      pageIndicator: document.getElementById("page-indicator"),

      // Canvases
      originalCanvas: document.getElementById("original-canvas"),
      overlayCanvas: document.getElementById("overlay-canvas"),
      ditherCanvas: document.getElementById("dither-canvas"),

      // Transforms
      rotateBtn: document.getElementById("rotate-btn"),
      applyRotationRemainingBtn: document.getElementById(
        "apply-rotation-remaining-btn",
      ),
      brightness: document.getElementById("brightness"),
      contrast: document.getElementById("contrast"),
      applyAdjustmentsRemainingBtn: document.getElementById(
        "apply-adjustments-remaining-btn",
      ),
      brightnessVal: document.getElementById("brightness-val"),
      contrastVal: document.getElementById("contrast-val"),

      // Trims
      trimTop: document.getElementById("trim-top"),
      trimBottom: document.getElementById("trim-bottom"),
      trimLeft: document.getElementById("trim-left"),
      trimRight: document.getElementById("trim-right"),
      trimTopVal: document.getElementById("trim-top-val"),
      trimBottomVal: document.getElementById("trim-bottom-val"),
      trimLeftVal: document.getElementById("trim-left-val"),
      trimRightVal: document.getElementById("trim-right-val"),
      applyTrimAllBtn: document.getElementById("apply-trim-all"),

      // B&W
      bwMode: document.getElementById("bw-mode"),
      bwControls: document.getElementById("bw-controls"),
      bwThreshold: document.getElementById("bw-threshold"),
      applyBwRemainingBtn: document.getElementById("apply-bw-remaining-btn"),
      bwThresholdVal: document.getElementById("bw-threshold-val"),

      resetBtn: document.getElementById("reset-transforms-btn"),

      // Splits
      vSplitGroup: document.getElementById("v-split-group"),
      hSplitGroup: document.getElementById("h-split-group"),
      autoSplitBtn: document.getElementById("auto-split-btn"),
      applySplitsRemainingBtn: document.getElementById(
        "apply-splits-remaining-btn",
      ),
      clearSplitsBtn: document.getElementById("clear-splits-btn"),
      splitThumbnails: document.getElementById("split-thumbnails"),

      // Output
      ditherAlgo: document.getElementById("dither-algo"),
      outputFormat: document.getElementById("output-format"),
      convertBtn: document.getElementById("convert-btn"),
      progressContainer: document.getElementById("progress-container"),
      progressFill: document.getElementById("progress-fill"),
      progressText: document.getElementById("progress-text"),

      // Sections
      transformControls: document.getElementById("transform-controls"),
      splitControls: document.getElementById("split-controls"),
      ditherControls: document.getElementById("dither-controls"),
      outputControls: document.getElementById("output-controls"),

      // Preview Header
      filenameTitle: document.getElementById("preview-filename"),

      // New 3-Pane Layout Elements
      sizeCalibration: document.getElementById("size-calibration"),
      sizeCalibrationValue: document.getElementById("size-calibration-value"),
      actualSizeViewport: document.getElementById("actual-size-viewport"),
      ditherViewport: document.getElementById("dither-viewport"),
      originalViewport: document.getElementById("original-viewport"),
    };

    // Initialize Preview Tabs and Calibration
    this.initializePreviewTabs();
    this.loadCalibrationScale();
    this.initListeners();
  }

  initializePreviewTabs() {
    const tabs = document.querySelectorAll(".preview-tab");
    const columns = document.querySelectorAll(".preview-column");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const type = tab.dataset.preview;

        // Update tabs
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Update columns
        columns.forEach((col) => {
          if (col.dataset.preview === type) {
            col.classList.add("active");
          } else {
            col.classList.remove("active");
          }
        });
      });
    });
  }

  loadCalibrationScale() {
    const saved = localStorage.getItem("cbz_calibration_scale");
    if (saved) {
      const val = parseInt(saved);
      this.els.sizeCalibration.value = val;
      this.els.sizeCalibrationValue.innerText = val;
      this.els.actualSizeViewport.style.transform = `scale(${val / 100})`;
    }
  }

  initListeners() {
    this.els.fileInput.addEventListener("change", (e) =>
      this.handleFileUpload(e),
    );

    // Navigation (Header)
    this.els.prevBtn.addEventListener("click", () => this.navigate(-1));
    this.els.nextBtn.addEventListener("click", () => this.navigate(1));

    // Transforms
    this.els.rotateBtn.addEventListener("click", () => this.rotate());
    if (this.els.applyRotationRemainingBtn) {
      this.els.applyRotationRemainingBtn.addEventListener("click", () =>
        this.applyRotationToRemaining(),
      );
    }

    // Sliders (Brightness/Contrast)
    ["brightness", "contrast"].forEach((key) => {
      this.els[key].addEventListener("input", (e) => {
        this.els[`${key}Val`].innerText = e.target.value;
        this.updateConfig({ [key]: parseInt(e.target.value) });
      });
    });

    if (this.els.applyAdjustmentsRemainingBtn) {
      this.els.applyAdjustmentsRemainingBtn.addEventListener("click", () =>
        this.applyAdjustmentsToRemaining(),
      );
    }

    // Trim Sliders
    ["trimTop", "trimBottom", "trimLeft", "trimRight"].forEach((key) => {
      this.els[key].addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.els[`${key}Val`].innerText = `${val}%`;

        // Construct trim object update
        const currentConfig =
          this.pageConfigs.get(this.currentPageIndex) ||
          this.getDefaultConfig();
        const currentTrim = currentConfig.trim || {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        };

        const trimKey = key.replace("trim", "").toLowerCase();
        const newTrim = { ...currentTrim, [trimKey]: val };

        this.updateConfig({ trim: newTrim });
      });
    });

    this.els.applyTrimAllBtn.addEventListener("click", () =>
      this.applyTrimToAll(),
    );

    // B&W Mode
    this.els.bwMode.addEventListener("change", (e) => {
      const isEnabled = e.target.checked;
      this.els.bwControls.classList.toggle("hidden", !isEnabled);
      this.updateConfig({ bwMode: isEnabled });
    });

    this.els.bwThreshold.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      this.els.bwThresholdVal.innerText = val;
      this.updateConfig({ bwThreshold: val });
    });

    if (this.els.applyBwRemainingBtn) {
      this.els.applyBwRemainingBtn.addEventListener("click", () =>
        this.applyBwToRemaining(),
      );
    }

    this.els.resetBtn.addEventListener("click", () => this.resetPage());

    // Splits
    this.els.vSplitGroup.addEventListener("click", (e) => {
      if (e.target.classList.contains("toggle-btn")) {
        const val = parseInt(e.target.dataset.val);
        this.updateSplitUI(this.els.vSplitGroup, val);

        let splits = [];
        if (val === 1) splits = [0.5];
        if (val === 2) splits = [0.333, 0.666];
        this.updateConfig({ verticalSplits: splits });
      }
    });

    this.els.hSplitGroup.addEventListener("click", (e) => {
      if (e.target.classList.contains("toggle-btn")) {
        const val = parseInt(e.target.dataset.val);
        this.updateSplitUI(this.els.hSplitGroup, val);

        let splits = [];
        if (val === 1) splits = [0.5];
        this.updateConfig({ horizontalSplits: splits });
      }
    });

    this.els.autoSplitBtn.addEventListener("click", () =>
      this.autoDetectSplits(),
    );

    if (this.els.applySplitsRemainingBtn) {
      this.els.applySplitsRemainingBtn.addEventListener("click", () =>
        this.applySplitsToRemaining(),
      );
    }

    this.els.clearSplitsBtn.addEventListener("click", () => {
      this.updateConfig({ verticalSplits: [], horizontalSplits: [] });
      this.updateSplitButtons({ verticalSplits: [], horizontalSplits: [] });
    });

    // Output
    this.els.convertBtn.addEventListener("click", () => this.startConversion());

    // Calibration Slider
    this.els.sizeCalibration.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      this.els.sizeCalibrationValue.innerText = val;
      this.els.actualSizeViewport.style.transform = `scale(${val / 100})`;
      localStorage.setItem("cbz_calibration_scale", val);
    });
  }

  setViewMode(mode) {
    // Deprecated/Removed - logic handled by CSS/Tabs now
  }

  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    console.log("2X4: Reading file", file.name);

    try {
      // Instantiate correct parser
      if (file.name.toLowerCase().endsWith(".cbr")) {
        this.parser = new CbrParser();
      } else {
        this.parser = new CbzParser();
      }

      this.updateUIStatus("Loading...", true);
      const metadata = await this.parser.load(file);
      console.log("2X4: Parser loaded", metadata);

      this.updateUIStatus(
        `Loaded: ${metadata.filename} (${metadata.pageCount} pages)`,
        false,
      );
      this.els.filenameTitle.innerText = metadata.filename;

      this.enableControls();

      this.currentPageIndex = 0;
      this.pageConfigs.clear();
      this.selectedRegionIndex = 0;

      console.log("2X4: Rendering Page 0");
      await this.renderCurrentPage();
    } catch (err) {
      console.error("2X4: Load Error", err);
      alert("Failed to load file: " + err.message);
    }
  }

  enableControls() {
    // Enable Section Containers
    const sections = [
      this.els.transformControls,
      this.els.splitControls,
      this.els.ditherControls,
      this.els.outputControls,
    ];
    sections.forEach((el) => {
      if (el) el.classList.remove("controls-disabled");
    });

    // Enable Header Nav Buttons
    this.els.prevBtn.disabled = false;
    this.els.nextBtn.disabled = false;
  }

  updateUIStatus(msg, isLoading) {
    this.els.fileInfo.innerText = msg;
    this.els.fileInfo.classList.remove("hidden");
  }

  async navigate(delta) {
    const newIndex = this.currentPageIndex + delta;
    if (newIndex >= 0 && newIndex < this.parser.metadata.pageCount) {
      this.currentPageIndex = newIndex;
      this.selectedRegionIndex = 0; // Reset region selection on page change
      await this.renderCurrentPage();
    }
  }

  getDefaultConfig() {
    return {
      rotation: 0,
      brightness: 100,
      contrast: 100,
      bwMode: false,
      bwThreshold: 128,
      verticalSplits: [],
      horizontalSplits: [],
      trim: this.globalTrim
        ? { ...this.globalTrim }
        : { top: 0, bottom: 0, left: 0, right: 0 },
    };
  }

  updateConfig(changes) {
    let config =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();

    // Merge simple properties
    if (changes.rotation !== undefined) config.rotation = changes.rotation;
    if (changes.brightness !== undefined)
      config.brightness = changes.brightness;
    if (changes.contrast !== undefined) config.contrast = changes.contrast;
    if (changes.bwMode !== undefined) config.bwMode = changes.bwMode;
    if (changes.bwThreshold !== undefined)
      config.bwThreshold = changes.bwThreshold;

    // Merge objects
    if (changes.trim !== undefined) config.trim = changes.trim;
    if (changes.verticalSplits !== undefined)
      config.verticalSplits = changes.verticalSplits;
    if (changes.horizontalSplits !== undefined)
      config.horizontalSplits = changes.horizontalSplits;

    this.pageConfigs.set(this.currentPageIndex, config);
    this.renderCurrentPage();
  }

  resetPage() {
    this.pageConfigs.delete(this.currentPageIndex);
    this.renderCurrentPage();
  }

  rotate() {
    const config =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();
    const newRotation = (config.rotation + 90) % 360;
    this.updateConfig({ rotation: newRotation });
  }

  applyTrimToAll() {
    // Get current page trim
    const currentConfig =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();
    const trim = currentConfig.trim || { top: 0, bottom: 0, left: 0, right: 0 };

    // Store as global
    this.globalTrim = { ...trim };

    // Propagate to all EXISTING configs
    for (const [idx, cfg] of this.pageConfigs.entries()) {
      cfg.trim = { ...trim };
      this.pageConfigs.set(idx, cfg);
    }

    alert(
      `Trim settings (T:${trim.top}%, B:${trim.bottom}%, L:${trim.left}%, R:${trim.right}%) applied to all pages.`,
    );
    this.renderCurrentPage();
  }

  applyRotationToRemaining() {
    const currentConfig =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();
    const rot = currentConfig.rotation || 0;

    let count = 0;
    for (
      let i = this.currentPageIndex + 1;
      i < this.parser.metadata.pageCount;
      i++
    ) {
      const config = this.pageConfigs.get(i) || this.getDefaultConfig();
      config.rotation = rot;
      this.pageConfigs.set(i, config);
      count++;
    }
    alert(`Rotation (${rot}°) applied to next ${count} pages.`);
  }

  applyAdjustmentsToRemaining() {
    const currentConfig =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();
    const b = currentConfig.brightness;
    const c = currentConfig.contrast;

    let count = 0;
    for (
      let i = this.currentPageIndex + 1;
      i < this.parser.metadata.pageCount;
      i++
    ) {
      const config = this.pageConfigs.get(i) || this.getDefaultConfig();
      config.brightness = b;
      config.contrast = c;
      this.pageConfigs.set(i, config);
      count++;
    }
    alert(`Adjustments (B:${b}, C:${c}) applied to next ${count} pages.`);
  }

  applyBwToRemaining() {
    const currentConfig =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();
    const mode = currentConfig.bwMode;
    const thresh = currentConfig.bwThreshold;

    let count = 0;
    for (
      let i = this.currentPageIndex + 1;
      i < this.parser.metadata.pageCount;
      i++
    ) {
      const config = this.pageConfigs.get(i) || this.getDefaultConfig();
      config.bwMode = mode;
      config.bwThreshold = thresh;
      this.pageConfigs.set(i, config);
      count++;
    }
    alert(
      `B&W settings (Mode:${mode}, T:${thresh}) applied to next ${count} pages.`,
    );
  }

  applySplitsToRemaining() {
    const currentConfig =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();
    const vSplits = currentConfig.verticalSplits || [];
    const hSplits = currentConfig.horizontalSplits || [];

    let count = 0;
    for (
      let i = this.currentPageIndex + 1;
      i < this.parser.metadata.pageCount;
      i++
    ) {
      const config = this.pageConfigs.get(i) || this.getDefaultConfig();
      config.verticalSplits = [...vSplits];
      config.horizontalSplits = [...hSplits];
      this.pageConfigs.set(i, config);
      count++;
    }
    alert(`Splits applied to next ${count} pages.`);
  }

  updateSplitUI(group, val) {
    group.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.val) === val);
    });
  }

  async autoDetectSplits() {
    if (!this.currentTransformedCanvas) return;
    const { width, height } = this.currentTransformedCanvas;
    const splits = SplitEditor.autoDetect(width, height);

    if (
      splits.verticalSplits.length === 0 &&
      splits.horizontalSplits.length === 0
    ) {
      const btn = this.els.autoSplitBtn;
      const origText = btn.innerText;
      btn.innerText = "No splits needed";
      setTimeout(() => (btn.innerText = origText), 1500);
    } else {
      this.updateConfig(splits);
    }
  }

  async renderCurrentPage() {
    console.log(`2X4: renderCurrentPage index=${this.currentPageIndex}`);
    this.els.pageIndicator.innerText = `${this.currentPageIndex + 1}/${this.parser.metadata.pageCount}`;

    // Ensure default config has trim object
    let config =
      this.pageConfigs.get(this.currentPageIndex) || this.getDefaultConfig();
    if (!config.trim)
      config.trim = this.globalTrim
        ? { ...this.globalTrim }
        : { top: 0, bottom: 0, left: 0, right: 0 };

    // Sync UI
    this.els.brightness.value = config.brightness;
    this.els.brightnessVal.innerText = config.brightness;

    this.els.contrast.value = config.contrast;
    this.els.contrastVal.innerText = config.contrast;

    // Sync Trim UI
    if (config.trim) {
      this.els.trimTop.value = config.trim.top;
      this.els.trimTopVal.innerText = `${config.trim.top}%`;
      this.els.trimBottom.value = config.trim.bottom;
      this.els.trimBottomVal.innerText = `${config.trim.bottom}%`;
      this.els.trimLeft.value = config.trim.left;
      this.els.trimLeftVal.innerText = `${config.trim.left}%`;
      this.els.trimRight.value = config.trim.right;
      this.els.trimRightVal.innerText = `${config.trim.right}%`;
    }

    // Sync B&W UI
    this.els.bwMode.checked = config.bwMode || false;
    this.els.bwControls.classList.toggle("hidden", !config.bwMode);
    this.els.bwThreshold.value = config.bwThreshold || 128;
    this.els.bwThresholdVal.innerText = config.bwThreshold || 128;

    this.updateSplitButtons(config);

    const sourceBitmap = await this.parser.getPage(this.currentPageIndex);

    // 1. Transform (Rotate + Brightness/Contrast + B&W)
    let processedCanvas = await ImageTransformer.process(sourceBitmap, config);

    if (
      config.trim.top > 0 ||
      config.trim.bottom > 0 ||
      config.trim.left > 0 ||
      config.trim.right > 0
    ) {
      processedCanvas = ImageTransformer.manualCrop(
        processedCanvas,
        config.trim,
      );
    }

    this.currentTransformedCanvas = processedCanvas;

    // 3. Draw Original
    const originCtx = this.els.originalCanvas.getContext("2d");
    this.els.originalCanvas.width = this.currentTransformedCanvas.width;
    this.els.originalCanvas.height = this.currentTransformedCanvas.height;
    originCtx.drawImage(this.currentTransformedCanvas, 0, 0);

    // Calc Viewport Sizing (Original View) - Ensure it fits
    // (Similar to previous "fit" logic but purely CSS max-width/height now handles it in 3-pane)
    // Reset manual width/height assignments
    this.els.originalCanvas.parentElement.style.width = "";
    this.els.originalCanvas.parentElement.style.height = "";

    // 3. Draw Overlay
    this.els.overlayCanvas.width = this.currentTransformedCanvas.width;
    this.els.overlayCanvas.height = this.currentTransformedCanvas.height;
    const overlayCtx = this.els.overlayCanvas.getContext("2d");
    SplitEditor.drawOverlay(
      overlayCtx,
      this.els.overlayCanvas.width,
      this.els.overlayCanvas.height,
      config,
    );

    // 4. Calculate Regions
    this.currentRegions = SplitEditor.calculateRegions(
      this.currentTransformedCanvas.width,
      this.currentTransformedCanvas.height,
      config,
    );

    if (this.selectedRegionIndex >= this.currentRegions.length) {
      this.selectedRegionIndex = 0;
    }

    // 5. Render Dithered Preview
    await this.renderDitherPreview();

    // 6. Render Thumbnails
    await this.renderThumbnails();
  }

  updateSplitButtons(config) {
    const vCount = config.verticalSplits ? config.verticalSplits.length : 0;
    const hCount = config.horizontalSplits ? config.horizontalSplits.length : 0;

    this.els.vSplitGroup.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.val) === vCount);
    });

    this.els.hSplitGroup.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.val) === hCount);
    });
  }

  async renderDitherPreview() {
    if (!this.currentTransformedCanvas || !this.currentRegions.length) return;

    const region = this.currentRegions[this.selectedRegionIndex];

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = region.w;
    cropCanvas.height = region.h;
    const cropCtx = cropCanvas.getContext("2d");
    cropCtx.drawImage(
      this.currentTransformedCanvas,
      region.x,
      region.y,
      region.w,
      region.h,
      0,
      0,
      region.w,
      region.h,
    );

    const targetW = 480;
    const targetH = 800;
    const scaledCanvas = ImageTransformer.scale(cropCanvas, targetW, targetH);

    const ditherAlgoName = this.els.ditherAlgo.value;
    const algorithm = DITHER_ALGORITHMS[ditherAlgoName];

    // 1. Render to Dither Canvas
    const ditherCtx = this.els.ditherCanvas.getContext("2d");
    this.els.ditherCanvas.width = targetW;
    this.els.ditherCanvas.height = targetH;
    ditherCtx.drawImage(scaledCanvas, 0, 0);

    if (algorithm) {
      const imageData = ditherCtx.getImageData(0, 0, targetW, targetH);
      algorithm.fn(imageData);
      ditherCtx.putImageData(imageData, 0, 0);
    }

    // 2. Render to Actual Size Viewport
    // We can just clone the ditherCanvas to an Image
    const img = new Image();
    img.src = this.els.ditherCanvas.toDataURL();
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";

    this.els.actualSizeViewport.innerHTML = "";
    this.els.actualSizeViewport.appendChild(img);
  }

  async renderThumbnails() {
    this.els.splitThumbnails.innerHTML = "";

    for (let i = 0; i < this.currentRegions.length; i++) {
      const region = this.currentRegions[i];
      const div = document.createElement("div");
      div.className =
        "thumbnail " + (i === this.selectedRegionIndex ? "active" : "");
      div.style.cursor = "pointer";

      const thumbCanvas = document.createElement("canvas");
      const thumbW = 60;
      const thumbH = 100;
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const ctx = thumbCanvas.getContext("2d");

      ctx.fillStyle = "#eee";
      ctx.fillRect(0, 0, thumbW, thumbH);

      const scale = Math.min(thumbW / region.w, thumbH / region.h);
      const w = region.w * scale;
      const h = region.h * scale;
      const x = (thumbW - w) / 2;
      const y = (thumbH - h) / 2;

      ctx.drawImage(
        this.currentTransformedCanvas,
        region.x,
        region.y,
        region.w,
        region.h,
        x,
        y,
        w,
        h,
      );

      const img = new Image();
      img.src = thumbCanvas.toDataURL();
      img.draggable = false;
      div.appendChild(img);

      const num = document.createElement("span");
      num.innerText = i + 1;
      num.style.position = "absolute";
      num.style.bottom = "2px";
      num.style.right = "2px";
      num.style.background = "rgba(0,0,0,0.5)";
      num.style.color = "#fff";
      num.style.padding = "2px 4px";
      num.style.fontSize = "10px";
      num.style.borderRadius = "2px";
      div.style.position = "relative";
      div.appendChild(num);

      div.onclick = () => {
        this.selectedRegionIndex = i;
        this.renderDitherPreview();
        this.els.splitThumbnails
          .querySelectorAll(".thumbnail")
          .forEach((el) => el.classList.remove("active"));
        div.classList.add("active"); // CSS should handle border
        // Quick inline fix for non-css handling of .active on this run
        this.els.splitThumbnails
          .querySelectorAll(".thumbnail")
          .forEach((el) => (el.style.borderColor = "var(--base01)"));
        div.style.borderColor = "var(--blue)";
      };

      this.els.splitThumbnails.appendChild(div);
    }
  }

  async startConversion() {
    if (!this.parser.metadata.pageCount) return;

    this.els.convertBtn.disabled = true;
    this.els.progressContainer.classList.remove("hidden");
    this.els.progressFill.style.width = "0%";
    this.els.progressText.innerText = "Starting...";

    try {
      const format = this.els.outputFormat.value;
      const ditherAlgo = this.els.ditherAlgo.value;

      // Capture current defaults (includes global trim if applied)
      const defaultConfig = this.getDefaultConfig();

      const blob = await CBZConversionPipeline.convert(
        this.parser,
        this.pageConfigs,
        { format, ditherAlgo, defaultConfig },
        (percent, text) => {
          this.els.progressFill.style.width = `${percent}%`;
          this.els.progressText.innerText = text;
        },
      );

      if (blob) {
        this.downloadBlob(
          blob,
          this.parser.metadata.filename.replace(/\.cbz$/i, "") + "." + format,
        );
      }

      this.els.progressText.innerText = "Done!";
    } catch (err) {
      console.error(err);
      this.els.progressText.innerText = "Error: " + err.message;
    } finally {
      this.els.convertBtn.disabled = false;
      setTimeout(
        () => this.els.progressContainer.classList.add("hidden"),
        3000,
      );
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Initialize on load
window.addEventListener("DOMContentLoaded", () => {
  new CbzMain();
});
