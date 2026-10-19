import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import '../styles/ViewProject.css';
import { getProject } from '../services/projectService';

import Footer from '../common/Footer';
import Navbar from '../common/Navbar';

import { jsPDF } from 'jspdf';

const SHADING_PREVIEW_COUNT = 8;
const COLOURING_PREVIEW_COUNT = 8;

const getVisibleDetectionPipelines = (detection) =>
  (detection?.pipelines || []).filter((pipeline) => pipeline.type !== 'shapes');

const getVisibleSubjectSteps = (stageType, steps = []) => {
  if (stageType === 'shading') {
    return steps.filter((step) => {
      const image = String(step?.image || '');
      return !image.includes('/04_quantized_shading.png') &&
        !image.includes('/05_stage_1.png');
    });
  }

  if (stageType === 'colouring') {
    const finalSketchSteps = steps.filter((step) =>
      String(step?.image || '').includes('/04_final_coloured_sketch.png')
    );
    const otherSteps = steps.filter((step) =>
      !String(step?.image || '').includes('/04_final_coloured_sketch.png')
    );
    return [...otherSteps, ...finalSketchSteps];
  }

  return steps;
};

const ViewProject = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

    const BACKEND_URL = 'http://localhost:5002';

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeStage, setActiveStage] = useState(1);

  // Stores the image selected for the enlarged preview
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedCurveStep, setSelectedCurveStep] = useState(null);
  const [selectedShadingIndex, setSelectedShadingIndex] = useState(0);
  const [selectedColouringIndex, setSelectedColouringIndex] = useState(0);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [detectionAnalysisImage, setDetectionAnalysisImage] = useState(null);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [selectedDetectionStep, setSelectedDetectionStep] = useState(null);
  const [selectedDetectionCrop, setSelectedDetectionCrop] = useState(null);

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

  useEffect(() => {
    if (!project || !['Waiting', 'Processing'].includes(project.status)) {
      return undefined;
    }

    let active = true;
    const refreshProject = async () => {
      try {
        const response = await getProject(projectId);
        if (active) {
          setProject(response.data);
        }
      } catch (refreshError) {
        console.warn('Could not refresh project status:', refreshError);
      }
    };

    const intervalId = window.setInterval(refreshProject, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [projectId, project?.status]);

  useEffect(() => {
    const fetchDetections = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/outputs/${projectId}/tata_vision_geometry/detections.json?v=${Date.now()}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          setDetectedObjects([]);
          setDetectionAnalysisImage(null);
          return;
        }

        const data = await response.json();
        const detections = Array.isArray(data.detections) ? data.detections : [];
        setDetectedObjects(detections);
        setSelectedDetection((current) => {
          if (!current) return null;
          return detections.find((detection) => detection.id === current.id) || current;
        });
        setDetectionAnalysisImage(data.analysis_image || null);
      } catch (detectionError) {
        console.warn('Detected-object metadata is not available:', detectionError);
        setDetectedObjects([]);
        setDetectionAnalysisImage(null);
      }
    };

    fetchDetections();

    const shouldPoll =
      !project || ['Waiting', 'Processing'].includes(project.status);
    if (!shouldPoll) {
      return undefined;
    }

    const intervalId = window.setInterval(fetchDetections, 5000);
    return () => window.clearInterval(intervalId);
  }, [projectId, project?.status]);

  // Close lightbox using Escape key
  // Also prevent page scrolling while the lightbox is open
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedStage(null);
        setSelectedDetectionCrop(null);
      }

      if (selectedStage?.id === 2 && event.key === 'ArrowLeft') {
        setSelectedShadingIndex((current) =>
          (current - 1 + SHADING_PREVIEW_COUNT) % SHADING_PREVIEW_COUNT
        );
      }

      if (selectedStage?.id === 2 && event.key === 'ArrowRight') {
        setSelectedShadingIndex((current) =>
          (current + 1) % SHADING_PREVIEW_COUNT
        );
      }

      if (selectedStage?.id === 3 && event.key === 'ArrowLeft') {
        setSelectedColouringIndex((current) =>
          (current - 1 + COLOURING_PREVIEW_COUNT) % COLOURING_PREVIEW_COUNT
        );
      }

      if (selectedStage?.id === 3 && event.key === 'ArrowRight') {
        setSelectedColouringIndex((current) =>
          (current + 1) % COLOURING_PREVIEW_COUNT
        );
      }
    };

    if (selectedStage || selectedDetectionCrop) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedStage, selectedDetectionCrop]);

  useEffect(() => {
    if (!selectedDetection) {
      setSelectedDetectionStep(null);
      return;
    }

    const firstPipeline = getVisibleDetectionPipelines(selectedDetection)[0];
    const firstStep = firstPipeline?.steps?.[0];
    setSelectedDetectionStep(
      firstStep
        ? {
            ...firstStep,
            pipelineType: firstPipeline.type,
            pipelineTitle: firstPipeline.title,
          }
        : null
    );
  }, [selectedDetection]);

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

  const loadImageForPDF = async (imageUrl) => {

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      `Could not load image: ${imageUrl}`
    );
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onloadend = () => {
      resolve(reader.result);
    };

    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });
};

const handleDownload = async () => {

  try {

    const stages = [
      {
        title: '1. Image Analysis',
        image: project.geometric_image
          ? `${BACKEND_URL}${project.geometric_image}`
          : null
      },
      {
        title: '2. Curve Extraction',
        image: project.curve_image
          ? `${BACKEND_URL}${project.curve_image}`
          : null
      },
      {
        title: '3. Pencil Shading',
        image: project.shading_image
          ? `${BACKEND_URL}${project.shading_image}`
          : null
      },
      {
        title: '4. Number & Colour Guide',
        image: project.colouring_image
          ? `${BACKEND_URL}${project.colouring_image}`
          : null
      }
    ];


    // Check all 4 images exist
    const missingStage = stages.find(
      (stage) => !stage.image
    );

    if (missingStage) {
      alert(
        'All four drawing stages must be generated before downloading.'
      );
      return;
    }


    // A4 portrait
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });


    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();


    for (
      let index = 0;
      index < stages.length;
      index++
    ) {

      const stage = stages[index];


      // Add another page after first image
      if (index > 0) {
        pdf.addPage();
      }


      // ==========================================
      // PROJECT TITLE
      // ==========================================

      pdf.setFontSize(16);

      pdf.text(
        project.title || 'Drawing Guide',
        pageWidth / 2,
        15,
        {
          align: 'center'
        }
      );


      // ==========================================
      // STAGE TITLE
      // ==========================================

      pdf.setFontSize(13);

      pdf.text(
        stage.title,
        pageWidth / 2,
        25,
        {
          align: 'center'
        }
      );


      // ==========================================
      // LOAD IMAGE
      // ==========================================

      const imageData =
        await loadImageForPDF(
          stage.image
        );


      // ==========================================
      // GET IMAGE DIMENSIONS
      // ==========================================

      const imageProperties =
        pdf.getImageProperties(
          imageData
        );


      const maxWidth =
        pageWidth - 20;

      const maxHeight =
        pageHeight - 50;


      const widthRatio =
        maxWidth /
        imageProperties.width;

      const heightRatio =
        maxHeight /
        imageProperties.height;


      const ratio = Math.min(
        widthRatio,
        heightRatio
      );


      const imageWidth =
        imageProperties.width *
        ratio;

      const imageHeight =
        imageProperties.height *
        ratio;


      // Center image
      const imageX =
        (
          pageWidth -
          imageWidth
        ) / 2;

      const imageY = 35;


      // ==========================================
      // ADD IMAGE
      // ==========================================

      pdf.addImage(
        imageData,
        'PNG',
        imageX,
        imageY,
        imageWidth,
        imageHeight
      );


      // ==========================================
      // PAGE NUMBER
      // ==========================================

      pdf.setFontSize(9);

      pdf.text(
        `Stage ${index + 1} of 4`,
        pageWidth / 2,
        pageHeight - 7,
        {
          align: 'center'
        }
      );
    }


    // ==========================================
    // SAFE FILE NAME
    // ==========================================

    const safeProjectTitle = (
      project.title ||
      `project-${projectId}`
    )
      .replace(
        /[^a-z0-9]/gi,
        '_'
      )
      .toLowerCase();


    // ==========================================
    // DOWNLOAD PDF
    // ==========================================

    pdf.save(
      `${safeProjectTitle}_drawing_guide.pdf`
    );


  } catch (error) {

    console.error(
      'PDF generation error:',
      error
    );

    alert(
      'Could not generate PDF. Please try again.'
    );
  }
};

      const handleDownloadZip = async () => {
      try {
        console.log('Starting ZIP download...');

        const stages = [
          {
            filename: '01_image_analysis.png',
            url: project.geometric_image
              ? `${BACKEND_URL}${project.geometric_image}`
              : null,
          },
          {
            filename: '02_curve_extraction.png',
            url: project.curve_image
              ? `${BACKEND_URL}${project.curve_image}`
              : null,
          },
          {
            filename: '03_pencil_shading.png',
            url: project.shading_image
              ? `${BACKEND_URL}${project.shading_image}`
              : null,
          },
          {
            filename: '04_number_colour_guide.png',
            url: project.colouring_image
              ? `${BACKEND_URL}${project.colouring_image}`
              : null,
          },
        ];

        console.log('ZIP stages:', stages);

        const missingStage = stages.find(
          (stage) => !stage.url
        );

        if (missingStage) {
          alert(
            'All four drawing stages must be generated before downloading.'
          );
          return;
        }

        const zip = new JSZip();

        // Download each generated image
        for (const stage of stages) {
          console.log(
            'Fetching:',
            stage.url
          );

          const response = await fetch(
            stage.url
          );

          console.log(
            stage.filename,
            'status:',
            response.status
          );

          if (!response.ok) {
            throw new Error(
              `Failed to fetch ${stage.filename}. HTTP ${response.status}`
            );
          }

          const imageBlob =
            await response.blob();

          console.log(
            'Downloaded:',
            stage.filename,
            imageBlob.size,
            'bytes'
          );

          zip.file(
            stage.filename,
            imageBlob
          );
        }

        console.log(
          'All 4 images added to ZIP.'
        );

        // Create ZIP
        const zipBlob =
          await zip.generateAsync({
            type: 'blob',
          });

        // Safe project name
        const safeProjectTitle = (
          project.title ||
          `project_${projectId}`
        )
          .replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
          );

        // Create temporary browser URL
        const downloadUrl =
          URL.createObjectURL(
            zipBlob
          );

        // Create temporary download link
        const link =
          document.createElement('a');

        link.href =
          downloadUrl;

        link.download =
          `${safeProjectTitle}_drawing_stages.zip`;

        document.body.appendChild(
          link
        );

        link.click();

        document.body.removeChild(
          link
        );

        URL.revokeObjectURL(
          downloadUrl
        );

        console.log(
          'ZIP downloaded successfully.'
        );

      } catch (error) {
        console.error(
          'ZIP DOWNLOAD ERROR:',
          error
        );

        alert(
          `Could not create ZIP file.\n\n${error.message}`
        );
      }
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
    if (stage.id === 1) {
      setSelectedCurveStep(null);
    }
    if (stage.id === 2) {
      setSelectedShadingIndex(0);
    }
    if (stage.id === 3) {
      setSelectedColouringIndex(0);
    }
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
          { id: 1, name: 'Image Analysis' },
          { id: 2, name: 'Curves' },
          { id: 3, name: 'Shading' },
          { id: 4, name: 'Colouring Guide' },
      ];

  // Temporary images until real AI output is connected.
  // These URLs use larger images so they do not become too blurry
  // when shown inside the enlarged preview.
 //const BACKEND_URL = 'http://localhost:5002';

  const curvePreviews = [
    ['Main Structure', 'curve_step1_main.png'],
    ['Major Curves', 'curve_step2_major.png'],
    ['Important Features', 'curve_step3_features.png'],
    ['Details', 'curve_step4_details.png'],
    ['Complete Curves', 'curve_step5_final.png'],
  ].map(([title, filename]) => ({
    title,
    image: BACKEND_URL + '/outputs/' + projectId + '/curve_steps/' + filename + '?v=2',
  }));

  const shadingPreviews = [
      ['Luminance Baseline', '01_luminance.png'],
      ['Relative Depth', '02_relative_depth.png'],
      ['Fused Shading', '03_fused_shading.png'],
      ['Shading Stage 2', '05_stage_2.png'],
      ['Shading Stage 3', '05_stage_3.png'],
      ['Shading Stage 4', '05_stage_4.png'],
      ['Shading Stage 5', '05_stage_5.png'],
      ['Final Pencil Hatching', '06_hatched_shading.png'],
  ].map(([title, filename]) => ({
      title,
      image: BACKEND_URL + '/outputs/' + projectId + '/shading_steps/' + filename,
  }));

  const showPreviousShading = () => {
    setSelectedShadingIndex((current) =>
      (current - 1 + shadingPreviews.length) % shadingPreviews.length
    );
  };

  const showNextShading = () => {
    setSelectedShadingIndex((current) =>
      (current + 1) % shadingPreviews.length
    );
  };

  const colouringPreviews = [
      {
        title: 'Number & Colour Guide',
        image: project.colouring_image
          ? BACKEND_URL + project.colouring_image
          : BACKEND_URL + '/outputs/' + projectId + '/colouring.png',
      },
      ...[
        ['Colour Stage 1', '05_colour_stage_1.png'],
        ['Colour Stage 2', '05_colour_stage_2.png'],
        ['Colour Stage 3', '05_colour_stage_3.png'],
        ['Colour Stage 4', '05_colour_stage_4.png'],
        ['Colour Stage 5', '05_colour_stage_5.png'],
        ['Realistic Painted Result', '06_realistic_paprika_painting.png'],
        ['Final Coloured Sketch', '04_final_coloured_sketch.png'],
      ].map(([title, filename]) => ({
        title,
        image: BACKEND_URL + '/outputs/' + projectId + '/colouring_steps/' + filename,
      })),
  ];

  const showPreviousColouring = () => {
    setSelectedColouringIndex((current) =>
      (current - 1 + colouringPreviews.length) % colouringPreviews.length
    );
  };

  const showNextColouring = () => {
    setSelectedColouringIndex((current) =>
      (current + 1) % colouringPreviews.length
    );
  };


  const drawingStages = [
      {
          id: 1,
          name: 'Curve Extraction',
          description: 'Refined curves and contour lines extracted from the image.',
          image: `${BACKEND_URL}${project.curve_image || `/outputs/${projectId}/curves.png`}?v=2`,
      },

      {
          id: 2,
          name: 'Pencil Shading',
          description: 'Pencil shading generated using reference-image light and shadow.',
          image: `${BACKEND_URL}${project.shading_image || `/outputs/${projectId}/shading.png`}?v=2`,
      },

      {
          id: 3,
          name: 'Number & Colour Guide',
          description: 'Paint-by-number guide with corresponding reference colours.',
          image: `${BACKEND_URL}${project.colouring_image || `/outputs/${projectId}/colouring.png`}?v=2`,
      },
  ];

  const getDetectionImageUrl = (detection) =>
    `${BACKEND_URL}/outputs/${projectId}/tata_vision_geometry/${detection.image}?v=1`;

  const getDetectionStepUrl = (step) =>
    `${BACKEND_URL}/outputs/${projectId}/tata_vision_geometry/${step.image}?v=1`;

  const getDetectionPipelineLabel = (type) => {
    if (type === 'body') return 'Human body steps';
    if (type === 'face') return 'Human face steps';
    if (type === 'curves') return 'Curves steps';
    if (type === 'shading') return 'Shading steps';
    if (type === 'colouring') return 'Colouring steps';
    return 'Object construction steps';
  };

  const detectionOverviewUrl = detectionAnalysisImage
    ? `${BACKEND_URL}/outputs/${projectId}/tata_vision_geometry/${detectionAnalysisImage}?v=1`
    : null;

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

          {detectedObjects.length > 0 && (
            <section className="section-block detected-objects-section">
              <div className="detected-objects-heading">
                <div>
                  <h3 className="section-title">Detected Objects</h3>
                  <p className="detected-objects-description">
                    Analysis found {detectedObjects.length} object{detectedObjects.length === 1 ? '' : 's'}. Click one to view it separately.
                  </p>
                </div>
                {detectionOverviewUrl && (
                  <img
                    src={detectionOverviewUrl}
                    alt="Detected objects marked in the uploaded image"
                    className="detection-overview-image"
                    loading="lazy"
                  />
                )}
              </div>

              <div className="detected-objects-grid">
                {detectedObjects.map((detection) => (
                  <button
                    type="button"
                    className="detected-object-card"
                    key={`${detection.id}-${detection.image}`}
                    onClick={() => setSelectedDetection(detection)}
                    aria-label={`Open detected ${detection.label}`}
                  >
                    <img
                      src={getDetectionImageUrl(detection)}
                      alt={`Detected ${detection.label}`}
                      loading="lazy"
                    />
                    <span className="detected-object-card-title">
                      {detection.label} {detection.category === 'human' ? detection.id : ''}
                    </span>
                    <span className="detected-object-card-meta">
                      {detection.category} · {Math.round(detection.confidence * 100)}% confidence
                    </span>
                  </button>
                ))}
              </div>

              {selectedDetection && (
                <div className="selected-detection-steps">
                  <div className="selected-detection-heading">
                    <div>
                      <h4>
                        {selectedDetection.label} {selectedDetection.category === 'human' ? selectedDetection.id : ''} — drawing steps
                      </h4>
                      <p>
                        Only this detected subject's pipeline is shown below.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="view-detection-crop-button"
                      onClick={() => setSelectedDetectionCrop(selectedDetection)}
                    >
                      View isolated crop
                    </button>
                  </div>

                  {getVisibleDetectionPipelines(selectedDetection).length > 0 ? (
                    getVisibleDetectionPipelines(selectedDetection).map((pipeline) => (
                      <div className="detection-pipeline-group" key={`${selectedDetection.id}-${pipeline.type}`}>
                        <h5>{getDetectionPipelineLabel(pipeline.type)}</h5>
                        <div className="detection-steps-grid">
                          {pipeline.steps.map((step) => {
                            const stepSelectionKey = `${pipeline.type}-${step.image}`;
                            const selectedKey = selectedDetectionStep
                              ? `${selectedDetectionStep.pipelineType}-${selectedDetectionStep.image}`
                              : '';

                            return (
                              <button
                                type="button"
                                className={`detection-step-card ${selectedKey === stepSelectionKey ? 'active' : ''}`}
                                key={stepSelectionKey}
                                onClick={() => setSelectedDetectionStep({
                                  ...step,
                                  pipelineType: pipeline.type,
                                  pipelineTitle: pipeline.title,
                                })}
                              >
                                <img
                                  src={getDetectionStepUrl(step)}
                                  alt={`${selectedDetection.label} ${step.title}`}
                                  loading="lazy"
                                />
                                <span>{step.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="detection-steps-empty">
                      Subject-specific drawing steps are not available yet. The analysis may still be processing.
                    </p>
                  )}

                  {['curves', 'shading', 'colouring'].map((stageType) => {
                    const stageOutput = selectedDetection.subject_outputs?.[stageType];
                    if (!stageOutput) return null;

                    return (
                      <div className="detection-pipeline-group" key={`${selectedDetection.id}-${stageType}`}>
                        <h5>{getDetectionPipelineLabel(stageType)}</h5>
                        <div className="detection-steps-grid">
                          {getVisibleSubjectSteps(stageType, stageOutput.steps).map((step) => {
                            const stepSelectionKey = `${stageType}-${step.image}`;
                            const selectedKey = selectedDetectionStep
                              ? `${selectedDetectionStep.pipelineType}-${selectedDetectionStep.image}`
                              : '';

                            return (
                              <button
                                type="button"
                                className={`detection-step-card ${selectedKey === stepSelectionKey ? 'active' : ''}`}
                                key={stepSelectionKey}
                                onClick={() => setSelectedDetectionStep({
                                  ...step,
                                  pipelineType: stageType,
                                  pipelineTitle: getDetectionPipelineLabel(stageType),
                                })}
                              >
                                <img
                                  src={getDetectionStepUrl(step)}
                                  alt={`${selectedDetection.label} ${step.title}`}
                                  loading="lazy"
                                />
                                <span>{step.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {selectedDetectionStep && (
                    <div className="selected-detection-step-preview">
                      <img
                        src={getDetectionStepUrl(selectedDetectionStep)}
                        alt={`${selectedDetection.label} ${selectedDetectionStep.title}`}
                      />
                      <div>
                        <strong>{selectedDetectionStep.title}</strong>
                        <span>{selectedDetectionStep.pipelineTitle}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Final Artwork Bar */}
          {project.status === 'Completed' && (
            <div className="final-artwork-bar">
              <div>
                <h4>Final Artwork</h4>
                <p>Your completed piece is ready to download</p>
              </div>

              <button
                type="button"
                className="btn-outline"
                onClick={handleDownloadZip}
              >
                Download as ZIP
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

            {selectedStage.id === 1 ? (
              <div className="shading-gallery static-steps-gallery curve-gallery">
                <div className="shading-main-preview">
                  <img
                    src={selectedCurveStep?.image || selectedStage.image}
                    alt={selectedCurveStep?.title || selectedStage.name}
                    className="shading-main-image"
                  />
                  <div className="shading-main-label">
                    <strong>{selectedCurveStep?.title || selectedStage.name}</strong>
                    <span>{selectedCurveStep ? 'Curve step' : 'Main result'}</span>
                  </div>
                </div>

                <div className="shading-preview-grid" aria-label="Progressive curve extraction stages">
                  {curvePreviews.map((preview) => (
                    <button
                      type="button"
                      className={'shading-preview-card ' + (selectedCurveStep?.image === preview.image ? 'active' : '')}
                      key={preview.image}
                      onClick={() => setSelectedCurveStep(preview)}
                      aria-label={'Show ' + preview.title}
                      aria-pressed={selectedCurveStep?.image === preview.image}
                    >
                      <img src={preview.image} alt={preview.title} loading="lazy" />
                      <span>{preview.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : selectedStage.id === 2 ? (
              <div className="shading-gallery">
                <div className="shading-main-preview">
                  <button type="button" className="shading-gallery-arrow shading-gallery-arrow-previous" onClick={showPreviousShading} aria-label="Show previous shading image">
                    &#8249;
                  </button>
                  <img src={shadingPreviews[selectedShadingIndex].image} alt={shadingPreviews[selectedShadingIndex].title} className="shading-main-image" />
                  <button type="button" className="shading-gallery-arrow shading-gallery-arrow-next" onClick={showNextShading} aria-label="Show next shading image">
                    &#8250;
                  </button>
                  <div className="shading-main-label" aria-live="polite">
                    <strong>{shadingPreviews[selectedShadingIndex].title}</strong>
                    <span>{selectedShadingIndex + 1} / {shadingPreviews.length}</span>
                  </div>
                </div>

                <div className="shading-preview-grid" aria-label="Shading image variations">
                  {shadingPreviews.map((preview, index) => (
                    <button type="button" className={'shading-preview-card ' + (selectedShadingIndex === index ? 'active' : '')} key={preview.image} onClick={() => setSelectedShadingIndex(index)} aria-label={'Show ' + preview.title} aria-pressed={selectedShadingIndex === index}>
                      <img src={preview.image} alt="" loading="lazy" />
                      <span>{preview.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : selectedStage.id === 3 ? (
              <div className="shading-gallery colouring-gallery">
                <div className="shading-main-preview">
                  <button type="button" className="shading-gallery-arrow shading-gallery-arrow-previous" onClick={showPreviousColouring} aria-label="Show previous colouring image">
                    &#8249;
                  </button>
                  <img src={colouringPreviews[selectedColouringIndex].image} alt={colouringPreviews[selectedColouringIndex].title} className="shading-main-image" />
                  <button type="button" className="shading-gallery-arrow shading-gallery-arrow-next" onClick={showNextColouring} aria-label="Show next colouring image">
                    &#8250;
                  </button>
                  <div className="shading-main-label" aria-live="polite">
                    <strong>{colouringPreviews[selectedColouringIndex].title}</strong>
                    <span>{selectedColouringIndex + 1} / {colouringPreviews.length}</span>
                  </div>
                </div>

                <div className="shading-preview-grid" aria-label="Colouring image stages">
                  {colouringPreviews.map((preview, index) => (
                    <button type="button" className={'shading-preview-card ' + (selectedColouringIndex === index ? 'active' : '')} key={preview.image} onClick={() => setSelectedColouringIndex(index)} aria-label={'Show ' + preview.title} aria-pressed={selectedColouringIndex === index}>
                      <img src={preview.image} alt="" loading="lazy" />
                      <span>{preview.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="image-lightbox-image-wrapper">
                <img
                  src={selectedStage.image}
                  alt={selectedStage.name}
                  className="image-lightbox-image"
                />
              </div>
            )}

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

      {selectedDetectionCrop && (
        <div
          className="image-lightbox detection-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Detected ${selectedDetectionCrop.label} enlarged preview`}
          onClick={() => setSelectedDetectionCrop(null)}
        >
          <div
            className="image-lightbox-content detection-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-lightbox-close"
              onClick={() => setSelectedDetectionCrop(null)}
              aria-label="Close detected object preview"
            >
              &times;
            </button>

            <div className="detected-object-popup">
              <img
                src={getDetectionImageUrl(selectedDetectionCrop)}
                alt={`Detected ${selectedDetectionCrop.label}`}
                className="detected-object-popup-image"
              />
              <div className="detected-object-popup-caption">
                <strong>
                  {selectedDetectionCrop.label} {selectedDetectionCrop.category === 'human' ? selectedDetectionCrop.id : ''}
                </strong>
                <span>
                  {selectedDetectionCrop.category} · {Math.round(selectedDetectionCrop.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default ViewProject;
