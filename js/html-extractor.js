/**
 * HTML Extractor
 * Extracts simplified HTML from paginated DOM elements for translation
 */

export class HTMLExtractor {
  constructor() {
    // Only allow these HTML tags
    this.allowedTags = ['p', 'strong', 'em', 'b', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br'];
  }

  /**
   * Extract simplified HTML from page element (only visible content)
   * @param {HTMLElement} pageElement - DOM element from getCurrentPageElement()
   * @returns {string} - Simplified HTML string
   */
  extractSimplifiedHTML(pageElement) {
    // The pageElement is a container with overflow:hidden and a transformed child
    // We need to temporarily render it to DOM to extract only visible elements

    // Append to DOM temporarily
    const wasInDOM = document.body.contains(pageElement);
    if (!wasInDOM) {
      pageElement.style.position = 'absolute';
      pageElement.style.left = '-9999px';
      pageElement.style.top = '-9999px';
      document.body.appendChild(pageElement);
    }

    // Get the bounds of the visible area
    const containerRect = pageElement.getBoundingClientRect();

    // Find the inner content container (the transformed element)
    const innerContainer = pageElement.querySelector('[style*="transform"]') || pageElement.firstElementChild;

    if (!innerContainer) {
      if (!wasInDOM) document.body.removeChild(pageElement);
      return '';
    }

    // Extract only elements that are within visible bounds
    const visibleHTML = this.extractVisibleElements(innerContainer, containerRect);

    // Remove from DOM if we added it
    if (!wasInDOM) {
      document.body.removeChild(pageElement);
    }

    return visibleHTML;
  }

  /**
   * Extract elements that are visible within the container bounds
   * @param {HTMLElement} element - Element to check
   * @param {DOMRect} containerRect - Visible container bounds
   * @returns {string} - HTML of visible elements
   */
  extractVisibleElements(element, containerRect) {
    const result = [];

    // Walk through all elements
    const allElements = element.querySelectorAll('*');

    for (const el of allElements) {
      const rect = el.getBoundingClientRect();

      // Check if element is within visible bounds
      // An element is visible if it intersects with the container
      const isVisible = !(
        rect.bottom < containerRect.top ||
        rect.top > containerRect.bottom ||
        rect.right < containerRect.left ||
        rect.left > containerRect.right
      );

      if (isVisible && this.allowedTags.includes(el.tagName.toLowerCase())) {
        // Check if this element contains only text (no nested allowed tags)
        const hasAllowedChildren = Array.from(el.children).some(child =>
          this.allowedTags.includes(child.tagName.toLowerCase())
        );

        if (!hasAllowedChildren) {
          // This is a leaf element with text content
          const tag = el.tagName.toLowerCase();
          const text = el.textContent.trim();

          if (text.length > 0) {
            if (tag === 'br') {
              result.push('<br>');
            } else {
              result.push(`<${tag}>${text}</${tag}>`);
            }
          }
        }
      }
    }

    return this.normalizeWhitespace(result.join('\n'));
  }

  /**
   * Recursively clean element - keep only allowed tags and their text
   * @param {HTMLElement} element
   */
  cleanElement(element) {
    if (!element || !element.childNodes) return;

    // Process child nodes
    const children = Array.from(element.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        // Keep text nodes as-is
        continue;
      }

      if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        // Remove all attributes from allowed tags
        if (this.allowedTags.includes(tagName)) {
          // Remove all attributes
          while (child.attributes.length > 0) {
            child.removeAttribute(child.attributes[0].name);
          }

          // Recursively clean children
          this.cleanElement(child);
        } else {
          // Disallowed tag - unwrap but keep text content
          const parent = child.parentNode;
          while (child.firstChild) {
            parent.insertBefore(child.firstChild, child);
          }
          parent.removeChild(child);
        }
      } else {
        // Remove comments, processing instructions, etc.
        child.remove();
      }
    }
  }

  /**
   * Normalize whitespace while preserving paragraph structure
   * @param {string} html
   * @returns {string}
   */
  normalizeWhitespace(html) {
    // Remove extra whitespace between tags
    html = html.replace(/>\s+</g, '><');

    // Normalize whitespace within text content
    html = html.replace(/\s+/g, ' ');

    // Clean up empty tags
    html = html.replace(/<(\w+)>\s*<\/\1>/g, '');

    return html;
  }
}
