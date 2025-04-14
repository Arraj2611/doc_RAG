import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FileText, FileImage, FileSpreadsheet, FilePieChart, FileCode, FileArchive, File } from "lucide-react";
import { useState, useEffect } from "react";

// Animation variants for document icon
const iconVariants = {
  initial: { scale: 0.8, opacity: 0.7 },
  animate: { 
    scale: [0.8, 1.1, 0.9, 1],
    opacity: [0.7, 1, 0.8, 1],
    rotate: [0, 5, -5, 0],
    transition: { 
      repeat: Infinity,
      repeatType: "loop" as const,
      duration: 3,
      ease: "easeInOut"
    }
  }
};

// Animation variants for text lines
const textLineVariants = {
  initial: { opacity: 0.5, width: "60%" },
  animate: {
    opacity: [0.5, 0.8, 0.5],
    width: ["60%", "100%", "60%"],
    transition: {
      repeat: Infinity,
      repeatType: "loop" as const,
      duration: 2,
      ease: "easeInOut",
    }
  }
};

// Document types with their respective icons
const documentIcons = {
  "pdf": FileText,
  "image": FileImage,
  "spreadsheet": FileSpreadsheet,
  "chart": FilePieChart,
  "code": FileCode,
  "archive": FileArchive,
  "default": File
};

interface DocumentSkeletonProps {
  className?: string;
  documentType?: keyof typeof documentIcons | string;
  lines?: number;
  animated?: boolean;
}

export function DocumentSkeleton({
  className,
  documentType = "default",
  lines = 2,
  animated = true,
}: DocumentSkeletonProps) {
  const IconComponent = documentIcons[documentType as keyof typeof documentIcons] || documentIcons.default;
  
  return (
    <div className={cn(
      "rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3", 
      className
    )}>
      <div className="flex items-start gap-4">
        <motion.div 
          className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
          variants={animated ? iconVariants : undefined}
          initial="initial"
          animate={animated ? "animate" : undefined}
        >
          <IconComponent className="h-6 w-6 text-gray-400" />
        </motion.div>
        
        <div className="space-y-2 flex-1">
          <motion.div 
            className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
            variants={animated ? textLineVariants : undefined}
            initial="initial"
            animate={animated ? "animate" : undefined}
            custom={0}
          />
          
          {Array.from({ length: lines }).map((_, i) => (
            <motion.div 
              key={i}
              className="h-3 bg-gray-100 dark:bg-gray-800 rounded"
              variants={animated ? textLineVariants : undefined}
              initial="initial"
              animate={animated ? "animate" : undefined}
              style={{ width: `${85 - (i * 15)}%`, animationDelay: `${i * 0.1}s` }}
              custom={i + 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DocumentGridSkeletonProps {
  count?: number;
  className?: string;
}

export function DocumentGridSkeleton({ count = 6, className }: DocumentGridSkeletonProps) {
  // Randomly determine document types for visual variety
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  
  useEffect(() => {
    const types = Object.keys(documentIcons);
    const randomTypes = Array.from({ length: count }, () => 
      types[Math.floor(Math.random() * types.length)]
    );
    setDocumentTypes(randomTypes);
  }, [count]);
  
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <DocumentSkeleton 
          key={i} 
          documentType={documentTypes[i] || "default"}
          lines={Math.floor(Math.random() * 2) + 1}
        />
      ))}
    </div>
  );
}

// Chat message skeleton for loading states
export function ChatMessageSkeleton() {
  return (
    <div className="flex items-start gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
      <div className="space-y-2 flex-1">
        <motion.div 
          className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"
          variants={textLineVariants}
          initial="initial"
          animate="animate"
        />
        <motion.div 
          className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-5/6"
          variants={textLineVariants}
          initial="initial"
          animate="animate"
          style={{ animationDelay: "0.1s" }}
        />
        <motion.div 
          className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2"
          variants={textLineVariants}
          initial="initial"
          animate="animate"
          style={{ animationDelay: "0.2s" }}
        />
      </div>
    </div>
  );
}

// Skeleton for document processing animation
export function DocumentProcessingSkeleton() {
  const processingSteps = [
    "Analyzing document structure...",
    "Extracting text content...",
    "Processing metadata...",
    "Indexing for search...",
    "Preparing for AI interaction..."
  ];
  
  const [currentStep, setCurrentStep] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % processingSteps.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
      <motion.div 
        className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
        animate={{ 
          rotate: [0, 360],
          transition: { 
            repeat: Infinity, 
            duration: 3,
            ease: "linear" 
          }
        }}
      >
        <FileText className="h-8 w-8 text-primary/70" />
      </motion.div>
      
      <h3 className="text-lg font-medium mb-2">Processing Document</h3>
      
      <motion.div 
        className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden"
      >
        <motion.div 
          className="h-full bg-primary"
          animate={{ 
            width: [0, '100%'],
            transition: { 
              repeat: Infinity, 
              duration: 10,
              ease: "linear" 
            }
          }}
        />
      </motion.div>
      
      <motion.p 
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="text-sm text-gray-500 dark:text-gray-400"
      >
        {processingSteps[currentStep]}
      </motion.p>
    </div>
  );
}