import { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
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
  const editorRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.getContent();
      navigator.clipboard.writeText(htmlContent);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Notes copied to clipboard'
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.getContent();
      const blob = new Blob([htmlContent], { type: 'text/html' });
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
    }
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
      <div className="p-4">
        <Editor
          apiKey="cg09wsf15duw9av3kj5g8d8fvsxvv3uver3a95xyfm1ngtq4"
          onInit={(evt, editor) => (editorRef.current = editor)}
          value={content}
          onEditorChange={onContentChange}
          init={{
            height: 600,
            menubar: true,
            plugins: [
              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
              'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | blocks | ' +
              'bold italic forecolor | alignleft aligncenter ' +
              'alignright alignjustify | bullist numlist outdent indent | ' +
              'removeformat | help',
            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
          }}
        />
      </div>
    </Card>
  );
};
