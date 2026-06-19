import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseReady } from '../lib/supabase';

export default function PendingScreen() {
  const { user, logout } = useAuth();
  const [note, setNote] = useState('');
  const [residentType, setResidentType] = useState('일반분양');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // 기존에 제출한 메모·입주구분 불러오기
  useEffect(() => {
    if (!user?.username || !isSupabaseReady) { setFetched(true); return; }
    supabase.from('residents')
      .select('verify_note, resident_type')
      .eq('username', user.username)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.verify_note) setNote(data.verify_note);
        if (data?.resident_type) setResidentType(data.resident_type);
        setFetched(true);
      });
  }, [user?.username]);

  async function handleSubmit() {
    if (!note.trim()) return;
    if (!isSupabaseReady) return;
    setLoading(true);
    await supabase.from('residents')
      .update({ verify_note: note.trim(), resident_type: residentType })
      .eq('username', user.username);
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div style={overlay}>
      <div style={card}>
        {/* 헤더 */}
        <div style={{ width:40, height:2, background:'var(--gold)', margin:'0 auto 20px', borderRadius:1 }} />
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:10, letterSpacing:4, color:'var(--gold)', textAlign:'center', marginBottom:4 }}>RAEMIAN</div>
        <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:18, fontWeight:600, color:'var(--navy)', textAlign:'center', marginBottom:20 }}>래미안 엘라비네</div>

        {/* 세대 배지 */}
        <div style={unitBadge}>
          <div style={{ fontSize:11, color:'var(--gold)', marginBottom:3 }}>신청 세대</div>
          <div style={{ fontSize:17, fontWeight:700, color:'var(--navy)' }}>{user.dong}동 {user.ho}호</div>
          <div style={{ fontSize:11, color:'var(--gray)', marginTop:2 }}>{user.type} 타입 · {user.area}㎡</div>
        </div>

        {/* 상태 */}
        <div style={statusBox}>
          <div style={{ fontSize:28, marginBottom:8 }}>⏳</div>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--navy)', marginBottom:6 }}>승인 대기 중</div>
          <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.8 }}>
            관리자가 세대를 확인하고 있습니다.<br />
            아래에 인증 정보를 남겨주시면<br />
            더 빠르게 승인받을 수 있습니다.
          </div>
        </div>

        {/* 인증 메모 입력 */}
        <div style={memoSection}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>
            📝 인증 메모
          </div>
          <div style={{ fontSize:10, color:'var(--gray)', marginBottom:12, lineHeight:1.7 }}>
            관리자가 세대 확인에 사용합니다.<br />
            입주 구분 선택 후 확인 메모를 작성해주세요.
          </div>

          {fetched && (
            <>
              {/* 입주 구분 선택 */}
              <div style={{ fontSize:10, color:'var(--gold)', fontWeight:600, letterSpacing:1, marginBottom:6 }}>입주 구분 *</div>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                {['일반분양', '조합원'].map(t => (
                  <button key={t} type="button"
                    style={{ flex:1, padding:'10px', borderRadius:10, fontSize:13,
                      fontWeight: residentType === t ? 700 : 400,
                      border: `1.5px solid ${residentType === t ? 'var(--navy)' : 'var(--border)'}`,
                      background: residentType === t ? 'var(--navy)' : '#FFFFFF',
                      color: residentType === t ? '#FFFFFF' : 'var(--text)', cursor:'pointer' }}
                    onClick={() => { setResidentType(t); setSaved(false); }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* 인증 메모 */}
              <div style={{ fontSize:10, color:'var(--gold)', fontWeight:600, letterSpacing:1, marginBottom:6 }}>확인 메모 *</div>
              <div style={privacyWarn}>
                ⚠️ 이름·전화번호 등 개인정보는 적지 말아 주세요.<br />
                오픈카톡 대화명이나 계약 일자 정도면 충분합니다.
              </div>
              <textarea
                style={textarea}
                placeholder={`예시)\n카카오 대화명: 홍길동\n계약금 납부일: 2026년 4월\n계약서 고유번호: 엘라-0802`}
                value={note}
                onChange={e => { setNote(e.target.value); setSaved(false); }}
                rows={5}
              />
              <button
                style={{
                  ...submitBtn,
                  background: !note.trim() || loading ? 'var(--bg)' : 'var(--navy)',
                  color: !note.trim() || loading ? 'var(--gray)' : '#FFFFFF',
                  border: !note.trim() || loading ? '1px solid var(--border)' : 'none',
                }}
                disabled={!note.trim() || loading}
                onClick={handleSubmit}
              >
                {loading ? '제출 중...' : saved ? '✓ 제출 완료!' : note.trim() ? '인증 메모 제출' : '내용을 입력해주세요'}
              </button>

              {saved && (
                <div style={successNote}>
                  관리자에게 전달됐습니다. 승인 완료 시 앱을 다시 열어 로그인해주세요.
                </div>
              )}
            </>
          )}
        </div>

        {/* 로그아웃 */}
        <button style={logoutBtn} onClick={logout}>로그아웃</button>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(247,245,240,0.98)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20, overflowY: 'auto',
};
const card = {
  width: '100%', maxWidth: 380,
  background: '#FFFFFF', border: '1px solid var(--border)',
  borderRadius: 24, padding: 24,
  boxShadow: 'var(--shadow-lg)',
};
const unitBadge = {
  background: 'rgba(200,168,64,0.07)', border: '1px solid var(--gold-dim)',
  borderRadius: 12, padding: '12px 16px', marginBottom: 16, textAlign: 'center',
};
const statusBox = {
  textAlign: 'center', padding: '16px',
  background: 'rgba(11,40,73,0.03)', border: '1px solid var(--border)',
  borderRadius: 14, marginBottom: 20,
};
const memoSection = {
  background: '#FFFFFF', border: '1px solid var(--border)',
  borderRadius: 14, padding: '16px', marginBottom: 12,
};
const textarea = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--text)',
  lineHeight: 1.8, resize: 'none', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};
const submitBtn = {
  width: '100%', padding: '12px', marginTop: 10,
  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const successNote = {
  marginTop: 10, padding: '8px 12px',
  background: 'rgba(26,144,104,0.07)', border: '1px solid rgba(26,144,104,0.2)',
  borderRadius: 8, fontSize: 11, color: 'var(--green)', lineHeight: 1.7, textAlign: 'center',
};
const privacyWarn = {
  marginBottom: 10,
  padding: '9px 12px',
  background: 'rgba(217,138,0,0.07)',
  border: '1px solid rgba(217,138,0,0.25)',
  borderRadius: 8,
  fontSize: 11,
  color: '#8a6200',
  lineHeight: 1.75,
};
const logoutBtn = {
  width: '100%', padding: '12px', background: 'transparent',
  border: '1px solid rgba(217,69,69,0.35)', borderRadius: 12,
  color: 'var(--red)', fontSize: 13, fontWeight: 600,
};
