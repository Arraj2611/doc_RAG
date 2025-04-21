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
import React, { createContext, useState, useCallback, useEffect, useRef } from "react";
import { fetchEventSource } from '@microsoft/fetch-event-source'; // Import SSE library
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator
import axios from 'axios'; // Re-import axios for upload/process
import { toast } from 'react-toastify'; // Import toast notifications
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// Remove Gemini import
// import runChat from "../config/gemini"; 

export const Context = createContext();

// Define backend URLs directly here
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
  // *** This is the primary state for displaying messages ***
  const [chatHistory, setChatHistory] = useState([]); // List of {id: string, role: 'user'/'assistant', content: string, sources?: any[]}

  // Removed redundant state variables:
  // const [currentTurnResult, setCurrentTurnResult] = useState("");
  // const [currentTurnSources, setCurrentTurnSources] = useState([]);
  // const [resultData, setResultData] = useState([]);

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
  // Removed resultData, recentPrompt, recentChats as they are handled differently now
  const [recentPrompt, setRecentPrompt] = useState(""); // Keep recentPrompt if needed for displaying in UI? (Revisit)

  // -------------------------------------

  // --- Hooks ---
  const navigate = useNavigate(); // Hook for programmatic navigation

  // --- Authentication Check Effect (Keep near top) ---
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

  // --- Theme Effect (Keep near top) ---
  useEffect(() => {
    // Theme Management
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // --- Helper Functions (like generateChatTitle, saveMessagesToBackend) ---
  const generateChatTitle = (firstMessage) => {
    // Simple title generation - can be improved later (e.g., call LLM)
    const words = firstMessage.split(' ');
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  };

  // --- Helper: Update History & Save to Backend ---
  // Keep this as is, it operates on completed messages
  const saveMessagesToBackend = async (sessionId, userMessage, assistantResponse) => {
    if (!sessionId || !userMessage || assistantResponse === undefined) {
      console.error("Missing data for saving messages to backend.");
      return;
    }
    // Ensure we have content for the assistant message before saving
    const assistantContent = typeof assistantResponse === 'object' ? assistantResponse.content : assistantResponse;
    if (assistantContent === null || assistantContent === undefined) {
      console.warn("Assistant response content missing, skipping save.");
      return;
    }
    const assistantMessage = { role: "assistant", content: assistantContent };
    try {
      console.log(`Saving messages for session ${sessionId} to backend...`);
      await nodeApi.put(`/api/chats/${sessionId}`, {
        // Send only necessary fields for saving
        messages: [
          { role: userMessage.role, content: userMessage.content },
          { role: assistantMessage.role, content: assistantMessage.content }
        ]
      });
      console.log(`Messages saved successfully for session ${sessionId}.`);
    } catch (error) {
      console.error("Error saving messages to backend:", error.response?.data?.message || error.message);
      toast.error("Failed to save chat history.");
    }
  };


  // --- Define core utility functions first ---
  const logout = useCallback(() => {
    console.log("Logging out...");
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setCurrentSessionId(null);
    setChatSessions([]);
    setChatHistory([]);
    navigate('/login');
  }, [navigate]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // --- Define core chat functions (check dependencies) ---
  const startNewChat = useCallback(async (clearExistingSessions = true) => {
    const newSessionId = uuidv4();
    const newSessionTitle = "New Chat";
    console.log("Attempting to start new chat, generated ID:", newSessionId);
    try {
      const response = await nodeApi.post('/api/chats', {
        sessionId: newSessionId,
        title: newSessionTitle
      });
      const createdSession = { id: response.data.sessionId, title: response.data.title, ...response.data };
      console.log("Backend session created:", createdSession);
      if (clearExistingSessions) {
        // Prepend the new session to the existing list
        setChatSessions(prev => [createdSession, ...prev.filter(s => s.id !== createdSession.id)]); // Avoid duplicates if called rapidly
      } else {
        // Replace the list if clearing
        setChatSessions([createdSession]);
      }
      setCurrentSessionId(createdSession.id);
      setChatHistory([]); // <<< Clear history for the new chat
      setShowResult(false); // <<< Don't show result area initially
      setLoading(false);
      setInput("");
      setProcessedFiles([]);
      setLastUploadResult(null);
      setLastProcessResult(null);
      console.log("Frontend state updated for new chat:", createdSession.id);
    } catch (error) {
      console.error("Error creating new chat session on backend:", error.response?.data?.message || error.message);
      toast.error("Failed to start new chat. Please try again.");
      if (error.response?.status === 401) {
        logout(); // <<< Depends on logout
      }
    }
  }, [logout]); // Dependencies: logout

  const selectChat = useCallback(async (sessionId) => {
    if (!sessionId || sessionId === currentSessionId) return;
    console.log("Selecting chat, session ID:", sessionId);
    setLoading(true); // Indicate loading history
    setCurrentSessionId(sessionId);
    setChatHistory([]); // Clear current history before loading new
    setInput("");
    setProcessedFiles([]); // Clear files related to previous chat
    setLastUploadResult(null);
    setLastProcessResult(null);
    try {
      const response = await nodeApi.get(`/api/chats/${sessionId}`);
      // Assuming backend returns an array of { role, content }
      const fetchedHistory = response.data?.messages || [];
      // Add unique IDs to fetched messages if they don't have them
      const historyWithIds = fetchedHistory.map(msg => ({ ...msg, id: msg.id || uuidv4() }));
      console.log(`Fetched history for ${sessionId}:`, historyWithIds);
      setChatHistory(historyWithIds);
      setShowResult(historyWithIds.length > 0); // Show result area if history exists
    } catch (error) {
      console.error(`Error fetching chat history for ${sessionId}:`, error.response?.data?.message || error.message);
      toast.error("Failed to load chat history.");
      if (error.response?.status === 401) {
        logout(); // <<< Depends on logout
      }
      setChatHistory([]); // Ensure history is empty on error
      setShowResult(false);
    } finally {
      setLoading(false); // Stop loading indicator
    }
  }, [currentSessionId, logout]); // Dependencies: currentSessionId, logout


  const updateChatTitle = useCallback(async (sessionId, newTitle) => {
    if (!newTitle || typeof newTitle !== 'string' || newTitle.trim() === '') {
      toast.error("Invalid title.");
      return;
    }
    console.log(`Attempting to update title for session ${sessionId} to "${newTitle}"`);

    try {
      // 1. Call backend API to update the title
      const response = await nodeApi.put(`/api/chats/${sessionId}/title`, {
        title: newTitle.trim()
      });
      const updatedTitle = response.data.title; // Get updated title from response
      toast.success("Chat title updated.");

      // 2. Update frontend state (chatSessions)
      setChatSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId ? { ...session, title: updatedTitle } : session
        )
      );

    } catch (error) {
      console.error("Error updating chat title:", error.response?.data?.message || error.message);
      toast.error("Failed to update chat title.");
      if (error.response?.status === 401) {
        logout();
      }
    }
  }, [logout]);

  // Define deleteChatSession AFTER startNewChat and selectChat
  const deleteChatSession = useCallback(async (sessionIdToDelete) => {
    console.log("Attempting to delete session:", sessionIdToDelete);

    // Basic confirmation
    if (!window.confirm("Are you sure you want to delete this chat session?")) {
      return; // User cancelled
    }

    try {
      // 1. Call backend API to delete the session
      await nodeApi.delete(`/api/chats/${sessionIdToDelete}`);
      toast.success("Chat session deleted.");

      // 2. Update frontend state
      let nextSessionId = null;
      const remainingSessions = chatSessions.filter(s => s.id !== sessionIdToDelete);

      if (currentSessionId === sessionIdToDelete) {
        // If the deleted chat was the active one, select another or start new
        if (remainingSessions.length > 0) {
          nextSessionId = remainingSessions[0].id; // Select the top one from remaining
          console.log("Deleted current session, selecting next:", nextSessionId);
        } else {
          console.log("Deleted last session, starting new chat.");
          // No sessions left, start a new one (will handle state updates)
          await startNewChat(false); // Start without clearing (already empty)
          // No need to update sessions here, startNewChat will do it
          return; // Exit early as startNewChat handles state
        }
      }

      // Update the sessions list
      setChatSessions(remainingSessions);

      // If we determined a next session needs to be selected
      if (nextSessionId) {
        await selectChat(nextSessionId);
      }

    } catch (error) {
      console.error("Error deleting chat session:", error.response?.data?.message || error.message);
      toast.error("Failed to delete chat session.");
      // Handle specific errors e.g., 401 Unauthorized
      if (error.response?.status === 401) {
        logout();
      }
    }
  }, [chatSessions, currentSessionId, selectChat, startNewChat, logout]);

  // --- Define functions that depend on core chat functions ---
  const fetchUserChatSessions = useCallback(async () => {
    if (!isAuthenticated) return;
    console.log("Fetching user chat sessions...");
    try {
      const response = await nodeApi.get('/api/chats');
      // Ensure correct mapping from backend session structure to { id, title }
      const sessions = response.data.map(s => ({
        id: s.sessionId, // Assuming backend sends sessionId
        title: s.title
      }));
      console.log("Fetched sessions:", sessions);
      setChatSessions(sessions); // Replace existing sessions
      if (sessions.length === 0) {
        console.log("No existing sessions found, starting a new chat.");
        await startNewChat(false); // <<< Depends on startNewChat
      } else if (!currentSessionId || !sessions.some(s => s.id === currentSessionId)) {
        // If no session is selected or the current one isn't in the fetched list, select the first/latest one
        console.log("Selecting the latest chat session:", sessions[0].id);
        await selectChat(sessions[0].id); // <<< Depends on selectChat
      } else {
        // Current session is valid, no need to re-select, but maybe refresh history? (Optional)
        // await selectChat(currentSessionId); // Re-fetch history for consistency
      }
      return sessions;
    } catch (error) {
      console.error("Error fetching chat sessions:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) {
        logout(); // <<< Depends on logout
      } else {
        toast.error("Failed to load chat sessions.");
      }
      return [];
    }
  }, [isAuthenticated, currentSessionId, startNewChat, selectChat, logout]); // Dependencies


  // *** REFACTORED onSent ***
  const onSent = useCallback(async (prompt) => {
    if (!prompt || !currentSessionId) {
      console.error("Cannot send: Prompt or Session ID missing.");
      return;
    }

    setLoading(true);
    setShowResult(true); // Show the chat area
    setRecentPrompt(prompt); // Keep track of the last prompt sent

    const userMessage = { id: uuidv4(), role: "user", content: prompt };
    const assistantMessageId = uuidv4();
    const initialAssistantMessage = { id: assistantMessageId, role: "assistant", content: "", sources: [] };

    // Add user message and initial assistant message to history
    setChatHistory(prev => [...prev, userMessage, initialAssistantMessage]);

    // Ref for the controller to abort the fetch request if needed
    const ctrl = new AbortController();
    let finalAssistantMessage = null; // To store the completed message for saving

    try {
      await fetchEventSource(RAG_BACKEND_URL + "/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add Authorization header if needed
          'Accept': 'text/event-stream', // Explicitly accept event stream
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          query: prompt,
        }),
        signal: ctrl.signal, // Pass the abort signal

        // Handle opening the connection
        onopen: async (response) => {
          console.log("SSE Connection Opened");
          if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
            const errorText = await response.text();
            console.error("SSE Failed to open correctly:", response.status, errorText);
            throw new Error(`SSE Failed: ${response.status} - ${errorText || 'Invalid content type'}`);
          }
        },

        // Handle incoming messages (events)
        onmessage: (event) => {
          console.log("SSE Message Received:", event.data); // Log raw event data
          if (event.event === 'close' || !event.data) {
            console.log("SSE Close event or empty data received.");
            ctrl.abort(); // Close the connection from client-side
            setLoading(false); // Ensure loading is off if closed prematurely
            return;
          }

          try {
            const data = JSON.parse(event.data);

            if (data.type === "token") {
              setChatHistory(prev =>
                prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                )
              );
            } else if (data.type === "sources") {
              setChatHistory(prev =>
                prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, sources: data.sources } // Update sources on the assistant message
                    : msg
                )
              );
            } else if (data.type === "error") {
              console.error("Stream Reader: Received stream error from backend:", data.message);
              setChatHistory(prev =>
                prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: `Error: ${data.message}` }
                    : msg
                )
              );
              setLoading(false); // <<< Stop loading on stream error
              ctrl.abort(); // Stop processing on error
            } else if (data.type === "end") {
              console.log("Stream Reader: Received 'end' event from backend.");
              setLoading(false); // <<< Stop loading on END event
              ctrl.abort(); // Signal stream end
            } else {
              console.warn("Stream Reader: Received unknown data type from backend:", data.type, data);
            }
          } catch (e) {
            console.error("SSE JSON PARSE ERROR:", e, "--- Problematic Data:", event.data, "---");
            setLoading(false); // <<< Stop loading on parse error
            ctrl.abort(); // Stop stream on parse error
          }
        },

        // Handle errors during the fetch/stream
        onerror: (err) => {
          console.error("SSE Fetch Error:", err);
          // Update the assistant message with an error state
          setChatHistory(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error receiving response: ${err.message || 'Connection failed'}` }
                : msg
            )
          );
          setLoading(false); // <<< Ensure loading is off on SSE error
        },

        // Handle closing the connection (optional)
        onclose: () => {
          console.log("SSE Connection Closed");
          setLoading(false); // <<< Keep as fallback / ensure final state
          // Find the completed assistant message to save it
          setChatHistory(prev => {
            finalAssistantMessage = prev.find(msg => msg.id === assistantMessageId);
            if (userMessage && finalAssistantMessage) {
              saveMessagesToBackend(currentSessionId, userMessage, finalAssistantMessage);
            } else {
              console.warn("Could not find completed messages to save.");
            }
            return prev; // Return the state unchanged after finding the message
          });
        }
      });

    } catch (error) {
      console.error("Error in onSent fetchEventSource setup:", error);
      // Update the assistant message in history with the error
      setChatHistory(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${error.message || 'Failed to get response'}` }
            : msg
        )
      );
      setLoading(false); // Ensure loading is off
    } finally {
      // setLoading(false); // Moved to onclose/onerror for better timing
      setInput(""); // Clear input after sending
      console.log("onSent finally block executed.");
    }
  }, [currentSessionId, saveMessagesToBackend]); // Dependencies: currentSessionId, saveMessagesToBackend


  // --- Auth Functions (depend on fetchUserChatSessions) ---
  const login = useCallback(async (email, password) => {
    setIsAuthLoading(true);
    try {
      const response = await nodeApi.post('/api/auth/login', { email, password });
      const { token, user: userData } = response.data;
      localStorage.setItem('authToken', token);
      setAuthToken(token);
      setUser(userData);
      setIsAuthenticated(true);
      toast.success("Login successful!");
      await fetchUserChatSessions(); // Fetch sessions AFTER successful login
      navigate('/app'); // Navigate AFTER fetching sessions
      return true;
    } catch (error) {
      console.error("Login error:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'An error occurred during login.');
      setIsAuthenticated(false);
      setAuthToken(null);
      setUser(null);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [navigate, fetchUserChatSessions]); // Dependencies: navigate, fetchUserChatSessions

  const register = useCallback(async (name, email, password) => {
    setIsAuthLoading(true);
    try {
      const response = await nodeApi.post('/api/auth/register', { name, email, password });
      toast.success('Registration successful! Please log in.');
      navigate('/login');
      return true;
    } catch (error) {
      console.error("Registration error:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'An error occurred during registration.');
      // Keep user logged out on registration failure
      setIsAuthenticated(false);
      setAuthToken(null);
      setUser(null);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [navigate]); // Dependencies: navigate


  // --- Upload/Process Functions ---
  // Define processUploadedFiles first as uploadFiles calls it
  const processUploadedFiles = useCallback(async () => {
    if (!currentSessionId) {
      toast.error("No active chat session. Cannot process files.");
      return;
    }
    setIsProcessing(true);
    setLastProcessResult(null);
    setProcessedFiles([]);
    console.log(`Triggering processing for session ${currentSessionId}...`);
    toast.info("Processing uploaded documents...");

    try {
      const response = await axios.post(`${RAG_BACKEND_URL}/api/process`, {
        session_id: currentSessionId
      });
      console.log("Processing response:", response.data);
      setLastProcessResult(response.data);
      setProcessedFiles(response.data.processed_files || []);
      toast.success(response.data.message || "Documents processed successfully!");
    } catch (error) {
      console.error("Document processing failed:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || "Document processing failed.";
      setLastProcessResult({ error: errorMsg });
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [currentSessionId]);

  const uploadFiles = useCallback(async (filesToUpload) => {
    if (!filesToUpload || filesToUpload.length === 0) {
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
    formData.append('session_id', currentSessionId);

    setIsUploading(true);
    setLastUploadResult(null);
    console.log(`Uploading ${filesToUpload.length} files for session ${currentSessionId}...`);
    toast.info(`Uploading ${filesToUpload.length} file(s)...`);

    let uploadSuccess = false;
    try {
      const response = await axios.post(`${RAG_BACKEND_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log("Upload response:", response.data);
      setLastUploadResult(response.data);
      toast.success(response.data.message || `${filesToUpload.length} file(s) uploaded successfully!`);
      setSelectedFiles([]);
      uploadSuccess = true;
    } catch (error) {
      console.error("File upload failed:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || "File upload failed.";
      setLastUploadResult({ error: errorMsg });
      toast.error(errorMsg);
      uploadSuccess = false;
    } finally {
      setIsUploading(false);
      if (uploadSuccess) {
        await processUploadedFiles(); // <<< Call the function defined above
      }
    }
  }, [currentSessionId, processUploadedFiles]);

  const handleFileChange = useCallback((event) => {
    const files = Array.from(event.target.files);
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validFiles = files.filter(file => allowedTypes.includes(file.type));
    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      toast.warn(`Unsupported file types: ${invalidFiles.map(f => f.name).join(', ')}. Only PDF and DOCX allowed.`);
    }

    if (validFiles.length > 0) {
      toast.info(`${validFiles.length} valid file(s) selected.`);
      uploadFiles(validFiles); // <<< Call the function defined above
    } else {
      toast.warn("No valid files selected.");
    }

    // Reset file input to allow selecting the same file again
    if (event.target) {
      event.target.value = null;
    }
  }, [uploadFiles]); // Dependencies: uploadFiles


  // --- Context Value --- 
  const contextValue = {
    // State
    input, setInput,
    showResult, setShowResult, // Still needed to toggle welcome/chat view
    loading, setLoading, // Still needed for loading indicator
    currentSessionId,
    chatSessions,
    chatHistory, // *** Primary state for messages ***
    theme,
    isAuthenticated,
    user,
    processedFiles,
    lastUploadResult,
    lastProcessResult,
    isUploading,
    isProcessing,
    selectedFiles, setSelectedFiles, // Allow UI to potentially clear selected files
    isAuthLoading,
    recentPrompt, // Pass if needed elsewhere

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
    // uploadFiles, // Not passed directly to UI unless needed
    // processUploadedFiles, // Not passed directly to UI unless needed

    // Theme Function
    toggleTheme,

    // New functions
    fetchUserChatSessions,
    deleteChatSession,
    updateChatTitle,
  };

  return (
    <Context.Provider value={contextValue}>
      {props.children}
    </Context.Provider>
  );
};

export default ContextProvider;
