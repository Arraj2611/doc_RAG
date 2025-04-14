import { useDocuments } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Trash2, MoreHorizontal, FileUp, Share } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentType } from "@/types";

interface DocumentLibraryProps {
  onUploadClick: () => void;
}

export default function DocumentLibrary({ onUploadClick }: DocumentLibraryProps) {
  const { documents, categories, setSelectedDocument, selectedDocument, deleteDocument } = useDocuments();
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredDocuments = activeCategory === "all" 
    ? documents 
    : documents.filter(doc => doc.categories?.includes(activeCategory));

  const handleDocumentClick = (document: DocumentType) => {
    setSelectedDocument(document.id);
  };
  
  const handleViewDocument = (e: React.MouseEvent, document: DocumentType) => {
    e.stopPropagation();
    setSelectedDocument(document.id);
  };
  
  const handleShareDocument = (e: React.MouseEvent, document: DocumentType) => {
    e.stopPropagation();
    // In a real app, this would open a share dialog
    alert(`Share functionality for "${document.name}" would open here`);
  };
  
  const handleDeleteDocument = (e: React.MouseEvent, document: DocumentType) => {
    e.stopPropagation();
    // Confirm before deleting
    if (window.confirm(`Are you sure you want to delete "${document.name}"?`)) {
      // Call deleteDocument function from context
      deleteDocument(document.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full overflow-auto custom-scrollbar"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-gray-800 dark:text-white">Document Library</h2>
        <p className="text-gray-500 dark:text-gray-400">Upload and manage your documents</p>
      </div>
      
      {/* Upload Section */}
      <div className="mb-8">
        <div 
          className="rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white/5 dark:bg-gray-800/5 backdrop-blur-md"
          onClick={onUploadClick}
        >
          <div className="text-center">
            <FileUp className="h-12 w-12 mx-auto text-primary mb-3" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Drag & Drop PDF Files</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">or click to browse from your computer</p>
            <Button onClick={(e) => {
              e.stopPropagation();
              onUploadClick();
            }}>
              Choose Files
            </Button>
          </div>
        </div>
      </div>
      
      {/* Recent Documents */}
      {documents.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Recent Documents</h3>
            <Button variant="link" className="text-sm text-primary hover:text-primary/80">
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.slice(0, 3).map((doc) => (
              <Card 
                key={doc.id}
                className={cn(
                  "overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-1",
                  "backdrop-blur-md bg-white/10 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700"
                )}
                onClick={() => handleDocumentClick(doc)}
              >
                <div className="aspect-w-3 aspect-h-4 bg-gray-100 dark:bg-gray-800 relative">
                  {doc.thumbnail ? (
                    <img 
                      src={doc.thumbnail} 
                      alt={`${doc.name} preview`} 
                      className="object-cover w-full h-48"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <FileText className="h-16 w-16 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="destructive" className="font-medium">PDF</Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-1 truncate">{doc.name}</h4>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span>{doc.size}</span>
                    <span className="mx-2">•</span>
                    <span>{doc.pages} Pages</span>
                    <span className="mx-2">•</span>
                    <span>{doc.uploadedAt}</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    {doc.tags?.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className={`bg-${tag.color}-100 dark:bg-${tag.color}-900/50 text-${tag.color}-800 dark:text-${tag.color}-200`}>
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Document Categories */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Categorized Documents</h3>
        
        <Card className="backdrop-blur-md bg-white/10 dark:bg-gray-900/20">
          <Tabs defaultValue="all" onValueChange={setActiveCategory}>
            <div className="border-b border-gray-200 dark:border-gray-700">
              <TabsList className="flex overflow-x-auto hide-scrollbar bg-transparent">
                <TabsTrigger value="all" className="text-sm">All Documents</TabsTrigger>
                {categories.map((category) => (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id}
                    className="text-sm"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            {/* All Documents Tab */}
            <TabsContent value="all" className="p-4">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {documents.length > 0 ? (
                  documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-2 cursor-pointer"
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <div className="flex-shrink-0">
                        <FileText className="h-6 w-6 text-red-500" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-white">{doc.name}</h4>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <span>{doc.size}</span>
                          <span className="mx-2">•</span>
                          <span>{doc.pages} Pages</span>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => handleViewDocument(e, doc)}
                          title="View document"
                        >
                          <FileText className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => handleShareDocument(e, doc)}
                          title="Share document"
                        >
                          <Share className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => handleDeleteDocument(e, doc)}
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No documents available.</p>
                    <Button variant="outline" onClick={onUploadClick} className="mt-2">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Document
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Category Tabs */}
            {categories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="p-4">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {documents.filter(doc => doc.categories?.includes(category.id)).length > 0 ? (
                    documents.filter(doc => doc.categories?.includes(category.id)).map((doc) => (
                      <div 
                        key={doc.id}
                        className="py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-2 cursor-pointer"
                        onClick={() => handleDocumentClick(doc)}
                      >
                        <div className="flex-shrink-0">
                          <FileText className="h-6 w-6 text-red-500" />
                        </div>
                        <div className="ml-4 flex-1">
                          <h4 className="text-sm font-medium text-gray-800 dark:text-white">{doc.name}</h4>
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <span>{doc.size}</span>
                            <span className="mx-2">•</span>
                            <span>{doc.pages} Pages</span>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => handleViewDocument(e, doc)}
                            title="View document"
                          >
                            <FileText className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => handleShareDocument(e, doc)}
                            title="Share document"
                          >
                            <Share className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => handleDeleteDocument(e, doc)}
                            title="Delete document"
                          >
                            <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No documents in this category.</p>
                      <Button variant="outline" onClick={onUploadClick} className="mt-2">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Document
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>
    </motion.div>
  );
}
