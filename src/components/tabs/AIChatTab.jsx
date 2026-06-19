import { useState, useRef, useEffect, Fragment } from 'react';
import { SYSTEM_PROMPT } from '../../data/ellavineData';
import { useAuth } from '../../contexts/AuthContext';

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

function renderMd(text) {
  return text.split('\n').map((line, li, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <Fragment key={li}>
        {parts.map((p, pi) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={pi} style={{ fontWeight:700 }}>{p.slice(2, -2)}</strong>
            : p
        )}
        {li < arr.length - 1 && '\n'}
      </Fragment>
    );
  });
}

const QUICK = [
  { label:'84B 중도금 납부 일정은?',     icon:'💰' },
  { label:'발코니 확장 비용이 얼마야?',  icon:'🏗️' },
  { label:'입주 시 필요한 서류가 뭐야?', icon:'📋' },
  { label:'커뮤니티 시설 알려줘',        icon:'🏋️' },
  { label:'취득세는 얼마나 나와?',       icon:'🧾' },
  { label:'잔금 납부는 언제야?',         icon:'📅' },
];

async function callGemini(history, userMsg, userContext) {
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

export default function AIChatTab() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role:'ai', text:'안녕하세요! 래미안 엘라비네 입주 도우미입니다 🏢\n\n분양가, 납부 일정, 단지 정보, 입주 절차 등 무엇이든 물어보세요!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const history = messages.slice(1);
    setMessages(m => [...m, { role:'user', text: msg }]);
    setLoading(true);

    try {
      const reply = await callGemini(history, msg, buildUserContext(user));
      setMessages(m => [...m, { role:'ai', text: reply }]);
    } catch (e) {
      const errMsg = String(e?.message || '');
      const isQuota = errMsg.includes('QUOTA_EXCEEDED') || errMsg.includes('429');
      const reply = isQuota
        ? 'API 일일 사용량 한도에 도달했습니다.\n구글 기준 한국시간 오전 9시에 리셋됩니다. 잠시 후 다시 시도해주세요.'
        : '연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      setMessages(m => [...m, { role:'ai', text: reply }]);
    }
    setLoading(false);
  }

  return (
    <div style={wrap}>
      <div style={sectionTitle}>AI 입주 도우미</div>
      <div style={sectionSub}>래미안 엘라비네 전용 챗봇 (Gemini)</div>
      <div style={goldLine} />

      {/* 인트로 */}
      <div style={intro}>
        <div style={avatar}>🤖</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--navy)', marginBottom:4 }}>엘라비네 AI</div>
        <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.7 }}>납부 일정, 단지 정보, 입주 절차 등<br />궁금한 것을 무엇이든 물어보세요</div>
      </div>

      {/* 빠른 질문 */}
      <div style={quickGrid}>
        {QUICK.map((q, i) => (
          <button key={i} style={quickBtn} onClick={() => send(q.label)}>
            <span style={{ fontSize:18, display:'block', marginBottom:4 }}>{q.icon}</span>
            <span style={{ fontSize:10, lineHeight:1.4, color:'var(--text)' }}>{q.label}</span>
          </button>
        ))}
      </div>

      {/* 채팅 영역 */}
      <div ref={chatRef} style={chatArea}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...msgBase, ...(m.role === 'user' ? msgUser : msgAi) }}>
            {m.role === 'ai' && <div style={{ fontSize:9, color:'var(--gold)', marginBottom:4, letterSpacing:1, fontWeight:700 }}>엘라비네 AI</div>}
            <div style={{ fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', color: m.role === 'user' ? '#FFFFFF' : 'var(--text)' }}>
              {m.role === 'ai' ? renderMd(m.text) : m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ ...msgBase, ...msgAi }}>
            <div style={{ fontSize:9, color:'var(--gold)', marginBottom:4, fontWeight:700 }}>엘라비네 AI</div>
            <div style={typingDots}>
              <span style={typingDot} /><span style={{ ...typingDot, animationDelay:'0.15s' }} /><span style={{ ...typingDot, animationDelay:'0.3s' }} />
            </div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div style={inputRow}>
        <input
          style={inputBox}
          placeholder="질문을 입력하세요..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button style={sendBtn(loading || !input.trim())} onClick={() => send()} disabled={loading || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}

const wrap = { padding:'16px 16px 140px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };
const intro = { textAlign:'center', padding:'20px 16px', background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16, marginBottom:16, boxShadow:'var(--shadow-sm)' };
const avatar = { fontSize:36, marginBottom:8 };
const noKeyAlert = { background:'rgba(217,69,69,0.08)', border:'1px solid rgba(217,69,69,0.25)', borderRadius:10, padding:'10px 14px', fontSize:11, color:'var(--red)', marginBottom:12, lineHeight:1.6 };
const quickGrid = { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 };
const quickBtn = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:12, padding:'10px 6px', textAlign:'center', cursor:'pointer', boxShadow:'var(--shadow-sm)' };
const chatArea = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:16, padding:12, minHeight:200, maxHeight:360, overflowY:'auto', marginBottom:12 };
const msgBase = { padding:'10px 12px', borderRadius:12, marginBottom:8, fontSize:13 };
const msgUser = { background:'var(--navy)', border:'none', marginLeft:24 };
const msgAi = { background:'#FFFFFF', border:'1px solid var(--border)', marginRight:24, boxShadow:'var(--shadow-sm)' };
const typingDots = { display:'flex', gap:4 };
const typingDot = { width:7, height:7, borderRadius:'50%', background:'var(--gold)', animation:'typing 1.2s infinite' };
const inputRow = { display:'flex', gap:8, position:'sticky', bottom:80 };
const inputBox = { flex:1, background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', color:'var(--text)', fontSize:13, outline:'none', boxShadow:'var(--shadow-sm)' };
const sendBtn = (disabled) => ({ width:48, height:48, borderRadius:12, background: disabled ? 'var(--bg)' : 'var(--navy)', color: disabled ? 'var(--gray)' : '#FFFFFF', border:'1px solid var(--border)', fontSize:16, fontWeight:700, flexShrink:0 });
