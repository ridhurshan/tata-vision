// src/pages/ViewProject/index.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import '../styles/ViewProject.css';
import { getProject } from '../services/projectService'; 
import Footer from '../common/Footer';
import Navbar from '../common/Navbar';

const ViewProject = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStage, setActiveStage] = useState(1);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getProject(projectId);
        setProject(response.data);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Project not found.');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleDownload = () => {
    alert('Downloading as PDF...');
  };

  const handleUploadAnother = () => {
    navigate('/upload');
  };

  if (loading) {
    return (
      <div className="view-project-loading">
        <div className="loading-spinner"></div>
        <p>Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="view-project-error">
        <h2>Project not found</h2>
        <Link to="/projects" className="btn-back">Back to Projects</Link>
      </div>
    );
  }

  const progressPercent = project.status === 'Completed' ? 100
    : project.status === 'Processing' ? 50
    : project.status === 'Failed' ? 0
    : 10; // Waiting

  const processingStages = [
    { id: 1, name: 'Sketch Analysis' },
    { id: 2, name: 'Enhancement' },
    { id: 3, name: 'Refinement' },
    { id: 4, name: 'Finalization' }
  ];

  // Placeholder stage images — not real AI output yet, just UI filler
  // seeded by project.id so they stay consistent per project on refresh
  const dummyStages = [
    { id: 1, name: 'Stage 1: Geometric Foundation', image: `https://picsum.photos/seed/${project.id}-1/300/220` },
    { id: 2, name: 'Stage 2: Contour Line-work', image: `https://picsum.photos/seed/${project.id}-2/300/220` },
    { id: 3, name: 'Stage 3: Shaded Study (Monochrome)', image: `https://picsum.photos/seed/${project.id}-3/300/220` },
    { id: 4, name: 'Stage 4: Color Painting (Final)', image: `https://picsum.photos/seed/${project.id}-4/300/220` }
  ];

  return (
    <>
    <Navbar/>
    <div className="view-project-page">
      <div className="view-project-container">

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1>{project.title}</h1>
            <p className="page-subtitle">{project.description || 'No description provided'}</p>
          </div>
          <Link to="/projects" className="btn-back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        <p className="project-meta-date">Created: {formatDate(project.created_at)}</p>

        {/* Processing Status Card */}
        <div className="processing-status-card">
          <div className="processing-status-top">
            <h3>Processing Status</h3>
            <span className="progress-percent">{project.status}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="stage-pills">
            {processingStages.map((stage) => {
              const done = progressPercent >= (stage.id * 25);
              return (
                <div key={stage.id} className={`stage-pill ${done ? 'done' : ''}`}>
                  {done && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  <span>{stage.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Final Output - 2x2 dummy stage grid (placeholder until image pipeline is built) */}
        <div className="section-block">
          <h3 className="section-title">Final Output</h3>
          <div className="drawing-stages-card">
            <div className="drawing-stages-header">DRAWING STAGES (PREVIEW)</div>
            <div className="drawing-stages-grid">
              {dummyStages.map((stage) => (
                <div
                  key={stage.id}
                  className={`drawing-stage-cell ${activeStage === stage.id ? 'active' : ''}`}
                  onClick={() => setActiveStage(stage.id)}
                >
                  <img src={stage.image} alt={stage.name} />
                  <div className="drawing-stage-caption">
                    {stage.name.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Final Artwork bar */}
        {project.status === 'Completed' && (
          <div className="final-artwork-bar">
            <div>
              <h4>Final Artwork</h4>
              <p>Your completed piece is ready to download</p>
            </div>
            <button className="btn-download-pdf" onClick={handleDownload}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </button>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <button className="btn-outline" onClick={handleUploadAnother}>
            Upload Another Sketch
          </button>
          {project.status === 'Completed' && (
            <button className="btn-primary" onClick={handleDownload}>
              Download as PDF
            </button>
          )}
        </div>

      </div>
    </div>
    <Footer/>
    </>
  );
};

export default ViewProject;