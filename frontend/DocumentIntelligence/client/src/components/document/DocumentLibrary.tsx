import { useContext } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Upload, FileText, Trash2, Share, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentContext } from "@/contexts/DocumentContext";
import { DocumentState } from "@/store/documentStore";
import ChatInterface from "../chat/ChatInterface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DocumentLibraryProps {
  onUploadClick: () => void;
}

export default function DocumentLibrary({ onUploadClick }: DocumentLibraryProps) {
  const docContext = useContext(DocumentContext);
  if (!docContext) {
    throw new Error("DocumentLibrary must be used within a DocumentProvider");
  }
  const { 
      documents, 
      setSelectedSessionId, 
      selectedSessionId,
      deleteDocument,
      isLoading
  } = docContext;

  const handleDocumentClick = (doc: DocumentState) => {
    setSelectedSessionId(doc.session_id);
  };
  
  const handleShareDocument = (e: React.MouseEvent, doc: DocumentState) => {
    e.stopPropagation();
    alert(`Share functionality for "${doc.filename}" would open here`);
  };
  
  const handleDeleteDocument = (e: React.MouseEvent, doc: DocumentState) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
      deleteDocument(doc.session_id);
    }
  };

  const getStatusIndicator = (status: DocumentState['status']) => {
      switch (status) {
          case 'processing':
              return <span title="Processing"><Loader2 className="h-4 w-4 text-blue-500 dark:text-blue-400 animate-spin" /></span>;
          case 'ready':
              return <span title="Completed"><CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /></span>;
          case 'error':
              return <span title="Error"><AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" /></span>;
          default:
              return <span title="Unknown"><FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" /></span>;
      }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="overflow-auto custom-scrollbar p-4 md:p-6"
    >
        {isLoading && documents.length === 0 && (
            <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                Loading documents...
            </div>
        )}
        
        {!isLoading && documents.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center h-full min-h-[200px]">
              <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">No documents found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Get started by uploading a new document.</p>
              <Button variant="default" onClick={onUploadClick} className="gap-1.5">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </div>
        ) : (
          <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <TableHead className="w-[60px] px-4 py-3 text-center text-gray-600 dark:text-gray-400">Status</TableHead>
                  <TableHead className="px-4 py-3 text-gray-600 dark:text-gray-400">Filename</TableHead>
                  <TableHead className="hidden md:table-cell px-4 py-3 text-gray-600 dark:text-gray-400">Processed</TableHead>
                  <TableHead className="text-right px-4 py-3 text-gray-600 dark:text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc) => (
                  <TableRow
                    key={doc.session_id}
                    onClick={() => handleDocumentClick(doc)}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      selectedSessionId === doc.session_id && "bg-muted hover:bg-muted"
                    )}
                  >
                    <TableCell className="px-4 py-3 text-center">
                        {getStatusIndicator(doc.status)}
                        {doc.status === 'error' && doc.error && <span className="sr-only">Error: {doc.error}</span>}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs md:max-w-md lg:max-w-lg truncate px-4 py-3 text-gray-800 dark:text-gray-100" title={doc.filename}>{doc.filename}</TableCell>
                    <TableCell className="hidden md:table-cell px-4 py-3 text-gray-600 dark:text-gray-400">
                      {doc.processed_at ? new Date(doc.processed_at).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right space-x-0 px-4 py-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                        onClick={(e) => handleShareDocument(e, doc)}
                        title="Share document"
                      >
                        <Share className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-500"
                        onClick={(e) => handleDeleteDocument(e, doc)}
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      
      {selectedSessionId && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Chat with Document</h3>
            <ChatInterface />
        </div>
      )}
    </motion.div>
  );
}
