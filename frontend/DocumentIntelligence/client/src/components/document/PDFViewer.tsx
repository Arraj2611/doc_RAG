import React, { useState, useCallback, useRef, useEffect, useContext } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Import react-pdf
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set workerSrc TO LOCAL PATH with .mjs extension
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

// Use DocumentState from store, assuming it will have fileUrl or enough info
// Use DocumentContext to get selectedSessionId and documents
import { DocumentContext } from "@/contexts/DocumentContext";
import { DocumentState } from "@/store/documentStore";

// Assuming PYTHON_BACKEND_URL is defined elsewhere and imported, or define it here
// import { PYTHON_BACKEND_URL } from '@/lib/apiService'; // Example import
const PYTHON_BACKEND_URL = 'http://localhost:8088/api'; // Define directly if not imported

export default function PDFViewer() {
  // Get state from DocumentContext
  const docContext = useContext(DocumentContext);
  if (!docContext) {
    throw new Error("PDFViewer must be used within a DocumentProvider");
  }
  const { 
      documents, 
      selectedSessionId, 
      setSelectedSessionId, // Use this to clear selection
      targetPdfPage,
      goToPdfPage
  } = docContext;
  
  // Find the selected document using selectedSessionId
  const document = documents.find(doc => doc.session_id === selectedSessionId);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null); // New state for page errors

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log('PDF Loaded successfully!');
    setNumPages(numPages);
    setPageNumber(1);
    setZoomLevel(1);
    setError(null); // Clear overall document error
    setPageError(null); // Clear any previous page error
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("Failed to load PDF Document:", error);
    setError(`Failed to load PDF: ${error.message}. Check backend logs and file path.`);
    setNumPages(null);
    setPageNumber(1);
    setPageError(null); // Clear page error too
  }, []);

  const onPageLoadError = useCallback((error: Error) => {
    console.error(`Failed to load page ${pageNumber}:`, error);
    setPageError(`Failed to load page ${pageNumber}: ${error.message}`);
    // Don't clear the overall document error here
  }, [pageNumber]); // Depend on pageNumber

  // Clear page error when page number changes
  useEffect(() => {
    setPageError(null);
  }, [pageNumber]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };
  
  const resetZoom = () => {
    setZoomLevel(1);
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  };

  // Construct the file URL using session_id, filename, AND PYTHON BACKEND URL
  const fileUrl = document 
    ? `${PYTHON_BACKEND_URL}/files/${document.session_id}/${encodeURIComponent(document.filename)}` 
    : null;

  // Reset state when document changes (selectedSessionId changes)
  useEffect(() => {
    console.log(`[PDFViewer] selectedSessionId changed to: ${selectedSessionId}. Resetting viewer state.`); // Add log
    setError(null);
    setNumPages(null);
    setPageNumber(1);
    setZoomLevel(1);
    goToPdfPage(null); // Still good to clear any lingering target from old doc
    // Remove goToPdfPage from dependencies - only run on session change
  }, [selectedSessionId]); 

  // NEW: Effect to handle external page navigation requests
  useEffect(() => {
    // Temporarily remove numPages check for debugging
    if (targetPdfPage !== null && targetPdfPage > 0 /* && targetPdfPage <= (numPages ?? 0) */) {
        console.log(`[PDFViewer] Navigating to page ${targetPdfPage} from context (numPages check skipped)...`);
        setPageNumber(targetPdfPage);
        // Reset the target page in context AFTER attempting navigation
        goToPdfPage(null);
    }
    // Temporarily remove numPages dependency for debugging
  }, [targetPdfPage, /* numPages, */ goToPdfPage]);

  // Use clearSelectedDocument (now named setSelectedSessionId(null))
  const handleClosePreview = () => {
    setSelectedSessionId(null);
  };

  // Handle case where no document is selected (selectedSessionId is null)
  if (!selectedSessionId || !document) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-4">
        Select a document from the library to view its preview.
      </div>
    );
  }
  
  // Handle case where fileUrl could not be constructed (shouldn't happen if document exists)
  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 p-4">
        Error: Could not determine file URL for preview. Invalid document data.
      </div>
    );
  }

  // Define the loading indicator component
  const pdfLoadingIndicator = (
     <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-gray-500 dark:text-gray-400">Loading PDF...</p>
     </div>
  );

  // Define the main error display component
   const pdfErrorDisplay = (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-red-600 dark:text-red-400 font-medium">Error loading preview</p>
          {/* Display the specific error message */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{error}</p> 
      </div>
  );

   // Define the page-specific error display component
   const pdfPageErrorDisplay = (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <AlertCircle className="h-6 w-6 text-orange-500 mb-2" />
          <p className="text-orange-600 dark:text-orange-400 font-medium">Error loading page</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pageError}</p> 
      </div>
  );

  // Add render log here
  console.log(`[PDFViewer Render] State: numPages=${numPages}, pageNumber=${pageNumber}, error=${error}, pageError=${pageError}, fileUrl=${fileUrl}`);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-4"
    >
      {/* PDF Toolbar */}
      <div className="flex-shrink-0 mb-3 rounded-lg p-1.5 flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={handleClosePreview}
          title="Close Preview"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h3 className="ml-2 font-medium text-gray-800 dark:text-white flex-1 truncate" title={document.filename}>
          {document.filename}
        </h3>
        {/* Page Navigation */} 
        <div className="flex items-center">
           <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                title="Previous Page"
            >
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-300 mx-2">
                 Page {pageNumber} of {numPages || '...'}
             </span>
             <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-8 w-8"
                 onClick={goToNextPage}
                 disabled={!numPages || pageNumber >= numPages}
                 title="Next Page"
             >
                 <ChevronRight className="h-5 w-5" />
             </Button>
        </div>
        <Separator orientation="vertical" className="h-6 mx-2" />
        {/* Zoom Controls */} 
        <div className="flex items-center space-x-0.5">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
            title="Zoom Out"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={resetZoom}
              title="Reset Zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 3}
            title="Zoom In"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          {/* Download Button */} 
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" asChild>
            <a href={fileUrl} download={document.filename}>
                 <Download className="h-4 w-4" />
             </a>
          </Button>
        </div>
      </div>
      
      {/* PDF Viewer Area */} 
      <div className="flex-1 overflow-auto custom-scrollbar bg-gray-200 dark:bg-gray-700 rounded flex items-start justify-center p-4">
         {/* Show main error first if it exists */}
         {error ? ( 
              pdfErrorDisplay
          ) : ( 
              <Document
                  key={fileUrl} // Add key to force re-render on file change
                  file={fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  className="pdf-document-container"
                  loading={pdfLoadingIndicator} // Pass loading indicator
                  error={pdfErrorDisplay} // Pass main error display component
              >
                  {/* Conditional rendering based on numPages AND pageError */}
                  {numPages && !pageError && (
                      <Page 
                          key={`${fileUrl}-page-${pageNumber}`} // Add key to page too
                          pageNumber={pageNumber} 
                          scale={zoomLevel} 
                          className="pdf-page-container shadow-lg"
                          loading="" // react-pdf handles page loading internally
                          onLoadError={onPageLoadError} // Add specific page load error handler
                          error={pdfPageErrorDisplay} // Pass page-specific error display
                      />
                  )}
                  {/* Show page error if it exists */}
                  {pageError && pdfPageErrorDisplay}
              </Document>
          )}
        </div>
    </motion.div>
  );
}
