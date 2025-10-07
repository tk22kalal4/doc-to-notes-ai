import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: File;
  onPageCountChange: (count: number) => void;
}

export const PDFViewer = ({ file, onPageCountChange }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    onPageCountChange(numPages);
  };

  return (
    <Card className="overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-primary to-primary/90 p-4">
        <div className="flex items-center justify-between text-primary-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">
            Page {pageNumber} of {numPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
            disabled={pageNumber >= numPages}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex justify-center bg-muted p-6">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          className="shadow-md"
        >
          <Page pageNumber={pageNumber} width={600} />
        </Document>
      </div>
    </Card>
  );
};
