// src/pages/ViewProject/index.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './ViewProject.css';

const ViewProject = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 800));

        const sampleProject = {
          id: parseInt(projectId),
          title: 'Processing Your Artwork',
          subtitle: 'Watch as AI transforms your sketch',
          date: 'February 15, 2024',
          status: 'completed',
          style: 'Realistic',
          stages: [
            {
              id: 1,
              name: 'Stage 1: Geometric Foundation',
              image: 'https://picsum.photos/200/300?random',
              status: 'completed'
            },
            {
              id: 2,
              name: 'Stage 2: Contour Line-work',
              image: 'https://picsum.photos/200/300?random',
              status: 'completed'
            },
            {
              id: 3,
              name: 'Stage 3: Shaded Study (Monochrome)',
              image: 'https://picsum.photos/200/300?random',
              status: 'completed'
            },
            {
              id: 4,
              name: 'Stage 4: Color Painting (Final)',
              image: 'https://picsum.photos/200/300?random',
              status: 'completed'
            }
          ],
          processingStages: [
            { id: 1, name: 'Sketch Analysis' },
            { id: 2, name: 'Enhancement' },
            { id: 3, name: 'Refinement' },
            { id: 4, name: 'Finalization' }
          ]
        };

        setProject(sampleProject);
        setProcessingProgress(100);

        if (sampleProject.status === 'processing') {
          setIsProcessing(true);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

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

  if (!project) {
    return (
      <div className="view-project-error">
        <h2>Project not found</h2>
        <Link to="/projects" className="btn-back">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="view-project-page">
      <div className="view-project-container">

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1>{project.title}</h1>
            <p className="page-subtitle">{project.subtitle}</p>
          </div>
          <Link to="/projects" className="btn-back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Processing Status Card */}
        <div className="processing-status-card">
          <div className="processing-status-top">
            <h3>Processing Status</h3>
            <span className="progress-percent">{processingProgress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          <div className="stage-pills">
            {project.processingStages.map((stage) => {
              const done = processingProgress >= 100;
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

        {/* Final Output - 2x2 stage grid */}
        <div className="section-block">
          <h3 className="section-title">Final Output</h3>
          <div className="drawing-stages-card">
            <div className="drawing-stages-header">DRAWING STAGES</div>
            <div className="drawing-stages-grid">
              {project.stages.map((stage) => (
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

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <button className="btn-outline" onClick={handleUploadAnother}>
            Upload Another Sketch
          </button>
          <button className="btn-primary" onClick={handleDownload}>
            Download as PDF
          </button>
        </div>

      </div>
    </div>
  );
};

export default ViewProject;