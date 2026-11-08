import React, { useEffect, useRef, useState } from 'react';
import { 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Sun, 
  Focus, 
  UserCheck, 
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { 
  startCameraStream, 
  stopCameraStream, 
  analyzeAndExtractFaceBiometrics, 
  FaceQualityAnalysis 
} from '../../utils/faceBiometrics.ts';

interface FaceCaptureModalProps {
  mode: 'register' | 'login' | 'reenroll';
  usn: string;
  studentName?: string;
  onConfirm: (faceVector: number[], qualityScore: number, photoDataUrl: string) => void;
  onBypassDemo?: () => void;
  onCancel: () => void;
}

export const FaceCaptureModal: React.FC<FaceCaptureModalProps> = ({
  mode,
  usn,
  studentName,
  onConfirm,
  onBypassDemo,
  onCancel
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FaceQualityAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Initialize camera
  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      setCameraError(null);
      try {
        if (!videoRef.current) return;
        const stream = await startCameraStream(videoRef.current);
        if (isMounted) {
          streamRef.current = stream;
          setCameraActive(true);
        } else {
          stopCameraStream(stream);
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraError(err.message || 'Unable to access camera. Please check browser permissions.');
          setCameraActive(false);
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !cameraActive) return;
    setIsProcessing(true);

    try {
      const { dataUrl, analysis: qualAnalysis } = analyzeAndExtractFaceBiometrics(videoRef.current);
      setCapturedPhoto(dataUrl);
      setAnalysis(qualAnalysis);
    } catch (err: any) {
      setCameraError(err.message || 'Capture processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setAnalysis(null);
    setCameraError(null);
  };

  const handleConfirmFace = () => {
    if (!analysis || !analysis.embeddingVector || !capturedPhoto) return;
    if (!analysis.isValid) return;

    onConfirm(
      analysis.embeddingVector,
      Math.round((analysis.lightingScore + analysis.sharpnessScore) / 2),
      capturedPhoto
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {mode === 'register' ? 'Biometric Face Enrollment' : mode === 'reenroll' ? 'Biometric Face Re-Enrollment' : 'Live Face Authentication'}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {usn}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'register' 
                  ? 'Capture a clear live portrait to generate your permanent 128-D facial template.' 
                  : 'Verify your face against the registered biometric profile to enter the Student Dashboard.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Camera / Photo Preview Container */}
          <div className="relative aspect-4/3 w-full max-w-md mx-auto rounded-xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex items-center justify-center">
            
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] ${capturedPhoto ? 'hidden' : 'block'}`}
            />

            {/* Captured Still Preview */}
            {capturedPhoto && (
              <img
                src={capturedPhoto}
                alt="Captured Face"
                className="w-full h-full object-cover"
              />
            )}

            {/* Face Alignment Overlay (Shown during live camera) */}
            {!capturedPhoto && cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-72 border-2 border-dashed border-blue-400/70 rounded-[48%] relative flex flex-col items-center justify-between py-6">
                  <div className="w-12 h-1 bg-blue-400/50 rounded-full" />
                  <span className="text-[11px] font-medium text-blue-200 bg-slate-950/70 px-2 py-0.5 rounded-full backdrop-blur-xs">
                    Align Face Here
                  </span>
                  <div className="w-16 h-1 bg-blue-400/50 rounded-full" />
                </div>
              </div>
            )}

            {/* Camera Error / No Permission Display */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <ShieldAlert className="w-12 h-12 text-rose-400" />
                <div>
                  <h4 className="text-sm font-bold text-rose-300">Camera Access Issue</h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">{cameraError}</p>
                </div>
                <div className="text-[11px] text-slate-400 bg-slate-900 border border-slate-800 p-2.5 rounded-lg max-w-sm text-left">
                  <strong>How to enable:</strong> Click the camera/lock icon in your browser address bar and grant camera permissions for SmartLab.
                </div>
                {onBypassDemo && (
                  <button
                    onClick={onBypassDemo}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-xs font-semibold cursor-pointer transition"
                  >
                    Use Registered Demo Template (Bypass for Test)
                  </button>
                )}
              </div>
            )}

            {/* Live Indicator */}
            {!capturedPhoto && cameraActive && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE CAMERA
              </div>
            )}

            {/* Captured Tag */}
            {capturedPhoto && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-blue-500/40 text-blue-400 text-[10px] font-mono">
                PHOTO CAPTURED
              </div>
            )}
          </div>

          {/* Real-time Quality & Biometric Extraction Feedback */}
          {analysis && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Biometric Model Inspection
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  analysis.isValid 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {analysis.isValid ? 'Biometrics Valid' : 'Requires Adjustment'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px] mb-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    Lighting
                  </div>
                  <span className="font-bold text-slate-200">{analysis.lightingScore}%</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px] mb-1">
                    <Focus className="w-3 h-3 text-cyan-400" />
                    Sharpness
                  </div>
                  <span className="font-bold text-slate-200">{analysis.sharpnessScore}%</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px] mb-1">
                    <UserCheck className="w-3 h-3 text-emerald-400" />
                    Geometry
                  </div>
                  <span className="font-bold text-emerald-300">128-D Vector</span>
                </div>
              </div>

              {/* Issues / Instructions */}
              {analysis.issues.length > 0 ? (
                <div className="space-y-1">
                  {analysis.issues.map((msg, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Face normalized and 128-dimensional biometric embedding computed successfully.</span>
                </div>
              )}
            </div>
          )}

          {/* Biometric Privacy & Informed Consent Note */}
          <div className="flex items-start gap-2 p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Biometric Privacy Notice:</strong> SmartLab extracts numerical geometric feature embeddings (128-D mathematical vectors) directly in memory. Raw photograph streams are not permanently stored on the college servers without student consent.
            </span>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          
          {/* Optional Demo Match Bypass for evaluators without webcam */}
          {onBypassDemo ? (
            <button
              onClick={onBypassDemo}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
            >
              Demo Match (Camera Bypass)
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            {!capturedPhoto ? (
              <button
                type="button"
                onClick={handleCapture}
                disabled={!cameraActive || isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{mode === 'register' ? 'Capture Face' : 'Capture Photo'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake Photo</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFace}
                  disabled={!analysis?.isValid}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{mode === 'register' || mode === 'reenroll' ? 'Confirm Face' : 'Verify Face'}</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
