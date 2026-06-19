import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseReady } from '../lib/supabase';

// VAPID 공개키 (서버와 동일해야 함)
const VAPID_PUBLIC_KEY = 'BDdfyU9c5kGCjCf-XeltTWBIHeSMZjSQTnFkNnkch7RKv5kXX9RzsEmvVYM_T7GA8PylkhWuIYTsbzRiVDSxF0w';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function MyPage({ onTabSwitch, onEnterAdmin }) {
  const { user, logout, deleteAccount } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [saved, setSaved] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [showUnitEdit, setShowUnitEdit] = useState(false);
  const [newDong, setNewDong] = useState(String(user?.dong || ''));
  const [newHo, setNewHo] = useState(String(user?.ho || ''));

  // ── 푸시 알림 상태 ──────────────────────────
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPerm, setNotifPerm]     = useState('default'); // default | granted | denied
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMsg, setNotifMsg]       = useState('');

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setNotifSupported(ok);
    if (ok) setNotifPerm(Notification.permission);
  }, []);

  async function toggleNotification() {
    if (!notifSupported) return;
    setNotifLoading(true);
    setNotifMsg('');

    try {
      const swReg = await navigator.serviceWorker.ready;

      if (notifPerm === 'granted') {
        // 구독 해제
        const existing = await swReg.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe();
          await fetch('/api/push-subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: existing.endpoint }),
          });
        }
        setNotifPerm('default');
        setNotifMsg('알림이 해제되었습니다');
      } else {
        // 구독 신청
        const permission = await Notification.requestPermission();
        setNotifPerm(permission);
        if (permission !== 'granted') {
          setNotifMsg('알림 권한이 거부되었습니다. 브라우저 설정에서 변경해 주세요.');
          setNotifLoading(false);
          return;
        }

        const sub = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), username: user?.username }),
        });

        setNotifMsg('납부일 D-7, D-1 알림이 설정되었습니다 ✓');
      }
    } catch (e) {
      setNotifMsg(`오류: ${e.message}`);
    }
    setNotifLoading(false);
  }
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitSaved, setUnitSaved] = useState(false);

  async function handleWithdraw() {
    setWithdrawLoading(true);
    await deleteAccount(user.username);
    setWithdrawLoading(false);
  }

  async function saveUnitChange() {
    if (!newDong.trim() || !newHo.trim()) return;
    if (!window.confirm(`동/호수를 ${newDong}동 ${newHo}호로 변경하시겠습니까?\n변경 후 관리자 재승인이 필요합니다.`)) return;
    setUnitSaving(true);
    if (isSupabaseReady && user) {
      await supabase.from('residents')
        .update({ dong: newDong.trim(), ho: newHo.trim(), is_approved: false })
        .eq('username', user.username);
    }
    // 로컬에도 반영
    localStorage.setItem('ellavine_dong', newDong.trim());
    localStorage.setItem('ellavine_ho', newHo.trim());
    setUnitSaving(false);
    setUnitSaved(true);
    setShowUnitEdit(false);
    setTimeout(() => setUnitSaved(false), 3000);
  }

  async function saveNickname() {
    if (!nickname.trim()) return;
    if (isSupabaseReady && user) {
      await supabase.from('residents').upsert({
        dong: user.dong, ho: user.ho, nickname: nickname.trim(),
        type: user.type, area: user.area, floor: user.floor,
      }, { onConflict: 'dong,ho' });
    }
    localStorage.setItem('ellavine_nickname', nickname.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!user) return null;

  /* ── 관리자 전용 뷰 ── */
  if (user.isAdmin) {
    return (
      <div style={wrap}>
        <div style={sectionTitle}>관리자</div>
        <div style={sectionSub}>엘라비네 관리자 계정</div>
        <div style={goldLine} />

        <div style={profileCard}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', borderRadius:'16px 16px 0 0' }} />
          <div style={{ textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(200,168,64,0.12)', border:'2px solid var(--gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 10px' }}>🔐</div>
            <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:18, fontWeight:600, color:'var(--navy)' }}>관리자</div>
            <div style={{ fontSize:12, color:'var(--gold)', marginTop:4 }}>{user.username}</div>
          </div>
        </div>

        <button style={adminEnterBtn} onClick={onEnterAdmin}>
          🛠️ 관리자 페이지 입장 →
        </button>

        <button style={logoutBtn} onClick={logout}>로그아웃</button>
      </div>
    );
  }

  /* ── 일반 유저 뷰 ── */
  return (
    <div style={wrap}>
      <div style={sectionTitle}>마이페이지</div>
      <div style={sectionSub}>내 세대 정보 및 설정</div>
      <div style={goldLine} />

      {/* 세대 정보 */}
      <div style={profileCard}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', borderRadius:'16px 16px 0 0' }} />
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(200,168,64,0.1)', border:'2px solid var(--gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 10px' }}>🏠</div>
          <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:18, fontWeight:600, color:'var(--navy)' }}>{user.dong}동 {user.ho}호</div>
          <div style={{ fontSize:12, color:'var(--gold)', marginTop:4 }}>{user.type} 타입 · {user.area}㎡ · {user.floor}층</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[['동', `${user.dong}동`], ['호수', `${user.ho}호`], ['타입', `${user.type} 타입`], ['층수', `${user.floor}층`]].map(([k,v]) => (
            <div key={k} style={infoChip}>
              <div style={{ fontSize:9, color:'var(--gray)', marginBottom:3 }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 닉네임 설정 */}
      <div style={card}>
        <div style={cardLabel}>닉네임 변경</div>
        <div style={{ display:'flex', gap:8 }}>
          <input style={input} value={nickname} onChange={e => setNickname(e.target.value)} maxLength={8} placeholder="닉네임 (최대 8자)" />
          <button style={saveBtn} onClick={saveNickname}>{saved ? '✓' : '저장'}</button>
        </div>
      </div>

      {/* 동/호수 수정 */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showUnitEdit ? 12 : 0 }}>
          <div style={cardLabel}>동·호수 변경</div>
          <button
            onClick={() => setShowUnitEdit(o => !o)}
            style={{ fontSize:11, padding:'4px 10px', background:'rgba(11,40,73,0.06)', border:'1px solid rgba(11,40,73,0.15)', borderRadius:7, color:'var(--navy)', cursor:'pointer' }}>
            {showUnitEdit ? '취소' : '✏️ 수정'}
          </button>
        </div>
        {unitSaved && (
          <div style={{ fontSize:11, color:'var(--navy)', background:'rgba(11,40,73,0.06)', borderRadius:8, padding:'8px 10px', marginBottom:8 }}>
            ✅ 변경 신청 완료. 관리자 승인 후 이용 가능합니다.
          </div>
        )}
        {showUnitEdit && (
          <>
            <div style={{ fontSize:11, color:'var(--red)', marginBottom:10, lineHeight:1.6 }}>
              ⚠️ 변경 후 관리자 재승인이 필요합니다. 승인 전까지 일부 기능이 제한됩니다.
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                value={newDong} onChange={e => setNewDong(e.target.value)}
                placeholder="동" maxLength={3}
                style={{ ...input, width:56, textAlign:'center' }}
              />
              <span style={{ fontSize:13 }}>동</span>
              <input
                value={newHo} onChange={e => setNewHo(e.target.value)}
                placeholder="호수" maxLength={5}
                style={{ ...input, width:72, textAlign:'center' }}
              />
              <span style={{ fontSize:13 }}>호</span>
              <button
                style={{ ...saveBtn, opacity: unitSaving ? 0.5 : 1 }}
                disabled={unitSaving}
                onClick={saveUnitChange}>
                {unitSaving ? '...' : '변경'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 메뉴 */}
      <div style={card}>
        <div style={menuRow} onClick={() => onTabSwitch('payment')}>
          <span>💰 내 세대 납부현황</span><span style={{ color:'var(--gray)' }}>›</span>
        </div>
        <div style={menuRow} onClick={() => onTabSwitch('community')}>
          <span>💬 커뮤니티 게시판</span><span style={{ color:'var(--gray)' }}>›</span>
        </div>
      </div>

      {/* 🔔 푸시 알림 설정 */}
      {notifSupported && (
        <div style={card}>
          <div style={cardLabel}>납부일 알림</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: notifMsg ? 10 : 0 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                🔔 납부일 D-7 · D-1 알림
              </div>
              <div style={{ fontSize:10, color:'var(--gray)', marginTop:3, lineHeight:1.5 }}>
                {notifPerm === 'granted'
                  ? '알림 ON — 납부일 7일·1일 전 자동 발송'
                  : notifPerm === 'denied'
                  ? '브라우저에서 알림이 차단되어 있습니다'
                  : '중도금 납부일을 잊지 않도록 알려드립니다'}
              </div>
            </div>
            <button
              onClick={toggleNotification}
              disabled={notifLoading || notifPerm === 'denied'}
              style={{
                padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
                background: notifPerm === 'granted' ? 'rgba(217,69,69,0.1)' : 'var(--navy)',
                color:      notifPerm === 'granted' ? 'var(--red)'          : '#FFFFFF',
                opacity: (notifLoading || notifPerm === 'denied') ? 0.5 : 1,
                flexShrink: 0,
              }}>
              {notifLoading ? '...' : notifPerm === 'granted' ? '해제' : '켜기'}
            </button>
          </div>
          {notifMsg && (
            <div style={{ fontSize:11, color: notifMsg.includes('오류') ? 'var(--red)' : 'var(--navy)',
              background: notifMsg.includes('오류') ? 'rgba(217,69,69,0.06)' : 'rgba(11,40,73,0.05)',
              borderRadius:8, padding:'8px 10px', lineHeight:1.5 }}>
              {notifMsg}
            </div>
          )}
          {notifPerm === 'denied' && (
            <div style={{ fontSize:10, color:'var(--gray)', marginTop:6, lineHeight:1.6 }}>
              💡 브라우저 주소창 옆 자물쇠 아이콘 → 알림 허용으로 변경하세요
            </div>
          )}
        </div>
      )}

      {/* 로그아웃 */}
      <button style={logoutBtn} onClick={logout}>로그아웃</button>

      {/* 회원탈퇴 */}
      {!showWithdraw ? (
        <button style={withdrawLink} onClick={() => setShowWithdraw(true)}>회원 탈퇴</button>
      ) : (
        <div style={withdrawBox}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--red)', marginBottom:6 }}>⚠️ 정말 탈퇴하시겠습니까?</div>
          <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.7, marginBottom:12 }}>
            계정과 작성한 게시글이 모두 삭제됩니다.<br/>재가입 시 관리자 승인이 다시 필요합니다.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ flex:1, padding:'10px', background:'transparent', border:'1px solid var(--border)', borderRadius:9, fontSize:12, color:'var(--gray)' }}
              onClick={() => setShowWithdraw(false)}>취소</button>
            <button style={{ flex:1, padding:'10px', background:'var(--red)', border:'none', borderRadius:9, fontSize:12, fontWeight:700, color:'#FFF', opacity: withdrawLoading ? 0.5 : 1 }}
              disabled={withdrawLoading} onClick={handleWithdraw}>
              {withdrawLoading ? '처리 중...' : '탈퇴 확인'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop:16, fontSize:10, color:'var(--gray)', textAlign:'center', lineHeight:1.7 }}>
        개인정보는 기기 내에만 저장됩니다.<br/>서버에는 동·호수와 닉네임만 익명 저장됩니다.
      </div>
    </div>
  );
}

const wrap = { padding:'16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };
const profileCard = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16, padding:'20px 16px', marginBottom:12, position:'relative', overflow:'hidden', boxShadow:'var(--shadow)' };
const infoChip = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px' };
const card = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:12, boxShadow:'var(--shadow-sm)' };
const cardLabel = { fontSize:10, color:'var(--gold)', letterSpacing:1.5, marginBottom:10, fontWeight:600 };
const input = { flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', color:'var(--text)', fontSize:13, outline:'none' };
const saveBtn = { padding:'9px 14px', background:'var(--navy)', border:'none', borderRadius:8, color:'#FFFFFF', fontSize:12, fontWeight:600, flexShrink:0 };
const menuRow = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 4px', fontSize:13, color:'var(--text)', cursor:'pointer', borderBottom:'1px solid var(--border)' };
const adminEnterBtn = { width:'100%', padding:'14px', background:'var(--navy)', border:'none', borderRadius:12, color:'#FFFFFF', fontSize:14, fontWeight:700, marginBottom:12, letterSpacing:0.5 };
const logoutBtn = { width:'100%', padding:'13px', background:'transparent', border:'1px solid rgba(217,69,69,0.4)', borderRadius:12, color:'var(--red)', fontSize:13, fontWeight:600, marginTop:8 };
const withdrawLink = { display:'block', width:'100%', padding:'10px', background:'transparent', border:'none', fontSize:11, color:'var(--gray)', textDecoration:'underline', marginTop:12, cursor:'pointer', textAlign:'center' };
const withdrawBox = { marginTop:12, background:'rgba(217,69,69,0.05)', border:'1px solid rgba(217,69,69,0.2)', borderRadius:12, padding:'14px 16px' };
