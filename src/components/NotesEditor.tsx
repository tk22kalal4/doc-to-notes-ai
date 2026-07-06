
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
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell } from 'docx';
import { saveAs } from 'file-saver';
import { groqChatCompletion } from '@/lib/groqKeys';
import { Languages, Volume2, VolumeX, Play, Pause, Square, Mic } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  uploadMode?: 'pdf' | 'image' | 'docx' | null;
  docxContent?: string;
}

// TinyMCE's parser sometimes inserts empty "padding" paragraphs (e.g. <p>&nbsp;</p>)
// directly before/after <hr> elements every time it re-parses HTML (e.g. on init).
// This strips those so the extra blank lines don't get saved and compound on re-edit.
const stripHrPadding = (html: string): string => {
  if (!html || !html.includes('<hr')) return html;
  const isEmptyParagraph = (s: string) =>
    /^<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>$/i.test(s.trim());

  let prev: string;
  let result = html;
  do {
    prev = result;
    result = result.replace(
      /(<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+(<hr[^>]*\/?>)/gi,
      (match, _p, hr) => (isEmptyParagraph(match.slice(0, match.length - hr.length)) ? hr : match)
    );
    result = result.replace(
      /(<hr[^>]*\/?>)(\s*<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>)+/gi,
      (match, hr) => {
        const tail = match.slice(hr.length);
        return isEmptyParagraph(tail) ? hr : match;
      }
    );
  } while (result !== prev);

  return result;
};

export const NotesEditor = ({ content, onContentChange, ocrTexts = [], uploadMode = null, docxContent = '' }: NotesEditorProps) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [isTouchingUp, setIsTouchingUp] = useState(false);
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showMCQ, setShowMCQ] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('medical-notes');
  const [isConvertingHinglish, setIsConvertingHinglish] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { toast } = useToast();
  const editorRef = useRef<any>(null);
  const historyRef = useRef<{ history: string[]; index: number }>({ history: [], index: -1 });
  const speechQueueRef = useRef<string[]>([]);
  const speechIndexRef = useRef(0);
  const speechStoppedRef = useRef(false);
  const [speechProgress, setSpeechProgress] = useState({ index: 0, total: 0 });
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('mednotes-tts-voice-uri') || '';
  });

  // Indian AI Voice (HuggingFace TTS)
  const [indianVoiceLang, setIndianVoiceLang] = useState<'hindi' | 'assamese'>(() => {
    if (typeof window === 'undefined') return 'hindi';
    return (window.localStorage.getItem('mednotes-indian-voice-lang') as 'hindi' | 'assamese') || 'hindi';
  });
  const [isHFSpeaking, setIsHFSpeaking] = useState(false);
  const [isHFPaused, setIsHFPaused] = useState(false);
  const [isHFLoading, setIsHFLoading] = useState(false);
  const [hfProgress, setHFProgress] = useState({ index: 0, total: 0 });
  const hfAudioRef = useRef<HTMLAudioElement | null>(null);
  const hfStoppedRef = useRef(false);
  const hfChunksRef = useRef<string[]>([]);
  const hfChunkIndexRef = useRef(0);
  const hfLangRef = useRef<'hindi' | 'assamese'>('hindi');
  // Ref so audio.onended always calls the latest version (avoids stale closure)
  const speakHFRef = useRef<() => void>(() => {});
  // Cache HF token after first fetch (token endpoint is on the api-server)
  const hfTokenRef = useRef<string | null>(null);
  // Track the active blob URL so it can be revoked on Stop or unmount
  const hfBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (hfAudioRef.current) {
        hfAudioRef.current.onended = null;
        hfAudioRef.current.onerror = null;
        hfAudioRef.current.pause();
        hfAudioRef.current.src = '';
      }
      if (hfBlobUrlRef.current) {
        URL.revokeObjectURL(hfBlobUrlRef.current);
        hfBlobUrlRef.current = null;
      }
    };
  }, []);

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
- Never Combine Two or more short sentences to form Long Sentence.
- Never Make Short Complete Sentence into Long Sentence.

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

7. **EMOJI USAGE:** always used as prefixes, never used after following text
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

      
      const touchedUpContent = await groqChatCompletion({
        // DIFFERENT MODEL FOR TOUCHUP
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: touchupSystemPrompt },
          { role: 'user', content: `Please enhance and format these medical notes while preserving all medical accuracy:\n\n${currentContent}` }
        ],
        temperature: 0.5, // Lower temperature for more consistent medical formatting
        max_tokens: 8192, // Higher token limit for comprehensive notes
        top_p: 0.9
      }) || currentContent;

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

  // HINGLISH EXPLAIN - Re-explain current notes like a teacher, in simple Hinglish
  const handleHinglishExplain = async () => {
    if (!content) return;

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

    setIsConvertingHinglish(true);

    try {
      const hinglishSystemPrompt = `You are a warm, patient medical teacher explaining notes out loud to a student who understands Hindi and English mixed together (Hinglish).

RULES:
- Rewrite the given medical notes as a friendly spoken-style explanation in HINGLISH — natural Hindi-English mix, written in ROMAN/ENGLISH SCRIPT ONLY (never Devanagari).
- Explain like you're teaching a student casually, e.g. "Dekho beta, yeh jo bimari hai na, iska matlab hai ki...".
- Use very easy, everyday words. Short sentences. Keep it engaging and simple to understand.
- Do NOT drop or invent medical facts — keep everything medically accurate, just explained simply.
- Preserve the structure (headings, bullet points) using the same HTML tags as the input.
- Output ONLY clean HTML using <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <br>, <hr> — no markdown, no commentary, no extra text.`;

      const hinglishContent = await groqChatCompletion({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: hinglishSystemPrompt },
          { role: 'user', content: `Explain these medical notes in simple Hinglish, like a teacher explaining to a student:\n\n${currentContent}` }
        ],
        temperature: 0.7,
        max_tokens: 8192,
        top_p: 0.9
      });

      const finalContent = hinglishContent || currentContent;

      const { history: latestHistory, index: latestIndex } = historyRef.current;
      const finalHistory = latestHistory.slice(0, latestIndex + 1);
      finalHistory.push(finalContent);
      const finalIndex = finalHistory.length - 1;
      setContentHistory(finalHistory);
      setHistoryIndex(finalIndex);
      historyRef.current = { history: finalHistory, index: finalIndex };

      onContentChange(finalContent);

      toast({
        title: 'Hinglish Explanation Ready!',
        description: 'Your notes have been explained in simple Hinglish. Use Undo to go back to the original.',
      });
    } catch (error) {
      console.error('Hinglish conversion error:', error);
      toast({
        title: 'Hinglish Conversion Failed',
        description: error instanceof Error ? error.message : 'Failed to convert notes to Hinglish. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsConvertingHinglish(false);
    }
  };

  // Strips emoji/pictographic symbols and stray punctuation that browser TTS
  // engines sometimes read aloud literally (e.g. "large blue diamond",
  // "slash", "comma") so the spoken notes sound like natural sentences.
  const cleanTextForSpeech = (text: string): string => {
    let cleaned = text;
    // Emoji / pictographic / symbol / flag ranges
    cleaned = cleaned.replace(
      /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\uFE0F\u200D]/gu,
      ''
    );
    // Bullet / arrow / markdown-ish characters
    cleaned = cleaned.replace(/[•●▪◦‣›»«→←↔]/g, ' ');
    // Symbols some TTS engines spell out by name (slash, asterisk, hash, etc.)
    cleaned = cleaned.replace(/[\/\\|*_#@^~`<>{}\[\]=+]/g, ' ');
    // Commas/semicolons/colons/dashes read literally on some engines ("comma") —
    // drop them, sentence-ending punctuation (. ! ? ।) is preserved for pacing.
    cleaned = cleaned.replace(/[,;:]/g, ' ');
    cleaned = cleaned.replace(/-{1,}/g, ' ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    return cleaned;
  };

  // Splits text into small, sentence-aware chunks (~180 chars max). Chrome and
  // several mobile browsers throw "synthesis-failed" on a single long
  // utterance, so speaking short chunks back-to-back is far more reliable.
  const splitTextForSpeech = (text: string, maxLen = 180): string[] => {
    const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);
    const chunks: string[] = [];
    let current = '';

    const pushCurrent = () => {
      if (current.trim()) chunks.push(current.trim());
      current = '';
    };

    for (const sentence of sentences) {
      if (sentence.length > maxLen) {
        pushCurrent();
        const words = sentence.split(/\s+/);
        let piece = '';
        for (const word of words) {
          if ((piece + ' ' + word).trim().length > maxLen) {
            if (piece.trim()) chunks.push(piece.trim());
            piece = word;
          } else {
            piece = (piece + ' ' + word).trim();
          }
        }
        if (piece.trim()) chunks.push(piece.trim());
        continue;
      }

      if ((current + ' ' + sentence).trim().length > maxLen) {
        pushCurrent();
      }
      current = (current + ' ' + sentence).trim();
    }
    pushCurrent();

    return chunks;
  };

  // Common Indian TTS voice names shipped by Google/Microsoft engines,
  // bucketed by gender so we can prefer a genuine male-sounding voice
  // when the user hasn't picked one manually.
  const KNOWN_MALE_VOICE_NAMES = ['hemant', 'ravi', 'prabhat', 'madhur', 'rishi', 'arnav', 'male'];
  const KNOWN_FEMALE_VOICE_NAMES = ['heera', 'lekha', 'kalpana', 'swara', 'female'];

  const isLikelyMaleVoice = (name: string): boolean => {
    const lower = name.toLowerCase();
    if (KNOWN_FEMALE_VOICE_NAMES.some(n => lower.includes(n))) return false;
    return KNOWN_MALE_VOICE_NAMES.some(n => lower.includes(n));
  };

  // Picks the clearest voice for reading Roman-script Hinglish text aloud.
  // A generic default voice (often British/US English) mispronounces
  // Hinglish words badly. An Indian-accented English/Hindi male voice reads
  // both the English and transliterated-Hindi words far more naturally.
  // If the user has manually selected a voice, that always wins.
  const pickBestSpeechVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    if (selectedVoiceURI) {
      const manual = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (manual) return manual;
    }

    const isIndianOrHindi = (v: SpeechSynthesisVoice) =>
      v.lang.toLowerCase().startsWith('en-in') ||
      v.lang.toLowerCase().startsWith('hi') ||
      /india|hindi/i.test(v.name);

    const indianVoices = voices.filter(isIndianOrHindi);

    return (
      // Prefer a known male Indian/Hindi voice
      indianVoices.find(v => isLikelyMaleVoice(v.name)) ||
      // Otherwise any Indian/Hindi voice at all
      indianVoices[0] ||
      // Fall back to any English voice rather than the browser's arbitrary default
      voices.find(v => v.lang.toLowerCase().startsWith('en-us')) ||
      voices.find(v => v.lang.toLowerCase().startsWith('en')) ||
      voices[0] ||
      null
    );
  };

  const speakNextChunk = () => {
    if (speechStoppedRef.current || speechIndexRef.current >= speechQueueRef.current.length) {
      setIsSpeaking(false);
      return;
    }

    setSpeechProgress({ index: speechIndexRef.current, total: speechQueueRef.current.length });
    setIsSpeechPaused(false);

    const chunk = speechQueueRef.current[speechIndexRef.current];
    const utterance = new SpeechSynthesisUtterance(chunk);
    const bestVoice = pickBestSpeechVoice();
    if (bestVoice) utterance.voice = bestVoice;
    utterance.lang = bestVoice?.lang || 'en-IN';
    utterance.rate = 0.88;
    // A slightly lower pitch reads more like a deeper male voice on engines
    // that don't expose a dedicated male voice for the selected language.
    utterance.pitch = bestVoice && isLikelyMaleVoice(bestVoice.name) ? 1 : 0.85;

    utterance.onend = () => {
      if (speechStoppedRef.current) {
        setIsSpeaking(false);
        return;
      }
      speechIndexRef.current += 1;
      if (speechIndexRef.current < speechQueueRef.current.length) {
        speakNextChunk();
      } else {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = (event) => {
      const errorType = (event as SpeechSynthesisErrorEvent).error;
      if (errorType === 'canceled' || errorType === 'interrupted' || speechStoppedRef.current) {
        setIsSpeaking(false);
        return;
      }

      const failedAtStart = speechIndexRef.current === 0;
      speechIndexRef.current += 1;

      // Skip this chunk and keep going rather than aborting the whole reading;
      // only surface an error toast if nothing has played at all yet.
      if (speechIndexRef.current < speechQueueRef.current.length) {
        speakNextChunk();
        if (failedAtStart) {
          toast({
            title: 'Audio Warning',
            description: `Some audio could not play (${errorType || 'unknown error'}). Continuing where possible.`,
            variant: 'destructive'
          });
        }
        return;
      }

      setIsSpeaking(false);
      toast({
        title: 'Audio Error',
        description: `Could not play audio in this browser (${errorType || 'unknown error'}). Please try a different browser or device.`,
        variant: 'destructive'
      });
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleStopListening = () => {
    speechStoppedRef.current = true;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsSpeechPaused(false);
  };

  const handlePauseResume = () => {
    if (!isSpeaking) return;
    if (isSpeechPaused) {
      window.speechSynthesis.resume();
      setIsSpeechPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
    }
  };

  // Jumps playback to a specific chunk (used by the seek/progress bar).
  const handleSeekTo = (index: number) => {
    if (!speechQueueRef.current.length) return;
    const clamped = Math.max(0, Math.min(index, speechQueueRef.current.length - 1));
    window.speechSynthesis.cancel();
    speechStoppedRef.current = false;
    speechIndexRef.current = clamped;
    setIsSpeechPaused(false);
    setIsSpeaking(true);
    speakNextChunk();
  };

  // LISTEN - Read the current notes aloud using the browser's speech synthesis
  const handleListen = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({
        title: 'Audio Not Supported',
        description: 'Your browser does not support text-to-speech playback.',
        variant: 'destructive'
      });
      return;
    }

    if (isSpeaking) {
      handleStopListening();
      return;
    }

    if (!content) {
      toast({
        title: 'Nothing to Read',
        description: 'Generate or open some notes first.',
        variant: 'destructive'
      });
      return;
    }

    const plainText = new DOMParser().parseFromString(content, 'text/html').body.textContent?.trim() || '';
    if (!plainText) {
      toast({
        title: 'Nothing to Read',
        description: 'There is no readable text in the current notes.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Chrome/mobile browsers reliably throw "synthesis-failed" for a single
      // long utterance. Splitting into small sentence-sized chunks and
      // speaking them back-to-back avoids this and also lets Stop work mid-way.
      const cleanedText = cleanTextForSpeech(plainText);
      const chunks = splitTextForSpeech(cleanedText);
      if (chunks.length === 0) {
        toast({
          title: 'Nothing to Read',
          description: 'There is no readable text in the current notes.',
          variant: 'destructive'
        });
        return;
      }

      window.speechSynthesis.cancel();
      speechQueueRef.current = chunks;
      speechIndexRef.current = 0;
      speechStoppedRef.current = false;
      setSpeechProgress({ index: 0, total: chunks.length });
      setIsSpeechPaused(false);
      setIsSpeaking(true);
      speakNextChunk();
    } catch (err) {
      console.error('Speech synthesis error:', err);
      setIsSpeaking(false);
      toast({
        title: 'Audio Error',
        description: 'Could not play audio in this browser. Please try a different browser.',
        variant: 'destructive'
      });
    }
  };

  // ── Indian AI Voice (HuggingFace TTS) ─────────────────────────────────────

  const handleIndianVoiceStop = () => {
    hfStoppedRef.current = true;
    if (hfAudioRef.current) {
      hfAudioRef.current.onended = null;
      hfAudioRef.current.onerror = null;
      hfAudioRef.current.pause();
      hfAudioRef.current.src = '';
      hfAudioRef.current = null;
    }
    if (hfBlobUrlRef.current) {
      URL.revokeObjectURL(hfBlobUrlRef.current);
      hfBlobUrlRef.current = null;
    }
    setIsHFSpeaking(false);
    setIsHFPaused(false);
    setIsHFLoading(false);
  };

  const handleIndianVoicePauseResume = () => {
    if (!hfAudioRef.current) return;
    if (isHFPaused) {
      hfAudioRef.current.play().catch(() => {});
      setIsHFPaused(false);
    } else {
      hfAudioRef.current.pause();
      setIsHFPaused(true);
    }
  };

  const HF_TTS_MODELS: Record<string, string> = {
    hindi: 'facebook/mms-tts-hin',
    assamese: 'facebook/mms-tts-asm',
  };

  const speakHFNextChunk = async () => {
    if (hfStoppedRef.current) { setIsHFSpeaking(false); setIsHFLoading(false); return; }
    const idx = hfChunkIndexRef.current;
    const chunks = hfChunksRef.current;
    if (idx >= chunks.length) { setIsHFSpeaking(false); setIsHFLoading(false); return; }

    setHFProgress({ index: idx, total: chunks.length });
    setIsHFLoading(true);

    try {
      // Resolve HF token — prefer build-time env var (GitHub Pages / static
      // deployments), fall back to the api-server endpoint for local dev.
      if (!hfTokenRef.current) {
        const buildTimeToken = import.meta.env.VITE_HF_API_TOKEN as string | undefined;
        if (buildTimeToken) {
          hfTokenRef.current = buildTimeToken;
        } else {
          const tokenRes = await fetch('/api/tts/token');
          if (!tokenRes.ok) throw new Error('Could not retrieve voice token from server.');
          const { token } = await tokenRes.json() as { token: string };
          hfTokenRef.current = token;
        }
      }

      // Call HuggingFace Inference API directly from the browser
      // (browser can resolve api-inference.huggingface.co; server cannot)
      const model = HF_TTS_MODELS[hfLangRef.current] ?? HF_TTS_MODELS.hindi;
      const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfTokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: chunks[idx] }),
      });

      setIsHFLoading(false);
      if (hfStoppedRef.current) { setIsHFSpeaking(false); return; }

      if (!hfRes.ok) {
        const errText = await hfRes.text().catch(() => '');
        const is503 = hfRes.status === 503;
        throw new Error(
          is503
            ? 'Model is warming up — please try again in ~20 seconds.'
            : `HF TTS error (${hfRes.status}): ${errText.slice(0, 120)}`
        );
      }

      const blob = await hfRes.blob();
      const url = URL.createObjectURL(blob);
      // Track the active blob URL so Stop/unmount can revoke it
      hfBlobUrlRef.current = url;
      const audio = new Audio(url);
      hfAudioRef.current = audio;

      audio.onended = () => {
        // Revoke only if this URL is still the tracked one (not already replaced)
        if (hfBlobUrlRef.current === url) hfBlobUrlRef.current = null;
        URL.revokeObjectURL(url);
        if (!hfStoppedRef.current) {
          hfChunkIndexRef.current += 1;
          speakHFRef.current(); // always calls latest version via ref
        }
      };
      audio.onerror = () => {
        if (hfBlobUrlRef.current === url) hfBlobUrlRef.current = null;
        URL.revokeObjectURL(url);
        if (!hfStoppedRef.current) {
          hfChunkIndexRef.current += 1;
          speakHFRef.current();
        }
      };
      audio.play().catch(() => {
        if (hfBlobUrlRef.current === url) hfBlobUrlRef.current = null;
        URL.revokeObjectURL(url);
        if (!hfStoppedRef.current) {
          setIsHFSpeaking(false);
          toast({ title: 'Playback Error', description: 'Browser blocked audio autoplay.', variant: 'destructive' });
        }
      });
    } catch (err) {
      setIsHFLoading(false);
      if (hfStoppedRef.current) { setIsHFSpeaking(false); return; }
      toast({
        title: 'Indian Voice Error',
        description: err instanceof Error ? err.message : 'Audio generation failed. Try again in a few seconds.',
        variant: 'destructive',
      });
      setIsHFSpeaking(false);
    }
  };
  // Keep the ref in sync so audio.onended always invokes the latest closure
  speakHFRef.current = speakHFNextChunk;

  const handleIndianVoiceListen = () => {
    if (isHFSpeaking || isHFLoading) { handleIndianVoiceStop(); return; }
    if (!content) {
      toast({ title: 'Nothing to Read', description: 'Generate some notes first.', variant: 'destructive' });
      return;
    }
    const plain = new DOMParser().parseFromString(content, 'text/html').body.textContent?.trim() || '';
    if (!plain) {
      toast({ title: 'Nothing to Read', description: 'No readable text found.', variant: 'destructive' });
      return;
    }
    const cleaned = cleanTextForSpeech(plain);
    const chunks = splitTextForSpeech(cleaned, 300);
    if (!chunks.length) return;

    hfStoppedRef.current = false;
    hfChunksRef.current = chunks;
    hfChunkIndexRef.current = 0;
    hfLangRef.current = indianVoiceLang;
    setHFProgress({ index: 0, total: chunks.length });
    setIsHFSpeaking(true);
    setIsHFPaused(false);
    speakHFRef.current();
  };

  // ──────────────────────────────────────────────────────────────────────────

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

  // Helper: Build text runs from element with proper formatting
  const buildRuns = async (element: Element, defaultSize: number = 24): Promise<any[]> => {
    const runs: any[] = [];
    
    // Get computed style to find applied font
    const htmlEl = element as HTMLElement;
    const fontFamily = htmlEl.style?.fontFamily || '';
    const isKalam = fontFamily.toLowerCase().includes('kalam');
    const isComic = fontFamily.toLowerCase().includes('comic');
    const isPatrick = fontFamily.toLowerCase().includes('patrick');
    const isArchitect = fontFamily.toLowerCase().includes('architect');
    const isCaveat = fontFamily.toLowerCase().includes('caveat');
    
    const fontOptions: any = {
      size: defaultSize,
    };

    if (isKalam) fontOptions.font = 'Kalam';
    else if (isComic) fontOptions.font = 'Comic Neue';
    else if (isPatrick) fontOptions.font = 'Patrick Hand';
    else if (isArchitect) fontOptions.font = 'Architects Daughter';
    else if (isCaveat) fontOptions.font = 'Caveat';
    
    // Ensure regular weight and no forced italic/cursive for custom fonts
    fontOptions.bold = false;
    fontOptions.italics = false;
    
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (text) runs.push(new TextRun({ text, ...fontOptions }));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        
        // Inherit or override font for nested elements
        const elHtml = el as HTMLElement;
        const elFont = elHtml.style?.fontFamily || fontFamily;
        const elIsKalam = elFont.toLowerCase().includes('kalam');
        const elIsComic = elFont.toLowerCase().includes('comic');
        const elIsPatrick = elFont.toLowerCase().includes('patrick');
        const elIsArchitect = elFont.toLowerCase().includes('architect');
        const elIsCaveat = elFont.toLowerCase().includes('caveat');
        
        const elFontOptions: any = {
          size: defaultSize,
        };

        if (elIsKalam) elFontOptions.font = 'Kalam';
        else if (elIsComic) elFontOptions.font = 'Comic Neue';
        else if (elIsPatrick) elFontOptions.font = 'Patrick Hand';
        else if (elIsArchitect) elFontOptions.font = 'Architects Daughter';
        else if (elIsCaveat) elFontOptions.font = 'Caveat';

        if (tag === 'ul' || tag === 'ol') {
          continue;
        }
        
        const content = el.textContent || '';
        
        if (tag === 'img') {
          const src = el.getAttribute('src');
          if (src) {
            const imageData = await fetchImageAsArrayBuffer(src);
            if (imageData) {
              const dims = await getImageDimensions(src);
              let width = dims.width, height = dims.height;
              const styleWidth = el.getAttribute('width') || (el as HTMLElement).style?.width;
              const styleHeight = el.getAttribute('height') || (el as HTMLElement).style?.height;
              if (styleWidth) {
                const pw = parseInt(styleWidth.toString().replace('px', ''), 10);
                if (!isNaN(pw)) width = pw;
              }
              if (styleHeight) {
                const ph = parseInt(styleHeight.toString().replace('px', ''), 10);
                if (!isNaN(ph)) height = ph;
              }
              const maxWidth = 600;
              if (width > maxWidth) {
                const scale = maxWidth / width;
                width = maxWidth;
                height = Math.round(height * scale);
              }
              runs.push(new ImageRun({
                data: imageData,
                transformation: { width, height },
                type: 'png',
              }));
            }
          }
        } else if (tag === 'strong' || tag === 'b') {
          runs.push(new TextRun({ text: content, bold: true, ...elFontOptions }));
        } else if (tag === 'em' || tag === 'i') {
          runs.push(new TextRun({ text: content, italics: true, ...elFontOptions }));
        } else {
          runs.push(new TextRun({ text: content, ...elFontOptions }));
        }
      }
    }
    return runs;
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
                const dims = await getImageDimensions(src);
                let width = dims.width, height = dims.height;
                const styleWidth = element.getAttribute('width') || (element as HTMLElement).style?.width;
                const styleHeight = element.getAttribute('height') || (element as HTMLElement).style?.height;
                if (styleWidth) {
                  const pw = parseInt(styleWidth.toString().replace('px', ''), 10);
                  if (!isNaN(pw)) width = pw;
                }
                if (styleHeight) {
                  const ph = parseInt(styleHeight.toString().replace('px', ''), 10);
                  if (!isNaN(ph)) height = ph;
                }
                const maxWidth = 600;
                if (width > maxWidth) {
                  const scale = maxWidth / width;
                  width = maxWidth;
                  height = Math.round(height * scale);
                }
                result.push(new Paragraph({
                  children: [new ImageRun({
                    data: imageData,
                    transformation: { width, height },
                    type: 'png',
                  })],
                  spacing: { before: 200, after: 200 },
                  alignment: AlignmentType.CENTER,
                }));
              }
            }
            break;
          }
          
          case 'h1': {
            const runs = await buildRuns(element, 36);
            result.push(new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun({ text: textContent, bold: true, size: 36, color: '0891b2' })],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }));
            break;
          }
          
          case 'h2': {
            const runs = await buildRuns(element, 32);
            result.push(new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun({ text: textContent, bold: true, size: 32, color: '9333ea' })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }));
            break;
          }
          
          case 'h3': {
            const runs = await buildRuns(element, 28);
            result.push(new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun({ text: textContent, bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            }));
            break;
          }
          
          case 'h4': {
            const runs = await buildRuns(element, 26);
            result.push(new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun({ text: textContent, bold: true, size: 26 })],
              heading: HeadingLevel.HEADING_4,
              spacing: { before: 150, after: 75 },
            }));
            break;
          }
          
          case 'p': {
            const runs = await buildRuns(element, 24);
            if (runs.length > 0) {
              // Check if paragraph contains images - if so, handle separately
              const hasImages = runs.some(r => r instanceof ImageRun || (r && r.constructor?.name === 'ImageRun'));
              
              if (hasImages) {
                // Add image paragraphs separately
                let textRuns: any[] = [];
                for (const run of runs) {
                  if (run instanceof ImageRun || (run && run.constructor?.name === 'ImageRun')) {
                    // Flush text runs first
                    if (textRuns.length > 0) {
                      result.push(new Paragraph({
                        children: textRuns,
                        spacing: { before: 100, after: 100 },
                      }));
                      textRuns = [];
                    }
                    // Add image paragraph
                    result.push(new Paragraph({
                      children: [run],
                      spacing: { before: 100, after: 100 },
                      alignment: AlignmentType.CENTER,
                    }));
                  } else {
                    textRuns.push(run);
                  }
                }
                // Flush remaining text
                if (textRuns.length > 0) {
                  result.push(new Paragraph({
                    children: textRuns,
                    spacing: { before: 100, after: 100 },
                  }));
                }
              } else {
                result.push(new Paragraph({
                  children: runs,
                  spacing: { before: 100, after: 100 },
                }));
              }
            }
            break;
          }
          
          case 'ul':
          case 'ol': {
            for (const li of Array.from(element.querySelectorAll(':scope > li'))) {
              const liRuns = await buildRuns(li as Element, 24);
              
              const baseIndent = 720;
              const depthIndent = depth * 720;
              const totalIndent = baseIndent + depthIndent;
              
              if (liRuns.length > 0) {
                let textRuns: any[] = [];
                for (const run of liRuns) {
                  if (run instanceof ImageRun || (run && run.constructor?.name === 'ImageRun')) {
                    if (textRuns.length > 0) {
                      result.push(new Paragraph({
                        children: textRuns,
                        bullet: { level: depth },
                        indent: { left: totalIndent, hanging: 360 },
                        spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
                      }));
                      textRuns = [];
                    }
                    result.push(new Paragraph({
                      children: [run],
                      indent: { left: totalIndent },
                      spacing: { before: 0, after: 0 },
                      alignment: AlignmentType.CENTER,
                    }));
                  } else {
                    textRuns.push(run);
                  }
                }
                if (textRuns.length > 0) {
                  result.push(new Paragraph({
                    children: textRuns,
                    bullet: { level: depth },
                    indent: { left: totalIndent, hanging: 360 },
                    spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
                  }));
                }
              }
              
              for (const nestedList of Array.from(li.querySelectorAll(':scope > ul, :scope > ol'))) {
                result.push(...await processNode(nestedList, depth + 1));
              }
            }
            break;
          }
          
          case 'table': {
            const rows: any[] = [];
            const trs = Array.from(element.querySelectorAll('tr'));
            for (const tr of trs) {
              const cells: any[] = [];
              const tds = Array.from(tr.querySelectorAll('td, th'));
              for (const td of tds) {
                const cellText = td.textContent?.trim() || '';
                cells.push(new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: cellText, size: 24 })]
                  })],
                  shading: { fill: td.tagName.toLowerCase() === 'th' ? 'E0E0E0' : 'FFFFFF' }
                }));
              }
              rows.push(new TableRow({ children: cells }));
            }
            if (rows.length > 0) {
              result.push(new Table({
                rows: rows,
                width: { size: 100, type: 'pct' }
              }));
            }
            break;
          }
          
          case 'hr':
            result.push(new Paragraph({
              children: [new TextRun({ text: '─'.repeat(30), size: 24, color: 'cccccc' })],
              spacing: { before: 200, after: 200 },
              alignment: AlignmentType.CENTER,
            }));
            break;
          
          case 'br':
            result.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
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
    const contentForMCQ = uploadMode === 'docx' && docxContent ? [docxContent] : ocrTexts;
    return <MCQGenerator ocrTexts={contentForMCQ} onClose={() => setShowMCQ(false)} />;
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
                onClick={handleHinglishExplain}
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                disabled={isConvertingHinglish || !content}
                data-testid="button-hinglish-notes"
              >
                <Languages className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{isConvertingHinglish ? 'Converting...' : 'Hinglish'}</span>
                <span className="xs:hidden">{isConvertingHinglish ? '...' : 'Hin'}</span>
              </Button>
              <Button
                onClick={handleListen}
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                disabled={!content}
                data-testid="button-listen-notes"
              >
                {isSpeaking ? <VolumeX className="h-3 w-3 sm:h-4 sm:w-4" /> : <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />}
                <span className="hidden xs:inline">{isSpeaking ? 'Stop' : 'Listen'}</span>
                <span className="xs:hidden">{isSpeaking ? 'Stop' : 'Play'}</span>
              </Button>
              <Button
                onClick={handleIndianVoiceListen}
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                disabled={!content}
                data-testid="button-indian-voice"
                title="Indian AI Voice — powered by HuggingFace"
              >
                {(isHFSpeaking || isHFLoading)
                  ? <VolumeX className="h-3 w-3 sm:h-4 sm:w-4" />
                  : <Mic className="h-3 w-3 sm:h-4 sm:w-4" />}
                <span className="hidden xs:inline">
                  {isHFLoading ? 'Loading…' : isHFSpeaking ? 'Stop 🇮🇳' : '🇮🇳 Voice'}
                </span>
                <span className="xs:hidden">
                  {isHFLoading ? '…' : isHFSpeaking ? '■' : '🇮🇳'}
                </span>
              </Button>
              <Button
                onClick={() => setShowMCQ(true)}
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                disabled={uploadMode === 'docx' ? !docxContent : (!ocrTexts || ocrTexts.length === 0)}
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
          {isSpeaking && speechProgress.total > 0 && (
            <div
              className="mt-3 flex items-center gap-2 sm:gap-3 rounded-md border bg-muted/40 px-3 py-2"
              data-testid="audio-player-bar"
            >
              <Button
                onClick={handlePauseResume}
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                data-testid="button-pause-resume-listen"
                aria-label={isSpeechPaused ? 'Resume' : 'Pause'}
              >
                {isSpeechPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button
                onClick={handleStopListening}
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                data-testid="button-stop-listen"
                aria-label="Stop"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
              <Slider
                value={[speechProgress.index]}
                min={0}
                max={Math.max(speechProgress.total - 1, 0)}
                step={1}
                onValueChange={(vals) => handleSeekTo(vals[0])}
                className="flex-1"
                data-testid="slider-listen-progress"
              />
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums" data-testid="text-listen-progress">
                {speechProgress.index + 1}/{speechProgress.total}
              </span>
            </div>
          )}
          {(isHFSpeaking || isHFLoading) && (
            <div className="mt-3 flex items-center gap-2 sm:gap-3 rounded-md border bg-muted/40 px-3 py-2" data-testid="hf-audio-player-bar">
              {isHFLoading ? (
                <span className="text-xs text-muted-foreground animate-pulse">
                  🇮🇳 Generating Indian voice… (first load ~20s)
                </span>
              ) : (
                <>
                  <Button
                    onClick={handleIndianVoicePauseResume}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={isHFPaused ? 'Resume' : 'Pause'}
                  >
                    {isHFPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={handleIndianVoiceStop}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Stop"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                  <Slider
                    value={[hfProgress.index]}
                    min={0}
                    max={Math.max(hfProgress.total - 1, 0)}
                    step={1}
                    className="flex-1"
                    onValueChange={() => {}}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    🇮🇳 {hfProgress.index + 1}/{hfProgress.total}
                  </span>
                </>
              )}
            </div>
          )}
          {availableVoices.length > 0 && (
            <div className="mt-2 flex items-center gap-2" data-testid="voice-picker">
              <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Select
                value={selectedVoiceURI || 'auto'}
                onValueChange={(value) => {
                  const next = value === 'auto' ? '' : value;
                  setSelectedVoiceURI(next);
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('mednotes-tts-voice-uri', next);
                  }
                  if (isSpeaking) {
                    handleSeekTo(speechIndexRef.current);
                  }
                }}
              >
                <SelectTrigger className="h-7 w-auto max-w-[220px] gap-1 text-xs" data-testid="select-voice">
                  <SelectValue placeholder="Auto voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (best Indian voice)</SelectItem>
                  {availableVoices.map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2" data-testid="indian-voice-lang-picker">
            <span className="text-xs text-muted-foreground">🇮🇳 AI Voice:</span>
            <Select
              value={indianVoiceLang}
              onValueChange={(value) => {
                const lang = value as 'hindi' | 'assamese';
                setIndianVoiceLang(lang);
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('mednotes-indian-voice-lang', lang);
                }
              }}
            >
              <SelectTrigger className="h-7 w-auto max-w-[180px] gap-1 text-xs" data-testid="select-indian-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hindi">Hindi (हिन्दी)</SelectItem>
                <SelectItem value="assamese">Assamese (অসমীয়া)</SelectItem>
              </SelectContent>
            </Select>
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

        <TabsContent
          value="edit"
          forceMount
          className="m-0 p-4 data-[state=inactive]:hidden"
        >
          <div data-testid="rich-text-editor">
            <Editor
              apiKey={import.meta.env.VITE_TINY_API}
              onInit={(_evt, editor) => editorRef.current = editor}
              value={content}
              onEditorChange={(newContent) => onContentChange(stripHrPadding(newContent))}
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
                  'removeformat | image media table | fontfamily | help',
                content_style: `
                  @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Comic+Neue:wght@400;700&family=Patrick+Hand&family=Architects+Daughter&family=Caveat:wght@400;700&display=swap');
                  body { 
                    font-family: Arial, sans-serif; 
                    font-size: 16px;
                    line-height: 1.6;
                    padding: 20px;
                    color: #334155;
                  }
                  h1 {
                    color: #0891b2 !important;
                    margin-top: 24px !important;
                    margin-bottom: 12px !important;
                    font-weight: bold;
                  }
                  h2 {
                    color: #9333ea !important;
                    margin-top: 18px !important;
                    margin-bottom: 9px !important;
                    font-weight: bold;
                  }
                  h3 {
                    margin-top: 12px !important;
                    margin-bottom: 6px !important;
                    font-weight: bold;
                  }
                  h4 {
                    margin-top: 9px !important;
                    margin-bottom: 4.5px !important;
                    font-weight: bold;
                  }
                  p {
                    margin: 0 !important;
                    padding: 0 !important;
                    max-width: 100%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                  }
                  hr {
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    border-top: 1px solid #cccccc !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    line-height: 0 !important;
                    overflow: hidden !important;
                    display: block !important;
                  }
                  div > hr, hr + div, div:has(> hr) {
                    margin: 0 !important;
                    padding: 0 !important;
                    line-height: 0 !important;
                  }
                  ul, ol {
                    max-width: 100%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    margin-left: 1.5rem !important;
                  }
                  ul ul, ol ol {
                    margin-left: 2rem !important;
                    list-style: none !important;
                  }
                  ul ul ul, ol ol ol {
                    margin-left: 2rem !important;
                    list-style: none !important;
                  }
                  ul ul li, ol ol li {
                    list-style: none !important;
                  }
                  li {
                    max-width: 100%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    margin-bottom: 0.5rem !important;
                  }
                  img { 
                    max-width: 100%; 
                    height: auto;
                    display: block;
                    margin: 10px auto;
                    cursor: pointer;
                    text-align: center;
                  }
                  img:hover {
                    opacity: 0.9;
                    outline: 2px solid #0891b2;
                  }
                  table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 12px 0;
                  }
                  td, th {
                    border: 1px solid #cccccc;
                    padding: 8px;
                  }
                  th {
                    background-color: #f0f0f0;
                    font-weight: bold;
                  }
                `,
                font_family_formats: 'Arial=Arial, sans-serif; Kalam=Kalam, cursive; Comic Sans MS=Comic Neue, cursive; Patrick Hand=Patrick Hand, cursive; Architects Daughter=Architects Daughter, cursive; Caveat=Caveat, cursive;',
                placeholder: 'Your generated notes will appear here. Use the toolbar to format text, add images, and customize your notes...',
                
                // Font family options including Kalam handwritten fonts
                font_formats: 
                  'Arial=Arial, Helvetica, sans-serif;' +
                  'Georgia=Georgia, serif;' +
                  'Times New Roman=Times New Roman, Times, serif;' +
                  'Courier New=Courier New, Courier, monospace;' +
                  'Comic Sans MS=Comic Sans MS, cursive;' +
                  'Trebuchet MS=Trebuchet MS, sans-serif;' +
                  'Verdana=Verdana, sans-serif;' +
                  'Impact=Impact, fantasy;' +
                  'Tahoma=Tahoma, sans-serif;' +
                  'Kalam Regular=Kalam;' +
                  'Kalam Light=KalamLight;' +
                  'Kalam Bold=KalamBold;',
                
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
