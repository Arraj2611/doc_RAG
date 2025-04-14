import { MessageType } from "@/types";
import { motion } from "framer-motion";
import { Copy, Save, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/useDocuments";
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: MessageType;
  isLast: boolean;
}

export default function ChatMessage({ message, isLast }: ChatMessageProps) {
  const { toast } = useToast();
  const { saveInsight } = useDocuments();

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast({
      title: "Copied to clipboard",
      description: "Message content has been copied to your clipboard.",
      duration: 3000,
    });
  };
  
  const handleSave = () => {
    saveInsight(message.content);
    toast({
      title: "Insight saved",
      description: "This insight has been saved and can be viewed in the Saved Insights section.",
      duration: 3000,
    });
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
          "rounded-lg p-4 max-w-[85%] space-y-3 bg-white/10 dark:bg-gray-800/30 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50",
          message.sender === "user" 
            ? "rounded-tr-none bg-primary/10 dark:bg-primary/5 text-gray-800 dark:text-white" 
            : "rounded-tl-none"
        )}
      >
        {message.content && message.sender === "user" && (
          <div className="text-gray-800 dark:text-white whitespace-pre-line">
            {message.content}
          </div>
        )}
        
        {message.content && message.sender === "ai" && (
          <div className="text-gray-800 dark:text-white markdown-content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <ul className="list-disc pl-5 space-y-2 text-gray-800 dark:text-white">
            {message.citations.map((citation, index) => (
              <li key={index}>
                {citation.text}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="inline-flex items-center ml-1 text-xs text-primary hover:text-primary/80 p-0 h-auto"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="h-3 w-3 mr-1"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <span>{citation.page}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jump to this page in document</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </li>
            ))}
          </ul>
        )}
        
        {message.sender === "ai" && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs bg-gray-100/50 dark:bg-gray-800/50"
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs bg-gray-100/50 dark:bg-gray-800/50"
              onClick={handleSave}
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs bg-gray-100/50 dark:bg-gray-800/50"
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
            <AvatarImage src="/user-avatar.png" alt="User" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
      )}
    </motion.div>
  );
}
