import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  isLight: boolean;
  circular?: boolean;
  title?: string;
  onClose: () => void;
  onCrop: (croppedBase64: string) => void;
}

export function ImageCropModal({
  isOpen,
  imageSrc,
  isLight,
  circular = true,
  title = "Adjust Profile Picture",
  onClose,
  onCrop,
}: ImageCropModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [baseDimensions, setBaseDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });

  const VIEWPORT_SIZE = 240; // size of the cropping window in px

  // Load image via robust useEffect to prevent race conditions and handle caching/iframe context
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setImageLoaded(false);
      setScale(1);
      return;
    }

    setScale(1);
    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    const handleLoad = () => {
      const nw = img.naturalWidth || img.width || VIEWPORT_SIZE;
      const nh = img.naturalHeight || img.height || VIEWPORT_SIZE;
      const ratio = (nw && nh) ? nw / nh : 1;
      
      let width = VIEWPORT_SIZE;
      let height = VIEWPORT_SIZE;

      if (ratio > 1) {
        // Landscape
        width = VIEWPORT_SIZE * ratio;
        height = VIEWPORT_SIZE;
      } else if (ratio < 1) {
        // Portrait
        width = VIEWPORT_SIZE;
        height = VIEWPORT_SIZE / ratio;
      }

      // Safeguard against NaN or infinite/invalid dimensions
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        width = VIEWPORT_SIZE;
        height = VIEWPORT_SIZE;
      }

      setBaseDimensions({ width, height });
      setImageLoaded(true);

      // Center the image initially
      setPosition({
        x: (VIEWPORT_SIZE - width) / 2,
        y: (VIEWPORT_SIZE - height) / 2,
      });
    };

    img.onload = handleLoad;
    img.onerror = (err) => {
      console.error("Image load failed in crop modal:", err);
      // Fallback so user is not stuck
      setBaseDimensions({ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE });
      setImageLoaded(true);
      setPosition({ x: 0, y: 0 });
    };

    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  const getBoundaries = (currentScale: number) => {
    const w = baseDimensions.width * currentScale;
    const h = baseDimensions.height * currentScale;

    let minX = VIEWPORT_SIZE - w;
    let maxX = 0;
    if (w <= VIEWPORT_SIZE) {
      minX = (VIEWPORT_SIZE - w) / 2;
      maxX = minX;
    }

    let minY = VIEWPORT_SIZE - h;
    let maxY = 0;
    if (h <= VIEWPORT_SIZE) {
      minY = (VIEWPORT_SIZE - h) / 2;
      maxY = minY;
    }

    return { minX, maxX, minY, maxY };
  };

  const clampPosition = (x: number, y: number, currentScale: number) => {
    const { minX, maxX, minY, maxY } = getBoundaries(currentScale);
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  };

  // Pointer Events handling for precise and robust dragging (works perfectly on mobile and desktop)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageLoaded) return;
    try {
      e.preventDefault();
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      startPosition.current = { ...position };
      if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } catch (err) {
      console.warn("Pointer down capture failed safely:", err);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !imageLoaded) return;
    try {
      e.preventDefault();
      
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      const targetX = startPosition.current.x + dx;
      const targetY = startPosition.current.y + dy;

      const clamped = clampPosition(targetX, targetY, scale);
      setPosition(clamped);
    } catch (err) {
      console.warn("Pointer move processing failed safely:", err);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging.current) {
      isDragging.current = false;
      try {
        if (e.currentTarget && typeof e.currentTarget.releasePointerCapture === 'function') {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch (err) {
        console.warn("Pointer up release failed safely:", err);
      }
    }
  };

  // Zoom changes
  const handleZoomChange = (newScale: number) => {
    const nextScale = Math.min(Math.max(newScale, 1.0), 3.0);
    setScale(nextScale);
    // Re-clamp position inside new boundaries
    setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
  };

  // Render crop using Canvas
  const handleCropApply = () => {
    if (!imageRef.current || !imageLoaded) return;

    try {
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      const OUTPUT_SIZE = 400; // Output high-quality square dimension

      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onCrop(imageSrc);
        return;
      }

      // Render dimensions
      const rWidth = baseDimensions.width * scale;
      const rHeight = baseDimensions.height * scale;

      if (!rWidth || !rHeight || !Number.isFinite(rWidth) || !Number.isFinite(rHeight)) {
        onCrop(imageSrc);
        return;
      }

      // Crop offsets on rendered dimensions
      const cropX = -position.x;
      const cropY = -position.y;

      const nw = img.naturalWidth || img.width || rWidth;
      const nh = img.naturalHeight || img.height || rHeight;

      // Ratio between natural (original) image size and rendered size
      const factorX = nw / rWidth;
      const factorY = nh / rHeight;

      // Target source dimensions on natural image
      let sourceX = cropX * factorX;
      let sourceY = cropY * factorY;
      let sourceW = VIEWPORT_SIZE * factorX;
      let sourceH = VIEWPORT_SIZE * factorY;

      // Safeguard inputs to drawImage to ensure finite positive double values
      if (!Number.isFinite(sourceX) || isNaN(sourceX)) sourceX = 0;
      if (!Number.isFinite(sourceY) || isNaN(sourceY)) sourceY = 0;
      if (!Number.isFinite(sourceW) || isNaN(sourceW) || sourceW <= 0) sourceW = nw;
      if (!Number.isFinite(sourceH) || isNaN(sourceH) || sourceH <= 0) sourceH = nh;

      // Clamp target source parameters to stay within native image dimensions safely
      const finalX = Math.max(0, Math.min(sourceX, nw - 1));
      const finalY = Math.max(0, Math.min(sourceY, nh - 1));
      const finalW = Math.max(1, Math.min(sourceW, nw - finalX));
      const finalH = Math.max(1, Math.min(sourceH, nh - finalY));

      ctx.drawImage(
        img,
        finalX,
        finalY,
        finalW,
        finalH,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.88);
      onCrop(croppedBase64);
    } catch (err) {
      console.error("Cropping failed, falling back to original image:", err);
      onCrop(imageSrc);
    }
  };

  if (!isOpen || !imageSrc || typeof imageSrc !== 'string' || imageSrc.trim() === '') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
      />

      {/* Dialog box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`relative w-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl border ${
          isLight 
            ? 'bg-[#F8F9FA] border-black/10 text-black' 
            : 'bg-[#121214] border-white/5 text-white'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <h3 className="text-[16px] font-bold tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${
              isLight ? 'hover:bg-black/5 text-black/60' : 'hover:bg-white/5 text-white/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace */}
        <div className="flex flex-col items-center py-8 px-6">
          {/* Main Visual Cropping Frame */}
          <div 
            className="relative w-[240px] h-[240px] select-none touch-none overflow-hidden bg-black/40 rounded-3xl"
          >
            {/* Viewport crop visual guide (handles pointer events directly) */}
            <div 
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`absolute inset-0 z-10 border-2 cursor-move flex items-center justify-center touch-none select-none ${
                circular ? 'rounded-full' : 'rounded-[2rem]'
              } border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]`}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <Move className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Render Image */}
            <img
              ref={imageRef}
              src={imageSrc}
              crossOrigin="anonymous"
              alt="Crop source"
              className="absolute pointer-events-none max-w-none origin-top-left"
              style={{
                width: `${baseDimensions.width * scale}px`,
                height: `${baseDimensions.height * scale}px`,
                transform: `translate(${position.x}px, ${position.y}px)`,
                opacity: imageLoaded ? 1 : 0,
              }}
            />
          </div>

          <p className={`text-[11px] text-center mt-3 ${isLight ? 'text-black/50' : 'text-white/40'}`}>
            Drag to reposition. Use slider below to zoom.
          </p>

          {/* Scale controls */}
          <div className="w-full mt-6 flex items-center gap-3">
            <button
              onClick={() => handleZoomChange(scale - 0.2)}
              disabled={scale <= 1.0}
              className={`p-1.5 rounded-full transition-colors ${
                isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'
              } disabled:opacity-30`}
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.01"
              value={scale}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-white outline-none"
            />

            <button
              onClick={() => handleZoomChange(scale + 0.2)}
              disabled={scale >= 3.0}
              className={`p-1.5 rounded-full transition-colors ${
                isLight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'
              } disabled:opacity-30`}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 flex gap-3 border-t border-white/5 bg-black/[0.04]">
          <button
            onClick={onClose}
            className={`flex-1 py-3 rounded-full text-sm font-semibold transition-colors ${
              isLight ? 'bg-black/5 hover:bg-black/10 text-black' : 'bg-white/5 hover:bg-white/10 text-white'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleCropApply}
            className={`flex-1 py-3 rounded-full text-sm font-bold transition-colors ${
              isLight ? 'bg-black hover:bg-black/90 text-white' : 'bg-white hover:bg-zinc-200 text-black'
            }`}
          >
            Apply Crop
          </button>
        </div>
      </motion.div>
    </div>
  );
}
