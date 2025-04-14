import { useState } from "react";
import { motion } from "framer-motion";
import { History as HistoryIcon, ChevronLeft, Search, Trash2, MessageSquare, Download, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useChat } from "@/hooks/useChat";

interface ChatHistoryProps {
  onBackToLibrary: () => void;
}

export default function ChatHistory({ onBackToLibrary }: ChatHistoryProps) {
  const { chatHistory, loadSession, deleteSession } = useChat();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  
  // Sort chatHistory by timestamp (newest first)
  const sortedHistory = [...chatHistory].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Filter chat history based on search query
  const filteredHistory = sortedHistory.filter(session => 
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (session.documentName && session.documentName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const formatDate = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      return format(date, "MMM d, yyyy h:mm a");
    } catch (error) {
      return timestamp;
    }
  };
  
  const handleLoadSession = (sessionId: string) => {
    loadSession(sessionId);
    onBackToLibrary(); // Navigate back to chat interface
  };
  
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
    
    if (selectedSession === sessionId) {
      setSelectedSession(null);
    }
  };
  
  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-800 dark:text-white flex items-center gap-2">
          <HistoryIcon className="h-4 w-4" />
          Chat History
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 text-xs" 
          onClick={onBackToLibrary}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Library
        </Button>
      </div>
      
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
        <Input
          type="text"
          placeholder="Search chat history..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {filteredHistory.length > 0 ? (
        <div className="space-y-2">
          {filteredHistory.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                selectedSession === session.id ? "bg-gray-50 dark:bg-gray-800 border-primary/50" : ""
              }`}
              onClick={() => setSelectedSession(
                selectedSession === session.id ? null : session.id
              )}
            >
              <div className="flex justify-between">
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 font-medium text-sm mb-1">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(session.timestamp)}</span>
                    
                    {session.documentName && (
                      <>
                        <span>•</span>
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{session.documentName}</span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-red-500"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {selectedSession === session.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                  className="mt-3"
                >
                  <Separator className="my-2" />
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center mt-2">
                      <Badge variant="outline" className="text-xs">
                        {session.messages.length} messages
                      </Badge>
                      
                      <div className="space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-8"
                          onClick={() => handleLoadSession(session.id)}
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          Continue Chat
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-xs h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Export chat as text
                            const text = session.messages.map(msg => 
                              `[${msg.sender.toUpperCase()}]: ${msg.content}`
                            ).join('\n\n');
                            
                            const blob = new Blob([text], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `chat-${format(parseISO(session.timestamp), "yyyy-MM-dd")}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border dark:border-gray-700 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <HistoryIcon className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-1">No chat history</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery 
              ? "No chats match your search query" 
              : "Your chat history will appear here once you have conversations"}
          </p>
          <Button 
            variant="outline"
            onClick={onBackToLibrary}
          >
            Start a Chat
          </Button>
        </div>
      )}
    </div>
  );
}