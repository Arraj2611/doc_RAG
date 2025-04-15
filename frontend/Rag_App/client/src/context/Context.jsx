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

// Define backend URLs
const RAG_BACKEND_URL = "http://localhost:8088"; // Your Python RAG API
const NODE_BACKEND_URL = "http://localhost:3001"; // Your Node.js Auth/Chat API

// Create an Axios instance for Node backend calls
const nodeApi = axios.create({
  baseURL: NODE_BACKEND_URL,
});

// Add an interceptor to include the auth token in requests
nodeApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

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
  const [isAuthLoading, setIsAuthLoading] = useState(true); // <<< Add loading state for initial auth check
  const [isAuthenticated, setIsAuthenticated] = useState(false); // <<< Initialize as false
  const [authToken, setAuthToken] = useState(null); // <<< Initialize as null
  const [user, setUser] = useState(null); // Optional: store user info
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light"); // Load theme from storage

  // --- NEW: State for Processed Files --- 
  const [processedFiles, setProcessedFiles] = useState([]);
  // -------------------------------------

  // --- Hooks ---
  const navigate = useNavigate(); // Hook for programmatic navigation

  // --- Effects --- 
  useEffect(() => {
    // Initial Authentication Check on Mount
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        console.log("Token found in storage, attempting validation...");
        // Optional: Verify token with backend here if needed
        // For now, just assume token presence means authenticated
        try {
          // Example: Verify token with a backend endpoint (if you have one)
          // const response = await nodeApi.get('/api/auth/verify'); // Requires a backend route
          // setUser(response.data.user);
          // setAuthToken(token);
          // setIsAuthenticated(true);

          // --- Simple check (no backend verification) ---
          setAuthToken(token);
          setIsAuthenticated(true);
          // Fetch user data if needed (can be added to login response later)
          // setUser({ name: 'User from Token', email: '... ' });
          console.log("Simple token check successful.");
          // ----

        } catch (error) {
          console.error("Token validation failed:", error);
          localStorage.removeItem('authToken'); // Remove invalid token
          setIsAuthenticated(false);
          setAuthToken(null);
          setUser(null);
        }
      } else {
        console.log("No auth token found in local storage.");
      }
      setIsAuthLoading(false); // <<< Authentication check complete
    };

    checkAuth();
  }, []); // <<< Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    // Theme Management
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // --- Helper Functions ---
  const generateChatTitle = (firstMessage) => {
    // Simple title generation - can be improved later (e.g., call LLM)
    const words = firstMessage.split(' ');
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  };

  // --- Helper: Update History & Save to Backend ---
  const saveMessagesToBackend = async (sessionId, userMessage, assistantResponse) => {
    if (!sessionId || !userMessage || assistantResponse === undefined) {
      console.error("Missing data for saving messages to backend.");
      return;
    }
    const assistantMessage = { role: "assistant", content: assistantResponse };
    try {
      console.log(`Saving messages for session ${sessionId} to backend...`);
      await nodeApi.put(`/api/chats/${sessionId}`, {
        messages: [userMessage, assistantMessage]
      });
      console.log(`Messages saved successfully for session ${sessionId}.`);
    } catch (error) {
      console.error("Error saving messages to backend:", error.response?.data?.message || error.message);
      toast.error("Failed to save chat history.");
    }
  };

  // --- API Interaction Functions ---
  const fetchUserChatSessions = useCallback(async () => {
    if (!isAuthenticated) return; // Don't fetch if not logged in
    console.log("Fetching user chat sessions...");
    try {
      const response = await nodeApi.get('/api/chats');
      // Map backend response to frontend state structure if necessary
      // Assuming backend returns [{ sessionId, title, ... }]
      const sessions = response.data.map(s => ({ id: s.sessionId, title: s.title, ...s }));
      console.log("Fetched sessions:", sessions);
      setChatSessions(sessions);

      // If no sessions exist, start a new one automatically
      if (sessions.length === 0) {
        console.log("No existing sessions found, starting a new chat.");
        await startNewChat(false); // Start new chat without clearing existing (as there are none)
      } else if (!currentSessionId || !sessions.some(s => s.id === currentSessionId)) {
        // If no session is selected, or selected is invalid, select the latest one
        console.log("Selecting the latest chat session:", sessions[0].id);
        await selectChat(sessions[0].id);
      }
      return sessions; // Return fetched sessions
    } catch (error) {
      console.error("Error fetching chat sessions:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) {
        // If unauthorized (token expired/invalid), log out
        logout();
      } else {
        toast.error("Failed to load chat sessions.");
      }
      return []; // Return empty array on error
    }
  }, [isAuthenticated, currentSessionId]); // Dependency: re-fetch if auth state changes

  // --- Core Functions ---
  const startNewChat = useCallback(async (clearExistingSessions = true) => {
    const newSessionId = uuidv4();
    const newSessionTitle = "New Chat"; // Default title
    console.log("Attempting to start new chat, generated ID:", newSessionId);

    try {
      // 1. Create session on the Node backend first
      const response = await nodeApi.post('/api/chats', {
        sessionId: newSessionId,
        title: newSessionTitle // Send default title
      });

      // 2. On backend success, update frontend state
      const createdSession = { id: response.data.sessionId, title: response.data.title, ...response.data }; // Use data returned from backend
      console.log("Backend session created:", createdSession);

      if (clearExistingSessions) {
        setChatSessions(prev => [createdSession, ...prev]);
      } else {
        // If called because no sessions existed, just set this as the only session
        setChatSessions([createdSession]);
      }
      setCurrentSessionId(createdSession.id);
      setChatHistory([]);
      setCurrentTurnResult("");
      setCurrentTurnSources([]);
      setShowResult(false);
      setLoading(false);
      setInput("");
      setProcessedFiles([]);
      setLastUploadResult(null);
      setLastProcessResult(null);

      console.log("Frontend state updated for new chat:", createdSession.id);

    } catch (error) {
      console.error("Error creating new chat session on backend:", error.response?.data?.message || error.message);
      toast.error("Failed to start new chat. Please try again.");
      // Handle specific errors e.g., 401 Unauthorized
      if (error.response?.status === 401) {
        logout();
      }
    }
  }, []); // No dependencies needed if it doesn't rely on changing state directly

  const selectChat = useCallback(async (sessionId) => {
    if (!sessionId || sessionId === currentSessionId) return; // Already selected or invalid ID

    console.log("Selecting chat, session ID:", sessionId);
    setLoading(true); // Indicate loading state while fetching history
    setCurrentSessionId(sessionId);
    setChatHistory([]); // Clear old history immediately
    setCurrentTurnResult("");
    setCurrentTurnSources([]);
    setInput("");
    setProcessedFiles([]);
    setLastUploadResult(null);
    setLastProcessResult(null);

    try {
      // Fetch history for this sessionId from Node.js backend
      const response = await nodeApi.get(`/api/chats/${sessionId}`);
      const fetchedHistory = response.data; // Assuming backend returns the history array directly
      console.log(`Fetched history for ${sessionId}:`, fetchedHistory);

      setChatHistory(fetchedHistory || []); // Ensure it's an array
      setShowResult(fetchedHistory && fetchedHistory.length > 0); // Show result area if history exists

    } catch (error) {
      console.error(`Error fetching chat history for ${sessionId}:`, error.response?.data?.message || error.message);
      toast.error("Failed to load chat history.");
      // Handle specific errors e.g., 401 Unauthorized
      if (error.response?.status === 401) {
        logout();
      }
      // Optionally reset to a default state or show error message in chat area
      setShowResult(false);
    } finally {
      setLoading(false); // Stop loading indicator
    }
  }, [currentSessionId]); // Dependency on currentSessionId to prevent re-fetching same chat

  const onSent = useCallback(async (promptToSend) => {
    const currentPrompt = promptToSend || input;
    if (!currentPrompt || !currentSessionId) {
      console.warn("Prompt or Session ID missing, cannot send.");
      return;
    }

    const userMessage = { role: "user", content: currentPrompt };
    const updatedHistory = [...chatHistory, userMessage]; // Temporary history for UI update

    // Update UI immediately
    setChatHistory(updatedHistory);
    setCurrentTurnResult("");
    setCurrentTurnSources([]);
    setLoading(true);
    setShowResult(true);
    setInput("");

    // --- Update Title for New Chats (If needed) ---
    // Check if this is the *first* message in a session *after* it was created
    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    const isFirstMessageInSession = chatHistory.length === 0; // Check *before* adding user message to state if backend handles title update

    // We might let the backend handle title updates based on the first few messages later.
    // For now, title is set on creation ('New Chat') or potentially updated manually.

    // --- Call RAG Backend (Streaming) ---
    let assistantResponse = ""; // Accumulate response chunks
    let finalSources = []; // Accumulate sources

    try {
      console.log(`SSE Connect: Session='${currentSessionId}', Sending Prompt.`);
      await fetchEventSource(`${RAG_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          // Add Auth headers if RAG API requires them
        },
        body: JSON.stringify({
          query: currentPrompt,
          session_id: currentSessionId,
          // Pass history if RAG backend uses it. Ensure format matches backend expectations.
          // chat_history: updatedHistory.slice(0, -1) // Example: Send history *before* current prompt
        }),

        onmessage(event) {
          if (!event.data) {
            console.log("SSE onmessage: Received empty event data.");
            return;
          }
          // console.log("SSE onmessage: Raw data received:", event.data); // Debugging
          try {
            const parsedData = JSON.parse(event.data);
            // console.log("SSE onmessage: Parsed data:", parsedData); // Debugging

            if (parsedData.type === 'answer_chunk') {
              const chunk = parsedData.content || "";
              // console.log("SSE onmessage: Handling answer_chunk:", chunk); // Debugging
              assistantResponse += chunk;
              setCurrentTurnResult(prev => prev + chunk); // Stream to UI
              // console.log("SSE onmessage: currentTurnResult updated."); // Debugging
            } else if (parsedData.type === 'sources') {
              // console.log("SSE onmessage: Handling sources:", parsedData.content); // Debugging
              finalSources = parsedData.content || []; // Replace/set sources
              setCurrentTurnSources(finalSources); // Update UI
            } else if (parsedData.type === 'processed_files') {
              setProcessedFiles(parsedData.content || []); // Update processed files display
            } else if (parsedData.type === 'error') {
              console.error("SSE Error Event:", parsedData.content);
              toast.error(`Error from RAG: ${parsedData.content}`);
              // Decide how to handle backend errors - stop stream? show message?
              throw new Error(`RAG API Error: ${parsedData.content}`); // Throw to trigger catch block
            } else if (parsedData.type === 'end') {
              console.log("SSE onmessage: Handling end event. Final assistant response:", assistantResponse);
              // Stream finished message is handled in onclose/onerror
            } else {
              // console.log("SSE onmessage: Received unhandled event type:", parsedData.type);
            }
          } catch (parseError) {
            console.error("SSE onmessage: Failed to parse JSON data:", parseError, "Raw data:", event.data);
            // Handle non-JSON messages if necessary
          }
        },

        onclose() {
          console.log("SSE Connection closed by server.");
          setLoading(false);
          // Add the final assistant response to the history state *after* streaming is complete
          setChatHistory(prev => [...prev, { role: "assistant", content: assistantResponse }]);
          // Save the user message and the complete assistant response to the backend
          saveMessagesToBackend(currentSessionId, userMessage, assistantResponse);
        },

        onerror(err) {
          console.error("SSE Connection Error:", err);
          setLoading(false);
          toast.error("Connection error with chat service.");
          // Decide if partial response should be saved or added to history
          // Maybe add an error message to the chat history?
          // setChatHistory(prev => [...prev, { role: "assistant", content: "Error receiving response." }]);
          throw err; // Re-throw to be caught by the outer try/catch block
        }
      });
    } catch (error) {
      console.error("Error during onSent:", error);
      setLoading(false);
      // Display error in chat or using toast
      if (!toast.isActive('onSentError')) { // Prevent duplicate toasts
        toast.error("Failed to get response from chat service.", { toastId: 'onSentError' });
      }
      // Optionally add error message to chat history state
      // setChatHistory(prev => [...prev, { role: "assistant", content:"Sorry, I couldn't get a response."}]);
    }
  }, [input, currentSessionId, chatHistory, chatSessions]); // Dependencies updated

  // --- Authentication Functions ---
  const login = async (email, password) => {
    console.log("Attempting login...");
    try {
      const response = await nodeApi.post('/api/auth/login', { email, password });
      const { token, user: userData } = response.data;

      localStorage.setItem('authToken', token);
      setAuthToken(token);
      setUser(userData);
      setIsAuthenticated(true); // <<< State update
      toast.success("Login successful!");
      navigate('/app'); // <<< Navigation

    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      const errorMsg = error.response?.data?.message || "Login failed. Please check credentials.";
      toast.error(errorMsg);
      setIsAuthenticated(false);
      setAuthToken(null);
      setUser(null);
    }
  };

  const register = async (name, email, password) => {
    console.log("Attempting registration...");
    try {
      // We assume the backend register endpoint returns the same { token, user } structure as login upon success
      const response = await nodeApi.post('/api/auth/register', { name, email, password });
      const { token, user: userData } = response.data; // Expect token and user data

      toast.success("Registration successful! Logging in...");
      localStorage.setItem('authToken', token);
      setAuthToken(token);
      setUser(userData);
      setIsAuthenticated(true); // <<< State update
      navigate('/app'); // <<< Navigation

    } catch (error) {
      console.error("Registration failed:", error.response?.data?.message || error.message);
      const errorMsg = error.response?.data?.message || "Registration failed. Please try again.";
      toast.error(errorMsg);
      setIsAuthenticated(false);
      setAuthToken(null);
      setUser(null);
    }
  };

  const logout = () => {
    console.log("Logging out...");
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setCurrentSessionId(null);
    setChatSessions([]);
    setChatHistory([]);
    navigate('/login');
  };

  // --- Upload/Process Functions (Mostly unchanged, ensure session ID is used if needed) ---
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    // Simple validation (example: allow only PDF and DOCX)
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validFiles = files.filter(file => allowedTypes.includes(file.type));
    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      toast.warn(`Unsupported file types: ${invalidFiles.map(f => f.name).join(', ')}. Only PDF and DOCX allowed.`);
    }
    setSelectedFiles(validFiles); // Only store valid files
    if (validFiles.length > 0) {
      toast.info(`${validFiles.length} valid file(s) selected.`);
    }
    // Clear the input value so the same file can be selected again
    event.target.value = null;
  };

  const uploadFiles = async (filesToUpload) => {
    if (!filesToUpload || filesToUpload.length === 0) {
      toast.warn("No valid files selected for upload.");
      return;
    }
    if (!currentSessionId) {
      toast.error("No active chat session. Cannot upload files.");
      return;
    }

    const formData = new FormData();
    filesToUpload.forEach(file => {
      formData.append('files', file);
    });
    // Append session_id to the form data
    formData.append('session_id', currentSessionId);

    setIsUploading(true);
    setLastUploadResult(null); // Clear previous result
    console.log(`Uploading ${filesToUpload.length} files for session ${currentSessionId}...`);
    toast.info(`Uploading ${filesToUpload.length} file(s)...`);

    try {
      const response = await axios.post(`${RAG_BACKEND_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          // Add Auth headers if RAG API requires them
        },
      });
      console.log("Upload response:", response.data);
      setLastUploadResult(response.data); // Store result object
      toast.success(response.data.message || `${filesToUpload.length} file(s) uploaded successfully!`);
      setSelectedFiles([]); // Clear selected files after successful upload
    } catch (error) {
      console.error("File upload failed:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || "File upload failed.";
      setLastUploadResult({ error: errorMsg }); // Store error result
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const processUploadedFiles = async () => {
    if (!currentSessionId) {
      toast.error("No active chat session. Cannot process files.");
      return;
    }
    setIsProcessing(true);
    setLastProcessResult(null); // Clear previous result
    setProcessedFiles([]); // Clear displayed list while processing
    console.log(`Triggering processing for session ${currentSessionId}...`);
    toast.info("Processing uploaded documents...");

    try {
      // Send session_id in the request body
      const response = await axios.post(`${RAG_BACKEND_URL}/api/process`, {
        session_id: currentSessionId
      }, {
        // Add Auth headers if RAG API requires them
      });
      console.log("Processing response:", response.data);
      setLastProcessResult(response.data); // Store result object
      setProcessedFiles(response.data.processed_files || []); // Update list of processed files for display
      toast.success(response.data.message || "Documents processed successfully!");

    } catch (error) {
      console.error("Document processing failed:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || "Document processing failed.";
      setLastProcessResult({ error: errorMsg }); // Store error result
      toast.error(errorMsg);
      // Optionally display the error in the UI, e.g., setProcessedFiles([{ name: 'Error', error: errorMsg }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Theme Toggle ---
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // --- Effects ---
  useEffect(() => {
    // Theme management
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    // Fetch initial data on mount if authenticated
    if (isAuthenticated) {
      console.log("Authenticated on mount/change, fetching sessions...");
      fetchUserChatSessions();
    } else {
      console.log("Not authenticated on mount/change.");
      // Clear session data if not authenticated
      setChatSessions([]);
      setCurrentSessionId(null);
      setChatHistory([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Run when auth state changes


  // --- Context Value ---
  const contextValue = {
    // State
    input, setInput,
    showResult, setShowResult,
    loading, setLoading, // RAG loading
    currentSessionId, // Read-only needed by Sidebar
    chatSessions, // Read-only needed by Sidebar
    chatHistory, // Read-only needed by Main
    currentTurnResult, // For displaying streamed response
    currentTurnSources, // For displaying sources
    theme, // Read-only needed by components
    isAuthenticated, // Read-only
    user, // Read-only
    processedFiles, // Read-only needed by Main/Sidebar
    lastUploadResult,
    lastProcessResult,
    isUploading,
    isProcessing,
    selectedFiles,

    // Core Functions
    onSent,
    startNewChat,
    selectChat,

    // Auth Functions
    login,
    register,
    logout,

    // Upload/Process Functions
    handleFileChange,
    uploadFiles,
    processUploadedFiles,

    // Theme Function
    toggleTheme,

    // RAG Backend URL (if needed directly by components)
    // RAG_BACKEND_URL
    isAuthLoading, // <<< Pass the new loading state
  };

  return (
    <Context.Provider value={contextValue}>
      {props.children}
    </Context.Provider>
  );
};

export default ContextProvider;
