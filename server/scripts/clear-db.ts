
import { prisma } from '../db';

async function clearDatabase() {
    console.log('🚀 Starting SpineGuard AI Database Cleanup...');

    try {
        // 1. Delete all Analyses (must happen first due to foreign keys)
        console.log('🗑️  Deleting all analysis records...');
        const analysisDelete = await prisma.analysis.deleteMany({});
        console.log(`✅ Deleted ${analysisDelete.count} analysis records.`);

        // 2. Delete all Scans
        console.log('🗑️  Deleting all clinical scan records...');
        const scanDelete = await prisma.scan.deleteMany({});
        console.log(`✅ Deleted ${scanDelete.count} scan records.`);

        // 3. Delete all Patients
        console.log('🗑️  Deleting all patient profiles...');
        const patientDelete = await prisma.patient.deleteMany({});
        console.log(`✅ Deleted ${patientDelete.count} patient records.`);

        console.log('\n✨ Database reset successfully. System ready for new clinical data.');
    } catch (error) {
        console.error('❌ Error during database cleanup:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Execute the cleanup
clearDatabase();
