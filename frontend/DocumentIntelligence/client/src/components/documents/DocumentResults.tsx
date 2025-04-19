import React from 'react';
import { useDocumentStore } from '../../store/documentStore';
import { cn } from '@/lib/utils';

// Import the Document interface from the store file
interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const DocumentResults: React.FC = () => {
  const { searchResults, isLoading } = useDocumentStore();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No documents found. Try a different search query.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
        Search Results ({searchResults.length})
      </h3>
      <div className="grid gap-4">
        {searchResults.map((document: Document) => (
          <div 
            key={document.id}
            className={cn(
              "p-4 rounded-lg border border-gray-200 dark:border-gray-700",
              "bg-white dark:bg-gray-800",
              "hover:shadow-md transition-shadow duration-200",
              "cursor-pointer"
            )}
          >
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{document.title}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{document.content}</p>
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              {new Date(document.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentResults; 