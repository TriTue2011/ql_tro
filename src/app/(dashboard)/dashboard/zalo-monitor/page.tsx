'use client';

import { useEffect, useRef, useState, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import {
  Copy, Trash2, Users, User, RefreshCw, Wifi, WifiOff,
  MessageSquare, Building2, DoorOpen, ChevronLeft, Bot,
  Send, Paperclip, Image as ImageIcon, X, FileText, Film, Loader2, HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomInfo {
  tenKhach: string;
  maPhong: string;
  tang: number;
  tenToaNha: string;
  diaChi: any;
}

interface ZaloMsg {
  id: string;
  chatId: string;
  ownId?: string | null;
  displayName: string | null;
  content: string;
  attachmentUrl: string | null;
  role: string;
  eventName: string | null;
  createdAt: string;
  rawPayload: any;
  roomInfo?: RoomInfo;
  botContent?: string | null;
  botCreatedAt?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getThreadId(msg: ZaloMsg): string {
  return (msg.rawPayload as any)?.threadId || msg.chatId;
}

function isGroup(msg: ZaloMsg): boolean {
  return (msg.rawPayload as any)?.type === 1;
}

function senderName(msg: ZaloMsg): string {
  const d = (msg.rawPayload as any)?.data;
  return d?.dName || d?.fromD || msg.displayName || 'Ẩn danh';
}

function formatTime(s: string) {
  const d = new Date(s);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Lấy msgType từ rawPayload (chat.photo, share.file, chat.video.msg, ...) */
function getMsgType(msg: ZaloMsg): string | null {
  return (msg.rawPayload as any)?.data?.msgType || null;
}

/** Trích xuất URL ảnh/file/video từ rawPayload hoặc attachmentUrl */
function getMediaUrl(msg: ZaloMsg): string | null {
  if (msg.attachmentUrl) return msg.attachmentUrl;
  const raw = (msg.rawPayload as any)?.data;
  if (!raw) return null;
  const c = raw.content;
  if (typeof c === 'object' && c) {
    return c.href || c.hdUrl || c.normalUrl || c.thumb || c.url || c.fileUrl || null;
  }
  return null;
}

/** Trích xuất tên file từ rawPayload */
function getFileName(msg: ZaloMsg): string | null {
  const raw = (msg.rawPayload as any)?.data;
  if (!raw) return null;
  const c = raw.content;
  if (typeof c === 'object' && c) {
    return c.title || c.fileName || null;
  }
  return null;
}

function isImageMsg(msg: ZaloMsg): boolean {
  const mt = getMsgType(msg);
  if (mt === 'chat.photo' || mt === 'chat.sticker') return true;
  const url = getMediaUrl(msg);
  if (url && /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i.test(url)) return true;
  return false;
}

function isVideoMsg(msg: ZaloMsg): boolean {
  const mt = getMsgType(msg);
  return mt === 'chat.video.msg' || mt === 'chat.gif';
}

function isFileMsg(msg: ZaloMsg): boolean {
  const mt = getMsgType(msg);
  return mt === 'share.file';
}

// ─── ConversationList ─────────────────────────────────────────────────────────

function ConversationList({
  convs, selectedId, onSelect, onDeleteAll, loading, onRefresh,
}: {
  convs: ZaloMsg[];
  selectedId: string | null;
  onSelect: (chatId: string) => void;
  onDeleteAll: () => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white shrink-0">
        <span className="flex-1 text-sm font-semibold text-gray-700">Hội thoại</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={onDeleteAll} title="Xóa tất cả">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {convs.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Chưa có tin nhắn nào.</p>
          </div>
        )}
        {convs.map(msg => {
          const tid = getThreadId(msg);
          const group = isGroup(msg);
          const name = senderName(msg);
          const selected = selectedId === msg.chatId;
          const preview = isImageMsg(msg) ? '📷 Hình ảnh' : isFileMsg(msg) ? '📎 File' : isVideoMsg(msg) ? '🎥 Video' : msg.content;
          return (
            <button key={msg.chatId} type="button"
              className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${selected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
              onClick={() => onSelect(msg.chatId)}>
              <div className="flex items-start gap-2.5">
                <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${group ? 'bg-purple-100' : 'bg-blue-100'}`}>
                  {group ? <Users className="h-4 w-4 text-purple-600" /> : <User className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatTime(msg.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {msg.role === 'bot' ? '🤖 ' : ''}{preview}
                  </p>
                  {msg.roomInfo && (
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1 border-green-300 text-green-700">
                        <DoorOpen className="h-2.5 w-2.5 mr-0.5" />{msg.roomInfo.maPhong}
                      </Badge>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono truncate">ID: {tid}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg, onDelete }: { msg: ZaloMsg; onDelete: (id: string) => void }) {
  const isBot = msg.role === 'bot';
  const mediaUrl = getMediaUrl(msg);
  const image = isImageMsg(msg);
  const video = isVideoMsg(msg);
  const file = isFileMsg(msg);
  const fileName = getFileName(msg);
  const hasTextContent = msg.content && msg.content !== '[hình ảnh]' && msg.content !== '[đính kèm]' && msg.content !== '[media]';

  return (
    <div className={`flex items-end gap-1.5 group ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* avatar */}
      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${isBot ? 'bg-gray-200' : 'bg-blue-100'}`}>
        {isBot ? <Bot className="h-3.5 w-3.5 text-gray-500" /> : <User className="h-3.5 w-3.5 text-blue-600" />}
      </div>

      {/* bubble */}
      <div className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm relative ${
        isBot ? 'bg-gray-100 text-gray-800 rounded-bl-sm' : 'bg-blue-500 text-white rounded-br-sm'
      }`}>
        {/* Ảnh */}
        {image && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl} alt="" className="rounded-lg max-h-64 max-w-full object-contain cursor-pointer hover:opacity-90 transition"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </a>
        )}

        {/* Video */}
        {video && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 mb-1 p-2 bg-black/10 rounded-lg hover:bg-black/20 transition">
            <Film className="h-5 w-5 shrink-0" />
            <span className="text-xs truncate">{fileName || 'Video'}</span>
          </a>
        )}

        {/* File */}
        {file && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-2 mb-1 p-2 rounded-lg transition ${
              isBot ? 'bg-white/60 hover:bg-white/80' : 'bg-white/20 hover:bg-white/30'
            }`}>
            <FileText className="h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-medium truncate block">{fileName || 'File'}</span>
              <span className="text-[10px] opacity-70">Nhấn để tải</span>
            </div>
          </a>
        )}

        {/* Ảnh không phải image/video/file nhưng có attachmentUrl */}
        {!image && !video && !file && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl} alt="" className="rounded-lg max-h-48 max-w-full mb-1 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </a>
        )}

        {/* Text */}
        {hasTextContent && (
          <span className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</span>
        )}

        <span className={`block text-[10px] mt-0.5 ${isBot ? 'text-gray-400' : 'text-blue-100'}`}>
          {formatTime(msg.createdAt)}
        </span>
      </div>

      {/* delete */}
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 mb-1 shrink-0"
        onClick={() => onDelete(msg.id)}
        title="Xóa tin nhắn này">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── ChatInput ──────────────────────────────────────────────────────────────

interface MinioFile { name: string; size: number; url: string; }

function MinioPickerModal({ onPick, onClose }: { onPick: (url: string, name: string) => void; onClose: () => void }) {
  const [files, setFiles] = useState<MinioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/minio/files?prefix=${encodeURIComponent(prefix)}&limit=50`)
      .then(r => r.json())
      .then(d => setFiles(d.files ?? []))
      .catch(() => toast.error('Lỗi tải danh sách MinIO'))
      .finally(() => setLoading(false));
  }, [prefix]);

  const isImage = (n: string) => /\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i.test(n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Chọn file từ MinIO</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 py-2 border-b">
          <input
            type="text" placeholder="Tìm theo prefix..." value={prefix}
            onChange={e => setPrefix(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && <div className="text-center py-8 text-gray-400 text-sm">Đang tải...</div>}
          {!loading && files.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">Không có file</div>}
          {files.map(f => (
            <button key={f.name} onClick={() => onPick(f.url, f.name.split('/').pop() || f.name)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 transition text-left">
              {isImage(f.name) ? <ImageIcon className="h-4 w-4 text-green-500 shrink-0" /> : <FileText className="h-4 w-4 text-blue-500 shrink-0" />}
              <span className="text-xs truncate flex-1">{f.name}</span>
              <span className="text-[10px] text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatInput({ chatId, threadType, onSent }: {
  chatId: string;
  threadType: 0 | 1;
  onSent: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; preview?: string; type: 'image' | 'file' } | null>(null);
  const [minioUrl, setMinioUrl] = useState<{ url: string; name: string } | null>(null);
  const [showMinioPicker, setShowMinioPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('File quá lớn (tối đa 25MB)'); return; }

    const preview = type === 'image' ? URL.createObjectURL(file) : undefined;
    setAttachment({ file, preview, type });
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
    setMinioUrl(null);
  };

  const uploadFile = async (file: File, fileType: 'image' | 'file'): Promise<string | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', fileType);
      formData.append('folder', 'zalo-monitor');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.data?.secure_url) return data.data.secure_url;
      toast.error(data.message || data.error || 'Upload thất bại');
      return null;
    } catch {
      toast.error('Lỗi upload file');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !attachment && !minioUrl) return;

    setSending(true);
    try {
      let imageUrl: string | undefined;
      let fileUrl: string | undefined;

      // MinIO file already has URL
      if (minioUrl) {
        const isImg = /\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i.test(minioUrl.name);
        if (isImg) imageUrl = minioUrl.url;
        else fileUrl = minioUrl.url;
      } else if (attachment) {
        const url = await uploadFile(attachment.file, attachment.type);
        if (!url) { setSending(false); return; }
        if (attachment.type === 'image') imageUrl = url;
        else fileUrl = url;
      }

      const body: Record<string, any> = {
        chatId,
        threadType,
      };
      if (trimmed) body.message = trimmed;
      if (imageUrl) body.imageUrl = imageUrl;
      if (fileUrl) body.fileUrl = fileUrl;

      const res = await fetch('/api/gui-zalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setText('');
        removeAttachment();
        onSent();
      } else {
        toast.error(data.message || data.error || 'Gửi tin nhắn thất bại');
      }
    } catch {
      toast.error('Lỗi gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [text]);

  return (
    <div className="border-t bg-white shrink-0">
      {/* Attachment preview */}
      {(attachment || minioUrl) && (
        <div className="px-3 pt-2 flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 max-w-[300px]">
            {attachment?.type === 'image' && attachment.preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={attachment.preview} alt="" className="h-10 w-10 object-cover rounded" />
            ) : minioUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(minioUrl.name) ? (
              <ImageIcon className="h-4 w-4 shrink-0 text-green-500" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-blue-500" />
            )}
            <span className="truncate">{attachment?.file.name || minioUrl?.name}</span>
            {minioUrl && <Badge variant="outline" className="text-[9px] px-1 shrink-0">MinIO</Badge>}
            <button onClick={removeAttachment} className="shrink-0 text-gray-400 hover:text-red-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MinIO picker modal */}
      {showMinioPicker && (
        <MinioPickerModal
          onPick={(url, name) => {
            setAttachment(null);
            setMinioUrl({ url, name });
            setShowMinioPicker(false);
          }}
          onClose={() => setShowMinioPicker(false)}
        />
      )}

      {/* Input row */}
      <div className="flex items-end gap-1.5 px-3 py-2">
        {/* Attachment buttons */}
        <div className="flex gap-0.5 shrink-0 mb-0.5">
          <button onClick={() => imageInputRef.current?.click()}
            className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition"
            title="Gửi ảnh" disabled={sending}>
            <ImageIcon className="h-4.5 w-4.5" />
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition"
            title="Đính kèm file" disabled={sending}>
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          <button onClick={() => setShowMinioPicker(true)}
            className="p-1.5 rounded-full text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition"
            title="Chọn từ MinIO" disabled={sending}>
            <HardDrive className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          rows={1}
          disabled={sending}
          className="flex-1 resize-none border rounded-2xl px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 placeholder:text-gray-400 disabled:opacity-50 max-h-[120px]"
        />

        {/* Send button */}
        <Button size="icon" onClick={handleSend}
          disabled={sending || uploading || (!text.trim() && !attachment && !minioUrl)}
          className="h-9 w-9 rounded-full bg-blue-500 hover:bg-blue-600 shrink-0 mb-0.5">
          {sending || uploading
            ? <Loader2 className="h-4 w-4 animate-spin text-white" />
            : <Send className="h-4 w-4 text-white" />}
        </Button>
      </div>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleFileChange(e, 'image')} />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif,.webp" className="hidden"
        onChange={e => handleFileChange(e, 'file')} />
    </div>
  );
}

// ─── MessageThread ────────────────────────────────────────────────────────────

function MessageThread({
  chatId, onBack, onDeleted,
}: {
  chatId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [msgs, setMsgs] = useState<ZaloMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    try {
      const url = `/api/zalo/messages?chatId=${encodeURIComponent(chatId)}&limit=50${before ? `&before=${before}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      const batch: ZaloMsg[] = data.data ?? [];
      if (before) {
        setMsgs(prev => [...batch, ...prev]);
      } else {
        setMsgs(batch);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      setHasMore(batch.length === 50);
    } finally { setLoading(false); }
  }, [chatId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeEvents(['zalo-message'], () => { void load(); });

  async function handleDelete(id: string) {
    await fetch(`/api/zalo/messages?id=${id}`, { method: 'DELETE' });
    setMsgs(prev => prev.filter(m => m.id !== id));
    onDeleted();
  }

  async function handleDeleteAll() {
    if (!confirm('Xóa toàn bộ lịch sử của hội thoại này?')) return;
    await fetch(`/api/zalo/messages?chatId=${encodeURIComponent(chatId)}`, { method: 'DELETE' });
    setMsgs([]);
    onDeleted();
    onBack();
    toast.success('Đã xóa');
  }

  const info = msgs.find(m => m.roomInfo)?.roomInfo;
  const name = msgs.length ? senderName(msgs[0]) : chatId;
  const tid = msgs.length ? getThreadId(msgs[0]) : chatId;
  const threadType: 0 | 1 = msgs.length && isGroup(msgs[0]) ? 1 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7 md:hidden" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 truncate">{name}</span>
            {info && (
              <Badge variant="outline" className="text-[10px] px-1.5 border-green-300 text-green-700 bg-green-50 shrink-0">
                <DoorOpen className="h-2.5 w-2.5 mr-0.5" />{info.maPhong}
              </Badge>
            )}
            {info && (
              <Badge variant="outline" className="text-[10px] px-1.5 border-orange-300 text-orange-700 bg-orange-50 shrink-0">
                <Building2 className="h-2.5 w-2.5 mr-0.5" />{info.tenToaNha}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-gray-400 font-mono">ID: {tid}</span>
            <button onClick={() => { navigator.clipboard.writeText(tid); toast.success('Đã sao chép'); }}
              className="text-gray-300 hover:text-blue-500">
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={handleDeleteAll} title="Xóa hội thoại">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {hasMore && (
          <div className="text-center pb-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => load(msgs[0]?.createdAt)} disabled={loading}>
              {loading ? 'Đang tải...' : 'Tải thêm'}
            </Button>
          </div>
        )}

        {msgs.map((msg, i) => {
          const showDateSep = i === 0 || new Date(msg.createdAt).toDateString() !== new Date(msgs[i - 1].createdAt).toDateString();
          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="text-center text-[10px] text-gray-400 py-2">
                  {new Date(msg.createdAt).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              )}
              <MessageBubble msg={msg} onDelete={handleDelete} />
            </div>
          );
        })}

        {msgs.length === 0 && !loading && (
          <div className="text-center text-gray-400 text-sm py-12">Chưa có tin nhắn.</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Chat input */}
      <ChatInput
        chatId={chatId}
        threadType={threadType}
        onSent={() => {
          setTimeout(() => {
            load();
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZaloMonitorPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const [convs, setConvs] = useState<ZaloMsg[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const loadConvs = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch('/api/zalo/messages?conversations=1');
      const data = await res.json();
      if (data.data) setConvs(data.data);
    } catch { /* ignore */ } finally { setLoadingConvs(false); }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/zalo-direct');
      if (res.ok) {
        const data = await res.json();
        const directOnline = data.directStatus?.loggedInCount > 0;
        const botOnline = data.botAccounts?.some((a: any) => a.isOnline || a.isConnected);
        setConnected(directOnline || botOnline);
      }
    } catch { setConnected(false); }
  }, []);

  useEffect(() => { loadConvs(); checkConnection(); }, [loadConvs, checkConnection]);
  useRealtimeEvents(['zalo-message'], () => { void loadConvs(); });

  async function handleDeleteAll() {
    if (!confirm('Xóa tất cả tin nhắn?')) return;
    await fetch('/api/zalo/messages', { method: 'DELETE' });
    setConvs([]);
    setSelectedChatId(null);
    toast.success('Đã xóa tất cả');
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Theo dõi tin nhắn Zalo</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isAdmin ? 'Xem và trả lời tin nhắn của tất cả tài khoản' : 'Xem và trả lời tin nhắn Zalo của bạn'}
          </p>
        </div>
        {connected === null ? (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-500">
            <RefreshCw className="h-3 w-3 animate-spin" /> Đang kiểm tra...
          </div>
        ) : connected ? (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-green-50 border-green-200 text-green-700">
            <Wifi className="h-3 w-3" /> Đang kết nối
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-red-50 border-red-200 text-red-600">
            <WifiOff className="h-3 w-3" /> Mất kết nối
          </div>
        )}
      </div>

      {/* 2-column layout */}
      <div className="flex flex-1 overflow-hidden rounded-xl border bg-white shadow-sm">
        {/* Left — conversation list */}
        <div className={`w-full md:w-72 lg:w-80 border-r shrink-0 ${selectedChatId ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
          <ConversationList
            convs={convs}
            selectedId={selectedChatId}
            onSelect={setSelectedChatId}
            onDeleteAll={handleDeleteAll}
            loading={loadingConvs}
            onRefresh={loadConvs}
          />
        </div>

        {/* Right — message thread */}
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedChatId ? 'flex' : 'hidden md:flex'}`}>
          {selectedChatId ? (
            <MessageThread
              key={selectedChatId}
              chatId={selectedChatId}
              onBack={() => setSelectedChatId(null)}
              onDeleted={loadConvs}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Chọn một hội thoại để xem lịch sử tin nhắn</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
