import React, { useContext } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Calendar, FileText } from 'lucide-react';
import { DocumentContext } from '@/contexts/DocumentContext';
import { DocumentState } from '@/store/documentStore';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Define props based on Dashboard usage (example, adjust as needed)
interface ChatHistoryProps {
  // No specific props needed for now
}

// Helper function (reuse or move to utils)
function formatDate(timestamp: string | undefined) {
  if (!timestamp) return 'N/A';
  try {
    const date = parseISO(timestamp);
    return format(date, "MMM d, yyyy h:mm a"); // Example format
  } catch (error) {
    return timestamp; 
  }
}

const ChatHistory: React.FC<ChatHistoryProps> = () => {
  const context = useContext(DocumentContext);
  
  if (!context) {
    return <div className="p-8">Error: DocumentContext not found.</div>; 
  }
  
  // Use documents as a proxy for chat sessions for now
  // TODO: Fetch actual chat sessions from backend when available
  const { documents, setSelectedSessionId, isLoading } = context;
  
  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    // Dashboard will handle switching view to show chat/pdf
  };
  
  // Sort documents (sessions) by processed date, newest first (example)
  const sortedSessions = [...documents].sort((a, b) => 
    new Date(b.processed_at || 0).getTime() - new Date(a.processed_at || 0).getTime()
  );

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
         <MessageSquare className="h-6 w-6 text-primary"/>
         Chat History
      </h2>
      
      {isLoading && sortedSessions.length === 0 ? (
         <div className="text-center p-12 text-gray-500 dark:text-gray-400">
           Loading chat history...
         </div>
      ) : sortedSessions.length === 0 ? (
        <div className="border border-dashed dark:border-gray-700 rounded-lg p-12 text-center bg-gray-50 dark:bg-gray-800/50">
          <p className="text-gray-500 dark:text-gray-400">
            No chat history found. Start chatting with a document!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map((session) => (
            <motion.div
              key={session.session_id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg cursor-pointer",
                "hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
              )}
              onClick={() => handleSessionClick(session.session_id)}
            >
              <div className="flex items-center overflow-hidden mr-4">
                <FileText className="h-5 w-5 mr-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div className='overflow-hidden'>
                  <p 
                    className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" 
                    title={session.filename}
                  >
                    Chat with: {session.filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
                     <Calendar className="h-3 w-3"/>
                     {/* TODO: Use last message timestamp when available */} 
                     Last activity: {formatDate(session.processed_at)} 
                  </p>
                </div>
              </div>
              {/* Optional: Add actions like delete history? */}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatHistory;