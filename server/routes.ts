function normalizeDiseasePredictions(results: any) {
  logMem("normalizeDiseasePredictions start");

  if (!results || typeof results !== "object") {
    return {
      mlPredictions: {
        predictions: [
          {
            disease: "Normal",
            confidence: 80,
            severity: "normal",
            status: "low",
            recommendation: "No major abnormality suggested.",
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
      p?.diseaseName ||
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

  const cleaned = rawPredictions
    .map((p: any) => ({
      ...p,
      disease: String(getDiseaseName(p)).trim(),
      confidence: normalizeConfidence(
        p?.confidence ?? p?.score ?? p?.probability ?? 0
      ),
    }))
    .filter((p: any) => p.disease && p.disease !== "Unknown");

  const dedupedMap = new Map<string, any>();

  for (const pred of cleaned) {
    const key = pred.disease.toLowerCase();
    const existing = dedupedMap.get(key);

    if (!existing || pred.confidence > existing.confidence) {
      dedupedMap.set(key, pred);
    }
  }

  let deduped = Array.from(dedupedMap.values()).sort(
    (a: any, b: any) => b.confidence - a.confidence
  );

  if (deduped.length === 0) {
    results.mlPredictions.predictions = [
      {
        disease: "Normal",
        confidence: 80,
        severity: "normal",
        status: "low",
        recommendation: "No major abnormality suggested.",
      },
    ];
    logMem("normalizeDiseasePredictions end (fallback)");
    return results;
  }

  const topPrediction = deduped[0];
  const topDisease = String(topPrediction.disease).toLowerCase();

  if (topDisease === "normal" && topPrediction.confidence >= 0.7) {
    results.mlPredictions.predictions = [
      {
        ...topPrediction,
        confidence: Number((topPrediction.confidence * 100).toFixed(2)),
        severity: "normal",
        status: "low",
        recommendation: "No major abnormality suggested.",
      },
    ];
    logMem("normalizeDiseasePredictions end (normal top)");
    return results;
  }

  deduped = deduped
    .filter((p: any) => String(p.disease).toLowerCase() !== "normal")
    .slice(0, 4);

  const finalPredictions = deduped.map((p: any, index: number) => {
    let severity = "normal";
    let status = "low";

    if (index === 0) {
      if (p.confidence >= 0.8) {
        severity = "severe";
        status = "high";
      } else if (p.confidence >= 0.6) {
        severity = "moderate";
        status = "medium";
      } else if (p.confidence >= 0.4) {
        severity = "mild";
        status = "low";
      }
    } else if (index === 1) {
      if (p.confidence >= 0.75) {
        severity = "moderate";
        status = "medium";
      } else if (p.confidence >= 0.45) {
        severity = "mild";
        status = "low";
      }
    } else {
      if (p.confidence >= 0.55) {
        severity = "mild";
        status = "low";
      }
    }

    return {
      ...p,
      confidence: Number((p.confidence * 100).toFixed(2)),
      severity,
      status,
      recommendation:
        severity === "severe"
          ? "Urgent specialist review recommended."
          : severity === "moderate"
          ? "Clinical correlation and specialist consultation recommended."
          : severity === "mild"
          ? "Mild finding. Monitor and correlate with symptoms."
          : "Low likelihood finding.",
    };
  });

  if (finalPredictions.length === 0) {
    results.mlPredictions.predictions = [
      {
        disease: "Normal",
        confidence: 80,
        severity: "normal",
        status: "low",
        recommendation: "No major abnormality suggested.",
      },
    ];
    logMem("normalizeDiseasePredictions end (empty final)");
    return results;
  }

  results.mlPredictions.predictions = finalPredictions;
  logMem("normalizeDiseasePredictions end");
  return results;
}