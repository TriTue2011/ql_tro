'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageCircle, Send, RefreshCw, Bot, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ZaloMessage {
  id: string;
  chatId: string;
  displayName: string | null;
  content: string;
  role: 'user' | 'bot';
  eventName: string | null;
  createdAt: string;
}

interface Conversation {
  chatId: string;
  displayName: string | null;
  content: string;
  role: string;
  createdAt: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ZaloChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ZaloMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // ─── Load danh sách cuộc hội thoại ──────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingConv(true);
    try {
      const res = await fetch('/api/zalo/messages?conversations=1');
      const data = await res.json();
      setConversations(data.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingConv(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ─── Load tin nhắn của cuộc hội thoại được chọn ─────────────────────────
  useEffect(() => {
    if (!selectedChatId) return;
    setMessages([]);

    fetch(`/api/zalo/messages?chatId=${selectedChatId}&limit=50`)
      .then(r => r.json())
      .then(data => setMessages(data.data ?? []));
  }, [selectedChatId]);

  // ─── SSE: nhận TẤT CẢ tin nhắn mới theo thời gian thực ────────────────
  // Dùng 1 kết nối không lọc chatId để cả conversations lẫn messages
  // đều cập nhật ngay khi có tin từ bất kỳ ai.
  const selectedChatIdRef = useRef<string | null>(null);
  useEffect(() => { selectedChatIdRef.current = selectedChatId; }, [selectedChatId]);

  useEffect(() => {
    const es = new EventSource('/api/zalo/messages/stream');
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type !== 'messages') return;
        const newMsgs: ZaloMessage[] = payload.data;

        // Cập nhật tin nhắn trong cuộc hội thoại đang mở
        const currentChatId = selectedChatIdRef.current;
        if (currentChatId) {
          const relevant = newMsgs.filter(m => m.chatId === currentChatId);
          if (relevant.length > 0) {
            setMessages(prev => {
              const existIds = new Set(prev.map(m => m.id));
              return [...prev, ...relevant.filter(m => !existIds.has(m.id))];
            });
          }
        }

        // Cập nhật preview danh sách bên trái (tất cả chatId)
        setConversations(prev => {
          const map = new Map(prev.map(c => [c.chatId, c]));
          for (const m of newMsgs) {
            const existing = map.get(m.chatId);
            if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
              map.set(m.chatId, {
                chatId: m.chatId,
                displayName: m.displayName,
                content: m.content,
                role: m.role,
                createdAt: m.createdAt,
              });
            }
          }
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      } catch { /* ignore parse errors */ }
    };

    return () => { es.close(); };
  }, []); // mount 1 lần duy nhất, không reconnect khi đổi chatId

  // ─── Auto-scroll khi có tin mới ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Gửi tin nhắn ────────────────────────────────────────────────────────
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChatId || !replyText.trim()) return;

    setSending(true);
    setSendError(null);
    const text = replyText.trim();
    setReplyText('');

    // Hiển thị tạm thời (optimistic update)
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ZaloMessage = {
      id: tempId,
      chatId: selectedChatId,
      displayName: 'Bot',
      content: text,
      role: 'bot',
      eventName: 'bot_reply',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const convDisplayName = conversations.find(c => c.chatId === selectedChatId)?.displayName;
      const res = await fetch('/api/zalo/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChatId, message: text, displayName: convDisplayName }),
      });
      const data = await res.json();

      if (!data.success) {
        setSendError(data.error || 'Gửi thất bại');
        // Đánh dấu lỗi trên tin tạm
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, eventName: 'bot_reply_failed' } : m
        ));
      } else {
        // Thay tin tạm bằng tin thật từ DB
        setMessages(prev => prev.map(m => m.id === tempId ? { ...data.saved, role: 'bot' } : m));
      }
    } catch (err: any) {
      setSendError(err?.message || 'Lỗi kết nối');
    } finally {
      setSending(false);
    }
  }

  const selectedConv = conversations.find(c => c.chatId === selectedChatId);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Panel trái: danh sách cuộc hội thoại ─────────────────────── */}
      <div className="w-72 border-r flex flex-col bg-white shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            Zalo Chat
          </h2>
          <Button variant="ghost" size="icon" onClick={loadConversations} disabled={loadingConv}
            className="h-7 w-7">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingConv ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-400 p-4 text-center">
              Chưa có tin nhắn nào.{' '}
              <span className="text-blue-500 cursor-pointer" onClick={loadConversations}>Làm mới</span>
            </p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.chatId}
                onClick={() => setSelectedChatId(conv.chatId)}
                className={`w-full text-left px-3 py-2.5 border-b hover:bg-gray-50 transition-colors ${
                  selectedChatId === conv.chatId ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-sm truncate">
                    {conv.displayName || conv.chatId}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                    {formatTime(conv.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                  {conv.role === 'bot' && <span className="text-blue-400">[Bot]</span>}
                  {conv.content}
                </p>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Panel phải: tin nhắn + ô reply ─────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
        {!selectedChatId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <MessageCircle className="h-10 w-10 opacity-30" />
            <p className="text-sm">Chọn một cuộc hội thoại</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {selectedConv?.displayName || selectedChatId}
                </p>
                <p className="text-xs text-gray-400">{selectedChatId}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.map(msg => (
                  <div key={msg.id}
                    className={`flex gap-2 ${msg.role === 'bot' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === 'bot' ? 'bg-blue-500' : 'bg-gray-200'
                    }`}>
                      {msg.role === 'bot'
                        ? <Bot className="h-3.5 w-3.5 text-white" />
                        : <User className="h-3.5 w-3.5 text-gray-600" />
                      }
                    </div>
                    <div className={`max-w-[70%] ${msg.role === 'bot' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm break-words ${
                        msg.role === 'bot'
                          ? msg.eventName === 'bot_reply_failed'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-blue-500 text-white'
                          : 'bg-white text-gray-800 border'
                      }`}>
                        {msg.content}
                        {msg.eventName === 'bot_reply_failed' && (
                          <span className="ml-1 text-xs">⚠ gửi lỗi</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Reply box */}
            <div className="p-3 border-t bg-white">
              {sendError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mb-2 px-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {sendError}
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={replyText}
                  onChange={e => { setReplyText(e.target.value); setSendError(null); }}
                  placeholder="Nhập tin nhắn trả lời..."
                  disabled={sending}
                  className="flex-1 text-sm"
                  autoComplete="off"
                />
                <Button type="submit" disabled={sending || !replyText.trim()} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
