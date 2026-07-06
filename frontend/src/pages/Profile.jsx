// src/pages/Profile/index.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import Footer from '../common/Footer';
import { useAuth } from '../context/AuthContext';
import Navbar from '../common/Navbar';
//import Navbar from '../common/Navbar';  

const Profile = () => {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // fullName + email come from DB via login response (user object in AuthContext)
  // everything else is local-only placeholder/editable data for now
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    role: '',
    username: '',
    bio: 'Passionate artist and AI enthusiast. Creating beautiful art with technology.',
    location: '',
    website: '',
    joinDate: '',
    avatar: 'https://ui-avatars.com/api/?name=User&size=150&background=6366f1&color=fff',
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

  const [formData, setFormData] = useState({ ...profile });

  // Redirect if not logged in, and sync fullName/email/role from the real logged-in user
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const updated = {
      fullName: user.name,   // maps to full_name in DB
      email: user.email,     // from DB
      role: user.role,       // from DB
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&size=150&background=6366f1&color=fff`
    };
    setProfile(prev => ({ ...prev, ...updated }));
    setFormData(prev => ({ ...prev, ...updated }));
  }, [user, navigate]);

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
      // Note: only local state is updated here. bio/location/website/preferences
      // are not persisted to the database yet — that requires backend support.
      await new Promise(resolve => setTimeout(resolve, 800));
      setProfile({ ...formData });
      setIsEditing(false);
      setSuccess('Profile updated!');
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!user) return null;

  return (
    <>
    <Navbar/>
    <div className="profile-page">
      <div className="profile-container">
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

        {success && <div className="success-message">{success}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="profile-content">
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
              {profile.joinDate && <p className="profile-join">Joined {profile.joinDate}</p>}
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
                    <p>{profile.username ? `@${profile.username}` : 'Not set'}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Email</label>
                  <p>{profile.email}</p>
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
                    <p>{profile.location || 'Not set'}</p>
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
              </div>
            )}
          </div>
        </div>
        {isEditing && <Footer />}
      </div>
    </div>
    <Footer/>
    </>
  );
};

export default Profile;