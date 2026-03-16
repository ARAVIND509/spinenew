import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/* ---------- FIX FOR CJS BUILD ---------- */
const rootDir = process.cwd();
/* -------------------------------------- */

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "client", "src"),
      "@shared": path.resolve(rootDir, "shared"),
      "@assets": path.resolve(rootDir, "attached_assets"),
    },
  },
  root: path.resolve(rootDir, "client"),
  build: {
    outDir: path.resolve(rootDir, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});