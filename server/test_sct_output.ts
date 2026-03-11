import { analyzeWithSCT } from './sct-bridge';
import fs from 'fs';
import path from 'path';

async function testRealAnalysis() {
    const testImage = path.join(process.cwd(), 'test-data/sample-spine.png');

    if (!fs.existsSync(testImage)) {
        console.log("Test image not found");
        return;
    }

    const buffer = fs.readFileSync(testImage);

    console.log("=== Testing SCT Analysis (Python Path) ===");
    try {
        const result = await analyzeWithSCT(buffer, 'MRI');

        console.log("\nmlPredictions:", result.mlPredictions);
        console.log("\nPrimary Finding:", result.primaryFinding);
        console.log("\nConditions:");
        result.mlPredictions?.predictions.forEach(p => {
            console.log(`  ${p.condition}: ${p.confidence}% (${p.severity})`);
        });
    } catch (error) {
        console.error("SCT Analysis failed:", error);
    }
}

testRealAnalysis().catch(console.error);
