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
      // H1: cyan color with proper spacing
      el.style.color = '#0891b2';
      el.style.marginTop = '24px';
      el.style.marginBottom = '12px';
    } else if (tagName === 'h2') {
      // H2: purple color with proper spacing
      el.style.color = '#9333ea';
      el.style.marginTop = '18px';
      el.style.marginBottom = '9px';
    } else if (tagName === 'h3') {
      // H3: proper spacing
      el.style.marginTop = '12px';
      el.style.marginBottom = '6px';
    } else if (tagName === 'h4') {
      // H4: proper spacing
      el.style.marginTop = '9px';
      el.style.marginBottom = '4.5px';
    } else if (tagName === 'p') {
      // Paragraphs: proper spacing and max-width constraint
      el.style.marginTop = '6px';
      el.style.marginBottom = '6px';
      el.style.maxWidth = '100%';
      el.style.wordWrap = 'break-word';
      el.style.overflowWrap = 'break-word';
    }
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
      hr.style.margin = '12px 0';
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
