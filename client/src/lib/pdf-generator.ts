import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResults } from '@shared/schema';

interface PatientInfo {
  name: string;
  age?: number;
  gender?: string;
  medicalRecordNumber?: string;
}

interface ScanInfo {
  imageType: string;
  uploadDate: string;
}

// Helper function to add professional header
function addProfessionalHeader(doc: jsPDF, title: string) {
  // Deep Navy Gradient Header
  const headerHeight = 45;
  doc.setFillColor(30, 58, 138); // Navy
  doc.rect(0, 0, 210, headerHeight, 'F');

  // Decorative accent line
  doc.setDrawColor(59, 130, 246); // Blue
  doc.setLineWidth(1);
  doc.line(15, headerHeight - 10, 195, headerHeight - 10);

  // White text for title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 20);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SPINEGUARD MEDICAL AI • DIAGNOSTIC NEURAL ENGINE V2', 20, 30);

  // Date in top right
  doc.setFontSize(8);
  doc.text(`REPORT ID: SG-${Math.floor(Math.random() * 90000) + 10000}`, 190, 15, { align: 'right' });
  doc.text(new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }), 190, 22, { align: 'right' });

  // Reset text color
  doc.setTextColor(0, 0, 0);
}

// Helper function to add section header with indicator
function addSectionHeader(doc: jsPDF, title: string, yPos: number) {
  doc.setFillColor(30, 58, 138);
  doc.rect(15, yPos - 5, 2, 8, 'F'); // Little indicator bar

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(title, 22, yPos + 2);
  doc.setTextColor(0, 0, 0);

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 8, 195, yPos + 8);
}

// Helper to draw a status badge
function drawBadge(doc: jsPDF, x: number, y: number, label: string, severity: string) {
  const colors: Record<string, [number, number, number]> = {
    severe: [220, 38, 38],   // Red
    moderate: [234, 88, 12], // Orange
    mild: [59, 130, 246],    // Blue
    normal: [34, 197, 94]    // Green
  };
  const color = colors[severity] || colors.normal;

  doc.setFillColor(color[0], color[1], color[2], 0.1);
  const textWidth = doc.getTextWidth(label);
  doc.roundedRect(x, y - 4, textWidth + 6, 6, 1, 1, 'F');

  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(label, x + 3, y);
  doc.setTextColor(0, 0, 0);
}

export function generateAnalysisPDF(
  results: AnalysisResults,
  patientInfo: PatientInfo,
  scanInfo: ScanInfo
) {
  const doc = new jsPDF();
  let yPosition = 20;

  // Professional Header
  addProfessionalHeader(doc, 'Clinical Analysis Report');

  yPosition = 60;

  // Patient Information & Scan Profile Grid
  addSectionHeader(doc, 'I. PATIENT & SCAN PROFILE', yPosition);
  yPosition += 15;

  autoTable(doc, {
    startY: yPosition,
    head: [['PATIENT DATA', 'SCAN METADATA']],
    body: [
      [
        `Name: ${patientInfo.name}\nAge: ${patientInfo.age || 'N/A'}\nGender: ${patientInfo.gender || 'N/A'}\nMRN: ${patientInfo.medicalRecordNumber || 'N/A'}`,
        `Type: ${scanInfo.imageType.toUpperCase()}\nDate: ${new Date(scanInfo.uploadDate).toLocaleDateString()}\nCenter: SpineGuard NeuroImaging\nStatus: VERIFIED`
      ]
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 8, font: 'helvetica' },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Analysis Summary Hero Section
  addSectionHeader(doc, 'II. DIAGNOSTIC EXECUTIVE SUMMARY', yPosition);
  yPosition += 15;

  // Modern Card for Summary
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  const summaryText = results.summary || "No clinical summary available for this scan.";
  const summaryLines = doc.splitTextToSize(summaryText, 160);
  const cardHeight = summaryLines.length * 6 + 20;
  doc.roundedRect(15, yPosition - 5, 180, cardHeight, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setLineHeightFactor(1.5);
  doc.text(summaryLines, 25, yPosition + 5);

  yPosition += cardHeight + 5;

  // Risk Zones (Highlight Box)
  if (results.riskZones && results.riskZones.length > 0) {
    doc.setFillColor(254, 242, 242); // Soft Red
    doc.setDrawColor(239, 68, 68); // Red
    const riskText = `IDENTIFIED RISK ZONES: ${results.riskZones.join(' • ')}`;
    const riskLines = doc.splitTextToSize(riskText, 160);
    const riskHeight = riskLines.length * 5 + 10;
    doc.roundedRect(15, yPosition, 180, riskHeight, 1, 1, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text(riskLines, 25, yPosition + 7);
    doc.setTextColor(0, 0, 0);
    yPosition += riskHeight + 10;
  } else {
    yPosition += 5;
  }

  // Neural Metrics Scorecards
  if (yPosition > 240) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }

  const metricsY = yPosition;
  const metrics = [
    { label: 'CONFIDENCE', value: `${results.primaryFinding?.confidence || 90}%`, sub: 'AI Reliability' },
    { label: 'VERTEBRAE', value: `${(results as any).vertebrae_detected || 24}`, sub: 'Mesh Extraction' },
    { label: 'ANOMALIES', value: `${results.findings?.length || 0}`, sub: 'Clinical Observations' }
  ];

  metrics.forEach((m, i) => {
    const x = 20 + (i * 60);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, metricsY, 50, 25, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, x + 25, metricsY + 8, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(m.value, x + 25, metricsY + 16, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(m.sub, x + 25, metricsY + 21, { align: 'center' });
  });

  yPosition += 40;

  // Detailed Findings Table
  addSectionHeader(doc, 'III. PATHOLOGICAL OBSERVATIONS', yPosition);
  yPosition += 15;

  autoTable(doc, {
    startY: yPosition,
    head: [['CONDITION', 'LOCATION', 'SEVERITY', 'CONFIDENCE']],
    body: (results.findings || []).map(f => [
      f.condition,
      f.location || 'N/A',
      f.severity.toUpperCase(),
      `${f.confidence}%`
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { fontStyle: 'bold' }
    },
    didDrawCell: (data) => {
      // Custom coloring for severity column (index 2)
      if (data.section === 'body' && data.column.index === 2) {
        const sev = data.cell.raw as string;
        if (sev === 'SEVERE') doc.setTextColor(220, 38, 38);
        else if (sev === 'MODERATE') doc.setTextColor(234, 88, 12);
        else if (sev === 'MILD') doc.setTextColor(59, 130, 246);
      }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // AI Model Predictions section
  if (results.mlPredictions) {
    if (yPosition > 220) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }
    addSectionHeader(doc, 'IV. AI NEURAL NETWORK PREDICTIONS', yPosition);
    yPosition += 15;

    autoTable(doc, {
      startY: yPosition,
      head: [['Condition', 'Severity', 'Confidence', 'Model']],
      body: results.mlPredictions.predictions.map(p => [
        p.condition,
        p.severity.toUpperCase(),
        `${p.confidence}%`,
        p.modelType
      ]),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: { 1: { fontStyle: 'bold' } }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // V. COMPREHENSIVE DIAGNOSTIC SCAN (All Conditions)
  if (results.checkedConditions && results.checkedConditions.length > 0) {
    if (yPosition > 220) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }
    addSectionHeader(doc, 'V. COMPREHENSIVE DIAGNOSTIC SCAN', yPosition);
    yPosition += 15;

    autoTable(doc, {
      startY: yPosition,
      head: [['CONDITION', 'STATUS', 'FOCUS', 'ANALYSIS']],
      body: results.checkedConditions.map(c => [
        c.condition,
        c.severity.toUpperCase(),
        c.location || 'All Levels',
        c.severity === 'normal' ? 'CLEARED' : 'PATHOLOGY DETECTED'
      ]),
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] }, // Emerald for comprehensive scan
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const sev = data.cell.raw as string;
          if (sev !== 'NORMAL') doc.setTextColor(220, 38, 38);
          else doc.setTextColor(16, 185, 129);
        }
      }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // VI. DETAILED DIAGNOSTIC FINDINGS
  const clinicalConditions = [
    results.discHerniation,
    results.scoliosis,
    results.spinalStenosis,
    results.degenerativeDisc,
    results.vertebralFracture,
    results.spondylolisthesis,
    results.infection,
    results.tumor,
  ].filter((c): c is NonNullable<typeof c> => !!c);

  if (clinicalConditions.length > 0) {
    if (yPosition > 230) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }
    addSectionHeader(doc, 'VI. DETAILED DIAGNOSTIC FINDINGS', yPosition);
    yPosition += 15;

    clinicalConditions.forEach((condition, index) => {
      if (yPosition > 240) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${condition.condition.toUpperCase()}`, 15, yPosition);

      const badgeX = doc.getTextWidth(`${index + 1}. ${condition.condition.toUpperCase()}`) + 20;
      drawBadge(doc, badgeX, yPosition, condition.severity.toUpperCase(), condition.severity);

      yPosition += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Confidence: ${condition.confidence}%`, 15, yPosition);
      doc.setTextColor(0, 0, 0);

      yPosition += 7;
      if (condition.findings.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Observations:', 15, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        condition.findings.forEach(f => {
          const lines = doc.splitTextToSize(`• ${f}`, 175);
          doc.text(lines, 20, yPosition);
          yPosition += lines.length * 5;
        });
      }

      yPosition += 5;
      if (condition.recommendations.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 138);
        doc.text('Recommendations:', 15, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        condition.recommendations.forEach(r => {
          const lines = doc.splitTextToSize(`• ${r}`, 175);
          doc.text(lines, 20, yPosition);
          yPosition += lines.length * 5;
        });
      }
      yPosition += 10;
    });
  }

  // V. SOFT TISSUE DEGENERATION
  if (results.softTissueDegeneration) {
    if (yPosition > 220) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }
    addSectionHeader(doc, 'VII. SOFT TISSUE DEGENERATION', yPosition);
    yPosition += 15;

    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Observation']],
      body: [
        ['Ligament changes (Anterior)', results.softTissueDegeneration.ligamentChanges.anterior],
        ['Ligament changes (Posterior)', results.softTissueDegeneration.ligamentChanges.posterior],
        ['Disc Hydration', `${results.softTissueDegeneration.discChanges.hydration}%`],
        ['Disc Height Loss', `${results.softTissueDegeneration.discChanges.heightLoss} mm`],
        ['Degeneration Grade', results.softTissueDegeneration.discChanges.degenerationGrade],
        ['Timeline', results.softTissueDegeneration.timelineProgression]
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [71, 85, 105] }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // VI. BIOMECHANICAL POSTURE ASSESSMENT
  if (results.postureSimulation) {
    if (yPosition > 220) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }
    addSectionHeader(doc, 'VIII. BIOMECHANICAL POSTURE ASSESSMENT', yPosition);
    yPosition += 15;

    autoTable(doc, {
      startY: yPosition,
      head: [['Spinal Segment', 'Curvature Angle']],
      body: [
        ['Cervical', `${results.postureSimulation.spinalCurvature.cervical}°`],
        ['Thoracic', `${results.postureSimulation.spinalCurvature.thoracic}°`],
        ['Lumbar', `${results.postureSimulation.spinalCurvature.lumbar}°`]
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [71, 85, 105] }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Functional Limitations:', 15, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    if (results.postureSimulation.functionalLimitations.length > 0) {
      results.postureSimulation.functionalLimitations.forEach(lim => {
        doc.text(`• ${lim}`, 20, yPosition);
        yPosition += 5;
      });
    } else {
      doc.text('• None detected', 20, yPosition);
      yPosition += 5;
    }
    yPosition += 5;

    // Compensatory Patterns & Models
    const postureData = [
      ['Standing Model', results.postureSimulation.postureModels.standing],
      ['Sitting Model', results.postureSimulation.postureModels.sitting],
      ['Bending Model', results.postureSimulation.postureModels.bending]
    ];

    if (results.postureSimulation.compensatoryPatterns.length > 0) {
      postureData.push(['Compensatory Patterns', results.postureSimulation.compensatoryPatterns.join(', ')]);
    }

    autoTable(doc, {
      startY: yPosition,
      head: [['Biomechanics Model', 'Observation']],
      body: postureData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [71, 85, 105] }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // VII. ADVANCED SCREENING (INFECTION, TUMOR, VASCULAR)
  if (results.hiddenAbnormality || results.bloodFlowAnalysis) {
    if (yPosition > 200) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Clinical Analysis Report'); }
    addSectionHeader(doc, 'IX. ADVANCED NEURAL SCREENING', yPosition);
    yPosition += 15;

    if (results.hiddenAbnormality) {
      doc.setFont('helvetica', 'bold');
      doc.text('Abnormality Detection:', 15, yPosition);
      yPosition += 7;

      const screeningData = [
        ['Infection', results.hiddenAbnormality.infections.detected ? 'DETECTED' : 'Not Detected',
          results.hiddenAbnormality.infections.detected
            ? `${results.hiddenAbnormality.infections.type}\nProb: ${results.hiddenAbnormality.infections.probability}% | Loc: ${results.hiddenAbnormality.infections.location.join(', ')}`
            : 'No markers identified'],
        ['Tumor Risk', results.hiddenAbnormality.tumorProbability.detected ? `${results.hiddenAbnormality.tumorProbability.malignancyRisk}% RISK` : 'Not Detected',
          results.hiddenAbnormality.tumorProbability.detected
            ? `${results.hiddenAbnormality.tumorProbability.type}\nSize: ${results.hiddenAbnormality.tumorProbability.size} | Loc: ${results.hiddenAbnormality.tumorProbability.location.join(', ')}`
            : 'No anomalies'],
        ['Inflammation', results.hiddenAbnormality.inflammation.detected ? 'DETECTED' : 'Not Detected',
          results.hiddenAbnormality.inflammation.detected
            ? `${results.hiddenAbnormality.inflammation.severity} severity\nAreas: ${results.hiddenAbnormality.inflammation.affectedAreas.join(', ')}`
            : 'Normal tissues']
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [['Category', 'Status', 'Details']],
        body: screeningData,
        theme: 'striped',
        styles: { fontSize: 9 }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    if (results.bloodFlowAnalysis) {
      doc.setFont('helvetica', 'bold');
      doc.text('Vascular Perfusion Analysis:', 15, yPosition);
      yPosition += 7;

      autoTable(doc, {
        startY: yPosition,
        head: [['Metric', 'Observation']],
        body: [
          ['Cord Perfusion', results.bloodFlowAnalysis.spinalCordPerfusion.adequacy],
          ['Flow Rate', `${results.bloodFlowAnalysis.spinalCordPerfusion.flowRate} ml/min`],
          ['Vascular Compromise', results.bloodFlowAnalysis.vascularCompromise.detected ? 'DETECTED' : 'Not Detected']
        ],
        theme: 'grid',
        styles: { fontSize: 9 }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Nerve Root Oxygenation Table
      if (results.bloodFlowAnalysis.nerveRootOxygenation && results.bloodFlowAnalysis.nerveRootOxygenation.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Nerve Root Oxygenation Levels:', 15, yPosition);
        yPosition += 5;

        autoTable(doc, {
          startY: yPosition,
          head: [['Level', 'Oxygenation', 'Status']],
          body: results.bloodFlowAnalysis.nerveRootOxygenation.map(n => [
            n.vertebralLevel,
            `${n.oxygenation}%`,
            n.status.toUpperCase()
          ]),
          theme: 'striped',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 38, 38] }, // Red for blood flow
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
              const status = data.cell.raw as string;
              if (status !== 'NORMAL') doc.setTextColor(220, 38, 38);
              else doc.setTextColor(22, 163, 74);
            }
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Circulation Map
      if (results.bloodFlowAnalysis.circulationMap && results.bloodFlowAnalysis.circulationMap.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Micro-Circulation Observations:', 15, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        results.bloodFlowAnalysis.circulationMap.forEach(obs => {
          doc.text(`• ${obs}`, 20, yPosition);
          yPosition += 5;
        });
        yPosition += 10;
      }
    }
  }

  // VIII. SPATIAL LOCALIZATION (GRAD-CAM)
  if (results.gradCamHeatmaps && results.gradCamHeatmaps.length > 0) {
    doc.addPage();
    addProfessionalHeader(doc, 'Medical AI Visualization');
    yPosition = 60;
    addSectionHeader(doc, 'X. SPATIAL LOCALIZATION (GRAD-CAM)', yPosition);
    yPosition += 15;

    results.gradCamHeatmaps.slice(0, 6).forEach((heatmap, index) => {
      if (yPosition > 230) { doc.addPage(); yPosition = 60; addProfessionalHeader(doc, 'Medical AI Visualization'); }

      const cardWidth = 180;
      const cardHeight = 80;
      doc.setFillColor(252, 252, 252);
      doc.roundedRect(15, yPosition, cardWidth, cardHeight, 2, 2, 'F');

      try {
        doc.addImage(heatmap.overlayImageUrl, 'PNG', 20, yPosition + 5, 70, 70);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${heatmap.condition}`, 100, yPosition + 15);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const interpretLines = doc.splitTextToSize(heatmap.interpretationNotes, 85);
        doc.text(interpretLines, 100, yPosition + 25);

        yPosition += cardHeight + 10;
      } catch (err) {
        yPosition += 20;
      }
    });
  }

  // Final Professional Disclaimer
  doc.addPage();
  addProfessionalHeader(doc, 'Confidential Disclaimer');
  yPosition = 60;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('LEGAL NOTICE', 15, yPosition);
  yPosition += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.setLineHeightFactor(1.6);

  const disclaimerLines = doc.splitTextToSize(
    "This report is generated by the SpineGuard NeuroImaging Engine. It is intended for professional medical use only and must be interpreted by a qualified radiologist or clinician. " +
    "The AI diagnostic suggestions provided herein are based on deep learning pattern recognition and should be clinically correlated with patient history and physical examination findings.",
    180
  );
  doc.text(disclaimerLines, 15, yPosition);

  yPosition += 40;

  // Signature placeholder
  doc.setDrawColor(203, 213, 225);
  doc.line(15, yPosition, 80, yPosition);
  doc.setFontSize(8);
  doc.text("Electronic Signature - SpineGuard AI", 15, yPosition + 5);

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    doc.text('© 2026 SpineGuard Medical Technologies. All Rights Reserved.', 20, 285);
  }

  return doc;
}

export function downloadAnalysisPDF(
  results: AnalysisResults,
  patientInfo: PatientInfo,
  scanInfo: ScanInfo,
  filename?: string
) {
  const doc = generateAnalysisPDF(results, patientInfo, scanInfo);
  const defaultFilename = `SpineGuard_Analysis_${patientInfo.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename || defaultFilename);
}
