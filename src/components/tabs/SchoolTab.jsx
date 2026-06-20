import { useState, useEffect, useRef } from 'react';
import { GU_LIST, GU_CENTER, SEOUL_SCHOOLS } from '../../data/schoolData';

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

// 구별 geocode 캐시 (탭 재진입 시 재검색 방지)
const _coordCache = {};

function getTotal(s)  { return (s.science||0)+(s.foreign||0)+(s.private||0)+(s.gifted||0); }
function getRate(s)   { return s.graduates ? (getTotal(s)/s.graduates)*100 : 0; }

const RANK_BADGE = {
  1: { bg:'#FFD700', color:'#7a5700' },
  2: { bg:'#C0C0C0', color:'#444'   },
  3: { bg:'#CD7F32', color:'#fff'   },
};

const SORT_OPTIONS = [
  { key:'rate',      label:'진학률순' },
  { key:'total',     label:'진학자순' },
  { key:'graduates', label:'졸업생순' },
  { key:'name',      label:'이름순'  },
];

// 카카오 Places로 학교 좌표 검색
function searchSchoolCoord(ps, kakao, school, gu, center) {
  return new Promise((resolve) => {
    ps.keywordSearch(
      `${school.name} ${gu}`,
      (results, status) => {
        if (status === kakao.maps.services.Status.OK && results.length > 0) {
          const exact = results.find(r => r.place_name === school.name || r.place_name.includes(school.name));
          const best  = exact || results[0];
          resolve({ name: school.name, lat: parseFloat(best.y), lng: parseFloat(best.x) });
        } else {
          resolve(null); // 폴백 없음 → 마커 미표시
        }
      },
      { location: new kakao.maps.LatLng(center.lat, center.lng), radius: 6000, category_group_code: 'SC4' }
    );
  });
}

export default function SchoolTab() {
  const [selectedGu, setSelectedGu] = useState('강서구');
  const [sortKey,    setSortKey]    = useState('rate');
  const [magokOnly,  setMagokOnly]  = useState(false);
  const [mapReady,   setMapReady]   = useState(false);
  const [geocoded,   setGeocoded]   = useState(_coordCache['강서구'] || null);
  const [geocoding,  setGeocoding]  = useState(false);
  const [selected,   setSelected]   = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const overlaysRef     = useRef([]);

  const schools    = SEOUL_SCHOOLS[selectedGu] || [];
  const center     = GU_CENTER[selectedGu] || { lat:37.5665, lng:126.9780 };
  const isGangseo  = selectedGu === '강서구';

  // 자사고 데이터 보유 구 (allinfo.today 2024학년도)
  const PRIVATE_GU = new Set(['강남구','서초구','양천구','송파구','노원구','강서구']);
  const hasPrivate = PRIVATE_GU.has(selectedGu);
  const footerText = hasPrivate
    ? `★ ${selectedGu}: 졸업생·과학고·외고 asil.kr 2025학년도 / 자사고 allinfo.today 2024학년도`
    : `☆ ${selectedGu}: asil.kr 2025학년도 실수치 — 과학고·외고 확인 / 자사고 미수집(0 표시)`;

  // 구별 좌표 매핑
  const coordMap = geocoded
    ? Object.fromEntries(geocoded.filter(Boolean).map(g => [g.name, { lat: g.lat, lng: g.lng }]))
    : {};

  const schoolsWithCoords = schools.map(s => ({
    ...s,
    lat: coordMap[s.name]?.lat,
    lng: coordMap[s.name]?.lng,
  }));

  // 정렬·필터
  const sorted = [...schoolsWithCoords]
    .filter(s => !magokOnly || s.magok)
    .sort((a, b) => {
      if (sortKey === 'rate')      return getRate(b)  - getRate(a);
      if (sortKey === 'total')     return getTotal(b) - getTotal(a);
      if (sortKey === 'graduates') return b.graduates - a.graduates;
      return a.name.localeCompare(b.name, 'ko');
    })
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const avgRate   = schools.length ? schools.reduce((acc, s) => acc + getRate(s), 0) / schools.length : 0;
  const topSchool = schools.length ? [...schools].sort((a,b) => getRate(b)-getRate(a))[0] : null;
  const magokList = schools.filter(s => s.magok);

  // Kakao SDK 로드 (libraries=services)
  useEffect(() => {
    function onSdkReady() {
      setMapReady(true);
      geocodeGu(selectedGu);
    }
    if (window.kakao?.maps?.services) { onSdkReady(); return; }

    if (!KAKAO_JS_KEY) { setMapReady(true); return; }

    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) {
      existing.addEventListener('load', () =>
        window.kakao?.maps?.load ? window.kakao.maps.load(onSdkReady) : onSdkReady()
      );
      return;
    }
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;
    script.onload = () => window.kakao.maps.load(onSdkReady);
    script.onerror = () => setMapReady(true);
    document.head.appendChild(script);

    // 10초 후에도 로드 안 되면 강제로 ready 처리
    const timer = setTimeout(() => setMapReady(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  // 구 변경 시 geocode + 지도 중심 이동
  useEffect(() => {
    setSelected(null);
    setMagokOnly(false);
    if (!mapReady) return;
    if (_coordCache[selectedGu]) {
      setGeocoded(_coordCache[selectedGu]);
    } else {
      setGeocoded(null);
      geocodeGu(selectedGu);
    }
    if (mapRef.current) {
      const kakao = window.kakao;
      mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
      mapRef.current.setLevel(6);
    }
  }, [selectedGu, mapReady]);

  function geocodeGu(gu) {
    if (_coordCache[gu] || !window.kakao?.maps?.services) return;
    const kakao = window.kakao;
    const ps    = new kakao.maps.services.Places();
    const c     = GU_CENTER[gu] || center;
    const list  = SEOUL_SCHOOLS[gu] || [];
    setGeocoding(true);
    Promise.all(list.map(s => searchSchoolCoord(ps, kakao, s, gu, c))).then(results => {
      _coordCache[gu] = results;
      setGeocoded(results);
      setGeocoding(false);
    });
  }

  // 마커 갱신
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) return;
    const kakao = window.kakao;

    if (!mapRef.current) {
      mapRef.current = new kakao.maps.Map(mapContainerRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: 6,
      });
      kakao.maps.event.addListener(mapRef.current, 'click', () => setSelected(null));
    }

    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    schoolsWithCoords.forEach(school => {
      if (!school.lat || !school.lng) return; // 좌표 없으면 스킵

      const total  = getTotal(school);
      const rate   = getRate(school);
      const isHome = school.magok;
      const bg     = isHome ? '#0B2849' : '#fff';
      const fg     = isHome ? '#C8A840' : '#0B2849';
      const border = isHome ? '#C8A840' : '#0B2849';

      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';

      const bubble = document.createElement('div');
      bubble.style.cssText = `
        background:${bg};color:${fg};border:2px solid ${border};
        border-radius:10px;padding:4px 8px;font-size:11px;font-weight:700;
        white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);
        line-height:1.4;text-align:center;
      `;
      bubble.innerHTML = `🏫 ${school.name}<br><span style="font-size:10px;font-weight:400;opacity:0.85;">특목·자사 ${total}명(${rate.toFixed(1)}%)</span>`;

      const tail = document.createElement('div');
      tail.style.cssText = `width:0;height:0;
        border-left:5px solid transparent;border-right:5px solid transparent;
        border-top:7px solid ${border};margin-top:-1px;`;

      wrap.appendChild(bubble);
      wrap.appendChild(tail);
      wrap.addEventListener('click', (e) => { e.stopPropagation(); setSelected(school); });

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(school.lat, school.lng),
        content: wrap,
        yAnchor: 1.15,
        zIndex: isHome ? 10 : 1,
      });
      overlay.setMap(mapRef.current);
      overlaysRef.current.push(overlay);
    });
  }, [mapReady, geocoded, selectedGu]);

  const selTotal = selected ? getTotal(selected) : 0;
  const selRate  = selected ? getRate(selected)  : 0;

  return (
    <div style={{ padding:'16px 16px 120px', maxWidth:760, margin:'0 auto', wordBreak:'keep-all' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        background:'var(--navy)', borderRadius:14,
        padding:'20px 20px 16px', marginBottom:16, color:'#fff',
      }}>
        <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px' }}>🏫 서울 학군 정보</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)', marginTop:4 }}>
          2025학년도 졸업생 기준 (2026년 공시) · 특목고·자사고 진학률 순위
        </div>
      </div>

      {/* ── 구 선택 ────────────────────────────────────────────────── */}
      <div style={{
        background:'#fff', border:'1px solid var(--border)',
        borderRadius:12, padding:'14px 16px', marginBottom:16,
        boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize:11, color:'var(--gray)', marginBottom:10, fontWeight:600, letterSpacing:'0.3px' }}>
          자치구 선택
        </div>
        <div style={{ position:'relative' }}>
          <select
            value={selectedGu}
            onChange={e => setSelectedGu(e.target.value)}
            style={{
              width:'100%', padding:'11px 40px 11px 14px',
              borderRadius:10, border:'1.5px solid var(--border)',
              background:'#fff', fontSize:16, fontWeight:700,
              color:'var(--navy)', appearance:'none', WebkitAppearance:'none',
              cursor:'pointer', outline:'none', transition:'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor='var(--navy)'}
            onBlur={e  => e.target.style.borderColor='var(--border)'}
          >
            {[...GU_LIST].sort((a, b) => a.localeCompare(b, 'ko')).map(gu => (
              <option key={gu} value={gu}>{gu === '강서구' ? '🏠 강서구' : gu}</option>
            ))}
          </select>
          <span style={{
            position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
            pointerEvents:'none', fontSize:11, color:'var(--gray)',
          }}>▼</span>
        </div>
      </div>

      {/* ── Summary stats ──────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'총 중학교',       value:`${schools.length}개교`,     sub:`${selectedGu} 전체` },
          { label:'평균 특목·자사율', value:`${avgRate.toFixed(1)}%`,    sub: topSchool ? `최고 ${topSchool.name}` : '' },
          { label:'마곡동 배정',      value: isGangseo ? `${magokList.length}개교` : '–',
            sub: isGangseo ? magokList.map(s=>s.name).join('·') : '강서구에서 확인' },
        ].map(c => (
          <div key={c.label} style={{
            background:'#fff', border:'1px solid var(--border)',
            borderRadius:12, padding:'12px 14px',
            boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize:10, color:'var(--gray)', marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--navy)' }}>{c.value}</div>
            <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Map ────────────────────────────────────────────────────── */}
      <div style={{
        background:'#fff', border:'1px solid var(--border)',
        borderRadius:12, overflow:'hidden',
        boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
        marginBottom:16, position:'relative',
      }}>
        <div style={{
          padding:'12px 16px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        }}>
          <span style={{ fontSize:15 }}>🗺️</span>
          <span style={{ fontWeight:700, fontSize:13, color:'var(--navy)' }}>{selectedGu} 중학교 위치</span>
          {geocoding && <span style={{ fontSize:11, color:'var(--gray)' }}>📍 좌표 조회 중…</span>}
          {isGangseo && !geocoding && (
            <span style={{ fontSize:11, color:'var(--gray)', marginLeft:'auto' }}>
              <span style={{ background:'#0B2849', color:'#C8A840', borderRadius:4, padding:'1px 6px', fontSize:10, fontWeight:700 }}>남색</span>
              {' '}마곡동 배정
            </span>
          )}
        </div>

        <div style={{ position:'relative', height:420 }}>
          <div ref={mapContainerRef} style={{ width:'100%', height:'100%', background:'#e8e4dc' }}>
            {!mapReady && (
              <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray)', fontSize:13 }}>
                지도 로딩 중…
              </div>
            )}
            {mapReady && !window.kakao?.maps && (
              <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--gray)', gap:8 }}>
                <span style={{ fontSize:28 }}>🗺️</span>
                <span style={{ fontSize:13, fontWeight:600 }}>지도를 불러올 수 없습니다</span>
                <span style={{ fontSize:11 }}>Vercel에 VITE_KAKAO_JS_KEY 환경변수를 등록해주세요</span>
              </div>
            )}
          </div>

          {/* Bottom sheet */}
          {selected && (
            <div style={{
              position:'absolute', bottom:0, left:0, right:0, zIndex:50,
              background:'#fff', borderTop:'2px solid var(--border)',
              borderRadius:'16px 16px 0 0',
              boxShadow:'0 -4px 24px rgba(0,0,0,0.15)',
              padding:'0 0 16px',
              animation:'slideUp 0.2s ease',
            }}>
              <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
                <div style={{ width:36, height:4, background:'#ddd', borderRadius:2 }} />
              </div>
              <div style={{ padding:'4px 16px 12px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:17, fontWeight:800, color:'var(--navy)' }}>🏫 {selected.name}</span>
                  <span style={{
                    fontSize:10, background:selected.type==='사립'?'#f0f0f0':'#e8f0ff',
                    color:selected.type==='사립'?'#666':'#0B2849',
                    borderRadius:4, padding:'1px 6px', fontWeight:700,
                  }}>{selected.type}</span>
                  {selected.magok && (
                    <span style={{ fontSize:10, background:'var(--navy)', color:'#C8A840', borderRadius:4, padding:'2px 7px', fontWeight:700 }}>
                      🏠 마곡동 배정
                    </span>
                  )}
                  {selected.note && (
                    <span style={{ fontSize:10, background:'#e8f5e9', color:'#2e7d32', borderRadius:4, padding:'1px 6px' }}>{selected.note}</span>
                  )}
                  <button onClick={() => setSelected(null)} style={{
                    marginLeft:'auto', background:'none', border:'none',
                    fontSize:18, cursor:'pointer', color:'var(--gray)', padding:4,
                  }}>✕</button>
                </div>
                <div style={{ fontSize:11, color:'var(--gray)', marginTop:3 }}>
                  졸업생 {selected.graduates.toLocaleString()}명 · 2025학년도 기준
                </div>
              </div>
              <div style={{ padding:'12px 16px 0' }}>
                <div style={{
                  background: selTotal>0 ? 'var(--navy)' : '#f8f6f1',
                  borderRadius:12, padding:'12px 16px', marginBottom:10,
                  display:'flex', alignItems:'center', gap:16,
                }}>
                  <div>
                    <div style={{ fontSize:10, color:selTotal>0?'rgba(255,255,255,0.6)':'var(--gray)' }}>특목·자사고 합계</div>
                    <div style={{ fontSize:26, fontWeight:800, color:selTotal>0?'#C8A840':'var(--text)' }}>{selTotal}명</div>
                  </div>
                  <div style={{ fontSize:24, fontWeight:800, color:selTotal>0?'rgba(255,255,255,0.3)':'var(--border)' }}>|</div>
                  <div>
                    <div style={{ fontSize:10, color:selTotal>0?'rgba(255,255,255,0.6)':'var(--gray)' }}>진학률</div>
                    <div style={{ fontSize:26, fontWeight:800, color:selTotal>0?'#fff':'var(--text)' }}>{selRate.toFixed(1)}%</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {[
                    { label:'과학고',      value:selected.science },
                    { label:'외고·국제고', value:selected.foreign },
                    { label:'자사고',      value:selected.private },
                    { label:'영재고',      value:selected.gifted  },
                  ].map(item => (
                    <div key={item.label} style={{ background:'#f8f6f1', borderRadius:8, padding:'8px 6px', textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:800, color:item.value>0?'var(--navy)':'var(--gray)' }}>
                        {item.value > 0 ? item.value : '–'}
                      </div>
                      <div style={{ fontSize:9, color:'var(--gray)', marginTop:2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {SORT_OPTIONS.map(o => (
          <button key={o.key} onClick={() => setSortKey(o.key)} style={{
            padding:'6px 12px', borderRadius:20, fontSize:12,
            border:'1px solid var(--border)',
            background: sortKey===o.key ? 'var(--navy)' : '#fff',
            color: sortKey===o.key ? '#fff' : 'var(--text)',
            fontWeight: sortKey===o.key ? 700 : 400,
            cursor:'pointer', transition:'all 0.18s',
          }}>{o.label}</button>
        ))}
        {isGangseo && (
          <button onClick={() => setMagokOnly(v => !v)} style={{
            marginLeft:'auto', padding:'6px 14px', borderRadius:20, fontSize:12,
            border:`1.5px solid ${magokOnly?'#C8A840':'var(--border)'}`,
            background: magokOnly ? '#0B2849' : '#fff',
            color: magokOnly ? '#C8A840' : 'var(--text)',
            fontWeight: magokOnly ? 700 : 400,
            cursor:'pointer', transition:'all 0.18s',
          }}>🏠 마곡동만 보기</button>
        )}
      </div>

      {/* ── Ranking table ───────────────────────────────────────────── */}
      <div style={{
        background:'#fff', border:'1px solid var(--border)',
        borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
        overflow:'hidden', marginBottom:16,
      }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>
            {selectedGu} 중학교 특목·자사고 진학률 순위
          </span>
          <span style={{ fontSize:11, color:'var(--gray)', marginLeft:'auto' }}>{sorted.length}개교</span>
        </div>

        {/* Desktop table */}
        <div className="school-table-wrapper" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:560 }}>
            <thead>
              <tr style={{ background:'#f8f6f1', borderBottom:'1px solid var(--border)' }}>
                {['순위','학교명','진학률','특목·자사\n합계','과학고','외고·\n국제고','자사고','영재고','졸업생'].map((h,i) => (
                  <th key={i} style={{
                    padding:'10px 10px', textAlign:i<=1?'left':'center',
                    fontWeight:700, color:'var(--navy)', fontSize:11,
                    whiteSpace:'pre-line', lineHeight:1.3,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const total = getTotal(s);
                const rate  = getRate(s);
                const badge = RANK_BADGE[s.rank];
                return (
                  <tr key={s.name}
                    onClick={() => setSelected(s)}
                    style={{
                      borderBottom:'1px solid var(--border)',
                      background: s.magok ? '#fffbf0' : '#fff',
                      cursor:'pointer', transition:'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = s.magok?'#fff5d6':'#f8f6f1'}
                    onMouseLeave={e => e.currentTarget.style.background = s.magok?'#fffbf0':'#fff'}
                  >
                    <td style={{ padding:'10px 10px', textAlign:'left' }}>
                      {badge ? (
                        <span style={{ display:'inline-block', background:badge.bg, color:badge.color, borderRadius:20, padding:'2px 9px', fontWeight:800, fontSize:11 }}>{s.rank}위</span>
                      ) : (
                        <span style={{ color:'var(--gray)', fontWeight:600 }}>{s.rank}위</span>
                      )}
                    </td>
                    <td style={{ padding:'10px 10px' }}>
                      <span style={{ fontWeight:700 }}>{s.name}</span>
                      {s.dong && !s.magok && <span style={{ marginLeft:5, fontSize:10, color:'#888', fontWeight:400, verticalAlign:'middle' }}>{s.dong}</span>}
                      {s.magok && <span style={{ marginLeft:5, fontSize:9, background:'var(--navy)', color:'#C8A840', borderRadius:4, padding:'1px 5px', fontWeight:700, verticalAlign:'middle' }}>마곡동</span>}
                      {s.type==='사립' && <span style={{ marginLeft:4, fontSize:9, background:'#f0f0f0', color:'#666', borderRadius:4, padding:'1px 5px', verticalAlign:'middle' }}>사립</span>}
                      {s.note && <span style={{ marginLeft:4, fontSize:9, background:'#e8f5e9', color:'#2e7d32', borderRadius:4, padding:'1px 5px', verticalAlign:'middle' }}>{s.note}</span>}
                      {s.verified && <span style={{ marginLeft:4, fontSize:9, color:'#1565c0', verticalAlign:'middle' }} title="학교알리미 공시 확인">★</span>}
                    </td>
                    <td style={{ padding:'10px 10px', textAlign:'center' }}>
                      <span style={{ fontWeight:700, fontSize:13, color:rate>=10?'#8b0000':rate>=6?'#c0392b':rate>=3?'#e67e22':'var(--gray)' }}>
                        {s.graduates > 0 ? `${rate.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 10px', textAlign:'center' }}>
                      <span style={{ fontWeight:800, color:total>0?'var(--navy)':'var(--gray)' }}>{s.graduates > 0 ? `${total}명` : '—'}</span>
                    </td>
                    {[s.science, s.foreign, s.private, s.gifted].map((v,idx) => (
                      <td key={idx} style={{ padding:'10px 10px', textAlign:'center', color:v>0?'var(--text)':'var(--gray)' }}>
                        {s.graduates > 0 ? (v>0?<b>{v}</b>:'–') : '—'}
                      </td>
                    ))}
                    <td style={{ padding:'10px 10px', textAlign:'center', color:'var(--gray)', fontSize:12 }}>
                      {s.graduates > 0 ? s.graduates.toLocaleString() : '미확인'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="school-cards" style={{ display:'none' }}>
          {sorted.map(s => {
            const total = getTotal(s);
            const rate  = getRate(s);
            const badge = RANK_BADGE[s.rank];
            return (
              <div key={s.name}
                onClick={() => setSelected(s)}
                style={{ padding:'13px 14px', borderBottom:'1px solid var(--border)', background:s.magok?'#fffbf0':'#fff', cursor:'pointer' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                  {badge ? (
                    <span style={{ background:badge.bg, color:badge.color, borderRadius:20, padding:'2px 8px', fontWeight:800, fontSize:11, flexShrink:0 }}>{s.rank}위</span>
                  ) : (
                    <span style={{ color:'var(--gray)', fontSize:12, flexShrink:0 }}>{s.rank}위</span>
                  )}
                  <span style={{ fontWeight:700, fontSize:14 }}>{s.name}</span>
                  {s.dong && !s.magok && <span style={{ fontSize:10, color:'#888', fontWeight:400, flexShrink:0 }}>{s.dong}</span>}
                  {s.magok && <span style={{ fontSize:9, background:'var(--navy)', color:'#C8A840', borderRadius:4, padding:'1px 5px', fontWeight:700, flexShrink:0 }}>마곡동</span>}
                  {s.type==='사립' && <span style={{ fontSize:9, background:'#f0f0f0', color:'#666', borderRadius:4, padding:'1px 5px', flexShrink:0 }}>사립</span>}
                  <span style={{ marginLeft:'auto', fontWeight:800, fontSize:15, color:rate>=10?'#8b0000':rate>=6?'#c0392b':rate>=3?'#e67e22':'var(--gray)', flexShrink:0 }}>
                    {s.graduates > 0 ? `${rate.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--gray)', flexWrap:'wrap' }}>
                  <span>특목·자사 <b style={{ color:'var(--navy)' }}>{s.graduates > 0 ? `${total}명` : '미확인'}</b></span>
                  {s.science>0 && <span>과학고 {s.science}</span>}
                  {s.foreign>0 && <span>외고·국제고 {s.foreign}</span>}
                  {s.private>0 && <span>자사고 {s.private}</span>}
                  {s.gifted>0  && <span>영재고 {s.gifted}</span>}
                  <span>졸업생 {s.graduates}명</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--gray)', background:'#fafafa', lineHeight:1.7 }}>
          {footerText}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform:translateY(100%); opacity:0; }
          to   { transform:translateY(0);    opacity:1; }
        }
        @media (max-width:600px) {
          .school-table-wrapper { display:none !important; }
          .school-cards         { display:block !important; }
        }
      `}</style>
    </div>
  );
}
