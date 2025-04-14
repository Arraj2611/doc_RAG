import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Document {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    type?: string;
    size?: number;
    pages?: number;
    status?: 'processing' | 'ready' | 'error';
    error?: string;
}

interface DocumentStore {
    documents: Document[];
    searchResults: Document[];
    isLoading: boolean;
    error: string | null;
    selectedDocument: Document | null;
    searchDocuments: (query: string) => Promise<void>;
    setDocuments: (documents: Document[]) => void;
    setSelectedDocument: (document: Document | null) => void;
    addDocument: (document: Document) => void;
    updateDocument: (id: string, updates: Partial<Document>) => void;
    deleteDocument: (id: string) => void;
    clearError: () => void;
}

export const useDocumentStore = create<DocumentStore>()(
    persist(
        (set, get) => ({
            documents: [],
            searchResults: [],
            isLoading: false,
            error: null,
            selectedDocument: null,

            searchDocuments: async (query: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`/api/documents/search?q=${encodeURIComponent(query)}`);
                    if (!response.ok) {
                        throw new Error('Failed to search documents');
                    }
                    const data = await response.json();
                    set({ searchResults: data, isLoading: false });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'An error occurred while searching',
                        isLoading: false
                    });
                }
            },

            setDocuments: (documents) => set({ documents }),

            setSelectedDocument: (document) => set({ selectedDocument: document }),

            addDocument: (document) =>
                set((state) => ({
                    documents: [...state.documents, document]
                })),

            updateDocument: (id, updates) =>
                set((state) => ({
                    documents: state.documents.map((doc) =>
                        doc.id === id ? { ...doc, ...updates } : doc
                    ),
                    selectedDocument: state.selectedDocument?.id === id
                        ? { ...state.selectedDocument, ...updates }
                        : state.selectedDocument,
                })),

            deleteDocument: (id) =>
                set((state) => ({
                    documents: state.documents.filter((doc) => doc.id !== id),
                    selectedDocument: state.selectedDocument?.id === id
                        ? null
                        : state.selectedDocument,
                })),

            clearError: () => set({ error: null }),
        }),
        {
            name: 'document-storage',
            partialize: (state) => ({
                documents: state.documents,
                selectedDocument: state.selectedDocument,
            }),
        }
    )
); 