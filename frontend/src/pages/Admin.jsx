// src/pages/Admin/index.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Admin.css';
import Navbar from '../common/Navbar';
import Footer from '../common/Footer';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalArtworks: 0,
    pendingApprovals: 0,
    revenue: 0,
    activeUsers: 0
  });
  const navigate = useNavigate();

  // Sample data - In real app, fetch from API
  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Sample stats
        setStats({
          totalUsers: 1254,
          totalProjects: 3421,
          totalArtworks: 5678,
          pendingApprovals: 23,
          revenue: 45678,
          activeUsers: 876
        });

        // Sample users
        setUsers([
          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'User', status: 'Active', joined: '2024-01-15', projects: 12 },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Artist', status: 'Active', joined: '2024-01-20', projects: 34 },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Inactive', joined: '2024-02-01', projects: 5 },
          { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Admin', status: 'Active', joined: '2024-02-10', projects: 45 },
          { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'User', status: 'Suspended', joined: '2024-02-15', projects: 8 },
        ]);

        // Sample projects
        setProjects([
          { id: 1, title: 'Landscape Sketch', user: 'John Doe', status: 'Completed', date: '2024-02-15', style: 'Realistic' },
          { id: 2, title: 'Portrait Study', user: 'Jane Smith', status: 'Processing', date: '2024-02-10', style: 'Abstract' },
          { id: 3, title: 'Abstract Design', user: 'Bob Johnson', status: 'Pending', date: '2024-02-05', style: 'Abstract' },
          { id: 4, title: 'Nature Illustration', user: 'Alice Brown', status: 'Completed', date: '2024-01-28', style: 'Illustration' },
        ]);
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleUserAction = (userId, action) => {
    alert(`User ${userId} - Action: ${action}`);
  };

  const handleProjectAction = (projectId, action) => {
    alert(`Project ${projectId} - Action: ${action}`);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'Active': { className: 'status-active', icon: '🟢' },
      'Inactive': { className: 'status-inactive', icon: '⚪' },
      'Suspended': { className: 'status-suspended', icon: '🔴' },
      'Completed': { className: 'status-completed', icon: '✅' },
      'Processing': { className: 'status-processing', icon: '🔄' },
      'Pending': { className: 'status-pending', icon: '⏳' },
    };
    return statusMap[status] || { className: '', icon: '' };
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      'Admin': 'role-admin',
      'Artist': 'role-artist',
      'User': 'role-user'
    };
    return roleMap[role] || 'role-user';
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <>
    <Navbar/>
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="header-left">
            <h1>Admin Dashboard</h1>
            <p className="subtitle">Manage users, projects, and system settings</p>
          </div>
          <div className="header-actions">
            <button className="btn-notification">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="notification-badge">3</span>
            </button>
            <button className="btn-settings">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
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

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon users-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <div className="stat-info">
              <h3>{stats.totalUsers}</h3>
              <p>Total Users</p>
              <span className="stat-change positive">+12% this month</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon projects-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
            </div>
            <div className="stat-info">
              <h3>{stats.totalProjects}</h3>
              <p>Total Projects</p>
              <span className="stat-change positive">+8% this month</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon artworks-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div className="stat-info">
              <h3>{stats.totalArtworks}</h3>
              <p>Artworks Created</p>
              <span className="stat-change positive">+15% this month</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon pending-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-info">
              <h3>{stats.pendingApprovals}</h3>
              <p>Pending Approvals</p>
              <span className="stat-change negative">+3 pending</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon revenue-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div className="stat-info">
              <h3>${stats.revenue.toLocaleString()}</h3>
              <p>Revenue</p>
              <span className="stat-change positive">+23% this month</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon active-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 12.5v3.5a2 2 0 01-2 2H6a2 2 0 01-2-2v-3.5" />
                <polyline points="16 8 12 12 8 8" />
                <line x1="12" y1="12" x2="12" y2="4" />
              </svg>
            </div>
            <div className="stat-info">
              <h3>{stats.activeUsers}</h3>
              <p>Active Users</p>
              <span className="stat-change positive">+5% this month</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button 
            className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-content">
              <div className="recent-activity">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  <div className="activity-item">
                    <span className="activity-dot green"></span>
                    <div className="activity-info">
                      <p><strong>John Doe</strong> created a new project: "Landscape Sketch"</p>
                      <span className="activity-time">2 minutes ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-dot blue"></span>
                    <div className="activity-info">
                      <p><strong>Jane Smith</strong> uploaded a new artwork</p>
                      <span className="activity-time">15 minutes ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-dot orange"></span>
                    <div className="activity-info">
                      <p><strong>Bob Johnson</strong> requested a project review</p>
                      <span className="activity-time">1 hour ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-dot purple"></span>
                    <div className="activity-info">
                      <p>New user <strong>Charlie Wilson</strong> registered</p>
                      <span className="activity-time">3 hours ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="users-content">
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Projects</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const status = getStatusBadge(user.status);
                      return (
                        <tr key={user.id}>
                          <td><strong>{user.name}</strong></td>
                          <td>{user.email}</td>
                          <td><span className={`role-badge ${getRoleBadge(user.role)}`}>{user.role}</span></td>
                          <td><span className={`status-badge ${status.className}`}>{status.icon} {user.status}</span></td>
                          <td>{user.projects}</td>
                          <td>{user.joined}</td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn-action edit" onClick={() => handleUserAction(user.id, 'Edit')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 14.66V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h5.34" />
                                  <polygon points="18 2 22 6 12 16 8 16 8 12 18 2" />
                                </svg>
                              </button>
                              <button className="btn-action delete" onClick={() => handleUserAction(user.id, 'Delete')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="projects-content">
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>User</th>
                      <th>Style</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(project => {
                      const status = getStatusBadge(project.status);
                      return (
                        <tr key={project.id}>
                          <td><strong>{project.title}</strong></td>
                          <td>{project.user}</td>
                          <td>{project.style}</td>
                          <td><span className={`status-badge ${status.className}`}>{status.icon} {project.status}</span></td>
                          <td>{project.date}</td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn-action view" onClick={() => handleProjectAction(project.id, 'View')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                              <button className="btn-action edit" onClick={() => handleProjectAction(project.id, 'Edit')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 14.66V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h5.34" />
                                  <polygon points="18 2 22 6 12 16 8 16 8 12 18 2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="analytics-content">
              <div className="analytics-placeholder">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                </svg>
                <h3>Analytics Dashboard</h3>
                <p>Coming soon - Detailed analytics and reporting</p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-content">
              <div className="settings-placeholder">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
                <h3>System Settings</h3>
                <p>Coming soon - Configure system preferences</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    <Footer/>
    </>
  );
};

export default Admin;