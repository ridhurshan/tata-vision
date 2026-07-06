// src/pages/Upload/index.jsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Upload.css';
import '../common/Navbar';
import Navbar from '../common/Navbar';
import Footer from '../common/Footer';
import { useAuth } from '../context/AuthContext'; 
import { createProject } from '../services/projectService'; 


const Upload = () => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');           // ← add this
  const [description, setDescription] = useState(''); 
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file) => {
    setError('');
    setSuccess('');

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    // Validate dimensions (optional - you can check with image loading)
    const img = new Image();
    img.onload = () => {
      if (img.width < 100 || img.height < 100) {
        setError('Image dimensions must be at least 100x100px.');
        return;
      }
      setFile(file);
      setPreview(URL.createObjectURL(file));
      setSuccess('Image uploaded successfully!');
    };
    img.onerror = () => {
      setError('Invalid image file.');
    };
    img.src = URL.createObjectURL(file);
  };


  const handleUpload = async () => {
    if (!file) {
      setError('Please select an image first.');
      return;
    }
    if (!title.trim()) {
      setError('Please give your project a title.');
      return;
    }
    if (!user) {
      setError('You must be logged in to upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 200);

    try {
      const response = await createProject({
        user_id: user.id,
        title,
        description
      });

      clearInterval(interval);
      setUploadProgress(100);
      setSuccess('Project created successfully! AI is processing your artwork...');
      console.log('Created project:', response.data);

      // navigate to the new project's page after a short pause
      setTimeout(() => {
        navigate(`/projects/${response.data.projectId}`);
      }, 1200);

    } catch (err) {
      clearInterval(interval);
      setIsUploading(false);
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    setError('');
    setSuccess('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Navbar/>
      <div className="upload-page">
        <div className="upload-container">
          <div className="upload-header">
            <div className="header-left">
              <h1>Upload Your Sketch</h1>
              <p className="subtitle">
                Share your drawing and let AI transform it into amazing artwork
              </p>
            </div>
          </div>

        <div className="upload-content">
          {/* Upload Area */}
          <div className="upload-area-wrapper">
            <div
              className={`upload-area ${isDragging ? 'dragging' : ''} ${preview ? 'has-image' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
              />

              {!preview ? (
                <div className="upload-placeholder">
                  <div className="upload-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <h3>Drag & drop your image</h3>
                  <p>or click to browse from your device</p>
                  <span className="file-formats">Supported Formats: JPG, PNG, WebP (Max. 5MB)</span>
                </div>
              ) : (
                <div className="preview-container">
                  <img src={preview} alt="Preview" className="image-preview" />
                  <div className="preview-overlay">
                    <button 
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* File Info */}
              {file && (
                <div className="file-info">
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Project Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Portrait Drawing"
                      className="edit-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label>Description (optional)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Convert portrait into anime style"
                      rows="2"
                      className="edit-textarea"
                    />
                  </div>

                  <div className="file-actions">
                    <button className="remove-file-btn" onClick={handleRemoveFile}>
                      Remove
                    </button>
                    <button
                      className="upload-btn"
                      onClick={handleUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Upload to AI'}
                    </button>
                  </div>
                </div>
              )}

            {/* Progress Bar */}
            {isUploading && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="progress-text">{uploadProgress}%</span>
              </div>
            )}

            {/* Messages */}
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
          </div>

          {/* Requirements Panel */}
          <div className="requirements-panel">
            <h3>Requirements</h3>
            <ul>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                JPG, PNG, or WebP format
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Maximum file size: 5MB
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Minimum dimensions: 100x100px
              </li>
            </ul>
          </div>
          
        </div>
      </div>
      
    </div>
    <Footer/>
    </>
  );
};

export default Upload;