'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Camera, ZoomIn, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type Variant = 'dien' | 'nuoc' | 'default';

interface ImageUploadProps {
  imageUrl: string;
  onImageChange: (imageUrl: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  variant?: Variant;
}

const variantConfig: Record<Variant, {
  accent: string;
  accentLight: string;
  accentBorder: string;
  accentText: string;
  accentHover: string;
  icon: string;
  iconBg: string;
  badge: string;
  badgeText: string;
}> = {
  dien: {
    accent: 'from-amber-400 to-yellow-300',
    accentLight: 'from-amber-50 to-yellow-50',
    accentBorder: 'border-amber-300',
    accentText: 'text-amber-600',
    accentHover: 'hover:border-amber-400 hover:from-amber-50 hover:to-yellow-50',
    icon: '⚡',
    iconBg: 'bg-amber-100',
    badge: 'bg-amber-100 border-amber-200',
    badgeText: 'text-amber-700',
  },
  nuoc: {
    accent: 'from-blue-400 to-cyan-300',
    accentLight: 'from-blue-50 to-cyan-50',
    accentBorder: 'border-blue-300',
    accentText: 'text-blue-600',
    accentHover: 'hover:border-blue-400 hover:from-blue-50 hover:to-cyan-50',
    icon: '💧',
    iconBg: 'bg-blue-100',
    badge: 'bg-blue-100 border-blue-200',
    badgeText: 'text-blue-700',
  },
  default: {
    accent: 'from-indigo-400 to-purple-300',
    accentLight: 'from-indigo-50 to-purple-50',
    accentBorder: 'border-indigo-300',
    accentText: 'text-indigo-600',
    accentHover: 'hover:border-indigo-400 hover:from-indigo-50 hover:to-purple-50',
    icon: '🖼️',
    iconBg: 'bg-indigo-100',
    badge: 'bg-indigo-100 border-indigo-200',
    badgeText: 'text-indigo-700',
  },
};

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function ImageUpload({
  imageUrl,
  onImageChange,
  className = '',
  label = 'Ảnh',
  placeholder = 'Chọn ảnh',
  variant = 'default',
}: ImageUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = variantConfig[variant];

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được quá 5MB');
      return;
    }

    setUploadState('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      // API trả về secure_url (không phải url) — fix lỗi upload ảnh từ máy tính
      const uploadedUrl = result.data?.secure_url || result.data?.url;
      if (result.success && uploadedUrl) {
        onImageChange(uploadedUrl);
        setUploadState('success');
        toast.success('Upload ảnh thành công');
        setTimeout(() => setUploadState('idle'), 2000);
      } else {
        throw new Error('Upload failed');
      }
    } catch {
      setUploadState('error');
      toast.error('Có lỗi xảy ra khi upload ảnh');
      setTimeout(() => setUploadState('idle'), 2000);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onImageChange]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm ${cfg.iconBg}`}>
          {cfg.icon}
        </span>
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        {imageUrl && (
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge} ${cfg.badgeText} flex items-center gap-1`}>
            <CheckCircle2 className="w-3 h-3" />
            Đã có ảnh
          </span>
        )}
      </div>

      {/* Upload zone / Preview */}
      {imageUrl ? (
        <div className="relative group rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-52 object-cover"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-gray-800 text-xs font-medium rounded-lg shadow transition-all"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              Xem ảnh
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-gray-800 text-xs font-medium rounded-lg shadow transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              Đổi ảnh
            </button>
            <button
              type="button"
              onClick={() => { onImageChange(''); setUploadState('idle'); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/90 hover:bg-red-600 text-white text-xs font-medium rounded-lg shadow transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Xóa
            </button>
          </div>
          {/* Bottom gradient bar */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${cfg.accent}`} />
        </div>
      ) : (
        <div
          onClick={() => uploadState === 'idle' && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative w-full h-52 rounded-xl border-2 border-dashed cursor-pointer
            bg-gradient-to-br transition-all duration-200 select-none
            ${isDragging
              ? `${cfg.accentBorder} ${cfg.accentLight} scale-[1.01] shadow-md`
              : `border-gray-200 from-gray-50 to-white ${cfg.accentHover}`
            }
          `}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            {uploadState === 'uploading' && (
              <>
                <div className={`w-14 h-14 rounded-full ${cfg.iconBg} flex items-center justify-center`}>
                  <Loader2 className={`w-7 h-7 ${cfg.accentText} animate-spin`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${cfg.accentText}`}>Đang tải lên...</p>
                  <p className="text-xs text-gray-400 mt-0.5">Vui lòng chờ</p>
                </div>
              </>
            )}
            {uploadState === 'success' && (
              <>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-green-600">Tải lên thành công!</p>
              </>
            )}
            {uploadState === 'error' && (
              <>
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-red-600">Có lỗi xảy ra, thử lại</p>
              </>
            )}
            {uploadState === 'idle' && (
              <>
                {isDragging ? (
                  <>
                    <div className={`w-14 h-14 rounded-full ${cfg.iconBg} flex items-center justify-center`}>
                      <Upload className={`w-7 h-7 ${cfg.accentText}`} />
                    </div>
                    <p className={`text-sm font-bold ${cfg.accentText}`}>Thả ảnh vào đây!</p>
                  </>
                ) : (
                  <>
                    <div className={`w-14 h-14 rounded-full ${cfg.iconBg} flex items-center justify-center shadow-sm`}>
                      <Camera className={`w-7 h-7 ${cfg.accentText}`} />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-gray-700">{placeholder}</p>
                      <p className="text-xs text-gray-400">
                        Kéo thả hoặc{' '}
                        <span className={`font-medium ${cfg.accentText} underline underline-offset-2`}>
                          chọn từ máy
                        </span>
                      </p>
                      <p className="text-xs text-gray-300">PNG, JPG, WEBP · Tối đa 5MB</p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Corner decoration */}
          <div className={`absolute top-3 right-3 w-2 h-2 rounded-full bg-gradient-to-br ${cfg.accent} opacity-60`} />
          <div className={`absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${cfg.accent} opacity-40`} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Lightbox preview */}
      {showPreview && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPreview(false)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-700" />
            </button>
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <div className={`h-1 bg-gradient-to-r ${cfg.accent}`} />
              <img src={imageUrl} alt={label} className="w-full max-h-[70vh] object-contain bg-gray-900" />
              <div className="bg-gray-900 px-4 py-2 flex items-center gap-2">
                <span className="text-sm">{cfg.icon}</span>
                <span className="text-xs text-gray-300 font-medium">{label}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
