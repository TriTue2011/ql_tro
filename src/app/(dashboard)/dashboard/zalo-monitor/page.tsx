'use client';

import { useEffect, useRef, useState, useCallback, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import {
  Copy, Trash2, Users, User, RefreshCw, Wifi, WifiOff,
  MessageSquare, Building2, DoorOpen, ChevronLeft, Bot,
  Send, Paperclip, Image as ImageIcon, X, FileText, Film, Loader2, HardDrive,
  ChevronDown, ChevronRight, Phone, BookUser, Pencil, Check,
  Settings, Plus, Shield, ShieldOff,
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
  const payload = msg.rawPayload as any;
  return !!payload?.threadId || payload?.type === 1 || payload?.type === '1';
}

function senderName(msg: ZaloMsg): string {
  // Groups: displayName = group name; DMs: rawPayload.data.dName = sender name
  if (isGroup(msg)) return msg.displayName || getThreadId(msg);
  const d = (msg.rawPayload as any)?.data;
  return d?.dName || d?.fromD || msg.displayName || 'Ẩn danh';
}

function msgSenderInGroup(msg: ZaloMsg): string {
  const d = (msg.rawPayload as any)?.data;
  return d?.dName || d?.fromD || '';
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

/** Chuyển presigned MinIO URL → proxy URL (không hết hạn) */
function toDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    if (parsed.searchParams.has('X-Amz-Credential')) {
      const pathParts = parsed.pathname.replace(/^\//, '').split('/');
      if (pathParts.length >= 2) return `/api/files/${pathParts.join('/')}`;
    }
  } catch { /* ignore */ }
  return url;
}

/** Parse content nếu là JSON string (tin nhắn cũ lưu raw JSON thay vì object) */
function parseContentObj(msg: ZaloMsg): any | null {
  const raw = (msg.rawPayload as any)?.data;
  if (raw && typeof raw.content === 'object' && raw.content) return raw.content;
  const s = msg.content;
  if (typeof s === 'string' && s.trim().startsWith('{') && s.trim().endsWith('}')) {
    try { return JSON.parse(s); } catch { /* ignore */ }
  }
  return null;
}

/** Trích xuất URL ảnh/file/video từ rawPayload hoặc attachmentUrl */
function getMediaUrl(msg: ZaloMsg): string | null {
  if (msg.attachmentUrl) return toDisplayUrl(msg.attachmentUrl);
  const c = parseContentObj(msg);
  if (c) {
    const url = c.href || c.hdUrl || c.normalUrl || c.thumb || c.url || c.fileUrl || null;
    return url ? toDisplayUrl(url) : null;
  }
  return null;
}

/** Trích xuất tên file từ rawPayload hoặc URL */
function getFileName(msg: ZaloMsg): string | null {
  const c = parseContentObj(msg);
  if (c) return c.title || c.fileName || null;
  const url = msg.attachmentUrl;
  if (url) {
    try {
      const pathname = new URL(url, 'http://x').pathname;
      const name = pathname.split('/').pop();
      if (name && name.includes('.')) {
        return name.replace(/^\d{13,}-[a-f0-9]+-/, '').replace(/^\d{13,}-/, '') || name;
      }
    } catch { /* ignore */ }
  }
  return null;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i;
const VIDEO_EXT_RE = /\.(mp4|avi|mov|webm|mkv)(\?|$)/i;
const FILE_EXT_RE = /\.(pdf|docx?|xlsx?|csv|txt|zip|rar|pptx?|odt|ods|7z|gz|tar)(\?|$)/i;

function isImageMsg(msg: ZaloMsg): boolean {
  const mt = getMsgType(msg);
  if (mt === 'chat.photo' || mt === 'chat.sticker' || mt === 'chat.gif') return true;
  if (msg.content === '[hình ảnh]' || msg.content === '[sticker]') {
    const url = getMediaUrl(msg);
    if (url) return true;
  }
  const url = getMediaUrl(msg);
  if (url && IMAGE_EXT_RE.test(url)) return true;
  // Tin nhắn cũ: content là JSON string có trường ảnh
  const c = parseContentObj(msg);
  if (c && (c.href || c.hdUrl || c.normalUrl || c.thumb)) {
    const mediaUrl = c.href || c.hdUrl || c.normalUrl || c.thumb;
    if (typeof mediaUrl === 'string' && (IMAGE_EXT_RE.test(mediaUrl) || c.jxl || c.hd)) return true;
  }
  return false;
}

/** Check nếu tin nhắn là reaction (emoji phản ứng) */
function isReactionMsg(msg: ZaloMsg): boolean {
  const mt = getMsgType(msg);
  if (mt === 'reaction') return true;
  return typeof msg.content === 'string' && msg.content.startsWith('[reaction:');
}

/** Check nếu content là raw JSON (không nên hiển thị dạng text) */
function isRawJsonContent(content: string): boolean {
  if (typeof content !== 'string') return false;
  const t = content.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}

function isVideoMsg(msg: ZaloMsg): boolean {
  const mt = getMsgType(msg);
  if (mt === 'chat.video.msg') return true;
  const url = getMediaUrl(msg);
  if (url && VIDEO_EXT_RE.test(url)) return true;
  return false;
}

function isFileMsg(msg: ZaloMsg): boolean {
  const mt = getMsgType(msg);
  if (mt === 'share.file') return true;
  const url = getMediaUrl(msg);
  if (!url) return false;
  // Explicit file extension match
  if (FILE_EXT_RE.test(url)) return true;
  // Has attachmentUrl but not an image or video → treat as file
  if (msg.attachmentUrl && !IMAGE_EXT_RE.test(url) && !VIDEO_EXT_RE.test(url)) return true;
  return false;
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
          const previewText = isImageMsg(msg) ? '📷 Hình ảnh'
            : isFileMsg(msg) ? '📎 File'
            : isVideoMsg(msg) ? '🎥 Video'
            : isReactionMsg(msg) ? '😊 Reaction'
            : isRawJsonContent(msg.content) ? '📷 Hình ảnh'
            : msg.content;
          const groupSender = group ? msgSenderInGroup(msg) : '';
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
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                      {group && <span className="text-[10px] text-purple-500 shrink-0 bg-purple-50 px-1 rounded">Nhóm</span>}
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatTime(msg.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {msg.role === 'bot' ? '🤖 ' : groupSender ? <><span className="font-medium">{groupSender}:</span> </> : ''}{previewText}
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

function msgSenderUid(msg: ZaloMsg): string {
  const d = (msg.rawPayload as any)?.data;
  return d?.uidFrom ? String(d.uidFrom) : '';
}

function MessageBubble({ msg, onDelete }: { msg: ZaloMsg; onDelete: (id: string) => void }) {
  const isBot = msg.role === 'bot';
  const isOwner = msg.role === 'owner';
  // outgoing = tin nhắn CỦA TA (bot auto-reply hoặc chủ tài khoản gửi)
  // incoming = tin nhắn CỦA KHÁCH (tenant gửi vào)
  const isOutgoing = isBot || isOwner;
  const group = isGroup(msg);
  const groupSender = group && !isOutgoing ? msgSenderInGroup(msg) : '';
  const groupSenderUid = group && !isOutgoing ? msgSenderUid(msg) : '';
  const mediaUrl = getMediaUrl(msg);
  const image = isImageMsg(msg);
  const video = isVideoMsg(msg);
  const file = isFileMsg(msg);
  const fileName = getFileName(msg);
  const hasTextContent = msg.content
    && msg.content !== '[hình ảnh]' && msg.content !== '[đính kèm]' && msg.content !== '[media]'
    && msg.content !== '[sticker]' && msg.content !== '[video]'
    && !isRawJsonContent(msg.content)
    && !(typeof msg.content === 'string' && msg.content.startsWith('[reaction:'));

  // Màu bubble:
  // - Bot auto-reply (outgoing)  → xanh lam  (bg-blue-500)
  // - Owner gửi tay (outgoing)   → tím indigo (bg-indigo-500)
  // - Khách thuê (incoming)      → xám       (bg-gray-100)
  const bubbleColor = isOwner
    ? 'bg-indigo-500 text-white rounded-br-sm'
    : isBot
      ? 'bg-blue-500 text-white rounded-br-sm'
      : 'bg-gray-100 text-gray-800 rounded-bl-sm';

  const timestampColor = isOutgoing ? 'text-white/70' : 'text-gray-400';
  const fallbackTextColor = isOutgoing ? 'text-white/70' : 'text-gray-500';
  const mediaOverlayColor = isOutgoing ? 'bg-white/20 hover:bg-white/30' : 'bg-black/5 hover:bg-black/10';

  return (
    <div className={`flex items-end gap-1.5 group ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* avatar */}
      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${
        isOwner ? 'bg-indigo-100' : isBot ? 'bg-blue-100' : group ? 'bg-purple-100' : 'bg-gray-200'
      }`}>
        {isOwner ? <Shield className="h-3.5 w-3.5 text-indigo-600" />
         : isBot  ? <Bot className="h-3.5 w-3.5 text-blue-500" />
         : group  ? <Users className="h-3.5 w-3.5 text-purple-600" />
                  : <User className="h-3.5 w-3.5 text-gray-500" />}
      </div>

      {/* bubble wrapper */}
      <div className={`flex flex-col max-w-[72%] ${isOutgoing ? 'items-end' : 'items-start'}`}>
        {groupSender && (
          <div className={`flex flex-col mb-0.5 px-1 ${isOutgoing ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-purple-600 font-medium">{groupSender}</span>
            {groupSenderUid && (
              <span className="text-[9px] text-gray-400 font-mono">{groupSenderUid}</span>
            )}
          </div>
        )}
        {/* label nhỏ phân biệt bot vs owner */}
        {isOutgoing && (
          <span className={`text-[9px] mb-0.5 px-1 ${isOwner ? 'text-indigo-400' : 'text-blue-400'}`}>
            {isOwner ? '🛡️ Bạn' : '🤖 Bot'}
          </span>
        )}
        <div className={`rounded-2xl px-3 py-2 text-sm relative ${bubbleColor}`}>
          {/* Ảnh */}
          {image && mediaUrl && (
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt="" className="rounded-lg max-h-64 max-w-full object-contain cursor-pointer hover:opacity-90 transition"
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const fallback = img.parentElement?.parentElement?.querySelector('.img-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'inline-block';
                }} />
            </a>
          )}
          {image && mediaUrl && (
            <span className={`img-fallback text-xs italic ${fallbackTextColor}`} style={{ display: 'none' }}>
              📷 Hình ảnh (đã hết hạn, click để mở)
            </span>
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
              className={`flex items-center gap-2 mb-1 p-2 rounded-lg transition ${mediaOverlayColor}`}>
              <FileText className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-medium truncate block">{fileName || 'File'}</span>
                <span className="text-[10px] opacity-70">Nhấn để tải</span>
              </div>
            </a>
          )}

          {/* Đính kèm không xác định loại */}
          {!image && !video && !file && mediaUrl && (
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 mb-1 p-2 rounded-lg transition ${mediaOverlayColor}`}>
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="text-xs truncate">{fileName || 'Đính kèm'}</span>
            </a>
          )}

          {/* Text */}
          {hasTextContent && (
            <span className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</span>
          )}

          {/* Fallback */}
          {!hasTextContent && !image && !video && !file && !mediaUrl && (
            <span className={`text-xs italic ${fallbackTextColor}`}>
              {msg.content === '[hình ảnh]' || (typeof msg.content === 'string' && msg.content.startsWith('{'))
                ? '📷 Hình ảnh (không tải được)'
                : msg.content === '[sticker]' ? '🎨 Sticker'
                : msg.content === '[đính kèm]' ? '📎 Đính kèm'
                : msg.content === '[video]' ? '🎥 Video'
                : '(nội dung không hiển thị được)'}
            </span>
          )}

          <span className={`block text-[10px] mt-0.5 ${timestampColor}`}>
            {formatTime(msg.createdAt)}
          </span>
        </div>
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
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40" onClick={onClose}>
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
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [customGroupName, setCustomGroupName] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    try {
      const url = `/api/zalo/messages?chatId=${encodeURIComponent(chatId)}&limit=50${before ? `&before=${before}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
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
  // Safety net: poll mỗi 30s phòng SSE mất kết nối (SSE vẫn là real-time chính)
  useEffect(() => {
    const timer = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

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

  async function handleRename() {
    const trimmed = renameVal.trim();
    if (!trimmed) return;
    const res = await fetch('/api/zalo/group-name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: chatId, name: trimmed }),
    });
    if (res.ok) {
      setCustomGroupName(trimmed);
      setMsgs(prev => prev.map(m => ({ ...m, displayName: trimmed })));
      toast.success('Đã đặt tên nhóm');
    } else {
      toast.error('Lỗi đặt tên nhóm');
    }
    setRenaming(false);
  }

  const info = msgs.find(m => m.roomInfo)?.roomInfo;
  const firstMsg = msgs.length ? msgs[0] : null;
  const group = firstMsg ? isGroup(firstMsg) : false;
  const resolvedName = customGroupName || (firstMsg ? senderName(firstMsg) : chatId);
  const tid = firstMsg ? getThreadId(firstMsg) : chatId;
  const threadType: 0 | 1 = group ? 1 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7 md:hidden" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {/* Group rename input */}
          {renaming ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
                className="text-sm border rounded-lg px-2 py-0.5 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-purple-400"
                placeholder="Tên nhóm..."
              />
              <button onClick={handleRename} className="text-green-500 hover:text-green-600 shrink-0">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setRenaming(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800 truncate">{resolvedName}</span>
              {group && (
                <Badge variant="outline" className="text-[10px] px-1.5 border-purple-300 text-purple-700 bg-purple-50 shrink-0">
                  <Users className="h-2.5 w-2.5 mr-0.5" />Nhóm
                </Badge>
              )}
              {group && (
                <button onClick={() => { setRenameVal(resolvedName); setRenaming(true); }}
                  className="text-gray-300 hover:text-purple-500 shrink-0" title="Đặt tên nhóm">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
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
          )}
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

        {msgs.filter(m => !isReactionMsg(m)).map((msg, i, arr) => {
          const showDateSep = i === 0 || new Date(msg.createdAt).toDateString() !== new Date(arr[i - 1].createdAt).toDateString();
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
          // Reload ngay + retry sau 600ms để đảm bảo DB đã ghi xong
          load().then(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
          setTimeout(() => {
            load().then(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
          }, 600);
        }}
      />
    </div>
  );
}

// ─── Compact Contact Directory ───────────────────────────────────────────────

interface CompactContact {
  id: string;
  ten: string;
  soDienThoai: string | null;
  threadId: string | null;
  vaiTro?: string;
  phong?: string;
  tang?: number;
}


function CompactContactDir({ onSelectThread }: { onSelectThread: (threadId: string) => void }) {
  const { data: session } = useSession();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [externalContacts, setExternalContacts] = useState<CompactContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [botAccountId, setBotAccountId] = useState<string | null>(null);

  const currentUserId = session?.user?.id;

  // Lấy zaloAccountId từ profile
  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then(d => {
      if (d.zaloAccountId) setBotAccountId(d.zaloAccountId);
    }).catch(() => {});
  }, []);

  const loadExternal = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/zalo/danh-ba-ngoai');
      const data = await res.json();
      if (data.ok) setExternalContacts(data.contacts.map((c: any) => ({
        id: c.id, ten: c.ten, soDienThoai: c.soDienThoai || null, threadId: c.threadId || null,
      })));
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      function resolveThreadId(person: any): string | null {
        if (botAccountId && Array.isArray(person.zaloChatIds)) {
          const entry = person.zaloChatIds.find((e: any) => e.ten === botAccountId);
          if (entry?.threadId) return entry.threadId;
        }
        return person.zaloChatId || null;
      }

      const res = await fetch('/api/admin/zalo');
      const data = await res.json();
      if (!data.ok) return;

      const result: any[] = [];
      for (const b of data.buildings || []) {
        const allPeople = [b.chuTro, ...(b.quanLys || [])];
        const seen = new Set<string>();
        const unique = allPeople.filter((p: any) => {
          if (!p || seen.has(p.id)) return false;
          seen.add(p.id);
          return p.vaiTro !== 'admin' && p.id !== currentUserId;
        });

        const mapPerson = (p: any) => ({ id: p.id, ten: p.ten, soDienThoai: p.soDienThoai, threadId: resolveThreadId(p), vaiTro: p.vaiTro });
        const chuNha = unique.filter((p: any) => p.vaiTro === 'chuNha').map(mapPerson);
        const dongChuTro = unique.filter((p: any) => p.vaiTro === 'dongChuTro').map(mapPerson);
        const quanLy = unique.filter((p: any) => p.vaiTro === 'quanLy').map(mapPerson);
        const nhanVien = unique.filter((p: any) => p.vaiTro === 'nhanVien').map(mapPerson);

        let khachThue: CompactContact[] = [];
        try {
          const botParam = botAccountId ? `&botAccountId=${encodeURIComponent(botAccountId)}` : '';
          const ktRes = await fetch(`/api/admin/zalo/khach-thue?toaNhaId=${b.id}${botParam}`);
          const ktData = await ktRes.json();
          if (ktData.ok) {
            khachThue = (ktData.khachThues || []).map((kt: any) => ({
              id: kt.id, ten: kt.hoTen, soDienThoai: kt.soDienThoai, threadId: kt.zaloChatId,
              phong: kt.phong?.maPhong, tang: kt.phong?.tang,
            }));
          }
        } catch { /* ignore */ }

        result.push({ id: b.id, tenToaNha: b.tenToaNha, chuNha, dongChuTro, quanLy, nhanVien, khachThue });
      }
      setBuildings(result);
    } catch { /* ignore */ }
    finally { setLoading(false); setLoaded(true); }
  }, [currentUserId, botAccountId]);

  useEffect(() => { if (!loaded) { load(); loadExternal(); } }, [loaded, load, loadExternal]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white shrink-0">
        <BookUser className="h-4 w-4 text-blue-500" />
        <span className="flex-1 text-sm font-semibold text-gray-700">Danh bạ</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && !loaded && (
          <div className="p-8 text-center text-gray-400 text-xs">Đang tải...</div>
        )}
        {loaded && buildings.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-xs">Chưa có dữ liệu</div>
        )}

        {buildings.map(b => (
          <div key={b.id} className="border-b last:border-0">
            {b.chuNha?.length > 0 && (
              <CompactRoleSection label="Chủ nhà" people={b.chuNha} onSelectThread={onSelectThread} />
            )}
            {b.dongChuTro?.length > 0 && (
              <CompactRoleSection label="Đồng chủ trọ" people={b.dongChuTro} onSelectThread={onSelectThread} />
            )}
            {b.quanLy?.length > 0 && (
              <CompactRoleSection label="Quản lý" people={b.quanLy} onSelectThread={onSelectThread} />
            )}
            {b.nhanVien?.length > 0 && (
              <CompactRoleSection label="Nhân viên" people={b.nhanVien} onSelectThread={onSelectThread} />
            )}
            {b.khachThue?.length > 0 && (
              <CompactTenantSection tenants={b.khachThue} onSelectThread={onSelectThread} />
            )}
          </div>
        ))}

        {/* Liên hệ khác */}
        {externalContacts.length > 0 && (
          <div className="border-b last:border-0">
            <CompactRoleSection label="Liên hệ khác" people={externalContacts} onSelectThread={onSelectThread} />
          </div>
        )}
      </div>
    </div>
  );
}

function CompactRoleSection({ label, people, onSelectThread }: {
  label: string;
  people: CompactContact[];
  onSelectThread: (threadId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 transition-colors">
        <span className="text-[11px] font-semibold text-gray-600">{label}</span>
        <span className="text-[10px] text-gray-400">({people.length})</span>
        <span className="flex-1" />
        {open ? <ChevronDown className="h-3 w-3 text-gray-300" /> : <ChevronRight className="h-3 w-3 text-gray-300" />}
      </button>
      {open && (
        <div className="px-1.5 pb-1.5">
          {people.map(p => (
            <CompactPersonItem key={p.id} person={p} onSelectThread={onSelectThread} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompactTenantSection({ tenants, onSelectThread }: {
  tenants: CompactContact[];
  onSelectThread: (threadId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const floors = tenants.reduce<Record<number, CompactContact[]>>((acc, t) => {
    const f = t.tang ?? 0;
    (acc[f] ||= []).push(t);
    return acc;
  }, {});
  const sortedFloors = Object.keys(floors).map(Number).sort((a, b) => a - b);

  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 transition-colors">
        <User className="h-3 w-3 text-green-500" />
        <span className="text-[11px] font-semibold text-gray-600">Khách thuê</span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-green-50 text-green-700">{tenants.length}</Badge>
        <span className="flex-1" />
        {open ? <ChevronDown className="h-3 w-3 text-gray-300" /> : <ChevronRight className="h-3 w-3 text-gray-300" />}
      </button>
      {open && (
        <div className="px-1.5 pb-1.5">
          {sortedFloors.map(f => (
            <CompactFloorGroup key={f} tang={f} tenants={floors[f]} onSelectThread={onSelectThread} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompactFloorGroup({ tang, tenants, onSelectThread }: {
  tang: number; tenants: CompactContact[];
  onSelectThread: (threadId: string) => void;
}) {
  return (
    <div className="ml-2">
      <div className="text-[10px] text-gray-400 font-medium px-2 py-0.5">Tầng {tang}</div>
      {tenants.map(t => (
        <CompactPersonItem key={t.id} person={t} showRoom onSelectThread={onSelectThread} />
      ))}
    </div>
  );
}

function CompactPersonItem({ person, showRoom, onSelectThread }: {
  person: CompactContact; showRoom?: boolean;
  onSelectThread: (threadId: string) => void;
}) {
  const hasThread = !!person.threadId;
  return (
    <button
      type="button"
      disabled={!hasThread}
      onClick={() => hasThread && onSelectThread(person.threadId!)}
      className={`w-full text-left rounded-md px-2 py-1.5 transition-colors ${
        hasThread ? 'hover:bg-blue-50 cursor-pointer' : 'opacity-60 cursor-default'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {showRoom && person.phong && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-gray-300 text-gray-500 shrink-0">
            {person.phong}
          </Badge>
        )}
        <span className="text-xs font-medium text-gray-800 truncate">{person.ten}</span>
      </div>
      {person.soDienThoai && (
        <div className="flex items-center gap-1 mt-0.5 ml-0.5">
          <Phone className="h-2.5 w-2.5 text-gray-300" />
          <span className="text-[10px] text-gray-400">{person.soDienThoai}</span>
        </div>
      )}
    </button>
  );
}

// ─── Owner Group Filter Panel ─────────────────────────────────────────────────

interface BuildingGroup { name: string; threadIds: Record<string, string>; tang?: number | null; label?: string }

function OwnerGroupFilterPanel({
  userId, dmFilterGlobal, systemChatIdsCount, groupWhitelist, onWhitelistChange
}: {
  userId: string;
  dmFilterGlobal: 'none' | 'system_only';
  systemChatIdsCount: number;
  groupWhitelist: string[];
  onWhitelistChange: (wl: string[]) => void;
}) {
  const [buildings, setBuildings] = useState<{ id: string; tenToaNha: string; zaloNhomChat: BuildingGroup[] }[]>([]);
  const [selectedBldg, setSelectedBldg] = useState('');
  const [groupName, setGroupName] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupResults, setLookupResults] = useState<{ threadId: string; displayName: string; lastSeen: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/toa-nha?limit=100').then(r => r.json()).then(d => {
      const list = (d.data || []).map((b: any) => ({
        id: b.id,
        tenToaNha: b.tenToaNha,
        zaloNhomChat: Array.isArray(b.zaloNhomChat) ? b.zaloNhomChat : [],
      }));
      setBuildings(list);
      if (list.length === 1) setSelectedBldg(list[0].id);
    }).catch(() => {});
  }, []);

  // Tất cả group của tất cả buildings của user này
  const allGroupNames = useMemo(() => {
    const names = new Set<string>();
    buildings.forEach(b => b.zaloNhomChat.forEach(g => {
      if (g.name) names.add(g.name);
    }));
    return Array.from(names);
  }, [buildings]);

  async function handleLookup() {
    const n = groupName.trim();
    if (!n) return;
    setLooking(true);
    setLookupResults([]);
    try {
      const r = await fetch(`/api/zalo/group-thread-lookup?name=${encodeURIComponent(n)}`);
      const d = await r.json();
      setLookupResults(d.results || []);
      if (!d.results?.length) toast.info('Không tìm thấy nhóm nào khớp tên. Hãy thử gõ đúng tên nhóm Zalo.');
    } catch { toast.error('Lỗi tra cứu'); }
    finally { setLooking(false); }
  }

  async function toggleGroup(name: string, checked: boolean) {
    if (!selectedBldg) return;
    setSaving(true);
    try {
      const newWhitelist = checked
        ? [...groupWhitelist, name]
        : groupWhitelist.filter(w => w !== name);
      
      const r = await fetch('/api/cai-dat/zalo-filter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: checked ? 'add_whitelist_only' : 'remove_whitelist_only', 
          toaNhaId: selectedBldg, 
          name 
        }),
      });
      const d = await r.json();
      if (d.success) {
        onWhitelistChange(newWhitelist);
        toast.success(checked ? `Đang theo dõi nhóm "${name}"` : `Đã bỏ theo dõi nhóm "${name}"`);
      } else { toast.error(d.error || 'Lỗi cập nhật'); }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setSaving(false); }
  }

  async function handleRemoveGroup(name: string) {
    if (!selectedBldg) return;
    setSaving(true);
    try {
      const r = await fetch('/api/cai-dat/zalo-filter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', toaNhaId: selectedBldg, name }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`Đã xóa nhóm "${name}"`);
        onWhitelistChange(groupWhitelist.filter(w => w !== name));
        setBuildings(prev => prev.map(b => b.id === selectedBldg
          ? { ...b, zaloNhomChat: b.zaloNhomChat.filter(g => g.name !== name) }
          : b));
      } else { toast.error(d.error || 'Xóa thất bại'); }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setSaving(false); }
  }

  const currentBldg = buildings.find(b => b.id === selectedBldg);

  return (
    <div className="space-y-3">
      {/* DM filter info — chỉ hiện khi admin để "xem tất cả" */}
      {dmFilterGlobal === 'none' && (
        <div className="p-2 bg-blue-50 rounded-lg text-[11px] text-blue-700">
          <User className="h-3 w-3 inline mr-1" />
          DM cá nhân: Hiện tất cả ({systemChatIdsCount} liên kết hệ thống). Admin chưa giới hạn DM.
        </div>
      )}
      {dmFilterGlobal === 'system_only' && (
        <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-500 flex items-center gap-1">
          <ShieldOff className="h-3 w-3 shrink-0" />
          DM cá nhân đang được Admin lọc theo hệ thống — không cần cài đặt thêm.
        </div>
      )}

      {/* Group filter theo tòa nhà */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-purple-500" /> Nhóm Zalo thông báo theo tòa nhà
        </p>

        {/* Chọn tòa nhà */}
        {buildings.length > 1 && (
          <select value={selectedBldg} onChange={e => setSelectedBldg(e.target.value)}
            className="w-full text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400">
            <option value="">— Chọn tòa nhà —</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.tenToaNha}</option>)}
          </select>
        )}

        {/* Nhóm từ tòa đang chọn */}
        {currentBldg && currentBldg.zaloNhomChat.length > 0 && (
          <div className="grid grid-cols-2 gap-2 border-t pt-2">
            {currentBldg.zaloNhomChat.filter(g => !!g.name).map(g => {
              const isMonitored = groupWhitelist.includes(g.name);
              return (
                <label key={g.name} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                  isMonitored ? 'bg-purple-50 border-purple-200' : 'bg-white hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={isMonitored}
                    onChange={e => toggleGroup(g.name, e.target.checked)}
                    disabled={saving}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-400"
                  />
                  <div className="min-w-0">
                    <p className={`text-[11px] font-medium truncate ${isMonitored ? 'text-purple-700' : 'text-gray-700'}`}>{g.name}</p>
                    {g.label && <p className="text-[9px] text-gray-400 truncate italic">{g.label}</p>}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        {currentBldg && currentBldg.zaloNhomChat.length === 0 && (
          <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed">
            <p className="text-[11px] text-gray-400">Tòa nhà này chưa cấu hình nhóm Zalo.</p>
            <Button variant="link" size="sm" asChild className="text-[10px] text-blue-600 h-auto p-0 mt-1">
              <a href="/dashboard/zalo">Đi tới Cài đặt Zalo</a>
            </Button>
          </div>
        )}

        {currentBldg && (
          <div className="flex justify-end pt-1">
             <Button variant="link" size="sm" asChild className="text-[10px] text-gray-400 h-auto p-0">
               <a href="/dashboard/zalo" className="flex items-center gap-1">
                 <Settings className="h-3 w-3" /> Quản lý danh sách nhóm
               </a>
             </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZaloMonitorPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const showContacts = session?.user?.role && ['chuNha', 'dongChuTro', 'quanLy'].includes(session.user.role);
  const [convs, setConvs] = useState<ZaloMsg[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [leftTab, setLeftTab] = useState<'conv' | 'contacts'>('conv');
  const [zaloMonitorAllowed, setZaloMonitorAllowed] = useState<boolean | null>(null);

  // Bộ lọc Zalo Monitor
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dmFilter, setDmFilter] = useState<'none' | 'system_only'>('none');
  const [groupWhitelist, setGroupWhitelist] = useState<string[]>([]);
  const [systemChatIds, setSystemChatIds] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [savingFilter, setSavingFilter] = useState(false);

  // Check zaloMonitor permission for non-admin users
  useEffect(() => {
    if (isAdmin) { setZaloMonitorAllowed(true); return; }
    const role = session?.user?.role;
    if (!role) return;
    // Fetch user's buildings to check permission
    (async () => {
      try {
        const bRes = await fetch('/api/toa-nha?limit=100');
        if (!bRes.ok) { setZaloMonitorAllowed(true); return; }
        const bData = await bRes.json();
        const buildings = bData.data || [];
        if (buildings.length === 0) { setZaloMonitorAllowed(true); return; }
        // Check first building's permission (try slot-specific first, then role-level)
        const pRes = await fetch(`/api/admin/zalo-quyen?toaNhaId=${buildings[0].id}`);
        const pData = await pRes.json();
        if (pData.ok && pData.effective) {
          // Check all keys matching this role
          const matchingKeys = Object.keys(pData.effective).filter(k => k === role || k.startsWith(`${role}_`));
          if (matchingKeys.length > 0) {
            // If any slot allows zaloMonitor, allow it
            const allowed = matchingKeys.some(k => pData.effective[k].zaloMonitor !== false);
            setZaloMonitorAllowed(allowed);
          } else {
            setZaloMonitorAllowed(true);
          }
        } else {
          setZaloMonitorAllowed(true);
        }
      } catch { setZaloMonitorAllowed(true); }
    })();
  }, [isAdmin, session?.user?.role]);

  // Load cài đặt bộ lọc + system chatIds
  useEffect(() => {
    fetch('/api/cai-dat/zalo-filter').then(r => r.json()).then(d => {
      setDmFilter(d.dmFilter || 'none');
      setGroupWhitelist(d.groupWhitelist || []);
    }).catch(() => {});
    fetch('/api/cai-dat/zalo-filter/system-contacts').then(r => r.json()).then(d => {
      if (Array.isArray(d.chatIds)) setSystemChatIds(new Set(d.chatIds));
    }).catch(() => {});
  }, []);

  // Hội thoại đã lọc: DM theo dmFilter, Group theo groupWhitelist
  const filteredConvs = useMemo(() => convs.filter(m => {
    if (isGroup(m)) {
      if (groupWhitelist.length === 0) return true;
      const name = (m.displayName || '').trim().toLowerCase();
      return groupWhitelist.some(w => name === w.toLowerCase() || name.includes(w.toLowerCase()));
    } else {
      if (dmFilter === 'system_only') return systemChatIds.has(m.chatId);
      return true;
    }
  }), [convs, dmFilter, systemChatIds, groupWhitelist]);

  const saveFilter = async (patch: { dmFilter?: 'none' | 'system_only'; groupWhitelist?: string[] }) => {
    setSavingFilter(true);
    try {
      const res = await fetch('/api/cai-dat/zalo-filter', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (d.success) {
        if (patch.dmFilter !== undefined) setDmFilter(patch.dmFilter);
        if (patch.groupWhitelist !== undefined) setGroupWhitelist(patch.groupWhitelist);
        toast.success('Đã lưu cài đặt lọc');
      } else { toast.error(d.error || 'Lưu thất bại'); }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setSavingFilter(false); }
  };

  const loadConvs = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch('/api/zalo/messages?conversations=1', { cache: 'no-store' });
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

  useEffect(() => {
    loadConvs();
    checkConnection();
    // Tự động gộp tin nhắn nhóm cũ (chatId sai = senderId) khi trang mở
    fetch('/api/zalo/migrate-groups', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.updatedMessages > 0) loadConvs(); })
      .catch(() => {});
  }, [loadConvs, checkConnection]);
  useRealtimeEvents(['zalo-message'], () => { void loadConvs(); });

  // Auto-fetch tên nhóm cho các nhóm chưa có tên trong CaiDat
  useEffect(() => {
    const groups = convs.filter(m => isGroup(m) && (!m.displayName || m.displayName === getThreadId(m)));
    for (const g of groups) {
      const tid = getThreadId(g);
      fetch(`/api/zalo/group-name?groupId=${tid}`)
        .then(r => r.json())
        .then(d => {
          if (!d.name) {
            // Chưa có tên → trigger fetch từ bot server qua webhook route (fire-and-forget)
            fetch(`/api/zalo/fetch-group-name?groupId=${tid}`).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [convs]);

  // Safety net: poll mỗi 30s phòng SSE mất kết nối
  useEffect(() => {
    const timer = setInterval(() => { void loadConvs(); }, 30_000);
    return () => clearInterval(timer);
  }, [loadConvs]);

  // Block access if zaloMonitor permission is disabled
  if (zaloMonitorAllowed === false) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <WifiOff className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Zalo Monitor đã bị tắt</h2>
          <p className="text-sm text-gray-500">Quản trị viên hoặc chủ trọ đã tắt tính năng này cho vai trò của bạn.</p>
        </div>
      </div>
    );
  }

  async function handleDeleteAll() {
    if (!confirm('Xóa tất cả tin nhắn?')) return;
    const res = await fetch('/api/zalo/messages', { method: 'DELETE' });
    if (res.ok) {
      setConvs([]);
      setSelectedChatId(null);
      toast.success('Đã xóa tất cả');
      // Reload từ server để đảm bảo sạch hoàn toàn
      setTimeout(() => loadConvs(), 500);
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || 'Không có quyền xóa');
    }
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
        <div className="flex items-center gap-2">
          {/* Nút cài đặt bộ lọc — admin + chủ trọ */}
          {(isAdmin || ['chuNha', 'dongChuTro'].includes(session?.user?.role || '')) && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowFilterPanel(p => !p)}>
              <Settings className="h-3.5 w-3.5" />
              Bộ lọc
              {(dmFilter === 'system_only' || groupWhitelist.length > 0) && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-blue-500">ON</Badge>
              )}
            </Button>
          )}
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
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <div className="mb-3 rounded-xl border bg-white shadow-sm p-4 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Cài đặt bộ lọc Zalo Monitor</span>
            <button type="button" onClick={() => setShowFilterPanel(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>

          {/* DM filter — admin only */}
          {isAdmin && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Lọc tin nhắn cá nhân (DM)</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => saveFilter({ dmFilter: 'none' })} disabled={savingFilter}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-lg border transition-colors ${dmFilter === 'none' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  <Users className="h-3.5 w-3.5" /> Xem tất cả
                </button>
                <button type="button" onClick={() => saveFilter({ dmFilter: 'system_only' })} disabled={savingFilter}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-lg border transition-colors ${dmFilter === 'system_only' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  <Shield className="h-3.5 w-3.5" /> Chỉ số trong hệ thống
                </button>
              </div>
              {dmFilter === 'system_only' && (
                <p className="text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Chỉ hiện DM từ khách thuê / tài khoản đã liên kết Zalo. Tổng: {systemChatIds.size} liên kết.
                </p>
              )}
            </div>
          )}

          {/* Group filter — chủ trọ / đồng chủ trọ (không phải admin) */}
          {!isAdmin && ['chuNha', 'dongChuTro'].includes(session?.user?.role || '') && (
            <OwnerGroupFilterPanel
              userId={session?.user?.id || ''}
              dmFilterGlobal={dmFilter}
              systemChatIdsCount={systemChatIds.size}
              groupWhitelist={groupWhitelist}
              onWhitelistChange={setGroupWhitelist}
            />
          )}
        </div>
      )}

      {/* 2-column layout */}
      <div className="flex flex-1 overflow-hidden rounded-xl border bg-white shadow-sm">
        {/* Left — conversation list / contacts */}
        <div className={`w-full md:w-72 lg:w-80 border-r shrink-0 flex flex-col ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
          {/* Tab switcher */}
          {showContacts && (
            <div className="flex border-b shrink-0">
              <button type="button"
                className={`flex-1 text-xs font-medium py-2 transition-colors ${leftTab === 'conv' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setLeftTab('conv')}>
                <MessageSquare className="h-3.5 w-3.5 inline mr-1" />Hội thoại
              </button>
              <button type="button"
                className={`flex-1 text-xs font-medium py-2 transition-colors ${leftTab === 'contacts' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setLeftTab('contacts')}>
                <BookUser className="h-3.5 w-3.5 inline mr-1" />Danh bạ
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {leftTab === 'conv' ? (
              <ConversationList
                convs={filteredConvs}
                selectedId={selectedChatId}
                onSelect={setSelectedChatId}
                onDeleteAll={handleDeleteAll}
                loading={loadingConvs}
                onRefresh={loadConvs}
              />
            ) : (
              <CompactContactDir onSelectThread={(threadId) => {
                setSelectedChatId(threadId);
                setLeftTab('conv');
              }} />
            )}
          </div>
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
