/**
 * 2X4 Article Extractor - Content Script
 * Extracts article content using Readability or ArxivParser (for Arxiv papers)
 */

(async function extractArticle() {
  console.log("2X4: Starting article extraction...");

  try {
    const currentUrl = document.location.href;
    const isArxiv = /arxiv\.org\/html\/(\d+\.\d+)(v\d+)?/.test(currentUrl);

    let article, contentWithEmbeddedImages, wordCount;

    if (isArxiv) {
      console.log("2X4: Detected Arxiv paper, using ArxivParser");

      // Extract metadata
      const title =
        document
          .querySelector("h1.ltx_title, .ltx_title_document, h1")
          ?.textContent?.trim() || "Untitled";

      const authorElements = document.querySelectorAll(
        ".ltx_author, .ltx_personname, .ltx_authors",
      );
      const byline =
        Array.from(authorElements)
          .map((el) => el.textContent.trim())
          .filter((a) => a)
          .join(", ") || "";

      // Extract main content
      let content = document.querySelector(
        "article, main, .ltx_document, body",
      );
      if (!content) {
        throw new Error("Could not find article content");
      }

      content = content.cloneNode(true);

      // Remove unwanted elements
      const removeSelectors = [
        "nav",
        "header",
        "footer",
        ".ltx_navigation",
        ".ltx_footer",
        ".ltx_header",
        ".ltx_page_footer",
        ".ltx_page_header",
        ".ltx_TOC",
        "script",
        "style",
        '[class*="navigation"]',
        '[class*="menu"]',
      ];
      removeSelectors.forEach((selector) => {
        content.querySelectorAll(selector).forEach((el) => el.remove());
      });

      // Convert images to absolute URLs then embed
      const images = content.querySelectorAll("img");
      console.log(`2X4: Found ${images.length} images in Arxiv content`);

      // Ensure base URL ends with / for correct resolution
      const baseUrl = currentUrl.endsWith("/") ? currentUrl : currentUrl + "/";

      for (const img of images) {
        try {
          const originalSrc = img.getAttribute("src");
          const absoluteUrl = new URL(originalSrc, baseUrl).href;
          img.setAttribute("src", absoluteUrl);
          console.log(`2X4: Converted ${originalSrc} -> ${absoluteUrl}`);
        } catch (e) {
          console.warn("Failed to resolve image URL:", img.src, e);
        }
      }

      // Don't embed images for storage - just keep absolute URLs
      // Images will be embedded during conversion in converter.js
      console.log(
        "2X4: Keeping absolute image URLs (will embed during conversion)",
      );
      contentWithEmbeddedImages = content.innerHTML;
      wordCount = countWords(content.textContent);

      article = {
        title,
        byline,
        excerpt: "",
        content: contentWithEmbeddedImages,
        wordCount,
      };
    } else {
      // Clone document for Readability (doesn't modify original)
      const documentClone = document.cloneNode(true);

      // Parse with Readability
      const reader = new Readability(documentClone, {
        debug: false,
        maxElemsToParse: 0, // No limit
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: [],
      });

      article = reader.parse();

      if (!article) {
        throw new Error(
          "Could not extract article from this page. This might not be an article, or the page structure is not supported.",
        );
      }

      console.log("2X4: Article extracted:", article.title);

      // Don't embed images for storage - images will be embedded during conversion
      console.log("2X4: Keeping image URLs (will embed during conversion)");
      contentWithEmbeddedImages = article.content;

      // Calculate word count
      wordCount = countWords(article.textContent || article.content);
    }

    // Build article data structure
    const articleData = {
      title: article.title || document.title || "Untitled",
      byline: article.byline || "",
      siteName: article.siteName || new URL(currentUrl).hostname,
      url: currentUrl,
      lang: document.documentElement.lang || "en",
      excerpt: article.excerpt || "",
      content: contentWithEmbeddedImages,
      wordCount: wordCount,
    };

    // Send to background script
    const response = await chrome.runtime.sendMessage({
      type: "ADD_ARTICLE",
      article: articleData,
    });

    if (response.success) {
      showNotification(
        `✓ Added to queue (${response.count} article${response.count > 1 ? "s" : ""})`,
        "success",
      );
    } else if (response.duplicate) {
      showNotification("⚠ Article already in queue", "warning");
    } else {
      throw new Error(response.error || "Failed to add article");
    }
  } catch (error) {
    console.error("2X4: Extraction failed:", error);
    showNotification("✗ " + error.message, "error");

    chrome.runtime.sendMessage({
      type: "EXTRACTION_ERROR",
      error: error.message,
    });
  }
})();

/**
 * Embed images as data URIs
 */
async function embedImages(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const images = doc.querySelectorAll("img");

  console.log(`2X4: Found ${images.length} images to embed`);

  const promises = Array.from(images).map(async (img) => {
    try {
      // Use getAttribute to get the actual src value, not the resolved URL
      const src = img.getAttribute("src") || img.src;

      // Skip if already data URI
      if (src.startsWith("data:")) return;

      // Skip if no src
      if (!src) {
        img.remove();
        return;
      }

      console.log(`2X4: Processing image: ${src}`);

      // Fetch image
      const response = await fetch(src);
      if (!response.ok) {
        console.error(`2X4: Failed to fetch ${src}: HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      // Skip if too large (>5MB)
      if (blob.size > 5 * 1024 * 1024) {
        console.warn(
          `2X4: Image too large (${(blob.size / 1024 / 1024).toFixed(2)}MB), skipping: ${src}`,
        );
        img.remove();
        return;
      }

      // Convert to data URI
      const dataUrl = await blobToDataURL(blob);
      img.setAttribute("src", dataUrl);

      console.log(
        `2X4: Embedded image (${(blob.size / 1024).toFixed(0)}KB): ${src}`,
      );
    } catch (error) {
      console.warn(`2X4: Failed to embed image ${img.src}:`, error.message);
      // Remove broken images
      img.remove();
    }
  });

  await Promise.all(promises);

  return doc.body.innerHTML;
}

/**
 * Convert blob to data URL
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Count words in text
 */
function countWords(text) {
  if (!text) return 0;
  // Remove HTML tags and count words
  const plainText = text.replace(/<[^>]*>/g, " ");
  const words = plainText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.length;
}

/**
 * Show notification toast
 */
function showNotification(message, type) {
  // Remove existing notification if any
  const existing = document.getElementById("x4-notification");
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement("div");
  notification.id = "x4-notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === "success" ? "#859900" : type === "warning" ? "#b58900" : "#dc322f"};
    color: white;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;

  notification.textContent = message;

  // Add slide-in animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.3s";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}
