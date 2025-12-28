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
    
    // Reconstruct nested bullet lists from flat structure
    reconstructNestedLists(temp);
    
    // Process each element to apply styling
    processElementsForStyling(temp);
    
    // Get the processed HTML
    html = temp.innerHTML;
    
    return html;
  } catch (error) {
    console.error('Error parsing docx file:', error);
    throw new Error('Failed to parse the docx file. Please ensure it is a valid Word document.');
  }
};

const reconstructNestedLists = (container: HTMLElement) => {
  // Find all ul/ol lists in the document
  const lists = container.querySelectorAll('ul, ol');
  
  lists.forEach((list) => {
    const listEl = list as HTMLElement;
    const items = Array.from(listEl.querySelectorAll(':scope > li'));
    
    if (items.length === 0) return;
    
    // Analyze each list item to determine its nesting level based on bullet marker
    const itemsWithMetadata: Array<{ 
      el: HTMLElement; 
      indent: number; 
    }> = [];
    
    items.forEach((item) => {
      const li = item as HTMLElement;
      const text = (li.textContent || '').trim();
      
      // Detect indentation level:
      // Level 0: Primary markers (📌, 🟡, 🔹, ⚠️, ❤️, 🔬, 🧬, 🤒, 💊, 📝, 🟢, 🔪, ⚡, 🩺)
      // Level 1: Secondary marker (🧠) - indicates this is a nested bullet
      let indent = 0;
      
      if (text.startsWith('🧠')) {
        indent = 1;
      } else {
        indent = 0;
      }
      
      itemsWithMetadata.push({ el: li, indent });
    });
    
    // Reconstruct nested structure from the flat list
    if (itemsWithMetadata.length > 0) {
      const newList = document.createElement('ul') as HTMLUListElement;
      newList.className = listEl.className;
      
      let currentLevel = 0;
      let currentList = newList as HTMLElement;
      const listStack: HTMLElement[] = [newList as HTMLElement];
      
      itemsWithMetadata.forEach((item) => {
        const { el, indent } = item;
        
        if (indent > currentLevel) {
          // Create nested list
          for (let i = currentLevel; i < indent; i++) {
            const newNestedList = document.createElement('ul') as HTMLUListElement;
            const lastItem = currentList.lastElementChild as HTMLElement;
            
            if (lastItem) {
              lastItem.appendChild(newNestedList);
            }
            
            currentList = newNestedList as HTMLElement;
            listStack.push(currentList);
          }
          currentLevel = indent;
        } else if (indent < currentLevel) {
          // Pop up the stack
          const levelDiff = currentLevel - indent;
          for (let i = 0; i < levelDiff; i++) {
            listStack.pop();
          }
          currentList = listStack[listStack.length - 1];
          currentLevel = indent;
        }
        
        // Clone and append
        const clonedEl = el.cloneNode(true) as HTMLElement;
        currentList.appendChild(clonedEl);
      });
      
      // Replace original list
      listEl.parentElement?.replaceChild(newList, listEl);
    }
  });
};

const processElementsForStyling = (container: HTMLElement) => {
  const elements = container.querySelectorAll('*');
  
  elements.forEach((element: Element) => {
    const el = element as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    
    // Apply heading colors
    if (tagName === 'h1') {
      el.style.color = '#0891b2';
      el.style.marginTop = '24px';
      el.style.marginBottom = '12px';
      el.style.fontSize = '1.875rem';
      el.style.fontWeight = '700';
      el.style.lineHeight = '1.3';
    } else if (tagName === 'h2') {
      el.style.color = '#9333ea';
      el.style.marginTop = '18px';
      el.style.marginBottom = '9px';
      el.style.fontSize = '1.5rem';
      el.style.fontWeight = '600';
      el.style.lineHeight = '1.4';
    } else if (tagName === 'h3') {
      el.style.marginTop = '12px';
      el.style.marginBottom = '6px';
      el.style.fontSize = '1.25rem';
      el.style.fontWeight = '600';
      el.style.lineHeight = '1.4';
    } else if (tagName === 'h4') {
      el.style.marginTop = '9px';
      el.style.marginBottom = '4.5px';
      el.style.fontWeight = '600';
      el.style.lineHeight = '1.4';
    } else if (tagName === 'p') {
      el.style.marginTop = '6px';
      el.style.marginBottom = '6px';
      el.style.maxWidth = '100%';
      el.style.wordWrap = 'break-word';
      el.style.overflowWrap = 'break-word';
      el.style.lineHeight = '1.8';
    } else if (tagName === 'li') {
      el.style.marginBottom = '0.5rem';
      el.style.lineHeight = '1.8';
      el.style.maxWidth = '100%';
      el.style.wordWrap = 'break-word';
      el.style.overflowWrap = 'break-word';
    }
  });
  
  // Apply list styling with proper margins and hide nested bullets
  const allLists = container.querySelectorAll('ul, ol');
  
  allLists.forEach((list) => {
    const listEl = list as HTMLElement;
    
    // Determine nesting level
    let nestLevel = 0;
    let parent = listEl.parentElement;
    
    while (parent) {
      if (parent.tagName.toLowerCase() === 'li') {
        nestLevel++;
        parent = parent.parentElement?.parentElement;
      } else {
        break;
      }
    }
    
    // Apply margins based on nesting level
    listEl.style.marginRight = '0';
    listEl.style.paddingLeft = '0';
    listEl.style.maxWidth = '100%';
    listEl.style.overflowWrap = 'break-word';
    
    if (nestLevel === 0) {
      // Top-level list
      listEl.style.marginLeft = '1.5rem';
      listEl.style.marginTop = '0.75rem';
      listEl.style.marginBottom = '0.75rem';
      listEl.style.listStyleType = 'disc';
    } else if (nestLevel === 1) {
      // Nested once - hide bullets completely
      listEl.style.marginLeft = '2rem';
      listEl.style.marginTop = '0.5rem';
      listEl.style.marginBottom = '0.5rem';
      listEl.style.setProperty('listStyleType', 'none', 'important');
      listEl.style.listStylePosition = 'inside';
      listEl.style.padding = '0';
      
      // Remove default bullet styling from nested items
      const nestedItems = listEl.querySelectorAll(':scope > li');
      nestedItems.forEach((item) => {
        const liEl = item as HTMLElement;
        liEl.style.setProperty('listStyleType', 'none', 'important');
        liEl.style.listStylePosition = 'inside';
        liEl.style.paddingLeft = '0';
        liEl.style.marginLeft = '0';
        liEl.style.textIndent = '0';
      });
    } else {
      // Triple nested and beyond
      listEl.style.marginLeft = '2rem';
      listEl.style.marginTop = '0.25rem';
      listEl.style.marginBottom = '0.25rem';
      listEl.style.setProperty('listStyleType', 'none', 'important');
    }
  });
  
  // Convert horizontal lines to HR elements
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const nodesToReplace: { node: Node; parent: HTMLElement; hr: HTMLElement }[] = [];
  let textNode;
  
  while ((textNode = walker.nextNode())) {
    const text = textNode.textContent || '';
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
  
  nodesToReplace.forEach(({ node, parent, hr }) => {
    parent.replaceChild(hr, node);
  });
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
