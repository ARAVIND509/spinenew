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

  /* -------------------- CREATE PATIENT -------------------- */
  const createPatientMutation = useMutation({
    mutationFn: async (data: InsertPatient) => {
      return await apiRequest<Patient>("POST", "/api/patients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Patient created",
        description: "You can now upload scans for this patient",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating patient",
        description: error.message || "Failed to create patient",
        variant: "destructive",
      });
    },
  });

  /* -------------------- UPLOAD -------------------- */
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      imageType,
      patientId,
    }: {
      file: File;
      imageType: string;
      patientId: string;
    }) => {
      const formData = new FormData();

      // ✅ FIXED FIELD NAME
      formData.append("image", file);

      formData.append("patientCaseId", patientId);
      formData.append("imageType", imageType);

      // 👉 simulate progress
      setUploadProgress(30);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      let result: any = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Upload failed with status ${response.status}`
        );
      }

      // 👉 complete progress
      setUploadProgress(100);

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });

      toast({
        title: "Scan uploaded successfully",
        description: "Redirecting to AI analysis",
      });

      setUploadProgress(0);

      if (data?.scan?.id) {
        setLocation(`/ai-analysis/${data.scan.id}`);
      } else {
        toast({
          title: "Upload completed",
          description: "Scan uploaded, but scan ID was not returned",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Something went wrong during upload",
        variant: "destructive",
      });

      setUploadProgress(0);
    },
  });

  /* -------------------- HANDLE UPLOAD -------------------- */
  const handleDirectUpload = async (file: File, imageType: string) => {
    // ✅ FILE SIZE VALIDATION (VERY IMPORTANT)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload file smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    const tempPatientData: InsertPatient = {
      patientId: `TEMP-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
    };

    try {
      const patient = await createPatientMutation.mutateAsync(tempPatientData);

      await uploadMutation.mutateAsync({
        file,
        imageType,
        patientId: patient.id,
      });
    } catch {
      setUploadProgress(0);
    }
  };

  /* -------------------- DATABASE SELECT -------------------- */
  const handleDatabaseScanSelect = (scan: Scan, patient: Patient) => {
    toast({
      title: "Scan selected",
      description: `Selected ${scan.imageType} scan for ${patient.name}`,
    });
    setLocation(`/ai-analysis/${scan.id}`);
  };

  /* -------------------- UI -------------------- */
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
          <TabsTrigger value="direct">
            <UploadIcon className="h-4 w-4 mr-2" />
            Direct Upload
          </TabsTrigger>

          <TabsTrigger value="database">
            <Database className="h-4 w-4 mr-2" />
            Hospital Database
          </TabsTrigger>

          <TabsTrigger value="new-patient">
            <UserPlus className="h-4 w-4 mr-2" />
            New Patient
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direct" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Direct Scan Upload</CardTitle>
              <p className="text-sm text-muted-foreground">
                Supports JPEG, PNG, WEBP up to 5MB
              </p>
            </CardHeader>
            <CardContent>
              <UploadScan
                onUpload={handleDirectUpload}
                isUploading={
                  uploadMutation.isPending || createPatientMutation.isPending
                }
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
                    },
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