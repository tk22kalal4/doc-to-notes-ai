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
 * Process mammoth HTML output to fix display issues:
 * 1. Wrap horizontal line text in proper containers
 * 2. Add proper indentation to nested lists based on nesting depth
 * 3. Preserve all content and structure exactly
 */
const processDocxHtml = (html: string): string => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Fix 1: Handle horizontal line text that overflows
  fixHorizontalLines(temp);
  
  // Fix 2: Add proper indentation to nested lists
  fixNestedListIndentation(temp);
  
  return temp.innerHTML;
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

/**
 * Add proper indentation to nested lists based on DOM nesting level
 * This preserves mammoth's structure while adding CSS for proper display
 */
const fixNestedListIndentation = (container: HTMLElement) => {
  const allLists = container.querySelectorAll('ul, ol');
  
  allLists.forEach((list) => {
    const listEl = list as HTMLElement;
    
    // Calculate nesting depth by counting parent <li> elements
    let depth = 0;
    let parent = listEl.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === 'li') {
        depth++;
        parent = parent.parentElement?.parentElement;
      } else {
        break;
      }
    }
    
    // Apply indentation based on depth
    // Each level gets progressively more indentation
    if (depth === 0) {
      // Top-level list
      listEl.style.marginLeft = '1.5rem';
      listEl.style.marginTop = '0.5rem';
      listEl.style.marginBottom = '0.5rem';
      listEl.style.paddingLeft = '1.5rem';
    } else if (depth === 1) {
      // First nested level
      listEl.style.marginLeft = '0.5rem';
      listEl.style.marginTop = '0.25rem';
      listEl.style.marginBottom = '0.25rem';
      listEl.style.paddingLeft = '1.5rem';
    } else if (depth === 2) {
      // Second nested level
      listEl.style.marginLeft = '0.25rem';
      listEl.style.marginTop = '0.125rem';
      listEl.style.marginBottom = '0.125rem';
      listEl.style.paddingLeft = '1.5rem';
    } else {
      // Deeper nesting
      listEl.style.marginLeft = '0rem';
      listEl.style.paddingLeft = `${1.5 + (depth - 3) * 0.5}rem`;
    }
    
    // Ensure list items don't overflow
    const items = listEl.querySelectorAll(':scope > li');
    items.forEach((item) => {
      const liEl = item as HTMLElement;
      liEl.style.overflow = 'visible';
      liEl.style.wordWrap = 'break-word';
      liEl.style.overflowWrap = 'break-word';
      liEl.style.whiteSpace = 'normal';
    });
  });
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
