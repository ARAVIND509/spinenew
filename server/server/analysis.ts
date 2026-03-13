import { SeverityLevel } from "../shared/schema";

function getSeverity(confidence: number): SeverityLevel {

  if (confidence < 60) return "normal";
  if (confidence < 70) return "mild";
  if (confidence < 85) return "moderate";
  return "severe";

}

export function generateRealisticAnalysis() {

  const conditions = [
    "Disc Herniation",
    "Scoliosis",
    "Spinal Stenosis",
    "Degenerative Disc",
    "Vertebral Fracture"
  ];

  const results: any[] = [];

  let severeUsed = false;

  for (const condition of conditions) {

    const confidence = Math.random() * 100;

    let severity = getSeverity(confidence);

    // Allow only ONE severe
    if (severity === "severe") {

      if (severeUsed) {
        severity = "moderate";
      } else {
        severeUsed = true;
      }

    }

    results.push({
      condition,
      confidence: Math.round(confidence),
      severity,
      location: "Lumbar Spine"
    });

  }

  return results;

}