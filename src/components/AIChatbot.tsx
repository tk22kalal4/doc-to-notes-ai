import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Maximize2, Minimize2, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatbotProps {
  ocrTexts: string[];
}

export const AIChatbot = ({ ocrTexts }: AIChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const allContent = ocrTexts.join('\n\n');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleResize = (e: MouseEvent) => {
    if (!isResizing || isFullscreen) return;
    
    const newWidth = window.innerWidth - e.clientX;
    const newHeight = window.innerHeight - e.clientY;
    
    setSize({
      width: Math.max(320, Math.min(newWidth, window.innerWidth - 100)),
      height: Math.max(400, Math.min(newHeight, window.innerHeight - 100))
    });
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', () => setIsResizing(false));
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', () => setIsResizing(false));
      };
    }
  }, [isResizing]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const systemPrompt = `You are a helpful medical study assistant. A student has studied medical content and now has questions about it. Use the OCR content provided to answer their questions accurately.

CRITICAL FORMATTING RULES - FOLLOW EXACTLY:

1. STRUCTURE WITH VISUAL ELEMENTS:
   - Main points: <h3>emoji Main Point</h3>
   - Subpoints: <h4>emoji Subpoint</h4>
   - Add <hr> after major sections for visual separation
   
2. EMOJI USAGE:
   - Headings: Use 💡, 🎯, 📚, 🔬, 🩺, 💊 (educational/medical emojis)
   - Bullet Level 1: 🔹 or 📌
   - Bullet Level 2: 🔸 or 💡
   - Bullet Level 3: ✨ or 🧠
   - For emphasis: ⭐, ✅, ⚡, 💪

3. BULLET FORMATTING (CRITICAL):
   - Each bullet: <li>emoji <strong>Key Term:</strong> clear explanation</li>
   - Use nested <ul> for sub-points
   - Add <br> between major bullet groups
   - Keep explanations simple and clear
   
4. BOLD FORMATTING:
   - Wrap ALL important terms in <strong>Term</strong>
   - Medical terms, definitions, key concepts = bold
   - Numbers, measurements, values = bold

5. SPACING (VERY IMPORTANT):
   - <hr> after major sections
   - <br><br> between different topics
   - <br> between bullet groups
   - Use <p> tags for paragraphs with good spacing

6. EXPLANATION STYLE:
   - Use simple, easy-to-understand language.
   - Break complex concepts into simple bullet points
   - Use analogies when helpful
   - Explain in the easiest possible way as if explaining to a student in 8th grade.
   - Focus on understanding, not just facts
   - Avoid complex medical jargon or technical terms unless necessary.
   
EXAMPLE STRUCTURE:
<h3>💡 Answer to Your Question</h3>
<p>Here's a simple explanation with <strong>key terms</strong> highlighted.</p>
<hr>
<h4>🔹 Main Points:</h4>
<ul>
  <li>📌 <strong>First Point:</strong> Clear explanation
    <ul>
      <li>🔸 Detail 1 - easy to understand</li>
      <li>🔸 Detail 2 - with examples</li>
    </ul>
  </li>
  <li>📌 <strong>Second Point:</strong> Another explanation</li>
</ul>
<br>
<h4>⭐ Key Takeaway:</h4>
<p><strong>Remember:</strong> Simple summary of the main idea.</p>

OCR CONTENT TO REFERENCE:
${allContent.slice(0, 15000)}

Answer questions based on this content. If the answer isn't in the content, say so politely and provide general medical knowledge if appropriate.`;

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
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices[0].message.content
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform z-50"
        size="icon"
        data-testid="button-open-chatbot"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  const chatStyle = isFullscreen
    ? { width: '100vw', height: '100vh', top: 0, right: 0, borderRadius: 0 }
    : { width: `${size.width}px`, height: `${size.height}px`, bottom: '1.5rem', right: '1.5rem' };

  return (
    <Card
      ref={chatRef}
      className="fixed shadow-2xl border-2 border-primary/20 flex flex-col z-50 transition-all"
      style={chatStyle}
      data-testid="chatbot-container"
    >
      {/* Resize Handle */}
      {!isFullscreen && (
        <div
          ref={resizeRef}
          onMouseDown={() => setIsResizing(true)}
          className="absolute -top-2 -left-2 w-8 h-8 cursor-nwse-resize hover:bg-primary/20 rounded-full flex items-center justify-center group"
          data-testid="resize-handle"
        >
          <div className="w-1 h-1 bg-primary rounded-full group-hover:w-2 group-hover:h-2 transition-all" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Study Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            data-testid="button-toggle-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            data-testid="button-close-chatbot"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Ask me anything about your medical notes!</p>
              <p className="text-xs mt-2">I'll explain concepts in the easiest way possible 📚</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
                data-testid={`message-${message.role}-${index}`}
              >
                {message.role === 'assistant' ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: message.content }}
                  />
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your notes..."
            disabled={isLoading}
            className="flex-1"
            data-testid="input-chat-message"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          💡 Ask about definitions, explanations, or clarifications
        </p>
      </div>
    </Card>
  );
};
