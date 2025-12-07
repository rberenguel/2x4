/**
 * ConversionPipeline - Pure conversion logic with no UI dependencies
 *
 * Converts documents (EPUB/ArXiv/Articles) to various formats (XTC/EPUB/ZIP/XTH)
 * Yields progress events via async generator pattern
 *
 * Can be used by PWA, extension, CLI, workers, or any JavaScript context
 */

export class ConversionPipeline {
  constructor({
    parser, // Parser instance (EPUBParser | ArxivParser | ArticleParser)
    paginator, // Paginator instance
    renderer, // Renderer instance
    xthEncoder, // XTHEncoder instance
    xtcBuilder, // XTCBuilder instance
    epubBuilder, // EPUBBuilder instance
  }) {
    this.parser = parser;
    this.paginator = paginator;
    this.renderer = renderer;
    this.xthEncoder = xthEncoder;
    this.xtcBuilder = xtcBuilder;
    this.epubBuilder = epubBuilder;
  }

  /**
   * Convert document to specified format
   *
   * @param {Object} options - Conversion options
   * @param {string} options.format - Output format: 'xtc' | 'epub' | 'zip' | 'xth'
   * @param {Object} options.settings - Typography: {fontFamily, fontSize, lineHeight, customCSS}
   * @param {Object} options.limits - Limits: {type: 'none'|'pages'|'chapters', value: number}
   * @param {Object} options.xtc - XTC options: {splitPages: number, filenamePattern: string}
   * @param {number} options.jpegQuality - JPEG quality (0.0 to 1.0)
   * @param {Object} options.metadata - Book metadata: {title, creator, language}
   * @param {Function} options.getChapterContent - Function to get chapter HTML by index
   * @param {Function} options.getChapterTitle - Function to get chapter title by index
   * @param {number} options.totalChapters - Total number of chapters
   * @param {boolean} options.suppressChapterMarkers - Skip chapter markers (for imported mode)
   *
   * @yields {Object} Progress events:
   *   - {type: 'init', totalChapters, estimatedPages}
   *   - {type: 'chapter-start', chapterIndex, chapterTitle}
   *   - {type: 'page-start', pageIndex, globalPage, chapterPage}
   *   - {type: 'page-complete', pageIndex, globalPage, renderTimeMs, avgTimeMs}
   *   - {type: 'chapter-complete', chapterIndex, pagesRendered}
   *   - {type: 'volume-complete', volumeNumber, pagesInVolume, blob, filename}
   *   - {type: 'complete', format, files: [{blob, filename}]}
   *   - {type: 'error', error, context}
   */
  async *convert(options) {
    // Validate options
    this._validateOptions(options);

    // Destructure options
    const {
      format,
      settings,
      limits,
      xtc,
      jpegQuality,
      metadata,
      getChapterContent,
      getChapterTitle,
      totalChapters: totalChaptersInput,
      suppressChapterMarkers = false,
      enableProgressBars = false,
      pageMap: providedPageMap = null,
      totalPages: providedTotalPages = 0,
    } = options;

    // Apply typography settings to paginator
    this.paginator.updateSettings(settings);

    // Calculate actual chapters to process
    let totalChapters = totalChaptersInput;
    if (limits.type === "chapters") {
      totalChapters = Math.min(limits.value, totalChapters);
    }
    const maxPages = limits.type === "pages" ? limits.value : Infinity;

    // Initialize output builders
    if (format === "xtc") {
      this.xtcBuilder.clear();
      this.xtcBuilder.setMetadata({
        title: metadata.title,
        creator: metadata.creator || "Unknown",
      });
    } else if (format === "epub") {
      this.epubBuilder.clear();
      this.epubBuilder.setMetadata({
        title: `${metadata.title} (x4-imaged)`,
        creator: metadata.creator,
        language: metadata.language,
      });
    }

    // Initialize state
    let globalPageNumber = 1;
    const files = [];
    const zip = format === "zip" || format === "xth" ? new JSZip() : null;

    // XTC volume splitting state
    let currentVolume = null;
    let pagesInCurrentVolume = 0;
    let volumeNumber = 1;

    // Performance tracking
    let totalRenderTime = 0;
    let pagesRendered = 0;

    yield {
      type: "init",
      totalChapters,
      estimatedPages: totalChapters * 10, // Rough estimate
    };

    try {
      // === PRE-PAGINATION PASS ===
      // Use provided page map or generate new one (only if progress bars enabled)
      let pageMap = providedPageMap;
      let totalPages = providedTotalPages;

      if (enableProgressBars && !providedPageMap) {
        // Need to paginate all chapters to build page map for progress bars
        yield {
          type: "pre-pagination-start",
          totalChapters,
        };

        pageMap = [];
        totalPages = 0;

        for (let i = 0; i < totalChapters; i++) {
          const html = await getChapterContent(i);
          await this.paginator.loadChapter(html, i);
          const pageCount = this.paginator.pageCount;

          pageMap.push({
            chapterIndex: i,
            chapterTitle: getChapterTitle(i),
            pageCount,
            startPage: totalPages + 1,
            endPage: totalPages + pageCount,
          });

          totalPages += pageCount;

          yield {
            type: "pre-pagination-progress",
            chapterIndex: i,
            totalChapters,
            pagesFound: totalPages,
          };
        }

        yield {
          type: "pre-pagination-complete",
          totalPages,
          pageMap,
        };
      } else if (enableProgressBars && providedPageMap) {
        // Using provided page map, skip pre-pagination
        yield {
          type: "pre-pagination-complete",
          totalPages,
          pageMap,
        };
      }

      // === MAIN CONVERSION LOOP ===
      for (let chapterIndex = 0; chapterIndex < totalChapters; chapterIndex++) {
        if (globalPageNumber > maxPages) break;

        const chapterTitle = getChapterTitle(chapterIndex);
        yield {
          type: "chapter-start",
          chapterIndex,
          chapterTitle,
          totalChapters,
        };

        // Load chapter into paginator
        const html = await getChapterContent(chapterIndex);
        await this.paginator.loadChapter(html, chapterIndex);
        const pageCount = this.paginator.pageCount;

        // Add chapter marker for XTC format
        if (format === "xtc" && !suppressChapterMarkers) {
          if (currentVolume) {
            currentVolume.builder.addChapter(
              chapterTitle,
              pagesInCurrentVolume,
            );
          } else {
            this.xtcBuilder.addChapter(chapterTitle, globalPageNumber - 1);
          }
        } else if (
          format === "xtc" &&
          suppressChapterMarkers &&
          chapterIndex === 0
        ) {
          // For imported/single-chapter mode, add one marker at start
          const title = metadata.title || "Document";
          if (currentVolume) {
            currentVolume.builder.addChapter(title, 0);
          } else {
            this.xtcBuilder.addChapter(title, 0);
          }
        }

        // Process each page in chapter
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          if (globalPageNumber > maxPages) break;

          // Check if we need to start a new XTC volume
          if (
            format === "xtc" &&
            this._shouldStartNewVolume(
              currentVolume,
              pagesInCurrentVolume,
              xtc.splitPages,
            )
          ) {
            if (currentVolume) {
              // Finalize and yield current volume
              const volumeResult = await this._finalizeVolume(
                currentVolume,
                xtc.filenamePattern,
                metadata,
                totalChapters,
              );
              yield {
                type: "volume-complete",
                volumeNumber: currentVolume.volumeNumber,
                pagesInVolume: currentVolume.pagesInVolume,
                blob: volumeResult.blob,
                filename: volumeResult.filename,
              };
              files.push(volumeResult);
              volumeNumber++;
            }

            // Start new volume
            currentVolume = this._startNewVolume(
              volumeNumber,
              globalPageNumber,
              metadata,
            );
            pagesInCurrentVolume = 0;
          }

          yield {
            type: "page-start",
            pageIndex,
            globalPage: globalPageNumber,
            chapterPage: pageIndex + 1,
            totalPagesInChapter: pageCount,
          };

          // Render page
          this.paginator.goToPage(pageIndex);
          const pageStartTime = performance.now();

          const pageElement = this.paginator.getCurrentPageElement();

          // Calculate progress for this page (if progress bars enabled)
          let progressInfo = null;
          if (enableProgressBars && pageMap) {
            const currentPageInfo = pageMap[chapterIndex];
            // Progress at START of page (0-indexed), so page 0 = 0%, page 1 = 1/total, etc.
            const chapterProgress = pageIndex / currentPageInfo.pageCount;
            const bookProgress =
              (currentPageInfo.startPage - 1 + pageIndex) / totalPages;

            // Calculate chapter boundary positions (as fraction of total book)
            const chapterMarkers = pageMap.map(
              (chapter) => (chapter.startPage - 1) / totalPages,
            );

            progressInfo = { chapterProgress, bookProgress, chapterMarkers };
          }

          const renderResult = await this._renderPage(
            pageElement,
            format,
            settings,
            progressInfo,
          );

          const renderTimeMs = performance.now() - pageStartTime;
          totalRenderTime += renderTimeMs;
          pagesRendered++;
          const avgTimeMs = totalRenderTime / pagesRendered;

          // Add to appropriate output
          if (format === "xtc") {
            const target = currentVolume
              ? currentVolume.builder
              : this.xtcBuilder;
            target.addPage(renderResult.xthBuffer);
            if (currentVolume) {
              currentVolume.pagesInVolume++;
            }
            pagesInCurrentVolume++;
          } else if (format === "epub") {
            this.epubBuilder.addImage(renderResult.jpegBlob, globalPageNumber);
          } else if (format === "zip") {
            zip.file(
              `page${String(globalPageNumber).padStart(4, "0")}.jpg`,
              renderResult.jpegBlob,
            );
          } else if (format === "xth") {
            zip.file(
              `page${String(globalPageNumber).padStart(4, "0")}.xth`,
              renderResult.xthBlob,
            );
          }

          yield {
            type: "page-complete",
            pageIndex,
            globalPage: globalPageNumber,
            renderTimeMs,
            avgTimeMs,
            chapterIndex,
            totalChapters,
            totalPagesInChapter: pageCount,
          };

          globalPageNumber++;
        }

        yield {
          type: "chapter-complete",
          chapterIndex,
          pagesRendered: pageCount,
        };
      }

      // === FINALIZATION ===
      if (format === "xtc") {
        if (currentVolume) {
          // Finalize last volume
          const volumeResult = await this._finalizeVolume(
            currentVolume,
            xtc.filenamePattern,
            metadata,
            totalChapters,
          );
          yield {
            type: "volume-complete",
            volumeNumber: currentVolume.volumeNumber,
            pagesInVolume: currentVolume.pagesInVolume,
            blob: volumeResult.blob,
            filename: volumeResult.filename,
          };
          files.push(volumeResult);
        } else {
          // Single file XTC
          const xtcBuffer = this.xtcBuilder.generate();
          const blob = new Blob([xtcBuffer], {
            type: "application/octet-stream",
          });
          // Use filenamePattern if provided (for extension Arxiv papers with ID),
          // otherwise use metadata title (PWA EPUB/Arxiv) or date-based name (extension articles)
          let filename;
          if (xtc.filenamePattern) {
            // Extension: Arxiv paper with ID
            filename = `${xtc.filenamePattern}.xtc`;
          } else if (
            metadata.title &&
            metadata.title !== `${totalChapters} Articles`
          ) {
            // PWA: Use book/paper title
            filename = `${this._sanitizeFilename(metadata.title)}.xtc`;
          } else {
            // Extension: Regular articles bundle (date-based)
            filename = this._generateXTCFilename(totalChapters);
          }
          files.push({ blob, filename });
        }
      } else if (format === "epub") {
        const blob = await this.epubBuilder.generate();
        const filename = `${this._sanitizeFilename(metadata.title)}-x4.epub`;
        files.push({ blob, filename });
      } else if (format === "zip" || format === "xth") {
        const blob = await zip.generateAsync({ type: "blob" });
        const ext = format === "xth" ? "xth" : "jpg";
        const filename = `${this._sanitizeFilename(metadata.title)}-${ext}.zip`;
        files.push({ blob, filename });
      }

      yield {
        type: "complete",
        format,
        files,
        totalPagesRendered: pagesRendered,
        totalRenderTimeMs: totalRenderTime,
      };
    } catch (error) {
      yield {
        type: "error",
        error,
        context: {
          chapterIndex: this.currentChapter || 0,
          globalPage: globalPageNumber,
        },
      };
      throw error;
    }
  }

  /**
   * Render a single page element to all required formats
   * @private
   */
  async _renderPage(pageElement, format, settings, progressInfo) {
    // For XTH/XTC formats: render to canvas then encode to XTH
    if (format === "xtc" || format === "xth") {
      const canvas = await this.renderer.renderPageToCanvas(
        pageElement,
        settings.fontFamily,
        settings,
        progressInfo,
      );

      const xthBlob = this.xthEncoder.encode(canvas);
      const xthBuffer = format === "xtc" ? await xthBlob.arrayBuffer() : null;

      return {
        jpegBlob: null,
        xthBuffer,
        xthBlob: format === "xth" ? xthBlob : null,
      };
    }

    // For JPEG formats (EPUB/ZIP): render directly to JPEG blob
    const jpegBlob = await this.renderer.renderPageToImage(
      pageElement,
      settings.fontFamily,
      settings,
      progressInfo,
    );

    return { jpegBlob, xthBuffer: null, xthBlob: null };
  }

  /**
   * Check if we should start a new XTC volume
   * @private
   */
  _shouldStartNewVolume(currentVolume, pagesInCurrentVolume, splitPages) {
    // If splitPages is 0, never split (single file)
    if (splitPages === 0) return false;

    // Start first volume
    if (currentVolume === null) return true;

    // Start new volume if current is full
    return pagesInCurrentVolume >= splitPages;
  }

  /**
   * Start a new XTC volume
   * @private
   */
  _startNewVolume(volumeNumber, startPage, metadata) {
    const xtcBuilder = new this.xtcBuilder.constructor(); // Create new instance
    xtcBuilder.setMetadata({
      title: metadata.title,
      creator: metadata.creator || "Unknown",
    });

    return {
      builder: xtcBuilder,
      volumeNumber,
      startPage,
      pagesInVolume: 0,
    };
  }

  /**
   * Finalize an XTC volume and return blob + filename
   * @private
   */
  async _finalizeVolume(volume, filenamePattern, metadata, totalChapters) {
    const xtcBuffer = volume.builder.generate();
    const blob = new Blob([xtcBuffer], { type: "application/octet-stream" });

    const filename = this._generateXTCFilename(totalChapters);

    return { blob, filename };
  }

  /**
   * Validate conversion options
   * @private
   */
  _validateOptions(options) {
    const required = [
      "format",
      "settings",
      "metadata",
      "getChapterContent",
      "getChapterTitle",
      "totalChapters",
    ];
    for (const field of required) {
      if (!options[field]) {
        throw new Error(`Missing required option: ${field}`);
      }
    }

    const validFormats = ["xtc", "epub", "zip", "xth"];
    if (!validFormats.includes(options.format)) {
      throw new Error(
        `Invalid format: ${options.format}. Must be one of: ${validFormats.join(", ")}`,
      );
    }

    if (options.format === "xtc" && !options.xtc) {
      throw new Error(
        "XTC format requires xtc options (splitPages, filenamePattern)",
      );
    }
  }

  /**
   * Sanitize filename for safe filesystem usage
   * @private
   */
  _sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9-_.]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 200);
  }

  /**
   * Generate XTC filename in format: 2x4-N-YYYYMMDD.xtc
   * where N is the number of articles and YYYYMMDD is today's date
   * @private
   * @param {number} articleCount - Number of articles in the export
   * @returns {string} Formatted filename
   */
  _generateXTCFilename(articleCount) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}${month}${day}`;

    return `2x4-${articleCount}-${dateStr}.xtc`;
  }
}
