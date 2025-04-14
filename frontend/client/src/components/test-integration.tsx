import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { generateTestToken } from '@/lib/generate-test-token';
import { documentApi, streamChatResponse } from '@/lib/api-client';

export function TestIntegration() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState('test_user_123');
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Generate a test token
  const handleGenerateToken = async () => {
    try {
      const newToken = await generateTestToken(userId);
      setToken(newToken);
    } catch (error) {
      console.error('Error generating token:', error);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Upload a document
  const handleUpload = async () => {
    if (!file || !token) {
      setUploadStatus('Please select a file and generate a token first');
      return;
    }

    try {
      setUploadStatus('Uploading...');
      const newSessionId = Math.random().toString(36).substring(2, 15);
      setSessionId(newSessionId);

      const response = await documentApi.uploadDocuments([file], newSessionId);
      setUploadStatus(`Upload successful: ${JSON.stringify(response)}`);

      // Process the document
      try {
        setUploadStatus('Processing document...');
        const processResponse = await documentApi.processDocuments(newSessionId);
        setUploadStatus(`Processing successful: ${JSON.stringify(processResponse)}`);
      } catch (processError) {
        setUploadStatus(`Upload successful but processing failed: ${processError instanceof Error ? processError.message : 'Unknown error'}`);
      }
    } catch (error) {
      setUploadStatus(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Send a chat message
  const handleSendMessage = async () => {
    if (!question || !token) {
      setAnswer('Please enter a question and generate a token first');
      return;
    }

    setIsLoading(true);
    setAnswer('');
    let responseText = '';

    try {
      // Prepare the request data
      const requestData = {
        question,
        session_id: sessionId || undefined,
        tenant_id: sessionId ? `user_${userId}_doc_${file?.name.replace(/\\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, '_')}` : undefined
      };

      // Stream the response
      await streamChatResponse(
        requestData,
        (chunk) => {
          responseText += chunk;
          setAnswer(responseText);
        },
        (error) => {
          setAnswer(`Error: ${error.message}`);
          setIsLoading(false);
        },
        () => {
          setIsLoading(false);
        }
      );
    } catch (error) {
      setAnswer(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Generate a test token for API access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex space-x-2">
            <Input
              placeholder="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <Button onClick={handleGenerateToken}>Generate Token</Button>
          </div>
          {token && (
            <div className="text-xs overflow-auto p-2 bg-gray-100 rounded">
              <p className="font-bold">Token:</p>
              <p className="break-all">{token}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Upload</CardTitle>
          <CardDescription>Upload and process a document</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input type="file" onChange={handleFileChange} />
          <Button onClick={handleUpload} disabled={!file || !token}>Upload Document</Button>
          {uploadStatus && (
            <div className="text-xs overflow-auto p-2 bg-gray-100 rounded">
              <p>{uploadStatus}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>Ask a question about the uploaded document</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Ask a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button onClick={handleSendMessage} disabled={!question || !token || isLoading}>
            {isLoading ? 'Loading...' : 'Send'}
          </Button>
          {answer && (
            <div className="overflow-auto p-2 bg-gray-100 rounded">
              <p>{answer}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
