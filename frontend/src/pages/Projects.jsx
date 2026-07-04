// src/pages/Projects/index.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Projects.css';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  // Sample project data
  useEffect(() => {
    // Simulate API call
    const fetchProjects = async () => {
      setLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Sample projects data
        const sampleProjects = [
          {
            id: 1,
            title: 'Landscape Sketch',
            date: 'February 15, 2024',
            description: 'Beautiful mountain landscape transformed into digital art',
            status: 'completed',
            style: 'Realistic',
            imageUrl: 'https://picsum.photos/200/300?random=1',
            thumbnail: 'https://via.placeholder.com/200x150/6366f1/ffffff?text=Landscape'
          },
          {
            id: 2,
            title: 'Portrait Study',
            date: 'February 10, 2024',
            description: 'Detailed portrait study with artistic interpretation',
            status: 'completed',
            style: 'Abstract',
            imageUrl: 'https://picsum.photos/200/300?random=2',
            thumbnail: 'https://via.placeholder.com/200x150/8b5cf6/ffffff?text=Portrait'
          },
          {
            id: 3,
            title: 'Abstract Design',
            date: 'February 5, 2024',
            description: 'Abstract composition with vibrant colors and patterns',
            status: 'processing',
            style: 'Abstract',
            imageUrl: 'https://picsum.photos/200/300?random=3',
            thumbnail: 'https://via.placeholder.com/200x150/ec4899/ffffff?text=Abstract'
          },
          {
            id: 4,
            title: 'Nature Illustration',
            date: 'January 28, 2024',
            description: 'Nature scene with detailed flora and fauna',
            status: 'completed',
            style: 'Illustration',
            imageUrl: 'https://picsum.photos/200/300?random=4',
            thumbnail: 'https://via.placeholder.com/200x150/14b8a6/ffffff?text=Nature'
          },
          {
            id: 5,
            title: 'Cityscape Night',
            date: 'January 20, 2024',
            description: 'Night cityscape with neon lights and reflections',
            status: 'completed',
            style: 'Modern',
            imageUrl: 'https://picsum.photos/200/300?random=5',
            thumbnail: 'https://via.placeholder.com/200x150/f59e0b/ffffff?text=Cityscape'
          },
          {
            id: 6,
            title: 'Fantasy World',
            date: 'January 15, 2024',
            description: 'Fantasy landscape with mythical creatures and magic',
            status: 'failed',
            style: 'Fantasy',
            imageUrl: 'https://picsum.photos/id/237/200/300?random=6',
            thumbnail: 'https://via.placeholder.com/200x150/ef4444/ffffff?text=Fantasy'
          }
        ];
        
        setProjects(sampleProjects);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleViewProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      setProjects(projects.filter(project => project.id !== projectId));
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      completed: { label: 'Completed', className: 'status-completed' },
      processing: { label: 'Processing', className: 'status-processing' },
      failed: { label: 'Failed', className: 'status-failed' },
      draft: { label: 'Draft', className: 'status-draft' }
    };
    return statusMap[status] || statusMap.draft;
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          project.description.toLowerCase().includes(searchTerm.toLowerCase());
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
              className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
            <button 
              className={`filter-tab ${filter === 'processing' ? 'active' : ''}`}
              onClick={() => setFilter('processing')}
            >
              Processing
            </button>
            <button 
              className={`filter-tab ${filter === 'failed' ? 'active' : ''}`}
              onClick={() => setFilter('failed')}
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
                  <img src={project.thumbnail} alt={project.title} />
                  <span className={`status-badge ${getStatusBadge(project.status).className}`}>
                    {getStatusBadge(project.status).label}
                  </span>
                </div>
                <div className="project-content">
                  <div className="project-info">
                    <h3>{project.title}</h3>
                    <p className="project-description">{project.description}</p>
                    <div className="project-meta">
                      <span className="project-date">{project.date}</span>
                      <span className="project-style">{project.style}</span>
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
                {projects.filter(p => p.status === 'completed').length}
              </span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">
                {projects.filter(p => p.status === 'processing').length}
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