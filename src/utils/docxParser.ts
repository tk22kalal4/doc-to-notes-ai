import mammoth from 'mammoth';

export const parseDocxFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    let html = result.value;
    
    // Process the HTML to fix display issues without reconstructing structure
    html = processDocxHtml(html);
    
    return html;
  } catch (error) {
    console.error('Error parsing docx file:', error);
    throw new Error('Failed to parse the docx file. Please ensure it is a valid Word document.');
  }
};

/**
 * Process mammoth HTML output to restore visual hierarchy:
 * 1. Apply indentation to headings (h1, h2, h3, h4)
 * 2. Apply indentation to paragraphs based on context
 * 3. Fix horizontal lines
 * 4. Apply indentation to nested lists
 */
const processDocxHtml = (html: string): string => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Fix 1: Apply proper indentation hierarchy to all elements
  restoreVisualHierarchy(temp);
  
  // Fix 2: Handle horizontal line text that overflows
  fixHorizontalLines(temp);
  
  return temp.innerHTML;
};

/**
 * Restore visual hierarchy by applying indentation based on element type
 * This recreates the visual structure that Word had but mammoth lost
 */
const restoreVisualHierarchy = (container: HTMLElement) => {
  // Process all block-level elements
  const allElements = container.querySelectorAll('h1, h2, h3, h4, p, ul, ol');
  
  allElements.forEach((element) => {
    const el = element as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    
    // Apply indentation based on element type
    // This restores the visual hierarchy from the Word document
    if (tagName === 'h1') {
      // Main title - minimal indentation, leftmost position
      el.style.marginLeft = '0';
      el.style.paddingLeft = '0';
    } else if (tagName === 'h2') {
      // Section heading - slight indentation
      el.style.marginLeft = '0.5rem';
      el.style.paddingLeft = '0';
    } else if (tagName === 'h3') {
      // Subsection - more indentation
      el.style.marginLeft = '1rem';
      el.style.paddingLeft = '0';
    } else if (tagName === 'h4') {
      // Minor heading - even more indentation
      el.style.marginLeft = '1.5rem';
      el.style.paddingLeft = '0';
    } else if (tagName === 'p') {
      // Paragraphs - check if they contain bullet-like emoji patterns
      const text = el.textContent || '';
      const startsWithEmoji = /^[🔹📌🧠✨💡🔸🟡⚠️❤️🩺💊🧬🔬🏥💪💨💓🤒🎯]/.test(text.trim());
      
      if (startsWithEmoji) {
        // This is a styled bullet point - apply appropriate indentation
        const emojiMatch = text.match(/^([🔹📌🧠✨💡🔸🟡⚠️❤️🩺💊🧬🔬🏥💪💨💓🤒🎯])/);
        if (emojiMatch) {
          const emoji = emojiMatch[1];
          // Determine indentation level based on emoji type
          if (emoji === '📌' || emoji === '🔹') {
            // First level - moderate indentation
            el.style.marginLeft = '2rem';
            el.style.paddingLeft = '0';
          } else if (emoji === '🔸' || emoji === '🧠') {
            // Second level - more indentation
            el.style.marginLeft = '3rem';
            el.style.paddingLeft = '0';
          } else if (emoji === '✨' || emoji === '💡') {
            // Third level - even more indentation
            el.style.marginLeft = '4rem';
            el.style.paddingLeft = '0';
          } else {
            // Other emojis (headers) - slight indentation
            el.style.marginLeft = '1.5rem';
            el.style.paddingLeft = '0';
          }
        }
      } else {
        // Regular paragraph text - moderate indentation
        el.style.marginLeft = '2rem';
        el.style.paddingLeft = '0';
        el.style.wordWrap = 'break-word';
        el.style.overflowWrap = 'break-word';
      }
    } else if (tagName === 'ul' || tagName === 'ol') {
      // Lists - determine nesting depth and apply indentation
      let depth = 0;
      let parent = el.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase() === 'li') {
          depth++;
          parent = parent.parentElement?.parentElement;
        } else {
          break;
        }
      }
      
      // Apply indentation based on depth
      if (depth === 0) {
        el.style.marginLeft = '2rem';
        el.style.paddingLeft = '0';
      } else if (depth === 1) {
        el.style.marginLeft = '3rem';
        el.style.paddingLeft = '0';
      } else {
        el.style.marginLeft = `${2 + (depth * 1)}rem`;
        el.style.paddingLeft = '0';
      }
      
      // Ensure list items wrap properly
      const items = el.querySelectorAll(':scope > li');
      items.forEach((item) => {
        const liEl = item as HTMLElement;
        liEl.style.wordWrap = 'break-word';
        liEl.style.overflowWrap = 'break-word';
        liEl.style.whiteSpace = 'normal';
      });
    }
  });
};

/**
 * Convert horizontal line text patterns to proper HR elements or wrapped containers
 */
const fixHorizontalLines = (container: HTMLElement) => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const nodesToProcess: { node: Node; parent: HTMLElement }[] = [];
  let textNode;
  
  while ((textNode = walker.nextNode())) {
    const text = textNode.textContent || '';
    // Match lines with dashes/underscores (30+ characters)
    if (/^[─_\-═]{30,}$/.test(text.trim())) {
      const parent = textNode.parentElement;
      if (parent) {
        nodesToProcess.push({ node: textNode, parent });
      }
    }
  }
  
  // Process collected nodes
  nodesToProcess.forEach(({ node, parent }) => {
    const hr = document.createElement('hr');
    hr.style.cssText = `
      margin: 16px 0;
      padding: 0;
      border: none;
      border-top: 1px solid #cccccc;
      width: 100%;
      box-sizing: border-box;
    `;
    parent.replaceChild(hr, node);
  });
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
