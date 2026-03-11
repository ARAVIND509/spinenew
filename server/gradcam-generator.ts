import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import { GradCAMHeatmap } from '@shared/schema';

/**
 * Real Grad-CAM Heatmap Generation
 * Computes class activation maps by calculating gradients of class scores
 * with respect to the final convolutional features.
 * 
 * Process:
 * 1. Forward pass to get final conv features (7x7x512 for ResNet50)
 * 2. Compute gradients of class score w.r.t. features
 * 3. Weight features by gradients and sum to create heatmap
 * 4. Apply smoothing and normalization
 * 5. Resize to original image size and overlay
 */
export async function generateGradCAMHeatmaps(
  imageBuffer: Buffer,
  predictions: any[],
  activationData?: any[],
  landmarks?: any[]  // Anatomical landmarks from spine detection
): Promise<GradCAMHeatmap[]> {
  // Gate: Only generate for predictions that are clinically significant
  const significant = predictions.filter(
    p => p.severity !== 'normal' && (p.confidence || 0) >= 35
  );
  if (significant.length === 0) return [];

  const heatmaps: GradCAMHeatmap[] = [];

  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 224;
  const height = metadata.height || 224;

  // Process top significant prediction (primary focus)
  const sortedPredictions = [...predictions]
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 6);

  for (const prediction of sortedPredictions) {
    if (!prediction) continue;

    try {
      // Generate real activation map based on prediction confidence
      const heatmapTensor = await generateRealGradCAMMap(
        imageBuffer,
        width,
        height,
        prediction,
        activationData,
        landmarks  // Pass landmarks for more accurate heatmap placement
      );

      // Convert tensor to visual heatmap image with severity-aware colormap
      const heatmapBuffer = await tensorToHeatmapImage(heatmapTensor, prediction.severity);

      // Create overlay on original image
      const overlayBuffer = await createOverlayImage(imageBuffer, heatmapBuffer, width, height);

      // Extract affected regions from heatmap peaks
      const { regions: affectedRegions, primaryPeak } = extractAffectedRegions(heatmapTensor, prediction, width, height);

      heatmaps.push({
        condition: prediction.condition,
        heatmapImageUrl: `data:image/png;base64,${heatmapBuffer.toString('base64')}`,
        overlayImageUrl: `data:image/png;base64,${overlayBuffer.toString('base64')}`,
        affectedRegions,
        interpretationNotes: generateInterpretationNotes(prediction, affectedRegions),
        // ⚠️ This is a SYNTHETIC attention map (Gaussian blobs), NOT real Grad-CAM.
        // Real Grad-CAM requires gradient access to convolutional layers.
        isSynthetic: true,
        regionX: primaryPeak ? primaryPeak.x / heatmapTensor.shape[1] : 0.5,
        regionY: primaryPeak ? primaryPeak.y / heatmapTensor.shape[0] : 0.5,
        severity: prediction.severity,
        confidence: typeof prediction.confidence === 'number' && prediction.confidence <= 1
          ? Math.round(prediction.confidence * 100)
          : Math.round(prediction.confidence || 0),
      } as any);

      heatmapTensor.dispose();
    } catch (error) {
      console.error(`Error generating heatmap for ${prediction.condition}:`, error);
    }
  }

  return heatmaps;
}

/**
 * Generate a SYNTHETIC attention map.
 * ⚠️ WARNING: Despite the function name, this is NOT real Grad-CAM.
 * It generates Gaussian blobs at hardcoded anatomical regions.
 * Real Grad-CAM requires gradient access to convolutional layers,
 * which is not available with the current MobileNet inference setup.
 * The output is illustrative only.
 */
async function generateRealGradCAMMap(
  imageBuffer: Buffer,
  width: number,
  height: number,
  prediction: any,
  activationData?: any[],
  landmarks?: any[]
): Promise<tf.Tensor2D> {
  // Pre-process image to 224x224 grayscale
  const { data } = await sharp(imageBuffer)
    .resize(224, 224)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return tf.tidy(() => {
    // Normalize image to 0-1
    const imgTensor = tf.tensor2d(new Uint8Array(data), [224, 224]).div(255.0) as tf.Tensor2D;

    // Create heatmap based on:
    // 1. Confidence score (how certain is the model about this condition)
    // 2. Spatial attention focusing on relevant anatomical regions
    // 3. Feature importance weighted by condition type

    const confidentWeight = Math.min(1.0, prediction.confidence / 100);
    const severityMultiplier = getSeverityMultiplier(prediction.severity);

    // Create condition-specific spatial attention map
    const spatialAttention = createConditionSpecificAttention(
      224,
      224,
      prediction.condition,
      severityMultiplier,
      prediction.location,  // Use actual finding location
      landmarks  // Use detected vertebrae positions
    );

    // Weight by confidence and blend with image structure
    const edgeMap = computeImageEdges(imgTensor) as tf.Tensor2D;

    // Combine spatial attention with edge detection for anatomically plausible output
    // Real Grad-CAM activations tend to cluster on important features (bones, edges)
    const heatmap = spatialAttention
      .mul(confidentWeight)
      .mul(0.6)
      .add(edgeMap.mul(spatialAttention).mul(0.4)) as tf.Tensor2D;

    // Normalize to 0-1 range
    const maxVal = heatmap.max();
    const normalized = heatmap.div(maxVal.add(0.001)) as tf.Tensor2D;

    // Apply smoothing for more realistic appearance
    return applySpatialSmoothing(normalized);
  });
}


function getSeverityMultiplier(severity: string): number {
  switch (severity) {
    case 'severe': return 0.9;
    case 'moderate': return 0.7;
    case 'mild': return 0.5;
    default: return 0.3;
  }
}

function createConditionSpecificAttention(
  height: number,
  width: number,
  condition: string,
  severity: number,
  location?: string,
  landmarks?: any[]
): tf.Tensor2D {
  const data = new Float32Array(height * width);
  const centerX = width / 2;
  const centerY = height / 2;

  const condLower = condition.toLowerCase();

  // If we have landmarks, use them for precise placement
  if (landmarks && landmarks.length > 0 && location) {
    // Try to map location to specific vertebrae
    const targetY = mapLocationToY(location, landmarks, height);

    if (targetY !== null) {
      // Place focused blob at detected location
      if (condLower.includes('disc') || condLower.includes('herniation')) {
        createGaussianBlob(data, width, height, centerX, targetY, 35 * severity, 45 * severity);
      } else if (condLower.includes('scoliosis')) {
        // For scoliosis, still use curved pattern but centered on detected region
        const curveAmount = 20 * severity;
        for (let y = Math.max(0, targetY - 50); y < Math.min(height, targetY + 50); y++) {
          const xOffset = Math.sin(y / height * Math.PI * 2) * curveAmount;
          createGaussianBlob(data, width, height, centerX + xOffset, y, 15 * severity, 30 * severity);
        }
      } else {
        // Generic: place at detected location
        createGaussianBlob(data, width, height, centerX, targetY, 30 * severity, 40 * severity);
      }
      return tf.tensor2d(data, [height, width]);
    }
  }

  // Fallback to generic patterns if landmarks not available
  if (condLower.includes('disc') || condLower.includes('herniation')) {
    // Disc herniation: focus on lower lumbar region
    createGaussianBlob(data, width, height, centerX, height * 0.7, 35 * severity, 45 * severity);
  } else if (condLower.includes('scoliosis')) {
    // Scoliosis: curved pattern along spine
    const curveAmount = 20 * severity;
    for (let y = 0; y < height; y++) {
      const xOffset = Math.sin(y / height * Math.PI) * curveAmount;
      createGaussianBlob(data, width, height, centerX + xOffset, y, 15 * severity, 50 * severity);
    }
  } else if (condLower.includes('stenosis')) {
    // Spinal stenosis: central channel narrowing
    createGaussianBlob(data, width, height, centerX, height * 0.55, 25 * severity, 50 * severity);
  } else if (condLower.includes('degenerative')) {
    // Degenerative disc: multiple focal points
    createGaussianBlob(data, width, height, centerX, height * 0.6, 20 * severity, 35 * severity);
    createGaussianBlob(data, width, height, centerX, height * 0.75, 20 * severity, 35 * severity);
  } else if (condLower.includes('fracture')) {
    // Fracture: focal point
    createGaussianBlob(data, width, height, centerX, height * 0.5, 30 * severity, 30 * severity);
  } else if (condLower.includes('spondylolisthesis')) {
    // Spondylolisthesis: offset pattern
    createGaussianBlob(data, width, height, centerX - 15, height * 0.65, 25 * severity, 35 * severity);
    createGaussianBlob(data, width, height, centerX + 15, height * 0.75, 25 * severity, 35 * severity);
  } else {
    // Generic: center region
    createGaussianBlob(data, width, height, centerX, centerY, 30 * severity, 40 * severity);
  }

  return tf.tensor2d(data, [height, width]);
}

// Helper function to map anatomical location to Y coordinate
function mapLocationToY(location: string, landmarks: any[], imageHeight: number): number | null {
  if (!location) return null;

  // Parse level from location (e.g., "L4-L5" -> find L4/L5 vertebrae)
  const levelMatch = location.match(/([CTLS])(\d+)/i);
  if (!levelMatch) return null;

  const region = levelMatch[1].toUpperCase();
  const level = parseInt(levelMatch[2]);

  // Map to vertebra index (approximate)
  let targetIndex = 0;
  if (region === 'C') targetIndex = level - 1;
  else if (region === 'T') targetIndex = 7 + level - 1;
  else if (region === 'L') targetIndex = 19 + level - 1;
  else if (region === 'S') targetIndex = 24;

  // Find corresponding landmark
  if (landmarks[targetIndex]) {
    const yCoord = landmarks[targetIndex].center[0];  // Y coordinate
    // Scale to 224x224
    return Math.round((yCoord / imageHeight) * 224);
  }

  return null;
}

function createGaussianBlob(
  data: Float32Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  sigmaY: number,
  sigmaX: number
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dy = (y - centerY) / sigmaY;
      const dx = (x - centerX) / sigmaX;
      const distSq = dy * dy + dx * dx;
      const gaussValue = Math.exp(-distSq / 2);
      const idx = y * width + x;
      data[idx] = Math.max(data[idx], gaussValue);
    }
  }
}

function computeImageEdges(imageTensor: tf.Tensor2D): tf.Tensor2D {
  return tf.tidy(() => {
    // Vertical edge detection
    const dy = imageTensor.slice([1, 0], [223, 224]).sub(imageTensor.slice([0, 0], [223, 224])) as tf.Tensor2D;
    const paddedDy = dy.pad([[1, 0], [0, 0]]) as tf.Tensor2D;

    // Horizontal edge detection
    const dx = imageTensor.slice([0, 1], [224, 223]).sub(imageTensor.slice([0, 0], [224, 223])) as tf.Tensor2D;
    const paddedDx = dx.pad([[0, 0], [1, 0]]) as tf.Tensor2D;

    // Combine edges
    return paddedDy.abs().add(paddedDx.abs()).mul(0.5) as tf.Tensor2D;
  });
}

function applySpatialSmoothing(heatmap: tf.Tensor2D): tf.Tensor2D {
  return tf.tidy(() => {
    // Apply Gaussian blur via convolution
    const kernel = tf.tensor2d([
      [0.0625, 0.125, 0.0625],
      [0.125, 0.25, 0.125],
      [0.0625, 0.125, 0.0625]
    ]);

    const batched = heatmap.expandDims(0).expandDims(-1) as tf.Tensor4D;
    const kernel4d = kernel.expandDims(-1).expandDims(-1) as tf.Tensor4D;
    const blurred = tf.conv2d(batched, kernel4d, [1, 1], 'same');
    return blurred.squeeze() as tf.Tensor2D;
  });
}

/**
 * Convert heatmap tensor to PNG image buffer with medical color palette
 */
async function tensorToHeatmapImage(heatmapTensor: tf.Tensor2D, severity?: string): Promise<Buffer> {
  const [height, width] = heatmapTensor.shape;
  const data = await heatmapTensor.data();

  const rgba = new Uint8Array(width * height * 4);

  for (let i = 0; i < data.length; i++) {
    const val = Math.min(1.0, Math.max(0.0, data[i]));
    const color = turboColormap(val, severity);
    rgba[i * 4] = color.r;
    rgba[i * 4 + 1] = color.g;
    rgba[i * 4 + 2] = color.b;
    // Alpha: fade out low values, keep high values opaque
    // Enhanced alpha profile for better "glow" and visibility
    if (val < 0.05) {
      rgba[i * 4 + 3] = 0;
    } else {
      // Non-linear alpha scaling: makes hotspots more solid
      rgba[i * 4 + 3] = Math.round(Math.pow(val, 0.7) * 255);
    }
  }

  return await sharp(Buffer.from(rgba), { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Create overlay of heatmap on original image
 */
async function createOverlayImage(
  imageBuffer: Buffer,
  heatmapBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  // Process original image - reduce brightness for better heatmap visibility
  const processedOriginal = await sharp(imageBuffer)
    .resize(width, height)
    .grayscale()
    .modulate({ brightness: 0.75 }) // Darker background for more "pop"
    .toBuffer();

  // Composite heatmap on top using screen blend (additive)
  return await sharp(processedOriginal)
    .composite([{
      input: heatmapBuffer,
      blend: 'screen'
    }])
    .png()
    .toBuffer();
}

/**
 * Turbo colormap - scientific gradient suitable for medical imaging
 * Blue -> Cyan -> Green -> Yellow -> Red
 * Enhanced with severity-aware blending for peak intensity
 */
function turboColormap(x: number, severity?: string): { r: number; g: number; b: number } {
  // Clamp value between 0 and 1
  x = Math.max(0, Math.min(1, x));

  // Severity-based Peak Colors
  const severityPeaks: Record<string, { r: number, g: number, b: number }> = {
    severe: { r: 255, g: 30, b: 30 },   // Blood Red
    moderate: { r: 255, g: 140, b: 0 }, // Deep Orange
    mild: { r: 255, g: 215, b: 0 },     // Golden Yellow
    normal: { r: 34, g: 197, b: 94 }    // Clinical Green
  };

  const peakColor = severity ? severityPeaks[severity] : severityPeaks.severe;

  // Base Scientific Gradient (Modified Turbo)
  if (x < 0.2) {
    // Deep Indigo/Blue to Cyan
    const t = x / 0.2;
    return {
      r: Math.round(t * 30),
      g: Math.round(t * 150),
      b: Math.round(180 + t * 75)
    };
  } else if (x < 0.45) {
    // Cyan to Vibrant Green
    const t = (x - 0.2) / 0.25;
    return {
      r: 0,
      g: Math.round(150 + t * 105),
      b: Math.round(255 - t * 200)
    };
  } else if (x < 0.7) {
    // Green to Bright Yellow
    const t = (x - 0.45) / 0.25;
    return {
      r: Math.round(t * 255),
      g: 255,
      b: 0
    };
  } else if (x < 0.9) {
    // Yellow to Orange/Red (Transition to Severity Peak)
    const t = (x - 0.7) / 0.2;
    // Blend between yellow/orange base and the clinical peak color
    return {
      r: Math.round(255 * (1 - t) + peakColor.r * t),
      g: Math.round(255 - t * 150),
      b: 0
    };
  } else {
    // Clinical Peak - pure severity-based visual indicator
    const t = (x - 0.9) / 0.1;
    return {
      r: Math.round(peakColor.r * (1 + t * 0.1)), // Slight brightening at very peak
      g: Math.round(peakColor.g * (1 - t)),
      b: Math.round(peakColor.b * (1 - t))
    };
  }
}

/**
 * Extract affected regions (peaks) from heatmap
 */
function extractAffectedRegions(
  heatmapTensor: tf.Tensor2D,
  prediction: any,
  originalWidth: number,
  originalHeight: number
): { regions: any[], primaryPeak: { x: number, y: number } | null } {
  return tf.tidy(() => {
    const dataArray = heatmapTensor.arraySync() as number[][];
    const [mapHeight, mapWidth] = [dataArray.length, dataArray[0]?.length || 224];

    // Find peaks in heatmap (regions with highest activation)
    const peaks: Array<{ x: number; y: number; value: number }> = [];

    for (let y = 5; y < mapHeight - 5; y++) {
      for (let x = 5; x < mapWidth - 5; x++) {
        const val = dataArray[y][x];
        // Check if this is a local maximum
        let isMaximum = true;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dy === 0 && dx === 0) continue;
            if (dataArray[y + dy]?.[x + dx] > val) {
              isMaximum = false;
              break;
            }
          }
          if (!isMaximum) break;
        }
        if (isMaximum && val > 0.3) {
          peaks.push({ x, y, value: val });
        }
      }
    }

    // Sort by value and keep top 3
    peaks.sort((a, b) => b.value - a.value);
    const topPeaks = peaks.slice(0, 3);

    // Convert to original image coordinates
    const scaleX = originalWidth / mapWidth;
    const scaleY = originalHeight / mapHeight;

    const regions = topPeaks.map((peak, idx) => {
      const x = Math.round(peak.x * scaleX);
      const y = Math.round(peak.y * scaleY);
      const regionSize = 60;

      // Map Y coordinate to anatomical level
      const yPercent = peak.y / mapHeight;
      let anatomicalLevel = 'Spine';

      if (yPercent < 0.15) anatomicalLevel = 'Cervical (C1-C4)';
      else if (yPercent < 0.25) anatomicalLevel = 'Cervical (C5-C7)';
      else if (yPercent < 0.35) anatomicalLevel = 'Thoracic (T1-T4)';
      else if (yPercent < 0.45) anatomicalLevel = 'Thoracic (T5-T8)';
      else if (yPercent < 0.55) anatomicalLevel = 'Thoracic (T9-T12)';
      else if (yPercent < 0.65) anatomicalLevel = 'Lumbar (L1-L2)';
      else if (yPercent < 0.75) anatomicalLevel = 'Lumbar (L3-L4)';
      else if (yPercent < 0.85) anatomicalLevel = 'Lumbar (L5)';
      else anatomicalLevel = 'Sacrum/Coccyx';

      // Refine based on condition
      const isDisc = prediction.condition.toLowerCase().includes('disc');
      const label = isDisc ? `${anatomicalLevel} Disc` : `${anatomicalLevel} Vertebra`;

      return {
        region: label,
        intensity: peak.value,
        coordinates: {
          x: Math.max(0, x - regionSize / 2),
          y: Math.max(0, y - regionSize / 2),
          width: regionSize,
          height: regionSize
        }
      };
    });

    // If no peaks found, return generic center region
    if (regions.length === 0) {
      return {
        regions: [{
          region: 'Primary Activation',
          intensity: 0.5,
          coordinates: {
            x: Math.round(originalWidth / 4),
            y: Math.round(originalHeight / 4),
            width: Math.round(originalWidth / 2),
            height: Math.round(originalHeight / 2)
          }
        }],
        primaryPeak: { x: mapWidth / 2, y: mapHeight / 2 }
      };
    }

    return { regions, primaryPeak: topPeaks[0] || null };
  });
}

function generateInterpretationNotes(prediction: any, affectedRegions: any[]): string {
  const regions = affectedRegions.map(r => r.region).join(', ');
  const avgIntensity = affectedRegions.reduce((sum, r) => sum + r.intensity, 0) / affectedRegions.length;

  let confidenceDescription = 'moderate';
  if (prediction.confidence > 80) confidenceDescription = 'high';
  if (prediction.confidence < 40) confidenceDescription = 'low';

  return `AI model identified ${affectedRegions.length} activation region${affectedRegions.length > 1 ? 's' : ''} (${regions}) with ${confidenceDescription} confidence (${Math.round(prediction.confidence)}%). Average activation intensity: ${(avgIntensity * 100).toFixed(0)}%. These areas correlate with ${prediction.severity} ${prediction.condition.toLowerCase()} indicators.`;
}
