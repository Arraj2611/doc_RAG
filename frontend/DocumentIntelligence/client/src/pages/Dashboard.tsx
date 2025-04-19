import { useState, useEffect, useContext, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelGroupHandle } from "react-resizable-panels";
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
  BarChart3,
  PanelRightOpen
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
import { DocumentContext } from "@/contexts/DocumentContext";
import DocumentSearch from "@/components/documents/DocumentSearch";
import Settings from "@/components/settings/Settings";
import HelpSupport from "@/components/help/HelpSupport";

export default function Dashboard() {
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  // Initialize sidebar state based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // On server or during SSR, default to false
    if (typeof window === 'undefined') return false;
    // On client, check window width
    return window.innerWidth >= 1024;
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(false);
  
  // Get state and actions from DocumentContext
  const docContext = useContext(DocumentContext);
  if (!docContext) {
    throw new Error("Dashboard must be used within a DocumentProvider");
  }
  const { 
      documents, 
      selectedSessionId, 
      setSelectedSessionId,
      isLoading: isDocLoading,
      allUserInsights,
      isAllInsightsLoading,
      fetchAllUserInsightsAggregated,
  } = docContext;

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
        !target.closest('[data-sidebar-toggle]')
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

  // NEW: Fetch all insights on mount or when documents change
  useEffect(() => {
    console.log("[Dashboard] Fetching all aggregated insights...");
    fetchAllUserInsightsAggregated();
    // Dependency array: trigger when component mounts or documents list changes
  }, [documents, fetchAllUserInsightsAggregated]);

  // Find the selected document name for the chat header
  const selectedDocName = useMemo(() => {
      if (!selectedSessionId) return null;
      return documents.find(d => d.session_id === selectedSessionId)?.filename;
  }, [selectedSessionId, documents]);

  // Find the selected document object for PDFViewer
  const selectedDocument = useMemo(() => {
    if (!selectedSessionId) return null;
    return documents.find(d => d.session_id === selectedSessionId);
  }, [selectedSessionId, documents]);

  // Function to restore default panel layout
  const restoreLayout = () => {
    const panelGroup = panelGroupRef.current;
    if (panelGroup) {
      // Set layout back to 50/50 split
      panelGroup.setLayout([50, 50]);
      setIsChatCollapsed(false);
      setIsPdfCollapsed(false);
    }
  };

  // Reset collapsed state when document selection changes
  useEffect(() => {
    setIsChatCollapsed(false);
    setIsPdfCollapsed(false);
    // Also attempt to reset layout if panels exist
    restoreLayout(); 
  }, [selectedSessionId]);

  // Function to render content based on activeSection when no document is selected
  const renderMainContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <>
            {/* --- Dashboard Overview --- */}
            <div className="mb-8 mx-auto max-w-4xl text-center">
              <motion.h2 
                  initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="text-3xl font-semibold mb-3 text-gray-800 dark:text-gray-100">
                  Welcome to your Document AI Assistant
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-lg text-gray-600 dark:text-gray-400">
                  Analyze, extract insights, and chat with your documents effortlessly.
              </motion.p>
            </div>
            {/* ... stats, quick actions, recent docs ... */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Document Statistics */}
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-300"><BarChart3 className="h-5 w-5"/> Document Statistics</h3>
                    <div className="flex justify-around text-center">
                        <div>
                            <p className="text-3xl font-bold text-primary">{documents.length}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Documents</p>
                        </div>
                        <div>
                            {/* Use isAllInsightsLoading and allUserInsights.length */}
                            {isAllInsightsLoading ? (
                                <p className="text-3xl font-bold text-primary animate-pulse">...</p>
                            ) : (
                                <p className="text-3xl font-bold text-primary">{allUserInsights?.length ?? 0}</p>
                            )}
                            <p className="text-sm text-gray-500 dark:text-gray-400">Saved Insights</p>
                        </div>
                    </div>
                </motion.div>
                {/* Quick Actions */}
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Zap className="h-5 w-5"/> Quick Actions</h3>
                    <div className="space-y-2">
                        <Button variant="outline" className="w-full justify-start" onClick={handleUploadClick}><Upload className="mr-2 h-4 w-4" /> Upload New Document</Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => setActiveSection('documents')}><Files className="mr-2 h-4 w-4" /> Browse All Documents</Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => setActiveSection('insights')}><Bookmark className="mr-2 h-4 w-4" /> View Saved Insights</Button>
                    </div>
                </motion.div>
                {/* Recent Activity (Placeholder - could show last uploaded docs) */}
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-300"><HistoryIcon className="h-5 w-5"/> Recent Activity</h3>
                    <div className="space-y-3">
                        {documents.slice(0, 3).map(doc => (
                            <div key={doc.session_id} className="text-sm flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => setSelectedSessionId(doc.session_id)}>
                                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0"/>
                                <span className="truncate flex-1" title={doc.filename}>{doc.filename}</span>
                                {/* <span className="text-xs text-gray-400 whitespace-nowrap">{doc.processed_at ? formatDistanceToNow(parseISO(doc.processed_at), { addSuffix: true }) : 'Pending'}</span> */}
                            </div>
                        ))}
                        {documents.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity.</p>}
                    </div>
                </motion.div>
            </div>
            {/* Recent Documents Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><FolderOpen className="h-5 w-5"/> Recent Documents</h3>
                    <Button variant="link" size="sm" className="text-sm text-primary" onClick={() => setActiveSection('documents')}>View All</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {documents.slice(0, 4).map(doc => (
                        <div key={doc.session_id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedSessionId(doc.session_id)}>
                            <div className="flex items-center mb-2">
                                <FileText className="h-5 w-5 text-primary mr-2"/>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={doc.filename}>{doc.filename}</p>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Status: {doc.status}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Processed on {doc.processed_at ? new Date(doc.processed_at).toLocaleDateString() : 'N/A'}</p>
                        </div>
                    ))}
                    {documents.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 col-span-full">No documents found.</p>}
                </div>
            </motion.div>
          </>
        );
      case 'documents':
        return <MyDocuments />;
      case 'history':
        return <ChatHistory />;
      case 'insights':
        // Pass allUserInsights and loading state to SavedInsights component
        return <SavedInsights />;
      case 'settings':
        return <Settings />;
      case 'help':
        return <HelpSupport />;
      default:
        return <div>Select a section</div>;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300 overflow-hidden">
      <Header toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div data-sidebar="true" className="flex-shrink-0 z-20">
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
          {sidebarOpen && window.innerWidth < 1024 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black lg:hidden z-30"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {selectedSessionId && selectedDocument ? (
            // --- VIEW/CHAT MODE (Document Selected) --- 
            <PanelGroup 
              direction="horizontal" 
              className="flex-1 h-full" 
              ref={panelGroupRef}
            >
              {/* Left Panel: Chat Interface */}
              <Panel 
                defaultSize={50}
                minSize={15}
                collapsible={true}
                onCollapse={() => setIsChatCollapsed(true)}
                onExpand={() => setIsChatCollapsed(false)}
                className={`flex flex-col overflow-hidden ${isChatCollapsed ? 'hidden' : ''}`}
              >
                <section className="flex-1 h-full flex flex-col overflow-hidden border-r dark:border-gray-700 bg-white dark:bg-gray-800">
                   <div className="flex-shrink-0 p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 min-h-[60px]">
                       <h3 className="text-base lg:text-lg font-medium text-gray-800 dark:text-gray-100 truncate mr-2" title={selectedDocName || "Chat"}>
                           Chat with: {selectedDocName || "Document"}
                    </h3>
                       {isPdfCollapsed && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                              onClick={restoreLayout} 
                              className="text-xs gap-1.5 text-primary hover:text-primary/80"
                              title="Restore PDF View"
                    >
                               <PanelRightOpen className="h-4 w-4"/>
                               <span>Restore View</span>
                    </Button>
                      )}
                    </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <ChatInterface key={selectedSessionId} /> 
                        </div>
                </section>
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle 
                 className={`w-2 bg-transparent hover:bg-primary/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 transition-colors duration-200 relative ${isChatCollapsed || isPdfCollapsed ? 'hidden' : ''}`}
              >
                <div className="h-full w-px bg-border absolute left-1/2 transform -translate-x-1/2 group-hover:bg-primary/50 transition-colors"></div>
              </PanelResizeHandle>

              {/* Right Panel: PDF Viewer */}
              <Panel 
                defaultSize={50}
                minSize={15}
                collapsible={true}
                onCollapse={() => setIsPdfCollapsed(true)}
                onExpand={() => setIsPdfCollapsed(false)}
                className={`overflow-hidden ${isPdfCollapsed ? 'hidden' : ''}`}
              >
                <section className="h-full overflow-hidden">
                   <PDFViewer /> 
                </section>
              </Panel>
            </PanelGroup>
          ) : ( 
            // --- BROWSE/OTHER MODE (No Document Selected) --- 
            <AnimatePresence mode="wait">
              <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 h-full overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar"
              >
                {renderMainContent()} 
                </motion.div>
              </AnimatePresence>
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
