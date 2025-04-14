import { motion } from "framer-motion";
import { FileText, PlusCircle, Search, Settings } from "lucide-react";

export default function ChatHistorySkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6 w-full"
    >
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
      </div>
      
      {/* Search Bar Skeleton */}
      <div className="relative flex items-center mb-6">
        <div className="absolute left-3 text-gray-400">
          <Search className="h-4 w-4" />
        </div>
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg w-full animate-pulse"></div>
      </div>
      
      {/* New Chat Button Skeleton */}
      <div className="flex items-center justify-center mb-6">
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg w-full animate-pulse flex justify-center items-center">
          <PlusCircle className="h-4 w-4 text-gray-400 mr-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
        </div>
      </div>
      
      {/* Chat History Items */}
      <div className="space-y-3 mb-6">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
        
        {[1, 2, 3, 4].map((i) => (
          <motion.div 
            key={i}
            className="flex items-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
            animate={i === 1 ? { scale: [1, 1.01, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 mr-3"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700"></div>
          </motion.div>
        ))}
      </div>
      
      {/* Document Info Skeleton */}
      <div className="rounded-lg p-4 mb-4 bg-gray-100 dark:bg-gray-800/50 animate-pulse">
        <div className="flex items-center mb-3">
          <FileText className="h-5 w-5 text-gray-400 mr-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
      
      {/* Settings Button Skeleton */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <Settings className="h-5 w-5 text-gray-400" />
        </div>
      </div>
      
      {/* Processing Indicator Animation */}
      <div className="flex justify-center mt-6">
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}