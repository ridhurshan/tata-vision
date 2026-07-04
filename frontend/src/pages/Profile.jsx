// src/pages/Profile/index.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import Footer from '../common/Footer';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    username: 'johndoe',
    bio: 'Passionate artist and AI enthusiast. Creating beautiful art with technology.',
    location: 'New York, USA',
    website: 'https://johndoe.com',
    joinDate: 'January 15, 2024',
    role: 'Artist',
    avatar: 'https://ui-avatars.com/api/?name=John+Doe&size=150&background=6366f1&color=fff',
    stats: {
      projects: 47,
      followers: 1234,
      following: 567,
      artworks: 89
    },
    preferences: {
      emailNotifications: true,
      pushNotifications: true,
      darkMode: false,
      language: 'English'
    }
  });

  const [formData, setFormData] = useState({ ...profile });

  useEffect(() => {
    // In real app, fetch profile from API
    // const fetchProfile = async () => {
    //   const response = await api.get('/profile');
    //   setProfile(response.data);
    //   setFormData(response.data);
    // };
    // fetchProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [name]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing, revert changes
      setFormData({ ...profile });
    }
    setIsEditing(!isEditing);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update profile
      setProfile({ ...formData });
      setIsEditing(false);
      setSuccess('Profile updated successfully!');
      
      // In real app:
      // await api.put('/profile', formData);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          avatar: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Header */}
        <div className="profile-header">
          <h1>Profile</h1>
          <div className="header-actions">
            <button 
              className={`btn-edit ${isEditing ? 'btn-cancel' : ''}`}
              onClick={handleEditToggle}
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
            <button className="btn-logout" onClick={handleLogout}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Messages */}
        {success && <div className="success-message">{success}</div>}
        {error && <div className="error-message">{error}</div>}

        {/* Profile Content */}
        <div className="profile-content">
          {/* Left Column - Avatar & Stats */}
          <div className="profile-left">
            <div className="avatar-section">
              <div className="avatar-wrapper">
                <img src={formData.avatar} alt="Profile" className="avatar" />
                {isEditing && (
                  <label className="avatar-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: 'none' }}
                    />
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </label>
                )}
              </div>
              <h2 className="profile-name">{profile.fullName}</h2>
              <p className="profile-role">{profile.role}</p>
              <p className="profile-join">Joined {profile.joinDate}</p>
            </div>

            <div className="stats-section">
              <div className="stat-item">
                <span className="stat-number">{profile.stats.projects}</span>
                <span className="stat-label">Projects</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{profile.stats.artworks}</span>
                <span className="stat-label">Artworks</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{profile.stats.followers}</span>
                <span className="stat-label">Followers</span>
              </div>
            </div>
          </div>

          {/* Right Column - Profile Details */}
          <div className="profile-right">
            <div className="profile-info">
              <h3>Personal Information</h3>
              
              <div className="info-grid">
                <div className="info-field">
                  <label>Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <p>{profile.fullName}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Username</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <p>@{profile.username}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <p>{profile.email}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Location</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <p>{profile.location}</p>
                  )}
                </div>

                <div className="info-field full-width">
                  <label>Bio</label>
                  {isEditing ? (
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      className="edit-textarea"
                      rows="3"
                    />
                  ) : (
                    <p>{profile.bio}</p>
                  )}
                </div>

                <div className="info-field full-width">
                  <label>Website</label>
                  {isEditing ? (
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <p>
                      {profile.website ? (
                        <a href={profile.website} target="_blank" rel="noopener noreferrer">
                          {profile.website}
                        </a>
                      ) : 'Not provided'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="preferences-section">
              <h3>Preferences</h3>
              <div className="preferences-grid">
                <label className="preference-item">
                  <span>Email Notifications</span>
                  {isEditing ? (
                    <input
                      type="checkbox"
                      name="emailNotifications"
                      checked={formData.preferences.emailNotifications}
                      onChange={handleInputChange}
                      className="toggle-input"
                    />
                  ) : (
                    <span className="preference-value">
                      {profile.preferences.emailNotifications ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                  )}
                </label>

                <label className="preference-item">
                  <span>Push Notifications</span>
                  {isEditing ? (
                    <input
                      type="checkbox"
                      name="pushNotifications"
                      checked={formData.preferences.pushNotifications}
                      onChange={handleInputChange}
                      className="toggle-input"
                    />
                  ) : (
                    <span className="preference-value">
                      {profile.preferences.pushNotifications ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                  )}
                </label>

                <label className="preference-item">
                  <span>Dark Mode</span>
                  {isEditing ? (
                    <input
                      type="checkbox"
                      name="darkMode"
                      checked={formData.preferences.darkMode}
                      onChange={handleInputChange}
                      className="toggle-input"
                    />
                  ) : (
                    <span className="preference-value">
                      {profile.preferences.darkMode ? '🌙 Dark' : '☀️ Light'}
                    </span>
                  )}
                </label>

                <label className="preference-item">
                  <span>Language</span>
                  {isEditing ? (
                    <select
                      name="language"
                      value={formData.preferences.language}
                      onChange={handleInputChange}
                      className="edit-select"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Chinese">Chinese</option>
                    </select>
                  ) : (
                    <span className="preference-value">{profile.preferences.language}</span>
                  )}
                </label>
              </div>
            </div>

            {/* Save Button (Edit Mode) */}
            {isEditing && (
              <div className="edit-actions">
                <button 
                  className="btn-save" 
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="btn-cancel-edit" onClick={handleEditToggle}>
                  Cancel
                </button>
                <Footer/>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;