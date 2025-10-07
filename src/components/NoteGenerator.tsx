import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface NoteGeneratorProps {
  ocrTexts: string[];
  onNotesGenerated: (notes: string) => void;
  onProgress?: (progress: number, currentPage: number) => void;
}

export const NoteGenerator = ({ ocrTexts, onNotesGenerated, onProgress }: NoteGeneratorProps) => {
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
        const page = i + 1;
        const progressValue = (page / ocrTexts.length) * 100;
        setCurrentPage(page);
        setProgress(progressValue);
        onProgress?.(progressValue, page);

        const systemPrompt = `You are an expert medical educator converting OCR text into beautifully structured HTML notes for medical students.

CRITICAL FORMATTING RULES - FOLLOW EXACTLY:

1. STRUCTURE WITH VISUAL SEPARATORS:
   - Start main topics with: <h1>emoji MainTopic</h1>
   - Add <hr> (horizontal rule) AFTER each h1
   - Subtopics: <h2>emoji Subtopic</h2>
   - Add <hr> AFTER each h2 section
   - Subsections: <h3>emoji Subsection</h3>
   - Add <hr> AFTER each h3 section when it ends
   
2. EMOJI USAGE:
   - H1 headings: Use ❤️, 🩺, 💊, 🧬, 🔬, 🏥 (medical emojis)
   - H2 headings: Use 🔹, 💪, 💨, 💓, 🩺 (relevant emojis)
   - Bullet Level 1: 🔹 or 📌
   - Bullet Level 2: 🔸 or 🧠
   - Bullet Level 3: ✨ or 💡

3. BULLET FORMATTING (CRITICAL):
   - Each bullet must be: <li>emoji <strong>Term:</strong> description</li>
   - Nested bullets must be inside proper <ul> tags
   - Add blank lines between major bullet groups
   - Keep bullets concise and clear
   
4. BOLD FORMATTING:
   - Wrap ALL key terms in <strong>Term</strong>
   - Medical terms, drug names, definitions = bold
   - Important concepts = bold

5. SPACING (VERY IMPORTANT):
   - <hr> after every major section
   - <br><br> between different topics
   - <br> between bullet groups
   - Generous white space for readability

EXAMPLE STRUCTURE:
<h1>❤️ Main Topic</h1>
<hr>
<h2>🔹 Subtopic Name</h2>
<p>Description with <strong>bold terms</strong>.</p>
<hr>
<h3>💪 Subsection</h3>
<ul>
  <li>🔹 <strong>Point 1:</strong> description
    <ul>
      <li>🔸 Detail 1</li>
      <li>🔸 Detail 2</li>
    </ul>
  </li>
</ul>
<hr>

${previousContext ? `CONTEXT FROM PREVIOUS PAGE:\n${previousContext}\n\nContinue seamlessly with same formatting style.` : ''}

Convert this OCR text into beautifully formatted medical notes with visual separators:`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
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

  useEffect(() => {
    generateNotes();
  }, []);

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
