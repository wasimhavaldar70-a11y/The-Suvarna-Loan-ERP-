'use client';

// ========================================================
// SuvarnaLoan ERP - Camera & WebP Document Upload Component
// Supports English & Bank-Grade Marathi Localization
// Location: src/components/ui/DocumentCameraUpload.tsx
// ========================================================

import React, { useState, useRef, useEffect } from 'react';
import { Eye, Camera, Upload, Trash2, CheckCircle2, X, RefreshCw, Zap } from 'lucide-react';
import { compressImageToWebP, CompressedImageResult } from '../../lib/imageCompressor';
import { toast } from 'sonner';
import { useTranslation } from '../../providers/LanguageProvider';

interface DocumentCameraUploadProps {
  label: string;
  required?: boolean;
  value?: string; // WebP Data URL
  onChange: (dataUrl: string) => void;
  aspectRatio?: 'square' | 'card';
}

export function DocumentCameraUpload({
  label,
  required = false,
  value,
  onChange,
  aspectRatio = 'card',
}: DocumentCameraUploadProps) {
  const { dict, language, isMarathi } = useTranslation();

  const [compressing, setCompressing] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [sizeBadge, setSizeBadge] = useState<string>('');
  const [reductionBadge, setReductionBadge] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Stop camera stream when modal closes
  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const openCameraModal = async () => {
    setCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error(isMarathi ? 'कॅमेरा सुरू करता आला नाही. कृपया परवानगी तपासा किंवा फाइल अपलोड करा.' : 'Unable to access device camera. Please check permissions or upload a file.');
      setCameraModalOpen(false);
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCameraStream();
    setCameraModalOpen(false);

    // Compress client side
    await processAndSetImage(snapshotDataUrl);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    await processAndSetImage(files[0]);
  };

  const processAndSetImage = async (input: File | string) => {
    if (typeof input !== 'string' && input instanceof File) {
      if (!input.type.startsWith('image/')) {
        toast.error(isMarathi ? 'केवळ इमेज (छायाचित्र) फाइल्स स्वीकारल्या जातात.' : 'Only image files are allowed');
        return;
      }
    }

    setCompressing(true);
    try {
      const res = await compressImageToWebP(input, 900, 0.35);
      onChange(res.dataUrl);
      setSizeBadge(res.formattedSize);
      setReductionBadge(res.reductionPercentage);
      toast.success(isMarathi ? `फोटो ${res.reductionPercentage}% कॉम्प्रेस होऊन WebP मध्ये जतन झाला!` : `Image auto-compressed by ${res.reductionPercentage}% to WebP!`);
    } catch (err) {
      console.error('Compression error:', err);
      toast.error(isMarathi ? 'इमेज कॉम्प्रेस करण्यात त्रुटी' : 'Failed to compress image');
    } finally {
      setCompressing(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    setSizeBadge('');
    setReductionBadge(null);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  return (
    <div className="space-y-1.5 font-sans">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {sizeBadge && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-600" />
            <span>WebP {sizeBadge} ({reductionBadge}% {isMarathi ? 'लहान' : 'smaller'})</span>
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {compressing ? (
        <div className="h-32 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50/40 flex flex-col items-center justify-center p-4">
          <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mb-2" />
          <span className="text-xs font-bold text-amber-900">
            {isMarathi ? 'स्वयंचलित ९०% WebP कॉम्प्रेशन सुरू आहे...' : 'Auto-compressing 90% WebP...'}
          </span>
        </div>
      ) : value ? (
        /* Image Preview Box */
        <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-900 shadow-2xs">
          <img
            src={value}
            alt={label}
            className={`w-full object-cover ${aspectRatio === 'square' ? 'h-36' : 'h-40'}`}
          />
          <div className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="px-2 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs"
              title="View Full Resolution Image"
            >
              <Eye className="w-3.5 h-3.5" /> {dict.common.view}
            </button>
            <button
              type="button"
              onClick={openCameraModal}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-700"
            >
              <Camera className="w-3.5 h-3.5" /> {isMarathi ? 'पुन्हा फोटो घ्या' : 'Retake'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-100"
            >
              <Upload className="w-3.5 h-3.5" /> {dict.customer.uploadImage}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
              title="Remove File"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="px-2 py-0.5 bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-white text-[10px] font-extrabold rounded-md backdrop-blur-xs flex items-center gap-1 border border-white/20 transition-colors"
              title="View Image"
            >
              <Eye className="w-3 h-3 text-amber-400" />
              <span>{dict.common.view}</span>
            </button>
          </div>

          <div className="absolute bottom-1.5 left-1.5 bg-slate-950/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>{isMarathi ? 'तयार' : 'Ready'}</span>
          </div>
        </div>
      ) : (
        /* Upload & Camera Trigger Controls */
        <div className="border-2 border-dashed border-slate-200 hover:border-amber-400/80 rounded-xl bg-slate-50/50 p-4 transition-colors">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={openCameraModal}
              className="w-full sm:flex-1 min-h-[44px] py-2.5 px-3 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <Camera className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{dict.customer.takePhotoCamera}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:flex-1 min-h-[44px] py-2.5 px-3 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <Upload className="w-4 h-4 text-slate-600 shrink-0" />
              <span>{dict.customer.uploadImage}</span>
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
            {dict.customer.autoConvertHelper}
          </p>
        </div>
      )}

      {/* Live Camera Webcam Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <Camera className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {isMarathi ? `फोटो घ्या: ${label}` : `Capture ${label}`}
                </h3>
              </div>
              <button
                onClick={() => {
                  stopCameraStream();
                  setCameraModalOpen(false);
                }}
                className="text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setCameraModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white min-h-[44px]"
              >
                {dict.common.cancel}
              </button>

              <button
                type="button"
                onClick={handleCaptureSnapshot}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg gold-glow flex items-center gap-2 min-h-[44px]"
              >
                <Camera className="w-4 h-4" />
                <span>{isMarathi ? 'फोटो क्लिक करा' : 'Snap Photo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Resolution Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 text-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-400">{label}</span>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black rounded-xl p-2">
              <img src={value} alt={label} className="max-h-[65vh] w-auto object-contain rounded-lg" />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700"
              >
                {dict.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
