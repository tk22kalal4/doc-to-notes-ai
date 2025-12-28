import mammoth from 'mammoth';

export const parseDocxFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    let html = result.value;
    
    // Remove unnecessary wrapper divs if present
    html = html.replace(/<div class="document">(.*)<\/div>/s, '$1');
    
    // Create a temporary container to manipulate the DOM
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Process each element to reconstruct formatting lost by mammoth
    processElementsForStyling(temp);
    
    // Get the processed HTML
    html = temp.innerHTML;
    
    return html;
  } catch (error) {
    console.error('Error parsing docx file:', error);
    throw new Error('Failed to parse the docx file. Please ensure it is a valid Word document.');
  }
};

const processElementsForStyling = (container: HTMLElement) => {
  const elements = container.querySelectorAll('*');
  
  elements.forEach((element: Element) => {
    const el = element as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    
    // Apply heading colors to match the download format
    if (tagName === 'h1') {
      // H1: cyan color with proper spacing and font
      el.style.color = '#0891b2';
      el.style.marginTop = '24px';
      el.style.marginBottom = '12px';
      el.style.fontSize = '1.875rem';
      el.style.fontWeight = '700';
      el.style.lineHeight = '1.3';
    } else if (tagName === 'h2') {
      // H2: purple color with proper spacing and font
      el.style.color = '#9333ea';
      el.style.marginTop = '18px';
      el.style.marginBottom = '9px';
      el.style.fontSize = '1.5rem';
      el.style.fontWeight = '600';
      el.style.lineHeight = '1.4';
    } else if (tagName === 'h3') {
      // H3: proper spacing and font
      el.style.marginTop = '12px';
      el.style.marginBottom = '6px';
      el.style.fontSize = '1.25rem';
      el.style.fontWeight = '600';
      el.style.lineHeight = '1.4';
    } else if (tagName === 'h4') {
      // H4: proper spacing and font
      el.style.marginTop = '9px';
      el.style.marginBottom = '4.5px';
      el.style.fontWeight = '600';
      el.style.lineHeight = '1.4';
    } else if (tagName === 'p') {
      // Paragraphs: proper spacing and max-width constraint
      el.style.marginTop = '6px';
      el.style.marginBottom = '6px';
      el.style.maxWidth = '100%';
      el.style.wordWrap = 'break-word';
      el.style.overflowWrap = 'break-word';
      el.style.lineHeight = '1.8';
    } else if (tagName === 'li') {
      // List items: proper spacing
      el.style.marginBottom = '0.5rem';
      el.style.lineHeight = '1.8';
      el.style.maxWidth = '100%';
      el.style.wordWrap = 'break-word';
      el.style.overflowWrap = 'break-word';
    }
  });
  
  // Apply spacing to all lists with proper left margins
  container.querySelectorAll('ul, ol').forEach((list: Element) => {
    const listEl = list as HTMLElement;
    const parent = listEl.parentElement;
    
    // Check nesting level
    const isNestedOnce = parent && (parent.tagName.toLowerCase() === 'li');
    const isNestedTwice = isNestedOnce && parent.parentElement && 
                          (parent.parentElement.tagName.toLowerCase() === 'li' || 
                           parent.parentElement.parentElement?.tagName.toLowerCase() === 'li');
    
    if (!isNestedOnce) {
      // First level lists - add left margin
      listEl.style.marginLeft = '1.5rem';
      listEl.style.paddingLeft = '0';
      listEl.style.marginTop = '0.75rem';
      listEl.style.marginBottom = '0.75rem';
    } else if (isNestedOnce && !isNestedTwice) {
      // Second level lists
      listEl.style.marginLeft = '2rem';
      listEl.style.paddingLeft = '0';
      listEl.style.marginTop = '0.5rem';
      listEl.style.marginBottom = '0.5rem';
    } else {
      // Third level and beyond
      listEl.style.marginLeft = '2rem';
      listEl.style.paddingLeft = '0';
      listEl.style.marginTop = '0.25rem';
      listEl.style.marginBottom = '0.25rem';
    }
    
    listEl.style.maxWidth = '100%';
    listEl.style.overflowWrap = 'break-word';
  });
  
  // Convert horizontal lines (which mammoth may represent as separators) to proper HR elements
  // Look for text nodes that contain only dashes or similar separator patterns
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const nodesToReplace: { node: Node; parent: HTMLElement; hr: HTMLElement }[] = [];
  let textNode;
  
  while ((textNode = walker.nextNode())) {
    const text = textNode.textContent || '';
    // Check if this is a separator line (50+ dashes, underscores, or similar)
    if (/^[─_\-═]{30,}$/.test(text.trim())) {
      const hr = document.createElement('hr');
      hr.style.margin = '18px 0';
      hr.style.padding = '0';
      hr.style.border = 'none';
      hr.style.borderTop = '1px solid #cccccc';
      hr.style.maxWidth = '100%';
      const parent = textNode.parentElement;
      if (parent) {
        nodesToReplace.push({ node: textNode, parent, hr });
      }
    }
  }
  
  // Replace separator lines with HR elements
  nodesToReplace.forEach(({ node, parent, hr }) => {
    parent.replaceChild(hr, node);
  });
  
  // Add max-width and prevent overflow for list items
  container.querySelectorAll('ul, ol').forEach((list: Element) => {
    (list as HTMLElement).style.maxWidth = '100%';
    (list as HTMLElement).style.overflowWrap = 'break-word';
  });
  
  container.querySelectorAll('li').forEach((li: Element) => {
    (li as HTMLElement).style.maxWidth = '100%';
    (li as HTMLElement).style.wordWrap = 'break-word';
    (li as HTMLElement).style.overflowWrap = 'break-word';
  });
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
