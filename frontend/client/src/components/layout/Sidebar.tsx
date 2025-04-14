import { useDocuments } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { 
  Home, 
  FileText, 
  HistoryIcon, 
  Bookmark, 
  Settings, 
  HelpCircle, 
  Upload, 
  File,
  MessageSquare as MessageSquareIcon
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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
  const { currentUser, recentDocuments, documentTags, setSelectedDocument } = useDocuments();
  const [location, navigate] = useLocation();
  const [activeItem, setActiveItem] = useState(location === "/" ? "dashboard" : location.substring(1));

  const handleDocumentClick = (documentId: string) => {
    setSelectedDocument(documentId);
    if (window.innerWidth < 1024) {
      onClose();
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
              {currentUser?.username ? (
                <AvatarFallback className="bg-primary/10 text-primary">
                  {currentUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              ) : (
                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {currentUser?.displayName?.charAt(0) || 'U'}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                {currentUser?.displayName || "Guest User"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentUser?.plan || "Free Plan"}
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
              variant={(activeItem === "chat" || activeSection === "chat") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                (activeItem === "chat" || activeSection === "chat") ? "bg-primary/10 text-primary" : ""
              )}
              onClick={() => {
                setActiveItem("chat");
                if (setActiveSection) {
                  setActiveSection("chat");
                }
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
            >
              <MessageSquareIcon className="mr-2 h-4 w-4" />
              <span>Chat</span>
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
              <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Recent Documents
              </h3>
              <div className="mt-2 space-y-1">
                {recentDocuments.map((doc) => (
                  <Button
                    key={doc.id}
                    variant="ghost"
                    className="w-full justify-start py-2 px-3"
                    onClick={() => handleDocumentClick(doc.id)}
                  >
                    <File className="mr-2 h-4 w-4 text-red-500" />
                    <span className="truncate">{doc.name}</span>
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
                {documentTags.map((tag) => (
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
                handleNavigation("/settings", "settings");
                if (setActiveSection) {
                  setActiveSection("settings");
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
