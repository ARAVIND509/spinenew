import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DiagnosticCard } from "./diagnostic-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AnalysisResults } from "@shared/schema";
import { Activity, AlertTriangle } from "lucide-react";

interface AnalysisPanelProps {
  results: AnalysisResults;
  className?: string;
}

export function AnalysisPanel({ results, className }: AnalysisPanelProps) {
  const conditions = [
    { key: "discHerniation", label: "Disc Herniation", data: results.discHerniation },
    { key: "scoliosis", label: "Scoliosis", data: results.scoliosis },
    { key: "spinalStenosis", label: "Spinal Stenosis", data: results.spinalStenosis },
    { key: "degenerativeDisc", label: "Degenerative Disc Disease", data: results.degenerativeDisc },
    { key: "infection", label: "Infection", data: results.infection },
    { key: "tumor", label: "Tumor", data: results.tumor },
  ];

  const criticalFindings = conditions.filter(c => c.data?.severity === "severe");
  const hasRiskZones = (results.riskZones || []).length > 0;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-6 border-b bg-card">
        <h2 className="text-medical-h2 font-semibold mb-2">Analysis Results</h2>
        <p className="text-medical-body text-muted-foreground">{results.summary}</p>
      </div>

      {(criticalFindings.length > 0 || hasRiskZones) && (
        <div className="p-6 bg-destructive/5 border-b">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="text-medical-label font-medium text-destructive mb-2">
                Critical Findings
              </h3>
              {criticalFindings.length > 0 && (
                <p className="text-medical-caption text-foreground mb-2">
                  {criticalFindings.length} severe condition(s) detected
                </p>
              )}
              {hasRiskZones && (
                <div className="space-y-1">
                  <p className="text-medical-caption font-medium">Risk Zones:</p>
                  <ul className="text-medical-caption text-muted-foreground">
                    {(results.riskZones || []).map((zone, i) => (
                      <li key={i}>• {zone}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-medical-h3 font-medium">Diagnostic Findings</h3>
          </div>

          {conditions.filter(c => !!c.data).map((condition) => (
            <DiagnosticCard
              key={condition.key}
              finding={condition.data!}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
