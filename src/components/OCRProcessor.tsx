import { useState } from 'react';
import { Scan, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Tesseract from 'tesseract.js';

interface OCRProcessorProps {
  file: File;
  pageRanges: string;
  onOCRComplete: (text: string[]) => void;
}

export const OCRProcessor = ({ file, pageRanges, onOCRComplete }: OCRProcessorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const parsePageRanges = (ranges: string): number[] => {
    const pages: number[] = [];
    const parts = ranges.split(',').map(p => p.trim());
    
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
      } else {
        pages.push(Number(part));
      }
    });
    
    return pages.sort((a, b) => a - b);
  };

  const processOCR = async () => {
    setIsProcessing(true);
    const pages = parsePageRanges(pageRanges);
    const extractedTexts: string[] = [];

    try {
      const pdfjs = await import('pdfjs-dist');
      
      // Configure PDF.js worker
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      for (let i = 0; i < pages.length; i++) {
        const pageNum = pages[i];
        setCurrentPage(pageNum);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        
        const imageData = canvas.toDataURL('image/png');
        
        const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pageProgress = (i / pages.length) * 100;
              const ocrProgress = m.progress * (100 / pages.length);
              setProgress(pageProgress + ocrProgress);
            }
          }
        });
        
        extractedTexts.push(text);
      }

      onOCRComplete(extractedTexts);
    } catch (error) {
      console.error('OCR Error:', error);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <Card className="p-6 shadow-lg border-l-4 border-l-primary">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Scan className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">OCR Processing</h3>
            <p className="text-sm text-muted-foreground">
              Extract text from selected pages
            </p>
          </div>
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processing page {currentPage}...</span>
              <span className="font-medium text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          onClick={processOCR}
          disabled={isProcessing}
          className="w-full gap-2"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing OCR...
            </>
          ) : (
            <>
              <Scan className="h-5 w-5" />
              Start OCR
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
