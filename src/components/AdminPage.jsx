import { useState, useEffect } from 'react';
import { supabase, isSupabaseReady } from '../lib/supabase';

export default function AdminPage({ onBack }) {
  const [residents, setResidents] = useState([]);
  const [pending, setPending] = useState([]);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // id of row being acted on
  const [editingId, setEditingId] = useState(null);
  const [editDong, setEditDong] = useState('');
  const [editHo, setEditHo] = useState('');
  const [cronLoading, setCronLoading] = useState(false);
  const [cronResult, setCronResult] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    if (!isSupabaseReady) return;
    setLoading(true);
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('residents').select('*').order('created_at', { ascending: false }),
      supabase.from('posts').select('id, dong, ho, nickname, title, created_at').order('created_at', { ascending: false }),
    ]);
    if (r) {
      setPending(r.filter(x => !x.is_approved && !x.is_admin));
      setResidents(r.filter(x => x.is_approved && !x.is_admin));
    }
    if (p) setPosts(p);
    setLoading(false);
  }

  async function approveUser(id) {
    setActionLoading(id);
    await supabase.from('residents').update({ is_approved: true }).eq('id', id);
    setActionLoading(null);
    fetchAll();
  }

  async function rejectUser(id) {
    if (!window.confirm('이 가입 신청을 거절하고 삭제하시겠습니까?')) return;
    setActionLoading(id);
    const { error } = await supabase.from('residents').delete().eq('id', id);
    if (error) alert('삭제 실패: ' + error.message);
    setActionLoading(null);
    fetchAll();
  }

  async function deleteResident(id, nickname) {
    if (!window.confirm(`${nickname} 회원을 탈퇴 처리하시겠습니까?\n해당 회원의 모든 데이터가 삭제됩니다.`)) return;
    setActionLoading(id);
    const { error } = await supabase.from('residents').delete().eq('id', id);
    if (error) alert('삭제 실패: ' + error.message);
    setActionLoading(null);
    fetchAll();
  }

  async function saveUnitEdit(id) {
    if (!editDong.trim() || !editHo.trim()) return;
    setActionLoading(id);
    await supabase.from('residents').update({ dong: editDong.trim(), ho: editHo.trim() }).eq('id', id);
    setEditingId(null);
    setActionLoading(null);
    fetchAll();
  }

  function startEdit(r) {
    setEditingId(r.id);
    setEditDong(String(r.dong));
    setEditHo(String(r.ho));
  }

  async function runCron() {
    setCronLoading(true);
    setCronResult(null);
    try {
      const res = await fetch('/api/cron-realtrade');
      const json = await res.json();
      setCronResult(json);
    } catch (e) {
      setCronResult({ error: e.message });
    }
    setCronLoading(false);
  }

  async function checkSyncStatus() {
    setSyncLoading(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/daily-trades');
      const json = await res.json();
      // 최근 report_date, 총 건수, 오늘 건수
      const trades = json.trades || [];
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = trades.filter(t => t.report_date === today).length;
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().slice(0, 10);
      const weekCount = trades.filter(t => t.report_date >= weekStr).length;
      const dates = [...new Set(trades.map(t => t.report_date))].sort((a,b) => b.localeCompare(a));
      setSyncStatus({ total: trades.length, todayCount, weekCount, lastDate: dates[0] || '-', dateRange: dates.length > 0 ? `${dates[dates.length-1]} ~ ${dates[0]}` : '-' });
    } catch (e) {
      setSyncStatus({ error: e.message });
    }
    setSyncLoading(false);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  return (
    <div style={wrap}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button style={backBtn} onClick={onBack}>←</button>
        <div>
          <div style={sectionTitle}>관리자 페이지</div>
          <div style={sectionSub}>래미안 엘라비네 입주민 현황</div>
        </div>
      </div>
      <div style={goldLine} />

      {!isSupabaseReady && (
        <div style={alertBox}>Supabase 연결이 필요합니다.</div>
      )}

      {/* 통계 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
        <div style={statCard}>
          <div style={{ fontSize:24, fontFamily:"'Cormorant Garamond',serif", color:'var(--navy)', fontWeight:300 }}>{residents.length}</div>
          <div style={{ fontSize:9, color:'var(--gold)', fontWeight:600, letterSpacing:1 }}>승인 세대</div>
        </div>
        <div style={{ ...statCard, background: pending.length > 0 ? 'rgba(200,168,64,0.06)' : '#FFFFFF', border: pending.length > 0 ? '1px solid var(--gold-dim)' : '1px solid var(--border)' }}>
          <div style={{ fontSize:24, fontFamily:"'Cormorant Garamond',serif", color: pending.length > 0 ? 'var(--gold)' : 'var(--navy)', fontWeight:300 }}>{pending.length}</div>
          <div style={{ fontSize:9, color:'var(--gold)', fontWeight:600, letterSpacing:1 }}>대기 중</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize:24, fontFamily:"'Cormorant Garamond',serif", color:'var(--navy)', fontWeight:300 }}>{posts.length}</div>
          <div style={{ fontSize:9, color:'var(--gold)', fontWeight:600, letterSpacing:1 }}>게시글</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={tabRow}>
        <button style={{ ...tabBtn, ...(tab === 'pending' ? tabActive : {}) }} onClick={() => setTab('pending')}>
          승인 대기 {pending.length > 0 && <span style={badge}>{pending.length}</span>}
        </button>
        <button style={{ ...tabBtn, ...(tab === 'residents' ? tabActive : {}) }} onClick={() => setTab('residents')}>
          승인 회원 ({residents.length})
        </button>
        <button style={{ ...tabBtn, ...(tab === 'posts' ? tabActive : {}) }} onClick={() => setTab('posts')}>
          게시글 ({posts.length})
        </button>
      </div>

      {loading && <div style={{ textAlign:'center', padding:'24px', color:'var(--gray)', fontSize:12 }}>불러오는 중...</div>}

      {/* ── 승인 대기 ── */}
      {tab === 'pending' && !loading && (
        <div style={tableCard}>
          {pending.length === 0 && (
            <div style={{ textAlign:'center', padding:'28px', fontSize:12, color:'var(--gray)' }}>
              대기 중인 가입 신청이 없습니다 ✅
            </div>
          )}
          {pending.map(r => (
            <div key={r.id} style={{ ...row, flexDirection:'column', alignItems:'stretch', gap:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>{r.dong}동 {r.ho}호</div>
                  <div style={{ fontSize:11, color:'var(--gray)', marginTop:2 }}>
                    {r.type} 타입 · {r.floor}층 ·{' '}
                    <span style={{ color: r.resident_type === '조합원' ? 'var(--cyan)' : 'var(--gold)', fontWeight:600 }}>
                      {r.resident_type || '일반분양'}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--gray)', marginTop:1 }}>아이디: {r.username} · {formatDate(r.created_at)}</div>
                </div>
              </div>

              {r.verify_note && (
                <div style={{ background:'rgba(11,40,73,0.04)', border:'1px solid rgba(11,40,73,0.1)', borderRadius:8, padding:'8px 10px', fontSize:11, color:'var(--text-2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                  💬 {r.verify_note}
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <button
                  style={{ flex:2, padding:'9px', background:'var(--navy)', border:'none', borderRadius:9, color:'#FFF', fontSize:12, fontWeight:700, opacity: actionLoading === r.id ? 0.5 : 1 }}
                  disabled={actionLoading === r.id}
                  onClick={() => approveUser(r.id)}>
                  ✓ 승인
                </button>
                <button
                  style={{ flex:1, padding:'9px', background:'transparent', border:'1px solid rgba(217,69,69,0.4)', borderRadius:9, color:'var(--red)', fontSize:12, fontWeight:600, opacity: actionLoading === r.id ? 0.5 : 1 }}
                  disabled={actionLoading === r.id}
                  onClick={() => rejectUser(r.id)}>
                  거절
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 승인 회원 ── */}
      {tab === 'residents' && !loading && (
        <div style={tableCard}>
          {residents.length === 0 && <div style={{ textAlign:'center', padding:'20px', fontSize:12, color:'var(--gray)' }}>승인된 회원이 없습니다.</div>}
          {residents.map((r, i) => (
            <div key={r.id} style={{ ...row, flexDirection:'column', alignItems:'stretch', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:22, fontSize:10, color:'var(--gray)', flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  {editingId === r.id ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <input
                        value={editDong} onChange={e => setEditDong(e.target.value)}
                        placeholder="동" maxLength={3}
                        style={{ width:44, padding:'4px 6px', border:'1px solid var(--navy)', borderRadius:6, fontSize:12, textAlign:'center' }}
                      />
                      <span style={{ fontSize:12, color:'var(--gray)' }}>동</span>
                      <input
                        value={editHo} onChange={e => setEditHo(e.target.value)}
                        placeholder="호수" maxLength={5}
                        style={{ width:56, padding:'4px 6px', border:'1px solid var(--navy)', borderRadius:6, fontSize:12, textAlign:'center' }}
                      />
                      <span style={{ fontSize:12, color:'var(--gray)' }}>호</span>
                      <button
                        style={{ padding:'4px 10px', background:'var(--navy)', border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', opacity: actionLoading === r.id ? 0.5 : 1 }}
                        disabled={actionLoading === r.id}
                        onClick={() => saveUnitEdit(r.id)}>저장</button>
                      <button
                        style={{ padding:'4px 8px', background:'transparent', border:'1px solid var(--border)', borderRadius:6, color:'var(--gray)', fontSize:11, cursor:'pointer' }}
                        onClick={() => setEditingId(null)}>취소</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.dong}동 {r.ho}호</div>
                      <button
                        onClick={() => startEdit(r)}
                        style={{ fontSize:10, padding:'2px 7px', background:'rgba(11,40,73,0.06)', border:'1px solid rgba(11,40,73,0.15)', borderRadius:6, color:'var(--navy)', cursor:'pointer' }}>
                        ✏️ 수정
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>
                    {r.type} · {r.floor}층 · {r.nickname} ·{' '}
                    <span style={{ color: r.resident_type === '조합원' ? 'var(--cyan)' : 'var(--gold)' }}>
                      {r.resident_type || '일반분양'}
                    </span>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  <div style={{ fontSize:9, color:'var(--gray)' }}>{formatDate(r.created_at)}</div>
                  <button
                    style={{ fontSize:10, padding:'4px 8px', background:'transparent', border:'1px solid rgba(217,69,69,0.35)', borderRadius:6, color:'var(--red)', opacity: actionLoading === r.id ? 0.5 : 1 }}
                    disabled={actionLoading === r.id}
                    onClick={() => deleteResident(r.id, `${r.dong}동 ${r.ho}호`)}>
                    탈퇴처리
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 게시글 ── */}
      {tab === 'posts' && !loading && (
        <div style={tableCard}>
          {posts.length === 0 && <div style={{ textAlign:'center', padding:'20px', fontSize:12, color:'var(--gray)' }}>게시글이 없습니다.</div>}
          {posts.map((p, i) => (
            <div key={p.id} style={row}>
              <div style={{ width:22, fontSize:10, color:'var(--gray)' }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>{p.nickname} · {p.dong}동 {p.ho}호</div>
              </div>
              <div style={{ fontSize:10, color:'var(--gray)', flexShrink:0 }}>{formatDate(p.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      <button style={refreshBtn} onClick={fetchAll}>🔄 새로고침</button>

      {/* ── 실거래가 동기화 현황 ── */}
      <div style={{ background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'16px', marginTop:12, boxShadow:'var(--shadow-sm)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--navy)', letterSpacing:1, marginBottom:6 }}>📡 실거래가 동기화 현황</div>
        <div style={{ fontSize:10, color:'var(--gray)', marginBottom:12, lineHeight:1.7, padding:'8px 10px', background:'rgba(200,168,64,0.06)', border:'1px solid rgba(200,168,64,0.2)', borderRadius:8 }}>
          ⚠️ MOLIT(국토부) API는 Vercel 서버 IP를 차단합니다.<br/>
          실제 동기화는 <b>Mac에서 매일 오전 9시</b> 자동 실행됩니다.<br/>
          <code style={{ fontSize:9, background:'rgba(0,0,0,0.05)', padding:'1px 4px', borderRadius:3 }}>
            cd ~/projects/ellavine && LAWD_CD=ALL node scripts/sync-molit.js
          </code>
        </div>
        <button
          style={{ width:'100%', padding:'10px', background: syncLoading ? 'var(--gray)' : 'var(--navy)', border:'none', borderRadius:10, color:'#FFF', fontSize:12, fontWeight:700, opacity: syncLoading ? 0.6 : 1, marginBottom:8 }}
          disabled={syncLoading}
          onClick={checkSyncStatus}>
          {syncLoading ? '⏳ 조회 중...' : '🔍 Supabase 동기화 현황 확인'}
        </button>
        {syncStatus && (
          syncStatus.error
          ? <div style={{ padding:'8px 10px', background:'rgba(217,69,69,0.06)', border:'1px solid rgba(217,69,69,0.2)', borderRadius:8, fontSize:10, color:'var(--red)' }}>❌ {syncStatus.error}</div>
          : <div style={{ padding:'10px 12px', background:'rgba(11,40,73,0.04)', border:'1px solid rgba(11,40,73,0.1)', borderRadius:8, fontSize:10, color:'var(--text)', lineHeight:1.8 }}>
              ✅ <b>최근 60일 신고 데이터</b><br/>
              📅 기간: {syncStatus.dateRange}<br/>
              📊 오늘({new Date().toISOString().slice(0,10)}) 신규: <b style={{ color: syncStatus.todayCount > 0 ? 'var(--navy)' : 'var(--gray)' }}>{syncStatus.todayCount}건</b><br/>
              📈 최근 7일 신규: {syncStatus.weekCount}건 · 전체: {syncStatus.total}건
            </div>
        )}
      </div>

      {/* ── 푸시 알림 DB 마이그레이션 안내 ── */}
      <div style={{ marginTop:16, background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'14px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--navy)', letterSpacing:1, marginBottom:8 }}>🔔 푸시알림 DB 설정 (최초 1회)</div>
        <div style={{ fontSize:10, color:'var(--gray)', lineHeight:1.7, marginBottom:10 }}>
          Supabase 대시보드 → SQL Editor에서 아래 SQL을 실행하세요
        </div>
        <pre style={{ background:'rgba(11,40,73,0.04)', border:'1px solid var(--border)', borderRadius:8, padding:'10px', fontSize:9, color:'var(--text)', overflowX:'auto', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
{`CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  endpoint    TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT,
  keys_auth   TEXT,
  username    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);`}
        </pre>
        <a
          href="https://supabase.com/dashboard/project/wtdohajsvwkpdzktucrd/sql"
          target="_blank" rel="noopener noreferrer"
          style={{ display:'block', textAlign:'center', marginTop:8, padding:'8px', background:'rgba(11,40,73,0.06)', border:'1px solid rgba(11,40,73,0.15)', borderRadius:8, fontSize:11, color:'var(--navy)', fontWeight:600, textDecoration:'none' }}>
          🔗 Supabase SQL Editor 열기 →
        </a>
      </div>
    </div>
  );
}

const wrap = { padding:'16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:2 };
const sectionSub = { fontSize:11, color:'var(--gray)' };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:20, borderRadius:1 };
const backBtn = { width:36, height:36, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, fontSize:16, color:'var(--text)', flexShrink:0 };
const alertBox = { background:'rgba(217,69,69,0.08)', border:'1px solid rgba(217,69,69,0.2)', borderRadius:10, padding:'12px', fontSize:12, color:'var(--red)', marginBottom:16 };
const statCard = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, padding:'14px', textAlign:'center', boxShadow:'var(--shadow-sm)' };
const tabRow = { display:'flex', gap:6, marginBottom:12 };
const tabBtn = { flex:1, padding:'7px 4px', background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:8, color:'var(--gray)', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', gap:4 };
const tabActive = { background:'var(--navy)', color:'#FFFFFF', fontWeight:700, border:'none' };
const badge = { background:'var(--gold)', color:'var(--navy)', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:700 };
const tableCard = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-sm)' };
const row = { display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid var(--border)' };
const refreshBtn = { width:'100%', padding:'12px', background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:10, color:'var(--navy)', fontSize:12, fontWeight:600, marginTop:12 };
