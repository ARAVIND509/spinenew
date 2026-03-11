import { analyzeMedicalImageWithML } from './ml-model';
import fs from 'fs';
import path from 'path';

async function testFeatureExtraction() {
    const testImage = path.join(process.cwd(), '../test-data/sample-spine.png');

    if (!fs.existsSync(testImage)) {
        console.log("Test image not found");
        return;
    }

    const buffer = fs.readFileSync(testImage);

    // Run analysis 3 times on same image to verify determinism
    console.log("=== Testing Same Image 3x ===");
    for (let i = 0; i < 3; i++) {
        const result = await analyzeMedicalImageWithML(buffer, 'ResNet50');
        console.log(`\nRun ${i + 1}:`);
        result.predictions.forEach(p => {
            console.log(`  ${p.condition}: ${p.confidence}% (${p.severity})`);
        });
    }
}

testFeatureExtraction().catch(console.error);
