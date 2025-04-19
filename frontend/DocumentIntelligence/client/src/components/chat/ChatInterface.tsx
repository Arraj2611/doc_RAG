import { useChat } from "@/hooks/useChat";
// import { useDocuments } from "@/hooks/useDocuments"; // Remove old hook
import { useContext, useState, useRef, useEffect } from "react"; // Added useContext
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import ChatLoadingAnimation from "./ChatLoadingAnimation";
import { Textarea } from "@/components/ui/textarea";
// Import context/store for document info
import { DocumentContext } from "@/contexts/DocumentContext";
import { useDocumentStore } from "@/store/documentStore";

export default function ChatInterface() {
  // Use useChat hook (accesses ChatContext)
  const chatContext = useChat();
  if (!chatContext) {
     throw new Error("ChatInterface must be used within a ChatProvider");
  }
  const { messages, sendMessage, isLoading, error } = chatContext; // Add error state
  
  // Use DocumentContext/Store to get selected session and document details
  // Prefer context if available, fallback to store (adjust as needed)
  const docContext = useContext(DocumentContext);
  const selectedSessionIdFromStore = useDocumentStore((state) => state.selectedSessionId);
  const documentsFromStore = useDocumentStore((state) => state.documents);
  
  // Use selectedSessionId from context if available, otherwise from store
  const selectedSessionId = docContext?.selectedSessionId ?? selectedSessionIdFromStore;
  // Use documents from context if available, otherwise from store
  const documents = docContext?.documents ?? documentsFromStore;
  
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Find the selected document based on selectedSessionId
  const selectedDoc = documents.find(doc => doc.session_id === selectedSessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() === "" || !selectedSessionId) return; // Check session ID
    
    sendMessage(inputValue);
    setInputValue("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Removed dummy quick prompts, can be added back if needed
  /*
  const quickPrompts = [...];
  */

  return (
    <div className="w-full h-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white/10 dark:bg-gray-900/40 backdrop-blur-xl">
      {/* Chat Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">Document Chat</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate" title={selectedDoc?.filename}>
            {/* Use selectedDoc and filename */} 
            {selectedDoc 
              ? `Ask questions about ${selectedDoc.filename}` 
              : "Select a document to start chatting"}
          </p>
        </div>
      </div>
      
      {/* Chat Messages */}
      <motion.div 
        className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id} // Use message ID from state
              message={message} // Pass the whole message object
              isLast={index === messages.length - 1}
            />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
        
        {/* Loading indicator at the bottom, might be redundant if ChatMessage handles isLoading */}
        {isLoading && messages[messages.length - 1]?.sender !== 'ai' && (
           <ChatLoadingAnimation type="generating" message="Generating response..." />
        )}
        {/* Display general chat error if any */} 
        {error && (
             <p className="text-center text-red-500 text-sm">Error: {error}</p>
        )}
      </motion.div>
      
      {/* Chat Input */}
      <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-700">
        <div className="rounded-lg p-2 flex items-end bg-white/30 dark:bg-gray-800/30 backdrop-blur-md shadow-sm border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              placeholder={selectedSessionId ? "Ask a question about your document..." : "Select a document to start chatting"}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="w-full p-2 bg-transparent border-0 focus:ring-0 resize-none min-h-[60px] max-h-36 text-gray-800 dark:text-white"
              // Disable if no session selected OR if chat context is loading
              disabled={!selectedSessionId || isLoading}
              rows={1}
              style={{ outline: "none" }}
            />
          </div>
          <div className="flex items-center px-2">
            <Button 
              size="icon" 
              className="rounded-full h-10 w-10"
              onClick={handleSendMessage}
              // Disable if no session selected OR loading OR no input
              disabled={!selectedSessionId || isLoading || inputValue.trim() === ""}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Removed Quick Actions/Prompts */}
        {/* 
        <div className="mt-4 flex flex-wrap gap-2"> ... </div>
        */}
      </div>
    </div>
  );
}
