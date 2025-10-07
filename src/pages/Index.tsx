import { useState } from 'react';
import { FileText } from 'lucide-react';
import { PDFUploader } from '@/components/PDFUploader';
import { PDFViewer } from '@/components/PDFViewer';
import { PageSelector } from '@/components/PageSelector';
import { OCRProcessor } from '@/components/OCRProcessor';
import { NoteGenerator } from '@/components/NoteGenerator';
import { NotesEditor } from '@/components/NotesEditor';

const Index = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageRanges, setPageRanges] = useState('');
  const [ocrTexts, setOcrTexts] = useState<string[]>([]);
  const [generatedNotes, setGeneratedNotes] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <FileText className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">MedNotes AI</h1>
              <p className="text-sm text-muted-foreground">
                Transform Medical PDFs into Structured Notes
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {!pdfFile ? (
              <PDFUploader onFileSelect={setPdfFile} />
            ) : (
              <>
                <PDFViewer 
                  file={pdfFile} 
                  onPageCountChange={setTotalPages}
                />
                
                {totalPages > 0 && (
                  <PageSelector
                    totalPages={totalPages}
                    onSplit={setPageRanges}
                  />
                )}

                {pageRanges && (
                  <OCRProcessor
                    file={pdfFile}
                    pageRanges={pageRanges}
                    onOCRComplete={setOcrTexts}
                  />
                )}

                {ocrTexts.length > 0 && (
                  <NoteGenerator
                    ocrTexts={ocrTexts}
                    onNotesGenerated={setGeneratedNotes}
                  />
                )}
              </>
            )}
          </div>

          {/* Right Column */}
          <div>
            {generatedNotes && (
              <NotesEditor
                content={generatedNotes}
                onContentChange={setGeneratedNotes}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
