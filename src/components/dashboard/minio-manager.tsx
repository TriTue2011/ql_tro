'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HardDrive,
  Folder,
  FileText,
  Image,
  Trash2,
  Plus,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Save,
  Download,
  ArrowLeft,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MinioBucket {
  name: string;
  creationDate?: Date;
}

interface MinioFile {
  name: string;
  size: number;
  lastModified: Date;
  url: string;
}

interface MinioFolder {
  prefix: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  return 'file';
}

function getFileName(path: string) {
  return path.split('/').filter(Boolean).pop() || path;
}

function getParentPrefix(prefix: string) {
  const parts = prefix.replace(/\/$/, '').split('/');
  parts.pop();
  return parts.length > 0 ? parts.join('/') + '/' : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MinioManager() {
  // ── Connection state ──
  const [endpoint, setEndpoint] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  // ── Bucket state ──
  const [buckets, setBuckets] = useState<MinioBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [newBucketName, setNewBucketName] = useState('');
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [deletingBucket, setDeletingBucket] = useState<string | null>(null);

  // ── File browser state ──
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<MinioFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Sidebar category state (tree style) ──
  const [sidebarCategory, setSidebarCategory] = useState<string | null>('buckets');

  // ── Load saved connection from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ql-tro-minio-connection');
      if (saved) {
        const parsed = JSON.parse(saved);
        setEndpoint(parsed.endpoint || '');
        setAccessKey(parsed.accessKey || '');
        setSecretKey(parsed.secretKey || '');
      }
    } catch { /* ignore */ }
  }, []);

  // ── Connect to MinIO ──
  async function handleConnect() {
    if (!endpoint.trim() || !accessKey.trim() || !secretKey.trim()) {
      toast.error('Cần điền Endpoint, Username và Password');
      return;
    }
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/admin/storage/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: endpoint.trim(),
          accessKey: accessKey.trim(),
          secretKey: secretKey.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnected(true);
        setBuckets((data.buckets || []).map((name: string) => ({ name })));
        localStorage.setItem('ql-tro-minio-connection', JSON.stringify({
          endpoint: endpoint.trim(),
          accessKey: accessKey.trim(),
          secretKey: secretKey.trim(),
        }));
        toast.success('Kết nối MinIO thành công');
        if (data.buckets?.length > 0) {
          setSelectedBucket(data.buckets[0]);
        }
      } else {
        setConnected(false);
        setConnectError(data.message || 'Kết nối thất bại');
        toast.error(data.message || 'Kết nối thất bại');
      }
    } catch {
      setConnected(false);
      setConnectError('Lỗi kết nối máy chủ');
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setConnecting(false);
    }
  }

  // ── Create bucket ──
  async function handleCreateBucket() {
    const name = newBucketName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!name || name.length < 3) { toast.error('Tên bucket tối thiểu 3 ký tự'); return; }
    setCreatingBucket(true);
    try {
      const res = await fetch('/api/admin/storage/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        setBuckets(prev => [...prev, { name }]);
        setSelectedBucket(name);
        setNewBucketName('');
        setCurrentPrefix('');
        toast.success(`Đã tạo bucket "${name}"`);
      } else {
        toast.error(data.message || 'Tạo bucket thất bại');
      }
    } catch {
      toast.error('Lỗi tạo bucket');
    } finally {
      setCreatingBucket(false);
    }
  }

  // ── Delete bucket ──
  async function handleDeleteBucket(name: string) {
    if (!confirm(`Xóa bucket "${name}"? Toàn bộ dữ liệu bên trong sẽ mất!`)) return;
    setDeletingBucket(name);
    try {
      const res = await fetch(`/api/admin/storage/buckets?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setBuckets(prev => prev.filter(b => b.name !== name));
        if (selectedBucket === name) {
          setSelectedBucket(buckets.length > 1 ? buckets.find(b => b.name !== name)?.name || null : null);
          setCurrentPrefix('');
          setFolders([]);
          setFiles([]);
        }
        toast.success(`Đã xóa bucket "${name}"`);
      } else {
        toast.error(data.message || 'Xóa bucket thất bại');
      }
    } catch {
      toast.error('Lỗi xóa bucket');
    } finally {
      setDeletingBucket(null);
    }
  }

  // ── Load files/folders ──
  const loadFiles = useCallback(async (bucket: string, prefix: string) => {
    if (!bucket) return;
    setLoadingFiles(true);
    try {
      const res = await fetch(
        `/api/admin/storage/objects?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(prefix)}`
      );
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
        setFiles(data.files || []);
      } else {
        toast.error(data.message || 'Lỗi tải danh sách file');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // ── Load files when bucket or prefix changes ──
  useEffect(() => {
    if (selectedBucket) {
      loadFiles(selectedBucket, currentPrefix);
    } else {
      setFolders([]);
      setFiles([]);
    }
  }, [selectedBucket, currentPrefix, loadFiles]);

  // ── Navigate into folder ──
  function navigateToFolder(prefix: string) {
    setCurrentPrefix(prefix);
  }

  // ── Navigate up ──
  function navigateUp() {
    if (!currentPrefix) return;
    setCurrentPrefix(getParentPrefix(currentPrefix));
  }

  // ── Upload file ──
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedBucket) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', selectedBucket);
      formData.append('prefix', currentPrefix);
      const res = await fetch('/api/admin/storage/objects', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã upload "${file.name}"`);
        loadFiles(selectedBucket, currentPrefix);
      } else {
        toast.error(data.message || 'Upload thất bại');
      }
    } catch {
      toast.error('Lỗi upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Create folder ──
  async function handleCreateFolder() {
    const name = newFolderName.trim().replace(/[/\\]/g, '');
    if (!name) { toast.error('Nhập tên folder'); return; }
    setCreatingFolder(true);
    try {
      const formData = new FormData();
      formData.append('bucket', selectedBucket || '');
      formData.append('prefix', currentPrefix);
      formData.append('folderName', name);
      const res = await fetch('/api/admin/storage/objects', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã tạo folder "${name}"`);
        setNewFolderName('');
        loadFiles(selectedBucket!, currentPrefix);
      } else {
        toast.error(data.message || 'Tạo folder thất bại');
      }
    } catch {
      toast.error('Lỗi tạo folder');
    } finally {
      setCreatingFolder(false);
    }
  }

  // ── Delete file ──
  async function handleDeleteFile(key: string) {
    const fileName = getFileName(key);
    if (!confirm(`Xóa file "${fileName}"?`)) return;
    setDeletingFile(key);
    try {
      const res = await fetch('/api/admin/storage/objects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: selectedBucket, key }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã xóa "${fileName}"`);
        loadFiles(selectedBucket!, currentPrefix);
      } else {
        toast.error(data.message || 'Xóa thất bại');
      }
    } catch {
      toast.error('Lỗi xóa file');
    } finally {
      setDeletingFile(null);
    }
  }

  // ── Delete folder ──
  async function handleDeleteFolder(prefix: string) {
    const folderName = prefix.replace(/\/$/, '').split('/').pop() || prefix;
    if (!confirm(`Xóa folder "${folderName}" và tất cả file bên trong?`)) return;
    setDeletingFile(prefix);
    try {
      const res = await fetch('/api/admin/storage/objects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: selectedBucket, prefix, isFolder: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã xóa folder "${folderName}"`);
        loadFiles(selectedBucket!, currentPrefix);
      } else {
        toast.error(data.message || 'Xóa thất bại');
      }
    } catch {
      toast.error('Lỗi xóa folder');
    } finally {
      setDeletingFile(null);
    }
  }

  // ── Download file ──
  function handleDownload(url: string, name: string) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = name;
    a.click();
  }

  // ── Render: Connection form ──
  function renderConnectionForm() {
    return (
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <HardDrive className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-base font-bold text-indigo-900">Kết nối MinIO</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Endpoint</Label>
            <Input
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              placeholder="http://192.168.1.10:9000"
              className="text-sm"
            />
          </div>
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Username (Access Key)</Label>
            <Input
              value={accessKey}
              onChange={e => setAccessKey(e.target.value)}
              placeholder="minioadmin"
              className="text-sm"
            />
          </div>
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Password (Secret Key)</Label>
            <Input
              type="password"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              className="text-sm"
            />
          </div>
          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Đang kết nối...</>
            ) : (
              <><HardDrive className="h-4 w-4 mr-2" />Kết nối</>
            )}
          </Button>
          {connectError && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-red-50 border border-red-200 text-red-800">
              <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
              {connectError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Bucket list (left sidebar) ──
  function renderBucketList() {
    return (
      <div className="space-y-2">
        {/* Buckets group */}
        <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 space-y-1 shadow-sm">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider px-1 mb-2">
            <HardDrive className="h-3.5 w-3.5 inline mr-1" />
            Buckets
          </p>
          {buckets.map(bucket => {
            const isSelected = sidebarCategory === 'bucket-' + bucket.name;
            return (
              <button
                key={bucket.name}
                type="button"
                onClick={() => {
                  setSidebarCategory('bucket-' + bucket.name);
                  setSelectedBucket(bucket.name);
                  setCurrentPrefix('');
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all duration-200 text-xs ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 border-0 text-white font-semibold shadow-lg shadow-indigo-200'
                    : 'bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <HardDrive className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{bucket.name}</span>
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBucket(bucket.name);
                    }}
                    disabled={deletingBucket === bucket.name}
                    className="text-white/80 hover:text-white p-0.5"
                    title="Xóa bucket"
                  >
                    {deletingBucket === bucket.name ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Create bucket */}
        <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 space-y-2 shadow-sm">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider px-1">Tạo bucket mới</p>
          <div className="flex gap-2">
            <Input
              value={newBucketName}
              onChange={e => setNewBucketName(e.target.value)}
              placeholder="Tên bucket"
              className="text-xs h-8"
              onKeyDown={e => { if (e.key === 'Enter') handleCreateBucket(); }}
            />
            <Button
              size="sm"
              className="h-8 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200 shrink-0"
              onClick={handleCreateBucket}
              disabled={creatingBucket || !newBucketName.trim()}
            >
              {creatingBucket ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: File browser (right panel) ──
  function renderFileBrowser() {
    if (!selectedBucket) {
      return (
        <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/50 p-8 text-center">
          <HardDrive className="mx-auto h-8 w-8 text-indigo-300 mb-2" />
          <p className="text-sm text-indigo-400">Chọn một bucket bên trái để xem nội dung</p>
        </div>
      );
    }

    const bucketName = selectedBucket;

    return (
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-indigo-100">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <HardDrive className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-indigo-900 truncate">{bucketName}</h3>
            <p className="text-xs text-indigo-500/70">
              {currentPrefix ? `/${currentPrefix}` : '/'}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-indigo-100 flex flex-wrap gap-2">
          {/* Navigation */}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 border-indigo-200 text-indigo-600"
              onClick={() => { setCurrentPrefix(''); }}
              disabled={!currentPrefix}
              title="Về thư mục gốc"
            >
              <Home className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 border-indigo-200 text-indigo-600"
              onClick={navigateUp}
              disabled={!currentPrefix}
              title="Lên trên"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Upload file */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Đang tải...</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload</>
              )}
            </Button>
          </div>

          {/* Create folder */}
          <div className="flex gap-1">
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Tên folder"
              className="text-xs h-8 w-28"
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
            />
            <Button
              size="sm"
              className="h-8 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
            >
              {creatingFolder ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Refresh */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-indigo-200 text-indigo-600"
            onClick={() => loadFiles(selectedBucket, currentPrefix)}
            disabled={loadingFiles}
            title="Làm mới"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-3 min-h-[300px] max-h-[500px] overflow-y-auto">
          {loadingFiles ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
              <span className="ml-2 text-sm text-indigo-500">Đang tải...</span>
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Folder className="h-8 w-8 text-indigo-300 mb-2" />
              <p className="text-sm text-indigo-400">Thư mục trống</p>
              <p className="text-xs text-indigo-300 mt-1">Upload file hoặc tạo folder mới</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Folders */}
              {folders.map(folder => {
                const folderName = folder.replace(/\/$/, '').split('/').pop() || folder;
                return (
                  <div
                    key={folder}
                    className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors group"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      onClick={() => navigateToFolder(folder)}
                    >
                      <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                      <span className="text-sm font-medium text-indigo-800 truncate">{folderName}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-indigo-300 shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder)}
                      disabled={deletingFile === folder}
                      className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                      title="Xóa folder"
                    >
                      {deletingFile === folder ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Files */}
              {files.map(file => {
                const fileName = getFileName(file.name);
                const iconType = getFileIcon(fileName);
                const isImage = iconType === 'image';
                return (
                  <div
                    key={file.name}
                    className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Thumbnail/Icon */}
                      {isImage && file.url ? (
                        <img
                          src={file.url}
                          alt=""
                          className="h-8 w-8 rounded object-cover border shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`h-8 w-8 rounded bg-indigo-50 flex items-center justify-center shrink-0 ${isImage && file.url ? 'hidden' : ''}`}>
                        <FileText className="h-4 w-4 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-indigo-800 truncate">{fileName}</p>
                        <p className="text-[10px] text-indigo-400">
                          {formatBytes(file.size)} · {new Date(file.lastModified).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {file.url && (
                        <button
                          type="button"
                          onClick={() => handleDownload(file.url, fileName)}
                          className="text-indigo-400 hover:text-indigo-600 p-1"
                          title="Tải xuống"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.name)}
                        disabled={deletingFile === file.name}
                        className="text-gray-300 hover:text-red-500 p-1"
                        title="Xóa file"
                      >
                        {deletingFile === file.name ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main render ──
  if (!connected) {
    return renderConnectionForm();
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left sidebar */}
      <div className="w-full lg:w-72 shrink-0">
        {renderBucketList()}

        {/* Disconnect */}
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs"
            onClick={() => {
              setConnected(false);
              setBuckets([]);
              setSelectedBucket(null);
              setCurrentPrefix('');
              setFolders([]);
              setFiles([]);
              setSidebarCategory('buckets');
            }}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Ngắt kết nối
          </Button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0">
        {renderFileBrowser()}
      </div>
    </div>
  );
}
