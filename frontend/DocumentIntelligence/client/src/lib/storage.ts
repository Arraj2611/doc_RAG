import { DocumentType } from "@/types";

// Storage keys
const DOCUMENTS_STORAGE_KEY = "documind_documents";

// Storage class for client-side storage
class ClientStorage {
  // Get all documents from storage
  async getDocuments(): Promise<DocumentType[]> {
    try {
      const storedDocuments = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
      return storedDocuments ? JSON.parse(storedDocuments) : [];
    } catch (error) {
      console.error("Error retrieving documents from storage:", error);
      return [];
    }
  }

  // Save documents to storage
  async saveDocuments(documents: DocumentType[]): Promise<void> {
    try {
      localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
    } catch (error) {
      console.error("Error saving documents to storage:", error);
    }
  }

  // Get a single document by ID
  async getDocument(id: string): Promise<DocumentType | undefined> {
    try {
      const documents = await this.getDocuments();
      return documents.find(doc => doc.id === id);
    } catch (error) {
      console.error("Error retrieving document from storage:", error);
      return undefined;
    }
  }

  // Delete a document by ID
  async deleteDocument(id: string): Promise<void> {
    try {
      const documents = await this.getDocuments();
      const updatedDocuments = documents.filter(doc => doc.id !== id);
      await this.saveDocuments(updatedDocuments);
    } catch (error) {
      console.error("Error deleting document from storage:", error);
    }
  }

  // Clear all documents
  async clearDocuments(): Promise<void> {
    try {
      localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing documents from storage:", error);
    }
  }
}

export const storage = new ClientStorage();
