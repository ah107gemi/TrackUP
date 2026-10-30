import React, { useState, useCallback } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { X, Check, ZoomIn, ZoomOut, Crop, RotateCcw } from 'lucide-react';
import { getCroppedImg } from '../../lib/cropImage';

interface BannerCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName?: string;
  fileType?: string;
  onClose: () => void;
  onConfirmCrop: (croppedFile: File) => Promise<void> | void;
}

export const BannerCropperModal: React.FC<BannerCropperModalProps> = ({
  isOpen,
  imageSrc,
  fileName = 'cropped-banner.jpg',
  fileType = 'image/jpeg',
  onClose,
  onConfirmCrop,
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, currentCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectRatio(16 / 9);
    setError(null);
  };

  const handleSaveCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    setError(null);

    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, fileType);
      const safeName = fileName.replace(/\.[^/.]+$/, '') + '-cropped.jpg';
      const croppedFile = new File([croppedBlob], safeName, {
        type: fileType.startsWith('image/') ? fileType : 'image/jpeg',
      });

      await onConfirmCrop(croppedFile);
      onClose();
    } catch (err: any) {
      console.error('Cropping error:', err);
      setError(err?.message || 'Failed to crop image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      data-testid="banner-cropper-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-surface-elevated rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-elevated">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Adjust Banner Frame</h2>
              <p className="text-xs text-text-muted">Pan, zoom, and crop to set the perfect banner angle</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="cropper-close-btn"
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Cropping Area */}
        <div
          data-testid="cropper-container"
          className="relative w-full h-64 sm:h-80 bg-black/90 rounded-2xl overflow-hidden border border-surface-elevated shadow-inner"
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={true}
          />
        </div>

        {/* Controls Toolbar */}
        <div className="space-y-3 pt-1">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3 bg-surface-elevated/40 p-2.5 rounded-xl border border-surface-elevated">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
              className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              data-testid="cropper-zoom-slider"
              className="flex-1 accent-accent h-1.5 bg-surface-elevated rounded-lg cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
              className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-text-muted w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Aspect Ratio and Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-elevated border border-surface-elevated text-xs">
              <span className="text-[11px] text-text-muted px-2 font-medium">Aspect:</span>
              <button
                type="button"
                onClick={() => setAspectRatio(16 / 9)}
                data-testid="cropper-aspect-16-9"
                className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  Math.abs(aspectRatio - 16 / 9) < 0.01
                    ? 'bg-accent text-background shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                16:9 Cinematic
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio(3 / 1)}
                data-testid="cropper-aspect-3-1"
                className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  Math.abs(aspectRatio - 3 / 1) < 0.01
                    ? 'bg-accent text-background shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                3:1 Panorama
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              data-testid="cropper-reset-btn"
              className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors cursor-pointer px-2 py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-surface-elevated flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            data-testid="cropper-cancel-btn"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            disabled={isProcessing}
            data-testid="cropper-confirm-btn"
            className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>{isProcessing ? 'Cropping & Uploading...' : 'Save Cropped Banner'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
