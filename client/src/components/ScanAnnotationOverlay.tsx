import { SEVERITY_COLORS, Severity } from "@/lib/severity-colors";

interface AnnotationOverlayProps {
    finding: {
        condition: string;
        severity: Severity;
        confidence: number;
        // Normalized coordinates (0–1) of the detected region center
        regionX?: number;  // e.g. 0.45 = 45% from left
        regionY?: number;  // e.g. 0.38 = 38% from top
    };
    imageDimensions: { width: number; height: number };
}

export function ScanAnnotationOverlay({ finding, imageDimensions }: AnnotationOverlayProps) {
    const { width, height } = imageDimensions;

    // Convert normalized coords to pixel positions
    // Use fallbacks if regionX/regionY are missing
    const dotX = (finding.regionX ?? 0.5) * width;
    const dotY = (finding.regionY ?? 0.5) * height;

    // Arrow tail starts offset from the dot
    // Logic to prevent arrow going off-screen
    const offsetX = dotX > width / 2 ? -60 : 60;
    const offsetY = dotY > height / 2 ? -60 : 60;

    const arrowTailX = dotX + offsetX;
    const arrowTailY = dotY + offsetY;

    // Info box positioned at arrow tail
    // Adjust box position based on which side the arrow is on
    const BOX_WIDTH = 180;
    const BOX_HEIGHT = 75;
    const padding = 10;

    // Info box positioned at arrow tail
    // Initially calculate requested position
    let boxX = offsetX > 0 ? arrowTailX + 8 : arrowTailX - BOX_WIDTH - 8;
    let boxY = offsetY > 0 ? arrowTailY + 8 : arrowTailY - BOX_HEIGHT - 8;

    // Viewport clamping - Keep the box within the SVG boundaries
    if (boxX < padding) boxX = padding;
    if (boxX + BOX_WIDTH > width - padding) boxX = width - BOX_WIDTH - padding;
    if (boxY < padding) boxY = padding;
    if (boxY + BOX_HEIGHT > height - padding) boxY = height - BOX_HEIGHT - padding;

    const style = SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.mild;
    // Ensure confidence is always shown as a percentage
    const displayConfidence = finding.confidence > 1
        ? Math.round(finding.confidence)
        : Math.round(finding.confidence * 100);
    const conditionId = finding.condition.replace(/\s+/g, '-').toLowerCase();

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* --- Target dot on the detected region --- */}
            <circle
                cx={dotX}
                cy={dotY}
                r={6}
                fill={style.border}
                opacity={0.9}
            />
            {/* Outer ring pulse */}
            <circle
                cx={dotX}
                cy={dotY}
                r={14}
                fill="none"
                stroke={style.border}
                strokeWidth={1.5}
                className="animate-pulse"
                opacity={0.5}
            />

            {/* --- Arrow line from dot to info box --- */}
            <defs>
                <marker
                    id={`arrowhead-${conditionId}`}
                    markerWidth="8"
                    markerHeight="8"
                    refX="4"
                    refY="4"
                    orient="auto"
                >
                    <path d="M0,0 L8,4 L0,8 Z" fill={style.border} />
                </marker>
            </defs>
            <line
                x1={dotX}
                y1={dotY}
                x2={arrowTailX}
                y2={arrowTailY}
                stroke={style.border}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                markerStart={`url(#arrowhead-${conditionId})`}
                className="opacity-80"
            />

            {/* --- Info box with foreignObject for text wrapping --- */}
            <foreignObject
                x={boxX}
                y={boxY}
                width={BOX_WIDTH}
                height={BOX_HEIGHT}
            >
                <div
                    className="w-full h-full rounded-lg border-[1.5px] backdrop-blur-md p-2 flex flex-col gap-1 shadow-xl overflow-hidden"
                    style={{
                        backgroundColor: style.background,
                        borderColor: style.border,
                        color: 'white'
                    }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-tighter shrink-0"
                            style={{ backgroundColor: style.border }}
                        >
                            {style.label}
                        </span>
                        <span className="text-[8px] font-mono opacity-60 shrink-0">
                            {displayConfidence}% CONF
                        </span>
                    </div>

                    <h4 className="text-[10px] font-black leading-[1.1] break-words hyphens-auto uppercase tracking-tighter">
                        {finding.condition}
                    </h4>

                    <div className="mt-auto pt-1 border-t border-white/10 flex items-center justify-between text-[7px] opacity-70 font-bold tracking-widest uppercase">
                        <span>Neural Analysis</span>
                        <span>Verified</span>
                    </div>
                </div>
            </foreignObject>
        </svg>
    );
}
