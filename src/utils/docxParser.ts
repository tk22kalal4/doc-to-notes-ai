import mammoth from 'mammoth';

export const parseDocxFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    // The HTML returned by mammoth is already well-formed
    // We just need to ensure it's clean and ready for the editor
    let html = result.value;
    
    // Remove unnecessary wrapper divs if present
    html = html.replace(/<div class="document">(.*)<\/div>/s, '$1');
    
    return html;
  } catch (error) {
    console.error('Error parsing docx file:', error);
    throw new Error('Failed to parse the docx file. Please ensure it is a valid Word document.');
  }
};

export const isDocxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.docx');
};
