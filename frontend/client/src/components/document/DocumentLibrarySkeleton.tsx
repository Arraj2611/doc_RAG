import { motion } from "framer-motion";
import { DocumentGridSkeleton } from "@/components/ui/skeleton-loader";
import { Search, Filter, Plus } from "lucide-react";

export default function DocumentLibrarySkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full w-24 animate-pulse"></div>
      </div>
      
      {/* Search and Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search className="h-4 w-4" />
          </div>
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg w-full animate-pulse"></div>
        </div>
        
        <div className="flex gap-2">
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg w-28 flex items-center justify-center animate-pulse">
            <Filter className="h-4 w-4 text-gray-400 mr-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
          </div>
          
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg w-28 flex items-center justify-center animate-pulse">
            <Plus className="h-4 w-4 text-gray-400 mr-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
          </div>
        </div>
      </div>
      
      {/* Document Grid Skeleton */}
      <DocumentGridSkeleton count={9} />
      
      {/* Pagination Skeleton */}
      <div className="flex justify-center mt-8">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div 
              key={i}
              className={`h-8 w-8 rounded-md ${i === 1 ? 'bg-primary/20' : 'bg-gray-100 dark:bg-gray-800'} flex items-center justify-center animate-pulse`}
              animate={i === 1 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <div className="h-3 w-3 bg-gray-300 dark:bg-gray-600 rounded-sm"></div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}