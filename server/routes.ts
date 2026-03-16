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
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/bmp",
      "application/dicom",
    ];

    const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".dcm"];
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
    `${label} | heapUsed: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB ` +
      `| rss: ${(used.rss / 1024 / 1024).toFixed(2)} MB ` +
      `| heapTotal: ${(used.heapTotal / 1024 / 1024).toFixed(2)} MB`
  );
}

function normalizeDiseasePredictions(results: any) {
  logMem("normalizeDiseasePredictions start");

  if (!results || typeof results !== "object") {
    return {
      mlPredictions: {
        predictions: [
          {
            disease: "Normal",
            confidence: 80,
            severity: "normal",
            status: "low",
            recommendation: "No major abnormality suggested.",
          },
        ],
      },
    };
  }

  if (!results.mlPredictions || typeof results.mlPredictions !== "object") {
    results.mlPredictions = { predictions: [] };
  }

  const rawPredictions = Array.isArray(results.mlPredictions.predictions)
    ? results.mlPredictions.predictions
    : [];

  const getDiseaseName = (p: any) => {
    return (
      p?.disease ||
      p?.diseaseName ||
      p?.condition ||
      p?.label ||
      p?.className ||
      p?.name ||
      "Unknown"
    );
  };

  const normalizeConfidence = (value: any) => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    return value > 1 ? value / 100 : value;
  };

  const cleaned = rawPredictions
    .map((p: any) => ({
      ...p,
      disease: String(getDiseaseName(p)).trim(),
      confidence: normalizeConfidence(
        p?.confidence ?? p?.score ?? p?.probability ?? 0
      ),
    }))
    .filter((p: any) => p.disease && p.disease !== "Unknown");

  const dedupedMap = new Map<string, any>();

  for (const pred of cleaned) {
    const key = pred.disease.toLowerCase();
    const existing = dedupedMap.get(key);

    if (!existing || pred.confidence > existing.confidence) {
      dedupedMap.set(key, pred);
    }
  }

  let deduped = Array.from(dedupedMap.values()).sort(
    (a: any, b: any) => b.confidence - a.confidence
  );

  if (deduped.length === 0) {
    results.mlPredictions.predictions = [
      {
        disease: "Normal",
        confidence: 80,
        severity: "normal",
        status: "low",
        recommendation: "No major abnormality suggested.",
      },
    ];
    logMem("normalizeDiseasePredictions end (fallback)");
    return results;
  }

  const topPrediction = deduped[0];
  const topDisease = String(topPrediction.disease).toLowerCase();

  if (topDisease === "normal" && topPrediction.confidence >= 0.7) {
    results.mlPredictions.predictions = [
      {
        ...topPrediction,
        confidence: Number((topPrediction.confidence * 100).toFixed(2)),
        severity: "normal",
        status: "low",
        recommendation: "No major abnormality suggested.",
      },
    ];
    logMem("normalizeDiseasePredictions end (normal top)");
    return results;
  }

  deduped = deduped
    .filter((p: any) => String(p.disease).toLowerCase() !== "normal")
    .slice(0, 4);

  const finalPredictions = deduped.map((p: any, index: number) => {
    let severity = "normal";
    let status = "low";

    if (index === 0) {
      if (p.confidence >= 0.8) {
        severity = "severe";
        status = "high";
      } else if (p.confidence >= 0.6) {
        severity = "moderate";
        status = "medium";
      } else if (p.confidence >= 0.4) {
        severity = "mild";
        status = "low";
      }
    } else if (index === 1) {
      if (p.confidence >= 0.75) {
        severity = "moderate";
        status = "medium";
      } else if (p.confidence >= 0.45) {
        severity = "mild";
        status = "low";
      }
    } else {
      if (p.confidence >= 0.55) {
        severity = "mild";
        status = "low";
      }
    }

    return {
      ...p,
      confidence: Number((p.confidence * 100).toFixed(2)),
      severity,
      status,
      recommendation:
        severity === "severe"
          ? "Urgent specialist review recommended."
          : severity === "moderate"
          ? "Clinical correlation and specialist consultation recommended."
          : severity === "mild"
          ? "Mild finding. Monitor and correlate with symptoms."
          : "Low likelihood finding.",
    };
  });

  if (finalPredictions.length === 0) {
    results.mlPredictions.predictions = [
      {
        disease: "Normal",
        confidence: 80,
        severity: "normal",
        status: "low",
        recommendation: "No major abnormality suggested.",
      },
    ];
    logMem("normalizeDiseasePredictions end (empty final)");
    return results;
  }

  results.mlPredictions.predictions = finalPredictions;
  logMem("normalizeDiseasePredictions end");
  return results;
}

function safeJsonParse(value: any) {
  if (value == null) return null;
  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      console.error("JSON parse error:", err);
      return null;
    }
  }

  return null;
}

/* -------------------- Routes -------------------- */
export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    next();
  });

  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", async (_req: Request, res: Response) => {
    res.json({ ok: true, message: "Server is running" });
  });

  app.get("/api/patients", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 50);
      const patients = await storage.getPatients(limit);
      return res.json(patients ?? []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      return res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  app.post("/api/patients", async (req: Request, res: Response) => {
    try {
      const {
        patientId,
        firstName,
        lastName,
        fullName,
        age,
        gender,
        phone,
      } = req.body ?? {};

      if (!patientId || String(patientId).trim() === "") {
        return res.status(400).json({ message: "patientId is required" });
      }

      const existingPatient = await storage.getPatientByPatientId(String(patientId));

      if (existingPatient) {
        return res.status(200).json(existingPatient);
      }

      const patient = await storage.createPatient({
        patientId: String(patientId).trim(),
        firstName: firstName ? String(firstName).trim() : "",
        lastName: lastName ? String(lastName).trim() : "",
        fullName: fullName ? String(fullName).trim() : undefined,
        age:
          age !== undefined && age !== null && age !== ""
            ? Number(age)
            : null,
        gender: gender ? String(gender).trim() : null,
        phone: phone ? String(phone).trim() : null,
      });

      return res.status(201).json(patient);
    } catch (error: any) {
      console.error("Error creating patient:", error);
      return res.status(500).json({
        message: error?.message || "Failed to create patient",
      });
    }
  });

  app.get("/api/scans/recent", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 20);
      const scans = await storage.getRecentScans(limit);

      const formatted = (scans ?? []).map((scan: any) => {
        const metadata =
          safeJsonParse(scan.metadata) ||
          safeJsonParse(scan.analysisResults) ||
          safeJsonParse(scan.results) ||
          safeJsonParse(scan.mlResults) ||
          null;

        const normalized = metadata ? normalizeDiseasePredictions(metadata) : null;
        const topPrediction = normalized?.mlPredictions?.predictions?.[0] ?? null;

        return {
          ...scan,
          analysisResults: normalized,
          resultSummary: topPrediction
            ? {
                disease: topPrediction.disease,
                confidence: topPrediction.confidence,
                severity: topPrediction.severity,
              }
            : null,
        };
      });

      return res.json(formatted);
    } catch (error) {
      console.error("Error fetching recent scans:", error);
      return res.status(500).json({ message: "Failed to fetch recent scans" });
    }
  });

  app.get("/api/scans/:id", async (req: Request, res: Response) => {
    try {
      const scan = await storage.getScanById(req.params.id);

      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      const parsedResults =
        safeJsonParse((scan as any).metadata) ||
        safeJsonParse((scan as any).analysisResults) ||
        safeJsonParse((scan as any).results) ||
        safeJsonParse((scan as any).mlResults) ||
        null;

      const normalizedResults = parsedResults
        ? normalizeDiseasePredictions(parsedResults)
        : null;

      return res.json({
        ...scan,
        analysisResults: normalizedResults,
      });
    } catch (error) {
      console.error("Error fetching scan details:", error);
      return res.status(500).json({ message: "Failed to fetch scan details" });
    }
  });

  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      return res.json({
        success: true,
        file: {
          filename: req.file.filename,
          originalname: req.file.originalname,
          path: `/uploads/${req.file.filename}`,
          size: req.file.size,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "File upload failed" });
    }
  });

  return server;
}