import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Updated interface to match backend DocumentMetadata + frontend status
export interface DocumentState {
    session_id: string; // Use session_id as the main ID
    filename: string;
    user_id?: string | null;
    processed_at?: string; // Or Date if parsed
    // Add any other relevant frontend-specific state if needed
    status?: 'processing' | 'ready' | 'error'; // Keep status for UI feedback
    error?: string; // Keep error message for UI feedback
}

interface DocumentStore {
    documents: DocumentState[];
    // searchResults: DocumentState[]; // Remove if search is handled differently
    isLoading: boolean; // Keep loading state for fetching documents
    error: string | null; // Keep error state
    selectedSessionId: string | null; // Store only the ID of the selected document
    // searchDocuments: (query: string) => Promise<void>; // Remove this action
    setDocuments: (documents: DocumentState[]) => void; // Action to replace the whole list
    setSelectedSessionId: (sessionId: string | null) => void; // Action to set the selected ID
    addOrUpdateDocument: (document: DocumentState) => void; // Combined action
    updateDocumentStatus: (sessionId: string, status: DocumentState['status'], error?: string) => void; // Action to update status/error
    deleteDocument: (sessionId: string) => void; // Action to remove a document by ID
    clearError: () => void;
}

export const useDocumentStore = create<DocumentStore>()(
    persist(
        (set, get) => ({
            documents: [],
            // searchResults: [], // Removed
            isLoading: false,
            error: null,
            selectedSessionId: null,

            // Removed searchDocuments action
            /*
            searchDocuments: async (query: string) => {
                set({ isLoading: true, error: null });
                try {
                    // OLD CALL - REMOVED
                    // const response = await fetch(`/api/documents/search?q=${encodeURIComponent(query)}`);
                    // ... error handling ...
                    // set({ searchResults: data, isLoading: false });
                    console.warn("searchDocuments action is deprecated. Fetching is handled elsewhere.");
                     set({ isLoading: false }); // Reset loading state
                } catch (error) {
                    // ... error handling ...
                }
            },
            */

            setDocuments: (documents) => set({ documents, isLoading: false, error: null }),

            setSelectedSessionId: (sessionId) => set({ selectedSessionId: sessionId }),

            addOrUpdateDocument: (document) =>
                set((state) => {
                    const existingIndex = state.documents.findIndex(doc => doc.session_id === document.session_id);
                    let newDocuments;
                    if (existingIndex > -1) {
                        // Update existing document
                        newDocuments = [...state.documents];
                        newDocuments[existingIndex] = { ...newDocuments[existingIndex], ...document };
                    } else {
                        // Add new document
                        newDocuments = [...state.documents, document];
                    }
                    return { documents: newDocuments };
                }),

            updateDocumentStatus: (sessionId, status, error = undefined) =>
                set((state) => ({
                    documents: state.documents.map((doc) =>
                        doc.session_id === sessionId
                            ? { ...doc, status: status, error: error } // Update status and optional error
                            : doc
                    ),
                    // Also update selected document status if it matches
                    // selectedDocument: state.selectedDocument?.session_id === sessionId
                    //     ? { ...state.selectedDocument, status: status, error: error }
                    //     : state.selectedDocument,
                    // Simpler just to map the main list
                })),

            deleteDocument: (sessionId) =>
                set((state) => ({
                    documents: state.documents.filter((doc) => doc.session_id !== sessionId),
                    selectedSessionId: state.selectedSessionId === sessionId
                        ? null // Clear selection if deleted document was selected
                        : state.selectedSessionId,
                })),

            clearError: () => set({ error: null }),
        }),
        {
            name: 'document-session-storage', // Renamed storage key
            partialize: (state) => ({
                // Persist only documents list and selected ID
                documents: state.documents,
                selectedSessionId: state.selectedSessionId,
            }),
        }
    )
); 