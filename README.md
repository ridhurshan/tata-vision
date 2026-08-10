# 🎨 DrawAI – AI-Guided Drawing and Coloring Assistant

<div align="center">

![DrawAI Banner](https://github.com/user-attachments/assets/b92aa493-832d-4742-9c6e-1a3074baf2ec)

**[Live Demo](#)** • **[Documentation](#)** • **[Report Bug](#)** • **[Request Feature](#)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)

</div>

---

## 📖 Overview

**DrawAI** is a web-based AI-assisted drawing platform developed as a Final Year Project. The system helps users transform a reference image into progressive drawing stages that can be followed step by step.

Instead of directly generating finished artwork, DrawAI provides structured visual guidance for learning and practicing drawing techniques through a systematic pipeline.

---

## ✨ Main Features

### 👤 User Management
- User registration and login
- Email verification
- Password recovery
- Profile management

### 🎯 Project Management
- Reference image upload
- Project creation and naming
- Project history and viewing
- Project deletion

### 🤖 AI Processing Pipeline
- **Geometric Shape Extraction** – Basic shapes and structure
- **Curve Extraction** – Edge detection and line art
- **Pencil Shading** – Grayscale tonal guide
- **Number & Colour Guide** – Paint-by-number style guide

### 📤 Export Options
- Download drawing stages as PDF
- Download generated images as ZIP
- Full-screen image preview
- Share projects

### 🛠️ Admin Functionality
- User management
- System monitoring
- Processing queue management

---

## 🧠 Drawing Pipeline

The uploaded reference image is processed through four main stages:

### 1. 📐 Geometric Shape Extraction
The reference image is segmented and simplified into basic geometric regions to help users understand the overall structure of the drawing.

**Technologies:**
- Segment Anything Model (SAM)
- OpenCV
- Contour detection and approximation

### 2. ✏️ Curve Extraction
Important edges and curves are extracted from the image to provide a more detailed drawing guide. This stage converts the simplified structure into line-based visual guidance.

**Technologies:**
- Canny Edge Detection
- Hough Transform
- Contour Tracing

### 3. ✒️ Pencil Shading
The image is transformed into a pencil-style shading guide to help users understand:
- Light and dark regions
- Shadows
- Intensity variations
- Tonal structure

**Technologies:**
- Grayscale conversion
- Gaussian blur
- Sketch generation algorithms

### 4. 🎨 Number & Colour Guide
The original colour image is processed to produce simplified colour regions. Each region is assigned a number corresponding to a colour palette, creating a paint-by-number style guide.

**Technologies:**
- K-means clustering
- Colour quantization
- Palette extraction

---

## 🏗️ System Architecture

```mermaid
graph TB
    A[User] --> B[React Frontend]
    B -->|REST API| C[Node.js/Express Backend]
    C --> D[MySQL Database]
    C -->|HTTP Request| E[Python Flask AI Service]
    E --> F[Image Processing Pipeline]
    F --> G[Geometric Shape Extraction]
    F --> H[Curve Extraction]
    F --> I[Pencil Shading]
    F --> J[Number & Colour Guide]
    G --> K[Generated Images]
    H --> K
    I --> K
    J --> K
    K --> C
    C --> B
