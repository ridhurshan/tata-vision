// src/pages/Dashboard/index.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

import Navbar from '../common/Navbar';
import Footer from '../common/Footer';
import { useAuth } from '../context/AuthContext';
import { getProjectsByUser } from '../services/projectService';

const BACKEND_URL = 'http://localhost:5000';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userName =
    user?.name ||
    user?.full_name ||
    'Artist';

  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchProjects = async () => {
      try {
        const response = await getProjectsByUser(user.id);
        setProjects(response.data);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };

    fetchProjects();
  }, [user]);

  const stats = {
    totalProjects: projects.length,
    inProgress: projects.filter((p) => p.status === 'Processing').length,
    completed: projects.filter((p) => p.status === 'Completed').length
  };

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      image: p.input_image ? `${BACKEND_URL}${p.input_image}` : '',
      title: p.title,
      stage: p.status
    }));

  const handleStartDrawing = () => {
    navigate('/upload');
  };

  const handleViewProjects = () => {
    navigate('/projects');
  };

  return (
    <>
      <Navbar />

      <main className="dashboard-page">

        {/* ============================== */}
        {/* HERO SECTION */}
        {/* ============================== */}

        <section className="dashboard-hero">
          <div className="dashboard-container hero-container">

            <div className="hero-content">

              <span className="hero-badge">
                AI-Powered Drawing Assistant
              </span>

              <h1>
                Welcome back,
                <span> {userName}</span>
              </h1>

              <p>
                Turn your reference images into simple,
                step-by-step drawing guidance with DrawAI.
                Learn shapes, curves, shading and colouring
                while creating your artwork.
              </p>

              <div className="hero-buttons">

                <button
                  className="dashboard-primary-btn"
                  onClick={handleStartDrawing}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>

                  Start New Drawing
                </button>

                <button
                  className="dashboard-secondary-btn"
                  onClick={handleViewProjects}
                >
                  View My Projects

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </button>

              </div>
            </div>


            {/* Hero visual */}

            <div className="hero-visual">

              <div className="drawing-demo-card">

                <div className="demo-header">
                  <span className="demo-dot"></span>
                  <span className="demo-dot"></span>
                  <span className="demo-dot"></span>

                  <span className="demo-title">
                    Drawing Process
                  </span>
                </div>

                <div className="demo-content">

                  <div className="demo-stage active">
                    <span className="demo-number">1</span>

                    <div>
                      <strong>Upload</strong>
                      <small>Reference image</small>
                    </div>

                    <span className="demo-check">✓</span>
                  </div>

                  <div className="demo-line"></div>

                  <div className="demo-stage active">
                    <span className="demo-number">2</span>

                    <div>
                      <strong>Basic Shapes</strong>
                      <small>Structure guidance</small>
                    </div>

                    <span className="demo-check">✓</span>
                  </div>

                  <div className="demo-line"></div>

                  <div className="demo-stage current">
                    <span className="demo-number">3</span>

                    <div>
                      <strong>Shading</strong>
                      <small>Light & shadow</small>
                    </div>

                    <span className="demo-processing"></span>
                  </div>

                  <div className="demo-line muted"></div>

                  <div className="demo-stage">
                    <span className="demo-number">4</span>

                    <div>
                      <strong>Colouring</strong>
                      <small>Final colours</small>
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>
        </section>


        {/* ============================== */}
        {/* STATISTICS */}
        {/* ============================== */}

        <section className="dashboard-section">

          <div className="dashboard-container">

            <div className="section-heading">
              <div>
                <span className="section-label">
                  YOUR WORKSPACE
                </span>

                <h2>
                  Your Overview
                </h2>

                <p>
                  A quick look at your drawing projects.
                </p>
              </div>
            </div>


            <div className="dashboard-stats">

              {/* Total Projects */}

              <div className="stat-card">

                <div className="stat-icon stat-purple">

                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                    />

                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>

                </div>

                <div className="stat-info">

                  <span className="stat-value">
                    {stats.totalProjects}
                  </span>

                  <span className="stat-title">
                    Total Projects
                  </span>

                </div>

              </div>


              {/* In Progress */}

              <div className="stat-card">

                <div className="stat-icon stat-orange">

                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>

                </div>

                <div className="stat-info">

                  <span className="stat-value">
                    {stats.inProgress}
                  </span>

                  <span className="stat-title">
                    In Progress
                  </span>

                </div>

              </div>


              {/* Completed */}

              <div className="stat-card">

                <div className="stat-icon stat-green">

                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12l3 3 5-6" />
                  </svg>

                </div>

                <div className="stat-info">

                  <span className="stat-value">
                    {stats.completed}
                  </span>

                  <span className="stat-title">
                    Completed
                  </span>

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* ============================== */}
        {/* RECENT PROJECTS */}
        {/* ============================== */}

        <section className="dashboard-section recent-section">

          <div className="dashboard-container">

            <div className="section-heading recent-heading">

              <div>

                <span className="section-label">
                  RECENT ACTIVITY
                </span>

                <h2>
                  Continue Your Work
                </h2>

                <p>
                  Continue from where you stopped.
                </p>

              </div>


              <button
                className="view-all-btn"
                onClick={handleViewProjects}
              >
                View All

                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>

              </button>

            </div>


            {recentProjects.length > 0 ? (

              <div className="recent-project-grid">

                {recentProjects.map((project) => (

                  <div
                    className="recent-project-card"
                    key={project.id}
                  >

                    <img
                      src={project.image}
                      alt={project.title}
                    />

                    <div className="recent-project-info">

                      <h3>
                        {project.title}
                      </h3>

                      <p>
                        {project.stage}
                      </p>

                      <button
                        onClick={() =>
                          navigate(`/projects/${project.id}`)
                        }
                      >
                        Continue
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            ) : (

              <div className="empty-projects">

                <div className="empty-project-icon">

                  <svg
                    width="42"
                    height="42"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
                    <path d="M8.5 11.5l2 2 3-4 3.5 5" />
                    <circle cx="9" cy="8" r="1" />
                  </svg>

                </div>

                <h3>
                  No projects yet
                </h3>

                <p>
                  Start your first drawing project and it
                  will appear here.
                </p>

                <button
                  className="dashboard-primary-btn small"
                  onClick={handleStartDrawing}
                >
                  Start Your First Drawing
                </button>

              </div>

            )}

          </div>

        </section>


        {/* ============================== */}
        {/* HOW IT WORKS */}
        {/* ============================== */}

        <section className="dashboard-section workflow-section">

          <div className="dashboard-container">

            <div className="center-heading">

              <span className="section-label">
                SIMPLE PROCESS
              </span>

              <h2>
                How DrawAI Works
              </h2>

              <p>
                Follow the AI-generated drawing stages from
                your reference image to the final artwork.
              </p>

            </div>


            <div className="workflow-grid">


              {/* Step 1 */}

              <div className="workflow-card">

                <div className="workflow-number">
                  01
                </div>

                <div className="workflow-icon">

                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 16V4" />
                    <path d="M7 9l5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>

                </div>

                <h3>
                  Upload Reference
                </h3>

                <p>
                  Upload the image you want to learn
                  how to draw.
                </p>

              </div>


              {/* Step 2 */}

              <div className="workflow-card">

                <div className="workflow-number">
                  02
                </div>

                <div className="workflow-icon">

                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="8" cy="8" r="4" />
                    <rect
                      x="12"
                      y="12"
                      width="8"
                      height="8"
                      rx="1"
                    />
                  </svg>

                </div>

                <h3>
                  Basic Shapes
                </h3>

                <p>
                  AI identifies simple shapes and
                  structures inside your image.
                </p>

              </div>


              {/* Step 3 */}

              <div className="workflow-card">

                <div className="workflow-number">
                  03
                </div>

                <div className="workflow-icon">

                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 17c4-7 8-7 16 0" />
                    <path d="M4 12c4-7 8-7 16 0" />
                  </svg>

                </div>

                <h3>
                  Curves & Outline
                </h3>

                <p>
                  Refine basic shapes into detailed
                  outlines and curves.
                </p>

              </div>


              {/* Step 4 */}

              <div className="workflow-card">

                <div className="workflow-number">
                  04
                </div>

                <div className="workflow-icon">

                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="M4.93 4.93l1.42 1.42" />
                    <path d="M17.66 17.66l1.41 1.41" />
                  </svg>

                </div>

                <h3>
                  Add Shading
                </h3>

                <p>
                  Learn where highlights, shadows and
                  different tones should appear.
                </p>

              </div>


              {/* Step 5 */}

              <div className="workflow-card">

                <div className="workflow-number">
                  05
                </div>

                <div className="workflow-icon">

                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="9" cy="9" r="1" />
                    <circle cx="15" cy="9" r="1" />
                    <circle cx="9" cy="15" r="1" />
                  </svg>

                </div>

                <h3>
                  Colouring
                </h3>

                <p>
                  Apply suitable colours to complete
                  your artwork.
                </p>

              </div>


              {/* Step 6 */}

              <div className="workflow-card">

                <div className="workflow-number">
                  06
                </div>

                <div className="workflow-icon">

                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M8 12l3 3 5-6" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>

                </div>

                <h3>
                  Final Artwork
                </h3>

                <p>
                  Compare your drawing and complete
                  the final artwork.
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* ============================== */}
        {/* FINAL CTA */}
        {/* ============================== */}

        <section className="dashboard-cta-section">

          <div className="dashboard-container">

            <div className="dashboard-cta">

              <div>

                <span>
                  CREATE WITH DRAWAI
                </span>

                <h2>
                  Ready to create something?
                </h2>

                <p>
                  Upload a reference image and start your
                  step-by-step drawing journey.
                </p>

              </div>

              <button
                onClick={handleStartDrawing}
                className="cta-button"
              >
                Upload Reference Image

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>

              </button>

            </div>

          </div>

        </section>

      </main>

      <Footer />
    </>
  );
};

export default Dashboard;