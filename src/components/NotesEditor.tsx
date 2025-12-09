import React, { useState, useRef, useEffect } from 'react';
import { Download, Copy, Edit3, Eye, Sparkles, Undo2, Redo2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Editor } from '@tinymce/tinymce-react';
import { MCQGenerator } from '@/components/MCQGenerator';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

// Helper function to fetch image as ArrayBuffer
const fetchImageAsArrayBuffer = async (src: string): Promise<ArrayBuffer | null> => {
  try {
    if (src.startsWith('data:')) {
      // Handle base64 data URLs
      const base64Data = src.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } else {
      // Handle regular URLs
      const response = await fetch(src);
      return await response.arrayBuffer();
    }
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return null;
  }
};

// Helper to get image dimensions
const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: 400, height: 300 }); // Default dimensions
    };
    img.src = src;
  });
};

interface NotesEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  ocrTexts?: string[];
}

export const NotesEditor = ({ content, onContentChange, ocrTexts = [] }: NotesEditorProps) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [isTouchingUp, setIsTouchingUp] = useState(false);
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showMCQ, setShowMCQ] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('medical-notes');
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
      const touchupSystemPrompt = `You are an expert **medical content enhancer and formatter**. Your task is to transform raw or unstructured medical notes into **perfectly formatted, hierarchically organized, and visually rich HTML content**, while **preserving every medical detail and meaning**.

⚕️ **CORE OBJECTIVES**
- Preserve ALL medical accuracy: every drug name, dosage, symptom, diagnosis, sign, and mechanism.
- Maintain technical medical language — never oversimplify or alter meaning.
- Restructure and reformat content to enhance clarity, flow, and readability.
- Ensure professional tone suitable for MBBS-level or higher medical learning.
- Convert long sentences into two or more short, clear bullet points.


---

### 🏥 STRUCTURAL ENHANCEMENT
1. Create clear and logical **hierarchical headings**:
   - Use **<h1>** for main topics (e.g., Asthma, Myocardial Infarction)
   - Use **<h2>** for subtopics (e.g., Etiology, Pathophysiology)
   - Use **<h3>** for finer details (e.g., Symptoms, Diagnosis)
2. **Combine or rearrange sections** when two headings represent the same or closely related topic.
3. Group related ideas logically (e.g., etiology, symptoms, diagnosis, management).
4. Insert **<hr>** between major sections for visual clarity.
5. Ensure consistent spacing and indentation throughout.
6. **Convert long or complex sentences** into multiple concise bullet points for better readability.

---

### 💊 CONTENT OPTIMIZATION
1. Remove redundant or repetitive text while retaining **all unique medical information**.
2. Add smooth **transitions** between related sections.
3. Maintain or slightly improve **academic tone and logical flow**.
4. Correct minor inconsistencies or disorganized sequences.
5. Preserve medical hierarchy: **Definition → Causes → Pathophysiology → Clinical Features → Diagnosis → Management → Complications → Prognosis.**
6. When presenting multiple facts or subpoints, use a **three-level bullet system**.

7. **EMOJI USAGE:**
   - **H1 headings:** Use ❤️, 🩺, 💊, 🧬, 🔬, 🏥 (medical emojis)
   - **H2 headings:** Use 🔹, 💪, 💨, 💓, 🩺 (relevant emojis)
   - **Bullet Level 1:** 🔹 or 📌
   - **Bullet Level 2:** 🔸 or 🧠
   - **Bullet Level 3:** ✨ or 💡
   - **STEPS or NUMBERIC Bullet Points:** 1️⃣,2️⃣,3️⃣,....etc.
   

8. Combine **structural emoji hierarchy** with **automatic contextual emojis**:
   - Automatically select relevant emojis based on section keywords or topic meaning.  
     Example: 🧬 for "Etiology", 🤒 for "Symptoms", 💊 for "Treatment", ⚠️ for "Complications", etc.
   - Do not require a predefined list; the model should intelligently choose appropriate emojis.

---

### 🩸 FORMATTING REQUIREMENTS
1. Use these HTML tags only:
   - **Headings:** <h1>, <h2>, <h3>, <h4>
   - **Text:** <p>, <strong>, <br>, <ul>, <li>, <hr>
2. Highlight important medical concepts, drugs, and keywords with **<strong>**.
3. Automatically apply **relevant medical emojis** based on topic or keyword context.
4. Maintain professional formatting with proper spacing (<br>).
5. Ensure bullet hierarchy and emoji structure are visually clear and consistent.
6. No markdown or commentary — **return only the enhanced HTML output**.

---

### ✅ OUTPUT REQUIREMENT
Return **ONLY** the enhanced and formatted HTML content — clean, structured, and ready for web publishing. Include:
- Hierarchical headings with emojis.
- Three-level bullet structure.
- Automatically assigned contextual emojis.
- All medical accuracy preserved.
`;

      
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
          temperature: 0.5, // Lower temperature for more consistent medical formatting
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
    setShowDownloadDialog(true);
  };

  const parseHtmlToDocxElements = async (htmlContent: string): Promise<any[]> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements: any[] = [];

    const processNode = async (node: Node, depth: number = 0): Promise<any[]> => {
      const result: any[] = [];
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          result.push(new Paragraph({
            children: [new TextRun({ text, size: 24 })],
          }));
        }
        return result;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        const textContent = element.textContent?.trim() || '';

        switch (tagName) {
          case 'img': {
            const src = element.getAttribute('src');
            if (src) {
              const imageData = await fetchImageAsArrayBuffer(src);
              if (imageData) {
                // Get original dimensions
                const originalDimensions = await getImageDimensions(src);
                
                // Get inline styles for width/height if specified
                const styleWidth = element.getAttribute('width') || (element as HTMLElement).style?.width;
                const styleHeight = element.getAttribute('height') || (element as HTMLElement).style?.height;
                
                let width = originalDimensions.width;
                let height = originalDimensions.height;
                
                // Parse style dimensions
                if (styleWidth) {
                  const parsedWidth = parseInt(styleWidth.toString().replace('px', ''), 10);
                  if (!isNaN(parsedWidth)) width = parsedWidth;
                }
                if (styleHeight) {
                  const parsedHeight = parseInt(styleHeight.toString().replace('px', ''), 10);
                  if (!isNaN(parsedHeight)) height = parsedHeight;
                }
                
                // Scale down if too large (max 600px width for docx)
                const maxWidth = 600;
                if (width > maxWidth) {
                  const scale = maxWidth / width;
                  width = maxWidth;
                  height = Math.round(height * scale);
                }
                
                result.push(new Paragraph({
                  children: [
                    new ImageRun({
                      data: imageData,
                      transformation: {
                        width,
                        height,
                      },
                      type: 'png',
                    }),
                  ],
                  spacing: { before: 200, after: 200 },
                }));
              }
            }
            break;
          }
          case 'h1':
            result.push(new Paragraph({
              children: [new TextRun({ text: textContent, bold: true, size: 36, color: '0891b2' })],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }));
            break;
          case 'h2':
            result.push(new Paragraph({
              children: [new TextRun({ text: textContent, bold: true, size: 32, color: '9333ea' })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }));
            break;
          case 'h3':
            result.push(new Paragraph({
              children: [new TextRun({ text: textContent, bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            }));
            break;
          case 'h4':
            result.push(new Paragraph({
              children: [new TextRun({ text: textContent, bold: true, size: 26 })],
              heading: HeadingLevel.HEADING_4,
              spacing: { before: 150, after: 75 },
            }));
            break;
          case 'p': {
            const runs: any[] = [];
            for (const child of Array.from(element.childNodes)) {
              if (child.nodeType === Node.TEXT_NODE) {
                const t = child.textContent || '';
                if (t) runs.push(new TextRun({ text: t, size: 24 }));
              } else if (child.nodeType === Node.ELEMENT_NODE) {
                const el = child as Element;
                const elTag = el.tagName.toLowerCase();
                
                // Handle inline images
                if (elTag === 'img') {
                  const imgSrc = el.getAttribute('src');
                  if (imgSrc) {
                    const imgData = await fetchImageAsArrayBuffer(imgSrc);
                    if (imgData) {
                      const dims = await getImageDimensions(imgSrc);
                      let w = dims.width;
                      let h = dims.height;
                      
                      const sw = el.getAttribute('width') || (el as HTMLElement).style?.width;
                      const sh = el.getAttribute('height') || (el as HTMLElement).style?.height;
                      if (sw) {
                        const pw = parseInt(sw.toString().replace('px', ''), 10);
                        if (!isNaN(pw)) w = pw;
                      }
                      if (sh) {
                        const ph = parseInt(sh.toString().replace('px', ''), 10);
                        if (!isNaN(ph)) h = ph;
                      }
                      
                      const maxW = 600;
                      if (w > maxW) {
                        const sc = maxW / w;
                        w = maxW;
                        h = Math.round(h * sc);
                      }
                      
                      runs.push(new ImageRun({
                        data: imgData,
                        transformation: { width: w, height: h },
                        type: 'png',
                      }));
                    }
                  }
                } else {
                  const ct = el.textContent || '';
                  if (elTag === 'strong' || elTag === 'b') {
                    runs.push(new TextRun({ text: ct, bold: true, size: 24 }));
                  } else if (elTag === 'em' || elTag === 'i') {
                    runs.push(new TextRun({ text: ct, italics: true, size: 24 }));
                  } else {
                    runs.push(new TextRun({ text: ct, size: 24 }));
                  }
                }
              }
            }
            if (runs.length > 0) {
              result.push(new Paragraph({
                children: runs,
                spacing: { before: 100, after: 100 },
              }));
            }
            break;
          }
          case 'ul':
          case 'ol':
            for (const [idx, li] of Array.from(element.querySelectorAll(':scope > li')).entries()) {
              const bulletText = tagName === 'ol' ? `${idx + 1}. ` : '• ';
              const liRuns: any[] = [];
              const indent = depth * 720;
              
              for (const child of Array.from(li.childNodes)) {
                if (child.nodeType === Node.TEXT_NODE) {
                  const t = child.textContent?.trim() || '';
                  if (t) liRuns.push(new TextRun({ text: t, size: 24 }));
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                  const el = child as Element;
                  const elTag = el.tagName.toLowerCase();
                  if (elTag === 'ul' || elTag === 'ol') {
                    continue;
                  }
                  if (elTag === 'img') {
                    const imgSrc = el.getAttribute('src');
                    if (imgSrc) {
                      const imgData = await fetchImageAsArrayBuffer(imgSrc);
                      if (imgData) {
                        const dims = await getImageDimensions(imgSrc);
                        let w = dims.width;
                        let h = dims.height;
                        const maxW = 500;
                        if (w > maxW) {
                          const sc = maxW / w;
                          w = maxW;
                          h = Math.round(h * sc);
                        }
                        liRuns.push(new ImageRun({
                          data: imgData,
                          transformation: { width: w, height: h },
                          type: 'png',
                        }));
                      }
                    }
                  } else {
                    const ct = el.textContent || '';
                    if (elTag === 'strong' || elTag === 'b') {
                      liRuns.push(new TextRun({ text: ct, bold: true, size: 24 }));
                    } else {
                      liRuns.push(new TextRun({ text: ct, size: 24 }));
                    }
                  }
                }
              }
              
              if (liRuns.length > 0) {
                result.push(new Paragraph({
                  children: [new TextRun({ text: bulletText, size: 24 }), ...liRuns],
                  indent: { left: indent + 360 },
                  spacing: { before: 50, after: 50 },
                }));
              }

              for (const nestedList of Array.from(li.querySelectorAll(':scope > ul, :scope > ol'))) {
                result.push(...await processNode(nestedList, depth + 1));
              }
            }
            break;
          case 'hr':
            result.push(new Paragraph({
              children: [new TextRun({ text: '─'.repeat(50), size: 24, color: 'cccccc' })],
              spacing: { before: 200, after: 200 },
              alignment: AlignmentType.CENTER,
            }));
            break;
          case 'br':
            result.push(new Paragraph({ children: [] }));
            break;
          default:
            for (const child of Array.from(element.childNodes)) {
              result.push(...await processNode(child, depth));
            }
        }
      }

      return result;
    };

    for (const child of Array.from(doc.body.childNodes)) {
      elements.push(...await processNode(child));
    }

    return elements;
  };

  const downloadAsDocx = async () => {
    try {
      const docElements = await parseHtmlToDocxElements(content);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: docElements as any,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = downloadFilename.trim() || 'medical-notes';
      saveAs(blob, `${filename}.docx`);
      
      setShowDownloadDialog(false);
      setDownloadFilename('medical-notes');
      
      toast({
        title: 'Download Complete',
        description: 'Your notes have been downloaded as an editable Word document.',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to create the document. Please try again.',
        variant: 'destructive',
      });
    }
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

  if (showMCQ) {
    return <MCQGenerator ocrTexts={ocrTexts} onClose={() => setShowMCQ(false)} />;
  }

  return (
    <>
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Download Notes</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filename">File Name</Label>
              <Input
                id="filename"
                value={downloadFilename}
                onChange={(e) => setDownloadFilename(e.target.value)}
                placeholder="Enter file name"
                data-testid="input-download-filename"
              />
              <p className="text-sm text-muted-foreground">
                The file will be saved as: {downloadFilename || 'medical-notes'}.docx
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)} data-testid="button-cancel-download">
              Cancel
            </Button>
            <Button onClick={downloadAsDocx} data-testid="button-confirm-download">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="h-full shadow-lg">
        <div className="border-b p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-foreground shrink-0">Medical Notes</h3>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Button
                onClick={handleTouchup}
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                disabled={isTouchingUp || !content}
                data-testid="button-touchup-notes"
              >
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{isTouchingUp ? 'Touching up...' : 'Touchup'}</span>
                <span className="xs:hidden">{isTouchingUp ? '...' : 'Touch'}</span>
              </Button>
              <Button
                onClick={() => setShowMCQ(true)}
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                disabled={!ocrTexts || ocrTexts.length === 0}
                data-testid="button-generate-mcqs"
              >
                <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Generate MCQs</span>
                <span className="sm:hidden">MCQs</span>
              </Button>
              <Button
                onClick={handleUndo}
                variant="outline"
                size="sm"
                className="gap-1 text-xs sm:text-sm px-2 sm:px-3"
                disabled={historyIndex <= 0}
                data-testid="button-undo-touchup"
              >
                <Undo2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Undo</span>
              </Button>
              <Button
                onClick={handleRedo}
                variant="outline"
                size="sm"
                className="gap-1 text-xs sm:text-sm px-2 sm:px-3"
                disabled={historyIndex >= contentHistory.length - 1}
                data-testid="button-redo-touchup"
              >
                <Redo2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Redo</span>
              </Button>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="gap-1 text-xs sm:text-sm px-2 sm:px-3"
                data-testid="button-copy-notes"
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="gap-1 text-xs sm:text-sm px-2 sm:px-3"
                data-testid="button-download-notes"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Download</span>
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
                content_style: `
                  body { 
                    font-family: Arial, sans-serif; 
                    font-size: 14px;
                    line-height: 1.6;
                  } 
                  img { 
                    max-width: 100%; 
                    height: auto;
                    display: block;
                    margin: 10px 0;
                    cursor: pointer;
                  }
                  img:hover {
                    opacity: 0.9;
                    outline: 2px solid #0891b2;
                  }
                `,
                placeholder: 'Your generated notes will appear here. Use the toolbar to format text, add images, and customize your notes...',
                
                // Image settings
                image_advtab: true,
                image_title: true,
                image_description: true,
                image_dimensions: true,
                image_uploadtab: true,
                
                // Enable image resizing in editor
                object_resizing: true,
                resize_img_proportional: true,
                
                // Enable paste images
                paste_data_images: true,
                
                // Auto upload settings
                automatic_uploads: true,
                file_picker_types: 'image',
                images_reuse_filename: true,
                
                // Convert all images to base64
                images_upload_handler: (blobInfo: any) => {
                  return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      if (typeof reader.result === 'string') {
                        resolve(reader.result);
                      } else {
                        reject('Failed to convert image to base64');
                      }
                    };
                    reader.onerror = () => reject('Failed to read image file');
                    reader.readAsDataURL(blobInfo.blob());
                  });
                },
                
                // File picker for gallery selection
                file_picker_callback: (callback: any, _value: any, meta: any) => {
                  if (meta.filetype === 'image') {
                    const input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('accept', 'image/*');
                    input.onchange = function(this: HTMLInputElement) {
                      const file = this.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            callback(reader.result, { 
                              alt: file.name,
                              title: file.name
                            });
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }
                },
                
                // Ensure base64 images are properly handled
                convert_urls: false,
                relative_urls: false,
                remove_script_host: false
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
      </Card>
    </>
  );
};
