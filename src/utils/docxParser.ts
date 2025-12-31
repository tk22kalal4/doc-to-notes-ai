import mammoth from 'mammoth';

export const parseDocxFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });

    let html = result.value;

    // Only fix horizontal lines, preserve everything else as-is
    html = processDocxHtml(html);

    return html;
  } catch (error) {
    console.error('Error parsing docx file:', error);
    throw new Error('Failed to parse the docx file. Please ensure it is a valid Word document.');
  }
};

/**
 * Process mammoth HTML output only to fix horizontal lines
 * Everything else is preserved exactly as mammoth converts it
 */
const processDocxHtml = (html: string): string => {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Only fix horizontal lines
  fixHorizontalLines(temp);

  return temp.innerHTML;
};

/**
 * Convert horizontal line text patterns to proper HR elements
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
    if (/^[─_\-═]{20,}$/.test(text.trim())) {
      const parent = textNode.parentElement;
      if (parent) {
        nodesToProcess.push({ node: textNode, parent });
      }
    }
  }

  nodesToProcess.forEach(({ node, parent }) => {
    const hr = document.createElement('hr');
    hr.setAttribute('data-hr-constraint', 'true');
    parent.replaceChild(hr, node);
  });
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
