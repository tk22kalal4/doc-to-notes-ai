import { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
}

export const PDFUploader = ({ onFileSelect }: PDFUploaderProps) => {
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <Card 
      className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 hover:border-primary/50 transition-all duration-300"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="p-12 text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
          <Upload className="h-10 w-10 text-primary-foreground" />
        </div>
        <h3 className="mb-2 text-2xl font-bold text-foreground">Upload Medical PDF</h3>
        <p className="mb-6 text-muted-foreground">
          Drag & drop your PDF file here, or click to browse
        </p>
        <label htmlFor="pdf-upload">
          <Button variant="default" size="lg" className="gap-2" asChild>
            <span>
              <FileText className="h-5 w-5" />
              Choose PDF File
            </span>
          </Button>
        </label>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>
    </Card>
  );
};
