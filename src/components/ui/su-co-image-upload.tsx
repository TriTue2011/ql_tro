'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Image as ImageIcon, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SuCoImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  className?: string;
  maxImages?: number;
}

export function SuCoImageUpload({ 
  images, 
  onImagesChange, 
  className = '',
  maxImages = 5
}: SuCoImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    
    // Kiểm tra số lượng ảnh
    if (images.length + newFiles.length > maxImages) {
      toast.error(`Chỉ được upload tối đa ${maxImages} ảnh`);
      return;
    }

    // Kiểm tra định dạng file
    const invalidFiles = newFiles.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toast.error('Vui lòng chọn file ảnh hợp lệ');
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = newFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Lỗi upload ảnh');
        }

        const result = await response.json();
        return result.data.secure_url || result.data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      onImagesChange([...images, ...uploadedUrls]);
      
      toast.success(`Upload ${uploadedUrls.length} ảnh thành công!`);

    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra khi upload ảnh');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    toast.success('Xóa ảnh thành công!');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <h3 className="text-lg font-medium">Ảnh sự cố</h3>
        <Badge variant="secondary" className="text-xs">
          {images.length}/{maxImages} ảnh
        </Badge>
      </div>

      {/* Upload button */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || images.length >= maxImages}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || images.length >= maxImages}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang upload...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Thêm ảnh
            </>
          )}
        </Button>
        {images.length >= maxImages && (
          <span className="text-sm text-gray-500">
            Đã đạt giới hạn {maxImages} ảnh
          </span>
        )}
      </div>

      {/* Images grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((imageUrl, index) => (
            <Card key={index} className="relative group">
              <CardContent className="p-2">
                <div className="relative aspect-square rounded-md overflow-hidden bg-gray-100">
                  <img
                    src={imageUrl}
                    alt={`Sự cố ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ImageIcon className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 text-sm text-center">
              Chưa có ảnh sự cố nào
            </p>
            <p className="text-xs text-gray-400 text-center mt-1">
              Click "Thêm ảnh" để upload ảnh minh họa sự cố
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status badge */}
      <div className="flex justify-center">
        <Badge 
          variant={images.length > 0 ? "default" : "secondary"} 
          className="text-xs"
        >
          {images.length > 0 
            ? `Đã upload ${images.length} ảnh sự cố` 
            : 'Chưa có ảnh sự cố'
          }
        </Badge>
      </div>
    </div>
  );
}
