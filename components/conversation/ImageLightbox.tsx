'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useCallback } from 'react';

type ImageLightboxProps = {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 重置状态
  const resetState = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  // 打开时重置
  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if (e.key === '+' || e.key === '=') {
        setScale(s => Math.min(s + 0.25, 5));
      }
      if (e.key === '-') {
        setScale(s => Math.max(s - 0.25, 0.25));
      }
      if (e.key === '0') {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
  const handleRotate = () => {
    // 简单重置位置和缩放
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none">
        {/* 工具栏 */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleZoomOut}
            className="bg-black/50 hover:bg-black/70 text-white"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleZoomIn}
            className="bg-black/50 hover:bg-black/70 text-white"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRotate}
            className="bg-black/50 hover:bg-black/70 text-white"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="bg-black/50 hover:bg-black/70 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 图片容器 */}
        <div
          className="flex items-center justify-center h-[80vh] overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={src}
            alt={alt}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              maxWidth: '90vw',
              maxHeight: '80vh',
              objectFit: 'contain',
            }}
            className="select-none"
            draggable={false}
          />
        </div>

        {/* 底部提示 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/50 px-3 py-1 rounded">
          Click to drag • Scroll to zoom • ESC to close • +/- to zoom
        </div>
      </DialogContent>
    </Dialog>
  );
}
