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

// Refined SourcesSidebar component
const SourcesSidebar = ({ isOpen, sources, onClose }) => {
  // Add the 'open' class dynamically based on the isOpen prop
  const sidebarClass = isOpen ? "sources-sidebar open" : "sources-sidebar";

  return (
    <div className={sidebarClass}>
      <button onClick={onClose} className="close-sidebar-btn" title="Close Sources">×</button>
      <h3>Sources</h3>
      <div className="sidebar-content">
        {sources.map((source, index) => {
          if (!source || !source.metadata) return (
            <div key={index} className="sidebar-source-item error">
              Source {index + 1}: Invalid data
            </div>
          );

          const { content, metadata } = source;
          const sourceName = metadata.source || 'Unknown Source';
          const page = metadata.page !== undefined ? `Page: ${metadata.page}` : null;
          const distance = metadata.distance !== undefined ? `Distance: ${metadata.distance.toFixed(4)}` : null;

          return (
            <div key={index} className="sidebar-source-item">
              <h4>Source {index + 1}: {sourceName}</h4>
              <div className="sidebar-source-meta">
                {page && <span>{page}</span>}
                {distance && <span>{distance}</span>}
              </div>
              <div className="sidebar-source-content">
                {content || 'No content available'}
              </div>
            </div>
          );
        })}
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
    currentTurnResult,
    currentTurnSources,
    showResult,
    handleFileChange,  // Get from context
    isUploading,       // Get from context
    processUploadedFiles, // Get from context
    lastUploadResult,    // Get from context
    isProcessing,       // Get from context
    theme,               // Get theme from context
    processedFiles,      // Get processed files list
    user, // <<< Get user object from context
    logout // <<< Get logout function from context
  } = useContext(Context);

  // --- Define local state and refs AFTER context --- 
  const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  // -------------------------------------------------

  // --- Hooks ---
  const navigate = useNavigate(); // Hook for programmatic navigation

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, currentTurnResult]);

  return (
    <div className="main">
      {/* --- Sidebar for Sources --- */}
      <SourcesSidebar
        isOpen={isSourcesSidebarOpen}
        sources={currentTurnSources}
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
          {!chatHistory || chatHistory.length === 0 ? (
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
              {chatHistory.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <img src={message.role === 'user' ? assets.user_icon : assets.gemini_icon} alt={message.role} />
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
                  </div>
                </div>
              ))}

              {/* Display the current assistant response while loading */}
              {loading && (
                <div className="message assistant">
                  <img src={assets.gemini_icon} alt="assistant" />
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{currentTurnResult}</ReactMarkdown>
                    {/* Optional: Add a blinking cursor or indicator */}
                    <span className="loading-cursor">▋</span>
                  </div>
                </div>
              )}

              {/* Display sources button for the last completed turn */}
              {!loading && currentTurnSources && currentTurnSources.length > 0 && (
                <div className="sources-button-container">
                  <button
                    className="sources-button"
                    onClick={() => setIsSourcesSidebarOpen(true)}
                  >
                    Sources ({currentTurnSources.length})
                  </button>
                </div>
              )}

              {/* Empty div to act as scroll target */}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="main-bottom">
          {/* --- Conditional Process Button --- */}
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
          {/* --------------------------------- */}

          {/* --- ADD Processed Files Display HERE --- */}
          {processedFiles && processedFiles.length > 0 && (
            <div className="processed-files-container">
              {/* Simple display for now */}
              <p><strong>Context:</strong> {processedFiles.join(", ")}</p>
            </div>
          )}
          {/* ----------------------------------------- */}

          <div className="search-box">
            {/* Hidden File Input - Moved Here */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              style={{ display: 'none' }}
              accept=".pdf,.docx,.txt,.md"
            />
            {/* Input Field */}
            <input
              onChange={(e) => setInput(e.target.value)}
              value={input}
              type="text"
              placeholder="Enter a prompt here, or attach files..."
              onKeyPress={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && input.trim()) {
                  event.preventDefault();
                  onSent(input);
                }
              }}
            />
            {/* Input Icons */}
            <div>
              {/* Upload Trigger Icon */}
              <img
                src={assets.gallery_icon}
                alt="Attach Files"
                title="Attach Files"
                className={`input-icon ${isUploading ? 'disabled' : ''}`}
                onClick={() => !isUploading && fileInputRef.current?.click()}
              />
              {/* Mic Icon (Functionality TBD) */}
              <img
                src={assets.mic_icon}
                alt="Use Microphone"
                title="Use Microphone"
                className="input-icon"
              />
              {/* Send Icon */}
              <img
                onClick={() => input.trim() && !loading && onSent(input)}
                className={`input-icon send-icon ${loading || !input.trim() ? 'disabled' : ''}`}
                src={assets.send_icon}
                alt="Send"
                title="Send Message"
              />
            </div>
          </div>
          {/* Bottom Info */}
          <p className="bottom-info">
            AI may display inaccurate info. Check responses.
          </p>
        </div>
      </div> {/* End main-content-area */}
    </div>
  );
};

export default Main;
