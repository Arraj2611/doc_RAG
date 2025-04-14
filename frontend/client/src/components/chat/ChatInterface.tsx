import { useChat } from "@/hooks/useChat";
import { useDocuments } from "@/hooks/useDocuments";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import ChatLoadingAnimation from "./ChatLoadingAnimation";
import { Textarea } from "@/components/ui/textarea";

export default function ChatInterface() {
  const { messages, sendMessage, isLoading } = useChat();
  const { selectedDocument, documents } = useDocuments();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const document = documents.find(doc => doc.id === selectedDocument);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() === "") return;
    
    sendMessage(inputValue);
    setInputValue("");
    
    // Reset textarea height
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
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const quickPrompts = [
    { text: "Summarize document" },
    { text: "Extract key insights" },
    { text: "Find tables & figures" }
  ];

  return (
    <div className="w-full h-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white/10 dark:bg-gray-900/40 backdrop-blur-xl">
      {/* Chat Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">Document Chat</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {document 
              ? `Ask questions about ${document.name}` 
              : "Upload a document to start chatting"}
          </p>
        </div>
        {/* Removed action buttons as requested */}
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
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
        
        {isLoading && (
          <AnimatePresence>
            <ChatLoadingAnimation 
              type={messages.length > 0 ? "generating" : "searching"}
              duration={2000}
              message={
                messages.length > 0 
                  ? "Generating response..." 
                  : "Searching document..."
              }
            />
          </AnimatePresence>
        )}
      </motion.div>
      
      {/* Chat Input */}
      <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-700">
        <div className="rounded-lg p-2 flex items-end bg-white/30 dark:bg-gray-800/30 backdrop-blur-md shadow-sm border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              placeholder={selectedDocument ? "Ask a question about your document..." : "Upload a document to start chatting"}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="w-full p-2 bg-transparent border-0 focus:ring-0 resize-none min-h-[60px] max-h-36 text-gray-800 dark:text-white"
              disabled={!selectedDocument || isLoading}
              rows={1}
              style={{ outline: "none" }}
            />
          </div>
          <div className="flex items-center px-2">
            <Button 
              size="icon" 
              className="rounded-full h-10 w-10"
              onClick={handleSendMessage}
              disabled={!selectedDocument || isLoading || inputValue.trim() === ""}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt, index) => (
            <Button
              key={index}
              variant="secondary"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => {
                setInputValue(prompt.text);
                if (textareaRef.current) {
                  textareaRef.current.focus();
                }
              }}
              disabled={!selectedDocument || isLoading}
            >
              {prompt.text}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
