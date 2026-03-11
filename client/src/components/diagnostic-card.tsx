import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "./severity-badge";
import { ConfidenceMeter } from "./confidence-meter";
import type { DiagnosticFinding } from "@shared/schema";
import { ChevronRight, AlertCircle, CheckCircle } from "lucide-react";

interface DiagnosticCardProps {
  finding: DiagnosticFinding;
  className?: string;
}

export function DiagnosticCard({ finding, className }: DiagnosticCardProps) {
  return (
    <Card className={`${className} hover-elevate`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {finding.severity === "normal" ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            <CardTitle className="text-medical-h3">{finding.condition}</CardTitle>
          </div>
          <SeverityBadge severity={finding.severity} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ConfidenceMeter confidence={finding.confidence} />
        
        {finding.findings.length > 0 && (
          <div className="space-y-2">
            <p className="text-medical-label text-muted-foreground">Key Findings</p>
            <ul className="space-y-1.5">
              {finding.findings.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-medical-caption">
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {finding.recommendations.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-medical-label text-muted-foreground">Recommendations</p>
            <ul className="space-y-1.5">
              {finding.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-medical-caption">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
