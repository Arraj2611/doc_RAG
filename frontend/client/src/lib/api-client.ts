import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
    UserType,
    LoginCredentials,
    RegistrationData,
    DocumentType as DocType,
    ProcessResponse,
    ChatStreamRequest
} from '@/types';

// Get API URLs from environment variables or use defaults
// --- Use separate URLs for Auth (Express) and Documents (FastAPI) ---
const AUTH_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DOC_API_URL = import.meta.env.VITE_DOC_API_URL || 'http://localhost:8000';

console.log("Authentication API URL (Express):", AUTH_API_URL);
console.log("Document API URL (FastAPI):", DOC_API_URL);

// --- Token Management ---
const FASTAPI_TOKEN_KEY = 'fastapi_access_token';

export const setFastApiToken = (token: string): void => {
    try {
        localStorage.setItem(FASTAPI_TOKEN_KEY, token);
        console.log('FastAPI token stored.'); // Debug log
    } catch (error) {
        console.error('Error storing FastAPI token:', error);
    }
};

export const getFastApiToken = (): string | null => {
    try {
        return localStorage.getItem(FASTAPI_TOKEN_KEY);
    } catch (error) {
        console.error('Error retrieving FastAPI token:', error);
        return null;
    }
};

export const clearFastApiToken = (): void => {
    try {
        localStorage.removeItem(FASTAPI_TOKEN_KEY);
        console.log('FastAPI token cleared.'); // Debug log
    } catch (error) {
        console.error('Error clearing FastAPI token:', error);
    }
};

// --- Create separate Axios instances ---
const authApiClient: AxiosInstance = axios.create({ baseURL: AUTH_API_URL });
const docApiClient: AxiosInstance = axios.create({ baseURL: DOC_API_URL }); // Will be proxied by Vite in dev

// Interceptor to add JWT token to FastAPI requests
docApiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const token = getFastApiToken();
        console.log('FastAPI request interceptor - Token:', token ? 'Present' : 'Absent'); // Debug log
        if (token) {
            console.log('FastAPI request interceptor - Authorization header set'); // Debug log
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError): Promise<AxiosError> => {
        console.error('FastAPI request interceptor error:', error); // Debug log
        return Promise.reject(error);
    }
);

// Global error handling (optional, adjust as needed)
const handleApiError = (error: AxiosError, apiName: string) => {
    if (error.response) {
        console.error(`${apiName} API Error:`, {
            url: error.config?.url,
            status: error.response.status,
            data: error.response.data,
        });
    } else if (error.request) {
        console.error(`${apiName} API Error: No response received`, error.request);
    } else {
        console.error(`${apiName} API Error:`, error.message);
    }
    throw error; // Re-throw error for further handling (e.g., by react-query)
};

// --- Authentication API Functions (Target: FastAPI /auth/*) ---

export const authApi = {
    register: async (data: RegistrationData): Promise<UserType & { accessToken: string }> => {
        // Use FastAPI auth endpoints
        const response = await docApiClient.post<{ access_token: string, token_type: string, user: UserType }>('/auth/register', data);
        // Transform the response to match our expected format
        return {
            ...response.data.user,
            accessToken: response.data.access_token
        };
    },

    login: async (credentials: LoginCredentials): Promise<UserType & { accessToken: string }> => {
        const response = await docApiClient.post<{ access_token: string, token_type: string, user: UserType }>('/auth/login', credentials);
        // Transform the response to match our expected format
        return {
            ...response.data.user,
            accessToken: response.data.access_token
        };
    },

    logout: async (): Promise<{ message: string }> => {
        // No server-side logout needed with JWT, just clear the token
        clearFastApiToken();
        return { message: "Logged out successfully" };
    },

    getCurrentUser: async (): Promise<UserType | null> => {
        try {
            // Get current user from the /auth/me endpoint
            const response = await docApiClient.get('/auth/me');
            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                clearFastApiToken(); // Clear token if user is unauthorized
                return null; // Not authenticated
            }
            throw error; // Re-throw other errors
        }
    },
};

// --- Document and Chat API Functions (Target: FastAPI /api/* via proxy) ---

// Use relative paths here - Vite proxy handles forwarding to DOC_API_URL
// Ensure these functions use the docApiClient instance with the interceptor
export const documentApi = {
    getDocuments: async (): Promise<DocType[]> => {
        // Use docApiClient instance
        const response = await docApiClient.get('/api/documents'); // Path is relative to baseURL, proxy adds /api
        return response.data;
    },

    uploadDocuments: async (files: File[], sessionId: string): Promise<{ message: string, filenames: string[] }> => {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        // Use docApiClient instance
        const response = await docApiClient.post(`/api/upload?session_id=${sessionId}`, formData, {
            headers: {
                // Interceptor handles Auth, Axios handles multipart Content-Type
                'Accept': 'application/json',
            }
        });
        return response.data;
    },

    processDocuments: async (sessionId: string): Promise<ProcessResponse> => {
        // Use docApiClient instance
        const response = await docApiClient.post('/api/process', { session_id: sessionId }, {
            headers: {
                'Accept': 'application/json',
                'X-Session-ID': sessionId // Add session ID as header for backend
            }
        });
        return response.data;
    },

    deleteDocument: async (docId: string): Promise<{ message: string }> => {
        const encodedId = encodeURIComponent(docId);
        // Use docApiClient instance
        const response = await docApiClient.delete(`/api/documents/${encodedId}`);
        return response.data;
    },

    getDocumentContentUrl: (docId: string): string => {
        const encodedId = encodeURIComponent(docId);
        // Construct the URL based on the proxied path
        return `/api/documents/${encodedId}/content`; // Relative path for browser/<a> tag
    },
};

// --- Chat Streaming Function (Target: FastAPI /api/* via proxy) ---

export const streamChatResponse = async (
    requestData: ChatStreamRequest,
    onChunk: (chunk: string) => void,
    onError: (error: Error) => void,
    onClose: () => void
) => {
    try {
        const token = getFastApiToken();
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Ensure tenant_id is included in the request if available
        if (!requestData.tenant_id && requestData.session_id) {
            console.log("No tenant_id provided, using session_id as fallback");
        }

        console.log("Streaming chat request body:", JSON.stringify(requestData));

        // Use relative path for proxy
        const response = await fetch('/api/chat-stream-fastapi', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Chat stream request failed: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Chat stream request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const processStream = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log("Chat stream finished.");
                    onClose();
                    break;
                }
                const chunk = decoder.decode(value, { stream: true });
                // Process Server-Sent Events (SSE)
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const jsonData = line.substring(5).trim();
                        if (jsonData) {
                            try {
                                const parsedData = JSON.parse(jsonData);
                                if (parsedData.token) {
                                    onChunk(parsedData.token);
                                } else if (parsedData.error) {
                                    console.error("Received error chunk:", parsedData.error);
                                    onError(new Error(parsedData.error));
                                    // Optionally close stream on error
                                    // reader.cancel();
                                    // onClose();
                                    // break;
                                } else if (parsedData.type === 'end') {
                                    console.log("Received end event from stream.");
                                    // Server explicitly signaled end, we can break
                                    reader.cancel();
                                    onClose();
                                    return; // Exit processStream
                                }
                            } catch (e) {
                                console.error("Failed to parse stream JSON:", jsonData, e);
                                // Handle non-JSON data if necessary, or ignore
                            }
                        }
                    } else if (line.trim() === ': ping') {
                        // Handle keep-alive pings if server sends them
                        console.log("Received stream ping.");
                    }
                }
            }
        };

        processStream().catch(error => {
            console.error("Error processing chat stream:", error);
            onError(error);
            onClose();
        });

    } catch (error: any) {
        console.error("Failed to initiate chat stream:", error);
        onError(error);
        onClose();
    }
};

// User preferences API
export const preferencesApi = {
    // Update user's system prompt preference
    updateSystemPrompt: async (userId: string, responseStyle: string) => {
        try {
            return await docApiClient.post('/api/preferences/system-prompt', {
                user_id: userId,
                response_style: responseStyle
            });
        } catch (error) {
            console.error("Update system prompt error:", error);
            throw error;
        }
    },

    // Get user's system prompt preference
    getSystemPrompt: async (userId: string) => {
        try {
            return await docApiClient.get(`/api/preferences/system-prompt/${userId}`);
        } catch (error) {
            console.error("Get system prompt error:", error);
            throw error;
        }
    },
};

export default docApiClient;