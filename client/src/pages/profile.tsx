import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  IdCard, 
  Shield, 
  Bell, 
  Moon, 
  Eye,
  Edit,
  Save,
  X
} from "lucide-react";
import { useTheme } from "next-themes";

export default function Profile() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@spineguard.com",
    phone: "+1 (555) 123-4567",
    specialty: "Spinal Specialist",
    licenseNumber: "MD-123456-NY",
    department: "Neurosurgery",
    organization: "SpineGuard Medical Center"
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    analysisAlerts: true,
    weeklyReports: true
  });

  const handleSave = () => {
    toast({
      title: "Profile updated",
      description: "Your profile information has been saved successfully.",
    });
    setIsEditing(false);
  };

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header Section */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-24 w-24 border-4 border-primary/20">
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              SJ
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{profileData.name}</h1>
            <p className="text-muted-foreground">{profileData.specialty}</p>
            <Badge variant="secondary" className="mt-2">
              <Shield className="h-3 w-3 mr-1" />
              Verified Practitioner
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(false)}
                data-testid="button-cancel-edit"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-profile"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Your professional and contact details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="specialty"
                  value={profileData.specialty}
                  onChange={(e) => setProfileData({ ...profileData, specialty: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-specialty"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license">License Number</Label>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="license"
                  value={profileData.licenseNumber}
                  onChange={(e) => setProfileData({ ...profileData, licenseNumber: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-license"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="department"
                  value={profileData.department}
                  onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-department"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="organization">Organization</Label>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Input
                id="organization"
                value={profileData.organization}
                onChange={(e) => setProfileData({ ...profileData, organization: e.target.value })}
                disabled={!isEditing}
                className="max-w-md"
                data-testid="input-organization"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications & Preferences
          </CardTitle>
          <CardDescription>
            Manage your notification settings and application preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notif">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates via email
                </p>
              </div>
              <Switch
                id="email-notif"
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) => 
                  setPreferences({ ...preferences, emailNotifications: checked })
                }
                data-testid="switch-email-notifications"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notif">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get real-time alerts in the app
                </p>
              </div>
              <Switch
                id="push-notif"
                checked={preferences.pushNotifications}
                onCheckedChange={(checked) => 
                  setPreferences({ ...preferences, pushNotifications: checked })
                }
                data-testid="switch-push-notifications"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="analysis-alerts">Analysis Completion Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when AI analysis is complete
                </p>
              </div>
              <Switch
                id="analysis-alerts"
                checked={preferences.analysisAlerts}
                onCheckedChange={(checked) => 
                  setPreferences({ ...preferences, analysisAlerts: checked })
                }
                data-testid="switch-analysis-alerts"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly-reports">Weekly Reports</Label>
                <p className="text-sm text-muted-foreground">
                  Receive weekly summary of your cases
                </p>
              </div>
              <Switch
                id="weekly-reports"
                checked={preferences.weeklyReports}
                onCheckedChange={(checked) => 
                  setPreferences({ ...preferences, weeklyReports: checked })
                }
                data-testid="switch-weekly-reports"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how the application looks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark themes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="dark-mode"
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                data-testid="switch-dark-mode"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">142</div>
            <p className="text-sm text-muted-foreground mt-1">+12 this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Cases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">23</div>
            <p className="text-sm text-muted-foreground mt-1">8 pending review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Member Since</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">2023</div>
            <p className="text-sm text-muted-foreground mt-1">2 years active</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
