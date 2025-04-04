/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */

// import { createContext, useState } from "react";
// import runChat from "../config/gemini";

// export const Context = createContext();

// const ContextProvider = (props) => {
//   const [input, setInput] = useState("");
//   const [recentPrompt, setRecentPrompt] = useState("");
//   const [prevPrompts, setPrevPrompts] = useState([]);
//   const [showResult, setShowResult] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [resultData, setResultData] = useState("");

//   const delayPara = (index, nextWord) => {
//     setTimeout(function () {
//       setResultData((prev) => prev + nextWord);
//     });
//   };

//   const onSent = async (prompt) => {
//     setResultData("");
//     setLoading(true);
//     setShowResult(true);
//     setRecentPrompt(input);
//     setPrevPrompts((prev) => [...prev, input]);
//     const response = await runChat(input);
//     let responseArray = response.split("**");
//     let newResponse;
//     for (let i = 0; i < responseArray.length; i++) {
//       if (i === 0 || i % 2 !== 1) {
//         newResponse += "<b>" + responseArray[i] + "</b>";
//       } else {
//         newResponse += "<b>" + responseArray[i] + "</b>";
//       }
//     }
//     let newResponse2 = newResponse2.split("*").join("</br>");
//     let newResponseArray = newResponse2.split(" ");
//     for (let i = 0; i < newResponseArray.length; i++) {
//       const nextWord = newResponseArray[i];
//       delayPara(i, nextWord + " ");
//     }
//     setLoading(false);
//     setInput("");
//   };

//   const contextValue = {
//     prevPrompts,
//     setPrevPrompts,
//     onSent,
//     setRecentPrompt,
//     recentPrompt,
//     showResult,
//     loading,
//     resultData,
//     input,
//     setInput,
//   };
//   return (
//     <Context.Provider value={contextValue}>{props.children}</Context.Provider>
//   );
// };

// export default ContextProvider;




// Context.jsx
import React, { createContext, useState, useCallback, useEffect } from "react";
import { fetchEventSource } from '@microsoft/fetch-event-source'; // Import SSE library
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator
import axios from 'axios'; // Re-import axios for upload/process
import { toast } from 'react-toastify'; // Import toast notifications
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// Remove Gemini import
// import runChat from "../config/gemini"; 

export const Context = createContext();

// Define backend URL (adjust if your FastAPI runs elsewhere)
const RAG_BACKEND_URL = "http://localhost:8088";

// TODO: Add NODE_BACKEND_URL later when implementing DB persistence
// const NODE_BACKEND_URL = "http://localhost:3001"; 

const ContextProvider = (props) => {
  // --- State Variables ---
  const [input, setInput] = useState("");
  const [showResult, setShowResult] = useState(false); // Controls if chat area shows welcome or result
  const [loading, setLoading] = useState(false); // For LLM response loading indicator

  // Session and History State
  const [currentSessionId, setCurrentSessionId] = useState(null); // ID of the active chat
  const [chatSessions, setChatSessions] = useState([]); // List of {id: string, title: string} for sidebar
  const [chatHistory, setChatHistory] = useState([]); // List of {role: 'user'/'assistant', content: string} for the current session

  // Result/Sources for the *current* turn (cleared on new message)
  const [currentTurnResult, setCurrentTurnResult] = useState("");
  const [currentTurnSources, setCurrentTurnSources] = useState([]);

  // --- NEW: Upload/Process State ---
  const [selectedFiles, setSelectedFiles] = useState([]); // Files selected by user
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState(null); // Store result of last upload
  const [lastProcessResult, setLastProcessResult] = useState(null); // Store result of last process call

  // --- NEW: Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check for a token in localStorage on initial load
    return !!localStorage.getItem('authToken');
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState(null); // Optional: store user info
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light"); // Load theme from storage
  // --------------------------------

  // --- Hooks ---
  const navigate = useNavigate(); // Hook for programmatic navigation

  // --- Effects --- 
  useEffect(() => {
    // Redirect based on auth status on initial load or auth change
    if (isAuthenticated && currentSessionId === null) {
      startNewChat(); // Start a chat if authenticated and no session
      // Fetch user sessions from Node backend later?
    }
    // Maybe redirect to /login if token expires or becomes invalid?
  }, [isAuthenticated]);

  useEffect(() => {
    // Remove existing theme classes
    document.body.classList.remove('light', 'dark');
    // Add the current theme class
    document.body.classList.add(theme);
    // Persist theme choice
    localStorage.setItem("theme", theme);
  }, [theme]); // Dependency array ensures this runs when theme changes

  // --- Helper Functions ---
  const generateChatTitle = (firstMessage) => {
    // Simple title generation - can be improved later (e.g., call LLM)
    const words = firstMessage.split(' ');
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  };

  // --- Core Functions ---
  const startNewChat = () => {
    const newSessionId = uuidv4();
    const newSession = { id: newSessionId, title: "New Chat" };

    console.log("Starting new chat, session ID:", newSessionId);
    setCurrentSessionId(newSessionId);
    setChatHistory([]); // Clear message history for the new chat
    setCurrentTurnResult(""); // Clear results from previous chat
    setCurrentTurnSources([]); // Clear sources
    setShowResult(false); // Show welcome screen
    setLoading(false);
    setInput("");

    // Add to the list of sessions for the sidebar (prepend for newest first)
    setChatSessions(prev => [newSession, ...prev]);

    // TODO: Persist this new session to the Node.js backend later
  };

  const selectChat = (sessionId) => {
    if (sessionId === currentSessionId) return; // Already selected

    console.log("Selecting chat, session ID:", sessionId);
    const selectedSession = chatSessions.find(s => s.id === sessionId);
    if (selectedSession) {
      setCurrentSessionId(sessionId);
      // TODO: Fetch history for this sessionId from Node.js backend later
      // For now, just clear it (or load from a temporary in-memory store if needed)
      setChatHistory([]);
      setCurrentTurnResult("");
      setCurrentTurnSources([]);
      setShowResult(false); // Reset view
      setLoading(false);
      setInput("");
    } else {
      console.error("Selected session ID not found:", sessionId);
      // Optionally start a new chat or show an error
    }
  };

  // Refactored onSent to handle history and session ID
  const onSent = useCallback(async (promptToSend) => {
    const currentPrompt = promptToSend || input;
    if (!currentPrompt || !currentSessionId) return; // Need prompt and session

    const userMessage = { role: "user", content: currentPrompt };
    const currentHistory = [...chatHistory, userMessage]; // Include the new user message

    // Update history state immediately for UI responsiveness
    setChatHistory(currentHistory);

    setCurrentTurnResult(""); // Clear previous turn results
    setCurrentTurnSources([]);
    setLoading(true);
    setShowResult(true);
    setInput(""); // Clear input field

    // --- Generate Title for New Chats --- 
    if (currentHistory.length === 1) { // Only user message exists
      const newTitle = generateChatTitle(currentPrompt);
      // Update title in the sessions list
      setChatSessions(prev => prev.map(s =>
        s.id === currentSessionId ? { ...s, title: newTitle } : s
      ));
      // TODO: Update title in Node.js backend later
    }

    // Store assistant response chunks here
    let assistantResponse = "";

    try {
      console.log(`SSE Connect: Session='${currentSessionId}', History Length=${currentHistory.length}`);

      await fetchEventSource(`${RAG_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          query: currentPrompt,
          session_id: currentSessionId, // Use current session ID
          // TODO: Send actual chat_history when backend supports it
          // chat_history: currentHistory.slice(0, -1) // Send history *before* current prompt
        }),

        onmessage(event) {
          if (!event.data) return;
          try {
            const parsedData = JSON.parse(event.data);
            if (parsedData.type === 'answer_chunk') {
              assistantResponse += parsedData.content;
              setCurrentTurnResult(prev => prev + parsedData.content); // Append chunk
            } else if (parsedData.type === 'sources') {
              setCurrentTurnSources(parsedData.content || []);
            } else if (parsedData.type === 'end') {
              // Stream finished, add complete assistant message to history
              setChatHistory(prev => [...prev, { role: "assistant", content: assistantResponse }]);
              // TODO: Save messages (user + assistant) to Node.js backend here
            } else if (parsedData.type === 'error') {
              console.error("Backend Stream Error:", parsedData.content);
              setCurrentTurnResult(prev => prev + `\n\nERROR: ${parsedData.content}`);
              // Add error message to history?
              setChatHistory(prev => [...prev, { role: "assistant", content: `Error: ${parsedData.content}` }]);
              setLoading(false);
            }
          } catch (e) {
            console.error("Failed to parse SSE message data:", event.data, e);
            if (typeof event.data === 'string') {
              setCurrentTurnResult((prev) => prev + event.data + '\n');
            } else {
              setCurrentTurnResult((prev) => prev + "\n\nError: Received unparseable message from backend.\n");
            }
            setChatHistory(prev => [...prev, { role: "assistant", content: `Error: Unparseable message - ${event.data}` }]);
          }
        },

        onclose() {
          console.log("SSE Connection closed by server.");
          setLoading(false);
        },

        onerror(err) {
          console.error("SSE Connection error:", err);
          setCurrentTurnResult((prev) => prev + "\n\nError: Connection to backend failed or was lost.");
          setLoading(false);
          setChatHistory(prev => [...prev, { role: "assistant", content: "Error: Connection failed." }]);
        },
      });

    } catch (error) {
      console.error("Failed to initiate SSE connection:", error);
      setCurrentTurnResult("Error: Could not connect to the backend streaming service.");
      setLoading(false);
      setChatHistory(prev => [...prev, { role: "assistant", content: "Error: Connection failed." }]);
    }

  }, [input, currentSessionId, chatHistory]); // Add dependencies
  // --- End Refactored onSent --- 

  // --- NEW: Upload/Process Functions ---
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    console.log("Files selected:", files);
    setSelectedFiles(files);
    // Automatically trigger upload after files are selected
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  const uploadFiles = async (filesToUpload) => {
    if (!filesToUpload || filesToUpload.length === 0) {
      toast.warn("No files selected for upload.");
      return;
    }

    setIsUploading(true);
    setLastUploadResult(null); // Clear previous result
    toast.info(`Uploading ${filesToUpload.length} file(s)...`);

    const formData = new FormData();
    filesToUpload.forEach((file) => {
      formData.append("files", file); // Backend expects 'files'
    });

    try {
      console.log(`Sending files to ${RAG_BACKEND_URL}/api/upload`);
      const response = await axios.post(`${RAG_BACKEND_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      });
      console.log("Upload response:", response.data);
      setLastUploadResult({ success: true, data: response.data });
      toast.success(`Successfully uploaded ${response.data.filenames_saved?.length || 0} file(s). Ready to process.`);
      // Clear selected files after successful upload?
      // setSelectedFiles([]); 
    } catch (error) {
      console.error("Error uploading files:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Unknown upload error";
      setLastUploadResult({ success: false, error: errorMsg });
      toast.error(`Upload failed: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const processUploadedFiles = async () => {
    if (!currentSessionId) {
      toast.error("Cannot process documents: No active chat session.");
      return;
    }
    // Optionally check if lastUploadResult was successful?
    // if (!lastUploadResult?.success) {
    //    toast.warn("Please upload files successfully before processing.");
    //    return;
    // }

    setIsProcessing(true);
    setLastProcessResult(null); // Clear previous result
    toast.info(`Processing documents for session ${currentSessionId}...`);

    try {
      console.log(`Processing documents for session ${currentSessionId}`);
      console.log(`Sending request to ${RAG_BACKEND_URL}/api/process`);

      const response = await axios.post(`${RAG_BACKEND_URL}/api/process`, {
        session_id: currentSessionId // Send current session ID
      }, {
        timeout: 60000, // 60 second timeout for processing
      });

      console.log("Processing response:", response.data);
      setLastProcessResult({ success: true, data: response.data });
      toast.success(response.data.message || "Processing finished.");
      // --- Clear upload result after successful processing --- 
      setLastUploadResult(null);
      // ---------------------------------------------------
    } catch (error) {
      console.error("Error processing documents:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Unknown processing error";
      setLastProcessResult({ success: false, error: errorMsg });
      toast.error(`Processing failed: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- NEW: Auth Functions ---
  const login = async (email, password) => {
    // TODO: Replace with actual API call to Node.js backend
    console.log("Attempting login for:", email);
    try {
      // const response = await axios.post(`${NODE_BACKEND_URL}/api/auth/login`, { email, password });
      // const { token, userData } = response.data;

      // --- Placeholder Success Logic ---
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      const token = "fake-jwt-token-" + Date.now(); // Simulate a token
      const userData = { email: email, name: "Test User" }; // Simulate user data
      // -------------------------------

      localStorage.setItem('authToken', token);
      setAuthToken(token);
      setUser(userData);
      setIsAuthenticated(true);
      toast.success("Login successful!");
      navigate('/app'); // <<< Navigate to app on successful login

    } catch (error) {
      console.error("Login failed:", error);
      const errorMsg = error.response?.data?.message || "Login failed. Please check credentials.";
      toast.error(errorMsg);
      setIsAuthenticated(false); // Ensure state is false on failure
    }
  };

  const register = async (name, email, password) => {
    // TODO: Replace with actual API call to Node.js backend
    console.log("Attempting registration for:", name, email);
    try {
      // const response = await axios.post(`${NODE_BACKEND_URL}/api/auth/register`, { name, email, password });
      // const { message } = response.data; // Or maybe token if auto-login

      // --- Placeholder Success Logic --- 
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      // Assume registration automatically logs in
      const token = "fake-jwt-token-" + Date.now();
      const userData = { email: email, name: name };
      // ---------------------------------

      toast.success("Registration successful! Logging in...");
      // Automatically log in after registration
      localStorage.setItem('authToken', token);
      setAuthToken(token);
      setUser(userData);
      setIsAuthenticated(true);
      navigate('/app'); // <<< Navigate to app on successful registration/login

    } catch (error) {
      console.error("Registration failed:", error);
      const errorMsg = error.response?.data?.message || "Registration failed. Please try again.";
      toast.error(errorMsg);
      setIsAuthenticated(false);
    }
  };

  const logout = () => {
    console.log("Logging out...");
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setCurrentSessionId(null); // Reset session state on logout
    setChatSessions([]);
    setChatHistory([]);
    navigate('/login'); // Navigate to login on logout
  };
  // ------------------------

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // --- Context Value --- 
  const contextValue = {
    // Existing States & Setters
    input,
    setInput,
    chatHistory,
    setChatHistory,
    loading,
    currentTurnResult,
    currentTurnSources,
    showResult,
    currentSessionId,
    isUploading,
    isProcessing,
    lastUploadResult,
    isAuthenticated,
    authToken,
    user, // Added user state

    // Existing Functions
    onSent,
    startNewChat,
    handleFileChange,
    processUploadedFiles,
    selectChat,
    login,
    register,
    logout,

    // --- Ensure Theme is included --- 
    theme,
    toggleTheme
    // ------------------------------
  };

  return (
    <Context.Provider value={contextValue}>
      {props.children}
    </Context.Provider>
  );
};

export default ContextProvider;
