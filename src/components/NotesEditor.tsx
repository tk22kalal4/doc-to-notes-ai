import { Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotesEditorProps {
  content: string;
  onContentChange: (content: string) => void;
}

export const NotesEditor = ({ content, onContentChange }: NotesEditorProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Notes copied to clipboard'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Medical Notes</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.8;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #2563eb; margin-top: 30px; margin-bottom: 15px; }
    h2 { color: #3b82f6; margin-top: 25px; margin-bottom: 12px; }
    h3 { color: #60a5fa; margin-top: 20px; margin-bottom: 10px; }
    ul { margin-left: 20px; margin-bottom: 15px; }
    li { margin-bottom: 8px; }
    strong { color: #1e40af; font-weight: 600; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medical-notes.html';
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Downloaded!',
      description: 'Notes saved as HTML file'
    });
  };

  return (
    <Card className="overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-primary to-primary/90 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary-foreground">
            Medical Notes Editor
          </h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div 
        className="p-6 prose prose-blue max-w-none overflow-y-auto"
        style={{ 
          height: '600px',
          lineHeight: '1.8'
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </Card>
  );
};
