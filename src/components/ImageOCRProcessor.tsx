import { useState, useEffect } from 'react';
import { ScanText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { createWorker } from 'tesseract.js';

interface ImageOCRProcessorProps {
  pages: HTMLCanvasElement[];
  onOCRComplete: (texts: string[]) => void;
  onProgress?: (progress: number, currentPage: number) => void;
}

export const ImageOCRProcessor = ({ pages, onOCRComplete, onProgress }: ImageOCRProcessorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processOCR = async () => {
    setIsProcessing(true);
    setError(null);
    const extractedTexts: string[] = [];

    try {
      const worker = await createWorker('eng');

      for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        const progressValue = (pageNum / pages.length) * 100;
        setCurrentPage(pageNum);
        setProgress(progressValue);
        onProgress?.(progressValue, pageNum);

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          pages[i].toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to convert canvas to blob'));
          }, 'image/jpeg', 0.95);
        });

        // Perform OCR
        const { data: { text } } = await worker.recognize(blob);
        extractedTexts.push(text);
      }

      await worker.terminate();
      onOCRComplete(extractedTexts);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(err instanceof Error ? err.message : 'OCR processing failed');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (pages.length > 0) {
      processOCR();
    }
  }, []);

  return (
    <Card className="p-6 shadow-lg border-l-4 border-l-primary">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ScanText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">OCR Text Extraction</h3>
            <p className="text-sm text-muted-foreground">
              Extracting text from images
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Processing page {currentPage} of {pages.length}...
              </span>
              <span className="font-medium text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          onClick={processOCR}
          disabled={isProcessing || pages.length === 0}
          className="w-full gap-2"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ScanText className="h-5 w-5" />
              Start OCR Processing
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
