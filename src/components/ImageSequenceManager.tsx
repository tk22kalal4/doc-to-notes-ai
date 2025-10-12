import { useState } from 'react';
import { X, GripVertical, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ImageItem {
  id: string;
  file: File;
  url: string;
}

interface ImageSequenceManagerProps {
  images: ImageItem[];
  onImagesChange: (images: ImageItem[]) => void;
  onAddMore: () => void;
}

export const ImageSequenceManager = ({ images, onImagesChange, onAddMore }: ImageSequenceManagerProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    onImagesChange(newImages);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleRemove = (id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">
          Image Sequence ({images.length} images)
        </h3>
        <Button size="sm" variant="outline" onClick={onAddMore} className="gap-2">
          <Upload className="h-4 w-4" />
          Add More
        </Button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {images.map((image, index) => (
          <div
            key={image.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 bg-muted/30 rounded-lg border-2 transition-all cursor-move hover:bg-muted/50 ${
              draggedIndex === index ? 'border-primary opacity-50' : 'border-transparent'
            }`}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
              {index + 1}
            </div>

            <img
              src={image.url}
              alt={`Image ${index + 1}`}
              className="w-16 h-16 object-cover rounded border flex-shrink-0"
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{image.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(image.file.size / 1024).toFixed(1)} KB
              </p>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemove(image.id)}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};
