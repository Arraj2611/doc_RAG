import React, { useContext, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, ArrowLeft, FileText, Trash2, Calendar } from 'lucide-react';
import { DocumentContext } from '@/contexts/DocumentContext';
import { DocumentState } from '@/store/documentStore';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface MyDocumentsProps {
  // No specific props needed for basic functionality for now
}

function formatDate(timestamp: string | undefined) {
  if (!timestamp) return 'N/A';
  try {
    const date = parseISO(timestamp);
    return format(date, "MMM d, yyyy h:mm a");
  } catch (error) {
    return timestamp;
  }
}

const MyDocuments: React.FC<MyDocumentsProps> = () => {
  const context = useContext(DocumentContext);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  if (!context) {
    return <div className="p-8">Error: DocumentContext not found.</div>; 
  }
  
  const { documents, setSelectedSessionId, isLoading, deleteDocument } = context;
  
  const handleDocumentClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };
  
  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (sessionToDelete) {
      deleteDocument(sessionToDelete);
    }
    setIsDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-100">My Documents</h2>
      
      {isLoading && documents.length === 0 ? (
         <div className="text-center p-12 text-gray-500 dark:text-gray-400">
           Loading documents...
         </div>
      ) : documents.length === 0 ? (
        <div className="border border-dashed dark:border-gray-700 rounded-lg p-12 text-center bg-gray-50 dark:bg-gray-800/50">
          <p className="text-gray-500 dark:text-gray-400">
            You haven't uploaded any documents yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <motion.div
              key={doc.session_id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg cursor-pointer",
                "hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
              )}
              onClick={() => handleDocumentClick(doc.session_id)}
            >
              <div className="flex items-center overflow-hidden mr-4">
                <FileText className="h-6 w-6 mr-4 text-primary flex-shrink-0" />
                <div className='overflow-hidden'>
                  <p 
                    className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" 
                    title={doc.filename}
                  >
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
                     <Calendar className="h-3 w-3"/>
                     Processed: {formatDate(doc.processed_at)}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                 <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 dark:hover:text-red-500 transition-opacity"
                    onClick={(e) => handleDeleteClick(e, doc.session_id)}
                    title="Delete Document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              document, its associated chat history, and insights.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSessionToDelete(null)}>
                Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default MyDocuments;