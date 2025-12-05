/**
 * 2X4 Article Extractor - Popup UI Logic
 */

let currentQueue = [];

// DOM elements
const elements = {
  addCurrent: document.getElementById("add-current"),
  openIn2x4: document.getElementById("open-in-2x4"),
  clearQueue: document.getElementById("clear-queue"),
  queueList: document.getElementById("queue-list"),
  emptyState: document.getElementById("empty-state"),
  articleCount: document.getElementById("article-count"),
  readingTime: document.getElementById("reading-time"),
};

// Initialize popup
async function init() {
  await loadQueue();
  setupEventListeners();
}

// Load queue from storage
async function loadQueue() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_QUEUE" });
    if (response.success) {
      currentQueue = response.queue;
      renderQueue();
    }
  } catch (error) {
    console.error("Error loading queue:", error);
  }
}

// Render queue list
function renderQueue() {
  const count = currentQueue.length;

  // Update stats
  elements.articleCount.textContent = `${count} article${count !== 1 ? "s" : ""}`;
  const totalWords = currentQueue.reduce(
    (sum, a) => sum + (a.wordCount || 0),
    0,
  );
  const readingMinutes = Math.ceil(totalWords / 200); // Assume 200 words per minute
  elements.readingTime.textContent = `${readingMinutes} min read`;

  // Enable/disable buttons
  elements.openIn2x4.disabled = count === 0;
  elements.clearQueue.disabled = count === 0;

  // Show empty state or list
  if (count === 0) {
    elements.emptyState.style.display = "flex";
    elements.queueList.style.display = "none";
    return;
  }

  elements.emptyState.style.display = "none";
  elements.queueList.style.display = "block";

  // Render list items
  elements.queueList.innerHTML = "";
  currentQueue.forEach((article, index) => {
    const li = createQueueItem(article, index);
    elements.queueList.appendChild(li);
  });
}

// Create queue item element
function createQueueItem(article, index) {
  const li = document.createElement("li");
  li.className = "queue-item";
  li.dataset.id = article.id;

  const title = document.createElement("div");
  title.className = "queue-item-header";

  const titleText = document.createElement("div");
  titleText.className = "queue-item-title";
  titleText.textContent = article.title;

  const actions = document.createElement("div");
  actions.className = "queue-item-actions";

  // Move up button
  if (index > 0) {
    const upBtn = document.createElement("button");
    upBtn.className = "icon-btn";
    upBtn.textContent = "⬆️";
    upBtn.title = "Move up";
    upBtn.onclick = () => moveArticle(index, index - 1);
    actions.appendChild(upBtn);
  }

  // Move down button
  if (index < currentQueue.length - 1) {
    const downBtn = document.createElement("button");
    downBtn.className = "icon-btn";
    downBtn.textContent = "⬇️";
    downBtn.title = "Move down";
    downBtn.onclick = () => moveArticle(index, index + 1);
    actions.appendChild(downBtn);
  }

  // Remove button
  const removeBtn = document.createElement("button");
  removeBtn.className = "icon-btn";
  removeBtn.textContent = "❌";
  removeBtn.title = "Remove";
  removeBtn.onclick = () => removeArticle(article.id);
  actions.appendChild(removeBtn);

  title.appendChild(titleText);
  title.appendChild(actions);

  const meta = document.createElement("div");
  meta.className = "queue-item-meta";

  const site = document.createElement("span");
  site.className = "queue-item-site";
  site.textContent = article.siteName || new URL(article.url).hostname;

  const words = document.createElement("span");
  words.textContent = `${article.wordCount || 0} words`;

  meta.appendChild(site);
  meta.appendChild(words);

  li.appendChild(title);
  li.appendChild(meta);

  return li;
}

// Setup event listeners
function setupEventListeners() {
  elements.addCurrent.addEventListener("click", addCurrentPage);
  elements.openIn2x4.addEventListener("click", openIn2x4);
  elements.clearQueue.addEventListener("click", clearQueue);
}

// Add current page to queue
async function addCurrentPage() {
  try {
    elements.addCurrent.disabled = true;
    elements.addCurrent.textContent = "Extracting...";

    // Get active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Inject Readability and content script (paths relative to extension root)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["extension/lib/Readability.js", "extension/content.js"],
    });

    // Queue will be updated via message, reload after a delay
    setTimeout(async () => {
      await loadQueue();
      elements.addCurrent.disabled = false;
      elements.addCurrent.innerHTML = "<span>📄</span>Add Current Page";
    }, 1000);
  } catch (error) {
    console.error("Error adding current page:", error);
    alert("Failed to extract article: " + error.message);
    elements.addCurrent.disabled = false;
    elements.addCurrent.innerHTML = "<span>📄</span>Add Current Page";
  }
}

// Open in 2X4 Converter
async function openIn2x4() {
  try {
    elements.openIn2x4.disabled = true;
    elements.openIn2x4.innerHTML = "<span>🚀</span>Opening...";

    // Get the extension converter URL
    const url = chrome.runtime.getURL("extension/converter.html");

    // Open in new tab
    await chrome.tabs.create({ url });

    // Show success feedback briefly
    elements.openIn2x4.innerHTML = "<span>✓</span>Opened!";
    setTimeout(() => {
      window.close(); // Close popup
    }, 500);
  } catch (error) {
    console.error("Error opening 2X4:", error);
    alert("Failed to open 2X4: " + error.message);
    elements.openIn2x4.innerHTML = "<span>🚀</span>Open in 2X4";
    elements.openIn2x4.disabled = false;
  }
}

// Clear queue
async function clearQueue() {
  if (!confirm("Clear all articles from queue? This cannot be undone.")) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: "CLEAR_QUEUE" });
    if (response.success) {
      currentQueue = [];
      renderQueue();
    }
  } catch (error) {
    console.error("Error clearing queue:", error);
    alert("Failed to clear queue: " + error.message);
  }
}

// Remove article
async function removeArticle(id) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "REMOVE_ARTICLE",
      id: id,
    });

    if (response.success) {
      await loadQueue();
    }
  } catch (error) {
    console.error("Error removing article:", error);
    alert("Failed to remove article: " + error.message);
  }
}

// Move article
async function moveArticle(fromIndex, toIndex) {
  try {
    const newQueue = [...currentQueue];
    const [article] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, article);

    const response = await chrome.runtime.sendMessage({
      type: "REORDER_QUEUE",
      queue: newQueue,
    });

    if (response.success) {
      currentQueue = newQueue;
      renderQueue();
    }
  } catch (error) {
    console.error("Error moving article:", error);
    alert("Failed to reorder queue: " + error.message);
  }
}

// Initialize on load
init();
