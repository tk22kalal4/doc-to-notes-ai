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

CRITICAL FORMATTING RULES - FOLLOW EXACTLY:

1. STRUCTURE & HIERARCHY:
   - Main topics: <h1> tags (large, clear headings)
   - Subtopics: <h2> tags (medium headings)  
   - Sub-sections: <h3> tags (smaller headings)
   - Add <br><br> between major sections for spacing

2. THREE-LEVEL EMOJI BULLET SYSTEM:
   - Level 1 bullets: Use 🔹 for main points
   - Level 2 bullets (nested): Use 🔸 for supporting details
   - Level 3 bullets (deeply nested): Use ✨ for examples/specifics
   
   Example structure (MUST follow this exact valid HTML nesting):
   <ul>
     <li>🔹 <strong>Main Point:</strong> Description here
       <ul>
         <li>🔸 <strong>Detail:</strong> Supporting info
           <ul>
             <li>✨ Example or specific case</li>
           </ul>
         </li>
       </ul>
     </li>
   </ul>

3. TEXT FORMATTING:
   - Wrap ALL key terms, definitions, and important concepts in <strong> tags
   - Use <strong> for medical terms, drug names, anatomical structures
   - Keep sentences clear and concise
   - Add proper line breaks with <br> where needed

4. SPACING & READABILITY:
   - Double line break <br><br> after each heading
   - Single line break <br> between bullet groups
   - Proper indentation for nested lists
   - White space between sections

5. CONTENT ORGANIZATION:
   - Convert tables into well-structured bullet lists
   - Group related information together
   - Maintain logical flow and hierarchy
   - Professional medical terminology

${previousContext ? `CONTEXT FROM PREVIOUS PAGE:\n${previousContext}\n\nContinue seamlessly with consistent formatting. Maintain the same style and hierarchy.` : ''}

Convert this OCR text into perfectly formatted medical notes with proper spacing, hierarchy, and the three-level emoji bullet system:`;

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
