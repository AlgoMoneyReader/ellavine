import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DONG_UNIT_MAP, PRICE_TABLE, PAYMENT_DATES } from '../../data/ellavineData';
import { supabase, isSupabaseReady } from '../../lib/supabase';

const BALCONY_PRICES = {
  '44': 10_580_000, '59B': 21_150_000,
  '76A': 20_380_000, '76A1': 20_380_000, '76A2': 20_380_000,
  '84A': 24_990_000, '84B': 21_950_000, '84C': 25_830_000,
  '84D': 23_540_000, '115': 33_930_000,
};

function getStatus(dateStr) {
  const today = new Date();
  if (dateStr.includes('2026.04')) return 'done';
  const d = dateStr.replace(/\./g, '-').substring(0, 10);
  const pd = new Date(d);
  if (pd < today) return 'done';
  const diff = (pd - today) / (1000 * 60 * 60 * 24);
  return diff < 60 ? 'next' : 'future';
}

function getPrice(type, floor) {
  const map = PRICE_TABLE[type];
  if (!map) return null;
  if (map[floor]) return map[floor];
  const floors = Object.keys(map).map(Number).sort((a, b) => a - b);
  for (let i = floors.length - 1; i >= 0; i--) {
    if (floors[i] <= floor) return map[floors[i]];
  }
  return map[floors[0]];
}

function calcAcqTax(price, type, area, balcony, extra, houseCount, isAdj) {
  const balconyAmt = balcony ? (BALCONY_PRICES[type] || 0) : 0;
  const taxBase = price + balconyAmt + (Number(extra) || 0) * 10_000;

  let taxRate;
  const base1 = (b) => b <= 600_000_000 ? 0.01 : b <= 900_000_000 ? ((b / 100_000_000) * (2 / 3) - 3) / 100 : 0.03;

  if (houseCount <= 1) {
    taxRate = base1(taxBase);
  } else if (houseCount === 2) {
    taxRate = isAdj ? 0.08 : base1(taxBase);
  } else {
    taxRate = isAdj ? 0.12 : 0.08;
  }

  const acq = Math.round(taxBase * taxRate);
  const edu = Math.round(acq * 0.1);
  const rural = area > 85 ? Math.round(taxBase * 0.002) : 0;

  return { taxBase, balconyAmt, taxRate, acq, edu, rural, total: acq + edu + rural };
}

const fmt = (n) => Math.round(n / 10000).toLocaleString();
const fmtWon = (n) => n >= 100_000_000
  ? `${(n / 100_000_000).toFixed(2)}억`
  : `${Math.round(n / 10000).toLocaleString()}만원`;

// ── 중도금 대출 동별 일정 ──────────────────────
const LOAN_SCHEDULE = [
  { date:'6월 16일 (화)', dongs:['101','102','103'] },
  { date:'6월 17일 (수)', dongs:['104','105'] },
  { date:'6월 18일 (목)', dongs:['106','110'] },
  { date:'6월 19일 (금)', dongs:['107','108','109'] },
];

export default function PaymentTab() {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState('timeline');
  const [dong, setDong] = useState(user?.dong || '');
  const [ho, setHo] = useState(user?.ho || '');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  /* 납부 체크 state */
  const [paidChecks, setPaidChecks] = useState(
    PAYMENT_DATES.map((_, i) => i === 0) // 계약금 기본 체크
  );

  function toggleCheck(i) {
    setPaidChecks(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
  }

  /* 취득세 계산기 state */
  const [balcony, setBalcony] = useState(true);
  const [extra, setExtra] = useState('');        // 만원 단위
  const [houseCount, setHouseCount] = useState(0);
  const isAdj = true; // 서울 전역 투기과열지구 = 조정대상지역 항상 적용

  /* 옵션 저장 관련 */
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved'
  const saveTimer = useRef(null);
  const prefsLoaded = useRef(false); // 로드 완료 전 자동저장 방지

  /* ── 이자 계산기 state ── */
  const [jdPrice,   setJdPrice]   = useState('');           // 중도금용 분양가 (억)
  const [jdRate,    setJdRate]    = useState('3.74');       // 중도금 금리 (%)
  const [jdEnd,     setJdEnd]     = useState('2028-10');    // 주담대 전환 예정 (YYYY-MM)
  const [jdSelfPay, setJdSelfPay] = useState([true, true, false, false, false, false]); // 자납 여부 (기본 1·2회차)
  const [mpPrice, setMpPrice] = useState('');        // 주담대 주택가격 (억)
  const [mpLoan,  setMpLoan]  = useState('');        // 대출금액 (억)
  const [mpRate,  setMpRate]  = useState('4.0');     // 주담대 금리 (%)
  const [mpTerm,  setMpTerm]  = useState(30);        // 대출기간 (년)
  const [mpType,  setMpType]  = useState('equal');   // equal=원리금균등, principal=원금균등

  // 로그인 시 저장된 옵션 불러오기
  useEffect(() => {
    if (!user?.username || !isSupabaseReady) { prefsLoaded.current = true; return; }
    supabase.from('residents').select('payment_prefs').eq('username', user.username).maybeSingle()
      .then(({ data }) => {
        if (data?.payment_prefs) {
          const p = data.payment_prefs;
          if (p.balcony !== undefined) setBalcony(p.balcony);
          if (p.extra  !== undefined) setExtra(p.extra || '');
          if (p.houseCount !== undefined) setHouseCount(p.houseCount);
          if (p.paidChecks !== undefined) setPaidChecks(p.paidChecks);
        }
        prefsLoaded.current = true;
      });
  }, [user?.username]);

  // 옵션 변경 시 자동저장 (800ms 디바운스)
  useEffect(() => {
    if (!prefsLoaded.current || !user?.username || !isSupabaseReady) return;
    setSaveStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('residents')
        .update({ payment_prefs: { balcony, extra, houseCount, paidChecks } })
        .eq('username', user.username);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [balcony, extra, houseCount, paidChecks]);

  function calc() {
    if (!dong || !ho) { setErr('동과 호수를 입력해주세요'); return; }
    const floor = parseInt(ho.slice(0, -2)) || parseInt(ho[0]);
    const unitNum = ho.slice(-1);
    const unitInfo = DONG_UNIT_MAP[dong]?.[unitNum];
    if (!unitInfo) {
      const valid = Object.keys(DONG_UNIT_MAP[dong] || {}).map(k => k + '호').join(', ');
      setErr(`${dong}동 ${ho}호 정보를 찾을 수 없습니다. 유효: ${valid}`);
      return;
    }
    const price = getPrice(unitInfo.type, floor);
    if (!price) { setErr('해당 타입 분양가 정보 없음'); return; }
    setErr('');
    setResult({ dong, ho, floor, ...unitInfo, price });
  }

  const tax = useMemo(() => {
    if (!result) return null;
    return calcAcqTax(result.price, result.type, result.area, balcony, extra, houseCount, isAdj);
  }, [result, balcony, extra, houseCount, isAdj]);

  // 동호수 조회 결과 → 계산기 분양가 자동 반영
  useEffect(() => {
    if (!result?.price) return;
    const eok = Math.round(result.price / 1_000_000) / 100; // 원 → 억 (소수 2자리)
    setJdPrice(String(eok));
    setMpPrice(String(eok));
    setMpLoan('');
  }, [result?.price]);

  // 중도금 이자 계산
  const EXEC_DATES = [
    { round:'1회차', date:'2026-07-15' },
    { round:'2회차', date:'2026-11-16' },
    { round:'3회차', date:'2027-03-15' },
    { round:'4회차', date:'2027-07-15' },
    { round:'5회차', date:'2027-11-15' },
    { round:'6회차', date:'2028-03-15' },
  ];

  const jdCalc = useMemo(() => {
    const price = parseFloat(jdPrice) * 100_000_000;
    if (!price || price <= 0) return null;
    const rate = parseFloat(jdRate);
    if (!rate || rate <= 0) return null;
    const [ey, em] = jdEnd.split('-').map(Number);
    const endDate = new Date(ey, em - 1, 15);

    const perRound = price * 0.1;
    const rows = [];
    let totalInterest = 0;

    for (let i = 0; i < EXEC_DATES.length; i++) {
      const isSelf   = !!jdSelfPay[i];
      const execDate = new Date(EXEC_DATES[i].date);
      // 각 회차 대출금은 실행일부터 주담대 전환일까지 전체 기간 이자 적용
      const days     = Math.max(0, Math.round((endDate - execDate) / 86400000));
      const months   = days / 30.4375;
      const interest = isSelf ? 0 : perRound * (rate / 100 / 12) * months;
      totalInterest += interest;
      rows.push({ round: EXEC_DATES[i].round, date: EXEC_DATES[i].date, months, interest, isSelf });
    }
    const loanCount = jdSelfPay.filter(v => !v).length;
    return { rows, totalInterest, perRound, loanCount };
  }, [jdPrice, jdRate, jdEnd, jdSelfPay]);

  // 주담대 한도 계산
  const mpLimit = useMemo(() => {
    const price = parseFloat(mpPrice);
    if (!price || price <= 0) return null;
    if (price > 20) return { limit: 2, note:'20억 초과 → 최대 2억', tier:'red'   };
    if (price > 15) return { limit: 4, note:'15억 초과 → 최대 4억', tier:'gold'  };
    return               { limit: 6, note:'15억 이하 → 최대 6억',  tier:'green' };
  }, [mpPrice]);

  // 주담대 월 납부 계산
  const mpCalc = useMemo(() => {
    const P = parseFloat(mpLoan) * 100_000_000;
    if (!P || P <= 0) return null;
    const r = parseFloat(mpRate) / 100 / 12;
    if (!r || r <= 0) return null;
    const n = mpTerm * 12;
    if (mpType === 'equal') {
      const M = P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
      return { monthly: Math.round(M), monthlyLast: null, total: Math.round(M * n), interest: Math.round(M * n - P) };
    } else {
      const mp = P / n;
      const firstM = mp + P * r;
      const lastM  = mp + mp * r;
      const totalI = r * P * (n + 1) / 2;
      return { monthly: Math.round(firstM), monthlyLast: Math.round(lastM), total: Math.round(P + totalI), interest: Math.round(totalI) };
    }
  }, [mpLoan, mpRate, mpTerm, mpType]);

  // 내 동의 방문일 찾기
  const myDong = user?.dong ? String(user.dong) : null;
  const myLoanDay = myDong ? LOAN_SCHEDULE.find(s => s.dongs.includes(myDong)) : null;

  // 접수 기간 내인지 여부 (6/16~19)
  const today = new Date();
  const loanStart = new Date('2026-06-16');
  const loanEnd   = new Date('2026-06-19T23:59:59');
  const isLoanPeriod = today >= loanStart && today <= loanEnd;
  const isLoanUpcoming = today < loanStart;
  const daysToLoan = Math.ceil((loanStart - today) / 86400000);

  return (
    <div style={wrap}>
      <div style={sectionTitle}>납부 안내</div>
      <div style={sectionSub}>중도금 납부 일정 및 대출 안내</div>
      <div style={goldLine} />

      {/* ── 서브 탭 ── */}
      <div style={{ display:'flex', gap:5, marginBottom:16 }}>
        {[['timeline','📋 납부현황'],['loan','🏦 대출안내'],['calc','🧮 계산기']].map(([key,label]) => (
          <button key={key} style={{
            flex:1, padding:'9px 2px', borderRadius:10, fontSize:11, fontWeight:600,
            background: subTab === key ? 'var(--navy)' : '#FFFFFF',
            color: subTab === key ? '#FFFFFF' : 'var(--text)',
            border: subTab === key ? 'none' : '1px solid var(--border)',
          }} onClick={() => setSubTab(key)}>{label}</button>
        ))}
      </div>

      {/* ── 중도금 대출 탭 ── */}
      {subTab === 'loan' && (
        <div>
          {/* 긴급 배너 */}
          {(isLoanPeriod || isLoanUpcoming) && (
            <div style={{
              background: isLoanPeriod
                ? 'linear-gradient(135deg,rgba(26,144,104,0.08),rgba(26,144,104,0.04))'
                : 'linear-gradient(135deg,rgba(200,168,64,0.1),rgba(200,168,64,0.04))',
              border: `1px solid ${isLoanPeriod ? 'rgba(26,144,104,0.3)' : 'rgba(200,168,64,0.4)'}`,
              borderRadius:14, padding:'14px 16px', marginBottom:14,
            }}>
              <div style={{ fontSize:13, fontWeight:700, color: isLoanPeriod ? 'var(--green)' : 'var(--gold)', marginBottom:4 }}>
                {isLoanPeriod ? '🔴 현재 접수 중!' : `⏰ 접수 시작 D-${daysToLoan}`}
              </div>
              <div style={{ fontSize:11, color:'var(--text)', lineHeight:1.7 }}>
                1차 중도금 대출 서류 접수<br/>
                <strong>2026.06.16(화) ~ 06.19(금)</strong> · 하나은행 방화동지점
              </div>
              {myLoanDay && (
                <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(11,40,73,0.06)', borderRadius:8, fontSize:11, color:'var(--navy)', fontWeight:600 }}>
                  📌 {myDong}동 방문일: <span style={{ color:'var(--gold)' }}>{myLoanDay.date}</span>
                </div>
              )}
            </div>
          )}

          {/* 동별 방문 일정 */}
          <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', background:'rgba(11,40,73,0.02)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)' }}>📅 동별 방문 일정</div>
              <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>하나은행 방화동지점 · 오전 9시~오후 5시</div>
            </div>
            {LOAN_SCHEDULE.map((s, i) => {
              const isMyDay = myDong && s.dongs.includes(myDong);
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', padding:'11px 14px',
                  borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
                  background: isMyDay ? 'rgba(200,168,64,0.06)' : 'transparent',
                }}>
                  <div style={{ width:90, fontSize:12, fontWeight: isMyDay ? 700 : 500, color: isMyDay ? 'var(--gold)' : 'var(--text)' }}>
                    {s.date}
                  </div>
                  <div style={{ flex:1, display:'flex', gap:4, flexWrap:'wrap' }}>
                    {s.dongs.map(d => (
                      <span key={d} style={{
                        padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600,
                        background: d === myDong ? 'var(--gold)' : 'rgba(11,40,73,0.06)',
                        color: d === myDong ? 'var(--navy)' : 'var(--text)',
                      }}>{d}동</span>
                    ))}
                  </div>
                  {isMyDay && <span style={{ fontSize:10, color:'var(--gold)', fontWeight:700 }}>← 내 방문일</span>}
                </div>
              );
            })}
          </div>

          {/* 접수 안내 */}
          <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'14px', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:10 }}>📌 접수 안내</div>
            {[
              ['접수 장소','하나은행 방화동지점\n서울시 강서구 양천로 108'],
              ['접수 시간','오전 9:00 ~ 오후 5:00\n(점심 12:00~13:00 서류접수 불가)'],
              ['대상','1회차부터 신청하는 세대'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', gap:10, marginBottom:8, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--gold)', fontWeight:600, width:56, flexShrink:0 }}>{k}</div>
                <div style={{ fontSize:11, color:'var(--text)', lineHeight:1.7, whiteSpace:'pre-line' }}>{v}</div>
              </div>
            ))}
            <div style={{ fontSize:11, color:'var(--text)', lineHeight:1.7, marginTop:4, paddingTop:4, borderBottom:'1px solid var(--border)', marginBottom:8, paddingBottom:8 }}>
              <span style={{ color:'var(--gold)', fontWeight:600 }}>2회차 이후 신청</span>는 회차별 실행일 <strong>1개월 전</strong>에 방화동지점 개별 방문
            </div>
            <div style={{ fontSize:10, color:'var(--gray)', lineHeight:1.7, background:'rgba(11,40,73,0.03)', borderRadius:8, padding:'8px 10px' }}>
              ※ 중도금 집단대출은 HUG(주택도시보증공사) 보증 기반 하나은행 취급<br/>
              ※ 자세한 서류 목록은 단지 공지 또는 방화동지점 문의 (☎ 02-2665-8900)
            </div>
          </div>

          {/* 대출 조건 카드 */}
          <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'14px', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:10 }}>💰 대출 조건</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              {[
                ['대출 금리','연 3.74%\n(COFIX 6개월 변동)'],
                ['대출 한도','분양가의 최대 40%\n(보증기관 한도 내)'],
                ['보증 기관','HUG\n(주택도시보증공사)'],
                ['이자 납입','후불제\n(실행일부터 이자 발생)'],
                ['대출 만기','2028년 10월 31일\n(HUG 보증서 만기일 이내)'],
              ].map(([k,v]) => (
                <div key={k} style={{ background:'rgba(11,40,73,0.03)', borderRadius:10, padding:'10px 12px' }}>
                  <div style={{ fontSize:9, color:'var(--gold)', fontWeight:700, letterSpacing:0.5, marginBottom:4 }}>{k}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--navy)', lineHeight:1.5, whiteSpace:'pre-line' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:'var(--gray)', lineHeight:1.6, background:'rgba(200,168,64,0.04)', border:'1px solid rgba(200,168,64,0.15)', borderRadius:8, padding:'8px 10px' }}>
              ※ 기준금리(COFIX 6개월): 2.89% + 가산금리 0.85% = 연 3.74% (2026.06.02 현재)<br/>
              ※ 회차 대출 실행일 현재 COFIX에 따라 최종 금리 확정, 6개월마다 변동<br/>
              ※ 대출 실행 후 은행이 조합 계좌로 직접 송금 처리
            </div>
          </div>

          {/* 회차별 실행 일정 */}
          <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', background:'rgba(11,40,73,0.02)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)' }}>📆 회차별 실행 일정</div>
            </div>
            {[
              ['1회차','2026.07.15','다음 실행'],
              ['2회차','2026.11.16',''],
              ['3회차','2027.03.15',''],
              ['4회차','2027.07.15',''],
              ['5회차','2027.11.15',''],
              ['6회차','2028.03.15','마지막'],
            ].map(([round, date, badge], i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', padding:'9px 14px', borderBottom: i < 5 ? '1px solid var(--border)' : 'none', background: i === 0 ? 'rgba(200,168,64,0.04)' : 'transparent' }}>
                <span style={{ width:44, fontSize:11, fontWeight:700, color: i===0 ? 'var(--gold)' : 'var(--text)' }}>{round}</span>
                <span style={{ flex:1, fontSize:11, color:'var(--gray)' }}>{date}</span>
                {badge && <span style={{ fontSize:9, padding:'2px 7px', borderRadius:5, background: i===0 ? 'rgba(200,168,64,0.15)' : 'rgba(11,40,73,0.06)', color: i===0 ? 'var(--gold)' : 'var(--gray)', fontWeight:600 }}>{badge}</span>}
              </div>
            ))}
          </div>

          {/* 준비 서류 */}
          <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'14px', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:10 }}>📄 준비 서류 (방문 시 지참)</div>
            {[
              ['필수','분양계약서 원본 (확인 후 반납)'],
              ['필수','신분증 원본 (주민등록증 또는 운전면허증)'],
              ['필수','주민등록등본 1부 (주민등록번호·가족관계 표시)'],
              ['필수','전 세대원 주민등록초본 1부 (현재 주소 포함, 미성년자 포함)'],
              ['필수','가족관계증명서(상세) 1부'],
              ['필수','건강보험자격득실확인서(전체이력) 1통'],
              ['직장인','재직증명서 + 최근 2개년 근로소득원천징수영수증'],
              ['자영업','사업자등록증 사본 + 소득금액증명원'],
            ].map(([tag, text], i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:7 }}>
                <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background: tag==='필수' ? 'rgba(217,69,69,0.1)' : 'rgba(11,40,73,0.06)', color: tag==='필수' ? 'var(--red)' : 'var(--navy)', fontWeight:700, flexShrink:0, marginTop:1 }}>{tag}</span>
                <span style={{ fontSize:11, color:'var(--text)', lineHeight:1.6 }}>{text}</span>
              </div>
            ))}
            <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(200,168,64,0.06)', border:'1px solid rgba(200,168,64,0.2)', borderRadius:8, fontSize:10, color:'var(--text)', lineHeight:1.7 }}>
              <span style={{ fontWeight:700, color:'var(--gold)' }}>⚠️ 6월 15일(월)까지 사전 준비 필수</span><br/>
              · 하나은행 입출금 계좌 개설 (인지세·보증료 납부용)<br/>
              · 하나원큐(모바일뱅킹) 가입 — 대출 신청은 모바일뱅킹으로 진행<br/>
              · 공동명의의 경우 두 명 모두 직접 방문하여 서류 작성 (대리인 불가)
            </div>
            <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(11,40,73,0.03)', borderRadius:8, fontSize:10, color:'var(--gray)', lineHeight:1.6 }}>
              ※ 공동명의인 경우 두 명 모두 서류 지참 필요<br/>
              ※ 차주 유형(다자녀·신혼부부·장애인 등)에 따라 추가 서류 있을 수 있으므로 방화동지점 사전 문의 권장<br/>
              ※ 모든 서류는 1개월 이내 발급본 (주민등록초본·가족관계증명서 포함)
            </div>
          </div>

          {/* ⚠️ 임대차 계약 제한 안내 */}
          <div style={{ background:'rgba(217,69,69,0.04)', border:'1.5px solid rgba(217,69,69,0.25)', borderRadius:14, padding:'14px', marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--red)', marginBottom:8 }}>⚠️ 임대차 계약 제한 안내</div>
            <div style={{ fontSize:11, color:'var(--text)', lineHeight:1.8, marginBottom:10 }}>
              중도금 대출을 이용하는 경우, <strong>준공 후 소유권 이전등기 및 대출은행의 1순위 근저당 설정이 완료될 때까지</strong> 해당 부동산에 임대차 계약(전세·월세)을 체결할 수 없습니다.
            </div>
            <div style={{ background:'rgba(217,69,69,0.06)', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, color:'var(--red)', fontWeight:600, marginBottom:6 }}>📌 핵심 포인트</div>
              {[
                '대출 이용 시 입주 후 즉시 전세/월세 불가',
                '소유권 이전등기 + 근저당 설정 완료 이후에만 가능',
                '대출 미이용 시 이 제한 없음',
                '위반 시 분양계약 해제 사유가 될 수 있으므로 주의',
              ].map((t, i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom: i < 3 ? 5 : 0, fontSize:11, color:'var(--text)', lineHeight:1.5 }}>
                  <span style={{ color:'var(--red)', flexShrink:0 }}>•</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 하나은행 연락처 */}
          <div style={{ background:'linear-gradient(135deg,rgba(11,40,73,0.05),rgba(11,40,73,0.02))', border:'1px solid rgba(11,40,73,0.12)', borderRadius:14, padding:'14px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:10 }}>🏦 하나은행 방화동지점</div>
            <div style={{ fontSize:11, color:'var(--text)', lineHeight:1.8 }}>
              📍 서울시 강서구 양천로 108<br/>
              📞 <a href="tel:02-2663-1111" style={{ color:'var(--navy)', fontWeight:700, textDecoration:'none' }}>02-2663-1111</a>&nbsp;
              <span style={{ color:'var(--gray)', fontSize:10 }}>FAX 02-2665-6327</span><br/>
              🕐 평일 오전 9시 ~ 오후 5시<br/>
              <span style={{ color:'var(--gray)', fontSize:10 }}>차장 송영진 (내선 304) · 대리 김다희 (내선 301, 307)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 🧮 계산기 탭 ── */}
      {subTab === 'calc' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* ─ 중도금 이자 시뮬레이터 ─ */}
          <div style={calcBox}>
            <div style={calcBoxTitle}>🏦 중도금 이자 시뮬레이터</div>
            <div style={calcBoxSub}>회차 실행 후 주담대 전환까지 발생하는 이자 총액</div>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
              <div style={calcRow}>
                <label style={calcLbl}>분양가 (억원)</label>
                <input type="number" inputMode="decimal" placeholder="예: 9.50" style={calcInp}
                  value={jdPrice} onChange={e => setJdPrice(e.target.value)} />
              </div>
              <div style={calcRow}>
                <label style={calcLbl}>중도금 금리 (%)</label>
                <input type="number" inputMode="decimal" step="0.01" style={calcInp}
                  value={jdRate} onChange={e => setJdRate(e.target.value)} />
              </div>
              <div style={calcRow}>
                <label style={calcLbl}>주담대 전환 예정</label>
                <input type="month" style={{ ...calcInp, width:130 }}
                  value={jdEnd} onChange={e => setJdEnd(e.target.value)} />
              </div>
              {!jdPrice && (
                <div style={{ fontSize:10, color:'var(--gray)', textAlign:'center', padding:'6px 0' }}>
                  💡 위 <strong>납부현황</strong> 탭에서 동호수 조회하면 분양가가 자동 입력됩니다
                </div>
              )}
            </div>

            {jdCalc && (<>
              {/* 자납 카운터 */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, marginBottom:8 }}>
                <span style={{ fontSize:11, color:'var(--text)', fontWeight:600 }}>회차별 납부방식 선택</span>
                <span style={{ fontSize:10, color:'var(--gray)' }}>
                  자납 <strong style={{ color:'var(--navy)' }}>{jdSelfPay.filter(Boolean).length}</strong>회 /
                  대출 <strong style={{ color:'var(--gold)' }}>{jdSelfPay.filter(v => !v).length}</strong>회
                  {jdSelfPay.filter(Boolean).length !== 2 && (
                    <span style={{ color:'var(--red)', marginLeft:6 }}>⚠ 1·2회차 자납 권장 (대출 한도 40%)</span>
                  )}
                </span>
              </div>
              <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'rgba(11,40,73,0.05)' }}>
                      {['회차','실행일','납부방식','대출금액','~전환까지','이자합계'].map(h => (
                        <th key={h} style={{ padding:'7px 5px', textAlign:'center', fontWeight:700, color:'var(--navy)', fontSize:10, borderBottom:'1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jdCalc.rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < 5 ? '1px solid var(--border)' : 'none', background: r.isSelf ? 'rgba(26,144,104,0.04)' : (i % 2 === 0 ? '#FFF' : 'rgba(11,40,73,0.015)') }}>
                        <td style={{ padding:'7px 5px', textAlign:'center', fontWeight:700, color:'var(--navy)', fontSize:11 }}>{r.round}</td>
                        <td style={{ padding:'7px 5px', textAlign:'center', color:'var(--gray)', fontSize:10 }}>{r.date.slice(2)}</td>
                        {/* 자납/대출 토글 */}
                        <td style={{ padding:'5px 4px', textAlign:'center' }}>
                          <button onClick={() => setJdSelfPay(prev => { const n=[...prev]; n[i]=!n[i]; return n; })}
                            style={{ fontSize:9, padding:'3px 7px', borderRadius:5, border:'none', cursor:'pointer', fontWeight:700,
                              background: r.isSelf ? 'rgba(26,144,104,0.15)' : 'rgba(200,168,64,0.15)',
                              color: r.isSelf ? 'var(--green)' : 'var(--gold)' }}>
                            {r.isSelf ? '자납' : '대출'}
                          </button>
                        </td>
                        <td style={{ padding:'7px 5px', textAlign:'center', fontWeight:600, color: r.isSelf ? 'var(--gray)' : 'var(--text)', fontSize:11 }}>
                          {r.isSelf ? '-' : `${(jdCalc.perRound / 100_000_000).toFixed(2)}억`}
                        </td>
                        <td style={{ padding:'7px 5px', textAlign:'center', color: r.isSelf ? 'var(--gray)' : 'var(--navy)', fontSize:10, fontWeight: r.isSelf ? 400 : 600 }}>
                          {r.isSelf ? '-' : `${r.months.toFixed(1)}개월`}
                        </td>
                        <td style={{ padding:'7px 5px', textAlign:'center', fontWeight:700, fontSize:11,
                          color: r.isSelf ? 'var(--green)' : 'var(--gold)' }}>
                          {r.isSelf ? '자납' : `${Math.round(r.interest / 10000).toLocaleString()}만`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop:10, padding:'13px 14px', background:'linear-gradient(135deg,rgba(200,168,64,0.08),rgba(200,168,64,0.04))', border:'1px solid rgba(200,168,64,0.3)', borderRadius:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--gold)', fontWeight:600, marginBottom:2 }}>📌 입주 시 일시납 예상액 (후불제)</div>
                    <div style={{ fontSize:10, color:'var(--gray)' }}>{jdEnd} 주담대 전환 시점 기준</div>
                  </div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, color:'var(--gold)' }}>
                    {Math.round(jdCalc.totalInterest / 10000).toLocaleString()}만원
                  </div>
                </div>
                <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(200,168,64,0.2)', fontSize:10, color:'var(--text)', lineHeight:1.7 }}>
                  💡 후불제란? 매달 이자를 내지 않고, 이자가 쌓이다가 <strong>주담대 전환 시 한 번에 정산</strong>하는 방식입니다.<br/>
                  이 금액을 잔금 or 주담대로 처리하면 됩니다.
                </div>
              </div>
              <div style={{ fontSize:10, color:'var(--gray)', marginTop:8, lineHeight:1.6, textAlign:'center' }}>
                ※ COFIX 6개월 변동금리로 실제 이자는 달라질 수 있습니다 (6개월마다 조정)<br/>
              ※ 주담대 전환 입력은 해당 월의 15일 기준으로 계산됩니다
              </div>
            </>)}
          </div>

          {/* ─ 주담대 계산기 ─ */}
          <div style={calcBox}>
            <div style={calcBoxTitle}>🏠 주담대 시뮬레이터</div>
            <div style={calcBoxSub}>입주 후 주택담보대출 월 납부액 계산</div>

            {/* 규제 한도 참고 카드 */}
            <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(11,40,73,0.03)', border:'1px solid var(--border)', borderRadius:10, fontSize:10, color:'var(--text)', lineHeight:1.8 }}>
              <span style={{ fontWeight:700, color:'var(--navy)' }}>📌 대출 한도 기준 (서울 투기과열지구)</span><br/>
              <span style={{ color:'var(--green)', fontWeight:600 }}>● 15억 이하</span>: 최대 6억<br/>
              <span style={{ color:'var(--gold)', fontWeight:600 }}>● 15억 초과 ~ 20억</span>: 최대 4억<br/>
              <span style={{ color:'var(--red)', fontWeight:600 }}>● 20억 초과</span>: 최대 2억<br/>
              <span style={{ color:'var(--gray)' }}>※ DSR·소득 요건 별도. 은행별 상이, 실행 전 반드시 확인</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
              {/* 주택가격 */}
              <div style={calcRow}>
                <label style={calcLbl}>주택가격 (억원)</label>
                <input type="number" inputMode="decimal" placeholder="예: 12.50" style={calcInp}
                  value={mpPrice} onChange={e => { setMpPrice(e.target.value); setMpLoan(''); }} />
              </div>

              {/* 한도 뱃지 */}
              {mpLimit && (() => {
                const colors = { green:['rgba(26,144,104,0.07)','rgba(26,144,104,0.3)','var(--green)'], gold:['rgba(200,168,64,0.08)','rgba(200,168,64,0.35)','var(--gold)'], red:['rgba(217,69,69,0.07)','rgba(217,69,69,0.3)','var(--red)'] };
                const [bg, border, fc] = colors[mpLimit.tier];
                return (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:bg, border:`1px solid ${border}`, borderRadius:10 }}>
                    <span style={{ fontSize:11, color:'var(--text)' }}>{mpLimit.note}</span>
                    <span style={{ fontSize:18, fontWeight:800, color:fc }}>최대 {mpLimit.limit <= 10 ? `${mpLimit.limit}억` : `${mpLimit.limit.toFixed(2)}억`}</span>
                  </div>
                );
              })()}

              {/* 대출금액 */}
              <div style={calcRow}>
                <label style={calcLbl}>대출금액 (억원)</label>
                <input type="number" inputMode="decimal" step="0.1"
                  placeholder={mpLimit ? `최대 ${mpLimit.limit <= 10 ? mpLimit.limit : mpLimit.limit.toFixed(2)}억` : '억원'}
                  style={calcInp} value={mpLoan} onChange={e => setMpLoan(e.target.value)} />
              </div>

              {/* 금리 */}
              <div style={calcRow}>
                <label style={calcLbl}>대출 금리 (%)</label>
                <input type="number" inputMode="decimal" step="0.1" style={calcInp}
                  value={mpRate} onChange={e => setMpRate(e.target.value)} />
              </div>

              {/* 기간 */}
              <div>
                <div style={{ ...calcLbl, marginBottom:8 }}>대출 기간</div>
                <div style={{ display:'flex', gap:4 }}>
                  {[20,25,30,35,40].map(y => (
                    <button key={y} onClick={() => setMpTerm(y)} style={{ flex:1, padding:'8px 2px', borderRadius:8,
                      border:`1.5px solid ${mpTerm===y ? 'var(--navy)' : 'var(--border)'}`,
                      background: mpTerm===y ? 'var(--navy)' : '#FFF',
                      color: mpTerm===y ? '#FFF' : 'var(--text)', fontSize:11, fontWeight: mpTerm===y ? 700 : 400 }}>
                      {y}년
                    </button>
                  ))}
                </div>
              </div>

              {/* 상환방식 */}
              <div>
                <div style={{ ...calcLbl, marginBottom:8 }}>상환방식</div>
                <div style={{ display:'flex', gap:6 }}>
                  {[['equal','원리금균등'],['principal','원금균등']].map(([k,v]) => (
                    <button key={k} onClick={() => setMpType(k)} style={{ flex:1, padding:'9px 4px', borderRadius:8,
                      border:`1.5px solid ${mpType===k ? 'var(--navy)' : 'var(--border)'}`,
                      background: mpType===k ? 'var(--navy)' : '#FFF',
                      color: mpType===k ? '#FFF' : 'var(--text)', fontSize:11, fontWeight: mpType===k ? 700 : 400 }}>
                      {v}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'var(--gray)', marginTop:5, lineHeight:1.5 }}>
                  {mpType==='equal' ? '매달 동일 금액 납부 — 이자 부담 높지만 초기 부담 낮음' : '매달 원금 고정 + 이자 감소 — 초기 부담 높지만 총 이자 절감'}
                </div>
              </div>
            </div>

            {/* 결과 카드 */}
            {mpCalc && (
              <div style={{ marginTop:14, borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                <div style={{ padding:'16px', background:'var(--navy)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', letterSpacing:1.5, marginBottom:4 }}>
                    {mpType==='equal' ? '월 납부액 (균등)' : '첫 달 납부액 (이후 감소)'}
                  </div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:40, fontWeight:300, color:'#FFF', lineHeight:1.1 }}>
                    {Math.round(mpCalc.monthly / 10000).toLocaleString()}
                    <span style={{ fontSize:18, marginLeft:4, fontWeight:400 }}>만원</span>
                  </div>
                  {mpCalc.monthlyLast && (
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:4 }}>
                      → 마지막 달 {Math.round(mpCalc.monthlyLast / 10000).toLocaleString()}만원
                    </div>
                  )}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', background:'#FFF' }}>
                  <div style={{ padding:'14px', borderRight:'1px solid var(--border)', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'var(--gray)', marginBottom:4 }}>총 납부액</div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--navy)' }}>
                      {(mpCalc.total / 100_000_000).toFixed(2)}억
                    </div>
                    <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>
                      원금 {parseFloat(mpLoan).toFixed(2)}억 포함
                    </div>
                  </div>
                  <div style={{ padding:'14px', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'var(--gray)', marginBottom:4 }}>총 이자</div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--red)' }}>
                      {Math.round(mpCalc.interest / 10000).toLocaleString()}만원
                    </div>
                    <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>
                      원금의 {Math.round(mpCalc.interest / (parseFloat(mpLoan) * 100_000_000) * 100)}%
                    </div>
                  </div>
                </div>
                <div style={{ padding:'10px 14px', background:'rgba(11,40,73,0.02)', borderTop:'1px solid var(--border)', fontSize:10, color:'var(--gray)', textAlign:'center' }}>
                  {parseFloat(mpLoan).toFixed(2)}억 × {mpRate}% × {mpTerm}년 ({mpType==='equal' ? '원리금균등' : '원금균등'})
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 납부현황 탭 (기존 내용) ── */}
      {subTab === 'timeline' && (<>

      {/* 입력 폼 */}
      <div style={formRow}>
        <select style={sel} value={dong} onChange={e => setDong(e.target.value)}>
          <option value="">동 선택</option>
          {['101','102','103','104','105','106','107','108','109','110'].map(d => (
            <option key={d} value={d}>{d}동</option>
          ))}
        </select>
        <input style={inp} placeholder="호수 (예: 0802)" value={ho} onChange={e => setHo(e.target.value)} type="text" inputMode="numeric" />
        <button style={calcBtn} onClick={calc}>조회</button>
      </div>
      {err && <div style={{ fontSize:11, color:'var(--red)', marginBottom:12 }}>{err}</div>}

      {/* 납부 타임라인 결과 카드 */}
      {result && (
        <div style={resultCard}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', borderRadius:'20px 20px 0 0' }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
            {[
              ['세대', `${result.dong}동 ${result.ho}호`],
              ['타입', result.type + ' 타입'],
              ['층수', result.floor + '층'],
              ['전용면적', `${result.area}㎡`],
            ].map(([k, v]) => (
              <div key={k} style={infoItem}>
                <div style={{ fontSize:9, color:'var(--gold)', letterSpacing:1.5 }}>{k}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginTop:3 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center', marginBottom:16, padding:'16px 0', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2 }}>분양가</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:48, fontWeight:300, color:'var(--navy)', lineHeight:1.2 }}>
              {(result.price / 100000000).toFixed(2)}
            </div>
            <div style={{ fontSize:14, color:'var(--gold)' }}>억원</div>
          </div>
          <div>
            {PAYMENT_DATES.map((p, i) => {
              const amt = Math.round(result.price * p.ratio);
              const status = i === 0 ? 'done' : getStatus(p.date);
              const amtStr = (amt / 100000000).toFixed(2) + '억';
              const checked = paidChecks[i] || false;
              return (
                <div key={p.key} style={{ display:'flex', gap:14, marginBottom:0 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:20 }}>
                    <div style={{
                      width:12, height:12, borderRadius:'50%', flexShrink:0,
                      background: checked ? 'var(--green)' : status === 'next' ? 'var(--gold)' : 'var(--border)',
                      border: status === 'next' && !checked ? '2px solid var(--gold)' : 'none',
                      boxShadow: status === 'next' && !checked ? '0 0 8px rgba(200,168,64,0.5)' : 'none',
                      marginTop:4,
                    }} />
                    {i < PAYMENT_DATES.length - 1 && (
                      <div style={{ width:2, flex:1, background:'var(--border)', minHeight:20 }} />
                    )}
                  </div>
                  <div style={{ paddingBottom:12, flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color: checked ? 'var(--gray)' : 'var(--text)' }}>{p.step}</div>
                        <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>{p.date}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:14, fontWeight:600,
                            color: checked ? 'var(--green)' : status === 'next' ? 'var(--gold)' : 'var(--text)',
                            textDecoration: checked ? 'line-through' : 'none' }}>
                            {amtStr}
                          </div>
                          <div style={{ fontSize:9, marginTop:2, padding:'2px 6px', borderRadius:4, display:'inline-block',
                            background: checked ? 'rgba(26,144,104,0.1)' : status === 'next' ? 'rgba(200,168,64,0.12)' : 'rgba(122,143,160,0.08)',
                            color: checked ? 'var(--green)' : status === 'next' ? 'var(--gold)' : 'var(--gray)',
                          }}>
                            {checked ? '✓ 납부완료' : status === 'next' ? '다음 납부' : '예정'}
                          </div>
                        </div>
                        {/* 체크박스 */}
                        <div
                          onClick={() => toggleCheck(i)}
                          style={{
                            width:22, height:22, borderRadius:6, flexShrink:0,
                            background: checked ? 'var(--green)' : '#FFFFFF',
                            border: checked ? '2px solid var(--green)' : '2px solid var(--border)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            cursor:'pointer', transition:'all 0.15s',
                          }}>
                          {checked && <span style={{ fontSize:12, color:'#FFF', fontWeight:700 }}>✓</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 납부 현황 요약 ── */}
          {(() => {
            const paidAmt  = PAYMENT_DATES.reduce((s, p, i) => s + (paidChecks[i] ? Math.round(result.price * p.ratio) : 0), 0);
            const remaining = result.price - paidAmt;
            const paidCnt  = paidChecks.filter(Boolean).length;
            const totalCnt = PAYMENT_DATES.length;
            const pct      = Math.round((paidAmt / result.price) * 100);
            return (
              <div style={{ marginTop:16, background:'rgba(11,40,73,0.03)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px' }}>
                <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:1.5, fontWeight:600, marginBottom:10 }}>💰 납부 현황 요약</div>
                {/* 진행 바 */}
                <div style={{ background:'var(--border)', borderRadius:4, height:8, marginBottom:12, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:'var(--green)', borderRadius:4, transition:'width 0.3s' }} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div style={{ background:'rgba(26,144,104,0.07)', border:'1px solid rgba(26,144,104,0.2)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:9, color:'var(--green)', fontWeight:600, marginBottom:4 }}>납부 완료 ({paidCnt}/{totalCnt}단계)</div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:'var(--green)' }}>
                      {(paidAmt / 100000000).toFixed(2)}억
                    </div>
                    <div style={{ fontSize:9, color:'var(--green)', opacity:0.8 }}>{pct}% 납부</div>
                  </div>
                  <div style={{ background:'rgba(217,69,69,0.05)', border:'1px solid rgba(217,69,69,0.2)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:9, color:'var(--red)', fontWeight:600, marginBottom:4 }}>잔여 납부액 ({totalCnt - paidCnt}단계)</div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:'var(--red)' }}>
                      {(remaining / 100000000).toFixed(2)}억
                    </div>
                    <div style={{ fontSize:9, color:'var(--red)', opacity:0.8 }}>{100 - pct}% 미납</div>
                  </div>
                </div>
                {user?.username && (
                  <div style={{ fontSize:10, color:'var(--gray)', textAlign:'center', marginTop:8 }}>
                    체크 내용이 자동 저장됩니다
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── 취득세 계산기 ── */}
      <div style={{ marginTop: result ? 20 : 8 }}>
        <div style={taxHeader}>
          <div>
            <div style={{ fontFamily:"'Noto Serif KR',serif", fontSize:16, fontWeight:600, color:'var(--text)', marginBottom:2 }}>취득세 계산기</div>
            <div style={{ fontSize:11, color:'var(--gray)' }}>잔금 납부(입주) 시 부담 세금 미리 확인</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            <div style={{ fontSize:22 }}>🧮</div>
            {user?.username && saveStatus && (
              <div style={{ fontSize:10, color: saveStatus === 'saved' ? 'var(--green)' : 'var(--gray)', display:'flex', alignItems:'center', gap:3, transition:'opacity 0.3s' }}>
                {saveStatus === 'saving' ? '⏳ 저장 중…' : '✓ 저장됨'}
              </div>
            )}
          </div>
        </div>

        <div style={taxCard}>
          {/* 분양가 표시 */}
          <div style={taxRow}>
            <div style={taxLabel}>분양가</div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>
              {result ? fmtWon(result.price) : <span style={{ color:'var(--gray)', fontSize:12 }}>동호수 조회 후 자동 입력</span>}
            </div>
          </div>

          {/* 발코니 확장 */}
          <div style={taxRow}>
            <div>
              <div style={taxLabel}>발코니 확장 포함</div>
              {result && <div style={{ fontSize:10, color:'var(--gold)' }}>{fmt(BALCONY_PRICES[result.type] || 0)}만원</div>}
            </div>
            <label style={toggle}>
              <input type="checkbox" checked={balcony} onChange={e => setBalcony(e.target.checked)} style={{ display:'none' }} />
              <div style={{ width:42, height:24, borderRadius:12, background: balcony ? 'var(--green)' : 'var(--border)', position:'relative', transition:'background 0.2s', cursor:'pointer' }}>
                <div style={{ position:'absolute', top:3, left: balcony ? 21 : 3, width:18, height:18, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
            </label>
          </div>

          {/* 기타 옵션 */}
          <div style={taxRow}>
            <div style={taxLabel}>기타 옵션비</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input
                type="number" inputMode="numeric"
                style={taxInput} placeholder="0"
                value={extra} onChange={e => setExtra(e.target.value)}
              />
              <span style={{ fontSize:11, color:'var(--gray)' }}>만원</span>
            </div>
          </div>

          {/* 주택 보유 수 */}
          <div style={{ ...taxRow, flexDirection:'column', alignItems:'flex-start', gap:8 }}>
            <div style={taxLabel}>현재 주택 보유 수</div>
            <div style={{ display:'flex', gap:6, width:'100%' }}>
              {[['무주택', 0], ['1주택', 1], ['2주택 이상', 2]].map(([label, val]) => (
                <button key={val} style={{ flex:1, padding:'8px 4px', borderRadius:8, border:`1.5px solid ${houseCount === val ? 'var(--navy)' : 'var(--border)'}`, background: houseCount === val ? 'var(--navy)' : '#FFFFFF', color: houseCount === val ? '#FFFFFF' : 'var(--text)', fontSize:11, fontWeight: houseCount === val ? 700 : 400 }}
                  onClick={() => setHouseCount(val)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 로그인 시 자동저장 안내 */}
          {!user?.username && (
            <div style={{ padding:'8px 12px', background:'rgba(200,168,64,0.06)', border:'1px solid rgba(200,168,64,0.2)', borderRadius:10, marginBottom:8, fontSize:10, color:'var(--gold)' }}>
              💡 로그인하면 발코니·옵션비·주택 수 설정이 자동 저장됩니다
            </div>
          )}

          {/* 투기과열지구 고정 안내 */}
          <div style={{ padding:'10px 12px', background:'rgba(11,40,73,0.04)', border:'1px solid rgba(11,40,73,0.12)', borderRadius:10, marginBottom:2 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--navy)' }}>🏙️ 투기과열지구 자동 적용</div>
            <div style={{ fontSize:10, color:'var(--gray)', marginTop:3 }}>서울 전역은 투기과열지구로 지정되어 조정대상지역 세율이 항상 적용됩니다</div>
          </div>
        </div>

        {/* 계산 결과 */}
        {tax && (
          <div style={taxResultCard}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', borderRadius:'14px 14px 0 0' }} />

            <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, fontWeight:600, marginBottom:12 }}>취득세 계산 결과</div>

            {/* 과세표준 */}
            <div style={taxResultRow}>
              <span style={{ fontSize:12, color:'var(--text-2)' }}>과세표준</span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{fmtWon(tax.taxBase)}</span>
            </div>
            {tax.balconyAmt > 0 && (
              <div style={{ fontSize:10, color:'var(--gray)', textAlign:'right', marginTop:-6, marginBottom:6 }}>
                분양가 + 발코니 {fmt(tax.balconyAmt)}만원{extra ? ` + 옵션 ${extra}만원` : ''}
              </div>
            )}

            <div style={{ height:1, background:'var(--border)', margin:'10px 0' }} />

            {/* 세금 항목 */}
            {[
              ['취득세', tax.acq, `${(tax.taxRate * 100).toFixed(1)}%`],
              ['지방교육세', tax.edu, '취득세 × 10%'],
              ...(tax.rural > 0 ? [['농어촌특별세', tax.rural, '0.2% (85㎡ 초과)']] : []),
            ].map(([label, amt, note]) => (
              <div key={label} style={taxResultRow}>
                <div>
                  <span style={{ fontSize:12, color:'var(--text)' }}>{label}</span>
                  <span style={{ fontSize:10, color:'var(--gray)', marginLeft:6 }}>{note}</span>
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{fmt(amt)}만원</span>
              </div>
            ))}

            <div style={{ height:1, background:'var(--border)', margin:'10px 0' }} />

            {/* 합계 */}
            <div style={{ ...taxResultRow, background:'rgba(200,168,64,0.06)', borderRadius:10, padding:'12px 14px', margin:'0 -14px' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>총 취득세 합계</span>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, color:'var(--navy)' }}>
                {fmt(tax.total)}만원
              </span>
            </div>

            {houseCount >= 2 && isAdj && (
              <div style={{ marginTop:10, padding:'8px 10px', background:'rgba(217,69,69,0.06)', border:'1px solid rgba(217,69,69,0.2)', borderRadius:8, fontSize:10, color:'var(--red)', lineHeight:1.6 }}>
                ⚠️ {houseCount === 2 ? '2주택자' : '3주택자 이상'} 조정대상지역 중과 적용 ({(tax.taxRate * 100).toFixed(0)}%). 일시적 2주택 비과세 등 예외 조항은 세무사 확인 필요.
              </div>
            )}

            <div style={{ marginTop:10, fontSize:10, color:'var(--gray)', lineHeight:1.6, textAlign:'center' }}>
              ※ 본 계산은 참고용이며, 잔금 납부 시점의 법령·세율 기준으로 실제 세액이 달라질 수 있습니다.
            </div>
          </div>
        )}

        {!result && (
          <div style={{ textAlign:'center', padding:'24px 16px', color:'var(--gray)', fontSize:12, background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14 }}>
            위에서 동호수 조회하면 분양가가 자동으로 입력됩니다
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

const wrap = { padding:'16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };
const formRow = { display:'flex', gap:8, marginBottom:12 };
const sel = { flex:1.2, background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:10, padding:'10px 8px', color:'var(--text)', fontSize:12 };
const inp = { flex:1.8, background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:10, padding:'10px 10px', color:'var(--text)', fontSize:12, outline:'none' };
const calcBtn = { flex:0.8, background:'var(--navy)', border:'none', borderRadius:10, color:'#FFFFFF', fontWeight:700, fontSize:13 };
const resultCard = {
  background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:20,
  padding:'22px 16px', position:'relative', overflow:'hidden', marginTop:8,
  boxShadow:'var(--shadow)',
};
const infoItem = { background:'var(--bg)', borderRadius:10, padding:'10px 12px', border:'1px solid var(--border)' };
const taxHeader = {
  display:'flex', justifyContent:'space-between', alignItems:'flex-start',
  marginBottom:12,
};
const taxCard = {
  background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14,
  padding:'14px', boxShadow:'var(--shadow-sm)',
};
const taxRow = {
  display:'flex', justifyContent:'space-between', alignItems:'center',
  padding:'10px 0', borderBottom:'1px solid var(--border)',
};
const taxLabel = { fontSize:12, fontWeight:600, color:'var(--text)' };
const taxInput = {
  width:80, background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, padding:'6px 8px', color:'var(--text)', fontSize:13,
  textAlign:'right', outline:'none',
};
const toggle = { cursor:'pointer', userSelect:'none' };
const taxResultCard = {
  background:'#FFFFFF', border:'1px solid var(--gold-dim)',
  borderRadius:14, padding:'16px 14px', marginTop:12,
  position:'relative', boxShadow:'var(--shadow-sm)',
};
const taxResultRow = {
  display:'flex', justifyContent:'space-between', alignItems:'center',
  marginBottom:8,
};

/* 계산기 탭 스타일 */
const calcBox   = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'16px', boxShadow:'var(--shadow-sm)' };
const calcBoxTitle = { fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:2 };
const calcBoxSub   = { fontSize:11, color:'var(--gray)' };
const calcRow   = { display:'flex', justifyContent:'space-between', alignItems:'center' };
const calcLbl   = { fontSize:12, fontWeight:600, color:'var(--text)', flexShrink:0 };
const calcInp   = { width:120, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', color:'var(--text)', fontSize:13, textAlign:'right', outline:'none' };
