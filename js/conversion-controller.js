/**
 * ConversionController - Bridges ConversionPipeline with UI
 *
 * Responsibilities:
 * - Coordinate conversion start
 * - Update progress UI (bars, text, estimates)
 * - Download generated files
 * - Handle errors with user-friendly messages
 * - Manage button states
 */

export class ConversionController {
  constructor(pipeline, uiElements) {
    this.pipeline = pipeline;
    this.ui = uiElements;
    // UI elements expected: {convertBtn, progressBar, progressText, progressContainer}
  }

  /**
   * Start conversion with given options
   * @param {Object} options - Same options as ConversionPipeline.convert()
   */
  async start(options) {
    // Disable convert button
    this.ui.convertBtn.disabled = true;
    this.ui.progressContainer.classList.remove("hidden");

    try {
      // Run conversion pipeline
      for await (const event of this.pipeline.convert(options)) {
        this._handleProgressEvent(event);
      }
    } catch (error) {
      this._handleError(error);
    } finally {
      // Re-enable convert button
      this.ui.convertBtn.disabled = false;
      // Keep progress visible briefly to show completion
      setTimeout(() => {
        this.ui.progressContainer.classList.add("hidden");
      }, 2000);
    }
  }

  /**
   * Handle progress events from pipeline
   * @private
   */
  _handleProgressEvent(event) {
    switch (event.type) {
      case "init":
        this._updateProgress(`Initializing conversion...`, 0);
        break;

      case "pre-pagination-start":
        this._updateProgress(`Analyzing document structure...`, 0);
        break;

      case "pre-pagination-progress":
        const prepagProgress =
          ((event.chapterIndex + 1) / event.totalChapters) * 100;
        this._updateProgress(
          `Analyzing chapter ${event.chapterIndex + 1}/${event.totalChapters}... (${event.pagesFound} pages found)`,
          prepagProgress,
        );
        break;

      case "pre-pagination-complete":
        this._updateProgress(
          `Analysis complete! Found ${event.totalPages} pages total.`,
          100,
        );
        break;

      case "chapter-start":
        this._updateProgress(
          `Loading chapter ${event.chapterIndex + 1}/${event.totalChapters}...`,
          0,
        );
        break;

      case "page-start":
        // Optional: Could show "Rendering page X..."
        break;

      case "page-complete":
        this._handlePageComplete(event);
        break;

      case "chapter-complete":
        // Optional: Could show chapter completion message
        break;

      case "volume-complete":
        this._handleVolumeComplete(event);
        break;

      case "complete":
        this._handleComplete(event);
        break;

      case "error":
        throw event.error;
    }
  }

  /**
   * Handle page completion (update progress bar and text)
   * @private
   */
  _handlePageComplete(event) {
    // Calculate overall progress percentage
    const progressPercent =
      (event.chapterIndex * 100 +
        (event.pageIndex / event.totalPagesInChapter) * 100) /
      event.totalChapters;

    // Build progress text with time estimates
    let text = `Rendering page ${event.globalPage}...`;

    if (event.avgTimeMs) {
      const avgSeconds = (event.avgTimeMs / 1000).toFixed(1);
      text += ` (avg: ${avgSeconds}s/page)`;
    }

    this._updateProgress(text, progressPercent);
  }

  /**
   * Handle volume completion (download file immediately)
   * @private
   */
  _handleVolumeComplete(event) {
    this._updateProgress(
      `Downloading volume ${event.volumeNumber} (${event.pagesInVolume} pages)...`,
      null, // Keep current progress
    );

    this._downloadFile(event.blob, event.filename);

    // Small delay before continuing
    return new Promise((resolve) => setTimeout(resolve, 300));
  }

  /**
   * Handle conversion completion (download all files, show success)
   * @private
   */
  _handleComplete(event) {
    this._updateProgress(
      `Complete! Downloading ${event.files.length} file(s)...`,
      100,
    );

    // Download all files (for single-file formats)
    event.files.forEach((file) => {
      this._downloadFile(file.blob, file.filename);
    });

    // Show success message
    const fileList = event.files.map((f) => f.filename).join(", ");
    const stats = `${event.totalPagesRendered} pages in ${(event.totalRenderTimeMs / 1000).toFixed(1)}s`;

    setTimeout(() => {
      alert(`Conversion complete!\n\nFiles: ${fileList}\n\nStats: ${stats}`);
    }, 500);
  }

  /**
   * Handle conversion error
   * @private
   */
  _handleError(error) {
    console.error("Conversion error:", error);

    this._updateProgress("Conversion failed!", 0);
    this.ui.progressBar.style.backgroundColor = "#dc322f"; // Red error color

    let errorMessage = "Conversion failed: " + error.message;

    if (error.context) {
      errorMessage += `\n\nContext: Chapter ${error.context.chapterIndex + 1}, Page ${error.context.globalPage}`;
    }

    alert(errorMessage);

    // Reset progress bar color
    setTimeout(() => {
      this.ui.progressBar.style.backgroundColor = "";
    }, 3000);
  }

  /**
   * Update progress UI
   * @private
   */
  _updateProgress(text, percentage) {
    this.ui.progressText.textContent = text;

    if (percentage !== null && percentage !== undefined) {
      this.ui.progressBar.style.width = `${percentage}%`;
    }
  }

  /**
   * Download file via browser
   * @private
   */
  _downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
