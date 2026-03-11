import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Patient, Scan } from "@shared/schema";

interface DatabaseScanFetchProps {
  onScanSelect: (scan: Scan, patient: Patient) => void;
}

export function DatabaseScanFetch({ onScanSelect }: DatabaseScanFetchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const { data: allPatients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: scans = [], isLoading: scansLoading } = useQuery<Scan[]>({
    queryKey: ["/api/scans", selectedPatient?.id],
    enabled: !!selectedPatient,
  });

  const filteredPatients = allPatients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.patientId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search Patient Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-patient-search"
            />
          </div>

          {patientsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredPatients.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredPatients.slice(0, 5).map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-3 rounded-md border cursor-pointer ${
                    selectedPatient?.id === patient.id
                      ? "border-primary bg-primary/5"
                      : "hover-elevate"
                  }`}
                  data-testid={`patient-item-${patient.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{patient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {patient.patientId} {patient.age && `• Age: ${patient.age}`}
                      </p>
                    </div>
                    <Badge variant="outline">Select</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No patients found matching "{searchTerm}"
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Enter patient name or ID to search
            </p>
          )}
        </CardContent>
      </Card>

      {selectedPatient && (
        <Card>
          <CardHeader>
            <CardTitle>Available Scans for {selectedPatient.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {scansLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : scans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-4 rounded-md border hover-elevate"
                    data-testid={`db-scan-item-${scan.id}`}
                  >
                    <div className="space-y-3">
                      <div className="h-32 rounded-md overflow-hidden bg-muted">
                        <img
                          src={scan.imageUrl}
                          alt={`${scan.imageType} scan`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{scan.imageType} Scan</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(scan.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onScanSelect(scan, selectedPatient)}
                          data-testid={`button-upload-scan-${scan.id}`}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No scans found for this patient
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
