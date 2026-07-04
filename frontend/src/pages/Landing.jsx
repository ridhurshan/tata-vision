// src/pages/Landing/index.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Landing.css';
import logoImage from '../../assets/drawai-logo.png';

const Landing = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/upload');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-brand">
            <img 
              src={logoImage} 
              alt="DrawAI Logo" 
              className="nav-logo"
              style={{
                width: '40px',
                height: '40px',
                objectFit: 'contain',
                borderRadius: '50%',
                background: 'white',
                padding: '6px',
                marginRight: '10px'
              }}
            />
            <span className="brand-text">DrawAI</span>
          </div>
          <div className="nav-links">
            <Link to="/" className="nav-link active">Home</Link>
            {isAuthenticated ? (
              <>
                <Link to="/upload" className="nav-link">Upload</Link>
                <Link to="/projects" className="nav-link">My Projects</Link>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Login</Link>
                <Link to="/register" className="nav-link btn-primary">SignUp</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">✨</span>
              <span>AI-Powered Drawing Assistant</span>
            </div>

            <h1 className="hero-title">
              Transform Your <br />
              <span className="gradient-text">Sketches with AI</span>
            </h1>

            <p className="hero-description">
              Upload a simple sketch and let our advanced AI transform it into beautiful 
              production-ready artwork. Watch as the magic unfolds in real-time.
            </p>

            <div className="hero-actions">
              <button className="btn-primary-hero" onClick={handleGetStarted}>
                Get Started
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              <button className="btn-secondary-hero">
                Learn More
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">10K+</span>
                <span className="stat-label">Artworks Created</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">4.9★</span>
                <span className="stat-label">User Rating</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">2M+</span>
                <span className="stat-label">Sketches Uploaded</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-illustration">
              <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#6366f1' }} />
                    <stop offset="100%" style={{ stopColor: '#8b5cf6' }} />
                  </linearGradient>
                </defs>
                {/* Background circles */}
                <circle cx="200" cy="200" r="180" fill="#6366f1" opacity="0.05" />
                <circle cx="200" cy="200" r="140" fill="#6366f1" opacity="0.08" />
                <circle cx="200" cy="200" r="100" fill="#6366f1" opacity="0.12" />
                
                {/* Drawing/Pencil icon */}
                <rect x="100" y="120" width="200" height="160" rx="12" fill="white" stroke="#6366f1" strokeWidth="3" />
                <path d="M140 160 L180 200 L140 240" stroke="#6366f1" strokeWidth="3" fill="none" />
                <path d="M260 160 L220 200 L260 240" stroke="#8b5cf6" strokeWidth="3" fill="none" />
                <circle cx="200" cy="200" r="20" fill="#6366f1" opacity="0.2" />
                <path d="M200 180 L200 220 M180 200 L220 200" stroke="#6366f1" strokeWidth="3" />
                
                {/* AI Sparkles */}
                <circle cx="80" cy="80" r="6" fill="#6366f1" opacity="0.6">
                  <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="320" cy="80" r="6" fill="#8b5cf6" opacity="0.6">
                  <animate attributeName="r" values="6;10;6" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="80" cy="320" r="6" fill="#6366f1" opacity="0.6">
                  <animate attributeName="r" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <circle cx="320" cy="320" r="6" fill="#8b5cf6" opacity="0.6">
                  <animate attributeName="r" values="4;7;4" dur="2.2s" repeatCount="indefinite" />
                </circle>
                
                {/* Magic wand */}
                <line x1="280" y1="120" x2="320" y2="80" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                <circle cx="320" cy="80" r="8" fill="#fbbf24" opacity="0.8" />
                <path d="M316 76 L324 84 M324 76 L316 84" stroke="#f59e0b" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="section-header">
            <h2>Why Choose DrawAI</h2>
            <p>Experience the future of digital art creation</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>AI-Powered Art</h3>
              <p>Advanced algorithms transform your sketches into stunning masterpieces</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-Time Processing</h3>
              <p>Watch your artwork come to life instantly with our fast AI engine</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🖼️</div>
              <h3>Multiple Styles</h3>
              <p>Choose from various art styles to match your creative vision</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💾</div>
              <h3>Save & Export</h3>
              <p>Download your creations in high quality for any use case</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;