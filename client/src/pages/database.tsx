import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Users, FileText, ChevronDown, ChevronUp, Brain } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Patient, Scan } from "@shared/schema";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Database() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [, navigate] = useLocation();
  
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patientId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePatient = (patientId: string) => {
    setExpandedPatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Patient Database</h1>
            <p className="text-muted-foreground">
              Manage and view all patient records and medical histories
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Patients
            </CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-total-patients">
              {patients.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Cases
            </CardTitle>
            <FileText className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-active-cases">
              {patients.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <Plus className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-this-month">
              {patients.filter(p => {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return new Date(p.createdAt) > monthAgo;
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Patients</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-patients"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPatients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "No patients found matching your search" : "No patient records yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPatients.map((patient) => (
                <PatientRow 
                  key={patient.id} 
                  patient={patient}
                  isExpanded={expandedPatients.has(patient.id)}
                  onToggle={() => togglePatient(patient.id)}
                  onNavigate={navigate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface PatientRowProps {
  patient: Patient;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: (path: string) => void;
}

function PatientRow({ patient, isExpanded, onToggle, onNavigate }: PatientRowProps) {
  const { data: scans = [] } = useQuery<Scan[]>({
    queryKey: ["/api/scans", patient.id],
    enabled: isExpanded,
  });

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-md border">
        <CollapsibleTrigger className="w-full" data-testid={`patient-row-${patient.id}`}>
          <div className="flex items-center justify-between p-4 hover-elevate">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <p className="font-medium">{patient.name}</p>
                <p className="text-sm text-muted-foreground">
                  ID: {patient.patientId} {patient.age && `• Age: ${patient.age}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  Added {format(new Date(patient.createdAt), "MMM d, yyyy")}
                </p>
                {scans.length > 0 && (
                  <p className="text-sm text-primary font-medium">
                    {scans.length} scan{scans.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4 bg-muted/30">
            {scans.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">No scans uploaded yet</p>
                <Link href={`/case/${patient.id}`}>
                  <Button size="sm" data-testid={`button-upload-scan-${patient.id}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload First Scan
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Patient Scans</h4>
                  <Link href={`/case/${patient.id}`}>
                    <Button size="sm" variant="outline" data-testid={`button-view-case-${patient.id}`}>
                      View Case
                    </Button>
                  </Link>
                </div>
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between p-3 rounded-md border bg-background hover-elevate"
                    data-testid={`scan-row-${scan.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 rounded-md overflow-hidden bg-muted">
                        <img
                          src={scan.imageUrl}
                          alt="Scan thumbnail"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{scan.imageType} Scan</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {format(new Date(scan.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(`/ai-analysis/${scan.id}`);
                      }}
                      data-testid={`button-analyze-${scan.id}`}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Analyze
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
