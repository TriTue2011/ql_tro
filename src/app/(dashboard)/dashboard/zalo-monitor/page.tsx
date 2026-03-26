'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtimeEvents } from '@/hooks/use-realtime';
import {
  Copy, Trash2, Users, User, RefreshCw, Wifi, WifiOff,
  MessageSquare, Building2, DoorOpen, ChevronLeft, Bot,
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
  displayName: string | null;
  content: string;
  attachmentUrl: string | null;
  role: string;
  eventName: string | null;
  createdAt: string;
  rawPayload: any;
  roomInfo?: RoomInfo;
  // chỉ dùng ở conversations view
  botContent?: string | null;
  botCreatedAt?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function threadId(msg: ZaloMsg): string {
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
      {/* toolbar */}
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

      {/* list */}
      <div className="flex-1 overflow-y-auto divide-y">
        {convs.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Chưa có tin nhắn nào.</p>
          </div>
        )}
        {convs.map(msg => {
          const tid = threadId(msg);
          const group = isGroup(msg);
          const name = senderName(msg);
          const selected = selectedId === msg.chatId;
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
                    {msg.role === 'bot' ? '🤖 ' : ''}{msg.content}
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

  // reload khi có tin nhắn mới
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
  const tid = msgs.length ? threadId(msgs[0]) : chatId;

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
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {hasMore && (
          <div className="text-center pb-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => load(msgs[0]?.createdAt)} disabled={loading}>
              {loading ? 'Đang tải...' : 'Tải thêm'}
            </Button>
          </div>
        )}

        {msgs.map((msg, i) => {
          const isBot = msg.role === 'bot';
          const showDateSep = i === 0 || new Date(msg.createdAt).toDateString() !== new Date(msgs[i - 1].createdAt).toDateString();

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="text-center text-[10px] text-gray-400 py-2">
                  {new Date(msg.createdAt).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              )}
              <div className={`flex items-end gap-1.5 group ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* avatar */}
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${isBot ? 'bg-gray-200' : 'bg-blue-100'}`}>
                  {isBot ? <Bot className="h-3.5 w-3.5 text-gray-500" /> : <User className="h-3.5 w-3.5 text-blue-600" />}
                </div>

                {/* bubble */}
                <div className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm relative ${
                  isBot
                    ? 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    : 'bg-blue-500 text-white rounded-br-sm'
                }`}>
                  {msg.attachmentUrl && (
                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                      <img src={msg.attachmentUrl} alt="" className="rounded-lg max-h-48 max-w-full mb-1 object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </a>
                  )}
                  <span className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</span>
                  <span className={`block text-[10px] mt-0.5 ${isBot ? 'text-gray-400' : 'text-blue-100'}`}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>

                {/* delete */}
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 mb-1 shrink-0"
                  onClick={() => handleDelete(msg.id)}
                  title="Xóa tin nhắn này">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {msgs.length === 0 && !loading && (
          <div className="text-center text-gray-400 text-sm py-12">Chưa có tin nhắn.</div>
        )}
        <div ref={bottomRef} />
      </div>
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
      // Tải tin nhắn (API tự filter theo user)
      const res = await fetch('/api/zalo/messages?conversations=1');
      const data = await res.json();
      if (data.data) setConvs(data.data);
    } catch { /* ignore */ } finally { setLoadingConvs(false); }
  }, []);

  // Kiểm tra trạng thái kết nối
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
            {isAdmin ? 'Xem tin nhắn của tất cả tài khoản' : 'Xem tin nhắn Zalo của bạn'}
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
