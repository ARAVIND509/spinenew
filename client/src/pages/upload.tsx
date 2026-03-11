import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadScan } from "@/components/upload-scan";
import { DatabaseScanFetch } from "@/components/database-scan-fetch";
import { PatientForm } from "@/components/patient-form";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, Database, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { InsertPatient, Patient, Scan } from "@shared/schema";

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);

  // Create patient mutation
  const createPatientMutation = useMutation({
    mutationFn: async (data: InsertPatient) => {
      return await apiRequest<Patient>("POST", "/api/patients", data);
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Patient created",
        description: "You can now upload scans for this patient",
      });
      // Only redirect if this wasn't called via handleDirectUpload
      // We can check if we are on the "new-patient" tab or just let the caller handle it.
      // But mutateAsync is used in handleDirectUpload, so onSucess still runs.
      // Better way: handle navigation in the component tab where it's used.
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating patient",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Direct upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, imageType, patientId }: { file: File; imageType: string; patientId: string }) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("patientCaseId", patientId);
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
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
      toast({
        title: "Scan uploaded successfully",
        description: "Redirecting to AI analysis",
      });
      setUploadProgress(0);
      setLocation(`/ai-analysis/${data.scan.id}`);
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

  const handleDirectUpload = async (file: File, imageType: string) => {
    // For direct upload, we'll need to create a temporary patient or ask for patient ID
    // For now, let's create a temporary patient with file name
    const tempPatientData = {
      patientId: `TEMP-${Date.now()}`,
      name: file.name.split('.')[0],
    };

    try {
      const patient = await createPatientMutation.mutateAsync(tempPatientData);
      uploadMutation.mutate({ file, imageType, patientId: patient.id });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDatabaseScanSelect = (scan: Scan, patient: Patient) => {
    toast({
      title: "Scan selected",
      description: `Selected ${scan.imageType} scan for ${patient.name}`,
    });
    setLocation(`/ai-analysis/${scan.id}`);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload Medical Scans</h1>
        <p className="text-muted-foreground">
          Upload new scans directly or fetch from hospital database
        </p>
      </div>

      <Tabs defaultValue="direct" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-1 sm:grid-cols-3 mx-auto h-auto sm:h-10">
          <TabsTrigger value="direct" data-testid="tab-direct-upload" className="py-2">
            <UploadIcon className="h-4 w-4 mr-2" />
            Direct Upload
          </TabsTrigger>
          <TabsTrigger value="database" data-testid="tab-database-fetch" className="py-2">
            <Database className="h-4 w-4 mr-2" />
            Hospital Database
          </TabsTrigger>
          <TabsTrigger value="new-patient" data-testid="tab-new-patient" className="py-2">
            <UserPlus className="h-4 w-4 mr-2" />
            New Patient
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direct" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Direct Scan Upload</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload MRI or X-ray scans directly for immediate analysis
              </p>
            </CardHeader>
            <CardContent>
              <UploadScan
                onUpload={handleDirectUpload}
                isUploading={uploadMutation.isPending || createPatientMutation.isPending}
                uploadProgress={uploadProgress}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <DatabaseScanFetch onScanSelect={handleDatabaseScanSelect} />
        </TabsContent>

        <TabsContent value="new-patient" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Patient Case</CardTitle>
              <p className="text-sm text-muted-foreground">
                Register a new patient and upload their medical scans
              </p>
            </CardHeader>
            <CardContent>
              <PatientForm
                onSubmit={(data) => {
                  createPatientMutation.mutate(data, {
                    onSuccess: (patient) => {
                      setLocation(`/case/${patient.id}`);
                    }
                  });
                }}
                isSubmitting={createPatientMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
