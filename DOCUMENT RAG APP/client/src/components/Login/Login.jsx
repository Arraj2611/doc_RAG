import { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import {
  FaRegCommentDots,
  FaUpload,
  FaComments,
  FaLightbulb,
} from "react-icons/fa";
import "./Login.css";

export default function Login() {
  const [details, setDetails] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleInput = (e) =>
    setDetails((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:7000/api/auth/login", {
        method: "POST",
        body: JSON.stringify(details),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        setDetails({ email: "", password: "" });
        // ← Navigate to /sidebar instead of /app
        navigate("/sidebar", { state: { toastMessage: data.message } });
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Login failed. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="form-container">
          <h2>
            <FaRegCommentDots className="app-icon" /> RagChatApp
          </h2>
          <h3>Welcome Back</h3>
          <form onSubmit={handleSubmit}>
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={details.email}
              onChange={handleInput}
              placeholder="Enter your email"
              required
            />
            <label>Password</label>
            <input
              name="password"
              type="password"
              value={details.password}
              onChange={handleInput}
              placeholder="Enter your password"
              required
            />
            <button type="submit" className="btn-login">
              Log In
            </button>
          </form>
          <p className="switch">
            Don’t have an account? <Link to="/register">Sign Up</Link>
          </p>
        </div>

        <div className="features-container">
          <h3>Key Features</h3>
          <ul>
            <li>
              <FaUpload className="icon upload" />
              <div>
                <strong>Upload Documents</strong>
                <p>
                  Easily upload and process your documents for instant analysis
                  and retrieval.
                </p>
              </div>
            </li>
            <li>
              <FaComments className="icon chat" />
              <div>
                <strong>Instant Q&A</strong>
                <p>
                  Get answers to your questions in real-time using our advanced
                  RAG technology.
                </p>
              </div>
            </li>
            <li>
              <FaLightbulb className="icon insight" />
              <div>
                <strong>AI‑Powered Insights</strong>
                <p>
                  Gain valuable insights from your documents with our
                  cutting‑edge AI analysis.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
