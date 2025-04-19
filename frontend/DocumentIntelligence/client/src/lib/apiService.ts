import axios from 'axios';

// TODO: Move to environment variables (.env)
const PYTHON_BACKEND_URL = 'http://localhost:8088/api';

// --- Interfaces (Define based on backend Pydantic models) ---

interface DocumentMetadata {
    session_id: string;
    filename: string;
    user_id?: string | null;
    processed_at?: string; // Assuming datetime comes as string
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool'; // Adjust roles as needed
    content: string;
    timestamp?: string;
}

interface InsightData {
    id: string;
    insight: string;
    timestamp?: string;
}

interface ProcessResponse {
    message: string;
    processed_files: string[];
    skipped_count: number;
    failed_files: string[];
}

interface UploadResponse {
    message: string;
    filenames_saved: string[];
    skipped_unsupported_extension: number;
}

interface SaveInsightResponse {
    message: string;
}

// --- API Functions ---

/**
 * Uploads files for a specific session ID.
 * NOTE: The backend currently requires session_id during upload,
 * but the flow might be: upload -> process -> get session_id.
 * This needs clarification/adjustment based on final backend flow.
 * Assuming for now session_id must be generated client-side first.
 */
export const uploadFiles = async (sessionId: string, files: File[]): Promise<UploadResponse> => {
    const formData = new FormData();
    files.forEach(file => {
        formData.append('files', file);
    });
    // Backend expects session_id as form data alongside files
    formData.append('session_id', sessionId);

    console.log(`[API] Uploading ${files.length} files for session: ${sessionId}`);
    const response = await axios.post<UploadResponse>(`${PYTHON_BACKEND_URL}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    console.log('[API] Upload response:', response.data);
    return response.data;
};

/**
 * Triggers the processing of uploaded files for a given session ID.
 * Includes user ID for associating metadata.
 */
export const processFiles = async (sessionId: string, userId: string | undefined): Promise<ProcessResponse> => {
    console.log(`[API] Processing files for session: ${sessionId}, User: ${userId}`);
    // Include user_id in the request body
    const response = await axios.post<ProcessResponse>(`${PYTHON_BACKEND_URL}/process`, {
        session_id: sessionId,
        user_id: userId // Send user_id here
    });
    console.log('[API] Process response:', response.data);
    return response.data;
};

/**
 * Fetches the list of documents associated with a user.
 * TODO: Requires authentication to get user_id securely.
 */
export const getDocuments = async (userId: string): Promise<DocumentMetadata[]> => {
    console.log(`[API] Getting documents for user: ${userId}`);
    // Pass userId as query param for now, needs proper auth implementation
    const response = await axios.get<DocumentMetadata[]>(`${PYTHON_BACKEND_URL}/documents?user_id=${userId}`);
    console.log('[API] Get documents response:', response.data);
    return response.data;
};

/**
 * Fetches the chat history for a specific session ID.
 */
export const getChatHistory = async (sessionId: string): Promise<ChatMessage[]> => {
    console.log(`[API] Getting chat history for session: ${sessionId}`);
    const response = await axios.get<ChatMessage[]>(`${PYTHON_BACKEND_URL}/history/${sessionId}`);
    console.log('[API] Get history response:', response.data);
    return response.data;
};

/**
 * Sends a chat message and handles the Server-Sent Events (SSE) stream.
 * Calls onMessage for each token/event and onComplete when finished.
 */
export const sendMessage = (
    sessionId: string,
    message: string,
    onMessage: (type: 'token' | 'sources' | 'error' | 'end', data: any) => void,
    onComplete: () => void,
    onError: (error: any) => void
) => {
    console.log(`[API] Sending message for session ${sessionId}: ${message.substring(0, 50)}...`);
    const eventSource = new EventSource(`${PYTHON_BACKEND_URL}/chat?session_id=${sessionId}&query=${encodeURIComponent(message)}`); // Use GET with query params for EventSource

    eventSource.onmessage = (event) => {
        try {
            const parsedData = JSON.parse(event.data);
            console.log('[API] SSE Message:', parsedData);
            if (parsedData.type === 'token') {
                onMessage('token', parsedData.content);
            } else if (parsedData.type === 'sources') {
                onMessage('sources', parsedData.sources);
            } else if (parsedData.type === 'error') {
                console.error('[API] SSE Error:', parsedData.message);
                onMessage('error', parsedData.message);
                eventSource.close(); // Close on error
                onError(new Error(parsedData.message)); // Propagate error
            } else if (parsedData.type === 'end') {
                console.log('[API] SSE Stream ended.');
                eventSource.close();
                onComplete();
            }
        } catch (error) {
            console.error('[API] Error parsing SSE message:', error);
            // Might receive non-JSON confirmation pings, ignore them
        }
    };

    eventSource.onerror = (error) => {
        console.error('[API] SSE Connection Error:', error);
        eventSource.close();
        onError(error); // Propagate connection error
    };

    // Return the eventSource instance so the caller can close it if needed (e.g., on component unmount)
    return eventSource;
};

/**
 * Sends a chat message - Adapted for POST if EventSource direct POST isn't feasible/desired.
 * This requires the backend /chat endpoint to be POST and return the streaming response.
 */
export const sendMessageViaPost = async (
    sessionId: string,
    message: string,
    onMessage: (type: 'token' | 'sources' | 'error' | 'end', data: any) => void,
    onComplete: () => void,
    onError: (error: any) => void
): Promise<void> => {
    console.log(`[API] Sending message via POST for session ${sessionId}: ${message.substring(0, 50)}...`);
    try {
        const response = await fetch(`${PYTHON_BACKEND_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream' // Important to signal desire for SSE
            },
            body: JSON.stringify({ session_id: sessionId, query: message }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

        let buffer = ''; // Buffer to store partial messages
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log('[API] Stream finished');
                // Process any remaining data in the buffer if necessary
                if (buffer.startsWith('data:')) {
                    // Handle potentially incomplete message at the end if needed
                    console.warn('[API] Stream ended with potential partial message in buffer:', buffer);
                }
                break;
            }

            buffer += value; // Append new chunk to buffer

            let messageEndIndex;
            // Process all complete messages (ending with \n\n) in the buffer
            while ((messageEndIndex = buffer.indexOf('\n\n')) !== -1) {
                const message = buffer.substring(0, messageEndIndex); // Get complete message part
                buffer = buffer.substring(messageEndIndex + 2); // Remove message and \n\n from buffer

                if (message.startsWith('data:')) {
                    const jsonData = message.substring(5).trim();
                    if (jsonData) {
                        try {
                            const parsedData = JSON.parse(jsonData);
                            console.log('[API] SSE Message:', parsedData);
                            // --- Process parsedData --- 
                            if (parsedData.type === 'token') {
                                onMessage('token', parsedData.content);
                            } else if (parsedData.type === 'sources') {
                                onMessage('sources', parsedData.sources);
                            } else if (parsedData.type === 'error') {
                                console.error('[API] SSE Error:', parsedData.message);
                                onMessage('error', parsedData.message);
                                onError(new Error(parsedData.message));
                                reader.cancel(); // Close the stream reader on error
                                return; // Stop processing
                            } else if (parsedData.type === 'end') {
                                console.log('[API] SSE Stream ended event received.');
                                // Wait for done=true before calling onComplete
                            }
                            // --- End of processing logic ---
                        } catch (e) {
                            console.error('[API] Error parsing SSE JSON:', e, 'Data:', jsonData);
                        }
                    }
                } else if (message.trim()) {
                    // Handle non-data lines if necessary (e.g., comments ': ping')
                    console.log('[API] SSE Non-data line:', message);
                }
            }
            // Buffer now contains any incomplete message part, loop continues to read next chunk
        }
        onComplete(); // Call onComplete only after the stream is fully read (done = true)

    } catch (error) {
        console.error('[API] Fetch SSE Error:', error);
        onError(error);
    }
};

/**
 * Saves a user insight for a specific session ID.
 */
export const saveInsight = async (sessionId: string, insight: string): Promise<SaveInsightResponse> => {
    console.log(`[API] Saving insight for session: ${sessionId}`);
    const response = await axios.post<SaveInsightResponse>(`${PYTHON_BACKEND_URL}/insights`, { session_id: sessionId, insight });
    console.log('[API] Save insight response:', response.data);
    return response.data;
};

/**
 * Fetches saved insights for a specific session ID.
 */
export const getInsights = async (sessionId: string): Promise<InsightData[]> => {
    console.log(`[API] Getting insights for session: ${sessionId}`);
    const response = await axios.get<InsightData[]>(`${PYTHON_BACKEND_URL}/insights/${sessionId}`);
    console.log('[API] Get insights response:', response.data);
    return response.data;
};

/**
 * Deletes a specific insight by its ID.
 */
export const deleteInsight = async (insightId: string): Promise<{ message: string }> => {
    console.log(`[API] Deleting insight: ${insightId}`);
    const response = await axios.delete<{ message: string }>(`${PYTHON_BACKEND_URL}/insights/${insightId}`);
    console.log('[API] Delete insight response:', response.data);
    return response.data;
};

// --- NEW: Delete Document Function ---
export const deleteDocument = async (sessionId: string): Promise<{ message: string }> => {
    console.log(`[API] Deleting document and related data for session: ${sessionId}`);
    const response = await axios.delete<{ message: string }>(`${PYTHON_BACKEND_URL}/documents/${sessionId}`);
    console.log('[API] Delete document response:', response.data);
    return response.data; // Assuming backend returns { message: "..." }
};

// Ensure this file doesn't export anything else conflicting 