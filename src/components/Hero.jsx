import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MOVE_IN_DATE, PAYMENT_DATES, CHECKLISTS } from '../data/ellavineData';
import aptPhoto from '../assets/apt-photo.jpg';

const TICKER_MSGS = [
  '👋 래미안 엘라비네 입주 예정자 전용 서비스에 오신 것을 환영합니다',
  '🏢 2028년 8월 입주 예정 · 557세대 10개동',
  '🚇 9호선 신방화역 도보 5분 · 여의도 20분 · 신논현역 35분',
  '🚇 5호선 송정역 도보 8분 · 광화문 35분',
  '💰 납부 일정 · 커뮤니티 · AI 도우미 · 평면도 서비스',
  '🌿 방화뉴타운 완성 · 서울식물원 차량 8분 · 롯데몰 김포공항 차량 7분',
  '📋 입주 도우미가 입주 준비의 시작부터 끝까지 함께합니다',
];

const WX_CODES = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌦️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'❄️', 73:'❄️', 75:'❄️', 77:'❄️',
  80:'🌧️', 81:'🌧️', 82:'🌧️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
};
const WX_DESC = {
  0:'맑음', 1:'대체로 맑음', 2:'구름 조금', 3:'흐림',
  45:'안개', 48:'안개',
  51:'이슬비', 53:'이슬비', 55:'이슬비',
  61:'비', 63:'비', 65:'비',
  71:'눈', 73:'눈', 75:'눈', 77:'눈',
  80:'소나기', 81:'소나기', 82:'소나기',
  95:'뇌우', 96:'뇌우', 99:'뇌우',
};

const FEATURES = [
  {
    key: 'payment',
    icon: '💰',
    title: '납부현황',
    desc: '중도금 일정 & 내 세대 납부 확인',
    color: '#0B2849',
    accent: 'rgba(11,40,73,0.07)',
    border: 'rgba(11,40,73,0.14)',
  },
  {
    key: 'community',
    icon: '💬',
    title: '커뮤니티',
    desc: '이웃 입주민과 게시판 소통',
    color: '#1A9068',
    accent: 'rgba(26,144,104,0.07)',
    border: 'rgba(26,144,104,0.2)',
  },
  {
    key: 'facilities',
    icon: '🏛️',
    title: '커뮤니티 시설',
    desc: '피트니스·골프·사우나·어린이집·재건축조합',
    color: '#C8A840',
    accent: 'rgba(200,168,64,0.08)',
    border: 'rgba(200,168,64,0.25)',
  },
  {
    key: 'map',
    icon: '🗺️',
    title: '주변 정보',
    desc: '맛집·학교·마트·병원 AI 탐색',
    color: '#008FAF',
    accent: 'rgba(0,143,175,0.07)',
    border: 'rgba(0,143,175,0.2)',
  },
  {
    key: 'news',
    icon: '📰',
    title: '뉴스',
    desc: '방화뉴타운 개발 최신 소식',
    color: '#7A8FA0',
    accent: 'rgba(122,143,160,0.07)',
    border: 'rgba(122,143,160,0.2)',
  },
  {
    key: 'ai',
    icon: '🤖',
    title: 'AI 도우미',
    desc: '입주 관련 무엇이든 질문',
    color: '#6B5BCD',
    accent: 'rgba(107,91,205,0.07)',
    border: 'rgba(107,91,205,0.2)',
  },
  {
    key: 'orientation',
    icon: '🧭',
    title: '조망·평면',
    desc: '동 위치, 타입별 조망·평면도',
    color: '#C0622A',
    accent: 'rgba(192,98,42,0.07)',
    border: 'rgba(192,98,42,0.2)',
  },
  {
    key: 'mypage',
    icon: '👤',
    title: '마이페이지',
    desc: '내 세대 정보 · 비밀번호 변경',
    color: '#516478',
    accent: 'rgba(81,100,120,0.07)',
    border: 'rgba(81,100,120,0.2)',
  },
];

function formatTradePrice(rawStr) {
  const num = parseInt(String(rawStr).replace(/,/g, '')) || 0;
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const man = num % 10000;
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
}

const STREAM_URL = 'https://strm4.spatic.go.kr/live/561.stream/playlist.m3u8';
const CCTV_FALLBACK = 'https://www.utic.go.kr/map/map.do';

function CCTVWidget() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | playing | error

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function cleanup() {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    }

    // Safari: native HLS
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = STREAM_URL;
      video.addEventListener('loadeddata', () => setStatus('playing'), { once: true });
      video.addEventListener('error', () => setStatus('error'), { once: true });
      return cleanup;
    }

    // Chrome/Firefox: load HLS.js from CDN
    if (document.getElementById('hlsjs-script')) {
      initHls(video);
      return cleanup;
    }
    const script = document.createElement('script');
    script.id = 'hlsjs-script';
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
    script.onload = () => initHls(video);
    script.onerror = () => setStatus('error');
    document.head.appendChild(script);
    return cleanup;

    function initHls(video) {
      if (!window.Hls?.isSupported()) { setStatus('error'); return; }
      const hls = new window.Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(STREAM_URL);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        setStatus('playing');
        video.play().catch(() => {});
      });
      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus('error');
      });
    }
  }, []);

  return (
    <div style={cctvCard}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:14, fontWeight:600, color:'var(--navy)' }}>지금 엘라비네는?</div>
            {status === 'playing' && (
              <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', animation:'pulse 1.5s infinite' }} />
                <span style={{ fontSize:9, color:'#22c55e', fontWeight:700 }}>LIVE</span>
              </div>
            )}
          </div>
          <div style={{ fontSize:10, color:'var(--text-2)', marginTop:2 }}>신방화역 사거리 공사 현장 실시간</div>
        </div>
        <a href={CCTV_FALLBACK} target="_blank" rel="noopener noreferrer"
          style={{ fontSize:10, color:'var(--navy)', textDecoration:'none', background:'rgba(11,40,73,0.07)', border:'1px solid rgba(11,40,73,0.15)', borderRadius:8, padding:'5px 10px', fontWeight:600 }}>
          새 창 →
        </a>
      </div>

      {/* 비디오 영역 */}
      <div style={{ position:'relative', borderRadius:10, overflow:'hidden', background:'#0a0a1a', aspectRatio:'16/9', maxHeight:240 }}>
        <video
          ref={videoRef}
          style={{ width:'100%', height:'100%', display: status === 'error' ? 'none' : 'block', objectFit:'cover' }}
          muted
          playsInline
          controls={status === 'playing'}
        />
        {status === 'loading' && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
            <div style={{ width:28, height:28, border:'2px solid rgba(255,255,255,0.15)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>스트림 연결 중...</div>
          </div>
        )}
        {status === 'error' && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:16 }}>
            <div style={{ fontSize:28 }}>📹</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', textAlign:'center', lineHeight:1.6 }}>
              스트림에 직접 접근할 수 없습니다<br/>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>UTIC 사이트에서 확인하세요</span>
            </div>
            <a href={CCTV_FALLBACK} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:11, color:'#fff', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'7px 16px', textDecoration:'none', fontWeight:600 }}>
              UTIC 지도 열기 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Hero({ onTabSwitch }) {
  const { user } = useAuth();
  const [dday, setDday] = useState(0);
  const [nextPay, setNextPay] = useState(null);
  const [paidCount, setPaidCount] = useState(0);
  const [checked, setChecked] = useState({});
  const [weather, setWeather] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  useEffect(() => {
    const today = new Date();
    const diff = Math.ceil((MOVE_IN_DATE - today) / (1000 * 60 * 60 * 24));
    setDday(diff);

    const payDates = PAYMENT_DATES.slice(1, 7).map((p, i) => ({
      date: new Date(p.date.replace(/\./g, '-').substring(0, 10)),
      label: p.step,
      idx: i,
    }));

    let paid = 0;
    let next = null;
    for (const p of payDates) {
      if (p.date < today) paid++;
      else if (!next) next = p;
    }
    setPaidCount(paid);
    setNextPay(next);

    // 날씨: Open-Meteo 무료 API (방화동 좌표)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5637&longitude=126.8020&current=temperature_2m,apparent_temperature,weather_code&timezone=Asia%2FSeoul')
      .then(r => r.json())
      .then(d => {
        const c = d.current;
        if (c) setWeather({ temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature), code: c.weather_code });
      })
      .catch(() => {});

    // 실거래가: 캐시 우선
    (async () => {
      try {
        const raw = localStorage.getItem('ellavine_realtrade_v4');
        if (raw) {
          const { data: cached } = JSON.parse(raw);
          if (cached && cached.apt) {
            setRecentTrades(cached.apt.slice(0, 10));
            return;
          }
        }
      } catch {}
      setTradesLoading(true);
      try {
        const r = await fetch('/api/realtrade');
        if (r.ok) {
          const json = await r.json();
          if (json && json.apt) setRecentTrades(json.apt.slice(0, 10));
        }
      } catch {}
      setTradesLoading(false);
    })();
  }, []);

  function toggleCheck(i) {
    setChecked(c => ({ ...c, [i]: !c[i] }));
  }

  const nextFullStr = nextPay
    ? `${nextPay.date.toISOString().substring(0, 10).replace(/-/g, '.')} (${nextPay.label})`
    : '잔금 — 2028.08 (입주 시)';

  const nextDateStr = nextPay
    ? nextPay.date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '전납 완료';

  const nextDday = nextPay
    ? Math.ceil((nextPay.date - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div style={heroWrap}>
      {/* 배경 이미지 */}
      <div style={{
        position:'absolute', inset:0, zIndex:0,
        backgroundImage:`url(${aptPhoto})`,
        backgroundSize:'cover', backgroundPosition:'center 20%',
        filter:'brightness(0.52)',
      }} />
      <div style={{
        position:'absolute', inset:0, zIndex:1,
        background:'linear-gradient(to bottom, rgba(11,40,73,0.35) 0%, rgba(247,245,240,0.82) 58%, var(--bg) 100%)',
      }} />

      <div style={{ position:'relative', zIndex:2, padding:'90px 16px 32px', display:'flex', flexDirection:'column' }}>

        {/* 상단 배지 */}
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:11, letterSpacing:4, color:'var(--gold-light)', textTransform:'uppercase', marginBottom:12, animation:'fadeUp 0.8s 0.2s both', textShadow:'0 1px 8px rgba(0,0,0,0.5)' }}>
          RAEMIAN EL RAVINE · 2028
        </div>

        {/* 티커 스트립 */}
        <div style={tickerWrap}>
          <div style={tickerTrack}>
            {[...TICKER_MSGS, ...TICKER_MSGS].map((msg, i) => (
              <span key={i} style={tickerItem}>{msg}</span>
            ))}
          </div>
        </div>

        {/* D-DAY 카드 */}
        <div style={ddayCard}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', borderRadius:'20px 20px 0 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2.5, textTransform:'uppercase', marginBottom:6 }}>입주까지</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:68, fontWeight:300, lineHeight:1, color:'var(--navy)', letterSpacing:-3 }}>
                  {dday.toLocaleString()}
                </span>
                <span style={{ fontSize:18, color:'var(--gold)', fontWeight:400 }}>일</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-2)', marginTop:6 }}>
                입주 예정: <strong style={{ color:'var(--navy)' }}>2028년 8월</strong>
                {user && <span style={{ marginLeft:12, color:'var(--gold)' }}>· {user.dong}동 {user.ho}호</span>}
              </div>
              <div style={{ fontSize:11, color:'var(--gray)', marginTop:4 }}>
                중도금 납부 <strong style={{ color:'var(--navy)' }}>{paidCount}/6</strong>
              </div>
            </div>

            {/* 날씨 위젯 */}
            <div style={weatherCard}>
              <div style={{ fontSize:9, color:'var(--gold)', letterSpacing:1.5, marginBottom:6, textAlign:'center' }}>엘라비네 날씨</div>
              {weather ? (
                <>
                  <div style={{ fontSize:32, textAlign:'center', marginBottom:4 }}>{WX_CODES[weather.code] || '🌡️'}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:300, color:'var(--navy)', textAlign:'center', lineHeight:1 }}>{weather.temp}°</div>
                  <div style={{ fontSize:9, color:'var(--text-2)', textAlign:'center', marginTop:4 }}>{WX_DESC[weather.code] || ''}</div>
                  <div style={{ fontSize:9, color:'var(--gray)', textAlign:'center', marginTop:2 }}>체감 {weather.feels}°</div>
                </>
              ) : (
                <div style={{ fontSize:20, textAlign:'center', color:'var(--gray)' }}>🌡️</div>
              )}
            </div>
          </div>
        </div>

        {/* 다음 납부 배너 */}
        <div style={nextPayBanner} onClick={() => onTabSwitch('payment')}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--red)', animation:'pulse 1.5s infinite' }} />
            <div>
              <div style={{ fontSize:10, color:'var(--gray)' }}>다음 납부일</div>
              <div style={{ fontSize:13, color:'var(--text)', fontWeight:500, marginTop:2 }}>{nextFullStr}</div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'var(--gold)', lineHeight:1.2 }}>
              {nextDateStr} →
            </div>
            {nextDday !== null && (
              <div style={{ fontSize:11, fontWeight:700, color: nextDday <= 30 ? 'var(--red)' : 'var(--gray)', marginTop:2 }}>
                {nextDday === 0 ? 'D-Day' : nextDday > 0 ? `D-${nextDday}` : `D+${Math.abs(nextDday)}`}
              </div>
            )}
          </div>
        </div>

        {/* ── CCTV 위젯 ── */}
        <CCTVWidget />

        {/* ── 기능 안내 섹션 ── */}
        <div style={featureSection}>
          <div style={featureSectionHeader}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:10, letterSpacing:3, color:'var(--gold)', textTransform:'uppercase', marginBottom:4 }}>FEATURES</div>
            <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:16, fontWeight:600, color:'var(--navy)' }}>입주 도우미 기능</div>
            <div style={{ fontSize:11, color:'var(--text-2)', marginTop:4 }}>입주 전 알아야 할 모든 정보를 담았습니다</div>
          </div>

          {/* 2열 그리드 */}
          <div style={featureGrid}>
            {FEATURES.map(f => (
              <button key={f.key} style={{ ...featureCard, background: f.accent, borderColor: f.border }}
                onClick={() => onTabSwitch(f.key)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <span style={{ fontSize:22 }}>{f.icon}</span>
                  <span style={{ fontSize:12, color: f.color, opacity:0.6 }}>→</span>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color: f.color, marginBottom:4, textAlign:'left' }}>{f.title}</div>
                <div style={{ fontSize:10, color:'var(--text-2)', lineHeight:1.5, textAlign:'left' }}>{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 호갱노노 외부 링크 */}
        <a
          href="https://hogangnono.com/apt/gg35c"
          target="_blank"
          rel="noopener noreferrer"
          style={hogangCard}
        >
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:11, color:'var(--gray)', letterSpacing:1 }}>실거래가 · 시세 · 단지 정보</div>
            <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:15, fontWeight:700, color:'var(--navy)' }}>호갱노노에서 확인하기</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <span style={{ fontSize:22 }}>🏠</span>
            <span style={{ fontSize:18, color:'var(--gold)' }}>→</span>
          </div>
        </a>

        {/* 강서구 인근 시세 */}
        <div style={tradePreviewCard} onClick={() => onTabSwitch('realtrade')}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:1, marginBottom:2 }}>강서구 인근 시세</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>마곡동 최근 실거래가</div>
            </div>
            <span style={{ fontSize:11, color:'var(--cyan)' }}>전체보기 →</span>
          </div>
          {recentTrades.slice(0, 3).map((t, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop: i===0 ? '1px solid var(--border)' : '1px solid rgba(0,0,0,0.04)' }}>
              <div>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{t.name}</span>
                <span style={{ fontSize:10, color:'var(--gray)', marginLeft:6 }}>{t.area}㎡</span>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>{formatTradePrice(t.price)}</span>
            </div>
          ))}
          {tradesLoading && <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:8 }}>불러오는 중...</div>}
          {!tradesLoading && recentTrades.length === 0 && <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:8 }}>데이터 없음</div>}
        </div>

        {/* 체크리스트 */}
        <div style={checkCard}>
          <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:12 }}>📋 입주 준비 체크리스트</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {CHECKLISTS.map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer' }} onClick={() => toggleCheck(i)}>
                <div style={{
                  width:16, height:16, borderRadius:4, border:`1.5px solid ${checked[i]?'var(--green)':'var(--border)'}`,
                  background: checked[i] ? 'var(--green)' : 'transparent',
                  flexShrink:0, marginTop:1, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, color:'white',
                }}>
                  {checked[i] && '✓'}
                </div>
                <span style={{ fontSize:11, color: checked[i] ? 'var(--gray)' : 'var(--text)', lineHeight:1.4, textDecoration: checked[i] ? 'line-through' : 'none' }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 개인정보 안심 안내 */}
        <div style={privacyCard}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:18 }}>🔒</span>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)' }}>개인정보 걱정 없이 사용하세요</div>
              <div style={{ fontSize:10, color:'var(--text-2)', marginTop:1 }}>Privacy First · 최소한의 정보만 저장</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              { icon:'✅', text:'이름·이메일·전화번호\n수집 안 함' },
              { icon:'✅', text:'아이디·닉네임·동호수만\n저장' },
              { icon:'✅', text:'커뮤니티 이용 외\n외부 제공 없음' },
              { icon:'✅', text:'언제든 탈퇴 시\n즉시 삭제' },
            ].map((item, i) => (
              <div key={i} style={privacyItem}>
                <span style={{ fontSize:12 }}>{item.icon}</span>
                <span style={{ fontSize:10, color:'var(--text-2)', lineHeight:1.5, whiteSpace:'pre-line' }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 서비스 설명 */}
        <div style={footerNote}>
          <div style={{ fontSize:9, color:'var(--gray)', letterSpacing:3, textTransform:'uppercase', marginBottom:6 }}>RAEMIAN EL RAVINE</div>
          <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.8 }}>
            납부 일정 · 시설 안내 · 커뮤니티 · 주변 정보 · AI 도우미<br />
            입주 준비의 시작부터 끝까지
          </div>
        </div>
      </div>
    </div>
  );
}

const heroWrap = { position:'relative', overflow:'hidden', background:'var(--bg)' };

/* 티커 */
const tickerWrap = {
  overflow:'hidden', marginBottom:14,
  borderRadius:10,
  background:'rgba(11,40,73,0.75)',
  padding:'8px 0',
  animation:'fadeUp 0.8s 0.3s both',
};
const tickerTrack = {
  display:'flex', gap:0,
  animation:'ticker 28s linear infinite',
  width:'max-content',
};
const tickerItem = {
  fontSize:11, color:'var(--gold-light)', whiteSpace:'nowrap',
  paddingRight:40, letterSpacing:0.3,
};

/* 날씨 */
const weatherCard = {
  background:'rgba(247,245,240,0.92)', border:'1px solid var(--border)',
  borderRadius:14, padding:'10px 12px', minWidth:80, flexShrink:0,
  boxShadow:'var(--shadow-sm)',
};
const ddayCard = {
  background:'rgba(255,255,255,0.95)', border:'1px solid var(--border)',
  borderRadius:20, padding:'22px 20px',
  boxShadow:'var(--shadow)',
  marginBottom:14, position:'relative', overflow:'hidden',
  animation:'fadeUp 0.8s 0.4s both',
};
const nextPayBanner = {
  background:'rgba(255,255,255,0.92)',
  border:'1px solid var(--border)',
  borderRadius:14, padding:'14px 16px', marginBottom:14,
  display:'flex', justifyContent:'space-between', alignItems:'center',
  cursor:'pointer', animation:'fadeUp 0.8s 0.6s both',
  boxShadow:'var(--shadow-sm)',
};
const cctvCard = {
  display:'block', textDecoration:'none',
  background:'rgba(255,255,255,0.95)', border:'1px solid var(--border)',
  borderRadius:16, padding:'14px 16px', marginBottom:14,
  boxShadow:'var(--shadow-sm)', animation:'fadeUp 0.8s 0.7s both',
};
const hogangCard = {
  display:'flex', justifyContent:'space-between', alignItems:'center',
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'16px 18px', marginBottom:14,
  boxShadow:'var(--shadow-sm)', textDecoration:'none',
  animation:'fadeUp 0.8s 0.9s both',
};
const tradePreviewCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'14px 16px', marginBottom:10,
  boxShadow:'var(--shadow-sm)', cursor:'pointer',
};
const featureSection = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:20, padding:'18px 16px', marginBottom:14,
  boxShadow:'var(--shadow-sm)', animation:'fadeUp 0.8s 0.8s both',
};
const featureSectionHeader = {
  marginBottom:16, paddingBottom:14,
  borderBottom:'1px solid var(--border)',
};
const featureGrid = {
  display:'grid', gridTemplateColumns:'1fr 1fr', gap:10,
};
const featureCard = {
  padding:'14px 12px', borderRadius:14, border:'1px solid',
  cursor:'pointer', background:'transparent',
  transition:'transform 0.15s ease, box-shadow 0.15s ease',
  textAlign:'left',
};
const checkCard = {
  background:'rgba(255,255,255,0.92)', border:'1px solid var(--border)',
  borderRadius:16, padding:16, marginBottom:14,
  boxShadow:'var(--shadow-sm)',
  animation:'fadeUp 0.8s 1.0s both',
};
const privacyCard = {
  background:'rgba(11,40,73,0.04)',
  border:'1px solid rgba(11,40,73,0.12)',
  borderRadius:16, padding:'14px 16px', marginBottom:14,
  animation:'fadeUp 0.8s 1.1s both',
};
const privacyItem = {
  display:'flex', alignItems:'flex-start', gap:6,
  background:'rgba(255,255,255,0.7)', borderRadius:10,
  padding:'8px 10px',
};
const footerNote = {
  textAlign:'center', padding:'8px 0 16px',
  animation:'fadeUp 0.8s 1.2s both',
};
