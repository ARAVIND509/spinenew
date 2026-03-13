import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analyzeWithMedicalModel } from "./ml-analysis";
import { analyzeWithSCT } from "./sct-bridge";
import { insertPatientSchema, insertScanSchema, insertAnalysisSchema } from "@shared/schema";
import { parseDICOM } from "./dicom-parser";
import { updateAnalysisProgress } from "./websocket-handler";
import { ensureAuthenticated } from "./auth";

/* ------------------------------------------------ */
/* REALISTIC SEVERITY NORMALIZATION (FIXED)         */
/* ------------------------------------------------ */

function normalizeDiseaseSeverities(results: any) {

  const conditions = [
    "discHerniation",
    "scoliosis",
    "spinalStenosis",
    "degenerativeDisc",
    "vertebralFracture",
    "infection",
    "tumor"
  ];

  let detected = 0;

  for (const condition of conditions) {

    const finding = results?.[condition];

    if (!finding || finding.confidence === undefined) continue;

    const confidence = finding.confidence;

    // Ignore weak predictions
    if (confidence < 60) {
      delete results[condition];
      continue;
    }

    let severity = "mild";

    if (confidence >= 60 && confidence < 70) severity = "mild";
    else if (confidence >= 70 && confidence < 85) severity = "moderate";
    else if (confidence >= 85) severity = "severe";

    finding.severity = severity;

    detected++;

  }

  // If nothing detected
  if (detected === 0) {
    results.summary = "Normal Spine";
  }

  return results;
}

/* ------------------------------------------------ */
/* MULTER CONFIG                                    */
/* ------------------------------------------------ */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

/* ------------------------------------------------ */
/* ROUTE REGISTRATION                               */
/* ------------------------------------------------ */

export async function registerRoutes(app: Express): Promise<Server> {

  app.use("/api", (req, res, next) => {
    if (
      req.path === "/register" ||
      req.path === "/login" ||
      req.path === "/logout" ||
      req.path === "/user"
    ) {
      return next();
    }

    ensureAuthenticated(req, res, next);
  });

  /* ---------------- PATIENT ROUTES ---------------- */

  app.get("/api/patients", async (req, res) => {
    try {
      const patients = await storage.getAllPatients();
      res.json(patients);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/patients", async (req, res) => {
    try {
      const validatedData = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(validatedData);
      res.status(201).json(patient);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /* ---------------- SCAN ROUTES ---------------- */

  app.get("/api/scans/:patientCaseId", async (req, res) => {
    try {
      const scans = await storage.getScansByPatient(req.params.patientCaseId);
      res.json(scans);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/upload", upload.single("image"), async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const { patientCaseId, imageType } = req.body;

      let imageUrl: string;
      let metadata: any = null;

      const isDICOM =
        req.file.mimetype === "application/dicom" ||
        req.file.originalname.toLowerCase().endsWith(".dcm");

      if (isDICOM) {

        const dicomData = await parseDICOM(req.file.buffer);

        imageUrl = `data:image/png;base64,${dicomData.imageBuffer.toString("base64")}`;

        metadata = dicomData.metadata;

      } else {

        const base64Image = req.file.buffer.toString("base64");

        imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      }

      const scanData = {
        patientCaseId,
        imageUrl,
        imageType,
        metadata,
      };

      const validatedScanData = insertScanSchema.parse(scanData);

      const scan = await storage.createScan(validatedScanData);

      res.status(201).json({ scan });

    } catch (error) {

      console.error("Upload error:", error);

      res.status(500).json({ error: (error as Error).message });

    }

  });

  /* ------------------------------------------------ */
  /* ANALYSIS ROUTE                                  */
  /* ------------------------------------------------ */

  app.post("/api/analyze/:scanId", async (req, res) => {

    try {

      const scanId = req.params.scanId;

      const scan = await storage.getScan(scanId);

      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }

      const base64Image = scan.imageUrl.includes(",")
        ? scan.imageUrl.split(",")[1]
        : scan.imageUrl;

      const imageBuffer = Buffer.from(base64Image, "base64");

      const startTime = Date.now();

      updateAnalysisProgress(scanId, 10, "Preprocessing image");

      let analysisResults;

      try {

        updateAnalysisProgress(scanId, 30, "Running SCT analysis");

        analysisResults = await analyzeWithSCT(imageBuffer, scan.imageType);

      } catch (sctError) {

        console.warn("SCT failed, fallback to ML model");

        analysisResults = await analyzeWithMedicalModel(
          imageBuffer,
          scan.imageType,
          "ResNet50"
        );

      }

      /* -------- APPLY NORMALIZATION -------- */

      analysisResults = normalizeDiseaseSeverities(analysisResults);

      const duration = Date.now() - startTime;

      if (!analysisResults.mlPredictions) {

        analysisResults.mlPredictions = {
          predictions: [],
          modelUsed: "Combined Model",
          processingTime: duration,
        };

      } else {

        analysisResults.mlPredictions.processingTime = duration;

      }

      const analysisData = {
        scanId: scan.id,
        results: analysisResults,
      };

      const validatedAnalysisData = insertAnalysisSchema.parse(analysisData);

      const analysis = await storage.createAnalysis(validatedAnalysisData);

      updateAnalysisProgress(scanId, 100, "Analysis complete");

      res.status(201).json({ analysis });

    } catch (error) {

      console.error("Analysis error:", error);

      res.status(500).json({ error: (error as Error).message });

    }

  });

  /* ---------------- ANALYSIS FETCH ---------------- */

  app.get("/api/analysis/:scanId", async (req, res) => {

    try {

      const analysis = await storage.getAnalysis(req.params.scanId);

      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      res.json(analysis);

    } catch (error) {

      res.status(500).json({ error: (error as Error).message });

    }

  });

  const httpServer = createServer(app);

  return httpServer;

}