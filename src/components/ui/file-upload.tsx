'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle2, AlertCircle, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadProps {
  fileUrl: string;
  onFileChange: (fileUrl: string) => void;
  className?: string;
  label?: string;
  folder?: string;
  /** Accepted MIME types — defaults to images + PDF */
  accept?: string;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|avif|heic)(\?.*)?$/i.test(url);
}

function fileNameFromUrl(url: string) {
  try {
    const parts = new URL(url).pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return url.split('/').pop() || 'file';
  }
}

export function FileUpload({
  fileUrl,
  onFileChange,
  className = '',
  label = 'File',
  folder,
  accept = 'image/jpeg,image/png,image/webp,image/heic,application/pdf',
}: FileUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const maxSize = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxSize) {
      toast.error('File không được quá 20MB');
      return;
    }

    setUploadState('uploading');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'file');
      if (folder) fd.append('folder', folder);

      const response = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      const uploadedUrl = result.data?.secure_url || result.data?.url;
      if (result.success && uploadedUrl) {
        onFileChange(uploadedUrl);
        setUploadState('success');
        toast.success('Tải lên thành công');
        setTimeout(() => setUploadState('idle'), 2000);
      } else {
        throw new Error('Upload failed');
      }
    } catch {
      setUploadState('error');
      toast.error('Có lỗi xảy ra khi tải lên file');
      setTimeout(() => setUploadState('idle'), 2000);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onFileChange, folder]);

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

  const isImage = fileUrl && isImageUrl(fileUrl);
  const fileName = fileUrl ? fileNameFromUrl(fileUrl) : '';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-100 text-sm">📄</span>
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        {fileUrl && (
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-100 border-emerald-200 text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Đã có file
          </span>
        )}
      </div>

      {fileUrl ? (
        <div className="rounded-xl border-2 border-emerald-200 overflow-hidden shadow-sm">
          {isImage ? (
            <div className="relative group">
              <img src={fileUrl} alt={label} className="w-full max-h-64 object-contain bg-gray-50" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-gray-800 text-xs font-medium rounded-lg shadow transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Xem
                </a>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-gray-800 text-xs font-medium rounded-lg shadow transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Đổi file
                </button>
                <button
                  type="button"
                  onClick={() => { onFileChange(''); setUploadState('idle'); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/90 hover:bg-red-600 text-white text-xs font-medium rounded-lg shadow transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Xóa
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50">
              <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
                <p className="text-xs text-gray-500">Đã tải lên thành công</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-medium transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Xem
                </a>
                <a
                  href={fileUrl}
                  download
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải
                </a>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Đổi
                </button>
                <button
                  type="button"
                  onClick={() => { onFileChange(''); setUploadState('idle'); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Xóa
                </button>
              </div>
            </div>
          )}
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-300" />
        </div>
      ) : (
        <div
          onClick={() => uploadState === 'idle' && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative w-full rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 select-none
            ${isDragging
              ? 'border-emerald-400 bg-emerald-50 scale-[1.01] shadow-md'
              : 'border-gray-200 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/50'
            }
          `}
        >
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-4">
            {uploadState === 'uploading' && (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-600">Đang tải lên...</p>
                  <p className="text-xs text-gray-400 mt-0.5">Vui lòng chờ</p>
                </div>
              </>
            )}
            {uploadState === 'success' && (
              <>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-green-600">Tải lên thành công!</p>
              </>
            )}
            {uploadState === 'error' && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-red-600">Có lỗi xảy ra, thử lại</p>
              </>
            )}
            {uploadState === 'idle' && (
              isDragging ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-emerald-600">Thả file vào đây!</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-gray-700">Chọn file hoặc kéo thả vào đây</p>
                    <p className="text-xs text-gray-400">
                      <span className="font-medium text-emerald-600 underline underline-offset-2">Chọn từ máy</span>
                    </p>
                    <p className="text-xs text-gray-300">PDF, ảnh (JPG, PNG, WEBP) · Tối đa 20MB</p>
                  </div>
                </>
              )
            )}
          </div>

          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-gradient-to-br from-emerald-400 to-teal-300 opacity-60" />
          <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-300 opacity-40" />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
