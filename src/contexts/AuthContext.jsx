import { createContext, useContext, useState, useEffect } from 'react';
import { DONG_UNIT_MAP, STORAGE_KEY } from '../data/ellavineData';
import { supabase, isSupabaseReady } from '../lib/supabase';

const AuthContext = createContext(null);

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setLoading(false);
  }, []);

  // 회원가입: 동/호수/아이디/비번/카카오닉네임/입주구분/보안질문/인증메모
  async function signup(dong, ho, username, password, kakaoNickname, residentType, securityQuestion, securityAnswer, verifyNote) {
    const unitNum = ho.slice(-1);
    const info = DONG_UNIT_MAP[dong]?.[unitNum];
    if (!info) return { ok: false, error: '올바른 동호수를 입력해주세요' };
    if (!username || username.length < 2) return { ok: false, error: '아이디는 2자 이상이어야 합니다' };
    if (!password || password.length < 4) return { ok: false, error: '비밀번호는 4자 이상이어야 합니다' };

    if (!isSupabaseReady) return { ok: false, error: 'Supabase 연결이 필요합니다' };

    // 아이디 중복 확인
    const { data: existing } = await supabase.from('residents').select('id').eq('username', username).maybeSingle();
    if (existing) return { ok: false, error: '이미 사용 중인 아이디입니다' };

    // 동호수 중복 확인
    const { data: existingUnit } = await supabase.from('residents').select('id').eq('dong', dong).eq('ho', ho).maybeSingle();
    if (existingUnit) return { ok: false, error: '이미 가입된 동호수입니다' };

    const floor = parseInt(ho.slice(0, -2)) || parseInt(ho[0]);
    const nickname = kakaoNickname.trim() || `${dong}동${ho}호`;
    const passwordHash = await sha256(password + dong + ho);
    const secAnswerHash = securityAnswer?.trim()
      ? await sha256(securityAnswer.trim().toLowerCase() + username + '_security')
      : null;

    const { error } = await supabase.from('residents').insert({
      dong, ho, username, password_hash: passwordHash,
      kakao_nickname: kakaoNickname.trim() || null,
      nickname, type: info.type, area: info.area, floor,
      resident_type: residentType || '일반분양',
      verify_note: verifyNote?.trim() || null,
      security_question: securityQuestion || null,
      security_answer_hash: secAnswerHash,
      is_approved: false,
    });

    if (error) return { ok: false, error: '가입 오류: ' + error.message };
    // 자동 로그인 없이 승인 대기 상태로 반환
    return { ok: true, pending: true };
  }

  // 비밀번호 찾기 Step1: 보안 질문 조회
  async function getSecurityQuestion(username) {
    if (!isSupabaseReady) return { ok: false, error: 'Supabase 연결이 필요합니다' };
    const { data } = await supabase.from('residents').select('security_question').eq('username', username).maybeSingle();
    if (!data) return { ok: false, error: '존재하지 않는 아이디입니다' };
    if (!data.security_question) return { ok: false, error: '보안 질문이 설정되지 않은 계정입니다' };
    return { ok: true, question: data.security_question };
  }

  // 비밀번호 찾기 Step2+3: 답변 검증 후 비밀번호 재설정
  async function resetPassword(username, securityAnswer, newPassword) {
    if (!isSupabaseReady) return { ok: false, error: 'Supabase 연결이 필요합니다' };
    if (!newPassword || newPassword.length < 4) return { ok: false, error: '비밀번호는 4자 이상이어야 합니다' };

    const { data } = await supabase.from('residents')
      .select('security_answer_hash, dong, ho, is_admin')
      .eq('username', username).maybeSingle();
    if (!data) return { ok: false, error: '존재하지 않는 아이디입니다' };

    const answerHash = await sha256(securityAnswer.trim().toLowerCase() + username + '_security');
    if (answerHash !== data.security_answer_hash) return { ok: false, error: '답변이 올바르지 않습니다' };

    const salt = data.is_admin ? 'admin_ellavine' : (data.dong + data.ho);
    const newHash = await sha256(newPassword + salt);
    const { error } = await supabase.from('residents').update({ password_hash: newHash }).eq('username', username);
    if (error) return { ok: false, error: '비밀번호 변경 중 오류가 발생했습니다' };
    return { ok: true };
  }

  // 관리자 계정 생성 (동호수 없이)
  async function adminSignup(username, password) {
    if (!isSupabaseReady) return { ok: false, error: 'Supabase 연결이 필요합니다' };
    if (!username || username.length < 2) return { ok: false, error: '아이디는 2자 이상이어야 합니다' };
    if (!password || password.length < 4) return { ok: false, error: '비밀번호는 4자 이상이어야 합니다' };

    const { data: existing } = await supabase.from('residents').select('id').eq('username', username).maybeSingle();
    if (existing) return { ok: false, error: '이미 사용 중인 아이디입니다' };

    const passwordHash = await sha256(password + 'admin_ellavine');
    const { error } = await supabase.from('residents').insert({
      dong: 'admin', ho: '0000', username,
      password_hash: passwordHash, nickname: '관리자', is_admin: true,
    });
    if (error) return { ok: false, error: '계정 생성 오류: ' + error.message };

    const u = { username, nickname: '관리자', isAdmin: true, loginAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch {}
    setUser(u);
    return { ok: true };
  }

  // 로그인: 아이디 + 비번
  async function loginWithPassword(username, password) {
    if (!isSupabaseReady) return { ok: false, error: 'Supabase 연결이 필요합니다' };

    const { data } = await supabase.from('residents').select('*').eq('username', username).maybeSingle();
    if (!data) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다' };

    // 관리자는 별도 salt 사용
    const salt = data.is_admin ? 'admin_ellavine' : (data.dong + data.ho);
    const hash = await sha256(password + salt);
    if (hash !== data.password_hash) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다' };

    // 타입·면적은 DB 저장값 대신 항상 최신 DONG_UNIT_MAP에서 재조회 (데이터 수정 시 자동 반영)
    const unitNum = data.ho?.slice(-1);
    const freshInfo = DONG_UNIT_MAP[data.dong]?.[unitNum];
    const u = data.is_admin
      ? { username: data.username, nickname: '관리자', isAdmin: true, isApproved: true, loginAt: new Date().toISOString() }
      : { dong: data.dong, ho: data.ho, floor: data.floor,
          type: freshInfo?.type || data.type,
          area: freshInfo?.area || data.area,
          nickname: data.nickname, username: data.username,
          isApproved: !!data.is_approved,
          loginAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch {}
    setUser(u);
    return { ok: true };
  }

  // 기존 동호수 입장 (Supabase 없을 때 fallback)
  function login(dong, ho, nickname) {
    const floor = parseInt(ho.slice(0, -2)) || parseInt(ho[0]);
    const unitNum = ho.slice(-1);
    const info = DONG_UNIT_MAP[dong]?.[unitNum];
    if (!info) return false;
    const displayName = nickname.trim() || `${dong}동${ho}호`;
    const u = { dong, ho, floor, type: info.type, area: info.area, nickname: displayName, loginAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch {}
    setUser(u);
    return true;
  }

  // 회원 탈퇴 (본인 또는 관리자가 대상 username 전달)
  async function deleteAccount(targetUsername) {
    if (!isSupabaseReady) return { ok: false, error: 'Supabase 연결 필요' };
    const { error } = await supabase.from('residents').delete().eq('username', targetUsername);
    if (error) return { ok: false, error: error.message };
    // 본인 탈퇴인 경우 로그아웃 처리
    if (user?.username === targetUsername) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setUser(null);
    }
    return { ok: true };
  }

  function logout() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithPassword, signup, logout, deleteAccount, getSecurityQuestion, resetPassword, isSupabaseReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
