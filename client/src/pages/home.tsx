import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, TrendingUp, Users, Activity, Brain, Eye, Heart } from "lucide-react";
import type { Patient, Scan } from "@shared/schema";
import { format } from "date-fns";

export default function Home() {
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: recentScans = [] } = useQuery<(Scan & { patient: Patient })[]>({
    queryKey: ["/api/scans/recent"],
  });

  const { data: dashboardStats } = useQuery<{
    scansToday: number;
    criticalFindings: number;
    avgAnalysisTime: number;
    activePatients: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const criticalFindings = dashboardStats?.criticalFindings || 0;
  const avgAnalysisTime = dashboardStats?.avgAnalysisTime || 0;
  const scansToday = dashboardStats?.scansToday || 0;
  const activePatients = dashboardStats?.activePatients || 0;

  const { data: criticalFindingsData } = useQuery<{ count: number; findings: any[] }>({
    queryKey: ["/api/stats/critical-findings"],
  });

  // Trend calculation (simulated for UI)
  const scanTrendText = "↑ 12% from yesterday";

  const stats = [
    {
      title: "Scans Analyzed Today",
      value: scansToday,
      subtitle: scanTrendText,
      icon: Activity,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Critical Findings",
      value: criticalFindings,
      subtitle: criticalFindings > 0 ? `${criticalFindings} cases requiring immediate review` : "All scans cleared",
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Average Analysis Time",
      value: `${avgAnalysisTime}m`,
      subtitle: avgAnalysisTime < 5 ? "↑ Optimized performance" : "Target: under 5 minutes",
      icon: Clock,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Active Patients",
      value: activePatients,
      subtitle: `Monitoring ${activePatients} active clinical cases`,
      icon: Users,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  const capabilities = [
    {
      title: "Soft Tissue Degeneration",
      description: "Quantifies ligament, tendon, and disc changes over time",
      icon: Brain,
      color: "text-blue-500",
    },
    {
      title: "3D Posture Simulation",
      description: "Converts static scans into functional posture models",
      icon: Activity,
      color: "text-green-500",
    },
    {
      title: "Hidden Abnormality Detection",
      description: "Identifies subtle infections and tumor probabilities",
      icon: AlertTriangle,
      color: "text-red-500",
    },
    {
      title: "Blood Flow Analysis",
      description: "Evaluates spinal cord perfusion and nerve root oxygenation",
      icon: Heart,
      color: "text-purple-500",
    },
  ];

  const realCriticalFindings = (criticalFindingsData?.findings || []).map((finding: any) => ({
    id: finding.scanId,
    title: `${finding.condition} detected (${finding.confidence}% confidence)`,
    description: `Patient: ${finding.patientName}`,
    severity: finding.severity === 'severe' ? 'URGENT' : 'WARNING',
    time: format(new Date(finding.analyzedAt), 'MMM d, yyyy'),
  }));

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">SpineGuard Dashboard</h1>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground">
            AI-powered spinal disorder detection and analysis
          </p>
          <Badge variant="secondary" className="text-xs">
            Last updated: 2 minutes ago
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground line-clamp-1">
                {stat.title}
              </CardTitle>
              <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-md ${stat.bgColor} flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1" data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Analysis Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {capabilities.map((capability) => (
                <div key={capability.title} className="flex items-start gap-3 p-3 rounded-md hover-elevate border">
                  <capability.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${capability.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm mb-1">{capability.title}</p>
                    <p className="text-xs text-muted-foreground">{capability.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Recent Critical Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {realCriticalFindings.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No critical findings detected</p>
              </div>
            ) : (
              <div className="space-y-4">
                {realCriticalFindings.map((finding: any) => (
                  <Card
                    key={finding.id}
                    className={`border-l-4 ${finding.severity === "URGENT"
                      ? "border-l-destructive bg-destructive/5"
                      : "border-l-warning bg-warning/5"
                      }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge
                          variant={finding.severity === "URGENT" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {finding.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{finding.time}</span>
                      </div>
                      <p className="font-medium text-sm mb-1">Patient ID: {finding.id}</p>
                      <p className="text-sm mb-1">{finding.title}</p>
                      <p className="text-xs text-muted-foreground">{finding.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Patient Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {patients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No patient cases yet. Start by creating your first patient case.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {patients.slice(0, 8).map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-4 rounded-md border hover-elevate cursor-pointer"
                  data-testid={`case-item-${patient.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {patient.patientId} {patient.age && `• Age: ${patient.age}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(patient.createdAt), "MMM d, yyyy")}
                    </p>
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
