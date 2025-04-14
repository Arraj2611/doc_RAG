import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  History as HistoryIcon, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  FileText, 
  Upload, 
  Files, 
  Bookmark, 
  FolderOpen, 
  Zap, 
  BarChart3
} from "lucide-react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import DocumentLibrary from "@/components/document/DocumentLibrary";
import PDFViewer from "@/components/document/PDFViewer";
import EmptyState from "@/components/document/EmptyState";
import SavedInsights from "@/components/document/SavedInsights";
import MyDocuments from "@/components/document/MyDocuments";
import ChatHistory from "@/components/chat/ChatHistory";
import ChatInterface from "@/components/chat/ChatInterface";
import UploadModal from "@/components/common/UploadModal";
import { Button } from "@/components/ui/button";
import { useDocuments } from "@/hooks/useDocuments";
import DocumentSearch from "@/components/documents/DocumentSearch";
import DocumentResults from "@/components/documents/DocumentResults";
import { useDocumentStore } from "@/store/documentStore";

export default function Dashboard() {
  // Initialize sidebar state based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // On server or during SSR, default to false
    if (typeof window === 'undefined') return false;
    // On client, check window width
    return window.innerWidth >= 1024;
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const { selectedDocument, documents, savedInsights, setSelectedDocument } = useDocuments();
  const [showSearchResults, setShowSearchResults] = useState(false);
  const { searchResults } = useDocumentStore();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleUploadClick = () => {
    setUploadModalOpen(true);
  };

  useEffect(() => {
    // Close sidebar on larger screens when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        window.innerWidth < 1024 &&
        sidebarOpen &&
        !target.closest('[data-sidebar]') &&
        !target.closest('[data-sidebar-content]')
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Auto-open sidebar on desktop
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Add effect to show search results when there are results
  useEffect(() => {
    if (searchResults.length > 0) {
      setShowSearchResults(true);
    }
  }, [searchResults]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <Header toggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div data-sidebar="true">
          <Sidebar 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)} 
            onUploadClick={handleUploadClick}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
          />
        </div>
        
        {/* Overlay for mobile when sidebar is open */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black lg:hidden z-10"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {activeSection === "insights" ? (
            /* Saved Insights View */
            <section className="flex-1 h-full overflow-auto p-4 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <SavedInsights 
                    onBackToLibrary={() => setActiveSection("documents")} 
                  />
                </motion.div>
              </AnimatePresence>
            </section>
          ) : activeSection === "history" ? (
            /* Chat History View */
            <section className="flex-1 h-full overflow-auto p-4 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChatHistory onBackToLibrary={() => setActiveSection("documents")} />
                </motion.div>
              </AnimatePresence>
            </section>
          ) : activeSection === "mydocuments" ? (
            /* My Documents View */
            <section className="flex-1 h-full overflow-auto p-4 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <MyDocuments
                    onUploadClick={handleUploadClick}
                    onBackToLibrary={() => setActiveSection("documents")}
                  />
                </motion.div>
              </AnimatePresence>
            </section>
          ) : activeSection === "chat" ? (
            /* Chat View - Add this new section */
            <section className="flex-1 h-full overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col h-full"
                >
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-medium text-gray-800 dark:text-white">Document Chat</h2>
                      {!selectedDocument && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setActiveSection("documents")}
                        >
                          Select a Document
                        </Button>
                      )}
                    </div>
                    {selectedDocument && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Currently chatting with: {documents.find(d => d.id === selectedDocument)?.name || "Unknown document"}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChatInterface />
                  </div>
                </motion.div>
              </AnimatePresence>
            </section>
          ) : activeSection === "help" ? (
            /* Help & Support View */
            <section className="flex-1 h-full overflow-auto p-4 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-800 dark:text-white flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Help & Support
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-1 text-xs" 
                      onClick={() => setActiveSection("documents")}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Back to Library
                    </Button>
                  </div>
                  <div className="border dark:border-gray-700 rounded-lg p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400">Help and support resources coming soon.</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </section>
          ) : activeSection === "dashboard" ? (
            /* Dashboard Overview (Full Width) */
            <section className="flex-1 h-full overflow-auto p-4 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8 mx-auto max-w-4xl text-center">
                    <h2 className="text-3xl font-semibold mb-3">Welcome to your Document AI Assistant</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto">Analyze, extract insights, and chat with your documents</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10 max-w-7xl mx-auto">
                    {/* Recent Activity */}
                    <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800 shadow-sm">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Recent Activity
                      </h3>
                      {documents.length > 0 ? (
                        <div className="space-y-3">
                          {documents.slice(0, 3).map(doc => (
                            <div key={doc.id} className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                      )}
                    </div>
                    
                    {/* Document Stats */}
                    <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800 shadow-sm">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Document Statistics
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
                          <p className="text-2xl font-semibold">{documents.length}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Documents</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
                          <p className="text-2xl font-semibold">{savedInsights.length}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Saved Insights</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800 shadow-sm">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Quick Actions
                      </h3>
                      <div className="space-y-3">
                        <Button 
                          className="w-full justify-start" 
                          variant="outline"
                          onClick={handleUploadClick}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload New Document
                        </Button>
                        <Button 
                          className="w-full justify-start" 
                          variant="outline"
                          onClick={() => setActiveSection("documents")}
                        >
                          <Files className="h-4 w-4 mr-2" />
                          Browse All Documents
                        </Button>
                        <Button 
                          className="w-full justify-start" 
                          variant="outline"
                          onClick={() => setActiveSection("insights")}
                        >
                          <Bookmark className="h-4 w-4 mr-2" />
                          View Saved Insights
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recent Documents */}
                  <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800 shadow-sm mb-10 max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-medium flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        Recent Documents
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs font-medium"
                        onClick={() => setActiveSection("documents")}
                      >
                        View All
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                    
                    {documents.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.slice(0, 3).map(doc => (
                          <div 
                            key={doc.id} 
                            className="border dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setSelectedDocument(doc.id)}
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <FileText className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate mb-1">{doc.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{doc.pages} pages • {doc.size}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 px-4">
                        <div className="mb-4">
                          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                            <FolderOpen className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 mb-5">No documents available yet</p>
                        </div>
                        <Button onClick={handleUploadClick} size="lg" className="gap-2">
                          <Upload className="h-4 w-4" />
                          Upload Your First Document
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </section>
          ) : (
            // Document Section - Modified to include Search
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-medium text-gray-800 dark:text-white mb-4">Document Library</h2>
                <DocumentSearch />
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar">
                {showSearchResults ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-800 dark:text-white">Search Results</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowSearchResults(false)}
                        className="text-sm"
                      >
                        Back to Library
                      </Button>
                    </div>
                    <DocumentResults />
                  </div>
                ) : (
                  <DocumentLibrary 
                    onUploadClick={handleUploadClick} 
                  />
                )}
              </div>
            </div>
          )}
          
          {/* Document Viewer (only show if document is selected and not in search mode) */}
          {selectedDocument && !showSearchResults && activeSection !== "insights" && 
           activeSection !== "history" && activeSection !== "help" && 
           activeSection !== "mydocuments" && activeSection !== "dashboard" && (
            <div className="hidden md:block md:w-1/2 lg:w-3/5 xl:w-2/3 h-full overflow-hidden border-l border-gray-200 dark:border-gray-700">
              <PDFViewer />
            </div>
          )}
        </main>
      </div>
      
      {/* Upload Modal */}
      <UploadModal 
        isOpen={uploadModalOpen} 
        onClose={() => setUploadModalOpen(false)} 
      />
    </div>
  );
}
