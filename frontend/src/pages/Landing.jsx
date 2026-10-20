// src/pages/Landing/index.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Landing.css';
import logoImage from '../../assets/drawai-logo.png';

const Landing = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(true);

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
              Upload a reference image and receive a calm, step-by-step drawing guide —
              from subject analysis to curves, shading, and colour.
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
                <span className="stat-number">01</span>
                <span className="stat-label">Reference image</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">04</span>
                <span className="stat-label">Drawing stages</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">∞</span>
                <span className="stat-label">Ways to practise</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-illustration">
              <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#5e969d' }} />
                    <stop offset="100%" style={{ stopColor: '#d88973' }} />
                  </linearGradient>
                </defs>
                {/* Background circles */}
                <circle cx="200" cy="200" r="180" fill="#5e969d" opacity="0.05" />
                <circle cx="200" cy="200" r="140" fill="#5e969d" opacity="0.08" />
                <circle cx="200" cy="200" r="100" fill="#5e969d" opacity="0.12" />
                
                {/* Drawing/Pencil icon */}
                <rect x="100" y="120" width="200" height="160" rx="12" fill="white" stroke="#5e969d" strokeWidth="3" />
                <path d="M140 160 L180 200 L140 240" stroke="#5e969d" strokeWidth="3" fill="none" />
                <path d="M260 160 L220 200 L260 240" stroke="#d88973" strokeWidth="3" fill="none" />
                <circle cx="200" cy="200" r="20" fill="#5e969d" opacity="0.2" />
                <path d="M200 180 L200 220 M180 200 L220 200" stroke="#5e969d" strokeWidth="3" />
                
                {/* AI Sparkles */}
                <circle cx="80" cy="80" r="6" fill="#5e969d" opacity="0.6">
                  <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="320" cy="80" r="6" fill="#d88973" opacity="0.6">
                  <animate attributeName="r" values="6;10;6" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="80" cy="320" r="6" fill="#5e969d" opacity="0.6">
                  <animate attributeName="r" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <circle cx="320" cy="320" r="6" fill="#d88973" opacity="0.6">
                  <animate attributeName="r" values="4;7;4" dur="2.2s" repeatCount="indefinite" />
                </circle>
                
                {/* Magic wand */}
                <line x1="280" y1="120" x2="320" y2="80" stroke="#d88973" strokeWidth="4" strokeLinecap="round" />
                <circle cx="320" cy="80" r="8" fill="#d88973" opacity="0.8" />
                <path d="M316 76 L324 84 M324 76 L316 84" stroke="#b96855" strokeWidth="2" />
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
              <p>Turn one reference into clear, reusable drawing guidance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Subject-aware steps</h3>
              <p>Open a person, face, animal, or object and practise it on its own.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🖼️</div>
              <h3>Progressive detail</h3>
              <p>Move from curves to shading and colour without losing the structure.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💾</div>
              <h3>Save & revisit</h3>
              <p>Keep each finished guide in your project library for later practice.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
