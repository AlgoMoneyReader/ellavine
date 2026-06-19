const FACILITIES = [
  {
    id: 'community',
    img: '/facilities/community.jpg',
    name: '커뮤니티 센터',
    location: '101동·110동 B1F–1F',
    emoji: '🏛️',
    color: '#1A9068',
    accent: 'rgba(26,144,104,0.08)',
    accentBorder: 'rgba(26,144,104,0.2)',
    summary: '단지 핵심 커뮤니티 시설. 피트니스·골프·사우나·독서실 등 복합 공간',
    features: [
      { icon: '🏋️', name: '피트니스 센터', desc: '최신 유산소·근력 기구 완비. 넓은 운동 공간' },
      { icon: '⛳', name: '골프연습장',   desc: '스크린 골프 + 실내 퍼팅 연습장 구비' },
      { icon: '♨️', name: '사우나',       desc: '건식·습식 사우나. 여성·남성 분리 운영' },
      { icon: '📚', name: '독서실',       desc: '조용한 개인 학습 공간. 독립 좌석 제공' },
      { icon: '🛋️', name: '라운지',      desc: '입주민 공유 라운지. 소모임·친목 공간' },
      { icon: '🎯', name: '다목적 회의실', desc: '예약 후 사용 가능한 소규모 회의실' },
    ],
  },
  {
    id: 'sky',
    img: '/facilities/sky.jpg',
    name: '스카이커뮤니티',
    location: '101동 13F · 14F',
    emoji: '🌆',
    color: '#0B2849',
    accent: 'rgba(11,40,73,0.06)',
    accentBorder: 'rgba(11,40,73,0.15)',
    summary: '101동 13·14층 커뮤니티 공간. 세부 구성은 입주 후 관리사무소 확인 필요.',
    features: [],
  },
  {
    id: 'momscafe',
    img: '/facilities/momscafe.jpg',
    name: '맘스카페',
    location: '106동 1F',
    emoji: '☕',
    color: '#C8A840',
    accent: 'rgba(200,168,64,0.07)',
    accentBorder: 'rgba(200,168,64,0.2)',
    summary: '영유아 동반 부모를 위한 카페형 커뮤니티 공간',
    features: [
      { icon: '🍼', name: '수유·기저귀 코너', desc: '수유실 및 기저귀 교환대 완비' },
      { icon: '🧸', name: '놀이 공간',        desc: '영유아 안전 놀이매트 및 장난감 구비' },
      { icon: '☕', name: '카페 공간',         desc: '입주민 간 교류를 위한 카페형 공용 라운지' },
    ],
  },
  {
    id: 'daycare',
    img: '/facilities/daycare.jpg',
    name: '어린이집',
    location: '107동 1F',
    emoji: '🧒',
    color: '#008FAF',
    accent: 'rgba(0,143,175,0.07)',
    accentBorder: 'rgba(0,143,175,0.2)',
    summary: '단지 내 입주민 전용 어린이집. 보육교사 상주 운영',
    features: [
      { icon: '🏫', name: '보육 시설',    desc: '연령별 보육 공간 구분. 안전한 단지 내 어린이집' },
      { icon: '🍽️', name: '급식실',      desc: '영양사가 관리하는 위생적 급식 운영' },
      { icon: '🌳', name: '실외 놀이터',  desc: '단지 내 안전 놀이터와 연계된 옥외 활동 공간' },
    ],
  },
  {
    id: 'senior',
    img: '/facilities/senior.jpg',
    name: '경로당',
    location: '108동 1F',
    emoji: '🌿',
    color: '#7A8FA0',
    accent: 'rgba(122,143,160,0.07)',
    accentBorder: 'rgba(122,143,160,0.2)',
    summary: '어르신 전용 여가·문화 활동 공간. 취미 모임 가능',
    features: [
      { icon: '🎭', name: '다목적 홀',  desc: '노래·바둑·장기 등 취미 활동 공간' },
      { icon: '🛋️', name: '휴게실',    desc: '편안한 소파·TV 등 휴게 시설 완비' },
      { icon: '🏥', name: '건강 코너',  desc: '혈압계·체중계 등 간단한 건강 체크 가능' },
    ],
  },
];

export default function FacilitiesTab() {
  return (
    <div style={wrap}>
      {/* 헤더 */}
      <div style={heroSection}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:10, letterSpacing:4, color:'var(--gold)', textTransform:'uppercase', marginBottom:6 }}>CLUB RAEMIAN</div>
        <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:22, fontWeight:600, color:'var(--navy)', marginBottom:10, lineHeight:1.4 }}>
          커뮤니티 라이프
        </div>
        <div style={{ width:32, height:2, background:'var(--gold)', marginBottom:14, borderRadius:1 }} />
        <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.8 }}>
          스카이라운지, 피트니스, 골프연습장, 사우나, 독서실 등<br />
          복합 커뮤니티 시설을 통해 여유로운 생활을 누려보세요.
        </div>
      </div>

      {/* 시설 평면도 전체 */}
      <div style={floorplanSection}>
        <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, fontWeight:600, marginBottom:10 }}>🏗️ 시설 평면도</div>
        <img
          src="/facilities/floorplans.jpeg"
          alt="CLUB RAEMIAN 시설 평면도"
          style={floorplanImg}
          onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
        />
      </div>

      {/* 면책 고지 */}
      <div style={disclaimerCard}>
        <span style={{ fontSize:13, marginRight:6 }}>ℹ️</span>
        <span>시설 구성 및 세부 내용은 <strong>통상적인 래미안 커뮤니티 기준을 참고</strong>하여 작성된 내용으로, 현재까지 공식 확정된 사항이 아닙니다. 입주 후 관리사무소 안내를 통해 최종 확인하시기 바라며, <strong>확정 내용은 순차적으로 업데이트</strong>할 예정입니다.</span>
      </div>

      {/* 시설 요약 칩 */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
        {FACILITIES.map(f => (
          <div key={f.id} style={{ ...facilityChip, borderColor: f.accentBorder, background: f.accent, color: f.color }}>
            {f.emoji} {f.name}
          </div>
        ))}
      </div>

      {/* 시설 카드 목록 */}
      {FACILITIES.map(f => (
        <div key={f.id} style={facilityCard}>
          {/* 카드 상단 컬러 라인 */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${f.color},${f.color}88,transparent)`, borderRadius:'16px 16px 0 0' }} />

          {/* 카드 헤더 */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:24 }}>{f.emoji}</span>
                <div>
                  <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:16, fontWeight:600, color:'var(--navy)' }}>{f.name}</div>
                </div>
              </div>
              <div style={{ ...locationBadge, background: f.accent, borderColor: f.accentBorder, color: f.color }}>
                📍 {f.location}
              </div>
            </div>
          </div>

          {/* 평면도 이미지 */}
          {f.img && (
            <div style={facilityImgWrap}>
              <img
                src={f.img}
                alt={f.name + ' 평면도'}
                style={facilityImg}
                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
              />
            </div>
          )}

          {/* 요약 */}
          <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.7, marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
            {f.summary}
          </div>

          {/* 세부 시설 */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {f.features.map((feat, i) => (
              <div key={i} style={featureRow}>
                <div style={{ ...featureIcon, background: f.accent, borderColor: f.accentBorder }}>{feat.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{feat.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.5 }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 운영 안내 */}
      <div style={noticeCard}>
        <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, fontWeight:600, marginBottom:10 }}>📋 운영 안내</div>
        {[
          '커뮤니티 시설 운영 방식 및 이용 요금은 입주 후 관리사무소 공지를 통해 확인하시기 바랍니다.',
          '어린이집은 별도 입소 절차를 통해 이용하며, 정원 제한이 있습니다.',
          '경로당은 만 60세 이상 입주민이 이용 가능합니다.',
          '세부 운영 규정은 입주 후 관리사무소를 통해 확인해 주세요.',
        ].map((t, i) => (
          <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
            <span style={{ color:'var(--gold)', fontSize:12, flexShrink:0 }}>·</span>
            <span style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.7 }}>{t}</span>
          </div>
        ))}
      </div>

      {/* 재건축 조합 사무소 */}
      <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', marginTop:16, boxShadow:'var(--shadow)' }}>
        {/* 조합 안내 */}
        <div style={{ padding:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:18 }}>🏢</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>방화 6구역 재건축 조합</div>
              <div style={{ fontSize:10, color:'var(--gold)', fontWeight:600, letterSpacing:0.5 }}>래미안 엘라비네 시행사</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:12 }}>
              <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>📍</span>
              <span style={{ color:'var(--text)', lineHeight:1.6 }}>서울특별시 강서구 방화대로 270<br />태양빌딩 5층 (마곡동)</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>📞</span>
              <a href="tel:02-2663-4541" style={{ color:'var(--navy)', fontWeight:700, textDecoration:'none' }}>02-2663-4541</a>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>📠</span>
              <span style={{ color:'var(--text-2)' }}>02-2663-4542 (팩스)</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <a
              href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=banghwa6"
              target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'9px 0', background:'var(--navy)', color:'#fff', borderRadius:10, fontSize:11, fontWeight:700, textAlign:'center', textDecoration:'none' }}
            >
              🏛️ 서울시 정비사업 정보몽땅
            </a>
            <a
              href="https://place.map.kakao.com/2072008509"
              target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'9px 0', background:'#FAE100', color:'#3C1E1E', borderRadius:10, fontSize:12, fontWeight:700, textAlign:'center', textDecoration:'none' }}
            >
              🗺️ 카카오맵
            </a>
          </div>
        </div>
        {/* 지도 */}
        <div style={{ position:'relative', width:'100%', paddingBottom:'52%', background:'#e8eaed', overflow:'hidden' }}>
          <iframe
            title="조합 사무소 위치"
            src="https://map.kakao.com/?itemId=2072008509"
            style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

const wrap = { padding:'16px 16px 120px' };
const disclaimerCard = {
  display:'flex', alignItems:'flex-start', gap:4,
  background:'rgba(0,143,175,0.05)', border:'1px solid rgba(0,143,175,0.2)',
  borderRadius:10, padding:'10px 14px', marginBottom:16,
  fontSize:11, color:'var(--text-2)', lineHeight:1.7,
};
const heroSection = {
  background:'linear-gradient(135deg, rgba(200,168,64,0.06) 0%, rgba(11,40,73,0.04) 100%)',
  border:'1px solid var(--border)',
  borderRadius:20, padding:'22px 18px', marginBottom:16,
};
const facilityChip = {
  fontSize:11, padding:'5px 10px', borderRadius:20,
  border:'1px solid', fontWeight:600,
};
const facilityCard = {
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:16, padding:'18px 16px', marginBottom:14,
  position:'relative', overflow:'hidden',
  boxShadow:'var(--shadow)',
};
const locationBadge = {
  display:'inline-block', fontSize:10, padding:'3px 8px',
  borderRadius:20, border:'1px solid', fontWeight:600, marginTop:4,
};
const featureRow = {
  display:'flex', gap:10, alignItems:'flex-start',
  padding:'8px 10px', background:'var(--bg)', borderRadius:10,
  border:'1px solid var(--border)',
};
const featureIcon = {
  width:32, height:32, borderRadius:8, border:'1px solid',
  display:'flex', alignItems:'center', justifyContent:'center',
  fontSize:16, flexShrink:0,
};
const facilityImgWrap = {
  margin: '-4px -16px 14px',
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
  overflow: 'hidden',
};
const facilityImg = {
  width: '100%',
  display: 'block',
  objectFit: 'contain',
  maxHeight: 260,
};
const floorplanSection = {
  background: '#FFFFFF',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '14px 16px',
  marginBottom: 20,
  boxShadow: 'var(--shadow-sm)',
};
const floorplanImg = {
  width: '100%',
  display: 'block',
  borderRadius: 8,
  border: '1px solid var(--border)',
};
const noticeCard = {
  background:'rgba(200,168,64,0.04)', border:'1px solid var(--gold-dim)',
  borderRadius:14, padding:'14px 16px', marginTop:4,
};

