import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card } from '@/components/ui/card';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: File;
  onPageCountChange: (count: number) => void;
  pageRanges?: string;
}

export const PDFViewer = ({ file, onPageCountChange, pageRanges }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(0);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    onPageCountChange(numPages);
  };

  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById('pdf-container');
      if (container) {
        setPageWidth(Math.min(container.offsetWidth - 32, 800));
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const getPageNumbers = (): number[] => {
    if (!pageRanges) {
      return Array.from({ length: numPages }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    const ranges = pageRanges.split(',').map(r => r.trim());
    
    ranges.forEach(range => {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(n => parseInt(n.trim()));
        for (let i = start; i <= end && i <= numPages; i++) {
          if (!pages.includes(i)) pages.push(i);
        }
      } else {
        const page = parseInt(range);
        if (page > 0 && page <= numPages && !pages.includes(page)) {
          pages.push(page);
        }
      }
    });
    
    return pages.sort((a, b) => a - b);
  };

  const pagesToRender = getPageNumbers();

  return (
    <Card id="pdf-container" className="overflow-hidden shadow-lg h-full">
      <div className="overflow-y-auto h-full bg-muted/30" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        <div className="flex flex-col items-center gap-4 p-4">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
          >
            {pagesToRender.map((pageNum) => (
              <div key={pageNum} className="mb-6 shadow-lg bg-white rounded-lg overflow-hidden">
                <div className="bg-primary/10 px-4 py-2 text-sm font-medium text-primary border-b">
                  Page {pageNum}
                </div>
                <Page 
                  pageNumber={pageNum} 
                  width={pageWidth || 600}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </Card>
  );
};
