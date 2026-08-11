// src/components/common/Navbar.jsx

import React, { useState, useEffect } from 'react';
import {
  Link,
  useNavigate,
  useLocation
} from 'react-router-dom';

import '../styles/Navbar.css';

import logoImage from '../assets/drawai-tatalogo.jpeg';

import { useAuth } from '../context/AuthContext';

const Navbar = () => {

  const { user, logout } = useAuth();

  const isAuthenticated = !!user;

  const isAdmin =
    user?.role?.toLowerCase() === 'admin';

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [isScrolled, setIsScrolled] =
    useState(false);

  // Navbar profile picture
  const [profileAvatar, setProfileAvatar] =
    useState('');

  const navigate = useNavigate();

  const location = useLocation();


  // ==========================================
  // Navbar scroll effect
  // ==========================================

  useEffect(() => {

    const handleScroll = () => {

      setIsScrolled(
        window.scrollY > 10
      );

    };

    window.addEventListener(
      'scroll',
      handleScroll
    );

    return () => {

      window.removeEventListener(
        'scroll',
        handleScroll
      );

    };

  }, []);


  // ==========================================
  // Load saved profile picture
  // ==========================================

  useEffect(() => {

    if (!user) {

      setProfileAvatar('');

      return;

    }

    const userKey =
      user.email ||
      user.id ||
      'currentUser';

    const savedAvatar =
      localStorage.getItem(
        `profileAvatar_${userKey}`
      );

    if (savedAvatar) {

      setProfileAvatar(savedAvatar);

    } else {

      const generatedAvatar =
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.name ||
          user.full_name ||
          user.email ||
          'User'
        )}&size=150&background=6366f1&color=fff`;

      setProfileAvatar(
        generatedAvatar
      );

    }

  }, [user]);


  // ==========================================
  // Listen when profile page changes picture
  // ==========================================

  useEffect(() => {

    const handleProfileUpdate = (event) => {

      if (event.detail?.avatar) {

        setProfileAvatar(
          event.detail.avatar
        );

      }

    };


    // Also useful if localStorage changes
    // from another browser tab
    const handleStorageChange = () => {

      if (!user) return;

      const userKey =
        user.email ||
        user.id ||
        'currentUser';

      const savedAvatar =
        localStorage.getItem(
          `profileAvatar_${userKey}`
        );

      if (savedAvatar) {

        setProfileAvatar(
          savedAvatar
        );

      }

    };


    window.addEventListener(
      'profileUpdated',
      handleProfileUpdate
    );

    window.addEventListener(
      'storage',
      handleStorageChange
    );


    return () => {

      window.removeEventListener(
        'profileUpdated',
        handleProfileUpdate
      );

      window.removeEventListener(
        'storage',
        handleStorageChange
      );

    };

  }, [user]);


  // ==========================================
  // Logout
  // ==========================================

  const handleLogout = () => {

    logout();

    setIsMenuOpen(false);

    navigate('/login');

  };


  // ==========================================
  // Mobile menu
  // ==========================================

  const toggleMenu = () => {

    setIsMenuOpen(
      (prev) => !prev
    );

  };


  const closeMenu = () => {

    setIsMenuOpen(false);

  };


  // ==========================================
  // Active route
  // ==========================================

  const isActive = (path) => {

    return location.pathname === path;

  };


  // ==========================================
  // Render
  // ==========================================

  return (

    <nav
      className={`navbar ${
        isScrolled
          ? 'navbar-scrolled'
          : ''
      }`}
    >

      <div className="navbar-container">


        {/* ================================= */}
        {/* Logo / Brand */}
        {/* ================================= */}

        <Link
          to="/Landing"
          className="navbar-brand"
          onClick={closeMenu}
        >

          <img
            src={logoImage}
            alt="DrawAI Logo"
            className="navbar-logo"
          />

          <span className="brand-text">
            DrawAI
          </span>

        </Link>



        {/* ================================= */}
        {/* Mobile hamburger */}
        {/* ================================= */}

        <button
          className="mobile-menu-btn"
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        >

          <span
            className={`hamburger ${
              isMenuOpen
                ? 'open'
                : ''
            }`}
          >

            <span className="bar"></span>

            <span className="bar"></span>

            <span className="bar"></span>

          </span>

        </button>



        {/* ================================= */}
        {/* Navigation */}
        {/* ================================= */}

        <div
          className={`nav-links ${
            isMenuOpen
              ? 'active'
              : ''
          }`}
        >

          <ul>


            {/* Home */}

            <li>

              <Link
                to="/Dashboard"
                className={`nav-link ${
                  isActive('/Dashboard')
                    ? 'active'
                    : ''
                }`}
                onClick={closeMenu}
              >

                Home

              </Link>

            </li>



            {/* Admin */}

            {
              isAdmin && (

                <li>

                  <Link
                    to="/admin"
                    className={`nav-link ${
                      isActive('/admin')
                        ? 'active'
                        : ''
                    }`}
                    onClick={closeMenu}
                  >

                    Admin

                  </Link>

                </li>

              )
            }



            {
              isAuthenticated ? (

                <>


                  {/* Upload */}

                  <li>

                    <Link
                      to="/upload"
                      className={`nav-link ${
                        isActive('/upload')
                          ? 'active'
                          : ''
                      }`}
                      onClick={closeMenu}
                    >

                      Upload

                    </Link>

                  </li>



                  {/* My Projects */}

                  <li>

                    <Link
                      to="/projects"
                      className={`nav-link ${
                        isActive('/projects')
                          ? 'active'
                          : ''
                      }`}
                      onClick={closeMenu}
                    >

                      My Projects

                    </Link>

                  </li>



                  {/* ================================= */}
                  {/* Profile Picture */}
                  {/* ================================= */}

                  <li className="profile-nav-item">

                    <Link
                      to="/profile"
                      className={`profile-link ${
                        isActive('/profile')
                          ? 'active'
                          : ''
                      }`}
                      onClick={closeMenu}
                      title="Profile"
                    >

                      <img
                        src={profileAvatar}
                        alt="Profile"
                        className="profile-avatar-image"
                      />

                    </Link>

                  </li>



                  {/* Logout */}

                  <li>

                    <button
                      onClick={handleLogout}
                      className="logout-btn"
                    >

                      Logout

                    </button>

                  </li>

                </>

              ) : (

                <>


                  {/* Login */}

                  <li>

                    <Link
                      to="/login"
                      className={`nav-link ${
                        isActive('/login')
                          ? 'active'
                          : ''
                      }`}
                      onClick={closeMenu}
                    >

                      Login

                    </Link>

                  </li>



                  {/* Register */}

                  <li>

                    <Link
                      to="/register"
                      className="register-btn"
                      onClick={closeMenu}
                    >

                      Register

                    </Link>

                  </li>

                </>

              )
            }

          </ul>

        </div>

      </div>

    </nav>

  );

};

export default Navbar;