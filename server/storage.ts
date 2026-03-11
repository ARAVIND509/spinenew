import {
  type Patient, type InsertPatient,
  type Scan, type InsertScan,
  type Analysis, type InsertAnalysis,
  type User, type InsertUser
} from "@shared/schema";
import { prisma } from "./db";
import session from "express-session";
import MemoryStoreFactory from "memorystore";

const MemoryStore = MemoryStoreFactory(session);

export interface IStorage {
  // Patient operations
  getPatient(id: string): Promise<Patient | undefined>;
  getAllPatients(): Promise<Patient[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;

  // Scan operations
  getScan(id: string): Promise<Scan | undefined>;
  getScansByPatient(patientCaseId: string): Promise<Scan[]>;
  getRecentScans(limit?: number): Promise<Scan[]>;
  createScan(scan: InsertScan): Promise<Scan>;

  // Analysis operations
  getAnalysis(scanId: string): Promise<Analysis | undefined>;
  getAllAnalyses(): Promise<Analysis[]>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;

  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  // Patient operations
  async getPatient(id: string): Promise<Patient | undefined> {
    const patient = await prisma.patient.findUnique({
      where: { id }
    });
    return patient || undefined;
  }

  async getAllPatients(): Promise<Patient[]> {
    return await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    return await prisma.patient.create({
      data: insertPatient
    });
  }

  // Scan operations
  async getScan(id: string): Promise<Scan | undefined> {
    const scan = await prisma.scan.findUnique({
      where: { id }
    });
    return scan || undefined;
  }

  async getScansByPatient(patientCaseId: string): Promise<Scan[]> {
    return await prisma.scan.findMany({
      where: { patientCaseId },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  async getRecentScans(limit: number = 10): Promise<Scan[]> {
    return await prisma.scan.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: limit
    });
  }

  async createScan(insertScan: InsertScan): Promise<Scan> {
    // metadata is Json type in Prisma, insertScan.metadata is any/null
    return await prisma.scan.create({
      data: {
        patientCaseId: insertScan.patientCaseId,
        imageUrl: insertScan.imageUrl,
        imageType: insertScan.imageType,
        metadata: insertScan.metadata ?? undefined
      }
    });
  }

  // Analysis operations
  async getAnalysis(scanId: string): Promise<Analysis | undefined> {
    const analysis = await prisma.analysis.findFirst({
      where: { scanId }
    });
    return analysis || undefined;
  }

  async getAllAnalyses(): Promise<Analysis[]> {
    return await prisma.analysis.findMany({
      orderBy: { analyzedAt: 'desc' }
    });
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    // results is Json type in Prisma
    return await prisma.analysis.create({
      data: {
        scanId: insertAnalysis.scanId,
        results: insertAnalysis.results as any
      }
    });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const user = await (prisma as any).user.findUnique({
      where: { id }
    });
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await (prisma as any).user.findUnique({
      where: { username }
    });
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await (prisma as any).user.create({
      data: insertUser
    });
  }

  sessionStore: session.Store = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
}

export const storage = new DatabaseStorage();
