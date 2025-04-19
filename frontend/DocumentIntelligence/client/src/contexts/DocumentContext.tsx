import { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { DocumentType, DocumentUploadOptions, TagType, CategoryType, UserType } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Import Zustand store and actions
import { useDocumentStore, DocumentState } from "@/store/documentStore"; 

// Import the new API service
import * as apiService from "@/lib/apiService";

// Define the Python API URL (should be in .env)
const PYTHON_API_URL = 'http://localhost:8088/api'; 
// Keep Node API URL if needed for metadata/auth
const NODE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Define type for saved insights (Keep for now, may move to own context/store)
export interface SavedInsight {
  id: string; // Maybe use Mongo ID later?
  content: string;
  session_id: string; // Link insight to session_id
  filename: string; // Store filename for context
  timestamp: string;
}

interface DocumentContextType {
  // State from Zustand store
  documents: DocumentState[];
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // State managed in context (if any remains, e.g., metadata, insights)
  documentTags: TagType[];
  categories: CategoryType[];
  currentUser: UserType | null;
  savedInsights: SavedInsight[];
  allUserInsights: SavedInsight[];
  isMetadataLoading: boolean; // Separate loading state for tags/categories
  isInsightsLoading: boolean; // Separate loading state for insights
  isAllInsightsLoading: boolean;
  targetPdfPage: number | null; // NEW: Target page for PDF viewer

  // Actions (combination of store actions and context-specific actions)
  setSelectedSessionId: (id: string | null) => void;
  uploadDocument: (file: File, options: DocumentUploadOptions) => Promise<string | null>; // Return session_id on success
  deleteDocument: (sessionId: string) => Promise<void>;
  clearSelectedDocument: () => void;
  saveInsight: (content: string) => Promise<void>; // Make async
  deleteInsight: (id: string) => Promise<void>; // Make async, needs backend integration
  refreshDocuments: () => Promise<void>; // Fetches from Python backend
  fetchInsights: (sessionId: string) => Promise<void>; // New action to fetch insights
  fetchAllUserInsightsAggregated: () => Promise<void>;
  goToPdfPage: (page: number | null) => void; // NEW: Action to navigate PDF
}

export const DocumentContext = createContext<DocumentContextType | null>(null);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Get state and actions from Zustand store
  const { 
      documents,
      selectedSessionId,
      isLoading: isDocumentStoreLoading,
      error: documentStoreError,
      setDocuments,
      setSelectedSessionId,
      addOrUpdateDocument,
      updateDocumentStatus,
      deleteDocument: deleteDocumentFromStore,
      clearError: clearDocumentStoreError
  } = useDocumentStore();

  // Local state for things not in documentStore (tags, categories, insights)
  const [documentTags, setDocumentTags] = useState<TagType[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>([]);
  const [allUserInsights, setAllUserInsights] = useState<SavedInsight[]>([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [isAllInsightsLoading, setIsAllInsightsLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null); // Context-specific errors
  const [targetPdfPage, setTargetPdfPage] = useState<number | null>(null); // NEW: State for target page

  // Combine loading states (example)
  const isLoading = isDocumentStoreLoading || isInsightsLoading || isAllInsightsLoading;
  // Combine errors (example)
  const error = documentStoreError || contextError;

  // Clear combined errors
  const clearError = () => {
      clearDocumentStoreError();
      setContextError(null);
  };

  // Helper function to get headers for Node.js API calls
  const getNodeApiHeaders = useCallback((): HeadersInit => {
    const token = localStorage.getItem('token'); // Assumes token stored by useAuth
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
        console.warn('No authentication token found for Node API call');
    }
    return headers;
  }, []);

  // Fetch documents from the PYTHON backend
  const fetchDocuments = useCallback(async () => {
    if (!user?.id) {
        console.log("fetchDocuments: No user or user ID, skipping fetch.");
        setDocuments([]); // Clear documents if no user
        return;
    } 
    
    useDocumentStore.setState({ isLoading: true, error: null }); // Use Zustand action directly
    
    try {
      // TODO: Pass user.id securely (or token if backend handles it)
      const backendDocuments = await apiService.getDocuments(String(user.id));
      
      // Map backend data to frontend DocumentState
      const frontendDocuments: DocumentState[] = backendDocuments.map(doc => ({
          session_id: doc.session_id,
          filename: doc.filename,
          user_id: doc.user_id,
          processed_at: doc.processed_at,
          status: 'ready', // Assume ready if fetched successfully
      }));

      setDocuments(frontendDocuments); // Update Zustand store
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch documents from backend';
      console.error("fetchDocuments error:", err);
      useDocumentStore.setState({ error: errorMessage, isLoading: false }); // Update Zustand store
      toast({
        title: "Error Fetching Documents",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
        useDocumentStore.setState({ isLoading: false }); 
    }
  }, [user?.id, setDocuments, toast]); 

  // Fetch Insights for a specific session - Moved BEFORE useEffect that uses it
  const fetchInsights = useCallback(async (sessionId: string) => {
    if (!user) return;
    setIsInsightsLoading(true);
    setContextError(null);
    try {
        const backendInsights = await apiService.getInsights(sessionId);
        const currentDoc = documents.find(d => d.session_id === sessionId);
        const frontendInsights: SavedInsight[] = backendInsights.map(i => ({
            id: i.id,
            content: i.insight,
            session_id: sessionId,
            filename: currentDoc?.filename || 'Unknown',
            timestamp: i.timestamp || new Date().toISOString(),
        }));
        setSavedInsights(frontendInsights);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch insights';
        console.error("Fetch insights error:", err);
        setContextError(errorMessage);
        toast({ title: "Error Fetching Insights", description: errorMessage, variant: "destructive" });
    } finally {
        setIsInsightsLoading(false);
    }
  }, [user, documents, toast]); // Dependencies for fetchInsights

  // Fetch tags and categories (still uses Node.js API for now)
  const fetchMetadata = useCallback(async () => {
    console.log("fetchMetadata is currently disabled.");
    setDocumentTags([]); // Ensure tags are empty
    setCategories([]); // Ensure categories are empty
    setIsMetadataLoading(false); // Ensure loading is false
    return Promise.resolve(); // Return resolved promise to match signature
  }, []);

  // Initial data fetch (documents)
  useEffect(() => {
    if (user) {
      console.log("User changed, fetching documents...");
      fetchDocuments();
      // Clear other session-specific data on user change
      setSavedInsights([]); 
      setAllUserInsights([]);
      setSelectedSessionId(null); 
    } else {
        // Clear everything if no user
        setDocuments([]);
        setDocumentTags([]);
        setCategories([]);
        setSavedInsights([]);
        setAllUserInsights([]);
        setSelectedSessionId(null);
        useDocumentStore.setState({ documents: [], selectedSessionId: null }); 
    }
  }, [user, fetchDocuments, setDocuments, setSelectedSessionId]);

  // Fetch insights when a document is selected
  useEffect(() => {
    if (selectedSessionId) {
      console.log(`[DocumentContext] Session selected: ${selectedSessionId}, fetching insights...`);
      fetchInsights(selectedSessionId);
    } else {
      // Clear insights when no document is selected
      setSavedInsights([]);
    }
  }, [selectedSessionId, fetchInsights]); // Dependency array includes fetchInsights

  // Upload document - Modified to use Python Backend
  const uploadDocument = async (file: File, options: DocumentUploadOptions): Promise<string | null> => {
    if (!user?.id) {
        toast({ title: "Error", description: "You must be logged in to upload.", variant: "destructive" });
        return null;
    }
    
    const generatedSessionId = uuidv4(); 
    const optimisticDoc: DocumentState = {
        session_id: generatedSessionId,
        filename: file.name,
        user_id: String(user.id),
        status: 'processing',
        processed_at: new Date().toISOString(), 
    };

    addOrUpdateDocument(optimisticDoc);

    try {
      console.log(`Uploading file ${file.name} with session ID ${generatedSessionId}`);
      await apiService.uploadFiles(generatedSessionId, [file]); 
      
      console.log(`Triggering processing for session ID ${generatedSessionId}`);
      const processResult = await apiService.processFiles(generatedSessionId, String(user.id));
      
      if (processResult.failed_files && processResult.failed_files.includes(file.name)) {
           throw new Error(`Processing failed for ${file.name}. ${processResult.message}`);
      }
      if (!processResult.processed_files || !processResult.processed_files.includes(file.name)) {
          console.warn(`File ${file.name} not in processed list: ${processResult.message}`);
          throw new Error(`Processing status uncertain for ${file.name}. ${processResult.message}`);
      }

      updateDocumentStatus(generatedSessionId, 'ready');
      
      toast({
        title: "Success",
        description: `Document '${file.name}' uploaded and processed successfully.`,
      });
      return generatedSessionId; 

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload or process document';
      console.error("Upload/Process error:", err);
      updateDocumentStatus(generatedSessionId, 'error', errorMessage);
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null; 
    } 
  };

  // Delete document - Needs backend endpoint
  const deleteDocument = async (sessionId: string) => {
    console.log(`[DocumentContext] Attempting to delete document with session ID: ${sessionId}`);
    // Find the document to potentially show filename in toast
    const docToDelete = documents.find(d => d.session_id === sessionId);
    const filename = docToDelete?.filename || `document (ID: ${sessionId.substring(0, 6)}...)`;

    try {
        // Show loading state specifically for deletion? (Optional)
        // useDocumentStore.setState({ isLoading: true }); 

        await apiService.deleteDocument(sessionId); // Call the API service
        
        // Remove from Zustand store
        deleteDocumentFromStore(sessionId);
        
        // If the deleted document was selected, clear the selection
        if (selectedSessionId === sessionId) {
            setSelectedSessionId(null);
        }
        
        toast({
            title: "Document Deleted",
            description: `Successfully deleted ${filename}.`,
        });
        console.log(`[DocumentContext] Successfully deleted document ${sessionId}`);

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
        console.error(`[DocumentContext] Failed to delete document ${sessionId}:`, err);
        // Update error state (optional)
        // useDocumentStore.setState({ error: errorMessage });
        toast({
            title: "Error Deleting Document",
            description: `Could not delete ${filename}. ${errorMessage}`,
            variant: "destructive",
        });
    } finally {
        // Ensure loading state is reset if it was set
        // useDocumentStore.setState({ isLoading: false }); 
    }
  };

  // Save insight - Modified for Python backend
  const saveInsight = async (content: string) => {
    if (!selectedSessionId) {
        toast({ title: "Error", description: "No document selected to save insight.", variant: "destructive" });
        return;
    }
    // Keep the check for selectedDoc if needed elsewhere, or remove if only used for filename previously
    // const selectedDoc = documents.find(d => d.session_id === selectedSessionId);
    // if (!selectedDoc) {
    //      toast({ title: "Error", description: "Selected document not found.", variant: "destructive" });
    //      return;
    // }

    setIsInsightsLoading(true);
    try {
        await apiService.saveInsight(selectedSessionId, content);
        // Instead of adding locally, refetch from the backend
        await fetchInsights(selectedSessionId);
        toast({ title: "Success", description: "Insight saved successfully." });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save insight';
        console.error("Save insight error:", err);
        setContextError(errorMessage);
        toast({ title: "Error Saving Insight", description: errorMessage, variant: "destructive" });
    } finally {
         setIsInsightsLoading(false);
    }
  };
  
  // Delete insight - Now with backend integration
  const deleteInsight = async (insightId: string) => {
    // Keep track of the insight being deleted for optimistic UI or rollback
    const insightToDelete = allUserInsights.find(i => i.id === insightId);
    if (!insightToDelete) {
        console.warn(`deleteInsight: Insight with ID ${insightId} not found in local state.`);
        // Optionally show a toast anyway, or just return
        toast({ title: "Error", description: "Insight not found.", variant: "destructive" });
        return;
    }

    // Optimistic UI: Remove immediately from state
    // setAllUserInsights(prev => prev.filter(insight => insight.id !== insightId));
    // Consider if `savedInsights` (for selected doc) also needs updating here
    // setSavedInsights(prev => prev.filter(insight => insight.id !== insightId));

    try {
        console.log(`[DocumentContext] Calling API to delete insight: ${insightId}`);
        await apiService.deleteInsight(insightId);
        
        // API call successful, confirm removal from state
        setAllUserInsights(prev => prev.filter(insight => insight.id !== insightId));
        // Also remove from selected session insights if it exists there
        setSavedInsights(prev => prev.filter(insight => insight.id !== insightId));

        toast({
          title: "Success",
          description: "Insight deleted successfully.",
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete insight from backend';
        console.error("Delete insight error:", err);
        setContextError(errorMessage);
        toast({ title: "Error Deleting Insight", description: errorMessage, variant: "destructive" });
        
        // Rollback Optimistic UI if needed (add the insight back)
        // setAllUserInsights(prev => [...prev, insightToDelete]);
        // setSavedInsights(prev => [...prev, insightToDelete]); 
    }
  };

  const clearSelectedDocument = () => {
      setSelectedSessionId(null);
      setTargetPdfPage(null); // Also clear target page
  };
  
  const refreshDocuments = fetchDocuments; 

  // Derive recent documents from Zustand store state
  const recentDocuments = useMemo(() => {
    // Sort comparing dates directly, handle undefined by treating them as oldest
    return [...documents]
      .sort((a, b) => {
        const dateA = a.processed_at ? new Date(a.processed_at).getTime() : Number.MIN_SAFE_INTEGER;
        const dateB = b.processed_at ? new Date(b.processed_at).getTime() : Number.MIN_SAFE_INTEGER;
        return dateB - dateA; // Sort descending (newest first)
      })
      .slice(0, 5);
  }, [documents]);

  // NEW: Fetch *all* insights by iterating through documents
  const fetchAllUserInsightsAggregated = useCallback(async () => {
    if (!user || documents.length === 0) {
        console.log("[fetchAllUserInsightsAggregated] No user or no documents to fetch insights for.");
        setAllUserInsights([]); // Clear if no user or documents
        return;
    }

    console.log("[fetchAllUserInsightsAggregated] Fetching all insights for user...");
    setIsAllInsightsLoading(true);
    setContextError(null);
    let aggregatedInsights: SavedInsight[] = [];

    try {
        // Use Promise.all to fetch insights for all documents concurrently
        const insightsPromises = documents.map(async (doc) => {
            try {
                const backendInsights = await apiService.getInsights(doc.session_id);
                // Filter out insights missing an ID before mapping
                return backendInsights
                  .filter(i => {
                      if (i.id === undefined || i.id === null) {
                          console.warn(`[fetchAllUserInsightsAggregated] Backend returned an insight without an ID for session ${doc.session_id}. Skipping it. Content:`, i.insight);
                          return false; // Exclude insight without ID
                      }
                      return true; // Include insight with ID
                  })
                  .map(i => ({
                    id: i.id,
                    content: i.insight,
                    session_id: doc.session_id,
                    filename: doc.filename,
                    timestamp: i.timestamp || new Date().toISOString(),
                }));
            } catch (err) {
                console.error(`Error fetching insights for session ${doc.session_id}:`, err);
                return []; // Return empty array for this session on error
            }
        });

        const results = await Promise.all(insightsPromises);
        aggregatedInsights = results.flat(); // Flatten the array of arrays

        setAllUserInsights(aggregatedInsights);
        console.log(`[fetchAllUserInsightsAggregated] Fetched ${aggregatedInsights.length} total insights.`);

    } catch (err) {
        // This catch might not be strictly necessary if errors are handled per-promise
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch all user insights';
        console.error("Fetch all insights aggregate error:", err);
        setContextError(errorMessage);
        setAllUserInsights([]); // Clear on major error
        toast({ title: "Error Fetching All Insights", description: errorMessage, variant: "destructive" });
    } finally {
        setIsAllInsightsLoading(false);
    }
  }, [user, documents, toast]); // Depends on user and the list of documents

  // NEW: Function to set target page
  const goToPdfPage = (page: number | null) => {
      console.log(`[DocumentContext] goToPdfPage called with page: ${page}`);
      setTargetPdfPage(page);
  };

  // Memoize context value
  const contextValue: DocumentContextType = useMemo(() => ({
        documents: documents,
        selectedSessionId: selectedSessionId,
        documentTags: documentTags,
        categories: categories,
        currentUser: user,
        savedInsights: savedInsights,
        allUserInsights: allUserInsights,
        isLoading: isLoading,
        error: error,
        isMetadataLoading: isMetadataLoading,
        isInsightsLoading: isInsightsLoading,
        isAllInsightsLoading: isAllInsightsLoading,
        targetPdfPage: targetPdfPage, // NEW
        setSelectedSessionId: setSelectedSessionId,
        uploadDocument: uploadDocument,
        deleteDocument: deleteDocument,
        clearSelectedDocument: clearSelectedDocument,
        saveInsight: saveInsight,
        deleteInsight: deleteInsight,
        refreshDocuments: refreshDocuments,
        fetchInsights: fetchInsights,
        fetchAllUserInsightsAggregated: fetchAllUserInsightsAggregated,
        goToPdfPage: goToPdfPage, // NEW
   }), [
       documents, selectedSessionId, documentTags, categories,
       user, savedInsights, allUserInsights, isLoading, error, isMetadataLoading, isInsightsLoading, isAllInsightsLoading,
       targetPdfPage,
       setSelectedSessionId, uploadDocument, deleteDocument, clearSelectedDocument,
       saveInsight, deleteInsight, refreshDocuments, fetchInsights, fetchAllUserInsightsAggregated, goToPdfPage
   ]);


  return (
    <DocumentContext.Provider value={contextValue}>
      {children}
    </DocumentContext.Provider>
  );
}

// Keep helper if needed elsewhere
// function formatFileSize(bytes: number): string { ... } 
