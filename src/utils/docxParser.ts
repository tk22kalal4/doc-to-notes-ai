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
    
    // Reconstruct nested bullet lists from flat structure (preserve inline styles when present)
    reconstructNestedLists(temp);
    
    // Process each element to apply styling (but preserve original left spacing / margin-left if present)
    processElementsForStyling(temp);
    
    // Get the processed HTML
    html = temp.innerHTML;
    
    return html;
  } catch (error) {
    console.error('Error parsing docx file:', error);
    throw new Error('Failed to parse the docx file. Please ensure it is a valid Word document.');
  }
};

/**
 * Helper: parse numeric value from CSS length string (e.g. "36pt", "24px", "1.5rem")
 * Returns pixels (approx) for pt and px; returns null if not parsable.
 */
const parseCssLengthToPx = (raw: string | null): number | null => {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const pxMatch = s.match(/^([\d.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const ptMatch = s.match(/^([\d.]+)pt$/);
  if (ptMatch) return parseFloat(ptMatch[1]) * 1.333333; // 1pt ≈ 1.3333px
  const remMatch = s.match(/^([\d.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * 16; // assume 1rem = 16px
  const emMatch = s.match(/^([\d.]+)em$/);
  if (emMatch) return parseFloat(emMatch[1]) * 16;
  const percentMatch = s.match(/^([\d.]+)%$/);
  if (percentMatch) return null; // percent-based left indent not handled here
  return null;
};

const reconstructNestedLists = (container: HTMLElement) => {
  // Find all ul/ol lists in the document
  const lists = Array.from(container.querySelectorAll('ul, ol'));
  
  lists.forEach((list) => {
    const listEl = list as HTMLElement;
    const items = Array.from(listEl.querySelectorAll(':scope > li')) as HTMLElement[];
    
    if (items.length === 0) return;
    
    // Collect metadata for each li: preserve original inline style and attempt to detect indent amount
    const itemsWithMetadata: Array<{ 
      el: HTMLElement; 
      indentAmountPx: number | null; // actual left indentation in px if available
      markerHintLevel: number; // fallback numeric hint for nesting (0,1,2) when styles not present
    }> = [];
    
    items.forEach((li) => {
      // Try to read explicit inline style values that indicate indentation
      // e.g. li.getAttribute('style') might contain "margin-left:36pt" or "padding-left:0pt"
      let indentPx: number | null = null;
      const styleAttr = li.getAttribute('style') || '';
      
      // search for margin-left or padding-left in style attribute
      const marginMatch = styleAttr.match(/margin-left\s*:\s*([^;]+)/i);
      const paddingMatch = styleAttr.match(/padding-left\s*:\s*([^;]+)/i);
      if (marginMatch) indentPx = parseCssLengthToPx(marginMatch[1].trim());
      if (indentPx === null && paddingMatch) indentPx = parseCssLengthToPx(paddingMatch[1].trim());
      
      // Fallback: detect emoji markers used previously (keep backward compatibility)
      const text = (li.textContent || '').trim();
      let markerHint = 0;
      if (text.startsWith('🧠')) markerHint = 1;
      // if you had other markers for deeper levels, add here
      
      itemsWithMetadata.push({ el: li, indentAmountPx: indentPx, markerHintLevel: markerHint });
    });
    
    // If none of the items have explicit indent pixels, we still reconstruct using markerHintLevel (legacy)
    // Otherwise, we will reconstruct but preserve inline left spacing by copying the style attribute values.
    if (itemsWithMetadata.length > 0) {
      const newList = document.createElement(listEl.tagName.toLowerCase() === 'ol' ? 'ol' : 'ul') as HTMLUListElement;
      // Preserve the original list's inline style if present (this keeps margin-left/padding-left set by mammoth)
      if (listEl.getAttribute('style')) {
        newList.setAttribute('style', listEl.getAttribute('style') || '');
      }
      newList.className = listEl.className || '';
      
      // We'll build nested lists but keep each LI's original inline style (so left spacing stays as in Word)
      let currentLevel = 0;
      let currentList: HTMLElement = newList;
      const listStack: HTMLElement[] = [newList];
      
      itemsWithMetadata.forEach((item) => {
        const { el, indentAmountPx, markerHintLevel } = item;
        
        // determine logical indent level:
        // if we have a measured indent in px, convert to a simple level by thresholds:
        // (these thresholds are only to decide when to create deeper nested UL/OL containers;
        //  the actual left spacing is preserved on the LI via inline styles)
        let indentLevel = 0;
        if (indentAmountPx !== null) {
          if (indentAmountPx < 20) indentLevel = 0;
          else if (indentAmountPx < 40) indentLevel = 1;
          else indentLevel = 2;
        } else {
          indentLevel = markerHintLevel || 0;
        }
        
        if (indentLevel > currentLevel) {
          // Create nested list(s)
          for (let i = currentLevel; i < indentLevel; i++) {
            const newNestedList = document.createElement('ul') as HTMLUListElement;
            // do NOT force default margins here — preserve any styles that may be on the original list items
            const lastItem = currentList.lastElementChild as HTMLElement;
            
            if (lastItem) {
              lastItem.appendChild(newNestedList);
            } else {
              // if there's no last item to attach a nested list to, append a placeholder li
              const placeholderLi = document.createElement('li');
              placeholderLi.innerHTML = '&nbsp;';
              currentList.appendChild(placeholderLi);
              placeholderLi.appendChild(newNestedList);
            }
            
            currentList = newNestedList as HTMLElement;
            listStack.push(currentList);
          }
          currentLevel = indentLevel;
        } else if (indentLevel < currentLevel) {
          // Pop up the stack
          const levelDiff = currentLevel - indentLevel;
          for (let i = 0; i < levelDiff; i++) {
            listStack.pop();
          }
          currentList = listStack[listStack.length - 1];
          currentLevel = indentLevel;
        }
        
        // Clone and append the original LI, preserving its inline styles and children
        const clonedEl = el.cloneNode(true) as HTMLElement;
        // If LI did not have an explicit left spacing but the original list had one, keep it on the LI level.
        // (We copy inline style attributes; if there is no inline style the original visual spacing will remain)
        currentList.appendChild(clonedEl);
      });
      
      // Replace original list with reconstructed list
      listEl.parentElement?.replaceChild(newList, listEl);
    }
  });
};

const processElementsForStyling = (container: HTMLElement) => {
  const elements = container.querySelectorAll('*');
  
  elements.forEach((element: Element) => {
    const el = element as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    
    // Apply heading colors and spacing but don't touch list left spacing here.
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
      // preserve left spacing on LIs when possible; only add safe display styling
      el.style.marginBottom = '0.5rem';
      el.style.lineHeight = '1.8';
      el.style.maxWidth = '100%';
      el.style.wordWrap = 'break-word';
      el.style.overflowWrap = 'break-word';
      // Do NOT override margin-left / padding-left here if an inline style is present from mammoth/docx
      // (leave any left spacing as-is to keep Word's indentation)
    }
  });
  
  // Apply list general safety styling but do NOT overwrite list margins or list-style types
  const allLists = container.querySelectorAll('ul, ol');
  
  allLists.forEach((list) => {
    const listEl = list as HTMLElement;
    
    // Keep any inline margin-left / padding-left that was produced by mammoth.
    // Only set fallback values when no left spacing exists.
    const styleAttr = listEl.getAttribute('style') || '';
    const hasLeftSpacingInAttr = /margin-left\s*:|padding-left\s*:/i.test(styleAttr);
    
    // Keep default bullets/numbering and do not force-hide nested bullets. That preserves Word appearance.
    listEl.style.marginRight = '0';
    listEl.style.paddingLeft = listEl.style.paddingLeft || '';
    listEl.style.maxWidth = '100%';
    listEl.style.overflowWrap = 'break-word';
    
    if (!hasLeftSpacingInAttr) {
      // fallback defaults only if there is absolutely no left spacing info
      // Use a conservative default that still shows nesting visually
      // Do not forcibly equalize the spacing for top/second/third levels
      // (leaving deeper control to inline styles produced by mammoth)
      listEl.style.marginLeft = listEl.style.marginLeft || '1.25rem';
      listEl.style.marginTop = '0.5rem';
      listEl.style.marginBottom = '0.5rem';
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
