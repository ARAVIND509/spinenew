import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AnalysisResults, DiagnosticFinding } from '@shared/schema';
import {
  generateFinding,
  getMaxSeverity,
  generatePostureAnalysis,
  generateSoftTissueAnalysis,
  generateHiddenAbnormalityAnalysis,
  generateBloodFlowAnalysis
} from "./analysis-utils";
import { generateGradCAMHeatmaps } from "./gradcam-generator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Call the Spinal Cord Toolbox Python script for spine analysis
 * @param imageBuffer The image data as a Buffer
 * @param imageType The type of image (MRI or X-ray)
 * @returns Analysis results from the SCT
 */
export async function analyzeWithSCT(
  imageBuffer: Buffer,
  imageType: string
): Promise<AnalysisResults> {
  console.log(`Analyzing ${imageType} scan with Python spine analysis`);

  // Create a temporary directory for the analysis
  const tempDir = join(process.cwd(), 'temp', Date.now().toString());
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Save the image buffer to a temporary file
    const imagePath = join(tempDir, 'input_image.png');
    await fs.writeFile(imagePath, imageBuffer);

    // Call the Python script
    const pythonScript = join(__dirname, 'spine_analysis.py');
    const outputDir = join(tempDir, 'output');

    console.log(`Running Python analysis: ${pythonScript}`);
    console.log(`Input: ${imagePath}, Output: ${outputDir}`);

    const pythonProcess = spawn('python', [
      pythonScript,
      '--input', imagePath,
      '--output', outputDir,
      '--format', 'png'
    ]);

    // Wait for the Python process to complete
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        }
      });

      // Add timeout (60 seconds)
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Python analysis timed out after 60 seconds'));
      }, 60000);
    });

    console.log('Python analysis completed');
    console.log('stdout:', result.stdout.substring(0, 200));
    if (result.stderr) {
      console.warn('stderr:', result.stderr);
    }

    // Parse the JSON output from the Python script
    let sctResults;
    try {
      sctResults = JSON.parse(result.stdout);
    } catch (parseError) {
      console.error('Failed to parse Python output:', result.stdout);
      throw new Error(`Failed to parse Python script output: ${parseError}`);
    }

    // If there was an error in the analysis, throw it
    if (sctResults.error) {
      console.warn(`Python Analysis Error: ${sctResults.error}`);
      throw new Error(sctResults.error);
    }

    console.log(`Analysis successful: ${sctResults.vertebrae_detected} vertebrae detected, ${sctResults.findings.length} findings`);

    // Generate Grad-CAM heatmaps using Python landmarks
    console.log('Generating heatmaps from anatomical landmarks...');
    const gradCamHeatmaps = await generateGradCAMHeatmaps(
      imageBuffer,
      sctResults.findings,
      undefined,  // activationData
      sctResults.landmarks  // anatomical landmarks for precise placement
    );

    // Convert results to our AnalysisResults format
    const results = convertSCTResultsToAnalysisResults(sctResults, imageType);
    results.gradCamHeatmaps = gradCamHeatmaps.length > 0 ? gradCamHeatmaps : undefined;

    // Extract precise targets for 3D model mapping
    if (gradCamHeatmaps.length > 0) {
      results.heatmapTargets = gradCamHeatmaps.flatMap(h =>
        h.affectedRegions.map(r => ({
          condition: h.condition,
          region: r.region,
          intensity: r.intensity
        }))
      );
    }

    return results;
  } finally {
    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError);
    }
  }
}

/**
 * Convert SCT analysis results to our internal AnalysisResults format
 * @param sctResults Results from the Spinal Cord Toolbox
 * @param imageType The type of image that was analyzed
 * @returns Formatted AnalysisResults
 */
function convertSCTResultsToAnalysisResults(
  sctResults: any,
  imageType: string
): AnalysisResults {
  // Extract findings from SCT results
  const findings = sctResults.findings || [];

  // Create diagnostic findings for each condition
  const discHerniation = findings.find((f: any) => f.condition === 'Disc Herniation');
  const scoliosis = findings.find((f: any) => f.condition === 'Scoliosis');
  const spinalStenosis = findings.find((f: any) => f.condition === 'Spinal Stenosis');
  const degenerativeDisc = findings.find((f: any) => f.condition === 'Degenerative Disc Disease');
  const vertebralFracture = findings.find((f: any) => f.condition === 'Vertebral Fracture');
  const spondylolisthesis = findings.find((f: any) => f.condition === 'Spondylolisthesis');
  const infection = findings.find((f: any) => f.condition === 'Infection');
  const tumor = findings.find((f: any) => f.condition === 'Tumor');

  // Map findings to our diagnostic format
  const createDiagnosticFinding = (finding: any, defaultCondition: string) => {
    if (!finding) {
      return {
        condition: defaultCondition,
        severity: "normal" as const,
        confidence: 70,
        findings: ["No significant abnormalities detected"],
        recommendations: ["Continue routine monitoring"],
      };
    }

    // Build detailed findings list
    const detailedFindings = [
      `Located at ${finding.location}`,
      `Severity: ${finding.severity}`,
      `Confidence level: ${finding.confidence}%`
    ];

    // Add measurements if available
    if (finding.measurements) {
      Object.entries(finding.measurements).forEach(([key, value]) => {
        detailedFindings.push(`${key.replace(/_/g, ' ')}: ${value}`);
      });
    }

    return {
      condition: finding.condition,
      severity: finding.severity,
      confidence: finding.confidence,
      findings: detailedFindings,
      recommendations: sctResults.recommendations || ["Consult with healthcare provider"],
      measurements: finding.measurements,
    };
  };

  // Generate comprehensive analysis based on findings
  const analysisResults: AnalysisResults = {
    discHerniation: createDiagnosticFinding(discHerniation, "Disc Herniation"),
    scoliosis: createDiagnosticFinding(scoliosis, "Scoliosis"),
    spinalStenosis: createDiagnosticFinding(spinalStenosis, "Spinal Stenosis"),
    degenerativeDisc: createDiagnosticFinding(degenerativeDisc, "Degenerative Disc Disease"),
    vertebralFracture: createDiagnosticFinding(vertebralFracture, "Vertebral Fracture"),
    spondylolisthesis: createDiagnosticFinding(spondylolisthesis, "Spondylolisthesis"),
    infection: createDiagnosticFinding(infection, "Infection"),
    tumor: createDiagnosticFinding(tumor, "Tumor"),

    // Restoring derived analysis cards
    postureSimulation: generatePostureAnalysis(findings, imageType),
    softTissueDegeneration: generateSoftTissueAnalysis(findings),
    hiddenAbnormality: generateHiddenAbnormalityAnalysis(findings),
    bloodFlowAnalysis: generateBloodFlowAnalysis(findings),

    findings: findings.map((f: any) => ({
      condition: f.condition,
      severity: f.severity,
      confidence: f.confidence,
      location: f.location || (f.condition.includes("Disc") ? "Disc" : "Spine"),
      measurements: f.measurements
    })),
    checkedConditions: (sctResults.checked_conditions || []).map((f: any) => ({
      condition: f.condition,
      severity: f.severity,
      confidence: f.confidence,
      location: f.location || "Checked",
      measurements: f.measurements
    })),
    landmarks: sctResults.landmarks,
    mlPredictions: {
      predictions: findings.map((f: any) => ({
        condition: f.condition,
        severity: f.severity,
        confidence: f.confidence,
        modelType: "ResNet-50 [SCT Path]"
      })),
      modelUsed: sctResults.model_architecture || "ResNet-50 Deep Convolutional Neural Network",
      processingTime: sctResults.processing_time || 0
    },
    gradCamHeatmaps: undefined, // Will be set outside
    primaryFinding: sctResults.primary_finding ? {
      condition: sctResults.primary_finding.condition,
      severity: sctResults.primary_finding.severity,
      confidence: sctResults.primary_finding.confidence,
      location: sctResults.primary_finding.location,
      measurements: sctResults.primary_finding.measurements
    } : undefined,
  };

  return analysisResults;
}
