import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, FileText, FileSpreadsheet, FileImage, FileType, File } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface DocumentLoadingStateProps {
  fileName?: string;
  documentType?: string;
  onComplete?: () => void;
  showCheckmark?: boolean;
}

const documentIcons = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  jpg: FileImage,
  jpeg: FileImage,
  png: FileImage,
  gif: FileImage,
  ppt: FileType,
  pptx: FileType,
};

export default function DocumentLoadingState({
  fileName = 'document.pdf',
  documentType = 'pdf',
  onComplete,
  showCheckmark = false,
}: DocumentLoadingStateProps) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [animationState, setAnimationState] = useState<
    'initial' | 'scanning' | 'processing' | 'complete'
  >('initial');

  // Determine the icon based on document type
  const IconComponent = documentIcons[documentType.toLowerCase() as keyof typeof documentIcons] || File;

  // Animation for progress
  useEffect(() => {
    if (showCheckmark) {
      setProgress(100);
      setIsComplete(true);
      setAnimationState('complete');
      onComplete?.();
      return;
    }

    let interval: ReturnType<typeof setInterval>;
    
    if (animationState === 'initial') {
      // Initial loading animation (0-30%)
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + Math.random() * 2;
          if (next >= 30) {
            setAnimationState('scanning');
            return 30;
          }
          return next;
        });
      }, 100);
    } else if (animationState === 'scanning') {
      // Scanning animation (30-60%)
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + Math.random() * 1.5;
          if (next >= 60) {
            setAnimationState('processing');
            return 60;
          }
          return next;
        });
      }, 150);
    } else if (animationState === 'processing') {
      // Processing animation (60-100%)
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + Math.random() * 1;
          if (next >= 100) {
            setIsComplete(true);
            setAnimationState('complete');
            onComplete?.();
            return 100;
          }
          return next;
        });
      }, 200);
    }

    return () => clearInterval(interval);
  }, [animationState, onComplete, showCheckmark]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-3">
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={
              isComplete
                ? { scale: 1, rotate: 0 }
                : {
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                    transition: {
                      repeat: Infinity,
                      duration: 3,
                    },
                  }
            }
            className="w-10 h-10 border border-gray-200 dark:border-gray-700 rounded-md flex items-center justify-center bg-white dark:bg-gray-800"
          >
            <AnimatePresence mode="wait">
              {isComplete && showCheckmark ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Check className="h-6 w-6 text-green-500" />
                </motion.div>
              ) : (
                <motion.div
                  key="icon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <IconComponent className="h-6 w-6 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <div>
            <div className="font-medium text-sm truncate max-w-[200px]">{fileName}</div>
            <div className="text-xs text-gray-500">
              {animationState === 'initial' && 'Uploading...'}
              {animationState === 'scanning' && 'Scanning content...'}
              {animationState === 'processing' && 'Processing document...'}
              {animationState === 'complete' && 'Document ready'}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 font-medium">{Math.round(progress)}%</div>
      </div>

      <Progress value={progress} className="h-1.5" />

      {!isComplete && (
        <motion.div
          className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            backgroundImage: `linear-gradient(45deg, transparent 45%, ${
              showCheckmark ? 'rgb(34, 197, 94)' : 'var(--primary)'
            } 50%, transparent 55%)`,
            backgroundSize: '300% 300%',
          }}
        />
      )}
    </div>
  );
}