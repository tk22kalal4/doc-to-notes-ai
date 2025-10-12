import { useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ImageUploaderProps {
  onImagesSelect: (files: File[]) => void;
  hasImages?: boolean;
}

export const ImageUploader = ({ onImagesSelect, hasImages = false }: ImageUploaderProps) => {
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    if (files.length > 0) {
      onImagesSelect(files);
    }
  }, [onImagesSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImagesSelect(Array.from(files));
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
        <h3 className="mb-2 text-2xl font-bold text-foreground">
          {hasImages ? 'Add More Images' : 'Upload Medical Images'}
        </h3>
        <p className="mb-6 text-muted-foreground">
          Drag & drop your images here, or click to browse
        </p>
        <label htmlFor="image-upload">
          <Button variant="default" size="lg" className="gap-2" asChild>
            <span>
              <ImageIcon className="h-5 w-5" />
              {hasImages ? 'Add More Images' : 'Choose Images'}
            </span>
          </Button>
        </label>
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>
    </Card>
  );
};
