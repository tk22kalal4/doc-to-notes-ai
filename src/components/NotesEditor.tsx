import { useState, useRef, useEffect } from 'react';
import { Download, Copy, Edit3, Eye, Sparkles, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import html2pdf from 'html2pdf.js';
import { Editor } from '@tinymce/tinymce-react';

interface NotesEditorProps {
  content: string;
  onContentChange: (content: string) => void;
}

export const NotesEditor = ({ content, onContentChange }: NotesEditorProps) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [isTouchingUp, setIsTouchingUp] = useState(false);
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { toast } = useToast();
  const editorRef = useRef<any>(null);
  const historyRef = useRef<{ history: string[]; index: number }>({ history: [], index: -1 });

  useEffect(() => {
    historyRef.current = { history: contentHistory, index: historyIndex };
  }, [contentHistory, historyIndex]);

  useEffect(() => {
    if (content && contentHistory.length === 0) {
      setContentHistory([content]);
      setHistoryIndex(0);
    }
  }, [content]);

  // TOUCHUP FUNCTIONALITY - Enhance and format existing notes
  const handleTouchup = async () => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY_X || import.meta.env.VITE_GROQ_API_KEY;
    
    if (!apiKey) {
      toast({
        title: 'API Key Missing',
        description: 'Please add VITE_GROQ_API_KEY_X in repo secrets or VITE_GROQ_API_KEY in .env for local dev.',
        variant: 'destructive'
      });
      return;
    }

    const currentContent = content;
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    const lastEntry = currentHistory[currentIndex];
    
    if (currentContent !== lastEntry) {
      const newHistory = currentHistory.slice(0, currentIndex + 1);
      newHistory.push(currentContent);
      const newIndex = newHistory.length - 1;
      setContentHistory(newHistory);
      setHistoryIndex(newIndex);
      historyRef.current = { history: newHistory, index: newIndex };
    }

    setIsTouchingUp(true);

    try {
      // NEW TOUCHUP PROMPT
      const touchupSystemPrompt = `You are an expert **medical content enhancer and formatter**. Your role is to transform raw or unstructured medical notes into **perfectly formatted, hierarchically organized, and visually clear HTML content**, while **preserving every medical detail and meaning**.

⚕️ **CORE OBJECTIVES**
- Preserve ALL medical accuracy: every drug name, dosage, symptom, diagnosis, sign, and mechanism.
- Maintain technical medical language — never oversimplify or alter meaning.
- Restructure and reformat content to enhance clarity, flow, and readability.
- Ensure professional tone suitable for MBBS-level or higher medical learning.

---

### 🩺 STRUCTURAL ENHANCEMENT
1. Create clear and logical **hierarchical headings**:
   - Use **<h1>** for main topics
   - Use **<h2>** for subtopics
   - Use **<h3>** for finer details or lists
2. **Combine or rearrange sections** when two headings represent the same or closely related topic.
3. Group related ideas together logically (e.g., etiology, symptoms, diagnosis, management).
4. Insert **<hr>** between major sections for visual clarity.
5. Ensure consistent spacing and indentation throughout.

---

### 💊 CONTENT OPTIMIZATION
1. Remove redundant or repetitive text while retaining **all unique information**.
2. Add smooth **transitions between related sections**.
3. Maintain or slightly improve **academic tone and logical flow**.
4. Correct minor inconsistencies or disorganized sequences.
5. Keep **medical hierarchy** intact: definition → causes → pathophysiology → clinical features → diagnosis → management → complications → prognosis.

---

### 🩸 FORMATTING REQUIREMENTS
1. Use these HTML tags:
   - **Headings:** <h1>, <h2>, <h3>, <h4>
   - **Text:** <p>, <strong>, <br>, <ul>, <li>, <hr>
2. Highlight important medical concepts, drugs, or keywords with **<strong>**.
3. Use **appropriate medical emojis** (🏥, 💊, ❤️, 🧠, 🫁, 🦴, 🩸, etc.) to visually enrich the content.
4. Maintain professional formatting with adequate spacing (<br>).
5. No markdown, no explanations — **return only the enhanced HTML output**.

---

### ✅ OUTPUT REQUIREMENT
Return **ONLY** the enhanced and formatted HTML content — clean, structured, and ready for web publishing.`;
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          // DIFFERENT MODEL FOR TOUCHUP
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: touchupSystemPrompt },
            { role: 'user', content: `Please enhance and format these medical notes while preserving all medical accuracy:\n\n${currentContent}` }
          ],
          temperature: 0.2, // Lower temperature for more consistent medical formatting
          max_tokens: 8192, // Higher token limit for comprehensive notes
          top_p: 0.9
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const touchedUpContent = data.choices[0]?.message?.content || currentContent;

      const { history: latestHistory, index: latestIndex } = historyRef.current;
      const finalHistory = latestHistory.slice(0, latestIndex + 1);
      finalHistory.push(touchedUpContent);
      const finalIndex = finalHistory.length - 1;
      setContentHistory(finalHistory);
      setHistoryIndex(finalIndex);
      historyRef.current = { history: finalHistory, index: finalIndex };

      onContentChange(touchedUpContent);
      
      toast({
        title: 'Touchup Complete!',
        description: 'Your notes have been professionally formatted and enhanced.',
      });
    } catch (error) {
      console.error('Touchup error:', error);
      toast({
        title: 'Touchup Failed',
        description: error instanceof Error ? error.message : 'Failed to touchup notes. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsTouchingUp(false);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onContentChange(contentHistory[newIndex]);
      toast({
        title: 'Undo Successful',
        description: 'Reverted to previous version.'
      });
    } else {
      toast({
        title: 'Nothing to Undo',
        description: 'No previous version available.',
        variant: 'destructive'
      });
    }
  };

  const handleRedo = () => {
    if (historyIndex < contentHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onContentChange(contentHistory[newIndex]);
      toast({
        title: 'Redo Successful',
        description: 'Restored next version.'
      });
    } else {
      toast({
        title: 'Nothing to Redo',
        description: 'No next version available.',
        variant: 'destructive'
      });
    }
  };

  const handleDownload = () => {
    const element = document.createElement('div');
    element.innerHTML = content;
    
    // Apply comprehensive styling to match the preview exactly
    const styles = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          line-height: 1.8;
          color: #1a1a1a;
          padding: 20px;
        }
        
        h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #0891b2;
          line-height: 1.3;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #9333ea;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #1a1a1a;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        h4 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #1a1a1a;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        ul {
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
          padding-left: 1.5rem;
          list-style-type: none;
        }
        
        ul ul {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          padding-left: 2rem;
        }
        
        ul ul ul {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
          padding-left: 2rem;
        }
        
        li {
          margin-bottom: 0.5rem;
          line-height: 1.8;
        }
        
        strong {
          font-weight: 600;
          color: #1a1a1a;
        }
        
        p {
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
          line-height: 1.8;
        }
        
        hr {
          margin-top: 1.5rem;
          margin-bottom: 1.5rem;
          border: 0;
          border-top: 2px solid #e5e7eb;
          opacity: 0.6;
        }
        
        br {
          display: block;
          content: "";
          margin-top: 0.5rem;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }
        
        table th,
        table td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem;
          text-align: left;
        }
        
        table th {
          background-color: #f3f4f6;
          font-weight: 600;
        }

        img {
          max-width: 100%;
          height: auto;
          margin: 1rem 0;
        }
      </style>
    `;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = styles + element.outerHTML;
    
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: 'medical-notes.pdf',
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(wrapper).save().then(() => {
      toast({
        title: 'Download Complete',
        description: 'Your notes have been downloaded as a PDF file.'
      });
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
          <h3 className="font-semibold text-foreground">Medical Notes</h3>
          <div className="flex gap-2">
            <Button
              onClick={handleTouchup}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isTouchingUp || !content}
              data-testid="button-touchup-notes"
            >
              <Sparkles className="h-4 w-4" />
              {isTouchingUp ? 'Touching up...' : 'Touchup'}
            </Button>
            <Button
              onClick={handleUndo}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={historyIndex <= 0}
              data-testid="button-undo-touchup"
            >
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
            <Button
              onClick={handleRedo}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={historyIndex >= contentHistory.length - 1}
              data-testid="button-redo-touchup"
            >
              <Redo2 className="h-4 w-4" />
              Redo
            </Button>
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
              Editor
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
          <div data-testid="rich-text-editor">
            <Editor
              apiKey={import.meta.env.VITE_TINY_API}
              onInit={(_evt, editor) => editorRef.current = editor}
              value={content}
              onEditorChange={onContentChange}
              init={{
                height: 600,
                menubar: true,
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | ' +
                  'bold italic forecolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'removeformat | image media table | help',
                content_style: 'body { font-family:Arial,sans-serif; font-size:14px }',
                placeholder: 'Your generated notes will appear here. Use the toolbar to format text, add images, and customize your notes...'
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
