import { motion } from "framer-motion";
import { FileText, Tag, Calendar, Clock, User, FileEdit } from "lucide-react";

export default function DocumentDetailsSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800"
    >
      {/* Document Header Skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2 flex-1">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
          <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-1/2 animate-pulse"></div>
        </div>
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
      </div>
      
      <div className="space-y-6">
        {/* Info Section Skeleton */}
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-28 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-20 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-32 animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* Tags Section Skeleton */}
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
          
          <div className="flex flex-wrap gap-2 mt-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-6 bg-gray-100 dark:bg-gray-800 rounded-full px-3 animate-pulse w-16"></div>
            ))}
          </div>
        </div>
        
        {/* Summary Section Skeleton */}
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
          
          <div className="space-y-2 mt-3">
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3 animate-pulse"></div>
          </div>
        </div>
        
        {/* Actions Skeleton */}
        <div className="flex gap-2 mt-6 justify-end">
          <motion.div 
            className="h-10 w-24 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          ></motion.div>
          <motion.div 
            className="h-10 w-24 bg-primary/20 rounded-md animate-pulse"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
          ></motion.div>
        </div>
      </div>
      
      {/* Processing Indicator Animation */}
      <div className="flex mt-6 justify-center">
        <div className="flex space-x-2">
          {[0, 1, 2, 3].map((i) => (
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