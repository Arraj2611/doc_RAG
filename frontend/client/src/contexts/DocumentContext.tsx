import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { DocumentType, DocumentUploadOptions, TagType, CategoryType, UserType } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { storage } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { documentApi, getFastApiToken } from "@/lib/api-client";

// Constants for API URLs (consider moving to a config file)
// Base URL for the FastAPI backend (documents, chat, processing)
const API_URL = import.meta.env.VITE_DOC_API_URL || 'http://localhost:8000';
// Base URL for the Express backend (auth, metadata)
const EXPRESS_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Define type for saved insights
interface SavedInsight {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  timestamp: string;
}

interface DocumentContextType {
  documents: DocumentType[];
  recentDocuments: DocumentType[];
  selectedDocument: string | null;
  documentTags: TagType[];
  categories: CategoryType[];
  currentUser: UserType | null;
  savedInsights: SavedInsight[];
  isLoading: boolean;
  error: string | null;
  setSelectedDocument: (id: string | null) => void;
  uploadDocument: (file: File, options: DocumentUploadOptions) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  clearSelectedDocument: () => void;
  saveInsight: (content: string) => void;
  deleteInsight: (id: string) => void;
  refreshDocuments: () => Promise<void>;
  processDocument: (id: string) => Promise<void>;
}

export const DocumentContext = createContext<DocumentContextType | null>(null);

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [documentTags, setDocumentTags] = useState<TagType[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get headers with auth token
  const getHeaders = useCallback(() => {
    const token = getFastApiToken();
    if (!token) {
      throw new Error('No authentication token found');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  // Fetch documents from the backend
  const fetchDocuments = useCallback(async () => {
    // Check if user is available before fetching
    if (!user) {
      // Optionally clear documents if user logs out
      setDocuments([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use RELATIVE path for Vite proxy
      const apiUrl = '/api/documents';
      console.log("Fetching documents via proxy path:", apiUrl);

      // Fetch token for FastAPI
      const token = getFastApiToken();
      if (!token) {
        // Don't throw an error immediately, maybe show a login prompt?
        // For now, log and set loading false
        console.error('No FastAPI authentication token found for fetching documents.');
        setError('Authentication token missing. Please log in again.');
        setDocuments([]); // Clear documents if token is missing
        setIsLoading(false);
        return;
        // Consider redirecting to login or showing a modal
        // throw new Error('No FastAPI authentication token found');
      }

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          // No need for Content-Type on GET
          'Accept': 'application/json' // Tell server we expect JSON
        }
      });

      // Check HTTP status first
      if (!response.ok) {
         console.error(`Document fetch failed with status: ${response.status} ${response.statusText}`);
         const errorText = await response.text(); // Attempt to read error body
         console.error("Error response body:", errorText);
         // Try to parse as JSON if possible, otherwise use text
         let detail = errorText;
         try {
           const errorJson = JSON.parse(errorText);
           detail = errorJson.detail || errorText;
         } catch (e) { /* Ignore parsing error, use raw text */ }

         setError(`Failed to fetch documents: ${response.status} ${response.statusText}. ${detail}`);
         setDocuments([]);
         setIsLoading(false);
         return;
      }

      // Check if response is JSON (redundant if Accept header is respected, but safe)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error(`Expected JSON response but got ${contentType}. Response text:`, responseText);
        setError(`Received invalid response format from server (${contentType}).`);
        setDocuments([]);
        setIsLoading(false);
        return;
      }

      // Parse the JSON response, expecting it to be the array directly
      const documentsArray = await response.json() as DocumentType[];
      console.log("Received documents data:", documentsArray); // Log received data

      // Check if the result is an array before setting state
      if (Array.isArray(documentsArray)) {
        console.log(`Setting documents state with ${documentsArray.length} items.`);
        setDocuments(documentsArray);
      } else {
        console.warn("Received data is not an array:", documentsArray);
        setError('Received unexpected data format for documents.');
        setDocuments([]);
      }
    } catch (err) {
      // Catch network errors or other exceptions during fetch/parsing
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching documents';
      console.error("Document fetch exception:", err);
      setError(errorMessage);
      toast({
        title: "Error Fetching Documents",
        description: errorMessage,
        variant: "destructive",
      });
      // Set empty documents to avoid undefined errors
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // Fetch tags and categories
  const fetchMetadata = useCallback(async () => {
    if (!user) return;

    try {
      // Use Express API URL for metadata (user-related)
      const expressApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const [tagsRes, categoriesRes] = await Promise.all([
        fetch(`${expressApiUrl}/api/metadata/tags`, {
          headers: getHeaders(),
        }),
        fetch(`${expressApiUrl}/api/metadata/categories`, {
          headers: getHeaders(),
        }),
      ]);

      // Check content type before parsing as JSON
      const checkResponse = async (response: Response) => {
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(`Expected JSON response but got ${contentType}`, await response.text());
          return []; // Return empty array on non-JSON response
        }

        if (!response.ok) {
          console.error(`API error: ${response.status} ${response.statusText}`);
          return [];
        }

        return response.json();
      };

      const [tags, cats] = await Promise.all([
        checkResponse(tagsRes),
        checkResponse(categoriesRes)
      ]);

      setDocumentTags(tags || []);
      setCategories(cats || []);
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
      // Set empty arrays to avoid undefined errors
      setDocumentTags([]);
      setCategories([]);
    }
  }, [user, getHeaders]);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchDocuments();
      fetchMetadata();
    }
  }, [user, fetchDocuments, fetchMetadata]);

  // Upload document to backend
  const uploadDocument = async (file: File, options?: DocumentUploadOptions): Promise<void> => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to upload documents",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a unique session ID for this upload
      const sessionId = options?.sessionId || uuidv4();
      console.log("Uploading document with session ID:", sessionId);

      // Show upload in progress toast
      toast({
        title: "Uploading",
        description: `Uploading ${file.name}...`,
      });

      // Upload the document
      const response = await documentApi.uploadDocuments([file], sessionId);
      console.log("Upload response:", response);

      // Show processing toast
      toast({
        title: "Processing",
        description: `Processing ${file.name}...`,
      });

      // Process the document
      try {
        const processResponse = await documentApi.processDocuments(sessionId);
        console.log("Document processed successfully:", processResponse);

        // Refresh documents to get processed data
        await fetchDocuments();

        toast({
          title: "Success",
          description: `Document ${file.name} uploaded and processed successfully.`,
        });
      } catch (processError) {
        console.error("Error processing document:", processError);
        toast({
          title: "Warning",
          description: `Document uploaded but processing failed: ${processError instanceof Error ? processError.message : 'Unknown error'}`,
          variant: "destructive",
        });

        // Still refresh to show the uploaded document
        await fetchDocuments();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Error",
        description: `Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Delete document
  const deleteDocument = async (id: string) => {
    if (!user) return;

    try {
      // Use the documentApi to delete documents
      await documentApi.deleteDocument(id);

      setDocuments(prev => prev.filter(doc => doc.id !== id));
      if (selectedDocument === id) {
        setSelectedDocument(null);
      }

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Save insight
  const saveInsight = (content: string) => {
    const newInsight: SavedInsight = {
      id: uuidv4(),
      content,
      documentId: selectedDocument || '',
      documentName: documents.find(d => d.id === selectedDocument)?.name || '',
      timestamp: new Date().toISOString(),
    };

    setSavedInsights(prev => [...prev, newInsight]);
    toast({
      title: "Success",
      description: "Insight saved successfully",
    });
  };

  // Delete insight
  const deleteInsight = (id: string) => {
    setSavedInsights(prev => prev.filter(insight => insight.id !== id));
    toast({
      title: "Success",
      description: "Insight deleted successfully",
    });
  };

  const clearSelectedDocument = () => setSelectedDocument(null);

  const recentDocuments = documents
    .sort((a, b) => {
      // Parse dates for comparison, handle potential errors
      try {
        const dateA = new Date(a.uploadedAt).getTime();
        const dateB = new Date(b.uploadedAt).getTime();
        return dateB - dateA; // Sort descending (newest first)
      } catch (e) {
        console.error("Error parsing date for sorting:", e);
        return 0; // Keep original order if dates are invalid
      }
    })
    .slice(0, 5);

  // Process document with RAG
  const processDocument = async (id: string) => {
    try {
      // Find the document
      const document = documents.find(doc => doc.id === id);
      if (!document) throw new Error("Document not found");

      // Create a session ID for this processing request
      const sessionId = uuidv4();

      // Call the backend API to process the document
      const response = await documentApi.processDocuments(sessionId);

      console.log('Document processing response:', response);

      // Update the document status in the local state
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === id ? { ...doc, processed: true } : doc
        )
      );

      toast({
        title: "Success",
        description: `Document processed successfully: ${response.processed_count} chunks created`,
      });

      // Refresh the documents list to get updated status
      await fetchDocuments();

    } catch (error) {
      console.error('Error processing document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error",
        description: `Failed to process document: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  // Sort documents by upload time (newest first)
  const sortedDocuments = useMemo(() => {
    // Make sure documents is always an array before sorting
    if (!Array.isArray(documents)) return [];

    return [...documents].sort((a, b) => {
      // Use uploadedAt instead of upload_time
      const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return dateB - dateA; // Sort descending (newest first)
    });
  }, [documents]);

  // Calculate total size
  const totalSize = useMemo(() => {
    if (!Array.isArray(documents)) return 0;
    return documents.reduce((acc, doc) => {
      // Assuming doc.size is a string like "1.23 MB"
      const match = doc.size?.match(/^(\d*\.?\d+)\s*(KB|MB|GB|TB)$/i);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        switch (unit) {
          case 'KB': return acc + value * 1024;
          case 'MB': return acc + value * 1024 * 1024;
          case 'GB': return acc + value * 1024 * 1024 * 1024;
          case 'TB': return acc + value * 1024 * 1024 * 1024 * 1024;
          default: return acc;
        }
      }
      return acc;
    }, 0);
  }, [documents]);

  // Convert total size to human-readable format
  const formattedTotalSize = useMemo(() => {
    return formatBytes(totalSize);
  }, [totalSize]);

  const value = {
    documents,
    recentDocuments,
    selectedDocument,
    documentTags,
    categories,
    currentUser: user as UserType | null,
    savedInsights,
    isLoading,
    error,
    setSelectedDocument,
    uploadDocument,
    deleteDocument,
    clearSelectedDocument,
    saveInsight,
    deleteInsight,
    refreshDocuments: fetchDocuments,
    processDocument,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}
