import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Brain, Upload } from "lucide-react";
import { UploadScan } from "@/components/upload-scan";
import { DatabaseScanFetch } from "@/components/database-scan-fetch";
import { ImageViewer } from "@/components/image-viewer";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Patient, Scan } from "@shared/schema";

export default function CaseDetail() {
  const [, params] = useRoute("/case/:id");
  const [, setLocation] = useLocation();
  const caseId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  const { data: patient, isLoading: patientLoading } = useQuery<Patient>({
    queryKey: ["/api/patients", caseId],
    enabled: !!caseId,
  });

  const { data: scans = [] } = useQuery<Scan[]>({
    queryKey: ["/api/scans", caseId],
    enabled: !!caseId,
  });


  const uploadMutation = useMutation({
    mutationFn: async ({ file, imageType }: { file: File; imageType: string }) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("patientCaseId", caseId!);
      formData.append("imageType", imageType);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans", caseId] });
      setSelectedScan(data.scan);
      toast({
        title: "Scan uploaded",
        description: "Click 'Predict' to start AI analysis",
      });
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const handleUpload = async (file: File, imageType: string) => {
    setUploadProgress(30);
    setTimeout(() => setUploadProgress(60), 500);
    setTimeout(() => setUploadProgress(90), 1000);
    uploadMutation.mutate({ file, imageType });
  };

  const handleDatabaseScanSelect = (scan: Scan, patient: Patient) => {
    setSelectedScan(scan);
    toast({
      title: "Scan selected from database",
      description: `${scan.imageType} scan for ${patient.name} - Click 'Predict' to analyze`,
    });
  };

  if (patientLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <p className="text-medical-body text-muted-foreground mb-4">Patient case not found</p>
        <Button onClick={() => setLocation("/")} data-testid="button-back-home">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b px-6 py-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{patient.name}</h1>
            <p className="text-sm text-muted-foreground">Patient ID: {patient.patientId} {patient.age && `• Age: ${patient.age}`}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl space-y-6">
            {scans.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Existing Scans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scans.map((scan) => (
                      <div
                        key={scan.id}
                        className={`p-4 rounded-md border ${selectedScan?.id === scan.id ? 'border-primary bg-primary/5' : ''} hover-elevate cursor-pointer`}
                        onClick={() => setSelectedScan(scan)}
                        data-testid={`scan-item-${scan.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-20 w-20 rounded-md overflow-hidden bg-muted">
                            <img
                              src={scan.imageUrl}
                              alt="Scan"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{scan.imageType} Scan</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(scan.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedScan ? (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Scan Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="aspect-video rounded-md overflow-hidden bg-muted">
                      <img
                        src={selectedScan.imageUrl}
                        alt="Selected scan"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedScan.imageType} Scan</p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded {new Date(selectedScan.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => setLocation(`/ai-analysis/${selectedScan.id}`)}
                        data-testid="button-predict"
                      >
                        <Brain className="h-5 w-5 mr-2" />
                        Predict
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="text-center">
                    <CardTitle className="text-2xl mb-2">Upload Scan for Analysis</CardTitle>
                    <p className="text-muted-foreground">
                      Choose from database or upload new MRI/X-ray images
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="database" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="database" data-testid="tab-database-fetch">
                        Database Fetch
                      </TabsTrigger>
                      <TabsTrigger value="local" data-testid="tab-local-upload">
                        Local Upload
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="database" className="mt-6">
                      <DatabaseScanFetch onScanSelect={handleDatabaseScanSelect} />
                    </TabsContent>
                    <TabsContent value="local" className="mt-6">
                      <UploadScan
                        onUpload={handleUpload}
                        isUploading={uploadMutation.isPending}
                        uploadProgress={uploadProgress}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
