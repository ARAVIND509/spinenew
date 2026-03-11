import type {
  AnalysisResults,
  DiagnosticFinding,
  SeverityLevel,
  SoftTissueDegenerationResult,
  PostureSimulationResult,
  HiddenAbnormalityResult,
  BloodFlowAnalysisResult
} from "@shared/schema";
import { analyzeMedicalImageWithML } from "./ml-model";
import { generateGradCAMHeatmaps } from "./gradcam-generator";

import {
  generateFinding,
  getMaxSeverity,
  generatePostureAnalysis,
  generateSoftTissueAnalysis,
  generateHiddenAbnormalityAnalysis,
  generateBloodFlowAnalysis
} from "./analysis-utils";

export async function analyzeWithMedicalModel(
  imageBuffer: Buffer,
  imageType: string,
  modelType: 'ResNet50' = 'ResNet50'
): Promise<AnalysisResults> {
  console.log(`Analyzing with ${modelType} medical model for ${imageType} scan`);

  // Get ML model predictions
  const mlResults = await analyzeMedicalImageWithML(imageBuffer, modelType);

  // Generate Grad-CAM heatmaps ONLY for abnormal predictions above threshold
  const abnormalPredictions = mlResults.predictions.filter(
    p => p.severity !== 'normal' && p.confidence >= 28
  );
  console.log(`Generating Grad-CAM heatmaps for ${abnormalPredictions.length} abnormal predictions...`);
  const gradCamHeatmaps = abnormalPredictions.length > 0
    ? await generateGradCAMHeatmaps(
      imageBuffer,
      abnormalPredictions.map(p => ({
        ...p,
        confidence: p.confidence
      }))
    )
    : [];

  // Map ML predictions to diagnostic findings
  const conditions = mlResults.predictions;
  const discHerniation = conditions.find(c => c.condition === 'Disc Herniation');
  const scoliosis = conditions.find(c => c.condition === 'Scoliosis');
  const spinalStenosis = conditions.find(c => c.condition === 'Spinal Stenosis');
  const degenerativeDisc = conditions.find(c => c.condition === 'Degenerative Disc Disease');
  const vertebralFracture = conditions.find(c => c.condition === 'Vertebral Fracture');
  const spondylolisthesis = conditions.find(c => c.condition === 'Spondylolisthesis');
  const infection = conditions.find(c => c.condition === 'Infection');
  const tumor = conditions.find(c => c.condition === 'Tumor');


  // Generate comprehensive analysis based on ML predictions
  const analysisResults: AnalysisResults = {
    discHerniation: generateFinding(discHerniation, "Disc Herniation"),
    scoliosis: generateFinding(scoliosis, "Scoliosis"),
    spinalStenosis: generateFinding(spinalStenosis, "Spinal Stenosis"),
    degenerativeDisc: generateFinding(degenerativeDisc, "Degenerative Disc Disease"),
    vertebralFracture: generateFinding(vertebralFracture, "Vertebral Fracture"),
    spondylolisthesis: generateFinding(spondylolisthesis, "Spondylolisthesis"),
    infection: generateFinding(infection, "Infection"),
    tumor: generateFinding(tumor, "Tumor"),

    // Restoring derived analysis cards
    postureSimulation: generatePostureAnalysis(conditions, imageType),
    softTissueDegeneration: generateSoftTissueAnalysis(conditions),
    hiddenAbnormality: generateHiddenAbnormalityAnalysis(conditions),
    bloodFlowAnalysis: generateBloodFlowAnalysis(conditions),

    findings: conditions.map(c => ({
      condition: c.condition,
      severity: c.severity,
      confidence: c.confidence,
      location: c.condition.includes("Disc") ? "Disc" : "Spine"
    })),
    primaryFinding: conditions.length > 0 ? (() => {
      // Filter to only conditions that exceed the clinical threshold
      const abnormal = conditions.filter(
        c => c.severity !== 'normal' && c.confidence >= 28
      );

      // TRUE NORMAL STATE — nothing significant found
      if (abnormal.length === 0) return undefined;

      // Sort abnormal findings by severity, then confidence
      const sorted = [...abnormal].sort((a, b) => {
        const severityOrder: Record<string, number> = { severe: 3, moderate: 2, mild: 1, normal: 0 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.confidence - a.confidence;
      });

      const primary = sorted[0];
      return {
        condition: primary.condition,
        severity: primary.severity,
        confidence: primary.confidence,
        location: primary.condition.includes("Disc") ? "Disc" : "Spine"
      };
    })() : undefined,
    mlPredictions: mlResults,
    gradCamHeatmaps: gradCamHeatmaps.length > 0 ? gradCamHeatmaps : undefined,
    heatmapTargets: gradCamHeatmaps.length > 0
      ? gradCamHeatmaps.flatMap(h =>
        h.affectedRegions.map(r => ({
          condition: h.condition,
          region: r.region,
          intensity: r.intensity,
          severity: h.severity || 'severe'
        }))
      )
      : undefined,
  };

  console.log(`Analysis complete with ${gradCamHeatmaps.length} Grad-CAM heatmaps generated`);
  return analysisResults;
}
