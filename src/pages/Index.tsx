import { useState } from 'react';
import { FileText, Upload, Scissors, ScanText, Sparkles, X, Download, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PDFViewer } from '@/components/PDFViewer';
import { OCRProcessor } from '@/components/OCRProcessor';
import { NoteGenerator } from '@/components/NoteGenerator';
import { NotesEditor } from '@/components/NotesEditor';
import { AIChatbot } from '@/components/AIChatbot';
import { ImageUploader } from '@/components/ImageUploader';
import { ImageSequenceManager } from '@/components/ImageSequenceManager';
import { ImageViewer } from '@/components/ImageViewer';
import { ImageOCRProcessor } from '@/components/ImageOCRProcessor';
import { arrangeImagesIntoA4Pages } from '@/utils/imageToA4';

interface ImageItem {
  id: string;
  file: File;
  url: string;
}


const Index = () => {
  const [uploadMode, setUploadMode] = useState<'pdf' | 'image' | null>(null);
  
  // PDF states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageRanges, setPageRanges] = useState('');
  const [tempPageRanges, setTempPageRanges] = useState('');
  const [showSplitInput, setShowSplitInput] = useState(false);
  
  // Image states
  const [images, setImages] = useState<ImageItem[]>([]);
  const [showImageManager, setShowImageManager] = useState(false);
  const [a4Pages, setA4Pages] = useState<HTMLCanvasElement[]>([]);
  const [isArrangingPages, setIsArrangingPages] = useState(false);
  
  // Common states
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrTexts, setOcrTexts] = useState<string[]>([]);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrCurrentPage, setOcrCurrentPage] = useState(0);
  const [notesProgress, setNotesProgress] = useState(0);
  const [notesCurrentPage, setNotesCurrentPage] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const fileSizeMB = file.size / (1024 * 1024);
      
      if (fileSizeMB > 50) {
        const confirmUpload = window.confirm(
          `⚠️ Large File Warning\n\n` +
          `File size: ${fileSizeMB.toFixed(2)} MB\n\n` +
          `Large PDFs may:\n` +
          `• Take longer to load\n` +
          `• Use more memory\n` +
          `• Slow down performance\n\n` +
          `Recommended: Use smaller files or select specific page ranges.\n\n` +
          `Do you want to continue?`
        );
        
        if (!confirmUpload) {
          e.target.value = '';
          return;
        }
      }
      
      if (fileSizeMB > 500) {
        alert(
          `❌ File Too Large\n\n` +
          `File size: ${fileSizeMB.toFixed(2)} MB\n\n` +
          `Maximum supported size: 500 MB\n\n` +
          `Please:\n` +
          `• Use a smaller PDF\n` +
          `• Split the PDF into smaller parts\n` +
          `• Compress the PDF file`
        );
        e.target.value = '';
        return;
      }
      
      setUploadMode('pdf');
      setPdfFile(file);
      setPageRanges('');
      setOcrTexts([]);
      setGeneratedNotes('');
      setShowNotes(false);
    }
  };

  const handleImagesSelect = (files: File[]) => {
    const newImages: ImageItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      url: URL.createObjectURL(file)
    }));
    
    setImages(prev => [...prev, ...newImages]);
    setShowImageManager(true);
    setUploadMode('image');
  };

  const handleArrangeImages = async () => {
    if (images.length === 0) return;
    
    setIsArrangingPages(true);
    try {
      const imageData = images.map(img => ({ file: img.file, url: img.url }));
      const pages = await arrangeImagesIntoA4Pages(imageData);
      setA4Pages(pages);
      setShowImageManager(false);
    } catch (error) {
      console.error('Error arranging images:', error);
      alert('Failed to arrange images into pages. Please try again.');
    } finally {
      setIsArrangingPages(false);
    }
  };

  const validatePageRanges = (ranges: string): boolean => {
    if (!ranges.trim()) return false;
    
    // Valid formats: "1-3", "4-9", "1,2,3", "1-3,5,7-9"
    const rangePattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;
    if (!rangePattern.test(ranges.trim())) return false;
    
    // Validate page numbers are within bounds
    const parts = ranges.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (start < 1 || end > totalPages || start > end) return false;
      } else {
        const pageNum = Number(part);
        if (pageNum < 1 || pageNum > totalPages) return false;
      }
    }
    return true;
  };

  const handleSplitSubmit = () => {
    if (validatePageRanges(tempPageRanges)) {
      setPageRanges(tempPageRanges);
      setShowSplitInput(false);
    } else {
      alert(`Invalid page range! Please use format like "1-3" or "1,2,3" or "1-3,5-7"\nTotal pages: ${totalPages}`);
    }
  };

  const handleOCRComplete = (texts: string[]) => {
    setOcrTexts(texts);
    setIsOCRProcessing(false);
    setOcrProgress(0);
    setOcrCurrentPage(0);
  };

  const handleOCRProgress = (progress: number, currentPage: number) => {
    setOcrProgress(progress);
    setOcrCurrentPage(currentPage);
  };

  const handleNotesGenerated = (notes: string) => {
    setGeneratedNotes(notes);
    setShowNotes(true);
    setIsGeneratingNotes(false);
    setNotesProgress(0);
    setNotesCurrentPage(0);
  };

  const handleNotesProgress = (progress: number, currentPage: number) => {
    setNotesProgress(progress);
    setNotesCurrentPage(currentPage);
  };

  const resetApp = () => {
    setUploadMode(null);
    setPdfFile(null);
    setTotalPages(0);
    setPageRanges('');
    setShowSplitInput(false);
    setIsOCRProcessing(false);
    setOcrTexts([]);
    setIsGeneratingNotes(false);
    setGeneratedNotes('');
    setShowNotes(false);
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setShowImageManager(false);
    setA4Pages([]);
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
            {(pdfFile || images.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetApp}
                className="gap-2"
                data-testid="button-reset"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">New Upload</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {!uploadMode ? (
          /* Full Screen Upload - Mode Selection */
          <div className="h-full flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">Upload Medical Documents</h2>
                <p className="text-muted-foreground">Choose PDF or images to start</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* PDF Upload */}
                <label
                  htmlFor="pdf-upload"
                  className="block w-full cursor-pointer"
                  data-testid="label-upload"
                >
                  <div className="border-2 border-dashed border-primary/30 rounded-2xl p-8 hover:border-primary/60 hover:bg-primary/5 transition-all duration-200 text-center h-full">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <p className="text-lg font-medium mb-2">PDF Document</p>
                    <p className="text-sm text-muted-foreground">Upload a PDF file</p>
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

                {/* Image Upload */}
                <div onClick={() => document.getElementById('initial-image-upload')?.click()} className="cursor-pointer">
                  <div className="border-2 border-dashed border-accent/30 rounded-2xl p-8 hover:border-accent/60 hover:bg-accent/5 transition-all duration-200 text-center h-full">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 text-accent" />
                    <p className="text-lg font-medium mb-2">Medical Images</p>
                    <p className="text-sm text-muted-foreground">Upload one or multiple images</p>
                    <input
                      id="initial-image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          handleImagesSelect(Array.from(files));
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : showImageManager ? (
          /* Image Management View */
          <div className="h-full p-4">
            <div className="h-full max-w-4xl mx-auto space-y-4">
              <ImageSequenceManager 
                images={images}
                onImagesChange={setImages}
                onAddMore={() => document.getElementById('add-more-images')?.click()}
              />
              <input
                id="add-more-images"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    handleImagesSelect(Array.from(files));
                  }
                }}
                className="hidden"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleArrangeImages}
                  disabled={images.length === 0 || isArrangingPages}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  {isArrangingPages ? (
                    <>Processing...</>
                  ) : (
                    <>Arrange into Pages & Continue</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : showNotes ? (
          /* Notes View */
          <div className="h-full p-4">
            <div className="h-full max-w-5xl mx-auto">
              <NotesEditor
                content={generatedNotes}
                onContentChange={setGeneratedNotes}
                ocrTexts={ocrTexts}
              />
            </div>
          </div>
        ) : uploadMode === 'pdf' && pdfFile ? (
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
                        value={tempPageRanges}
                        onChange={(e) => setTempPageRanges(e.target.value)}
                        className="h-9 text-sm"
                        data-testid="input-page-ranges"
                      />
                      <Button size="sm" onClick={handleSplitSubmit} data-testid="button-split-submit">
                        Apply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setShowSplitInput(false);
                        setTempPageRanges('');
                      }}>
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

                  {/* OCR Button or Progress */}
                  {pageRanges && ocrTexts.length === 0 && !isOCRProcessing && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsOCRProcessing(true)}
                      disabled={isOCRProcessing}
                      className="gap-2"
                      data-testid="button-start-ocr"
                    >
                      <ScanText className="h-4 w-4" />
                      <span className="hidden sm:inline">Extract Text</span>
                      <span className="sm:hidden">OCR</span>
                    </Button>
                  )}

                  {/* OCR Progress */}
                  {isOCRProcessing && (
                    <div className="flex items-center gap-2 flex-1 max-w-md" data-testid="ocr-progress-container">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Processing page {ocrCurrentPage}...
                          </span>
                          <span className="font-medium text-primary">{Math.round(ocrProgress)}%</span>
                        </div>
                        <Progress value={ocrProgress} className="h-2" data-testid="progress-ocr" />
                      </div>
                    </div>
                  )}

                  {/* Hidden OCR Processor */}
                  {isOCRProcessing && (
                    <div className="hidden">
                      <OCRProcessor
                        file={pdfFile}
                        pageRanges={pageRanges}
                        onOCRComplete={handleOCRComplete}
                        onProgress={handleOCRProgress}
                      />
                    </div>
                  )}

                  {/* Generate Notes Button or Progress */}
                  {ocrTexts.length > 0 && !isGeneratingNotes && !generatedNotes && (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => setIsGeneratingNotes(true)}
                      disabled={isGeneratingNotes}
                      data-testid="button-trigger-generate"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span className="hidden sm:inline">Generate Notes</span>
                      <span className="sm:hidden">Generate</span>
                    </Button>
                  )}

                  {/* Notes Generation Progress */}
                  {isGeneratingNotes && (
                    <div className="flex items-center gap-2 flex-1 max-w-md" data-testid="notes-progress-container">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Generating page {notesCurrentPage} of {ocrTexts.length}...
                          </span>
                          <span className="font-medium text-accent">{Math.round(notesProgress)}%</span>
                        </div>
                        <Progress value={notesProgress} className="h-2" data-testid="progress-notes" />
                      </div>
                    </div>
                  )}

                  {/* Hidden Note Generator */}
                  {isGeneratingNotes && (
                    <div className="hidden">
                      <NoteGenerator
                        ocrTexts={ocrTexts}
                        onNotesGenerated={handleNotesGenerated}
                        onProgress={handleNotesProgress}
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
        ) : uploadMode === 'image' && a4Pages.length > 0 ? (
          /* Image View with Toolbar */
          <div className="h-full flex flex-col">
            {/* Compact Toolbar */}
            <div className="bg-card/80 backdrop-blur-sm border-b px-3 py-2 sm:px-4 sm:py-3">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Page Info */}
                  <div className="text-xs sm:text-sm text-muted-foreground bg-accent/5 px-3 py-1.5 rounded-md">
                    {a4Pages.length} page{a4Pages.length > 1 ? 's' : ''} created from {images.length} image{images.length > 1 ? 's' : ''}
                  </div>

                  {/* OCR Button or Progress */}
                  {ocrTexts.length === 0 && !isOCRProcessing && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsOCRProcessing(true)}
                      disabled={isOCRProcessing}
                      className="gap-2"
                      data-testid="button-start-image-ocr"
                    >
                      <ScanText className="h-4 w-4" />
                      <span className="hidden sm:inline">Extract Text</span>
                      <span className="sm:hidden">OCR</span>
                    </Button>
                  )}

                  {/* OCR Progress */}
                  {isOCRProcessing && (
                    <div className="flex items-center gap-2 flex-1 max-w-md" data-testid="image-ocr-progress-container">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Processing page {ocrCurrentPage}...
                          </span>
                          <span className="font-medium text-primary">{Math.round(ocrProgress)}%</span>
                        </div>
                        <Progress value={ocrProgress} className="h-2" data-testid="progress-image-ocr" />
                      </div>
                    </div>
                  )}

                  {/* Hidden OCR Processor */}
                  {isOCRProcessing && (
                    <div className="hidden">
                      <ImageOCRProcessor
                        pages={a4Pages}
                        onOCRComplete={handleOCRComplete}
                        onProgress={handleOCRProgress}
                      />
                    </div>
                  )}

                  {/* Generate Notes Button or Progress */}
                  {ocrTexts.length > 0 && !isGeneratingNotes && !generatedNotes && (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => setIsGeneratingNotes(true)}
                      disabled={isGeneratingNotes}
                      data-testid="button-trigger-generate-from-images"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span className="hidden sm:inline">Generate Notes</span>
                      <span className="sm:hidden">Generate</span>
                    </Button>
                  )}

                  {/* Notes Generation Progress */}
                  {isGeneratingNotes && (
                    <div className="flex items-center gap-2 flex-1 max-w-md" data-testid="image-notes-progress-container">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Generating page {notesCurrentPage} of {ocrTexts.length}...
                          </span>
                          <span className="font-medium text-accent">{Math.round(notesProgress)}%</span>
                        </div>
                        <Progress value={notesProgress} className="h-2" data-testid="progress-image-notes" />
                      </div>
                    </div>
                  )}

                  {/* Hidden Note Generator */}
                  {isGeneratingNotes && (
                    <div className="hidden">
                      <NoteGenerator
                        ocrTexts={ocrTexts}
                        onNotesGenerated={handleNotesGenerated}
                        onProgress={handleNotesProgress}
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
                      data-testid="button-view-notes-from-images"
                    >
                      <Download className="h-4 w-4" />
                      View Notes
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Image Viewer - Full Screen with Vertical Scroll */}
            <div className="flex-1 overflow-hidden p-2 sm:p-4">
              <div className="h-full max-w-7xl mx-auto">
                <ImageViewer pages={a4Pages} />
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* AI Chatbot - Shows after notes are generated */}
      {generatedNotes && ocrTexts.length > 0 && (
        <AIChatbot ocrTexts={ocrTexts} />
      )}
    </div>
  );
};

export default Index;
