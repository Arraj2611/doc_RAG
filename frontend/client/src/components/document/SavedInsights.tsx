import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ChevronLeft, Search, Trash2, Share2, FileText, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { useDocuments } from "@/hooks/useDocuments";

// Helper function to format time
function formatTimeAgo(timestamp: string) {
  try {
    const date = parseISO(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return timestamp;
  }
}

interface SavedInsightsProps {
  onBackToLibrary?: () => void;
}

export default function SavedInsights({ onBackToLibrary }: SavedInsightsProps) {
  const { savedInsights, deleteInsight } = useDocuments();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  
  // Sort insights by timestamp (newest first)
  const sortedInsights = [...savedInsights].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Filter insights based on search query
  const filteredInsights = sortedInsights.filter(insight => 
    insight.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    insight.documentName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const formatDate = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      return format(date, "MMM d, yyyy h:mm a");
    } catch (error) {
      return timestamp;
    }
  };
  
  const handleDeleteInsight = (e: React.MouseEvent, insightId: string) => {
    e.stopPropagation();
    deleteInsight(insightId);
    
    if (selectedInsightId === insightId) {
      setSelectedInsightId(null);
    }
  };
  
  return (
    <div className="h-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          Saved Insights
        </h3>
        {onBackToLibrary && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-1 text-sm" 
            onClick={onBackToLibrary}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Library
          </Button>
        )}
      </div>
      
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-500 dark:text-gray-400" />
        <Input
          type="text"
          placeholder="Search saved insights..."
          className="pl-10 py-6 text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {filteredInsights.length > 0 ? (
        <div className="space-y-4">
          {filteredInsights.map((insight) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`p-4 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                selectedInsightId === insight.id ? "bg-gray-50 dark:bg-gray-800 border-primary/50" : ""
              }`}
              onClick={() => setSelectedInsightId(
                selectedInsightId === insight.id ? null : insight.id
              )}
            >
              <div className="flex justify-between">
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="truncate font-medium">{insight.documentName}</span>
                    <span>•</span>
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatTimeAgo(insight.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                    {insight.content}
                  </p>
                </div>
                <div className="ml-4 flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                    onClick={(e) => handleDeleteInsight(e, insight.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {selectedInsightId === insight.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                  className="mt-4"
                >
                  <Separator className="my-3" />
                  <div className="text-sm text-gray-800 dark:text-gray-200 mb-4">
                    {insight.content}
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs h-9"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Copy to clipboard
                        navigator.clipboard.writeText(insight.content);
                        // Could add a toast here
                      }}
                    >
                      <Share2 className="h-3.5 w-3.5 mr-1.5" />
                      Copy to Clipboard
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs h-9"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Export insight as text
                        const text = `Insight from "${insight.documentName}"\n\n${insight.content}\n\nSaved ${formatDate(insight.timestamp)}`;
                        
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `insight-${format(parseISO(insight.timestamp), "yyyy-MM-dd")}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Export
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center p-10 border dark:border-gray-700 rounded-lg">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Bookmark className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium mb-2">No saved insights</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery 
              ? "No insights match your search query" 
              : "Save important insights from your documents to find them here"}
          </p>
          {onBackToLibrary && (
            <Button 
              variant="outline"
              onClick={onBackToLibrary}
              size="lg"
            >
              Browse Documents
            </Button>
          )}
        </div>
      )}
    </div>
  );
}