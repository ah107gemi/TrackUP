import React, { useState, useCallback } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { X, Check, ZoomIn, ZoomOut, User, RotateCcw } from 'lucide-react';
import { getCroppedImg } from '../../lib/cropImage';

interface AvatarCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName?: string;
  fileType?: string;
  onClose: () => void;
  onConfirmCrop: (croppedFile: File) => Promise<void> | void;
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  imageSrc,
  fileName = 'avatar-cropped.jpg',
  fileType = 'image/jpeg',
  onClose,
  onConfirmCrop,
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, currentCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError(null);
  };

  const handleSaveCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    setError(null);

    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, fileType);
      const safeName = fileName.replace(/\.[^/.]+$/, '') + '-avatar.jpg';
      const croppedFile = new File([croppedBlob], safeName, {
        type: fileType.startsWith('image/') ? fileType : 'image/jpeg',
      });

      await onConfirmCrop(croppedFile);
      onClose();
    } catch (err: any) {
      console.error('Avatar cropping error:', err);
      setError(err?.message || 'Failed to crop image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      data-testid="avatar-cropper-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-surface-elevated rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-elevated">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Crop Profile Picture</h2>
              <p className="text-xs text-text-muted">Pan and zoom to frame your 1:1 circular photo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="avatar-cropper-close-btn"
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

        {/* 1:1 Cropping Container with Circular Guide */}
        <div
          data-testid="avatar-cropper-container"
          className="relative w-full h-72 sm:h-80 bg-black/90 rounded-2xl overflow-hidden border border-surface-elevated shadow-inner"
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom & Reset Toolbar */}
        <div className="space-y-3 pt-1">
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
              data-testid="avatar-cropper-zoom-slider"
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
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-elevated">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              data-testid="avatar-cropper-cancel-btn"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCrop}
              disabled={isProcessing}
              data-testid="avatar-cropper-save-btn"
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isProcessing ? 'Cropping & Uploading...' : 'Save Profile Picture'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
