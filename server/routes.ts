import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { storage } from "./storage";

/* -------------------- Upload Setup -------------------- */
const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext || ".png";
    cb(null, `${Date.now()}-${randomUUID()}${safeExt}`);
  },
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // ✅ 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/bmp",
    ];

    const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported file type"));
  },
});

/* -------------------- Helpers -------------------- */
function logMem(label: string) {
  const used = process.memoryUsage();
  console.log(
    `${label} | heapUsed: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB | rss: ${(used.rss / 1024 / 1024).toFixed(2)} MB`
  );
}

function safeJsonParse(value: any) {
  if (value == null) return null;
  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

/* -------------------- Routes -------------------- */
export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  /* ---------- PATIENTS ---------- */
  app.get("/api/patients", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 50);
      const patients = await storage.getPatients(limit);
      res.json(patients ?? []);
    } catch {
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  app.post("/api/patients", async (req, res) => {
    try {
      const { patientId, fullName, age } = req.body ?? {};

      if (!patientId) {
        return res.status(400).json({ message: "patientId required" });
      }

      const existing = await storage.getPatientByPatientId(patientId);
      if (existing) return res.json(existing);

      const patient = await storage.createPatient({
        patientId,
        fullName,
        age: age ? Number(age) : null,
      });

      res.status(201).json(patient);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  /* ---------- UPLOAD (FIXED) ---------- */
  app.post(
    "/api/upload",
    upload.single("image"), // ✅ FIXED FIELD NAME
    async (req: Request, res: Response) => {
      logMem("UPLOAD START");

      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const filePath = req.file.path;

        // 👉 Simulate processing (replace with your ML logic)
        const result = {
          disease: "Normal",
          confidence: 95,
        };

        // ✅ DELETE FILE AFTER USE
        fs.unlink(filePath, (err) => {
          if (err) console.error("Delete error:", err);
        });

        logMem("UPLOAD END");

        return res.json({
          success: true,
          result,
        });
      } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ message: "Upload failed" });
      }
    }
  );

  return server;
}