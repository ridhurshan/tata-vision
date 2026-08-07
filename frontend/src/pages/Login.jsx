// src/pages/Login/index.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import logoImage from '../../assets/drawai-logo.png';
import '../styles/Navbar.css';
import { loginUser } from "../services/authService";
import { useAuth } from '../context/AuthContext';

const Login = () => {

  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await loginUser({ email, password });
      login(response.data.user, response.data.token); // <-- use context, not localStorage directly
      navigate('/dashboard');
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Login failed. Please try again.";

      setError(message);

      if (
        error.response?.status === 403 &&
        error.response?.data?.code === "EMAIL_NOT_VERIFIED"
      ) {
        navigate("/verify-email", {
          state: {
            email: email.trim().toLowerCase(),
          },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-container">
        <div className="auth-left">
          <div className="brand">

            <h1>DrawAI</h1>
            <p className="tagline">
              Turn your sketches into stunning AI artworks with one click!
            </p>
                        {/* Logo image should be here, not inside SVG */}
            <img 
                src={logoImage} 
                alt="DrawAI Logo" 
                className="brand-logo" 
                style={{ 
                    width: '300px', 
                    height: '300px',
                    objectFit: 'contain'
                }}
            />
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-form-wrapper">
            <div className="auth-tabs">
              <Link to="/login" className="auth-tab active">Login</Link>
              <Link to="/register" className="auth-tab">Register</Link>
            </div>

            <h2 className="form-title">Welcome Back</h2>
            <p className="form-subtitle">Sign in to continue creating amazing art</p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="forgot-link">
                  Forgot Password?
                </Link>
              </div>

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <p className="auth-footer">
                Don't have an account? <Link to="/register">Sign up now</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;