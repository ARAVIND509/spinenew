import { Badge } from "@/components/ui/badge";
import type { SeverityLevel } from "@shared/schema";

interface SeverityBadgeProps {
  severity: SeverityLevel;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const variants = {
    normal: "bg-success/10 text-success border-success/20",
    mild: "bg-success/10 text-success border-success/20",
    moderate: "bg-warning/10 text-warning border-warning/20",
    severe: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const labels = {
    normal: "Normal",
    mild: "Mild",
    moderate: "Moderate",
    severe: "Severe",
  };

  return (
    <Badge
      variant="outline"
      className={`${variants[severity]} font-medium capitalize ${className}`}
      data-testid={`badge-severity-${severity}`}
    >
      {labels[severity]}
    </Badge>
  );
}
