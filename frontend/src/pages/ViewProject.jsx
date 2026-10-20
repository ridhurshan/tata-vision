import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import '../styles/ViewProject.css';
import { getProject, updateProject } from '../services/projectService';

import Footer from '../common/Footer';
import Navbar from '../common/Navbar';

import { jsPDF } from 'jspdf';

const SHADING_PREVIEW_COUNT = 8;
const COLOURING_PREVIEW_COUNT = 8;

const getVisibleDetectionPipelines = (detection) =>
  detection?.pipelines || [];

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
  const [processingProgress, setProcessingProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stores the image selected for the enlarged preview
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedCurveStep, setSelectedCurveStep] = useState(null);
  const [selectedShadingIndex, setSelectedShadingIndex] = useState(0);
  const [selectedColouringIndex, setSelectedColouringIndex] = useState(0);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [detectionAnalysisImage, setDetectionAnalysisImage] = useState(null);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [selectedDetectionStep, setSelectedDetectionStep] = useState(null);
  const [selectedDetectionStepLightbox, setSelectedDetectionStepLightbox] = useState(null);
  const [selectedFallbackStepLightbox, setSelectedFallbackStepLightbox] = useState(null);
  const [selectedDetectionCrop, setSelectedDetectionCrop] = useState(null);
  const [isEditingProjectDetails, setIsEditingProjectDetails] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState('');
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState('');
  const [isSavingProjectDetails, setIsSavingProjectDetails] = useState(false);
  const projectStatus = project?.status;

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
    let active = true;

    const fetchProcessingProgress = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/outputs/${projectId}/progress.json?v=${Date.now()}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          if (active) setProcessingProgress(null);
          return;
        }

        const progress = await response.json();
        if (active) setProcessingProgress(progress);
    } catch {
        // Older projects may not have a progress manifest yet.
        if (active) setProcessingProgress(null);
      }
    };

    fetchProcessingProgress();

    const shouldPoll =
      !projectStatus || ['Waiting', 'Processing'].includes(projectStatus);
    if (!shouldPoll) {
      return () => {
        active = false;
      };
    }

    const intervalId = window.setInterval(fetchProcessingProgress, 2000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [projectId, projectStatus]);

  useEffect(() => {
    if (!projectStatus || !['Waiting', 'Processing'].includes(projectStatus)) {
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
  }, [projectId, projectStatus]);

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
      !projectStatus || ['Waiting', 'Processing'].includes(projectStatus);
    if (!shouldPoll) {
      return undefined;
    }

    const intervalId = window.setInterval(fetchDetections, 5000);
    return () => window.clearInterval(intervalId);
  }, [projectId, projectStatus]);

  // Close lightbox using Escape key
  // Also prevent page scrolling while the lightbox is open
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedStage(null);
        setSelectedDetectionStepLightbox(null);
        setSelectedFallbackStepLightbox(null);
        setSelectedDetectionCrop(null);
      }

      if (selectedDetectionStepLightbox && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        navigateDetectionStep(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }

      if (selectedFallbackStepLightbox && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        navigateFallbackStep(event.key === 'ArrowLeft' ? -1 : 1);
        return;
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

    if (
      selectedStage ||
      selectedDetectionStepLightbox ||
      selectedFallbackStepLightbox ||
      selectedDetectionCrop
    ) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  // The navigation helper intentionally stays out of the dependency list because it
  // is recreated with the current selected-step state on each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, selectedDetectionStepLightbox, selectedFallbackStepLightbox, selectedDetectionCrop]);

  useEffect(() => {
    if (!selectedDetection) {
      setSelectedDetectionStep(null);
      setSelectedDetectionStepLightbox(null);
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

  const defaultProjectTitle = `Project - ${String(projectId).padStart(2, '0')}`;
  const getProjectTitle = () => String(project?.title || '').trim() || defaultProjectTitle;
  const safeFileName = () => getProjectTitle()
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  const loadImageForPDF = async (imageUrl) => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Could not load image: ${imageUrl}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const fetchImageBlob = async (imageUrl) => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Could not load image: ${imageUrl}`);
    }
    return response.blob();
  };

  const getPdfImageFormat = (imageData) =>
    String(imageData).startsWith('data:image/jpeg') ||
    String(imageData).startsWith('data:image/jpg')
      ? 'JPEG'
      : 'PNG';

  const drawWhitePage = (pdf) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addContainedPdfImage = async (pdf, imageUrl, x, y, width, height) => {
    try {
      const imageData = await loadImageForPDF(imageUrl);
      const properties = pdf.getImageProperties(imageData);
      const ratio = Math.min(width / properties.width, height / properties.height);
      const imageWidth = properties.width * ratio;
      const imageHeight = properties.height * ratio;
      pdf.addImage(
        imageData,
        getPdfImageFormat(imageData),
        x + (width - imageWidth) / 2,
        y + (height - imageHeight) / 2,
        imageWidth,
        imageHeight
      );
      return true;
    } catch (imageError) {
      console.warn('Could not add export image:', imageUrl, imageError);
      pdf.setTextColor(120, 113, 104);
      pdf.setFont('times', 'italic');
      pdf.setFontSize(8);
      pdf.text('Preview unavailable', x + width / 2, y + height / 2, { align: 'center' });
      return false;
    }
  };

  const resolveExportImageUrl = (image, subjectSpecific = false) => {
    if (!image) return null;
    if (String(image).startsWith('http')) return image;
    if (String(image).startsWith('/')) return `${BACKEND_URL}${image}`;
    return `${BACKEND_URL}/outputs/${projectId}/${subjectSpecific ? 'tata_vision_geometry/' : ''}${image}`;
  };

  const getPdfSections = () => {
    const sectionLabels = {
      body: 'Human body steps',
      face: 'Human face steps',
      shapes: 'Geometric construction steps',
      creature: 'Object construction steps',
      curves: 'Curves steps',
      shading: 'Shading steps',
      colouring: 'Colouring steps',
    };
    const orderedTypes = ['body', 'face', 'shapes', 'creature', 'curves', 'shading', 'colouring'];

    if (detectedObjects.length > 0) {
      const orderedDetections = [...detectedObjects].sort(
        (first, second) => Number(first.id || 0) - Number(second.id || 0)
      );

      return orderedDetections.flatMap((detection) => {
        const pipelines = getVisibleDetectionPipelines(detection);
        return orderedTypes.flatMap((type) => {
          const pipeline = pipelines.find((item) => item.type === type);
          const sourceSteps = pipeline?.steps || detection.subject_outputs?.[type]?.steps || [];
          const steps = getVisibleSubjectSteps(type, sourceSteps);
          if (steps.length === 0) return [];

          const personLabel = detection.category === 'human'
            ? `Person ${detection.id}`
            : `${detection.label || 'Object'} ${detection.id}`;

          return [{
            title: sectionLabels[type],
            subtitle: `${personLabel} · ${pipeline?.title || sectionLabels[type]}`,
            steps: steps.map((step) => ({
              title: step.title,
              image: resolveExportImageUrl(step.image, true),
            })),
          }];
        });
      });
    }

    return fallbackStepPipelines.map((pipeline) => ({
      title: pipeline.type === 'geometric' ? 'Geometric construction steps' : sectionLabels[pipeline.type],
      subtitle: 'Full-image drawing pipeline',
      steps: pipeline.steps.map((step) => ({
        title: step.title,
        image: resolveExportImageUrl(step.image),
      })),
    }));
  };

  const drawPdfSection = async (pdf, section) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = 27;
    const gap = 5;
    const columns = 2;
    const cardWidth = (pageWidth - marginLeft - 15 - gap) / columns;
    const rows = Math.ceil(section.steps.length / columns);
    const top = 43;
    const bottom = 13;
    const cardGap = 5;
    const cardHeight = Math.min(54, (pageHeight - top - bottom - cardGap * (rows - 1)) / rows);

    pdf.setTextColor(38, 48, 53);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(20);
    pdf.text(section.title, marginLeft, 28);
    pdf.setFont('times', 'italic');
    pdf.setFontSize(9);
    pdf.text(section.subtitle, marginLeft, 35);

    for (let index = 0; index < section.steps.length; index += 1) {
      const step = section.steps[index];
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = marginLeft + column * (cardWidth + gap);
      const y = top + row * (cardHeight + cardGap);

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(210, 214, 220);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

      const labelHeight = Math.min(12, cardHeight * 0.25);
      await addContainedPdfImage(
        pdf,
        step.image,
        x + 5,
        y + 4,
        cardWidth - 10,
        cardHeight - labelHeight - 7
      );

      pdf.setTextColor(56, 54, 49);
      pdf.setFont('times', 'normal');
      pdf.setFontSize(8);
      const label = `${index + 1}. ${step.title}`;
      const labelLines = pdf.splitTextToSize(label, cardWidth - 10);
      pdf.text(labelLines.slice(0, 2), x + 5, y + cardHeight - 5);
    }
  };

  const handleDownload = async () => {
    try {
      const sections = getPdfSections();
      if (sections.length === 0) {
        alert('No drawing steps are available yet.');
        return;
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const title = getProjectTitle();

      drawWhitePage(pdf);
      pdf.setTextColor(39, 48, 51);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(31);
      pdf.text('TATA VISION', pageWidth / 2, 43, { align: 'center' });
      pdf.setFont('times', 'italic');
      pdf.setFontSize(13);
      pdf.text('AI drawing practice workbook', pageWidth / 2, 52, { align: 'center' });
      pdf.setFont('times', 'bold');
      pdf.setFontSize(22);
      pdf.text(title, pageWidth / 2, 70, { align: 'center' });

      if (project.description) {
        pdf.setFont('times', 'normal');
        pdf.setFontSize(11);
        const descriptionLines = pdf.splitTextToSize(project.description, pageWidth - 55);
        pdf.text(descriptionLines.slice(0, 4), pageWidth / 2, 81, { align: 'center' });
      }

      pdf.setFont('times', 'normal');
      pdf.setFontSize(10);
      pdf.text('Reference image', pageWidth / 2, 104, { align: 'center' });
      await addContainedPdfImage(
        pdf,
        resolveExportImageUrl(project.input_image),
        37,
        112,
        pageWidth - 57,
        pageHeight - 139
      );

      for (let index = 0; index < sections.length; index += 1) {
        pdf.addPage();
        drawWhitePage(pdf);
        await drawPdfSection(pdf, sections[index]);
      }

      pdf.save(`${safeFileName()}_drawing_workbook.pdf`);
    } catch (downloadError) {
      console.error('PDF generation error:', downloadError);
      alert('Could not generate the drawing workbook PDF. Please try again.');
    }
  };

  const handleDownloadZip = async () => {
    try {
      const sections = getPdfSections();
      if (sections.length === 0) {
        alert('No drawing steps are available yet.');
        return;
      }

      const zip = new JSZip();
      const info = [
        'TATA VISION — AI drawing practice workbook',
        `Project: ${getProjectTitle()}`,
        `Description: ${project.description || 'Not provided'}`,
        '',
        'Order: reference image, then each detected subject in geometry, curves, shading, colouring order.'
      ].join('\n');
      zip.file('00_project_info.txt', info);

      if (project.input_image) {
        const referenceUrl = resolveExportImageUrl(project.input_image);
        const referenceBlob = await fetchImageBlob(referenceUrl);
        const extension = referenceBlob.type.includes('png') ? 'png' : 'jpg';
        zip.file(`01_reference_image.${extension}`, referenceBlob);
      }

      let folderNumber = 2;
      for (const section of sections) {
        const folderName = `${String(folderNumber).padStart(2, '0')}_${section.title
          .replace(/[^a-z0-9]+/gi, '_')
          .toLowerCase()}`;
        for (let stepIndex = 0; stepIndex < section.steps.length; stepIndex += 1) {
          const step = section.steps[stepIndex];
          const imageBlob = await fetchImageBlob(step.image);
          const extension = imageBlob.type.includes('jpeg') || imageBlob.type.includes('jpg') ? 'jpg' : 'png';
          zip.file(
            `${folderName}/${String(stepIndex + 1).padStart(2, '0')}_${step.title
              .replace(/[^a-z0-9]+/gi, '_')
              .toLowerCase()}.${extension}`,
            imageBlob
          );
        }
        folderNumber += 1;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${safeFileName()}_drawing_workbook.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      console.error('ZIP download error:', downloadError);
      alert(`Could not create the drawing workbook ZIP.\n\n${downloadError.message}`);
    }
  };

  const beginProjectDetailsEdit = () => {
    setProjectTitleDraft(getProjectTitle());
    setProjectDescriptionDraft(project.description || '');
    setIsEditingProjectDetails(true);
  };

  const cancelProjectDetailsEdit = () => {
    setIsEditingProjectDetails(false);
    setProjectTitleDraft('');
    setProjectDescriptionDraft('');
  };

  const saveProjectDetails = async () => {
    setIsSavingProjectDetails(true);
    try {
      const title = projectTitleDraft.trim() || defaultProjectTitle;
      const description = projectDescriptionDraft.trim();
      await updateProject(projectId, { title, description });
      setProject((current) => ({ ...current, title, description }));
      setIsEditingProjectDetails(false);
    } catch (saveError) {
      console.error('Could not save project details:', saveError);
      alert('Could not save the project details. Please try again.');
    } finally {
      setIsSavingProjectDetails(false);
    }
  };

  const handleUploadAnother = () => {
    navigate('/upload');
  };

  const closeLightbox = () => {
    setSelectedStage(null);
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

  const processingStages = [
    { id: 1, key: 'preprocessing', name: 'Preparing image' },
    { id: 2, key: 'geometry', name: 'Image analysis' },
    { id: 3, key: 'curves', name: 'Curves' },
    { id: 4, key: 'shading', name: 'Shading' },
    { id: 5, key: 'colouring', name: 'Colouring guide' },
  ];

  const progressPercent =
    project.status === 'Completed'
      ? 100
      : Number.isFinite(Number(processingProgress?.percent))
        ? Number(processingProgress.percent)
        : project.status === 'Failed'
          ? 0
          : 0;
  const completedStages = new Set(
    processingProgress?.completed_stages ||
      (project.status === 'Completed'
        ? processingStages.map((stage) => stage.key)
        : [])
  );
  const applicableStages = new Set(
    processingProgress?.applicable_stages || processingStages.map((stage) => stage.key)
  );
  const currentStageKey = processingProgress?.stage;
  const progressMessage =
    processingProgress?.message ||
    (project.status === 'Completed'
      ? 'All drawing pipeline stages completed.'
      : project.status === 'Failed'
        ? 'The drawing pipeline could not be completed.'
        : 'Preparing the drawing pipeline.');

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


  // An unidentified upload follows only the geometric.py fallback. Curves,
  // shading, and colouring are reserved for identified subjects below.
  const fallbackStepPipelines = [
    {
      type: 'geometric',
      title: 'Geometric construction steps',
      folder: 'geometric_steps',
      steps: [
        ['Object analysis', '01_extraction.png'],
        ['Background removed', '02_background_removed.png'],
        ['Parts isolated', '03_parts_isolated.png'],
        ['Final geometric shapes', '04_final_parts.png'],
      ],
    },
  ].map((pipeline) => ({
    ...pipeline,
    steps: pipeline.steps.map(([title, filename]) => ({
      title,
      image: `${BACKEND_URL}/outputs/${projectId}/${pipeline.folder}/${filename}?v=2`,
      pipelineType: pipeline.type,
      pipelineTitle: pipeline.title,
    })),
  }));

  const fallbackStepEntries = fallbackStepPipelines.flatMap((pipeline) => pipeline.steps);

  const getDetectionImageUrl = (detection) =>
    `${BACKEND_URL}/outputs/${projectId}/tata_vision_geometry/${detection.image}?v=1`;

  const getDetectionStepUrl = (step) =>
    `${BACKEND_URL}/outputs/${projectId}/tata_vision_geometry/${step.image}?v=1`;

  const handleDetectionStepClick = (step, pipelineType, pipelineTitle) => {
    const selectedStep = {
      ...step,
      pipelineType,
      pipelineTitle,
    };

    setSelectedDetectionStep(selectedStep);
    setSelectedDetectionStepLightbox(selectedStep);
  };

  const getDetectionPipelineLabel = (type) => {
    if (type === 'body') return 'Human body steps';
    if (type === 'face') return 'Human face steps';
    if (type === 'shapes') return 'Geometric construction steps';
    if (type === 'creature') return 'Object construction steps';
    if (type === 'curves') return 'Curves steps';
    if (type === 'shading') return 'Shading steps';
    if (type === 'colouring') return 'Colouring steps';
    return 'Object construction steps';
  };

  const getDetectionStepEntries = (detection) => {
    if (!detection) return [];

    const pipelineSteps = getVisibleDetectionPipelines(detection).flatMap((pipeline) =>
      (pipeline.steps || []).map((step) => ({
        ...step,
        pipelineType: pipeline.type,
        pipelineTitle: pipeline.title || getDetectionPipelineLabel(pipeline.type),
      }))
    );

    const subjectSteps = ['curves', 'shading', 'colouring'].flatMap((stageType) => {
      const stageOutput = detection.subject_outputs?.[stageType];
      if (!stageOutput) return [];

      return getVisibleSubjectSteps(stageType, stageOutput.steps).map((step) => ({
        ...step,
        pipelineType: stageType,
        pipelineTitle: getDetectionPipelineLabel(stageType),
      }));
    });

    return [...pipelineSteps, ...subjectSteps];
  };

  const navigateDetectionStep = (direction) => {
    const stepEntries = getDetectionStepEntries(selectedDetection);
    if (!selectedDetectionStepLightbox || stepEntries.length === 0) return;

    const currentIndex = stepEntries.findIndex((step) =>
      step.pipelineType === selectedDetectionStepLightbox.pipelineType &&
      step.image === selectedDetectionStepLightbox.image
    );
    if (currentIndex < 0) return;

    const nextIndex = (currentIndex + direction + stepEntries.length) % stepEntries.length;
    const nextStep = stepEntries[nextIndex];

    setSelectedDetectionStep(nextStep);
    setSelectedDetectionStepLightbox(nextStep);
  };

  const navigateFallbackStep = (direction) => {
    if (!selectedFallbackStepLightbox || fallbackStepEntries.length === 0) return;

    const currentIndex = fallbackStepEntries.findIndex((step) =>
      step.pipelineType === selectedFallbackStepLightbox.pipelineType &&
      step.image === selectedFallbackStepLightbox.image
    );
    if (currentIndex < 0) return;

    const nextIndex = (currentIndex + direction + fallbackStepEntries.length) % fallbackStepEntries.length;
    setSelectedFallbackStepLightbox(fallbackStepEntries[nextIndex]);
  };

  const detectionOverviewUrl = detectionAnalysisImage
    ? `${BACKEND_URL}/outputs/${projectId}/tata_vision_geometry/${detectionAnalysisImage}?v=1`
    : null;
  const detectionStepEntries = getDetectionStepEntries(selectedDetection);
  const selectedDetectionStepIndex = selectedDetectionStepLightbox
    ? detectionStepEntries.findIndex((step) =>
        step.pipelineType === selectedDetectionStepLightbox.pipelineType &&
        step.image === selectedDetectionStepLightbox.image
      )
    : -1;
  const selectedFallbackStepIndex = selectedFallbackStepLightbox
    ? fallbackStepEntries.findIndex((step) =>
        step.pipelineType === selectedFallbackStepLightbox.pipelineType &&
        step.image === selectedFallbackStepLightbox.image
      )
    : -1;

  return (
    <>
      <Navbar />

      <main className="view-project-page">
        <div className="view-project-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-copy">
              {isEditingProjectDetails ? (
                <div className="project-details-editor">
                  <label>
                    Project title
                    <input
                      type="text"
                      value={projectTitleDraft}
                      onChange={(event) => setProjectTitleDraft(event.target.value)}
                      placeholder={defaultProjectTitle}
                      maxLength={150}
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      value={projectDescriptionDraft}
                      onChange={(event) => setProjectDescriptionDraft(event.target.value)}
                      placeholder="Add a short description (optional)"
                      rows="2"
                      maxLength={1000}
                    />
                  </label>

                  <div className="project-details-actions">
                    <button
                      type="button"
                      className="project-details-save"
                      onClick={saveProjectDetails}
                      disabled={isSavingProjectDetails}
                    >
                      {isSavingProjectDetails ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      className="project-details-cancel"
                      onClick={cancelProjectDetailsEdit}
                      disabled={isSavingProjectDetails}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="project-title-row">
                    <h1>{getProjectTitle()}</h1>
                    <button
                      type="button"
                      className="project-edit-button"
                      onClick={beginProjectDetailsEdit}
                    >
                      Edit
                    </button>
                  </div>

                  <p className="page-subtitle">
                    {project.description || 'No description provided'}
                  </p>
                </>
              )}
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
                {project.status === 'Completed'
                  ? 'Completed'
                  : project.status === 'Failed'
                    ? 'Failed'
                    : `${progressPercent}%`}
              </span>
            </div>

            <p className="processing-status-message">{progressMessage}</p>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="stage-pills">
              {processingStages.map((stage) => {
                const done = completedStages.has(stage.key);
                const skipped = !applicableStages.has(stage.key);
                const active = currentStageKey === stage.key && !done;

                return (
                  <div
                    key={stage.id}
                    className={`stage-pill ${done ? 'done' : ''} ${active ? 'active' : ''} ${skipped ? 'skipped' : ''}`}
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

                    {skipped && <span aria-hidden="true">—</span>}

                    <span>{stage.name}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {detectedObjects.length === 0 && project.status === 'Completed' && (
            <section className="section-block selected-detection-steps fallback-drawing-steps">
              <div className="selected-detection-heading">
                <div>
                  <h4>Full-image drawing steps</h4>
                  <p>
                    No specific subject was detected. Only the geometric.py fallback is shown below.
                  </p>
                </div>
              </div>

              {fallbackStepPipelines.map((pipeline) => (
                <div className="detection-pipeline-group" key={pipeline.type}>
                  <h5>{pipeline.title}</h5>
                  <div className="detection-steps-grid">
                    {pipeline.steps.map((step) => (
                      <button
                        type="button"
                        className={`detection-step-card ${selectedFallbackStepLightbox?.image === step.image ? 'active' : ''}`}
                        key={step.image}
                        onClick={() => setSelectedFallbackStepLightbox(step)}
                        aria-label={`Open ${step.title} enlarged`}
                      >
                        <img src={step.image} alt={step.title} loading="lazy" />
                        <span>{step.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

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
                      {detection.label} {detection.category === 'human' ? detection.id : `#${detection.id}`}
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
                        {selectedDetection.label} {selectedDetection.category === 'human' ? selectedDetection.id : `#${selectedDetection.id}`} — drawing steps
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
                                onClick={() => handleDetectionStepClick(step, pipeline.type, pipeline.title)}
                                aria-label={`Open ${selectedDetection.label} ${step.title} enlarged`}
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
                                onClick={() => handleDetectionStepClick(
                                  step,
                                  stageType,
                                  getDetectionPipelineLabel(stageType)
                                )}
                                aria-label={`Open ${selectedDetection.label} ${step.title} enlarged`}
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
                  Stage {selectedStage.order || selectedStage.id}
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
                  {selectedDetectionCrop.label} {selectedDetectionCrop.category === 'human' ? selectedDetectionCrop.id : `#${selectedDetectionCrop.id}`}
                </strong>
                <span>
                  {selectedDetectionCrop.category} · {Math.round(selectedDetectionCrop.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDetectionStepLightbox && selectedDetection && (
        <div
          className="image-lightbox detection-step-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedDetectionStepLightbox.title} enlarged preview`}
          onClick={() => setSelectedDetectionStepLightbox(null)}
        >
          <div
            className="image-lightbox-content detection-step-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-lightbox-close"
              onClick={() => setSelectedDetectionStepLightbox(null)}
              aria-label="Close drawing step preview"
            >
              &times;
            </button>

            <div className="detection-step-popup">
              <div className="detection-step-popup-image-wrap">
                <button
                  type="button"
                  className="detection-step-gallery-arrow detection-step-gallery-arrow-previous"
                  onClick={() => navigateDetectionStep(-1)}
                  aria-label="Show previous drawing step"
                >
                  <span aria-hidden="true">&#8249;</span>
                </button>
                <img
                  src={getDetectionStepUrl(selectedDetectionStepLightbox)}
                  alt={`${selectedDetection.label} ${selectedDetectionStepLightbox.title}`}
                  className="detection-step-popup-image"
                />
                <button
                  type="button"
                  className="detection-step-gallery-arrow detection-step-gallery-arrow-next"
                  onClick={() => navigateDetectionStep(1)}
                  aria-label="Show next drawing step"
                >
                  <span aria-hidden="true">&#8250;</span>
                </button>
              </div>
              <div className="detection-step-popup-caption">
                <strong>{selectedDetectionStepLightbox.title}</strong>
                <span>
                  {selectedDetection.label} {selectedDetection.category === 'human' ? selectedDetection.id : `#${selectedDetection.id}`} · {selectedDetectionStepLightbox.pipelineTitle}
                </span>
                <small aria-live="polite">
                  {selectedDetectionStepIndex + 1} / {detectionStepEntries.length} · Use ← → to browse
                </small>
                <small>Click outside or press Esc to close</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedFallbackStepLightbox && (
        <div
          className="image-lightbox detection-step-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedFallbackStepLightbox.title} enlarged preview`}
          onClick={() => setSelectedFallbackStepLightbox(null)}
        >
          <div
            className="image-lightbox-content detection-step-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-lightbox-close"
              onClick={() => setSelectedFallbackStepLightbox(null)}
              aria-label="Close full-image drawing step preview"
            >
              &times;
            </button>

            <div className="detection-step-popup">
              <div className="detection-step-popup-image-wrap">
                <button
                  type="button"
                  className="detection-step-gallery-arrow detection-step-gallery-arrow-previous"
                  onClick={() => navigateFallbackStep(-1)}
                  aria-label="Show previous full-image drawing step"
                >
                  <span aria-hidden="true">&#8249;</span>
                </button>
                <img
                  src={selectedFallbackStepLightbox.image}
                  alt={selectedFallbackStepLightbox.title}
                  className="detection-step-popup-image"
                />
                <button
                  type="button"
                  className="detection-step-gallery-arrow detection-step-gallery-arrow-next"
                  onClick={() => navigateFallbackStep(1)}
                  aria-label="Show next full-image drawing step"
                >
                  <span aria-hidden="true">&#8250;</span>
                </button>
              </div>
              <div className="detection-step-popup-caption">
                <strong>{selectedFallbackStepLightbox.title}</strong>
                <span>Full-image pipeline · {selectedFallbackStepLightbox.pipelineTitle}</span>
                <small aria-live="polite">
                  {selectedFallbackStepIndex + 1} / {fallbackStepEntries.length} · Use ← → to browse
                </small>
                <small>Click outside or press Esc to close</small>
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
