import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { MessageType, CitationType } from "@/types";
import { useDocumentStore } from "@/store/documentStore";
import * as apiService from "@/lib/apiService";
import { useToast } from "@/hooks/use-toast";

interface BackendChatMessage {
    role: 'user' | 'assistant' | string;
    content: string;
    timestamp?: string;
}

// Define the structure of the source data coming from the backend API
interface BackendSourceData {
    content_snippet: string;
    metadata: {
        source: string;
        page?: number | null; // Page might be number or null
    };
}

interface ChatContextType {
  messages: MessageType[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
  clearChat: () => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedSessionId = useDocumentStore((state) => state.selectedSessionId);
  const { toast } = useToast();
  
  useEffect(() => {
    setMessages([]);
    setError(null);

    if (selectedSessionId) {
      console.log(`[ChatContext] Selected session changed: ${selectedSessionId}. Fetching history...`);
      setIsLoading(true);
      apiService.getChatHistory(selectedSessionId)
        .then(history => {
          const formattedMessages: MessageType[] = history.map((msg: BackendChatMessage) => ({
            id: uuidv4(),
            sender: msg.role === 'assistant' ? 'ai' : 'user',
            content: msg.content,
            timestamp: msg.timestamp || new Date().toISOString(),
          }));
          setMessages(formattedMessages);
          console.log(`[ChatContext] Fetched ${formattedMessages.length} messages.`);
        })
        .catch(err => {
          const errorMsg = err.message || 'Failed to load chat history';
          console.error("[ChatContext] Error fetching history:", err);
          setError(errorMsg);
          toast({ title: "Error", description: errorMsg, variant: "destructive" });
          setMessages([{ 
        id: uuidv4(),
              sender: 'ai', 
              content: `Error loading history: ${errorMsg}`, 
              timestamp: new Date().toISOString(),
              error: true
          }]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setMessages([
        {
          id: uuidv4(),
          sender: "ai",
                content: "Select a document to start chatting.",
          timestamp: new Date().toISOString()
        }
      ]);
    }
  }, [selectedSessionId, toast]);
  
  const sendMessage = (content: string) => {
    if (!content.trim()) return;
    if (!selectedSessionId) {
        toast({ title: "Error", description: "Please select a document first.", variant: "destructive" });
        return;
    }
    
    const userMessage: MessageType = {
      id: uuidv4(),
      sender: "user",
      content,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    
    const aiMessageId = uuidv4();
    const aiPlaceholder: MessageType = {
        id: aiMessageId,
        sender: "ai",
        content: "",
        timestamp: new Date().toISOString(),
        isLoading: true,
    };
    setMessages(prev => [...prev, aiPlaceholder]);
    
    setIsLoading(true);
    setError(null);

    let accumulatedContent = "";
    // Temporarily store the raw backend sources
    let rawSources: BackendSourceData[] | undefined = undefined; 

    apiService.sendMessageViaPost(
        selectedSessionId!, // Assert non-null as checked earlier
        content, 
        (type, data) => {
            // --- OnMessage Handler ---
            if (type === 'token') {
                accumulatedContent += data;
                setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId 
                        ? { ...msg, content: accumulatedContent + "▌" }
                        : msg
                ));
            } else if (type === 'sources') {
                console.log("[ChatContext] Received raw sources:", data);
                // Store the raw data
                rawSources = data as BackendSourceData[]; 
            } else if (type === 'error') {
                 setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId 
                        ? { ...msg, content: `Error: ${data}`, isLoading: false, error: true } 
                        : msg
                ));
            }
        },
        () => {
            // --- OnComplete Handler ---
            console.log("[ChatContext] Stream complete.");
            
            // Map rawSources to CitationType[] before setting state
            let mappedCitations: CitationType[] | undefined = undefined;
            if (rawSources) {
                mappedCitations = rawSources.map(s => {
                    // Extract filename from the source path
                    const sourcePath = s.metadata?.source || 'Source';
                    const filename = sourcePath.split(/[\\/]/).pop() || sourcePath; // Get last part after / or \

                    return {
                        // Format text as "Filename: Snippet..."
                        text: `${filename}: "${s.content_snippet}..."`, 
                        page: s.metadata?.page !== null && s.metadata?.page !== undefined 
                              ? String(s.metadata.page + 1) // Convert page num (adjust if 0-based vs 1-based)
                              : 'N/A' 
                    };
                });
                console.log("[ChatContext] Mapped citations:", mappedCitations);
            }

            setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                    // Use the mapped citations
                    ? { ...msg, content: accumulatedContent, isLoading: false, citations: mappedCitations }
                    : msg
            ));
            setIsLoading(false);
        },
        (error) => {
            // --- OnError Handler ---
            const errorMsg = error.message || "Failed to get response from AI";
            console.error("[ChatContext] sendMessage error:", error);
            setError(errorMsg);
            setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                    ? { ...msg, content: `Error: ${errorMsg}`, isLoading: false, error: true } 
                    : msg
            ));
        setIsLoading(false);
            toast({ title: "Chat Error", description: errorMsg, variant: "destructive" });
        }
    );
  };
  
  const clearChat = () => {
      if (selectedSessionId) {
           console.log(`[ChatContext] Clearing chat for session: ${selectedSessionId}`);
            setMessages([]);
            setIsLoading(true);
             apiService.getChatHistory(selectedSessionId)
                .then(history => {
                     const formattedMessages: MessageType[] = history.map((msg: BackendChatMessage) => ({
                        id: uuidv4(),
                        sender: msg.role === 'assistant' ? 'ai' : 'user',
                        content: msg.content,
                        timestamp: msg.timestamp || new Date().toISOString()
                     }));
                     setMessages(formattedMessages);
                })
                .catch(err => {
                    const errorMsg = err.message || 'Failed to reload chat history after clearing';
                    console.error("[ChatContext] Error reloading history after clear:", err);
                    setError(errorMsg);
                    toast({ title: "Error", description: errorMsg, variant: "destructive" });
                    setMessages([{ 
                        id: uuidv4(), 
                        sender: 'ai', 
                        content: `Error reloading history: ${errorMsg}`, 
                        timestamp: new Date().toISOString(),
                        error: true 
                    }]);
                 })
                .finally(() => setIsLoading(false));
      } else {
    setMessages([
      {
        id: uuidv4(),
        sender: "ai",
                    content: "Select a document to start chatting.",
        timestamp: new Date().toISOString()
      }
    ]);
      }
  };

  const contextValue = {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}