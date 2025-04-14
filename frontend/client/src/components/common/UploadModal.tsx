import { useState, useCallback, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { useDocuments } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const { uploadDocument, processDocument } = useDocuments();
  const modalRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filteredFiles = acceptedFiles.filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/')
    );
    
    if (filteredFiles.length !== acceptedFiles.length) {
      toast({
        title: "Invalid file format",
        description: "Only PDF and image files are supported",
        variant: "destructive",
      });
    }
    
    setFiles(prev => [...prev, ...filteredFiles]);
  }, [toast]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
  });
  
  // Remove a file from the list
  const removeFile = (fileToRemove: File) => {
    setFiles(files.filter(file => file !== fileToRemove));
  };
  
  // Clear all files
  const clearFiles = () => {
    setFiles([]);
    setUploadStatus("idle");
    setUploadProgress(0);
  };
  
  // Handle upload
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    const token = localStorage.getItem('token');
    
    console.log("Auth status before upload:", { 
      hasUser: !!user, 
      hasToken: !!token,
      userId: user?.id
    });
    
    setUploading(true);
    setUploadStatus("uploading");
    
    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 300);
    
    try {
      console.log("Starting upload of", files.length, "files");
      
      // Generate a session ID for this upload
      const sessionId = uuidv4();
      console.log("Using session ID:", sessionId);
      
      // Upload the files one by one
      for (const file of files) {
        await uploadDocument(file, { sessionId });
        console.log(`Uploaded file: ${file.name}`);
      }
      
      // Complete progress
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus("success");
      
      setTimeout(() => {
        onClose();
        clearFiles();
        setUploading(false);
        setUploadStatus("idle");
        setUploadProgress(0);
      }, 1500);
      
    } catch (error) {
      console.error("Upload error:", error);
      clearInterval(progressInterval);
      setUploadStatus("error");
      setUploading(false);
      
      toast({
        title: "Upload failed",
        description: "There was an error uploading your files. Check console for details.",
        variant: "destructive",
      });
    }
  };
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !uploading) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, uploading]);
  
  // Handle escape key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
    }
    
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose, uploading]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <motion.div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl p-6 overflow-hidden"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Upload Documents</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            disabled={uploading}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? "border-primary/80 bg-primary/10" 
              : "border-gray-300 dark:border-gray-600 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-3">
            <Upload className="h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Drag & Drop files here</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Supports PDF and image files</p>
            <Button variant="outline" type="button" className="mt-2">
              Browse Files
            </Button>
          </div>
        </div>
        
        {/* File list */}
        {files.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Files to upload ({files.length})</h3>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file, index) => (
                <div 
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md"
                >
                  <div className="flex items-center">
                    <div className="bg-gray-200 dark:bg-gray-600 h-10 w-10 rounded-md flex items-center justify-center mr-3">
                      <FileText className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate max-w-[300px]">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeFile(file)}
                    disabled={uploading}
                    className="h-8 w-8 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Upload progress */}
        {uploadStatus !== "idle" && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {uploadStatus === "uploading" ? "Uploading..." : 
                 uploadStatus === "processing" ? "Processing..." : 
                 uploadStatus === "success" ? "Upload Complete" :
                 "Upload Failed"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            <div className="mt-2 flex items-center">
              {uploadStatus === "uploading" || uploadStatus === "processing" ? (
                <Loader className="h-4 w-4 animate-spin text-primary mr-2" />
              ) : uploadStatus === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {uploadStatus === "uploading" ? "Uploading documents to server..." : 
                 uploadStatus === "processing" ? "Processing documents..." : 
                 uploadStatus === "success" ? "Documents uploaded successfully!" :
                 "Failed to upload documents. Please try again."}
              </span>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={clearFiles}
            disabled={files.length === 0 || uploading}
          >
            Clear All
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? (
              <>
                <Loader className="h-4 w-4 animate-spin mr-2" />
                {uploadStatus === "uploading" ? "Uploading..." : "Processing..."}
              </>
            ) : (
              <>Upload {files.length > 0 ? `(${files.length})` : ""}</>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
