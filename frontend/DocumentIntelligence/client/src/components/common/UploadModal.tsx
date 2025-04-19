import { useState, useRef, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload as UploadIcon, FileUp, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DocumentContext } from "@/contexts/DocumentContext";
import { DocumentUploadOptions } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const docContext = useContext(DocumentContext);
  if (!docContext) {
      throw new Error("UploadModal must be used within a DocumentProvider");
  }
  const { uploadDocument } = docContext;
  
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingGlobal, setIsUploadingGlobal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'processing' | 'success' | 'error'>>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setFilesToUpload([]);
        setUploadStatus({});
        setErrorMessages({});
        setIsUploadingGlobal(false);
        setIsDragging(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }, 300);
    } else {
        setFilesToUpload([]);
        setUploadStatus({});
        setErrorMessages({});
        setIsUploadingGlobal(false);
        setIsDragging(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  }, [isOpen]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files);
    }
  };

  const handleFileSelection = (fileList: FileList) => {
    const acceptedFiles: File[] = [];
    const currentStatus: Record<string, 'pending'> = {};
    
    const allowedTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (allowedTypes.includes(file.type.toLowerCase())) {
        if (!filesToUpload.some(existing => existing.name === file.name)) {
             acceptedFiles.push(file);
             currentStatus[file.name] = 'pending';
        }
      } else {
          toast({
            title: `Skipped: ${file.name}`,
            description: "Unsupported file format (PDF, TXT, DOCX only).",
            variant: "default",
            duration: 3000,
          });
      }
    }
    
    setFilesToUpload(prev => [...prev, ...acceptedFiles]);
    setUploadStatus(prev => ({ ...prev, ...currentStatus }));
  };

  const startUploadProcess = async () => {
      if (filesToUpload.length === 0) {
          toast({ 
              title: "No files", 
              description: "Please select files to upload.", 
              variant: "default"
            });
          return;
      }

      setIsUploadingGlobal(true);
      let successCount = 0;
      let errorCount = 0;

      const uploadPromises = filesToUpload.map(async (file) => {
          const fileName = file.name;
          if (uploadStatus[fileName] !== 'pending') return;

          setUploadStatus(prev => ({ ...prev, [fileName]: 'uploading' }));
          setErrorMessages(prev => { const copy = {...prev}; delete copy[fileName]; return copy; });

          try {
              const sessionId = await uploadDocument(file, {}); 
              
              if (sessionId) {
                  setUploadStatus(prev => ({ ...prev, [fileName]: 'success' }));
                  successCount++;
              } else {
                  throw new Error('Upload or processing failed. Backend returned null session ID.'); 
              }
          } catch (err) {
              const errorMsg = err instanceof Error ? err.message : "An unknown error occurred during upload.";
              console.error(`Error uploading ${fileName}:`, err);
              setUploadStatus(prev => ({ ...prev, [fileName]: 'error' }));
              setErrorMessages(prev => ({ ...prev, [fileName]: errorMsg }));
              errorCount++;
          }
      });

      await Promise.all(uploadPromises);

      setIsUploadingGlobal(false);

      if (errorCount === 0 && successCount > 0) {
           toast({ title: "Upload Complete", description: `${successCount} file(s) processed successfully.` });
      } else if (successCount > 0) {
           toast({ 
               title: "Upload Partially Complete", 
               description: `${successCount} file(s) processed, ${errorCount} failed.`,
               variant: "default"
           });
      } else if (errorCount > 0) {
           toast({ title: "Upload Failed", description: `All ${errorCount} file(s) failed to process.`, variant: "destructive" });
      }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const renderStatusIcon = (status: string | undefined) => {
      switch (status) {
          case 'uploading':
          case 'processing':
              return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
          case 'success':
              return <CheckCircle2 className="h-4 w-4 text-green-500" />;
          case 'error':
              return <AlertCircle className="h-4 w-4 text-red-500" />;
          default:
              return <FileText className="h-4 w-4 text-gray-400" />;
      }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload PDF, TXT, or DOCX files to analyze.
          </DialogDescription>
        </DialogHeader>
        
        <div
          className={`mt-4 border-2 border-dashed ${
            isDragging ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-600"
          } rounded-lg p-6 text-center transition-colors cursor-pointer`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!isUploadingGlobal ? handleBrowseClick : undefined}
        >
          <FileUp className="h-10 w-10 mx-auto text-primary mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Drag & drop files here or click to browse
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">Supported: PDF, TXT, DOCX</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="hidden"
            disabled={isUploadingGlobal}
          />
        </div>
        
        {filesToUpload.length > 0 && (
            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filesToUpload.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                       <div className="flex items-center space-x-2 overflow-hidden">
                           {renderStatusIcon(uploadStatus[file.name])}
                           <span className="truncate" title={file.name}>{file.name}</span>
                       </div>
                       {uploadStatus[file.name] === 'error' && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center space-x-1 text-red-500 cursor-help">
                                            <AlertCircle className="h-4 w-4"/> 
                                            <span className="text-xs">Failed</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{errorMessages[file.name] || 'Unknown error'}</p>
                                    </TooltipContent>
                                </Tooltip>
                           </TooltipProvider>
                       )}
                    </div>
                ))}
            </div>
        )}
        
        <div className="mt-auto pt-4 flex justify-end space-x-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={isUploadingGlobal}>
             Cancel
          </Button>
          <Button 
            onClick={startUploadProcess} 
            disabled={isUploadingGlobal || !filesToUpload.some(f => uploadStatus[f.name] === 'pending')}
          >
            {isUploadingGlobal ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Processing...
              </>
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                {filesToUpload.length > 0 ? `Upload ${filesToUpload.filter(f => uploadStatus[f.name] === 'pending').length} File(s)` : 'Upload'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
