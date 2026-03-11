import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Home from "@/pages/home";
import Upload from "@/pages/upload";
import CaseDetail from "@/pages/case-detail";
import Analysis from "@/pages/analysis";
import AIAnalysis from "@/pages/ai-analysis";
import Database from "@/pages/database";
import Reports from "@/pages/reports";
import Profile from "@/pages/profile";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function AuthRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/auth");
  }, [setLocation]);
  return null;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    toast({
      title: "Logged out successfully",
      description: "You have been logged out of your account.",
    });
    setLocation("/auth");
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-6 h-16 border-b bg-background sticky top-0 z-40">
            <div className="flex items-center gap-4 flex-1">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Input
                placeholder="Search patients, scans..."
                className="max-w-md"
                data-testid="input-search"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" data-testid="button-notifications">
                <Bell className="h-5 w-5" />
              </Button>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-3 pl-3 border-l hover-elevate"
                    data-testid="button-profile"
                  >
                    <div className="text-right">
                      <p className="text-sm font-medium">{user?.username || "Dr. Sarah Johnson"}</p>
                      <p className="text-xs text-muted-foreground">Spinal Specialist</p>
                    </div>
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {(user?.username || "SJ").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="menu-profile"
                    onClick={() => setLocation("/profile")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="menu-settings"
                    onClick={() => setLocation("/profile")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="menu-logout"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/auth" component={LoginPage} />
        <Route component={AuthRedirect} />
      </Switch>
    );
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/upload" component={Upload} />
        <Route path="/case/:id" component={CaseDetail} />
        <Route path="/analysis" component={Analysis} />
        <Route path="/ai-analysis/:scanId" component={AIAnalysis} />
        <Route path="/database" component={Database} />
        <Route path="/reports" component={Reports} />
        <Route path="/profile" component={Profile} />
        <Route path="/auth" component={LoginPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
