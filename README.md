# SpineGuardAI

SpineGuardAI is an advanced medical imaging analysis system that leverages artificial intelligence and computer vision to detect and analyze spinal disorders from medical scans. The system provides comprehensive diagnostic capabilities for conditions such as disc herniation, scoliosis, spinal stenosis, and degenerative disc disease.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Analysis Capabilities](#analysis-capabilities)
- [Database Schema](#database-schema)
- [File Upload and Processing](#file-upload-and-processing)
- [Real-time Progress Updates](#real-time-progress-updates)
- [PDF Report Generation](#pdf-report-generation)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Overview

SpineGuardAI is designed to assist medical professionals in diagnosing spinal conditions by providing AI-powered analysis of medical imaging data. The system combines traditional machine learning approaches with advanced computer vision techniques to identify various spinal pathologies with high accuracy.

The application features a modern React-based frontend with a comprehensive dashboard, image visualization tools, and detailed analysis results. The backend is built with Node.js and Express, supporting both direct upload of medical images and integration with hospital databases.

## Features

- **Multi-modal Medical Imaging Support**: Handles DICOM files, MRI scans, X-rays, and other medical imaging formats
- **AI-Powered Analysis**: Uses a ResNet-50 v2 simulation optimized for medical image analysis
- **Spinal Cord Toolbox Integration**: Leverages specialized Python-based tools for detailed spinal analysis
- **Real-time Progress Tracking**: WebSocket-based progress updates during analysis
- **Grad-CAM Heatmap Visualization**: Provides interpretable AI decision-making visualization
- **3D Spine Visualization**: Interactive 3D modeling of spinal structures
- **Comprehensive Reporting**: Generates detailed PDF reports with clinical findings
- **DICOM Support**: Native handling of DICOM medical imaging standard
- **Patient Management**: Track patient cases and scan history
- **Critical Findings Dashboard**: Highlights urgent medical conditions requiring attention

## Architecture

The system follows a modern full-stack architecture:

### Frontend
- **React 18** with TypeScript
- **wouter** for routing
- **Tailwind CSS** with shadcn/ui components
- **TanStack Query** for data fetching and caching
- **Framer Motion** for animations
- **Radix UI** primitives for accessible components

### Backend
- **Node.js** with TypeScript
- **Express.js** web framework
- **Prisma ORM** with SQLite database
- **Python** integration for medical imaging analysis
- **WebSocket** for real-time updates
- **Multer** for file uploads

### AI/ML Components
- **TensorFlow.js** for browser-based inference
- **Spinal Cord Toolbox (SCT)** integration
- **Grad-CAM** for visualization
- **Computer Vision** algorithms for spine detection

## Technology Stack

### Frontend Technologies
- **React 18**: Modern component-based UI library
- **TypeScript**: Type-safe JavaScript development
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Accessible UI components
- **wouter**: Lightweight routing solution
- **TanStack Query**: Server state management
- **Framer Motion**: Production-ready animations
- **Lucide React**: Beautiful icon library
- **jspdf**: PDF generation for reports

### Backend Technologies
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **TypeScript**: Type-safe server development
- **Prisma**: Modern database toolkit
- **SQLite**: Lightweight SQL database
- **Python**: Medical image processing
- **WebSocket**: Real-time communication

### AI/ML Libraries
- **TensorFlow.js**: Machine learning in JavaScript
- **dcmjs**: DICOM medical imaging library
- **sharp**: High-performance image processing
- **NumPy**: Python numerical computing
- **SciPy**: Scientific computing for Python
- **Pillow**: Python image processing

## Installation

### Prerequisites
- Node.js (v18 or higher)
- Python 3.10.* with pip
- Git

### Setup Instructions

1. Clone the repository:
```bash
git clone https://github.com/your-username/SpineGuardAI.git
cd SpineGuardAI
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
# First install wheel to avoid legacy setup issues
pip install wheel

# Install required Python packages
pip install numpy scipy pillow nibabel

# Install Spinal Cord Toolbox (SCT) from GitHub - this is critical for the medical analysis
pip install git+https://github.com/spinalcordtoolbox/spinalcordtoolbox.git
```

4. Set up the database:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`.

## Usage

### Starting the Application
```bash
npm run dev
```

### Main Application Pages
- **Home Dashboard**: `http://localhost:5000/` - Overview of recent scans and critical findings
- **Upload Scans**: `http://localhost:5000/upload` - Upload medical images for analysis
- **AI Analysis**: `http://localhost:5000/ai-analysis/:scanId` - Detailed analysis results
- **Database View**: `http://localhost:5000/database` - Patient and scan management
- **Reports**: `http://localhost:5000/reports` - Historical analysis reports

### Uploading Medical Scans
1. Navigate to the Upload page
2. Select one of three options:
   - Direct Upload: Upload images directly from your computer
   - Hospital Database: Fetch scans from integrated hospital systems
   - New Patient: Create a new patient record and upload scans
3. For direct upload, select your medical image file
4. Choose the image type (MRI, X-ray, etc.)
5. The system will automatically begin AI analysis

### Analysis Process
1. Medical images are preprocessed and normalized
2. AI models analyze the images for various spinal conditions
3. Spinal Cord Toolbox provides detailed anatomical analysis
4. Grad-CAM heatmaps visualize AI decision-making regions
5. Results are displayed with confidence scores and recommendations

## API Endpoints

### Patient Management
- `GET /api/patients` - Retrieve all patients
- `GET /api/patients/:id` - Retrieve specific patient
- `POST /api/patients` - Create new patient

### Scan Management
- `GET /api/scans/:patientCaseId` - Get scans for a patient
- `GET /api/scans/single/:scanId` - Get a specific scan
- `GET /api/scans/recent` - Get recent scans
- `POST /api/upload` - Upload new scan (with optional analysis)

### Analysis
- `POST /api/analyze/:scanId` - Analyze existing scan
- `GET /api/analysis/:scanId` - Get analysis results
- `GET /api/analyses` - Get all analyses with details

### Statistics
- `GET /api/stats/critical-findings` - Get critical findings summary
- `GET /api/stats/average-analysis-time` - Get average analysis time

## Analysis Capabilities

### Spinal Conditions Detected
- **Disc Herniation**: Identification of intervertebral disc protrusion
- **Scoliosis**: Detection of spinal curvature abnormalities
- **Spinal Stenosis**: Assessment of spinal canal narrowing
- **Degenerative Disc Disease**: Evaluation of disc degeneration
- **Infections**: Detection of spinal infections
- **Tumors**: Identification of spinal masses

### Advanced Analysis Features
- **Soft Tissue Degeneration**: Quantification of ligament and tendon changes
- **3D Posture Simulation**: Modeling of functional spine mechanics
- **Hidden Abnormality Detection**: Identification of subtle pathologies
- **Blood Flow Analysis**: Assessment of spinal cord perfusion
- **Risk Zone Identification**: Highlighting areas prone to future problems

### AI Model Performance
- **ResNet50 v2**: Primary deep learning simulation for medical image analysis with Residual Aggregation
- **Grad-CAM Visualization**: Heatmap visualization of AI decision-making
- **Confidence Scoring**: Percentage-based confidence in predictions

## Database Schema

The application uses SQLite with Prisma ORM and follows a three-table schema:

### Patients Table
- `id`: Primary key (UUID)
- `patientId`: Patient identifier
- `name`: Patient name
- `age`: Patient age (nullable)
- `createdAt`: Record creation timestamp

### Scans Table
- `id`: Primary key (UUID)
- `patientCaseId`: Foreign key to patients table
- `imageUrl`: Base64 encoded image data URL
- `imageType`: Type of medical image (MRI, X-ray, etc.)
- `metadata`: JSONB field for additional scan metadata (DICOM data, etc.)
- `uploadedAt`: Scan upload timestamp

### Analyses Table
- `id`: Primary key (UUID)
- `scanId`: Foreign key to scans table
- `results`: JSONB field containing analysis results
- `analyzedAt`: Analysis completion timestamp

## File Upload and Processing

### Supported File Types
- DICOM files (`.dcm`)
- Standard image formats (PNG, JPG, JPEG)
- Medical imaging files up to 50MB

### Upload Process
1. File is received via Multer middleware
2. DICOM files are parsed using dcmjs library
3. Images are converted to base64 data URLs
4. Metadata is extracted and stored
5. Scan record is created in the database

### DICOM Processing
- Patient information extraction
- Image data conversion to displayable format
- Medical metadata preservation
- Standard compliance verification

## Real-time Progress Updates

The system implements WebSocket-based real-time progress updates during analysis:

### WebSocket Endpoint
- `/ws/analysis` - WebSocket connection for analysis progress

### Progress Updates
- 10%: Preprocessing medical image
- 30-80%: Running deep segmentation models (SCT analysis)
- 90%: Finalizing diagnostic findings
- 100%: Analysis complete

### Client Implementation
- Automatic WebSocket connection on analysis page
- Progress bar updates in real-time
- Status messages during processing
- Error handling for connection issues

## PDF Report Generation

The system generates comprehensive PDF reports containing:

### Report Sections
1. **Patient Information**: Name, age, medical record number
2. **Executive Summary**: Overall analysis findings
3. **AI Model Predictions**: Confidence scores and severity levels
4. **Detailed Clinical Findings**: Condition-specific analysis
5. **Soft Tissue Analysis**: Degeneration assessment
6. **Biomechanical Assessment**: Posture and functional analysis
7. **Advanced Screening**: Hidden abnormality detection
8. **Vascular Analysis**: Blood flow and perfusion assessment
9. **AI Visualization**: Grad-CAM heatmap interpretations
10. **Medical Disclaimer**: Important usage information

### Report Features
- Professional formatting with headers and footers
- Color-coded severity indicators
- Detailed tables and measurements
- Image visualizations where possible
- HIPAA-compliant confidentiality notices

## Development

### Project Structure
```
SpineGuardAI/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions
├── server/                 # Backend Node.js application
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Database operations
│   ├── ml-analysis.ts      # Machine learning analysis
│   ├── sct-bridge.ts       # Python integration
│   ├── dicom-parser.ts     # DICOM file processing
│   └── websocket-handler.ts # Real-time updates
├── shared/                 # Shared TypeScript types
├── prisma/                 # Database schema and migrations
└── server/                 # Python analysis scripts
```

### Environment Variables
- `DATABASE_URL`: Database connection string
- `NODE_ENV`: Environment mode (development/production)
- `PORT`: Application port (default: 5000)

### Development Scripts
- `npm run dev`: Start development server
- `npm run build`: Build production application
- `npm run start`: Start production server
- `npm run check`: Type checking with TypeScript

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Standards
- Follow TypeScript/JavaScript best practices
- Write comprehensive unit tests
- Maintain consistent code formatting
- Document new features and APIs
- Follow accessibility guidelines

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note**: This is a medical AI application intended for research and educational purposes. The analysis results should not be used as the sole basis for medical diagnosis or treatment decisions. Always consult with qualified healthcare professionals for medical advice.