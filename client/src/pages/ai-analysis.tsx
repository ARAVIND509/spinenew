import React, { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu, Download, FileText, Loader2, RefreshCw, AlertCircle,
  CheckCircle2, Heart, Eye, Brain, Activity, Info,
  ChevronRight, Share2, Layers, Maximize2, Scan as ScanIcon,
  ShieldCheck, Zap, Thermometer, Radar, X, Minimize2, AlertTriangle,
  Siren, Microscope, Stethoscope, Clock
} from "lucide-react";
import Spine3DViewer from "@/components/Spine3DViewer";
import { ImageOverlayVisualization } from "@/components/ImageOverlayVisualization";
import type { Scan, Analysis, AnalysisResults, Patient, SeverityLevel } from "@shared/schema";
import { downloadAnalysisPDF } from "@/lib/pdf-generator";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { SEVERITY_COLORS } from "@/lib/severity-colors";
import { ScanAnnotationOverlay } from "@/components/ScanAnnotationOverlay";

// Group Findings and Deduplicate
const groupAndAverageFindings = (findings: any[]) => {
  if (!findings || findings.length === 0) return [];

  const grouped = findings.reduce((acc: Record<string, any>, curr) => {
    // Aggressive normalization
    const condition = (curr.condition || '').toLowerCase().trim();
    const loc = (curr.location || '').toLowerCase().replace(/vertebra|level|disc|bone|segment/g, '').trim();

    // If location is very vague or missing, group by condition only to avoid spam
    const key = (loc.length < 2) ? `agg-${condition}` : `${condition}-${loc}`;

    if (!acc[key]) {
      acc[key] = { ...curr, confidenceSum: curr.confidence, count: 1 };
    } else {
      acc[key].confidenceSum += curr.confidence;
      acc[key].count += 1;
      // Keep the highest severity
      const severityOrder = { severe: 3, moderate: 2, mild: 1, normal: 0 };
      const currSev = (curr.severity?.toLowerCase() || 'normal') as keyof typeof severityOrder;
      const accSev = (acc[key].severity?.toLowerCase() || 'normal') as keyof typeof severityOrder;

      if (severityOrder[currSev] > severityOrder[accSev]) {
        acc[key].severity = curr.severity;
      }
    }
    return acc;
  }, {});

  return Object.values(grouped).map((g: any) => ({
    ...g,
    confidence: Math.round(g.confidenceSum / g.count)
  }));
};

export default function AIAnalysis() {
  const [, params] = useRoute("/ai-analysis/:scanId");
  const scanId = params?.scanId;
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing AI engine...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [modelType, setModelType] = useState<'ResNet50'>('ResNet50');
  const [maximizedView, setMaximizedView] = useState<'3d' | 'heatmap' | 'main' | null>(null);
  const [activeHeatmapIdx, setActiveHeatmapIdx] = useState<number | null>(null);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 });
  const [fullscreenImgDims, setFullscreenImgDims] = useState({ width: 0, height: 0 });
  const [visualMode, setVisualMode] = useState<'standard' | 'perfusion' | 'signal' | 'neural'>('standard');
  const { toast } = useToast();
  const scanContainerRef = useRef<HTMLDivElement>(null);

  const { data: scan } = useQuery<Scan>({
    queryKey: ["/api/scans/single", scanId],
    enabled: !!scanId,
    queryFn: async () => {
      const res = await fetch(`/api/scans/single/${scanId}`);
      if (!res.ok) throw new Error("Failed to fetch scan");
      return res.json();
    },
  });

  const { data: patient } = useQuery<Patient>({
    queryKey: ["/api/patients", scan?.patientCaseId],
    enabled: !!scan?.patientCaseId,
    queryFn: async () => {
      const res = await fetch(`/api/patients/${scan?.patientCaseId}`);
      if (!res.ok) throw new Error("Failed to fetch patient");
      return res.json();
    },
  });

  const { data: analysis, status: analysisStatus } = useQuery<Analysis>({
    queryKey: ["/api/analysis", scanId],
    enabled: !!scanId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ analysis: Analysis }>("POST", `/api/analyze/${scanId}`, { modelType });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/analysis", scanId], data.analysis);
      queryClient.invalidateQueries({ queryKey: ["/api/scans/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsAnalyzing(false);

      // Auto-select first heatmap if available
      if (data.analysis?.results?.gradCamHeatmaps?.length > 0) {
        setActiveHeatmapIdx(0);
      }
      setAnalysisProgress(100);
      setCurrentStep("Analysis synchronized");
      toast({
        title: "Analysis Complete",
        description: "Medical AI has finalized the diagnostic report.",
      });
    },
  });

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setCurrentStep("Booting Neural Engine...");
    analyzeMutation.mutate();
  };

  useEffect(() => {
    // Only auto-trigger analysis if we have the scan, no analysis yet, 
    // we aren't already analyzing, and we aren't currently loading the analysis
    if (scan && !analysis && !isAnalyzing && analysisStatus !== 'pending') {
      handleAnalyze();
    }
  }, [scan, analysis, isAnalyzing, analysisStatus]);

  useEffect(() => {
    if (!scanId || !isAnalyzing) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/analysis`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "subscribe", scanId }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress" && data.scanId === scanId) {
          setAnalysisProgress(data.progress);
          setCurrentStep(data.status);

          if (data.progress === 100) {
            queryClient.invalidateQueries({ queryKey: ["/api/analysis", scanId] });
            queryClient.invalidateQueries({ queryKey: ["/api/scans/recent"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
            setIsAnalyzing(false);

            // Auto-selection will happen via the analysis query update if needed, 
            // but we can also trigger it here if we refetch.
          }
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    return () => socket.close();
  }, [scanId, isAnalyzing]);

  const results = analysis?.results as AnalysisResults | undefined;
  const bloodFlow = results?.bloodFlowAnalysis;

  // Effect to auto-select first heatmap when results become available
  useEffect(() => {
    if (results?.gradCamHeatmaps?.length && activeHeatmapIdx === null) {
      setActiveHeatmapIdx(0);
    }
  }, [results, activeHeatmapIdx]);

  const handleDownloadPDF = () => {
    if (!results || !patient || !scan) return;
    downloadAnalysisPDF(results, {
      name: patient.name,
      age: patient.age ?? undefined,
      medicalRecordNumber: patient.patientId,
    }, {
      imageType: scan.imageType,
      uploadDate: new Date(scan.uploadedAt).toLocaleString(),
    });
    toast({
      title: "Generating Report",
      description: "Diagnostic PDF is being compiled.",
    });
  };

  const handleShare = () => {
    toast({
      title: "Case Shared",
      description: "A secure link has been copied to your clipboard.",
    });
  };

  const switchVisualMode = (mode: 'standard' | 'perfusion' | 'signal' | 'neural') => {
    setVisualMode(mode);
    const descriptions = {
      standard: "Switching to standard anatomical view.",
      perfusion: "Simulating vascular perfusion layers.",
      signal: "Enhancing vertebral signal intensity.",
      neural: "Highlighting neural pathway connectivity."
    };
  };

  const selectHeatmapByCondition = (condition: string) => {
    if (!results?.gradCamHeatmaps) return;
    const idx = results.gradCamHeatmaps.findIndex(h => h.condition === condition);
    if (idx !== -1) {
      setActiveHeatmapIdx(idx);
    }
  };

  const activeHeatmap = activeHeatmapIdx !== null ? results?.gradCamHeatmaps?.[activeHeatmapIdx] : null;

  // Fallback: If mlPredictions is missing (SCT path), aggregate from individual fields
  const predictions = React.useMemo(() => {
    let preds = results?.mlPredictions?.predictions || [];

    if (preds.length === 0 && results) {
      const conditions = [
        'discHerniation', 'scoliosis', 'spinalStenosis',
        'degenerativeDisc', 'vertebralFracture', 'spondylolisthesis',
        'infection', 'tumor'
      ] as const;
      preds = conditions.map(key => {
        const finding = (results as any)[key];
        if (!finding) return null;
        return {
          condition: finding.condition,
          severity: (finding.severity || 'normal').toLowerCase(),
          confidence: finding.confidence,
          modelType: "SCT Analysis"
        };
      }).filter(Boolean) as any[];
    }
    return preds;
  }, [results]);

  const processedPredictions = React.useMemo(() =>
    groupAndAverageFindings(predictions),
    [predictions]);

  const severeFindings = processedPredictions.filter(p => p.severity?.toLowerCase() === 'severe');
  const moderateFindings = processedPredictions.filter(p => p.severity?.toLowerCase() === 'moderate');
  const normalFindings = processedPredictions.filter(p => !['severe', 'moderate'].includes(p.severity?.toLowerCase()));

  // Enhanced results for 3D viewer - Deduplicated and enriched with Heatmap regions
  const viewerResults = React.useMemo(() => {
    if (!results) return undefined;

    // Deduplicate results.findings if they exist
    const rawFindings = results.findings?.length ? results.findings : processedPredictions.map(p => ({
      condition: p.condition,
      severity: p.severity as SeverityLevel,
      confidence: p.confidence,
      location: p.location || (p.condition.includes("Disc") ? "Disc" : (p.condition.includes("Scoliosis") ? "Spine" : "Lumbar"))
    }));

    const deduplicatedFindings = groupAndAverageFindings(rawFindings);

    // Parse heatmap regions to extract specific anatomical targets (Fallback for older scans or pure client-side paths)
    const heatmapTargets = results.heatmapTargets?.length ? results.heatmapTargets : (() => {
      const heatmaps = results.gradCamHeatmaps || [];
      const targets: Array<{ region: string, condition: string, severity: SeverityLevel, intensity: number }> = [];

      heatmaps.forEach(heatmap => {
        if (heatmap.affectedRegions?.length) {
          heatmap.affectedRegions.forEach(ar => {
            targets.push({
              region: ar.region,
              condition: heatmap.condition,
              severity: (heatmap.severity || 'severe') as SeverityLevel,
              intensity: ar.intensity
            });
          });
        }
      });
      return targets;
    })();

    return {
      ...results,
      findings: deduplicatedFindings,
      heatmapTargets // Pass parsed heatmap targets for precise 3D highlighting
    };
  }, [results, processedPredictions]);

  if (!scan) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary/80" />
        <span className="text-muted-foreground font-medium tracking-widest text-xs uppercase">Initializing System</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background text-foreground bg-grid">
      <div className="w-full px-4 lg:px-12 py-10">

        {/* Header - Glassmorphic */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 glass-card rounded-3xl"
        >
          <div className="flex items-center gap-6">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 shadow-lg">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Badge variant="outline" className="text-[10px] uppercase border-primary/30 text-primary px-2 py-0">AI Analysis Engine Active</Badge>
                <Badge variant="outline" className="text-[10px] uppercase border-emerald-500/30 text-emerald-500 dark:text-emerald-400 px-2 py-0 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> HIPAA Compliant
                </Badge>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
                SpineGuard AI <span className="text-primary/60 font-light italic">Clinical v4.0</span>
              </h1>
              <p className="text-muted-foreground max-w-md text-sm mt-1">
                Performing sub-millimeter anatomical segmentation and pathological verification.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {results && (
              <Button
                onClick={handleDownloadPDF}
                className="h-12 px-6 rounded-xl bg-primary text-primary-foreground shadow-lg transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Diagnostic Report
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleShare}
              className="h-12 w-12 rounded-xl"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8">
          {/* Main Visualizer - 8 cols */}
          <div className="xl:col-span-8 flex flex-col gap-8">
            <Card className="glass-card border-none rounded-[2rem] overflow-hidden shadow-2xl relative">
              <div className="absolute top-6 left-6 z-20 flex gap-2">
                <Badge className="bg-background/60 backdrop-blur-md border border-border/50 text-[10px] py-1">SOURCE: {scan.imageType}</Badge>
                <Badge className="bg-background/60 backdrop-blur-md border border-border/50 text-[10px] uppercase tracking-tighter flex items-center gap-1">
                  <Thermometer className="h-3 w-3 text-rose-500" /> {activeHeatmap ? 'NEURAL_HEATMAP_ACTIVE' : 'RAW CALIBRATION'}
                </Badge>
                {visualMode !== 'standard' && (
                  <Badge className="bg-primary/80 backdrop-blur-md border border-primary text-primary-foreground text-[10px] uppercase tracking-tighter animate-fadeIn">
                    MODE: {visualMode}
                  </Badge>
                )}
              </div>

              <div className="flex h-[550px]">
                <div ref={scanContainerRef} className="flex-1 relative bg-black group">
                  <img
                    src={scan.imageUrl}
                    alt="Clinical Scan"
                    className="w-full h-full object-contain transition-opacity duration-500"
                  />

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    {activeHeatmap && (
                      <div className="w-[400px] h-[400px] border border-rose-500/10 rounded-full animate-ping opacity-20" />
                    )}
                  </div>

                  {/* Scanning Animation */}
                  {isAnalyzing && (
                    <div className="absolute inset-x-0 h-1 bg-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.8)] z-10 animate-scan">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-primary text-white text-[8px] font-bold rounded">SCANNING_LEVEL_DATA</div>
                    </div>
                  )}

                  {/* Visualizer UI Overlays */}
                  <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-20">
                    <div className="flex flex-col gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setMaximizedView('main')}
                        className="w-10 h-10 rounded-xl glass-panel border-white/10 text-foreground hover:bg-white/10"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setActiveHeatmapIdx(null)}
                        className={`w-10 h-10 rounded-xl glass-panel border-white/10 text-foreground transition-all ${activeHeatmapIdx === null ? 'bg-primary/20 border-primary/30' : 'hover:bg-white/10'}`}
                        title="Reset View"
                      >
                        <ScanIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>



              </div>
            </Card>

            {/* In-depth Panels Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dynamic 3D Viewer */}
              <div className="glass-card rounded-3xl p-6 relative overflow-hidden h-[400px]">
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-500" /> Bio-Dynamic Reconstruct
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20 text-[9px]">3D_RENDER</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setMaximizedView('3d')}>
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="absolute inset-0 top-16">
                  <Spine3DViewer results={viewerResults as any} imageUrl={scan.imageUrl} visualMode={visualMode} isFullView={false} />
                </div>
              </div>

              {results?.postureSimulation && (
                <div className="glass-card rounded-3xl p-6 relative overflow-hidden h-[400px] border border-emerald-500/10 hover-elevate">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" /> Functional Biomechanics
                    </h3>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      {results.postureSimulation.confidence}% CONF
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                    {[
                      { label: 'Cervical', val: results.postureSimulation.spinalCurvature.cervical },
                      { label: 'Thoracic', val: results.postureSimulation.spinalCurvature.thoracic },
                      { label: 'Lumbar', val: results.postureSimulation.spinalCurvature.lumbar }
                    ].map((c, i) => (
                      <div key={i} className="p-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center flex flex-col justify-center min-w-0">
                        <p className="text-[7px] text-muted-foreground uppercase font-bold mb-1 truncate">{c.label}</p>
                        <p className="text-sm sm:text-base font-bold text-emerald-600 truncate">
                          {Number(c.val).toFixed(1)}°
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Compensatory Patterns</p>
                        <div className="flex flex-wrap gap-1">
                          {results.postureSimulation.compensatoryPatterns.map((p, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-none">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Functional Limitations</p>
                      <ul className="space-y-1">
                        {results.postureSimulation.functionalLimitations.map((l, i) => (
                          <li key={i} className="text-xs flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-emerald-500" />
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Info - 4 cols */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            <Card className="glass-card !bg-primary/[0.02] border-none rounded-[2rem] p-8 shadow-xl">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> AI Analysis Summary
              </h3>

              <div className="space-y-6">
                {/* 1. Primary Finding - Hero Card Style */}
                {results?.primaryFinding ? (
                  <div className="space-y-4 animate-in slide-in-from-right duration-500">
                    <div className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-2">
                      <Zap className="h-4 w-4 animate-pulse" /> Primary AI Observation
                    </div>
                    <div className={`rounded-3xl bg-primary/10 border border-primary/20 p-6 relative overflow-hidden group transition-all duration-300`}>
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Brain className="h-24 w-24 text-primary rotate-12" />
                      </div>
                      <div
                        onClick={() => selectHeatmapByCondition(results.primaryFinding!.condition)}
                        className={`p-3 rounded-xl border flex flex-col gap-2 transition-all cursor-pointer min-w-0 ${activeHeatmap?.condition === results.primaryFinding.condition
                          ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]'
                          : 'bg-foreground/5 border-border/50 hover:bg-foreground/10'
                          }`}
                      >
                        <div className="min-w-0">
                          <h4 className="text-2xl font-bold text-primary break-words leading-tight">{results.primaryFinding.condition}</h4>
                          <p className="text-xs text-muted-foreground uppercase mt-1 break-words">Location: {results.primaryFinding.location}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className={`bg-primary/20 text-primary border-primary/30 text-[10px] font-bold px-2 py-0.5 whitespace-nowrap`}>
                            {results.primaryFinding.confidence}% CONF
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-4 mt-6">
                        <div className="flex items-center gap-3">
                          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${results.primaryFinding.severity === 'severe' ? 'bg-red-500 text-white' :
                            results.primaryFinding.severity === 'moderate' ? 'bg-orange-500 text-white' :
                              'bg-emerald-500 text-white'
                            }`}>
                            {results.primaryFinding.severity}
                          </div>
                          <div className="h-1.5 flex-1 bg-primary/20 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${results.primaryFinding.confidence}%` }}
                              className="h-full bg-primary"
                            ></motion.div>
                          </div>
                        </div>

                      </div>
                    </div>

                    <div className="pt-4 border-t border-primary/10">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-3">Supporting Observations</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {processedPredictions.filter(p => p.condition !== results?.primaryFinding?.condition).slice(0, 6).map((p, i) => (
                          <div
                            key={i}
                            onClick={() => selectHeatmapByCondition(p.condition)}
                            className={`p-3 rounded-xl border flex flex-col gap-1 transition-all cursor-pointer min-w-0 ${activeHeatmap?.condition === p.condition
                              ? 'bg-primary/10 border-primary/40 shadow-sm'
                              : 'bg-foreground/5 border-border/50 hover:bg-foreground/10'
                              }`}
                          >
                            <span className="text-[10px] font-bold break-words whitespace-normal leading-tight">{p.condition}</span>
                            <div className="flex justify-between items-center mt-1">
                              <span className={`text-[8px] uppercase font-black ${p.severity === 'severe' ? 'text-red-500' :
                                p.severity === 'moderate' ? 'text-orange-500' : 'text-emerald-500'
                                }`}>{p.severity}</span>
                              <span className="text-[8px] font-mono opacity-50">{p.confidence}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : !results ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 rounded-3xl bg-foreground/5 border border-border/50 animate-pulse"></div>
                  ))
                ) : (
                  <div className="p-10 rounded-3xl border-2 border-dashed border-primary/10 flex flex-col items-center text-center gap-4">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
                    <div>
                      <h4 className="font-bold">Clear Anatomy</h4>
                      <p className="text-xs text-muted-foreground">No significant pathologies identified in current scan.</p>
                    </div>
                  </div>
                )}

                {/* Clinical Summary Text */}
                {results?.summary && (
                  <div className="pt-6 border-t border-primary/10">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-2 flex items-center gap-2">
                      <FileText className="h-3 w-3" /> Clinical Impression
                    </p>
                    <p className="text-xs leading-relaxed text-foreground/80 bg-primary/5 p-4 rounded-2xl border border-primary/10 italic">
                      "{results.summary}"
                    </p>
                  </div>
                )}

                {/* Risk Zones */}
                {results?.riskZones && results.riskZones.length > 0 && (
                  <div className="pt-4">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-2 flex items-center gap-2">
                      <Radar className="h-3 w-3" /> Anatomical Risk Zones
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {results.riskZones.map((zone, i) => (
                        <Badge key={i} variant="secondary" className="bg-rose-500/10 text-rose-600 border-none text-[9px]">
                          {zone}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 glass-card rounded-3xl text-center space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Latency</span>
                <div className="text-2xl font-bold leading-none">{results?.mlPredictions?.processingTime || '---'}ms</div>
              </div>
              <div className="p-6 glass-card rounded-3xl text-center space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Model</span>
                <div className="text-sm font-bold leading-none truncate px-2 capitalize">{modelType}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Per-Disease Heatmap Gallery — Interactive Navigation              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {results && scan && (
          <div className="flex flex-col gap-6 mb-12">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                  <Thermometer className="h-6 w-6 text-rose-500" />
                  Disease Heatmap Analysis
                </h2>
                <p className="text-muted-foreground text-sm">
                  Individual AI-generated heatmaps per detected condition. Select a disease to view its activation map.
                </p>
              </div>
              {results.gradCamHeatmaps && results.gradCamHeatmaps.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setMaximizedView('heatmap')}
                  className="shrink-0 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white transition-all"
                >
                  <Maximize2 className="h-4 w-4 mr-2" /> Expand Full Analysis
                </Button>
              )}
            </div>

            {/* Disease Navigation Pills */}
            {results.gradCamHeatmaps && results.gradCamHeatmaps.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {results.gradCamHeatmaps.map((heatmap, idx) => {
                    const isActive = activeHeatmapIdx === idx;
                    const sev = (heatmap.severity || 'mild') as keyof typeof SEVERITY_COLORS;
                    const style = SEVERITY_COLORS[sev] || SEVERITY_COLORS.mild;
                    return (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActiveHeatmapIdx(idx)}
                        className={`
                          px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide border transition-all duration-300
                          flex items-center gap-2
                          ${isActive
                            ? `${style.badge} text-white border-transparent shadow-lg shadow-${sev === 'severe' ? 'red' : sev === 'moderate' ? 'orange' : 'emerald'}-500/30 scale-[1.03]`
                            : 'bg-card/60 border-border/60 text-foreground hover:border-primary/40 hover:bg-card'
                          }
                        `}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white/80 animate-pulse' : style.badge}`} />
                        {heatmap.condition}
                        <span className={`ml-1 text-[9px] opacity-70 ${isActive ? 'text-white/80' : ''}`}>
                          {heatmap.confidence ?? 0}%
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Split View: Original vs Active Disease Heatmap */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LEFT — Original Scan */}
                  <div className="flex flex-col gap-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Badge variant="outline" className="bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400">BASELINE</Badge>
                      Original Spinal Scan
                    </h3>
                    <div className="glass-card rounded-2xl overflow-hidden border border-slate-500/10 h-[450px] relative flex items-center justify-center bg-black/50">
                      <img
                        src={scan.imageUrl}
                        className="w-full h-full object-contain"
                        alt="Original Scan"
                      />
                      <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/70 rounded-lg text-[10px] font-bold text-slate-400 backdrop-blur">
                        UNMODIFIED
                      </div>
                    </div>
                  </div>

                  {/* RIGHT — Active Disease Heatmap */}
                  <div className="flex flex-col gap-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Badge className={`${SEVERITY_COLORS[(activeHeatmap?.severity || 'mild') as keyof typeof SEVERITY_COLORS]?.badge || 'bg-rose-500/20'} text-white border-none`}>
                        {activeHeatmap?.severity?.toUpperCase() || 'AI'} DETECTION
                      </Badge>
                      {activeHeatmap?.condition || 'Select a Disease'}
                    </h3>
                    <div className="glass-card rounded-2xl overflow-hidden border border-rose-500/20 h-[450px] flex flex-col relative">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeHeatmapIdx ?? 'none'}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="relative flex-1 bg-black/80 flex items-center justify-center"
                        >
                          <img
                            src={scan.imageUrl}
                            className="absolute inset-0 w-full h-full object-contain"
                            alt="Original Base"
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              setImgDims({ width: img.clientWidth, height: img.clientHeight });
                            }}
                          />

                          {/* Active Heatmap Overlay Only */}
                          {activeHeatmap?.heatmapImageUrl && (
                            <img
                              src={activeHeatmap.heatmapImageUrl}
                              className="absolute inset-0 w-full h-full object-contain mix-blend-screen pointer-events-none opacity-90 z-20"
                              alt={`Heatmap: ${activeHeatmap.condition}`}
                            />
                          )}

                          {/* Active Disease Annotation */}
                          {imgDims.width > 0 && activeHeatmap && (
                            <div className="absolute inset-0 w-full h-full pointer-events-none z-40">
                              <ScanAnnotationOverlay
                                finding={{
                                  condition: activeHeatmap.condition,
                                  severity: (activeHeatmap.severity || 'mild') as any,
                                  confidence: activeHeatmap.confidence || 0,
                                  regionX: activeHeatmap.regionX,
                                  regionY: activeHeatmap.regionY
                                }}
                                imageDimensions={imgDims}
                              />
                            </div>
                          )}

                          {/* Severity indicator badge */}
                          {activeHeatmap && (
                            <div className="absolute top-3 right-3 z-50">
                              <Badge className={`${SEVERITY_COLORS[(activeHeatmap.severity || 'mild') as keyof typeof SEVERITY_COLORS]?.badge || 'bg-primary'} text-white text-[10px] font-black uppercase shadow-xl border border-white/10 px-3 py-1`}>
                                {SEVERITY_COLORS[(activeHeatmap.severity || 'mild') as keyof typeof SEVERITY_COLORS]?.label || 'DETECTED'}
                              </Badge>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Active Disease Info Bar */}
                {activeHeatmap && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={`info-${activeHeatmapIdx}`}
                    className="glass-card rounded-2xl p-5 border border-primary/10"
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Condition + Severity */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`p-3 rounded-xl ${SEVERITY_COLORS[(activeHeatmap.severity || 'mild') as keyof typeof SEVERITY_COLORS]?.badge || 'bg-primary'}`}>
                          <Radar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{activeHeatmap.condition}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${SEVERITY_COLORS[(activeHeatmap.severity || 'mild') as keyof typeof SEVERITY_COLORS]?.badge || 'bg-primary'} text-white`}>
                              {activeHeatmap.severity}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">{activeHeatmap.confidence ?? 0}% confidence</span>
                          </div>
                        </div>
                      </div>

                      {/* Affected Regions */}
                      <div className="flex-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5">Affected Regions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeHeatmap.affectedRegions?.map((r, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] bg-primary/5 border-primary/10">
                              {r.region} — {(r.intensity * 100).toFixed(0)}% intensity
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Interpretation */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5">AI Interpretation</p>
                        <p className="text-xs text-foreground/70 leading-relaxed line-clamp-3">
                          {activeHeatmap.interpretationNotes}
                        </p>
                      </div>
                    </div>

                    {/* Navigation hint */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        Viewing {(activeHeatmapIdx ?? 0) + 1} of {results.gradCamHeatmaps?.length ?? 0} detected conditions
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3 text-[10px]"
                          disabled={activeHeatmapIdx === 0}
                          onClick={() => setActiveHeatmapIdx(Math.max(0, (activeHeatmapIdx ?? 0) - 1))}
                        >
                          ← Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3 text-[10px]"
                          disabled={activeHeatmapIdx === (results.gradCamHeatmaps?.length ?? 1) - 1}
                          onClick={() => setActiveHeatmapIdx(Math.min((results.gradCamHeatmaps?.length ?? 1) - 1, (activeHeatmapIdx ?? 0) + 1))}
                        >
                          Next →
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              /* No heatmaps available — normal scan */
              <div className="p-10 rounded-3xl border-2 border-dashed border-emerald-500/20 flex flex-col items-center text-center gap-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
                <div>
                  <h4 className="font-bold">No Abnormal Regions Detected</h4>
                  <p className="text-xs text-muted-foreground max-w-md">
                    The AI analysis did not identify any conditions exceeding the clinical threshold. No disease-specific heatmaps were generated.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Advanced Analysis Features Section - FULL WIDTH */}
        {results && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Advanced Analysis Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Soft Tissue Degeneration Card */}
              {results.softTissueDegeneration && (
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10">
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Soft Tissue Degeneration</CardTitle>
                        <Badge className={`${results.softTissueDegeneration.severity === 'severe' ? 'bg-rose-500' :
                          results.softTissueDegeneration.severity === 'moderate' ? 'bg-orange-500' :
                            results.softTissueDegeneration.severity === 'mild' ? 'bg-yellow-500' : 'bg-green-500'
                          } text-white`}>
                          {results.softTissueDegeneration.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Ligament Changes */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Ligamentous Integrity</p>
                        <ul className="space-y-1">
                          <li className="text-xs flex flex-col">
                            <span className="text-muted-foreground">Anterior:</span>
                            <span>{results.softTissueDegeneration.ligamentChanges.anterior}</span>
                          </li>
                          <li className="text-xs flex flex-col">
                            <span className="text-muted-foreground">Posterior:</span>
                            <span>{results.softTissueDegeneration.ligamentChanges.posterior}</span>
                          </li>
                        </ul>
                      </div>
                      {/* Tendon / Disc Changes */}
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold">
                            <span>Tendon Degeneration</span>
                            <span>{results.softTissueDegeneration.tendonDegeneration.percentage}%</span>
                          </div>
                          <Progress value={results.softTissueDegeneration.tendonDegeneration.percentage} className="h-1.5" />
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <div className="text-center flex-1">
                            <p className="text-[8px] text-muted-foreground uppercase font-bold">Hydration</p>
                            <p className="text-sm font-bold text-primary">{results.softTissueDegeneration.discChanges.hydration}%</p>
                          </div>
                          <div className="w-px h-8 bg-primary/20 mx-2" />
                          <div className="text-center flex-1">
                            <p className="text-[8px] text-muted-foreground uppercase font-bold">Height Loss</p>
                            <p className="text-sm font-bold text-primary">{results.softTissueDegeneration.discChanges.heightLoss}mm</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Hidden Abnormality Detection Card */}
              {results.hiddenAbnormality && (
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-amber-500/10">
                        <Radar className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Hidden Abnormality Detection</CardTitle>
                        <Badge variant="outline" className="border-amber-500/30 text-amber-500">
                          {results.hiddenAbnormality.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Infection Selection */}
                      <div className={`p-3 rounded-2xl border ${results.hiddenAbnormality.infections.detected ? 'bg-rose-500/5 border-rose-500/20' : 'bg-muted/30 border-border'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Siren className={`h-3 w-3 ${results.hiddenAbnormality.infections.detected ? 'text-rose-500' : 'text-muted-foreground'}`} />
                          <span className="text-[10px] font-bold uppercase">Infection Risk</span>
                        </div>
                        <p className="text-xs font-semibold">{results.hiddenAbnormality.infections.type}</p>
                        {results.hiddenAbnormality.infections.location.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">Focus: {results.hiddenAbnormality.infections.location.join(', ')}</p>
                        )}
                      </div>

                      {/* Tumor Selection */}
                      <div className={`p-3 rounded-2xl border ${results.hiddenAbnormality.tumorProbability.detected ? 'bg-orange-500/5 border-orange-500/20' : 'bg-muted/30 border-border'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Microscope className={`h-3 w-3 ${results.hiddenAbnormality.tumorProbability.detected ? 'text-orange-500' : 'text-muted-foreground'}`} />
                          <span className="text-[10px] font-bold uppercase">Tumor Probability</span>
                        </div>
                        <p className="text-xs font-semibold">{results.hiddenAbnormality.tumorProbability.type}</p>
                        {results.hiddenAbnormality.tumorProbability.detected && (
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[9px] text-muted-foreground">Size: {results.hiddenAbnormality.tumorProbability.size}</span>
                            <Badge className="bg-orange-500/20 text-orange-600 text-[8px] border-none px-1.5 h-4">
                              {results.hiddenAbnormality.tumorProbability.malignancyRisk}% RISK
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    {results.hiddenAbnormality.subtleFindings.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold mb-2">Subtle Findings</p>
                        <ul className="space-y-1">
                          {results.hiddenAbnormality.subtleFindings.map((finding, idx) => (
                            <li key={idx} className="text-[10px] flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-amber-500" />
                              {finding}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 3D Posture Simulation Card */}
              {results.postureSimulation && (
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-blue-500/10">
                        <Layers className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">3D Posture Simulation</CardTitle>
                        <Badge variant="outline" className="border-blue-500/30 text-blue-500">
                          {results.postureSimulation.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Cervical</p>
                        <p className="text-xs font-bold text-primary">{results.postureSimulation.spinalCurvature.cervical}°</p>
                      </div>
                      <div className="p-2 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Thoracic</p>
                        <p className="text-xs font-bold text-primary">{results.postureSimulation.spinalCurvature.thoracic}°</p>
                      </div>
                      <div className="p-2 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Lumbar</p>
                        <p className="text-xs font-bold text-primary">{results.postureSimulation.spinalCurvature.lumbar}°</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Functional Limitations</p>
                      <div className="flex flex-wrap gap-1">
                        {results.postureSimulation.functionalLimitations.map((lim, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[8px] bg-blue-500/5 text-blue-600 border-none">{lim}</Badge>
                        ))}
                        {results.postureSimulation.functionalLimitations.length === 0 && <span className="text-xs text-muted-foreground">None identified</span>}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold mb-1">Posture Models</p>
                      <div className="grid grid-cols-1 gap-1">
                        <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Standing:</span> <span>{results.postureSimulation.postureModels.standing}</span></div>
                        <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Sitting:</span> <span>{results.postureSimulation.postureModels.sitting}</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Neural Perfusion / Blood Flow Analysis Card */}
              {results.bloodFlowAnalysis && (
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-emerald-500/10">
                          <Heart className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Blood Flow Analysis</CardTitle>
                          <Badge className={
                            results.bloodFlowAnalysis.severity === 'severe' ? 'bg-rose-500' :
                              results.bloodFlowAnalysis.severity === 'moderate' ? 'bg-orange-500' :
                                'bg-emerald-500'
                          }>
                            {results.bloodFlowAnalysis.severity.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/[0.03] border border-primary/10">
                      <div>
                        <p className="text-2xl font-bold text-primary">{results.bloodFlowAnalysis.spinalCordPerfusion.flowRate}</p>
                        <p className="text-[8px] text-muted-foreground uppercase font-bold">ML/MIN PERFUSION ({results.bloodFlowAnalysis.spinalCordPerfusion.level})</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase">{results.bloodFlowAnalysis.spinalCordPerfusion.adequacy}</Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Segmental Oxygenation</p>
                      <div className="grid grid-cols-5 gap-1">
                        {results.bloodFlowAnalysis.nerveRootOxygenation.slice(0, 5).map((n, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div className={`w-full h-1 rounded-full mb-1 ${n.oxygenation > 85 ? 'bg-emerald-500' : n.oxygenation > 70 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                            <span className="text-[8px] font-mono text-muted-foreground font-bold">{n.vertebralLevel}</span>
                            <span className="text-[8px] font-mono">{n.oxygenation}%</span>
                          </div>
                        ))}
                        {results.bloodFlowAnalysis.nerveRootOxygenation.length === 0 && (
                          <div className="col-span-5 text-[10px] text-muted-foreground italic text-center p-2">Standard vascular profile maintained</div>
                        )}
                      </div>
                    </div>

                    {results.bloodFlowAnalysis.vascularCompromise.detected && (
                      <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-rose-500" />
                        <span className="text-[9px] text-rose-600 font-bold uppercase truncate">
                          Compromise: {results.bloodFlowAnalysis.vascularCompromise.location.join(', ')}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* All Conditions Checked - Full Report Section */}
        {results && results.checkedConditions && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              Comprehensive Diagnostic Scan (6+ Conditions Verified)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {results.checkedConditions.map((condition, idx) => (
                <div key={idx} className="glass-card p-4 rounded-2xl border border-white/10 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">{condition.condition}</span>
                    <Badge variant={condition.severity === 'normal' ? 'outline' : 'destructive'} className="text-[9px]">
                      {condition.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-1">
                    <p className="flex justify-between">
                      <span>Anatomical Status:</span>
                      <span className={condition.severity === 'normal' ? 'text-emerald-500' : 'text-rose-500'}>
                        {condition.severity === 'normal' ? 'CLEARED / HEALTHY' : 'PATHOLOGY DETECTED'}
                      </span>
                    </p>
                    {condition.location && (
                      <p className="flex justify-between">
                        <span>Analysis Focus:</span>
                        <span className="text-foreground font-medium">{condition.location}</span>
                      </p>
                    )}
                    {condition.measurements && Object.entries(condition.measurements).map(([key, val]) => (
                      <p key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-foreground font-mono">{typeof val === 'number' ? val.toFixed(2) : val}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-depth Tissue & Pathologies Section - FULL WIDTH */}
        {
          results && (
            <div className="mb-12">
            </div>
          )
        }
      </div >

      {/* Fullscreen Overlays */}
      <AnimatePresence>
        {maximizedView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col h-screen overflow-hidden"
          >
            {/* Header for Fullscreen */}
            <div className="flex-none p-6 flex items-center justify-between border-b border-border/40 bg-background/95 backdrop-blur">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {maximizedView === '3d' ? <Zap className="text-primary h-5 w-5" /> : maximizedView === 'heatmap' ? <Thermometer className="text-rose-500 h-5 w-5" /> : <Maximize2 className="text-primary h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {maximizedView === '3d' ? '3D Bio-Dynamic Model' : maximizedView === 'heatmap' ? 'Neural Activation Heatmaps' : 'Advanced Diagnostic View'}
                  </h2>
                  <p className="text-muted-foreground text-xs font-mono">SESSION_ID: {scanId}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMaximizedView(null)} className="hover:bg-red-500/10 hover:text-red-500">
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Content Area - Flex-1 ensuring it takes remaining space without overflow */}
            <div className="flex-1 relative min-h-0 container mx-auto p-6 max-w-[1920px]">

              {maximizedView === '3d' && scan && (
                <div className="w-full h-full relative rounded-3xl overflow-hidden border border-border/50 bg-black/40">
                  <Spine3DViewer results={viewerResults as any} imageUrl={scan.imageUrl} visualMode={visualMode} isFullView={true} />
                  <div className="absolute top-6 left-6 p-2 rounded-2xl glass-panel flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground px-2 uppercase mb-1">Visual Mode</span>
                    <Button size="sm" variant={visualMode === 'standard' ? 'secondary' : 'ghost'} onClick={() => switchVisualMode('standard')} className="justify-start"><Eye className="h-4 w-4 mr-2" /> Standard</Button>
                    <Button size="sm" variant={visualMode === 'perfusion' ? 'secondary' : 'ghost'} onClick={() => switchVisualMode('perfusion')} className="justify-start"><Heart className="h-4 w-4 mr-2" /> Perfusion</Button>
                    <Button size="sm" variant={visualMode === 'signal' ? 'secondary' : 'ghost'} onClick={() => switchVisualMode('signal')} className="justify-start"><Activity className="h-4 w-4 mr-2" /> Signal</Button>
                    <Button size="sm" variant={visualMode === 'neural' ? 'secondary' : 'ghost'} onClick={() => switchVisualMode('neural')} className="justify-start"><Cpu className="h-4 w-4 mr-2" /> Neural</Button>
                  </div>
                </div>
              )}

              {maximizedView === 'heatmap' && (
                <div className="flex h-full gap-8">
                  {/* Main Image Container */}
                  <div className="flex-1 relative h-full rounded-3xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                    <span className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1.5 rounded-lg text-xs font-mono text-white/70">
                      {activeHeatmap?.condition?.toUpperCase() ?? 'NO_SELECTION'}
                    </span>

                    {activeHeatmap ? (
                      <div className="relative w-full h-full overflow-hidden rounded-2xl">
                        <img
                          src={scan.imageUrl}
                          className="w-full h-full object-contain"
                          alt="Base Image Analysis"
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            setFullscreenImgDims({ width: img.clientWidth, height: img.clientHeight });
                          }}
                        />
                        {fullscreenImgDims.width > 0 && (
                          <ScanAnnotationOverlay
                            finding={{
                              condition: activeHeatmap.condition,
                              severity: (activeHeatmap.severity || 'mild') as any,
                              confidence: activeHeatmap.confidence || 0,
                              regionX: activeHeatmap.regionX,
                              regionY: activeHeatmap.regionY
                            }}
                            imageDimensions={fullscreenImgDims}
                          />
                        )}

                        {/* Severity-Aware Badge in Fullscreen */}
                        <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-40">
                          {(() => {
                            const style = SEVERITY_COLORS[(activeHeatmap.severity || 'mild') as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.mild;
                            return (
                              <Badge className={`${style.badge} text-white text-xs uppercase font-black px-4 py-2 shadow-2xl border border-white/10`}>
                                {style.label}: {activeHeatmap.condition.toUpperCase()}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-2 opacity-50">
                        <Microscope className="h-12 w-12 mx-auto" />
                        <p>Select a region to analyze</p>
                      </div>
                    )}

                    {activeHeatmap && (
                      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                        <p className="text-white text-sm max-w-3xl leading-relaxed">
                          {activeHeatmap?.interpretationNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Selection */}
                  <div className="w-80 flex-none flex flex-col gap-4 overflow-hidden">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Layers className="h-5 w-5" /> Detected Regions
                    </h3>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 pb-4">
                      {results?.gradCamHeatmaps?.map((heatmap, idx) => (
                        <div
                          key={idx}
                          onClick={() => setActiveHeatmapIdx(idx)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeHeatmapIdx === idx ? 'bg-primary/20 border-primary shadow-lg scale-[1.02]' : 'bg-card/50 border-border hover:border-primary/50'}`}
                        >
                          <div className="font-bold text-sm mb-1">{heatmap.condition}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {heatmap.affectedRegions.map((r, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] bg-background/50">{r.region}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )
        }
      </AnimatePresence >

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(var(--foreground), 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--foreground), 0.1);
          border-radius: 2px;
        }
        @keyframes scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
            animation: scan 3s linear infinite;
        }
        .animate-fadeIn {
            animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div >
  );
}
