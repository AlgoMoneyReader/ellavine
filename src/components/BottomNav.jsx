const TABS = [
  { key:'home',        icon:'🏠', label:'홈' },
  { key:'payment',     icon:'💰', label:'납부' },
  { key:'orientation', icon:'🧭', label:'조망' },
  { key:'map',         icon:'🗺️', label:'지도' },
  { key:'community',   icon:'💬', label:'커뮤' },
  { key:'facilities',  icon:'🏛️', label:'시설' },
  { key:'news',        icon:'📰', label:'뉴스' },
  { key:'realtrade',   icon:'📈', label:'시세' },
  { key:'school',      icon:'🏫', label:'학군' },
  { key:'ai',          icon:'🤖', label:'AI' },
  { key:'mypage',      icon:'👤', label:'마이' },
];

export default function BottomNav({ active, onSwitch }) {
  return (
    <nav style={nav}>
      <div style={tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            style={{ ...tab, ...(active === t.key ? tabActive : {}) }}
            onClick={() => onSwitch(t.key)}
          >
            <span style={{ fontSize:14, display:'block', marginBottom:1 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

const nav = {
  position:'fixed', bottom:0, left:0, right:0, zIndex:200,
  background:'rgba(255,255,255,0.97)',
  borderTop:'1px solid var(--border)',
  backdropFilter:'blur(20px)',
  paddingBottom:'env(safe-area-inset-bottom)',
  boxShadow:'0 -2px 16px rgba(11,40,73,0.06)',
};
const tabs = {
  display:'flex', gap:0,
  padding:'4px 2px',
};
const tab = {
  flex:1, padding:'7px 1px', background:'transparent', border:'none',
  color:'var(--gray)', fontSize:8, letterSpacing:0.2, borderRadius:8,
  transition:'all 0.2s',
};
const tabActive = {
  background:'var(--navy)', color:'#FFFFFF', fontWeight:700,
};
