import { useState, useEffect } from 'react';
import { Scan, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Tesseract from 'tesseract.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

interface OCRProcessorProps {
  file: File;
  pageRanges: string;
  onOCRComplete: (text: string[]) => void;
  onProgress?: (progress: number, currentPage: number) => void;
}

export const OCRProcessor = ({ file, pageRanges, onOCRComplete, onProgress }: OCRProcessorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
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
    setError(null);
    const pages = parsePageRanges(pageRanges);
    const extractedTexts: string[] = [];

    try {
      console.log('[OCR] Starting OCR', { pages, fileName: file.name, fileSize: file.size });
      // Ensure worker is set at runtime as well
      GlobalWorkerOptions.workerSrc = pdfWorker;

      const arrayBuffer = await file.arrayBuffer();
      console.log('[OCR] PDF arrayBuffer length', arrayBuffer.byteLength);

      const loadingTask = getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      console.log('[OCR] PDF loaded with pages', pdf.numPages);

      for (let i = 0; i < pages.length; i++) {
        const pageNum = pages[i];
        setCurrentPage(pageNum);
        onProgress?.(((i / pages.length) * 100), pageNum);
        console.log(`[OCR] Rendering page ${pageNum}`);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas context not available');
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        console.log(`[OCR] Page ${pageNum} rendered to canvas ${canvas.width}x${canvas.height}`);
        
        const imageData = canvas.toDataURL('image/png');
        
        const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pageProgress = (i / pages.length) * 100;
              const ocrProgress = m.progress * (100 / pages.length);
              const totalProgress = pageProgress + ocrProgress;
              setProgress(totalProgress);
              onProgress?.(totalProgress, pageNum);
            }
          }
        });
        
        console.log(`[OCR] Page ${pageNum} OCR length:`, text.length);
        extractedTexts.push(text);

        // Cleanup canvas
        canvas.width = 0;
        canvas.height = 0;
      }

      onOCRComplete(extractedTexts);
      console.log('[OCR] Completed successfully');
      toast({ title: 'OCR complete', description: `Processed ${extractedTexts.length} page(s).` });
    } catch (error) {
      console.error('OCR Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'OCR failed',
        description: message,
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    processOCR();
  }, []);

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

        {error && (
          <Alert variant="destructive">
            <AlertTitle>OCR error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
