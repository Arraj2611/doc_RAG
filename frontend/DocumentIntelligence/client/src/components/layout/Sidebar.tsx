import { useDocuments } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";
import { useState, useContext } from "react";
import { useAuth } from "@/hooks/use-auth";
import { TagType } from "@/types";
import { 
  Home, 
  FileText, 
  HistoryIcon, 
  Bookmark, 
  Settings, 
  HelpCircle, 
  Upload, 
  File
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DocumentContext } from "@/contexts/DocumentContext";
import { DocumentState } from "@/store/documentStore";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadClick: () => void;
  activeSection?: string;
  setActiveSection?: (section: string) => void;
}

export default function Sidebar({ 
  isOpen, 
  onClose, 
  onUploadClick,
  activeSection,
  setActiveSection
}: SidebarProps) {
  const context = useContext(DocumentContext);
  const { user } = useAuth();
  const { 
    documents = [], 
    documentTags = [], 
    setSelectedSessionId = () => {},
    isLoading = false
  } = context || {};
  
  const recentDocuments = Array.isArray(documents) ? documents.slice(0, 5) : [];
  const [location, navigate] = useLocation();
  const [activeItem, setActiveItem] = useState(location === "/" ? "dashboard" : location.substring(1));

  const handleDocumentClick = (sessionId: string | null | undefined) => {
    if (sessionId) {
       setSelectedSessionId(sessionId);
       if (window.innerWidth < 1024) {
         onClose();
       }
    }
  };
  
  const handleNavigation = (path: string, item: string) => {
    navigate(path);
    setActiveItem(item);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <motion.aside
      initial={{ x: "-100%" }}
      animate={{ x: isOpen ? 0 : "-100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "w-64 border-r border-gray-200 dark:border-gray-700 h-full flex-shrink-0 fixed lg:relative z-20",
        "bg-white/10 backdrop-blur-xl dark:bg-gray-900/70",
        isOpen ? "block" : "hidden lg:block"
      )}
      data-sidebar-content="true"
    >
      <div className="flex flex-col h-full">
        {/* Profile Summary */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10 border-2 border-primary">
              <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                {(user?.username?.charAt(0) || user?.displayName?.charAt(0) || 'U').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                {user?.username || user?.displayName || "Guest User"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.plan || "Free Plan"}
              </p>
            </div>
          </div>
        </div>
        
        {/* Upload Button */}
        <div className="p-4">
          <Button 
            onClick={onUploadClick} 
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload Document</span>
          </Button>
        </div>
        
        {/* Navigation */}
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-1">
            <Button
              variant={(activeItem === "dashboard" || activeSection === "dashboard") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                (activeItem === "dashboard" || activeSection === "dashboard") ? "bg-primary/10 text-primary" : ""
              )}
              onClick={() => {
                handleNavigation("/", "dashboard");
                if (setActiveSection) {
                  setActiveSection("dashboard");
                }
              }}
            >
              <Home className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </Button>
            
            <Button
              variant={(activeItem === "documents" || activeSection === "documents") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                (activeItem === "documents" || activeSection === "documents") ? "bg-primary/10 text-primary" : ""
              )}
              onClick={() => {
                setActiveItem("documents");
                if (setActiveSection) {
                  setActiveSection("documents");
                }
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              <span>My Documents</span>
            </Button>
            
            <Button
              variant={(activeItem === "history" || activeSection === "history") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                (activeItem === "history" || activeSection === "history") ? "bg-primary/10 text-primary" : ""
              )}
              onClick={() => {
                setActiveItem("history");
                if (setActiveSection) {
                  setActiveSection("history");
                }
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
            >
              <HistoryIcon className="mr-2 h-4 w-4" />
              <span>Chat History</span>
            </Button>
            
            <Button
              variant={(activeItem === "insights" || activeSection === "insights") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                (activeItem === "insights" || activeSection === "insights") ? "bg-primary/10 text-primary" : ""
              )}
              onClick={() => {
                setActiveItem("insights");
                if (setActiveSection) {
                  setActiveSection("insights");
                }
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
            >
              <Bookmark className="mr-2 h-4 w-4" />
              <span>Saved Insights</span>
            </Button>
          </div>
          
          {recentDocuments.length > 0 && (
            <div className="mt-6">
              <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Recent Documents
              </h3>
              <div className="space-y-1">
                {recentDocuments.map((doc: DocumentState) => (
                  <Button
                    key={doc.session_id}
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm font-normal text-gray-600 dark:text-gray-300 hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10"
                    onClick={() => handleDocumentClick(doc.session_id)}
                    title={doc.filename}
                  >
                    <FileText className="mr-2 h-4 w-4 flex-shrink-0" /> 
                    <span className="truncate flex-1 text-left">{doc.filename}</span> 
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {documentTags.length > 0 && (
            <div className="mt-6">
              <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tags
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 px-3">
                {documentTags.map((tag: TagType) => (
                  <Badge 
                    key={tag.id} 
                    variant="outline" 
                    className={`bg-${tag.color}-100 dark:bg-${tag.color}-900 text-${tag.color}-800 dark:text-${tag.color}-200`}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
        
        {/* Settings & Help */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-1">
            <Button
              variant={(activeItem === "settings" || activeSection === "settings") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                (activeItem === "settings" || activeSection === "settings") ? "bg-primary/10 text-primary" : ""
              )}
              onClick={() => {
                setActiveItem("settings");
                if (setActiveSection) {
                  setActiveSection("settings");
                }
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
            
            <Button
              variant={(activeItem === "help" || activeSection === "help") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                (activeItem === "help" || activeSection === "help") ? "bg-primary/10 text-primary" : ""
              )}
              onClick={() => {
                setActiveItem("help");
                if (setActiveSection) {
                  setActiveSection("help");
                }
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Help & Support</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
