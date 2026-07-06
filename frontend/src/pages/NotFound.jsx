// src/pages/NotFound/index.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/NotFound.css';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="not-found-page">
      <div className="not-found-container">
        {/* Animated 404 Illustration */}
        <div className="not-found-illustration">
          <div className="floating-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
            <div className="shape shape-4"></div>
          </div>
          <div className="error-code">
            <span className="digit digit-1">4</span>
            <span className="digit digit-2">0</span>
            <span className="digit digit-3">4</span>
          </div>
          <div className="error-icon">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="100" r="80" fill="#6366f1" opacity="0.1" />
              <circle cx="100" cy="100" r="60" fill="#6366f1" opacity="0.15" />
              <circle cx="100" cy="100" r="40" fill="#6366f1" opacity="0.2" />
              {/* Compass/Search icon */}
              <circle cx="100" cy="100" r="30" fill="none" stroke="#6366f1" strokeWidth="4" />
              <line x1="100" y1="100" x2="120" y2="80" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
              <circle cx="100" cy="100" r="6" fill="#6366f1" />
              {/* Question marks */}
              <text x="80" y="70" fontSize="24" fill="#6366f1" opacity="0.6">?</text>
              <text x="130" y="140" fontSize="24" fill="#8b5cf6" opacity="0.6">?</text>
            </svg>
          </div>
        </div>

        {/* Error Content */}
        <div className="not-found-content">
          <h1 className="error-title">Page Not Found</h1>
          <p className="error-description">
            Oops! The page you're looking for seems to have wandered off into 
            the digital wilderness. It might have been moved, deleted, or 
            never existed at all.
          </p>

          <div className="error-actions">
            <Link to="/" className="btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go Home
            </Link>
            <button onClick={handleGoBack} className="btn-secondary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Go Back
            </button>
          </div>

          {/* Quick Links */}
          <div className="quick-links">
            <p className="quick-links-title">You might want to try:</p>
            <div className="links-grid">
              <Link to="/" className="quick-link">
                <span className="quick-link-icon">🏠</span>
                Home
              </Link>
              <Link to="/dashboard" className="quick-link">
                <span className="quick-link-icon">📊</span>
                Dashboard
              </Link>
              <Link to="/projects" className="quick-link">
                <span className="quick-link-icon">📁</span>
                Projects
              </Link>
              <Link to="/upload" className="quick-link">
                <span className="quick-link-icon">📤</span>
                Upload
              </Link>
              <Link to="/profile" className="quick-link">
                <span className="quick-link-icon">👤</span>
                Profile
              </Link>
              <Link to="/help" className="quick-link">
                <span className="quick-link-icon">❓</span>
                Help Center
              </Link>
            </div>
          </div>

          {/* Fun Facts / Easter Egg */}
          <div className="error-fun-fact">
            <span className="fun-fact-icon">🎨</span>
            <p>
              <strong>Did you know?</strong> Even the best artists sometimes 
              lose their way. Here's a fun fact to brighten your day: 
              The Mona Lisa has no eyebrows!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;