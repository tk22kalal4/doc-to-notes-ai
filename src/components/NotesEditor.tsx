import { useState } from 'react';
import { Download, Copy, Edit3, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { saveAs } from 'file-saver';

interface NotesEditorProps {
  content: string;
  onContentChange: (content: string) => void;
}

export const NotesEditor = ({ content, onContentChange }: NotesEditorProps) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const { toast } = useToast();

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    saveAs(blob, 'medical-notes.html');
    toast({
      title: 'Download Started',
      description: 'Your notes are being downloaded as an HTML file.'
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Copied!',
        description: 'Notes copied to clipboard.'
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy notes to clipboard.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="h-full shadow-lg">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Generated Notes</h3>
          <div className="flex gap-2">
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-copy-notes"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-download-notes"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'edit')} className="h-full">
        <div className="border-b px-4">
          <TabsList>
            <TabsTrigger value="preview" className="gap-2" data-testid="tab-preview">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-2" data-testid="tab-edit">
              <Edit3 className="h-4 w-4" />
              Edit
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" className="m-0 p-6">
          <div
            className="notes-preview"
            dangerouslySetInnerHTML={{ __html: content }}
            data-testid="notes-preview"
          />
        </TabsContent>

        <TabsContent value="edit" className="m-0 p-4">
          <Textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="min-h-[600px] font-mono text-sm"
            placeholder="Your generated notes will appear here..."
            data-testid="textarea-notes-editor"
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
};
