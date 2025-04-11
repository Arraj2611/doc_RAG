import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import Register from "./components/Register/Register";
import Login from "./components/Login/Login";
import Sidebar from "./components/Sidebar/Sidebar";
import Main from "./components/Main/Main";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  return (
    <Router>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Sidebar route */}
        <Route path="/sidebar" element={<Sidebar />}>
          <Route path="main" element={<Main />} />
        </Route>

        {/* Redirect for undefined routes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {/* Only render Main component if on the sidebar page */}
      <Routes>
        <Route path="/sidebar/*" element={<Main />} />
      </Routes>
    </Router>
  );
};

export default App;
