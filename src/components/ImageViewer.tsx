import { Card } from '@/components/ui/card';

interface ImageViewerProps {
  pages: HTMLCanvasElement[];
}

export const ImageViewer = ({ pages }: ImageViewerProps) => {
  return (
    <Card className="overflow-hidden shadow-lg h-full">
      <div className="overflow-y-auto h-full bg-muted/30" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        <div className="flex flex-col items-center gap-4 p-4">
          {pages.map((canvas, index) => (
            <div 
              key={index}
              className="mb-6 shadow-lg bg-white rounded-lg overflow-hidden max-w-[800px]"
            >
              <div className="bg-primary/10 px-4 py-2 text-sm font-medium text-primary border-b">
                Page {index + 1}
              </div>
              <div className="flex justify-center p-4">
                <img 
                  src={canvas.toDataURL('image/jpeg', 0.95)} 
                  alt={`Page ${index + 1}`}
                  className="max-w-full h-auto"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
