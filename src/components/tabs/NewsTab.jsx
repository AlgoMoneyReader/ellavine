import { useState, useEffect } from 'react';

const CAT = { all:'전체', price:'시세/분양', policy:'정책/규제', infra:'교통/개발', community:'입주민' };
const SRC_TYPE = { all:'전체', news:'뉴스', blog:'블로그' };

const FALLBACK_NEWS = [
  {
    title: '평당 6000만 원인데도 청약 경쟁률은 100대 1…과열 양상',
    source: '문화일보', date: '2026-05-24', category: 'price',
    summary: '우려와 전세난이 겹치면서 청약 수요는 오히려 더 몰리는 분위기다. 서울에서 공급된 단지 대부분이 1순위 마감했으며 래미안 엘라비네도 높은 관심을 받고 있다.',
    url: 'https://www.munhwa.com/article/11591004',
  },
  {
    title: '국평 18억 래미안 엘라비네, 무순위에 1209명 몰렸다',
    source: '한국경제', date: '2026-04-27', category: 'price',
    summary: '강서구 방화동 래미안 엘라비네 무순위 청약에 1209명이 몰리며 흥행했다. 9호선 급행 역세권·방화뉴타운 프리미엄이 수요를 끌어모았다.',
    url: 'https://www.hankyung.com/article/2026042705097',
  },
  {
    title: '강서구 래미안 엘라비네, 20% 미계약…56가구 무순위 열린다',
    source: '뉴시스', date: '2026-04-21', category: 'price',
    summary: '국평 18억 원대 분양가 부담으로 강서구 래미안 엘라비네에서 20%가량 미계약이 발생해 56가구 무순위 청약이 진행된다.',
    url: 'https://www.newsis.com/view/NISX20260421_0003599909',
  },
  {
    title: '래미안 엘라비네 20% 계약 포기…무순위 청약 열린다',
    source: '파이낸셜뉴스', date: '2026-04-21', category: 'policy',
    summary: '래미안 엘라비네 초기 계약 포기 물량이 56가구 무순위로 다시 공급된다. 대출 규제와 고분양가 부담 속에서도 입지 프리미엄을 노린 실수요 경쟁이 예상된다.',
    url: 'https://www.fnnews.com/news/202604210819578913',
  },
  {
    title: '방화뉴타운 래미안 엘라비네 56가구 줍줍',
    source: '서울경제', date: '2026-04-21', category: 'infra',
    summary: '방화뉴타운 래미안 엘라비네 56가구가 무순위(줍줍) 공급된다. 신방화역 도보 5분 초역세권 입지와 방화뉴타운 완성에 따른 주거 환경 개선이 기대된다.',
    url: 'https://www.sedaily.com/article/20035342',
  },
  {
    title: '현금 14억 어찌 구하나…고분양가 강서구 첫 래미안, 미계약 56가구',
    source: '뉴스핌', date: '2026-04-22', category: 'policy',
    summary: '래미안 엘라비네 미계약의 주된 원인은 높은 자기자본 조달 부담이다. 중도금 대출 한도 규제로 현금 여력이 부족한 수요자들이 계약을 포기한 것으로 분석된다.',
    url: 'https://www.newspim.com/news/view/20260422001074',
  },
];

const NEWS_CACHE_KEY = 'ellavine_news_v2';
const NEWS_CACHE_TTL = 60 * 60 * 1000; // 1시간

function getCachedNews() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > NEWS_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCachedNews(data) {
  try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

async function fetchNewsRSS() {
  const res = await fetch('/api/news');
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
  return data;
}

export default function NewsTab() {
  const [news, setNews] = useState([]);
  const [cat, setCat] = useState('all');
  const [srcFilter, setSrcFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fromFallback, setFromFallback] = useState(false);
  const [lastFetched, setLastFetched] = useState(null); // 마지막 서버 요청 시각

  async function loadNews(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCachedNews();
      if (cached?.length) {
        setNews(cached);
        setFromFallback(false);
        setLoaded(true);
        // 캐시 저장 시각 복원
        try {
          const { ts } = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || '{}');
          if (ts) setLastFetched(new Date(ts));
        } catch {}
        return;
      }
    }
    setLoading(true);
    setFromFallback(false);
    try {
      const data = await fetchNewsRSS();
      setNews(data);
      setCachedNews(data);
      setFromFallback(false);
      setLastFetched(new Date());
    } catch {
      setNews(FALLBACK_NEWS);
      setFromFallback(true);
      setLastFetched(new Date());
    }
    setLoading(false);
    setLoaded(true);
  }

  useEffect(() => { loadNews(); }, []);

  const filtered = news
    .filter(n => cat === 'all' || n.category === cat)
    .filter(n => srcFilter === 'all' || n.srcType === srcFilter);

  return (
    <div style={wrap}>
      <div style={sectionTitle}>단지 관련 뉴스</div>
      <div style={sectionSub}>래미안 엘라비네 최신 소식</div>
      <div style={goldLine} />

      {/* 카테고리 필터 */}
      <div style={filterRow}>
        {Object.entries(CAT).map(([k, l]) => (
          <div key={k} style={{ ...chip, ...(cat === k ? chipActive : {}) }} onClick={() => setCat(k)}>{l}</div>
        ))}
      </div>
      {/* 소스 타입 필터 */}
      <div style={{ ...filterRow, marginBottom:20 }}>
        {Object.entries(SRC_TYPE).map(([k, l]) => (
          <div key={k}
            style={{ ...chip, fontSize:10, padding:'4px 10px',
              ...(srcFilter === k ? { background:'var(--gold)', color:'#fff', fontWeight:700, border:'none' } : {}) }}
            onClick={() => setSrcFilter(k)}>
            {k === 'news' ? '📰 ' : k === 'blog' ? '✏️ ' : ''}{l}
          </div>
        ))}
      </div>

      {loading && (
        <div style={loadingBox}>
          <div style={{ marginBottom:12, color:'var(--text-2)' }}>🔍 최신 뉴스를 가져오는 중...</div>
          <div style={dots}>
            <span style={dot} /><span style={{ ...dot, animationDelay:'0.15s' }} /><span style={{ ...dot, animationDelay:'0.3s' }} />
          </div>
        </div>
      )}

      {!loading && fromFallback && (
        <div style={fallbackBanner}>
          📰 뉴스 서버 연결 일시 불가 — 최근 주요 기사를 표시합니다.
          <button style={naverNewsBtn}
            onClick={() => window.open('https://search.naver.com/search.naver?where=news&query=래미안+엘라비네', '_blank')}>
            네이버 뉴스 →
          </button>
        </div>
      )}

      {!loading && filtered.map((n, i) => (
        <div key={i} style={newsItem} onClick={() => window.open(n.url, '_blank')}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={srcBadge(n.srcType)}>{n.srcType === 'blog' ? '✏️ 블로그' : '📰 뉴스'}</span>
              <span style={{ fontSize:10, color:'var(--gold)', fontWeight:700 }}>{n.source}</span>
            </div>
            <span style={{ fontSize:10, color:'var(--gray)' }}>{n.date}</span>
          </div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', lineHeight:1.5, marginBottom:8 }}>{n.title}</div>
          <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.7 }}>{n.summary}</div>
          <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={catTag(n.category)}>{CAT[n.category] || n.category}</span>
            <span style={{ fontSize:10, color:'var(--cyan)' }}>{n.srcType === 'blog' ? '포스트 읽기 →' : '기사 읽기 →'}</span>
          </div>
        </div>
      ))}

      {/* 마지막 확인 시각 + 안내 */}
      {loaded && !loading && (
        <div style={infoBox}>
          <div style={{ fontSize:10, color:'var(--gray)', marginBottom:4 }}>
            {lastFetched
              ? `🕐 마지막 서버 확인: ${lastFetched.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}`
              : ''}
          </div>
          <div style={{ fontSize:10, color:'var(--text-2)', lineHeight:1.6 }}>
            네이버 검색 API로 최신 뉴스·블로그를 실시간 수집합니다. (래미안 엘라비네 · 방화뉴타운)
          </div>
        </div>
      )}
      <button style={refreshBtn} onClick={() => loadNews(true)} disabled={loading}>
        🔄 새 기사 확인
      </button>
    </div>
  );
}

const srcBadge = (type) => ({
  fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:600,
  background: type === 'blog' ? 'rgba(200,168,64,0.12)' : 'rgba(11,40,73,0.07)',
  color: type === 'blog' ? 'var(--gold)' : 'var(--navy)',
  border: `1px solid ${type === 'blog' ? 'var(--gold-dim)' : 'rgba(11,40,73,0.15)'}`,
});

const catTag = (c) => ({
  fontSize:9, padding:'2px 8px', borderRadius:10,
  background: c === 'price' ? 'rgba(26,144,104,0.1)' : c === 'infra' ? 'rgba(0,143,175,0.08)' : 'rgba(200,168,64,0.08)',
  color: c === 'price' ? 'var(--green)' : c === 'infra' ? 'var(--cyan)' : 'var(--gold)',
  border: `1px solid ${c === 'price' ? 'rgba(26,144,104,0.2)' : c === 'infra' ? 'rgba(0,143,175,0.2)' : 'var(--gold-dim)'}`,
});

const wrap = { padding:'16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };
const filterRow = { display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 };
const chip = { fontSize:11, padding:'6px 12px', borderRadius:20, border:'1px solid var(--border)', color:'var(--gray)', cursor:'pointer', background:'#FFFFFF' };
const chipActive = { background:'var(--navy)', color:'#FFFFFF', fontWeight:700, border:'none' };
const loadingBox = { textAlign:'center', padding:'40px 20px', fontSize:12 };
const dots = { display:'flex', justifyContent:'center', gap:6 };
const dot = { width:8, height:8, borderRadius:'50%', background:'var(--gold)', display:'inline-block', animation:'typing 1.2s infinite' };
const newsItem = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'16px', marginBottom:10, cursor:'pointer',
  boxShadow:'var(--shadow-sm)',
};
const fallbackBanner = {
  display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8,
  background:'rgba(200,168,64,0.06)', border:'1px solid var(--gold-dim)',
  borderRadius:10, padding:'10px 14px', fontSize:11, color:'var(--text-2)',
  lineHeight:1.6, marginBottom:12,
};
const naverNewsBtn = {
  padding:'6px 14px', background:'var(--navy)', border:'none',
  borderRadius:8, color:'#FFFFFF', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0,
};
const infoBox = {
  background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:10, padding:'10px 14px', marginTop:4, marginBottom:4,
};
const refreshBtn = {
  width:'100%', padding:14, background:'#FFFFFF',
  border:'1px solid var(--border)', borderRadius:12, color:'var(--navy)',
  fontSize:13, marginTop:8, fontWeight:500, cursor:'pointer',
};
