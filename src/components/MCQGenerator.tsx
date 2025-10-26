import { useState } from 'react';
import { Brain, ChevronRight, ChevronLeft, RotateCcw, X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getRandomTextChunk, shouldUseOCRText } from '@/utils/randomTextSelector';

interface MCQ {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
}

interface MCQGeneratorProps {
  ocrTexts: string[];
  onClose: () => void;
}

export const MCQGenerator = ({ ocrTexts, onClose }: MCQGeneratorProps) => {
  const [mode, setMode] = useState<'easy' | 'hard' | null>(null);
  const [totalMCQs, setTotalMCQs] = useState<number>(10);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<(MCQ | null)[]>([]);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
  const [showResults, setShowResults] = useState<boolean[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const generateMCQ = async (index: number) => {
    setIsGenerating(true);
    
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_X || import.meta.env.VITE_GROQ_API_KEY_X || import.meta.env.VITE_GROQ_API_KEY;
      
      if (!apiKey) {
        toast({
          title: 'API Key Missing',
          description: 'Please add VITE_GROQ_API_X in repo secrets or VITE_GROQ_API_KEY in .env for local dev.',
          variant: 'destructive'
        });
        return;
      }

      const useOCR = shouldUseOCRText(ocrTexts, totalMCQs, index);
      let contextText = '';
      let promptBase = '';

      if (useOCR) {
        const randomChunk = getRandomTextChunk(ocrTexts, 100, 300);
        contextText = randomChunk.text;
        
        if (mode === 'easy') {
          promptBase = `Based on the following medical content, generate ONE deep, important NEET-PG level MCQ that tests understanding of key concepts:\n\n${contextText}\n\n`;
        } else {
          promptBase = `Based on the medical topic discussed in the following content, generate ONE clinical-based NEET-PG MCQ with a patient scenario:\n\n${contextText}\n\n`;
        }
      } else {
        const topic = extractMainTopic(ocrTexts);
        
        if (mode === 'easy') {
          promptBase = `Generate ONE NEET-PG level MCQ related to ${topic}. The question should test deep understanding:\n\n`;
        } else {
          promptBase = `Generate ONE clinical case-based NEET-PG MCQ related to ${topic} with a patient presentation:\n\n`;
        }
      }

      const systemPrompt = `You are an expert medical educator creating NEET-PG level MCQs.

CRITICAL INSTRUCTIONS:
1. Generate EXACTLY ONE multiple choice question
2. The question must be medically accurate and at NEET-PG difficulty level
3. Provide 4 options labeled A, B, C, D
4. Clearly indicate the correct answer
5. Provide a brief explanation (2-3 lines)

${mode === 'easy' ? 
  'Create a direct knowledge-based question testing important medical concepts.' :
  'Create a clinical scenario with a patient presentation requiring diagnostic/management decision.'
}

RESPONSE FORMAT (JSON ONLY):
{
  "question": "The complete question text",
  "options": {
    "A": "Option A text",
    "B": "Option B text",
    "C": "Option C text",
    "D": "Option D text"
  },
  "correctAnswer": "A",
  "explanation": "Brief explanation of the correct answer"
}

Respond ONLY with valid JSON, no additional text.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptBase }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }
      
      const mcq: MCQ = JSON.parse(jsonMatch[0]);
      
      const newQuestions = [...questions];
      newQuestions[index] = mcq;
      setQuestions(newQuestions);
      
    } catch (error) {
      console.error('MCQ generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate MCQ. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const extractMainTopic = (texts: string[]): string => {
    const allText = texts.join(' ');
    const words = allText.split(/\s+/).slice(0, 50).join(' ');
    return words || 'medical science';
  };

  const handleStart = () => {
    if (!mode) {
      toast({
        title: 'Select Mode',
        description: 'Please select Easy or Hard mode to continue.',
        variant: 'destructive'
      });
      return;
    }
    
    if (totalMCQs < 1 || totalMCQs > 50) {
      toast({
        title: 'Invalid Number',
        description: 'Please enter a number between 1 and 50.',
        variant: 'destructive'
      });
      return;
    }
    
    setQuestions(new Array(totalMCQs).fill(null));
    setUserAnswers(new Array(totalMCQs).fill(null));
    setShowResults(new Array(totalMCQs).fill(false));
    generateMCQ(0);
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = answer;
    setUserAnswers(newAnswers);
    
    const newResults = [...showResults];
    newResults[currentIndex] = true;
    setShowResults(newResults);
  };

  const handleNext = () => {
    if (currentIndex < totalMCQs - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      if (!questions[nextIndex]) {
        generateMCQ(nextIndex);
      }
    } else {
      setIsComplete(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleRestart = () => {
    setMode(null);
    setTotalMCQs(10);
    setCurrentIndex(0);
    setQuestions([]);
    setUserAnswers([]);
    setShowResults([]);
    setIsComplete(false);
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (q && userAnswers[i] === q.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  if (isComplete) {
    const score = calculateScore();
    const percentage = Math.round((score / totalMCQs) * 100);
    
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold">Quiz Complete!</h2>
          
          <div className="space-y-2">
            <div className="text-6xl font-bold text-primary">{percentage}%</div>
            <div className="text-muted-foreground">
              You got {score} out of {totalMCQs} questions correct
            </div>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button onClick={handleRestart} className="gap-2" data-testid="button-restart-mcq">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={onClose} data-testid="button-close-mcq">
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!mode || questions.length === 0) {
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Generate MCQs</h2>
                <p className="text-sm text-muted-foreground">Test your knowledge with NEET-PG level questions</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-setup">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">Select Difficulty Mode</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={mode === 'easy' ? 'default' : 'outline'}
                  onClick={() => setMode('easy')}
                  className="h-auto py-4 flex-col gap-2"
                  data-testid="button-mode-easy"
                >
                  <span className="text-lg font-bold">Easy Mode</span>
                  <span className="text-xs opacity-80">Direct knowledge-based questions from OCR text</span>
                </Button>
                <Button
                  variant={mode === 'hard' ? 'default' : 'outline'}
                  onClick={() => setMode('hard')}
                  className="h-auto py-4 flex-col gap-2"
                  data-testid="button-mode-hard"
                >
                  <span className="text-lg font-bold">Hard Mode</span>
                  <span className="text-xs opacity-80">Clinical case-based scenarios</span>
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="mcq-count" className="text-base font-semibold mb-2 block">
                Number of MCQs
              </Label>
              <Input
                id="mcq-count"
                type="number"
                min="1"
                max="50"
                value={totalMCQs}
                onChange={(e) => setTotalMCQs(parseInt(e.target.value) || 10)}
                className="text-lg"
                data-testid="input-mcq-count"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter a number between 1 and 50</p>
            </div>

            <Button
              onClick={handleStart}
              disabled={!mode || isGenerating}
              className="w-full gap-2"
              size="lg"
              data-testid="button-start-mcq"
            >
              {isGenerating ? 'Generating...' : 'Start Quiz'}
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const currentQuestion = questions[currentIndex];
  const userAnswer = userAnswers[currentIndex];
  const showResult = showResults[currentIndex];

  return (
    <Card className="p-6 max-w-3xl mx-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold" data-testid="text-progress">
              Question {currentIndex + 1} of {totalMCQs}
            </span>
            <span className="text-sm text-muted-foreground">
              ({mode === 'easy' ? 'Easy' : 'Hard'} Mode)
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-quiz">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Progress value={((currentIndex + 1) / totalMCQs) * 100} className="h-2" />

        {isGenerating || !currentQuestion ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Generating question...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg">
              <p className="text-lg font-medium leading-relaxed" data-testid="text-question">
                {currentQuestion.question}
              </p>
            </div>

            <RadioGroup
              value={userAnswer || ''}
              onValueChange={handleAnswer}
              disabled={showResult}
              className="space-y-3"
            >
              {Object.entries(currentQuestion.options).map(([key, value]) => {
                const isCorrect = key === currentQuestion.correctAnswer;
                const isSelected = userAnswer === key;
                
                let className = 'flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all';
                
                if (showResult) {
                  if (isCorrect) {
                    className += ' border-green-500 bg-green-50 dark:bg-green-950';
                  } else if (isSelected && !isCorrect) {
                    className += ' border-red-500 bg-red-50 dark:bg-red-950';
                  } else {
                    className += ' border-muted';
                  }
                } else {
                  className += ' border-muted hover:border-primary hover:bg-primary/5';
                }
                
                return (
                  <div key={key} className={className} data-testid={`option-${key}`}>
                    <RadioGroupItem value={key} id={`option-${key}`} className="mt-0.5" />
                    <Label htmlFor={`option-${key}`} className="flex-1 cursor-pointer font-normal">
                      <span className="font-semibold">{key}.</span> {value}
                    </Label>
                    {showResult && isCorrect && (
                      <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <span className="text-red-600 dark:text-red-400 font-semibold">✗</span>
                    )}
                  </div>
                );
              })}
            </RadioGroup>

            {showResult && currentQuestion.explanation && (
              <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Explanation:</p>
                <p className="text-blue-800 dark:text-blue-200">{currentQuestion.explanation}</p>
              </div>
            )}

            <div className="flex gap-3 justify-between">
              <Button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                variant="outline"
                className="gap-2"
                data-testid="button-previous"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={!showResult}
                className="gap-2"
                data-testid="button-next"
              >
                {currentIndex === totalMCQs - 1 ? 'Finish' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
