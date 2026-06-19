import { useState, useEffect, useRef } from 'react';
import { DEFAULT_PLACES } from '../../data/ellavineData';

/* ── 학교 데이터 ── */
const SCHOOL_DATA = {
  elem: [
    { name:'서울송정초등학교', dist:'729m', walk:'도보 11분', note:'혁신학교', type:'공립',
      addr:'서울 강서구 공항대로41길 48', perClass:'약 25명', classes:'18학급', extra:'방화뉴타운 내 신설. 시설 우수.' },
    { name:'방화초등학교',     dist:'1.1km', walk:'도보 16분', note:'', type:'공립',
      addr:'서울 강서구 방화1로 25', perClass:'약 22명', classes:'15학급', extra:'방화동 전통 공립 초등학교.' },
    { name:'공항초등학교',     dist:'1.3km', walk:'도보 19분', note:'', type:'공립',
      addr:'서울 강서구 하늘길 98', perClass:'약 24명', classes:'16학급', extra:'인근 주거지 배정 초등학교.' },
  ],
  mid: [
    { name:'공항중학교',      dist:'229m',  walk:'도보 3분',  note:'최근접', type:'공립',
      addr:'서울 강서구 하늘길 76', perClass:'약 26명', classes:'18학급', extra:'단지에서 가장 가까운 중학교. 강서구 주요 배정 학교.' },
    { name:'마곡중학교',      dist:'611m',  walk:'도보 9분',  note:'2025년 개교', type:'공립',
      addr:'서울 강서구 마곡동', perClass:'약 28명', classes:'12학급', extra:'마곡지구 신설. 새 건물·시설.' },
    { name:'마곡하늬중학교',  dist:'897m',  walk:'도보 13분', note:'2026년 개교', type:'공립',
      addr:'서울 강서구 마곡동', perClass:'미정', classes:'미정', extra:'2026년 개교 예정 신설 학교.' },
    { name:'등명중학교',      dist:'1.2km', walk:'도보 18분', note:'', type:'공립',
      addr:'서울 강서구 방화대로44길 15', perClass:'약 25명', classes:'15학급', extra:'강서구 서부 배정 중학교.' },
    { name:'경서중학교',      dist:'1.4km', walk:'도보 20분', note:'', type:'공립',
      addr:'서울 강서구 경서동 40', perClass:'약 26명', classes:'14학급', extra:'강서구 서부 공립 중학교.' },
  ],
  high: [
    { name:'공항고등학교',     dist:'655m',  walk:'도보 10분', type:'공립', pct:'23.4명/학급', classes:'21학급',
      addr:'서울 강서구 하늘길 78', extra:'강서양천학교군 내 거리순 가장 가까운 고교.' },
    { name:'강서고등학교',     dist:'1.1km', walk:'도보 16분', type:'공립', pct:'24.1명/학급', classes:'22학급',
      addr:'서울 강서구 강서로18길 78', extra:'마곡·방화동 주요 고교.' },
    { name:'마곡고등학교',     dist:'1.4km', walk:'도보 20분', type:'공립', pct:'26.2명/학급', classes:'18학급',
      addr:'서울 강서구 마곡동', extra:'마곡지구 신설 고교. 2020년 개교.' },
    { name:'수명고등학교',     dist:'1.9km', walk:'차량 5분',  type:'공립', pct:'23.5명/학급', classes:'19학급',
      addr:'서울 강서구 수명로 55', extra:'학급 규모 작고 안정적 학교 분위기.' },
    { name:'명덕여자고등학교', dist:'2.1km', walk:'차량 5분',  type:'사립', pct:'27.2명/학급', classes:'24학급',
      addr:'서울 강서구 화곡동', extra:'강서구 대표 여고. 꾸준한 진학 실적.' },
    { name:'명덕고등학교',     dist:'2.1km', walk:'차량 5분',  type:'사립', pct:'26.0명/학급', classes:'22학급',
      addr:'서울 강서구 화곡동', extra:'명덕재단 운영 남고. 진학 실적 양호.' },
    { name:'덕원여자고등학교', dist:'2.2km', walk:'차량 6분',  type:'사립', pct:'23.7명/학급', classes:'20학급',
      addr:'서울 강서구 방화동', extra:'방화동 인근 여고.' },
    { name:'화곡고등학교',     dist:'2.4km', walk:'차량 7분',  type:'사립', pct:'24.9명/학급', classes:'21학급',
      addr:'서울 강서구 화곡동', extra:'사립 고교. 비교적 안정적 학업 환경.' },
  ],
};

/* ── 지하철 (첫차/막차/배차간격 포함) ── */
const SUBWAY = [
  {
    line:'9', name:'신방화역', dist:'315m', walk:'도보 5분', color:'#BDB70F',
    express: false,
    dir1:'개화 방향', dir2:'중앙보훈병원 방향',
    first1:'05:28', last1:'23:55',
    first2:'05:32', last2:'00:05',
    headway:'출퇴근 4~5분 / 평시 8~12분',
    note:'완행 정차역 — 여의도 20분, 강남(봉은사) 30분',
  },
  {
    line:'9', name:'공항시장역', dist:'459m', walk:'도보 7분', color:'#BDB70F',
    express: false,
    dir1:'개화 방향', dir2:'중앙보훈병원 방향',
    first1:'05:30', last1:'23:57',
    first2:'05:34', last2:'00:07',
    headway:'출퇴근 4~5분 / 평시 8~12분',
    note:'완행 전용 정차역. 급행 이용 시 신방화역 이동 권장',
  },
  {
    line:'5', name:'송정역', dist:'505m', walk:'도보 8분', color:'#996CAC',
    express: false,
    dir1:'방화 방향', dir2:'하남검단산 방향',
    first1:'05:27', last1:'00:13',
    first2:'05:30', last2:'00:05',
    headway:'출퇴근 6~7분 / 평시 10~12분',
    note:'방화 종점에서 1정거장. 여의도 20분, 광화문 35분',
  },
  {
    line:'5', name:'마곡역', dist:'967m', walk:'도보 15분', color:'#996CAC',
    express: false,
    dir1:'방화 방향', dir2:'하남검단산 방향',
    first1:'05:29', last1:'00:15',
    first2:'05:32', last2:'00:07',
    headway:'출퇴근 6~7분 / 평시 10~12분',
    note:'마곡지구 중심역. 마곡나루역(9호선/공항철도) 도보 연결',
  },
];

/* ── 버스 정류장 (단지 도보권 3곳) ── */
const BUS_STOPS_NEAR = [
  { code:'16704', name:'신방화역7번출구',     dist:'단지 바로 앞', note:'9호선 신방화역 7번 출구 앞',
    naverUrl:'https://map.naver.com/p/bus/bus-station/%EC%8B%A0%EB%B0%A9%ED%99%94%EC%97%AD%207%EB%B2%88%EC%B6%9C%EA%B5%AC/bus-station/85497' },
  { code:'16706', name:'신방화역6번출구',     dist:'도보 2분',    note:'반대편 방향 승차 시',
    naverUrl:'https://map.naver.com/p/bus/bus-station/%EC%8B%A0%EB%B0%A9%ED%99%94%EC%97%AD%207%EB%B2%88%EC%B6%9C%EA%B5%AC/bus-station/86176' },
  { code:'16307', name:'공항중학교,신성교회', dist:'도보 3분',    note:'방화대로 방면',
    naverUrl:'https://map.naver.com/p/bus/bus-station/%EC%8B%A0%EB%B0%A9%ED%99%94%EC%97%AD%207%EB%B2%88%EC%B6%9C%EA%B5%AC/bus-station/100706' },
];

const BUS = [
  { type:'마을', no:'07',   color:'#4CAF50', desc:'방화동 내부 순환. 홈플러스 강서 경유' },
  { type:'간선', no:'651',  color:'#4A9EE0', desc:'강서구 ↔ 강남 연결. 빠른 간선' },
  { type:'간선', no:'652',  color:'#4A9EE0', desc:'강서 ↔ 마포·종로 연결' },
  { type:'광역', no:'8601', color:'#E0A44A', desc:'강서 ↔ 강남·양재 광역급행' },
  { type:'간선', no:'604',  color:'#4A9EE0', desc:'강서 ↔ 영등포·노량진' },
  { type:'간선', no:'6631', color:'#4A9EE0', desc:'방화동 ↔ 마곡지구 연결' },
  { type:'지선', no:'5714', color:'#A06ECC', desc:'강서 ↔ 여의도 지선' },
];

const CAT_LABELS = { all:'전체', restaurant:'맛집', cafe:'카페', mart:'편의', leisure:'여가' };
const CAT_SEARCH = { all:'음식점', restaurant:'맛집', cafe:'카페', mart:'마트 편의점', leisure:'문화시설 여가' };

/* ── 병원 데이터 ── */
const HOSP_SPECS = [
  { key:'내과',       icon:'🫁' },
  { key:'소아과',     icon:'👶' },
  { key:'이비인후과', icon:'👂' },
  { key:'정형외과',   icon:'🦴' },
  { key:'치과',       icon:'🦷' },
  { key:'피부과',     icon:'💊' },
];

const HOSPITAL_LIST = [
  {
    name:'이대서울병원',
    type:'종합병원',
    area:'마곡나루역',
    dist:'차량 7분',
    badge:'서울 서남권 거점 종합병원 · 2019년 개원',
    specs:{
      내과:      '내과 · 소화기내과 · 순환기내과 · 내분비내과',
      소아과:    '소아청소년과 · 야간·주말 진료 가능',
      이비인후과:'이비인후과 · 두경부외과',
      정형외과:  '정형외과 · 척추센터 · 관절센터',
      치과:      '치과 전과목',
      피부과:    '피부과 · 피부미용',
    },
    naver:'이대서울병원',
  },
];

const PLACES_CACHE_KEY = 'ellavine_places_v1';
const PLACES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

function getCachedPlaces() {
  try {
    const raw = localStorage.getItem(PLACES_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > PLACES_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCachedPlaces(data) {
  try { localStorage.setItem(PLACES_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

/* ── 단지 위치 칩 데이터 ── */
const LOC_CHIPS = [
  { icon:'🚇', label:'신방화역 (9호선)', value:'7번출구 321m', color:'var(--gold)',  query:'신방화역 서울 강서구' },
  { icon:'🚇', label:'5호선 송정역',     value:'도보 8분',     color:'#996CAC',       query:'송정역 5호선 서울 강서구' },
  { icon:'🚌', label:'신방화역7번출구',  value:'단지 바로 앞', color:'var(--cyan)',   query:'신방화역7번출구 버스정류장' },
  { icon:'🏫', label:'공항중학교',       value:'도보 3분',     color:'var(--green)',  query:'공항중학교 서울 강서구' },
  { icon:'✈️', label:'김포공항',         value:'차량 5분',     color:'var(--gray)',   query:'김포국제공항' },
  { icon:'🏥', label:'이대서울병원',     value:'차량 7분',     color:'var(--red)',    query:'이대서울병원' },
  { icon:'🏫', label:'서울송정초등학교', value:'도보 11분',    color:'var(--green)',  query:'서울송정초등학교' },
  { icon:'🌳', label:'방화근린공원',     value:'도보 5분',     color:'var(--green)',  query:'방화근린공원 서울' },
];

/* ── Gemini 장소 검색 (서버 프록시 사용) ── */
async function fetchPlaces() {
  const res = await fetch('/api/places');
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && data.length >= 3) return data;
  throw new Error('empty');
}

export default function MapTab() {
  const [schoolTab, setSchoolTab] = useState('elem');
  const [expandedSchool, setExpandedSchool] = useState(null);
  const [expandedBus, setExpandedBus] = useState(null);
  const [expandedSubway, setExpandedSubway] = useState(null);
  const [hospSpec, setHospSpec] = useState('내과');
  const [placeCat, setPlaceCat] = useState('all');
  const [places, setPlaces] = useState(DEFAULT_PLACES);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const [mapPlace, setMapPlace] = useState(null);
  const mapRef = useRef(null);

  async function loadPlaces(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCachedPlaces();
      if (cached?.length >= 3) {
        setPlaces(cached);
        setPlacesLoaded(true);
        return;
      }
    }
    setPlacesLoading(true);
    try {
      const data = await fetchPlaces();
      setPlaces(data);
      setCachedPlaces(data);
    } catch {
      /* keep DEFAULT_PLACES */
    }
    setPlacesLoading(false);
    setPlacesLoaded(true);
  }

  useEffect(() => {
    const cached = getCachedPlaces();
    if (cached?.length >= 3) {
      setPlaces(cached);
      setPlacesLoaded(true);
    }
  }, []);

  function showOnMap(place) {
    setMapPlace(place);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showChipOnMap(chip) {
    if (!chip.query) return;
    setMapPlace({ name: chip.query });
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleSchool(name) {
    setExpandedSchool(prev => prev === name ? null : name);
  }
  function toggleBus(no) {
    setExpandedBus(prev => prev === no ? null : no);
    setExpandedSubway(null);
  }
  function toggleSubway(name) {
    setExpandedSubway(prev => prev === name ? null : name);
    setExpandedBus(null);
  }

  const filtered = placeCat === 'all' ? places : places.filter(p => p.cat === placeCat);

  return (
    <div style={wrap}>
      <div style={sectionTitle}>생활 인프라</div>
      <div style={sectionSub}>학군 · 교통 · 병원 · 맛집 & 편의시설</div>
      <div style={goldLine} />

      {/* ── 학군 ── */}
      <section style={section}>
        <div style={secLabel}>🏫 학군 정보</div>
        <div style={schoolTabs}>
          {[['elem','초등'], ['mid','중학교'], ['high','고등학교']].map(([k, l]) => (
            <button key={k} style={{ ...sTab, ...(schoolTab === k ? sTabActive : {}) }} onClick={() => { setSchoolTab(k); setExpandedSchool(null); }}>
              {l}
            </button>
          ))}
        </div>
        <div style={card}>
          {SCHOOL_DATA[schoolTab].map((s, i) => (
            <div key={i}>
              <div style={{ ...schoolRow, cursor:'pointer' }} onClick={() => toggleSchool(s.name)}>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{s.name}</span>
                  {s.note && <span style={{ fontSize:10, color:'var(--cyan)', marginLeft:6, fontWeight:600 }}>{s.note}</span>}
                  <span style={{ fontSize:10, color:'var(--gray)', marginLeft:6 }}>({s.type})</span>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginRight:8 }}>
                  <div style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>{s.dist}</div>
                  <div style={{ fontSize:10, color:'var(--gray)' }}>{s.walk}</div>
                  {s.pct && <div style={{ fontSize:10, color:'var(--gold)' }}>{s.pct}</div>}
                </div>
                <div style={{ fontSize:12, color:'var(--gray)', transition:'transform 0.2s', transform: expandedSchool === s.name ? 'rotate(90deg)' : 'none' }}>›</div>
              </div>
              {expandedSchool === s.name && (
                <div style={schoolDetail}>
                  <div style={{ fontSize:11, color:'var(--gray)', marginBottom:8 }}>📍 {s.addr}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
                    <div style={detailChip}><div style={detailChipLabel}>학급 수</div><div style={detailChipValue}>{s.classes}</div></div>
                    <div style={detailChip}><div style={detailChipLabel}>학급당 학생</div><div style={detailChipValue}>{s.pct || s.perClass}</div></div>
                  </div>
                  {s.extra && <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.7, marginBottom:10 }}>{s.extra}</div>}
                  <button style={naverBtn} onClick={() => window.open(`https://search.naver.com/search.naver?query=${encodeURIComponent(s.name)}`, '_blank')}>
                    네이버에서 학교 정보 보기 →
                  </button>
                </div>
              )}
            </div>
          ))}
          {schoolTab === 'high' && (
            <div style={{ fontSize:10, color:'var(--text-2)', lineHeight:1.7, marginTop:8, padding:'8px 10px', background:'rgba(0,143,175,0.05)', borderRadius:8, border:'1px solid rgba(0,143,175,0.15)' }}>
              ※ 강서양천학교군 배정. 공항고(655m) 최근접. 학급당 23~27명 수준.
            </div>
          )}
        </div>
      </section>

      {/* ── 지하철 ── */}
      <section style={section}>
        <div style={secLabel}>🚇 지하철 (1km 이내 4개역) <span style={{ fontSize:9, color:'var(--gray)', fontWeight:400 }}>(탭하면 시간표)</span></div>
        <div style={card}>
          {SUBWAY.map((s, i) => (
            <div key={i}>
              <div style={{ ...subwayRow, cursor:'pointer' }} onClick={() => toggleSubway(s.name)}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:s.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'white', flexShrink:0 }}>{s.line}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{s.name}</span>
                    {s.express && <span style={{ fontSize:9, padding:'1px 6px', background:'rgba(189,183,15,0.15)', color:'#9A8A00', borderRadius:4, fontWeight:700 }}>급행</span>}
                  </div>
                  <div style={{ fontSize:10, color:'var(--gray)' }}>{s.line}호선</div>
                </div>
                <div style={{ textAlign:'right', marginRight:6 }}>
                  <div style={{ fontSize:12, fontWeight:600, color: i < 2 ? 'var(--green)' : i === 2 ? 'var(--gold)' : 'var(--gray)' }}>{s.dist}</div>
                  <div style={{ fontSize:10, color:'var(--gray)' }}>{s.walk}</div>
                </div>
                <div style={{ fontSize:12, color:'var(--gray)', transition:'transform 0.2s', transform: expandedSubway === s.name ? 'rotate(90deg)' : 'none' }}>›</div>
              </div>

              {expandedSubway === s.name && (
                <div style={subwayDetail}>
                  {/* 첫차/막차 그리드 */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
                    <div style={detailChip}>
                      <div style={detailChipLabel}>🌅 첫차 ({s.dir1})</div>
                      <div style={{ ...detailChipValue, color:'var(--navy)' }}>{s.first1}</div>
                    </div>
                    <div style={detailChip}>
                      <div style={detailChipLabel}>🌅 첫차 ({s.dir2})</div>
                      <div style={{ ...detailChipValue, color:'var(--navy)' }}>{s.first2}</div>
                    </div>
                    <div style={detailChip}>
                      <div style={detailChipLabel}>🌙 막차 ({s.dir1})</div>
                      <div style={{ ...detailChipValue, color:'var(--red)' }}>{s.last1}</div>
                    </div>
                    <div style={detailChip}>
                      <div style={detailChipLabel}>🌙 막차 ({s.dir2})</div>
                      <div style={{ ...detailChipValue, color:'var(--red)' }}>{s.last2}</div>
                    </div>
                  </div>
                  <div style={{ ...detailChip, marginBottom:8 }}>
                    <div style={detailChipLabel}>⏱ 배차간격</div>
                    <div style={detailChipValue}>{s.headway}</div>
                  </div>
                  {s.note && (
                    <div style={{ fontSize:11, color: s.express ? '#7A6A00' : 'var(--text-2)', lineHeight:1.6, padding:'6px 10px', background: s.express ? 'rgba(189,183,15,0.07)' : 'var(--bg)', borderRadius:8, border:`1px solid ${s.express ? 'rgba(189,183,15,0.2)' : 'var(--border)'}`, marginBottom:10 }}>
                      {s.note}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8 }}>
                    <button style={{ ...naverBtn, flex:1 }}
                      onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent(s.name + ' 지하철역')}`, '_blank')}>
                      🗺️ 네이버 실시간 도착
                    </button>
                    <button style={{ ...kakaoBtn, flex:1 }}
                      onClick={() => window.open(`https://map.kakao.com/link/search/${encodeURIComponent(s.name)}`, '_blank')}>
                      🚇 카카오지하철
                    </button>
                  </div>
                  <div style={{ fontSize:9, color:'var(--gray)', marginTop:6, textAlign:'center' }}>※ 첫·막차 시간은 평일 기준 (주말 상이). 실시간은 앱에서 확인</div>
                </div>
              )}
            </div>
          ))}
          <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(0,143,175,0.05)', border:'1px solid rgba(0,143,175,0.15)', borderRadius:8, fontSize:10, color:'var(--cyan)', lineHeight:1.7 }}>
            💡 9호선 신방화역 도보 5분 — 여의도 20분, 강남(봉은사) 30분.
          </div>
        </div>
      </section>

      {/* ── 버스 ── */}
      <section style={section}>
        <div style={secLabel}>🚌 버스 27개 노선</div>
        <div style={card}>

          {/* 정류장 실시간 도착 카드 3개 */}
          <div style={{ fontSize:10, color:'var(--gold)', fontWeight:700, marginBottom:8 }}>📍 도보권 정류장 실시간 도착</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
            {BUS_STOPS_NEAR.map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg)', borderRadius:10, padding:'10px 12px', border:'1px solid var(--border)' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{s.name}</div>
                  <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>{s.note}</div>
                </div>
                <div style={{ fontSize:11, color:'var(--green)', fontWeight:600, flexShrink:0, marginRight:8 }}>{s.dist}</div>
                <button style={{ ...naverBtn, fontSize:10, padding:'6px 10px', flexShrink:0 }}
                  onClick={() => window.open(s.naverUrl, '_blank')}>
                  실시간 →
                </button>
              </div>
            ))}
          </div>

          {/* 버스 번호 칩 */}
          <div style={{ fontSize:10, color:'var(--gold)', fontWeight:700, marginBottom:8 }}>🚌 운행 노선 (탭하면 노선 정보)</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
            {BUS.map((b, i) => (
              <div key={i} onClick={() => toggleBus(b.no)}
                style={{ background: expandedBus === b.no ? b.color : '#FFFFFF', border:`1.5px solid ${b.color}55`, borderRadius:8, padding:'5px 12px', cursor:'pointer', boxShadow:'var(--shadow-sm)', transition:'all 0.2s' }}>
                <div style={{ fontSize:9, color: expandedBus === b.no ? 'rgba(255,255,255,0.85)' : b.color, marginBottom:2, fontWeight:600 }}>{b.type}</div>
                <div style={{ fontSize:13, fontWeight:700, color: expandedBus === b.no ? '#FFFFFF' : 'var(--text)' }}>{b.no}</div>
              </div>
            ))}
          </div>

          {expandedBus && (() => {
            const b = BUS.find(x => x.no === expandedBus);
            return b ? (
              <div style={busDetail}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:4 }}>
                  <span style={{ color:b.color }}>■</span> {b.no}번 {b.type}버스
                </div>
                <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.6 }}>{b.desc}</div>
              </div>
            ) : null;
          })()}

          <div style={{ fontSize:10, color:'var(--gray)', lineHeight:1.7, marginTop:4 }}>
            총 27개 노선 운행 · 광역버스 500m 이내
          </div>
        </div>
      </section>

      {/* ── 단지 위치 ── */}
      <section ref={mapRef} style={section}>
        <div style={secLabel}>🗺️ 단지 위치</div>
        <div style={locationCard}>
          {/* Google Maps iframe */}
          <div style={{ position:'relative' }}>
            <iframe
              key={mapPlace?.name || 'home'}
              src={mapPlace
                ? `https://maps.google.com/maps?q=${encodeURIComponent(mapPlace.name)}&z=17&output=embed&hl=ko`
                : `https://maps.google.com/maps?q=서울+강서구+방화대로25길+11-11&z=17&output=embed&hl=ko`}
              width="100%" height="220" style={{ border:0, display:'block' }}
              allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            />
            <div style={{ position:'absolute', top:8, left:8, background:'rgba(255,255,255,0.95)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 10px', fontSize:10, color:'var(--navy)', fontWeight:700, boxShadow:'var(--shadow-sm)' }}>
              📍 {mapPlace ? mapPlace.name : '래미안 엘라비네'}
            </div>
            {mapPlace && (
              <button
                style={{ position:'absolute', top:8, right:8, background:'var(--navy)', border:'none', borderRadius:8, padding:'5px 10px', fontSize:10, color:'#FFFFFF', cursor:'pointer', boxShadow:'var(--shadow-sm)' }}
                onClick={() => setMapPlace(null)}>
                ← 단지로
              </button>
            )}
          </div>

          {/* 거리 정보 그리드 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'14px 14px 0' }}>
            {LOC_CHIPS.map((item, i) => (
              <div key={i}
                style={{ ...locChip, ...(item.query ? { cursor:'pointer', transition:'background 0.15s' } : {}) }}
                onClick={() => showChipOnMap(item)}>
                <span style={{ fontSize:16 }}>{item.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:9, color:'var(--gray)', marginBottom:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.label}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:item.color }}>{item.value}</div>
                </div>
                {item.query && <span style={{ fontSize:9, color:'var(--gray)' }}>›</span>}
              </div>
            ))}
          </div>
          <div style={{ padding:'8px 14px 0', fontSize:9, color:'var(--gray)' }}>💡 항목을 탭하면 지도에서 위치 확인</div>

          {/* 버튼 */}
          <div style={{ display:'flex', gap:8, padding:'12px 14px 14px' }}>
            <button style={{ ...naverBtn, flex:1, fontSize:12 }}
              onClick={() => window.open('https://map.naver.com/v5/search/서울%20강서구%20방화대로25길%2011-11', '_blank')}>
              🗺️ 네이버지도에서 보기
            </button>
            <button style={{ ...kakaoBtn, flex:1, fontSize:12 }}
              onClick={() => window.open('https://map.kakao.com/?q=서울+강서구+방화대로25길+11-11', '_blank')}>
              🟡 카카오맵
            </button>
          </div>
        </div>
      </section>

      {/* ── 주변 병원 ── */}
      <section style={section}>
        <div style={secLabel}>🏥 주변 병원</div>

        {/* 진료과 탭 */}
        <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:2 }}>
          {HOSP_SPECS.map(s => (
            <button key={s.key}
              style={{ ...hospSpecBtn, ...(hospSpec === s.key ? hospSpecBtnActive : {}), flexShrink:0 }}
              onClick={() => setHospSpec(s.key)}>
              {s.icon} {s.key}
            </button>
          ))}
        </div>

        {/* 병원 카드 */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
          {HOSPITAL_LIST.filter(h => h.specs[hospSpec]).map((h, i) => (
            <div key={i} style={hospCard}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{h.name}</span>
                  <span style={{ fontSize:9, marginLeft:6, padding:'2px 6px', background:'rgba(11,40,73,0.08)', borderRadius:4, color:'var(--navy)', fontWeight:600 }}>{h.type}</span>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{h.dist}</div>
                  <div style={{ fontSize:9, color:'var(--gray)' }}>{h.area}</div>
                </div>
              </div>
              {h.badge && (
                <div style={{ fontSize:10, color:'var(--cyan)', marginBottom:8 }}>✦ {h.badge}</div>
              )}
              <div style={{ fontSize:11, color:'var(--text-2)', marginBottom:10, padding:'7px 10px', background:'rgba(200,168,64,0.05)', borderRadius:8, border:'1px solid var(--gold-dim)' }}>
                <span style={{ fontWeight:700, color:'var(--gold)' }}>{hospSpec}</span> — {h.specs[hospSpec]}
              </div>
              <button style={{ ...naverBtn, width:'100%', fontSize:11 }}
                onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent(h.name)}`, '_blank')}>
                🗺️ 네이버에서 위치·예약 확인
              </button>
            </div>
          ))}

          {HOSPITAL_LIST.filter(h => h.specs[hospSpec]).length === 0 && (
            <div style={{ ...hospCard, textAlign:'center', color:'var(--gray)', fontSize:12, padding:20 }}>
              확인된 대형 병원 정보가 없습니다.<br />아래 검색으로 근처 의원을 찾아보세요.
            </div>
          )}
        </div>

        {/* 동네 의원 검색 바로가기 */}
        <div style={{ background:'rgba(0,143,175,0.04)', border:'1px solid rgba(0,143,175,0.18)', borderRadius:12, padding:'12px 14px' }}>
          <div style={{ fontSize:10, color:'var(--cyan)', fontWeight:700, marginBottom:10 }}>
            🔍 근처 {hospSpec} 동네 의원 찾기
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <button style={{ ...naverBtn, fontSize:11, textAlign:'center' }}
              onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent('신방화역 ' + hospSpec)}`, '_blank')}>
              📍 신방화역 {hospSpec}
            </button>
            <button style={{ ...naverBtn, fontSize:11, textAlign:'center', background:'#7A5FAF' }}
              onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent('마곡역 ' + hospSpec)}`, '_blank')}>
              📍 마곡역 {hospSpec}
            </button>
          </div>
          <div style={{ fontSize:9, color:'var(--gray)', marginTop:8, textAlign:'center' }}>
            네이버 지도에서 실시간 운영 중인 의원을 확인하세요
          </div>
        </div>
      </section>

      {/* ── 마곡 핫플레이스 ── */}
      <section style={section}>
        <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, fontWeight:600, marginBottom:14 }}>
          🗺️ 마곡 핫플레이스
        </div>

        {/* 원그로브 */}
        <div style={hotCard}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#1a1a1a,#555,transparent)', borderRadius:'16px 16px 0 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌳</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', fontFamily:"'Noto Serif KR',serif" }}>One Grove</div>
                  <div style={{ fontSize:10, color:'var(--gray)' }}>원그로브</div>
                </div>
              </div>
              <div style={{ display:'inline-block', fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(26,26,26,0.07)', border:'1px solid rgba(26,26,26,0.15)', color:'#333', fontWeight:600 }}>
                📍 마곡역 1번 출구 · 도보 3분
              </div>
            </div>
          </div>
          <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.7, marginBottom:12 }}>
            마곡역 바로 앞 복합 라이프스타일 공간. 쇼핑·다이닝·문화·웰니스를 한 곳에서 누릴 수 있는 마곡 대표 핫플레이스.
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {[
              { emoji:'🛍️', label:'Shop',       color:'rgba(11,40,73,0.07)',  border:'rgba(11,40,73,0.2)',  text:'var(--navy)' },
              { emoji:'🍽️', label:'Eat & Drink', color:'rgba(200,168,64,0.1)', border:'rgba(200,168,64,0.3)', text:'#8a6f00' },
              { emoji:'🎨', label:'Culture',     color:'rgba(26,144,104,0.07)',border:'rgba(26,144,104,0.2)',text:'#1A9068' },
              { emoji:'💆', label:'Wellness',    color:'rgba(0,143,175,0.07)', border:'rgba(0,143,175,0.2)', text:'#008FAF' },
            ].map(c => (
              <span key={c.label} style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background:c.color, border:`1px solid ${c.border}`, color:c.text, fontWeight:600 }}>
                {c.emoji} {c.label}
              </span>
            ))}
          </div>
          <a href="https://onegrove.kr/ko/lifestyle" target="_blank" rel="noopener noreferrer" style={hotLinkBtn}>
            매장 전체 보기 →
          </a>
        </div>

        {/* 코엑스 마곡 */}
        <div style={hotCard}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#003087,#0057b8,transparent)', borderRadius:'16px 16px 0 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'#003087', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🏛️</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', fontFamily:"'Noto Serif KR',serif" }}>COEX Magok</div>
                  <div style={{ fontSize:10, color:'var(--gray)' }}>코엑스 마곡</div>
                </div>
              </div>
              <div style={{ display:'inline-block', fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(0,48,135,0.07)', border:'1px solid rgba(0,48,135,0.18)', color:'#003087', fontWeight:600 }}>
                📍 마곡나루역 인근 · 도보 7분
              </div>
            </div>
          </div>
          <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.7, marginBottom:12 }}>
            마곡 랜드마크 복합문화공간. 전시·공연·팝업·이벤트가 상시 운영되며, 마곡 주민의 문화생활 거점.
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {[
              { emoji:'🎭', label:'공연·전시',  color:'rgba(0,48,135,0.07)', border:'rgba(0,48,135,0.18)', text:'#003087' },
              { emoji:'🎪', label:'팝업스토어', color:'rgba(200,168,64,0.1)', border:'rgba(200,168,64,0.3)', text:'#8a6f00' },
              { emoji:'🛍️', label:'쇼핑',       color:'rgba(11,40,73,0.07)', border:'rgba(11,40,73,0.2)',  text:'var(--navy)' },
              { emoji:'🍴', label:'F&B',        color:'rgba(26,144,104,0.07)',border:'rgba(26,144,104,0.2)',text:'#1A9068' },
            ].map(c => (
              <span key={c.label} style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background:c.color, border:`1px solid ${c.border}`, color:c.text, fontWeight:600 }}>
                {c.emoji} {c.label}
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <a href="https://coexmagok.co.kr/event-schedule/calendar/" target="_blank" rel="noopener noreferrer"
              style={{ ...hotLinkBtn, flex:1, textAlign:'center' }}>
              이벤트 캘린더 →
            </a>
            <a href="https://coexmagok.co.kr" target="_blank" rel="noopener noreferrer"
              style={{ ...hotLinkBtn, flex:1, textAlign:'center', background:'rgba(0,48,135,0.06)', color:'#003087', border:'1px solid rgba(0,48,135,0.2)' }}>
              공식 사이트 →
            </a>
          </div>
        </div>
      </section>

      {/* ── 맛집·편의시설 ── */}
      <section style={section}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={secLabel}>🍽️ 주변 맛집 & 편의시설</div>
          <button style={refreshPlacesBtn} onClick={() => loadPlaces(true)} disabled={placesLoading}>
            {placesLoading ? '검색 중...' : '🔍 AI 실검색'}
          </button>
        </div>
        <div style={criteriaBanner}>
          🎯 AI 실검색 기준: <strong>구글 리뷰 100개 이상 · 평점 4.0점 이상</strong> · 실제 영업 중인 업소명만
        </div>
        {placesLoading && (
          <div style={{ textAlign:'center', padding:'20px', color:'var(--gray)', fontSize:11 }}>
            AI가 실제 운영 중인 장소를 검색 중입니다...
          </div>
        )}
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          {Object.entries(CAT_LABELS).map(([k, l]) => (
            <button key={k} style={{ ...catBtn, ...(placeCat === k ? catBtnActive : {}) }} onClick={() => setPlaceCat(k)}>{l}</button>
          ))}
        </div>

        {/* 네이버 지도 검색 바로가기 */}
        <div style={{ background:'rgba(0,143,175,0.04)', border:'1px solid rgba(0,143,175,0.18)', borderRadius:12, padding:'10px 12px', marginBottom:12 }}>
          <div style={{ fontSize:10, color:'var(--cyan)', fontWeight:700, marginBottom:8 }}>
            🔍 네이버 지도에서 실시간 검색
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <button style={{ ...naverBtn, fontSize:11 }}
              onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent('신방화역 ' + CAT_SEARCH[placeCat])}`, '_blank')}>
              📍 신방화역 {CAT_LABELS[placeCat]}
            </button>
            <button style={{ ...naverBtn, fontSize:11, background:'#7A5FAF' }}
              onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent('마곡역 ' + CAT_SEARCH[placeCat])}`, '_blank')}>
              📍 마곡역 {CAT_LABELS[placeCat]}
            </button>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map((p, i) => (
            <div key={i} style={{ ...placeCard, outline: mapPlace?.name === p.name ? '2px solid var(--gold)' : 'none' }}
              onClick={() => showOnMap(p)}>
              <div style={{ width:42, height:42, borderRadius:10, background:'rgba(200,168,64,0.08)', border:'1px solid var(--gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {p.emoji}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{p.name}</span>
                  <span style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>{p.dist}</span>
                </div>
                <div style={{ fontSize:10, color:'var(--gray)', marginBottom:3 }}>{p.desc}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:10, color:'var(--gold)' }}>★ {p.rating}</div>
                  <button style={mapLinkBtn} onClick={e => { e.stopPropagation(); window.open(`https://map.naver.com/v5/search/${encodeURIComponent(p.name + ' 서울 강서구')}`, '_blank'); }}>
                    네이버 →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {placesLoaded && (
          <div style={{ fontSize:10, color:'var(--gray)', textAlign:'center', marginTop:8, lineHeight:1.6 }}>
            AI 검색 결과 기준 · 실제 운영 여부는 방문 전 확인 권장
          </div>
        )}
      </section>
    </div>
  );
}

/* ── 스타일 ── */
const wrap = { padding:'16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };
const section = { marginBottom:20 };
const secLabel = { fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:10, fontWeight:600 };
const card = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:14, boxShadow:'var(--shadow-sm)' };
const schoolTabs = { display:'flex', gap:6, marginBottom:10 };
const sTab = { flex:1, padding:'7px', background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:8, color:'var(--gray)', fontSize:11 };
const sTabActive = { background:'var(--navy)', color:'#FFFFFF', fontWeight:700, border:'none' };
const schoolRow = { display:'flex', alignItems:'center', gap:8, background:'var(--bg)', borderRadius:10, padding:'10px 12px', marginBottom:4, border:'1px solid var(--border)' };
const schoolDetail = {
  background:'rgba(200,168,64,0.04)', border:'1px solid var(--gold-dim)',
  borderRadius:10, padding:'12px 14px', marginBottom:6, marginTop:-2,
};
const detailChip = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px' };
const detailChipLabel = { fontSize:9, color:'var(--gray)', marginBottom:3 };
const detailChipValue = { fontSize:13, fontWeight:700, color:'var(--text)' };
const naverBtn = {
  padding:'9px 8px', background:'var(--navy)', border:'none', borderRadius:8,
  color:'#FFFFFF', fontSize:11, fontWeight:600, cursor:'pointer', textAlign:'center',
};
const kakaoBtn = {
  padding:'9px 8px', background:'#FFE812', border:'none', borderRadius:8,
  color:'#3C1E1E', fontSize:11, fontWeight:700, cursor:'pointer', textAlign:'center',
};
const subwayRow = { display:'flex', alignItems:'center', gap:10, background:'var(--bg)', borderRadius:10, padding:'10px 12px', marginBottom:4, border:'1px solid var(--border)' };
const subwayDetail = {
  background:'rgba(200,168,64,0.03)', border:'1px solid var(--gold-dim)',
  borderRadius:10, padding:'12px 14px', marginBottom:6, marginTop:-2,
};
const busDetail = {
  background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:10, padding:'12px 14px', marginBottom:12,
};
const catBtn = { fontSize:10, padding:'4px 10px', background:'#FFFFFF', color:'var(--text-2)', border:'1px solid var(--border)', borderRadius:10 };
const catBtnActive = { background:'var(--navy)', color:'#FFFFFF', fontWeight:700, border:'none' };
const placeCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:12, padding:'12px 14px', display:'flex', gap:12, alignItems:'center', cursor:'pointer',
  boxShadow:'var(--shadow-sm)',
};
const mapLinkBtn = {
  fontSize:10, padding:'3px 8px', background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:6, color:'var(--navy)', cursor:'pointer', fontWeight:600,
};
const refreshPlacesBtn = {
  fontSize:11, padding:'5px 10px', background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, color:'var(--text)', cursor:'pointer',
};
const locationCard = {
  background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16,
  overflow:'hidden', boxShadow:'var(--shadow)',
};
const locationHeader = {
  background:'linear-gradient(135deg, var(--navy) 0%, #1a3a5c 100%)',
  padding:'16px 14px', display:'flex', alignItems:'center', gap:12,
};
const locationDot = {
  width:36, height:36, borderRadius:'50%', background:'rgba(200,168,64,0.25)',
  border:'2px solid var(--gold)', flexShrink:0,
  backgroundImage:'radial-gradient(circle at center, var(--gold) 4px, transparent 4px)',
  backgroundRepeat:'no-repeat', backgroundPosition:'center',
};
const locChip = {
  background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10,
  padding:'8px 10px', display:'flex', gap:8, alignItems:'center',
};
const hospSpecBtn = {
  fontSize:11, padding:'6px 11px', background:'#FFFFFF',
  border:'1px solid var(--border)', borderRadius:20, color:'var(--text-2)', cursor:'pointer',
};
const hospSpecBtnActive = { background:'var(--red)', color:'#FFFFFF', fontWeight:700, border:'none' };
const hospCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:12, padding:'12px 14px', boxShadow:'var(--shadow-sm)',
};
const criteriaBanner = {
  background:'rgba(26,144,104,0.05)', border:'1px solid rgba(26,144,104,0.2)',
  borderRadius:9, padding:'8px 12px', fontSize:10, color:'var(--text-2)',
  lineHeight:1.6, marginBottom:12,
};
const hotCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'16px 16px', marginBottom:12,
  position:'relative', overflow:'hidden',
  boxShadow:'var(--shadow)',
};
const hotLinkBtn = {
  display:'block', padding:'9px 14px',
  background:'rgba(11,40,73,0.06)', border:'1px solid rgba(11,40,73,0.15)',
  borderRadius:9, fontSize:12, fontWeight:600, color:'var(--navy)',
  textDecoration:'none', textAlign:'center',
};
