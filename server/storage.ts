import { prisma } from "./db";

export const storage = {
  async getUser(id: string | number) {
    return await prisma.user.findUnique({
      where: { id: String(id) },
    });
  },

  async getUserByUsername(username: string) {
    return await prisma.user.findUnique({
      where: { username },
    });
  },

  async createUser(data: { username: string; password: string }) {
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
    return await prisma.patient.findFirst({
      where: { patientId },
    });
  },

  async createPatient(data: {
    patientId: string;
    fullName?: string;
    age?: number | null;
  }) {
    const computedName = data.fullName?.trim() || "Unknown Patient";

    return await prisma.patient.create({
      data: {
        patientId: data.patientId,
        name: computedName,
        age: data.age ?? null,
      },
    });
  },

  async getRecentScans(limit: number = 20) {
    return await prisma.scan.findMany({
      orderBy: { uploadedAt: "desc" },
      take: limit,
      include: {
        patient: true,
        analyses: true,
      },
    });
  },

  async getScanById(id: string) {
    return await prisma.scan.findUnique({
      where: { id },
      include: {
        patient: true,
        analyses: true,
      },
    });
  },

  async createScan(data: {
    patientCaseId: string;
    imageUrl: string;
    imageType: string;
    metadata?: any;
  }) {
    return await prisma.scan.create({
      data: {
        patientCaseId: data.patientCaseId,
        imageUrl: data.imageUrl,
        imageType: data.imageType,
        metadata: data.metadata ?? null,
      },
    });
  },

  async createAnalysis(data: {
    scanId: string;
    results: any;
  }) {
    return await prisma.analysis.create({
      data: {
        scanId: data.scanId,
        results: data.results,
      },
    });
  },

  async deleteScan(id: string) {
    await prisma.analysis.deleteMany({
      where: { scanId: id },
    });

    return await prisma.scan.delete({
      where: { id },
    });
  },

  async deletePatient(patientId: string) {
    const patient = await prisma.patient.findFirst({
      where: { patientId },
      include: { scans: true },
    });

    if (!patient) return null;

    const scanIds = patient.scans.map((scan) => scan.id);

    if (scanIds.length > 0) {
      await prisma.analysis.deleteMany({
        where: {
          scanId: { in: scanIds },
        },
      });

      await prisma.scan.deleteMany({
        where: {
          patientCaseId: patient.id,
        },
      });
    }

    return await prisma.patient.delete({
      where: { id: patient.id },
    });
  },
};