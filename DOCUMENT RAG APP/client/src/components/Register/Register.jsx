import { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import {
  FaRegCommentDots,
  FaUpload,
  FaComments,
  FaLightbulb,
  FaLock,
} from "react-icons/fa";
import "./Register.css";

export default function Register() {
  const [u, setU] = useState({ name: "", email: "", password: "" });
  const nav = useNavigate();

  const handleInput = (e) =>
    setU((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:7000/api/auth/register", {
        method: "POST",
        body: JSON.stringify(u),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setU({ name: "", email: "", password: "" });
        // ← Navigate to /sidebar, same as login
        nav("/sidebar", { state: { toastMessage: data.message } });
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Registration failed. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        {/* ←——— Left: Form */}
        <div className="form-container">
          <h2>
            <FaRegCommentDots className="app-icon" /> RagChatApp
          </h2>
          <h3>Create an Account</h3>
          <form onSubmit={handleSubmit}>
            <label>Name</label>
            <input
              name="name"
              type="text"
              value={u.name}
              onChange={handleInput}
              placeholder="Enter your name"
              required
            />
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={u.email}
              onChange={handleInput}
              placeholder="Enter your email"
              required
            />
            <label>Password</label>
            <input
              name="password"
              type="password"
              value={u.password}
              onChange={handleInput}
              placeholder="Enter your password"
              required
            />
            <button type="submit" className="btn-register">
              Sign Up
            </button>
          </form>
          <p className="switch">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>

        {/* ←——— Right: Features */}
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
            {/* ←——— New fourth feature */}
            <li>
              <FaLock className="icon security" />
              <div>
                <strong>Secure Authentication</strong>
                <p>
                  Your credentials are encrypted and stored safely, ensuring
                  top‑level security.
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

