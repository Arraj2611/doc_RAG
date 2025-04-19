import { useContext, useState } from "react";
import { MessageType } from "@/types";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Copy, Save, RefreshCw, AlertTriangle, FileText, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DocumentContext } from "@/contexts/DocumentContext";
import ChatLoadingAnimation from "./ChatLoadingAnimation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './markdown-styles.css';

interface ChatMessageProps {
  message: MessageType;
  isLast: boolean;
}

export default function ChatMessage({ message, isLast }: ChatMessageProps) {
  const { toast } = useToast();
  const docContext = useContext(DocumentContext);
  const { user } = useAuth();

  if (!docContext) {
    console.error("ChatMessage must be used within a DocumentProvider");
    return null;
  }
  const { saveInsight, goToPdfPage } = docContext;

  const handleCopy = () => {
    if (message.content && !message.error) {
        navigator.clipboard.writeText(message.content);
        toast({
          title: "Copied to clipboard",
          description: "Message content has been copied.",
          duration: 2000,
        });
    } else if (message.error) {
         toast({ title: "Cannot Copy", description: "Cannot copy error message.", duration: 2000, variant: "destructive" });
    } else {
         toast({ title: "Cannot Copy", description: "No content to copy.", duration: 2000 });
    }
  };
  
  const handleSave = () => {
    if (message.content && !message.error) {
        saveInsight(message.content);
    } else if (message.error) {
        toast({ title: "Cannot Save", description: "Cannot save error message as insight.", duration: 3000, variant: "destructive" });
    } else {
        toast({ title: "Cannot Save", description: "No content to save as insight.", duration: 3000 });
    }
  };

  const handleRegenerate = () => {
    toast({ title: "Not Implemented", description: "Regenerate functionality is not yet available.", duration: 3000 });
  };

  const messageVariants = {
    initial: { 
      opacity: 0, 
      y: 10 
    },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3 
      }
    },
    exit: { 
      opacity: 0,
      transition: { 
        duration: 0.2 
      }
    }
  };

  const isOnlyCursor = message.content === "▌";

  const handleSourceClick = (pageStr: string) => {
    console.log(`[ChatMessage] handleSourceClick called with pageStr: ${pageStr}`);
    const pageNum = parseInt(pageStr, 10);
    if (!isNaN(pageNum) && pageNum > 0) {
        console.log(`[ChatMessage] Parsed pageNum: ${pageNum}, calling goToPdfPage...`);
        goToPdfPage(pageNum);
    } else {
        console.log(`[ChatMessage] Invalid page number: ${pageStr}`);
        toast({ title: "Info", description: "Page number not available for this source.", duration: 2000 });
    }
  };

  return (
    <motion.div
      className={cn(
        "flex items-start",
        message.sender === "user" && "justify-end"
      )}
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      {message.sender === "ai" && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-primary-foreground flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 8V4H8"></path>
              <rect width="16" height="12" x="4" y="8" rx="2"></rect>
              <path d="M2 14h2"></path>
              <path d="M20 14h2"></path>
              <path d="M15 13v2"></path>
              <path d="M9 13v2"></path>
            </svg>
          </div>
        </div>
      )}

      <div 
        className={cn(
          "rounded-lg p-4 max-w-[85%] space-y-3 transition-colors duration-200",
          "border",
          message.sender === "user" 
            ? "rounded-tr-none bg-primary/10 dark:bg-primary/20 border-primary/30 text-gray-800 dark:text-white" 
            : "rounded-tl-none bg-white/60 dark:bg-gray-800/50 border-gray-200/80 dark:border-gray-700/80 prose prose-sm dark:prose-invert max-w-none",
          message.error && "bg-red-50 dark:bg-red-900/30 border-red-500/50 dark:border-red-700/50"
        )}
      >
        {message.isLoading ? (
            <ChatLoadingAnimation type="generating" message="" duration={1500} />
        ) : message.content && !isOnlyCursor ? (
            message.sender === 'ai' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.error && typeof message.error === 'string' ? message.error : message.content}
                </ReactMarkdown>
            ) : (
                <div className={cn("whitespace-pre-wrap", message.error ? "text-red-700 dark:text-red-300" : "text-gray-800 dark:text-white")}>
                    {message.error && typeof message.error === 'string' ? message.error : message.content}
                </div>
            )
        ) : message.error ? (
             <div className="text-red-700 dark:text-red-300 flex items-center">
                 <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0"/> 
                 <span>An error occurred.</span>
             </div>
        ) : null}

        {!message.isLoading && !message.error && message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
                  <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                  Sources ({message.citations.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 max-h-80 overflow-y-auto p-1 custom-scrollbar">
                 <Accordion type="single" collapsible className="w-full">
                      {message.citations.map((citation, index) => (
                          <AccordionItem value={`item-${index}`} key={index} className="border-b-0">
                              <AccordionTrigger 
                                  className="text-xs p-2 hover:bg-primary/10 hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-left w-full"
                                  onClick={(e) => {
                                      if (citation.page !== 'N/A') {
                                          console.log("[ChatMessage] AccordionTrigger clicked!");
                                          handleSourceClick(citation.page); 
                                      } else {
                                          e.preventDefault();
                                      }
                                  }}
                                  disabled={citation.page === 'N/A'}
                                  title={citation.page === 'N/A' ? "Page number not available" : `Go to page ${citation.page}`}
                              >
                                  <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                                  <span className="flex-1 text-gray-800 dark:text-gray-200">
                                      {citation.text}
                                  </span>
                              </AccordionTrigger>
                              <AccordionContent className="p-2 pt-0 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/30 rounded-b-md">
                                  Page: {citation.page}
                                  <br/>
                                  {citation.text}
                              </AccordionContent>
                          </AccordionItem>
                      ))}
                 </Accordion>
              </PopoverContent>
            </Popover>
          </div>
        )}
        
        {message.sender === "ai" && !message.isLoading && !message.error && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 mt-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
              onClick={handleCopy}
              disabled={!message.content || isOnlyCursor}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
              onClick={handleSave}
              disabled={!message.content || isOnlyCursor}
            >
              <Save className="h-3 w-3 mr-1" />
              Save Insight
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
              onClick={handleRegenerate}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
          </div>
        )}
      </div>

      {message.sender === "user" && (
        <div className="flex-shrink-0 ml-3">
          <Avatar className="w-8 h-8 bg-gray-200 dark:bg-gray-700">
            <AvatarFallback>
               {(user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </motion.div>
  );
}
