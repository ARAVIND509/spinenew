import type { Express, Request, Response } from "express";
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

    const allowedExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".bmp",
      ".dcm",
    ];

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

function normalizeDiseasePredictions(results: any) {
  if (!results || typeof results !== "object") {
    return {
      mlPredictions: {
        predictions: [
          {
            disease: "Normal",
            confidence: 0.8,
            severity: "normal",
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

  const getSeverity = (confidence: number) => {
    if (confidence >= 0.85) return "severe";
    if (confidence >= 0.7) return "moderate";
    if (confidence >= 0.5) return "mild";
    return "low";
  };

  const cleaned = rawPredictions
    .map((p: any) => {
      const disease = String(getDiseaseName(p)).trim();
      const confidence = normalizeConfidence(
        p?.confidence ?? p?.score ?? p?.probability
      );

      return {
        ...p,
        disease,
        confidence,
        severity: getSeverity(confidence),
      };
    })
    .filter((p: any) => p.disease && p.disease !== "Unknown");

  const dedupedMap = new Map<string, any>();

  for (const pred of cleaned) {
    const key = pred.disease.toLowerCase();
    const existing = dedupedMap.get(key);

    if (!existing || pred.confidence > existing.confidence) {
      dedupedMap.set(key, pred);
    }
  }

  const deduped = Array.from(dedupedMap.values())
    .filter((p: any) => p.confidence >= 0.4)
    .sort((a: any, b: any) => b.confidence - a.confidence);

  if (deduped.length === 0) {
    results.mlPredictions.predictions = [
      {
        disease: "Normal",
        confidence: 0.8,
        severity: "normal",
      },
    ];
    return results;
  }

  const topPrediction = deduped[0];

  if (
    String(topPrediction.disease).toLowerCase() === "normal" &&
    topPrediction.confidence >= 0.75
  ) {
    results.mlPredictions.predictions = [topPrediction];
    return results;
  }

  const finalPredictions = deduped
    .filter((p: any) => String(p.disease).toLowerCase() !== "normal")
    .slice(0, 3);

  results.mlPredictions.predictions =
    finalPredictions.length > 0 ? finalPredictions : [topPrediction];

  return results;
}

function safeJsonParse(value: any) {
  if (value == null) return null;
  if (typeof value === "object") return value;

  if (typeof value === "string") {
    if (value.length > 2_000_000) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return null;
}

function buildScanSummary(scan: any) {
  const parsedResults =
    safeJsonParse(scan.analysisResults) ||
    safeJsonParse(scan.results) ||
    safeJsonParse(scan.mlResults) ||
    null;

  const normalized = parsedResults
    ? normalizeDiseasePredictions(parsedResults)
    : null;

  const predictions = normalized?.mlPredictions?.predictions ?? [];
  const topPrediction = predictions[0] ?? null;

  return {
    id: scan.id,
    patientId: scan.patientId,
    scanType: scan.scanType ?? scan.modality ?? "Unknown",
    imageType: scan.imageType ?? null,
    status: scan.status ?? "completed",
    createdAt: scan.createdAt,
    updatedAt: scan.updatedAt ?? null,
    imageUrl: scan.imageUrl ?? null,
    heatmapUrl: scan.heatmapUrl ?? null,
    resultSummary: topPrediction
      ? {
          disease: topPrediction.disease,
          confidence: topPrediction.confidence,
          severity: topPrediction.severity,
        }
      : null,
  };
}

/* -------------------- Routes -------------------- */

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    next();
  });

  app.use("/uploads", require("express").static(uploadsDir));

  /* -------- Health Check -------- */
  app.get("/api/health", async (_req: Request, res: Response) => {
    res.json({ ok: true, message: "Server is running" });
  });

  /* -------- Patients List -------- */
  app.get("/api/patients", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 50);
      const patients = await storage.getPatients?.(limit);

      if (Array.isArray(patients)) {
        const compactPatients = patients.map((patient: any) => ({
          id: patient.id,
          patientId: patient.patientId,
          firstName: patient.firstName ?? "",
          lastName: patient.lastName ?? "",
          fullName:
            patient.fullName ??
            `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim(),
          name:
            patient.fullName ??
            `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim(),
          age: patient.age ?? null,
          gender: patient.gender ?? null,
          phone: patient.phone ?? null,
          createdAt: patient.createdAt,
        }));

        return res.json(compactPatients);
      }

      return res.json([]);
    } catch (error) {
      console.error("Error fetching patients:", error);
      return res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  /* -------- Recent Scans -------- */
  app.get("/api/scans/recent", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 20);
      const scans = await storage.getRecentScans?.(limit);

      if (!Array.isArray(scans)) {
        return res.json([]);
      }

      const compactScans = scans.map((scan: any) => buildScanSummary(scan));
      return res.json(compactScans);
    } catch (error) {
      console.error("Error fetching recent scans:", error);
      return res.status(500).json({ message: "Failed to fetch recent scans" });
    }
  });

  /* -------- Single Scan Details -------- */
  app.get("/api/scans/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const scan = await storage.getScanById?.(id);

      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      const parsedResults =
        safeJsonParse(scan.analysisResults) ||
        safeJsonParse(scan.results) ||
        safeJsonParse(scan.mlResults) ||
        null;

      const normalizedResults = parsedResults
        ? normalizeDiseasePredictions(parsedResults)
        : null;

      return res.json({
        id: scan.id,
        patientId: scan.patientId,
        scanType: scan.scanType ?? scan.modality ?? "Unknown",
        imageType: scan.imageType ?? null,
        status: scan.status ?? "completed",
        createdAt: scan.createdAt,
        updatedAt: scan.updatedAt ?? null,
        imageUrl: scan.imageUrl ?? null,
        heatmapUrl: scan.heatmapUrl ?? null,
        notes: scan.notes ?? null,
        reportText: scan.reportText ?? null,
        analysisResults: normalizedResults,
      });
    } catch (error) {
      console.error("Error fetching scan details:", error);
      return res.status(500).json({ message: "Failed to fetch scan details" });
    }
  });

  /* -------- Create Patient -------- */
  app.post("/api/patients", async (req: Request, res: Response) => {
    try {
      const {
        patientId,
        firstName,
        lastName,
        fullName,
        name,
        age,
        gender,
        phone,
      } = req.body ?? {};

      const resolvedFullName =
        fullName ||
        name ||
        `${firstName ?? ""} ${lastName ?? ""}`.trim() ||
        "Unknown Patient";

      if (!patientId && !resolvedFullName && !firstName) {
        return res.status(400).json({ message: "Missing patient details" });
      }

      const createdPatient = await storage.createPatient?.({
        patientId: patientId ?? `TEMP-${Date.now()}`,
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        fullName: resolvedFullName,
        age: age != null && age !== "" ? Number(age) : null,
        gender: gender ?? null,
        phone: phone ?? null,
      });

      return res.status(201).json({
        ...createdPatient,
        name: createdPatient?.fullName ?? resolvedFullName,
      });
    } catch (error) {
      console.error("Error creating patient:", error);
      return res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to create patient",
      });
    }
  });

  /* -------- Upload Scan -------- */
  app.post(
    "/api/upload",
    upload.single("image"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        const { patientCaseId, imageType, scanType } = req.body ?? {};

        if (!file) {
          return res.status(400).json({ message: "Image file is required" });
        }

        if (!patientCaseId) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          return res.status(400).json({ message: "patientCaseId is required" });
        }

        const finalScanType =
          scanType ||
          (String(imageType || "").toLowerCase().includes("xray")
            ? "X-Ray"
            : "MRI");

        const imageUrl = `/uploads/${path.basename(file.path)}`;

        const mockAnalysisResults = normalizeDiseasePredictions({
          mlPredictions: {
            predictions: [
              {
                disease:
                  finalScanType === "X-Ray"
                    ? "Spinal Alignment Issue"
                    : "Disc Herniation",
                confidence: 0.82,
              },
              {
                disease: "Spinal Stenosis",
                confidence: 0.58,
              },
              {
                disease: "Normal",
                confidence: 0.31,
              },
            ],
          },
        });

        const createdScan = await storage.createScan?.({
          patientId: patientCaseId,
          scanType: finalScanType,
          imageType: imageType ?? null,
          imageUrl,
          heatmapUrl: null,
          notes: null,
          reportText: "Initial upload completed successfully",
          analysisResults: JSON.stringify(mockAnalysisResults),
          status: "uploaded",
        });

        return res.status(201).json({
          message: "Scan uploaded successfully",
          scan: createdScan
            ? buildScanSummary({
                ...createdScan,
                analysisResults:
                  createdScan.analysisResults ??
                  JSON.stringify(mockAnalysisResults),
              })
            : null,
        });
      } catch (error) {
        console.error("Error uploading scan:", error);
        return res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to upload scan",
        });
      }
    }
  );

  /* -------- Save Analysis Result -------- */
  app.post("/api/scans", async (req: Request, res: Response) => {
    try {
      const {
        patientId,
        scanType,
        imageType,
        imageUrl,
        heatmapUrl,
        notes,
        reportText,
        analysisResults,
      } = req.body ?? {};

      if (!patientId) {
        return res.status(400).json({ message: "patientId is required" });
      }

      const normalizedResults = analysisResults
        ? normalizeDiseasePredictions(
            typeof analysisResults === "string"
              ? safeJsonParse(analysisResults) ?? {}
              : analysisResults
          )
        : null;

      const createdScan = await storage.createScan?.({
        patientId,
        scanType: scanType ?? "MRI",
        imageType: imageType ?? null,
        imageUrl: imageUrl ?? null,
        heatmapUrl: heatmapUrl ?? null,
        notes: notes ?? null,
        reportText: reportText ?? null,
        analysisResults: normalizedResults
          ? JSON.stringify(normalizedResults)
          : null,
        status: "completed",
      });

      return res.status(201).json({
        message: "Scan saved successfully",
        scan: createdScan
          ? buildScanSummary({
              ...createdScan,
              analysisResults:
                createdScan.analysisResults ??
                (normalizedResults ? JSON.stringify(normalizedResults) : null),
            })
          : null,
      });
    } catch (error) {
      console.error("Error saving scan:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to save scan",
      });
    }
  });

  /* -------- Dummy Analyze Endpoint -------- */
  app.post("/api/scans/analyze", async (req: Request, res: Response) => {
    try {
      const { analysisResults } = req.body ?? {};

      const parsed =
        typeof analysisResults === "string"
          ? safeJsonParse(analysisResults)
          : analysisResults;

      const normalized = normalizeDiseasePredictions(
        parsed ?? {
          mlPredictions: {
            predictions: [
              {
                disease: "Disc Herniation",
                confidence: 0.82,
              },
              {
                disease: "Spinal Stenosis",
                confidence: 0.58,
              },
            ],
          },
        }
      );

      return res.json({
        message: "Analysis completed successfully",
        analysisResults: normalized,
      });
    } catch (error) {
      console.error("Error analyzing scan:", error);
      return res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to analyze scan",
      });
    }
  });

  return server;
}