import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Brain, Eye, Scan, Stethoscope, Heart } from "lucide-react";
import type { Scan as ScanType, Patient } from "@shared/schema";

export default function Analysis() {
  const { data: scans = [], isLoading } = useQuery<(ScanType & { patient: Patient; analysis: any })[]>({
    queryKey: ["/api/analysis-archive"],
  });

  const capabilities = [
    {
      title: "Soft Tissue Degeneration",
      description: "Quantifies ligament, tendon, and disc changes over time",
      icon: Scan,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "3D Posture Simulation",
      description: "Converts static scans into functional posture models",
      icon: Activity,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Hidden Abnormality Detection",
      description: "Identifies subtle infections and tumor probabilities",
      icon: Eye,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Blood Flow Analysis",
      description: "Evaluates spinal cord perfusion and nerve root oxygenation",
      icon: Heart,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Comprehensive Diagnostics",
      description: "AI-powered analysis across 6+ spinal conditions",
      icon: Brain,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      title: "Clinical Integration",
      description: "Seamless integration with existing medical workflows",
      icon: Stethoscope,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
  ];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Analysis Capabilities</h1>
        <p className="text-muted-foreground">
          Advanced medical imaging analysis powered by cutting-edge AI technology
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {capabilities.map((capability) => (
          <Card key={capability.title} className="hover-elevate">
            <CardHeader className="pb-3">
              <div className={`h-12 w-12 rounded-md ${capability.bgColor} flex items-center justify-center mb-3`}>
                <capability.icon className={`h-6 w-6 ${capability.color}`} />
              </div>
              <CardTitle className="text-lg">{capability.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{capability.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Analysis Archive</CardTitle>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No scans found in database</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-4 rounded-md border hover-elevate"
                  data-testid={`analysis-item-${scan.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-md overflow-hidden bg-muted">
                      <img
                        src={scan.imageUrl}
                        alt="Scan thumbnail"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-medium">{scan.patient?.name || "Unknown Patient"}</p>
                      <p className="text-sm text-muted-foreground">
                        {scan.imageType} Scan - Patient ID: {scan.patient?.patientId || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${scan.analysis ? 'bg-success animate-pulse' : 'bg-amber-500 animate-pulse'}`}></div>
                      <p className={`text-sm font-bold ${scan.analysis ? 'text-success' : 'text-amber-500'}`}>
                        {scan.analysis ? 'Analysis Complete' : 'Pending Analysis'}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">
                      {new Date(scan.uploadedAt).toLocaleString()}
                    </p>
                    <Link
                      href={`/ai-analysis/${scan.id}`}
                      className="mt-2"
                    >
                      <button className="px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-white transition-all border border-primary/20">
                        {scan.analysis ? 'View Detailed Report' : 'Process Analysis'}
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
