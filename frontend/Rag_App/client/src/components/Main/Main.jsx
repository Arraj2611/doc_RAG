// Main.jsx
import React, { useContext, useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import "./Main.css";
import { assets } from "../../assets/assets";
import { Context } from "../../context/Context";
import { useNavigate } from "react-router-dom";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SourcesIcon from '@mui/icons-material/Source'; // Example Icon

// Refined SourcesSidebar component
const SourcesSidebar = ({ isOpen, sources, onClose }) => {
  // Add the 'open' class dynamically based on the isOpen prop
  const sidebarClass = isOpen ? "sources-sidebar open" : "sources-sidebar";

  return (
    <div className={sidebarClass}>
      <button onClick={onClose} className="close-sidebar-btn" title="Close Sources">×</button>
      <h3>Sources</h3>
      <div className="sidebar-content">
        {Array.isArray(sources) && sources.length > 0 ? (
          sources.map((source, index) => {
            if (!source || !source.metadata) return (
              <div key={index} className="sidebar-source-item error">
                Source {index + 1}: Invalid data
              </div>
            );

            const { content_snippet, metadata } = source;
            // Use Path manipulation for filename extraction if needed, or directly use metadata.source
            // Handle potential differences in how source name is stored
            const sourceName = metadata.source ? metadata.source.split(/[\\/]/).pop() : 'Unknown Source';
            const page = metadata.page !== undefined && metadata.page !== null ? `Page: ${metadata.page}` : null; // Handle null page
            const distance = metadata.distance_score !== undefined ? `Distance: ${metadata.distance_score.toFixed(4)}` : null; // Check distance_score

            return (
              <div key={index} className="sidebar-source-item">
                <h4>Source {index + 1}: {sourceName}</h4>
                <div className="sidebar-source-meta">
                  {page && <span>{page}</span>}
                  {distance && <span>{distance}</span>}
                </div>
                <div className="sidebar-source-content">
                  {content_snippet || 'No content available'} {/* Display snippet */}
                </div>
              </div>
            );
          })
        ) : (
          <p>No sources available for this message.</p>
        )}
      </div>
    </div>
  );
};

// Helper component for displaying a single source
const SourceDocument = ({ source }) => {
  if (!source || !source.metadata) return null;

  const { content, metadata } = source;
  const sourceName = metadata.source || 'Unknown Source';
  const page = metadata.page !== undefined ? `, Page: ${metadata.page}` : '';
  const distance = metadata.distance !== undefined ? ` (Distance: ${metadata.distance.toFixed(4)})` : '';

  return (
    <div className="source-document">
      <details>
        <summary>
          Source: {sourceName}{page}{distance}
        </summary>
        <div className="source-content">
          {content || 'No content available'}
        </div>
      </details>
    </div>
  );
};

const Main = () => {
  // Destructure values from Context
  const {
    chatHistory,
    currentSessionId,
    onSent,
    setInput,
    input,
    loading,
    showResult,
    handleFileChange,
    isUploading,
    processUploadedFiles,
    lastUploadResult,
    isProcessing,
    theme,
    processedFiles,
    user,
    logout
  } = useContext(Context);

  // --- Define local state and refs AFTER context --- 
  const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(false);
  const [sourcesToShowInSidebar, setSourcesToShowInSidebar] = useState([]);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  // -------------------------------------------------

  // --- Hooks ---
  const navigate = useNavigate(); // Hook for programmatic navigation

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Function to trigger file input click
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleSend = () => {
    // Add log to check input value right before calling onSent
    console.log(`handleSend triggered. Current input state: "${input}"`);
    if (input && input.trim()) { // Ensure input is not null/undefined before trimming
      console.log("Input is valid, calling onSent...");
      onSent(input);
    } else {
      console.warn("Input is empty or only whitespace, onSent not called.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent newline on Enter
      // Add log here too for consistency
      console.log(`handleKeyDown (Enter) triggered. Current input state: "${input}"`);
      handleSend(); // Call the same send logic
    }
  };

  // --- Click Handler for Sources Button --- 
  const handleShowSources = (sources) => {
    console.log("Showing sources:", sources); // Debug log
    setSourcesToShowInSidebar(sources || []); // Ensure it's an array
    setIsSourcesSidebarOpen(true);
  };
  // ----------------------------------------

  return (
    <div className={`main ${theme === 'dark' ? 'dark' : ''}`}>
      {/* --- Sidebar for Sources --- */}
      <SourcesSidebar
        isOpen={isSourcesSidebarOpen}
        sources={sourcesToShowInSidebar}
        onClose={() => setIsSourcesSidebarOpen(false)}
      />
      {/* ------------------------- */}

      <div className="main-content-area"> {/* Wrap main content */}
        <div className="nav">
          {/* --- Display Username in Nav (Optional) --- */}
          <p>Rag App {user?.name ? ` - Welcome, ${user.name}` : ""}</p>
          {/* --------------------------------------- */}
          {/* --- Add onClick handler to profile image --- */}
          <img
            src={assets.user_icon}
            alt="User profile"
            title="Logout"
            onClick={logout} // <<< Call logout function on click
          />
          {/* ----------------------------------------- */}
        </div>
        <div className="main-container">
          {/* Show welcome screen only if there's NO history for the current session */}
          {!showResult ? (
            <>
              <div className="greet">
                <p>
                  {/* --- Dynamic Greeting --- */}
                  <span>Hello{user?.name ? `, ${user.name}` : ''}.</span>
                  {/* ---------------------- */}
                </p>
                <p>How can I help you today?</p> {/* Keep generic question */}
              </div>
              <div className="cards">
                <div className="card" onClick={() => setInput("Summarize the key points from the uploaded documents.")}>
                  <p>Summarize the key points from the uploaded documents.</p>
                  <img src={assets.compass_icon} alt="Summary icon" />
                </div>
                <div className="card" onClick={() => setInput("What is the main conclusion mentioned in the files?")}>
                  <p>What is the main conclusion mentioned in the files?</p>
                  <img src={assets.bulb_icon} alt="Conclusion icon" />
                </div>
                <div className="card" onClick={() => setInput("Extract the main arguments presented in the documents.")}>
                  <p>Extract the main arguments presented in the documents.</p>
                  <img src={assets.message_icon} alt="Arguments icon" />
                </div>
                <div className="card" onClick={() => setInput("Based on the documents, explain the concept of...")}>
                  <p>Based on the documents, explain the concept of...</p>
                  <img src={assets.code_icon} alt="Concept icon" />
                </div>
              </div>
            </>
          ) : (
            // Display chat history
            <div className="chat-history">
              {chatHistory.map((message, index) => {
                const isLastMessage = index === chatHistory.length - 1;
                const hasSources = message.role === 'assistant' && message.sources && message.sources.length > 0;

                return (
                  <div key={message.id || index} className={`message ${message.role}`}>
                    <img src={message.role === 'user' ? assets.user_icon : assets.gemini_icon} alt={message.role} />
                    <div className="message-content-wrapper"> {/* Wrapper for content + button */}
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                          {message.content}
                        </ReactMarkdown>
                        {loading && message.role === 'assistant' && isLastMessage && (
                          <span className="loading-cursor">▋</span>
                        )}
                      </div>
                      {/* --- Render Sources Button Conditionally --- */}
                      {hasSources && (
                        <div className="sources-button-container-inline">
                          <button
                            className="sources-button-inline"
                            onClick={() => handleShowSources(message.sources)}
                            title="Show sources for this message"
                          >
                            <SourcesIcon fontSize="inherit" /> {/* Icon */}
                            Sources
                          </button>
                        </div>
                      )}
                      {/* ------------------------------------------ */}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="main-bottom">
          {lastUploadResult?.success && !isProcessing && (
            <div className="process-trigger-container">
              <button
                className="process-button-main"
                onClick={processUploadedFiles}
                disabled={isProcessing}
              >
                Process {lastUploadResult.data?.filenames_saved?.length || 'Uploaded'} File(s)
              </button>
            </div>
          )}

          {processedFiles && processedFiles.length > 0 && (
            <div className="processed-files-container">
              <p><strong>Context:</strong> {processedFiles.join(", ")}</p>
            </div>
          )}

          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
            accept=".pdf,.docx"
          />

          <div className="search-box">
            <input
              onChange={(e) => setInput(e.target.value)}
              value={input}
              type="text"
              placeholder="Enter a prompt here, or attach files..."
              onKeyDown={handleKeyDown}
            />
            <div>
              <AttachFileIcon
                className={`input-icon ${isUploading || isProcessing ? 'disabled' : ''}`}
                onClick={handleAttachClick}
                style={{ cursor: (isUploading || isProcessing) ? 'not-allowed' : 'pointer' }}
                title="Attach Files (.pdf, .docx)"
              />
              <img
                onClick={handleSend}
                className={`input-icon send-icon ${(!input && !loading) || loading ? 'disabled' : ''}`}
                src={assets.send_icon}
                alt="Send icon"
                style={{ cursor: (!input && !loading) || loading ? 'not-allowed' : 'pointer' }}
              />
            </div>
          </div>
          <p className="bottom-info">
            AI may display inaccurate info. Check responses.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Main;
