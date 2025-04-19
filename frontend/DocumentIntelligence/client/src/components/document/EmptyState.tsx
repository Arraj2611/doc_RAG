import { motion } from "framer-motion";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onUploadClick: () => void;
}

export default function EmptyState({ onUploadClick }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col items-center justify-center text-center p-6"
    >
      <div className="rounded-2xl p-8 max-w-md bg-white/10 dark:bg-gray-900/20 backdrop-blur-xl shadow-sm border border-gray-200/50 dark:border-gray-700/50">
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 bg-primary-100 dark:bg-gray-700 p-4 rounded-full inline-flex mx-auto"
        >
          <FileText className="h-10 w-10 text-primary" />
        </motion.div>
        <h2 className="text-2xl font-display font-bold text-gray-800 dark:text-white mb-2">No Document Selected</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Upload a PDF document or select one from your library to start analyzing with AI</p>
        <Button size="lg" onClick={onUploadClick}>
          <Upload className="mr-2 h-5 w-5" />
          Upload Document
        </Button>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">or drag and drop a PDF file anywhere</p>
      </div>
    </motion.div>
  );
}
