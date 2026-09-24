'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

interface DetectedBarcode {
  rawValue: string;
  format?: string;
}

interface BarcodeDetectorInstance {
  detect(image: HTMLVideoElement | ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
}

export default function CameraBarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title,
  subtitle,
}: CameraBarcodeScannerModalProps) {
  const t = useTranslations('stocktake');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isBarcodeDetectorSupported, setIsBarcodeDetectorSupported] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isCooldown, setIsCooldown] = useState(false);
  const isCooldownRef = useRef(false);
  isCooldownRef.current = isCooldown;
  const scanThrottleRef = useRef<number>(0);

  const animationFrameRef = useRef<number | null>(null);

  // Stop camera stream tracks
  const stopStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize camera stream
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setTorchOn(false);
      setLastScannedCode(null);
      return;
    }

    let isMounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          try {
            await videoRef.current.play();
          } catch {
            // fallback
          }
        }

        // Check if torch/flashlight capability is available
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (
            videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}
          ) as MediaTrackCapabilities & { torch?: boolean };
          setHasTorch(Boolean(capabilities.torch));
        }
      } catch (err) {
        // fallback
        if (isMounted) {
          setHasCameraPermission(false);
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isOpen, facingMode, stopStream]);

  // Barcode Detection Loop
  useEffect(() => {
    if (!isOpen || !hasCameraPermission) return;

    // Check BarcodeDetector support
    const BarcodeDetectorClass = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;

    if (!BarcodeDetectorClass) {
      setIsBarcodeDetectorSupported(false);
      return;
    }

    setIsBarcodeDetectorSupported(true);

    let detector: BarcodeDetectorInstance;
    try {
      detector = new BarcodeDetectorClass({
        formats: [
          'qr_code',
          'code_128',
          'code_39',
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'data_matrix',
          'itf',
        ],
      });
    } catch {
      // fallback
      detector = new BarcodeDetectorClass();
    }

    let isDetecting = true;

    async function detectLoop() {
      if (!isDetecting) return;

      if (
        videoRef.current &&
        videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !isCooldownRef.current
      ) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0 && !isCooldownRef.current) {
            const raw = barcodes[0].rawValue?.trim();
            if (raw) {
              setIsCooldown(true);
              setLastScannedCode(raw);
              onScan(raw);

              // Cooldown timer to prevent accidental double-scans
              setTimeout(() => {
                setIsCooldown(false);
                setLastScannedCode(null);
              }, 1200);
            }
          }
        } catch {
          // harmless - Frame detection error, continue next frame
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectLoop);
    }

    detectLoop();

    return () => {
      isDetecting = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen, hasCameraPermission, onScan]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextTorch = !torchOn;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Torch constraint API
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      } catch {
        // harmless - Torch constraint failed
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/90 flex flex-col items-center justify-between p-4 sm:p-6 text-white backdrop-blur-sm select-none">
      {/* Top Header */}
      <div className="w-full max-w-lg flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-emerald-400">photo_camera</span>
            {title || t('camera.scannerTitle')}
          </h2>
          <p className="text-xs text-neutral-300">
            {subtitle || t('camera.scannerSubtitle')}
          </p>
        </div>
        <Button
          onClick={onClose}
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('camera.close')}
          className="rounded-full bg-white/15 hover:bg-white/25 text-white"
        >
          {t('camera.close')}
        </Button>
      </div>

      {/* Camera Viewfinder Area */}
      <div className="relative w-full max-w-lg flex-1 my-3 flex items-center justify-center overflow-hidden rounded-2xl bg-neutral-950 border border-white/10 shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Reticle Viewfinder Target */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div
            className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 transition-all duration-200 ${
              lastScannedCode
                ? 'border-emerald-400 bg-emerald-500/20 scale-105 shadow-[0_0_30px_rgba(52,211,153,0.5)]'
                : 'border-white/70 shadow-lg'
            }`}
          >
            {/* Animated Laser Scan Line */}
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 -translate-y-1/2" />

            {/* Corner Bracket Accents */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />

            {/* Center Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined text-4xl text-white">add</span>
            </div>
          </div>

          {/* Real-time scan feedback banner */}
          {lastScannedCode ? (
            <div className="mt-4 px-4 py-2 rounded-full bg-emerald-500 text-neutral-950 font-bold text-sm flex items-center gap-2 shadow-lg animate-bounce">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>{lastScannedCode}</span>
            </div>
          ) : (
            <p className="mt-4 text-xs font-medium text-white/80 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-xs">
              {t('camera.pointCameraHint')}
            </p>
          )}
        </div>

        {/* Fallback alerts if camera/detector is unavailable */}
        {hasCameraPermission === false && (
          <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-amber-400 mb-3">no_photography</span>
            <h3 className="text-base font-bold text-white mb-1">
              {t('camera.permissionDeniedTitle')}
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs mb-4">
              {t('camera.permissionDeniedDesc')}
            </p>
            <Button variant="secondary" onClick={onClose}>
              {t('camera.close')}
            </Button>
          </div>
        )}

        {!isBarcodeDetectorSupported && hasCameraPermission && (
          <div className="absolute bottom-3 left-3 right-3 bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 text-amber-200 text-xs text-center backdrop-blur-md">
            {t('camera.detectorUnsupportedNotice')}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-lg flex items-center justify-around py-2 z-10 gap-2">
        {hasTorch && (
          <Button
            type="button"
            onClick={toggleTorch}
            variant={torchOn ? 'primary' : 'ghost'}
            className="flex-1 py-2.5 px-3 rounded-xl text-white hover:text-white font-semibold text-xs"
          >
            {torchOn ? t('camera.torchOn') : t('camera.torchOff')}
          </Button>
        )}

        <Button
          type="button"
          onClick={toggleCamera}
          variant="ghost"
          className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white font-semibold text-xs"
        >
          {t('camera.flipCamera')}
        </Button>

        <Button
          type="button"
          onClick={onClose}
          variant="ghost"
          className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white font-semibold text-xs"
        >
          {t('camera.manualInput')}
        </Button>
      </div>
    </div>
  );
}
