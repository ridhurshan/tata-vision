import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

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

  // Stores the image selected for the enlarged preview
  const [selectedStage, setSelectedStage] = useState(null);

  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      setError('');

      try {

          const response = await getProject(projectId);

          console.log(
              "PROJECT RECEIVED FROM BACKEND:",
              response.data
          );

          setProject(response.data);

      } catch (err) {

          console.error(
              'Error fetching project:',
              err
          );

          setError(
              'Project not found.'
          );

      } finally {

          setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  // Close lightbox using Escape key
  // Also prevent page scrolling while the lightbox is open
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedStage(null);
      }
    };

    if (selectedStage) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedStage]);

  const formatDate = (dateString) => {
    if (!dateString) {
      return '';
    }

    const date = new Date(dateString);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDownload = () => {
    alert('Downloading as PDF...');
  };

  const handleUploadAnother = () => {
    navigate('/upload');
  };

  const closeLightbox = () => {
    setSelectedStage(null);
  };

  const handleStageClick = (stage) => {

    if (!stage.image) {
        return;
    }

    setActiveStage(stage.id);
    setSelectedStage(stage);
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

        <Link to="/projects" className="btn-back">
          Back to Projects
        </Link>
      </div>
    );
  }

  const progressPercent =
    project.status === 'Completed'
      ? 100
      : project.status === 'Processing'
        ? 50
        : project.status === 'Failed'
          ? 0
          : 10;

      const processingStages = [
          { id: 1, name: 'Geometric Shapes' },
          { id: 2, name: 'Curves' },
          { id: 3, name: 'Shading' },
          { id: 4, name: 'Colouring Guide' },
      ];

  // Temporary images until real AI output is connected.
  // These URLs use larger images so they do not become too blurry
  // when shown inside the enlarged preview.
 const BACKEND_URL = 'http://localhost:5000';

  const drawingStages = [
      {
          id: 1,
          name: 'Geometric Shape Extraction',
          description: 'Basic geometric structure extracted from the reference image.',
          image: project.geometric_image
              ? `${BACKEND_URL}${project.geometric_image}`
              : null,
      },

      {
          id: 2,
          name: 'Curve Extraction',
          description: 'Refined curves and contour lines extracted from the image.',
          image: project.curve_image
              ? `${BACKEND_URL}${project.curve_image}`
              : null,
      },

      {
          id: 3,
          name: 'Pencil Shading',
          description: 'Pencil shading generated using reference-image light and shadow.',
          image: project.shading_image
              ? `${BACKEND_URL}${project.shading_image}`
              : null,
      },

      {
          id: 4,
          name: 'Number & Colour Guide',
          description: 'Paint-by-number guide with corresponding reference colours.',
          image: project.colouring_image
              ? `${BACKEND_URL}${project.colouring_image}`
              : null,
      },
  ];

  return (
    <>
      <Navbar />

      <main className="view-project-page">
        <div className="view-project-container">
          {/* Page Header */}
          <div className="page-header">
            <div>
              <h1>{project.title}</h1>

              <p className="page-subtitle">
                {project.description || 'No description provided'}
              </p>
            </div>

            <Link to="/projects" className="btn-back-link">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>

              Back
            </Link>
          </div>

          <p className="project-meta-date">
            Created: {formatDate(project.created_at)}
          </p>

          {/* Processing Status */}
          <section className="processing-status-card">
            <div className="processing-status-top">
              <h3>Processing Status</h3>

              <span className="progress-percent">
                {project.status}
              </span>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="stage-pills">
              {processingStages.map((stage) => {
                const done = progressPercent >= stage.id * 25;

                return (
                  <div
                    key={stage.id}
                    className={`stage-pill ${done ? 'done' : ''}`}
                  >
                    {done && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        aria-hidden="true"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}

                    <span>{stage.name}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Drawing Stages */}
          <section className="section-block">
            <h3 className="section-title">Final Output</h3>

            <div className="drawing-stages-card">
              <div className="drawing-stages-header">
                DRAWING STAGES (PREVIEW)
              </div>

              <div className="drawing-stages-grid">
                {drawingStages.map((stage) => (
                  <button
                    type="button"
                    key={stage.id}
                    className={`drawing-stage-cell ${
                      activeStage === stage.id ? 'active' : ''
                    }`}
                    onClick={() => handleStageClick(stage)}
                    aria-label={`Open enlarged preview of ${stage.name}`}
                  >
                    <div className="drawing-stage-image-wrapper">

                        {stage.image ? (

                            <img
                                src={stage.image}
                                alt={stage.name}
                                loading="lazy"
                            />

                        ) : (

                            <div className="stage-image-placeholder">

                                <div className="stage-placeholder-spinner"></div>

                                <span>
                                    Output not generated yet
                                </span>

                            </div>

                        )}

                        {stage.image && (
                            <div className="drawing-stage-hover-overlay">

                                <svg
                                    width="38"
                                    height="38"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    aria-hidden="true"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="M21 21l-4.35-4.35" />
                                    <path d="M11 8v6M8 11h6" />
                                </svg>

                                <span>View image</span>

                            </div>
                        )}

                    </div>

                    <div className="drawing-stage-caption">
                      {stage.name.toUpperCase()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Final Artwork Bar */}
          {project.status === 'Completed' && (
            <div className="final-artwork-bar">
              <div>
                <h4>Final Artwork</h4>
                <p>Your completed piece is ready to download</p>
              </div>

              <button
                type="button"
                className="btn-download-pdf"
                onClick={handleDownload}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
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
            <button
              type="button"
              className="btn-outline"
              onClick={handleUploadAnother}
            >
              Upload Another Sketch
            </button>

            {project.status === 'Completed' && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownload}
              >
                Download as PDF
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Enlarged Image Lightbox */}
      {selectedStage && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedStage.name} enlarged preview`}
          onClick={closeLightbox}
        >
          <div
            className="image-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-lightbox-close"
              onClick={closeLightbox}
              aria-label="Close image preview"
            >
              &times;
            </button>

            <div className="image-lightbox-image-wrapper">
              <img
                src={selectedStage.image}
                alt={selectedStage.name}
                className="image-lightbox-image"
              />
            </div>

            <div className="image-lightbox-bottom">
              <div>
                <p className="image-lightbox-stage-number">
                  Stage {selectedStage.id}
                </p>

                <h3 className="image-lightbox-caption">
                  {selectedStage.name}
                </h3>
              </div>

              <button
                type="button"
                className="image-lightbox-done"
                onClick={closeLightbox}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default ViewProject;