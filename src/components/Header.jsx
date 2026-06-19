import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Header({ onTabSwitch }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleMyUnit() {
    setMenuOpen(false);
    onTabSwitch('payment');
  }

  return (
    <header style={header}>
      <div style={{ cursor:'pointer' }} onClick={() => onTabSwitch('home')}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:9, letterSpacing:3, color:'var(--gold)', textTransform:'uppercase' }}>RAEMIAN</div>
        <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:14, fontWeight:600, color:'var(--navy)', letterSpacing:1 }}>래미안 엘라비네</div>
      </div>

      {user && (
        <div style={{ position:'relative' }}>
          <div style={chip} onClick={() => setMenuOpen(o => !o)}>
            <div style={dot} />
            <span style={{ fontSize:12, color:'var(--text)' }}>{user.nickname}</span>
          </div>

          {menuOpen && (
            <>
              <div style={backdrop} onClick={() => setMenuOpen(false)} />
              <div style={menu}>
                <div style={menuItem}>
                  {user.isAdmin ? (
                    <div style={{ fontSize:11, color:'var(--gold)', marginBottom:2 }}>🔐 관리자 계정</div>
                  ) : (
                    <>
                      <div style={{ fontSize:11, color:'var(--gold)', marginBottom:2 }}>{user.dong}동 {user.ho}호</div>
                      <div style={{ fontSize:10, color:'var(--gray)' }}>{user.type} 타입 · {user.floor}층</div>
                    </>
                  )}
                </div>
                <div style={divider} />
                {!user.isAdmin && <button style={menuBtn} onClick={handleMyUnit}>내 세대 납부현황</button>}
                <button style={{ ...menuBtn, color:'var(--red)' }} onClick={() => { setMenuOpen(false); logout(); }}>로그아웃</button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

const header = {
  position:'fixed', top:0, left:0, right:0, zIndex:200,
  padding:'14px 18px',
  background:'rgba(255,255,255,0.96)',
  borderBottom:'1px solid var(--border)',
  backdropFilter:'blur(20px)',
  display:'flex', justifyContent:'space-between', alignItems:'center',
  boxShadow:'0 1px 12px rgba(11,40,73,0.06)',
};
const chip = {
  display:'flex', alignItems:'center', gap:6, cursor:'pointer',
  border:'1px solid var(--border)', borderRadius:20, padding:'5px 12px',
  background:'rgba(255,255,255,0.8)',
};
const dot = { width:8, height:8, borderRadius:'50%', background:'var(--green)' };
const backdrop = { position:'fixed', inset:0, zIndex:199 };
const menu = {
  position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300,
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:14, padding:8, minWidth:160,
  boxShadow:'var(--shadow-lg)',
  animation:'fadeIn 0.15s ease',
};
const menuItem = { padding:'8px 12px' };
const divider = { height:1, background:'var(--border)', margin:'4px 0' };
const menuBtn = {
  display:'block', width:'100%', textAlign:'left', padding:'8px 12px',
  background:'transparent', border:'none', color:'var(--text)', fontSize:12,
  borderRadius:8,
};
