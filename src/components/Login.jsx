import { useState } from 'react';
import { DONG_UNIT_MAP } from '../data/ellavineData';
import { useAuth } from '../contexts/AuthContext';

const SECURITY_QUESTIONS = [
  '좋아하는 음식은?',
  '어린 시절 살던 동네는?',
  '첫 번째 반려동물 이름은?',
  '졸업한 초등학교 이름은?',
  '가장 기억에 남는 여행지는?',
  '가장 좋아하는 영화 제목은?',
  '직접 입력',
];

export default function Login() {
  const { signup, loginWithPassword, getSecurityQuestion, resetPassword, isSupabaseReady } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // 회원가입 필드
  const [dong, setDong] = useState('');
  const [ho, setHo] = useState('');
  const [preview, setPreview] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [kakaoNickname, setKakaoNickname] = useState('');
  const [residentType, setResidentType] = useState('일반분양'); // '일반분양' | '조합원'
  const [verifyNote, setVerifyNote] = useState('');
  const [secQuestion, setSecQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [secAnswer, setSecAnswer] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [signupDone, setSignupDone] = useState(false);

  // 로그인 필드
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // 비밀번호 찾기 필드
  const [forgotId, setForgotId] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [forgotDone, setForgotDone] = useState(false);

  function updatePreview(d, h) {
    const unitNum = h.slice(-1);
    const info = DONG_UNIT_MAP[d]?.[unitNum];
    if (d && h.length >= 3 && info) {
      const floor = parseInt(h.slice(0, -2)) || parseInt(h[0]);
      setPreview({ dong: d, ho: h, floor, ...info });
    } else {
      setPreview(null);
    }
  }

  function onDongChange(v) { setDong(v); setErr(''); updatePreview(v, ho); }
  function onHoChange(v)   { setHo(v);  setErr(''); updatePreview(dong, v); }

  function handleSignupStep1() {
    if (!preview) { setErr('올바른 동호수를 입력해주세요'); return; }
    setStep(2); setErr('');
  }

  async function handleSignup() {
    if (!username.trim()) { setErr('아이디를 입력해주세요'); return; }
    if (password.length < 4) { setErr('비밀번호는 4자 이상이어야 합니다'); return; }
    if (password !== passwordConfirm) { setErr('비밀번호가 일치하지 않습니다'); return; }
    if (!kakaoNickname.trim()) { setErr('오픈카톡 대화명을 입력해주세요'); return; }
    if (!verifyNote.trim()) { setErr('관리자 확인용 메모를 입력해주세요'); return; }
    if (secQuestion === '직접 입력' && !customQuestion.trim()) { setErr('보안 질문을 직접 입력해주세요'); return; }
    if (!secAnswer.trim()) { setErr('보안 질문 답변을 입력해주세요'); return; }
    const finalQuestion = secQuestion === '직접 입력' ? customQuestion.trim() : secQuestion;
    setLoading(true);
    const result = await signup(dong, ho, username.trim(), password, kakaoNickname.trim(), residentType, finalQuestion, secAnswer, verifyNote);
    setLoading(false);
    if (!result.ok) { setErr(result.error); return; }
    if (result.pending) setSignupDone(true);
  }

  async function handleLogin() {
    if (!loginId.trim() || !loginPw) { setErr('아이디와 비밀번호를 입력해주세요'); return; }
    setLoading(true);
    const result = await loginWithPassword(loginId.trim(), loginPw);
    setLoading(false);
    if (!result.ok) setErr(result.error);
  }

  // 비밀번호 찾기 Step1: 아이디 → 보안 질문 조회
  async function handleForgotStep1() {
    if (!forgotId.trim()) { setErr('아이디를 입력해주세요'); return; }
    setLoading(true);
    const result = await getSecurityQuestion(forgotId.trim());
    setLoading(false);
    if (!result.ok) { setErr(result.error); return; }
    setForgotQuestion(result.question);
    setStep(2); setErr('');
  }

  // 비밀번호 찾기 Step2: 답변 확인
  function handleForgotStep2() {
    if (!forgotAnswer.trim()) { setErr('답변을 입력해주세요'); return; }
    setStep(3); setErr('');
  }

  // 비밀번호 찾기 Step3: 새 비밀번호 저장
  async function handleForgotReset() {
    if (newPw.length < 4) { setErr('비밀번호는 4자 이상이어야 합니다'); return; }
    if (newPw !== newPwConfirm) { setErr('비밀번호가 일치하지 않습니다'); return; }
    setLoading(true);
    const result = await resetPassword(forgotId.trim(), forgotAnswer, newPw);
    setLoading(false);
    if (!result.ok) { setErr(result.error); return; }
    setForgotDone(true);
  }

  function switchMode(m) {
    setMode(m); setStep(1); setErr('');
    setDong(''); setHo(''); setPreview(null);
    setUsername(''); setPassword(''); setPasswordConfirm('');
    setKakaoNickname(''); setSecAnswer(''); setSecQuestion(SECURITY_QUESTIONS[0]); setCustomQuestion('');
    setResidentType('일반분양'); setVerifyNote(''); setSignupDone(false);
    setLoginId(''); setLoginPw('');
    setForgotId(''); setForgotQuestion(''); setForgotAnswer('');
    setNewPw(''); setNewPwConfirm(''); setForgotDone(false);
  }

  return (
    <div style={overlay}>
      <div style={card}>
        {/* 로고 */}
        <div style={logoArea}>
          <div style={{ width:40, height:2, background:'var(--gold)', margin:'0 auto 14px', borderRadius:1 }} />
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:10, letterSpacing:4, color:'var(--gold)', textTransform:'uppercase', marginBottom:4 }}>RAEMIAN</div>
          <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--navy)' }}>래미안 엘라비네</div>
          <div style={{ fontSize:10, color:'var(--gray)', marginTop:4, letterSpacing:1 }}>입주 예정자 전용</div>
          <div style={{ width:40, height:2, background:'var(--gold)', margin:'14px auto 0', borderRadius:1 }} />
        </div>

        {/* ── 비밀번호 찾기 ── */}
        {mode === 'forgot' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <button style={backLinkBtn} onClick={() => switchMode('login')}>← 로그인으로</button>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>비밀번호 찾기</div>
            <div style={{ fontSize:11, color:'var(--gray)', marginBottom:16, lineHeight:1.6 }}>
              가입 시 설정한 보안 질문으로 비밀번호를 재설정합니다.
            </div>

            {forgotDone ? (
              <div style={successBox}>
                <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--navy)', marginBottom:6 }}>비밀번호가 변경됐습니다</div>
                <button style={btn(false)} onClick={() => switchMode('login')}>로그인하기</button>
              </div>
            ) : (
              <>
                {/* Step 표시 */}
                <div style={stepRow}>
                  {['아이디 확인', '보안 질문', '새 비밀번호'].map((s, i) => (
                    <div key={i} style={{ ...stepDot, ...(step === i + 1 ? stepDotActive : step > i + 1 ? stepDotDone : {}) }}>
                      {step > i + 1 ? '✓' : i + 1}
                    </div>
                  ))}
                </div>

                {step === 1 && (
                  <div>
                    <div style={fieldGroup}>
                      <div style={label}>아이디</div>
                      <input style={input} type="text" placeholder="가입한 아이디" value={forgotId}
                        onChange={e => { setForgotId(e.target.value); setErr(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleForgotStep1()} />
                    </div>
                    {err && <div style={errTxt}>{err}</div>}
                    <button style={btn(loading || !forgotId.trim() || !isSupabaseReady)}
                      disabled={loading || !forgotId.trim() || !isSupabaseReady}
                      onClick={handleForgotStep1}>
                      {loading ? '확인 중...' : '다음'}
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <div style={questionBox}>
                      <div style={{ fontSize:10, color:'var(--gold)', marginBottom:4 }}>보안 질문</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{forgotQuestion}</div>
                    </div>
                    <div style={fieldGroup}>
                      <div style={label}>답변</div>
                      <input style={input} type="text" placeholder="답변 입력" value={forgotAnswer}
                        onChange={e => { setForgotAnswer(e.target.value); setErr(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleForgotStep2()} />
                    </div>
                    {err && <div style={errTxt}>{err}</div>}
                    <div style={{ display:'flex', gap:8 }}>
                      <button style={{ ...btn(false), background:'transparent', border:'1px solid var(--border)', color:'var(--gray)', flex:1 }}
                        onClick={() => { setStep(1); setErr(''); }}>이전</button>
                      <button style={{ ...btn(!forgotAnswer.trim()), flex:2 }}
                        disabled={!forgotAnswer.trim()} onClick={handleForgotStep2}>다음</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <div style={fieldGroup}>
                      <div style={label}>새 비밀번호</div>
                      <input style={input} type="password" placeholder="4자 이상" value={newPw}
                        onChange={e => { setNewPw(e.target.value); setErr(''); }} />
                    </div>
                    <div style={{ ...fieldGroup, marginTop:10 }}>
                      <div style={label}>비밀번호 확인</div>
                      <input style={input} type="password" placeholder="비밀번호 재입력" value={newPwConfirm}
                        onChange={e => { setNewPwConfirm(e.target.value); setErr(''); }} />
                    </div>
                    {err && <div style={errTxt}>{err}</div>}
                    <div style={{ display:'flex', gap:8, marginTop:4 }}>
                      <button style={{ ...btn(false), background:'transparent', border:'1px solid var(--border)', color:'var(--gray)', flex:1 }}
                        onClick={() => { setStep(2); setErr(''); }}>이전</button>
                      <button style={{ ...btn(loading || !newPw || !newPwConfirm), flex:2 }}
                        disabled={loading || !newPw || !newPwConfirm} onClick={handleForgotReset}>
                        {loading ? '변경 중...' : '비밀번호 변경'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 탭 (로그인/회원가입) */}
        {mode !== 'forgot' && (
          <>
            <div style={tabRow}>
              <button style={{ ...tab, ...(mode === 'login' ? tabActive : {}) }} onClick={() => switchMode('login')}>로그인</button>
              <button style={{ ...tab, ...(mode === 'signup' ? tabActive : {}) }} onClick={() => switchMode('signup')}>회원가입</button>
            </div>

            {/* 개인정보 안내 */}
            <div style={privacyBanner}>
              🔒 아이디·닉네임만 사용합니다. 이름·이메일·전화번호 등 개인정보는 일절 수집하지 않습니다.
            </div>
          </>
        )}

        {/* ── 로그인 ── */}
        {mode === 'login' && (
          <div>
            <div style={fieldGroup}>
              <div style={label}>아이디</div>
              <input style={input} type="text" placeholder="가입 시 설정한 아이디" value={loginId}
                onChange={e => { setLoginId(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div style={{ ...fieldGroup, marginTop:10 }}>
              <div style={label}>비밀번호</div>
              <input style={input} type="password" placeholder="비밀번호" value={loginPw}
                onChange={e => { setLoginPw(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {err && <div style={errTxt}>{err}</div>}
            <button style={btn(loading || !isSupabaseReady)} disabled={loading || !isSupabaseReady} onClick={handleLogin}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
            {!isSupabaseReady && (
              <div style={{ fontSize:10, color:'var(--red)', marginTop:6, textAlign:'center' }}>Supabase 연결 필요</div>
            )}
            <div style={{ textAlign:'center', marginTop:12 }}>
              <button style={forgotLink} onClick={() => switchMode('forgot')}>비밀번호를 잊으셨나요?</button>
            </div>
          </div>
        )}

        {/* ── 회원가입 완료(승인 대기) ── */}
        {mode === 'signup' && signupDone && (
          <div style={successBox}>
            <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
            <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:16, fontWeight:600, color:'var(--navy)', marginBottom:8 }}>가입 신청 완료</div>
            <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.8, marginBottom:16 }}>
              관리자 승인 후 서비스를 이용하실 수 있습니다.<br />
              승인은 보통 1~2일 내에 처리됩니다.
            </div>
            <div style={{ background:'rgba(200,168,64,0.08)', border:'1px solid var(--gold-dim)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:11, color:'var(--text-2)' }}>
              신청 세대: <strong style={{ color:'var(--navy)' }}>{dong}동 {ho}호</strong>
              {preview && <span style={{ color:'var(--gold)', marginLeft:8 }}>{preview.type} 타입</span>}
            </div>
            <button style={btn(false)} onClick={() => switchMode('login')}>로그인 화면으로</button>
          </div>
        )}

        {/* ── 회원가입 ── */}
        {mode === 'signup' && !signupDone && (
          <div>
            {step === 1 && (
              <div>
                <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:12 }}>STEP 1 · 동호수 확인</div>
                <div style={unitNotice}>
                  🏠 <strong>세대당 1개의 계정만</strong> 생성할 수 있습니다.<br />
                  이미 가입된 동호수로는 재가입이 불가합니다.
                </div>
                <div style={fieldRow}>
                  <div style={fieldGroup}>
                    <div style={label}>동</div>
                    <select style={select} value={dong} onChange={e => onDongChange(e.target.value)}>
                      <option value="">선택</option>
                      {['101','102','103','104','105','106','107','108','109','110'].map(d => (
                        <option key={d} value={d}>{d}동</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ ...fieldGroup, flex:2 }}>
                    <div style={label}>호수</div>
                    <input style={input} type="text" inputMode="numeric" placeholder="예: 0802"
                      value={ho} onChange={e => onHoChange(e.target.value)} />
                  </div>
                </div>
                {preview && (
                  <div style={previewBox}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)', marginBottom:2 }}>{preview.dong}동 {preview.ho}호</div>
                    <div style={{ fontSize:11, color:'var(--gold)' }}>{preview.type} 타입 · 전용 {preview.area}㎡ · {preview.floor}층</div>
                  </div>
                )}
                {err && <div style={errTxt}>{err}</div>}
                <button style={btn(!preview)} disabled={!preview} onClick={handleSignupStep1}>다음</button>
              </div>
            )}

            {step === 2 && (
              <div>
                <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:12 }}>STEP 2 · 계정 설정</div>
                <div style={previewBox}>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--navy)' }}>{dong}동 {ho}호</span>
                  {preview && <span style={{ fontSize:11, color:'var(--gold)', marginLeft:8 }}>{preview.type} · {preview.area}㎡</span>}
                </div>

                <div style={fieldGroup}>
                  <div style={label}>아이디 <span style={{ color:'var(--red)' }}>*</span></div>
                  <input style={input} type="text" placeholder="영문/숫자, 2자 이상" value={username}
                    onChange={e => { setUsername(e.target.value); setErr(''); }} />
                </div>
                <div style={{ ...fieldGroup, marginTop:10 }}>
                  <div style={label}>비밀번호 <span style={{ color:'var(--red)' }}>*</span></div>
                  <input style={input} type="password" placeholder="4자 이상" value={password}
                    onChange={e => { setPassword(e.target.value); setErr(''); }} />
                </div>
                <div style={{ ...fieldGroup, marginTop:10 }}>
                  <div style={label}>비밀번호 확인 <span style={{ color:'var(--red)' }}>*</span></div>
                  <input style={input} type="password" placeholder="비밀번호 재입력" value={passwordConfirm}
                    onChange={e => { setPasswordConfirm(e.target.value); setErr(''); }} />
                </div>
                <div style={{ ...fieldGroup, marginTop:10 }}>
                  <div style={label}>커뮤니티 닉네임 <span style={{ color:'var(--red)' }}>*</span></div>
                  <input style={input} type="text" placeholder="커뮤니티에서 표시될 이름" value={kakaoNickname}
                    onChange={e => { setKakaoNickname(e.target.value); setErr(''); }} />
                  <div style={{ fontSize:10, color:'var(--gray)', marginTop:2, lineHeight:1.6 }}>
                    닉네임만 공개되며, 동호수는 다른 회원에게 노출되지 않습니다.
                  </div>
                </div>

                {/* 입주 구분 */}
                <div style={{ height:1, background:'var(--border)', margin:'14px 0' }} />
                <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:10 }}>🏠 입주 구분</div>
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  {['일반분양', '조합원'].map(t => (
                    <button key={t} type="button"
                      style={{ flex:1, padding:'10px', borderRadius:10, fontSize:13, fontWeight: residentType === t ? 700 : 400,
                        border: `1.5px solid ${residentType === t ? 'var(--navy)' : 'var(--border)'}`,
                        background: residentType === t ? 'var(--navy)' : '#FFFFFF',
                        color: residentType === t ? '#FFFFFF' : 'var(--text)', cursor:'pointer' }}
                      onClick={() => setResidentType(t)}>
                      {t}
                    </button>
                  ))}
                </div>

                {/* 인증 메모 */}
                <div style={fieldGroup}>
                  <div style={label}>관리자 확인용 메모 <span style={{ color:'var(--red)' }}>*</span></div>
                  <div style={{ margin:'6px 0 8px', padding:'9px 12px', background:'rgba(217,138,0,0.07)', border:'1px solid rgba(217,138,0,0.25)', borderRadius:8, fontSize:11, color:'#8a6200', lineHeight:1.75 }}>
                    ⚠️ 이름·전화번호 등 개인정보는 적지 말아 주세요.<br />
                    오픈카톡 대화명이나 계약 일자 정도면 충분합니다.
                  </div>
                  <textarea style={{ ...input, resize:'none', height:64, lineHeight:1.6 }}
                    placeholder={`예) 카카오 대화명: OOO\n계약금 납부일: 2026년 4월`}
                    value={verifyNote} onChange={e => setVerifyNote(e.target.value)} />
                </div>

                {/* 보안 질문 */}
                <div style={{ height:1, background:'var(--border)', margin:'14px 0' }} />
                <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:10 }}>🔑 비밀번호 찾기 설정</div>
                <div style={{ ...fieldGroup }}>
                  <div style={label}>보안 질문 <span style={{ color:'var(--red)' }}>*</span></div>
                  <select style={select} value={secQuestion} onChange={e => { setSecQuestion(e.target.value); setCustomQuestion(''); setErr(''); }}>
                    {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                {secQuestion === '직접 입력' && (
                  <div style={{ ...fieldGroup, marginTop:10 }}>
                    <div style={label}>질문 직접 입력 <span style={{ color:'var(--red)' }}>*</span></div>
                    <input style={input} type="text" placeholder="나만 알 수 있는 질문을 입력하세요" value={customQuestion}
                      onChange={e => { setCustomQuestion(e.target.value); setErr(''); }} />
                  </div>
                )}
                <div style={{ ...fieldGroup, marginTop:10 }}>
                  <div style={label}>답변 <span style={{ color:'var(--red)' }}>*</span></div>
                  <input style={input} type="text" placeholder="답변 (대소문자 무관)" value={secAnswer}
                    onChange={e => { setSecAnswer(e.target.value); setErr(''); }} />
                </div>

                {err && <div style={errTxt}>{err}</div>}

                <div style={{ display:'flex', gap:8, marginTop:14 }}>
                  <button style={{ ...btn(false), background:'transparent', border:'1px solid var(--border)', color:'var(--gray)', flex:1 }}
                    onClick={() => { setStep(1); setErr(''); }}>이전</button>
                  <button style={{ ...btn(loading || !isSupabaseReady), flex:2 }}
                    disabled={loading || !isSupabaseReady} onClick={handleSignup}>
                    {loading ? '가입 중...' : '가입하기'}
                  </button>
                </div>
                {!isSupabaseReady && (
                  <div style={{ fontSize:10, color:'var(--red)', marginTop:6, textAlign:'center' }}>Supabase 연결 필요</div>
                )}
              </div>
            )}
          </div>
        )}

        {mode !== 'forgot' && (
          <div style={{ marginTop:20, fontSize:10, color:'var(--gray)', lineHeight:1.8, textAlign:'center' }}>
            수집 항목: 동호수 · 아이디 · 닉네임만 저장됩니다.<br />
            실명 · 이메일 · 전화번호는 수집하지 않습니다.
          </div>
        )}
      </div>
    </div>
  );
}

const overlay = {
  position:'fixed', inset:0, background:'rgba(247,245,240,0.98)',
  display:'flex', alignItems:'center', justifyContent:'center',
  zIndex:1000, padding:20,
};
const card = {
  width:'100%', maxWidth:400, background:'#FFFFFF',
  border:'1px solid var(--border)', borderRadius:24, padding:24,
  boxShadow:'var(--shadow-lg)', maxHeight:'90vh', overflowY:'auto',
};
const logoArea = { textAlign:'center', marginBottom:20 };
const tabRow = { display:'flex', background:'var(--bg)', borderRadius:12, padding:3, marginBottom:16, gap:3 };
const tab = { flex:1, padding:'8px', background:'transparent', border:'none', borderRadius:10, fontSize:13, color:'var(--gray)', cursor:'pointer', fontWeight:500 };
const tabActive = { background:'#FFFFFF', color:'var(--navy)', fontWeight:700, boxShadow:'var(--shadow-sm)' };
const privacyBanner = {
  background:'rgba(0,143,175,0.05)', border:'1px solid rgba(0,143,175,0.15)',
  borderRadius:8, padding:'8px 12px', fontSize:10, color:'var(--text-2)',
  lineHeight:1.7, marginBottom:16,
};
const fieldRow = { display:'flex', gap:10, marginBottom:12 };
const fieldGroup = { flex:1, display:'flex', flexDirection:'column', gap:5 };
const label = { fontSize:10, color:'var(--gray)', letterSpacing:0.5 };
const select = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:10, padding:'10px 12px', color:'var(--text)', fontSize:13, width:'100%',
};
const input = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:10, padding:'10px 12px', color:'var(--text)', fontSize:13, width:'100%',
  outline:'none', boxSizing:'border-box',
};
const previewBox = {
  background:'rgba(200,168,64,0.06)', border:'1px solid var(--gold-dim)',
  borderRadius:10, padding:'8px 12px', marginBottom:10,
};
const questionBox = {
  background:'rgba(11,40,73,0.04)', border:'1px solid rgba(11,40,73,0.12)',
  borderRadius:10, padding:'10px 14px', marginBottom:12,
};
const errTxt = { fontSize:11, color:'var(--red)', marginTop:6, marginBottom:2 };
const successBox = {
  textAlign:'center', padding:'20px', background:'rgba(26,144,104,0.05)',
  border:'1px solid rgba(26,144,104,0.2)', borderRadius:14,
};
const stepRow = { display:'flex', justifyContent:'center', gap:8, marginBottom:20 };
const stepDot = {
  width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
  fontSize:11, fontWeight:700, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--gray)',
};
const stepDotActive = { background:'var(--navy)', border:'1px solid var(--navy)', color:'#FFFFFF' };
const stepDotDone  = { background:'var(--green)', border:'1px solid var(--green)', color:'#FFFFFF' };
const forgotLink = {
  fontSize:11, color:'var(--gray)', background:'transparent', border:'none',
  cursor:'pointer', textDecoration:'underline', padding:0,
};
const unitNotice = {
  background:'rgba(11,40,73,0.04)', border:'1px solid rgba(11,40,73,0.12)',
  borderRadius:9, padding:'9px 12px', fontSize:11, color:'var(--text-2)',
  lineHeight:1.7, marginBottom:12,
};
const backLinkBtn = {
  fontSize:11, color:'var(--gold)', background:'transparent', border:'none',
  cursor:'pointer', padding:0, fontWeight:600,
};
const btn = (disabled) => ({
  width:'100%', padding:'12px', marginTop:10,
  background: disabled ? 'var(--bg)' : 'var(--gold)',
  color: disabled ? 'var(--gray)' : 'var(--navy)',
  border: disabled ? '1px solid var(--border)' : 'none',
  borderRadius:12, fontSize:14, fontWeight:700,
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
});
