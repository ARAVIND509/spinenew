import { Progress } from "@/components/ui/progress";

interface ConfidenceMeterProps {
  confidence: number;
  className?: string;
}

export function ConfidenceMeter({ confidence, className }: ConfidenceMeterProps) {
  const getColor = (value: number) => {
    if (value >= 80) return "bg-success";
    if (value >= 60) return "bg-primary";
    if (value >= 40) return "bg-warning";
    return "bg-muted-foreground";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-medical-caption text-muted-foreground">Confidence</span>
        <span className="text-medical-label font-medium" data-testid="text-confidence">
          {confidence}%
        </span>
      </div>
      <Progress value={confidence} className={`h-2 ${getColor(confidence)}`} />
    </div>
  );
}
