import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Stethoscope, ShieldCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 text-slate-50 overflow-hidden">
      {/* Left Side Branding */}
      <div className="relative hidden lg:flex flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
              <Brain className="w-16 h-16 text-blue-400" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              SpineGuard AI
            </h1>

            <p className="text-xl text-slate-400 max-w-md mx-auto leading-relaxed">
              Advanced Neural Analysis for Spinal Diagnostics. Precision, Speed,
              and Intelligence in Every Scan.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-12">
            {[
              { icon: Stethoscope, label: "Diagnostic Precision" },
              { icon: Brain, label: "AI Powered" },
              { icon: ShieldCheck, label: "Secure Data" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <feature.icon className="w-6 h-6 text-blue-400" />
                </div>

                <span className="text-xs font-medium text-slate-500">
                  {feature.label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Login Form */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-slate-900/50 backdrop-blur-xl border-l border-slate-800/50">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="lg:hidden text-center space-y-4 mb-12">
            <Brain className="w-12 h-12 text-blue-400 mx-auto" />
            <h1 className="text-3xl font-bold">SpineGuard AI</h1>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">Login</h2>

              <p className="text-sm text-slate-400">
                Enter your credentials to access the clinical dashboard.
              </p>
            </div>

            <AuthForm
              mode="login"
              onSubmit={(data) => loginMutation.mutate(data)}
              isLoading={loginMutation.isPending}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function AuthForm({
  mode,
  onSubmit,
  isLoading,
}: {
  mode: "login" | "register";
  onSubmit: (data: InsertUser) => void;
  isLoading: boolean;
}) {
  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-slate-300">
            Username
          </Label>

          <Input
            id="username"
            {...form.register("username")}
            className="bg-slate-950 border-slate-800 focus:border-blue-500"
            placeholder="Enter your username"
          />

          {form.formState.errors.username && (
            <p className="text-xs text-red-400 mt-1">
              {form.formState.errors.username.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">
            Password
          </Label>

          <Input
            id="password"
            type="password"
            {...form.register("password")}
            className="bg-slate-950 border-slate-800 focus:border-blue-500"
            placeholder="••••••••"
          />

          {form.formState.errors.password && (
            <p className="text-xs text-red-400 mt-1">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 h-11"
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}

        {mode === "login" ? "Sign In" : "Create Account"}
      </Button>
    </form>
  );
}