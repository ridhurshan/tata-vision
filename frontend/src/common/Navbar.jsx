// src/components/common/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';
import logoImage from '../assets/drawai-tatalogo.jpeg';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const { user, logout } = useAuth();
    const isAuthenticated = !!user;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();


  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

    const handleLogout = () => {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      navigate('/login');
    };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Check if link is active
  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Brand/Logo */}
              <Link 
                to="/Landing" 
                className={`nav-link ${isActive('/Landing') ? 'active' : ''}`}
                onClick={closeMenu}
              >
          <img 
            src={logoImage} 
            alt="DrawAI Logo" 
            className="navbar-logo"
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
        </Link>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMenu}>
          <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}>
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </span>
        </button>

        {/* Navigation Links */}
        <div className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
          <ul>
            <li>
              <Link 
                to="/Dashboard" 
                className={`nav-link ${isActive('/') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                Home
              </Link>
            </li>
            <li>
              <Link 
                to="/Projects" 
                className={`nav-link ${isActive('/') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                Projects
              </Link>
            </li>
            {/* <li>
              <Link 
                to="/projects/1" 
                className={`nav-link ${isActive('/projects/1') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                ViewProject
              </Link>
            </li> */}
                        <li>
              <Link 
                to="/admin" 
                className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                Admin
              </Link>
            </li>
            <li>
              <Link 
                to="/profile" 
                className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                Profile
              </Link>
            </li>
            {/* <li>
              <Link 
                to="/notfound" 
                className={`nav-link ${isActive('/notfound') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                NotFound
              </Link>
            </li> */}
            
            {isAuthenticated ? (
              <>
                <li>
                  <Link 
                    to="/upload" 
                    className={`nav-link ${isActive('/upload') ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    Upload
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/projects" 
                    className={`nav-link ${isActive('/projects') ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    My Projects
                  </Link>
                </li>
                <li>
                  <button onClick={handleLogout} className="nav-link logout-btn">
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link 
                    to="/login" 
                    className={`nav-link ${isActive('/login') ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    Login
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/register" 
                    className={`nav-link btn-primary ${isActive('/register') ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;