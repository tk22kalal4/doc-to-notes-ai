export interface TextChunk {
  text: string;
  sourceIndex: number;
}

export function getRandomTextChunk(
  ocrTexts: string[],
  minWords: number = 50,
  maxWords: number = 200
): TextChunk {
  const allText = ocrTexts.join('\n\n');
  const words = allText.split(/\s+/);
  
  if (words.length === 0) {
    return { text: '', sourceIndex: -1 };
  }
  
  if (words.length <= minWords) {
    return { text: allText, sourceIndex: 0 };
  }
  
  const chunkSize = Math.min(
    Math.max(minWords, Math.floor(Math.random() * (maxWords - minWords)) + minWords),
    words.length
  );
  
  const maxStartIndex = words.length - chunkSize;
  const startIndex = Math.floor(Math.random() * maxStartIndex);
  
  const chunk = words.slice(startIndex, startIndex + chunkSize).join(' ');
  
  return {
    text: chunk,
    sourceIndex: startIndex
  };
}

export function getMultipleRandomChunks(
  ocrTexts: string[],
  count: number,
  minWords: number = 50,
  maxWords: number = 200
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const usedRanges = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let chunk: TextChunk;
    let attempts = 0;
    
    do {
      chunk = getRandomTextChunk(ocrTexts, minWords, maxWords);
      const rangeKey = `${chunk.sourceIndex}`;
      
      if (!usedRanges.has(rangeKey) || attempts > 10) {
        usedRanges.add(rangeKey);
        break;
      }
      
      attempts++;
    } while (attempts < 20);
    
    chunks.push(chunk);
  }
  
  return chunks;
}

export function shouldUseOCRText(
  ocrTexts: string[],
  requestedCount: number,
  currentIndex: number
): boolean {
  const totalWords = ocrTexts.join(' ').split(/\s+/).length;
  const estimatedQuestionsFromOCR = Math.floor(totalWords / 100);
  
  const useOCRRatio = Math.min(estimatedQuestionsFromOCR / requestedCount, 1);
  
  return currentIndex < requestedCount * useOCRRatio;
}
