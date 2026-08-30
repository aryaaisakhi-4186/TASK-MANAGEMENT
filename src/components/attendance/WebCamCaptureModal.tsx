import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, ShieldAlert, Smartphone, SwitchCamera, Upload } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export const WebCamCaptureModal: React.FC<Props> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    setIsMobileDevice(isMobile);
  }, []);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, capturedImage, facingMode]);

  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();
    setCameraError(false);

    try {
      let mediaStream: MediaStream | null = null;

      // Tier 1: Try preferred facing mode with ideal resolution (Mobile & Laptop)
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        // Tier 2: Try basic facing mode
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false
          });
        } catch (err2) {
          // Tier 3: Universal Laptop Webcam / External USB Camera (ignores facingMode constraint)
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(e => console.warn('Video play catch:', e));
        }
      }
    } catch (err) {
      console.warn('WebCam stream not accessible directly, fallback to mobile file capture available', err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  // Ultra-shrunk photo compression (Zero local memory footprint, fast Google Drive cloud sync)
  const watermarkAndSave = (sourceImg: CanvasImageSource, _w: number, _h: number) => {
    const targetWidth = 360;
    const targetHeight = 270;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw compressed thumbnail
    ctx.drawImage(sourceImg, 0, 0, targetWidth, targetHeight);

    // Compact watermark overlay bar
    const barHeight = 26;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, targetHeight - barHeight, targetWidth, barHeight);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('TASK-VAANI VERIFIED', 8, targetHeight - 10);

    ctx.fillStyle = '#FFFFFF';
    const dateText = new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    ctx.font = 'bold 9px monospace';
    ctx.fillText(dateText, targetWidth - (dateText.length * 6) - 10, targetHeight - 10);

    // Export ultra-shrunk JPEG (quality: 0.55 -> ~12KB - 18KB file size)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleTakeSelfie = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      watermarkAndSave(video, w, h);
    } else if (cameraError) {
      // Trigger mobile camera file input
      if (mobileInputRef.current) {
        mobileInputRef.current.click();
      }
    }
  };

  const handleMobileFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        watermarkAndSave(img, img.width, img.height);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      setCapturedImage(null);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} title="Close" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
          <X size={18} />
        </button>

        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-serif flex items-center justify-center gap-2">
            <Camera className="text-emerald-500" /> Biometric & Mobile Attendance
          </h3>
          <p className="text-xs text-slate-500">
            Works with Laptop Webcam, Mobile Front/Selfie & Back Camera
          </p>
        </div>

        {/* Camera Viewport */}
        <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden border border-slate-800 mb-4 flex items-center justify-center">
          {!capturedImage ? (
            cameraError ? (
              <div className="text-center p-4 text-slate-400">
                <Smartphone size={36} className="mx-auto mb-2 text-emerald-500 animate-bounce" />
                <p className="text-xs font-bold text-white">Mobile Camera Ready</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Tap below to open your phone's native camera and take a selfie punch-in.
                </p>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className={'w-full h-full object-cover ' + (facingMode === 'user' ? 'scale-x-[-1]' : '')} />
                
                {/* Switch Camera Button (Front vs Back) */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Switch Front / Back Camera"
                  className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs flex items-center gap-1.5 backdrop-blur-sm border border-slate-700 shadow-md"
                >
                  <SwitchCamera size={15} />
                  <span className="text-[10px] font-bold">{facingMode === 'user' ? 'Selfie / Front' : 'Rear / Back'}</span>
                </button>
              </>
            )
          ) : (
            <img src={capturedImage} alt="Captured Attendance Selfie" className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Hidden Mobile Native Camera Inputs */}
        <input
          type="file"
          accept="image/*"
          capture={facingMode === 'user' ? 'user' : 'environment'}
          ref={mobileInputRef}
          onChange={handleMobileFileCapture}
          className="hidden"
        />

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          {!capturedImage ? (
            <>
              {/* Primary Live Stream Capture */}
              {!cameraError ? (
                <button
                  type="button"
                  onClick={handleTakeSelfie}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Camera size={16} /> Capture Verified Selfie
                </button>
              ) : null}

              {/* Native Mobile Camera Button (Always Available for Phone Users) */}
              <button
                type="button"
                onClick={() => mobileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Smartphone size={16} /> Open Phone Camera
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700"
              >
                <RefreshCw size={14} /> Retake Photo
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Check size={16} /> Confirm & Punch-In
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
