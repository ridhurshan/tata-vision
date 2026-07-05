// src/pages/Projects/index.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Projects.css';
import { useAuth } from '../context/AuthContext'; 
import { getProjectsByUser,deleteProject } from '../services/projectService'; 
const Projects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchProjects = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getProjectsByUser(user.id);
        setProjects(response.data);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user, navigate]);

  const handleViewProject = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

const handleDeleteProject = async (projectId) => {
  if (!window.confirm('Are you sure you want to delete this project?')) {
    return;
  }

  try {
    await deleteProject(projectId);
    setProjects(prev => prev.filter(project => project.id !== projectId));
  } catch (err) {
    console.error('Error deleting project:', err);
    setError('Failed to delete project. Please try again.');
  }
};

  const getStatusBadge = (status) => {
    const statusMap = {
      Completed: { label: 'Completed', className: 'status-completed' },
      Processing: { label: 'Processing', className: 'status-processing' },
      Failed: { label: 'Failed', className: 'status-failed' },
      Waiting: { label: 'Waiting', className: 'status-draft' }
    };
    return statusMap[status] || statusMap.Waiting;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || project.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="projects-loading">
        <div className="loading-spinner"></div>
        <p>Loading your projects...</p>
      </div>
    );
  }

  return (
    <div className="projects-page">
      <div className="projects-container">
        {/* Header */}
        <div className="projects-header">
          <div className="header-content">
            <h1>My Projects</h1>
            <p className="subtitle">View and manage your past artwork transformations</p>
          </div>
          <div className="header-actions">
            <Link to="/upload" className="btn-new-project">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Project
            </Link>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Filters */}
        <div className="projects-filters">
          <div className="search-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm('')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-tab ${filter === 'Completed' ? 'active' : ''}`}
              onClick={() => setFilter('Completed')}
            >
              Completed
            </button>
            <button
              className={`filter-tab ${filter === 'Processing' ? 'active' : ''}`}
              onClick={() => setFilter('Processing')}
            >
              Processing
            </button>
            <button
              className={`filter-tab ${filter === 'Failed' ? 'active' : ''}`}
              onClick={() => setFilter('Failed')}
            >
              Failed
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎨</div>
            <h3>No projects found</h3>
            <p>Start your creative journey by uploading a sketch</p>
            <Link to="/upload" className="btn-primary-empty">
              Upload Your First Sketch
            </Link>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-thumbnail">
                  <img
                    src={`https://via.placeholder.com/200x150/6366f1/ffffff?text=${encodeURIComponent(project.title)}`}
                    alt={project.title}
                  />
                  <span className={`status-badge ${getStatusBadge(project.status).className}`}>
                    {getStatusBadge(project.status).label}
                  </span>
                </div>
                <div className="project-content">
                  <div className="project-info">
                    <h3>{project.title}</h3>
                    <p className="project-description">{project.description || 'No description'}</p>
                    <div className="project-meta">
                      <span className="project-date">{formatDate(project.created_at)}</span>
                    </div>
                  </div>
                  <div className="project-actions">
                    <button
                      className="btn-view"
                      onClick={() => handleViewProject(project.id)}
                    >
                      View Project
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Project Stats */}
        {filteredProjects.length > 0 && (
          <div className="projects-stats">
            <div className="stat-item">
              <span className="stat-number">{projects.length}</span>
              <span className="stat-label">Total Projects</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">
                {projects.filter(p => p.status === 'Completed').length}
              </span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">
                {projects.filter(p => p.status === 'Processing').length}
              </span>
              <span className="stat-label">In Progress</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;