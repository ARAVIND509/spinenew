import { prisma } from "./db";

export const storage = {
  async getUser(id: string | number) {
    const numericId =
      typeof id === "string" ? parseInt(id, 10) : id;

    if (!Number.isFinite(numericId)) {
      return null;
    }

    return await prisma.user.findUnique({
      where: { id: numericId },
    });
  },

  async getUserByUsername(username: string) {
    return await prisma.user.findUnique({
      where: { username },
    });
  },

  async createUser(data: {
    username: string;
    password: string;
  }) {
    return await prisma.user.create({
      data: {
        username: data.username,
        password: data.password,
      },
    });
  },

  async getPatients(limit: number = 50) {
    return await prisma.patient.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async getPatientByPatientId(patientId: string) {
    return await prisma.patient.findUnique({
      where: { patientId },
    });
  },

  async getRecentScans(limit: number = 20) {
    return await prisma.scan.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        patient: true,
      },
    });
  },

  async getScanById(id: string) {
    return await prisma.scan.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  },

  async createPatient(data: {
    patientId: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    age?: number | null;
    gender?: string | null;
    phone?: string | null;
  }) {
    const computedName =
      data.fullName?.trim() ||
      `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() ||
      "Unknown Patient";

    return await prisma.patient.create({
      data: {
        patientId: data.patientId,
        name: computedName,
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        fullName: data.fullName?.trim() || computedName,
        age: data.age ?? null,
        gender: data.gender ?? null,
        phone: data.phone ?? null,
      },
    });
  },

  async createScan(data: {
    patientId: string;
    scanType?: string;
    imageType?: string | null;
    imageUrl?: string | null;
    heatmapUrl?: string | null;
    notes?: string | null;
    reportText?: string | null;
    analysisResults?: string | null;
    status?: string;
  }) {
    return await prisma.scan.create({
      data: {
        patientId: data.patientId,
        scanType: data.scanType ?? "MRI",
        imageType: data.imageType ?? null,
        imageUrl: data.imageUrl ?? null,
        heatmapUrl: data.heatmapUrl ?? null,
        notes: data.notes ?? null,
        reportText: data.reportText ?? null,
        analysisResults: data.analysisResults ?? null,
        status: data.status ?? "completed",
      },
    });
  },

  async deleteScan(id: string) {
    return await prisma.scan.delete({
      where: { id },
    });
  },

  async deletePatient(patientId: string) {
    return await prisma.patient.delete({
      where: { patientId },
    });
  },
};