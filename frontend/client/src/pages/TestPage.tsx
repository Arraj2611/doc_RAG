import React from 'react';
import { TestIntegration } from '@/components/test-integration';

export default function TestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Backend Integration Test</h1>
      <p className="mb-4">Use this page to test the integration between the frontend and backend.</p>
      <TestIntegration />
    </div>
  );
}
