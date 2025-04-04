import React from 'react';
import { Link } from 'react-router-dom'; // For navigation
import './LandingPage.css'; // We'll create this CSS file
// Import assets if needed for icons
// import { assets } from '../../assets/assets';

const LandingPage = () => {
    return (
        <div className="landing-container">
            <header className="landing-header">
                <h1>RagChatApp</h1>
                <nav>
                    {/* Add other nav links if needed */}
                    <Link to="/login" className="nav-button">Log In</Link>
                    <Link to="/register" className="nav-button primary">Sign Up</Link>
                </nav>
            </header>

            <section className="hero-section">
                <h2>Unlock Insights from Your Documents</h2>
                <p>Upload, chat, and get intelligent answers instantly with our advanced RAG technology.</p>
                <Link to="/register" className="cta-button">Get Started Now</Link>
            </section>

            <section className="features-section">
                <h3>Key Features</h3>
                <div className="features-grid">
                    <div className="feature-item">
                        {/* <img src={assets.upload_icon} alt="Upload"/> */}
                        <h4>Upload Documents</h4>
                        <p>Easily upload and process your documents for instant analysis and retrieval.</p>
                    </div>
                    <div className="feature-item">
                        {/* <img src={assets.chat_icon} alt="Q&A"/> */}
                        <h4>Instant Q&A</h4>
                        <p>Get answers to your questions in real-time using our advanced RAG technology.</p>
                    </div>
                    <div className="feature-item">
                        {/* <img src={assets.insight_icon} alt="Insights"/> */}
                        <h4>AI-Powered Insights</h4>
                        <p>Gain valuable insights from your documents with our cutting-edge AI analysis.</p>
                    </div>
                </div>
            </section>

            {/* Add other sections as needed (How it works, Testimonials, Footer) */}

            <footer className="landing-footer">
                <p>&copy; 2024 RagChatApp. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default LandingPage; 