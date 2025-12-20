/**
 * Device Manager Standalone Page
 * Manages files on X4 device via HTTP API
 */

class DeviceManager {
  constructor() {
    // Override element IDs for standalone page
    this.deviceIP = "192.168.3.3";
    this.currentPath = "/";
    this.previewCache = new Map();

    this.elements = {
      deviceIP: document.getElementById("device-ip"),
      connectBtn: document.getElementById("connect-btn"),
      deviceStatus: document.getElementById("device-status"),
      modal: document.getElementById("device-browser-modal"),
      closeBrowserBtn: document.getElementById("close-browser-btn"),
      cancelBrowserBtn: document.getElementById("cancel-browser-btn"),
      uploadHereBtn: document.getElementById("upload-here-btn"),
      newFolderBtn: document.getElementById("new-folder-btn"),
      currentPath: document.getElementById("current-path"),
      folderList: document.getElementById("folder-list"),
      previewModal: document.getElementById("xtc-preview-modal"),
      closePreviewBtn: document.getElementById("close-preview-btn"),
      previewFilename: document.getElementById("preview-filename"),
      previewContent: document.getElementById("preview-content"),
      uploadProgressContainer: document.getElementById("upload-progress-container"),
      uploadProgressBar: document.getElementById("upload-progress-bar"),
      uploadStatusText: document.getElementById("upload-status-text"),
      uploadPercentage: document.getElementById("upload-percentage"),
    };

    this.loadDeviceIP();
    this.attachEventListeners();
  }

  attachEventListeners() {
    this.elements.connectBtn.addEventListener("click", () => this.connect());
    this.elements.closeBrowserBtn.addEventListener("click", () =>
      this.closeBrowser(),
    );
    this.elements.cancelBrowserBtn.addEventListener("click", () =>
      this.closeBrowser(),
    );
    this.elements.uploadHereBtn.addEventListener("click", () =>
      this.uploadFiles(),
    );
    this.elements.newFolderBtn.addEventListener("click", () =>
      this.showNewFolderDialog(),
    );

    // Save device IP when it changes
    this.elements.deviceIP.addEventListener("change", () =>
      this.saveDeviceIP(),
    );
    this.elements.deviceIP.addEventListener("blur", () => this.saveDeviceIP());

    // Preview modal close
    this.elements.closePreviewBtn.addEventListener("click", () =>
      this.closePreview(),
    );
  }

  async connect() {
    this.deviceIP = this.elements.deviceIP.value.trim();

    if (!this.deviceIP) {
      this.showStatus("Please enter device IP address", "error");
      return;
    }

    try {
      this.showStatus("Connecting to device...", "info");
      this.elements.connectBtn.disabled = true;

      const status = await this.getDeviceStatus();
      const usedGB = (status.usedBytes / 1024 / 1024 / 1024).toFixed(2);
      const totalGB = (status.totalBytes / 1024 / 1024 / 1024).toFixed(2);

      this.showStatus(
        `Connected! Device: ${status.device_type || "X4"} | Storage: ${usedGB}GB / ${totalGB}GB used`,
        "success",
      );

      // Show file browser modal
      this.currentPath = "/";
      this.elements.modal.style.display = "block";
      await this.loadFolder(this.currentPath);
    } catch (error) {
      this.showStatus(`Connection failed: ${error.message}`, "error");
    } finally {
      this.elements.connectBtn.disabled = false;
    }
  }

  closeBrowser() {
    this.elements.modal.style.display = "none";
  }

  closePreview() {
    this.elements.previewModal.style.display = "none";
  }

  async getDeviceStatus() {
    const response = await fetch(`http://${this.deviceIP}/status`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  async loadFolder(path) {
    this.currentPath = path;
    this.elements.currentPath.textContent = path || "/";
    this.elements.folderList.innerHTML =
      '<div style="text-align: center; color: #93a1a1; padding: 2rem;">Loading...</div>';

    try {
      const encodedPath = encodeURIComponent(path);
      const response = await fetch(
        `http://${this.deviceIP}/list?dir=${encodedPath}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const items = await response.json();
      this.renderFolderContents(items);
    } catch (error) {
      console.error("loadFolder error:", error);
      this.elements.folderList.innerHTML = `
        <div style="text-align: center; color: #dc322f; padding: 2rem;">
          Error: ${error.message}
        </div>
      `;
    }
  }

  renderFolderContents(items) {
    const folders = items.filter((i) => i.type === "dir");
    const files = items.filter((i) => i.type === "file");

    let html = "";

    // Parent directory link
    if (this.currentPath !== "/") {
      const parentPath =
        this.currentPath.split("/").slice(0, -1).join("/") || "/";
      html += `
        <div style="padding: 0.75rem; border-bottom: 1px solid var(--base2); display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"
             class="folder-link" data-path="${parentPath}">
          <span style="font-size: 1.2rem;">⬆️</span>
          <span style="flex: 1;">..</span>
        </div>
      `;
    }

    // Folders
    folders.forEach((item) => {
      const fullPath =
        this.currentPath === "/"
          ? `/${item.name}`
          : `${this.currentPath}/${item.name}`;
      html += `
        <div style="padding: 0.75rem; border-bottom: 1px solid var(--base2); display: flex; align-items: center; gap: 0.5rem;"
             data-path="${fullPath}" data-type="dir">
          <span style="font-size: 1.2rem; cursor: pointer;" class="folder-link">📁</span>
          <span style="flex: 1; cursor: pointer;" class="folder-link">${item.name}</span>
          <button class="rename-item-btn" data-path="${fullPath}" data-name="${item.name}" data-item-type="dir"
                  style="background: none; border: none; color: var(--blue); cursor: pointer; font-size: 1rem; padding: 0.25rem 0.5rem;">✏️</button>
        </div>
      `;
    });

    // Files
    files.forEach((item) => {
      const sizeStr = item.size
        ? `${(item.size / 1024 / 1024).toFixed(2)}MB`
        : "";
      const fullPath =
        this.currentPath === "/"
          ? `/${item.name}`
          : `${this.currentPath}/${item.name}`;
      const isXTC =
        item.name.toLowerCase().endsWith(".xtc") ||
        item.name.toLowerCase().endsWith(".xtch");

      html += `
        <div style="padding: 0.75rem; border-bottom: 1px solid var(--base2); display: flex; align-items: center; gap: 0.5rem; color: var(--base1);">
          <span style="font-size: 1.2rem;">📄</span>
          <span style="flex: 1;">${item.name}</span>
          <span style="font-size: 0.85rem;">${sizeStr}</span>
          ${
            isXTC
              ? `<button class="preview-file-btn" data-path="${fullPath}" data-name="${item.name}"
                  style="background: none; border: none; color: var(--blue); cursor: pointer; font-size: 1.2rem; padding: 0.25rem 0.5rem;" title="Preview">👁️</button>`
              : ""
          }
          <button class="rename-item-btn" data-path="${fullPath}" data-name="${item.name}" data-item-type="file"
                  style="background: none; border: none; color: var(--blue); cursor: pointer; font-size: 1rem; padding: 0.25rem 0.5rem;">✏️</button>
          <button class="delete-file-btn" data-path="${fullPath}" data-name="${item.name}"
                  style="background: none; border: none; color: var(--red); cursor: pointer; font-size: 1.2rem; padding: 0.25rem 0.5rem;">✕</button>
        </div>
      `;
    });

    if (items.length === 0) {
      html =
        '<div style="text-align: center; color: var(--base1); padding: 2rem;">Empty folder</div>';
    }

    this.elements.folderList.innerHTML = html;

    // Attach event listeners
    this.elements.folderList
      .querySelectorAll(".folder-link")
      .forEach((link) => {
        link.addEventListener("click", () => {
          const path = link.closest("[data-path]").getAttribute("data-path");
          this.currentPath = path;
          this.loadFolder(path);
        });
      });

    this.elements.folderList
      .querySelectorAll(".rename-item-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const path = btn.getAttribute("data-path");
          const name = btn.getAttribute("data-name");
          const itemType = btn.getAttribute("data-item-type");
          this.showRenameDialog(path, name, itemType);
        });
      });

    this.elements.folderList
      .querySelectorAll(".delete-file-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const path = btn.getAttribute("data-path");
          const name = btn.getAttribute("data-name");
          this.confirmDelete(path, name);
        });
      });

    this.elements.folderList
      .querySelectorAll(".preview-file-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const path = btn.getAttribute("data-path");
          const name = btn.getAttribute("data-name");
          this.showXTCPreview(path, name);
        });
      });
  }

  async uploadFiles() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;

    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      this.elements.uploadProgressContainer.style.display = "block";
      this.elements.uploadHereBtn.disabled = true;

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressPrefix = `Uploading ${i + 1}/${files.length}: ${file.name}`;
        
        try {
          const targetPath =
            this.currentPath === "/"
              ? `/${file.name}`
              : `${this.currentPath}/${file.name}`;

          await this.uploadFile(file, targetPath, (percent) => {
            this.elements.uploadStatusText.textContent = progressPrefix;
            this.elements.uploadPercentage.textContent = `${percent}%`;
            this.elements.uploadProgressBar.style.width = `${percent}%`;
          });
          successCount++;
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          failCount++;
        }
      }

      // Hide progress after short delay
      this.elements.uploadStatusText.textContent = "Upload complete!";
      this.elements.uploadPercentage.textContent = "100%";
      this.elements.uploadProgressBar.style.width = "100%";
      
      setTimeout(() => {
        this.elements.uploadProgressContainer.style.display = "none";
        this.elements.uploadHereBtn.disabled = false;
        this.elements.uploadProgressBar.style.width = "0%";
      }, 1500);

      const resultMsg = `Uploaded ${successCount} files.${failCount > 0 ? ` Failed: ${failCount}` : ""}`;
      this.showStatus(resultMsg, failCount > 0 ? "error" : "success");

      // Refresh folder
      await this.loadFolder(this.currentPath);
    };

    fileInput.click();
  }

  uploadFile(file, targetPath, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("data", file, targetPath);

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          if (onProgress) onProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });
      
      xhr.addEventListener("abort", () => {
          reject(new Error("Upload aborted"));
      });

      xhr.open("POST", `http://${this.deviceIP}/edit`);
      xhr.send(formData);
    });
  }

  async confirmDelete(path, name) {
    if (!confirm(`Delete "${name}"?`)) return;

    try {
      const formData = new FormData();
      formData.append("path", path);

      const response = await fetch(`http://${this.deviceIP}/edit`, {
        method: "DELETE",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Refresh folder
      await this.loadFolder(this.currentPath);
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  }

  showNewFolderDialog() {
    const name = prompt("New folder name:");
    if (!name) return;

    this.createFolder(name);
  }

  async createFolder(name) {
    try {
      const folderPath =
        this.currentPath === "/" ? `/${name}/` : `${this.currentPath}/${name}/`;

      const formData = new FormData();
      formData.append("path", folderPath);

      const response = await fetch(`http://${this.deviceIP}/edit`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Refresh folder
      await this.loadFolder(this.currentPath);
    } catch (error) {
      alert(`Create folder failed: ${error.message}`);
    }
  }

  showRenameDialog(path, oldName, itemType) {
    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    if (!newName || newName === oldName) return;

    this.renameItem(path, newName, itemType);
  }

  async renameItem(oldPath, newName, itemType) {
    try {
      const pathParts = oldPath.split("/");
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join("/");

      const formData = new FormData();
      formData.append("src", oldPath);
      formData.append("path", newPath);

      const response = await fetch(`http://${this.deviceIP}/edit`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Refresh folder
      await this.loadFolder(this.currentPath);
    } catch (error) {
      alert(`Rename failed: ${error.message}`);
    }
  }

  async showXTCPreview(filePath, filename) {
    // Check cache first
    if (this.previewCache.has(filename)) {
      this.displayPreview(filename, this.previewCache.get(filename));
      return;
    }

    // Show preview modal with loading state
    this.elements.previewFilename.textContent = filename;
    this.elements.previewContent.innerHTML =
      '<div style="text-align: center; color: #93a1a1">Loading preview...</div>';
    this.elements.previewModal.style.display = "block";

    try {
      // Fetch file but abort after reading first 100KB
      const controller = new AbortController();
      const signal = controller.signal;

      const response = await fetch(
        `http://${this.deviceIP}${filePath}?download=true`,
        { signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const chunks = [];
      let bytesRead = 0;
      const maxBytes = 100 * 1024; // 100KB limit

      try {
        while (bytesRead < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          bytesRead += value.length;

          if (bytesRead >= maxBytes) {
            controller.abort();
            break;
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") throw err;
      } finally {
        reader.releaseLock();
      }

      // Combine chunks into single ArrayBuffer
      const arrayBuffer = new Uint8Array(bytesRead);
      let offset = 0;
      for (const chunk of chunks) {
        arrayBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`Preview: Read ${bytesRead} bytes, aborted connection`);

      // Use existing XTCParser and XTHRenderer
      const { XTCParser } = await import("./xtc-parser.js");
      const { XTHRenderer } = await import("./xth-renderer.js");

      const parser = new XTCParser(arrayBuffer.buffer);
      const pageData = parser.getPageData(0);

      // Render using existing renderer
      const canvas = document.createElement("canvas");
      XTHRenderer.renderToCanvas(pageData, canvas);

      // Cache the canvas data URL
      const dataURL = canvas.toDataURL();
      this.previewCache.set(filename, dataURL);

      // Display preview
      this.displayPreview(filename, dataURL);
    } catch (error) {
      console.error("Preview error:", error);
      this.elements.previewContent.innerHTML = `
        <div style="text-align: center; color: #dc322f">
          <p>Failed to load preview</p>
          <p style="font-size: 0.85em; color: #586e75">${error.message}</p>
        </div>
      `;
    }
  }

  displayPreview(filename, dataURL) {
    this.elements.previewFilename.textContent = filename;
    this.elements.previewContent.innerHTML = `
      <img src="${dataURL}" style="max-width: 100%; max-height: 100%; border: 1px solid #93a1a1;" />
    `;
  }

  showStatus(message, type) {
    this.elements.deviceStatus.style.display = "block";
    this.elements.deviceStatus.textContent = message;
    this.elements.deviceStatus.style.backgroundColor =
      type === "success" ? "#859900" : type === "error" ? "#dc322f" : "#268bd2";
    this.elements.deviceStatus.style.color = "#fdf6e3";
  }

  loadDeviceIP() {
    const savedIP = localStorage.getItem("deviceIP");
    if (savedIP) {
      this.elements.deviceIP.value = savedIP;
      this.deviceIP = savedIP;
    }
  }

  saveDeviceIP() {
    const ip = this.elements.deviceIP.value.trim();
    if (ip) {
      localStorage.setItem("deviceIP", ip);
      this.deviceIP = ip;
    }
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  new DeviceManager();
});
