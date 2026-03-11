import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";

interface ImageViewerProps {
  imageUrl: string;
  imageType: string;
  className?: string;
}

export function ImageViewer({ imageUrl, imageType, className }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div>
          <h3 className="text-medical-h3 font-medium">Image Viewer</h3>
          <p className="text-medical-caption text-muted-foreground">{imageType} Scan</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-medical-caption min-w-16 text-center" data-testid="text-zoom-level">
            {zoom}%
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 400}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRotate}
            data-testid="button-rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            data-testid="button-reset-view"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-8">
        <div
          className="transition-transform duration-200"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
          }}
        >
          <img
            src={imageUrl}
            alt="Medical scan"
            className="max-w-full max-h-full object-contain"
            data-testid="img-scan"
          />
        </div>
      </div>
    </div>
  );
}
