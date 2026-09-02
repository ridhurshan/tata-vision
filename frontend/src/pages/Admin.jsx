// src/pages/Admin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Admin.css';
import Navbar from '../common/Navbar';
import Footer from '../common/Footer';
import { getStats, getUsers, updateUserStatus } from '../services/adminService';
import { getProjects } from '../services/projectService';
import { useAuth } from '../context/AuthContext';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { userId, name, newStatus }
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    activeUsers: 0,
  });
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, projectsRes] = await Promise.all([
        getStats(),
        getUsers(),
        getProjects(),
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setProjects(projectsRes.data);
    } catch (err) {
      // M4-style session error, per SRS Account Management use case
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized access detected. Please log in again.');
      } else {
        setError('Unable to retrieve admin data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  if (
    user &&
    user.role?.toLowerCase() === 'admin'
  ) {
    loadAdminData();
  }
}, [user]);
  useEffect(() => {
  if (authLoading) return;

  if (!user) {
    navigate('/login');
    return;
  }

  if (
    user.role?.toLowerCase() !== 'admin'
  ) {
    navigate('/Dashboard');
  }
}, [user, authLoading, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Step 1: ask for confirmation (per SRS 7A:1 / M-messages)
  const askConfirm = (user, newStatus) => {
    setConfirmAction({ userId: user.id, name: user.full_name, newStatus });
  };

  // Step 2: user confirms -> actually call the API
  const confirmStatusChange = async () => {
    if (!confirmAction) return;
    const { userId, newStatus } = confirmAction;
    try {
      await updateUserStatus(userId, newStatus);
      setActionMessage(`User account status updated successfully to ${newStatus}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
    } catch (err) {
      setActionMessage(err.response?.data?.message || 'Account status update failed. Please try again.');
    } finally {
      setConfirmAction(null);
      setTimeout(() => setActionMessage(''), 4000);
    }
  };

  const cancelConfirm = () => setConfirmAction(null);

  const getStatusBadge = (status) => {
    const statusMap = {
      Active: { className: 'status-active', icon: '🟢' },
      Deactivated: { className: 'status-suspended', icon: '🔴' },
      Pending: { className: 'status-pending', icon: '⏳' },
      Completed: { className: 'status-completed', icon: '✅' },
      Processing: { className: 'status-processing', icon: '🔄' },
    };
    return statusMap[status] || { className: '', icon: '' };
  };

  const getRoleBadge = (role) => {
    const roleMap = { Admin: 'role-admin', User: 'role-user' };
    return roleMap[role] || 'role-user';
  };

  const projectCountFor = (userId) =>
    projects.filter((p) => p.user_id === userId).length;

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
      <Navbar />
      <div className="admin-page">
        <div className="admin-container">
          {/* Header */}
          <div className="admin-header">
            <div className="header-left">
              <h1>Admin Dashboard</h1>
              <p className="subtitle">Manage users and monitor system activity</p>
            </div>
            <div className="header-actions">
              {/* <button className="btn-logout" onClick={handleLogout}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button> */}
            </div>
          </div>

          {error && (
            <div className="tab-content" style={{ marginBottom: 20, color: '#dc2626' }}>
              {error}
            </div>
          )}

          {actionMessage && (
            <div className="tab-content" style={{ marginBottom: 20, color: '#059669' }}>
              {actionMessage}
            </div>
          )}

          {/* Stats Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-icon users-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div className="stat-info">
                <h3>{stats.totalUsers}</h3>
                <p>Total Users</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon active-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 8 12 12 8 8" />
                </svg>
              </div>
              <div className="stat-info">
                <h3>{stats.activeUsers}</h3>
                <p>Active Users</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon projects-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <div className="stat-info">
                <h3>{stats.totalProjects}</h3>
                <p>Total Projects</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="admin-tabs">
            <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              Overview
            </button>
            <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              Users
            </button>
            <button className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
              Projects
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'overview' && (
              <div className="overview-content">
                <h3>Welcome, Admin</h3>
                <p>Use the Users tab to activate or deactivate accounts, or the Projects tab to see all drawing projects in the system.</p>
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
                      {users.map((user) => {
                        const status = getStatusBadge(user.status);
                        return (
                          <tr key={user.id}>
                            <td><strong>{user.full_name}</strong></td>
                            <td>{user.email}</td>
                            <td><span className={`role-badge ${getRoleBadge(user.role)}`}>{user.role}</span></td>
                            <td><span className={`status-badge ${status.className}`}>{status.icon} {user.status}</span></td>
                            <td>{projectCountFor(user.id)}</td>
                            <td>{new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                              <div className="action-buttons">
                                {user.status !== 'Active' && (
                                  <button
                                    className="btn-action view"
                                    onClick={() => askConfirm(user, 'Active')}
                                  >
                                    Activate
                                  </button>
                                )}
                                {user.status !== 'Deactivated' && (
                                  <button
                                    className="btn-action delete"
                                    onClick={() => askConfirm(user, 'Deactivated')}
                                  >
                                    Deactivate
                                  </button>
                                )}
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
                        <th>User ID</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project) => {
                        const status = getStatusBadge(project.status);
                        return (
                          <tr key={project.id}>
                            <td><strong>{project.title}</strong></td>
                            <td>{project.user_id}</td>
                            <td><span className={`status-badge ${status.className}`}>{status.icon} {project.status}</span></td>
                            <td>{new Date(project.created_at).toLocaleDateString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog - SRS section 3.6.1 */}
      {confirmAction && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div style={{ background: 'white', padding: 24, borderRadius: 12, maxWidth: 360, textAlign: 'center' }}>
            <p>
              Are you sure you want to set <strong>{confirmAction.name}</strong>'s account to{' '}
              <strong>{confirmAction.newStatus}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn-action delete" onClick={confirmStatusChange}>Yes</button>
              <button className="btn-action edit" onClick={cancelConfirm}>No</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default Admin;
