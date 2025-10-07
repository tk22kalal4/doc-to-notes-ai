import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface NoteGeneratorProps {
  ocrTexts: string[];
  onNotesGenerated: (notes: string) => void;
}

export const NoteGenerator = ({ ocrTexts, onNotesGenerated }: NoteGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const { toast } = useToast();

  const generateNotes = async () => {
    setIsGenerating(true);
    let allNotes = '';
    let previousContext = '';

    try {
      for (let i = 0; i < ocrTexts.length; i++) {
        setCurrentPage(i + 1);
        setProgress(((i + 1) / ocrTexts.length) * 100);

        const systemPrompt = `You are an expert medical educator converting OCR text into structured, beautiful HTML notes for medical students.

CRITICAL FORMATTING RULES:
- Use HTML tags: <h1>, <h2>, <h3>, <ul>, <li>
- Three-level bullet hierarchy with emojis:
  * Level 1: 🔹 or 📌
  * Level 2: 🔸 or 🧠
  * Level 3: ✳️ or 💡
- Use <strong> for key terms and definitions
- Short, clear sentences
- Line breaks between sections
- Clean indentation
- Convert tables to readable bullets
- Professional, student-friendly style

${previousContext ? `CONTEXT FROM PREVIOUS PAGE:\n${previousContext}\n\nContinue the formatting and style seamlessly. Do not restart numbering or structure unless contextually needed.` : ''}

Convert this OCR text into beautiful medical notes:`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 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'
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: ocrTexts[i] }
            ],
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate notes');
        }

        const data = await response.json();
        const pageNotes = data.choices[0].message.content;
        
        allNotes += pageNotes + '\n\n';
        previousContext = pageNotes.slice(-500);

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      onNotesGenerated(allNotes);
      toast({
        title: 'Notes Generated!',
        description: `Successfully generated notes from ${ocrTexts.length} pages.`
      });
    } catch (error) {
      console.error('Note generation error:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate notes. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <Card className="p-6 shadow-lg border-l-4 border-l-accent">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Note Generation</h3>
            <p className="text-sm text-muted-foreground">
              Convert OCR text to formatted notes
            </p>
          </div>
        </div>

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Generating page {currentPage} of {ocrTexts.length}...
              </span>
              <span className="font-medium text-accent">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          onClick={generateNotes}
          disabled={isGenerating || ocrTexts.length === 0}
          className="w-full gap-2"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Notes...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate Notes with AI
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
