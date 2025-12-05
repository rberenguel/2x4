/**
 * 2X4 Article Extractor - Background Service Worker
 * Manages article queue, badge updates, and export functionality
 */

// Initialize queue on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["articleQueue"], (result) => {
    if (!result.articleQueue) {
      chrome.storage.local.set({ articleQueue: [] });
    }
    updateBadge();
  });
});

// Update badge with queue count
async function updateBadge() {
  const { articleQueue = [] } = await chrome.storage.local.get([
    "articleQueue",
  ]);
  const count = articleQueue.length;

  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#268bd2" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ADD_ARTICLE") {
    handleAddArticle(message.article).then(sendResponse);
    return true; // Keep channel open for async response
  } else if (message.type === "GET_QUEUE") {
    handleGetQueue().then(sendResponse);
    return true;
  } else if (message.type === "REMOVE_ARTICLE") {
    handleRemoveArticle(message.id).then(sendResponse);
    return true;
  } else if (message.type === "REORDER_QUEUE") {
    handleReorderQueue(message.queue).then(sendResponse);
    return true;
  } else if (message.type === "CLEAR_QUEUE") {
    handleClearQueue().then(sendResponse);
    return true;
  } else if (message.type === "EXPORT_QUEUE") {
    handleExportQueue().then(sendResponse);
    return true;
  }
});

// Add article to queue
async function handleAddArticle(article) {
  try {
    const { articleQueue = [] } = await chrome.storage.local.get([
      "articleQueue",
    ]);

    // Check for duplicate URL
    const isDuplicate = articleQueue.some((a) => a.url === article.url);
    if (isDuplicate) {
      return {
        success: false,
        error: "Article already in queue",
        duplicate: true,
      };
    }

    // Add article with unique ID and timestamp
    const newArticle = {
      ...article,
      id: crypto.randomUUID(),
      addedAt: Date.now(),
    };

    articleQueue.push(newArticle);
    await chrome.storage.local.set({ articleQueue });
    await updateBadge();

    return {
      success: true,
      count: articleQueue.length,
      article: newArticle,
    };
  } catch (error) {
    console.error("Error adding article:", error);
    return { success: false, error: error.message };
  }
}

// Get current queue
async function handleGetQueue() {
  const { articleQueue = [] } = await chrome.storage.local.get([
    "articleQueue",
  ]);
  return { success: true, queue: articleQueue };
}

// Remove article by ID
async function handleRemoveArticle(id) {
  try {
    const { articleQueue = [] } = await chrome.storage.local.get([
      "articleQueue",
    ]);
    const filtered = articleQueue.filter((a) => a.id !== id);
    await chrome.storage.local.set({ articleQueue: filtered });
    await updateBadge();
    return { success: true, count: filtered.length };
  } catch (error) {
    console.error("Error removing article:", error);
    return { success: false, error: error.message };
  }
}

// Reorder queue
async function handleReorderQueue(newQueue) {
  try {
    await chrome.storage.local.set({ articleQueue: newQueue });
    return { success: true };
  } catch (error) {
    console.error("Error reordering queue:", error);
    return { success: false, error: error.message };
  }
}

// Clear entire queue
async function handleClearQueue() {
  try {
    await chrome.storage.local.set({ articleQueue: [] });
    await updateBadge();
    return { success: true };
  } catch (error) {
    console.error("Error clearing queue:", error);
    return { success: false, error: error.message };
  }
}

// Export queue as JSON file
async function handleExportQueue() {
  try {
    const { articleQueue = [] } = await chrome.storage.local.get([
      "articleQueue",
    ]);

    if (articleQueue.length === 0) {
      return { success: false, error: "Queue is empty" };
    }

    // Build export structure
    const exportData = {
      version: "1.0",
      type: "article-queue",
      exportedAt: Date.now(),
      articles: articleQueue,
    };

    // Create blob and convert to data URL (works in service worker)
    const json = JSON.stringify(exportData, null, 2);

    // Convert to base64 in chunks to avoid call stack overflow
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:application/json;base64,${base64}`;

    // Generate filename with timestamp
    const date = new Date().toISOString().split("T")[0];
    const filename = `reading-queue-${date}.html`;

    // Trigger download
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true,
    });

    return {
      success: true,
      count: articleQueue.length,
      filename: filename,
    };
  } catch (error) {
    console.error("Error exporting queue:", error);
    return { success: false, error: error.message };
  }
}

// Initialize badge on startup
updateBadge();
