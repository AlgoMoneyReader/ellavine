import { useState, useRef, useEffect, Fragment } from 'react';
import { SYSTEM_PROMPT } from '../data/ellavineData';

const QUICK = [
  '다음 납부일이 언제야?',
  '취득세 얼마나 나와?',
  '발코니 확장 비용은?',
  '입주 시 필요한 서류가 뭐야?',
];

function renderMd(text) {
  return text.split('\n').map((line, li, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <Fragment key={li}>
        {parts.map((p, pi) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={pi}>{p.slice(2, -2)}</strong>
            : p
        )}
        {li < arr.length - 1 && '\n'}
      </Fragment>
    );
  });
}

function buildUserContext(user) {
  if (!user) return null;
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const parts = [`오늘: ${today}`];
  if (!user.isAdmin && user.dong) {
    parts.push(`세대: ${user.dong}동 ${user.ho}호 (${user.type}타입 ${user.area}㎡, ${user.floor}층)`);
  }
  if (user.nickname) parts.push(`닉네임: ${user.nickname}`);
  return parts.join('\n');
}

async function callAI(history, userMsg, userContext) {
  const contents = [
    ...history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: userMsg }] },
  ];
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt: SYSTEM_PROMPT, contents, userContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP_${res.status}`);
  }
  const data = await res.json();
  return data.text || '죄송합니다, 잠시 후 다시 시도해주세요.';
}

export default function FloatingAI({ user, currentTab }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: `안녕하세요${user?.nickname ? `, ${user.nickname}님` : ''}! 🏢\n무엇이든 물어보세요.` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) { setUnread(false); inputRef.current?.focus(); }
  }, [open]);

  // AI 탭에선 숨김 (중복 방지)
  if (currentTab === 'ai') return null;

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const history = messages.slice(1);
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);

    try {
      const reply = await callAI(history, msg, buildUserContext(user));
      setMessages(m => [...m, { role: 'ai', text: reply }]);
      if (!open) setUnread(true);
    } catch (e) {
      const msg = String(e?.message || '');
      const isQuota = msg.includes('QUOTA_EXCEEDED');
      const is503 = msg.includes('503') || msg.includes('502');
      setMessages(m => [...m, {
        role: 'ai',
        text: isQuota
          ? '일일 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
          : is503
          ? 'AI 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
          : `연결 오류가 발생했습니다. (${msg || '알 수 없는 오류'})`,
      }]);
    }
    setLoading(false);
  }

  return (
    <>
      {/* 채팅 패널 */}
      {open && (
        <div style={panel}>
          {/* 패널 헤더 */}
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={aiAvatar}>🤖</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>엘라비네 AI</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>gemini-2.5-flash · 항상 응답</div>
              </div>
            </div>
            <button style={closeBtn} onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* 메시지 영역 */}
          <div ref={chatRef} style={panelBody}>
            {messages.map((m, i) => (
              <div key={i} style={{ ...msgBase, ...(m.role === 'user' ? msgUser : msgAi) }}>
                {m.role === 'ai' && (
                  <div style={{ fontSize: 9, color: 'var(--gold)', marginBottom: 3, fontWeight: 700 }}>엘라비네 AI</div>
                )}
                <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: m.role === 'user' ? '#FFFFFF' : 'var(--text)' }}>
                  {m.role === 'ai' ? renderMd(m.text) : m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ ...msgBase, ...msgAi }}>
                <div style={{ fontSize: 9, color: 'var(--gold)', marginBottom: 3, fontWeight: 700 }}>엘라비네 AI</div>
                <div style={dots}>
                  <span style={dot} /><span style={{ ...dot, animationDelay: '0.15s' }} /><span style={{ ...dot, animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {/* 빠른 질문 */}
          {messages.length <= 1 && (
            <div style={quickArea}>
              {QUICK.map((q, i) => (
                <button key={i} style={quickChip} onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}

          {/* 입력창 */}
          <div style={panelFooter}>
            <input
              ref={inputRef}
              style={panelInput}
              placeholder="질문을 입력하세요..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              disabled={loading}
            />
            <button style={sendBtn(!input.trim() || loading)} disabled={!input.trim() || loading} onClick={() => send()}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button style={floatButton} onClick={() => setOpen(o => !o)} aria-label="AI 도우미">
        {open ? (
          <span style={{ fontSize: 18, color: '#FFFFFF' }}>✕</span>
        ) : (
          <>
            <span style={{ fontSize: 22 }}>🤖</span>
            {unread && <div style={badge} />}
          </>
        )}
      </button>
    </>
  );
}

const panel = {
  position: 'fixed',
  bottom: 90,
  right: 16,
  width: 'min(360px, calc(100vw - 32px))',
  height: 'min(520px, calc(100vh - 160px))',
  background: '#FFFFFF',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: '0 8px 40px rgba(11,40,73,0.18)',
  zIndex: 400,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: 'fadeUp 0.2s ease',
};
const panelHeader = {
  background: 'var(--navy)',
  padding: '14px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
};
const aiAvatar = {
  width: 34, height: 34, borderRadius: '50%',
  background: 'rgba(255,255,255,0.15)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18,
};
const closeBtn = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'rgba(255,255,255,0.15)', border: 'none',
  color: '#FFFFFF', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const panelBody = {
  flex: 1, overflowY: 'auto', padding: '12px',
  display: 'flex', flexDirection: 'column', gap: 8,
};
const quickArea = {
  padding: '8px 12px',
  display: 'flex', flexWrap: 'wrap', gap: 6,
  borderTop: '1px solid var(--border)',
  flexShrink: 0,
};
const quickChip = {
  fontSize: 10, padding: '5px 10px',
  background: 'rgba(200,168,64,0.08)', border: '1px solid var(--gold-dim)',
  borderRadius: 20, color: 'var(--gold)', cursor: 'pointer', fontWeight: 600,
};
const panelFooter = {
  padding: '10px 12px',
  borderTop: '1px solid var(--border)',
  display: 'flex', gap: 8,
  flexShrink: 0,
};
const panelInput = {
  flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 12,
  outline: 'none',
};
const sendBtn = (disabled) => ({
  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
  background: disabled ? 'var(--bg)' : 'var(--navy)',
  color: disabled ? 'var(--gray)' : '#FFFFFF',
  border: '1px solid var(--border)', fontSize: 14, cursor: disabled ? 'default' : 'pointer',
});
const msgBase = { padding: '9px 11px', borderRadius: 12, maxWidth: '88%' };
const msgUser = { background: 'var(--navy)', alignSelf: 'flex-end', marginLeft: 'auto' };
const msgAi   = { background: 'var(--bg)', border: '1px solid var(--border)', alignSelf: 'flex-start' };
const dots = { display: 'flex', gap: 4 };
const dot = { width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', animation: 'typing 1.2s infinite' };
const floatButton = {
  position: 'fixed', bottom: 90, right: 16, zIndex: 399,
  width: 52, height: 52, borderRadius: '50%',
  background: 'var(--navy)', border: '2px solid rgba(200,168,64,0.4)',
  boxShadow: '0 4px 20px rgba(11,40,73,0.3)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
};
const badge = {
  position: 'absolute', top: 2, right: 2,
  width: 10, height: 10, borderRadius: '50%',
  background: 'var(--red)', border: '2px solid var(--navy)',
};
