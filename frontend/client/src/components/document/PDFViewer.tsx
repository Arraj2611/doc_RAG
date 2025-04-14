import { useDocuments } from "@/hooks/useDocuments";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker
const pdfjsVersion = '3.4.120'; // Update this to match your installed version
const pdfjsWorker = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Get the API URL from environment
const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';

export default function PDFViewer() {
  const { selectedDocument, documents, clearSelectedDocument } = useDocuments();
  
  // Find document first to allow early return before hooks
  const document = documents.find(doc => doc.id === selectedDocument);

  // Early return before hooks are called
  if (!document) return null;
  
  const [zoomLevel, setZoomLevel] = useState(100);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pageRendering, setPageRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const renderPage = async (pageNum: number) => {
    if (!pdfDocument || !canvasRef.current) return;
    
    setPageRendering(true);
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoomLevel / 100 });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('Canvas context not available');
        return;
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      setPageRendering(false);
    } catch (error) {
      console.error('Error rendering PDF page:', error);
      setPageRendering(false);
    }
  };

  // Load PDF document
  useEffect(() => {
    if (!document || !document.id) return;
    
    const loadPDF = async () => {
      setPdfLoaded(false);
      
      try {
        // Extract the filename from the path to use with the API
        const fileName = document.id.split('/').pop() || document.id.split('\\').pop() || document.id;
        console.log(`Loading PDF with document ID: ${document.id}`);
        console.log(`Extracted filename: ${fileName}`);
        
        // Use API endpoint with just the filename
        const pdfUrl = `${API_URL}/api/documents/${encodeURIComponent(fileName)}/content`;
        console.log(`Requesting PDF from: ${pdfUrl}`);
        
        // Get token from localStorage for authentication
        const token = localStorage.getItem('fastapi_token');
        
        // Load PDF document using the API URL with authentication
        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          httpHeaders: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        const pdf = await loadingTask.promise;
        
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setPdfLoaded(true);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };
    
    loadPDF();
    
    return () => {
      // Clean up
      if (pdfDocument) {
        pdfDocument.destroy();
        setPdfDocument(null);
      }
    };
  }, [document]);

  // Render current page when zoom level or page changes
  useEffect(() => {
    if (pdfLoaded && !pageRendering) {
      renderPage(currentPage);
    }
  }, [currentPage, zoomLevel, pdfLoaded]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col"
    >
      {/* PDF Toolbar */}
      <div className="mb-4 rounded-lg p-2 flex items-center bg-white/10 dark:bg-gray-900/30 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={clearSelectedDocument}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h3 className="ml-2 font-medium text-gray-800 dark:text-white flex-1 truncate">
          {document.name}
        </h3>
        <div className="flex items-center space-x-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[60px] text-center">
            {currentPage} / {numPages}
          </span>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
          >
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 50}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[40px] text-center">
            {zoomLevel}%
          </span>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              const fileName = document.id.split('/').pop() || document.id.split('\\').pop() || document.id;
              window.open(`${API_URL}/api/documents/${encodeURIComponent(fileName)}/download`, '_blank')
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* PDF Viewer */}
      <Card className="flex-1 bg-white/10 dark:bg-gray-900/30 backdrop-blur-md p-4 border border-gray-200/50 dark:border-gray-700/50 overflow-auto">
        <CardContent className="flex items-center justify-center h-full p-0">
          <div 
            ref={pdfContainerRef}
            className="pdf-container overflow-auto"
          >
            {pdfLoaded ? (
              <canvas ref={canvasRef} className="shadow-lg mx-auto" />
            ) : (
              <div className="w-[595px] h-[842px] bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
