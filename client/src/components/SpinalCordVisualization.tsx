import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCw, ZoomIn, ZoomOut, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SpinalCordVisualizationProps {
  severity?: string;
  affectedRegions?: string[];
  mode?: "normal" | "affected";
  postureData?: {
    cervical: number;
    thoracic: number;
    lumbar: number;
  };
  title?: string;
}

export function SpinalCordVisualization({ 
  severity = "normal", 
  affectedRegions = [],
  mode = "normal",
  postureData,
  title
}: SpinalCordVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawSpinalCord = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseWidth = 45 * zoom;
      const segmentHeight = 22 * zoom;
      const vertebrae = 24;

      ctx.save();
      ctx.translate(centerX, centerY);
      
      const rotationRad = (rotation * Math.PI) / 180;
      const perspective = Math.cos(rotationRad);

      // Calculate curvature effects based on mode
      const isAffectedMode = mode === "affected";
      const cervicalCurvature = isAffectedMode && postureData ? postureData.cervical : 0;
      const thoracicCurvature = isAffectedMode && postureData ? postureData.thoracic : 0;
      const lumbarCurvature = isAffectedMode && postureData ? postureData.lumbar : 0;

      // Draw region labels
      const regions = [
        { name: "C1-C7", y: -250 * zoom, region: "cervical" },
        { name: "T1-T12", y: -50 * zoom, region: "thoracic" },
        { name: "L1-L5", y: 180 * zoom, region: "lumbar" }
      ];

      ctx.font = `bold ${12 * zoom}px Arial`;
      ctx.textAlign = "right";
      regions.forEach(({ name, y, region }) => {
        const isAffected = isAffectedMode && affectedRegions.some(r => 
          r.toLowerCase().includes(region) || region.includes(r.toLowerCase())
        );
        ctx.fillStyle = isAffected ? "#dc2626" : "#71717a";
        ctx.fillText(name, -60 * zoom, y);
      });

      for (let i = 0; i < vertebrae; i++) {
        const baseY = (i - vertebrae / 2) * segmentHeight;
        let y = baseY;
        let xOffset = 0;
        
        // Apply curvature deformations based on region and disease data
        let region = "";
        let label = "";
        let curvature = 0;
        
        if (i < 7) {
          region = "cervical";
          label = `C${i + 1}`;
          curvature = cervicalCurvature;
          // Cervical curvature - forward curve
          xOffset = isAffectedMode ? Math.sin((i / 7) * Math.PI) * (curvature / 90) * 30 * zoom : 0;
        } else if (i < 19) {
          region = "thoracic";
          label = `T${i - 6}`;
          curvature = thoracicCurvature;
          // Thoracic curvature - backward curve (kyphosis)
          xOffset = isAffectedMode ? -Math.sin(((i - 7) / 12) * Math.PI) * (curvature / 90) * 40 * zoom : 0;
        } else {
          region = "lumbar";
          label = `L${i - 18}`;
          curvature = lumbarCurvature;
          // Lumbar curvature - forward curve (lordosis)
          xOffset = isAffectedMode ? Math.sin(((i - 19) / 5) * Math.PI) * (curvature / 90) * 35 * zoom : 0;
        }

        const isAffected = isAffectedMode && affectedRegions.some(r => 
          r.toLowerCase().includes(region) || 
          region.includes(r.toLowerCase())
        );

        // Calculate width compression for affected regions
        let widthMultiplier = 1;
        if (isAffected) {
          if (severity === "severe") {
            widthMultiplier = 0.75; // 25% compression
          } else if (severity === "moderate") {
            widthMultiplier = 0.85; // 15% compression
          } else if (severity === "mild") {
            widthMultiplier = 0.92; // 8% compression
          }
        }

        const width = baseWidth * (1 - Math.abs(i - vertebrae / 2) / vertebrae * 0.25) * widthMultiplier;
        const depth = width * 0.7 * Math.abs(perspective);

        // Enhanced color scheme with gradients
        let baseColor, lightColor, darkColor;
        if (isAffected) {
          if (severity === "severe") {
            baseColor = "#dc2626";
            lightColor = "#ef4444";
            darkColor = "#991b1b";
          } else if (severity === "moderate") {
            baseColor = "#ea580c";
            lightColor = "#f97316";
            darkColor = "#c2410c";
          } else {
            baseColor = "#ca8a04";
            lightColor = "#eab308";
            darkColor = "#a16207";
          }
        } else {
          baseColor = "#52525b";
          lightColor = "#71717a";
          darkColor = "#3f3f46";
        }

        ctx.save();
        ctx.translate(xOffset, 0);

        // Draw top ellipse with gradient
        const gradient = ctx.createRadialGradient(width * 0.2, y - depth * 0.3, 0, 0, y, width);
        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(1, baseColor);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, y, width / 2, depth / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw vertebra body with shading
        const bodyGradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
        bodyGradient.addColorStop(0, darkColor);
        bodyGradient.addColorStop(0.5, baseColor);
        bodyGradient.addColorStop(1, darkColor);
        
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(-width / 2, y - segmentHeight / 2, width, segmentHeight);
        
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-width / 2, y - segmentHeight / 2, width, segmentHeight);

        // Add vertebra label
        if (i % 2 === 0) {
          ctx.fillStyle = "#ffffff";
          ctx.font = `${8 * zoom}px Arial`;
          ctx.textAlign = "center";
          ctx.fillText(label, 0, y + 2);
        }

        // Draw intervertebral disc
        if (i < vertebrae - 1) {
          ctx.strokeStyle = isAffected ? "#7f1d1d" : "#71717a";
          ctx.lineWidth = isAffected ? 1.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(0, y + segmentHeight / 2);
          ctx.lineTo(0, y + segmentHeight);
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.restore();
    };

    drawSpinalCord();
  }, [rotation, zoom, severity, affectedRegions, mode, postureData]);

  useEffect(() => {
    if (isPaused) return;
    
    const animate = () => {
      setRotation((prev) => (prev + 0.5) % 360);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused]);

  const displayTitle = title || (mode === "normal" ? "Original (Healthy) Posture" : "Affected Posture with Disease Impact");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl">{displayTitle}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "normal" 
                ? "Normal vertebral column alignment" 
                : "Deformations from predicted conditions"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsPaused(!isPaused)}
              data-testid={`button-pause-rotation-${mode}`}
              title={isPaused ? "Resume rotation" : "Pause rotation"}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((prev) => Math.min(prev + 0.1, 2))}
              data-testid={`button-zoom-in-${mode}`}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.5))}
              data-testid={`button-zoom-out-${mode}`}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRotation(0)}
              data-testid={`button-reset-rotation-${mode}`}
              title="Reset rotation"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[1fr,auto] gap-6">
          <div className="relative bg-gradient-to-br from-muted/50 to-muted rounded-lg p-6 border">
            <canvas
              ref={canvasRef}
              width={500}
              height={650}
              className="mx-auto"
              data-testid={`canvas-3d-spine-${mode}`}
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Severity Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: "#52525b" }}></div>
                  <Badge variant="secondary" className="text-xs">Normal</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: "#eab308" }}></div>
                  <Badge variant="secondary" className="text-xs">Mild</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: "#f97316" }}></div>
                  <Badge variant="secondary" className="text-xs">Moderate</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: "#ef4444" }}></div>
                  <Badge variant="secondary" className="text-xs">Severe</Badge>
                </div>
              </div>
            </div>
            {mode === "affected" && (
              <>
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-semibold text-sm">Affected Regions</h4>
                  {affectedRegions.length > 0 ? (
                    <div className="space-y-1">
                      {affectedRegions.map((region, idx) => (
                        <Badge key={idx} variant="destructive" className="text-xs">
                          {region}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No affected regions detected</p>
                  )}
                </div>
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-semibold text-sm">Current Status</h4>
                  <Badge 
                    variant={severity === "severe" ? "destructive" : severity === "moderate" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {severity.toUpperCase()}
                  </Badge>
                </div>
                {postureData && (
                  <div className="space-y-2 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Curvature Angles</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cervical:</span>
                        <span className="font-medium">{postureData.cervical}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Thoracic:</span>
                        <span className="font-medium">{postureData.thoracic}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lumbar:</span>
                        <span className="font-medium">{postureData.lumbar}°</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
