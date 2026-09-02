// src/pages/Profile/index.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Profile.css';

import Footer from '../common/Footer';
import Navbar from '../common/Navbar';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    role: '',
    username: '',

    bio: 'Passionate artist and AI enthusiast. Creating beautiful art with technology.',

    location: '',
    website: '',
    joinDate: '',

    avatar:
      'https://ui-avatars.com/api/?name=User&size=150&background=6366f1&color=fff',

    stats: {
      projects: 0,
      followers: 0,
      following: 0,
      artworks: 0
    },

    preferences: {
      emailNotifications: true,
      pushNotifications: true,
      darkMode: false,
      language: 'English'
    }
  });

  const [formData, setFormData] = useState({
    ...profile
  });

  // =========================================================
  // Load logged-in user + saved profile data
  // =========================================================

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const userKey = user.email || user.id || 'currentUser';

    // Get saved profile from localStorage
    const savedProfile = localStorage.getItem(
      `profile_${userKey}`
    );

    let localProfile = null;

    if (savedProfile) {
      try {
        localProfile = JSON.parse(savedProfile);
      } catch (err) {
        console.error('Could not parse saved profile:', err);
      }
    }

    // Get separately saved avatar
    const savedAvatar = localStorage.getItem(
      `profileAvatar_${userKey}`
    );

    const generatedAvatar =
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.name ||
        user.full_name ||
        user.email ||
        'User'
      )}&size=150&background=6366f1&color=fff`;

    const updatedProfile = {
      ...profile,

      ...(localProfile || {}),

      fullName:
        localProfile?.fullName ||
        user.name ||
        user.full_name ||
        '',

      email:
        user.email ||
        localProfile?.email ||
        '',

      role:
        user.role ||
        localProfile?.role ||
        '',

      avatar:
        savedAvatar ||
        localProfile?.avatar ||
        generatedAvatar,

      stats: {
        ...profile.stats,
        ...(localProfile?.stats || {})
      },

      preferences: {
        ...profile.preferences,
        ...(localProfile?.preferences || {})
      }
    };

    setProfile(updatedProfile);
    setFormData(updatedProfile);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);


  // =========================================================
  // Input change
  // =========================================================

  const handleInputChange = (e) => {
    const {
      name,
      value,
      type,
      checked
    } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,

        preferences: {
          ...prev.preferences,
          [name]: checked
        }
      }));

    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };


  // =========================================================
  // Edit / Cancel
  // =========================================================

  const handleEditToggle = () => {

    if (isEditing) {
      // Restore previous saved data when cancelled
      setFormData({
        ...profile,

        stats: {
          ...profile.stats
        },

        preferences: {
          ...profile.preferences
        }
      });
    }

    setIsEditing((prev) => !prev);

    setError('');
    setSuccess('');
  };


  // =========================================================
  // Profile picture change
  // =========================================================

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    // Basic validation
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Limit size to 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile image must be smaller than 5 MB.');
      return;
    }

    setError('');

    const reader = new FileReader();

    reader.onloadend = () => {

      setFormData((prev) => ({
        ...prev,
        avatar: reader.result
      }));

    };

    reader.onerror = () => {
      setError('Could not load the selected image.');
    };

    reader.readAsDataURL(file);
  };


  // =========================================================
  // Save changes
  // =========================================================

  const handleSave = async () => {

    setLoading(true);
    setError('');
    setSuccess('');

    try {

      const userKey =
        user.email ||
        user.id ||
        'currentUser';

      const updatedProfile = {
        ...formData,

        stats: {
          ...formData.stats
        },

        preferences: {
          ...formData.preferences
        }
      };

      // Save complete profile to localStorage
      localStorage.setItem(
        `profile_${userKey}`,
        JSON.stringify(updatedProfile)
      );

      // Save avatar separately
      if (formData.avatar) {
        localStorage.setItem(
          `profileAvatar_${userKey}`,
          formData.avatar
        );
      }

      setProfile(updatedProfile);

      setIsEditing(false);

      setSuccess(
        'Profile updated successfully!'
      );

    } catch (err) {

      console.error(
        'Profile save error:',
        err
      );

      setError(
        'Failed to update profile. Please try again.'
      );

    } finally {

      setLoading(false);

    }
  };


  // =========================================================
  // Logout
  // =========================================================

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  // =========================================================
  // Do not render profile before user is available
  // =========================================================

  if (!user) {
    return null;
  }


  return (
    <>
      <Navbar />

      <div className="profile-page">

        <div className="profile-container">

          {/* ============================================= */}
          {/* Header */}
          {/* ============================================= */}

          <div className="profile-header">

            <h1>Profile</h1>

            <div className="header-actions">

              <button
                className={`btn-edit ${
                  isEditing
                    ? 'btn-cancel'
                    : ''
                }`}
                onClick={handleEditToggle}
              >
                {
                  isEditing
                    ? 'Cancel'
                    : 'Edit Profile'
                }
              </button>

            </div>

          </div>


          {/* ============================================= */}
          {/* Messages */}
          {/* ============================================= */}

          {
            success && (
              <div className="success-message">
                {success}
              </div>
            )
          }

          {
            error && (
              <div className="error-message">
                {error}
              </div>
            )
          }


          {/* ============================================= */}
          {/* Main Content */}
          {/* ============================================= */}

          <div className="profile-content">


            {/* =========================================== */}
            {/* LEFT SIDE */}
            {/* =========================================== */}

            <div className="profile-left">

              <div className="avatar-section">

                <div className="avatar-wrapper">

                  <img
                    src={formData.avatar}
                    alt="Profile"
                    className="avatar"
                  />

                  {
                    isEditing && (

                      <label className="avatar-upload">

                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          style={{
                            display: 'none'
                          }}
                        />

                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >

                          <path
                            d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                          />

                          <circle
                            cx="12"
                            cy="13"
                            r="4"
                          />

                        </svg>

                      </label>

                    )
                  }

                </div>


                <h2 className="profile-name">
                  {profile.fullName}
                </h2>


                <p className="profile-role">
                  {profile.role}
                </p>


                {
                  profile.joinDate && (
                    <p className="profile-join">
                      Joined {profile.joinDate}
                    </p>
                  )
                }

              </div>


              {/* ========================================= */}
              {/* Stats */}
              {/* ========================================= */}

              <div className="stats-section">

                <div className="stat-item">

                  <span className="stat-number">
                    {profile.stats.projects}
                  </span>

                  <span className="stat-label">
                    Projects
                  </span>

                </div>


                <div className="stat-divider">
                </div>


                <div className="stat-item">

                  <span className="stat-number">
                    {profile.stats.artworks}
                  </span>

                  <span className="stat-label">
                    Artworks
                  </span>

                </div>


                <div className="stat-divider">
                </div>


                <div className="stat-item">

                  <span className="stat-number">
                    {profile.stats.followers}
                  </span>

                  <span className="stat-label">
                    Followers
                  </span>

                </div>

              </div>

            </div>


            {/* =========================================== */}
            {/* RIGHT SIDE */}
            {/* =========================================== */}

            <div className="profile-right">


              {/* ========================================= */}
              {/* Personal Information */}
              {/* ========================================= */}

              <div className="profile-info">

                <h3>
                  Personal Information
                </h3>


                <div className="info-grid">


                  {/* Full Name */}

                  <div className="info-field">

                    <label>
                      Full Name
                    </label>

                    {
                      isEditing ? (

                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          className="edit-input"
                        />

                      ) : (

                        <p>
                          {profile.fullName}
                        </p>

                      )
                    }

                  </div>


                  {/* Username */}

                  <div className="info-field">

                    <label>
                      Username
                    </label>

                    {
                      isEditing ? (

                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          className="edit-input"
                          placeholder="Enter username"
                        />

                      ) : (

                        <p>
                          {
                            profile.username
                              ? `@${profile.username}`
                              : 'Not set'
                          }
                        </p>

                      )
                    }

                  </div>


                  {/* Email */}

                  <div className="info-field">

                    <label>
                      Email
                    </label>

                    <p>
                      {profile.email}
                    </p>

                  </div>


                  {/* Location */}

                  <div className="info-field">

                    <label>
                      Location
                    </label>

                    {
                      isEditing ? (

                        <input
                          type="text"
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          className="edit-input"
                          placeholder="Enter location"
                        />

                      ) : (

                        <p>
                          {
                            profile.location ||
                            'Not set'
                          }
                        </p>

                      )
                    }

                  </div>


                  {/* Bio */}

                  <div className="info-field full-width">

                    <label>
                      Bio
                    </label>

                    {
                      isEditing ? (

                        <textarea
                          name="bio"
                          value={formData.bio}
                          onChange={handleInputChange}
                          className="edit-textarea"
                          rows="3"
                          placeholder="Tell us something about yourself"
                        />

                      ) : (

                        <p>
                          {
                            profile.bio ||
                            'No bio added'
                          }
                        </p>

                      )
                    }

                  </div>


                  {/* Website */}

                  <div className="info-field full-width">

                    <label>
                      Website
                    </label>

                    {
                      isEditing ? (

                        <input
                          type="url"
                          name="website"
                          value={formData.website}
                          onChange={handleInputChange}
                          className="edit-input"
                          placeholder="https://example.com"
                        />

                      ) : (

                        <p>

                          {
                            profile.website ? (

                              <a
                                href={profile.website}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {profile.website}
                              </a>

                            ) : (

                              'Not provided'

                            )
                          }

                        </p>

                      )
                    }

                  </div>

                </div>

              </div>


              {/* ========================================= */}
              {/* Preferences */}
              {/* ========================================= */}

              <div className="preferences-section">

                <h3>
                  Preferences
                </h3>


                <div className="preferences-grid">


                  {/* Email Notifications */}

                  <label className="preference-item">

                    <span>
                      Email Notifications
                    </span>

                    {
                      isEditing ? (

                        <input
                          type="checkbox"
                          name="emailNotifications"
                          checked={
                            formData.preferences
                              .emailNotifications
                          }
                          onChange={handleInputChange}
                          className="toggle-input"
                        />

                      ) : (

                        <span className="preference-value">

                          {
                            profile.preferences
                              .emailNotifications
                              ? '✅ Enabled'
                              : '❌ Disabled'
                          }

                        </span>

                      )
                    }

                  </label>


                  {/* Push Notifications */}

                  <label className="preference-item">

                    <span>
                      Push Notifications
                    </span>

                    {
                      isEditing ? (

                        <input
                          type="checkbox"
                          name="pushNotifications"
                          checked={
                            formData.preferences
                              .pushNotifications
                          }
                          onChange={handleInputChange}
                          className="toggle-input"
                        />

                      ) : (

                        <span className="preference-value">

                          {
                            profile.preferences
                              .pushNotifications
                              ? '✅ Enabled'
                              : '❌ Disabled'
                          }

                        </span>

                      )
                    }

                  </label>


                  {/* Dark Mode */}

                  <label className="preference-item">

                    <span>
                      Dark Mode
                    </span>

                    {
                      isEditing ? (

                        <input
                          type="checkbox"
                          name="darkMode"
                          checked={
                            formData.preferences
                              .darkMode
                          }
                          onChange={handleInputChange}
                          className="toggle-input"
                        />

                      ) : (

                        <span className="preference-value">

                          {
                            profile.preferences
                              .darkMode
                              ? '🌙 Dark'
                              : '☀️ Light'
                          }

                        </span>

                      )
                    }

                  </label>


                  {/* Language */}

                  <label className="preference-item">

                    <span>
                      Language
                    </span>

                    {
                      isEditing ? (

                        <select
                          name="language"
                          value={
                            formData.preferences
                              .language
                          }
                          onChange={handleInputChange}
                          className="edit-select"
                        >

                          <option value="English">
                            English
                          </option>

                          <option value="Spanish">
                            Spanish
                          </option>

                          <option value="French">
                            French
                          </option>

                          <option value="German">
                            German
                          </option>

                          <option value="Chinese">
                            Chinese
                          </option>

                        </select>

                      ) : (

                        <span className="preference-value">

                          {
                            profile.preferences
                              .language
                          }

                        </span>

                      )
                    }

                  </label>

                </div>

              </div>


              {/* ========================================= */}
              {/* Save / Cancel Buttons */}
              {/* ========================================= */}

              {
                isEditing && (

                  <div className="edit-actions">

                    <button
                      className="btn-save"
                      onClick={handleSave}
                      disabled={loading}
                    >

                      {
                        loading
                          ? 'Saving...'
                          : 'Save Changes'
                      }

                    </button>


                    <button
                      className="btn-cancel-edit"
                      onClick={handleEditToggle}
                      disabled={loading}
                    >

                      Cancel

                    </button>

                  </div>

                )
              }

            </div>

          </div>

        </div>

      </div>


      {/* Only ONE footer */}
      <Footer />

    </>
  );
};

export default Profile;