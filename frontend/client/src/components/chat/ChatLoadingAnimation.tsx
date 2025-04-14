import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Brain, BookOpen, Zap, TerminalSquare } from "lucide-react";

interface ChatLoadingAnimationProps {
  message?: string;
  duration?: number; // in milliseconds, how long to show each animation state
  type?: "thinking" | "searching" | "generating";
}

export default function ChatLoadingAnimation({
  message = "Thinking...",
  duration = 1500,
  type = "thinking"
}: ChatLoadingAnimationProps) {
  const [dots, setDots] = useState("");
  const [currentMessage, setCurrentMessage] = useState(message);
  const [currentPhase, setCurrentPhase] = useState(0);
  
  // Dot animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // Type-specific animations and messages
  useEffect(() => {
    if (type === "thinking") {
      const thinkingPhrases = [
        "Analyzing context",
        "Processing information",
        "Formulating response",
        "Connecting ideas"
      ];
      
      const interval = setInterval(() => {
        setCurrentPhase(prev => (prev + 1) % thinkingPhrases.length);
        setCurrentMessage(thinkingPhrases[currentPhase]);
      }, duration);
      
      return () => clearInterval(interval);
    } else if (type === "searching") {
      const searchingPhrases = [
        "Searching document",
        "Finding relevant sections",
        "Extracting information",
        "Gathering context"
      ];
      
      const interval = setInterval(() => {
        setCurrentPhase(prev => (prev + 1) % searchingPhrases.length);
        setCurrentMessage(searchingPhrases[currentPhase]);
      }, duration);
      
      return () => clearInterval(interval);
    } else if (type === "generating") {
      const generatingPhrases = [
        "Generating response",
        "Creating content",
        "Drafting answer",
        "Formulating insights"
      ];
      
      const interval = setInterval(() => {
        setCurrentPhase(prev => (prev + 1) % generatingPhrases.length);
        setCurrentMessage(generatingPhrases[currentPhase]);
      }, duration);
      
      return () => clearInterval(interval);
    }
  }, [type, currentPhase, duration]);
  
  // Get the appropriate icon based on the loading type
  const getIcon = () => {
    switch (type) {
      case "thinking":
        return <Brain className="h-6 w-6 text-primary" />;
      case "searching":
        return <BookOpen className="h-6 w-6 text-primary" />;
      case "generating":
        return <TerminalSquare className="h-6 w-6 text-primary" />;
      default:
        return <Zap className="h-6 w-6 text-primary" />;
    }
  };
  
  return (
    <motion.div 
      className="flex items-start gap-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex-shrink-0 mr-3">
        <motion.div 
          className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          {getIcon()}
        </motion.div>
      </div>
      <div className="glassmorphism rounded-lg rounded-tl-none p-4 max-w-[85%] bg-background/30 dark:bg-gray-800/30 backdrop-blur-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMessage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">{currentMessage}{dots}</p>
              <div className="flex space-x-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0
                  }}
                />
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.2
                  }}
                />
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.4
                  }}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}