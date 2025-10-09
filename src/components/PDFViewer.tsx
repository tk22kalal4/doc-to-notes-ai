import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: File;
  onPageCountChange: (count: number) => void;
  pageRanges?: string;
}

export const PDFViewer = ({ file, onPageCountChange, pageRanges }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([1]));
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    onPageCountChange(numPages);
    // Initially load only the first page
    setLoadedPages(new Set([1]));
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

  // Lazy loading with Intersection Observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
            if (pageNum > 0) {
              setLoadedPages((prev) => new Set([...prev, pageNum]));
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '200px', // Load pages 200px before they come into view
        threshold: 0.01,
      }
    );

    // Observe all page placeholders
    pageRefs.current.forEach((element) => {
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [numPages, pageRanges]);

  const setPageRef = useCallback((pageNum: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(pageNum, element);
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    } else {
      pageRefs.current.delete(pageNum);
    }
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
            loading={
              <div className="flex flex-col items-center justify-center p-8">
                <Skeleton className="w-[600px] h-[800px]" />
                <p className="mt-4 text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center p-8 text-destructive">
                <p className="font-semibold">Failed to load PDF</p>
                <p className="text-sm mt-2">The file may be too large or corrupted.</p>
              </div>
            }
          >
            {pagesToRender.map((pageNum) => (
              <div 
                key={pageNum} 
                ref={(el) => setPageRef(pageNum, el)}
                data-page={pageNum}
                className="mb-6 shadow-lg bg-white rounded-lg overflow-hidden"
              >
                <div className="bg-primary/10 px-4 py-2 text-sm font-medium text-primary border-b">
                  Page {pageNum}
                </div>
                {loadedPages.has(pageNum) ? (
                  <Page 
                    pageNumber={pageNum} 
                    width={pageWidth || 600}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div className="flex items-center justify-center" style={{ height: '800px' }}>
                        <Skeleton className="w-full h-full" />
                      </div>
                    }
                  />
                ) : (
                  <div 
                    className="flex items-center justify-center bg-muted/20" 
                    style={{ height: '800px', width: pageWidth || 600 }}
                  >
                    <p className="text-sm text-muted-foreground">Scroll to load page {pageNum}</p>
                  </div>
                )}
              </div>
            ))}
          </Document>
        </div>
      </div>
    </Card>
  );
};
