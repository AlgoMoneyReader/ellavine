import { useState, useEffect, useRef, useMemo } from 'react';
import TradeMapView from '../TradeMapView.jsx';

const CACHE_KEY = 'ellavine_realtrade_v4';
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3시간
const GU_CACHE_TTL = 30 * 60 * 1000;  // 구별 캐시 30분

const SEOUL_GU = [
  { code: '11680', name: '강남구' },
  { code: '11740', name: '강동구' },
  { code: '11305', name: '강북구' },
  { code: '11500', name: '강서구' },
  { code: '11620', name: '관악구' },
  { code: '11215', name: '광진구' },
  { code: '11530', name: '구로구' },
  { code: '11545', name: '금천구' },
  { code: '11350', name: '노원구' },
  { code: '11320', name: '도봉구' },
  { code: '11230', name: '동대문구' },
  { code: '11590', name: '동작구' },
  { code: '11440', name: '마포구' },
  { code: '11410', name: '서대문구' },
  { code: '11650', name: '서초구' },
  { code: '11200', name: '성동구' },
  { code: '11290', name: '성북구' },
  { code: '11710', name: '송파구' },
  { code: '11470', name: '양천구' },
  { code: '11560', name: '영등포구' },
  { code: '11170', name: '용산구' },
  { code: '11380', name: '은평구' },
  { code: '11110', name: '종로구' },
  { code: '11140', name: '중구' },
  { code: '11260', name: '중랑구' },
];
const PAGE_SIZE = 10;

/** 단지명 옆 외부링크 뱃지 (호갱노노 · 네이버부동산)
 *  dong: "마곡동" 등 법정동명 — 있으면 검색 정확도 향상 */
function AptLinks({ name, dong }) {
  const q = dong ? `${dong} ${name}` : name;
  return (
    <span onClick={e => e.stopPropagation()} style={{ display:'inline-flex', gap:3, marginLeft:5, verticalAlign:'middle' }}>
      <a
        href={`https://hogangnono.com/search?q=${encodeURIComponent(q)}`}
        target="_blank" rel="noopener noreferrer"
        title={`호갱노노: ${q}`}
        style={{ fontSize:8, padding:'2px 5px', borderRadius:4, background:'#f05a28', color:'#fff',
          textDecoration:'none', fontWeight:700, lineHeight:'13px', flexShrink:0, letterSpacing:'-0.3px' }}
      >호갱</a>
      <a
        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`}
        target="_blank" rel="noopener noreferrer"
        title={`네이버 검색: ${q}`}
        style={{ fontSize:8, padding:'2px 5px', borderRadius:4, background:'#03c75a', color:'#fff',
          textDecoration:'none', fontWeight:700, lineHeight:'13px', flexShrink:0, letterSpacing:'-0.3px' }}
      >N부동산</a>
    </span>
  );
}

function formatPrice(rawStr) {
  const num = parseInt(String(rawStr).replace(/,/g, '')) || 0;
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const man = num % 10000;
    return man > 0 ? `${eok}억 ${Number(man).toLocaleString()}만` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
}

function formatDate(it) {
  return it.day ? `${it.year}.${it.month}.${it.day}` : `${it.year}.${it.month}`;
}
function formatDateShort(it) {
  return `${it.year}.${it.month}`;
}

function getSizeGroup(area) {
  const a = parseFloat(area) || 0;
  if (a < 60) return '20평형';
  if (a < 95) return '30평형';
  if (a < 130) return '40평형';
  return '50평+';
}


function groupByComplex(items) {
  const map = {};
  for (const it of items) {
    if (!map[it.name]) map[it.name] = [];
    map[it.name].push(it);
  }
  return Object.entries(map).map(([name, trades]) => ({ name, trades }));
}

// 최근 1개월 거래 평균가
function recentAvgPrice(trades) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = trades.filter(t => {
    const d = new Date(`${t.year}-${t.month}-${t.day || '01'}`);
    return d >= cutoff;
  });
  const src = recent.length > 0 ? recent : trades;
  const sum = src.reduce((s, t) => s + (parseInt(t.price) || 0), 0);
  return src.length > 0 ? sum / src.length : 0;
}

function buildPageNums(current, total) {
  const pages = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - current) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }
  return pages;
}

// ── 가격 추이 SVG 차트 ──────────────────────────
const CHART_SIZE_COLORS = {
  '20평형': '#1a9068',
  '30평형': '#0B2849',
  '40평형': '#C8A840',
  '50평+':  '#D94545',
};

function PriceChart({ allTrades, filteredTrades, sizeFilter }) {
  const SIZE_GROUPS = ['20평형', '30평형', '40평형', '50평+'];

  // 표시할 시리즈 결정
  const series = sizeFilter === '전체'
    ? SIZE_GROUPS
        .map(sg => ({ label: sg, color: CHART_SIZE_COLORS[sg], trades: allTrades.filter(t => getSizeGroup(t.area) === sg) }))
        .filter(s => s.trades.length >= 2)
    : [{ label: sizeFilter, color: CHART_SIZE_COLORS[sizeFilter] || '#0B2849', trades: filteredTrades }];

  // X축: 최근 12개월
  const months = [...new Set(allTrades.map(t => `${t.year}-${t.month}`))].sort().slice(-12);
  if (months.length < 2) return (
    <div style={{ textAlign:'center', padding:'30px 16px', color:'var(--gray)', fontSize:12 }}>
      데이터가 충분하지 않습니다 (최소 2개월 이상)
    </div>
  );

  // 월별 평균 계산
  const seriesData = series.map(s => ({
    ...s,
    points: months.map(m => {
      const [yr, mo] = m.split('-');
      const trades = s.trades.filter(t => t.year === yr && t.month === mo);
      if (trades.length === 0) return null;
      return trades.reduce((sum, t) => sum + (parseInt(t.price) || 0), 0) / trades.length;
    }),
  })).filter(s => s.points.some(p => p !== null));

  if (seriesData.length === 0) return (
    <div style={{ textAlign:'center', padding:'30px 16px', color:'var(--gray)', fontSize:12 }}>
      선택된 조건의 데이터가 없습니다
    </div>
  );

  // SVG 치수
  const W = 320; const H = 190;
  const PL = 52; const PR = 8; const PT = 16; const PB = 38;
  const iW = W - PL - PR; const iH = H - PT - PB;

  const allVals = seriesData.flatMap(s => s.points.filter(p => p !== null));
  const minV = Math.min(...allVals); const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const vPad  = range * 0.12;

  const xS = i => PL + (i / Math.max(months.length - 1, 1)) * iW;
  const yS = v => PT + iH - ((v - (minV - vPad)) / (range + 2 * vPad)) * iH;

  // Y축 틱 (억 단위)
  const yTicks = Array.from({ length: 5 }, (_, i) => (minV - vPad) + (range + 2 * vPad) * (i / 4));

  return (
    <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'14px 12px', marginBottom:14, boxShadow:'var(--shadow-sm)', maxWidth:520, margin:'0 auto 14px' }}>
      {/* 범례 */}
      {seriesData.length > 1 && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
          {seriesData.map(s => (
            <div key={s.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <div style={{ width:12, height:3, borderRadius:2, background:s.color }} />
              <span style={{ fontSize:10, color:'var(--text)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:'visible', display:'block' }}>
        {/* 배경 그리드 */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PL} y1={yS(v)} x2={W - PR} y2={yS(v)} stroke="#E8E6E1" strokeWidth="0.8" />
            <text x={PL - 4} y={yS(v) + 3.5} textAnchor="end" fontSize="8.5" fill="#9AA5AF">
              {(v / 10000).toFixed(1)}억
            </text>
          </g>
        ))}

        {/* X축 라벨 */}
        {months.map((m, i) => {
          if (months.length > 6 && i % 2 !== 0 && i !== months.length - 1) return null;
          const [yr, mo] = m.split('-');
          return (
            <text key={m} x={xS(i)} y={H - PB + 13} textAnchor="middle" fontSize="8" fill="#9AA5AF"
              transform={`rotate(-30,${xS(i)},${H - PB + 13})`}>
              {yr.slice(2)}.{mo}
            </text>
          );
        })}

        {/* 데이터 라인 */}
        {seriesData.map(s => {
          const pts = s.points
            .map((p, i) => p !== null ? { x: xS(i), y: yS(p), v: p, i } : null)
            .filter(Boolean);
          if (pts.length === 0) return null;

          const d = pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
          return (
            <g key={s.label}>
              {pts.length > 1 && (
                <path d={d} fill="none" stroke={s.color} strokeWidth="2.2"
                  strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
              )}
              {pts.map(pt => (
                <circle key={pt.i} cx={pt.x} cy={pt.y} r="3.5" fill={s.color} stroke="#FFF" strokeWidth="1.5" />
              ))}
              {/* 마지막 점에 가격 라벨 */}
              {pts.length > 0 && (() => {
                const last = pts[pts.length - 1];
                return (
                  <text x={last.x + 5} y={last.y + 3} fontSize="8" fill={s.color} fontWeight="700">
                    {(last.v / 10000).toFixed(1)}억
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* 축 테두리 */}
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="#D4D0C8" strokeWidth="1" />
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#D4D0C8" strokeWidth="1" />
      </svg>
      <div style={{ fontSize:9, color:'var(--gray)', textAlign:'right', marginTop:4 }}>
        월별 평균 실거래가 · 국토교통부 기준
      </div>
    </div>
  );
}

// ── 단지별 미니 가격 추이 차트 ───────────────────
function MiniPriceChart({ trades }) {
  // 거래일 기준 월별 평균
  const months = [...new Set(trades.map(t => `${t.year}-${t.month}`))].sort();
  if (months.length < 2) return null;

  const points = months.map(m => {
    const [yr, mo] = m.split('-');
    const mt = trades.filter(t => t.year === yr && t.month === mo);
    return mt.reduce((s, t) => s + (parseInt(t.price) || 0), 0) / mt.length;
  });

  const W = 280; const H = 88;
  const PL = 44; const PR = 32; const PT = 8; const PB = 22;
  const iW = W - PL - PR; const iH = H - PT - PB;

  const minV = Math.min(...points); const maxV = Math.max(...points);
  const range = maxV - minV || 1; const vPad = range * 0.25;

  const xS = i => PL + (i / Math.max(months.length - 1, 1)) * iW;
  const yS = v => PT + iH - ((v - (minV - vPad)) / (range + 2 * vPad)) * iH;
  const pts = points.map((p, i) => ({ x: xS(i), y: yS(p), v: p }));
  const d   = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

  // 가격 변동 방향
  const delta = points[points.length - 1] - points[0];
  const lineColor = delta > 0 ? '#D94545' : delta < 0 ? '#1a9068' : '#0B2849';

  return (
    <div style={{ background:'rgba(11,40,73,0.025)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 10px', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <span style={{ fontSize:9, color:'var(--gray)', fontWeight:600 }}>📈 월별 평균 실거래가 ({months.length}개월)</span>
        <span style={{ fontSize:9, fontWeight:700, color: delta > 0 ? 'var(--red)' : delta < 0 ? 'var(--green)' : 'var(--gray)' }}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '─'} {Math.abs(delta / 10000).toFixed(1)}억
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block', maxWidth:280 }}>
        {/* 그리드 */}
        {[minV - vPad, (minV + maxV) / 2, maxV + vPad].map((v, i) => (
          <g key={i}>
            <line x1={PL} y1={yS(v)} x2={W - PR} y2={yS(v)} stroke="#E8E6E1" strokeWidth="0.6" />
            <text x={PL - 3} y={yS(v) + 3} textAnchor="end" fontSize="7" fill="#9AA5AF">
              {(v / 10000).toFixed(1)}억
            </text>
          </g>
        ))}
        {/* X 라벨 */}
        {months.map((m, i) => {
          if (months.length > 7 && i % 2 !== 0 && i !== months.length - 1) return null;
          const [yr, mo] = m.split('-');
          return (
            <text key={m} x={xS(i)} y={H - PB + 11} textAnchor="middle" fontSize="6.5" fill="#9AA5AF">
              {yr.slice(2)}.{mo}
            </text>
          );
        })}
        {/* 라인 */}
        {pts.length > 1 && <path d={d} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {/* 닷 */}
        {pts.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="2.8" fill={lineColor} stroke="#FFF" strokeWidth="1.2" />
        ))}
        {/* 최신값 라벨 */}
        {pts.length > 0 && (
          <text x={pts[pts.length-1].x + 4} y={pts[pts.length-1].y + 3} fontSize="8" fill={lineColor} fontWeight="700">
            {(pts[pts.length-1].v / 10000).toFixed(1)}억
          </text>
        )}
        {/* 축 */}
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="#D4D0C8" strokeWidth="0.8" />
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#D4D0C8" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

export default function RealTradeTab() {
  const [data, setData] = useState(null);
  const [subTab, setSubTab] = useState('apt');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'chart' | 'map'
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [lastFetched, setLastFetched] = useState(null);
  const [sizeFilter, setSizeFilter] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [complexPeriod, setComplexPeriod] = useState('1w');
  const [dailyOpen, setDailyOpen] = useState(false);
  const [complexOpen, setComplexOpen] = useState(false);
  const [complexExpanded, setComplexExpanded] = useState(null); // 단지명 또는 null
  const [trackDayExpanded, setTrackDayExpanded] = useState(null);    // 강서구 탭 날짜 확장
  const [guTrackDayExpanded, setGuTrackDayExpanded] = useState(null); // 서울 구별 탭 날짜 확장
  const [sortBy, setSortBy] = useState('recent'); // recent | priceDesc | priceAsc | alpha
  const [tradeTypeFilter, setTradeTypeFilter] = useState('매매'); // '매매' | '전세'
  const [highlightedComplex, setHighlightedComplex] = useState(null); // 지도 버블 클릭 후 하이라이트

  // ── 서울 구별 비교 ──
  const [selectedGuCode, setSelectedGuCode] = useState('11500');
  const [guDataCache, setGuDataCache]       = useState({});   // { lawd: { data, ts } }
  const [guLoading, setGuLoading]           = useState(false);
  const guScrollRef = useRef(null);

  // ── 토허 신고 추적 (Supabase) ──
  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [trackPeriod, setTrackPeriod] = useState('1w');

  // ── 카카오 지도 좌표 ──
  const [coordsMap, setCoordsMap] = useState({});
  const [guCoordsCache, setGuCoordsCache] = useState({}); // { lawd: { apt_name: {lat,lng} } }

  // ── 추적 섹션 접기/펼치기 ──
  const [trackOpen, setTrackOpen] = useState(false);
  const [seoulTrackOpen, setSeoulTrackOpen] = useState(false);

  // 서울 구별 일별 추적 캐시 { lawd: { data, ts } }
  const [guDailyCache, setGuDailyCache] = useState({});
  const GU_DAILY_TTL = 60 * 1000; // 1분

  useEffect(() => {
    setDailyLoading(true);
    fetch('/api/daily-trades')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => setDailyData(json))
      .catch(() => setDailyData(null))
      .finally(() => setDailyLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/apt-coords?lawd=11500')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => { setCoordsMap(json.coords || {}); setGuCoordsCache(prev => ({ ...prev, '11500': json.coords || {} })); })
      .catch(() => {});
  }, []);

  // 서울 구별 탭에서 구 변경 시 좌표 캐시 로드
  useEffect(() => {
    if (subTab !== 'seoul') return;
    if (guCoordsCache[selectedGuCode]) return;
    fetch(`/api/apt-coords?lawd=${selectedGuCode}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => setGuCoordsCache(prev => ({ ...prev, [selectedGuCode]: json.coords || {} })))
      .catch(() => {});
  }, [subTab, selectedGuCode]);

  async function loadData(forceRefresh = false) {
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { data: cached, ts } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL && cached && cached.aptAll) {
            setData(cached);
            setLastFetched(new Date(ts));
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    setErr('');
    try {
      const url = forceRefresh ? `/api/realtrade?r=${Date.now()}` : '/api/realtrade';
      const r = await fetch(url);
      if (!r.ok) throw new Error(`서버 오류 ${r.status}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      const now = new Date();
      setLastFetched(now);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json, ts: now.getTime() }));
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }

  async function fetchGuData(lawd) {
    // 강서구는 기존 data 재사용
    if (lawd === '11500' && data) return;
    // 캐시 확인
    const cached = guDataCache[lawd];
    if (cached && Date.now() - cached.ts < GU_CACHE_TTL) return;

    setGuLoading(true);
    try {
      const r = await fetch(`/api/realtrade?lawd=${lawd}&r=${Date.now()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setGuDataCache(prev => ({ ...prev, [lawd]: { data: json, ts: Date.now() } }));
    } catch (e) {
      console.error('구 데이터 조회 실패:', e.message);
    }
    setGuLoading(false);
  }

  async function fetchGuDaily(lawd) {
    if (lawd === '11500' && dailyData) return; // 강서구는 기존 dailyData 재사용
    const cached = guDailyCache[lawd];
    if (cached && Date.now() - cached.ts < GU_DAILY_TTL) return;
    try {
      const r = await fetch(`/api/daily-trades?lawd=${lawd}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setGuDailyCache(prev => ({ ...prev, [lawd]: { data: json, ts: Date.now() } }));
    } catch (e) {
      console.error('구 일별 데이터 조회 실패:', e.message);
    }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setCurrentPage(1); setExpanded(null); setSearchQuery(''); setViewMode('list'); setTradeTypeFilter('매매'); }, [subTab]);
  useEffect(() => { setCurrentPage(1); setExpanded(null); }, [sizeFilter, searchQuery, sortBy]);

  // 서울탭 진입 or 구 변경 시 데이터 로드
  useEffect(() => {
    if (subTab === 'seoul') {
      fetchGuData(selectedGuCode);
      fetchGuDaily(selectedGuCode);
    }
  }, [subTab, selectedGuCode]);

  const SIZE_FILTERS = ['전체', '20평형', '30평형', '40평형', '50평+'];

  function getAptGroups() {
    const isJeonse = tradeTypeFilter === '전세';
    if (!isJeonse && !data) return [];

    let items;
    if (isJeonse) {
      const rawRents = dailyData?.rents || [];
      const filteredRents = subTab === 'apt' ? rawRents.filter(r => r.dong === '마곡동') : rawRents;
      items = filteredRents.map(r => ({
        name: r.apt_name,
        price: r.price,
        area: r.area,
        floor: r.floor,
        year: r.deal_year,
        month: r.deal_month,
        day: r.deal_day,
        dong: r.dong,
        tradeType: '전세',
      }));
    } else {
      items = subTab === 'apt' ? (data.apt || []) : (data.aptAll || []);
    }

    const groups = groupByComplex(items).filter(g => {
      const sizeOk = sizeFilter === '전체' || g.trades.some(t => getSizeGroup(t.area) === sizeFilter);
      const searchOk = !searchQuery.trim() || g.name.includes(searchQuery.trim());
      return sizeOk && searchOk;
    });
    return groups.sort((a, b) => {
      if (sortBy === 'recent') {
        const da = Math.max(...a.trades.map(t => new Date(`${t.year}-${t.month}-${t.day||'01'}`).getTime()));
        const db = Math.max(...b.trades.map(t => new Date(`${t.year}-${t.month}-${t.day||'01'}`).getTime()));
        return db - da;
      }
      if (sortBy === 'priceDesc') return recentAvgPrice(b.trades) - recentAvgPrice(a.trades);
      if (sortBy === 'priceAsc')  return recentAvgPrice(a.trades) - recentAvgPrice(b.trades);
      if (sortBy === 'alpha')     return a.name.localeCompare(b.name, 'ko');
      return 0;
    });
  }

  const isAptTab = subTab === 'apt' || subTab === 'aptAll';
  const aptGroups = isAptTab ? getAptGroups() : [];
  const totalPages = Math.ceil(aptGroups.length / PAGE_SIZE);
  const pagedGroups = aptGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const silvItems = data
    ? (data.silv || []).filter(t =>
        (sizeFilter === '전체' || getSizeGroup(t.area) === sizeFilter) &&
        (!searchQuery.trim() || t.name.includes(searchQuery.trim()))
      )
    : [];

  // ── 통계 계산 ──
  const today = new Date();
  const todayKey = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const thisMonthKey = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}`;

  const allTabTrades = data
    ? (subTab === 'apt' ? (data.apt||[]) : subTab === 'aptAll' ? (data.aptAll||[]) : (data.silv||[]))
    : [];

  // 평형 필터 적용된 거래 (통계·차트 기준)
  const filteredAllTrades = sizeFilter === '전체'
    ? allTabTrades
    : allTabTrades.filter(t => getSizeGroup(t.area) === sizeFilter);

  const todayTrades = filteredAllTrades.filter(t => `${t.year}${t.month}${t.day||''}` === todayKey);

  const thisMonthTrades = filteredAllTrades.filter(t => `${t.year}${t.month}` === thisMonthKey);
  const highTrade = [...filteredAllTrades].sort((a,b) => (parseInt(b.price)||0) - (parseInt(a.price)||0))[0] || null;
  const thisMonthHigh = [...thisMonthTrades].sort((a,b) => (parseInt(b.price)||0) - (parseInt(a.price)||0))[0] || null;

  // 일별 실거래 신고건수 (최근 30일, 평형 필터 적용)
  const dailyMap = {};
  filteredAllTrades.forEach(t => {
    if (!t.day) return;
    const key = `${t.year}.${t.month}.${t.day}`;
    dailyMap[key] = (dailyMap[key] || 0) + 1;
  });
  const dailyCounts = Object.entries(dailyMap)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .slice(0, 30);
  const maxDaily = Math.max(...dailyCounts.map(([,c]) => c), 1);

  // 단지별 신고건수 (기간 필터 + 평형 필터 적용)
  const COMPLEX_PERIODS = [
    { key: '1w',  label: '1주일',  days: 7 },
    { key: '1m',  label: '1개월',  days: 30 },
    { key: '3m',  label: '3개월',  days: 90 },
    { key: '6m',  label: '6개월',  days: 180 },
    { key: '12m', label: '12개월', days: 365 },
  ];
  const complexPeriodDays = COMPLEX_PERIODS.find(p => p.key === complexPeriod)?.days || 365;
  const complexCutoff = new Date(today);
  complexCutoff.setDate(complexCutoff.getDate() - complexPeriodDays);

  const complexPeriodTrades = filteredAllTrades.filter(t => {
    if (!t.year || !t.month) return false;
    const d = new Date(`${t.year}-${t.month}-${t.day || '01'}`);
    return d >= complexCutoff;
  });

  const complexCountMap = {};
  complexPeriodTrades.forEach(t => {
    if (!t.name) return;
    complexCountMap[t.name] = (complexCountMap[t.name] || 0) + 1;
  });
  const complexCounts = Object.entries(complexCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const maxComplexCount = Math.max(...complexCounts.map(([,c]) => c), 1);

  // ── 토허 신고 추적 집계 (Supabase 기반) ──
  const TRACK_PERIODS = [
    { key: '1w',  label: '1주일',  days: 7 },
    { key: '1m',  label: '1개월',  days: 30 },
    { key: '3m',  label: '3개월',  days: 90 },
    { key: '6m',  label: '6개월',  days: 180 },
    { key: '12m', label: '12개월', days: 365 },
  ];
  const trackDays = TRACK_PERIODS.find(p => p.key === trackPeriod)?.days || 7;
  const trackCutoff = new Date(today);
  trackCutoff.setDate(trackCutoff.getDate() - trackDays);
  const trackCutoffStr = trackCutoff.toISOString().slice(0, 10);

  // 서브탭 + 평형 필터 적용한 기본 베이스 (daily-trades는 이미 강서구만 반환)
  const allTrackBase = (dailyData?.trades || []).filter(t => {
    if (subTab === 'apt' && t.dong !== '마곡동') return false; // 마곡동만
    if (subTab === 'silv')                       return false; // 분양권 추적 없음
    if (sizeFilter !== '전체' && getSizeGroup(t.area) !== sizeFilter) return false;
    return true;
  });

  // 단지별 집계 (기간 필터 적용)
  const trackTrades = allTrackBase.filter(t => t.report_date >= trackCutoffStr);
  const trackComplexMap = {};
  trackTrades.forEach(t => {
    trackComplexMap[t.apt_name] = (trackComplexMap[t.apt_name] || 0) + 1;
  });
  const trackComplexCounts = Object.entries(trackComplexMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const maxTrackComplex = Math.max(...trackComplexCounts.map(([,c]) => c), 1);

  // 일별 집계 (최근 30일, 기간 필터 없이 전체)
  const trackDailyMap = {};
  allTrackBase.forEach(t => {
    if (!t.report_date) return;
    trackDailyMap[t.report_date] = (trackDailyMap[t.report_date] || 0) + 1;
  });
  const trackDailyCounts = Object.entries(trackDailyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);
  const maxTrackDaily = Math.max(...trackDailyCounts.map(([,c]) => c), 1);

  // 오늘/이번주/이번달 배지 (서브탭+평형 필터 적용)
  const todayStr = today.toISOString().slice(0, 10);
  const weekAgo  = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30);
  const trackToday = allTrackBase.filter(t => t.report_date === todayStr).length;
  const trackWeek  = allTrackBase.filter(t => t.report_date >= weekAgo.toISOString().slice(0,10)).length;
  const trackMonth = allTrackBase.filter(t => t.report_date >= monthAgo.toISOString().slice(0,10)).length;

  // 서브탭별 네이버 부동산 URL (강서구 중심)
  const naverMapUrl =
    subTab === 'apt'
      ? 'https://fin.land.naver.com/map?layer=apt&zoom=15&lat=37.5610&lng=126.8250'
      : subTab === 'aptAll'
      ? 'https://fin.land.naver.com/map?layer=apt&zoom=13&lat=37.5540&lng=126.8480'
      : 'https://fin.land.naver.com/map?layer=pre&zoom=13&lat=37.5540&lng=126.8480';

  return (
    <div style={wrap}>
      <div style={sectionTitle}>강서구 실거래가</div>
      <div style={sectionSub}>국토교통부 실거래 신고 데이터 · 최근 12개월</div>
      <div style={goldLine} />

      {/* 서브탭 */}
      <div style={subTabRow}>
        {[
          { key: 'apt',    label: '마곡동 아파트' },
          { key: 'aptAll', label: '강서구 아파트' },
          { key: 'silv',   label: '강서구 분양권' },
        ].map(({ key, label }) => (
          <button
            key={key}
            style={{ ...subTabBtn, ...(subTab === key ? subTabActive : {}) }}
            onClick={() => { setSubTab(key); setSearchQuery(''); setSizeFilter('전체'); }}
          >
            {label}
          </button>
        ))}
      </div>
      {/* 서울 구별 비교 버튼 (2번째 줄) */}
      <button
        style={{ ...seoulTabBtn, ...(subTab === 'seoul' ? seoulTabActive : {}) }}
        onClick={() => { setSubTab('seoul'); setSearchQuery(''); setSizeFilter('전체'); }}
      >
        🏙️ 서울 구별 비교
        {subTab === 'seoul'
          ? <span style={{ fontSize:11, marginLeft:6, opacity:0.8 }}>· {SEOUL_GU.find(g => g.code === selectedGuCode)?.name}</span>
          : <span style={{ fontSize:9, color:'var(--gray)', marginLeft:6 }}>25개 구 실거래가</span>
        }
      </button>

      {/* ── 서울 구별 비교 탭 ── */}
      {subTab === 'seoul' && (() => {
        const seoulData   = selectedGuCode === '11500' ? data : guDataCache[selectedGuCode]?.data;
        const guName      = SEOUL_GU.find(g => g.code === selectedGuCode)?.name || '';
        const seoulTrades = seoulData?.aptAll || [];
        const seoulFiltered = sizeFilter === '전체'
          ? seoulTrades
          : seoulTrades.filter(t => getSizeGroup(t.area) === sizeFilter);
        const seoulSearched = searchQuery.trim()
          ? seoulFiltered.filter(t => t.name?.includes(searchQuery.trim()))
          : seoulFiltered;

        const seoulGroups = groupByComplex(seoulSearched).sort((a, b) => {
          if (sortBy === 'priceDesc') return recentAvgPrice(b.trades) - recentAvgPrice(a.trades);
          if (sortBy === 'priceAsc')  return recentAvgPrice(a.trades) - recentAvgPrice(b.trades);
          if (sortBy === 'alpha')     return a.name.localeCompare(b.name, 'ko');
          const da = Math.max(...a.trades.map(t => new Date(`${t.year}-${t.month}-${t.day||'01'}`).getTime()));
          const db = Math.max(...b.trades.map(t => new Date(`${t.year}-${t.month}-${t.day||'01'}`).getTime()));
          return db - da;
        });

        const seoulHighTrade    = [...seoulFiltered].sort((a,b) => (parseInt(b.price)||0) - (parseInt(a.price)||0))[0] || null;
        const seoulThisMonth    = seoulFiltered.filter(t => `${t.year}${t.month}` === thisMonthKey);
        const seoulMonthHigh    = [...seoulThisMonth].sort((a,b) => (parseInt(b.price)||0) - (parseInt(a.price)||0))[0] || null;
        const seoulTotalPages   = Math.ceil(seoulGroups.length / PAGE_SIZE);
        const seoulPagedGroups  = seoulGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
        const isGuLoading       = guLoading || (selectedGuCode !== '11500' && !seoulData);

        return (
          <>
            {/* 구 선택 드롭박스 */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:'var(--gray)', marginBottom:6, fontWeight:600 }}>🏙️ 구 선택 (서울 25개 구)</div>
              <select
                value={selectedGuCode}
                onChange={e => { setSelectedGuCode(e.target.value); setCurrentPage(1); setExpanded(null); setSearchQuery(''); setGuTrackDayExpanded(null); setSeoulTrackOpen(false); }}
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid var(--border)',
                  fontSize:15, fontWeight:700, color:'var(--navy)', background:'#FFFFFF',
                  cursor:'pointer', outline:'none', appearance:'auto' }}
              >
                {SEOUL_GU.map(g => (
                  <option key={g.code} value={g.code}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* 보기 모드 */}
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              {[['list','📋 목록'],['chart','📈 가격 추이'],['map','🗺️ 지도']].map(([mode, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ flex:1, padding:'8px 4px', borderRadius:10, fontSize:12, fontWeight:600,
                    border: viewMode === mode ? 'none' : '1px solid var(--border)', cursor:'pointer',
                    background: viewMode === mode ? 'var(--navy)' : '#FFFFFF',
                    color:      viewMode === mode ? '#FFFFFF'   : 'var(--gray)' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* 평형 필터 */}
            <div style={sizeFilterRow}>
              {SIZE_FILTERS.map(f => (
                <button key={f}
                  style={sizeFilter === f ? { ...sizeFilterBtn, background:'rgba(200,168,64,0.15)', color:'var(--gold)', border:'1px solid var(--gold)', fontWeight:700 } : sizeFilterBtn}
                  onClick={() => setSizeFilter(f)}>{f}
                </button>
              ))}
            </div>

            {/* 검색창 */}
            <div style={{ position:'relative', marginBottom:14 }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>🔍</span>
              <input
                style={{ width:'100%', padding:'9px 32px 9px 34px', border:'1px solid var(--border)', borderRadius:10, fontSize:13, boxSizing:'border-box', outline:'none' }}
                placeholder={`${guName} 단지명 검색...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', fontSize:13, cursor:'pointer', color:'var(--gray)' }}>
                  ✕
                </button>
              )}
            </div>

            {/* 로딩 */}
            {isGuLoading && (
              <div style={loadingBox}>
                <div style={{ fontSize:28, marginBottom:10 }}>🔍</div>
                <div style={{ fontSize:12, color:'var(--text-2)' }}>{guName} 실거래가 불러오는 중...</div>
              </div>
            )}

            {/* MOLIT 장애 안내 */}
            {seoulData && !isGuLoading && seoulData._molitFailed && seoulTrades.length === 0 && (
              <div style={{ background:'rgba(217,69,69,0.05)', border:'1px solid rgba(217,69,69,0.2)', borderRadius:12, padding:'22px 16px', textAlign:'center', marginBottom:16 }}>
                <div style={{ fontSize:22, marginBottom:8 }}>📡</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--red)', marginBottom:8 }}>국토부 API 일시 장애</div>
                <div style={{ fontSize:11, color:'var(--gray)', lineHeight:1.9 }}>
                  현재 국토교통부 실거래가 API에 접근이 어렵습니다.<br />
                  <strong>강서구</strong>는 백업 데이터로 조회 가능합니다.<br />
                  API 복구 후 자동으로 데이터가 표시됩니다.
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:14 }}>
                  <button
                    onClick={() => setSelectedGuCode('11500')}
                    style={{ padding:'8px 18px', borderRadius:10, background:'var(--navy)', color:'#fff', border:'none', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                    강서구 보기
                  </button>
                  <button
                    onClick={() => { setGuDataCache(prev => { const n={...prev}; delete n[selectedGuCode]; return n; }); fetchGuData(selectedGuCode); }}
                    style={{ padding:'8px 18px', borderRadius:10, background:'#fff', color:'var(--navy)', border:'1px solid var(--border)', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                    🔄 다시 시도
                  </button>
                </div>
              </div>
            )}

            {/* 데이터 */}
            {seoulData && !isGuLoading && !(seoulData._molitFailed && seoulTrades.length === 0) && (
              <>
                {/* 통계 */}
                <div style={statsBanner}>
                  <div style={statCard}>
                    <div style={statLabel}>총 거래건수</div>
                    <div style={{ ...statValue, color:'var(--navy)' }}>{seoulFiltered.length}건</div>
                    <div style={statSub}>최근 12개월</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>이달 최고가</div>
                    <div style={{ ...statValue, color:'var(--navy)' }}>{seoulMonthHigh ? formatPrice(seoulMonthHigh.price) : '-'}</div>
                    <div style={statSub}>{seoulMonthHigh ? seoulMonthHigh.name.slice(0,8) : '-'}</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>역대 최고가</div>
                    <div style={{ ...statValue, color:'var(--gold)' }}>{seoulHighTrade ? formatPrice(seoulHighTrade.price) : '-'}</div>
                    <div style={statSub}>{seoulHighTrade ? seoulHighTrade.name.slice(0,8) : '-'}</div>
                  </div>
                </div>

                {/* ── 일별 거래 추적 (통계 카드 바로 아래) ── */}
                {(() => {
                  const gd = selectedGuCode === '11500' ? dailyData : guDailyCache[selectedGuCode]?.data;
                  if (!gd) return (
                    <div style={{ ...trackSection, marginBottom:12, textAlign:'center', padding:'14px', color:'var(--gray)', fontSize:11 }}>
                      ⏳ 거래 추적 데이터 로딩 중...
                    </div>
                  );
                  const gdTrades = gd.trades || [];
                  const todayStr2 = today.toISOString().slice(0, 10);
                  const w = new Date(today); w.setDate(w.getDate() - 7);
                  const m = new Date(today); m.setDate(m.getDate() - 30);
                  const gdToday = gdTrades.filter(t => t.report_date === todayStr2).length;
                  const gdWeek  = gdTrades.filter(t => t.report_date >= w.toISOString().slice(0,10)).length;
                  const gdMonth = gdTrades.filter(t => t.report_date >= m.toISOString().slice(0,10)).length;
                  const gdMap = {};
                  gdTrades.forEach(t => { if (t.report_date) gdMap[t.report_date] = (gdMap[t.report_date]||0)+1; });
                  const gdCounts = Object.entries(gdMap).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
                  const gdMax = Math.max(...gdCounts.map(([,c])=>c), 1);
                  return (
                    <div style={{ ...trackSection, marginBottom:12 }}>
                      <div
                        style={{ display:'flex', flexDirection:'column', gap:6, marginBottom: seoulTrackOpen ? 10 : 0, cursor:'pointer' }}
                        onClick={() => setSeoulTrackOpen(o => !o)}
                      >
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>📡 {guName} 실거래 추적</span>
                          <span style={{ fontSize:12, color:'var(--gray)' }}>{seoulTrackOpen ? '▲' : '▼'}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:9, color:'var(--gray)' }}>거래일 기준 · 최근 60일</span>
                          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                            <div style={trackBadge}>오늘 {gdToday}건</div>
                            <div style={trackBadge}>1주 {gdWeek}건</div>
                            <div style={trackBadge}>1달 {gdMonth}건</div>
                          </div>
                        </div>
                      </div>
                      {seoulTrackOpen && (gdCounts.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'8px 0', color:'var(--gray)', fontSize:10 }}>
                          데이터 없음 — Mac에서 동기화 후 표시됩니다
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {gdCounts.map(([date, count]) => {
                            const isExp = guTrackDayExpanded === date;
                            const dayTrades = isExp
                              ? gdTrades
                                  .filter(t => t.report_date === date)
                                  .sort((a, b) => (parseInt(b.price)||0) - (parseInt(a.price)||0))
                              : [];
                            return (
                              <div key={date}>
                                <div
                                  onClick={() => setGuTrackDayExpanded(isExp ? null : date)}
                                  style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer',
                                    padding:'2px 2px', borderRadius:5,
                                    background: isExp ? 'rgba(11,40,73,0.04)' : 'transparent' }}>
                                  <span style={{ fontSize:9, color: isExp ? 'var(--navy)' : 'var(--gray)',
                                    width:60, flexShrink:0, fontWeight: isExp ? 700 : 400 }}>
                                    {date.slice(5)}
                                  </span>
                                  <div style={{ flex:1, background:'var(--bg)', borderRadius:3, height:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                                    <div style={{
                                      width:`${Math.round((count/gdMax)*100)}%`,
                                      background: count === gdMax ? 'var(--red)' : 'var(--navy)',
                                      height:'100%', borderRadius:3,
                                    }} />
                                  </div>
                                  <span style={{ fontSize:10, fontWeight:700, color: count === gdMax ? 'var(--red)' : 'var(--text)', width:22, textAlign:'right' }}>{count}</span>
                                  <span style={{ fontSize:9, color:'var(--gray)', width:10 }}>{isExp ? '▲' : '▼'}</span>
                                </div>
                                {isExp && (
                                  <div style={{ margin:'4px 0 6px 62px', background:'rgba(11,40,73,0.03)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                                    {dayTrades.map((t, i) => (
                                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                                        padding:'6px 10px', borderBottom: i < dayTrades.length-1 ? '1px solid var(--border)' : 'none' }}>
                                        <div>
                                          <div style={{ fontSize:11, fontWeight:600, color:'var(--navy)', marginBottom:1 }}>
                                            {t.apt_name || '-'}
                                            <AptLinks name={t.apt_name || ''} dong={t.dong} />
                                          </div>
                                          <div style={{ fontSize:10, color:'var(--gray)' }}>
                                            {t.dong} · {t.area}㎡ · {t.floor}층 · {t.deal_year}.{t.deal_month}.{t.deal_day}
                                          </div>
                                        </div>
                                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', flexShrink:0 }}>
                                          {parseInt(t.price) >= 10000
                                            ? `${Math.floor(parseInt(t.price)/10000)}억${parseInt(t.price)%10000 ? ` ${(parseInt(t.price)%10000).toLocaleString()}만` : ''}`
                                            : `${parseInt(t.price).toLocaleString()}만`}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 가격 추이 차트 */}
                {viewMode === 'chart' && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>
                      📈 {guName} 월별 평균 실거래가
                      <span style={{ fontSize:10, color:'var(--gray)', fontWeight:400, marginLeft:6 }}>
                        {sizeFilter !== '전체' ? sizeFilter : '평형별'}
                      </span>
                    </div>
                    <PriceChart allTrades={seoulFiltered} filteredTrades={seoulFiltered} sizeFilter={sizeFilter} />
                  </div>
                )}

                {/* 🗺️ 서울 구별 지도 */}
                {viewMode === 'map' && (
                  <TradeMapView
                    groups={seoulGroups}
                    tradeTypeFilter="매매"
                    subTab="seoul"
                    coordsMap={guCoordsCache[selectedGuCode] || {}}
                    guCode={selectedGuCode}
                    sizeFilter={sizeFilter}
                    onSelectComplex={(name) => {
                      const idx = seoulGroups.findIndex(g => g.name === name);
                      if (idx >= 0) setCurrentPage(Math.floor(idx / PAGE_SIZE) + 1);
                      setViewMode('list'); setExpanded(name);
                      setHighlightedComplex(name);
                      setTimeout(() => {
                        document.getElementById(`complex-card-${name}`)
                          ?.scrollIntoView({ behavior:'smooth', block:'center' });
                      }, 300);
                      setTimeout(() => setHighlightedComplex(null), 2500);
                    }}
                  />
                )}

                {/* 단지 목록 */}
                {viewMode === 'list' && (
                  <>
                    <div style={{ ...countBar, flexDirection:'column', alignItems:'stretch', gap:8 }}>
                      <div>
                        총 <strong>{seoulFiltered.length}건</strong> · {seoulGroups.length}개 단지
                        {searchQuery.trim() && <span style={{ color:'var(--navy)' }}> · "{searchQuery.trim()}" 검색</span>}
                      </div>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {[{ key:'recent',label:'최신순'},{ key:'priceDesc',label:'최고가순'},{ key:'priceAsc',label:'최저가순'},{ key:'alpha',label:'가나다순'}].map(s => (
                          <button key={s.key} onClick={() => { setSortBy(s.key); setCurrentPage(1); }}
                            style={{ fontSize:10, padding:'4px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontWeight: sortBy === s.key ? 700 : 400,
                              background: sortBy === s.key ? 'var(--navy)' : '#FFFFFF',
                              color:      sortBy === s.key ? '#FFFFFF' : 'var(--gray)',
                              borderColor: sortBy === s.key ? 'var(--navy)' : 'var(--border)' }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {seoulGroups.length === 0 && <div style={emptyBox}>조회된 거래가 없습니다</div>}
                    {seoulPagedGroups.map(g => {
                      const ft = sizeFilter === '전체' ? g.trades : g.trades.filter(t => getSizeGroup(t.area) === sizeFilter);
                      const dt = ft[0] || g.trades[0];
                      const isHighlighted = highlightedComplex === g.name;
                      return (
                        <div key={g.name} id={`complex-card-${g.name}`}
                          style={{ ...complexCard, ...(isHighlighted ? { border:'2px solid var(--gold)', background:'rgba(200,168,64,0.08)', boxShadow:'0 0 0 3px rgba(200,168,64,0.3)' } : {}) }}>
                          <div style={complexHeader} onClick={() => setExpanded(expanded === g.name ? null : g.name)}>
                            <div>
                              <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:2, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                                {g.name}
                                {dt?.dong && <span style={{ fontSize:9, padding:'2px 6px', background:'rgba(11,40,73,0.07)', color:'var(--navy)', borderRadius:8, fontWeight:600, border:'1px solid rgba(11,40,73,0.14)' }}>{dt.dong}</span>}
                                <AptLinks name={g.name} dong={dt?.dong} />
                              </div>
                              <div style={{ fontSize:10, color:'var(--gray)' }}>{formatDate(dt)} 최신 · 총 {ft.length}건</div>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>{formatPrice(dt.price)}</div>
                              <div style={{ fontSize:10, color:'var(--gold)', marginTop:1 }}>{dt.area}㎡ · {dt.floor}층</div>
                            </div>
                          </div>
                          {ft.length > 1 && (() => {
                            const prices = ft.map(t => parseInt(t.price) || 0);
                            const mn = Math.min(...prices); const mx = Math.max(...prices);
                            const lt = parseInt(ft[0].price) || 0;
                            const pct = mx > mn ? Math.round(((lt - mn) / (mx - mn)) * 100) : 50;
                            return (
                              <div style={{ padding:'10px 0 4px' }}>
                                <div style={rangeBar}><div style={{ ...rangeThumb, left:`${pct}%` }} /></div>
                                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                                  <span style={{ fontSize:9, color:'var(--gray)' }}>최저 {formatPrice(String(mn))}</span>
                                  <span style={{ fontSize:9, color:'var(--gray)' }}>최고 {formatPrice(String(mx))}</span>
                                </div>
                              </div>
                            );
                          })()}
                          {expanded === g.name && (
                            <div style={tradeList}>
                              <MiniPriceChart trades={ft} />
                              <div style={tradeListHeader}><span>면적 · 층</span><span>계약</span><span style={{ textAlign:'right' }}>거래금액</span></div>
                              {ft.slice(0, 20).map((t, i) => (
                                <div key={i} style={tradeRow}>
                                  <span style={{ color:'var(--text-2)' }}>{t.area}㎡ · {t.floor}층</span>
                                  <span style={{ color:'var(--gray)' }}>{formatDate(t)}</span>
                                  <span style={{ fontWeight:700, color:'var(--navy)', textAlign:'right' }}>{formatPrice(t.price)}</span>
                                </div>
                              ))}
                              {ft.length > 20 && <div style={{ fontSize:10, color:'var(--gray)', textAlign:'center', paddingTop:6 }}>외 {ft.length - 20}건 더 있음</div>}
                            </div>
                          )}
                          <button style={expandBtn} onClick={() => setExpanded(expanded === g.name ? null : g.name)}>
                            {expanded === g.name ? '▲ 접기' : `▼ 상세 ${ft.length}건 보기`}
                          </button>
                        </div>
                      );
                    })}
                    {seoulTotalPages > 1 && (
                      <div style={{ display:'flex', gap:4, justifyContent:'center', padding:'12px 0' }}>
                        <button style={pageBtn} disabled={currentPage===1} onClick={() => setCurrentPage(1)}>«</button>
                        <button style={pageBtn} disabled={currentPage===1} onClick={() => setCurrentPage(p => p-1)}>‹</button>
                        {buildPageNums(currentPage, seoulTotalPages).map((p, i) =>
                          p === '...'
                            ? <span key={`el-${i}`} style={{ padding:'6px 4px', color:'var(--gray)' }}>…</span>
                            : <button key={p} style={{ ...pageBtn, ...(currentPage===p ? { background:'var(--navy)', color:'#fff', border:'none', fontWeight:700 } : {}) }} onClick={() => setCurrentPage(p)}>{p}</button>
                        )}
                        <button style={pageBtn} disabled={currentPage===seoulTotalPages} onClick={() => setCurrentPage(p => p+1)}>›</button>
                        <button style={pageBtn} disabled={currentPage===seoulTotalPages} onClick={() => setCurrentPage(seoulTotalPages)}>»</button>
                      </div>
                    )}
                  </>
                )}

                <div style={infoBox}>
                  <div style={{ fontSize:10, color:'var(--text-2)', lineHeight:1.7 }}>
                    국토교통부 실거래가 신고 기준 · 최근 12개월 · 계약 해제 건 자동 제외
                  </div>
                </div>
                <button style={refreshBtn} onClick={() => {
                  setGuDataCache(prev => { const n = {...prev}; delete n[selectedGuCode]; return n; });
                  setGuDailyCache(prev => { const n = {...prev}; delete n[selectedGuCode]; return n; });
                  fetchGuData(selectedGuCode);
                  fetchGuDaily(selectedGuCode);
                }}>
                  🔄 {guName} 데이터 새로 불러오기
                </button>
              </>
            )}
          </>
        );
      })()}

      {/* ── 기존 강서구/마곡동 탭 콘텐츠 ── */}
      {subTab !== 'seoul' && (<>

      {/* 보기 모드 */}
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        {(tradeTypeFilter === '매매'
          ? [['list','📋 목록'],['chart','📈 가격 추이'],['map','🗺️ 지도']]
          : [['list','📋 목록'],['map','🗺️ 지도']]
        ).map(([mode, label]) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            style={{ flex:1, padding:'8px 4px', borderRadius:10, fontSize:12, fontWeight:600,
              border: viewMode === mode ? 'none' : '1px solid var(--border)', cursor:'pointer',
              background: viewMode === mode ? 'var(--navy)' : '#FFFFFF',
              color:      viewMode === mode ? '#FFFFFF'   : 'var(--gray)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* 거래 유형 (분양권 탭 제외) */}
      {subTab !== 'silv' && (
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {['매매','전세'].map(t => (
            <button key={t}
              onClick={() => { setTradeTypeFilter(t); setCurrentPage(1); setExpanded(null); if (t === '전세') setViewMode('list'); }}
              style={{ flex:1, padding:'7px 4px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                border: tradeTypeFilter === t ? 'none' : '1px solid var(--border)',
                background: tradeTypeFilter === t ? (t === '전세' ? '#2176ae' : 'var(--navy)') : '#FFFFFF',
                color: tradeTypeFilter === t ? '#FFFFFF' : 'var(--gray)' }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* 평형 필터 */}
      <div style={sizeFilterRow}>
        {SIZE_FILTERS.map(f => (
          <button
            key={f}
            style={sizeFilter === f ? { ...sizeFilterBtn, background:'rgba(200,168,64,0.15)', color:'var(--gold)', border:'1px solid var(--gold)', fontWeight:700 } : sizeFilterBtn}
            onClick={() => setSizeFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 검색창 */}
      <div style={{ position:'relative', marginBottom:14 }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>🔍</span>
        <input
          style={{ width:'100%', padding:'9px 32px 9px 34px', border:'1px solid var(--border)', borderRadius:10, fontSize:13, boxSizing:'border-box', outline:'none' }}
          placeholder="단지명 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', fontSize:13, cursor:'pointer', color:'var(--gray)' }}
          >✕</button>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={loadingBox}>
          <div style={{ fontSize:28, marginBottom:10 }}>🔍</div>
          <div style={{ fontSize:12, color:'var(--text-2)' }}>국토교통부 실거래가 불러오는 중...</div>
        </div>
      )}

      {/* 에러 */}
      {!loading && err && (
        <div style={errBox}>
          ⚠️ 데이터를 불러오지 못했습니다.<br />
          <span style={{ fontSize:10, color:'var(--gray)' }}>{err}</span>
        </div>
      )}

      {/* ── 🔔 토허 신고 추적 (Supabase 기반, 신고일자 기준) ── */}
      <div style={trackSection}>
        <div
          style={{ display:'flex', flexDirection:'column', gap:6, marginBottom: trackOpen ? 10 : 0, cursor:'pointer' }}
          onClick={() => setTrackOpen(o => !o)}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>📡 국토부 실거래 추적</span>
            <span style={{ fontSize:12, color:'var(--gray)' }}>{trackOpen ? '▲' : '▼'}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:9, color:'var(--gray)' }}>거래일 기준 · 매일 오전 9시 Mac 자동 동기화</span>
            <div style={{ display:'flex', gap:5, alignItems:'center' }}>
              <div style={trackBadge}>오늘 {trackToday}건</div>
              <div style={trackBadge}>1주 {trackWeek}건</div>
              <div style={trackBadge}>1달 {trackMonth}건</div>
            </div>
          </div>
        </div>
        {trackOpen && (<>

        {dailyLoading && (
          <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:'20px 0' }}>
            데이터 불러오는 중...
          </div>
        )}

        {!dailyLoading && !dailyData && (
          <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:'16px 0', lineHeight:1.7 }}>
            📡 첫 데이터 수집 대기 중<br />
            <span style={{ fontSize:10 }}>매일 오전 10시 자동 수집됩니다</span>
          </div>
        )}

        {!dailyLoading && dailyData && subTab === 'silv' && (
          <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:'14px 0' }}>
            분양권 탭은 아파트 매매 신고 추적 대상이 아닙니다
          </div>
        )}

        {!dailyLoading && dailyData && subTab !== 'silv' && trackDailyCounts.length === 0 && (
          <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:'14px 0', lineHeight:1.8 }}>
            ✅ 기준 데이터 수집 완료<br />
            <span style={{ fontSize:10 }}>내일 오전 10시부터 신규 신고 건수 집계 시작됩니다</span>
          </div>
        )}

        {!dailyLoading && dailyData && subTab !== 'silv' && trackDailyCounts.length > 0 && (
          <>
            {/* 일별 차트 */}
            {trackDailyCounts.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--gray)', marginBottom:6 }}>
                  📊 일별 거래건수 (거래일 기준)
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {trackDailyCounts.map(([date, count]) => {
                    const isExp = trackDayExpanded === date;
                    const dayTrades = isExp
                      ? allTrackBase
                          .filter(t => t.report_date === date)
                          .sort((a, b) => (parseInt(b.price)||0) - (parseInt(a.price)||0))
                      : [];
                    return (
                      <div key={date}>
                        <div
                          onClick={() => setTrackDayExpanded(isExp ? null : date)}
                          style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer',
                            padding:'2px 2px', borderRadius:5,
                            background: isExp ? 'rgba(11,40,73,0.04)' : 'transparent' }}>
                          <span style={{ fontSize:9, color: isExp ? 'var(--navy)' : 'var(--gray)',
                            width:60, flexShrink:0, fontWeight: isExp ? 700 : 400 }}>
                            {date.slice(5)}
                          </span>
                          <div style={{ flex:1, background:'var(--bg)', borderRadius:3, height:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                            <div style={{
                              width:`${Math.round((count/maxTrackDaily)*100)}%`,
                              background: count === maxTrackDaily ? 'var(--red)' : 'var(--navy)',
                              height:'100%', borderRadius:3,
                            }} />
                          </div>
                          <span style={{ fontSize:10, fontWeight:700, color: count === maxTrackDaily ? 'var(--red)' : 'var(--text)', width:22, textAlign:'right' }}>{count}</span>
                          <span style={{ fontSize:9, color:'var(--gray)', width:10 }}>{isExp ? '▲' : '▼'}</span>
                        </div>
                        {isExp && (
                          <div style={{ margin:'4px 0 6px 62px', background:'rgba(11,40,73,0.03)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                            {dayTrades.map((t, i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                                padding:'6px 10px', borderBottom: i < dayTrades.length-1 ? '1px solid var(--border)' : 'none' }}>
                                <div>
                                  <div style={{ fontSize:11, fontWeight:600, color:'var(--navy)', marginBottom:1 }}>
                                    {t.apt_name || t.name || '-'}
                                    <AptLinks name={t.apt_name || t.name || ''} dong={t.dong} />
                                  </div>
                                  <div style={{ fontSize:10, color:'var(--gray)' }}>
                                    {t.dong && `${t.dong} · `}{t.area}㎡ · {t.floor}층 · 거래일 {t.deal_year||t.year}.{t.deal_month||t.month}.{t.deal_day||t.day||'??'}
                                  </div>
                                </div>
                                <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', flexShrink:0 }}>
                                  {parseInt(t.price) >= 10000
                                    ? `${Math.floor(parseInt(t.price)/10000)}억${parseInt(t.price)%10000 ? ` ${(parseInt(t.price)%10000).toLocaleString()}만` : ''}`
                                    : `${parseInt(t.price).toLocaleString()}만`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 단지별 차트 + 기간 탭 */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--gray)' }}>
                  🏢 단지별 신고건수
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  {TRACK_PERIODS.map(p => (
                    <button key={p.key} onClick={() => setTrackPeriod(p.key)} style={{
                      padding:'2px 7px', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer',
                      border: trackPeriod === p.key ? '1px solid var(--navy)' : '1px solid var(--border)',
                      background: trackPeriod === p.key ? 'var(--navy)' : '#FFFFFF',
                      color: trackPeriod === p.key ? '#FFFFFF' : 'var(--gray)',
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>

              {trackComplexCounts.length === 0 ? (
                <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:'12px 0' }}>
                  해당 기간 신고 내역 없음
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {trackComplexCounts.map(([name, count], idx) => (
                    <div key={name} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:9,
                        color: idx === 0 ? 'var(--gold)' : 'var(--gray)',
                        width:96, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        fontWeight: idx === 0 ? 700 : 400 }}>
                        {name}
                      </span>
                      <div style={{ flex:1, background:'var(--bg)', borderRadius:3, height:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <div style={{
                          width:`${Math.round((count/maxTrackComplex)*100)}%`,
                          background: idx === 0 ? 'var(--gold)' : 'rgba(11,40,73,0.55)',
                          height:'100%', borderRadius:3,
                        }} />
                      </div>
                      <span style={{ fontSize:10, fontWeight:700,
                        color: idx === 0 ? 'var(--gold)' : 'var(--text)',
                        width:26, textAlign:'right' }}>{count}건</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        </>)}
      </div>

      {/* ── 📈 가격 추이 차트 ── */}
      {!loading && data && viewMode === 'chart' && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>
            📈 월별 평균 실거래가 추이
            <span style={{ fontSize:10, color:'var(--gray)', fontWeight:400, marginLeft:6 }}>
              {subTab === 'apt' ? '마곡동 아파트' : subTab === 'aptAll' ? '강서구 전체 아파트' : '강서구 분양권'}
              {sizeFilter !== '전체' ? ` · ${sizeFilter}` : ' · 평형별'}
            </span>
          </div>
          <PriceChart
            allTrades={allTabTrades}
            filteredTrades={filteredAllTrades}
            sizeFilter={sizeFilter}
          />
        </div>
      )}

      {/* ── 🗺️ 실거래 지도 ── */}
      {viewMode === 'map' && (subTab === 'apt' || subTab === 'aptAll') && (
        <TradeMapView
          groups={aptGroups}
          tradeTypeFilter={tradeTypeFilter}
          subTab={subTab}
          coordsMap={coordsMap}
          guCode={subTab === 'aptAll' ? '11500' : null}
          sizeFilter={sizeFilter}
          onSelectComplex={(name) => {
            const idx = aptGroups.findIndex(g => g.name === name);
            if (idx >= 0) setCurrentPage(Math.floor(idx / PAGE_SIZE) + 1);
            setViewMode('list'); setExpanded(name);
            setHighlightedComplex(name);
            setTimeout(() => {
              document.getElementById(`complex-card-${name}`)
                ?.scrollIntoView({ behavior:'smooth', block:'center' });
            }, 300);
            setTimeout(() => setHighlightedComplex(null), 2500);
          }}
        />
      )}

      {/* ── 통계 배너 ── */}
      {!loading && data && (
        <div style={statsBanner}>
          {/* 오늘 신고 */}
          <div style={statCard}>
            <div style={statLabel}>오늘 신고</div>
            <div style={{ ...statValue, color: todayTrades.length > 0 ? 'var(--red)' : 'var(--gray)' }}>
              {todayTrades.length}건
            </div>
            <div style={statSub}>{today.getMonth()+1}월 {today.getDate()}일</div>
          </div>
          {/* 이달 최고가 */}
          <div style={statCard}>
            <div style={statLabel}>이달 최고가</div>
            <div style={{ ...statValue, color:'var(--navy)' }}>
              {thisMonthHigh ? formatPrice(thisMonthHigh.price) : '-'}
            </div>
            <div style={statSub}>{thisMonthHigh ? `${thisMonthHigh.name.slice(0,8)} · ${thisMonthHigh.area}㎡` : '-'}</div>
          </div>
          {/* 역대 최고가 */}
          <div style={statCard}>
            <div style={statLabel}>역대 최고가</div>
            <div style={{ ...statValue, color:'var(--gold)' }}>
              {highTrade ? formatPrice(highTrade.price) : '-'}
            </div>
            <div style={statSub}>{highTrade ? `${highTrade.name.slice(0,8)} · ${formatDateShort(highTrade)}` : '-'}</div>
          </div>
        </div>
      )}

      {/* ── 일별 실거래 신고건수 ── */}
      {!loading && data && dailyCounts.length > 0 && (
        <div style={dailySection}>
          <div
            style={{ ...dailySectionTitle, marginBottom: dailyOpen ? 10 : 0, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
            onClick={() => setDailyOpen(o => !o)}
          >
            <span>
              📊 일별 실거래 신고건수
              <span style={{ fontSize:10, color:'var(--gray)', fontWeight:400, marginLeft:6 }}>
                최근 {dailyCounts.length}일 · {sizeFilter !== '전체' ? `${sizeFilter} · ` : ''}국토교통부 신고 기준
              </span>
            </span>
            <span style={{ fontSize:11, color:'var(--gray)' }}>{dailyOpen ? '▲' : '▼'}</span>
          </div>
          {dailyOpen && (
            <>
              <div style={{ fontSize:9, color:'var(--gray)', marginBottom:8, lineHeight:1.5 }}>
                매수자가 계약 후 30일 이내 국토부에 신고한 건수입니다. 토지거래허가구역은 허가 후 신고 포함.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {dailyCounts.map(([date, count]) => (
                  <div key={date} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:9, color:'var(--gray)', width:60, flexShrink:0 }}>{date.slice(5)}</span>
                    <div style={{ flex:1, background:'var(--bg)', borderRadius:3, height:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                      <div style={{
                        width:`${Math.round((count/maxDaily)*100)}%`,
                        background: count === maxDaily ? 'var(--red)' : 'var(--navy)',
                        height:'100%', borderRadius:3, transition:'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color: count === maxDaily ? 'var(--red)' : 'var(--text)', width:22, textAlign:'right' }}>{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 단지별 신고건수 ── */}
      {!loading && data && (
        <div style={dailySection}>
          {/* 헤더 (항상 표시) */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: complexOpen ? 10 : 0 }}>
            <div
              style={{ ...dailySectionTitle, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
              onClick={() => setComplexOpen(o => !o)}
            >
              🏢 단지별 신고건수
              <span style={{ fontSize:10, color:'var(--gray)', fontWeight:400 }}>
                {sizeFilter !== '전체' ? `${sizeFilter} · ` : ''}상위 {complexCounts.length}개 단지
              </span>
              <span style={{ fontSize:11, color:'var(--gray)' }}>{complexOpen ? '▲' : '▼'}</span>
            </div>
            {complexOpen && (
              <div style={{ display:'flex', gap:4 }}>
                {COMPLEX_PERIODS.map(p => (
                  <button
                    key={p.key}
                    onClick={e => { e.stopPropagation(); setComplexPeriod(p.key); }}
                    style={{
                      padding:'3px 8px', borderRadius:8, fontSize:10, fontWeight:600, cursor:'pointer',
                      border: complexPeriod === p.key ? '1px solid var(--navy)' : '1px solid var(--border)',
                      background: complexPeriod === p.key ? 'var(--navy)' : '#FFFFFF',
                      color: complexPeriod === p.key ? '#FFFFFF' : 'var(--gray)',
                    }}
                  >{p.label}</button>
                ))}
              </div>
            )}
          </div>
          {complexOpen && complexCounts.length === 0 && (
            <div style={{ fontSize:11, color:'var(--gray)', textAlign:'center', padding:'16px 0' }}>
              해당 기간에 신고된 거래가 없습니다
            </div>
          )}
          {complexOpen && <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {complexCounts.map(([name, count], idx) => {
              const isExpanded = complexExpanded === name;
              const detailTrades = isExpanded
                ? complexPeriodTrades
                    .filter(t => t.name === name)
                    .sort((a, b) => {
                      const da = new Date(`${a.year}-${a.month}-${a.day||'01'}`);
                      const db = new Date(`${b.year}-${b.month}-${b.day||'01'}`);
                      return db - da;
                    })
                : [];
              return (
                <div key={name}>
                  {/* 바 행 */}
                  <div
                    style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'4px 2px', borderRadius:6,
                      background: isExpanded ? 'rgba(11,40,73,0.04)' : 'transparent' }}
                    onClick={() => setComplexExpanded(isExpanded ? null : name)}
                  >
                    <span style={{ fontSize:9, color: idx === 0 ? 'var(--gold)' : 'var(--gray)',
                      width:96, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      fontWeight: idx === 0 ? 700 : 400, textDecoration: isExpanded ? 'underline' : 'none' }}>
                      {name}
                    </span>
                    <div style={{ flex:1, background:'var(--bg)', borderRadius:3, height:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                      <div style={{
                        width:`${Math.round((count/maxComplexCount)*100)}%`,
                        background: idx === 0 ? 'var(--gold)' : 'rgba(11,40,73,0.55)',
                        height:'100%', borderRadius:3,
                      }} />
                    </div>
                    <span style={{ fontSize:10, fontWeight:700,
                      color: idx === 0 ? 'var(--gold)' : 'var(--text)',
                      width:26, textAlign:'right' }}>{count}건</span>
                    <span style={{ fontSize:9, color:'var(--gray)', width:10, textAlign:'center' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* 세부 거래 목록 */}
                  {isExpanded && (
                    <div style={{ margin:'4px 0 6px 0', background:'rgba(11,40,73,0.03)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                      {detailTrades.map((t, i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                          padding:'7px 10px', borderBottom: i < detailTrades.length-1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                            <span style={{ fontSize:11, color:'var(--navy)', fontWeight:600 }}>
                              {t.area}㎡ · {t.floor}층
                            </span>
                            <span style={{ fontSize:10, color:'var(--gray)' }}>
                              {t.year}.{t.month}.{t.day || '??'}
                            </span>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>
                            {t.price >= 10000
                              ? `${Math.floor(t.price/10000)}억${t.price%10000 ? ` ${(t.price%10000).toLocaleString()}만` : ''}`
                              : `${t.price.toLocaleString()}만`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>}
        </div>
      )}

      {/* 전세 탭 로딩 */}
      {tradeTypeFilter === '전세' && dailyLoading && (
        <div style={{ textAlign:'center', padding:'32px 0', color:'var(--gray)', fontSize:13 }}>
          전세 데이터 불러오는 중...
        </div>
      )}

      {/* 아파트 목록 (apt & aptAll 공통) */}
      {!loading && isAptTab && (tradeTypeFilter === '매매' ? data : dailyData) && viewMode === 'list' && (
        <>
          <div style={{ ...countBar, flexDirection:'column', alignItems:'stretch', gap:8 }}>
            <div>
              {tradeTypeFilter === '전세' && <span style={{ color:'#2176ae', fontWeight:700, marginRight:4 }}>전세</span>}
              총 <strong>{aptGroups.reduce((s, g) => s + (sizeFilter === '전체' ? g.trades.length : g.trades.filter(t => getSizeGroup(t.area) === sizeFilter).length), 0)}건</strong> · {aptGroups.length}개 단지
              {searchQuery.trim() && <span style={{ color:'var(--navy)' }}> · "{searchQuery.trim()}" 검색</span>}
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {[
                { key:'recent',    label:'최신순' },
                { key:'priceDesc', label:'최고가순' },
                { key:'priceAsc',  label:'최저가순' },
                { key:'alpha',     label:'가나다순' },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)}
                  style={{ fontSize:10, padding:'4px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontWeight: sortBy === s.key ? 700 : 400,
                    background: sortBy === s.key ? 'var(--navy)' : '#FFFFFF',
                    color:      sortBy === s.key ? '#FFFFFF' : 'var(--gray)',
                    borderColor: sortBy === s.key ? 'var(--navy)' : 'var(--border)',
                  }}>
                  {s.label}
                </button>
              ))}
              {(sortBy === 'priceDesc' || sortBy === 'priceAsc') && (
                <span style={{ fontSize:9, color:'var(--gray)', alignSelf:'center' }}>최근 1개월 평균가 기준</span>
              )}
            </div>
          </div>
          {aptGroups.length === 0 && <div style={emptyBox}>조회된 거래가 없습니다</div>}
          {pagedGroups.map(g => {
            const filteredTrades = sizeFilter === '전체' ? g.trades : g.trades.filter(t => getSizeGroup(t.area) === sizeFilter);
            const displayTrade = filteredTrades[0] || g.trades[0];
            const isHighlighted = highlightedComplex === g.name;
            return (
              <div key={g.name} id={`complex-card-${g.name}`}
                style={{ ...complexCard, ...(isHighlighted ? {
                  border: '2px solid var(--gold)',
                  background: 'rgba(200,168,64,0.08)',
                  boxShadow: '0 0 0 3px rgba(200,168,64,0.3)',
                } : {}) }}>
                {/* 단지 헤더 */}
                <div style={complexHeader} onClick={() => setExpanded(expanded === g.name ? null : g.name)}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:2, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                      {g.name}
                      {subTab === 'aptAll' && displayTrade.dong && (
                        <span style={{ fontSize:9, padding:'2px 6px', background:'rgba(11,40,73,0.07)', color:'var(--navy)', borderRadius:8, fontWeight:600, border:'1px solid rgba(11,40,73,0.14)' }}>
                          {displayTrade.dong}
                        </span>
                      )}
                      <AptLinks name={g.name} dong={displayTrade.dong} />
                    </div>
                    <div style={{ fontSize:10, color:'var(--gray)' }}>
                      {formatDate(displayTrade)} 최신 · 총 {filteredTrades.length}건
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:17, fontWeight:800, color: tradeTypeFilter === '전세' ? '#2176ae' : 'var(--text)' }}>
                      {formatPrice(displayTrade.price)}
                    </div>
                    {tradeTypeFilter === '매매' && filteredTrades.length > 1 && (() => {
                      const prices = filteredTrades.map(t => parseInt(t.price)||0).filter(p=>p>0);
                      if (!prices.length) return null;
                      const maxP = Math.max(...prices);
                      const latestP = parseInt(displayTrade.price)||0;
                      if (maxP <= 0) return null;
                      const pct = Math.round((latestP/maxP)*100);
                      if (pct >= 100) return <div style={{ fontSize:9, color:'#D94545', fontWeight:700, marginTop:1 }}>신고가 🔥</div>;
                      const c = pct >= 95 ? '#1a9068' : pct >= 80 ? '#d4860a' : '#D94545';
                      return <div style={{ fontSize:9, color:c, marginTop:1 }}>최고가의 {pct}%</div>;
                    })()}
                    <div style={{ fontSize:10, color: tradeTypeFilter === '전세' ? '#6b8fa8' : 'var(--gold)', marginTop:1 }}>
                      {displayTrade.area}㎡ · {displayTrade.floor}층
                    </div>
                  </div>
                </div>

                {/* 가격 범위 바 */}
                {filteredTrades.length > 1 && (() => {
                  const prices = filteredTrades.map(t => parseInt(t.price) || 0);
                  const min = Math.min(...prices);
                  const max = Math.max(...prices);
                  const latest = parseInt(filteredTrades[0].price) || 0;
                  const pct = max > min ? Math.round(((latest - min) / (max - min)) * 100) : 50;
                  return (
                    <div style={{ padding:'10px 0 4px' }}>
                      <div style={rangeBar}>
                        <div style={{ ...rangeThumb, left:`${pct}%` }} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                        <span style={{ fontSize:9, color:'var(--gray)' }}>최저 {formatPrice(String(min))}</span>
                        <span style={{ fontSize:9, color:'var(--gray)' }}>최고 {formatPrice(String(max))}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 인라인 스파크라인 (항상 표시) */}
                {filteredTrades.length >= 3 && (() => {
                  const sorted = [...filteredTrades].sort((a,b) => {
                    const da = `${a.year}${String(a.month).padStart(2,'0')}${String(a.day||'01').padStart(2,'0')}`;
                    const db = `${b.year}${String(b.month).padStart(2,'0')}${String(b.day||'01').padStart(2,'0')}`;
                    return da < db ? -1 : 1;
                  });
                  const prices = sorted.map(t=>parseInt(t.price)||0).filter(p=>p>0);
                  if (prices.length < 2) return null;
                  const min = Math.min(...prices), max = Math.max(...prices);
                  const range = max - min || 1;
                  const W = 200, H = 24;
                  const pts = prices.map((p,i) => ({
                    x: (i/(prices.length-1))*W,
                    y: 2 + (H-4) - ((p-min)/range)*(H-4)
                  }));
                  const d = pts.map((pt,i)=>`${i===0?'M':'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
                  const delta = prices[prices.length-1] - prices[0];
                  const color = delta > 0 ? '#D94545' : delta < 0 ? '#1a9068' : '#888';
                  return (
                    <div style={{ padding:'4px 0 2px' }}>
                      <svg width="100%" viewBox="0 0 200 24" preserveAspectRatio="none" style={{ display:'block', height:24 }}>
                        <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.65" />
                        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill={color} stroke="#fff" strokeWidth="1" />
                      </svg>
                    </div>
                  );
                })()}

                {/* 상세 거래 내역 */}
                {expanded === g.name && (
                  <div style={tradeList}>
                    {/* 단지별 가격 추이 미니 차트 */}
                    <MiniPriceChart trades={filteredTrades} />
                    <div style={tradeListHeader}>
                      <span>면적 · 층</span>
                      <span>계약</span>
                      <span style={{ textAlign:'right' }}>거래금액</span>
                    </div>
                    {filteredTrades.slice(0, 20).map((t, i) => (
                      <div key={i} style={tradeRow}>
                        <span style={{ color:'var(--text-2)' }}>{t.area}㎡ · {t.floor}층</span>
                        <span style={{ color:'var(--gray)' }}>{formatDate(t)}</span>
                        <span style={{ fontWeight:700, color:'var(--navy)', textAlign:'right' }}>
                          {formatPrice(t.price)}
                        </span>
                      </div>
                    ))}
                    {filteredTrades.length > 20 && (
                      <div style={{ fontSize:10, color:'var(--gray)', textAlign:'center', paddingTop:6 }}>
                        외 {filteredTrades.length - 20}건 더 있음
                      </div>
                    )}
                  </div>
                )}

                {/* 펼치기 버튼 */}
                <button style={expandBtn} onClick={() => setExpanded(expanded === g.name ? null : g.name)}>
                  {expanded === g.name ? '▲ 접기' : `▼ ${tradeTypeFilter === '전세' ? '전세 ' : ''}상세 ${filteredTrades.length}건 보기`}
                </button>
              </div>
            );
          })}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display:'flex', gap:4, justifyContent:'center', padding:'12px 0' }}>
              <button style={pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</button>
              <button style={pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
              {buildPageNums(currentPage, totalPages).map((p, i) =>
                p === '...'
                  ? <span key={`ellipsis-${i}`} style={{ padding:'6px 4px', color:'var(--gray)' }}>…</span>
                  : <button
                      key={p}
                      style={{ ...pageBtn, ...(currentPage === p ? { background:'var(--navy)', color:'#fff', border:'none', fontWeight:700 } : {}) }}
                      onClick={() => setCurrentPage(p)}
                    >{p}</button>
              )}
              <button style={pageBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
              <button style={pageBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
            </div>
          )}
        </>
      )}

      {/* 강서구 분양권 */}
      {!loading && subTab === 'silv' && data && viewMode === 'list' && (
        <div>
          <div style={countBar}>
            총 <strong>{silvItems.length}건</strong> · 강서구 전체 · 최근 12개월
            {searchQuery.trim() && <span style={{ color:'var(--navy)' }}> · "{searchQuery.trim()}" 검색</span>}
          </div>
          {silvItems.length === 0 && (
            <div style={emptyBox}>
              최근 12개월 강서구 분양권 전매 내역이 없습니다.<br />
              <span style={{ fontSize:10, color:'var(--gray)', lineHeight:1.8, display:'block', marginTop:4 }}>
                래미안 엘라비네 무순위 계약분은 신고 기간(30일) 이후 표시됩니다.
              </span>
            </div>
          )}
          {silvItems.map((t, i) => (
            <div key={i} style={{ ...silvCard, ...(t.dong === '방화동' ? { borderColor:'var(--gold)', background:'rgba(200,168,64,0.03)' } : {}) }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:2, display:'flex', alignItems:'center', gap:4 }}>
                    {t.name}
                    <span style={{ fontSize:9, marginLeft:4, padding:'2px 6px', background: t.dong === '방화동' ? 'var(--gold)' : 'var(--bg)', color: t.dong === '방화동' ? '#fff' : 'var(--gray)', borderRadius:8, fontWeight:600, border:'1px solid var(--border)' }}>{t.dong}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--gray)' }}>{formatDate(t)}</div>
                </div>
                <div style={dateChip}>{formatDate(t)}</div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>
                  전용 {t.area}㎡ · {t.floor}층
                </div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>
                  {formatPrice(t.price)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 하단 정보 */}
      {data && !loading && (
        <div style={infoBox}>
          <div style={{ fontSize:10, color:'var(--gray)', marginBottom:3 }}>
            🕐 {lastFetched
              ? `${lastFetched.toLocaleDateString('ko-KR')} ${lastFetched.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })} 기준`
              : ''}
          </div>
          <div style={{ fontSize:10, color:'var(--text-2)', lineHeight:1.7 }}>
            국토교통부 실거래가 신고 기준 · 계약 해제 건은 자동 제외됩니다.
          </div>
        </div>
      )}

      <button style={refreshBtn} onClick={() => loadData(true)} disabled={loading}>
        🔄 새 데이터 불러오기
      </button>

      </>)} {/* end subTab !== 'seoul' */}
    </div>
  );
}

/* ─── 스타일 ─── */
const wrap = { padding: '16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub   = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine     = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };

const subTabRow = {
  display:'flex', gap:6, marginBottom:10,
};
const sizeFilterRow = {
  display:'flex', gap:6, marginBottom:16,
};
const sizeFilterBtn = {
  flex:1, padding:'7px 4px', borderRadius:10, fontSize:11, fontWeight:500,
  border:'1px solid var(--border)', background:'#FFFFFF',
  color:'var(--gray)', cursor:'pointer',
};
const subTabBtn = {
  flex:1, padding:'9px 4px', borderRadius:12, fontSize:11, fontWeight:600,
  border:'1px solid var(--border)', background:'#FFFFFF',
  color:'var(--gray)', cursor:'pointer',
};
const subTabActive = {
  background:'var(--navy)', color:'#FFFFFF', border:'none',
};

const loadingBox = {
  textAlign:'center', padding:'40px 20px',
};
const errBox = {
  background:'rgba(217,69,69,0.06)', border:'1px solid rgba(217,69,69,0.2)',
  borderRadius:12, padding:'16px', fontSize:12, color:'var(--red)', lineHeight:1.7,
  textAlign:'center', marginBottom:12,
};
const emptyBox = {
  textAlign:'center', padding:'30px', fontSize:12, color:'var(--gray)', lineHeight:1.8,
  background:'var(--bg)', borderRadius:12, border:'1px solid var(--border)',
};
const countBar = {
  fontSize:11, color:'var(--text-2)', marginBottom:12,
};

const complexCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'14px 16px', marginBottom:10,
  boxShadow:'var(--shadow-sm)',
};
const complexHeader = {
  display:'flex', justifyContent:'space-between', alignItems:'center',
  cursor:'pointer',
};
const rangeBar = {
  height:4, background:'var(--bg)', borderRadius:2, position:'relative',
  border:'1px solid var(--border)',
};
const rangeThumb = {
  position:'absolute', top:'50%', transform:'translate(-50%, -50%)',
  width:10, height:10, borderRadius:'50%',
  background:'var(--gold)', border:'2px solid #FFFFFF',
  boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
};
const tradeList = {
  marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10,
};
const tradeListHeader = {
  display:'grid', gridTemplateColumns:'1fr 60px 80px',
  fontSize:9, color:'var(--gray)', letterSpacing:0.5,
  paddingBottom:6, borderBottom:'1px solid var(--border)', marginBottom:6,
};
const tradeRow = {
  display:'grid', gridTemplateColumns:'1fr 60px 80px',
  fontSize:11, padding:'5px 0',
  borderBottom:'1px solid rgba(0,0,0,0.04)',
};
const expandBtn = {
  width:'100%', marginTop:10, padding:'7px',
  background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, fontSize:11, color:'var(--navy)', cursor:'pointer', fontWeight:600,
};

const silvCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'14px 16px', marginBottom:10,
  boxShadow:'var(--shadow-sm)',
};
const dateChip = {
  fontSize:9, padding:'3px 8px', borderRadius:10,
  background:'rgba(200,168,64,0.1)', color:'var(--gold)',
  border:'1px solid var(--gold-dim)', fontWeight:600,
};

const infoBox = {
  background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:10, padding:'10px 14px', marginTop:4, marginBottom:4,
};
const refreshBtn = {
  width:'100%', padding:14, background:'#FFFFFF',
  border:'1px solid var(--border)', borderRadius:12,
  color:'var(--navy)', fontSize:13, marginTop:8, fontWeight:500, cursor:'pointer',
};

const pageBtn = {
  padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8,
  background:'#FFFFFF', color:'var(--navy)', fontSize:13, cursor:'pointer', fontWeight:600,
};

const trackSection = {
  background:'#FFFFFF', border:'1.5px solid var(--navy)',
  borderRadius:14, padding:'14px 16px', marginBottom:16,
  boxShadow:'0 2px 12px rgba(11,40,73,0.08)',
};
const trackBadge = {
  fontSize:10, fontWeight:700, padding:'3px 8px',
  borderRadius:8, background:'rgba(11,40,73,0.07)',
  color:'var(--navy)', border:'1px solid rgba(11,40,73,0.15)',
  whiteSpace:'nowrap', flexShrink:0,
};

const statsBanner = {
  display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16,
};
const statCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:12, padding:'10px 10px 8px', textAlign:'center',
  boxShadow:'var(--shadow-sm)',
};
const statLabel = {
  fontSize:9, color:'var(--gray)', fontWeight:600, letterSpacing:0.3, marginBottom:4,
};
const statValue = {
  fontSize:15, fontWeight:800, marginBottom:3, lineHeight:1.2,
};
const statSub = {
  fontSize:8, color:'var(--gray)', lineHeight:1.4,
  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
};

const dailySection = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:12, padding:'12px 14px', marginBottom:16,
  boxShadow:'var(--shadow-sm)',
};
const dailySectionTitle = {
  fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:0,
};

const seoulTabBtn = {
  width:'100%', padding:'9px 12px', borderRadius:12, fontSize:12, fontWeight:600,
  border:'1px solid var(--border)', background:'#FFFFFF', color:'var(--gray)',
  cursor:'pointer', textAlign:'left', marginBottom:14,
};
const seoulTabActive = {
  background:'var(--navy)', color:'#FFFFFF', border:'none',
};
