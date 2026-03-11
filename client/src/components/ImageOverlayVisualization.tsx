import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ImageOverlayVisualizationProps {
  imageUrl: string;
  affectedRegions?: string[];
  severity?: string;
  mode?: "original" | "overlay";
  riskZones?: string[];
  mlPredictions?: any[];
}

export function ImageOverlayVisualization({
  imageUrl,
  affectedRegions = [],
  severity = "normal",
  mode = "original",
  riskZones = [],
  mlPredictions = [],
}: ImageOverlayVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imageLoaded || !imageRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imageRef.current;

    // Set canvas size to match image
    canvas.width = 600;
    canvas.height = 700;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Apply transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Draw the original image centered
    const aspectRatio = img.width / img.height;
    let drawWidth = canvas.width * 0.8;
    let drawHeight = drawWidth / aspectRatio;

    if (drawHeight > canvas.height * 0.8) {
      drawHeight = canvas.height * 0.8;
      drawWidth = drawHeight * aspectRatio;
    }

    ctx.drawImage(
      img,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    // Apply overlay for affected regions if in overlay mode
    if (mode === "overlay") {
      // First, apply a very subtle base tint to the entire image
      ctx.globalAlpha = 0.08;
      const baseGradient = ctx.createLinearGradient(0, -drawHeight / 2, 0, drawHeight / 2);
      baseGradient.addColorStop(0, "rgba(59, 130, 246, 0.1)"); // Light blue tint
      baseGradient.addColorStop(1, "rgba(59, 130, 246, 0.05)");
      ctx.fillStyle = baseGradient;
      ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

      // Create enhanced medical-grade heatmap overlays based on predictions
      mlPredictions.forEach((prediction) => {
        if (prediction.severity !== "normal" && prediction.confidence >= 40) {
          // Determine region position and size based on condition type
          let regionY = 0;
          let regionHeight = drawHeight / 3;
          let centerY = 0;

          if (prediction.condition.toLowerCase().includes("disc") ||
            prediction.condition.toLowerCase().includes("degenerative")) {
            // Lumbar region (lower third)
            regionY = drawHeight / 6;
            centerY = regionY + regionHeight / 2;
          } else if (prediction.condition.toLowerCase().includes("scoliosis") ||
            prediction.condition.toLowerCase().includes("stenosis")) {
            // Thoracic region (middle third)
            regionY = -regionHeight / 2;
            centerY = regionY + regionHeight / 2;
          } else {
            // Cervical region (upper third) or full spine
            regionY = -drawHeight / 3;
            centerY = regionY + regionHeight / 2;
          }

          // Enhanced heatmap with medical-grade color mapping
          const confidenceFactor = prediction.confidence / 100;
          const regionWidth = drawWidth * 0.7;
          const regionX = -regionWidth / 2;

          // Create a more sophisticated heatmap using multiple gradients
          // Use a medical-grade color scheme (blue -> green -> yellow -> red)
          const heatmapGradient = ctx.createLinearGradient(regionX, centerY, regionX + regionWidth, centerY);

          // Define color stops based on severity and confidence
          switch (prediction.severity.toLowerCase()) {
            case "severe":
              heatmapGradient.addColorStop(0, `rgba(0, 0, 255, ${0.3 * confidenceFactor})`);      // Blue
              heatmapGradient.addColorStop(0.4, `rgba(0, 255, 255, ${0.5 * confidenceFactor})`);  // Cyan
              heatmapGradient.addColorStop(0.6, `rgba(0, 255, 0, ${0.6 * confidenceFactor})`);    // Green
              heatmapGradient.addColorStop(0.8, `rgba(255, 255, 0, ${0.7 * confidenceFactor})`);  // Yellow
              heatmapGradient.addColorStop(1, `rgba(255, 0, 0, ${0.8 * confidenceFactor})`);      // Red
              break;
            case "moderate":
              heatmapGradient.addColorStop(0, `rgba(0, 100, 0, ${0.2 * confidenceFactor})`);       // Dark Green
              heatmapGradient.addColorStop(0.5, `rgba(255, 255, 0, ${0.4 * confidenceFactor})`);  // Yellow
              heatmapGradient.addColorStop(1, `rgba(255, 165, 0, ${0.6 * confidenceFactor})`);    // Orange
              break;
            case "mild":
              heatmapGradient.addColorStop(0, `rgba(0, 100, 0, ${0.15 * confidenceFactor})`);      // Dark Green
              heatmapGradient.addColorStop(0.7, `rgba(144, 238, 144, ${0.3 * confidenceFactor})`); // Light Green
              heatmapGradient.addColorStop(1, `rgba(255, 255, 0, ${0.4 * confidenceFactor})`);    // Yellow
              break;
            default:
              heatmapGradient.addColorStop(0, `rgba(0, 100, 0, ${0.1 * confidenceFactor})`);
              heatmapGradient.addColorStop(1, `rgba(0, 255, 0, ${0.2 * confidenceFactor})`);
          }

          // Draw the heatmap overlay with enhanced visualization
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = heatmapGradient;

          // Draw a more anatomically accurate overlay shape
          ctx.beginPath();
          ctx.ellipse(0, centerY, regionWidth / 2, regionHeight / 2.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Add a subtle glow effect for medical visualization
          ctx.shadowColor = prediction.severity === 'severe' ?
            'rgba(255, 0, 0, 0.6)' :
            prediction.severity === 'moderate' ?
              'rgba(255, 165, 0, 0.5)' :
              'rgba(255, 255, 0, 0.4)';
          ctx.shadowBlur = prediction.severity === 'severe' ? 15 :
            prediction.severity === 'moderate' ? 10 : 5;

          // Draw a subtle border to highlight the region
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = prediction.severity === 'severe' ?
            'rgba(255, 0, 0, 0.7)' :
            prediction.severity === 'moderate' ?
              'rgba(255, 165, 0, 0.6)' :
              'rgba(255, 255, 0, 0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Reset shadow
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;

          // Add condition label with medical-grade styling
          const labelText = `${prediction.condition} (${prediction.confidence}%)`;
          ctx.font = "bold 16px Arial";
          ctx.textAlign = "center";

          // Measure text for background
          const textMetrics = ctx.measureText(labelText);
          const textWidth = textMetrics.width;
          const textHeight = 20;
          const padding = 10;

          // Draw a medical-grade label background
          const labelGradient = ctx.createLinearGradient(
            -textWidth / 2 - padding,
            centerY - textHeight / 2 - padding,
            -textWidth / 2 - padding,
            centerY + textHeight / 2 + padding
          );
          labelGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
          labelGradient.addColorStop(1, 'rgba(50, 50, 50, 0.8)');

          ctx.fillStyle = labelGradient;
          // Draw rounded rectangle for label background
          ctx.beginPath();
          const radius = 8;
          const x = -textWidth / 2 - padding;
          const y = centerY - textHeight / 2 - padding;
          const width = textWidth + padding * 2;
          const height = textHeight + padding * 2;

          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + width - radius, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
          ctx.lineTo(x + width, y + height - radius);
          ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
          ctx.lineTo(x + radius, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();

          // Draw label text with enhanced contrast
          ctx.fillStyle = "#ffffff";
          ctx.fillText(labelText, 0, centerY + 5);

          // Add a severity indicator with medical iconography
          ctx.beginPath();
          ctx.arc(-textWidth / 2 - padding - 12, centerY, 6, 0, Math.PI * 2);

          // Color based on severity
          switch (prediction.severity.toLowerCase()) {
            case "severe":
              ctx.fillStyle = "#ff1a1a"; // vibrant red
              break;
            case "moderate":
              ctx.fillStyle = "#f97316"; // orange-500
              break;
            case "mild":
              ctx.fillStyle = "#eab308"; // yellow-500
              break;
            default:
              ctx.fillStyle = "#22c55e"; // green-500
          }
          ctx.fill();

          // Add scanning crosshair/reticle over the center
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-20, centerY); ctx.lineTo(-5, centerY);
          ctx.moveTo(5, centerY); ctx.lineTo(20, centerY);
          ctx.moveTo(0, centerY - 20); ctx.lineTo(0, centerY - 5);
          ctx.moveTo(0, centerY + 5); ctx.lineTo(0, centerY + 20);
          ctx.stroke();

          // Add inner circle for visual enhancement
          ctx.beginPath();
          ctx.arc(-textWidth / 2 - padding - 12, centerY, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
      });

      // Add anatomical grid overlay for "creative" technical feel
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 0.5;
      for (let i = -drawWidth / 2; i <= drawWidth / 2; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, -drawHeight / 2); ctx.lineTo(i, drawHeight / 2);
        ctx.stroke();
      }
      for (let i = -drawHeight / 2; i <= drawHeight / 2; i += 40) {
        ctx.beginPath();
        ctx.moveTo(-drawWidth / 2, i); ctx.lineTo(drawWidth / 2, i);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [imageLoaded, zoom, rotation, mode, mlPredictions, affectedRegions, severity]);

  const displayTitle = mode === "original"
    ? "Original Spinal Scan"
    : "Affected Regions Highlighted";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl">{displayTitle}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "original"
                ? "Unmodified medical imaging scan"
                : "AI-detected abnormalities highlighted with RGB overlays"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((prev) => Math.min(prev + 0.2, 3))}
              data-testid={`button-zoom-in-${mode}`}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((prev) => Math.max(prev - 0.2, 0.5))}
              data-testid={`button-zoom-out-${mode}`}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              data-testid={`button-rotate-${mode}`}
              title="Rotate 90°"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[1fr,auto] gap-6">
          <div className="relative bg-gradient-to-br from-muted/50 to-muted rounded-lg p-6 border overflow-hidden">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-muted-foreground">Loading image...</div>
              </div>
            )}
            <div className="w-full max-w-full overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={600}
                height={700}
                className="max-w-full h-auto"
                data-testid={`canvas-image-${mode}`}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Color Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-white/20 shadow-[0_0_8px_rgba(34,197,94,0.5)]" style={{ backgroundColor: "#22c55e" }}></div>
                  <Badge variant="secondary" className="text-[10px] font-bold">NORMAL_BASE</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-white/20 shadow-[0_0_8px_rgba(234,179,8,0.5)]" style={{ backgroundColor: "#eab308" }}></div>
                  <Badge variant="secondary" className="text-[10px] font-bold">MILD_INFLAM</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-white/20 shadow-[0_0_8px_rgba(249,115,22,0.5)]" style={{ backgroundColor: "#f97316" }}></div>
                  <Badge variant="secondary" className="text-[10px] font-bold">MODERATE_RISK</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-white/20 shadow-[0_0_12px_rgba(255,26,26,0.8)] animate-pulse" style={{ backgroundColor: "#ff1a1a" }}></div>
                  <Badge variant="secondary" className="text-[10px] font-bold">CRITICAL_DANGER</Badge>
                </div>
              </div>
            </div>
            {mode === "overlay" && affectedRegions.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="font-semibold text-sm">Evaluated Conditions</h4>
                <div className="space-y-1">
                  {mlPredictions
                    .filter((p) => p.severity !== "normal" && p.confidence >= 40)
                    .map((prediction, idx) => (
                      <div key={idx} className="text-xs">
                        <Badge
                          variant={
                            prediction.severity === "severe"
                              ? "destructive"
                              : prediction.severity === "moderate"
                                ? "default"
                                : "secondary"
                          }
                          className="text-xs mb-1"
                        >
                          {prediction.condition}
                        </Badge>
                        <div className="text-muted-foreground ml-1">
                          {prediction.confidence}% confidence
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {mode === "overlay" && riskZones.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="font-semibold text-sm">Risk Zones</h4>
                <div className="space-y-1">
                  {riskZones.map((zone, idx) => (
                    <Badge key={idx} variant="destructive" className="text-xs">
                      {zone}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent >
    </Card >
  );
}
