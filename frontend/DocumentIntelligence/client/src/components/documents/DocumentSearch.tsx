import React, { useState } from 'react';
import { useDocumentStore } from '../../store/documentStore';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DocumentSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { searchDocuments, isLoading } = useDocumentStore();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }
    await searchDocuments(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <div className="relative flex items-center mb-6">
      <div className="relative w-full">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full py-2 pl-10 pr-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
        />
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        {searchQuery && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-10 top-1.5 h-6 w-6" 
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <Button 
        onClick={handleSearch}
        disabled={isLoading || !searchQuery.trim()}
        className="ml-2 bg-primary hover:bg-primary/90 text-white"
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
        ) : (
          "Search"
        )}
      </Button>
    </div>
  );
};

export default DocumentSearch; 