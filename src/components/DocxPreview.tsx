import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Button } from '@/components/ui/button';
import { Loader2, Edit3 } from 'lucide-react';

interface DocxPreviewProps {
  file: File;
  onConvertToEditable: () => void;
}

export const DocxPreview: React.FC<DocxPreviewProps> = ({ file, onConvertToEditable }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDocx = async () => {
      if (!containerRef.current || !file) return;

      setIsLoading(true);
      setError(null);

      try {
        // Clear previous content
        containerRef.current.innerHTML = '';

        const arrayBuffer = await file.arrayBuffer();

        await renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          debug: false,
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Error rendering DOCX:', err);
        setError('Failed to render DOCX file. The file may be corrupted or unsupported.');
        setIsLoading(false);
      }
    };

    renderDocx();
  }, [file]);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Convert button */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{file.name}</span>
          <span className="ml-2">• Exact Preview (Read-only)</span>
        </div>
        <Button 
          onClick={onConvertToEditable} 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <Edit3 className="h-4 w-4" />
          Convert to Editable
        </Button>
      </div>

      {/* DOCX Render Container */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading document...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-destructive">
              <p>{error}</p>
              <Button 
                onClick={onConvertToEditable} 
                variant="outline" 
                className="mt-4"
              >
                Try Convert to Editable Instead
              </Button>
            </div>
          </div>
        )}

        <div 
          ref={containerRef} 
          className="docx-container mx-auto"
          style={{ display: isLoading || error ? 'none' : 'block' }}
        />
      </div>
    </div>
  );
};
