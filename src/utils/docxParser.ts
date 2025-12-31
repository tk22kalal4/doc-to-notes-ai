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
    // Match lines with dashes/underscores (20+ characters)
    if (/^[─_\-═]{20,}$/.test(text.trim())) {
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
      margin: 4px auto !important;
      padding: 0 !important;
      border: none !important;
      border-top: 1px solid #cccccc !important;
      width: 95% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      line-height: 0 !important;
      display: block !important;
    `;
    hr.setAttribute('data-hr-constraint', 'true');
    // Wrap in a container to ensure proper constraint
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      width: 100%;
      overflow: hidden;
      display: flex;
      justify-content: center;
      margin: 0 !important;
      padding: 0 !important;
    `;
    wrapper.appendChild(hr);
    parent.replaceChild(wrapper, node);
  });
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
