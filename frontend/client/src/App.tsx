import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import AuthPage from "./pages/auth-page";
import { ProtectedRoute } from "./lib/protected-route";
import { Toaster } from "./components/ui/toaster";
import { DocumentProvider } from "./contexts/DocumentContext";
import { ChatProvider } from "./contexts/ChatContext";
import DashboardPage from "./pages/Dashboard";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <DocumentProvider>
          <ChatProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster />
          </ChatProvider>
        </DocumentProvider>
      </Router>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
