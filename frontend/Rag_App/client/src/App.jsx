import React, { useContext } from "react";
import {
  Route,
  Routes,
  Navigate,
  Outlet // Import Outlet for nested routes
} from "react-router-dom";
import Register from "./components/Register/Register";
import Login from "./components/Login/Login";
import Sidebar from "./components/Sidebar/Sidebar";
import Main from "./components/Main/Main";
import LandingPage from "./components/LandingPage/LandingPage"; // Import LandingPage
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Context } from "./context/Context"; // Import main context

// Layout component for the main app (Sidebar + Main)
const AppLayout = () => {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Main />
    </div>
  );
};

// Wrapper for protected routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useContext(Context);

  if (isAuthLoading) {
    return <div>Loading Authentication...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? children : <Outlet />;
};

const App = () => {
  // Get auth state directly if needed, but ProtectedRoute handles logic
  // const { isAuthenticated } = useContext(Context);

  return (
    <>
      <ToastContainer theme="colored" /> {/* Use theme based on body class */}
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected App Route using Wrapper */}
        <Route element={<ProtectedRoute />}> {/* Wrap routes that need auth */}
          <Route
            path="/app"
            element={<AppLayout />}
          >
            {/* Nested routes within /app if needed later */}
          </Route>
          {/* Add other protected routes here if necessary */}
          {/* <Route path="/settings" element={<SettingsPage />} /> */}
        </Route>

        {/* Redirect any other unknown paths to landing page */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
};

export default App;
