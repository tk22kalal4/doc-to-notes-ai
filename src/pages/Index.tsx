import { useState } from 'react';
import { FileText, Upload, Scissors, ScanText, Sparkles, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PDFViewer } from '@/components/PDFViewer';
import { OCRProcessor } from '@/components/OCRProcessor';
import { NoteGenerator } from '@/components/NoteGenerator';
import { NotesEditor } from '@/components/NotesEditor';

const Index = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageRanges, setPageRanges] = useState('');
  const [showSplitInput, setShowSplitInput] = useState(false);
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrTexts, setOcrTexts] = useState<string[]>([]);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setPageRanges('');
      setOcrTexts([]);
      setGeneratedNotes('');
      setShowNotes(false);
    }
  };

  const handleSplitSubmit = () => {
    if (pageRanges.trim()) {
      setShowSplitInput(false);
    }
  };

  const handleOCRComplete = (texts: string[]) => {
    setOcrTexts(texts);
    setIsOCRProcessing(false);
  };

  const handleNotesGenerated = (notes: string) => {
    setGeneratedNotes(notes);
    setShowNotes(true);
  };

  const resetApp = () => {
    setPdfFile(null);
    setTotalPages(0);
    setPageRanges('');
    setShowSplitInput(false);
    setIsOCRProcessing(false);
    setOcrTexts([]);
    setIsGeneratingNotes(false);
    setGeneratedNotes('');
    setShowNotes(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex flex-col">
      {/* Compact Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <FileText className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-foreground">MedNotes AI</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Transform Medical PDFs into Structured Notes
                </p>
              </div>
            </div>
            {pdfFile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetApp}
                className="gap-2"
                data-testid="button-reset"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">New PDF</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {!pdfFile ? (
          /* Full Screen Upload */
          <div className="h-full flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">Upload Medical PDF</h2>
                <p className="text-muted-foreground">Start by uploading your PDF document</p>
              </div>
              
              <label
                htmlFor="pdf-upload"
                className="block w-full cursor-pointer"
                data-testid="label-upload"
              >
                <div className="border-2 border-dashed border-primary/30 rounded-2xl p-8 sm:p-12 hover:border-primary/60 hover:bg-primary/5 transition-all duration-200 text-center">
                  <Upload className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium mb-2">Click to browse</p>
                  <p className="text-sm text-muted-foreground">or drag & drop your PDF here</p>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-pdf-upload"
                  />
                </div>
              </label>
            </div>
          </div>
        ) : showNotes ? (
          /* Notes View */
          <div className="h-full p-4">
            <div className="h-full max-w-5xl mx-auto">
              <NotesEditor
                content={generatedNotes}
                onContentChange={setGeneratedNotes}
              />
            </div>
          </div>
        ) : (
          /* PDF View with Toolbar */
          <div className="h-full flex flex-col">
            {/* Compact Toolbar */}
            <div className="bg-card/80 backdrop-blur-sm border-b px-3 py-2 sm:px-4 sm:py-3">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Split Button */}
                  {!pageRanges && !showSplitInput && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSplitInput(true)}
                      className="gap-2"
                      data-testid="button-show-split"
                    >
                      <Scissors className="h-4 w-4" />
                      <span className="hidden sm:inline">Split Pages</span>
                      <span className="sm:hidden">Split</span>
                    </Button>
                  )}

                  {/* Split Input */}
                  {showSplitInput && !pageRanges && (
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <Input
                        placeholder="e.g., 1-5,7,10-12"
                        value={pageRanges}
                        onChange={(e) => setPageRanges(e.target.value)}
                        className="h-9 text-sm"
                        data-testid="input-page-ranges"
                      />
                      <Button size="sm" onClick={handleSplitSubmit} data-testid="button-split-submit">
                        Apply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSplitInput(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Page Info */}
                  {pageRanges && (
                    <div className="text-xs sm:text-sm text-muted-foreground bg-primary/5 px-3 py-1.5 rounded-md">
                      Pages: {pageRanges}
                    </div>
                  )}

                  {/* OCR Button */}
                  {pageRanges && ocrTexts.length === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsOCRProcessing(true)}
                      disabled={isOCRProcessing}
                      className="gap-2"
                      data-testid="button-start-ocr"
                    >
                      <ScanText className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {isOCRProcessing ? 'Processing...' : 'Extract Text'}
                      </span>
                      <span className="sm:hidden">OCR</span>
                    </Button>
                  )}

                  {/* Hidden OCR Processor */}
                  {isOCRProcessing && (
                    <div className="hidden">
                      <OCRProcessor
                        file={pdfFile}
                        pageRanges={pageRanges}
                        onOCRComplete={handleOCRComplete}
                      />
                    </div>
                  )}

                  {/* Generate Notes Button */}
                  {ocrTexts.length > 0 && (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => setIsGeneratingNotes(true)}
                      disabled={isGeneratingNotes}
                      data-testid="button-trigger-generate"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {isGeneratingNotes ? 'Generating...' : 'Generate Notes'}
                      </span>
                      <span className="sm:hidden">Generate</span>
                    </Button>
                  )}

                  {/* Hidden Note Generator */}
                  {isGeneratingNotes && (
                    <div className="hidden">
                      <NoteGenerator
                        ocrTexts={ocrTexts}
                        onNotesGenerated={handleNotesGenerated}
                      />
                    </div>
                  )}

                  {/* View Notes Button */}
                  {generatedNotes && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setShowNotes(true)}
                      className="gap-2"
                      data-testid="button-view-notes"
                    >
                      <Download className="h-4 w-4" />
                      View Notes
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* PDF Viewer - Full Screen with Vertical Scroll */}
            <div className="flex-1 overflow-hidden p-2 sm:p-4">
              <div className="h-full max-w-7xl mx-auto">
                <PDFViewer
                  file={pdfFile}
                  onPageCountChange={setTotalPages}
                  pageRanges={pageRanges}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
