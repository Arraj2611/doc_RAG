import { useContext } from "react";
import { DocumentContext } from "@/contexts/DocumentContext";
import { DocumentType, DocumentUploadOptions } from "@/types";

export function useDocuments() {
  const context = useContext(DocumentContext);
  
  if (!context) {
    throw new Error("useDocuments must be used within a DocumentProvider");
  }
  
  return context;
}
