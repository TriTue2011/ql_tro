'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME =
  'Xin chào! Tôi là trợ lý AI của hệ thống. Tôi có thể giúp bạn tra cứu thông tin phòng, hóa đơn, hợp đồng và các vấn đề liên quan. Bạn cần hỗ trợ gì?';

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [messages, open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter(m => m.role !== 'assistant' || m.content !== WELCOME),
        }),
      });
      const data: { reply?: string; error?: string } = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply! }]);
      } else {
        setError(data.error ?? 'Xảy ra lỗi. Vui lòng thử lại.');
      }
    } catch {
      setError('Không thể kết nối tới AI. Vui lòng thử lại.');
    }
    setLoading(false);
  }, [input, messages, loading]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  return (
    <>
      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 82,
          right: 20,
          width: 340,
          maxHeight: open ? 500 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 10000,
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          border: '1px solid #e5e7eb',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          style={{
            padding: '11px 16px',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <i className="bi bi-stars" style={{ fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1, letterSpacing: 0.2 }}>
            Trợ lý AI
          </span>
          <button
            onClick={() => setOpen(false)}
            title="Đóng"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '3px 6px',
              borderRadius: 6,
              lineHeight: 1,
              fontSize: 13,
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 12px 4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 350,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {m.role === 'assistant' && (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginRight: 6,
                    marginTop: 2,
                  }}
                >
                  <i className="bi bi-stars" style={{ fontSize: 11, color: '#fff' }} />
                </div>
              )}
              <div
                style={{
                  maxWidth: '82%',
                  padding: '8px 11px',
                  borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '3px 12px 12px 12px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: m.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f3f4f6',
                  color: m.role === 'user' ? '#fff' : '#1f2937',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-stars" style={{ fontSize: 11, color: '#fff' }} />
              </div>
              <div
                style={{
                  background: '#f3f4f6',
                  padding: '8px 14px',
                  borderRadius: '3px 12px 12px 12px',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {[0, 160, 320].map(d => (
                  <span
                    key={d}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#9ca3af',
                      display: 'inline-block',
                      animation: `ai-dot 1.2s ${d}ms infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                fontSize: 12,
                color: '#ef4444',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="bi bi-exclamation-circle" />
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: '8px 10px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={handleKey}
            placeholder="Nhập câu hỏi... (Enter gửi)"
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '7px 10px',
              fontSize: 13,
              outline: 'none',
              minHeight: 36,
              maxHeight: 100,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#6366f1')}
            onBlur={e => (e.target.style.borderColor = '#d1d5db')}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            title="Gửi"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background:
                loading || !input.trim()
                  ? '#e5e7eb'
                  : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: loading || !input.trim() ? '#9ca3af' : '#fff',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              alignSelf: 'flex-end',
              transition: 'background 0.15s',
            }}
          >
            {loading ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid #9ca3af',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'ai-spin 0.7s linear infinite',
                }}
              />
            ) : (
              <i className="bi bi-send" style={{ fontSize: 14 }} />
            )}
          </button>
        </div>

        <style>{`
          @keyframes ai-dot {
            0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
          @keyframes ai-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* ── Floating button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(p => !p)}
        title={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background: open
            ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
            : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color: '#fff',
          cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(99,102,241,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          fontSize: 20,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        <i className={`bi bi-${open ? 'x-lg' : 'stars'}`} />
      </button>
    </>
  );
}
