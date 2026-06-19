import { useEffect, useRef, useState } from 'react';

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

// 구별 중심 좌표
const GU_CENTERS = {
  '11110': { lat: 37.5726, lng: 126.9790, zoom: 6 }, // 종로구
  '11140': { lat: 37.5641, lng: 126.9979, zoom: 6 }, // 중구
  '11170': { lat: 37.5323, lng: 126.9900, zoom: 6 }, // 용산구
  '11200': { lat: 37.5531, lng: 127.0369, zoom: 6 }, // 성동구
  '11215': { lat: 37.5383, lng: 127.0825, zoom: 6 }, // 광진구
  '11230': { lat: 37.5744, lng: 127.0395, zoom: 6 }, // 동대문구
  '11260': { lat: 37.5953, lng: 127.0732, zoom: 6 }, // 중랑구
  '11290': { lat: 37.5894, lng: 126.9939, zoom: 6 }, // 성북구
  '11305': { lat: 37.6396, lng: 127.0113, zoom: 6 }, // 강북구
  '11320': { lat: 37.6688, lng: 127.0471, zoom: 6 }, // 도봉구
  '11350': { lat: 37.6541, lng: 127.0568, zoom: 6 }, // 노원구
  '11380': { lat: 37.6026, lng: 126.9290, zoom: 6 }, // 은평구
  '11410': { lat: 37.5791, lng: 126.9368, zoom: 6 }, // 서대문구
  '11440': { lat: 37.5662, lng: 126.9014, zoom: 6 }, // 마포구
  '11470': { lat: 37.5268, lng: 126.8551, zoom: 6 }, // 양천구
  '11500': { lat: 37.5509, lng: 126.8496, zoom: 6 }, // 강서구
  '11530': { lat: 37.4956, lng: 126.8874, zoom: 6 }, // 구로구
  '11545': { lat: 37.4561, lng: 126.8954, zoom: 6 }, // 금천구
  '11560': { lat: 37.5263, lng: 126.8961, zoom: 6 }, // 영등포구
  '11590': { lat: 37.5124, lng: 126.9394, zoom: 6 }, // 동작구
  '11620': { lat: 37.4784, lng: 126.9516, zoom: 6 }, // 관악구
  '11650': { lat: 37.4833, lng: 127.0324, zoom: 6 }, // 서초구
  '11680': { lat: 37.5172, lng: 127.0473, zoom: 6 }, // 강남구
  '11710': { lat: 37.5145, lng: 127.1059, zoom: 6 }, // 송파구
  '11740': { lat: 37.5309, lng: 127.1238, zoom: 6 }, // 강동구
};

function formatPrice(rawStr) {
  const num = parseInt(String(rawStr).replace(/,/g, '')) || 0;
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const man = num % 10000;
    return man > 0 ? `${eok}억 ${Number(man).toLocaleString()}만` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
}

// 평형 그룹 분류 (RealTradeTab과 동일 기준)
function getSizeGroup(area) {
  const a = parseFloat(area) || 0;
  if (a < 60)  return '20평형';
  if (a < 95)  return '30평형';
  if (a < 130) return '40평형';
  return '50평+';
}

const MAP_HEIGHT = 460;

export default function TradeMapView({ groups, tradeTypeFilter, subTab, coordsMap, guCode, onSelectComplex, sizeFilter }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const overlaysRef     = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [selected, setSelected] = useState(null);

  // 중심 좌표 결정
  const centerInfo = guCode && GU_CENTERS[guCode]
    ? GU_CENTERS[guCode]
    : subTab === 'apt'
    ? { lat: 37.5605, lng: 126.8305, zoom: 5 }   // 마곡동 중심
    : { lat: 37.5509, lng: 126.8496, zoom: 6 };  // 강서구 기본

  const isJeonse = tradeTypeFilter === '전세';

  // ── Kakao Maps SDK 로드 ──────────────────────────────
  useEffect(() => {
    if (window.kakao?.maps) { setMapReady(true); return; }
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    script.onload = () => { window.kakao.maps.load(() => setMapReady(true)); };
    script.onerror = () => console.error('Kakao Maps SDK 로드 실패');
    document.head.appendChild(script);
  }, []);

  // ── 지도 초기화 ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) return;
    const kakao = window.kakao;
    const map = new kakao.maps.Map(mapContainerRef.current, {
      center: new kakao.maps.LatLng(centerInfo.lat, centerInfo.lng),
      level: centerInfo.zoom,
    });
    mapRef.current = map;
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
  }, [mapReady]);

  // ── 구 변경 시 중심 이동 ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.setCenter(new window.kakao.maps.LatLng(centerInfo.lat, centerInfo.lng));
    mapRef.current.setLevel(centerInfo.zoom);
    setSelected(null);
  }, [guCode, subTab]);

  // ── 오버레이 렌더링 ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const kakao = window.kakao;
    const map   = mapRef.current;

    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    let noCoords = 0;

    groups.forEach(g => {
      const coord = coordsMap?.[g.name];
      if (!coord) { noCoords++; return; }

      // 평형 필터 적용
      const trades = (sizeFilter && sizeFilter !== '전체')
        ? g.trades.filter(t => getSizeGroup(t.area) === sizeFilter)
        : g.trades;
      if (!trades.length) return;

      const latest   = trades[0];
      if (!latest) return;

      const price    = parseInt(latest.price) || 0;
      const maxPrice = Math.max(...trades.map(t => parseInt(t.price) || 0));
      const pct      = maxPrice > 0 ? Math.round((price / maxPrice) * 100) : 100;

      let bg, border;
      if (isJeonse) {
        bg = '#2176ae'; border = '#1559a0';
      } else {
        bg     = pct >= 100 ? '#D94545' : pct >= 95 ? '#e05c5c' : pct >= 80 ? '#d4860a' : '#888';
        border = pct >= 100 ? '#b02020' : pct >= 95 ? '#c03030' : pct >= 80 ? '#a06008' : '#666';
      }

      const shortName = g.name.length > 8 ? g.name.slice(0, 8) + '…' : g.name;

      // ── DOM 엘리먼트로 직접 생성 → 클릭 이벤트 즉시 바인딩 (querySelector + setTimeout 방식은 불안정) ──
      const wrap = document.createElement('div');
      wrap.style.cssText = [
        `background:${bg}`, `border:2px solid ${border}`, 'border-radius:10px',
        'padding:5px 8px', 'cursor:pointer', 'white-space:nowrap',
        'box-shadow:0 2px 8px rgba(0,0,0,0.25)', 'font-family:-apple-system,sans-serif',
        'user-select:none', 'position:relative', '-webkit-tap-highlight-color:transparent',
      ].join(';');

      const priceEl = document.createElement('div');
      priceEl.style.cssText = 'color:#fff;font-size:10px;font-weight:700;line-height:1.3;pointer-events:none;';
      priceEl.textContent = formatPrice(latest.price);
      wrap.appendChild(priceEl);

      if (!isJeonse) {
        const pctEl = document.createElement('div');
        pctEl.style.cssText = 'color:#ffeb9e;font-size:8px;pointer-events:none;';
        pctEl.textContent = pct >= 100 ? '🔥신고가' : `${pct}%`;
        wrap.appendChild(pctEl);
      }

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'color:rgba(255,255,255,0.85);font-size:8px;margin-top:1px;pointer-events:none;';
      nameEl.textContent = shortName;
      wrap.appendChild(nameEl);

      const arrow = document.createElement('div');
      arrow.style.cssText = [
        'width:0', 'height:0',
        'border-left:5px solid transparent', 'border-right:5px solid transparent',
        `border-top:6px solid ${border}`,
        'position:absolute', 'bottom:-8px', 'left:50%', 'transform:translateX(-50%)',
        'pointer-events:none',
      ].join(';');
      wrap.appendChild(arrow);

      // 클릭 이벤트 직접 바인딩
      const complexName = g.name;
      wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(complexName);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(coord.lat, coord.lng),
        content: wrap,
        yAnchor: 1.3,
        zIndex: 10,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    if (noCoords > 0) console.log(`[지도] 좌표 없는 단지: ${noCoords}개`);
  }, [mapReady, groups, coordsMap, isJeonse, sizeFilter]);

  const selectedGroup  = selected ? groups.find(g => g.name === selected) : null;
  const selectedTrades = selectedGroup
    ? ((sizeFilter && sizeFilter !== '전체')
        ? selectedGroup.trades.filter(t => getSizeGroup(t.area) === sizeFilter)
        : selectedGroup.trades)
    : [];

  // 최고가 대비 %
  const latestPrice = selectedTrades[0] ? parseInt(selectedTrades[0].price) || 0 : 0;
  const maxSelectedPrice = selectedTrades.length ? Math.max(...selectedTrades.map(t => parseInt(t.price) || 0)) : 0;
  const selectedPct = maxSelectedPrice > 0 ? Math.round((latestPrice / maxSelectedPrice) * 100) : 100;

  if (!KAKAO_JS_KEY) {
    return (
      <div style={{ padding:32, textAlign:'center', color:'var(--gray)', fontSize:13 }}>
        VITE_KAKAO_JS_KEY가 설정되지 않았습니다
      </div>
    );
  }

  return (
    <div>
      {/* ── 지도 + 오버레이 컨테이너 ── */}
      <div style={{ position:'relative', height:MAP_HEIGHT, borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>

        {/* 지도 */}
        <div ref={mapContainerRef} style={{ width:'100%', height:'100%' }} />

        {/* 로딩 */}
        {!mapReady && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(248,246,241,0.9)', fontSize:13, color:'var(--gray)' }}>
            지도 로딩 중...
          </div>
        )}

        {/* 백드롭 */}
        {selected && (
          <div
            onClick={() => setSelected(null)}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.18)', zIndex:49 }}
          />
        )}

        {/* ── 바텀시트 ── */}
        {selectedGroup && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, zIndex:50,
            background:'#fff',
            borderRadius:'18px 18px 0 0',
            boxShadow:'0 -6px 32px rgba(0,0,0,0.22)',
            maxHeight:'62%',
            overflowY:'auto',
            WebkitOverflowScrolling:'touch',
          }}>
            {/* 드래그 핸들 */}
            <div style={{ padding:'10px 0 0', textAlign:'center' }}>
              <div style={{ display:'inline-block', width:36, height:4, background:'#ddd', borderRadius:2 }} />
            </div>

            <div style={{ padding:'10px 16px 24px' }}>
              {/* 단지명 + 닫기 */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0, paddingRight:8 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--navy)', lineHeight:1.3 }}>
                    {selectedGroup.name}
                  </div>
                  {sizeFilter && sizeFilter !== '전체' && (
                    <div style={{ fontSize:10, color:'var(--gold)', fontWeight:700, marginTop:2 }}>
                      {sizeFilter} 필터 · {selectedTrades.length}건
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:'50%',
                    width:28, height:28, fontSize:14, cursor:'pointer', color:'#555',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  ✕
                </button>
              </div>

              {/* 최근 거래 강조 */}
              {selectedTrades[0] && (
                <div style={{
                  background:'rgba(11,40,73,0.05)', borderRadius:12, padding:'10px 14px', marginBottom:12,
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <div>
                    <div style={{ fontSize:22, fontWeight:800, color: isJeonse ? '#2176ae' : 'var(--navy)', lineHeight:1.2 }}>
                      {formatPrice(selectedTrades[0].price)}
                    </div>
                    <div style={{ fontSize:10, color:'var(--gray)', marginTop:3 }}>
                      {selectedTrades[0].year}.{String(selectedTrades[0].month).padStart(2,'0')}.{String(selectedTrades[0].day).padStart(2,'0')}
                      &nbsp;·&nbsp;{selectedTrades[0].area}㎡&nbsp;·&nbsp;{selectedTrades[0].floor}층
                    </div>
                  </div>
                  {!isJeonse && (
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      {selectedPct >= 100
                        ? <div style={{ fontSize:12, fontWeight:700, color:'#D94545' }}>🔥 신고가</div>
                        : <div style={{ fontSize:12, fontWeight:700, color: selectedPct >= 95 ? '#e05c5c' : selectedPct >= 80 ? '#d4860a' : '#888' }}>
                            최고가의 {selectedPct}%
                          </div>
                      }
                      <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>최근 {selectedTrades.length}건</div>
                    </div>
                  )}
                </div>
              )}

              {/* 거래 목록 */}
              <div style={{ display:'flex', flexDirection:'column' }}>
                {selectedTrades.slice(0, 8).map((t, i) => (
                  <div key={i} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    fontSize:12, padding:'7px 0',
                    borderBottom: i < Math.min(selectedTrades.length, 8) - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ color:'var(--text-2)', minWidth:80 }}>{t.area}㎡ · {t.floor}층</span>
                    <span style={{ color:'var(--gray)', fontSize:11 }}>
                      {t.year}.{String(t.month).padStart(2,'0')}.{String(t.day).padStart(2,'0')}
                    </span>
                    <span style={{ fontWeight:700, color: isJeonse ? '#2176ae' : 'var(--navy)', minWidth:70, textAlign:'right' }}>
                      {formatPrice(t.price)}
                    </span>
                  </div>
                ))}
              </div>
              {selectedTrades.length > 8 && (
                <div style={{ fontSize:10, color:'var(--gray)', textAlign:'center', padding:'6px 0' }}>
                  외 {selectedTrades.length - 8}건
                </div>
              )}

              {/* 목록 이동 버튼 (보조 액션) */}
              {onSelectComplex && (
                <button
                  onClick={() => { onSelectComplex(selectedGroup.name); setSelected(null); }}
                  style={{
                    marginTop:14, width:'100%', fontSize:13, padding:'11px',
                    borderRadius:12, border:'1.5px solid var(--navy)',
                    background:'var(--navy)', color:'#fff',
                    cursor:'pointer', fontWeight:700, letterSpacing:'0.01em',
                  }}>
                  📋 목록에서 전체 보기
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 범례 ── */}
      <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
        {isJeonse ? (
          <span style={{ fontSize:10, color:'#2176ae', fontWeight:700 }}>● 전세 보증금</span>
        ) : (
          <>
            <span style={{ fontSize:10, color:'#D94545', fontWeight:700 }}>● 신고가</span>
            <span style={{ fontSize:10, color:'#e05c5c' }}>● 95%+</span>
            <span style={{ fontSize:10, color:'#d4860a' }}>● 80~95%</span>
            <span style={{ fontSize:10, color:'#888' }}>● ~80%</span>
            <span style={{ fontSize:10, color:'var(--gray)', marginLeft:4 }}>(최고가 대비)</span>
          </>
        )}
        <span style={{ fontSize:10, color:'var(--gray)', marginLeft:'auto' }}>
          {groups.filter(g => {
            if (!coordsMap?.[g.name]) return false;
            if (sizeFilter && sizeFilter !== '전체') return g.trades.some(t => getSizeGroup(t.area) === sizeFilter);
            return true;
          }).length}/{groups.length}개 단지
          {sizeFilter && sizeFilter !== '전체' && <span style={{ color:'var(--gold)', fontWeight:700 }}> · {sizeFilter}</span>}
        </span>
      </div>
    </div>
  );
}
