import type {
    PostureSimulationResult,
    SeverityLevel,
    SoftTissueDegenerationResult,
    HiddenAbnormalityResult,
    BloodFlowAnalysisResult,
    DiagnosticFinding
} from "@shared/schema";

/**
 * Generates posture simulation results based on detected conditions.
 * Used by both ML and SCT analysis paths for consistent 3D reconstruction.
 */
export function generatePostureAnalysis(conditions: any[], imageType: string): PostureSimulationResult {
    const scoliosis = conditions.find(c => c.condition === "Scoliosis");
    const severity = scoliosis?.severity || "normal";

    // Extract angles from measurements if available
    const measurements = scoliosis?.measurements || {};
    const cervical = measurements.cervical_angle || (severity === "severe" ? 45 : severity === "moderate" ? 38 : 32);
    const thoracic = measurements.thoracic_angle || (severity === "severe" ? 52 : severity === "moderate" ? 45 : 38);
    const lumbar = measurements.lumbar_angle || (severity === "severe" ? 48 : severity === "moderate" ? 42 : 36);

    return {
        condition: "3D Posture Simulation",
        severity: severity as SeverityLevel,
        confidence: scoliosis?.confidence || 75,
        spinalCurvature: {
            cervical: Number(cervical),
            thoracic: Number(thoracic),
            lumbar: Number(lumbar),
        },
        postureModels: {
            standing: severity === "severe" ? "Significant lateral deviation" : "Normal alignment",
            sitting: severity === "moderate" || severity === "severe" ? "Compensatory tilt observed" : "Balanced posture",
            bending: severity === "severe" ? "Restricted range of motion" : "Normal flexibility",
        },
        functionalLimitations: severity === "severe"
            ? ["Reduced lateral bending", "Difficulty with prolonged standing", "Pain with rotation"]
            : [],
        compensatoryPatterns: severity === "moderate" || severity === "severe"
            ? ["Pelvic tilt compensation", "Shoulder elevation imbalance"]
            : [],
        recommendations: severity === "severe"
            ? ["Specialized bracing evaluation", "Intensive physical therapy", "Surgical consultation"]
            : ["Posture awareness exercises", "Ergonomic adjustments"],
        _disclaimer: "AI-estimated illustrative values — NOT measured from imaging data",
    } as any;
}

export function generateSoftTissueAnalysis(conditions: any[]): SoftTissueDegenerationResult {
    const avgConfidence = conditions.reduce((sum, c) => sum + c.confidence, 0) / (conditions.length || 1);
    const maxSeverity = getMaxSeverity(conditions.map(c => c.severity));

    const ligamentDescriptions: Record<string, string> = {
        severe: "Significant thickening and partial tearing observed",
        moderate: "Moderate hypertrophy with altered signal intensity",
        mild: "Mild thickening and early signal changes",
        normal: "Normal integrity and signal intensity"
    };

    return {
        condition: "Soft Tissue Degeneration",
        severity: maxSeverity,
        confidence: 0, // Reset to 0 — derived estimation only
        ligamentChanges: {
            anterior: ligamentDescriptions[maxSeverity],
            posterior: maxSeverity === "severe" || maxSeverity === "moderate" ? "Moderate hypertrophy noted" : "Normal integrity",
            interspinous: maxSeverity === "severe" ? "Severe degenerative changes" : "Normal integrity",
        },
        tendonDegeneration: {
            level: maxSeverity === "severe" ? "Advanced degeneration" : maxSeverity === "moderate" ? "Moderate degeneration" : "Minimal changes",
            percentage: maxSeverity === "severe" ? 45 : maxSeverity === "moderate" ? 25 : 5,
        },
        discChanges: {
            hydration: maxSeverity === "severe" ? 45 : maxSeverity === "moderate" ? 65 : 85,
            heightLoss: maxSeverity === "severe" ? 5.5 : maxSeverity === "moderate" ? 2.8 : 0.5,
            degenerationGrade: maxSeverity === "severe" ? "Grade V" : maxSeverity === "moderate" ? "Grade III" : "Grade I",
        },
        timelineProgression: maxSeverity === "severe" ? "Rapid progression observed over last 12 months" : "Stable chronic condition",
        recommendations: maxSeverity === "severe"
            ? ["Urgent orthopedic consultation", "Regenerative medicine evaluation", "Intensive physical therapy"]
            : ["Maintain activity levels", "Targeted core strengthening", "Ergonomic assessment"],
        _disclaimer: "AI-estimated illustrative values — NOT measured from imaging data",
    } as any;
}

export function generateHiddenAbnormalityAnalysis(conditions: any[]): HiddenAbnormalityResult {
    const infection = conditions.find(c => c.condition === "Infection");
    const tumor = conditions.find(c => c.condition === "Tumor");
    const maxSeverity = getMaxSeverity([infection?.severity || "normal", tumor?.severity || "normal"]);

    const subtleFindings = [];
    if (maxSeverity !== "normal") {
        subtleFindings.push("Altered signal in bone marrow at L3");
        subtleFindings.push("Minor paravertebral soft tissue swelling");
        if (maxSeverity === "severe") {
            subtleFindings.push("Possible cortical breaching at L4");
        }
    }

    return {
        condition: "Hidden Abnormality Detection",
        severity: maxSeverity,
        confidence: 0, // Reset to 0 — derived estimation only
        infections: {
            detected: (infection?.severity && infection.severity !== "normal") || false,
            type: (infection?.severity && infection.severity !== "normal") ? "Possible pyogenic discitis" : "None detected",
            location: (infection?.severity && infection.severity !== "normal") ? ["L4-L5 intervertebral space"] : [],
            probability: infection?.confidence || 0,
        },
        inflammation: {
            detected: infection?.severity === "moderate" || infection?.severity === "severe",
            severity: infection?.severity || "None",
            affectedAreas: (infection?.severity && infection.severity !== "normal") ? ["L4 superior endplate", "L5 inferior endplate", "Psoas muscle margin"] : [],
        },
        tumorProbability: {
            detected: (tumor?.severity && tumor.severity !== "normal") || false,
            type: (tumor?.severity && tumor.severity !== "normal") ? "Atypical marrow signal - potential metastatic lesion" : "None detected",
            size: tumor?.severity === "severe" ? "3.8 x 2.4 cm" : tumor?.severity === "moderate" ? "1.2 cm" : "N/A",
            location: (tumor?.severity && tumor.severity !== "normal") ? ["L3 vertebral body posterior element"] : [],
            malignancyRisk: tumor?.confidence || 0,
        },
        subtleFindings,
        recommendations: (infection?.severity && infection.severity !== "normal") || (tumor?.severity && tumor.severity !== "normal")
            ? ["Urgent biopsy verification", "Nuclear medicine bone scan", "Enhanced contrast MRI (Gadolinium)"]
            : ["Follow-up routine imaging in 6 months"],
        _disclaimer: "AI-estimated illustrative values — NOT measured from imaging data",
    } as any;
}

export function generateBloodFlowAnalysis(conditions: any[]): BloodFlowAnalysisResult {
    const stenosis = conditions.find(c => c.condition === "Spinal Stenosis");
    const severity = stenosis?.severity || "normal";

    // If all conditions are normal, return a benign result
    const hasAbnormal = conditions.some(c => c.severity !== "normal" && c.confidence >= 35);
    if (!hasAbnormal) {
        return {
            condition: "Blood Flow Analysis",
            severity: "normal" as SeverityLevel,
            confidence: 0,
            spinalCordPerfusion: { level: "Within normal limits", flowRate: 68, adequacy: "optimal" },
            nerveRootOxygenation: [],
            vascularCompromise: { detected: false, location: [], severity: "None" },
            circulationMap: ["Pulsatile flow within normal variance"],
            recommendations: ["No action required"],
            _disclaimer: "AI-estimated illustrative values — NOT measured from imaging data",
        } as any;
    }

    return {
        condition: "Blood Flow Analysis",
        severity: severity as SeverityLevel,
        confidence: 0, // Reset to 0 — perfusion estimated from morphology
        spinalCordPerfusion: {
            level: "L2-L5 anatomical segment",
            flowRate: severity === "severe" ? 28 : severity === "moderate" ? 48 : 68,
            adequacy: severity === "severe" ? "compromised" : severity === "moderate" ? "reduced" : "optimal",
        },
        nerveRootOxygenation: [
            { vertebralLevel: "L3", oxygenation: severity === "severe" ? 72 : 94, status: severity === "severe" ? "ischemic" : "normal" },
            { vertebralLevel: "L4", oxygenation: severity === "severe" ? 64 : 91, status: severity === "severe" ? "critical" : "normal" },
            { vertebralLevel: "L5", oxygenation: severity === "severe" ? 62 : 92, status: severity === "severe" ? "critical" : "normal" },
        ],
        vascularCompromise: {
            detected: severity === "severe" || severity === "moderate",
            location: severity !== "normal" ? ["Anterior spinal artery junction", "Neural exits L4/L5"] : [],
            severity: severity || "None",
        },
        circulationMap: severity === "severe"
            ? ["Significant anterior flow reduction", "Venous plexus congestion identified", "Reduced capillary density"]
            : ["Pulsatile flow within normal variance", "Symmetry maintained"],
        recommendations: severity === "severe"
            ? ["Vascular surgical decompresssion", "Vessel patency assessment (MRA)", "Immediate neuro-vascular monitoring"]
            : ["Regular cardiovascular exercise", "Postural awareness training"],
    };
}

export function generateSummary(conditions: any[], imageType: string): string {
    const abnormalConditions = conditions.filter(c => c.severity !== "normal");

    if (abnormalConditions.length === 0) {
        return `${imageType} scan analysis complete. No significant abnormalities detected. All spinal structures appear within normal limits. Continue routine monitoring and maintain spinal health through appropriate exercise and posture.`;
    }

    // Group findings by severity
    const severeGroup = abnormalConditions.filter(c => c.severity === "severe");
    const moderateGroup = abnormalConditions.filter(c => c.severity === "moderate");
    const mildGroup = abnormalConditions.filter(c => c.severity === "mild");

    const getNames = (group: any[]) => Array.from(new Set(group.map(c => c.condition)));

    const severeNames = getNames(severeGroup);
    const moderateNames = getNames(moderateGroup);
    const mildNames = getNames(mildGroup);

    let summaryParts = [];

    if (severeNames.length > 0) {
        summaryParts.push(`CRITICAL: ${severeNames.length} severe finding(s) detected (${severeNames.join(", ")}). Immediate specialist consultation is required.`);
    }

    if (moderateNames.length > 0) {
        summaryParts.push(`MODERATE: ${moderateNames.length} condition(s) identified (${moderateNames.join(", ")}). Targeted medical intervention and monitoring are recommended.`);
    }

    if (mildNames.length > 0) {
        summaryParts.push(`MILD: ${mildNames.length} minor observation(s) (${mildNames.join(", ")}). Conservative management and routine follow-up suggested.`);
    }

    return `${imageType} scan analysis reveals multiple findings. ${summaryParts.join(" ")}`;
}

export function generateRiskZones(conditions: any[]): string[] {
    const zones: string[] = [];

    conditions.forEach(condition => {
        if (condition.severity === "severe" || condition.severity === "moderate") {
            if (condition.condition.includes("Disc")) zones.push("L4-L5", "L5-S1");
            if (condition.condition.includes("Stenosis")) zones.push("Central canal");
            if (condition.condition.includes("Scoliosis")) zones.push("Thoracolumbar junction");
        }
    });

    return Array.from(new Set(zones)); // Remove duplicates
}

export function getMaxSeverity(severities: string[]): SeverityLevel {
    if (severities.includes("severe")) return "severe";
    if (severities.includes("moderate")) return "moderate";
    if (severities.includes("mild")) return "mild";
    return "normal";
}

export function generateFinding(
    prediction: any,
    conditionName: string
): DiagnosticFinding {
    if (!prediction) {
        return {
            condition: conditionName,
            severity: "normal",
            confidence: 0,
            findings: ["No significant abnormalities detected"],
            recommendations: ["Continue routine monitoring"],
        };
    }

    const findings = generateFindingsList(conditionName, prediction.severity, prediction.confidence);
    const recommendations = generateRecommendationsList(conditionName, prediction.severity);

    return {
        condition: conditionName,
        severity: prediction.severity as SeverityLevel,
        confidence: prediction.confidence,
        findings,
        recommendations,
    };
}

function generateFindingsList(condition: string, severity: string, confidence: number): string[] {
    const findings: Record<string, Record<string, string[]>> = {
        "Disc Herniation": {
            normal: ["No disc herniation detected", "Normal disc spacing maintained"],
            mild: ["Minor disc bulge observed at L4-L5", "No significant nerve compression"],
            moderate: ["Moderate disc protrusion affecting neural foramen", "Possible nerve root contact"],
            severe: ["Severe disc extrusion with significant nerve compression", "Spinal canal narrowing observed"],
        },
        "Scoliosis": {
            normal: ["Spinal alignment within normal range", "No lateral curvature detected"],
            mild: ["Mild lateral curvature (10-20°)", "No rotation observed"],
            moderate: ["Moderate spinal curvature (20-40°)", "Some vertebral rotation present"],
            severe: ["Severe scoliotic curve (>40°)", "Significant vertebral rotation and deformity"],
        },
        "Spinal Stenosis": {
            normal: ["Normal spinal canal diameter", "No stenosis detected"],
            mild: ["Mild canal narrowing at L3-L4", "No clinical symptoms expected"],
            moderate: ["Moderate stenosis affecting multiple levels", "Potential nerve compression"],
            severe: ["Severe central canal stenosis", "Significant neural compression present"],
        },
        "Degenerative Disc Disease": {
            normal: ["Disc hydration within normal limits", "No degenerative changes"],
            mild: ["Early degenerative changes at L5-S1", "Mild disc space narrowing"],
            moderate: ["Moderate disc degeneration with osteophyte formation", "Reduced disc height"],
            severe: ["Advanced degeneration with severe disc space collapse", "Extensive osteophyte formation"],
        },
        "Infection": {
            normal: ["No signs of infection", "Normal bone and soft tissue appearance"],
            mild: ["Subtle inflammatory changes noted", "Early stage infection possible"],
            moderate: ["Moderate infection indicators present", "Soft tissue involvement"],
            severe: ["Severe infection with abscess formation", "Bone destruction evident"],
        },
        "Tumor": {
            normal: ["No mass lesions identified", "Normal bone architecture"],
            mild: ["Small benign-appearing lesion", "Low malignancy probability"],
            moderate: ["Moderate-sized lesion requiring further investigation", "Possible malignancy"],
            severe: ["Large aggressive lesion with bone destruction", "High malignancy risk"],
        },
    };

    return findings[condition]?.[severity] || ["Analysis completed"];
}

function generateRecommendationsList(condition: string, severity: string): string[] {
    const recommendations: Record<string, Record<string, string[]>> = {
        "Disc Herniation": {
            normal: ["Maintain healthy lifestyle", "Regular follow-up in 12 months"],
            mild: ["Physical therapy recommended", "Avoid heavy lifting", "Follow-up in 6 months"],
            moderate: ["Consider epidural injection", "Intensive physical therapy", "MRI follow-up in 3 months"],
            severe: ["Urgent surgical consultation recommended", "Pain management specialist referral", "Immediate follow-up"],
        },
        "Scoliosis": {
            normal: ["Regular posture exercises", "Annual check-up"],
            mild: ["Observation and monitoring", "Core strengthening exercises", "6-month follow-up"],
            moderate: ["Bracing may be considered", "Specialized physical therapy", "3-month monitoring"],
            severe: ["Surgical evaluation urgently needed", "Specialist referral", "Comprehensive treatment plan"],
        },
        "Spinal Stenosis": {
            normal: ["Maintain spinal health", "Regular exercise"],
            mild: ["Physical therapy for flexibility", "NSAIDs as needed", "6-month follow-up"],
            moderate: ["Epidural steroid injection consideration", "Decompression surgery evaluation", "3-month review"],
            severe: ["Urgent surgical decompression recommended", "Pain specialist consultation", "Immediate intervention"],
        },
        "Degenerative Disc Disease": {
            normal: ["Preventive care measures", "Regular exercise"],
            mild: ["Low-impact exercises", "Core strengthening", "Annual monitoring"],
            moderate: ["Consider regenerative treatments", "Physical therapy protocol", "6-month imaging"],
            severe: ["Fusion surgery evaluation", "Comprehensive pain management", "Urgent specialist referral"],
        },
        "Infection": {
            normal: ["Standard hygiene practices", "Routine monitoring"],
            mild: ["Antibiotic therapy consideration", "Close monitoring", "Blood work recommended"],
            moderate: ["IV antibiotic therapy", "Infectious disease consultation", "Weekly follow-up"],
            severe: ["Urgent surgical debridement needed", "Prolonged antibiotic therapy", "ICU-level care may be required"],
        },
        "Tumor": {
            normal: ["Routine screening", "Healthy lifestyle"],
            mild: ["Biopsy consideration", "Oncology consultation", "3-month imaging follow-up"],
            moderate: ["Urgent biopsy required", "Multidisciplinary team review", "Treatment planning"],
            severe: ["Emergency oncology referral", "Staging workup immediately", "Chemotherapy/radiation planning"],
        },
    };

    return recommendations[condition]?.[severity] || ["Consult with healthcare provider"];
}
