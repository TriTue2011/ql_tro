'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Image as ImageIcon, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface CCCDUploadProps {
  anhCCCD: {
    matTruoc: string;
    matSau: string;
  };
  onCCCDChange: (anhCCCD: { matTruoc: string; matSau: string }) => void;
  className?: string;
}

export function CCCDUpload({ 
  anhCCCD, 
  onCCCDChange, 
  className = '' 
}: CCCDUploadProps) {
  const [uploading, setUploading] = useState<{ matTruoc: boolean; matSau: boolean }>({
    matTruoc: false,
    matSau: false
  });
  const matTruocInputRef = useRef<HTMLInputElement>(null);
  const matSauInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, type: 'matTruoc' | 'matSau') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }

    setUploading(prev => ({ ...prev, [type]: true }));

    try {
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
      onCCCDChange({
        ...anhCCCD,
        [type]: result.data.secure_url
      });
      
      toast.success(`Upload ảnh CCCD ${type === 'matTruoc' ? 'mặt trước' : 'mặt sau'} thành công!`);

    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra khi upload ảnh');
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
      if (type === 'matTruoc' && matTruocInputRef.current) {
        matTruocInputRef.current.value = '';
      }
      if (type === 'matSau' && matSauInputRef.current) {
        matSauInputRef.current.value = '';
      }
    }
  };

  const removeImage = (type: 'matTruoc' | 'matSau') => {
    onCCCDChange({
      ...anhCCCD,
      [type]: ''
    });
    toast.success(`Xóa ảnh CCCD ${type === 'matTruoc' ? 'mặt trước' : 'mặt sau'} thành công!`);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium">Ảnh CCCD</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mặt trước */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Mặt trước CCCD
            </label>
            <input
              ref={matTruocInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'matTruoc')}
              className="hidden"
              disabled={uploading.matTruoc}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => matTruocInputRef.current?.click()}
              disabled={uploading.matTruoc}
            >
              {uploading.matTruoc ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang upload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>

          {anhCCCD.matTruoc ? (
            <Card className="relative group">
              <CardContent className="p-2">
                <div className="relative aspect-[3/2] rounded-md overflow-hidden bg-gray-100">
                  <img
                    src={anhCCCD.matTruoc}
                    alt="CCCD mặt trước"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage('matTruoc')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-500 text-sm text-center">
                  Chưa có ảnh CCCD mặt trước
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Mặt sau */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Mặt sau CCCD
            </label>
            <input
              ref={matSauInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'matSau')}
              className="hidden"
              disabled={uploading.matSau}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => matSauInputRef.current?.click()}
              disabled={uploading.matSau}
            >
              {uploading.matSau ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang upload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>

          {anhCCCD.matSau ? (
            <Card className="relative group">
              <CardContent className="p-2">
                <div className="relative aspect-[3/2] rounded-md overflow-hidden bg-gray-100">
                  <img
                    src={anhCCCD.matSau}
                    alt="CCCD mặt sau"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage('matSau')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-500 text-sm text-center">
                  Chưa có ảnh CCCD mặt sau
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex justify-center">
        <Badge variant="secondary" className="text-xs">
          {anhCCCD.matTruoc && anhCCCD.matSau 
            ? 'Đã upload đầy đủ ảnh CCCD' 
            : `Còn thiếu ${!anhCCCD.matTruoc && !anhCCCD.matSau ? '2' : '1'} ảnh CCCD`
          }
        </Badge>
      </div>
    </div>
  );
}
