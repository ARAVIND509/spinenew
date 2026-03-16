import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";

import { registerRoutes } from "./routes";
import { setupAuth, hashPassword } from "./auth";
import { setupVite, log } from "./vite";
import { setupWebSocket } from "./websocket-handler";
import { storage } from "./storage";

/* ---------- FIX FOR ESM (__dirname support) ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/* ----------------------------------------------------- */

const app = express();

/* -------- Safer JSON / Form Limits -------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

setupAuth(app);

/* -------------------- Safe API Logger -------------------- */
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (requestPath.startsWith("/api")) {
      log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

/* -------------------- Main Server -------------------- */
(async () => {
  const server = await registerRoutes(app);

  setupWebSocket(server);

  /* ----------- Seed Admin User ----------- */
  try {
    const admin = await storage.getUserByUsername("admin");

    if (!admin) {
      log("Seeding default admin user...");

      const hashedPassword = await hashPassword("password123");

      await storage.createUser({
        username: "admin",
        password: hashedPassword,
      });

      log(
        "Admin user created successfully (username: admin, password: password123)"
      );
    }
  } catch (err) {
    console.error("Failed to seed admin user:", err);
  }

  /* ----------- Error Handler ----------- */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Server error:", err);

    if (err?.type === "entity.too.large") {
      return res.status(413).json({
        message: "Request too large. Please upload a smaller file.",
      });
    }

    if (err?.message === "Unsupported file type") {
      return res.status(400).json({
        message: "Unsupported file type. Please upload PNG, JPG, JPEG, WEBP, BMP, or DICOM.",
      });
    }

    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "File too large. Maximum allowed size is 10MB.",
      });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  /* ----------- Vite / Static Serving ----------- */
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    const distPath = path.resolve(__dirname, "../dist/public");

    log("Serving static files from: " + distPath);

    app.use(express.static(distPath));

    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  /* ----------- Render Port Handling ----------- */
  const port = Number(process.env.PORT) || 5000;
  const host =
    process.env.NODE_ENV === "development" ? "localhost" : "0.0.0.0";

  server.listen(port, host, () => {
    log(`Server running on http://${host}:${port}`);
  });
})();