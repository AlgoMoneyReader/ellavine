import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Header from './components/Header';
import Hero from './components/Hero';
import BottomNav from './components/BottomNav';
import MyPage from './components/MyPage';
import AdminPage from './components/AdminPage';
import PaymentTab from './components/tabs/PaymentTab';
import OrientationTab from './components/tabs/OrientationTab';
import MapTab from './components/tabs/MapTab';
import NewsTab from './components/tabs/NewsTab';
import CommunityTab from './components/tabs/CommunityTab';
import AIChatTab from './components/tabs/AIChatTab';
import FacilitiesTab from './components/tabs/FacilitiesTab';
import RealTradeTab from './components/tabs/RealTradeTab';
import SchoolTab from './components/tabs/SchoolTab';
import FloatingAI from './components/FloatingAI';
import PendingScreen from './components/PendingScreen';

function AppInner() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState('home');
  const [showAdmin, setShowAdmin] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (user && !loading) {
      showToast(`👋 ${user.nickname}님, 환영합니다!`);
    }
  }, [user?.nickname]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function switchTab(key) {
    setTab(key);
    setShowAdmin(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) return null;

  // 승인 대기 화면 (관리자는 항상 통과)
  if (user && !user.isAdmin && !user.isApproved) {
    return <PendingScreen />;
  }

  if (showAdmin) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
        <Header onTabSwitch={switchTab} />
        <main style={{ paddingTop:60 }}>
          <AdminPage onBack={() => setShowAdmin(false)} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {!user && <Login />}

      <Header onTabSwitch={switchTab} />

      <main style={tab !== 'home' ? { paddingTop:58 } : {}}>
        {tab === 'home'        && <Hero onTabSwitch={switchTab} />}
        {tab === 'payment'     && <PaymentTab />}
        {tab === 'orientation' && <OrientationTab />}
        {tab === 'map'         && <MapTab />}
        {tab === 'news'        && <NewsTab />}
        {tab === 'community'   && <CommunityTab />}
        {tab === 'facilities'  && <FacilitiesTab />}
        {tab === 'realtrade'   && <RealTradeTab />}
        {tab === 'school'      && <SchoolTab />}
        {tab === 'ai'          && <AIChatTab />}
        {tab === 'mypage'      && <MyPage onTabSwitch={switchTab} onEnterAdmin={() => setShowAdmin(true)} />}
      </main>

      {user && tab !== 'home' && (
        <BottomNav active={tab} onSwitch={switchTab} />
      )}

      {user && <FloatingAI user={user} currentTab={tab} />}

      {toast && (
        <div style={{
          position:'fixed', bottom:100, left:'50%', transform:'translateX(-50%)',
          background:'rgba(255,255,255,0.97)', border:'1px solid var(--border)',
          color:'var(--text)', padding:'10px 20px', borderRadius:20,
          fontSize:13, zIndex:500, whiteSpace:'nowrap',
          animation:'fadeUp 0.3s ease', boxShadow:'var(--shadow)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
