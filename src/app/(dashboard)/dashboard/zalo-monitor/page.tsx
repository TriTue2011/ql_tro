'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Trash2, Users, User, Image as ImageIcon, FileText, MessageSquare, RefreshCw, Wifi, WifiOff, Download, Clock, Building2, DoorOpen, Webhook, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface RoomInfo {
  tenKhach: string;
  maPhong: string;
  tang: number;
  tenToaNha: string;
  diaChi: any;
}

interface MonitorMsg {
  id: string;
  chatId: string;
  displayName: string | null;
  content: string;
  attachmentUrl: string | null;
  role: string;
  eventName: string | null;
  createdAt: string;
  rawPayload: any;
  roomInfo?: RoomInfo;
}

// ─── parse rawPayload từ bot server (zca-js) ──────────────────────────────────
function parseRaw(msg: MonitorMsg) {
  const raw = msg.rawPayload as any;
  const data = raw?.data ?? {};
  const isGroup = raw?.type === 1;
  const threadId: string = raw?.threadId || msg.chatId;
  const msgType: string = data?.msgType || 'webchat';
  const dName: string = data?.dName || msg.displayName || '';
  const tsMs = data?.ts ? parseInt(data.ts) : new Date(msg.createdAt).getTime();
  const ts = new Date(isNaN(tsMs) ? msg.createdAt : tsMs);
  const ttlMs: number | null = data?.ttl != null ? Number(data.ttl) : null;
  const uidFrom: string = data?.uidFrom ? String(data.uidFrom) : '';
  const accountId: string = raw?._accountId ? String(raw._accountId) : '';

  // Nội dung tùy loại
  let text = '';
  let imageUrl: string | null = null;
  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let fileExt: string | null = null;
  let thumb: string | null = null;

  if (msgType === 'chat.photo') {
    const c = data?.content ?? {};
    imageUrl = typeof c === 'object' ? (c.href || c.thumb || null) : null;
    thumb = typeof c === 'object' ? (c.thumb || c.href || null) : null;
    text = typeof c === 'object' ? (c.title || c.description || '') : '';
  } else if (msgType === 'share.file') {
    const c = data?.content ?? {};
    fileUrl = typeof c === 'object' ? (c.href || null) : null;
    fileName = typeof c === 'object' ? (c.title || 'file') : 'file';
    thumb = typeof c === 'object' ? (c.thumb || null) : null;
    // Extract file extension from params or filename
    try {
      if (typeof c?.params === 'string') {
        const params = JSON.parse(c.params);
        fileExt = params.fileExt || null;
      }
    } catch { /* ignore */ }
    if (!fileExt && fileName) fileExt = fileName.split('.').pop() || null;
    text = fileName;
  } else {
    text = typeof data?.content === 'string'
      ? data.content
      : (msg.content ?? '');
  }

  return { isGroup, threadId, msgType, dName, ts, ttlMs, uidFrom, accountId, text, imageUrl, fileUrl, fileName, fileExt, thumb };
}

function formatTtl(ttlMs: number | null): string | null {
  if (ttlMs === null || ttlMs <= 0) return null;
  if (ttlMs >= 86400000) return `${Math.round(ttlMs / 86400000)} ngày`;
  if (ttlMs >= 3600000) return `${Math.round(ttlMs / 3600000)} giờ`;
  if (ttlMs >= 60000) return `${Math.round(ttlMs / 60000)} phút`;
  return `${Math.round(ttlMs / 1000)} giây`;
}

function formatTime(d: Date) {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ZaloMonitorPage() {
  const [messages, setMessages] = useState<MonitorMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleTriggerHA(msg: MonitorMsg) {
    const { threadId, dName } = parseRaw(msg);
    setTriggeringId(msg.id);
    try {
      const res = await fetch('/api/zalo/trigger-ha-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId,
          display_name: dName,
          message: msg.content,
          type: msg.rawPayload?.type === 1 ? 'group' : 'user',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã trigger HA webhook');
      } else {
        toast.error(data.message || data.error || 'Trigger thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setTriggeringId(null);
    }
  }

  // ─── Load lần đầu từ DB ──────────────────────────────────────────────────
  async function loadMessages() {
    setLoading(true);
    try {
      const res = await fetch('/api/zalo/messages?conversations=1');
      const data = await res.json();
      if (data.data) setMessages(data.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadMessages(); }, []);

  // ─── SSE real-time ───────────────────────────────────────────────────────
  useEffect(() => {
    let retryDelay = 2000;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      const es = new EventSource('/api/zalo/messages/stream');

      es.onopen = () => { setConnected(true); retryDelay = 2000; };
      es.onerror = () => {
        setConnected(false);
        es.close();
        timer = setTimeout(() => { retryDelay = Math.min(retryDelay * 2, 30_000); connect(); }, retryDelay);
      };

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type !== 'messages') return;
          const newMsgs: MonitorMsg[] = payload.data;
          setMessages(prev => {
            const map = new Map(prev.map(m => [m.chatId, m]));
            for (const m of newMsgs) {
              const existing = map.get(m.chatId);
              if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
                map.set(m.chatId, m);
              }
            }
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        } catch { /* ignore */ }
      };

      return es;
    }

    const es = connect();
    return () => { clearTimeout(timer); es.close(); setConnected(false); };
  }, []);

  async function handleClear() {
    if (!confirm('Xóa tất cả tin nhắn đã nhận?')) return;
    await fetch('/api/zalo/messages', { method: 'DELETE' });
    setMessages([]);
    toast.success('Đã xóa tất cả');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Theo dõi tin nhắn Zalo Bot</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">
            Hiển thị tin nhắn đến — lấy <strong>Thread ID</strong> để liên kết với khách thuê
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
            connected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            {connected
              ? <><Wifi className="h-3 w-3" /> Đang kết nối</>
              : <><WifiOff className="h-3 w-3" /> Chờ kết nối</>}
          </div>
          <Button size="sm" variant="outline" onClick={loadMessages} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-1" />
            Xóa tất cả
          </Button>
        </div>
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-gray-400">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Chưa có tin nhắn nào.</p>
          <p className="text-xs mt-1">Nhắn vào Zalo Bot để xem Thread ID tại đây.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => {
            const { isGroup, threadId, msgType, dName, ts, ttlMs, uidFrom, text, imageUrl, fileUrl, fileName, fileExt, thumb } = parseRaw(msg);
            const isExpanded = expandedId === msg.id;
            const ttlLabel = formatTtl(ttlMs);
            const room = msg.roomInfo;

            return (
              <div key={msg.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                {/* Thread header */}
                <div className={`px-4 py-3 flex items-center gap-3 ${isGroup ? 'bg-purple-50' : 'bg-blue-50'}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    isGroup ? 'bg-purple-200' : 'bg-blue-200'
                  }`}>
                    {isGroup
                      ? <Users className="h-4 w-4 text-purple-700" />
                      : <User className="h-4 w-4 text-blue-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${
                        isGroup ? 'border-purple-300 text-purple-700 bg-purple-50' : 'border-blue-300 text-blue-700 bg-blue-50'
                      }`}>
                        {isGroup ? 'Nhóm' : 'Người dùng'}
                      </Badge>
                      <span className="font-medium text-sm text-gray-900 truncate">{dName || 'Ẩn danh'}</span>
                      {msgType !== 'webchat' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 border-gray-300 text-gray-600">
                          {msgType === 'chat.photo' ? 'Hình ảnh' : fileExt ? fileExt.toUpperCase() : 'File'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">Thread ID:</span>
                      <code className="text-xs font-bold text-blue-800 select-all">{threadId}</code>
                      <button type="button"
                        className="text-gray-400 hover:text-blue-600"
                        onClick={() => { navigator.clipboard.writeText(threadId); toast.success('Đã sao chép Thread ID'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {uidFrom && uidFrom !== threadId && (
                        <span className="text-[10px] text-gray-400">UID: {uidFrom}</span>
                      )}
                    </div>
                    {/* Thông tin phòng / tòa nhà */}
                    {room && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 border-green-300 text-green-700 bg-green-50">
                          <DoorOpen className="h-3 w-3 mr-0.5" />
                          {room.maPhong} (Tầng {room.tang})
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 border-orange-300 text-orange-700 bg-orange-50">
                          <Building2 className="h-3 w-3 mr-0.5" />
                          {room.tenToaNha}
                        </Badge>
                        {room.diaChi && typeof room.diaChi === 'object' && (
                          <span className="text-[10px] text-gray-400">
                            {[room.diaChi.soNha, room.diaChi.duong, room.diaChi.phuong, room.diaChi.quan].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                    {ttlLabel && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-600">
                        <Clock className="h-3 w-3" />
                        TTL: {ttlLabel}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-gray-400">{formatTime(ts)}</span>
                    <button type="button"
                      className="text-gray-400 hover:text-orange-600 p-1 rounded hover:bg-orange-50 transition-colors"
                      title="Trigger HA Webhook"
                      disabled={triggeringId === msg.id}
                      onClick={() => handleTriggerHA(msg)}>
                      {triggeringId === msg.id
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Nội dung */}
                <div className="px-4 py-3">
                  {msgType === 'chat.photo' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>Hình ảnh</span>
                      </div>
                      {thumb && (
                        <a href={imageUrl || thumb} target="_blank" rel="noopener noreferrer">
                          <img src={thumb} alt="ảnh Zalo"
                            className="rounded-lg max-h-64 max-w-full object-contain border cursor-pointer hover:opacity-90"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </a>
                      )}
                      {text && <p className="text-sm text-gray-600">{text}</p>}
                    </div>
                  )}

                  {msgType === 'share.file' && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-12 w-12 object-contain rounded"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center shrink-0">
                          <FileText className="h-6 w-6 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                          <FileText className="h-3.5 w-3.5" />
                          <span>File đính kèm {fileExt && <code className="bg-gray-200 px-1 rounded text-[10px]">.{fileExt}</code>}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
                        {fileUrl && (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            Tải xuống
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {msgType !== 'chat.photo' && msgType !== 'share.file' && (
                    <p className="text-sm text-gray-800">{text || <span className="text-gray-400 italic">[trống]</span>}</p>
                  )}
                </div>

                {/* Raw payload toggle */}
                <div className="px-4 pb-3">
                  <button type="button"
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                    onClick={() => setExpandedId(isExpanded ? null : msg.id)}>
                    {isExpanded ? 'Ẩn raw payload' : 'Xem raw payload'}
                  </button>
                  {isExpanded && (
                    <pre className="mt-2 p-3 bg-gray-50 border rounded-lg text-[10px] text-gray-600 overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                      {JSON.stringify(msg.rawPayload, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
