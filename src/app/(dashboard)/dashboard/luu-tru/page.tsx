'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  HardDrive,
  Folder,
  FolderPlus,
  File,
  FileText,
  FileImage,
  Upload,
  Trash2,
  Plus,
  ChevronRight,
  RefreshCw,
  Download,
  Eye,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Copy,
  X as CloseIcon,
} from 'lucide-react';
import PageHeader from '@/components/dashboard/page-header';

// ── Types ───────────────────────────────────────────────────────────────────────
interface Bucket {
  name: string;
  creationDate: string;
}
interface FileItem {
  name: string;
  size: number;
  lastModified: string;
  url: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'].includes(ext))
    return <FileImage className="h-4 w-4 text-blue-500 shrink-0" />;
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'].includes(ext))
    return <FileText className="h-4 w-4 text-orange-500 shrink-0" />;
  return <File className="h-4 w-4 text-gray-400 shrink-0" />;
}

function shortName(fullPath: string, prefix: string) {
  return fullPath.slice(prefix.length);
}

function folderLabel(fullPrefix: string, parentPrefix: string) {
  return fullPrefix.slice(parentPrefix.length).replace(/\/$/, '');
}

// ── Main Component ───────────────────────────────────────────────────────────────
export default function LuuTruPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [status, session, router]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [prefix, setPrefix] = useState<string>('');           // current folder path
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [loadingObjects, setLoadingObjects] = useState(false);

  const [isNewBucketOpen, setIsNewBucketOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [deleteBucket, setDeleteBucket] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ key?: string; prefix?: string; label: string } | null>(null);

  // Form state
  const [newBucketName, setNewBucketName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch buckets ────────────────────────────────────────────────────────────
  const fetchBuckets = useCallback(async () => {
    setLoadingBuckets(true);
    try {
      const res = await fetch('/api/admin/storage/buckets');
      const data = await res.json();
      if (data.success) {
        setBuckets(data.buckets);
      } else {
        toast.error(data.message || 'Lỗi tải danh sách bucket');
      }
    } catch {
      toast.error('Không thể kết nối MinIO');
    } finally {
      setLoadingBuckets(false);
    }
  }, []);

  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);

  // ── Fetch objects ────────────────────────────────────────────────────────────
  const fetchObjects = useCallback(async (bucket: string, pref: string) => {
    if (!bucket) return;
    setLoadingObjects(true);
    try {
      const res = await fetch(`/api/admin/storage/objects?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(pref)}`);
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders);
        setFiles(data.files);
      } else {
        toast.error(data.message || 'Lỗi tải danh sách file');
      }
    } catch {
      toast.error('Lỗi tải objects');
    } finally {
      setLoadingObjects(false);
    }
  }, []);

  // ── Bucket select / folder navigate ─────────────────────────────────────────
  const selectBucket = (name: string) => {
    setSelectedBucket(name);
    setPrefix('');
    fetchObjects(name, '');
  };

  const openFolder = (folderPrefix: string) => {
    setPrefix(folderPrefix);
    fetchObjects(selectedBucket, folderPrefix);
  };

  const goUp = () => {
    if (!prefix) return;
    // Remove last segment
    const parts = prefix.replace(/\/$/, '').split('/');
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
    setPrefix(newPrefix);
    fetchObjects(selectedBucket, newPrefix);
  };

  // ── Breadcrumbs ──────────────────────────────────────────────────────────────
  const breadcrumbParts = prefix ? prefix.replace(/\/$/, '').split('/') : [];

  const navigateBreadcrumb = (index: number) => {
    if (index < 0) {
      // Go to bucket root
      setPrefix('');
      fetchObjects(selectedBucket, '');
    } else {
      const newPrefix = breadcrumbParts.slice(0, index + 1).join('/') + '/';
      setPrefix(newPrefix);
      fetchObjects(selectedBucket, newPrefix);
    }
  };

  // ── Create bucket ────────────────────────────────────────────────────────────
  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/storage/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBucketName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsNewBucketOpen(false);
        setNewBucketName('');
        await fetchBuckets();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Lỗi tạo bucket');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete bucket ────────────────────────────────────────────────────────────
  const handleDeleteBucket = async () => {
    if (!deleteBucket) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/storage/buckets?name=${encodeURIComponent(deleteBucket)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setDeleteBucket(null);
        if (selectedBucket === deleteBucket) {
          setSelectedBucket('');
          setPrefix('');
          setFolders([]);
          setFiles([]);
        }
        await fetchBuckets();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Lỗi xóa bucket');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Create folder ────────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !selectedBucket) return;
    setActionLoading(true);
    try {
      const fd = new FormData();
      fd.append('bucket', selectedBucket);
      fd.append('prefix', prefix);
      fd.append('folderName', newFolderName.trim());
      const res = await fetch('/api/admin/storage/objects', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsNewFolderOpen(false);
        setNewFolderName('');
        fetchObjects(selectedBucket, prefix);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Lỗi tạo folder');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Upload file ──────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !selectedBucket) return;

    const toUpload = Array.from(fileList);
    let successCount = 0;
    for (const file of toUpload) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', selectedBucket);
        fd.append('prefix', prefix);
        const res = await fetch('/api/admin/storage/objects', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          toast.error(`Lỗi upload "${file.name}": ${data.message}`);
        }
      } catch {
        toast.error(`Lỗi upload "${file.name}"`);
      }
    }
    if (successCount > 0) {
      toast.success(`Đã upload ${successCount} file`);
      fetchObjects(selectedBucket, prefix);
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  // ── Delete object / folder ───────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget || !selectedBucket) return;
    setActionLoading(true);
    try {
      const body = deleteTarget.key
        ? { bucket: selectedBucket, key: deleteTarget.key }
        : { bucket: selectedBucket, prefix: deleteTarget.prefix, isFolder: true };
      const res = await fetch('/api/admin/storage/objects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchObjects(selectedBucket, prefix);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Lỗi xóa');
    } finally {
      setActionLoading(false);
      setDeleteTarget(null);
    }
  };

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin')) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Quản lý lưu trữ MinIO"
        description="Quản lý bucket, folder và file trực tiếp trên MinIO"
        onRefresh={fetchBuckets}
        loading={loadingBuckets}
      />

      <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[500px]">
        {/* ── Sidebar: Bucket list ─────────────────────────────────────────── */}
        <div className="w-56 shrink-0 flex flex-col rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center justify-between p-3 border-b border-indigo-100">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Buckets</span>
            <button
              onClick={() => setIsNewBucketOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-xs font-medium transition-colors shadow-sm shadow-indigo-200"
              title="Tạo bucket mới"
            >
              <Plus className="h-3 w-3" /> Tạo
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {loadingBuckets ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : buckets.length === 0 ? (
              <p className="text-xs text-indigo-400 text-center py-6 px-3">Chưa có bucket nào</p>
            ) : (
              buckets.map(b => (
                <div
                  key={b.name}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                    selectedBucket === b.name ? 'bg-indigo-100/70 text-indigo-700' : 'hover:bg-indigo-50/50 text-indigo-700'
                  }`}
                  onClick={() => selectBucket(b.name)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <HardDrive className={`h-4 w-4 shrink-0 ${selectedBucket === b.name ? 'text-indigo-600' : 'text-indigo-400'}`} />
                    <span className="text-sm font-medium truncate">{b.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteBucket(b.name); }}
                    className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                    title="Xóa bucket"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Main content: File browser ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
          {!selectedBucket ? (
            <div className="flex-1 flex flex-col items-center justify-center text-indigo-400">
              <HardDrive className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm">Chọn một bucket để xem nội dung</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 p-3 border-b border-indigo-100 flex-wrap">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-hidden">
                  <button
                    onClick={() => { setSelectedBucket(''); setPrefix(''); }}
                    className="text-indigo-600 hover:underline shrink-0"
                  >
                    Buckets
                  </button>
                  <ChevronRight className="h-3 w-3 text-indigo-400 shrink-0" />
                  <button
                    onClick={() => navigateBreadcrumb(-1)}
                    className={`font-semibold shrink-0 ${prefix ? 'text-indigo-600 hover:underline' : 'text-indigo-800'}`}
                  >
                    {selectedBucket}
                  </button>
                  {breadcrumbParts.map((part, i) => (
                    <span key={i} className="flex items-center gap-1 min-w-0">
                      <ChevronRight className="h-3 w-3 text-indigo-400 shrink-0" />
                      <button
                        onClick={() => navigateBreadcrumb(i)}
                        className={`truncate ${i === breadcrumbParts.length - 1 ? 'text-indigo-800 font-semibold' : 'text-indigo-600 hover:underline'}`}
                      >
                        {part}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {prefix && (
                    <Button size="sm" variant="ghost" onClick={goUp} className="h-8 px-2 text-indigo-600 hover:bg-indigo-50">
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Lên
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setIsNewFolderOpen(true)} className="h-8 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                    <FolderPlus className="h-3.5 w-3.5 mr-1" />
                    Folder mới
                  </Button>
                  <Button size="sm" onClick={() => uploadInputRef.current?.click()} className="h-8 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    Upload
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => fetchObjects(selectedBucket, prefix)} className="h-8 px-2 text-indigo-600 hover:bg-indigo-50" disabled={loadingObjects}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingObjects ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto">
                {loadingObjects ? (
                  <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : folders.length === 0 && files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-indigo-400">
                    <Folder className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">Thư mục trống</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-indigo-50/70 text-xs text-indigo-600 uppercase tracking-wide sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Tên</th>
                        <th className="text-right px-4 py-2 font-medium w-24">Kích thước</th>
                        <th className="text-right px-4 py-2 font-medium w-40 hidden md:table-cell">Ngày sửa</th>
                        <th className="w-20 px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100">
                      {/* Folders */}
                      {folders.map(f => (
                        <tr key={f} className="hover:bg-indigo-50/50 cursor-pointer" onClick={() => openFolder(f)}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                              <span className="font-medium text-indigo-800">{folderLabel(f, prefix)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-indigo-400">—</td>
                          <td className="px-4 py-2.5 text-right text-indigo-400 hidden md:table-cell">—</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget({ prefix: f, label: folderLabel(f, prefix) }); }}
                              className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                              title="Xóa folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Files */}
                      {files.map(f => (
                        <tr key={f.name} className="hover:bg-indigo-50/50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {getFileIcon(f.name)}
                              <span className="truncate max-w-xs text-indigo-800">{shortName(f.name, prefix)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-indigo-500">{formatBytes(f.size)}</td>
                          <td className="px-4 py-2.5 text-right text-indigo-400 hidden md:table-cell text-xs">
                            {new Date(f.lastModified).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {f.url && (
                                <>
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors"
                                    title="Xem"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(f.url);
                                      toast.success('Đã sao chép URL ảnh');
                                    }}
                                    className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors"
                                    title="Sao chép URL MinIO"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <a
                                    href={f.url}
                                    download
                                    className="p-1 rounded hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 transition-colors"
                                    title="Tải xuống"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </a>
                                </>
                              )}
                              <button
                                onClick={() => setDeleteTarget({ key: f.name, label: shortName(f.name, prefix) })}
                                className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Status bar */}
              <div className="px-4 py-2 border-t border-indigo-100 bg-indigo-50/50 flex items-center justify-between text-xs text-indigo-500">
                <span>{folders.length} folder{folders.length !== 1 ? 's' : ''}, {files.length} file{files.length !== 1 ? 's' : ''}</span>
                {files.length > 0 && (
                  <span>Tổng: {formatBytes(files.reduce((a, f) => a + f.size, 0))}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Inline: Tạo bucket ─────────────────────────────────────────────── */}
      {isNewBucketOpen && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-indigo-900">Tạo bucket mới</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" onClick={() => { setIsNewBucketOpen(false); setNewBucketName(''); }}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-indigo-600 mb-3">Tên bucket chỉ dùng chữ thường, số và dấu gạch ngang (3-63 ký tự)</p>
            <Input
              value={newBucketName}
              onChange={e => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '-'))}
              placeholder="my-bucket"
              onKeyDown={e => e.key === 'Enter' && handleCreateBucket()}
              autoFocus
            />
            <Separator className="my-4 bg-indigo-100" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => { setIsNewBucketOpen(false); setNewBucketName(''); }}>Hủy</Button>
              <Button onClick={handleCreateBucket} disabled={actionLoading || newBucketName.length < 3} className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Tạo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline: Tạo folder ─────────────────────────────────────────────── */}
      {isNewFolderOpen && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-indigo-900">Tạo folder mới</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" onClick={() => { setIsNewFolderOpen(false); setNewFolderName(''); }}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-indigo-600 mb-3">
              Tạo trong: <strong className="text-indigo-900">{selectedBucket}{prefix ? `/${prefix}` : ''}</strong>
            </p>
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="tên-folder"
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
            <Separator className="my-4 bg-indigo-100" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => { setIsNewFolderOpen(false); setNewFolderName(''); }}>Hủy</Button>
              <Button onClick={handleCreateFolder} disabled={actionLoading || !newFolderName.trim()} className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderPlus className="h-4 w-4 mr-2" />}
                Tạo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline: Xóa bucket ─────────────────────────────────────────────── */}
      {deleteBucket && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-red-50/80 to-orange-50/80 shadow-lg shadow-red-100/50">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Xóa bucket
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteBucket(null)}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-red-600 mb-4">
              Xóa bucket <strong className="text-red-700">"{deleteBucket}"</strong> sẽ xóa toàn bộ file bên trong. Hành động này không thể hoàn tác.
            </p>
            <Separator className="my-4 bg-red-100" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeleteBucket(null)}>Hủy</Button>
              <Button variant="destructive" onClick={handleDeleteBucket} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Xóa hẳn
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline: Xóa file/folder ───────────────────────────────────────── */}
      {deleteTarget && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-red-50/80 to-orange-50/80 shadow-lg shadow-red-100/50">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {deleteTarget?.prefix ? 'Xóa folder' : 'Xóa file'}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(null)}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-red-600 mb-4">
              {deleteTarget?.prefix
                ? <>Xóa folder <strong className="text-red-700">"{deleteTarget.label}"</strong> và tất cả file bên trong?</>
                : <>Xóa file <strong className="text-red-700">"{deleteTarget?.label}"</strong>?</>
              }
              {' '}Hành động này không thể hoàn tác.
            </p>
            <Separator className="my-4 bg-red-100" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(null)}>Hủy</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Xóa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
