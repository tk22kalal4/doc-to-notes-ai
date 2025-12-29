import mammoth from 'mammoth';

export const parseDocxFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Convert DOCX to HTML using mammoth
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    // Post-process to add proper indentation styles based on list nesting
    const processedHtml = addIndentationStyles(result.value);
    
    return processedHtml;
  } catch (error) {
    console.error('Error parsing docx file:', error);
    throw new Error('Failed to parse the docx file. Please ensure it is a valid Word document.');
  }
};

// Add proper indentation to HTML elements based on hierarchy
const addIndentationStyles = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Process all list items to add proper indentation
  const processLists = (element: Element, depth: number = 0) => {
    const lists = element.querySelectorAll(':scope > ul, :scope > ol');
    
    lists.forEach(list => {
      const items = list.querySelectorAll(':scope > li');
      items.forEach(li => {
        // Add margin-left based on depth
        const marginLeft = depth * 24; // 24px per level (matches 0.5 inch in DOCX)
        if (marginLeft > 0) {
          (li as HTMLElement).style.marginLeft = `${marginLeft}px`;
        }
        
        // Process nested lists with increased depth
        const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
        nestedLists.forEach(nestedList => {
          processLists(nestedList.parentElement!, depth + 1);
        });
      });
    });
  };
  
  // Process headings to add proper styles (h2 should have left margin)
  const h2Elements = doc.querySelectorAll('h2');
  h2Elements.forEach(h2 => {
    (h2 as HTMLElement).style.marginLeft = '8px';
    (h2 as HTMLElement).style.color = '#9333ea';
  });
  
  const h1Elements = doc.querySelectorAll('h1');
  h1Elements.forEach(h1 => {
    (h1 as HTMLElement).style.color = '#0891b2';
  });
  
  // Process bullet lists - first level under h2 should be indented
  const allLists = doc.querySelectorAll('ul, ol');
  allLists.forEach((list, listIndex) => {
    // Check if this list is a top-level list (not nested)
    const parentList = list.parentElement?.closest('ul, ol');
    
    if (!parentList) {
      // This is a top-level list
      const items = list.querySelectorAll(':scope > li');
      items.forEach(li => {
        // First level bullet points - add left margin
        (li as HTMLElement).style.marginLeft = '24px';
        (li as HTMLElement).style.paddingLeft = '8px';
        
        // Check for nested lists inside this li
        const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
        nestedLists.forEach(nestedList => {
          const nestedItems = nestedList.querySelectorAll(':scope > li');
          nestedItems.forEach(nestedLi => {
            // Second level - more indentation
            (nestedLi as HTMLElement).style.marginLeft = '24px';
            (nestedLi as HTMLElement).style.paddingLeft = '8px';
            
            // Check for 3rd level
            const thirdLevelLists = nestedLi.querySelectorAll(':scope > ul, :scope > ol');
            thirdLevelLists.forEach(thirdList => {
              const thirdItems = thirdList.querySelectorAll(':scope > li');
              thirdItems.forEach(thirdLi => {
                (thirdLi as HTMLElement).style.marginLeft = '24px';
                (thirdLi as HTMLElement).style.paddingLeft = '8px';
              });
            });
          });
        });
      });
    }
  });
  
  return doc.body.innerHTML;
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
