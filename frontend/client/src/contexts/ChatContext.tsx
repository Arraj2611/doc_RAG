import React, { createContext, useState, useCallback, useContext, ReactNode, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MessageType, CitationType } from '@/types';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/hooks/use-auth';
import { streamChatResponse, getFastApiToken } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface ChatSession {
  id: string;
  title: string;
  documentId: string | null;
  documentName: string | null;
  timestamp: string;
  messages: MessageType[];
}

interface ChatContextType {
  messages: MessageType[];
  currentChatId: string | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, documentId?: string, tenantId?: string) => Promise<void>;
  startNewChat: (documentId?: string) => void;
  clearChat: () => void;
  addMessage: (message: MessageType) => void;
  citations: CitationType[];
  currentDocId: string | null;
  chatHistory: ChatSession[];
  currentSessionId: string | null;
  saveCurrentSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<CitationType[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { selectedDocument, documents, setSelectedDocument } = useDocuments();
  const { toast } = useToast();
  const { user } = useAuth();

  // Load chat history from API
  useEffect(() => {
    if (user) {
      // Fetch chat sessions from the API
      const fetchChatSessions = async () => {
        try {
          const response = await fetch('/api/chat/sessions', {
            headers: {
              'Authorization': `Bearer ${getFastApiToken()}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const sessions = await response.json();
            // Transform the sessions to match our expected format
            const formattedSessions = sessions.map((session: any) => ({
              id: session.id,
              title: session.title,
              documentId: session.document_id,
              documentName: session.document_name,
              timestamp: session.created_at,
              messages: [] // We'll load messages when a session is selected
            }));
            setChatHistory(formattedSessions);
          } else {
            console.error('Failed to fetch chat sessions:', await response.text());
          }
        } catch (error) {
          console.error('Error fetching chat sessions:', error);
        }
      };

      fetchChatSessions();
    }

    // Initialize with welcome message
    setMessages([
      {
        id: uuidv4(),
        sender: "ai",
        content: "Welcome to DocuMind AI! I can help you analyze and extract insights from your documents. What would you like to know?",
        timestamp: new Date().toISOString()
      }
    ]);
  }, [user]);

  // Reset chat when document changes
  useEffect(() => {
    if (selectedDocument) {
      const document = documents.find(doc => doc.id === selectedDocument);

      // Create a new session for this document
      const newSessionId = uuidv4();
      setCurrentSessionId(newSessionId);

      setMessages([
        {
          id: uuidv4(),
          sender: "ai",
          content: document
            ? `I've loaded ${document.name}. What would you like to know about this document?`
            : "Welcome to DocuMind AI! I can help you analyze and extract insights from your documents. What would you like to know?",
          timestamp: new Date().toISOString()
        }
      ]);
    }
  }, [selectedDocument, documents]);

  // We don't need to save chat history to local storage anymore
  // as it's stored in MongoDB

  // Start a new chat session, optionally associated with a document
  const startNewChat = useCallback((documentId?: string) => {
    const newChatId = uuidv4();
    console.log(`Starting new chat with ID: ${newChatId}, Document ID: ${documentId}`);
    setCurrentChatId(newChatId);
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setCitations([]);
    setCurrentDocId(documentId || null);
  }, []);

  // Function to add a message (useful for initial prompts or system messages)
  const addMessage = useCallback((message: MessageType) => {
      setMessages((prev) => [...prev, message]);
  }, []);

  // Clear chat state
  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
    setError(null);
    setIsLoading(false);
    setCitations([]);
    setCurrentDocId(null);
  }, []);

  // Send message and handle streaming response
  const sendMessage = useCallback(async (content: string, documentId?: string, tenantId?: string) => {
    if (!user || isLoading) return;

    const chatId = currentChatId || uuidv4();
    if (!currentChatId) {
      setCurrentChatId(chatId);
      setCurrentDocId(documentId || null); // Track doc ID for the session
    }

    const userMessage: MessageType = {
      id: uuidv4(),
      sender: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setCitations([]); // Clear previous citations

    const aiMessageId = uuidv4();
    let aiContent = '';

    // Add placeholder for AI response
    setMessages((prev) => [
      ...prev,
      { id: aiMessageId, sender: 'ai', content: '...', timestamp: new Date().toISOString() },
    ]);

    try {
      // Determine the tenant ID for document-specific chat
      // If tenantId is provided directly, use it
      // Otherwise, if we have a documentId, construct a tenant ID based on the document
      let effectiveTenantId = tenantId;
      if (!effectiveTenantId && documentId) {
        // Find the document to get its name for the tenant ID
        const document = documents.find(doc => doc.id === documentId);
        if (document) {
          // Create a tenant ID in the format expected by the backend: user_{user_id}_doc_{doc_name}
          const docName = document.name.replace(/\.[^/.]+$/, ""); // Remove extension
          const sanitizedDocName = docName.replace(/[^a-zA-Z0-9_]/g, '_'); // Sanitize
          effectiveTenantId = `user_${user.id}_doc_${sanitizedDocName}`;
          console.log(`Generated tenant ID for document: ${effectiveTenantId}`);
        }
      }

      console.log(`Sending message with content: "${content.substring(0, 50)}...", tenantId: ${effectiveTenantId}`);

      // Prepare request for the streaming API
      const requestData = {
          question: content,
          session_id: chatId,
          tenant_id: effectiveTenantId // Pass the effective tenant ID
      };

      // Use the imported streamChatResponse function
      await streamChatResponse(
        requestData,
        (chunk) => {
          // Append chunk to AI message content
          aiContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: aiContent } : msg
            )
          );
        },
        (streamError) => {
          console.error("Chat stream error:", streamError);
          setError(streamError.message || 'Failed to get response from AI');
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: `Error: ${streamError.message}` } : msg
            )
          );
          setIsLoading(false);
        },
        () => {
          // Stream closed
          setIsLoading(false);
          // Optionally fetch citations here if backend signals completion differently
          console.log("AI response stream finished.");
        }
      );

    } catch (err) {
      console.error("Error sending message:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId ? { ...msg, content: `Error: ${errorMessage}` } : msg
        )
      );
      setIsLoading(false);
    }
  }, [user, isLoading, currentChatId, documents, startNewChat]); // Added documents to dependencies

  // Save current chat session to MongoDB
  const saveCurrentSession = async () => {
    if (!user || messages.length <= 1) {
      toast({
        title: "Cannot Save",
        description: "There are no messages to save or you're not logged in",
        variant: "destructive",
      });
      return;
    }

    const document = documents.find(doc => doc.id === selectedDocument);

    try {
      // First, create or update the session
      const sessionData = {
        title: document ? `Chat about ${document.name}` : `Chat ${new Date().toLocaleString()}`,
        document_id: selectedDocument,
        document_name: document?.name || null,
      };

      let sessionId = currentSessionId;

      if (!sessionId) {
        // Create a new session
        const sessionResponse = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getFastApiToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sessionData)
        });

        if (!sessionResponse.ok) {
          throw new Error(`Failed to create session: ${await sessionResponse.text()}`);
        }

        const newSession = await sessionResponse.json();
        sessionId = newSession.id;
        setCurrentSessionId(sessionId);
      }

      // Now save all messages that aren't already saved
      for (const message of messages) {
        // Skip welcome message
        if (message.content.includes("Welcome to DocuMind AI")) continue;

        await fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getFastApiToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: message.sender,
            content: message.content,
            document_id: selectedDocument,
            tenant_id: currentDocId
          })
        });
      }

      // Refresh the chat history
      const response = await fetch('/api/chat/sessions', {
        headers: {
          'Authorization': `Bearer ${getFastApiToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const sessions = await response.json();
        const formattedSessions = sessions.map((session: any) => ({
          id: session.id,
          title: session.title,
          documentId: session.document_id,
          documentName: session.document_name,
          timestamp: session.created_at,
          messages: []
        }));
        setChatHistory(formattedSessions);
      }

      toast({
        title: "Success",
        description: "Chat session saved",
      });
    } catch (error) {
      console.error('Error saving chat session:', error);
      toast({
        title: "Error",
        description: `Failed to save chat session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Load a saved session from MongoDB
  const loadSession = async (sessionId: string) => {
    if (!user) return;

    try {
      // First, get the session details
      const sessionResponse = await fetch(`/api/chat/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${getFastApiToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!sessionResponse.ok) {
        throw new Error(`Failed to load session: ${await sessionResponse.text()}`);
      }

      const session = await sessionResponse.json();
      setCurrentSessionId(session.id);

      // If the session has a document, select it
      if (session.document_id) {
        setSelectedDocument(session.document_id);
      }

      // Now get the messages for this session
      const messagesResponse = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${getFastApiToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!messagesResponse.ok) {
        throw new Error(`Failed to load messages: ${await messagesResponse.text()}`);
      }

      const messagesData = await messagesResponse.json();

      // Transform the messages to match our expected format
      const formattedMessages = messagesData.map((msg: any) => ({
        id: msg.id,
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // Add welcome message if there are no messages
      if (formattedMessages.length === 0) {
        formattedMessages.unshift({
          id: uuidv4(),
          sender: "ai",
          content: "Welcome to DocuMind AI! I can help you analyze and extract insights from your documents. What would you like to know?",
          timestamp: new Date().toISOString()
        });
      }

      setMessages(formattedMessages);

      toast({
        title: "Success",
        description: "Chat session loaded",
      });
    } catch (error) {
      console.error('Error loading chat session:', error);
      toast({
        title: "Error",
        description: `Failed to load chat session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Delete a saved session from MongoDB
  const deleteSession = async (sessionId: string) => {
    if (!user) return;

    try {
      // Delete the session from the API
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getFastApiToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${await response.text()}`);
      }

      // Update the local state
      setChatHistory(prev => prev.filter(s => s.id !== sessionId));

      // If the current session is deleted, clear the chat
      if (currentSessionId === sessionId) {
        clearChat();
      }

      toast({
        title: "Success",
        description: "Chat session deleted",
      });
    } catch (error) {
      console.error('Error deleting chat session:', error);
      toast({
        title: "Error",
        description: `Failed to delete chat session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  return (
    <ChatContext.Provider
      value={{
    messages,
        currentChatId,
    isLoading,
        error,
        sendMessage,
        startNewChat,
        clearChat,
        addMessage,
        citations,
        currentDocId,
    chatHistory,
    currentSessionId,
    saveCurrentSession,
    loadSession,
        deleteSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};