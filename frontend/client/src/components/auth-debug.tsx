import React, { useEffect, useState } from 'react';
import { getFastApiToken, setFastApiToken, clearFastApiToken } from '@/lib/api-client';

export function AuthDebugger() {
  const [token, setToken] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    // Check token on component mount
    const storedToken = getFastApiToken();
    setToken(storedToken);
    
    // Set up interval to check token periodically
    const interval = setInterval(() => {
      const currentToken = getFastApiToken();
      setToken(currentToken);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Generate a test token
  const generateTestToken = () => {
    const testToken = `test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    setFastApiToken(testToken);
    setToken(testToken);
  };
  
  // Clear the token
  const clearToken = () => {
    clearFastApiToken();
    setToken(null);
  };
  
  // Only show in development mode
  if (import.meta.env.MODE !== 'development') {
    return null;
  }
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: token ? 'rgba(0, 128, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 9999,
        cursor: 'pointer',
        width: expanded ? '300px' : 'auto',
      }}
      onClick={() => !expanded && setExpanded(true)}
    >
      {expanded ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong>Auth Debugger</strong>
            <span onClick={(e) => { e.stopPropagation(); setExpanded(false); }} style={{ cursor: 'pointer' }}>×</span>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Status:</strong> {token ? 'Authenticated' : 'Not Authenticated'}
          </div>
          
          {token && (
            <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
              <strong>Token:</strong> {token.substring(0, 20)}...
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); generateTestToken(); }}
              style={{ 
                backgroundColor: '#4CAF50',
                border: 'none',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Generate Test Token
            </button>
            
            <button 
              onClick={(e) => { e.stopPropagation(); clearToken(); }}
              style={{ 
                backgroundColor: '#f44336',
                border: 'none',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Token
            </button>
          </div>
        </div>
      ) : (
        <div>
          {token ? '✓ Auth OK' : '✗ Not Authenticated'}
        </div>
      )}
    </div>
  );
} 