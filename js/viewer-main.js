/**
 * XTC Viewer Main Script
 * Coordinates parser, renderer, and UI
 */

import { XTCParser } from './xtc-parser.js';
import { XTHRenderer } from './xth-renderer.js';

class XTCViewer {
  constructor() {
    this.parser = null;
    this.currentPage = 0;

    this.elements = {
      fileInput: document.getElementById('xtcFileInput'),
      metadataPanel: document.getElementById('metadataPanel'),
      metadataToggle: document.getElementById('metadataToggle'),
      metadataContent: document.getElementById('metadataContent'),
      noFileMessage: document.getElementById('noFileMessage'),
      displayArea: document.getElementById('displayArea'),
      canvasContainer: document.getElementById('canvasContainer'),
      canvas: document.getElementById('pageCanvas'),
      controls: document.getElementById('controls'),
      prevBtn: document.getElementById('prevBtn'),
      nextBtn: document.getElementById('nextBtn'),
      pageInfo: document.getElementById('pageInfo'),
      sizeCalibration: document.getElementById('sizeCalibration'),
      sizeCalibrationValue: document.getElementById('sizeCalibrationValue'),
    };

    this.attachEventListeners();
    this.loadCalibrationScale();
  }

  attachEventListeners() {
    this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.elements.prevBtn.addEventListener('click', () => this.prevPage());
    this.elements.nextBtn.addEventListener('click', () => this.nextPage());

    // Metadata toggle
    this.elements.metadataToggle.addEventListener('click', () => {
      this.elements.metadataPanel.classList.toggle('collapsed');
    });

    // Calibration scale
    this.elements.sizeCalibration.addEventListener('input', (e) => {
      this.elements.sizeCalibrationValue.textContent = e.target.value;
      this.updateCanvasScale();
    });

    this.elements.sizeCalibration.addEventListener('change', () => {
      this.saveCalibrationScale();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.parser) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          this.prevPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          this.nextPage();
          break;
        case 'Home':
          e.preventDefault();
          this.goToPage(0);
          break;
        case 'End':
          e.preventDefault();
          this.goToPage(this.parser.pageIndex.length - 1);
          break;
      }
    });
  }

  loadCalibrationScale() {
    const savedScale = localStorage.getItem('viewerCalibrationScale');
    if (savedScale) {
      this.elements.sizeCalibration.value = savedScale;
      this.elements.sizeCalibrationValue.textContent = savedScale;
    }
  }

  saveCalibrationScale() {
    localStorage.setItem('viewerCalibrationScale', this.elements.sizeCalibration.value);
  }

  updateCanvasScale() {
    if (!this.elements.canvas) return;
    const scale = parseInt(this.elements.sizeCalibration.value) / 100;
    this.elements.canvasContainer.style.transform = `scale(${scale})`;
    this.elements.canvasContainer.style.transformOrigin = 'top center';
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      console.log('Loading XTC file:', file.name);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Parse XTC
      this.parser = new XTCParser(arrayBuffer);

      // Display metadata
      this.displayMetadata();

      // Show display area and controls
      this.elements.noFileMessage.style.display = 'none';
      this.elements.metadataPanel.style.display = 'block';
      this.elements.displayArea.style.display = 'block';
      this.elements.controls.style.display = 'flex';

      // Render first page
      this.goToPage(0);

    } catch (error) {
      console.error('Failed to load XTC file:', error);
      alert(`Failed to load XTC file: ${error.message}`);
    }
  }

  displayMetadata() {
    const { header, metadata, chapters } = this.parser;

    let html = '';

    // Header information
    html += '<div class="metadata-section">';
    html += '<h3>Header</h3>';
    html += `<div class="metadata-row"><span class="metadata-label">Format:</span><span class="metadata-value">${header.magic}</span></div>`;
    html += `<div class="metadata-row"><span class="metadata-label">Version:</span><span class="metadata-value">${(header.version / 256).toFixed(2)}</span></div>`;
    html += `<div class="metadata-row"><span class="metadata-label">Pages:</span><span class="metadata-value">${header.pageCount}</span></div>`;
    html += `<div class="metadata-row"><span class="metadata-label">Reading Direction:</span><span class="metadata-value">${this.getReadingDirectionLabel(header.readDirection)}</span></div>`;
    html += '</div>';

    // Metadata information
    if (metadata) {
      html += '<div class="metadata-section">';
      html += '<h3>Metadata</h3>';
      html += `<div class="metadata-row"><span class="metadata-label">Title:</span><span class="metadata-value">${metadata.title}</span></div>`;
      html += `<div class="metadata-row"><span class="metadata-label">Author:</span><span class="metadata-value">${metadata.author}</span></div>`;
      html += `<div class="metadata-row"><span class="metadata-label">Created:</span><span class="metadata-value">${metadata.createTime.toLocaleString()}</span></div>`;
      html += '</div>';
    }

    // Chapters
    if (chapters.length > 0) {
      html += '<div class="metadata-section">';
      html += '<h3>Chapters</h3>';
      html += '<div class="chapter-list">';
      chapters.forEach((chapter, index) => {
        html += `<div class="chapter-item" onclick="window.viewer.goToPage(${chapter.startPage})">`;
        html += `${index + 1}. ${chapter.name} (pages ${chapter.startPage + 1}-${chapter.endPage + 1})`;
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    this.elements.metadataContent.innerHTML = html;
  }

  getReadingDirectionLabel(direction) {
    switch (direction) {
      case 0:
        return 'Left to Right';
      case 1:
        return 'Right to Left (Manga)';
      case 2:
        return 'Top to Bottom';
      default:
        return `Unknown (${direction})`;
    }
  }

  goToPage(pageIndex) {
    if (!this.parser) return;

    const pageCount = this.parser.pageIndex.length;
    if (pageIndex < 0 || pageIndex >= pageCount) return;

    this.currentPage = pageIndex;
    this.renderCurrentPage();
    this.updateControls();
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  renderCurrentPage() {
    try {
      // Get XTH data for current page
      const xthBuffer = this.parser.getPageData(this.currentPage);

      // Render to canvas
      XTHRenderer.renderToCanvas(xthBuffer, this.elements.canvas);

      // Update canvas scale
      this.updateCanvasScale();

      console.log(`Rendered page ${this.currentPage + 1}`);
    } catch (error) {
      console.error('Failed to render page:', error);
      alert(`Failed to render page: ${error.message}`);
    }
  }

  updateControls() {
    const pageCount = this.parser.pageIndex.length;

    // Update page info
    this.elements.pageInfo.textContent = `Page ${this.currentPage + 1} / ${pageCount}`;

    // Update button states
    this.elements.prevBtn.disabled = this.currentPage === 0;
    this.elements.nextBtn.disabled = this.currentPage === pageCount - 1;
  }
}

// Initialize viewer on page load
window.addEventListener('DOMContentLoaded', () => {
  window.viewer = new XTCViewer();
});
