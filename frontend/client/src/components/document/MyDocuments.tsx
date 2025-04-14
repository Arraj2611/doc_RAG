import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, ChevronLeft, FileUp, Search, Calendar, FileIcon, Trash2, Eye, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { useDocuments } from "@/hooks/useDocuments";
import { DocumentType } from "@/types";

interface MyDocumentsProps {
  onUploadClick: () => void;
  onBackToLibrary: () => void;
}

export default function MyDocuments({ onUploadClick, onBackToLibrary }: MyDocumentsProps) {
  const { documents, setSelectedDocument, deleteDocument } = useDocuments();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  
  // Sort documents by uploadedAt (newest first)
  const sortedDocuments = [...documents].sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  
  // Filter documents based on search query
  const filteredDocuments = sortedDocuments.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.metadata?.author && doc.metadata.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const formatDate = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      return format(date, "MMM d, yyyy h:mm a");
    } catch (error) {
      return timestamp;
    }
  };
  
  const getDocumentIcon = (type: string) => {
    if (type.includes("pdf")) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (type.includes("word") || type.includes("doc")) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    if (type.includes("excel") || type.includes("sheet") || type.includes("csv")) {
      return <FileText className="h-4 w-4 text-green-500" />;
    }
    if (type.includes("ppt") || type.includes("presentation")) {
      return <FileText className="h-4 w-4 text-orange-500" />;
    }
    return <FileIcon className="h-4 w-4" />;
  };
  
  const handleViewDocument = (e: React.MouseEvent, document: DocumentType) => {
    e.stopPropagation();
    setSelectedDocument(document.id);
    onBackToLibrary();
  };
  
  const handleDeleteDocument = (e: React.MouseEvent, document: DocumentType) => {
    e.stopPropagation();
    deleteDocument(document.id);
    
    if (selectedDocId === document.id) {
      setSelectedDocId(null);
    }
  };
  
  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-800 dark:text-white flex items-center gap-2">
          <FileText className="h-4 w-4" />
          My Documents
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 text-xs" 
          onClick={onBackToLibrary}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Library
        </Button>
      </div>
      
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
        <Input
          type="text"
          placeholder="Search documents..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {filteredDocuments.length > 0 ? (
        <div className="space-y-2">
          {filteredDocuments.map((document) => (
            <motion.div
              key={document.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                selectedDocId === document.id ? "bg-gray-50 dark:bg-gray-800 border-primary/50" : ""
              }`}
              onClick={() => setSelectedDocId(
                selectedDocId === document.id ? null : document.id
              )}
            >
              <div className="flex justify-between">
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 font-medium text-sm mb-1">
                    {getDocumentIcon(document.type)}
                    <span className="truncate">{document.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span>Uploaded {formatDate(document.uploadedAt)}</span>
                    <span>•</span>
                    <span>{document.size}</span>
                    <span>•</span>
                    <span>{document.pages} pages</span>
                  </div>
                </div>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-primary"
                    onClick={(e) => handleViewDocument(e, document)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                    onClick={(e) => handleDeleteDocument(e, document)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {selectedDocId === document.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                  className="mt-3"
                >
                  <Separator className="my-2" />
                  <div className="grid grid-cols-1 gap-2">
                    {document.metadata && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <div className="font-medium mb-1">Document Info</div>
                        {document.metadata.author && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="font-medium">Author:</span>
                            <span>{document.metadata.author}</span>
                          </div>
                        )}
                        {document.metadata.createdDate && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="font-medium">Created:</span>
                            <span>{formatDate(document.metadata.createdDate)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {document.tags && document.tags.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                          <Tag className="h-3 w-3" />
                          <span className="font-medium">Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {document.tags.map(tag => (
                            <Badge 
                              key={tag.id} 
                              variant="outline" 
                              className={`text-xs bg-${tag.color}-100 dark:bg-${tag.color}-900 text-${tag.color}-800 dark:text-${tag.color}-200`}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end items-center mt-2">
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="text-xs"
                        onClick={(e) => handleViewDocument(e, document)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View Document
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border dark:border-gray-700 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-1">No documents found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery 
              ? "No documents match your search query" 
              : "Upload documents to get started"}
          </p>
          <Button 
            variant="default"
            onClick={onUploadClick}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      )}
    </div>
  );
}