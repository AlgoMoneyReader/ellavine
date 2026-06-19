import { useState } from 'react';
import { DONG_ORIENT, DONG_UNIT_MAP, ORIENT_COLOR } from '../../data/ellavineData';

// ── 타입별 평면도 데이터 ──────────────────────────────────────
// 이미지 파일을 /public/floorplans/ 에 저장하세요
// 예: plan-44.jpg / plan-59B.jpg / plan-76A1.jpg …
const FLOOR_PLANS = [
  { type:'44',  area:'44.84',  rooms:'2룸',           beds:2, baths:1, imgs:['/floorplans/plan-44.jpg'] },
  { type:'59B', area:'59.53',  rooms:'3룸+드레스룸',  beds:3, baths:2, imgs:['/floorplans/plan-59B.jpg'] },
  { type:'76A1', area:'76.21',  rooms:'3룸+드레스룸',  beds:3, baths:2,
    imgs:['/floorplans/plan-76A1.jpg'], note:'110동 3호 라인 (14세대)' },
  { type:'76A2', area:'76.21',  rooms:'3룸+드레스룸',  beds:3, baths:2,
    imgs:['/floorplans/plan-76A2.jpg'], note:'106·107동 5호 라인 (25세대)' },
  { type:'84A', area:'84.53',  rooms:'3룸+드레스룸',  beds:3, baths:2, imgs:['/floorplans/plan-84A.jpg'] },
  { type:'84B', area:'84.32',  rooms:'3룸+드레스룸', beds:3, baths:2, imgs:['/floorplans/plan-84B.jpg'],
    note:'개방형 발코니: 홀수층/짝수층 선택' },
  { type:'84C', area:'84.10',  rooms:'3룸+드레스룸×2', beds:3, baths:2, imgs:['/floorplans/plan-84C.jpg'],
    note:'개방형 발코니: 홀수층/짝수층 선택' },
  { type:'84D', area:'84.33',  rooms:'3룸+드레스룸',  beds:3, baths:2, imgs:['/floorplans/plan-84D.jpg'] },
  { type:'115', area:'115.22', rooms:'4룸+드레스룸×2', beds:4, baths:2, imgs:['/floorplans/plan-115.jpg'],
    note:'개방형 발코니: 홀수층/짝수층 선택' },
];

export default function OrientationTab() {
  // 조망·향 상태
  const [selected, setSelected] = useState(null);

  // 평면도 상태
  const [viewMode, setViewMode] = useState('orient'); // 'orient' | 'plan'
  const [selectedPlan, setSelectedPlan] = useState('84A');
  const [imgIdx, setImgIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(null); // img url

  const info = selected ? DONG_ORIENT[selected] : null;
  const currentPlan = FLOOR_PLANS.find(p => p.type === selectedPlan) || FLOOR_PLANS[0];

  function selectPlan(type) {
    setSelectedPlan(type);
    setImgIdx(0);
  }

  return (
    <div style={wrap}>
      <div style={sectionTitle}>동별 조망 & 평면도</div>
      <div style={sectionSub}>향 정보 및 타입별 확장 평면도를 확인하세요</div>
      <div style={goldLine} />

      {/* ⚠️ 향 정보 면책 배너 */}
      <div style={disclaimerBanner}>
        <div style={{ fontSize:12, fontWeight:700, color:'#92400E', marginBottom:4 }}>
          ⚠️ 향 정보는 AI 추정 데이터입니다
        </div>
        <div style={{ fontSize:11, color:'#92400E', lineHeight:1.6, marginBottom:8 }}>
          아래 동·호수별 향 정보는 단지 배치도 기반 추정값으로,
          실제와 다를 수 있습니다. 정확한 향·조망은 3D조경에서 직접 확인하세요.
        </div>
        <a
          href="https://zed.zigbang.com/apt3d/itemLocation/?domain=hogangnono&danjiId=90718&screen_name=ZED%EC%83%81%EC%84%B8"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display:'inline-block', padding:'6px 14px', background:'#92400E', color:'#fff',
            borderRadius:8, fontSize:11, fontWeight:700, textDecoration:'none' }}>
          🏗️ ZED 3D 조망 데이터 보기 →
        </a>
      </div>

      {/* 뷰 모드 토글 */}
      <div style={modeToggle}>
        <button style={{ ...modeBtn, ...(viewMode==='orient' ? modeBtnActive : {}) }}
          onClick={() => setViewMode('orient')}>🧭 조망·향</button>
        <button style={{ ...modeBtn, ...(viewMode==='plan' ? modeBtnActive : {}) }}
          onClick={() => setViewMode('plan')}>📐 평면도</button>
      </div>

      {/* ─────────── 조망·향 뷰 ─────────── */}
      {viewMode === 'orient' && (
        <>
          {/* 동 선택 그리드 */}
          <div style={dongGrid}>
            {Object.keys(DONG_ORIENT).map(dong => {
              const d = DONG_ORIENT[dong];
              const col = ORIENT_COLOR[d.orient] || 'var(--gold)';
              const isSelected = selected === dong;
              return (
                <div key={dong} style={{
                  ...dongCard,
                  borderColor: isSelected ? col : 'var(--border)',
                  background: isSelected ? `${col}18` : '#FFFFFF',
                  boxShadow: isSelected ? `0 2px 12px ${col}30` : 'var(--shadow-sm)',
                }}
                  onClick={() => setSelected(isSelected ? null : dong)}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, color: isSelected ? col : 'var(--navy)' }}>{dong}</div>
                  <div style={{ fontSize:9, color: col, marginTop:2 }}>{d.orient}</div>
                </div>
              );
            })}
          </div>

          {/* 상세 정보 */}
          {info && (
            <div style={detailCard}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,transparent,${ORIENT_COLOR[info.orient] || 'var(--gold)'},transparent)`, borderRadius:'20px 20px 0 0' }} />

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div>
                  <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)' }}>{selected}동</div>
                  <div style={{ fontSize:12, color: ORIENT_COLOR[info.orient] || 'var(--gold)', marginTop:4 }}>
                    {info.orient} 위주 · {Object.values(DONG_UNIT_MAP[selected]||{}).map(u=>u.type).filter((v,i,a)=>a.indexOf(v)===i).join(', ')}
                  </div>
                </div>
                <div style={compassWrap}>
                  <div style={{ fontSize:8, color:'var(--gold)', position:'absolute', top:4, left:'50%', transform:'translateX(-50%)', fontWeight:700 }}>N</div>
                  <div style={{ ...needle, transform:`translate(-50%,-100%) rotate(${info.angle}deg)` }} />
                  <div style={{ fontSize:8, color:'var(--gray)', position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)' }}>S</div>
                  <div style={{ fontSize:8, color:'var(--gray)', position:'absolute', left:4, top:'50%', transform:'translateY(-50%)' }}>W</div>
                  <div style={{ fontSize:8, color:'var(--gray)', position:'absolute', right:4, top:'50%', transform:'translateY(-50%)' }}>E</div>
                </div>
              </div>

              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {info.tags.map(t => (
                  <span key={t} style={tag}>{t}</span>
                ))}
              </div>

              <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.7, marginBottom:16 }}>{info.desc}</div>

              <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:10 }}>호수별 향 상세</div>
              {Object.entries(info.units).map(([hoNum, u]) => {
                const t = DONG_UNIT_MAP[selected]?.[hoNum];
                const col = ORIENT_COLOR[u.orient] || 'var(--gold)';
                return (
                  <div key={hoNum} style={unitRow}>
                    <div style={{ ...unitDot, background:`${col}15`, borderColor: col, color: col }}>{hoNum}호</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                        <span style={{ fontSize:12, fontWeight:600, color: col }}>{u.orient}</span>
                        {t && <span style={{ fontSize:10, color:'var(--gray)' }}>({t.type})</span>}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-2)', lineHeight:1.5 }}>{u.tip}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!selected && (
            <div style={summaryCard}>
              <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:12 }}>전체 동 향 요약</div>
              {Object.entries(DONG_ORIENT).map(([dong, d]) => {
                const col = ORIENT_COLOR[d.orient] || 'var(--gold)';
                return (
                  <div key={dong} style={summaryRow} onClick={() => setSelected(dong)}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'var(--navy)', width:40 }}>{dong}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600, color: col }}>{d.orient}</div>
                      <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>{d.tags.slice(0,2).join(' · ')}</div>
                    </div>
                    <div style={{ fontSize:12, color:'var(--gray)' }}>›</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─────────── 평면도 뷰 ─────────── */}
      {viewMode === 'plan' && (
        <>
          {/* 확장형 기준 안내 */}
          <div style={expansionNote}>
            📌 모든 평면도는 <strong>발코니 확장형 기준</strong>입니다.<br />
            비확장 시 면적 및 구조가 다를 수 있습니다.
          </div>

          {/* 타입 선택 칩 */}
          <div style={typeChips}>
            {FLOOR_PLANS.map(p => (
              <button key={p.type}
                style={{ ...typeChip, ...(selectedPlan === p.type ? typeChipActive : {}) }}
                onClick={() => selectPlan(p.type)}>
                {p.type}형
              </button>
            ))}
          </div>

          {/* 선택된 타입 정보 */}
          <div style={planCard}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, color:'var(--navy)' }}>
                  {currentPlan.type}<span style={{ fontSize:14, marginLeft:2 }}>형</span>
                </div>
                <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2 }}>
                  전용 {currentPlan.area}㎡ · {currentPlan.rooms}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <span style={badgePill}>🛏️ {currentPlan.beds}개</span>
                <span style={badgePill}>🚿 {currentPlan.baths}개</span>
              </div>
            </div>

            {/* 개방형 발코니 선택 안내 */}
            {currentPlan.note && (
              <div style={{ fontSize:10, color:'var(--cyan)', background:'rgba(0,143,175,0.06)', border:'1px solid rgba(0,143,175,0.15)', borderRadius:8, padding:'6px 10px', marginBottom:10 }}>
                🏗️ {currentPlan.note}
              </div>
            )}

            {/* 이미지 (여러 장일 때 레이블 탭) */}
            {currentPlan.imgs.length > 1 && (
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                {currentPlan.imgLabels?.map((lbl, i) => (
                  <button key={i}
                    style={{ ...imgTab, ...(imgIdx === i ? imgTabActive : {}) }}
                    onClick={() => setImgIdx(i)}>
                    {lbl}
                  </button>
                ))}
              </div>
            )}

            {/* 평면도 이미지 */}
            <div style={imgWrapper} onClick={() => setFullscreen(currentPlan.imgs[imgIdx])}>
              <img
                src={currentPlan.imgs[imgIdx]}
                alt={`${currentPlan.type}형 평면도`}
                style={planImg}
                onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
              />
              <div style={imgPlaceholder}>
                <div style={{ fontSize:32, marginBottom:8 }}>📐</div>
                <div style={{ fontSize:12, color:'var(--text-2)' }}>이미지 준비 중</div>
                <div style={{ fontSize:10, color:'var(--gray)', marginTop:4 }}>/public/floorplans/plan-{currentPlan.type}.jpg</div>
              </div>
              <div style={tapHint}>탭하여 크게 보기 ↗</div>
            </div>
          </div>

          {/* 타입별 미니 목록 */}
          <div style={planListCard}>
            <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, marginBottom:12 }}>타입별 면적 요약</div>
            {FLOOR_PLANS.map(p => (
              <div key={p.type} style={{ ...planListRow, ...(selectedPlan===p.type ? planListRowActive : {}) }}
                onClick={() => selectPlan(p.type)}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, color:'var(--navy)', minWidth:52, fontWeight:300, whiteSpace:'nowrap' }}>{p.type}형</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>{p.rooms}</div>
                  <div style={{ fontSize:10, color:'var(--gray)' }}>전용 {p.area}㎡</div>
                </div>
                <div style={{ fontSize:12, color:'var(--gray)' }}>›</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 전체화면 오버레이 */}
      {fullscreen && (
        <div style={fsOverlay} onClick={() => setFullscreen(null)}>
          <div style={{ position:'absolute', top:16, right:16, color:'#FFFFFF', fontSize:24, cursor:'pointer' }}>✕</div>
          <img src={fullscreen} alt="평면도 전체화면" style={fsImg} onClick={e => e.stopPropagation()} />
          <div style={{ position:'absolute', bottom:20, color:'rgba(255,255,255,0.6)', fontSize:11 }}>확장형 기준 · 탭하여 닫기</div>
        </div>
      )}
    </div>
  );
}

const disclaimerBanner = {
  background:'#FEF3C7', border:'1px solid #FCD34D',
  borderRadius:12, padding:'12px 14px', marginBottom:16,
};
const wrap = { padding:'16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };

/* 모드 토글 */
const modeToggle = {
  display:'flex', background:'var(--bg)', borderRadius:12, padding:3, marginBottom:20, gap:3,
};
const modeBtn = {
  flex:1, padding:'10px', background:'transparent', border:'none', borderRadius:10,
  fontSize:13, color:'var(--gray)', cursor:'pointer', fontWeight:500,
};
const modeBtnActive = { background:'#FFFFFF', color:'var(--navy)', fontWeight:700, boxShadow:'var(--shadow-sm)' };

/* 조망·향 */
const dongGrid = { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:16 };
const dongCard = {
  background:'#FFFFFF', border:'1.5px solid', borderRadius:12,
  padding:'10px 6px', textAlign:'center', cursor:'pointer', transition:'all 0.2s',
};
const detailCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:20, padding:'20px 16px', position:'relative', overflow:'hidden',
  boxShadow:'var(--shadow)',
};
const compassWrap = {
  width:64, height:64, borderRadius:'50%',
  border:'1.5px solid var(--border)', position:'relative',
  background:'var(--bg)',
};
const needle = {
  position:'absolute', top:'50%', left:'50%',
  width:2, height:22, background:'var(--gold)',
  borderRadius:'1px 1px 0 0', transformOrigin:'bottom center',
  transition:'transform 0.5s ease',
};
const tag = {
  fontSize:9, padding:'3px 8px', borderRadius:20,
  background:'rgba(200,168,64,0.08)', color:'var(--gold)',
  border:'1px solid var(--gold-dim)',
};
const unitRow = {
  display:'flex', alignItems:'flex-start', gap:10,
  padding:'10px 12px', background:'var(--bg)',
  border:'1px solid var(--border)', borderRadius:10, marginBottom:6,
};
const unitDot = {
  width:32, height:32, borderRadius:'50%', border:'2px solid',
  display:'flex', alignItems:'center', justifyContent:'center',
  fontSize:10, fontWeight:700, flexShrink:0,
};
const summaryCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'16px', boxShadow:'var(--shadow)',
};
const summaryRow = {
  display:'flex', alignItems:'center', gap:12,
  padding:'10px 12px', cursor:'pointer', borderRadius:10,
  transition:'background 0.2s', borderBottom:'1px solid var(--border)',
};

/* 평면도 */
const expansionNote = {
  background:'rgba(200,168,64,0.06)', border:'1px solid var(--gold-dim)',
  borderRadius:10, padding:'10px 14px', fontSize:11, color:'var(--text-2)',
  lineHeight:1.7, marginBottom:16,
};
const typeChips = { display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 };
const typeChip = {
  fontSize:11, padding:'6px 14px', borderRadius:20,
  border:'1px solid var(--border)', color:'var(--gray)',
  cursor:'pointer', background:'#FFFFFF',
};
const typeChipActive = { background:'var(--navy)', color:'#FFFFFF', fontWeight:700, border:'none' };
const planCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:20, padding:'16px', marginBottom:14,
  boxShadow:'var(--shadow)',
};
const badgePill = {
  fontSize:10, padding:'4px 10px', borderRadius:20,
  background:'rgba(11,40,73,0.06)', color:'var(--navy)',
  border:'1px solid rgba(11,40,73,0.12)',
};
const imgTab = {
  flex:1, padding:'6px', background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, fontSize:10, color:'var(--gray)', cursor:'pointer',
};
const imgTabActive = { background:'var(--navy)', color:'#FFFFFF', border:'none', fontWeight:600 };
const imgWrapper = {
  position:'relative', borderRadius:12, overflow:'hidden',
  cursor:'pointer', background:'var(--bg)',
};
const planImg = {
  width:'100%', display:'block', borderRadius:12,
};
const imgPlaceholder = {
  display:'none', flexDirection:'column', alignItems:'center', justifyContent:'center',
  height:220, background:'var(--bg)', borderRadius:12,
  border:'2px dashed var(--border)',
};
const tapHint = {
  position:'absolute', bottom:8, right:10, fontSize:9,
  color:'rgba(255,255,255,0.9)', background:'rgba(0,0,0,0.35)',
  padding:'3px 8px', borderRadius:8, pointerEvents:'none',
};
const planListCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'16px', boxShadow:'var(--shadow-sm)',
};
const planListRow = {
  display:'flex', alignItems:'center', gap:12,
  padding:'10px 12px', cursor:'pointer', borderRadius:10,
  borderBottom:'1px solid var(--border)', transition:'background 0.15s',
};
// 타입 셀 nowrap 처리는 인라인 style로: whiteSpace:'nowrap', width:'auto', minWidth:52
const planListRowActive = { background:'rgba(11,40,73,0.04)' };

/* 전체화면 */
const fsOverlay = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
  zIndex:2000, padding:16,
};
const fsImg = {
  maxWidth:'100%', maxHeight:'85vh', objectFit:'contain', borderRadius:8,
};
