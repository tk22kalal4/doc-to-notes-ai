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
    let previousPageSummary = '';

    try {
      for (let i = 0; i < ocrTexts.length; i++) {
        const page = i + 1;
        const progressValue = (page / ocrTexts.length) * 100;
        setCurrentPage(page);
        setProgress(progressValue);
        onProgress?.(progressValue, page);

        const contextPrompt = previousPageSummary 
          ? `IMPORTANT - CONTEXT FROM PREVIOUS PAGE:
${previousPageSummary}

SMART CONTINUATION INSTRUCTIONS:
1. If previous page ENDED WITH BULLET POINTS and current text continues those points:
   → Continue with <ul><li> bullets at the same nesting level
   
2. If previous page ENDED WITH H3 SUBSECTION and current text is related:
   → Continue under that H3 or add another H3 at same level (NOT H1 or H2)
   
3. If previous page ENDED WITH H2 SUBTOPIC and current text is related:
   → Continue under that H2 or add H3 subsections (NOT new H1)
   
4. If previous page ENDED WITH H1 MAIN TOPIC and current text is related:
   → Add H2 subtopics or continue content (NOT new H1)
   
5. ONLY create new H1 if:
   → Current text is a completely NEW major topic unrelated to previous content
   
GOLDEN RULE: Match the ending structure type - bullets continue as bullets, headings continue at appropriate level!

` 
          : 'This is the first page - start with appropriate heading structure.';

        const systemPrompt = `
You are an expert medical educator who rewrites OCR medical text into clear, simple, student-friendly HTML notes.

🎯 MAIN GOAL:
Make the language as easy as possible — like explaining to a beginner or 8th-grade student — while keeping **all** medical facts, numbers, examples, and values intact.

---

LANGUAGE RULES (MOST IMPORTANT):
- Use very simple, everyday English.
- Prefer short sentences (max 10–15 words each).
- Avoid heavy medical jargon unless necessary.
- When using a difficult term, immediately explain it in brackets or simple words.
- Never copy long textbook sentences — always rewrite them in simple language.
- Imagine teaching a beginner student who has no medical background.
- Use a friendly, teacher-like tone.
- Reconstruct unclear or broken OCR text, but never remove any factual data.

---

CONTENT RETENTION RULES:
- Keep all details, facts, lists, values, drug names, and examples from the OCR.
- You can simplify grammar and structure, but do **not skip any medical information**.
- If something looks repetitive, unclear, or half-written, clean it up and merge it — keep all meaning.
- If you can guess the missing words from context, fill them in carefully.

---

CRITICAL HTML + FORMATTING RULES:

1️⃣ STRUCTURE:
- Main topics: \`<h1>❤️ Main Topic</h1>\`
  → Add \`<hr>\` after each \`<h1>\`
- Subtopics: \`<h2>🔹 Subtopic</h2>\`
  → Add \`<hr>\` after each subtopic section
- Subsections: \`<h3>💪 Subsection</h3>\`
  → Add \`<hr>\` after each subsection ends

2️⃣ EMOJIS:
- H1: ❤️, 🩺, 💊, 🧬, 🔬, 🏥
- H2: 🔹, 💪, 💨, 💓, 🩺
- Bullet level 1: 🔹 or 📌
- Bullet level 2: 🔸 or 🧠
- Bullet level 3: ✨ or 💡

3️⃣ BULLETS:
- Use nested <ul> lists properly.
- Each bullet must follow:
  \`<li>🔹 <strong>Term:</strong> description</li>\`
- Add blank lines (<br>) between major bullet groups.

4️⃣ BOLD:
- Bold all key terms, drug names, and definitions using <strong>...</strong>.

5️⃣ SPACING:
- Add <hr> after major sections.
- Add <br><br> between topics.
- Add <br> between bullet groups for better readability.

---

EXAMPLE STRUCTURE:
<h1>❤️ Main Topic</h1>
<hr>
<h2>🔹 Subtopic Name</h2>
<p>Simple, easy explanation with <strong>bold terms</strong>.</p>
<hr>
<h3>💪 Subsection</h3>
<ul>
  <li>🔹 <strong>Point 1:</strong> clear explanation
    <ul>
      <li>🔸 Detail 1</li>
      <li>🔸 Detail 2</li>
    </ul>
  </li>
</ul>
<hr>

---

${contextPrompt}

Now convert the following OCR text into **easy-to-understand, detailed HTML medical notes** following all above rules.
`;

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
        
        // Detect what the previous page ended with for better continuation
        const lastSection = pageNotes.slice(-800);
        
        // Check if ended with H1, H2, or H3
        const h1Match = lastSection.match(/<h1>([^<]+)<\/h1>/g);
        const h2Match = lastSection.match(/<h2>([^<]+)<\/h2>/g);
        const h3Match = lastSection.match(/<h3>([^<]+)<\/h3>/g);
        const lastH1 = h1Match ? h1Match[h1Match.length - 1] : '';
        const lastH2 = h2Match ? h2Match[h2Match.length - 1] : '';
        const lastH3 = h3Match ? h3Match[h3Match.length - 1] : '';
        
        // Check if ended with bullet points
        const endsWithBullets = /<\/ul>|<\/li>/.test(lastSection.slice(-100));
        
        // Check if ended with paragraph
        const endsWithParagraph = /<\/p>/.test(lastSection.slice(-50));
        
        // Get text content for context
        const textContent = lastSection.replace(/<[^>]+>/g, ' ').trim().slice(-300);
        
        let endingStructure = '';
        if (endsWithBullets) {
          endingStructure = 'ENDED WITH BULLET POINTS/LIST';
        } else if (lastH3) {
          endingStructure = `ENDED WITH H3 SUBSECTION: ${lastH3}`;
        } else if (lastH2) {
          endingStructure = `ENDED WITH H2 SUBTOPIC: ${lastH2}`;
        } else if (lastH1) {
          endingStructure = `ENDED WITH H1 MAIN TOPIC: ${lastH1}`;
        } else if (endsWithParagraph) {
          endingStructure = 'ENDED WITH PARAGRAPH';
        }
        
        previousPageSummary = `PREVIOUS PAGE STRUCTURE:
${endingStructure}

Current hierarchy:
- Main topic (H1): ${lastH1 || 'None'}
- Subtopic (H2): ${lastH2 || 'None'}  
- Subsection (H3): ${lastH3 || 'None'}

Last content: ${textContent}

CONTINUATION RULES:
- If next page content continues the same topic, DO NOT create new H1
- If continuing bullet points, continue with <ul><li> at same level
- If continuing subsection, continue under same H2/H3 hierarchy
- If new major topic, then create new H1
- Match the structure type (bullets continue as bullets, headings continue as headings)`;

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
    if (ocrTexts.length > 0) {
      generateNotes();
    }
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
