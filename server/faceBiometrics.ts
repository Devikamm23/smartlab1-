export interface BiometricMatchResult {
  matched: boolean;
  similarity: number;
  euclideanDistance: number;
  confidencePercent: number;
  threshold: number;
  reason?: string;
}

/**
 * Compares two 128-dimensional face embedding vectors
 * Computes cosine similarity and Euclidean distance
 */
export function compareFaceEmbeddings(
  liveVector: number[],
  registeredVector: number[],
  distanceThreshold = 0.38
): BiometricMatchResult {
  if (!Array.isArray(liveVector) || !Array.isArray(registeredVector)) {
    return {
      matched: false,
      similarity: 0,
      euclideanDistance: 999,
      confidencePercent: 0,
      threshold: distanceThreshold,
      reason: 'Invalid face template data format'
    };
  }

  if (liveVector.length !== 128 || registeredVector.length !== 128) {
    return {
      matched: false,
      similarity: 0,
      euclideanDistance: 999,
      confidencePercent: 0,
      threshold: distanceThreshold,
      reason: `Template dimension mismatch: expected 128, got live=${liveVector.length}, enrolled=${registeredVector.length}`
    };
  }

  let dotProduct = 0;
  let normLive = 0;
  let normReg = 0;
  let sumSqDiff = 0;

  for (let i = 0; i < 128; i++) {
    const l = liveVector[i];
    const r = registeredVector[i];

    dotProduct += l * r;
    normLive += l * l;
    normReg += r * r;
    sumSqDiff += (l - r) * (l - r);
  }

  const denom = Math.sqrt(normLive) * Math.sqrt(normReg);
  const similarity = denom === 0 ? 0 : Math.max(-1, Math.min(1, dotProduct / denom));
  const euclideanDistance = Math.sqrt(sumSqDiff);

  // Confidence mapping based on distance
  const confidencePercent = Math.max(0, Math.min(100, Math.round((1 - euclideanDistance / 0.8) * 100)));
  const matched = euclideanDistance <= distanceThreshold;

  return {
    matched,
    similarity: Number(similarity.toFixed(4)),
    euclideanDistance: Number(euclideanDistance.toFixed(4)),
    confidencePercent,
    threshold: distanceThreshold,
    reason: matched ? undefined : 'Face does not match registered profile. Please try again.'
  };
}
